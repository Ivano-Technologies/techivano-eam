// @ts-nocheck — auth sub-router (HIGH-11)
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, SESSION_COOKIE_NAME, DEV_BYPASS_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, getAuthSessionCookieOptions } from "../_core/cookies";
import type { MembershipContext } from "../_core/context";
import { isGlobalOwnerEmail } from "../_core/env";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { verifyTurnstileToken } from "../_core/turnstile";
import { logSecurityAudit } from "../audit/logSecurityAudit";
import * as db from "../db";

export type MeResponse = NonNullable<import("../_core/context").TrpcContext["user"]> & {
  membership: MembershipContext | null;
  isGlobalOwner: boolean;
  mfaRequired: boolean;
  mfaReverifyRequired: boolean;
  isImpersonating: boolean;
  impersonatorId: string | null;
};

export const authRouter = router({
  me: publicProcedure.query((opts): MeResponse | null => {
    const user = opts.ctx.user;
    const membership = opts.ctx.membership ?? null;
    if (!user) return null;
    const u = user as { mfaEnabled?: boolean; mfaLastVerifiedAt?: Date | string | null };
    const mfaRequired = opts.ctx.isGlobalOwner && !(u.mfaEnabled === true);
    const mfaReverifyRequired =
      opts.ctx.isGlobalOwner &&
      u.mfaEnabled === true &&
      (() => {
        const last = u.mfaLastVerifiedAt;
        if (!last) return true;
        const ms = typeof last === "string" ? new Date(last).getTime() : (last as Date).getTime();
        return Date.now() - ms > 12 * 60 * 60 * 1000;
      })();
    return {
      ...user,
      membership,
      isGlobalOwner: opts.ctx.isGlobalOwner,
      mfaRequired,
      mfaReverifyRequired,
      isImpersonating: opts.ctx.isImpersonating ?? false,
      impersonatorId: opts.ctx.impersonatorId ?? null,
    } as MeResponse;
  }),
  /** Verify Cloudflare Turnstile token (bot protection). Call before magic link or OAuth. */
  verifyTurnstile: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const result = await verifyTurnstileToken(input.token, ctx.req.ip ?? undefined);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification failed. Please try again.",
        });
      }
      return { success: true } as const;
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    const cookieHeader = ctx.req.headers.cookie;
    if (typeof cookieHeader === "string") {
      const { parse: parseCookie } = await import("cookie");
      const cookies = parseCookie(cookieHeader);
      const sessionId = cookies[SESSION_COOKIE_NAME];
      if (sessionId) await db.revokeSessionById(sessionId);
    }
    await logSecurityAudit(ctx, { action: "auth.logout" });
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    if (process.env.NODE_ENV === "development") {
      ctx.res.clearCookie(DEV_BYPASS_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    }
    return { success: true } as const;
  }),
  setSession: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      rememberMe: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getUserFromSupabaseToken } = await import("../_core/supabaseAuth");
      const { getUserFromClerkToken } = await import("../_core/clerkAuth");
      const user =
        (await getUserFromClerkToken(input.accessToken)) ??
        (await getUserFromSupabaseToken(input.accessToken));
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired session token",
        });
      }
      const u = user as { status?: string; supabaseUserId?: string | null; openId?: string | null; email?: string | null };
      if (u.status === "pending") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is pending admin approval.",
        });
      }
      if (u.status === "rejected" || u.status === "inactive") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is not active. Please contact the administrator.",
        });
      }
      ctx.res.cookie(
        COOKIE_NAME,
        input.accessToken,
        getAuthSessionCookieOptions(ctx.req, { rememberMe: input.rememberMe })
      );
      const sessionIdentityId =
        (typeof u.supabaseUserId === "string" && u.supabaseUserId) ||
        (typeof u.openId === "string" && u.openId) ||
        null;
      if (sessionIdentityId) {
        try {
          const sessionId = await db.createUserSession({
            userId: sessionIdentityId,
            userAgent: ctx.req.headers["user-agent"],
            ip: ctx.req.ip,
          });
          if (sessionId) {
            const sessionCookieOpts = getAuthSessionCookieOptions(ctx.req, { rememberMe: input.rememberMe });
            ctx.res.cookie(SESSION_COOKIE_NAME, sessionId, { ...sessionCookieOpts, httpOnly: true, path: "/", sameSite: sessionCookieOpts.sameSite, secure: sessionCookieOpts.secure, ...(sessionCookieOpts.maxAge != null && { maxAge: sessionCookieOpts.maxAge }) });
          }
        } catch {
          // user_sessions table may not be migrated yet; session tracking is non-critical
        }
      }
      let requiresPasswordSetup = false;
      let mandatoryForOwner = false;
      if (typeof u.supabaseUserId === "string") {
        const { checkRequiresPasswordSetup } = await import("../supabaseAdmin");
        const check = await checkRequiresPasswordSetup(u.supabaseUserId);
        requiresPasswordSetup = check.requiresPasswordSetup;
        const email = check.email ?? u.email ?? null;
        mandatoryForOwner = requiresPasswordSetup && isGlobalOwnerEmail(email);
      }
      await logSecurityAudit(ctx, {
        action: "auth.login",
        metadata: { userId: sessionIdentityId ?? undefined },
      });
      return { success: true, user, requiresPasswordSetup, mandatoryForOwner };
    }),
  signup: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { isAllowedSignupEmail } = await import("../_core/signupDomain");
      if (!isAllowedSignupEmail(input.email, ctx.req)) {
        const domain = input.email.split("@")[1] ?? "unknown";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Signup is not allowed for @${domain}. Only configured organization domains may register. Contact your administrator or use an allowed email.`,
        });
      }
      const { createSignupRequest } = await import("../magicLinkAuth");
      return await createSignupRequest(input.email, input.name);
    }),
  /** @deprecated Prefer client-side Supabase magic link (signInWithOtp) on the login page. This sends an app-generated link; verification no longer sets a session cookie (Option A). */
  requestMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user) {
        return { success: false, message: "No account found with this email" };
      }
      const { createMagicLinkToken, sendMagicLink } = await import("../magicLinkAuth");
      const token = await createMagicLinkToken(user.id);
      const sent = await sendMagicLink(input.email, token);
      if (sent) {
        return { success: true, message: "Magic link sent to your email" };
      }
      return { success: false, message: "Failed to send magic link" };
    }),
  signupWithPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8, "Password must be at least 8 characters"),
      turnstileToken: z.string().optional(),
      jobTitle: z.string().optional(),
      phoneNumber: z.string().optional(),
      phoneCountryCode: z.string().optional(),
      agency: z.string().optional(),
      geographicalArea: z.string().optional(),
      registrationPurpose: z.string().optional(),
      employeeId: z.string().optional(),
      department: z.string().optional(),
      supervisorName: z.string().optional(),
      supervisorEmail: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { ENV } = await import("../_core/env");
      if (ENV.turnstileSecretKey && process.env.NODE_ENV !== "test") {
        const result = await verifyTurnstileToken(input.turnstileToken ?? null, ctx.req.ip ?? undefined);
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Verification failed. Please try again.",
          });
        }
      }
      const { isAllowedSignupEmail } = await import("../_core/signupDomain");
      if (!isAllowedSignupEmail(input.email, ctx.req)) {
        const domain = input.email.split("@")[1] ?? "unknown";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Signup is not allowed for @${domain}. Only configured organization domains may register. Contact your administrator or use an allowed email.`,
        });
      }
      if (isGlobalOwnerEmail(input.email) && input.password.length < 12) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Global owner accounts require a password of at least 12 characters.",
        });
      }
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An account with this email already exists",
        });
      }
      const { createUserWithPassword } = await import("../passwordAuth");
      const user = await createUserWithPassword(
        input.email,
        input.name,
        input.password,
        {
          jobTitle: input.jobTitle,
          phoneNumber: input.phoneNumber,
          phoneCountryCode: input.phoneCountryCode,
          agency: input.agency,
          geographicalArea: input.geographicalArea,
          registrationPurpose: input.registrationPurpose,
          employeeId: input.employeeId,
          department: input.department,
          supervisorName: input.supervisorName,
          supervisorEmail: input.supervisorEmail,
        }
      );
      return {
        success: true,
        message:
          "Registration submitted successfully. An administrator will review your request.",
        user,
      };
    }),
  /** Legacy app password login removed. Use Supabase Auth: client calls supabase.auth.signInWithPassword then auth.setSession(accessToken). */
  loginWithPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Password login is via Supabase Auth only. Use the sign-in form to sign in with email/password; your session will be set automatically.",
      });
    }),

  /**
   * Migrate a legacy password user (created via signupWithPassword, stored in our DB only)
   * into Supabase Auth so they can sign in with email/password. Call this when
   * signInWithPassword fails with "Invalid login credentials" and the user may be legacy.
   * On success, client should retry signInWithPassword.
   */
  migrateLegacyPasswordUser: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const { authenticateWithPassword } = await import("../passwordAuth");
      const { createAuthUserWithPassword } = await import("../supabaseAdmin");
      const user = await authenticateWithPassword(input.email, input.password);
      if (!user) {
        return { success: false as const, reason: "invalid_credentials" };
      }
      const u = user as { id: number; supabaseUserId?: string | null };
      if (u.supabaseUserId) {
        return { success: false as const, reason: "already_migrated" };
      }
      const supabaseUserId = await createAuthUserWithPassword(input.email, input.password);
      if (!supabaseUserId) {
        return { success: false as const, reason: "supabase_create_failed" };
      }
      await db.setUserSupabaseId(u.id, supabaseUserId);
      const { invalidateUserCache } = await import("../_core/userCache");
      await invalidateUserCache(supabaseUserId);
      return { success: true as const };
    }),
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const successPayload = {
        success: true as const,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      };
      try {
        const { generateResetToken } = await import("../passwordReset");
        const { sendEmail } = await import("../emailService");
        const { ENV } = await import("../_core/env");
        const { logger } = await import("../_core/logger");
        const result = await generateResetToken(input.email);
        if (!result) {
          return successPayload;
        }
        const resetLink = `${ENV.appUrl}/reset-password?token=${result.token}`;
        const { renderPasswordResetEmail } = await import("../emailTemplates");
        const sent = await sendEmail({
          to: input.email,
          subject: "Reset your NRCS EAM password",
          html: renderPasswordResetEmail(resetLink),
        });
        if (!sent) {
          logger.warn("Password reset email could not be sent; check email/Resend configuration", {
            to: input.email,
          });
        }
        return successPayload;
      } catch (err) {
        const { logger } = await import("../_core/logger");
        logger.error(err, "Password reset request failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to send the reset link. Please try again later.",
        });
      }
    }),
  /**
   * Set password for current session user (e.g. after OAuth when requiresPasswordSetup).
   * Enforces min 8 chars; global owner emails require 12+.
   */
  setPassword: publicProcedure
    .input(z.object({ newPassword: z.string().min(8, "Password must be at least 8 characters") }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      }
      const u = user as { email?: string | null; supabaseUserId?: string | null };
      if (isGlobalOwnerEmail(u.email) && input.newPassword.length < 12) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Global owner accounts require a password of at least 12 characters.",
        });
      }
      const supabaseUserId = u.supabaseUserId;
      if (typeof supabaseUserId !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot set password for this account.",
        });
      }
      const { updateAuthUserPassword } = await import("../supabaseAdmin");
      const ok = await updateAuthUserPassword(supabaseUserId, input.newPassword);
      if (!ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update password. Please try again.",
        });
      }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input }) => {
      const { resetPassword, verifyResetToken } = await import("../passwordReset");
      const userId = await verifyResetToken(input.token);
      if (userId) {
        const u = await db.getRootUserById(userId);
        if (u?.email && isGlobalOwnerEmail(u.email) && input.newPassword.length < 12) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Global owner accounts require a password of at least 12 characters.",
          });
        }
      }
      const success = await resetPassword(input.token, input.newPassword);
      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }
      return {
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
      };
    }),

  /**
   * Called after client completes Supabase TOTP enroll + verify. Sets mfa_enabled and mfa_last_verified_at.
   */
  mfaConfirmEnrollment: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user as { id: number; email?: string | null };
    if (!user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }
    await db.setUserMfaEnrolled(user.id, isGlobalOwnerEmail(user.email));
    const { invalidateUserCache } = await import("../_core/userCache");
    const supabaseUserId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
    if (typeof supabaseUserId === "string") {
      await invalidateUserCache(supabaseUserId);
    }
    await logSecurityAudit(ctx, { action: "mfa.enabled" });
    return { success: true };
  }),

  /**
   * Refresh mfa_last_verified_at after a successful TOTP challenge (e.g. at login or step-up).
   */
  mfaUpdateVerifiedAt: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user as { id: number };
    if (!user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }
    await db.setUserMfaVerifiedAt(user.id);
    const { invalidateUserCache } = await import("../_core/userCache");
    const supabaseUserId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
    if (typeof supabaseUserId === "string") {
      await invalidateUserCache(supabaseUserId);
    }
    await logSecurityAudit(ctx, { action: "mfa.verified" });
    return { success: true };
  }),
});
