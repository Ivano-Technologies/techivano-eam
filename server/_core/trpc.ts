import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { createRequirePermission, createRequireRole } from "./rbac";
import { createRequireMFA } from "./requireMFA";
import { createRequireRecentAuth } from "./requireRecentAuth";
import { runWithTenantContext } from "./tenantContext";
import { runWithTenantDb } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

/** RBAC: org-scoped role/permission middleware. Use after protectedOrgProcedure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireRole = createRequireRole(t as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requirePermission = createRequirePermission(t as any);

/** MFA: enforced for global owners on admin/owner procedures. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireMFA = createRequireMFA(t as any) as any;

/** Step-up: require MFA verified within maxAgeMinutes (default 10). Use for highest-risk actions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireRecentAuth = createRequireRecentAuth(t as any, 10) as any;

export const router = t.router;

/** Runs every procedure inside tenant context (AsyncLocalStorage). When organizationId is set, also runs in a Postgres transaction with set_config('app.tenant_id') so RLS enforces isolation. */
const tenantContextMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const runNext = () =>
    runWithTenantContext(
      {
        organizationId: ctx.organizationId ?? null,
        tenantId: ctx.tenantId ?? null,
      },
      () => next({ ctx })
    );
  if (ctx.organizationId) {
    return runWithTenantDb(ctx.organizationId, runNext);
  }
  return runNext();
});

export const publicProcedure = t.procedure.use(tenantContextMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

const requireOrganizationContext = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization context is required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organizationId: ctx.organizationId,
      tenantId: ctx.tenantId,
    },
  });
});

export const protectedOrgProcedure = protectedProcedure.use(requireOrganizationContext);

const requireAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user || ctx.user.role !== 'admin') {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Admin-only procedures; MFA required for global owners. */
export const adminProcedure = protectedProcedure.use(requireAdmin).use(requireMFA);

/** Global owner only (email in GLOBAL_OWNER_EMAILS). Use for impersonation, not org-scoped owner. */
const requireGlobalOwner = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.isGlobalOwner) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Global owner access required" });
  }
  return next({ ctx });
});

export const globalOwnerProcedure = protectedProcedure.use(requireGlobalOwner).use(requireMFA);
