/**
 * Tenant guardrail: request-scoped tenant context for Postgres SET LOCAL injection.
 * When using Supabase Postgres, run setTenantContextOnConnection() at the start of each request
 * so RLS policies (current_tenant_id()) enforce isolation.
 * @see supabase/migrations/20260311130000_tenant_context_guardrail.sql
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContextStorage = {
  organizationId: string | null;
  tenantId: number | null;
};

const tenantStorage = new AsyncLocalStorage<TenantContextStorage>();

/**
 * Run a function with tenant context set. Call this from tRPC middleware so all procedures see the same tenant.
 */
export function runWithTenantContext<T>(
  context: TenantContextStorage,
  fn: () => T
): T {
  return tenantStorage.run(context, fn);
}

/**
 * Get the organization ID for the current request (from AsyncLocalStorage). Used when injecting into Postgres session.
 */
export function getTenantOrganizationId(): string | null {
  const store = tenantStorage.getStore();
  return store?.organizationId ?? null;
}

/**
 * Get the tenant ID for the current request.
 */
export function getTenantId(): number | null {
  const store = tenantStorage.getStore();
  return store?.tenantId ?? null;
}

/**
 * Execute SET LOCAL app.tenant_id for the current request's Postgres connection.
 * Call this when you have a Postgres connection (e.g. from pool) before running any queries.
 * Uses set_config('app.tenant_id', orgId, true) — true = local to the transaction/session.
 * Compatible with Supabase connection pooling (SET LOCAL is connection-scoped).
 */
export type PostgresExec = (sql: string, params?: unknown[]) => Promise<unknown>;

export async function setTenantContextOnConnection(
  exec: PostgresExec,
  organizationId: string
): Promise<void> {
  await exec("SELECT set_config('app.tenant_id', $1, true)", [organizationId]);
}
