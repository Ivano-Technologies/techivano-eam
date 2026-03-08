export function assertTenantMatch(authenticatedTenantId: number, requestedTenantId: number) {
  if (authenticatedTenantId !== requestedTenantId) {
    throw new Error("Tenant mismatch");
  }
}
