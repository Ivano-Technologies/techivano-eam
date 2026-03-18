# Techivano EAM — Auth System Comprehensive Audit

**Audit date:** 2026-03-18  
**Scope:** End-to-end authentication (Supabase, custom flows, session, deployment). Includes subdomains **admin.techivano.com** and **nrcseam.techivano.com**.

---

## 1. Executive summary

The app uses **Supabase Auth** as the primary identity provider, with a custom session layer (httpOnly cookie + tRPC `auth.setSession` / `auth.me`). Email/password and Google OAuth are implemented and documented; legacy password migration and password reset are wired. Several **bugs and gaps** remain, especially for **magic link** and **Vercel deployment** of non-tRPC auth routes. Supabase Auth itself is **not inherently problematic**; the main issues are integration consistency, env usage, and one legacy flow that conflicts with the Supabase-only auth model.

---

## 2. Current architecture (reference)

| Layer | Implementation |
|-------|----------------|
| **Identity** | Supabase Auth (email/password, Google OAuth, optional Azure) |
| **Session** | `app_session_id` cookie = Supabase access token (JWT); optional `SESSION_COOKIE_NAME` for server-side session row (revocable) |
| **API auth** | `authenticateRequest()` → cookie or `Authorization: Bearer` → `verifySupabaseToken()` → `getUserFromSupabaseToken()` → DB/Redis user |
| **Protected routes** | `DashboardLayout` + `useAuth()` (trpc.auth.me); public auth paths skip skeleton |
| **Backend** | Express (dev) + Vercel serverless (`api/trpc/[...path].ts`, `api/auth/google`, `api/auth/google/callback`) |

---

## 3. Bugs and issues

### 3.1 Magic link — broken on Vercel and wrong session type

- **Magic link verification route:** Implemented only on the **Express** app in `server/_core/index.ts` as `app.post("/api/auth/verify-magic-link", ...)`. There is **no** `api/auth/verify-magic-link.ts` (or equivalent) under `api/`. On Vercel, only `api/trpc/*` and `api/auth/google*` exist as serverless functions, so **POST /api/auth/verify-magic-link returns 404** in production.
- **Magic link URL in email:** `server/magicLinkAuth.ts` builds the link as `${BASE_URL}/auth/verify?token=${token}`. The client route is **`/verify-magic-link`** (see `client/src/App.tsx` and `VerifyMagicLink.tsx`). So the link in the email sends users to **`/auth/verify`**, which is not a defined route — wrong path.
- **Session after magic link:** `server/_core/magicLinkVerification.ts` signs a **custom JWT** with `ENV.cookieSecret` and sets it in `COOKIE_NAME` (same as `app_session_id`). The rest of the stack expects that cookie to be a **Supabase** access token: `authenticateRequest()` uses `looksLikeSupabaseJwt` and **`verifySupabaseToken()`** (which uses `SUPABASE_JWT_SECRET`). So after magic link verification, the cookie is **not** a Supabase JWT and will **never** authenticate. Effectively, **magic link login does not work** even when the verify endpoint is hit (e.g. in dev with Express).

**Recommendations:**

1. Change the link in the email to **`/verify-magic-link?token=...`** in `server/magicLinkAuth.ts`.
2. Either:
   - **Option A:** Add a Vercel serverless route for magic link (e.g. `api/auth/verify-magic-link.ts`) that calls the same handler, **and** change the post-verify flow to obtain a Supabase session (e.g. sign in with magic link via Supabase, or issue a short-lived token that the client exchanges for a Supabase session), then call `auth.setSession(accessToken)` so the cookie is a Supabase JWT; or
   - **Option B:** Deprecate app magic link and use **Supabase magic link** only (Supabase Auth → email link → Supabase callback → your `/auth/callback` + `auth.setSession`), so one session model everywhere.

### 3.2 Magic link verification uses tenant-scoped `getUserById`

- In `server/_core/magicLinkVerification.ts`, after `verifyMagicLinkToken(token)` returns `userId`, the code calls **`db.getUserById(userId)`**. In `server/db.ts`, `getUserById` uses **`getDb()`** (tenant-scoped). During magic link verification there is no tenant context, so this can be wrong or fail. For auth flows that are not yet in a tenant context, **`db.getRootUserById(userId)`** should be used.

