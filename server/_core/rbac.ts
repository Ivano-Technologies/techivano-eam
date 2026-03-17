/**
 * RBAC helpers for org-scoped procedures. Use with tRPC middleware after protectedOrgProcedure.
 * Single source of truth: organization_members.role (+ permissions for overrides).
 * Org-scoped procedures must use at least requireRole('viewer') (or equivalent) so membership
 * is always enforced before any role/permission logic.
 * RLS alignment: RLS policies enforce "user in organization_members" for org-scoped tables only;
 * they do not restrict by role. Backend RBAC here enforces role (viewer/manager/admin). Both
 * layers together give defense-in-depth; optional later: role-based RLS (e.g. role in ('admin','owner')).
 */
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

export const roleRank: Record<OrgRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1,
};

function getRoleRank(role: string): number {
  return roleRank[role as OrgRole] ?? 0;
}

/**
 * Strict permission check: only true if perms[key] === true (not truthy).
 * Use for feature flags; validates structure so permissions stay key -> boolean.
 */
export function hasPermission(perms: unknown, key: string): boolean {
  return Boolean(
    perms &&
      typeof perms === "object" &&
      !Array.isArray(perms) &&
      (perms as Record<string, unknown>)[key] === true
  );
}

type MiddlewareBuilder = {
  middleware: (fn: (opts: { ctx: TrpcContext; next: (opts: { ctx: TrpcContext }) => Promise<unknown> }) => Promise<unknown>) => unknown;
};

/**
 * Returns a function that, given minRole, returns a tRPC middleware enforcing at least that org role.
 * Use after protectedOrgProcedure. Throws FORBIDDEN if not a member or insufficient role.
 */
export function createRequireRole(t: MiddlewareBuilder) {
  return (minRole: OrgRole) =>
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        });
      }
      const userRole = ctx.membership.role;
      if (getRoleRank(userRole) < getRoleRank(minRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        });
      }
      return next({ ctx });
    });
}

/**
 * Returns a function that, given a permission key, returns a tRPC middleware enforcing that key in ctx.membership.permissions.
 * Use for feature flags / one-off overrides. Use after protectedOrgProcedure (and typically after requireRole).
 * Enforces membership existence before reading permissions.
 */
export function createRequirePermission(t: MiddlewareBuilder) {
  return (key: string) =>
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        });
      }
      if (!hasPermission(ctx.membership.permissions, key)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing permission: ${key}`,
        });
      }
      return next({ ctx });
    });
}
