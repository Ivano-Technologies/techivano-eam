# Enterprise Asset Management (EAM) — Codebase Audit Report

**Analysis date:** 2025-03-19  
**Scope:** Full codebase audit — structure, stack, features, working/non-working areas, risks, improvements, MVP production readiness.

---

## Post-audit updates (recent changes)

- **Single site:** Marketing site disabled; all hosts serve the EAM app. Main site is **techivano.com** (and www, localhost); admin/nrcseam subdomains disabled for routing; auth simplified to one site.
- **Login:** Email + password is the primary sign-in; “Send magic link instead” and Google/Microsoft OAuth are secondary. Supabase magic link uses `signInWithOtp` → redirect to `/auth/callback` → `exchangeCodeForSession` → `auth.setSession`. The legacy custom magic-link flow (requestMagicLink, `/api/auth/verify-magic-link`, custom JWT) is not the primary path; if still present in code, it is legacy.
- **Preview page:** The `/preview` route and `PreviewPage.tsx` have been removed.
- **Link styling:** All auth text links use muted default color with red (`#DC2626`) on hover only.
- **Google logo:** Login button uses the official multi-color Google “G” logo.

**Signup domains:** Main site (techivano.com, www, localhost, nrcseam.techivano.com) correctly uses NRCS allowed domains; no “nrcs.techivano.com” typo in current code.

**If “Invalid or expired session token” still appears after callback:** JWT verification or user resolution in `setSession` may be failing (e.g. `SUPABASE_JWT_SECRET` / `SUPABASE_URL`, or user not found in DB). Rely on email/password sign-in for MVP until magic-link verification is confirmed.

---

## 1. Structure & stack

### 1.1 Project structure

| Area | Location | Purpose |
|------|----------|---------|
| **Client** | `client/` | React SPA (Vite). Entry: `client/index.html` → `client/src/main.tsx` → `App.tsx`. Root in Vite config: `client/`. |
| **Server** | `server/` | Node/Express app. Entry: `server/_core/index.ts`. tRPC router root: `server/routers.ts`. |
| **Shared** | `shared/` | Constants and types used by client and server (e.g. `shared/const.ts`, `shared/types.ts`). |
| **API (Vercel)** | `api/` | Vercel serverless: `api/trpc/[...path].ts` (tRPC), `api/auth/google.ts`, `api/auth/google/callback.ts`. No `api/auth/verify-magic-link`. |
| **DB / migrations** | `drizzle/` | Drizzle schema (`drizzle/schema.ts`), migrations in `drizzle/*.sql`. |
| **Scripts** | `scripts/` | E2E seed, RLS tests, queue health, deploy, redirect URLs, etc. |
| **Config** | Root + `config/` | `vite.config.ts`, `tsconfig.json`, `config/aliases.ts`, `vercel.json`. |
| **Docs** | `docs/` | Auth checklists, phase reports, deployment, RLS, architecture. |
| **CI** | `.github/workflows/` | Auth E2E workflow (`auth-e2e.yml`) — deploy-blocking. |

**Path aliases:** `@` → `client/src`, `@server` → `server`, `@shared` → `shared` (see `config/aliases.ts`, `vite.config.ts`).

### 1.2 Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, wouter (routing), Tailwind 4, Radix UI, Framer Motion, Recharts. State: TanStack Query + tRPC React. |
| **Backend** | Node + Express. API: tRPC 11 (single `appRouter` in `server/routers.ts`). No Convex. |
| **Database** | Postgres via Drizzle ORM (`drizzle-orm`, `drizzle-kit`). Schema: `drizzle/schema.ts` (users, sites, assets, workOrders, etc.). |
| **Auth** | Supabase Auth (primary). Session: httpOnly cookie `app_session_id` = Supabase access token. Verification: `server/_core/authenticateRequest.ts` → `getUserFromSupabaseToken` (HS256 + JWKS fallback). Custom Google OAuth: `api/auth/google.ts` + callback. |
| **Background jobs** | BullMQ + Redis. Worker: `server/_core/worker.ts`. Queue: `server/jobs/queue.ts`. |
| **Storage** | AWS S3–compatible (R2) for uploads; multipart and encrypted upload flows in `server/_core/index.ts` and `server/_core/r2.ts`. |
| **Email** | Resend (primary), SMTP fallback. Templates: `server/emailTemplates.ts`. |
| **Deployment** | Vercel (rewrites in `vercel.json`: non-`api/` → `/index.html`). Build: `vite build` → `dist/public/`, server bundle → `dist/index.js`. Env: `.env.example` documents vars; production uses Vercel env / secrets. |

