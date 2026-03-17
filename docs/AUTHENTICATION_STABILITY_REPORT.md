# Authentication Stability Report

**Audit date:** 2026-03-16

---

## 1. Providers and flows

| Provider | Flow | Status in code |
|----------|------|-----------------|
| Supabase Auth (email/password) | Client: `signInWithPassword` → tRPC `auth.setSession` (cookie) | Implemented; legacy users migrated via `migrateLegacyPasswordUser` on first “Invalid login credentials” |
| Google OAuth (custom) | Redirect to `/api/auth/google` → Google → `/api/auth/google/callback` → Supabase `signInWithIdToken` → redirect to `/auth/callback?access_token=...` | Implemented when `GOOGLE_OAUTH_CLIENT_ID` set; “continue to EAM” |
| Google OAuth (Supabase) | Client: `signInWithOAuth` → Supabase host | Fallback when custom client not set |
| Magic link | Request link → email → POST `/api/auth/verify-magic-link` | Implemented |
| Password reset | Request reset → token in DB + email → `/reset-password?token=...` → reset; Supabase user password updated if `supabase_user_id` set | Implemented |

---

## 2. OAuth redirect URIs

- **Custom Google:** Redirect URI = `{origin}/api/auth/google/callback`. Origin taken from request (Host header); must match Google Cloud Console authorized redirect URIs (e.g. `https://techivano.com/api/auth/google/callback`, `http://localhost:3001/api/auth/google/callback`).
- **Supabase Google:** Supabase dashboard redirect URLs must include app callback (e.g. `https://yourapp.com/auth/callback`).

---

## 3. Cookie configuration

- **Name:** `app_session_id` (COOKIE_NAME in shared const).
- **Options:** From `getAuthSessionCookieOptions(req, { rememberMe })` — httpOnly, secure in production, sameSite, path `/`, maxAge based on rememberMe. Implemented in `server/_core/cookies.ts`.

---

## 4. JWT validation

- **Server:** `verifySupabaseToken(token)` in `server/_core/supabaseAuth.ts` — HS256, optional issuer/audience from env (`SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`). Requires `SUPABASE_JWT_SECRET`.
- **Session:** Cookie or Authorization Bearer → `authenticateRequest` → `getUserFromSupabaseToken` → DB (and optional Redis cache).

---

## 5. Session persistence

- **Cookie:** Set on `auth.setSession` after Supabase sign-in or custom Google callback; read by Express and Vercel api routes. Persists across reloads when cookie is valid.
- **Client:** Supabase client can be used for client-side session; app primarily relies on cookie + tRPC for authenticated requests.

---

## 6. Secure cookie flags

- **Secure:** Set in production (from request proto). OK.
- **HttpOnly:** Set. OK.
- **SameSite:** Configured in cookies.ts. OK.

---

## 7. Auth callback handling

- **Path:** `/auth/callback` (client route). Handles hash fragment (Supabase) and query params (custom Google: `access_token`, `refresh_token`, `remember`). Calls `auth.setSession` then clears tokens from URL.
- **Implemented in:** `client/src/pages/AuthCallback.tsx`.

---

## 8. Known issues and fixes applied (pre-audit)

| Issue | Fix |
|-------|-----|
| Legacy password users (DB only) get “Invalid login credentials” | `migrateLegacyPasswordUser` tRPC + client retry on that error; creates Supabase user and links `supabase_user_id` |
| Password reset only updated app DB | Reset flow now also updates Supabase Auth password when user has `supabase_user_id` |
| Custom Google “continue to EAM” | Custom OAuth routes + env GOOGLE_OAUTH_CLIENT_ID; dev log confirms when enabled |
| .env.local not loaded by server | dotenv.config({ path: ".env.local", override: true }) in server and api/trpc |
| /login 404 in dev | Explicit GET routes for SPA paths in setupVite + serveSpa; dev log `[vite] registered SPA routes` |

---

## 9. Recommendations

1. **Playwright:** Run `E2E_BASE_URL=<eam_url> E2E_AUTH_EMAIL=... E2E_AUTH_PASSWORD=... pnpm test:e2e:auth` against staging/production to confirm login and logout.
2. **Redirect URIs:** Keep Google Cloud Console and Supabase redirect URLs in sync with deployed and local URLs.
3. **Secrets:** Ensure `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET` are set only in server env and never in client bundles.
