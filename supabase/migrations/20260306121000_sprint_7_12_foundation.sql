-- Sprint 6.5 + Sprint 7-12 foundation
-- Canonical tenancy model and event-driven intelligence scaffolding.

alter table if exists entries add column if not exists tenant_id uuid;
update entries set tenant_id = coalesce(tenant_id, business_id) where tenant_id is null;

alter table if exists vendors add column if not exists tenant_id uuid;
update vendors set tenant_id = coalesce(tenant_id, business_id) where tenant_id is null;

alter table if exists products add column if not exists tenant_id uuid;
update products set tenant_id = coalesce(tenant_id, business_id) where tenant_id is null;

alter table if exists tax_ledger add column if not exists tenant_id uuid;
update tax_ledger set tenant_id = coalesce(tenant_id, business_id) where tenant_id is null;

create index if not exists idx_entries_tenant_created_at on entries(tenant_id, created_at desc);
create index if not exists idx_vendors_tenant_name on vendors(tenant_id, name_normalized);
create index if not exists idx_products_tenant_name on products(tenant_id, name);
create index if not exists idx_tax_ledger_tenant_period on tax_ledger(tenant_id, period desc);

create table if not exists platform_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_by text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_events_tenant_processed_created
  on platform_events(tenant_id, processed, created_at desc);
create index if not exists idx_platform_events_event_type
  on platform_events(event_type);

create table if not exists warehouse_transfer_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  from_warehouse_id text not null,
  to_warehouse_id text not null,
  product_id uuid,
  quantity integer not null default 0,
  confidence numeric(5,2) not null default 0,
  reason text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_warehouse_transfer_recos_tenant_status
  on warehouse_transfer_recommendations(tenant_id, status, created_at desc);

create table if not exists vendor_performance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  vendor_id uuid,
  vendor_name text not null,
  on_time_delivery_rate numeric(5,2) not null default 0,
  quality_score numeric(5,2) not null default 0,
  average_lead_time_days numeric(8,2) not null default 0,
  risk_score numeric(5,2) not null default 0,
  recommendation jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_performance_tenant_vendor
  on vendor_performance(tenant_id, vendor_name, evaluated_at desc);

create table if not exists integration_connectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  status text not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create index if not exists idx_integration_connectors_tenant_provider
  on integration_connectors(tenant_id, provider);

create table if not exists telemetry_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id text not null,
  signal_name text not null,
  signal_value numeric(14,4) not null,
  baseline_value numeric(14,4),
  anomaly_score numeric(8,4) not null default 0,
  severity text not null default 'medium',
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_anomaly_events_tenant_created
  on telemetry_anomaly_events(tenant_id, created_at desc);