**Key dependencies (from `package.json`):** `@supabase/supabase-js`, `@trpc/client` / `@trpc/server` / `@trpc/react-query`, `drizzle-orm`, `postgres`, `ioredis`, `bullmq`, `jose`, `zod`, `react-hook-form`, `@hookform/resolvers`, `html5-qrcode`, `node-quickbooks`, `@sentry/react` / `@sentry/node`, `pino`, `vite-plugin-pwa`.

---

## 2. Features in place

### 2.1 Auth

| Feature | Location | Status |
|---------|----------|--------|
| **Login** | `client/src/pages/Login.tsx` — email/password (Supabase), “Send magic link”, Google, Microsoft. Redirect: `origin + /auth/callback`. | **Complete** (email/password + OAuth). |
| **Signup** | `client/src/pages/Signup.tsx`. Backend: `server/routers/auth.ts` (`signup`, `signupWithPassword`). Domain allowlist: `server/_core/signupDomain.ts`. | **Complete** (domain-restricted). |
| **Magic link** | Request: tRPC `auth.requestMagicLink`. Verify: **Express-only** `POST /api/auth/verify-magic-link` in `server/_core/index.ts`. Client: `client/src/pages/VerifyMagicLink.tsx` calls `/api/auth/verify-magic-link`. Email link: `server/magicLinkAuth.ts` uses wrong path (`/auth/verify` vs `/verify-magic-link`) and sets **custom JWT** (not Supabase), so cookie is rejected by `authenticateRequest`. | **Broken** — wrong link URL, no Vercel route, wrong session type (see §4). |
| **OAuth (Google / Microsoft)** | Custom: `api/auth/google.ts`, `api/auth/google/callback.ts`. Supabase-hosted when custom not set. Callback → `/auth/callback?access_token=...` or code exchange. | **Complete** (Google; Microsoft configured in Supabase). |
| **Forgot / reset password** | `client/src/pages/ForgotPassword.tsx`, `ResetPassword.tsx`, `SetPassword.tsx`. Backend: `server/routers/auth.ts` (`requestPasswordReset`, `resetPassword`), `server/passwordReset.ts`. | **Complete**. |
| **MFA (TOTP)** | `client/src/pages/MfaSetup.tsx`, `MfaVerify.tsx`. Enforced for global owners; re-verify after 12h. | **Complete**. |
| **Session** | `auth.setSession` (tRPC) stores Supabase access token in `app_session_id`. Optional `user_sessions` row + `SESSION_COOKIE_NAME` for revoke. Refresh: `client/src/components/AuthRefreshHandler.tsx` on 401. | **Complete**. |
| **Protected routes** | `client/src/components/DashboardLayout.tsx`: uses `useAuth()` (trpc.auth.me); public auth paths skip skeleton; unauthenticated → “Sign In”; MFA required → redirect to `/mfa/setup` or `/mfa/verify`. | **Complete**. |

### 2.2 Assets

| Feature | Location | Status |
|---------|----------|--------|
| **Asset list/detail** | `client/src/pages/Assets.tsx`, `AssetDetail.tsx`. tRPC: `server/routers/assets.ts`. | **Complete**. |
| **Asset scanner** | `client/src/pages/AssetScanner.tsx`, `SmartScanner.tsx`. | **Complete**. |
| **Asset map** | `client/src/pages/AssetMap.tsx`. | **Complete**. |
| **Categories** | `server/routers.ts` → `assetCategoriesRouter`. | **Complete**. |
| **Bulk import/export** | tRPC `bulkOperations`, `server/bulkImport.ts`, `server/bulkImportExport.ts`. | **Complete**. |
| **Photos / uploads** | tRPC `photos`, multipart/signed upload routes in `server/_core/index.ts`. | **Complete**. |

