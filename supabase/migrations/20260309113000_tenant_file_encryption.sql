-- Tenant-level file encryption support
-- Adds organization key versioning table and encrypted document metadata.

create table if not exists organization_encryption_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  key_version int not null default 1,
  encrypted_key text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (organization_id, key_version)
);

create index if not exists idx_org_encryption_keys_organization_id
  on organization_encryption_keys(organization_id);

create index if not exists idx_org_encryption_keys_org_status_created
  on organization_encryption_keys(organization_id, status, created_at desc);

alter table if exists documents add column if not exists organization_id uuid;
alter table if exists documents add column if not exists encryption_algorithm text;
alter table if exists documents add column if not exists encryption_key_version int;
alter table if exists documents add column if not exists encryption_iv text;
alter table if exists documents add column if not exists encryption_auth_tag text;
alter table if exists documents add column if not exists encrypted_at timestamptz;
alter table if exists documents add column if not exists is_encrypted boolean not null default false;

do $$
begin
  -- Backfill from legacy tenant/business columns where available.
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'documents'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'tenant_id'
    ) then
      execute '
        update documents
        set organization_id = tenant_id
        where organization_id is null
          and tenant_id is not null
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'tenantId'
    ) then
      execute '
        update documents
        set organization_id = "tenantId"
        where organization_id is null
          and "tenantId" is not null
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'business_id'
    ) then
      execute '
        update documents
        set organization_id = business_id
        where organization_id is null
          and business_id is not null
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'businessId'
    ) then
      execute '
        update documents
        set organization_id = "businessId"
        where organization_id is null
          and "businessId" is not null
      ';
    end if;
  end if;
end $$;

create index if not exists idx_documents_organization_id
  on documents(organization_id);

create index if not exists idx_documents_org_encrypted_created
  on documents(organization_id, is_encrypted);

create index if not exists idx_documents_encryption_key_version
  on documents(encryption_key_version);
