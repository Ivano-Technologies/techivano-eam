# Techivano EAM — System Architecture

**Purpose:** Single diagram and description of the full platform: how the browser, frontend, API, queues, workers, and data stores connect.

**Related:** [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) (day-to-day process), [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) (CI/CD and environments).

---

## High-level flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│  Vercel (frontend + serverless API)  │
│  • Static assets (React/Vite)        │
│  • /api/* → Node API (tRPC, etc.)   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Node API   │  (Express, tRPC, auth, business logic)
└──────┬──────┘
       │
       ├──────────────────┬─────────────────────┐
       ▼                  ▼                     ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│   Redis     │    │  Supabase   │    │ Supabase Storage │
│  (queues)   │    │  Postgres   │    │  (files, etc.)   │
└──────┬──────┘    └─────────────┘    └─────────────────┘
       │
       ▼
┌─────────────┐
│   Workers   │  (BullMQ jobs: sync, reports, background tasks)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Supabase   │  (DB writes, external APIs)
│  Postgres   │
└─────────────┘
```

---

## Component roles

| Layer | Technology | Role |
|-------|------------|------|
| **Browser** | User client | React SPA; auth (Supabase Auth + session cookie); tRPC client. |
| **Vercel** | Edge / serverless | Serves frontend; routes `/api/*` to Node API (serverless or external API host). |
| **Node API** | Express, tRPC | REST + tRPC procedures; auth (JWT + cookie); orchestration; rate limiting. |
| **Redis** | Queues / cache | BullMQ job queues; optional identity/session cache. |
| **Workers** | BullMQ workers | Background jobs (QuickBooks sync, reports, email, etc.). |
| **Supabase Postgres** | Database | Primary data store (eam_* tables, users, config). |
| **Supabase Storage** | Object storage | File uploads, exports, assets. |

---

## Data flow (summary)

- **Request path:** Browser → Vercel (static or `/api`) → Node API → Postgres / Redis / Storage.
- **Async path:** Node API enqueues job → Redis → Worker runs → Postgres / Storage / external APIs.
- **Auth:** Supabase Auth (frontend) + JWT verification and app session in Node API; optional Redis cache for resolved user.

---

## Where this runs

| Environment | Frontend / API | Redis | Postgres | Workers |
|-------------|----------------|--------|----------|---------|
| **Production** | Vercel (main) | Production Redis | Supabase production | Same host or separate worker process |
| **Staging** | Vercel (staging) | Staging Redis | Supabase staging | Staging workers |
| **Preview** | Vercel (preview) | Staging Redis | Supabase staging | Staging workers |
| **Local** | Vite dev server + Node | Optional local Redis | Supabase dev/staging | Optional `pnpm run worker` |

For deployment and branch mapping, see [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) and [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md).