### 2.3 Work orders

| Feature | Location | Status |
|---------|----------|--------|
| **Work orders** | `client/src/pages/WorkOrders.tsx`, `WorkOrderDetail.tsx`. tRPC: `server/routers/workOrders.ts`. | **Complete**. |
| **Templates** | tRPC `workOrderTemplates`. `client/src/pages/WorkOrderTemplates.tsx`. | **Complete**. |
| **Mobile work orders** | `client/src/pages/MobileWorkOrders.tsx`, `MobileWorkOrderDetail.tsx`. | **Complete**. |

### 2.4 Maintenance, inventory, sites, vendors

| Feature | Location | Status |
|---------|----------|--------|
| **Maintenance** | tRPC `maintenance`, reports. `client/src/pages/Maintenance.tsx`. | **Complete**. |
| **Inventory** | tRPC `inventory`. `client/src/pages/Inventory.tsx`. | **Complete**. |
| **Sites** | tRPC `sites`, `server/routers/sites.ts`. `client/src/pages/Sites.tsx`. | **Complete**. |
| **Vendors** | tRPC `vendors` (list, create, update, bulk import, export). `client/src/pages/Vendors.tsx`. | **Complete**. |

### 2.5 Financials, compliance, reports

| Feature | Location | Status |
|---------|----------|--------|
| **Financial** | tRPC `financial` (transactions, lifecycle cost, cost analytics). `client/src/pages/Financial.tsx`. | **Complete**. |
| **Depreciation** | tRPC `depreciation`. `client/src/pages/DepreciationDashboard.tsx`. | **Complete**. |
| **Compliance** | tRPC `compliance`. `client/src/pages/Compliance.tsx`. | **Complete**. |
| **Reports** | tRPC `reports` (asset, maintenance, work order, financial, compliance — PDF/Excel). `client/src/pages/Reports.tsx`. | **Complete**. |
| **Report scheduling** | tRPC `scheduledReports`. `client/src/pages/ReportScheduling.tsx`. | **Complete**. |

### 2.6 Dashboards and intelligence

| Feature | Location | Status |
|---------|----------|--------|
| **Home dashboard** | `client/src/pages/Home.tsx`. tRPC `dashboard`. | **Complete**. |
| **Dashboard settings** | `client/src/pages/DashboardSettings.tsx`. | **Complete**. |
| **Warehouse rebalance** | tRPC `warehouseV1`. `client/src/pages/WarehouseRebalanceDashboard.tsx`. | **Complete**. |
| **Vendor intelligence** | tRPC `vendorIntelligence`. `client/src/pages/VendorIntelligenceDashboard.tsx`. | **Complete**. |
| **Procurement / supply chain / dispatch / executive** | tRPC `procurementV1`, `supplyChainV1`, `dispatchV1`, `executiveV1`. Corresponding client pages. | **Complete**. |
| **Cost analytics / warranty / audit** | `client/src/pages/CostAnalytics.tsx`, `WarrantyAlerts.tsx`, `AuditTrail.tsx`, `ActivityLog.tsx`. | **Complete**. |

### 2.7 Mobile / PWA

| Feature | Location | Status |
|---------|----------|--------|
| **PWA** | `vite.config.ts` → VitePWA (manifest, Workbox, runtime caching). `client/src/hooks/usePWA.ts`, `PWAInstallPrompt.tsx`. | **Complete**. |
| **Mobile work orders** | Dedicated routes and UI. | **Complete**. |
| **Offline queue** | `client/src/pages/OfflineQueue.tsx`. | **Complete**. |

### 2.8 Integrations

| Feature | Location | Status |
|---------|----------|--------|
| **QuickBooks** | tRPC `quickbooks` (config, auth URL, exchange code, sync, test). `client/src/pages/QuickBooksSettings.tsx`, `QuickBooksCallback.tsx`. `server/quickbooksIntegration.ts`. | **Complete** (needs verification with live QB). |

### 2.9 Admin

