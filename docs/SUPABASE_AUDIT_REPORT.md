# Supabase Backend Audit Report — Techivano EAM

**Date:** 2026-03-11  
**Scope:** Security, correctness, and performance of the Supabase project; production readiness.  
**Methods:** Supabase CLI, repository and migration inspection, documented SQL for remote verification.

---

## 1. Project connection status

| Check | Result |
|-------|--------|
| **`supabase status`** | **Failed** — No local container (`supabase_db_techivano-eam` not found). Expected when using linked remote only. |
| **Project linked** | **Yes** — `supabase migration list` connects to the remote database and returns migration history. |
| **Project reference** | Stored in `supabase/.temp/project-ref`; CLI uses it for `migration list`, `db push`, `migration repair`. |

**Recommendation:** For local development with `supabase status`, run `supabase start`. For production audit, the linked project is sufficient.

---

## 2. Migration health

### 2.1 Migration list (local vs remote)

| Local | Remote | Status |
|-------|--------|--------|
| 20260306121000 | 20260306121000 | OK |
| 20260309113000 | 20260309113000 | OK |
| 20260309133000 | 20260309133000 | OK |
| 20260309160000 | 20260309160000 | OK |
| 20260309180000 | 20260309180000 | OK |
| 20260309190000 | 20260309190000 | OK |
| 20260309200000 | 20260309200000 | OK |
| 20260309210000 | 20260309210000 | OK |
| — | **20260311** | **Mismatch** — Remote has version `20260311`; no matching local migration (see below). |
| 20260311 (from 20260311_remote.sql) | — | **Mismatch** — Local file `20260311_remote.sql` yields version `20260311_remote`; remote has `20260311`. |
| 20260311100000 | 20260311100000 | OK |
| … through 20260311150000 | … | OK |

**Critical issue:** Migration history mismatch prevents `supabase db pull` and can block safe `db push`. Fix: run in Supabase SQL Editor:

```sql
UPDATE supabase_migrations.schema_migrations
SET version = '20260311_remote'
WHERE version = '20260311';
```

See `docs/SUPABASE_MIGRATION_MISMATCH_FIX.md`.

### 2.2 Migration directory and content

**Location:** `supabase/migrations/`

**Ordering:** Migrations use timestamps; ordering is correct (20260306 → 20260309 → 20260311).

**Malformed / skipped file:**

- **`20260311.sql`** — Exists but is **skipped** by the CLI (filename does not match `<timestamp>_name.sql`). No schema changes; placeholder only.

**Migrations present (by purpose):**

| Migration | Purpose |
|-----------|---------|
| 20260306121000_sprint_7_12_foundation.sql | Foundation tables (platform_events, warehouse_transfer_recommendations, vendor_performance, integration_connectors), tenant_id, indexes |
| 20260309113000_tenant_file_encryption.sql | Encryption-related schema |
| 20260309133000_canonical_organization_tenancy.sql | organizations, organization_members, RLS, organization_id columns and backfill |
| 20260309160000_phase3_organization_id_not_null_and_rls.sql | tenant_organization_map, organization_id indexes, RLS enablement on multiple tables |
| 20260309180000_phase4_drop_legacy_tenant_columns.sql | Legacy column cleanup |
| 20260309190000_rls_optimize_auth_uid.sql | RLS tuning (auth.uid()) |
| 20260309200000_rls_policies_audit.sql | Documentation / no-op |
| 20260309210000_optional_asset_metrics_view.sql | Optional view |
| 20260311.sql | Placeholder (skipped by CLI) |
| 20260311_remote.sql | Placeholder to align with remote 20260311 (no schema changes) |
| 20260311100000_audit_high3_six_tables.sql | Six app tables (workOrderTemplates, passwordResetTokens, etc.) |
| 20260311110000_audit_high4_foreign_keys.sql | Foreign key constraints |
| 20260311120000_rls_app_used_tables.sql | RLS on platform_events, warehouse_transfer_recommendations, vendor_performance, integration_connectors, tenant_organization_map, organization_encryption_keys |
| 20260311130000_tenant_context_guardrail.sql | **Tenant guardrail:** `current_tenant_id()`, `assert_tenant_set()`, grants |
| 20260311140000_rls_use_current_tenant_id.sql | **RLS policies** using `current_tenant_id()` (and auth.uid() fallback) on org/tenant tables |
| 20260311150000_tenant_isolation_indexes.sql | **Tenant indexes:** single-column indexes on organization_id / tenant_id for all public tables that have these columns |

