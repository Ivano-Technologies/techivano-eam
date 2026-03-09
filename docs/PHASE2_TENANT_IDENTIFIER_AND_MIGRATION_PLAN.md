# Phase 2 — Tenant Identifier Strategy & Migration Plan

**Date:** 2025-03-09  
**Purpose:** Canonical tenant identifier, mapping from legacy fields, and safe migration plan for `organization_id` (no RLS or migrations executed yet).

---

## 1. Canonical tenant identifier

**Canonical identifier:** `organization_id` (UUID)

- Stored in Postgres as `organization_id uuid`.
- References `public.organizations(id)`.
- Used by RLS policies and application layer for tenant isolation.
- All new code and queries should scope by `organization_id` (resolved from session/context).

---

## 2. Mapping from legacy identifiers

| Legacy identifier   | Type   | Where it appears                         | Mapping to organization_id |
|---------------------|--------|------------------------------------------|-----------------------------|
| `tenantId`          | int    | Drizzle schema, server ctx, workers, many tables | **No direct cast** to UUID. Use `tenant_organization_map` or default org until backfill. |
| `tenant_id`         | uuid   | Some API routes, Supabase, migration backfill    | Use as-is when value is a valid UUID: `organization_id = tenant_id`. |
| `business_id`       | uuid   | API routes, Supabase, migration backfill         | Use as-is when value is a valid UUID: `organization_id = business_id`. |
| `organization_id`   | uuid   | documents, organization_encryption_keys, migrations | Already canonical. |

**Resolution order (when backfilling or resolving from a row):**  
`organization_id` → `tenant_id` (if UUID) → `business_id` (if UUID). For integer `tenantId`, use `tenant_organization_map` (see below) or assign a default organization and backfill the mapping table.

---

## 3. Tenant–organization mapping table (integer → UUID)

Tables that only have **integer** `tenantId` (e.g. `inspections`, `telemetry_points`, `background_job_runs`, analytics tables) cannot be backfilled to `organization_id` by casting. Options:

1. **Default organization:** Assign one organization per integer tenant (e.g. tenant_id 1 → org UUID X) and backfill `organization_id` from a mapping.
2. **Mapping table:** Add `tenant_organization_map (tenant_id integer, organization_id uuid)` so that:
   - Existing workers and jobs that only have integer `tenantId` can resolve `organization_id` via a lookup.
   - Backfill scripts can set `organization_id = (SELECT organization_id FROM tenant_organization_map WHERE tenant_id = t.tenantId)`.

The Drizzle schema now includes an optional **tenant_organization_map** table (Phase 2D). Use it if you have integer tenant IDs that must map to organizations; otherwise you can backfill from a single default org and omit the table.

---

## 4. Tables requiring organization_id (Phase 2E)

From Phase 1 audit and Supabase migration `20260309133000`:

| # | Logical table        | Drizzle table name (schema) | Migration target name | Has org_id in Drizzle? | Has legacy tenant? |
|---|----------------------|-----------------------------|------------------------|-------------------------|---------------------|
| 1 | assets               | assets                      | assets                 | No                      | No                  |
| 2 | work_orders          | workOrders                  | work_orders            | No                      | No                  |
| 3 | inspections          | inspections                 | inspections            | No                      | Yes (tenantId int)  |
| 4 | documents            | documents                   | documents              | Yes                     | —                   |
| 5 | maintenance_schedules | maintenanceSchedules        | maintenance_schedules  | No                      | No                  |
| 6 | asset_photos         | assetPhotos                 | asset_photos           | No                      | No                  |
| 7 | vendors              | vendors                     | vendors                | No                      | No                  |
| 8 | compliance_records   | complianceRecords           | compliance_records     | No                      | No                  |
| 9 | inventory_items      | inventoryItems              | inventory_items        | No                      | No                  |
|10 | inventory_transactions | inventoryTransactions    | inventory_transactions | No                      | No                  |
|11 | sites                | sites                       | sites                  | No                      | No                  |
|12 | users                | users                       | users                  | No                      | No                  |

