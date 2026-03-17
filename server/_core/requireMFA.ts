/**
 * MFA enforcement for global owners. Use after protectedProcedure (or admin/owner).
 * Non–global-owner users are not required to have MFA.
 */
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

/** Client-detectable message for redirect to MFA setup. */
export const MFA_SETUP_REQUIRED = "MFA_SETUP_REQUIRED";

/** Client-detectable message for redirect to MFA verify (re-verify). */
export const MFA_REVERIFY_REQUIRED = "MFA_REVERIFY_REQUIRED";

const MFA_REVERIFY_AGE_MS = 12 * 60 * 60 * 1000; // 12h

export function createRequireMFA(t: { middleware: (fn: unknown) => unknown }) {
  return t.middleware(async (opts: { ctx: TrpcContext; next: (o: { ctx: TrpcContext }) => Promise<unknown> }) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    if (!ctx.isGlobalOwner) {
      return next({ ctx });
    }

    if (process.env.E2E_MFA_BYPASS === "1") {
      return next({ ctx });
    }

    const user = ctx.user as { mfaEnabled?: boolean; mfaLastVerifiedAt?: Date | string | null };
    if (!user.mfaEnabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MFA_SETUP_REQUIRED,
      });
    }

    const last = user.mfaLastVerifiedAt;
    if (last) {
      const lastMs = typeof last === "string" ? new Date(last).getTime() : (last as Date).getTime();
      if (Number.isFinite(lastMs) && Date.now() - lastMs > MFA_REVERIFY_AGE_MS) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MFA_REVERIFY_REQUIRED,
        });
      }
    } else {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MFA_REVERIFY_REQUIRED,
      });
    }

    return next({ ctx });
  });
}
