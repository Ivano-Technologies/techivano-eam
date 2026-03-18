# Techivano EAM — Complete Auth Report (Downloadable)

**Report date:** 2026-03-18  
**Scope:** Full authentication audit, subdomains (admin.techivano.com, nrcseam.techivano.com), and recommended next steps including magic link resolution, subdomain fixes, and Firebase Auth option.

---

## Part 1 — Audit Summary

### 1.1 Executive summary

The app uses **Supabase Auth** as the primary identity provider, with a custom session layer (httpOnly cookie + tRPC `auth.setSession` / `auth.me`). Email/password and Google OAuth are implemented and documented; legacy password migration and password reset are wired. Several **bugs and gaps** remain, especially for **magic link** and **Vercel deployment** of non-tRPC auth routes. Supabase Auth itself is **not inherently problematic**; the main issues are integration consistency, env usage, and one legacy flow that conflicts with the Supabase-only auth model.

### 1.2 Current architecture

| Layer | Implementation |
|-------|----------------|
| **Identity** | Supabase Auth (email/password, Google OAuth, optional Azure) |
| **Session** | `app_session_id` cookie = Supabase access token (JWT); optional `SESSION_COOKIE_NAME` for server-side session row (revocable) |
| **API auth** | `authenticateRequest()` → cookie or `Authorization: Bearer` → `verifySupabaseToken()` → `getUserFromSupabaseToken()` → DB/Redis user |
| **Protected routes** | `DashboardLayout` + `useAuth()` (trpc.auth.me); public auth paths skip skeleton |
| **Backend** | Express (dev) + Vercel serverless (`api/trpc/[...path].ts`, `api/auth/google`, `api/auth/google/callback`) |

### 1.3 Bugs and issues (concise)

| Issue | Location | Impact |
|-------|----------|--------|
| Magic link email URL wrong | `server/magicLinkAuth.ts` | Link points to `/auth/verify`; app route is `/verify-magic-link` |
| Magic link verify 404 on Vercel | No `api/auth/verify-magic-link` | POST verify returns 404 in production |
| Magic link sets custom JWT | `server/_core/magicLinkVerification.ts` | Cookie is not Supabase JWT; auth never succeeds after magic link |
| Magic link uses tenant DB | `magicLinkVerification.ts` → `getUserById` | Should use `getRootUserById` for pre-tenant context |
| Supabase Admin env on server | `server/supabaseAdmin.ts` | Uses `VITE_SUPABASE_URL`; serverless may not have it |
| Signup domain NRCS host wrong | `server/_core/signupDomain.ts` | Was `nrcs.techivano.com`; fixed to `nrcseam.techivano.com` |
| CORS / ALLOWED_ORIGINS | Env / Express | Must include both subdomains for production |
| auth router `@ts-nocheck` | `server/routers/auth.ts` | Weakens type safety |

### 1.4 What is working

- Email/password login and legacy migration; Google OAuth (custom + Supabase host); password reset (app DB + Supabase).
- Session persistence (cookie + `auth.me`); protected routes and public auth paths; Vercel tRPC; MFA and impersonation.
- Subdomains: host → app variant and org; cookies host-scoped; OAuth redirect per host; login URL and branding from `window.location.origin`.

### 1.5 Is Supabase Auth problematic?

**No.** Issues are integration and env usage, not Supabase itself. Fixing magic link, env, and signup domain is the most efficient path.

---

## Part 2 — Subdomains: admin.techivano.com and nrcseam.techivano.com

### 2.1 What works

- **Host → app variant and org:** `server/_core/context.ts` resolves `appVariant` and `organizationId` from host for both Express and Vercel tRPC.
- **Cookies host-scoped:** No `domain` set on auth cookie; sessions do not leak between admin and nrcseam.
- **OAuth per host:** Custom Google builds `redirectUri` from request host; callback uses `parsedState.origin` to redirect back to same host.
- **Branding and login URL:** `getLoginUrl()` and `useAuthBranding` use current origin/host.

### 2.2 Subdomain checklist (configuration)

| Item | admin.techivano.com | nrcseam.techivano.com |
|------|---------------------|------------------------|
| Vercel domain | Add in project | Add in project |
| Supabase redirect URLs | `https://admin.techivano.com`, `https://admin.techivano.com/auth/callback` | `https://nrcseam.techivano.com`, `https://nrcseam.techivano.com/auth/callback` |
| Google Cloud redirect URIs | `https://admin.techivano.com/api/auth/google/callback` | `https://nrcseam.techivano.com/api/auth/google/callback` |
| ALLOWED_ORIGINS | Include | Include |
| ENV | `HOST_ORG_ADMIN`, `ALLOWED_DOMAINS_ADMIN` | `HOST_ORG_NRCS`, `ALLOWED_DOMAINS_NRCS` |

### 2.3 E2E

Set `E2E_BASE_URL=https://admin.techivano.com` or `https://nrcseam.techivano.com` when running Playwright so tests hit the EAM app, not the apex marketing page. Example: `E2E_BASE_URL=https://nrcseam.techivano.com E2E_AUTH_EMAIL=... E2E_AUTH_PASSWORD=... pnpm test:e2e:auth`.

