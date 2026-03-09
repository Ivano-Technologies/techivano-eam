# Canonical Organization Tenancy Migration

This migration introduces a canonical multi-tenant model based on organizations and organization memberships, and rolls out org-scoped RLS policies to priority domain tables in a safe, idempotent way.

Migration file:
- `supabase/migrations/20260309133000_canonical_organization_tenancy.sql`

## What It Adds

1. Canonical tenant tables:
- `public.organizations`
- `public.organization_members`

2. Conditional `organization_id` rollout for priority tables (when they exist):
- `assets`
- `work_orders`
- `inspections`
- `documents`
- `asset_photos`
- `maintenance_schedules`
- `inventory_items`
- `inventory_transactions`
- `vendors`
- `compliance_records`
- `sites`
- `users`

3. Backfill of `organization_id` from legacy tenant markers when present:
- `tenant_id`
- `tenantId`
- `business_id`
- `businessId`

4. RLS enablement + org isolation policy pattern:
- `organization_id in (select organization_id from organization_members where user_id = auth.uid())`

## Idempotency and Safety

- Uses `create table if not exists`.
- Uses `alter table ... add column if not exists`.
- Uses `create index if not exists`.
- Uses guarded policy creation (`pg_policies` checks) to avoid duplicate policy errors.
- Uses conditional table/column existence checks through `information_schema`.
- Backfill only updates rows where `organization_id is null`.
- Backfill only casts legacy markers that match UUID regex.
- No destructive changes (no drops, no rewrites of legacy columns).

## Verification Checklist

Run in SQL editor after applying migrations.

### 1) Confirm canonical tables exist

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('organizations', 'organization_members')
order by table_name;
```

### 2) Confirm `organization_id` column exists on target tables that are present

```sql
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema
 and t.table_name = c.table_name
where c.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and c.column_name = 'organization_id'
  and c.table_name in (
    'assets',
    'work_orders',
    'inspections',
    'documents',
    'asset_photos',
    'maintenance_schedules',
    'inventory_items',
    'inventory_transactions',
    'vendors',
    'compliance_records',
    'sites',
    'users'
  )
order by c.table_name;
```

### 3) Confirm RLS is enabled

```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'organizations',
    'organization_members',
    'assets',
    'work_orders',
    'inspections',
    'documents',
    'asset_photos',
    'maintenance_schedules',
    'inventory_items',
    'inventory_transactions',
    'vendors',
    'compliance_records',
    'sites',
    'users'
  )
order by relname;
```

### 4) Confirm org-isolation policies exist

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and (
    policyname like '%_org_isolation'
    or policyname = 'organization_members_self_access'
  )
order by tablename, policyname;
```

### 5) Cross-tenant isolation smoke test

Use two test users and two test organizations. Ensure each user has membership in only one org.

As user A, set JWT subject claim and query data:

```sql
set local role authenticated;
set local request.jwt.claim.sub = '<user_a_uuid>';

select organization_id, count(*)
from public.assets
group by organization_id
order by organization_id;
```

Repeat for user B:

```sql
set local role authenticated;
set local request.jwt.claim.sub = '<user_b_uuid>';

select organization_id, count(*)
from public.assets
group by organization_id
order by organization_id;
```

Expected:
- User A only sees rows belonging to orgs in `organization_members` for user A.
- User B only sees rows belonging to orgs in `organization_members` for user B.
- No cross-tenant row leakage.

## Notes

- If a priority table does not exist in the environment, migration safely skips it.
- Existing legacy tenant markers remain intact for compatibility during transition.
