/**
 * Tenant guardrail: resolve organization_id (and tenant_id) for the current request.
 * Used to set Postgres session variable app.tenant_id so RLS policies can enforce isolation.
 * @see supabase/migrations/20260311130000_tenant_context_guardrail.sql
 */
import type { TrpcContext } from "./context";

/**
 * Returns the organization ID (UUID) to use for app.tenant_id in Postgres.
 * RLS policies compare organization_id = current_tenant_id(); this is the value the app must set.
 */
export function getOrganizationIdForGuardrail(ctx: TrpcContext): string | null {
  return ctx.organizationId ?? null;
}

/**
 * Returns the integer tenant ID if available (from tenant_organization_map or canonical org UUID).
 */
export function getTenantIdForGuardrail(ctx: TrpcContext): number | null {
  return ctx.tenantId ?? null;
}
