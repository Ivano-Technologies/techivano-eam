-- RBAC: permissions jsonb for organization_members (one-off overrides / feature flags).
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
