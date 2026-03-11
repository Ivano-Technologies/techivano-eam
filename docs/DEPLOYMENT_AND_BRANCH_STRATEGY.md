# Techivano Deployment & Branch Strategy

Production-grade workflow for a multi-tenant SaaS platform. Eliminates accidental broken production deploys, environment variable drift, staging/main merge confusion, and silent configuration errors.

---

## 1. Branch Architecture (Simple and Safe)

Use **three permanent branches**:

| Branch    | Purpose                    |
|-----------|----------------------------|
| `main`    | Production deployment      |
| `staging` | Pre-production testing     |
| `develop` | Integration of features    |

Feature work happens in **short-lived branches**:

- `feature/*` — new capabilities (e.g. `feature/ocr-pipeline`)
- `bugfix/*` — defect fixes
- `hotfix/*` — production-critical fixes

### Recommended flow

```
feature/ocr-pipeline
        ↓
    develop
        ↓
    staging
        ↓
     main
```

- **develop**: Merge feature/bugfix branches here; run CI and basic QA.
- **staging**: Deploy to staging (e.g. `staging.techivano.com`); full QA and UAT.
- **main**: Only after staging is verified; production deploy.

This prevents accidental direct pushes to production and keeps a clear promotion path.

---

## 2. Vercel Deployment Mapping

Map each branch to an environment:

| Branch    | Deployment   | URL (example)              |
|-----------|-------------|----------------------------|
| `main`    | Production  | `https://techivano.com`    |
| `staging` | Preview    | `https://staging.techivano.com` |
| `develop` | Preview    | Vercel auto-preview URL    |

Pipeline:

```
GitHub push
      ↓
Vercel preview build (staging / develop)
      ↓
Manual verification
      ↓
Merge to main
      ↓
Production deploy
```

---

## 3. Environment Variable Strategy

Categorize variables to avoid drift and accidental exposure.

### Public client variables (safe for browser)

- `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `R2_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`
- Feature flags: `NEXT_PUBLIC_*`, `VITE_*`

### Server secrets (never expose to client)

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`
- `MASTER_ENCRYPTION_KEY`
- `MONO_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, etc.

### Infrastructure variables

- `REDIS_URL`
- `QUEUE_WORKER_CONCURRENCY`
- `LOG_LEVEL`
- `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (server/monitoring)

Set these per environment in Vercel (Production / Preview) and in Railway (or other worker host) so staging and production never share production secrets.

---

## 4. Repository Structure

Recommended Techivano layout (current and target):

```
techivano-eam/
├── client/
│   └── src/
│       ├── components
│       ├── pages
│       └── lib/
│           ├── env.ts        # Client env validation
│           ├── supabase.ts   # Supabase client
│           └── api.ts        # API helpers
├── server/
│   ├── env.ts               # Server env validation (Zod)
│   ├── _core/               # Express, routes, middleware
│   ├── jobs/
│   │   ├── processors.ts
│   │   ├── ocrUploadQueue.ts
│   │   └── queue.ts
│   └── routers.ts
├── drizzle/
│   └── schema.ts
├── supabase/
│   └── migrations/
├── docs/
│   └── architecture
└── scripts/
```

### Queue + worker separation (future)

Workers currently live alongside the API. For scale, you can split them:

- **server/jobs/** — queue definitions and processors (called by workers).
- **workers/** (optional) — standalone worker entrypoints (e.g. `ocr-worker.ts`).

Workers can then run on:

- Railway  
- Fly.io  
- Cloudflare Workers  
- Supabase Edge  

without tying them to the same process as the web server.

---

## 5. Environment Validation (Critical)

Server env is validated at startup so production never runs with missing or invalid config.

- **client**: `client/src/lib/env.ts` — `requireEnv()` for Supabase URL and anon key (Vite + Next compat).
- **server**: `server/env.ts` — Zod schema; `.parse(process.env)` on load.

If a required variable is missing:

- **Build/start fails** → deployment stops → users never see runtime config errors.

See `server/env.ts` and `client/src/lib/env.ts` for the exact schema and list of required variables.

---

## 6. Health Endpoint

Use for uptime checks and load balancers.

- **URL**: `https://techivano.com/api/health` or `https://techivano.com/health`
- **Method**: GET
- **Auth**: None
- **Response**: `200` with JSON, e.g.:

```json
{
  "status": "ok",
  "service": "techivano",
  "timestamp": "2026-03-09T12:00:00.000Z"
}
```

Monitor this URL in BetterStack, Uptime Robot, or your existing monitoring.

---

## 7. Deployment Safety Rule

Before merging into `main`:

1. Run locally (or in CI):
   - `pnpm build`
   - `pnpm lint`
   - `pnpm typecheck` (or rely on `pnpm lint` if it runs `tsc --noEmit`)
2. Ensure staging has been tested and health check passes.

CI is configured to run these on push and pull requests to `main`, `staging`, `develop`, and `feature/**` so broken config or code is caught before merge. See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) for the full three-environment (Preview / Staging / Production) flow.

---

## 8. Production Monitoring

- **Sentry** — Error tracking and performance (already in use).
- **PostHog** (optional) — Product analytics, session replay, feature flags.

Together they give:

- Error tracing and release health
- Performance monitoring
- User analytics and behavior

---

## 9. Resulting Techivano Architecture

```
GitHub
   │
   ├── develop   → Vercel Preview
   ├── staging  → Vercel Preview (staging.techivano.com)
   │
   └── main      → Vercel Production (techivano.com)
                    ↓
                Supabase (Postgres, Auth, Storage)
                    ↓
                Redis (BullMQ queues)
                    ↓
                Workers (Railway / Fly / etc.)
                    ↓
                R2 / CDN (assets)
```

This matches the modern SaaS pattern used by platforms like MaintainX, UpKeep, and Fiix, with a stack (Vite, tRPC, Supabase, Redis, R2) that is well-suited for multi-tenant asset management.

---

## Quick reference

| Item              | Location / command |
|-------------------|--------------------|
| Health check      | `GET /api/health` or `GET /health` |
| Client env        | `client/src/lib/env.ts` |
| Server env        | `server/env.ts` (Zod) |
| CI                | `.github/workflows/ci.yml` (build, lint, test) |
| Env template      | `.env.example` (categorized) |
