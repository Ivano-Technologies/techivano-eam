-- Staging tenant-isolation verification checks (read-only).
-- These statements are reference queries used by the TS runner and for manual psql execution.
--
-- Optional fixture guidance:
-- 1) Ensure there are at least 2 active members in different orgs (Org A user and Org B user).
--    select organization_id, user_id from public.organization_members where is_active = true limit 20;
-- 2) Ensure Org B has at least one asset row and at least one encrypted document row.
--    select organization_id, count(*) from public.assets group by organization_id order by count(*) desc;
--    select organization_id, count(*) from public.documents where coalesce(is_encrypted, false)=true group by organization_id;
--
-- Manual psql parameters (example):
--   \set USER_A '00000000-0000-0000-0000-000000000001'
--   \set USER_B '00000000-0000-0000-0000-000000000002'
--   \set ORG_B  '00000000-0000-0000-0000-0000000000aa'

-- 1) Org RLS policy + table RLS enabled checks
with required_tables as (
  select unnest(array['organizations', 'organization_members', 'assets', 'documents']) as table_name
),
rls_flags as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (select table_name from required_tables)
),
policy_presence as (
  select
    tablename as table_name,
    count(*) > 0 as has_policy
  from pg_policies
  where schemaname = 'public'
    and tablename in (select table_name from required_tables)
  group by tablename
)
select
  t.table_name,
  coalesce(r.rls_enabled, false) as rls_enabled,
  coalesce(p.has_policy, false) as has_policy
from required_tables t
left join rls_flags r on r.table_name = t.table_name
left join policy_presence p on p.table_name = t.table_name
order by t.table_name;

-- 2) Fixture visibility sanity check (Org B user should see Org B rows)
begin;
set transaction read only;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'USER_B', true);
select count(*) as org_b_assets_visible_to_org_b_user
from public.assets
where organization_id = :'ORG_B'::uuid;
rollback;

-- 3) Org A user must not be able to see Org B assets
begin;
set transaction read only;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'USER_A', true);
select count(*) as cross_org_assets_visible
from public.assets
where organization_id = :'ORG_B'::uuid;
rollback;

-- 4) Fixture visibility sanity check for encrypted docs (as Org B user)
begin;
set transaction read only;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'USER_B', true);
select count(*) as org_b_encrypted_docs_visible_to_org_b_user
from public.documents
where organization_id = :'ORG_B'::uuid
  and coalesce(is_encrypted, false) = true;
rollback;

-- 5) Encrypted document access must require matching organization_id (as Org A user)
begin;
set transaction read only;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'USER_A', true);
select count(*) as cross_org_encrypted_docs_visible
from public.documents
where organization_id = :'ORG_B'::uuid
  and coalesce(is_encrypted, false) = true;
rollback;
