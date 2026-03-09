# Phase 3I — Migration Verification

**Purpose:** Verify tenant isolation after Phase 3 migration and RLS rollout.

---

## Scenario 1: User A in Organization A

1. Authenticate as a user who is a member of **Organization A** (via `organization_members`).
2. Call the assets list API (or equivalent) with that user’s session.
3. **Expected:** Only assets where `organization_id = Organization A's UUID` are returned.
4. Repeat for work orders, sites, vendors, inventory, compliance, maintenance schedules.

---

## Scenario 2: User B in Organization B

1. Authenticate as a user who is a member of **Organization B** only.
2. Call the assets list API (or equivalent).
3. **Expected:** Only assets where `organization_id = Organization B's UUID` are returned.
4. User B must not see any of Organization A’s data.

---

## Scenario 3: Cross-tenant query (direct SQL)

Run in Supabase SQL Editor as a user with access to the database (e.g. service role or postgres):

```sql
-- Set session to simulate User A (use a real user_id from organization_members for Org A)
-- Then run:
SELECT * FROM assets WHERE organization_id = '<organization_b_uuid>';
```

- When run **as User A** (via Supabase Auth / RLS), the same query for Organization B’s UUID should return **0 rows**.
- When run with **bypass RLS** (e.g. service role), rows may be visible for testing; the important check is that the **application and RLS** restrict access.

---

## Checklist

- [ ] 3A verification passed (organizations and organization_members exist and have correct columns).
- [ ] Phase 3 migration applied (organization_id added, backfilled, NOT NULL set where applicable, RLS enabled).
- [ ] No rows with `organization_id IS NULL` in tenant tables:  
  `SELECT COUNT(*) FROM assets WHERE organization_id IS NULL;` → 0 (and same for other tenant tables).
- [ ] Server API list endpoints return only rows for the request’s organization (ctx.organizationId).
- [ ] Direct SQL as Org A user for Org B’s organization_id returns 0 rows (RLS enforced).
