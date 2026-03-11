/**
 * Phase 8: Integration tests for auth.me and session flow.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md Phase 8
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createTestContextWithOrg } from "./test/contextHelpers";
import type { TrpcContext } from "./_core/context";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null when not authenticated", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const ctx = createTestContextWithOrg("user");
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.id).toBe(ctx.user?.id);
    expect(me?.email).toBe(ctx.user?.email);
    expect(me?.role).toBe("user");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createTestContextWithOrg();
    const clearedCookies: { name: string }[] = [];
    (ctx.res as { clearCookie?: (n: string) => void }).clearCookie = (name: string) => {
      clearedCookies.push({ name });
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies.some((c) => c.name === "app_session_id")).toBe(true);
  });
});