**Recommendation:** Use `getRootUserById(userId)` in the magic link verification handler (and, if you keep custom magic link, ensure the rest of the flow is consistent with Supabase-only auth).

### 3.3 Supabase Admin client env on server

- `server/supabaseAdmin.ts` uses `process.env.VITE_SUPABASE_URL` (and `NEXT_PUBLIC_*`) for the Supabase URL. On Vercel, **`VITE_*`** are typically available only at build time for the client; serverless functions often do not have them. If only `VITE_SUPABASE_URL` is set in the project (and not `SUPABASE_URL`), **createAuthUserWithPassword**, **updateAuthUserPassword**, and **checkRequiresPasswordSetup** can fail in production.

**Recommendation:** Prefer **server-only** env for the admin client, e.g. `process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL`, and document that production must set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the server.

### 3.4 Auth router `@ts-nocheck` and stub `loginWithPassword`

- `server/routers/auth.ts` has `// @ts-nocheck` at the top (weakens type safety).
- `loginWithPassword` is a stub that always throws, telling the client to use the sign-in form. That’s correct for the current design (password login is Supabase-only on the client), but the procedure remains in the router; consider removing it or clearly marking it as “deprecated, do not use” to avoid confusion.

### 3.5 Subdomains: admin.techivano.com and nrcseam.techivano.com

The app is designed for **host-based multi-tenancy**: one Vercel deployment serves **admin.techivano.com** (Ivano mothership) and **nrcseam.techivano.com** (NRCS tenant). Auth and tenant resolution depend on the `Host` header.

**What works for subdomains**

- **Host → app variant and org:** `server/_core/context.ts` resolves `appVariant` and `organizationId` from host: `admin.techivano.com` → `ENV.hostOrgAdmin`, `nrcseam.techivano.com` → `ENV.hostOrgNrcs`. Same logic runs for Express and for the Vercel tRPC handler (createContext uses `getHostFromRequest(req)`).
- **Cookies are host-scoped:** `server/_core/cookies.ts` does **not** set `domain` on the auth cookie, so `app_session_id` is scoped to the exact host. A session on admin.techivano.com is not sent to nrcseam.techivano.com and vice versa. That is correct for tenant isolation.
- **OAuth redirect per host:** Custom Google OAuth in `api/auth/google.ts` builds `redirectUri` from the request host (`x-forwarded-host` / `host`), so each subdomain gets its own callback URL (e.g. `https://admin.techivano.com/api/auth/google/callback`). The callback in `api/auth/google/callback.ts` uses `parsedState.origin` (passed in state from the login page) to redirect back to the same host's `/auth/callback?access_token=...`. So Google sign-in works per subdomain.
- **Login URL and branding:** `getLoginUrl()` uses `window.location.origin`, so redirects to login go to the current subdomain. `useAuthBranding` returns `"ivano"` for admin.techivano.com and `"nrcs"` for others, so login/signup pages show the right branding per host.
- **Supabase redirect URLs:** The script `scripts/supabase-add-redirect-urls.ts` and docs list both subdomains' callback URLs; these must be added in Supabase Dashboard (Auth → URL configuration) for each: `https://admin.techivano.com/auth/callback`, `https://nrcseam.techivano.com/auth/callback`.

**Subdomain-specific issues**

1. **Signup domain check uses wrong host for NRCS:** In `server/_core/signupDomain.ts`, `getAllowedSignupDomainsForRequest(req)` checks `host === "nrcs.techivano.com"` for the NRCS list. The actual NRCS host is **nrcseam.techivano.com**. So when a user signs up on nrcseam.techivano.com, the host does not match and the code falls back to `ENV.allowedSignupDomains` (default list) instead of `ENV.allowedDomainsNrcs`. If you intend NRCS to have a different (stricter or different) list than the default, signups on nrcseam will currently get the default list until this is fixed.
2. **CORS / ALLOWED_ORIGINS:** In production, CORS uses `ALLOWED_ORIGINS` or `VITE_APP_URL` (comma-separated). For subdomains to call the same API (e.g. when both hit the same Vercel project), you must include both origins in the allow list, e.g. `https://admin.techivano.com,https://nrcseam.techivano.com` (and `https://techivano.com` if the apex is used). Otherwise, browser requests from one subdomain may be rejected by CORS.
3. **E2E and default base URL:** Playwright default is `E2E_BASE_URL=https://techivano.com`. The apex may serve the marketing page, not the EAM app. For E2E against the EAM app on a subdomain, set `E2E_BASE_URL=https://admin.techivano.com` or `https://nrcseam.techivano.com` so login and tRPC run against the correct host.

