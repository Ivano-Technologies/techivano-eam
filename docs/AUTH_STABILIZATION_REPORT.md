# Auth Stabilization Report — Techivano EAM

**Date:** 2026-03-12  
**Scope:** Supabase auth (email/password, session cookie, protected routes).  
**Status:** Root cause identified and fixes applied; E2E verification pending deploy.

---

## 1. Root cause (runtime evidence)

Playwright E2E against production showed:

- **Symptom:** After clicking Sign In, the page stayed on `/login` and showed alert:  
  `Unexpected token 'T', "The page c"... is not valid JSON`
- **Evidence:** Page snapshot (error-context.md) contained that exact alert; tRPC client received a non-JSON response.
- **Conclusion:** Requests to `/api/trpc` (e.g. `auth.setSession`, `auth.me`) were **not** handled by the backend and returned **HTML** (e.g. 404 “The page could not be found”). The client then tried to parse that as JSON and threw.

So the failure is **not** Supabase config or login logic; it is **/api/trpc not being served on Vercel**, so the frontend gets an HTML error page instead of JSON.

---

## 2. Auth architecture (reference)

| Layer | Implementation |
|-------|----------------|
| **Frontend** | Vite + React; `useAuth` → `trpc.auth.me.useQuery()`; Login uses `supabase.auth.signInWithPassword` then `auth.setSession(accessToken)`. |
| **Client routing** | Wouter; `/login`, `/signup`, `/auth/callback` are public; `DashboardLayout` treats them as `isPublicAuthPath` and does not wait on `auth.me`. |
| **Session** | Cookie `app_session_id` (Supabase access token); server verifies with `SUPABASE_JWT_SECRET` via `authenticateRequest()`. |
| **Backend** | Express + tRPC at `/api/trpc`; `auth.me`, `auth.setSession`, `auth.logout` in `server/routers/auth.ts`; context from `createContext()` → `authenticateRequest(req)`. |
| **Deployment** | Vercel; `vercel.json` rewrites non-`api/` to `/index.html`. No handler was defined for `/api/trpc`, so those requests returned 404 HTML. |

---

## 3. Changes made

### 3.1 Vercel API handler for tRPC (root cause fix)

- **Added:** `api/trpc/[...path].ts`
  - Express app with `express.json()`, `express.urlencoded()`, and tRPC at `/api/trpc`.
  - Exported as default Node handler `(req, res) => app(req, res)` for Vercel.
- **Purpose:** Ensure `/api/trpc/*` is served by the app and returns JSON (so `auth.setSession` and `auth.me` work in production).

### 3.2 E2E and config

- **playwright.config.ts**  
  Default `E2E_BASE_URL` set to `https://techivano.com` (no www) so tests hit the same origin as the API when both are on that host.
- **tests/e2e/auth.spec.ts**  
  Base URL in both tests updated from `https://www.techivano.com` to `https://techivano.com` (or `E2E_BASE_URL`).

### 3.3 Login error message

- **client/src/pages/Login.tsx**  
  When the caught error looks like a JSON parse error (e.g. “not valid JSON”, “Unexpected token”), the UI now shows:  
  `"Unable to reach the server. Please check your connection and try again."`  
  instead of the raw parse error.

### 3.4 TypeScript

- **tsconfig.json**  
  `"api/**/*"` added to `include` so the new API route is type-checked.

---

## 4. Debug instrumentation (temporary)

The following debug logging was added for local/on-demand tracing. Remove after E2E passes and you confirm auth in production.

- **client/src/components/DashboardLayout.tsx** — layout branch (public vs loading vs unauthenticated vs full) and pathname.
- **client/src/_core/hooks/useAuth.ts** — `auth.me` state (loading, status, hasData).
- **server/_core/authenticateRequest.ts** — token presence, looksLikeSupabase, hasUser.
- **server/routers/auth.ts** — setSession called, getUser result, cookie set.
- **client/src/pages/Login.tsx** — signIn result, setSession after signIn, catch.
- **client/src/pages/AuthCallback.tsx** — has code, exchange result, setSession ok.

Logs are sent to the debug ingest endpoint (session `cb0794`). Delete these `#region agent log` blocks and the ingest calls once verification is done.

---

## 5. What you need to do next

1. **Deploy**  
   Push the branch (including `api/trpc/[[...path]].ts`, Playwright/config changes, and Login message) and deploy to Vercel so the new tRPC handler is live.

2. **Confirm Vercel behavior**  
   In the Vercel project, ensure:
   - The build includes the `api/` directory (or that Vercel builds serverless functions from it).
   - Production (and staging, if used) use the same domain/origin for the app and `/api/trpc` (e.g. `https://techivano.com` without redirect to a different host that doesn’t have the API).

3. **Re-run E2E**  
   ```bash
   E2E_AUTH_EMAIL=test@techivano.com E2E_AUTH_PASSWORD=*** E2E_BASE_URL=https://techivano.com pnpm test:e2e:auth
   ```
   Both tests should pass (sign in and land on home; sign in → dashboard → logout).

4. **Optional: local verification**  
   Run the app locally, open `/login`, sign in with the test account, and confirm redirect and session. If the debug ingest is running, check `debug-cb0794.log` for the instrumentation above.

5. **Cleanup**  
   After E2E and production auth are verified, remove the debug instrumentation (all `#region agent log` / `#endregion` blocks and their `fetch(...ingest...)` calls) from the files listed in §4.

---

## 6. Supabase / auth checklist (no code changes)

- **Redirect URLs:** Include `https://techivano.com/auth/callback` and `http://localhost:5173/auth/callback` (or your dev origin) in Supabase Auth URL configuration.
- **JWT:** Backend uses `SUPABASE_JWT_SECRET`; optional issuer/audience must match Dashboard if set.
- **Cookie:** `app_session_id` — httpOnly, path `/`, sameSite lax, secure in production.
- **Test user:** E2E uses `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD` (e.g. test@techivano.com). Create in Supabase Auth if needed.

---

## 7. Files touched

| File | Change |
|------|--------|
| `api/trpc/[...path].ts` | **New** — Vercel serverless tRPC handler |
| `vercel.json` | Unchanged (rewrites already exclude `api/`) |
| `playwright.config.ts` | Default base URL → `https://techivano.com` |
| `tests/e2e/auth.spec.ts` | Base URL in tests → `https://techivano.com` |
| `client/src/pages/Login.tsx` | Friendlier error for non-JSON response; debug logs |
| `client/src/components/DashboardLayout.tsx` | Debug logs |
| `client/src/_core/hooks/useAuth.ts` | Debug logs |
| `client/src/pages/AuthCallback.tsx` | Debug logs |
| `server/_core/authenticateRequest.ts` | Debug logs |
| `server/routers/auth.ts` | Debug logs |
| `tsconfig.json` | Include `api/**/*` |

---

## 8. Success criteria (after deploy)

- [ ] Playwright E2E: “sign in with email/password and land on home” passes.
- [ ] Playwright E2E: “sign in → dashboard → logout” passes.
- [ ] Login page loads without skeleton lock.
- [ ] Email/password login redirects to `/` and session persists after refresh.
- [ ] Protected routes redirect unauthenticated users to `/login`.
- [ ] No “Unexpected token” / “not valid JSON” errors on login.
- [ ] Optional: OAuth and logout verified manually.

Once these are met, auth can be considered stabilized; then remove the debug instrumentation as in §5.5.
