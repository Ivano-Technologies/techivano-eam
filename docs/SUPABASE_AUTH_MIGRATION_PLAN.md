# Supabase Auth Migration Plan

**Objective:** Replace Manus OAuth (and unify existing password/magic-link flows) with **Supabase Auth** as the single auth system for the Techivano EAM app, while keeping the current tRPC context, `User` type, and multi-tenant model.

**Stack:** React 19 + Vite + Express 4 + tRPC 11 + Drizzle + Supabase (Postgres).

**Quick reference:** [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) — best-practice setup for Supabase Auth with Vite + React (env vars, session, redirect URLs, auth UI).

---

## Current State Summary

| Component | Current behavior |
|-----------|------------------|
| **IdP** | Manus OAuth (portal redirect → `/api/oauth/callback` → code exchange → user by `openId`) |
| **Session** | App-issued JWT (jose, `JWT_SECRET`) in cookie `app_session_id`; payload: `openId`, `appId`, `name` |
| **Backend auth** | `sdk.authenticateRequest(req)` verifies cookie JWT → `getUserByOpenId(openId)` → `User` in tRPC context |
| **Users table** | Drizzle `users`: `id`, `openId` (unique), `name`, `email`, `passwordHash`, `loginMethod`, `role`, `status`, etc. |
| **Other auth** | Password login and magic link set the **same** cookie via `sdk.createSessionToken(user.openId)`. Some `src/app/api/*` routes use `supabase.auth.getUser()` (separate Supabase client). |

**Goal:** One auth system (Supabase Auth); backend verifies Supabase JWT and resolves to the same `users` row; no Manus dependency.

---

## Phase 0 — Prerequisites and Supabase Dashboard

**Owner:** DevOps / backend lead.

1. **Supabase project**
   - Use the existing project (same as `DATABASE_URL` / `SUPABASE_URL`).
   - Ensure you have: **Project URL**, **anon key**, **service_role key**, and **JWT secret** (Project Settings → API → `JWT Secret`; used to verify Supabase JWTs server-side).

2. **Auth providers (Dashboard → Authentication → Providers)**
   - **Email**: Enable “Email”. Optionally enable “Confirm email” for new signups.
   - **Magic Link**: Enable if you want passwordless (Supabase sends the link; you can deprecate custom magic-link flow later).
   - **OAuth**: Enable desired providers (e.g. Google, GitHub, Azure) and set Client ID/Secret in Dashboard. Add redirect URLs below.

3. **Redirect URLs (Authentication → URL Configuration)**
   - Add:
     - `https://techivano.com/**` (production)
     - `http://localhost:3000/**` (local)
   - Supabase will redirect to your app after sign-in; you can use a single frontend route (e.g. `/auth/callback`) that reads the session and then redirects to `/`.

4. **Env vars (already present; document for migration)**
   - `SUPABASE_URL` — project URL  
   - `SUPABASE_ANON_KEY` — anon key (client)  
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only  
   - **New:** `SUPABASE_JWT_SECRET` — JWT secret from Dashboard (for backend JWT verification). Store in `shared/.env` / server env only; never expose to client.

5. **.env.example**
   - Add `SUPABASE_JWT_SECRET` to the Supabase section and to the deployment runbook.

**Redirect URL to add:** `https://techivano.com/auth/callback` and `http://localhost:3000/auth/callback` (Supabase redirects here after sign-in; the app route is `/auth/callback`).

**Deliverable:** Dashboard configured; `SUPABASE_JWT_SECRET` in server env; redirect URLs and providers documented.

---

## Phase 1 — Schema: Link `users` to Supabase Auth

**Owner:** Backend.

1. **Migration: add column to `users`**
   - Add nullable column: `supabase_user_id uuid` (or `uuid` type your DB supports).  
   - No FK to `auth.users` in application migrations if you prefer (Supabase manages `auth.users`); document that this column stores `auth.users.id`.

   **Drizzle (example):**
   - In `users` table definition add: `supabaseUserId: uuid('supabase_user_id')`, nullable.
   - Generate migration: `pnpm exec drizzle-kit generate` (name e.g. `add_supabase_user_id`).
   - Apply: `pnpm run db:migrate`.

2. **Unique constraint (optional but recommended)**
   - Add unique constraint on `supabase_user_id` so one Supabase user maps to at most one app user.