| Feature | Location | Status |
|---------|----------|--------|
| **Users** | tRPC `users`. `client/src/pages/Users.tsx`. | **Complete**. |
| **Pending users** | tRPC `pendingUsers`, `server/magicLinkAuth.ts` (approve/reject). `client/src/pages/PendingUsers.tsx`. | **Complete**. |
| **Sessions** | tRPC `sessions`. `client/src/pages/Sessions.tsx`. | **Complete**. |
| **Impersonation** | tRPC `impersonation` (admin). `server/routers/adminImpersonation.ts`. `ImpersonationBanner.tsx`. | **Complete**. |
| **Email notifications** | tRPC `emailNotifications` (send, history). `client/src/pages/EmailNotifications.tsx`. | **Complete**. |

### 2.10 Other

| Feature | Location | Status |
|---------|----------|--------|
| **NRCS reference / templates** | tRPC `nrcs`, `nrcsTemplates`. | **Complete**. |
| **Transfers** | tRPC `transfers`. | **Complete**. |
| **Telemetry** | tRPC `telemetry.ingest` / `ingestBatch`. | **Complete**. |
| **Background jobs** | tRPC `backgroundJobs` (enqueue PM, predictive, report, telemetry; get run, list recent). | **Complete**. |
| **Theme / profile / legal** | ThemeSettings, Profile, TermsOfService, PrivacyPolicy. | **Complete**. |
| **Biometric setup** | `client/src/pages/BiometricSetup.tsx`. | **Present** (needs verification). |

---

## 3. What is working

### 3.1 Auth flow

- **Supabase-only:** `server/_core/authenticateRequest.ts` uses only Supabase JWT (cookie or `Authorization: Bearer`). Legacy app JWT removed (per `docs/VERIFICATION_REPORT.md`).
- **Login:** Client `supabase.auth.signInWithPassword` (or OAuth) → callback → `auth.setSession(accessToken)` → cookie set → `auth.me` and protected routes work.
- **Cookie:** `app_session_id` httpOnly, path `/`, SameSite lax, secure in prod. tRPC client: `credentials: "include"` in `client/src/providers/AppProviders.tsx`.
- **Refresh:** `AuthRefreshHandler` on UNAUTHORIZED tries `supabase.auth.refreshSession()` then `auth.setSession`; on failure redirects to login.
- **MFA:** Global owner check and redirect to `/mfa/setup` or `/mfa/verify` in `DashboardLayout`.

### 3.2 Protected routes and tRPC

- **DashboardLayout** treats public auth paths as non-skeleton; all other routes require `user` from `useAuth()` (trpc.auth.me); otherwise “Sign In” or MFA redirect.
- **tRPC:** Single router in `server/routers.ts`; procedures use `viewerProcedure`, `managerOrAdminProcedure`, `adminProcedure` from `server/routers/_shared.ts`. Context: `server/_core/context.ts` (user, tenantId, organizationId, membership, appVariant, isGlobalOwner, impersonation).

### 3.3 DB and env

- **DB:** Drizzle + Postgres; schema in `drizzle/schema.ts`; migrations via `pnpm db:push` / `pnpm db:migrate`. Tenant/organization: `organizationId` on tables; context from host/header.
- **Env:** `server/_core/env.ts` and `server/_core/loadEnv.ts`; `.env.example` documents vars. Required for auth: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`; client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Optional: Turnstile, Resend, Redis, etc.

### 3.4 Tests and CI

- **Unit/integration:** Vitest (`vitest.config.ts`). Tests in `server/**/*.test.ts`, `server/**/*.phase4.test.ts`, `server/jobs/**/*.test.ts`. DB-dependent tests skipped when `DATABASE_URL` is missing/placeholder.
- **E2E:** Playwright. `tests/e2e/auth.spec.ts`, `tests/e2e/rbac.spec.ts`. Scripts: `scripts/run-e2e-auth-full.ts`, `scripts/seed-test-user.ts`.
- **CI:** `.github/workflows/auth-e2e.yml` — on PR/push to main/staging: install, build, migrate, start server, run `test:e2e:auth:full`. Requires secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`. Auth E2E is deploy-blocking.

