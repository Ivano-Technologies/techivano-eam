# Supabase Migration Mismatch Fix

## What was done

1. **Migration folder**
   - Confirmed `supabase/migrations` and that the CLI requires filenames like `<timestamp>_name.sql` (e.g. `20260311000000_name.sql`). A file named only `20260311.sql` is **skipped** by the CLI and does not count as a migration.

2. **Placeholder files**
   - **`20260311.sql`** — Kept as requested (comment only, no schema changes). The CLI skips it because it does not match `<timestamp>_name.sql`.
   - **`20260311_remote.sql`** — Pattern-compliant placeholder (no schema changes) so the CLI has a migration for the “20260311” slot.
   - **`20260311000000_align_remote.sql`** — Was created during repair then removed so local does not have an extra migration (remote `20260311000000` was reverted).

3. **Remote history**
   - `supabase migration repair` was used to revert/apply rows so that the remote migration history table no longer has an orphan `20260311` without a matching local file.
   - The remote DB still has one row with **version = `20260311`**. The CLI expects that to match a **local migration version**. The only local migration we have for that slot is **`20260311_remote`** (from `20260311_remote.sql`), so the stored version and the CLI’s idea of the local version do not match.

4. **Archived migrations**
   - **`20260311_placeholder.sql`** and **`20260311_tenant_index_optimization.sql`** were moved to **`supabase/migrations_archive/`** so they are not loaded by the CLI. That avoids extra “local only” migrations and keeps the index optimization SQL available if you want to re-apply it (see `migrations_archive/README.md`).

## Why `db pull` still fails

- Remote has a row: **version = `20260311`**.
- Local has a file: **`20260311_remote.sql`** → CLI treats its version as **`20260311_remote`**.
- So: `20260311` ≠ `20260311_remote` → mismatch → `supabase db pull` fails.
- The CLI does not accept a file named `20260311.sql` as a migration (it skips it), so we cannot get a local “version” of `20260311` without changing how the CLI works or changing the remote row.

## Fix so `db pull` and `db push` work

Update the remote migration history so the row that is currently `20260311` is stored as `20260311_remote` (to match the local file `20260311_remote.sql`).

**In Supabase Dashboard → SQL Editor, run:**

```sql
UPDATE supabase_migrations.schema_migrations
SET version = '20260311_remote'
WHERE version = '20260311';
```

Then in your repo:

```powershell
cd C:\Antigravity\Projects\techivano-eam
supabase migration list
supabase db pull
supabase db push
```

- **`supabase migration list`** should show the same migrations in both Local and Remote (including `20260311_remote`).
- **`supabase db pull`** should succeed.
- **`supabase db push`** should report something like “Database is up to date” (no new migrations to apply).

## Summary

- **Placeholder migration** for alignment: **`20260311.sql`** (kept; CLI skips it) and **`20260311_remote.sql`** (used by CLI; no schema changes).
- **Repair steps done:** Reverted/applied migration rows via `supabase migration repair`; reverted `20260311000000`; moved two migrations to `supabase/migrations_archive/`.
- **Remaining step for you:** Run the `UPDATE` above in the Supabase SQL Editor once, then re-run `migration list`, `db pull`, and `db push` as above.

No schema changes were applied; only migration history and file layout were adjusted.