3. **Backward compatibility**
   - Keep `openId` column during migration. New Supabase-only users will have `supabase_user_id` set and can have a placeholder or generated `openId` for legacy code paths that still reference it, or you gradually stop using `openId` for new flows.

**Deliverable:** Migration applied; `users.supabase_user_id` exists; optional unique constraint.

---

## Phase 2 — Backend: Verify Supabase JWT and Resolve User

**Owner:** Backend.

1. **Supabase JWT verification helper**
   - **File:** e.g. `server/_core/supabaseAuth.ts`.
   - **Input:** Raw JWT string (from cookie or `Authorization: Bearer <token>`).
   - **Logic:**
     - Verify JWT with `jose` (e.g. `jwtVerify`) using `SUPABASE_JWT_SECRET` and algorithm `HS256` (Supabase default). Or use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).auth.getUser(accessToken)` to let Supabase validate the token.
     - Extract `sub` (Supabase user id = `auth.users.id`) and optionally email from payload.
   - **Output:** `{ supabaseUserId: string, email?: string }` or null if invalid/expired.

2. **Session source: cookie + header**
   - **Cookie:** Introduce a dedicated cookie name for Supabase session, e.g. `sb_access_token` or keep reusing `app_session_id` for the Supabase access token (recommended so existing cookie options and domain logic stay).
   - **Header:** Support `Authorization: Bearer <access_token>` for API clients.
   - **Resolution order:** e.g. 1) Cookie `app_session_id`, 2) `Authorization` header. If the value looks like a Supabase JWT (e.g. decode without verify and check structure), use Supabase verification; otherwise fall back to current Manus-style verification during transition (see Phase 5).

3. **User resolution**
   - **File:** `server/_core/supabaseAuth.ts` or extend `server/_core/sdk.ts`.
   - **Function:** `getUserFromSupabaseToken(token: string): Promise<User | null>`.
     - Verify token (Step 1).
     - Look up app user by `supabase_user_id` (from JWT `sub`). If found, return user.
     - If not found, optionally try match by email (for migration: first-time Supabase login of an existing app user). If matched, update `users.supabase_user_id` and return user.
     - If no match, return null (or, for sign-up flow, you may create a pending user later).

4. **Integrate into `createContext`**
   - **File:** `server/_core/context.ts`.
   - **Current:** `user = await sdk.authenticateRequest(opts.req)`.
   - **New logic (high level):**
     - Try to get token from cookie or `Authorization` header.
     - If token present and looks like Supabase JWT: call `getUserFromSupabaseToken(token)`. If non-null, set `user`.
     - Else (during migration): call existing `sdk.authenticateRequest(opts.req)` so Manus/password sessions still work.
   - **After full cutover:** Remove Manus branch; only Supabase path remains.

5. **Cookie options**
   - Reuse `getSessionCookieOptions(ctx.req)` for the Supabase token cookie (httpOnly, path `/`, sameSite, secure). Set `maxAge` from Supabase session expiry if needed, or a fixed value (e.g. 1 week) and rely on refresh.

**Deliverable:** Backend can authenticate requests using Supabase JWT and resolve to `User`; `createContext` uses Supabase-first with Manus fallback during migration.

---

## Phase 3 — Backend: Supabase Auth Callback and Cookie

**Owner:** Backend.

1. **Auth callback route (Exchange Supabase session for app cookie)**
   - **Purpose:** Supabase redirects to your app with tokens in the URL (PKCE flow) or in a fragment. Your backend should not read the fragment (client-only). Recommended: use Supabase client on the frontend to handle redirect and then call a backend endpoint that sets the cookie.
   - **Alternative (simpler):** Frontend auth callback page (see Phase 4) receives the session from Supabase client, then calls a new tRPC mutation or REST endpoint, e.g. `auth.setSession`, with the Supabase access token (or session). Backend verifies the token (Phase 2), resolves user, sets `app_session_id` cookie to the **Supabase access token** (so subsequent requests send that token and backend verifies via Phase 2). No need to issue a second app JWT if you standardize on Supabase token in cookie.
   - **Recommended:** Store Supabase access_token in `app_session_id` cookie; backend only verifies Supabase JWT and resolves user. No duplicate JWT.

2. **`auth.setSession` (tRPC or REST)**
   - **Input:** `{ accessToken: string }` (from frontend after Supabase sign-in).
   - **Logic:** Verify token (Phase 2), resolve user. If user exists (and is allowed to log in), set cookie with `accessToken` (or the token as-is). Return `{ success: true, user }`.
   - **Security:** Only accept tokens that verify successfully; short-lived validity.

3. **Logout**
   - **Current:** `auth.logout` clears `COOKIE_NAME` cookie.
   - **New:** Same: clear the session cookie. Optionally call Supabase `auth.signOut()` on the client so Supabase session is invalidated; server just clears the cookie.

**Deliverable:** Backend endpoint that accepts Supabase access token and sets session cookie; logout clears cookie.

---

## Phase 4 — Frontend: Supabase Client and Sign-In

**Owner:** Frontend.

1. **Supabase client (browser)**
   - **Package:** `@supabase/supabase-js` (already in use elsewhere).
   - **File:** e.g. `client/src/lib/supabase.ts` or reuse existing if present.
   - **Create client with:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (from env, e.g. `import.meta.env.VITE_SUPABASE_URL`). Use this only for auth and optional realtime; do not expose service role.

2. **Auth callback page**
   - **Route:** e.g. `/auth/callback` (or `/api/auth/callback` if you implement a server redirect handler that forwards to frontend).
   - **Behavior:**
     - Supabase client can exchange code for session on the client (e.g. `supabase.auth.exchangeCodeForSession(code)` if Supabase redirects with `?code=...`).
     - On success, read `session.access_token`, call backend `auth.setSession({ accessToken })` (tRPC or fetch), then redirect to `/`.
     - On error, redirect to `/login` with error message.

3. **Login page**
   - **Current:** Password + magic link (tRPC); optional “Sign in with OAuth” that redirects to Manus.
   - **New:**
     - **Email + password:** Call `supabase.auth.signInWithPassword({ email, password })`. On success, get `session.access_token`, call `auth.setSession({ accessToken })`, redirect to `/`.
     - **Magic link:** Call `supabase.auth.signInWithOtp({ email })`. User clicks link in email; Supabase redirects to your app with code → callback page exchanges code and calls `auth.setSession`, then redirect to `/`.
     - **OAuth (Google, etc.):** Call `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`. After redirect, callback page has session; call `auth.setSession` and redirect.
   - **Remove:** Manus redirect (delete `getLoginUrl()` usage for OAuth; replace with Supabase OAuth or hide until migration complete).

4. **Sign-up (request access)**
   - **Current:** tRPC `auth.signup` with email/name; app creates pending user and may send email.
   - **Options:**
     - **A)** Keep tRPC signup for “request access” (admin approves); after approval, user sets password in Supabase or receives magic link. Then first sign-in via Supabase links `supabase_user_id` (Phase 2 email match).
     - **B)** Sign-up via Supabase: `supabase.auth.signUp({ email, password, options: { data: { name } } })`. Create app user (pending) linked to `supabase_user_id` in a backend hook or via `auth.setSession` logic that creates user if not exists (with approval flow if needed).

5. **Session persistence**
   - Supabase client can persist session in localStorage by default. Your app session is the cookie set by `auth.setSession`. Ensure after any Supabase sign-in you call `auth.setSession` so the cookie is set and tRPC sees the user.

6. **useAuth and guards**
   - **Current:** `useAuth` uses `trpc.auth.me.useQuery()` and redirects to `getLoginUrl()` when unauthenticated.
   - **New:** Keep `trpc.auth.me`; redirect to `/login` (not Manus). Remove or replace `getLoginUrl()` with `/login` for unauthenticated redirects.
   - **DashboardLayout / AppProviders:** Replace any “Sign in with OAuth” button that uses `getLoginUrl()` with Supabase OAuth or email/password only.

**Deliverable:** Login and sign-up use Supabase Auth; callback page sets app cookie via backend; unauthenticated redirects go to `/login`.

---

## Phase 5 — Migrate Existing Users (Manus / Password) to Supabase

**Owner:** Backend + product.

1. **Strategy**
   - **Option A — Lazy migration:** No bulk import. Existing users keep logging in with password (or Manus until deprecated). On first Supabase sign-in (e.g. “Sign in with Google”), backend matches by email and sets `users.supabase_user_id`; next time they can use Supabase only.
   - **Option B — Bulk link:** For users with email, create Supabase users via Admin API (service role) with same email, set password to a random value and send “Set your password” link, or invite link; then set `users.supabase_user_id` from created `auth.users.id`. Run once as script.

2. **Password and magic-link migration**
   - **Current:** Password hash in `users.passwordHash`; login via tRPC and app-issued JWT.
   - **Target:** Passwords and magic link live in Supabase Auth only.
   - **Steps:**
     - For each app user with email (and optionally password hash), create Supabase user (Admin API) with same email; if you have password hash, Supabase does not accept raw hashes—you must either force “reset password” or keep legacy password login until users reset. Prefer: invite or “set password” link so Supabase stores the password.
     - Set `users.supabase_user_id = auth.users.id`.
     - After migration, remove local password login or keep a short “legacy password” path that creates/updates Supabase user and then redirects to Supabase sign-in.

3. **Manus users**
   - Match by email when they first sign in with Supabase (e.g. OAuth with same email). Backend Phase 2 email fallback sets `supabase_user_id`. Deprecate Manus; remove callback and env vars (Phase 6).

**Deliverable:** Decision and (if needed) script for linking existing users to Supabase; legacy password path optional and temporary.

---

## Phase 6 — Remove Manus and Legacy Auth

**Owner:** Full stack.

1. **Remove Manus**
   - Delete or disable route: `GET /api/oauth/callback` (and any Manus-specific routes).
   - Remove from `server/_core/index.ts`: `registerOAuthRoutes(app)` or equivalent.
   - Remove Manus SDK usage from `server/_core/sdk.ts` (exchangeCodeForToken, getUserInfo, getUserInfoWithJwt). Keep only cookie parsing and Supabase-based auth, or move Supabase auth to `supabaseAuth.ts` and keep sdk for any remaining non-auth Manus features (if none, remove).

2. **Env and config**
   - Remove or stop using: `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` (if only used for Manus). Update `.env.example` and runbook.

3. **Frontend**
   - Remove `getLoginUrl()` (or make it return `/login`). Remove OAuth button that redirects to Manus. Clean up `manus-runtime-user-info` localStorage if redundant.

4. **Password and magic link**
   - Once all users are on Supabase: remove tRPC `auth.loginWithPassword`, `auth.requestMagicLink`, and custom magic-link verification that sets app JWT. Remove `server/passwordAuth.ts`, `server/magicLinkAuth.ts` (and related) if fully replaced by Supabase. Keep `auth.signup` if it still creates pending app users; implement via Supabase sign-up or admin-created users.

5. **Cookie and context**
   - Single path in `createContext`: read cookie/header → verify Supabase JWT → resolve user. No fallback to Manus or legacy JWT.

**Deliverable:** No Manus code or env; single Supabase-only auth path; legacy password/magic-link removed or minimal.

---

## Phase 7 — Align `src/app/api` Routes with Unified Auth

**Owner:** Backend.

- **Current:** Some routes under `src/app/api/*` use `getSupabaseForRequest` and `supabase.auth.getUser()` (Supabase client session).
- **Target:** Prefer one source of truth. Options:
  - **A)** Those routes accept the same session cookie as Express (Supabase access token). Implement a small helper that reads the cookie, verifies Supabase JWT, and returns user (or use shared middleware).
  - **B)** Or proxy these APIs through Express so that Express sets the cookie and all auth goes through tRPC/Express context.

Document which approach is chosen and update each route to use it so behavior is consistent with the rest of the app.

**Deliverable:** All API routes use the same auth model (Supabase JWT from cookie/header).

---

## Phase 8 — Testing and Rollout

1. **Tests**
   - Unit: Supabase JWT verification and user resolution (valid token, unknown user, email match).
   - Integration: Login with Supabase (email/password and OAuth if enabled) → `auth.me` returns user; protected procedure works; logout clears cookie.
   - E2E: Sign-in → access dashboard → logout.

2. **Rollout**
   - Deploy with Phase 2 + 3 + 4 behind feature flag or config: “use Supabase auth” so new logins use Supabase; existing sessions (Manus/password) still work until expiry.
   - Monitor errors and session resolution; run Phase 5 (user migration) as planned.
   - After migration window, enable “Supabase only” and remove Manus/legacy (Phase 6).

3. **Docs**
   - Update runbook and README: auth is Supabase; required env vars (`SUPABASE_JWT_SECRET`, etc.); redirect URLs.

**Deliverable:** Test suite updated; rollout plan; docs updated.

---

## Checklist Summary

| Phase | Key deliverables |
|-------|------------------|
| 0 | Dashboard: providers, redirect URLs; `SUPABASE_JWT_SECRET` in env |
| 1 | `users.supabase_user_id` migration |
| 2 | Supabase JWT verification; user resolution; `createContext` Supabase + fallback |
| 3 | `auth.setSession` (cookie from Supabase token); logout unchanged |
| 4 | Supabase client; `/auth/callback`; login/sign-up use Supabase; redirect to `/login` |
| 5 | User migration strategy and execution (lazy or bulk) |
| 6 | Remove Manus routes/env; single auth path |
| 7 | `src/app/api` routes use same auth |
| 8 | Tests; rollout; docs |

---

## File Change Overview (reference)

| Area | Files to add/modify |
|------|----------------------|
| Schema | `drizzle/` migration for `users.supabase_user_id`; `drizzle/schema.ts` |
| Backend auth | `server/_core/supabaseAuth.ts` (new); `server/_core/context.ts`; `server/_core/sdk.ts` (simplify or remove Manus); `server/_core/oauth.ts` (remove or gut) |
| Backend routes | `server/_core/index.ts` (remove Manus callback); `server/routers.ts` (add `auth.setSession`, adjust logout if needed) |
| Frontend | `client/src/lib/supabase.ts`; `client/src/pages/Login.tsx`; new `client/src/pages/AuthCallback.tsx` (or similar); `client/src/const.ts` (getLoginUrl → `/login`); `client/src/_core/hooks/useAuth.ts`; layout components that link to OAuth |
| Env | `.env.example`; `server/_core/env.ts` (SUPABASE_JWT_SECRET); runbook |
| API routes | `src/app/api/**` and shared auth helper if needed |

---

## Risk and Rollback

- **Risk:** Existing sessions invalidated if cookie format or secret changes. Mitigation: during transition, support both Manus JWT and Supabase JWT in `createContext`; cut over cookie format only after Supabase path is verified.
- **Rollback:** Keep Manus env and callback in a branch until Phase 6 is proven in production; revert `createContext` to Manus-only if critical issues appear.

---

---

## Supabase configuration checklist

Before launch, in **Supabase Dashboard**:

**Authentication → URL Configuration**

- Allowed redirect URLs:
  - `https://techivano.com/auth/callback`
  - `http://localhost:3000/auth/callback`
  - If using www: `https://www.techivano.com/auth/callback`

**Authentication → Providers**

| Provider        | Status    |
|----------------|-----------|
| Email/password | Required  |
| Magic link     | Optional  |
| Google         | Optional  |
| GitHub         | Optional  |

**Project Settings → API → JWT Settings**

- Copy **JWT Secret** into server env as `SUPABASE_JWT_SECRET`.
- Optional: set `SUPABASE_JWT_ISSUER` (e.g. `https://YOUR_REF.supabase.co/auth/v1`) and `SUPABASE_JWT_AUDIENCE` (e.g. `authenticated`) for stricter validation.

---

## Local development (Supabase login)

For email/password login to complete, the **server** must verify the Supabase access token. Without `SUPABASE_JWT_SECRET` in `.env` or `.env.local`, `auth.setSession` will return "Invalid or expired session token" after Supabase accepts the password.

### Quick local test checklist

1. **Env (client + server)**  
   In `.env.local` or `.env` ensure:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase project URL and anon key; used by the client).
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (server verification).  
   Get **JWT Secret** from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API** → **JWT Settings**.
   - Optional: `VITE_APP_URL=http://localhost:3000` (or the port you use). Server uses `PORT` (default 3000); if the port is different, set `VITE_APP_URL` to match (e.g. `http://localhost:3001`).

2. **Supabase redirect URLs**  
   In Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**, add:
   - `http://localhost:3000/**` (default port)
   - If you run on another port (e.g. 3001), also add `http://localhost:3001/**`

3. **App user in Supabase**  
   Either create a user in Supabase **Authentication** → **Users** (email + password), or use **Sign up** on the app’s `/signup` page so the user exists in both Supabase Auth and your app’s `users` table (link by email on first login if you have lazy migration).

4. **Run and test**
   - From repo root: `pnpm dev`
   - Open **http://localhost:3000/** (or the port printed in the terminal, e.g. 3001).
   - Go to **/login**, sign in with email/password. You should be redirected to `/` with a session.

