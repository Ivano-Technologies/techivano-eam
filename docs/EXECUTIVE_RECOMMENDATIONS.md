# Executive Recommendations — Techivano EAM

**Generated using:** Supabase MCP (security & performance advisors), CLI (`pnpm typecheck`, `pnpm build`, `pnpm test`).  
**Project:** TECHIVANO EAM (Supabase project `itzigdbbkkwmnaitlqfy`).  
**Date:** 2026-03-09

---

## Summary

Techivano is in good shape for a multi-tenant SaaS platform: production build succeeds, typecheck passes after dependencies are installed, and Supabase reports the project as **ACTIVE_HEALTHY**. The recommendations below focus on **security hardening**, **performance at scale**, and **operational reliability** so the platform stays production-grade as usage grows.

---

## 1. Security (Supabase MCP — Security Advisor)

### Finding
- **~40 tables** have RLS enabled but **no policies**. Those tables are effectively locked for direct Postgres access (service role still works). If any client or future integration expects to read them with anon/key, they will see no rows.
- **1 WARN:** Function `public.update_updated_at_column` has a mutable `search_path` (potential privilege escalation if other objects are in the path).

### Recommendations
| Priority | Action | How |
|----------|--------|-----|
| **High** | Add RLS policies to high-value tables | Use Supabase MCP or Dashboard: for each table that should be tenant-scoped, add a policy using `(select auth.uid())` and `organization_id` / `organization_members`. Start with: `assets`, `workOrders`, `sites`, `inspections`, `users`, `organization_members`, `organizations`. |
| **Medium** | Fix function `search_path` | In Supabase SQL Editor or a migration: `ALTER FUNCTION public.update_updated_at_column() SET search_path = public;` (or a minimal path). Re-run Security Advisor via MCP to confirm. |
| **Low** | Decide policy for RLS-only tables | For tables that are server-only (e.g. `backgroundJobRuns`, `telemetry_points`), either add a restrictive policy (e.g. service role only) or document that they are intentionally policy-less and never exposed to anon/key. |

**MCP:** Use `get_advisors(project_id, type: "security")` periodically to track remaining RLS and function issues.

---

## 2. Performance (Supabase MCP — Performance Advisor)

### Findings
- **RLS policies** on core tenant tables (`organizations`, `organization_members`, `assets`, `workOrders`, `sites`, `inspections`, `vendors`, `inventoryItems`, `maintenanceSchedules`, `complianceRecords`, `users`) use `auth.uid()` directly. That can force re-evaluation per row; at scale this hurts query performance.
- **Many indexes** reported as unused (e.g. `sla_metrics`, `audit_logs`, `backgroundJobRuns`, `workOrders`, `inspections`, `organizations`, `organization_members`). Some may be for future features or reporting; others may be removable to speed up writes.
- **Auth DB connections** use an absolute cap (e.g. 10) rather than a percentage of pool; scaling the instance won’t automatically give Auth more connections.

### Recommendations
| Priority | Action | How |
|----------|--------|-----|
| **High** | Optimize RLS for `auth.uid()` | In each policy, replace `auth.uid()` with `(select auth.uid())` so it’s evaluated once per query. Apply via Supabase SQL migration. Example: `using (organization_id in (select organization_id from organization_members where user_id = (select auth.uid())))`. Re-run Performance Advisor via MCP to confirm. |
| **Medium** | Review unused indexes | Use MCP performance advisor list; for each unused index, confirm whether the table is used by reporting/workers. Drop only after confirming no current or planned use. Keep indexes on `organization_id` and tenant-scoped filters. |
| **Low** | Auth connection strategy | In Supabase Dashboard (Project Settings / Database), consider switching Auth to a percentage-based connection allocation if you plan to scale the instance. |

**MCP:** Use `get_advisors(project_id, type: "performance")` after schema/policy changes to catch regressions.

---

## 3. Deployment & CI (CLI)

### Findings
- **Build:** `pnpm build` **succeeds** (Vite + esbuild server bundle).
- **Typecheck:** `pnpm typecheck` **passes** after `pnpm install` (e.g. `@supabase/supabase-js` present).
- **Tests:** `pnpm test` **fails** due to missing test bootstrap file (`server/test/bootstrapLegacyTables.ts`). Many suite files exist but report 0 tests and fail on load.

### Recommendations
| Priority | Action | How |
|----------|--------|-----|
| **High** | Fix test bootstrap so CI is green | Add or restore `server/test/bootstrapLegacyTables.ts` (or update test setup to not depend on it). Run locally: `pnpm test` until it passes, then keep CI running tests on every PR. |
| **Medium** | Enforce install before typecheck in CI | In `.github/workflows/ci.yml`, ensure `pnpm install --frozen-lockfile` runs before `pnpm typecheck` (already the case; document that new client deps require `pnpm install` for typecheck). |
| **Low** | Reduce build warnings | Address Vite env warnings (`VITE_ANALYTICS_*`) and chunk-size warning (e.g. code-splitting or `build.chunkSizeWarningLimit`) so the build log stays clean. |

**CLI:** Before every merge to `main`, run: `pnpm install && pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

---

## 4. Environment & Configuration

- **Env validation:** `server/env.ts` (Zod) and `client/src/lib/env.ts` (requireEnv) ensure missing Supabase or DB config fails fast. Keep these in sync with `.env.example` and deployment (Vercel/Railway).
- **Health check:** `GET /api/health` or `GET /health` is in place; use it for uptime checks and load balancers.

**Recommendation:** In Vercel/Railway, set env per environment (staging vs production) and never use production secrets in staging. Re-run a quick build after any env change: `pnpm build`.

---

## 5. Branch & Release Strategy

- **Branch strategy** is documented in `docs/DEPLOYMENT_AND_BRANCH_STRATEGY.md` (main → production, staging → pre-prod, develop → integration).
- **CI** runs on `main`, `staging`, and `develop` (typecheck, lint, test, build, worker build).

**Recommendation:** Keep branch protection on `main` so that merges require a passing CI (including tests once the bootstrap is fixed). Prefer “merge after staging verification” to avoid accidental broken production deploys.

---

## 6. How to Re-run Checks (MCP + CLI)

| Goal | Tool | Command / MCP call |
|------|------|---------------------|
| Security posture | Supabase MCP | `get_advisors(project_id: "itzigdbbkkwmnaitlqfy", type: "security")` |
| Performance posture | Supabase MCP | `get_advisors(project_id: "itzigdbbkkwmnaitlqfy", type: "performance")` |
| Project list / status | Supabase MCP | `list_projects()` |
| Typecheck | CLI | `pnpm typecheck` |
| Lint | CLI | `pnpm lint` |
| Build | CLI | `pnpm build` |
| Tests | CLI | `pnpm test` |
| Full pre-merge gate | CLI | `pnpm install && pnpm typecheck && pnpm lint && pnpm build && pnpm test` |

---

## 7. Priority Overview

| # | Area | Top action |
|---|------|------------|
| 1 | Security | Add RLS policies to tenant tables that need them; fix `update_updated_at_column` search_path. |
| 2 | Performance | Change RLS policies to use `(select auth.uid())`; then review unused indexes. |
| 3 | CI / Quality | Restore or fix test bootstrap so `pnpm test` passes and CI remains reliable. |
| 4 | Ops | Use `/api/health` for monitoring; keep env validated and branch strategy followed. |

---

This document reflects the state of the repo and Supabase project at the time of generation. Re-run MCP advisors and CLI checks after major schema, policy, or dependency changes to keep recommendations current.
