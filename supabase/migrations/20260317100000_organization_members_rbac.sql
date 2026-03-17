-- RBAC: add permissions and constrain role on organization_members.
-- Role semantics: owner (full control), admin (manage users, all resources), manager (create/update domain),
-- member (standard usage), viewer (read-only).

-- Add permissions column for feature flags / overrides without schema churn
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill invalid or null roles to 'member'
UPDATE public.organization_members
SET role = 'member'
WHERE role IS NULL
   OR role NOT IN ('owner', 'admin', 'manager', 'member', 'viewer');

-- Drop existing check if any (e.g. from a previous run), then add canonical check
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS org_members_role_check;

ALTER TABLE public.organization_members
  ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'));