**Note:** If Redis is not running locally, you may see `ECONNREFUSED 127.0.0.1:6379` in the logs; in development the server stays up so you can still test Supabase login. The `[OAuth] ERROR: OAUTH_SERVER_URL is not configured` message is safe to ignore when using Supabase auth only.

---

## Production deployment checklist

- [ ] **Environment variables:** `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` set on server and build.
- [ ] **Migration:** `pnpm run db:migrate` applied; confirm `users.supabase_user_id` exists.
- [ ] **Auth flow test:** Email/password, magic link, and Google (if enabled); confirm redirect to `/auth/callback` and cookie set.
- [ ] **Cookie:** Session cookie uses `httpOnly: true`, `secure: true` in production, `sameSite: "lax"`, `path: "/"`, `maxAge: 7 days`.
- [ ] **JWT validation:** Backend validates `exp`, `nbf` (and optional `iss`, `aud`) via `verifySupabaseToken()`.

---

## Request-level identity cache

**`server/_core/redis.ts`** — Shared Redis client for app-level caching (BullMQ keeps its own connection).

**`server/_core/userCache.ts`** — Cache resolved `User` by Supabase `sub` (auth.users.id):

- **`getCachedUser(sub)`** — Redis lookup first; on miss, DB `getUserBySupabaseUserId(sub)` then cache (TTL 1 hour).
- **`setUserInCache(sub, user)`** — Store after lazy migration so the next request hits cache.
- **`invalidateUserCache(supabaseUserId)`** — Call after profile/role/status updates (user update, updateRole, completeOnboarding, approve/reject).

