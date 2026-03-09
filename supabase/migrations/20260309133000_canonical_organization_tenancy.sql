-- Canonical multi-tenant organization model and org-scoped RLS rollout.
-- Idempotent and non-destructive: only additive/conditional changes.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_is_active
  on public.organizations(is_active);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user_id
  on public.organization_members(user_id);

create index if not exists idx_organization_members_org_user
  on public.organization_members(organization_id, user_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_org_isolation'
  ) then
    create policy organizations_org_isolation
      on public.organizations
      for all
      using (
        id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
        )
      )
      with check (
        id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
      and policyname = 'organization_members_self_access'
  ) then
    create policy organization_members_self_access
      on public.organization_members
      for select
      using (user_id = auth.uid());
  end if;
end $$;

do $$
declare
  target_tables text[] := array[
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
  ];
  target_table text;
  legacy_expr text;
begin
  foreach target_table in array target_tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = target_table
    ) then
      execute format(
        'alter table public.%I add column if not exists organization_id uuid',
        target_table
      );

      execute format(
        'create index if not exists %I on public.%I (organization_id)',
        'idx_' || target_table || '_organization_id',
        target_table
      );

      -- Seed organizations from any already-populated organization_id values.
      execute format(
        $sql$
          insert into public.organizations (id, name, slug)
          select distinct t.organization_id,
                 'Migrated Org ' || left(t.organization_id::text, 8),
                 'migrated-' || replace(t.organization_id::text, '-', '')
          from public.%I t
          where t.organization_id is not null
          on conflict (id) do nothing
        $sql$,
        target_table
      );

      legacy_expr := '';

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'tenant_id'
      ) then
        legacy_expr := legacy_expr || case when legacy_expr = '' then '' else ', ' end
          || 'nullif(tenant_id::text, '''')';
      end if;

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'tenantId'
      ) then
        legacy_expr := legacy_expr || case when legacy_expr = '' then '' else ', ' end
          || 'nullif("tenantId"::text, '''')';
      end if;

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'business_id'
      ) then
        legacy_expr := legacy_expr || case when legacy_expr = '' then '' else ', ' end
          || 'nullif(business_id::text, '''')';
      end if;

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'businessId'
      ) then
        legacy_expr := legacy_expr || case when legacy_expr = '' then '' else ', ' end
          || 'nullif("businessId"::text, '''')';
      end if;

      if legacy_expr <> '' then
        legacy_expr := 'coalesce(' || legacy_expr || ')';

        -- Seed canonical organizations from valid legacy tenant markers.
        execute format(
          $sql$
            insert into public.organizations (id, name, slug)
            select distinct (%s)::uuid,
                   'Migrated Org ' || left((%s)::text, 8),
                   'migrated-' || replace((%s)::text, '-', '')
            from public.%I
            where organization_id is null
              and (%s) is not null
              and (%s) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            on conflict (id) do nothing
          $sql$,
          legacy_expr,
          legacy_expr,
          legacy_expr,
          target_table,
          legacy_expr,
          legacy_expr
        );

        -- Backfill organization_id from valid legacy tenant markers.
        execute format(
          $sql$
            update public.%I
            set organization_id = (%s)::uuid
            where organization_id is null
              and (%s) is not null
              and (%s) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          $sql$,
          target_table,
          legacy_expr,
          legacy_expr,
          legacy_expr
        );
      end if;

      execute format('alter table public.%I enable row level security', target_table);

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
          and policyname = target_table || '_org_isolation'
      ) then
        execute format(
          $sql$
            create policy %I
            on public.%I
            for all
            using (
              organization_id in (
                select organization_id
                from public.organization_members
                where user_id = auth.uid()
              )
            )
            with check (
              organization_id in (
                select organization_id
                from public.organization_members
                where user_id = auth.uid()
              )
            )
          $sql$,
          target_table || '_org_isolation',
          target_table
        );
      end if;
    end if;
  end loop;
end $$;
