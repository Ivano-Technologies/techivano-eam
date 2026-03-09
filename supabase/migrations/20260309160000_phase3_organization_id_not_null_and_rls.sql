-- Phase 3: organization_id NOT NULL enforcement and RLS (run after 20260309133000).
-- Prerequisites: 3A verification passed; organization_id columns exist; backfill completed.
-- Idempotent: safe to run multiple times.

-- Optional: create mapping table for integer tenantId → organization_id (if not exists)
create table if not exists public.tenant_organization_map (
  tenant_id integer not null primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_organization_map_organization_id
  on public.tenant_organization_map(organization_id);

-- ========== 3B/3C: Ensure organization_id and index exist (snake_case and camelCase) ==========
-- Tables that may exist with camelCase names in some environments
do $$
declare
  camel_tables text[] := array[
    'workOrders', 'maintenanceSchedules', 'inventoryItems', 'inventoryTransactions',
    'complianceRecords', 'assetPhotos'
  ];
  t text;
begin
  foreach t in array camel_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I add column if not exists organization_id uuid', t);
      execute format(
        'create index if not exists %I on public.%I (organization_id)',
        'idx_' || replace(t, '"', '') || '_organization_id',
        t
      );
    end if;
  end loop;
end $$;

-- ========== 3D: Backfill from tenant_organization_map (integer tenantId → organization_id) ==========
-- Only if tenant_organization_map exists and has rows
do $$
declare
  target_tables text[] := array[
    'assets', 'work_orders', 'workOrders', 'inspections', 'documents',
    'asset_photos', 'assetPhotos', 'maintenance_schedules', 'maintenanceSchedules',
    'inventory_items', 'inventoryItems', 'inventory_transactions', 'inventoryTransactions',
    'vendors', 'compliance_records', 'complianceRecords', 'sites', 'users'
  ];
  t text;
  has_map boolean;
  has_tenant_col boolean;
  has_org_col boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tenant_organization_map'
  ) into has_map;

  if not has_map then
    return;
  end if;

  foreach t in array target_tables loop
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'organization_id'
    ) into has_org_col;
    if not has_org_col then
      continue;
    end if;

    -- Check for integer tenant column (tenant_id or "tenantId")
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name in ('tenant_id', 'tenantId')
    ) into has_tenant_col;
    if not has_tenant_col then
      continue;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'tenant_id') then
      execute format(
        $sql$
          update public.%I t
          set organization_id = m.organization_id
          from public.tenant_organization_map m
          where t.organization_id is null
            and t.tenant_id = m.tenant_id
        $sql$,
        t
      );
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'tenantId') then
      execute format(
        $sql$
          update public.%I t
          set organization_id = m.organization_id
          from public.tenant_organization_map m
          where t.organization_id is null
            and t."tenantId" = m.tenant_id
        $sql$,
        t
      );
    end if;
  end loop;
end $$;

-- ========== 3E: SET NOT NULL only when no nulls remain ==========
do $$
declare
  target_tables text[] := array[
    'assets', 'work_orders', 'workOrders', 'inspections', 'documents',
    'asset_photos', 'assetPhotos', 'maintenance_schedules', 'maintenanceSchedules',
    'inventory_items', 'inventoryItems', 'inventory_transactions', 'inventoryTransactions',
    'vendors', 'compliance_records', 'complianceRecords', 'sites', 'users'
  ];
  t text;
  null_count bigint;
begin
  foreach t in array target_tables loop
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      continue;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'organization_id') then
      continue;
    end if;

    execute format('select count(*) from public.%I where organization_id is null', t) into null_count;
    if null_count = 0 then
      execute format('alter table public.%I alter column organization_id set not null', t);
    end if;
  end loop;
end $$;

-- ========== 3F: Enable RLS and policy (idempotent) for camelCase tables ==========
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
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      continue;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'organization_id') then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    policy_name := t || '_org_isolation';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = policy_name
    ) then
      execute format(
        $sql$
          create policy %I on public.%I
          for all
          using (
            organization_id in (
              select organization_id from public.organization_members where user_id = auth.uid()
            )
          )
          with check (
            organization_id in (
              select organization_id from public.organization_members where user_id = auth.uid()
            )
          )
        $sql$,
        policy_name,
        t
      );
    end if;
  end loop;
end $$;