**Archived (not loaded by CLI):**

- `supabase/migrations_archive/20260311_placeholder.sql`
- `supabase/migrations_archive/20260311_tenant_index_optimization.sql` — Composite tenant indexes; restore to `migrations/` and apply if composite index optimization is required (see `docs/TENANT_INDEX_OPTIMIZATION_REPORT.md`).

**Duplicate filenames:** None. One non–pattern-compliant file (`20260311.sql`), which is intentional and skipped.

---

## 3. Schema consistency (db pull)

| Check | Result |
|-------|--------|
| **`supabase db pull`** | **Fails** — "The remote database's migration history does not match local files." |
| **Cause** | Remote has migration version `20260311`; local has `20260311_remote` (from `20260311_remote.sql`). Versions must match. |
| **Schema drift** | Cannot be fully verified until migration history is aligned and `db pull` succeeds. |

**Recommendation:** Apply the migration history fix (Section 2.1), then run `supabase db pull` and compare the generated migration to the existing ones to document any drift.

---

## 4. Row Level Security (RLS) — table coverage

**Source:** Migration files (20260309133000, 20260309160000, 20260311120000, 20260311140000).

**Tables that migrations enable RLS on:**

- **organizations**, **organization_members** (20260309133000)
- **assets**, **work_orders**, **inspections**, **documents**, **asset_photos**, **maintenance_schedules**, **inventory_items**, **inventory_transactions**, **vendors**, **compliance_records**, **sites**, **users** (20260309133000 / 20260309160000 — organization_id and RLS)
- **platform_events**, **warehouse_transfer_recommendations**, **vendor_performance**, **integration_connectors**, **telemetry_anomaly_events** (20260311120000 — tenant_id)
- **tenant_organization_map** (20260311120000 — deny-all policy)
- **organization_encryption_keys** (20260311120000)
- **workOrders**, **maintenanceSchedules**, **inventoryItems**, **inventoryTransactions**, **complianceRecords**, **assetPhotos** (20260311140000 — organization_id guardrail policies where table/column exist)

**Verification query (run in Supabase SQL Editor):**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

**Action:** Ensure every tenant-scoped table has `rowsecurity = true`. If any table with `organization_id` or `tenant_id` has `rowsecurity = false`, treat as **critical**.

---

## 5. RLS policies — tenant isolation

**Source:** 20260311140000_rls_use_current_tenant_id.sql.

**Pattern:**

- **organization_id tables:**  
  `(current_tenant_id() IS NOT NULL AND organization_id = current_tenant_id()) OR (current_tenant_id() IS NULL AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))`
- **tenant_id (uuid) tables:** Same logic with `tenant_id`.
- **organizations:** Restrict to `current_tenant_id()` or `auth.uid()` via `organization_members`.
- **tenant_organization_map:** Deny all (using (false), with check (false)).

Policies do **not** allow anonymous access; they require either `current_tenant_id()` set (server) or `auth.uid()` (Supabase Auth). Cross-tenant access is prevented by the predicate.

**Verification query:**

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

**Action:** Confirm no policy uses only `true` or allows `anon` without tenant/user restriction. Any such policy is **high** risk.

---

## 6. Tenant guardrail functions

**Source:** 20260311130000_tenant_context_guardrail.sql.

| Function | Purpose | Definition |
|----------|---------|------------|
| **current_tenant_id()** | Returns UUID from session for RLS | `select nullif(trim(current_setting('app.tenant_id', true)), '')::uuid` |
| **assert_tenant_set()** | Raises if tenant context not set | Raises if `current_setting('app.tenant_id', true)` is null or empty |

**Session setting:** Both use `current_setting('app.tenant_id', true)` (local to transaction/session; safe with pooling).

**Grants:**  
`GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role`  
`GRANT EXECUTE ON FUNCTION public.assert_tenant_set() TO authenticated, service_role`

