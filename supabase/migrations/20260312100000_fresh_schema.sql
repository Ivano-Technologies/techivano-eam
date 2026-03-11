-- Fresh Supabase schema for Techivano EAM.
-- Single migration: tables, tenant guardrail, RLS, indexes.
-- All operations are idempotent (IF NOT EXISTS / DO blocks). Safe for db reset and CI.

-- =============================================================================
-- 1. CORE TENANCY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON public.organizations(is_active);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user ON public.organization_members(organization_id, user_id);

CREATE TABLE IF NOT EXISTS public.tenant_organization_map (
  tenant_id integer NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_organization_map_organization_id ON public.tenant_organization_map(organization_id);

-- =============================================================================
-- 2. TENANT GUARDRAIL FUNCTIONS (session-scoped app.tenant_id for RLS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(trim(current_setting('app.tenant_id', true)), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.assert_tenant_set()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.tenant_id', true) IS NULL OR trim(current_setting('app.tenant_id', true)) = '' THEN
    RAISE EXCEPTION 'Tenant context not set';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_tenant_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_tenant_set() TO service_role;

-- =============================================================================
-- 3. PLATFORM / INTELLIGENCE TABLES (tenant_id uuid = organization_id)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_by text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_tenant_processed_created ON public.platform_events(tenant_id, processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_event_type ON public.platform_events(event_type);

CREATE TABLE IF NOT EXISTS public.warehouse_transfer_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_warehouse_id text NOT NULL,
  to_warehouse_id text NOT NULL,
  product_id uuid,
  quantity integer NOT NULL DEFAULT 0,
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfer_recos_tenant_status ON public.warehouse_transfer_recommendations(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  vendor_id uuid,
  vendor_name text NOT NULL,
  on_time_delivery_rate numeric(5,2) NOT NULL DEFAULT 0,
  quality_score numeric(5,2) NOT NULL DEFAULT 0,
  average_lead_time_days numeric(8,2) NOT NULL DEFAULT 0,
  risk_score numeric(5,2) NOT NULL DEFAULT 0,
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_performance_tenant_vendor ON public.vendor_performance(tenant_id, vendor_name, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integration_connectors_tenant_provider ON public.integration_connectors(tenant_id, provider);

CREATE TABLE IF NOT EXISTS public.telemetry_anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  asset_id text NOT NULL,
  signal_name text NOT NULL,
  signal_value numeric(14,4) NOT NULL,
  baseline_value numeric(14,4),
  anomaly_score numeric(8,4) NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium',
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_anomaly_events_tenant_created ON public.telemetry_anomaly_events(tenant_id, created_at DESC);

-- =============================================================================
-- 4. ENCRYPTION & APP TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  encrypted_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (organization_id, key_version)
);
CREATE INDEX IF NOT EXISTS idx_org_encryption_keys_organization_id ON public.organization_encryption_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_encryption_keys_org_status_created ON public.organization_encryption_keys(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public."workOrderTemplates" (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  "estimatedDuration" integer,
  "checklistItems" text,
  instructions text,
  "categoryId" integer,
  "createdBy" integer NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."passwordResetTokens" (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  token varchar(255) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public."passwordResetTokens" (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public."passwordResetTokens" (expires_at);

CREATE TABLE IF NOT EXISTS public."userPreferences" (
  id serial PRIMARY KEY,
  "userId" integer NOT NULL UNIQUE,
  "sidebarWidth" integer DEFAULT 280,
  "sidebarCollapsed" integer DEFAULT 0,
  "dashboardWidgets" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id serial PRIMARY KEY,
  template_type varchar(50) NOT NULL,
  subject varchar(255) NOT NULL,
  html_content text NOT NULL,
  text_content text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."emailNotifications" (
  id serial PRIMARY KEY,
  subject varchar(255) NOT NULL,
  body text NOT NULL,
  "recipientType" varchar(50) NOT NULL,
  "recipientIds" text,
  "recipientRole" varchar(50),
  "sentBy" integer NOT NULL,
  "sentAt" timestamptz NOT NULL DEFAULT now(),
  status varchar(50) NOT NULL DEFAULT 'sent',
  "recipientCount" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."importHistory" (
  id serial PRIMARY KEY,
  "entityType" text NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "fileType" text NOT NULL,
  "importedBy" integer NOT NULL,
  "totalRows" integer NOT NULL,
  "successCount" integer NOT NULL,
  "failedCount" integer NOT NULL,
  errors text,
  status text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_history_imported_by ON public."importHistory" ("importedBy");
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON public."importHistory" ("createdAt");

-- =============================================================================
-- 5. EAM CORE TABLES (organization_id for multi-tenant RLS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  "openId" varchar(64) NOT NULL UNIQUE,
  name text,
  email varchar(320),
  "passwordHash" varchar(255),
  "loginMethod" varchar(64),
  role text NOT NULL DEFAULT 'user',
  "siteId" integer,
  status text NOT NULL DEFAULT 'pending',
  "jobTitle" varchar(255),
  "phoneNumber" varchar(50),
  "phoneCountryCode" varchar(10) DEFAULT '+234',
  agency varchar(255),
  "geographicalArea" varchar(255),
  "registrationPurpose" text,
  "employeeId" varchar(100),
  department varchar(255),
  "supervisorName" varchar(255),
  "supervisorEmail" varchar(320),
  "approvedBy" integer,
  "approvedAt" timestamptz,
  "rejectionReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSignedIn" timestamptz NOT NULL DEFAULT now(),
  has_completed_onboarding boolean NOT NULL DEFAULT false,
  supabase_user_id uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_supabase_user_id ON public.users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sites (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  address text,
  city varchar(100),
  state varchar(100),
  country varchar(100) DEFAULT 'Nigeria',
  "contactPerson" varchar(255),
  "contactPhone" varchar(50),
  "contactEmail" varchar(320),
  "isActive" boolean NOT NULL DEFAULT true,
  latitude numeric(10,8),
  longitude numeric(11,8),
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON public.sites(organization_id);

CREATE TABLE IF NOT EXISTS public."assetCategories" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id serial PRIMARY KEY,
  "assetTag" varchar(100) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  "categoryId" integer NOT NULL,
  "siteId" integer NOT NULL,
  status varchar(100) NOT NULL DEFAULT 'In Use',
  manufacturer varchar(255),
  model varchar(255),
  "serialNumber" varchar(255),
  "acquisitionDate" timestamptz,
  "acquisitionCost" numeric(15,2),
  "currentValue" numeric(15,2),
  "depreciationRate" numeric(5,2),
  "warrantyExpiry" timestamptz,
  location varchar(255),
  "assignedTo" integer,
  "imageUrl" text,
  notes text,
  "qrCode" text,
  barcode varchar(255),
  "barcodeFormat" varchar(50),
  latitude numeric(10,8),
  longitude numeric(11,8),
  "depreciationMethod" varchar(50),
  "usefulLifeYears" integer,
  "residualValue" numeric(12,2),
  "depreciationStartDate" timestamptz,
  "itemType" varchar(20) DEFAULT 'Asset',
  "subCategory" varchar(100),
  "branchCode" varchar(10),
  "itemCategoryCode" varchar(10),
  "assetNumber" integer,
  "productNumber" varchar(255),
  "methodOfAcquisition" varchar(100),
  "acquisitionDetails" text,
  "projectReference" varchar(255),
  "yearAcquired" integer,
  "acquiredCondition" varchar(20),
  "currentDepreciatedValue" numeric(15,2),
  "assignedToName" varchar(255),
  department varchar(255),
  condition varchar(100),
  "lastPhysicalCheckDate" timestamptz,
  "checkConductedBy" varchar(255),
  remarks text,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_organization_id ON public.assets(organization_id);

CREATE TABLE IF NOT EXISTS public."workOrders" (
  id serial PRIMARY KEY,
  "workOrderNumber" varchar(100) NOT NULL UNIQUE,
  title varchar(255) NOT NULL,
  description text,
  "assetId" integer NOT NULL,
  "siteId" integer NOT NULL,
  type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  "assignedTo" integer,
  "requestedBy" integer NOT NULL,
  "scheduledStart" timestamptz,
  "scheduledEnd" timestamptz,
  "actualStart" timestamptz,
  "actualEnd" timestamptz,
  "estimatedCost" numeric(15,2),
  "actualCost" numeric(15,2),
  "completionNotes" text,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workOrders_organization_id ON public."workOrders"(organization_id);

CREATE TABLE IF NOT EXISTS public."maintenanceSchedules" (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  "assetId" integer NOT NULL,
  frequency text NOT NULL,
  "frequencyValue" integer NOT NULL DEFAULT 1,
  "lastPerformed" timestamptz,
  "nextDue" timestamptz NOT NULL,
  "assignedTo" integer,
  "isActive" boolean NOT NULL DEFAULT true,
  "taskTemplate" text,
  "estimatedDuration" integer,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenanceSchedules_organization_id ON public."maintenanceSchedules"(organization_id);

CREATE TABLE IF NOT EXISTS public."inventoryItems" (
  id serial PRIMARY KEY,
  "itemCode" varchar(100) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  category varchar(100),
  "siteId" integer NOT NULL,
  "currentStock" integer NOT NULL DEFAULT 0,
  "minStockLevel" integer NOT NULL DEFAULT 0,
  "reorderPoint" integer NOT NULL DEFAULT 0,
  "maxStockLevel" integer,
  "unitOfMeasure" varchar(50),
  "unitCost" numeric(15,2),
  "vendorId" integer,
  location varchar(255),
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventoryItems_organization_id ON public."inventoryItems"(organization_id);

CREATE TABLE IF NOT EXISTS public."inventoryTransactions" (
  id serial PRIMARY KEY,
  "itemId" integer NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  "workOrderId" integer,
  "fromSiteId" integer,
  "toSiteId" integer,
  "unitCost" numeric(15,2),
  "totalCost" numeric(15,2),
  "performedBy" integer NOT NULL,
  notes text,
  "transactionDate" timestamptz NOT NULL DEFAULT now(),
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventoryTransactions_organization_id ON public."inventoryTransactions"(organization_id);

CREATE TABLE IF NOT EXISTS public.vendors (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  contact_person varchar(255),
  email varchar(320),
  phone varchar(50),
  address text,
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_organization_id ON public.vendors(organization_id);

CREATE TABLE IF NOT EXISTS public."complianceRecords" (
  id serial PRIMARY KEY,
  "assetId" integer,
  type text,
  status text,
  "dueDate" timestamptz,
  "completedAt" timestamptz,
  notes text,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complianceRecords_organization_id ON public."complianceRecords"(organization_id);

CREATE TABLE IF NOT EXISTS public.documents (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  "fileUrl" text NOT NULL,
  "fileKey" varchar(500) NOT NULL,
  "fileType" varchar(100),
  "fileSize" bigint,
  "entityType" varchar(100),
  "entityId" integer,
  organization_id uuid,
  encryption_algorithm text,
  encryption_key_version integer,
  encryption_iv text,
  encryption_auth_tag text,
  encrypted_at timestamptz,
  is_encrypted boolean NOT NULL DEFAULT false,
  "uploadedBy" integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_encrypted_created ON public.documents(organization_id, is_encrypted);
CREATE INDEX IF NOT EXISTS idx_documents_encryption_key_version ON public.documents(encryption_key_version);

CREATE TABLE IF NOT EXISTS public."assetPhotos" (
  id serial PRIMARY KEY,
  "assetId" integer NOT NULL,
  "fileUrl" text NOT NULL,
  "fileKey" varchar(500),
  "uploadedBy" integer,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assetPhotos_organization_id ON public."assetPhotos"(organization_id);

CREATE TABLE IF NOT EXISTS public.inspections (
  id serial PRIMARY KEY,
  "assetId" integer NOT NULL,
  "templateId" integer,
  status text NOT NULL DEFAULT 'pending',
  "scheduledAt" timestamptz,
  "completedAt" timestamptz,
  "inspectedBy" integer,
  result text,
  notes text,
  organization_id uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspections_organization_id ON public.inspections(organization_id);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (enable + policies using current_tenant_id / auth.uid)
-- =============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_organization_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfer_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_anomaly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workOrders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maintenanceSchedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventoryItems" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventoryTransactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."complianceRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."assetPhotos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Organizations: user can see orgs they belong to
DROP POLICY IF EXISTS organizations_tenant_guardrail ON public.organizations;
CREATE POLICY organizations_tenant_guardrail ON public.organizations
  FOR ALL USING (
    (public.current_tenant_id() IS NOT NULL AND id = public.current_tenant_id())
    OR (public.current_tenant_id() IS NULL AND id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  ) WITH CHECK (
    (public.current_tenant_id() IS NOT NULL AND id = public.current_tenant_id())
    OR (public.current_tenant_id() IS NULL AND id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  );

-- Organization members: user can see own memberships
DROP POLICY IF EXISTS organization_members_self_access ON public.organization_members;
CREATE POLICY organization_members_self_access ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

-- Tenant map: deny anon; server only
DROP POLICY IF EXISTS tenant_organization_map_deny_anon ON public.tenant_organization_map;
CREATE POLICY tenant_organization_map_deny_anon ON public.tenant_organization_map
  FOR ALL USING (false) WITH CHECK (false);

-- Policy helper: org-scoped (organization_id) and tenant_id-scoped tables
DO $$
DECLARE
  org_tables text[] := ARRAY[
    'sites', 'assets', 'workOrders', 'maintenanceSchedules', 'inventoryItems', 'inventoryTransactions',
    'vendors', 'complianceRecords', 'documents', 'assetPhotos', 'inspections', 'organization_encryption_keys'
  ];
  tenant_tables text[] := ARRAY[
    'platform_events', 'warehouse_transfer_recommendations', 'vendor_performance',
    'integration_connectors', 'telemetry_anomaly_events'
  ];
  t text;
  using_sql text := $p$(
    (public.current_tenant_id() IS NOT NULL AND organization_id = public.current_tenant_id())
    OR (public.current_tenant_id() IS NULL AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  )$p$;
  tenant_using_sql text := $p$(
    (public.current_tenant_id() IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (public.current_tenant_id() IS NULL AND tenant_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  )$p$;
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_guardrail', t);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
          t || '_tenant_guardrail', t, using_sql, using_sql
        );
      END IF;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id') THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_guardrail', t);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
          t || '_tenant_guardrail', t, tenant_using_sql, tenant_using_sql
        );
      END IF;
    END IF;
  END LOOP;
END $$;