### 2.4 Subdomain deployment (Vercel and Supabase)

- **ALLOWED_ORIGINS:** In Vercel Project Settings → Environment Variables (Production and Preview as needed), set `ALLOWED_ORIGINS=https://admin.techivano.com,https://nrcseam.techivano.com` (and `https://techivano.com` if the apex calls the API) so browser requests from both subdomains are allowed.
- **Supabase redirect URLs:** Run `pnpm tsx scripts/supabase-add-redirect-urls.ts` (with `SUPABASE_ACCESS_TOKEN` or `supabase login` and `SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL` set). Then in Supabase Dashboard → Authentication → URL configuration, confirm both hosts and their `/auth/callback` URLs appear.

---

## Part 3 — Recommended next steps

### 3.1 Magic link: setup and issue resolution

**Priority 1 — Fix link and verification (required for magic link to work)**

1. **Fix email link URL**  
   - File: `server/magicLinkAuth.ts`  
   - Change: `const magicLink = \`${BASE_URL}/auth/verify?token=${token}\`;`  
   - To: `const magicLink = \`${BASE_URL}/verify-magic-link?token=${token}\`;`

2. **Use root user lookup in verification**  
   - File: `server/_core/magicLinkVerification.ts`  
   - Change: `db.getUserById(userId)`  
   - To: `db.getRootUserById(userId)`  
   - Reason: No tenant context at magic link verify; root DB is correct.

3. **Choose one session model (no custom JWT in same cookie)**  
   - **Option A — Supabase magic link only (recommended):**  
     - Remove or deprecate app magic link.  
     - Use Supabase Auth “Magic Link” (email link); Supabase redirects to your app with token/code.  
     - Handle in existing `/auth/callback` and call `auth.setSession(accessToken)` so the cookie is always a Supabase JWT.  
     - No new serverless route; one session model.  
   - **Option B — Keep app magic link:**  
     - Add Vercel serverless route: `api/auth/verify-magic-link.ts` that runs the same verification handler.  
     - After verifying the token, do **not** set a custom JWT. Instead: obtain a Supabase session (e.g. Supabase Admin `generateLink` for magic link, or Supabase “Email OTP”) and redirect to `/auth/callback?access_token=...` so the client runs `auth.setSession` with the Supabase token.  
     - Ensure verify handler uses `getRootUserById` and that the “create Supabase session” step is implemented so the cookie is a Supabase JWT.

**Priority 2 — If keeping custom magic link on Vercel**

4. **Add serverless route**  
   - Create `api/auth/verify-magic-link.ts` (or equivalent) that imports and calls the same logic as Express `app.post("/api/auth/verify-magic-link", ...)`.  
   - Ensure the handler returns JSON and sets the correct redirect/response so the client can complete login (e.g. redirect to `/auth/callback?access_token=...` after creating a Supabase session as in Option B above).

**Summary:** Fix link URL and `getRootUserById` in all cases. Then either move to Supabase-only magic link (Option A) or add the Vercel route and Supabase-session handoff (Option B). Do not keep setting a custom JWT in `app_session_id`.

---

### 3.2 Subdomain-linked issues: fixes

**Done**

- **Signup domain for NRCS:** In `server/_core/signupDomain.ts`, the NRCS host is now `nrcseam.techivano.com` (not `nrcs.techivano.com`). Signups on nrcseam use `ENV.allowedDomainsNrcs`.

**To do**

1. **CORS / ALLOWED_ORIGINS (production)**  
   - In Vercel (or your server env), set:  
     `ALLOWED_ORIGINS=https://admin.techivano.com,https://nrcseam.techivano.com`  
   - Add `https://techivano.com` if the apex also calls the API.  
   - Ensures browser requests from both subdomains are allowed.

2. **Supabase Dashboard**  
   - Auth → URL configuration: add Site URL and Redirect URLs for both subdomains (see checklist in Part 2).  
   - Run `scripts/supabase-add-redirect-urls.ts` if you use it, and confirm both hosts are present in the Dashboard.

3. **Google Cloud Console**  
   - Add both callback URIs:  
     `https://admin.techivano.com/api/auth/google/callback`  
     `https://nrcseam.techivano.com/api/auth/google/callback`  
   - So custom Google OAuth works on both hosts.

4. **Server env (Supabase Admin)**  
   - In `server/supabaseAdmin.ts`, prefer server env:  
     `process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL`  
   - In production (Vercel), set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so serverless functions do not depend on `VITE_*`.

5. **E2E**  
   - For auth E2E against a subdomain, set `E2E_BASE_URL` to the subdomain you want to test (e.g. `https://nrcseam.techivano.com`).

---

### 3.3 Using Firebase for the auth backend

If you decide to use **Firebase Authentication** for all auth (email/password, OAuth, magic link), the app’s contract stays the same: frontend gets a token, calls `auth.setSession`, backend verifies and resolves `User`. Only the “verify + resolve user” layer changes.

**Why consider Firebase**

