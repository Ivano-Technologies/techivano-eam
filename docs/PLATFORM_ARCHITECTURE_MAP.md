# Techivano EAM — Platform Architecture Map

**Audit date:** 2026-03-16  
**Mode:** Principal SaaS platform audit (architecture discovery)

---

## 1. High-level architecture

| Layer | Technology | Location / domain | Notes |
|-------|------------|-------------------|--------|
| **Marketing site** | Next.js 14 (App Router) | `website/` → techivano.com (Vercel) | Separate app; `website/package.json` |
| **EAM frontend** | Vite + React | `client/` | SPA; served by Express in dev, static + rewrites on Vercel |
| **Backend API** | Express + tRPC | `server/` + `api/` (Vercel serverless) | Monolith in one repo; tRPC at `/api/trpc/*` |
| **Database** | PostgreSQL (Supabase) | Supabase project | Drizzle ORM; `drizzle/schema.ts`, `DATABASE_URL` |
| **Auth** | Supabase Auth + custom Google | Supabase Auth; custom flow in `api/auth/google*` | JWT verified server-side; cookie `app_session_id` |
| **Queue / cache** | Redis + BullMQ | `REDIS_URL`; optional in dev | Background jobs; user cache (optional) |

**Deployment:**

- **Local:** Single process `pnpm dev` → Express on port 3000/3001 serves EAM SPA (Vite middleware) + API.
- **Vercel:** `vercel.json` rewrites non-`api/` to `/index.html` (SPA); `api/*` → serverless (e.g. `api/trpc/[...path].ts`, `api/auth/google.ts`, `api/auth/google/callback.ts`). EAM app and API are one Vercel project (no separate api.techivano.com in repo).

---

## 2. Frontend applications

| App | Path | Framework | Build | Hosting |
|-----|------|-----------|--------|---------|
| EAM (main) | `/` (root) | Vite, React, wouter, tRPC, TanStack Query | `pnpm build` → `dist/public` | Same origin as API (Vercel or Express) |
| Marketing | `website/` | Next.js 14 | `pnpm build` in website/ | Vercel (techivano.com if configured) |

**EAM routes (client-side):** `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/verify-magic-link`, `/welcome`, `/assets`, `/work-orders`, etc. (see `client/src/App.tsx`).

---

## 3. Backend services

| Service | Path | Purpose |
|---------|------|---------|
| tRPC API | `/api/trpc/*` | All app data (auth, assets, work orders, users, etc.) |
| Health | `/api/health`, `/health` | No auth; monitoring |
| Google OAuth | `/api/auth/google`, `/api/auth/google/callback` | Custom “continue to EAM” flow; exchanges code for Supabase session |
| Magic link verify | `POST /api/auth/verify-magic-link` | Magic link auth |
| Signed uploads | `POST /api/uploads/signed-url` | R2 presigned URLs |
| Warehouse rebalance | `POST /warehouse/rebalance` | Queue job (tenant-scoped) |
| Bull Board | `/admin/queues` | Queue dashboard (dev/admin) |

**Server structure:** No formal `routes/`, `controllers/`, `services/` split. Logic lives in:

- `server/routers/*.ts` — tRPC procedures (auth, users, assets, workOrders, dashboard, etc.)
- `server/_core/` — context, auth, cookies, Vite, Redis, env
- `server/db.ts` — Drizzle access; tenant via `set_config('app.tenant_id')` / organization context

---

## 4. Database and tenant model

- **DB:** PostgreSQL via Supabase; connection `DATABASE_URL`.
- **ORM:** Drizzle; schema in `drizzle/schema.ts`.
- **Tenant model:** Organization-based multi-tenant:
  - **Canonical:** `organizations`, `organization_members` (Supabase migrations); `organization_id` (UUID) on core tables (sites, assets, work_orders, maintenance_schedules, inventory_items, vendors, compliance_records, documents, inspections, etc.).
  - **Legacy:** Some tables still use integer `tenantId` (e.g. warehouse_transfer_recommendations, vendor_performance_metrics, purchase_orders, fleet_units, technicians, etc.); `tenant_organization_map` maps `tenant_id` (int) → `organization_id` (uuid).
