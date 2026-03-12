# Supabase Auth — Full Audit & Architecture (Techivano)

This document records the audit performed per the Supabase Auth master prompt. Techivano uses **Vite + React** (SPA) and **Express + tRPC** (API), not Next.js. The architecture below is the actual production setup.

---

## 1. Architecture Summary

| Layer | Implementation |
|-------|-----------------|
| **Frontend** | Vite + React, wouter (routing), tRPC React Query |
| **Auth client** | `@supabase/supabase-js` `createClient()` in `client/src/lib/supabase.ts` (browser only; no SSR) |
| **Session storage** | Server sets `app_session_id` httpOnly cookie (Supabase access token) via `auth.setSession` tRPC mutation |
| **API auth** | Express tRPC; `authenticateRequest()` reads cookie or `Authorization: Bearer`, verifies JWT with `SUPABASE_JWT_SECRET`, resolves `User` via `getUserFromSupabaseToken()` |
| **Protected routes** | `DashboardLayout` + `useAuth()` (trpc.auth.me); unauthenticated users see sign-in card or redirect to `/login` |
| **Public auth routes** | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-magic-link`, `/auth/callback` — rendered in minimal layout **without** waiting for `auth.me` (avoids skeleton) |

---

## 2. Root Causes Identified (Login / Skeleton)

1. **Layout blocked on `auth.me`**  
   For all routes, the app showed `DashboardLayoutSkeleton` until `auth.me` resolved. On `/login`, unauthenticated users never got a session, so `auth.me` could stay pending or return null; either way the UI stayed on the skeleton.  
   **Fix:** Public auth paths use `window.location.pathname` so `/login` is detected on first paint; for these paths we render only the route content in a minimal wrapper (no sidebar, no skeleton). Implemented in `client/src/components/DashboardLayout.tsx`.

2. **Path detection timing**  
   Relying only on wouter’s `useLocation()` could lag on first paint, so the app might not treat the URL as a public auth path immediately.  
   **Fix:** Public path check uses both `window.location.pathname` and wouter `location`.

3. **Missing Supabase env (client)**  
   If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` were missing, `client/src/lib/env.ts` threw and the app crashed before rendering.  
   **Fix:** Client env no longer throws; Supabase client is created with placeholders when vars are missing. Login page guards with `useSupabaseAuth` and shows an error on submit if Supabase isn’t configured.

---

## 3. Supabase Configuration (Dashboard Checklist)

Verify in [Supabase Dashboard](https://supabase.com/dashboard) → your project:

- **Auth → Providers**  
  - Email: enabled.  
  - Google (or other OAuth): enabled if you use “Sign in with Google”.

- **Auth → URL configuration**  
  - **Site URL:** `https://techivano.com` (production) or `http://localhost:3000` (local).  
  - **Redirect URLs:**  
    - `https://techivano.com/auth/callback`  
    - `http://localhost:3000/auth/callback`  
    - Add any other origins (e.g. preview URLs) as needed.

- **Auth → Email**  
  - Confirm email settings (templates, redirects) if you use magic link or email confirmation.

- **Project Settings → API**  
  - Copy **Project URL** and **anon public** key for env (see below).  
  - Copy **JWT Secret** for server-side verification (`SUPABASE_JWT_SECRET`).

---

## 4. Environment Variables

### Client (Vite; must be prefixed with `VITE_` for Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes (for login) | Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes (for login) | Supabase anon/public key |
| `VITE_APP_URL` | Recommended | App origin, e.g. `https://techivano.com` (used for reset links, etc.) |

### Server (Express / Vercel server)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_JWT_SECRET` | **Yes** | JWT Secret from Supabase Project Settings → API. Without this, server cannot verify tokens and `auth.me` always returns null. |
| `SUPABASE_URL` | Yes | Same as project URL (server-side Supabase usage if any). |
| `SUPABASE_ANON_KEY` | Yes | Anon key (server-side usage if any). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | For admin operations; not used for normal login. |
| `SUPABASE_JWT_ISSUER` | Optional | JWT `iss` claim to validate (e.g. `https://xxxx.supabase.co/auth/v1`). |
| `SUPABASE_JWT_AUDIENCE` | Optional | JWT `aud` claim to validate. |
| `DATABASE_URL` | Yes | Postgres connection string (Drizzle / app DB). |

**Vercel:** In Project Settings → Environment Variables, set the same variables for Production (and Preview if needed). Ensure `SUPABASE_JWT_SECRET` is set in production; otherwise login will succeed in Supabase but the app will not recognize the session.

---

## 5. Auth Flow (End-to-End)

### Email + password

1. User opens `https://techivano.com/login` → login form renders (no skeleton).  
2. User submits email/password → `supabase.auth.signInWithPassword({ email, password })`.  
3. On success → `trpc.auth.setSession.mutate({ accessToken })` → server verifies JWT, loads user, sets `app_session_id` cookie.  
4. Client redirects to `/` → `auth.me` is called with cookie → user is set → dashboard renders.

### Google OAuth

1. User clicks Google on login page → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } })`.  
2. Supabase redirects to Google, then back to `https://techivano.com/auth/callback?code=...`.  
3. `AuthCallback` runs `supabase.auth.exchangeCodeForSession(code)` → then `auth.setSession(accessToken)` → cookie set → redirect to `/`.

