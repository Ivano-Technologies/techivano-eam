/**
 * Test context helpers for server tests that need organization/tenant context.
 * Use these when calling tRPC procedures that require resolveTenantIdFromContext
 * (e.g. dashboard, sites, assets, notifications).
 *
 * Required env for DB-dependent tests: DATABASE_URL (see .env.example).
 */
import type { TrpcContext } from "../_core/context";

/** Canonical organization UUID for tenant id 1 (used in tests when DB is available). */
export const TEST_ORG_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_TENANT_ID = 1;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

export function createTestContextWithOrg(
  role: "admin" | "manager" | "technician" | "user" = "admin",
  overrides?: { userId?: number; email?: string }
): TrpcContext {
  const user: AuthenticatedUser = {
    id: overrides?.userId ?? 1,
    openId: "test-user",
    email: overrides?.email ?? "test@nrcs.org",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    organizationId: TEST_ORG_ID,
    tenantId: TEST_TENANT_ID,
  };
}