**Verification query:**

```sql
select routine_name, routine_definition
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('current_tenant_id', 'assert_tenant_set');
```

---

## 7. Index coverage

**From migrations:**

- **20260309133000 / 20260309160000:** Indexes on `organization_id` for assets, work_orders, inspections, documents, asset_photos, maintenance_schedules, inventory_items, inventory_transactions, vendors, compliance_records, sites; and on camelCase equivalents where applicable.
- **20260311150000_tenant_isolation_indexes.sql:** Adds single-column indexes on `organization_id` and `tenant_id` (and `tenantId`) for every public table that has these columns (dynamic loop).
- **Archived:** `20260311_tenant_index_optimization.sql` adds composite indexes (e.g. org+status, org+created_at); not applied unless restored.

**Verification query:**

```sql
select tablename, indexname
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

**Action:** For each table that has `organization_id` or `tenant_id`, confirm at least one index includes that column (preferably leading). For common patterns (e.g. list by org + created_at, org + status), consider applying the archived composite index migration or equivalent.

---

## 8. Query planner verification

**Recommended (run in Supabase SQL Editor):**

```sql
EXPLAIN (ANALYZE, BUFFERS)
select *
from assets
where organization_id = current_tenant_id()
order by "createdAt" desc
limit 20;
```

Replace `assets` / column names as needed for `work_orders`, `sites`, etc. (e.g. `workOrders` and `"createdAt"` if that is the actual table/column name).

**Target:** Plan should use **Index Scan** (or Index Only Scan) on an index that starts with `organization_id` (or tenant_id), not **Seq Scan** on the table. If Seq Scan appears for large tables, add or restore composite tenant indexes.

---

## 9. Supabase Auth configuration

**Repository and docs:**

- **Provider:** Supabase Auth is the only authentication provider (legacy Manus OAuth removed; see `docs/SUPABASE_AUTH_MIGRATION_PLAN.md`).
- **Login:** `client/src/pages/Login.tsx` uses:
  - `supabase.auth.signInWithPassword({ email, password })`
  - `supabase.auth.signInWithOtp` (magic link)
  - `supabase.auth.signInWithOAuth` (e.g. Google) with `redirectTo: ${origin}/auth/callback`
- **Sign-up:** Sign-up flow uses Supabase (see Signup page and auth router).
- **Redirect URLs:** App and docs expect:
  - `/auth/callback` — OAuth and magic link
  - `/reset-password` — password reset
- **Auth pages:** Custom UI at `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` (see `client/src/App.tsx`, `DashboardLayout` public paths).

**Supabase Dashboard checks:**

- In **Authentication → URL Configuration**, ensure **Redirect URLs** include production and dev (e.g. `https://techivano.com/auth/callback`, `http://localhost:3000/auth/callback`, and `/reset-password` as needed).
- Confirm no legacy OAuth provider is required for production.

---

## 10. Storage policies

**Codebase:** No Supabase Storage usage was found in the main EAM client/server (one reference to `storage.from("receipts")` in another route). Asset photos and documents may be stored via app-specific endpoints or different buckets.

**Verification query:**

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;
```

Then in Dashboard: **Storage → Policies** (or `storage.policies`) to ensure buckets used for asset photos, documents, or attachments have RLS policies that restrict access by tenant/user (e.g. `organization_id` or `auth.uid()`). Unrestricted public buckets for tenant data are **high** risk.

---

## 11. Database functions and triggers

**Verification query (functions):**

```sql
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

**Action:** Ensure no function runs with `SECURITY DEFINER` and bypasses RLS unless intended and documented. Guardrail functions (`current_tenant_id`, `assert_tenant_set`) are safe (read session only).

**Triggers:**

```sql
select trigger_name, event_manipulation, event_object_table, action_statement
from information_schema.triggers
where trigger_schema = 'public';
```

**Action:** Confirm no trigger disables RLS (e.g. `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`).

---

## 12. Schema drift

- **Current limitation:** `supabase db pull` does not run due to migration history mismatch, so a full diff of remote vs migrations cannot be produced automatically.
- **After fixing migration history:** Run `supabase db pull`, then compare the new migration file to existing migrations. Report:
  - Tables or columns in remote not defined in any migration (manual or out-of-band changes).
  - Indexes or policies in remote not created by migrations.
  - Functions/triggers in remote not in migrations.

