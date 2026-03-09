# Phase 4 — Final Multi-Tenant Architecture

**Date:** 2025-03-09  
**Status:** Canonical `organization_id` model; legacy columns removed from core EAM tables; RLS and server enforcement in place.

---

## 1. Final architecture

- **Canonical tenant identifier:** `organization_id` (UUID). All tenant-scoped tables use this column.
- **Organizations:** `public.organizations` (id, name, slug, is_active, created_at, updated_at).
- **Membership:** `public.organization_members` (organization_id, user_id, role, …). Access is granted when `auth.uid()` is in this table for the given organization.
- **Legacy:** Analytics/worker tables (warehouse, vendor, procurement, supply chain, dispatch, executive, telemetry, job runs, etc.) still use integer `tenantId` / `tenant_id`. Migration to `organization_id` for those tables is deferred.
- **Mapping:** `tenant_organization_map` (tenant_id integer → organization_id uuid) for backfill and for code that only has integer tenant id.

---

## 2. Core tenant tables (organization_id only)

| Table | organization_id | Legacy columns dropped |
|-------|-----------------|-------------------------|
| assets | Yes, indexed | — (none in schema) |
| work_orders / workOrders | Yes, indexed | — |
| inspections | Yes, indexed, NOT NULL | tenantId dropped (Phase 4E) |
| documents | Yes, indexed | business_id, tenant_id dropped if present (Phase 4E) |
| maintenance_schedules / maintenanceSchedules | Yes, indexed | — |
| asset_photos / assetPhotos | Yes, indexed | — |
| vendors | Yes, indexed | — |
| compliance_records / complianceRecords | Yes, indexed | — |
| inventory_items / inventoryItems | Yes, indexed | — |
| inventory_transactions / inventoryTransactions | Yes, indexed | — |
| sites | Yes, indexed | — |
| users | Yes (migration) | — |

---

## 3. RLS enforcement

- **Enabled on:** All core tenant tables and on `organizations`, `organization_members`.
- **Policy pattern:** `organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())` for both `USING` and `WITH CHECK`.
- **Application:** Server APIs filter by `ctx.organizationId` on every tenant-scoped list/create/update; RLS enforces at the database for direct SQL and for any missed application paths.

---

## 4. Worker compatibility

- **OCR / document jobs:** Payload includes `organizationId`; workers must persist document metadata with that `organization_id`.
- **Analytics jobs:** Payloads include `tenantId` (integer); workers write to tables that still use `tenant_id`. No change in Phase 4.
- **New jobs:** Prefer `organizationId` in payloads and write results with `organization_id` when the target table has it.

---

## 5. Architecture diagram

```
User
  ↓
Vercel API (tRPC / Express)
  ↓
resolveOrganizationContext(req, user) → ctx.organizationId
  ↓
DB layer: getAll*(…, organizationId: ctx.organizationId), create*(…, organizationId: ctx.organizationId)
  ↓
Supabase Postgres
  ↓
RLS: organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ↓
Tenant-isolated database
  ↓
Railway workers (payload.organizationId for document/org-scoped jobs; payload.tenantId for analytics)
  ↓
Cloudflare R2 storage (tenant-scoped paths/keys)
```

---

## 6. Documentation index

| Document | Purpose |
|----------|---------|
| PHASE4A_VERIFY_ORGANIZATION_ID_ADOPTION.md | Verify no NULL organization_id before dropping legacy columns |
| PHASE4B_LEGACY_TENANT_FIELD_USAGE_REPORT.md | Remaining tenantId/tenant_id/business_id usage |
| PHASE4D_WORKER_COMPATIBILITY_VALIDATION.md | Worker payload and write rules |
| PHASE4G_FINAL_RLS_VALIDATION.md | RLS checks and isolation tests |
| PHASE4H_PERFORMANCE_VALIDATION.md | Index and EXPLAIN checks |
| PHASE3K_MULTI_TENANT_MIGRATION_AND_RLS.md | Phase 3 rollout and RLS design |
| PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md | Canonical identifier and mapping |

---

## 7. Migrations (order)

1. `20260309113000_tenant_file_encryption.sql` — documents organization_id, encryption.
2. `20260309133000_canonical_organization_tenancy.sql` — organizations, organization_members, organization_id on tenant tables (snake_case), RLS.
3. `20260309160000_phase3_organization_id_not_null_and_rls.sql` — camelCase tables, tenant_organization_map, backfill from map, NOT NULL, RLS.
4. `20260309180000_phase4_drop_legacy_tenant_columns.sql` — drop inspections.tenantId, documents.business_id/tenant_id (if present).