### Session persistence

- Session is stored in **httpOnly** cookie `app_session_id` (Supabase access token).  
- On every page load or tRPC call, the client sends the cookie (`credentials: "include"` in tRPC client).  
- `auth.me` runs in layout; server reads cookie, verifies JWT, returns user.  
- No `onAuthStateChange` is required for persistence; the cookie + `auth.me` provide it.

---

## 6. Files Touched by Audit / Fixes

| File | Change |
|------|--------|
| `client/src/components/DashboardLayout.tsx` | Public auth paths use `pathname` + minimal layout; no skeleton on `/login`. |
| `client/src/lib/env.ts` | No throw on missing Supabase vars; return empty string. |
| `client/src/lib/supabase.ts` | Create client with placeholders when env missing so app loads. |
| `server/_core/authenticateRequest.ts` | (Existing) Reads cookie/Bearer, verifies Supabase JWT, logs auth metrics. |
| `server/_core/supabaseAuth.ts` | (Existing) `verifySupabaseToken`, `getUserFromSupabaseToken`; requires `SUPABASE_JWT_SECRET`. |
| `server/_core/cookies.ts` | (Existing) `getAuthSessionCookieOptions`: httpOnly, secure in production, sameSite lax. |
| `server/routers/auth.ts` | (Existing) `setSession`, `me`, `logout`; password login is Supabase-only. |
| `client/src/pages/Login.tsx` | (Existing) `signInWithPassword` then `setSession`; OAuth uses `redirectTo: origin + '/auth/callback'`. |
| `client/src/pages/AuthCallback.tsx` | (Existing) `exchangeCodeForSession(code)` then `setSession`; redirect to `/`. |
| `client/src/providers/AppProviders.tsx` | (Existing) tRPC client with `credentials: "include"`. |

---

## 7. What Is Not in This Stack

- **No Next.js** — No `middleware.ts`, no `createServerClient` from `@supabase/ssr`, no `app/auth/callback/route.ts`.  
- **No separate “browser” vs “server” Supabase client** — Single browser client; server only verifies JWT and uses DB.  
- **No Supabase Admin Client in browser** — Service role is server-only.

---

## 8. Success Criteria (Verification)

- [ ] Login page at `https://techivano.com/login` loads the form (no skeleton).  
- [ ] Email/password login works; redirect to dashboard.  
- [ ] Google login works; redirect to `/auth/callback` then dashboard.  
- [ ] After refresh, user remains logged in (cookie + `auth.me`).  
- [ ] Protected routes show dashboard when logged in; otherwise sign-in card or redirect to `/login`.  
- [ ] Logout clears cookie and returns to sign-in state.  
- [ ] Production has `SUPABASE_JWT_SECRET` (and other required env) set in Vercel.

---

## 9. Verification Checklist (Post-Deploy)

### JWT verification
- Backend uses `jose` with `algorithms: ["HS256"]` and `SUPABASE_JWT_SECRET`. Optional `SUPABASE_JWT_ISSUER` / `SUPABASE_JWT_AUDIENCE` must match Dashboard → API → JWT Settings if set.

### Cookie
- `app_session_id`: httpOnly true, path "/", sameSite "lax", secure true in production (or when x-forwarded-proto is https).

### OAuth redirect chain
- Browser → Supabase OAuth → `/auth/callback` → `exchangeCodeForSession(code)` → `setSession(access_token)` → redirect `/`. Redirect URLs in Supabase must include `https://techivano.com/auth/callback` and `http://localhost:5173/auth/callback` (or your dev origin).

### auth.me
- Returns `ctx.user` (or null); never throws for unauthenticated requests. Frontend treats null as not logged in.

### CORS / credentials
- App and API are same-origin (Express serves SPA and `/api/trpc`). Cookies are sent via tRPC client `credentials: "include"`. If you later split API to another domain, set `credentials: true` in CORS on the server.

### Optional: faster initial paint
- To reduce perceived latency when a session already exists, you can call `supabase.auth.getSession()` in `useAuth` and treat loading as false when a Supabase session is present (then let `auth.me` fill in the app user). Documented here for future optimization.

---

## 10. If Login Still Fails in Production

1. **Confirm deploy** — Latest commit (DashboardLayout + env + supabase client fixes) is deployed to `techivano.com`.  
2. **Vercel env** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (and optionally `SUPABASE_JWT_ISSUER` / `SUPABASE_JWT_AUDIENCE`) set for Production.  
3. **Supabase redirect URLs** — `https://techivano.com/auth/callback` is in the allow list.  
4. **Browser** — Hard refresh or incognito to avoid cached JS.  
5. **Server logs** — Check for `auth request` log lines (auth_method, user, latency_ms); if `auth_method: "none"` after login, cookie or JWT verification is failing (often missing or wrong `SUPABASE_JWT_SECRET`).
