import { z } from "zod";

export const TenantScopedPayloadSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
});

export type TenantScopedPayload = z.infer<typeof TenantScopedPayloadSchema>;

/**
 * Canonical tenant resolver for migration window:
 * tenant_id -> business_id -> authenticated user id.
 */
export function resolveTenantId(
  userId: string,
  scoped?: TenantScopedPayload | null,
): string {
  return scoped?.tenant_id ?? scoped?.business_id ?? userId;
}

export function ensureTenantMatch(
  authenticatedTenantId: string,
  scoped?: TenantScopedPayload | null,
): void {
  const requestedTenantId = resolveTenantId(authenticatedTenantId, scoped);
  if (requestedTenantId !== authenticatedTenantId) {
    throw new Error("Tenant mismatch for authenticated context");
  }
}

export function withTenantId<T extends Record<string, unknown>>(
  tenantId: string,
  payload: T,
): T & { tenant_id: string } {
  return {
    ...payload,
    tenant_id: tenantId,
  };
}