- Single provider for email/password, Google (and other IdPs), and magic link / email link.
- Firebase Auth handles email links and token issuance; your app only handles the callback and sets the cookie.
- Good fit if you already use or plan to use Firebase (e.g. Firestore, Cloud Functions) or want a managed auth service with strong SDK support.

**How it would work**

1. **Frontend**  
   - Use Firebase JS SDK: `signInWithEmailAndPassword`, `signInWithPopup` (Google), or `sendSignInLinkToEmail` + `isSignInWithEmailLink` for magic link.  
   - After sign-in, get the ID token: `const token = await user.getIdToken();`  
   - Call `trpc.auth.setSession.mutate({ accessToken: token, rememberMe });` (unchanged).  
   - For email link: open link on same device; `isSignInWithEmailLink` + `signInWithEmailLink`; then `getIdToken()` and `setSession` as above.

2. **Backend**  
   - Install Firebase Admin SDK (e.g. `firebase-admin`).  
   - Replace `verifySupabaseToken` with Firebase ID token verification:  
     `admin.auth().verifyIdToken(accessToken)`  
   - Extract `uid` (and optionally `email`) from the decoded token.  
   - Replace `getUserFromSupabaseToken` with a function that loads your app `User` by `firebase_uid` (add a column or use existing mapping table). Optionally cache by `uid` in Redis.  
   - In `auth.setSession`, after verifying the Firebase token and resolving `User`, set the same `app_session_id` cookie with the Firebase ID token (or a short-lived app-issued token; if you keep Firebase token in cookie, backend only needs to verify Firebase token).  
   - Remove or bypass Supabase-specific code (Supabase client, `getUserFromSupabaseToken`, legacy migration that creates Supabase users).

3. **Subdomains**  
   - No change: cookies remain host-scoped; Firebase does not care about host.  
   - In Firebase Console, add authorized domains: `admin.techivano.com`, `nrcseam.techivano.com`, and your apex if needed.  
   - Email action links (e.g. magic link) must use the correct subdomain in the link URL (Firebase allows you to configure action URL or you build it from request host).

4. **Migration from Supabase**  
   - **Dual support (recommended during transition):** In `authenticateRequest`, try Supabase JWT first (`looksLikeSupabaseJwt` → `getUserFromSupabaseToken`); if that fails, try Firebase `verifyIdToken` and resolve user by `firebase_uid`.  
   - Migrate users: create Firebase users (e.g. by email) and set `firebase_uid` on your `User` rows; or run both providers until all users have logged in once with Firebase.  
   - After migration, remove Supabase verification and Supabase-specific auth routes (e.g. custom Google callback that uses Supabase); use Firebase-only on frontend and backend.

5. **What stays the same**  
   - Cookie name, `auth.setSession` / `auth.me` / `auth.logout` API, protected procedures, RBAC, `ctx.user`, `ctx.organizationId`, host-based org resolution, and client `useAuth()` / redirects.  
   - Only the implementation of “token → User” and the login UI (Firebase SDK instead of Supabase SDK) change.

**Recommendation**

- If you are satisfied with Supabase after fixing the listed issues, **staying on Supabase** is the smallest change.  
- If you prefer a single provider for magic link and OAuth, or want to standardize on Firebase, **moving to Firebase Auth** is feasible by swapping the verify + user-resolution layer and adding Firebase authorized domains for both subdomains; the rest of the app can remain as-is.

---

## Part 4 — Summary and action table

| Area | Status | Recommended action |
|------|--------|---------------------|
| Magic link email URL | Bug | Set link to `/verify-magic-link?token=...` in `magicLinkAuth.ts` |
| Magic link verify on Vercel | Bug | Use Supabase magic link only, or add `api/auth/verify-magic-link` + Supabase session handoff |
| Magic link session type | Bug | Do not set custom JWT; use Supabase (or Firebase) token only |
| Magic link user lookup | Bug | Use `getRootUserById` in magic link verification |
| Supabase Admin server env | Risk | Prefer `SUPABASE_URL` on server; set in Vercel |
| Signup domain nrcseam | Fixed | Host check is `nrcseam.techivano.com` |
| Subdomains CORS | Config | Set `ALLOWED_ORIGINS` to include both subdomains |
| Subdomains Supabase/Google | Config | Add both hosts to redirect URLs in Supabase and Google Console |
| Firebase as auth backend | Option | Use Firebase ID token in cookie; verify with Admin SDK; resolve user by `firebase_uid`; add authorized domains for both subdomains |

---

## Part 5 — References (in repo)

- `docs/AUTHENTICATION_STABILITY_REPORT.md`
- `docs/SUPABASE_AUTH_AUDIT.md`
- `docs/AUTH_STABILIZATION_REPORT.md`
- `docs/FINAL_AUTH_POLICY.md`
- `docs/SUBDOMAIN_CLI_STEPS.md`
- `server/_core/supabaseAuth.ts`, `server/_core/authenticateRequest.ts`, `server/routers/auth.ts`
- `client/src/pages/Login.tsx`, `client/src/pages/AuthCallback.tsx`, `client/src/pages/VerifyMagicLink.tsx`
- `scripts/supabase-add-redirect-urls.ts`

---

*End of report. Save or download this file as needed.*
