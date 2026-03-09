# Phase 3A — Verify Existing Organization Tables

**Purpose:** Confirm that `organizations` and `organization_members` exist and have the required structure before proceeding with organization_id rollout and RLS.

**Do not modify these tables.** Run the following in the Supabase SQL Editor (or `psql`).

---

## 1. Confirm tables exist

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'organization_members')
ORDER BY table_name;
```

**Expected:** Two rows — `public.organizations`, `public.organization_members`.

---

## 2. Confirm organizations columns

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;
```

**Required columns:**

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| id          | uuid      | NO          |
| name        | text      | NO          |
| slug        | text      | NO          |
| is_active   | boolean   | NO          |
| created_at  | timestamptz | NO        |
| updated_at  | timestamptz | NO        |

`id` should be primary key with default `gen_random_uuid()`.

---

## 3. Confirm organization_members columns

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;
```

**Required columns:**

| column_name     | data_type | is_nullable |
|-----------------|-----------|-------------|
| id              | uuid      | NO          |
| organization_id | uuid      | NO          |
| user_id         | uuid      | NO          |
| role            | text      | NO          |
| is_active       | boolean   | NO          |
| created_at      | timestamptz | NO        |
| updated_at      | timestamptz | NO        |

`organization_id` should reference `public.organizations(id)`.

---

## 4. Check for valid rows (optional)

```sql
SELECT (SELECT COUNT(*) FROM public.organizations) AS org_count,
       (SELECT COUNT(*) FROM public.organization_members) AS member_count;
```

Ensure at least one organization exists for backfill and RLS. If zero, create a default organization and link users via `organization_members` before enabling RLS on tenant tables.

---

## 5. Proceed to Phase 3B

Only after verification: run the Phase 3 migration that adds `organization_id` to tenant tables, backfills, and enables RLS.
