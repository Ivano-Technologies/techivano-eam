# Resumed Phases — Post–DB Baseline

After the Supabase migration blocker was lifted and the fresh baseline (`20260312100000_fresh_schema.sql`) was applied, these phases resume.

---

## Status overview

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 7** | Align `src/app/api` routes with unified auth (same cookie/Bearer + Supabase JWT verification as Express) | Done |
| **Phase 8** | Testing and rollout (unit, integration, E2E; docs) | Done |
| **Audit follow-up** | Remaining router split (HIGH-11), optional FKs | In progress (assetCategories + nrcs extracted) |

---

## Phase 7 — Align API routes with unified auth

**Goal:** All API routes under `src/app/api/*` use the same auth model as the Express/tRPC app: Supabase JWT from `app_session_id` cookie or `Authorization: Bearer`.

**Current:** Routes use `getSupabaseForRequest(request)` and `supabase.auth.getUser()`.

**Target:**

- **Option A (implemented):** Shared helper that reads cookie/Bearer, verifies Supabase JWT, and returns app `User` (or builds a Supabase client with that token so RLS applies). Same verification path as `server/_core/authenticateRequest.ts` and `getUserFromSupabaseToken`.
- **Option B:** Proxy API calls through Express so all auth goes through tRPC/Express context.

**Deliverables:**

- [x] `src/lib/supabase/server.ts` exports:
  - `getSessionTokenFromRequest(request)` — read `app_session_id` cookie and Bearer.
  - `getSupabaseForRequest(request)` — create Supabase client with that token so `auth.getUser()` and `.from()` use the same session.
  - `createAdminClient()` / `createServerClient()` for admin and server-component use.
- [x] `src/lib/supabase/session.ts` exports `requireServerUser(supabase)` for dashboard pages.
- [x] All `src/app/api/*` routes already use `getSupabaseForRequest`; they now receive a client that sends the same token as Express (unified auth).
- [x] Documented in `SUPABASE_AUTH_MIGRATION_PLAN.md` (Phase 7 = Done).

**Files to touch:**

- `src/lib/supabase/server.ts` (create or update)
- `src/app/api/transactions/route.ts`
- `src/app/api/entries/route.ts`
- `src/app/api/operations/command-center/route.ts`
- `src/app/api/warehouse/transfer-recommendations/route.ts`
- `src/app/api/vendor-intelligence/recommendations/route.ts`
- `src/app/api/integrations/connectors/route.ts`
- `src/app/api/vendors/suggest/route.ts`
- `src/app/api/expenses/ocr/route.ts`

---

## Phase 8 — Testing and rollout

**Goal:** Test suite and docs updated; rollout plan clear.

**Deliverables:**

- [x] **Unit:** `server/_core/supabaseAuth.test.ts` — JWT verification and user resolution (valid token, unknown user, email match, cache hit, lazy migration).
- [x] **Integration:** `server/auth.me.integration.test.ts` — `auth.me` returns user when authenticated, null when not; logout clears cookie.
- [x] **E2E:** `tests/e2e/auth.spec.ts` — sign-in → home; second test sign-in → dashboard → optional logout.
- [x] **Docs:** Runbook and README updated with Supabase auth env vars and redirect URLs (see DEPLOYMENT_RUNBOOK.md, README.md).

**Reference:** `docs/SUPABASE_AUTH_MIGRATION_PLAN.md` Phase 8 section.

---

## Audit follow-up (backlog)

- **Remaining router split (HIGH-11):** Move remaining inline routers from `server/routers.ts` into `server/routers/*.ts` (assetCategories, nrcs, maintenance, inventory, warehouseV1, etc.). See `docs/AUDIT_REMEDIATION.md`.
- **Optional FKs:** Add foreign keys for `auth_tokens.user_id`, `pending_users.approved_by`, `workOrders.siteId`/`requestedBy`/`assignedTo`, etc., in a follow-up migration when table names are confirmed.

---

## DB baseline (done)

- Single migration: `supabase/migrations/20260312100000_fresh_schema.sql`
- RLS, tenant guardrail, and indexes in place
- See `docs/BACKEND_STATUS.md`

---

*Last updated: March 2026.*
