// @ts-nocheck — auth sub-router (HIGH-11)
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, getAuthSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  setSession: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      rememberMe: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getUserFromSupabaseToken } = await import("../_core/supabaseAuth");
      const user = await getUserFromSupabaseToken(input.accessToken);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired session token",
        });
      }
      const u = user as { status?: string };
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
      return { success: true, user };
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
      const { isAllowedSignupEmail } = await import("../_core/signupDomain");
      if (!isAllowedSignupEmail(input.email, ctx.req)) {
        const domain = input.email.split("@")[1] ?? "unknown";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Signup is not allowed for @${domain}. Only configured organization domains may register. Contact your administrator or use an allowed email.`,
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
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const { generateResetToken } = await import("../passwordReset");
      const { sendEmail } = await import("../emailService");
      const { ENV } = await import("../_core/env");
      const { logger } = await import("../_core/logger");
      const result = await generateResetToken(input.email);
      if (!result) {
        return {
          success: true,
          message:
            "If an account exists with this email, you will receive a password reset link.",
        };
      }
      const resetLink = `${ENV.appUrl}/reset-password?token=${result.token}`;
      const { renderPasswordResetEmail } = await import("../emailTemplates");
      const sent = await sendEmail({
        to: input.email,
        subject: "Reset your NRCS EAM password",
        html: renderPasswordResetEmail(resetLink),
      });
      if (!sent) {
        logger.warn("Password reset email could not be sent; check email/Forge configuration", {
          to: input.email,
        });
      }
      return {
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      };
    }),
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input }) => {
      const { resetPassword } = await import("../passwordReset");
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
});