**Checklist for subdomains**

| Item | admin.techivano.com | nrcseam.techivano.com |
|------|---------------------|------------------------|
| Vercel domain | Add in project | Add in project |
| Supabase redirect URLs | `https://admin.techivano.com`, `https://admin.techivano.com/auth/callback` | `https://nrcseam.techivano.com`, `https://nrcseam.techivano.com/auth/callback` |
| Google Cloud redirect URIs (custom OAuth) | `https://admin.techivano.com/api/auth/google/callback` | `https://nrcseam.techivano.com/api/auth/google/callback` |
| ALLOWED_ORIGINS | Include if cross-origin | Include if cross-origin |
| ENV | `HOST_ORG_ADMIN`, `ALLOWED_DOMAINS_ADMIN` | `HOST_ORG_NRCS`, `ALLOWED_DOMAINS_NRCS` |
| Signup domain logic | Matches `admin.techivano.com` | Fix: use `nrcseam.techivano.com` in signupDomain.ts |

**Recommendation:** In `server/_core/signupDomain.ts`, change the NRCS host check from `nrcs.techivano.com` to `nrcseam.techivano.com` so that signups on the NRCS subdomain use `ENV.allowedDomainsNrcs`.

---

## 4. What is working

- **Email/password login:** Client calls `supabase.auth.signInWithPassword` then `auth.setSession(accessToken)`; cookie is set; `auth.me` and protected routes work. Legacy users are migrated via `migrateLegacyPasswordUser` on “Invalid login credentials”.
- **Google OAuth:** Custom (`/api/auth/google`, `/api/auth/google/callback`) when `GOOGLE_OAUTH_CLIENT_ID` is set; otherwise Supabase host. Callback sets cookie via redirect to `/auth/callback?access_token=...` or code exchange; `AuthCallback.tsx` calls `auth.setSession`.
- **Password reset:** Request → app token in DB + email; reset page → `auth.resetPassword`; app DB and (when present) Supabase password are updated in `server/passwordReset.ts`.
- **Session persistence:** Cookie + `auth.me`; optional Redis user cache; optional `user_sessions` row for revoke-on-logout.
- **Protected routes / public auth paths:** `DashboardLayout` treats public auth paths as non-skeleton; login/signup/callback load without waiting on `auth.me`.
- **Vercel tRPC:** `api/trpc/[...path].ts` serves tRPC so `auth.setSession` and `auth.me` work in production (per AUTH_STABILIZATION_REPORT).
- **MFA and impersonation:** Documented and wired (global owner MFA, impersonation with banner).

---

## 5. Is Supabase Auth problematic?

**No.** The issues are not with Supabase Auth itself but with:

- **Dual session model:** Custom magic link sets a non-Supabase JWT in the same cookie name, which the rest of the app does not accept.
- **Missing serverless route** for magic link on Vercel.
- **Wrong link URL** in magic link email and **tenant-scoped** user lookup in magic link verification.
- **Env usage** for server-side Supabase (relying on `VITE_*` in serverless).

Supabase Auth is a good fit for this stack: JWT verification with `SUPABASE_JWT_SECRET`, cookie-based session, and optional Supabase-hosted OAuth are consistent and maintainable once the above gaps are fixed.

---

## 6. Options to resolve issues

### 6.1 Minimal fixes (keep current design)

1. **Magic link (if you keep it):**
   - Fix email link to **`/verify-magic-link?token=...`**.
   - Add **`api/auth/verify-magic-link.ts`** on Vercel that invokes the same verification logic.
   - After verification, do **not** set a custom JWT. Either:
     - Use Supabase magic link (Supabase sends the email and handles the link; your app only needs to handle the callback and call `auth.setSession`), or
     - After verifying the token, create a short-lived Supabase session (e.g. admin `generateLink` or sign-in with OTP) and redirect to `/auth/callback?access_token=...` so the cookie is a Supabase JWT.
   - In the verify handler, use **`getRootUserById(userId)`** instead of `getUserById(userId)`.