**Already have organization_id (from migration or Drizzle):** documents.

**Migration adds organization_id only if the table exists with the exact snake_case name.** If the live DB has camelCase names (e.g. `workOrders`), the existing migration does not touch them; the plan in §6 covers that.

---

## 5. Tables with integer tenantId (for mapping table / backfill)

These have **integer** `tenantId` (or `tenant_id` in DB) and need either a default org or `tenant_organization_map` to set `organization_id`:

- inspections, inspection_templates  
- compliance_rules, compliance_events, sla_metrics  
- audit_logs (audit_logs_v1)  
- warehouse_transfer_recommendations, vendor_performance_metrics, vendor_risk_scores  
- procurement_recommendations, purchase_orders  
- supply_chain_risk_scores, supply_chain_risk_events  
- fleet_units, technicians, dispatch_assignments  
- executive_metrics_snapshots, operational_kpi_trends  
- telemetry_points, telemetry_aggregates  
- report_snapshots, predictive_scores  
- background_job_runs  
- ruvector_memories, prime_agent_executions  
- stock_forecasts  

Backfill strategy: (1) Ensure at least one organization exists. (2) Insert rows into `tenant_organization_map` for each integer tenant (e.g. 1 → default org UUID). (3) Add `organization_id` to these tables (if not already added by migration). (4) Update `organization_id` from `tenant_organization_map` where `tenant_id` = integer tenantId.

---

## 6. Migration plan for Phase 3 (do not execute yet)

### 6.1 Naming alignment

- **If the live DB already has snake_case table names** (assets, work_orders, …):  
  The existing Supabase migration has already (or will) add `organization_id` and indexes. Ensure Drizzle schema adds `organizationId` (with DB column `organization_id`) to each tenant table so that Drizzle matches the DB. Do not run `drizzle-kit generate` to create new tables; only add column definitions to existing table defs.

- **If the live DB has camelCase table names** (workOrders, maintenanceSchedules, …):  
  Either:  
  - **Option A:** Rename tables in DB to snake_case (breaking; requires app and migration coordination), then run the existing migration.  
  - **Option B:** Keep camelCase and add a **new** Supabase migration (or Drizzle migration) that adds `organization_id` (and index) to the **actual** table names (e.g. `workOrders`). Then add `organizationId` to Drizzle for those tables.

### 6.2 Steps (high level)

1. **Verify live schema** using the SQL in `docs/PHASE2A_SCHEMA_INSPECTION_REPORT.md`.
2. **Add `organization_id` to tenant tables** (in DB) only for tables that exist; use the correct table name (snake_case or camelCase) per verification.
3. **Backfill**  
   - From UUID columns: `UPDATE t SET organization_id = COALESCE(tenant_id, business_id) WHERE organization_id IS NULL AND (tenant_id IS NOT NULL OR business_id IS NOT NULL)` (and valid UUID).  
   - From integer `tenantId`: use `tenant_organization_map` or a default organization.
4. **Create indexes** on `organization_id` for each tenant table (if not already created by migration).
5. **Do not enable RLS** until all rows have non-NULL `organization_id` and backfill is verified.
6. **Update Drizzle** so every tenant table has `organizationId: uuid("organization_id")` (or equivalent) to match the DB.

### 6.3 Index pattern

For each tenant table:

```sql
CREATE INDEX IF NOT EXISTS idx_<table_name>_organization_id ON public.<table_name> (organization_id);
```

Use the actual table name (snake_case or camelCase) as in the database.

---

## 7. Summary

- **Canonical identifier:** `organization_id` (UUID).  
- **Legacy mapping:** `tenant_id`/`business_id` (UUID) → use as `organization_id`; integer `tenantId` → use `tenant_organization_map` or default org.  
- **Drizzle:** Organizations and organization_members added in Phase 2B; optional `tenant_organization_map` in Phase 2D.  
- **Next:** Verify live DB with Phase 2A SQL; then add `organization_id` and backfill per §6 without enabling RLS until backfill is complete.