Auth flow: JWT → verify → Redis cache → on miss DB → cache. Cache is invalidated on user update, role change, approval/rejection, and onboarding completion.

---

## Central auth helper

**`server/_core/authenticateRequest.ts`**

- `getSessionToken(req)` — reads `app_session_id` cookie or `Authorization: Bearer` header.
- `authenticateRequest(req)` — returns `User | null`: tries Supabase JWT first, then legacy. No throw.

Use `authenticateRequest(req)` in tRPC `createContext` and in any API route that needs the same auth. Do **not** unify `src/app/api/*` on `getSupabaseForRequest`; instead have those routes call `authenticateRequest(req)` (or a thin wrapper that reads the request from their framework) for one authentication system.

---

## Implementation status (as implemented)

| Phase | Status | Notes |
|-------|--------|------|
| 0 | Manual | Configure Dashboard; set `SUPABASE_JWT_SECRET` in env. |
| 1 | Done | `users.supabase_user_id` added; migration `0038_supabase_auth_user_id.sql`. |
| 2 | Done | `server/_core/supabaseAuth.ts` (verify + resolve user; validates exp/nbf/iss/aud); `server/_core/authenticateRequest.ts`; `createContext` uses `authenticateRequest(req)`. |
| 3 | Done | `auth.setSession` sets cookie via `getAuthSessionCookieOptions` (httpOnly, secure in prod, sameSite: lax, maxAge 7 days). |
| 4 | Done | Supabase client; `/auth/callback` page; Login uses Supabase (password, OTP, OAuth) when `VITE_SUPABASE_URL` set. |
| 5 | Done | Lazy migration: `getUserFromSupabaseToken` matches by email and sets `supabase_user_id`. |
| 6 | Done | Manus callback removed (redirect to `/login`); `getLoginUrl()` returns `/login`. |
| 7 | Pending | `src/app/api/*` routes still use `getSupabaseForRequest` + `supabase.auth.getUser()`. Align by having those routes call a shared auth helper that reads `app_session_id` / Bearer and uses `authenticateRequest`-style verification (see [Central auth helper](#central-auth-helper)). |
| 8 | Pending | Add tests and rollout. |

---

## Deploy verification (Supabase Auth)

After merging to `staging` or `main` and deploying:

1. **Env:** Ensure `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are set for the deployed environment.
2. **Migration:** Run `pnpm run db:migrate` (or equivalent) so `users.supabase_user_id` exists.
3. **Smoke test:** Open the app → sign in (email/password or OAuth if enabled) → confirm redirect to `/auth/callback` then home; confirm no auth errors in console.
4. **Logs:** Check auth metrics (`auth_method=supabase` / `legacy` / `none`) to confirm Supabase path is used.

---

*Document version: 1.0. Supabase Auth migration for Techivano EAM — single auth system, same tRPC context and tenant model.*
