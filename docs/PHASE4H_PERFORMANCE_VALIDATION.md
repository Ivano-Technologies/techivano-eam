# Phase 4H — Performance Validation

**Purpose:** Ensure tenant-scoped queries use indexes on `organization_id`.

---

## 1. Index existence

Confirm indexes exist (run in Supabase SQL Editor):

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%organization_id%'
ORDER BY tablename;
```

**Expected:** One or more indexes per tenant table that include `organization_id` (e.g. `idx_assets_organization_id`, `idx_work_orders_organization_id`).

---

## 2. Query plan (EXPLAIN ANALYZE)

For a typical tenant list query:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM assets
WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY "createdAt" DESC
LIMIT 50;
```

**Expected:** Plan shows an **Index Scan** or **Bitmap Index Scan** on an index that includes `organization_id`, not a full table scan.

Example of good output:

```
Index Scan using idx_assets_organization_id on assets
  Index Cond: (organization_id = '550e8400-e29b-41d4-a716-446655440000'::uuid)
```

---

## 3. Index naming convention

Recommended pattern:

- `idx_<table_name>_organization_id` for single-column index on `organization_id`.
- Composite indexes that start with `organization_id` for common filters (e.g. `(organization_id, status)`).

All Phase 3 migrations create these indexes; Phase 4 does not change them.
