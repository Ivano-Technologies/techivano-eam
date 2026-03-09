# Phase 3 — Multi-Tenant Migration & RLS Rollout

**Date:** 2025-03-09  
**Scope:** organization_id rollout, backfill, RLS, server filtering, worker compatibility, and legacy field deprecation.

**Phase 4 complete:** Legacy columns removed from core tables; final architecture in `docs/PHASE4I_FINAL_MULTI_TENANT_ARCHITECTURE.md`.

---

## 1. Tenant identifier migration

- **Canonical identifier:** `organization_id` (UUID). All tenant-scoped tables use this column.
- **Legacy identifiers** (deprecated; do not remove until Phase 4):
  - `tenantId` (integer)
  - `tenant_id` (uuid or integer depending on table)
  - `business_id` (uuid)
- **Mapping:** Integer `tenantId` → `organization_id` via `tenant_organization_map` when backfilling. UUID `tenant_id` / `business_id` can be used directly as `organization_id` when valid.

---

## 2. organization_id rollout

### 2.1 Tables with organization_id (Drizzle + DB)

| Table | Drizzle | Migration |
|-------|---------|-----------|
| organizations | — | Existing (20260309133000) |
| organization_members | — | Existing |
| tenant_organization_map | Phase 2 | Phase 3 migration (optional) |
| assets | Phase 3 | 20260309133000 (snake_case) + 20260309160000 (camelCase) |
| work_orders / workOrders | Phase 3 | Same |
| inspections | Phase 3 | Same |
| documents | Already had | 20260309113000 |
| maintenance_schedules / maintenanceSchedules | Phase 3 | Same |
| asset_photos / assetPhotos | Phase 3 | Same |
| vendors | Phase 3 | Same |
| compliance_records / complianceRecords | Phase 3 | Same |
| inventory_items / inventoryItems | Phase 3 | Same |
| inventory_transactions / inventoryTransactions | Phase 3 | Same |
| sites | Phase 3 | Same |
| users | — | 20260309133000 |

### 2.2 Migration steps (already in SQL)

1. **3B/3C:** Add `organization_id` and index (idempotent) for snake_case and camelCase table names.
2. **3D:** Backfill from `tenant_organization_map` for rows with integer `tenantId`/`tenant_id`.
3. **3E:** `ALTER COLUMN organization_id SET NOT NULL` only when `COUNT(*) WHERE organization_id IS NULL` = 0.
4. **3F:** Enable RLS and create policy `*_org_isolation` (using `organization_members` and `auth.uid()`).

---

## 3. RLS policy design

For each tenant table:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_org_isolation ON <table>
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
```

- **auth.uid()** is the Supabase Auth user ID. Ensure application users are linked via `organization_members.user_id` to the same identifier.

---

## 4. Server API enforcement

- **Do not rely only on RLS.** All tenant-scoped list/get operations in the server filter by `organization_id` (from `ctx.organizationId`).
- **Updated DB helpers:** `getAllAssets`, `getAllWorkOrders`, `getAllMaintenanceSchedules`, `getAllSites`, `getAllInventoryItems`, `getAllVendors`, `getAllComplianceRecords` accept optional `organizationId`; when provided, the query adds `WHERE organization_id = :orgId`.
- **Routers:** Procedures using `protectedOrgProcedure` pass `ctx.organizationId` into these DB calls so that only the current organization’s data is returned.

---

## 5. Worker compatibility

- **OCR queue** (`OcrUploadJobPayload`): Already includes `organizationId`; workers must persist document metadata with the same `organization_id`.
- **Background job payloads** (`BaseBackgroundJobPayload`): Optional `organizationId` added; workers should prefer it when writing tenant-scoped results and must include it in new job payloads when enqueueing.
- **Payload example:**
  ```json
  {
    "organizationId": "uuid",
    "documentId": 123,
    "fileKey": "..."
  }
  ```

---

## 6. Legacy field removal (Phase 4)

- **Phase 3:** Legacy columns `tenantId`, `tenant_id`, `business_id` remain. They are marked deprecated in schema comments and in job types.
- **Phase 4:** After verification and stabilisation, remove legacy columns and any code that still reads/writes them.

---

## 7. Architecture diagram

```
User Request
     ↓
Vercel API (tRPC / Express)
     ↓
resolveOrganizationContext(req, user) → ctx.organizationId
     ↓
DB layer: getAllAssets({ organizationId: ctx.organizationId })
     ↓
Supabase Postgres
     ↓
RLS: organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
     ↓
Tenant-Isolated Data
     ↓
Railway Workers (payload.organizationId)
     ↓
Cloudflare R2 (tenant-scoped keys/paths)
```

---

## 8. Related docs

| Doc | Content |
|-----|---------|
| PHASE3A_VERIFY_ORGANIZATION_TABLES.md | Verify organizations and organization_members before migration |
| PHASE3I_MIGRATION_VERIFICATION.md | Post-migration test scenarios and checklist |
| PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md | Canonical identifier and mapping strategy |
| PHASE2A_SCHEMA_INSPECTION_REPORT.md | Live DB verification SQL |
