# EAM deployment model

## Vercel (current)

- **Static + serverless:** `vercel.json` rewrites all non-`api/` requests to `/index.html` (SPA). The app is built with `pnpm build` (Vite → static assets; server bundle is built but not used by Vercel serverless).
- **API routes (serverless):**
  - `api/trpc/[...path].ts` — tRPC (auth, assets, work orders, etc.). This is the main backend surface in production.
  - `api/auth/google.ts` and `api/auth/google/callback.ts` — custom Google OAuth when configured.
- **Not on Vercel (Express-only):** The following exist only when running the full Node server (`pnpm start` / `node dist/index.js`):
  - `GET /api/health` (and `/health`)
  - `POST /api/dev-login` (E2E; only when `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD` are set)
  - Multipart/signed upload routes (R2), Bull Board, etc.

So **production on Vercel** uses only the SPA and the serverless tRPC + Google auth routes. Health checks, E2E dev-login, and upload endpoints are **not** available unless you run a separate Node server or add equivalent serverless functions.

## Server env (recommended)

On the server (and in Vercel env for serverless), set:

- `SUPABASE_URL` — Supabase project URL (do not rely only on `VITE_SUPABASE_URL` in serverless).
- `SUPABASE_ANON_KEY` — Anon key for server-side Supabase client (e.g. E2E dev-login when using Node).
- `SUPABASE_JWT_SECRET` — Required for verifying Supabase access tokens in tRPC.
- `DATABASE_URL` — Postgres connection string for Drizzle.

See `.env.example` and `docs/AUTH_CHECKLIST.md`.

## Optional: full Node server

To expose health, dev-login, or upload routes in production, run the bundled server (e.g. on Railway, Fly, or a VPS):

```bash
pnpm build && pnpm build:worker
pnpm start
```

Then point your frontend (or a reverse proxy) to that server’s URL for API and static (or keep static on Vercel and proxy only `/api` to the Node server).
