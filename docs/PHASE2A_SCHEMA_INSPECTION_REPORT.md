# Phase 2A — Database Schema Inspection Report

**Purpose:** Align Drizzle schema with the canonical organization model. This report is derived from **Supabase migrations** (source of truth for what exists or will exist after migrations) and documents how to verify the live database.

**Date:** 2025-03-09

---

## 1. Source of truth: Supabase migrations

The following migration files define the canonical organization model and tenant table changes:

| File | Contents |
|------|----------|
| `supabase/migrations/20260309133000_canonical_organization_tenancy.sql` | `organizations`, `organization_members`, `organization_id` on tenant tables, RLS |
| `supabase/migrations/20260309113000_tenant_file_encryption.sql` | `organization_encryption_keys`, `organization_id` on `documents` |

**Important:** We do **not** connect to the live database from this workspace. Verification of actual table/column names must be done by running the SQL below in your Supabase SQL Editor (or `psql`).

---

## 2. Organizations and organization_members (from migration)

### 2.1 Table names (actual in DB)

- **organizations** — `public.organizations` (snake_case)
- **organization_members** — `public.organization_members` (snake_case)

### 2.2 organizations — full definition (migration)

| Column       | Type         | Constraints                          |
|-------------|--------------|--------------------------------------|
| id          | uuid         | PRIMARY KEY, default gen_random_uuid() |
| name        | text         | NOT NULL                             |
| slug        | text         | NOT NULL, UNIQUE                      |
| is_active   | boolean      | NOT NULL, default true                |
| created_at  | timestamptz  | NOT NULL, default now()               |
| updated_at  | timestamptz  | NOT NULL, default now()               |

Index: `idx_organizations_is_active` on `(is_active)`.

### 2.3 organization_members — full definition (migration)

| Column          | Type        | Constraints                          |
|-----------------|-------------|--------------------------------------|
| id              | uuid        | PRIMARY KEY, default gen_random_uuid() |
| organization_id | uuid        | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE |
| user_id         | uuid        | NOT NULL                             |
| role            | text        | NOT NULL, default 'member'            |
| is_active       | boolean     | NOT NULL, default true                |
| created_at      | timestamptz | NOT NULL, default now()              |
| updated_at      | timestamptz | NOT NULL, default now()              |

Unique: `(organization_id, user_id)`.  
Indexes: `idx_organization_members_user_id`, `idx_organization_members_org_user`.

**Note:** `user_id` references `auth.users(id)` conceptually; the migration does not add a FK to `auth.users` (cross-schema). Drizzle will not add that FK either.

---

## 3. Naming: Drizzle vs Supabase

| Aspect        | Drizzle (current)     | Supabase migration    | Risk |
|---------------|------------------------|------------------------|------|
| Table names   | Mix: "assets", "workOrders", "maintenanceSchedules", "documents", "assetPhotos", etc. | **Snake_case**: assets, work_orders, maintenance_schedules, documents, asset_photos, etc. | If the live DB was created by Drizzle with camelCase, the migration’s `information_schema.table_name = 'work_orders'` check **fails** and no `organization_id` is added to work orders. |
| Column names  | camelCase in schema (e.g. organizationId) | snake_case in SQL (e.g. organization_id) | Drizzle’s `pgTable("documents", { organizationId: uuid("organization_id") })` maps JS name to DB name; migration uses `organization_id`. |

**Conclusion:**  
- **Organizations tables:** Must be defined in Drizzle with **table names** `"organizations"` and `"organization_members"` and **column names** matching the migration (use `uuid("organization_id")` etc.) so that Drizzle matches the actual Postgres schema.  
- **Tenant tables:** The migration only touches tables that **exist** in the DB with **snake_case** names. If your database uses camelCase table names (e.g. `workOrders`), you must either (a) rename tables to snake_case and then run the migration, or (b) add a separate migration that adds `organization_id` to the camelCase-named tables. Phase 2B will add the organization tables to Drizzle only; tenant table naming is part of the Phase 2F migration plan.

---

## 4. organization_id on tenant tables (from migration)

The migration loops over:

- assets  
- work_orders  
- inspections  
- documents  
- asset_photos  
- maintenance_schedules  
- inventory_items  
- inventory_transactions  
- vendors  
- compliance_records  
- sites  
- users  

For each table that **exists** in `information_schema.tables` with that **exact snake_case name**, it:

1. Adds column `organization_id uuid` (if not exists).  
2. Creates index `idx_<table>_organization_id`.  
3. Backfills from legacy columns (`tenant_id`, `tenantId`, `business_id`, `businessId`) only when the value is a **valid UUID** (regex check).  
4. Enables RLS and creates org isolation policy.

So:

- **documents** — Already has `organization_id` in Drizzle; migration adds it if missing and backfills.  
- **assets, work_orders, …** — Get `organization_id` only if the table in the DB is named `assets`, `work_orders`, etc. (snake_case). If the DB has `workOrders`, the migration skips it.

---

## 5. SQL to verify live database (run in Supabase)

Run this in the Supabase SQL Editor (or `psql`) to inspect the current schema. This is the only way to confirm actual table/column names and whether `organization_id` exists on each tenant table.

```sql
-- 1) Do organizations and organization_members exist?
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'organization_members')
ORDER BY table_name;

-- 2) Columns of organizations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;

-- 3) Columns of organization_members
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;

-- 4) Which tenant tables exist (snake_case as in migration)?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'assets', 'work_orders', 'inspections', 'documents',
    'asset_photos', 'maintenance_schedules', 'inventory_items',
    'inventory_transactions', 'vendors', 'compliance_records',
    'sites', 'users'
  )
ORDER BY table_name;

-- 5) Which of those have organization_id?
SELECT t.table_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.table_name = t.table_name
           AND c.column_name = 'organization_id'
       ) AS has_organization_id
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'assets', 'work_orders', 'inspections', 'documents',
    'asset_photos', 'maintenance_schedules', 'inventory_items',
    'inventory_transactions', 'vendors', 'compliance_records',
    'sites', 'users'
  )
ORDER BY t.table_name;

-- 6) Any camelCase tenant tables? (Drizzle-style names)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'workOrders', 'maintenanceSchedules', 'inventoryItems',
    'inventoryTransactions', 'complianceRecords', 'assetPhotos'
  )
ORDER BY table_name;
```

**How to use:**  
- If (1)–(3) show the expected columns, the DB matches the migration and Drizzle can be aligned to it.  
- (4)–(5) show which tenant tables exist in snake_case and which already have `organization_id`.  
- (6) shows whether camelCase tables exist; if they do, the migration did not add `organization_id` to them and a separate plan is needed (see Phase 2F).

---

## 6. Summary for Phase 2B

- **Add to Drizzle** (only as a reflection of the existing migration; do not recreate tables):
  - **organizations** — table name `"organizations"`, columns: id (uuid), name, slug, is_active, created_at, updated_at.
  - **organization_members** — table name `"organization_members"`, columns: id, organization_id, user_id, role, is_active, created_at, updated_at.
- Use **snake_case** for the **table names** in `pgTable(…)` so they match Postgres.  
- Use Drizzle’s second-argument column naming so that DB column names are snake_case (e.g. `organization_id`) where the migration uses snake_case.

Next: **Phase 2B** — Add these two tables to `drizzle/schema.ts` without generating new migrations.
