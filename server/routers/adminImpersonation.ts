import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@shared/const";
import { globalOwnerProcedure, router } from "../_core/trpc";
import { logSecurityAudit } from "../audit/logSecurityAudit";
import { signImpersonationToken } from "../_core/impersonationToken";
import * as db from "../db";

export const adminImpersonationRouter = router({
  /** Start impersonating another user. Returns signed token; client sends it in x-impersonation header. */
  startImpersonation: globalOwnerProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isImpersonating) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot start impersonation while already impersonating",
        });
      }
      const impersonatorId = (ctx.user as { supabaseUserId?: string | null }).supabaseUserId;
      if (typeof impersonatorId !== "string" || impersonatorId === input.targetUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid target user",
        });
      }
      const targetUser = await db.getUserBySupabaseUserId(input.targetUserId);
      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target user not found",
        });
      }
      const cookieHeader = ctx.req.headers.cookie;
      const sessionId =
        typeof cookieHeader === "string"
          ? parseCookie(cookieHeader)[SESSION_COOKIE_NAME]
          : undefined;
      const token = signImpersonationToken({
        impersonatorId,
        targetUserId: input.targetUserId,
        sessionId: sessionId ?? undefined,
      });
      await logSecurityAudit(ctx, {
        action: "impersonation.start",
        metadata: { impersonatorId, targetUserId: input.targetUserId },
      });
      return { impersonationToken: token };
    }),

  /** Stop impersonating (audit only; client clears header/token). */
  stopImpersonation: globalOwnerProcedure.mutation(async ({ ctx }) => {
    await logSecurityAudit(ctx, {
      action: "impersonation.stop",
      metadata: { impersonatorId: ctx.impersonatorId },
    });
    return { success: true };
  }),
});
