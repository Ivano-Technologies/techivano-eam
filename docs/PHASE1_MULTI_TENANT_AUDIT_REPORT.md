# Phase 1 — Multi-Tenant Security Isolation: Repository Audit Report

**Repository:** [Ivano-Technologies/techivano-eam](https://github.com/Ivano-Technologies/techivano-eam)  
**Stack:** Next.js (Vercel), Supabase Postgres, Railway workers, Cloudflare R2  
**Date:** 2025-03-09  
**Scope:** Database schema, tenant identifiers, and tables requiring organization isolation.

---

## 1. Executive Summary

The codebase uses **mixed tenant identifiers**: integer `tenantId` in Drizzle schema and worker/queue code, and UUID `tenant_id` / `business_id` in some API routes and Supabase migrations. A **Supabase migration already exists** that introduces `organizations`, `organization_members`, adds `organization_id` (UUID) to tenant tables, backfills from legacy columns, and enables RLS. The **Drizzle schema** does not yet define `organizations` or `organization_members`, and most core EAM tables (**assets**, **workOrders**, **sites**, **vendors**, **inventoryItems**, **inventoryTransactions**, **maintenanceSchedules**, **complianceRecords**, **assetPhotos**) have **no tenant or organization column** in the schema. Only **documents** has `organizationId` (UUID) in Drizzle; several analytics/worker tables use integer `tenantId`.

---

## 2. Current Database Schema (Drizzle)

**Location:** `drizzle/schema.ts`

- Schema is built with **pg-core** (Postgres) via a `mysqlTable()` wrapper that delegates to `pgTable()`.
- **No `organizations` or `organization_members`** tables are defined in Drizzle.
- Table names are a mix of **camelCase** (e.g. `workOrders`, `maintenanceSchedules`, `inventoryItems`) and **snake_case** (e.g. `documents`, `inspections`, `warehouse_transfer_recommendations`). Supabase migrations use **snake_case** (e.g. `work_orders`, `maintenance_schedules`); ensure naming alignment when applying migrations or generating from Drizzle.

---

## 3. Tables Requiring Organization Isolation

Per your list and schema inspection, the following tables store tenant-scoped data and **must** be isolated by `organization_id` and RLS.

| # | Table (logical) | Drizzle export | Drizzle table name | Has tenant/org column in schema? |
|---|----------------|----------------|--------------------|-----------------------------------|
| 1 | **assets** | `assets` | `"assets"` | No |
| 2 | **workOrders** | `workOrders` | `"workOrders"` | No |
| 3 | **inspections** | `inspections` | `"inspections"` | Yes — `tenantId` (int) |
| 4 | **documents** | `documents` | `"documents"` | Yes — `organizationId` (uuid) |
| 5 | **maintenanceSchedules** | `maintenanceSchedules` | `"maintenanceSchedules"` | No |
| 6 | **assetPhotos** | `assetPhotos` | `"assetPhotos"` | No |
| 7 | **vendors** | `vendors` | `"vendors"` | No |
| 8 | **complianceRecords** | `complianceRecords` | `"complianceRecords"` | No |
| 9 | **inventoryItems** | `inventoryItems` | `"inventoryItems"` | No |
| 10 | **inventoryTransactions** | `inventoryTransactions` | `"inventoryTransactions"` | No |
| 11 | **sites** | `sites` | `"sites"` | No |

**Additional tenant-scoped tables in schema (integer `tenantId`):**

- `warehouseTransferRecommendations` — `tenant_id` (int)
- `vendorPerformanceMetrics` — `tenant_id` (int)
- `vendorRiskScores` — `tenant_id` (int)
- `procurementRecommendations` — `tenant_id` (int)
- `purchaseOrders` — `tenant_id` (int)
- `supplyChainRiskScores` / `supplyChainRiskEvents` — `tenant_id` (int)
- `fleetUnits`, `technicians`, `dispatchAssignments` — `tenant_id` (int)
- `executiveMetricsSnapshots`, `operationalKpiTrends` — `tenant_id` (int)
- `telemetryPoints`, `telemetryAggregates` — `tenantId` (int)
- `reportSnapshots`, `predictiveScores` — `tenantId` (int)
- `inspectionTemplates`, `inspections` — `tenantId` (int)
- `complianceRules`, `complianceEvents`, `slaMetrics` — `tenantId` (int)
- `auditLogsV1` — `tenantId` (int)
- `backgroundJobRuns` — `tenantId` (int), default 1
- `ruvectorMemories`, `primeAgentExecutions` — `tenantId` (int)
- `stockForecasts` — `tenant_id` (int)
- `organizationEncryptionKeys` — `organization_id` (uuid) only; no tenant int.

---

## 4. Current Tenant Identifiers

### 4.1 In Drizzle schema

| Identifier | Type | Where used |
|------------|------|------------|
| `tenantId` | `int` | Many analytics/worker tables (e.g. `warehouseTransferRecommendations`, `vendorRiskScores`, `inspections`, `backgroundJobRuns`, `telemetryPoints`, etc.). Column name in DB: often `tenant_id` (snake_case). |
| `organizationId` | `uuid` | `documents`, `organizationEncryptionKeys` only. |

### 4.2 In application and API code

| Identifier | Type / usage |
|------------|----------------|
| `tenantId` | **Number** in server/routers (e.g. `ctx.tenantId`), jobs (e.g. `payload.tenantId`), queue types. Resolved from context; used for DB filters and job payloads. |
| `tenant_id` | **String (UUID)** in some API routes (e.g. vendors suggest, entries, warehouse transfer recommendations), Supabase client `.eq("tenant_id", tenantId)`, and worker payload types. |
| `business_id` | **String (UUID)** in API routes (entries, vendors), Supabase `.eq("business_id", tenantId)`, and validation schemas. |
| `organizationId` / `organization_id` | **String (UUID)** in worker decrypt, OCR payloads, and Supabase migration. |

### 4.3 Resolution logic

- **Server context:** `resolveTenantIdFromContext(ctx)` returns `ctx.tenantId` (number).
- **Request payloads:** `resolveTenantId(userId, { tenant_id, business_id })` (e.g. in `src/lib/tenant/context.ts`) prefers `tenant_id` then `business_id` then falls back to `userId`.
- **Workers:** `resolveWorkerTenantId(payload)` uses `tenantId` or `tenant_id` (numeric); `resolveWorkerOrganizationId(payload)` uses `organizationId` or `organization_id` (string).

---

## 5. Tables Already Containing Tenant References

| Table (Drizzle name / DB) | Column(s) | Type | Notes |
|---------------------------|-----------|------|--------|
| **documents** | `organization_id` | uuid | Present in Drizzle; RLS/backfill in Supabase migration. |
| **organization_encryption_keys** | `organization_id` | uuid | Org-scoped encryption keys. |
| **inspections** | `tenantId` | int | Tenant-scoped; no UUID org column. |
| **inspection_templates** | `tenantId` | int | Same as above. |
| **compliance_rules**, **compliance_events**, **sla_metrics** | `tenantId` | int | Same. |
| **audit_logs_v1** | `tenantId` | int | Same. |
| **warehouse_transfer_recommendations** | `tenant_id` | int | Analytics/worker table. |
| **vendor_performance_metrics**, **vendor_risk_scores** | `tenant_id` | int | Same. |
| **procurement_recommendations**, **purchase_orders** | `tenant_id` | int | Same. |
| **supply_chain_risk_scores**, **supply_chain_risk_events** | `tenant_id` | int | Same. |
| **fleet_units**, **technicians**, **dispatch_assignments** | `tenant_id` | int | Same. |
| **executive_metrics_snapshots**, **operational_kpi_trends** | `tenant_id` | int | Same. |
| **telemetry_points**, **telemetry_aggregates** | `tenantId` | int | Same. |
| **report_snapshots**, **predictive_scores** | `tenantId` | int | Same. |
| **background_job_runs** | `tenantId` | int | Default 1. |
| **ruvector_memories**, **prime_agent_executions** | `tenantId` | int | Same. |
| **stock_forecasts** | `tenant_id` | int | Same. |

**Core EAM tables with no tenant column in Drizzle:**  
assets, workOrders, sites, vendors, inventoryItems, inventoryTransactions, maintenanceSchedules, complianceRecords, assetPhotos.

---

## 6. Existing Supabase Migrations (RLS / Organizations)

- **`supabase/migrations/20260309113000_tenant_file_encryption.sql`**  
  Adds `organization_encryption_keys`, adds `organization_id` to `documents`, backfills from `tenant_id` / `tenantId` / `business_id` / `businessId`, creates index on `documents(organization_id)`.

- **`supabase/migrations/20260309133000_canonical_organization_tenancy.sql`**  
  - Creates **`organizations`** (id uuid, name, slug, is_active, created_at, updated_at).  
  - Creates **`organization_members`** (id uuid, organization_id uuid FK, user_id uuid, role, is_active, created_at, updated_at, unique(organization_id, user_id)).  
  - Enables RLS on both.  
  - For each table in a fixed list (e.g. `assets`, `work_orders`, `inspections`, `documents`, …), the migration:  
    - Adds `organization_id uuid` if not exists.  
    - Creates index `idx_<table>_organization_id`.  
    - Seeds/backfills `organizations` and `organization_id` from existing `organization_id` or legacy `tenant_id` / `tenantId` / `business_id` / `businessId` (treated as UUID strings).  
    - Enables RLS and creates policy `_org_isolation` (using `organization_members` and `auth.uid()`).  
  - **Table names in the migration are snake_case** (e.g. `work_orders`, `asset_photos`, `maintenance_schedules`, `inventory_items`, `inventory_transactions`, `compliance_records`). Your actual Postgres table names may be different if they were created by Drizzle with camelCase; this can cause the migration to skip adding columns/policies if the table name does not match.

---

## 7. Gaps and Risks

1. **Drizzle schema vs Supabase migrations**  
   - Drizzle does not define `organizations` or `organization_members`.  
   - Core tenant tables (assets, workOrders, sites, vendors, etc.) have no `organization_id` (or any tenant column) in Drizzle.  
   - So: either the app uses a different DB (e.g. MySQL) and Supabase is for a separate Postgres env, or table names/schema need to be aligned so that one source of truth (Drizzle or Supabase) matches the actual database.

2. **Tenant type mismatch**  
   - Many tables and the server context use **integer** `tenantId`.  
   - RLS and organizations model use **UUID** `organization_id` and `auth.uid()`.  
   - You need a clear mapping: either integer tenant id → organization uuid (e.g. via a mapping table or by migrating to UUID-only tenant identity).

3. **Table naming**  
   - Migration assumes Postgres table names like `work_orders`, `asset_photos`.  
   - Drizzle defines `workOrders`, `assetPhotos` (camelCase).  
   - If the database was created by Drizzle, actual names may be camelCase; the migration’s `information_schema` checks will look for snake_case and may not find tables or columns.

4. **Service role key**  
   - Audit did not search exhaustively for `SUPABASE_SERVICE_ROLE_KEY` in frontend bundles; recommendation: ensure it is only used in server-side/API code and never exposed to the client.

---

## 8. Recommendations for Next Phases

1. **Phase 2 (Organizations model)**  
   - Add `organizations` and `organization_members` to **Drizzle** so schema and migrations stay in sync.  
   - Align with existing Supabase migration (id, name, slug, is_active, timestamps; members with organization_id, user_id, role, is_active).

2. **Phase 3 (organization_id on tenant tables)**  
   - Add `organization_id uuid` (and optional FK to `organizations`) in Drizzle for: assets, workOrders, inspections, documents, maintenanceSchedules, assetPhotos, inventoryItems, inventoryTransactions, vendors, complianceRecords, sites (and optionally other tenant-scoped tables).  
   - Add indexes on `organization_id` for each.  
   - Do not remove existing integer `tenantId` columns until backfill and RLS are verified.

3. **Naming and migration strategy**  
   - Confirm actual Postgres table names (from running DB or from Drizzle’s generated migrations).  
   - If they are camelCase, either:  
     - Update Supabase migration to use the same names, or  
     - Introduce a Drizzle-generated migration that adds `organization_id` and indexes (and optionally RLS), and keep Supabase migrations for RLS only if they run against the same names.

4. **Backfill (Phase 5)**  
   - Backfill `organization_id` from existing tenant columns.  
   - For tables that only have integer `tenantId`, define a mapping (e.g. tenant_id 1 → org uuid X) or a default organization until full migration to UUID-based tenancy.

5. **RLS (Phase 6)**  
   - Use the same policy pattern as in `20260309133000_canonical_organization_tenancy.sql` (select by `organization_id in (select organization_id from organization_members where user_id = auth.uid())`).  
   - Ensure `auth.uid()` matches how users authenticate (e.g. Supabase Auth or JWT with same sub).

6. **Server APIs and workers (Phases 7–8)**  
   - Resolve `organization_id` (UUID) from context or session and pass to all tenant-scoped queries and job payloads.  
   - Workers should read/write with the same `organization_id` and never use service role to bypass RLS unless for a defined admin operation.

---

## 9. Summary Tables

### Tables requiring organization isolation (your list)

| Table | In Drizzle | Tenant/org column in schema | In Supabase RLS migration |
|-------|------------|-----------------------------|----------------------------|
| assets | Yes | No | Yes (as `assets`) |
| workOrders | Yes | No | Yes (as `work_orders`) |
| inspections | Yes | Yes (`tenantId` int) | Yes (as `inspections`) |
| documents | Yes | Yes (`organizationId` uuid) | Yes (as `documents`) |
| maintenanceSchedules | Yes | No | Yes (as `maintenance_schedules`) |
| assetPhotos | Yes | No | Yes (as `asset_photos`) |
| vendors | Yes | No | Yes (as `vendors`) |
| complianceRecords | Yes | No | Yes (as `compliance_records`) |
| inventoryItems | Yes | No | Yes (as `inventory_items`) |
| inventoryTransactions | Yes | No | Yes (as `inventory_transactions`) |
| sites | Yes | No | Yes (as `sites`) |

### Current tenant identifiers

| Identifier | Type | Used in |
|------------|------|--------|
| `tenantId` (Drizzle / server) | int | Schema (analytics, inspections, jobs, telemetry, etc.), routers, queue payloads |
| `tenant_id` (API / Supabase) | string (UUID) | Some API routes, Supabase client, worker payloads |
| `business_id` | string (UUID) | API routes (entries, vendors), Supabase |
| `organization_id` / `organizationId` | uuid / string | documents, organizationEncryptionKeys, worker decrypt, Supabase migrations |

---

## 10. Phase 2 follow-up (align Drizzle with organizations)

Phase 2 was executed to align the Drizzle schema with the existing Supabase organization model **without recreating tables**.

### 10.1 Canonical tenant identifier

- **organization_id (uuid)** is the single canonical tenant identifier.
- All RLS policies and application queries should scope by `organization_id` (from session/context).

### 10.2 Table naming conventions

- **Supabase migrations** use **snake_case** table names: `organizations`, `organization_members`, `work_orders`, `asset_photos`, etc.
- **Drizzle** now defines `organizations` and `organization_members` with table names `"organizations"` and `"organization_members"` so they match the DB. Other tables in Drizzle still use a mix (e.g. `workOrders`, `documents`, `assets`). For any new or altered tenant table, ensure the **table name string** in `mysqlTable("...")` matches the actual Postgres table name.

### 10.3 Tenant mapping strategy

- **tenant_id / business_id (UUID):** Use as `organization_id` when backfilling; migration already does this where the value is a valid UUID.
- **tenantId (integer):** No direct cast to UUID. Use the optional **tenant_organization_map** table (`tenant_id` integer → `organization_id` uuid) for backfill and for workers that only have integer tenant id. See `docs/PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md`.

### 10.4 Migration plan for Phase 3

- **Do not enable RLS** until every row in tenant tables has a non-NULL `organization_id`.
- Verify live schema with the SQL in `docs/PHASE2A_SCHEMA_INSPECTION_REPORT.md`.
- Add `organization_id` (and index) only to tables that **exist** in the DB, using the **actual** table name (snake_case or camelCase).
- Backfill from UUID columns first; then use `tenant_organization_map` or a default organization for integer `tenantId`.
- Full steps and naming options: `docs/PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md`.

### 10.5 Phase 2 deliverables

| Deliverable | Location |
|------------|----------|
| Schema inspection (2A) | `docs/PHASE2A_SCHEMA_INSPECTION_REPORT.md` |
| Drizzle organizations + organization_members (2B) | `drizzle/schema.ts` |
| Tenant identifier + mapping + migration plan (2C–2F) | `docs/PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md` |
| Optional tenant_organization_map (2D) | `drizzle/schema.ts` |

---

*End of Phase 1 report. Phase 2 code and docs added as above; no migrations were executed.*
