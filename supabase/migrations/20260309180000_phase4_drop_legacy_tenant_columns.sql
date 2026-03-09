-- Phase 4E: Drop legacy tenant columns only from core tables that have organization_id populated.
-- Run only after: 4A verification (zero NULL organization_id), 4B/4C complete.
-- Reversible: columns are dropped; to roll back, re-add columns and backfill from tenant_organization_map or restore from backup.

-- Drop inspections.tenantId (integer) — canonical tenant is now organization_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inspections' AND column_name = 'tenantId'
  ) THEN
    ALTER TABLE public.inspections DROP COLUMN "tenantId";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inspections' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.inspections DROP COLUMN tenant_id;
  END IF;
END $$;

-- Drop documents.business_id and documents.tenant_id if present (documents use organization_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.documents DROP COLUMN business_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.documents DROP COLUMN tenant_id;
  END IF;
END $$;

-- Do NOT drop tenantId/tenant_id from analytics tables (warehouse_transfer_recommendations,
-- vendor_performance_metrics, vendor_risk_scores, procurement_recommendations, etc.) —
-- they do not yet have organization_id. Defer to a later phase.