### 3.5 Deployment

- **Vercel:** `vercel.json` rewrites all non-`api/` to `/index.html` (SPA). API: only `api/trpc/[...path].ts` and `api/auth/google*` are serverless; health/magic-link/uploads etc. exist only on Express in `server/_core/index.ts`.
- **Build:** `pnpm build` → Vite build → `dist/public/`; esbuild server → `dist/index.js`. For Vercel, static assets are typically served from `dist/public` or equivalent; server may run as a separate process or not — **needs verification** (e.g. whether production uses `pnpm start` or only serverless `api/`).

---

## 4. What is not working / risky

### 4.1 Magic link (critical)

- **No Vercel route:** `POST /api/auth/verify-magic-link` exists only in Express (`server/_core/index.ts`). On Vercel, only `api/trpc/*` and `api/auth/google*` exist → **404 in production**.
- **Wrong link in email:** `server/magicLinkAuth.ts` builds link to `/auth/verify?token=...`. Client route is `/verify-magic-link` → user lands on undefined route.
- **Wrong session type:** Magic link verification in `server/_core/magicLinkVerification.ts` sets a **custom JWT** (signed with `ENV.cookieSecret`) in `app_session_id`. `authenticateRequest` expects a **Supabase** JWT → cookie never valid after magic link.
- **Tenant context:** Verification uses `db.getUserById(userId)` which may be tenant-scoped; for pre-tenant auth, `getRootUserById` is more appropriate (per `docs/AUTH_SYSTEM_AUDIT_2026.md`).

**Recommendation:** Either (A) add Vercel serverless route for verify-magic-link and switch post-verify to Supabase session + `auth.setSession`, or (B) deprecate app magic link and use only Supabase magic link → `/auth/callback` + `auth.setSession`.

### 4.2 Supabase admin / server env

- **Server using VITE_*:** `server/supabaseAdmin.ts` may use `process.env.VITE_SUPABASE_URL` (and similar). On Vercel, `VITE_*` are often build-time only for client; serverless may not have them. Prefer `SUPABASE_URL` (and service role) on server and document in `.env.example`.

### 4.3 Subdomains and signup domain

- **NRCS host typo:** `server/_core/signupDomain.ts` checks `host === "nrcs.techivano.com"`; actual host is **nrcseam.techivano.com** → NRCS signup domain list may not apply (falls back to default).
- **CORS / ALLOWED_ORIGINS:** For multi-subdomain (admin vs nrcseam), allow list must include all origins if front and API are same project.

### 4.4 Security and auth

- **RLS:** Migrations enable RLS on app-used tables (`docs/VERIFICATION_REPORT.md`, `docs/RLS_SERVER_ONLY_TABLES.md`). Application uses Drizzle with server-side context (tenantId/organizationId); RLS and app-layer checks should align — no bypass identified in this audit.
- **Cookie/CORS:** Same-origin with Vite+Express; with Vercel, same domain. `credentials: "include"` and no `domain` on cookie keep session host-scoped (correct for tenant isolation).
- **Rate limiting:** tRPC wrapped with `trpcLimiter` (e.g. 100 req/15 min in `api/trpc/[...path].ts` and Express).

### 4.5 Code quality

- **@ts-nocheck:** Present in `server/routers/auth.ts`, `server/routers.ts`, `drizzle/schema.ts` — weakens type safety.
- **Stub procedure:** `loginWithPassword` in auth router throws “use sign-in form”; kept for compatibility; consider removing or marking deprecated.

---

## 5. Improvements needed

### 5.1 MVP / auth reliability

- Fix magic link: correct email link to `/verify-magic-link?token=...`; add Vercel route or move to Supabase-only magic link; ensure post-verify cookie is Supabase JWT via `auth.setSession`.
- Use `getRootUserById` (or equivalent) in magic link verification when no tenant context.
- Prefer server env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) in `server/supabaseAdmin.ts` and document.

### 5.2 Error handling and validation

- tRPC procedures already use Zod inputs; ensure all public procedures validate and return consistent error shapes. `api/trpc/[...path].ts` error middleware returns JSON (avoids “A server error” HTML).
- Client: `AppProviders` fetch wrapper maps non-JSON responses to a friendly message for sign-in issues.

