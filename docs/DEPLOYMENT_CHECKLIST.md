# Techivano EAM — Deployment Checklist

Use this checklist for production and staging deployments.

---

## 1. Environment variables (production)

Ensure these are set in Vercel (or your host) and **never** committed:

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | Set to `production` |
| `DATABASE_URL` | Yes | Supabase Postgres connection string |
| `SUPABASE_JWT_SECRET` | Yes | From Supabase Dashboard → API → JWT Secret |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (client + server) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client + server) |
| `VITE_APP_URL` | Yes | Full app URL (e.g. `https://app.techivano.com`) |
| `VITE_API_URL` | Yes | Full API base (e.g. `https://app.techivano.com/api`) |
| `JWT_SECRET` or `APP_SECRET` | Yes | Min 32 chars; cookie/session signing |
| `ALLOWED_ORIGINS` | If cross-origin | Comma-separated origins for CORS (e.g. if API on different domain) |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | For legacy password migration, password reset in Supabase |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | Custom “continue to EAM” Google OAuth |
| `REDIS_URL` | If using queues | Required for background jobs |
| `RESEND_API_KEY`, `EMAIL_FROM` | If using email | Resend and from address |

Run the app and check logs for `[env] Production: missing or empty recommended variables` if any critical var is missing.

---

## 2. Authentication

- [ ] **Supabase:** Redirect URLs in Supabase Auth settings include your app callback (e.g. `https://app.techivano.com/auth/callback`).
- [ ] **Google OAuth (if used):** Authorized redirect URIs in Google Cloud Console include `https://<your-domain>/api/auth/google/callback`.
- [ ] **Cookies:** App uses `secure: true` in production (set automatically from `x-forwarded-proto` / NODE_ENV).
- [ ] **Session:** Test login → reload → session persists; test logout.

---

## 3. Domain and routing

- [ ] **Vercel (or host):** Domain(s) added and verified (e.g. techivano.com, app.techivano.com).
- [ ] **SSL:** Handled by Vercel for Vercel-hosted domains.
- [ ] **Host → tenant:** If using host-based org resolution, set `HOST_ORG_ADMIN` and `HOST_ORG_NRCS` (UUIDs) to match your organizations.

---

## 4. API security

- [ ] **Rate limiting:** Enabled on `/api/trpc` (100 req/15 min per IP).
- [ ] **CORS:** In production, set `ALLOWED_ORIGINS` if the app is served from a different origin than the API; otherwise same-origin only.
- [ ] **API 404:** Unmatched `/api/*` routes return JSON `{ "error": "Not found" }` (no HTML leak).
- [ ] **Errors:** Unhandled errors return JSON; stack traces only in non-production.

---

## 5. CI/CD

- [ ] **Branch:** Deploy from `main` (or your production branch); ensure CI runs on push/PR.
- [ ] **CI steps:** Typecheck → Test → Build (and build:worker) must pass before merge.
- [ ] **Secrets:** Production secrets only in Vercel/host env, not in GitHub repo.
- [ ] **Migrations:** Run Supabase/DB migrations manually or in a release step (not in CI).

---

## 6. Post-deploy verification

- [ ] **Health:** `GET https://<your-domain>/api/health` returns 200 and `{ "status": "ok" }`.
- [ ] **Login:** Sign in with email/password and (if configured) Google.
- [ ] **EAM app:** Load `/` and `/login`; no 404.
- [ ] **Playwright (optional):** `E2E_BASE_URL=https://app.techivano.com E2E_AUTH_EMAIL=... E2E_AUTH_PASSWORD=... pnpm test:e2e:auth`.

---

## 6b. E2E auth tests (local)

1. **Start the EAM app:** `pnpm dev` (default port 3000).
2. **Create an approved test user:** `pnpm e2e:create-user`  
   - Creates `e2e-<timestamp>@example.com` (or set `E2E_CREATE_EMAIL` / `E2E_CREATE_PASSWORD`).  
   - Prints `E2E_AUTH_EMAIL` and `E2E_AUTH_PASSWORD` to use next.
3. **Run Playwright:**  
   `E2E_BASE_URL=http://localhost:3000 E2E_AUTH_EMAIL=<email> E2E_AUTH_PASSWORD=<password> pnpm test:e2e:auth`  
   - Without credentials, only “Auth pages” run; sign-in tests are skipped.

---

## 7. References

- Architecture: `docs/PLATFORM_ARCHITECTURE_MAP.md`
- Auth: `docs/AUTHENTICATION_STABILITY_REPORT.md`
- Env template: `.env.example`
