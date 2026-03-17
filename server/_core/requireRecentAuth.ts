/**
 * Step-up auth: require recent MFA verification (or session) for high-risk actions.
 * Use with requireMFA on owner/admin procedures (e.g. delete org, change roles, billing).
 */
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

export const REAUTH_REQUIRED = "REAUTH_REQUIRED";

export function createRequireRecentAuth(t: { middleware: (fn: unknown) => unknown }, maxAgeMinutes = 10) {
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  return t.middleware(async (opts: { ctx: TrpcContext; next: (o: { ctx: TrpcContext }) => Promise<unknown> }) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    const user = ctx.user as { mfaLastVerifiedAt?: Date | string | null };
    const last = user.mfaLastVerifiedAt;
    if (!last) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: REAUTH_REQUIRED,
      });
    }
    const lastMs = typeof last === "string" ? new Date(last).getTime() : (last as Date).getTime();
    if (!Number.isFinite(lastMs) || Date.now() - lastMs > maxAgeMs) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: REAUTH_REQUIRED,
      });
    }

    return next({ ctx });
  });
}