### 5.3 Logging and monitoring

- **Logging:** Pino in server; `server/_core/logger.ts`. Auth metrics in `authenticateRequest`.
- **Sentry:** `@sentry/react`, `@sentry/node`; init in `server/_core/sentry.ts` and client. Ensure DSN and env are set in production.

### 5.4 Performance

- **Lazy loading:** Routes in `App.tsx` are lazy-loaded; Vite manual chunks split vendor, supabase, charts, trpc-query, etc.
- **DB:** Use indexes for tenant/organization and frequent filters; see `drizzle/schema.ts` and migration indexes (e.g. `organizationIdIdx`).

### 5.5 UX

- **Loading:** Dashboard and routes use `Suspense` and `PageFallback` / `DashboardLayoutSkeleton`.
- **Errors:** Toaster (sonner); AuthRefreshHandler and fetch wrapper improve auth error messages. Ensure critical flows show clear messages and recovery actions.

### 5.6 DevOps

- **Secrets:** No secrets in repo; `.env.example` only. Use Vercel (and/or GitHub) secrets for E2E and production.
- **Staging vs prod:** Env and branch strategy documented in `docs/DEPLOYMENT_AND_BRANCH_STRATEGY.md`; ensure staging has its own Supabase redirect URLs and env.
- **Runbooks:** `docs/DEPLOYMENT_RUNBOOK.md`, `docs/AUTH_CHECKLIST.md`; keep them updated when auth or deploy steps change.

---

## 6. MVP production readiness

### 6.1 Summary

| Aspect | Status | Notes |
|--------|--------|--------|
| **Auth (email/password + OAuth)** | Ready | Supabase + setSession + cookie; refresh and MFA wired. |
| **Auth (magic link)** | Not ready | Broken on Vercel; wrong link and session type. |
| **Protected routes / tRPC** | Ready | DashboardLayout + auth.me; procedures use viewer/manager/admin. |
| **Core EAM features** | Ready | Assets, work orders, maintenance, inventory, sites, vendors, financials, compliance, reports, dashboards. |
| **Deployment** | Partial | Vercel rewrites + api/trpc + api/auth/google work; many Express routes (health, uploads, magic link, etc.) have no serverless counterpart — production may rely on a separate Node server (needs verification). |
| **Tests / CI** | Ready | Auth E2E blocking; unit/phase4/worker tests. |
| **Env / secrets** | Ready | Documented; production must set required vars. |

### 6.2 Verdict

**Not ready for MVP production** if magic link is a required sign-in method; **ready** if MVP relies only on email/password and OAuth and magic link is disabled or fixed.

### 6.3 Blockers (prioritized)

1. **Magic link (P0):** Fix or remove. If keeping: (a) fix email link to `/verify-magic-link?token=...`, (b) add Vercel serverless handler for verify and (c) make post-verify set Supabase session (e.g. via `auth.setSession`) so cookie is accepted.
2. **Server Supabase env (P1):** Use `SUPABASE_URL` (and service role) on server; do not rely on `VITE_*` in serverless.
3. **NRCS signup host (P2):** In `server/_core/signupDomain.ts`, use `nrcseam.techivano.com` for NRCS domain list.
4. **Deployment model (P2):** Confirm how production is run: Vercel serverless only (then health, uploads, etc. need serverless or different hosting) or Vercel + separate Node server for full Express app.

### 6.4 Recommended next steps

1. Decide magic link strategy (fix vs Supabase-only) and implement.
2. Add or document Vercel serverless routes for any Express endpoints that production must use (e.g. health, uploads), or document that production runs a Node server.
3. Replace `VITE_*` usage in server code with server env vars; update `.env.example` and runbooks.
4. Fix NRCS host in signupDomain and run tenant/signup tests.
5. Remove or narrow `@ts-nocheck` and add types where feasible.
6. Keep auth E2E and CI green; add smoke tests for critical post-login flows if not already covered.

---

*Audit report generated from codebase exploration. Where something was unclear, “needs verification” is noted.*
