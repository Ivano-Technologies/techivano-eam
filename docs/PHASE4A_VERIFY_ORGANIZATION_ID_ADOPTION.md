# Phase 4A — Verify organization_id Adoption

**Purpose:** Confirm that all tenant tables have `organization_id` populated (no NULLs) before removing legacy columns or enforcing NOT NULL in application code.

**Run the following in the Supabase SQL Editor.** Ensure result is **zero** for every table before proceeding to Phase 4E (drop legacy columns).

---

## 1. Core tenant tables (snake_case names)

If your database uses **snake_case** table names (from Supabase migrations):

```sql
-- Run each and confirm result = 0
SELECT 'assets' AS tbl, COUNT(*) AS null_count FROM public.assets WHERE organization_id IS NULL
UNION ALL SELECT 'work_orders', COUNT(*) FROM public.work_orders WHERE organization_id IS NULL
UNION ALL SELECT 'inspections', COUNT(*) FROM public.inspections WHERE organization_id IS NULL
UNION ALL SELECT 'documents', COUNT(*) FROM public.documents WHERE organization_id IS NULL
UNION ALL SELECT 'maintenance_schedules', COUNT(*) FROM public.maintenance_schedules WHERE organization_id IS NULL
UNION ALL SELECT 'asset_photos', COUNT(*) FROM public.asset_photos WHERE organization_id IS NULL
UNION ALL SELECT 'vendors', COUNT(*) FROM public.vendors WHERE organization_id IS NULL
UNION ALL SELECT 'compliance_records', COUNT(*) FROM public.compliance_records WHERE organization_id IS NULL
UNION ALL SELECT 'inventory_items', COUNT(*) FROM public.inventory_items WHERE organization_id IS NULL
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM public.inventory_transactions WHERE organization_id IS NULL
UNION ALL SELECT 'sites', COUNT(*) FROM public.sites WHERE organization_id IS NULL;
```

---

## 2. CamelCase table names (if applicable)

If your database has **camelCase** table names (e.g. `workOrders`, `maintenanceSchedules`), run for each that exists:

```sql
SELECT 'workOrders' AS tbl, COUNT(*) AS null_count FROM public."workOrders" WHERE organization_id IS NULL;
SELECT 'maintenanceSchedules' AS tbl, COUNT(*) FROM public."maintenanceSchedules" WHERE organization_id IS NULL;
SELECT 'inventoryItems' AS tbl, COUNT(*) FROM public."inventoryItems" WHERE organization_id IS NULL;
SELECT 'inventoryTransactions' AS tbl, COUNT(*) FROM public."inventoryTransactions" WHERE organization_id IS NULL;
SELECT 'complianceRecords' AS tbl, COUNT(*) FROM public."complianceRecords" WHERE organization_id IS NULL;
SELECT 'assetPhotos' AS tbl, COUNT(*) FROM public."assetPhotos" WHERE organization_id IS NULL;
```

---

## 3. Single consolidated check (all tables)

Use this to list every table that still has NULL `organization_id` (should be empty):

```sql
DO $$
DECLARE
  r RECORD;
  null_count bigint;
  q text;
BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organization_id'
  ) LOOP
    q := format('SELECT COUNT(*) FROM %I.%I WHERE organization_id IS NULL', r.table_schema, r.table_name);
    EXECUTE q INTO null_count;
    IF null_count > 0 THEN
      RAISE NOTICE 'Table %.% has % rows with organization_id IS NULL', r.table_schema, r.table_name, null_count;
    END IF;
  END LOOP;
END $$;
```

---

## 4. Proceed to Phase 4E only when

- Every core tenant table returns **0** for the NULL count.
- Backfill and Phase 3 migrations have been applied and verified.
- Phase 4B report has been reviewed and Phase 4C updates are complete so that no code depends on legacy columns for these tables.
