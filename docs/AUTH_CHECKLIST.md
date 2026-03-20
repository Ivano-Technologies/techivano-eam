# Auth checklist — ensure auth works 100%

Use this list to verify Supabase-based auth (magic link, Google/Microsoft OAuth, and session) is correctly configured.

## 1. Environment variables

### Server (Vercel / Express)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | **Required.** Project URL (e.g. `https://xxxx.supabase.co`). Used for JWT verification (JWKS fallback when `SUPABASE_JWT_SECRET` fails). |
| `SUPABASE_JWT_SECRET` | **Required.** JWT Secret from Supabase **Project Settings → API**. Used first for HS256 verification; if your project uses new signing keys, JWKS from `SUPABASE_URL` is used as fallback. |
| `DATABASE_URL` | **Required.** Postgres connection string for app DB (user resolution, sessions). |
| `TURNSTILE_SECRET_KEY` | **Optional (bot protection).** Cloudflare Turnstile secret key. When set, login and signup require a valid Turnstile token. Get keys at [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile. |

### Client (Vite / build)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | **Required for login.** Same as Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | **Required for login.** Anon/public key from Supabase. |
| `VITE_TURNSTILE_SITE_KEY` | **Optional (bot protection).** Cloudflare Turnstile site key (public). When set with `TURNSTILE_SECRET_KEY` on server, login and signup show the Turnstile widget. |

Optional: `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE` for stricter JWT claim checks.

---

## 2. Supabase Dashboard

- **Authentication → URL configuration**
  - **Site URL:** Main EAM site is **techivano.com** (e.g. `https://techivano.com` in prod, `http://localhost:3000` for dev).
  - **Redirect URLs:** Single source of auth at techivano.com. Include:
    - `https://techivano.com/auth/callback`
    - `https://www.techivano.com/auth/callback`
    - `http://localhost:3000/auth/callback`
  - Admin and nrcseam subdomains are disabled; all auth uses the main site.

- **Project Settings → API**
  - Copy **JWT Secret** → `SUPABASE_JWT_SECRET` on the server.
  - If magic links fail with “invalid token” or verification errors after working before, Supabase may have rotated to new JWT keys: ensure **`SUPABASE_URL`** is set on the server so the app can use the JWKS fallback.

- **Authentication → Providers**
  - **Google:** Enable the Google provider; add Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com/) (OAuth 2.0 credentials, redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`).
  - **Azure (Microsoft):** Enable the Azure provider; register an app in [Microsoft Entra ID](https://entra.microsoft.com/), set redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, and add Client ID and Secret in Supabase.
  - The app uses the same callback path for OAuth as for magic link: `https://yourdomain.com/auth/callback`. Ensure that URL is in **Redirect URLs** (see above).

- **Authentication → Email**
  - If using custom SMTP (e.g. Resend), configure it and use a verified “From” address.
  - Magic link expiry is set here; short expiry can cause “This magic link has expired” if the user opens the link late.

---

## 3. Cookie and CORS

- **Cookie:** Session is stored in `app_session_id` (httpOnly, path `/`, sameSite lax, secure in production). The value is the Supabase access token.
- **tRPC:** Client must send cookies: `credentials: "include"` is set in `AppProviders` for the tRPC `fetch` call.
- **Origin:** App and API must share the same origin (or CORS and cookie `SameSite`/domain configured if split). For Vite + Express on the same host, this is automatic.

---

## 4. Common issues and fixes

| Symptom | Check / fix |
|---------|-------------|
| “JWT verification failed” or 401 after callback | Set `SUPABASE_JWT_SECRET` on server (Project Settings → API). If secret is correct and still fails, set `SUPABASE_URL` so JWKS fallback can verify new Supabase signing keys. |
| “This magic link has expired” | User opened link after expiry; increase magic link expiry in Supabase Auth → Email, or ask user to request a new link. |
| “No sign-in code received” | Redirect URL mismatch: Supabase must redirect to your app’s `/auth/callback` and the URL must be listed in Redirect URLs. Check that login uses `window.location.origin + '/auth/callback'` (or your configured callback path). |
| “We're having trouble signing you in” (generic) | Often a non-JSON server response (e.g. 500 HTML). Check server logs; ensure env vars and DB are correct so `auth.setSession` and JWT verification succeed. |
| Session works then 401 after ~1 hour | Supabase access tokens expire (~1h). The app automatically tries to refresh the session (Supabase `refreshSession` → `auth.setSession` with new token). If refresh fails (e.g. no Supabase session in the browser), the user is redirected to login. Ensure Supabase client persists session (default: localStorage) so refresh can run. |

---

## 5. Code references

- **Login:** `client/src/pages/Login.tsx` — **Email + password** (primary), magic link (“Send magic link instead”), and **Sign in with Google** / **Sign in with Microsoft**. All use redirect `origin + /auth/callback`. Turnstile widget at bottom of form (30% smaller).
- **Callback (magic link & OAuth):** `client/src/pages/AuthCallback.tsx` — exchanges `code` for session, calls `auth.setSession`, then redirects. Errors from Supabase (query or hash) are shown with a “Return to sign in” link.
- **Session refresh on 401:** `client/src/components/AuthRefreshHandler.tsx` — on UNAUTHORIZED, tries `supabase.auth.refreshSession()` and `auth.setSession` with the new token, then invalidates `auth.me`; if refresh fails, redirects to login.
- **Bot protection (Turnstile):** `client/src/components/TurnstileWidget.tsx` — Cloudflare Turnstile widget; used on Login and Signup. Server verifies token in `auth.verifyTurnstile` and at start of `auth.signupWithPassword` when `TURNSTILE_SECRET_KEY` is set.
- **Session verification:** `server/_core/supabaseAuth.ts` — HS256 with `SUPABASE_JWT_SECRET`, then JWKS from `SUPABASE_URL` if needed.
- **Cookie and auth:** `server/_core/authenticateRequest.ts` reads `app_session_id` or `Authorization: Bearer`; `server/routers/auth.ts` sets the cookie in `setSession`.

---

## 6. Signup behavior

- **After registration:** Signup creates the account request and redirects to **`/login?registered=1`**. The login page shows: “Account created. Please sign in.”
- **Verification flow:** Password resets and sign-in verification are handled through Supabase Auth callbacks (`/auth/callback`) and server session cookie sync (`auth.setSession`).

For full architecture and audit details, see **docs/SUPABASE_AUTH_AUDIT.md**.