- **Resolution:** Host-based (e.g. admin.techivano.com → HOST_ORG_ADMIN, nrcseam.techivano.com → HOST_ORG_NRCS) plus header/query/session `x-organization-id`, `organizationId`, `tenantId` (see `server/_core/context.ts`).

---

## 5. Auth flows

| Flow | Client | Server | Notes |
|------|--------|--------|--------|
| Email/password | Supabase `signInWithPassword` | JWT in cookie; `auth.setSession` tRPC | Legacy DB users: `migrateLegacyPasswordUser` creates Supabase user on first failed login then retry |
| Google (custom) | Redirect to `/api/auth/google` | Exchange code → Supabase `signInWithIdToken`; redirect to `/auth/callback` with tokens | Requires `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` |
| Google (Supabase) | Supabase `signInWithOAuth` | Standard Supabase redirect | Used when custom client not set |
| Magic link | Request link → verify at `/api/auth/verify-magic-link` | Token in DB | |
| Session | Cookie `app_session_id` (Supabase access token) | `authenticateRequest` → JWT verify → `getUserFromSupabaseToken` (DB + optional Redis cache) | |

---

## 6. Domain routing (from repo)

- **Configured in app:** Host → org mapping via `HOST_ORG_ADMIN`, `HOST_ORG_NRCS` (env); no DNS or SSL logic in repo.
- **Expected (from audit spec):** techivano.com, www.techivano.com, app.techivano.com, api.techivano.com, auth.techivano.com — **not** all present in code; single Vercel project can serve app + api on same domain (e.g. techivano.com + techivano.com/api).

---

## 7. CI/CD

- **Workflow:** `.github/workflows/ci.yml`
- **Triggers:** Push/PR to `main`, `staging`, `develop`, `feature/**`
- **Steps:** Checkout → pnpm install → **Typecheck** (`pnpm typecheck`) → **Test** (`pnpm test:ci`) → **Build** (`pnpm build && pnpm build:worker`)
- **No:** Supabase migrations, deploy step, or Vercel trigger in this file (deploy likely via Vercel GitHub integration).

---

## 8. Environment variable dependencies

| Category | Key vars | Used by |
|----------|----------|---------|
| **Public client** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_API_URL` | EAM client |
| **Server auth** | `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Express/Vercel; JWT verify, legacy migration, password reset in Supabase |
| **DB** | `DATABASE_URL` | Drizzle, all server code |
| **Tenant** | `HOST_ORG_ADMIN`, `HOST_ORG_NRCS` | `server/_core/context.ts` |
| **Google OAuth** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | `api/auth/google*` |
| **Infra** | `REDIS_URL`, `JWT_SECRET` | Queue, cache; cookie signing |
| **Email** | `RESEND_API_KEY`, `EMAIL_FROM` | server/emailService.ts |
| **Storage** | `R2_*` | Uploads, signed URLs |

Full list: `.env.example`.

---

## 9. Dependency map (summary)

```
Marketing (website/)     → standalone Next.js (no EAM API)
EAM client (client/)     → Vite, tRPC client, Supabase client
Express (server/)        → Drizzle, Supabase JWT, Redis (optional), tRPC router
Vercel serverless (api/) → Same tRPC + auth handlers; reads .env.local
DB                      → Supabase Postgres (Drizzle)
Auth                    → Supabase Auth + custom Google OAuth
```

---

## 10. Known issues (from audit)

1. **EAM `/login` 404 locally:** Explicit SPA routes added in `server/_core/vite.ts` for `/`, `/login`, etc. If “Not Found” persists, confirm server restarted and check for `[vite] registered SPA routes` and `[vite] serving SPA for GET /login` in logs.
2. **Redis optional:** Auth works without Redis (user cache falls back to DB); queue jobs need Redis.
3. **Single Vercel project:** App and API are one project; api.techivano.com would require separate deployment or proxy if desired.
