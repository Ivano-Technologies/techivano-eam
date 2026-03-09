# Phase 4G — Final RLS Validation

**Purpose:** Verify that Row Level Security is active on tenant tables and that isolation works as intended.

---

## 1. Check RLS is enabled

Run in Supabase SQL Editor:

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'assets', 'work_orders', 'workOrders', 'inspections', 'documents',
    'maintenance_schedules', 'maintenanceSchedules', 'asset_photos', 'assetPhotos',
    'inventory_items', 'inventoryItems', 'inventory_transactions', 'inventoryTransactions',
    'vendors', 'compliance_records', 'complianceRecords', 'sites', 'users',
    'organizations', 'organization_members'
  )
ORDER BY c.relname;
```

**Expected:** `rls_enabled` = `true` for every table listed that exists.

---

## 2. Check policies exist

```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'assets', 'work_orders', 'inspections', 'documents',
    'maintenance_schedules', 'asset_photos', 'inventory_items',
    'inventory_transactions', 'vendors', 'compliance_records', 'sites'
  )
ORDER BY tablename, policyname;
```

**Expected:** At least one policy per tenant table (e.g. `*_org_isolation`).

---

## 3. Isolation test scenarios

### Scenario 1: User A (Organization A)

1. Sign in as a user that is in **Organization A** only (`organization_members`).
2. From the app or API, list assets / work orders / sites.
3. **Expected:** Only rows where `organization_id = Organization A's UUID`.

### Scenario 2: User B (Organization B)

1. Sign in as a user that is in **Organization B** only.
2. List assets / work orders / sites.
3. **Expected:** Only Organization B’s data. No Organization A rows.

### Scenario 3: Cross-tenant query (RLS enforced)

As the **application user** (Supabase Auth, so RLS applies), run:

```sql
-- Use a valid org B UUID that is not User A's org
SELECT * FROM assets WHERE organization_id = '<organization_b_uuid>';
```

**Expected:** 0 rows for User A (RLS restricts to orgs in `organization_members` for that user).

---

## 4. Summary

- RLS must be **enabled** on all tenant tables.
- Policies must restrict access to rows where `organization_id` is in the set of organizations the user belongs to (`organization_members`).
- Application and RLS together enforce isolation; the app filters by `ctx.organizationId` and RLS blocks direct SQL cross-tenant access.
