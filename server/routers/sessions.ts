import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, router } from "../_core/trpc";
import { logSecurityAudit } from "../audit/logSecurityAudit";
import * as db from "../db";

export const sessionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const supabaseUserId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
    if (typeof supabaseUserId !== "string") return [];
    return db.listUserSessions(supabaseUserId);
  }),

  revoke: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const supabaseUserId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
      if (typeof supabaseUserId !== "string") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User has no session identity" });
      }
      const session = await db.getSessionById(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      if (session.userId !== supabaseUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot revoke another user's session" });
      }
      await db.revokeSessionById(input.sessionId);
      await logSecurityAudit(ctx, {
        action: "session.revoked",
        metadata: { sessionId: input.sessionId },
      });
      return { success: true };
    }),

  /** Revoke the current session (session cookie). Used by E2E and "sign out this device". */
  revokeCurrent: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieHeader = ctx.req.headers.cookie;
    const sessionId =
      typeof cookieHeader === "string" ? parseCookie(cookieHeader)[SESSION_COOKIE_NAME] : undefined;
    if (!sessionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No session to revoke" });
    }
    const supabaseUserId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
    if (typeof supabaseUserId !== "string") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User has no session identity" });
    }
    const session = await db.getSessionById(sessionId);
    if (session && session.userId === supabaseUserId) {
      await db.revokeSessionById(sessionId);
      await logSecurityAudit(ctx, {
        action: "session.revoked",
        metadata: { sessionId },
      });
    }
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    const { COOKIE_NAME } = await import("@shared/const");
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),
});
