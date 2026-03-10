-- P3: Optimize RLS policy expressions — use (select auth.uid()) so the value is evaluated once per query.
-- Run after 20260309133000 and 20260309160000. Idempotent: safe to run multiple times.

-- organizations
drop policy if exists organizations_org_isolation on public.organizations;
create policy organizations_org_isolation on public.organizations
  for all
  using (
    id in (
      select organization_id from public.organization_members where user_id = (select auth.uid())
    )
  )
  with check (
    id in (
      select organization_id from public.organization_members where user_id = (select auth.uid())
    )
  );

-- organization_members
drop policy if exists organization_members_self_access on public.organization_members;
create policy organization_members_self_access on public.organization_members
  for select
  using (user_id = (select auth.uid()));

-- Snake-case tenant tables (from 20260309133000)
do $$
declare
  snake_tables text[] := array[
    'assets', 'work_orders', 'inspections', 'documents', 'asset_photos',
    'maintenance_schedules', 'inventory_items', 'inventory_transactions',
    'vendors', 'compliance_records', 'sites', 'users'
  ];
  t text;
begin
  foreach t in array snake_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop policy if exists %I on public.%I', t || '_org_isolation', t);
      execute format(
        $sql$
          create policy %I on public.%I for all
          using (
            organization_id in (
              select organization_id from public.organization_members where user_id = (select auth.uid())
            )
          )
          with check (
            organization_id in (
              select organization_id from public.organization_members where user_id = (select auth.uid())
            )
          )
        $sql$,
        t || '_org_isolation',
        t
      );
    end if;
  end loop;
end $$;

-- CamelCase tenant tables (from 20260309160000)
do $$
declare
  camel_tables text[] := array[
    'workOrders', 'maintenanceSchedules', 'inventoryItems', 'inventoryTransactions',
    'complianceRecords', 'assetPhotos'
  ];
  t text;
  policy_name text;
begin
  foreach t in array camel_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      policy_name := t || '_org_isolation';
      execute format('drop policy if exists %I on public.%I', policy_name, t);
      execute format(
        $sql$
          create policy %I on public.%I for all
          using (
            organization_id in (
              select organization_id from public.organization_members where user_id = (select auth.uid())
            )
          )
          with check (
            organization_id in (
              select organization_id from public.organization_members where user_id = (select auth.uid())
            )
          )
        $sql$,
        policy_name,
        t
      );
    end if;
  end loop;
end $$;