---

## 13. Performance inspection

**Query (run in Supabase SQL Editor):**

```sql
select
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_catalog.pg_statio_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;
```

**Action:** For each large table (e.g. assets, work_orders, inventory_items, telemetry), ensure:
- It has RLS enabled.
- It has at least one index on `organization_id` or `tenant_id` (and composite indexes for common filters like status, created_at) so tenant-scoped queries use Index Scan.

---

## 14. Security review summary

| Category | Status | Severity |
|----------|--------|----------|
| **Migration history mismatch** | Remote `20260311` vs local `20260311_remote`; blocks db pull/push | **Critical** (operational) |
| **RLS on tenant tables** | Migrations enable RLS and tenant/org policies; runtime must be verified with Section 4 query | **Verify** |
| **Anonymous access** | Policies in migrations use `current_tenant_id()` or `auth.uid()`; no policy grants anon full access | **OK** in migrations |
| **Cross-tenant queries** | Policies restrict by organization_id/tenant_id and membership | **OK** in migrations |
| **Guardrail functions** | Present and use `current_setting('app.tenant_id', true)`; granted to authenticated, service_role | **OK** |
| **Storage buckets** | Not audited in code; must be checked in Dashboard for tenant-scoped RLS | **High** (if used for tenant data) |
| **Public functions** | No audit of SECURITY DEFINER or RLS bypass in this report; use Section 11 queries | **Verify** |

**No destructive changes** were applied; this audit is read-only and documentation-only except for the recommended one-time migration version fix.

---

## 15. Recommendations

1. **Fix migration history (critical):**  
   Run the `UPDATE supabase_migrations.schema_migrations SET version = '20260311_remote' WHERE version = '20260311'` in the Supabase SQL Editor, then run `supabase migration list` and `supabase db pull` to confirm alignment.

2. **Run verification queries:**  
   Execute the SQL in Sections 4, 5, 6, 7, 8, 10, 11, and 13 in the Supabase SQL Editor (or via a read-only role) and record results to confirm RLS, indexes, functions, triggers, and table sizes.

3. **Restore composite tenant indexes (optional):**  
   If query plans show Seq Scans on large tenant tables, consider restoring `supabase/migrations_archive/20260311_tenant_index_optimization.sql` into `supabase/migrations` with a new timestamp and applying it, or applying its content via a new migration.

4. **Storage:**  
   If the app uses Supabase Storage for asset photos or documents, add RLS policies per bucket so access is restricted by tenant or user.

5. **Redirect URLs:**  
   Confirm in Supabase Dashboard that production and dev redirect URLs for `/auth/callback` and password reset are correct and limited to your domains.

6. **Ongoing drift:**  
   After fixing the migration mismatch, run `supabase db pull` periodically and compare generated SQL to migrations to catch manual or out-of-band schema changes.

---

## Appendix: SQL verification checklist

Run these in **Supabase Dashboard → SQL Editor** and save results for the audit file:

1. **RLS per table:**  
   `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;`

2. **Policies:**  
   `select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename;`

3. **Guardrail functions:**  
   `select routine_name, routine_definition from information_schema.routines where routine_schema = 'public' and routine_name in ('current_tenant_id', 'assert_tenant_set');`

4. **Indexes:**  
   `select tablename, indexname from pg_indexes where schemaname = 'public' order by tablename;`

5. **EXPLAIN (assets):**  
   `EXPLAIN (ANALYZE, BUFFERS) select * from assets where organization_id = current_tenant_id() order by "createdAt" desc limit 20;`

6. **Storage buckets:**  
   `select id, name, public from storage.buckets;`

7. **Functions:**  
   `select routine_name, routine_type from information_schema.routines where routine_schema = 'public';`

8. **Table sizes:**  
   `select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_catalog.pg_statio_user_tables where schemaname = 'public' order by pg_total_relation_size(relid) desc;`

---

**Report status:** Complete. No destructive changes applied. Resolve migration history mismatch and run the appendix queries for full production sign-off.
