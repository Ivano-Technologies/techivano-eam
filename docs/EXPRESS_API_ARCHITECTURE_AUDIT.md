# Express API Architecture Audit

**Audit date:** 2026-03-16

---

## 1. Current structure

- **Entry:** `server/_core/index.ts` — single Express app; mounts tRPC at `/api/trpc`, auth routes, uploads, health, Bull Board, and (in dev) Vite + SPA routes.
- **API surface:** Predominantly **tRPC** (procedures in `server/routers/*.ts`), not REST controllers. A few REST endpoints: health, OAuth callback, magic link verify, signed upload, warehouse rebalance, document download.
- **Folders:**
  - `server/routers/` — tRPC routers (auth, users, assets, workOrders, sites, dashboard, inventory, maintenance, nrcs, _shared).
  - `server/_core/` — context, authenticateRequest, cookies, env, Redis, Vite, logger, sentry, trpc.
  - `server/` — db.ts (Drizzle + tenant helpers), passwordAuth, passwordReset, magicLinkAuth, emailService, jobs (queue), etc.
- **No** formal `routes/`, `controllers/`, `services/` folders; business logic lives inside tRPC procedures and shared modules (db, emailService, etc.).

---

## 2. Route organization

| Pattern | Location | Notes |
|---------|----------|--------|
| tRPC | `app.use("/api/trpc", createExpressMiddleware(...))` | All procedure namespaces (auth.*, users.*, assets.*, etc.) |
| Health | app.get(["/api/health", "/health"]) | No auth |
| OAuth | app.get("/api/oauth/callback") | Redirect to /login |
| Magic link | app.post("/api/auth/verify-magic-link") | Custom handler |
| Google OAuth | app.get("/api/auth/google", "/api/auth/google/callback") | Dynamic import from api/auth/* |
| Upload | app.post("/api/uploads/signed-url") | Auth required |
| Warehouse | app.post("/warehouse/rebalance") | Auth + x-tenant-id |
| Document download | app.get("/api/uploads/encrypted/:documentId") | Auth + optional encryption |
| Bull Board | app.use("/admin/queues", ...) | Dev/admin |
| SPA (dev) | setupVite: GET /, /login, /signup, ... + Vite middleware + catch-all | Explicit routes + fallback |

---

## 3. Controller / service separation

- **tRPC procedures** act as thin handlers: they validate input (zod), call `authenticateRequest`/context, then call into `server/db.ts` or dedicated modules (passwordAuth, magicLinkAuth, emailService, etc.). No separate “controller” layer; “service” logic is in db.ts and ad-hoc helpers.
- **Recommendation (optional):** For very large procedures, extract business logic into `server/services/*.ts` and keep routers thin; not required for current stability.

---

## 4. Database access patterns

- **Single DB module:** `server/db.ts` exports Drizzle-based functions; tenant/organization is applied via context (organizationId, tenantId) and `set_config('app.tenant_id')` where used. No repository abstraction layer.
- **Recommendation:** Keep using context in procedures; ensure every tenant-scoped query filters by organization_id or tenantId (already the pattern in schema and context).

---

## 5. Error handling

- **tRPC:** Procedures throw `TRPCError` (code + message); client receives structured errors.
- **Express routes:** Some use try/catch and res.status(...).json({ error: ... }); no global error middleware observed in the scanned code.
- **Recommendation:** Add an Express error middleware (e.g. `app.use((err, req, res, next) => { ... })`) for non-tRPC routes to return consistent JSON and status codes.

---

## 6. Request validation

- **tRPC:** Input validated with zod in procedure `.input(...)`. Good coverage for procedure arguments.
- **REST:** Manual checks (e.g. body/headers) in upload and warehouse endpoints. No shared validator layer for REST.
- **Recommendation:** For new REST endpoints, consider a small validator (zod) and reuse where possible.

---

## 7. API response format

- **tRPC:** Typed result; no single envelope (success/error is built-in).
- **REST:** Ad-hoc (e.g. `{ status: "ok" }`, `{ error: "..." }`, `{ queued: true, ... }`). No project-wide REST response standard.
- **Recommendation:** Optional: define a minimal REST envelope (e.g. `{ success, data?, error? }`) for new REST routes.

---

## 8. Verdict

- **Stable for current scope:** Single Express app + tRPC is coherent; tenant context and auth are centralized. No mandatory restructure for “scalable service architecture”; improvements are incremental (error middleware, optional services layer, REST validation/response format).
- **Deployment:** Same code runs as monolith (pnpm start) or behind Vercel serverless (`api/trpc/[...path].ts`, `api/auth/google*`); env and entry points are consistent.
