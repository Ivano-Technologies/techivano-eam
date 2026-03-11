import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { runWithTenantContext } from "./tenantContext";
import { runWithTenantDb } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

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

/** Admin-only procedures; still run with tenant context when organizationId is set. */
export const adminProcedure = protectedProcedure.use(requireAdmin);