2. **Supabase Admin (server):** In `server/supabaseAdmin.ts`, use `SUPABASE_URL` first, then fallback to `VITE_SUPABASE_URL`, and document `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for production.

3. **Cleanup:** Remove `@ts-nocheck` from the auth router and fix types; consider removing or clearly deprecating `loginWithPassword`.

### 6.2 Alternative backends — Option B: How it works in detail

If you later move off Supabase Auth (Auth0, Cognito, Firebase Auth, or your own backend-only auth), you **keep the same app contract** and **swap only the token verification and user-resolution layer**. The frontend and tRPC surface can stay as they are.

- **Auth0 / Cognito / Firebase Auth:** Same pattern: frontend gets an access token (or ID token), backend verifies it and maps to your `User`. You would replace `verifySupabaseToken` / `getUserFromSupabaseToken` with that provider’s verification and user resolution, and keep the same cookie + `auth.setSession` / `auth.me` contract so the rest of the app stays unchanged.
- **Custom backend-only auth:** You could issue your own JWTs (e.g. after password or magic link verification) and verify them in `authenticateRequest`. That would require a single session model (no Supabase JWT + custom JWT mix) and either migrating existing users to the new model or supporting both during a transition.

#### The contract your app already has

1. **Frontend:** After login (password or OAuth), the client has an **access token** (today: Supabase JWT). It calls **`auth.setSession({ accessToken, rememberMe })`**; the server sets the token in the `app_session_id` cookie (or the client sends it as `Authorization: Bearer`).
2. **Backend:** On every request that needs auth, **`authenticateRequest(req)`** runs. It: reads the token from the cookie or `Authorization` header; **verifies** the token (today: Supabase JWT with `SUPABASE_JWT_SECRET`); **resolves** your app's `User` from that token (today: `getUserFromSupabaseToken` → DB/Redis by `sub` or email); puts `user` (or `null`) on the tRPC context.
3. **Rest of the app:** Procedures use `ctx.user` and `ctx.organizationId`; they do not care whether the token came from Supabase, Auth0, or your own JWT.

So "alternative backend" means: **replace step 2's "verify + resolve user"** with the new provider's equivalent. The cookie name, `auth.setSession` / `auth.me` API, and protected routes stay the same.

#### How Option B works step by step

**1. Choose the new identity provider**

- **Auth0:** User logs in via Auth0 (hosted lock or embedded); Auth0 returns an access token (JWT or opaque). Your frontend sends that token to `auth.setSession`; backend verifies it with Auth0's JWKS or Auth0 API and maps `sub` (or email) to your `User`.
- **Cognito:** Same idea: Cognito issues JWTs; frontend gets the ID token or access token after login, sends it to `auth.setSession`; backend verifies with Cognito's JWKS and resolves `User` from `sub`/claims.
- **Firebase Auth:** Frontend signs in with Firebase; gets an ID token; sends it to `auth.setSession`; backend verifies the Firebase ID token (e.g. with Firebase Admin SDK) and maps `uid`/email to your `User`.
- **Custom backend-only:** Your server is the only issuer. After password (or magic link) verification, you sign a JWT with your own secret (e.g. `cookieSecret` or a dedicated `JWT_SECRET`), put the app user id (and optionally org) in claims; backend verifies that JWT and loads `User` from DB by id. No third-party IdP.

**2. What you change in the codebase**

- **Frontend (login):** Replace Supabase login calls with the new provider's SDK (e.g. Auth0 `loginWithRedirect`, Cognito `Auth.signIn`, Firebase `signInWithEmailAndPassword`). After the provider returns a token, the frontend still calls **`trpc.auth.setSession.mutate({ accessToken: thatToken, rememberMe })`**. So the "session" in the app is still "whatever token the backend accepts"; only where the token comes from changes.
- **Backend — verification:** Replace `verifySupabaseToken` (and optionally `looksLikeSupabaseJwt`) with the new verification: Auth0/Cognito/Firebase use the provider's JWKS or SDK (e.g. `jose` with `createRemoteJWKSet(providerJwksUrl)`); extract identity (`sub`, `email`) from the payload. Custom: verify the JWT with your own secret, extract user id (and org) from claims.
- **Backend — user resolution:** Replace `getUserFromSupabaseToken` with a function that, given the verified token payload (e.g. `sub`, `email`, or your custom `userId`), loads your app's `User` from the DB (e.g. by `auth0_id`, `cognito_sub`, `firebase_uid`, or `users.id`). Optionally keep Redis cache keyed by that identity.
- **Backend — `auth.setSession`:** Today it calls `getUserFromSupabaseToken(input.accessToken)`. Change it to call your new "verify token + resolve user" function. If the new provider's token is opaque, you may need to call the provider's introspect/userinfo API in `setSession` and then resolve your `User` from that response.
- **Cookie and tRPC:** No change. Still set `app_session_id` to the token; `authenticateRequest` still reads it and runs the new verify + resolve.

**3. What stays the same**

- tRPC procedures: `auth.me`, `auth.logout`, `auth.setSession` (signature unchanged; implementation of `setSession` uses the new verifier).
- Protected procedures, `ctx.user`, `ctx.organizationId`, membership, RBAC.
- Cookie name, cookie options, and host-scoped behavior for admin/nrcseam subdomains.
- Client: `useAuth()`, redirect to login, public auth paths, DashboardLayout.

**4. Migration and coexistence**

- **Big-bang cutover:** One deploy: frontend uses new provider only; backend only has the new verifier. Migrate existing users: create identities in the new provider and link to your `User` rows (e.g. by email), or force re-sign-up.
- **Dual support during transition:** Backend can support both Supabase and the new provider: in `authenticateRequest`, try "looks like Supabase JWT" → `getUserFromSupabaseToken`; else try the new verifier. Frontend can show two login options and call the same `auth.setSession` with whichever token is returned. Once all users are migrated, remove the Supabase path.
- **Custom JWT only:** If you move to "we issue our own JWT only," use a single session model: after password or magic link, sign a JWT with your secret and set it in the cookie; no Supabase token in the same cookie. Migrate Supabase users to password or magic link in your system, or run both verifiers until migration is done.

**5. Why this works**

The app is already **provider-agnostic** at the tRPC and layout level: it only assumes "there is a token in the cookie (or header)" and "the backend can turn that into `User | null`." Option B is: implement a different "token → User" pipeline and keep the rest. Subdomains (admin/nrcseam) do not change: each host still sends its own cookie and the same backend logic runs with the same Host-based org resolution.

For the current codebase, **fixing the Supabase integration** (magic link, env, signup domain, and one DB call) is the most efficient path; switching provider (Option B) is only necessary if you have a product or compliance requirement to do so.

---

## 7. Summary table

| Area | Status | Action |
|------|--------|--------|
| Email/password + setSession | OK | None |
| Google OAuth (custom + Supabase) | OK | Ensure redirect URLs and env in sync |
| Password reset (app + Supabase) | OK | None |
| Magic link email URL | Bug | Use `/verify-magic-link?token=...` |
| Magic link verify on Vercel | Bug | Add `api/auth/verify-magic-link` serverless or use Supabase magic link |
| Magic link session type | Bug | Stop setting custom JWT; use Supabase session only |
| Magic link user lookup | Bug | Use `getRootUserById` |
| Supabase Admin server env | Risk | Prefer `SUPABASE_URL` on server; document |
| auth router types | Cleanup | Remove `@ts-nocheck`; fix types |
| Subdomains (admin/nrcseam) | OK / config | Cookies host-scoped; OAuth per host; ensure Supabase + Google redirect URLs and ALLOWED_ORIGINS include both |
| Signup domain on nrcseam | Bug | In signupDomain.ts use `nrcseam.techivano.com` not `nrcs.techivano.com` for NRCS |

---

## 8. References

- `docs/AUTHENTICATION_STABILITY_REPORT.md`
- `docs/SUPABASE_AUTH_AUDIT.md`
- `docs/AUTH_STABILIZATION_REPORT.md`
- `docs/FINAL_AUTH_POLICY.md`
- `server/_core/supabaseAuth.ts`, `server/_core/authenticateRequest.ts`, `server/routers/auth.ts`
- `client/src/pages/Login.tsx`, `client/src/pages/AuthCallback.tsx`, `client/src/pages/VerifyMagicLink.tsx`
