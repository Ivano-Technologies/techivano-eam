# Clerk vs Supabase Auth — assessment for EAM

## Could auth issues be easily resolved by switching to Clerk?

**Short answer: No. Switching would not be “easy” and is not required to fix current auth issues.**

### Current auth issues

- **Magic link:** “Invalid or expired session token” after callback is usually due to server-side JWT verification (e.g. `SUPABASE_JWT_SECRET` / JWKS) or user resolution in `auth.setSession`, not Supabase Auth itself. Email/password and OAuth already work when env and DB are correct.
- **Session:** App stores the Supabase access token in `app_session_id` and verifies it with `SUPABASE_JWT_SECRET` (and JWKS fallback). Fixing secret/issuer and user provisioning is a configuration and code fix, not a provider change.

### What switching to Clerk would involve

| Area | Effort | Notes |
|------|--------|--------|
| **Client** | High | Replace all Supabase Auth usage (`signInWithPassword`, `signInWithOtp`, `signInWithOAuth`, `getSession`, `refreshSession`) with Clerk’s `useAuth`, `signIn`, `signUp`, etc. Login, signup, callback, MFA, and session refresh flows would need to be rewritten. |
| **Server** | High | Replace `authenticateRequest` (Supabase JWT → user) with Clerk’s backend verification (e.g. `getAuth` from `@clerk/backend`). tRPC context would use Clerk’s `userId` and then resolve app `User` from your DB (you’d still need a `users` table and mapping from Clerk user id to app user). |
| **Database** | Medium | Keep `users` (and related) but add a Clerk user id column (or equivalent) and migration. Remove or repurpose `supabase_user_id`. No need to remove Supabase entirely if you still use it for DB/RLS. |
| **Signup / MFA / OAuth** | Medium | Reimplement with Clerk’s APIs (sign-up, MFA, social providers). Domain allowlist and “pending approval” can stay in your app logic. |
| **E2E / CI** | Medium | Replace E2E auth (e.g. dev-login + Supabase) with Clerk testing (e.g. Clerk’s testing tokens or test users). |

So you’d be doing a **full auth provider migration**: new SDK on client and server, new session shape, new env vars (Clerk keys), and updated tests. That’s a multi-day (or multi-sprint) change, not a quick fix.

### When Clerk might be worth it

- You want a single vendor for auth UI, MFA, orgs, and user management and are willing to migrate.
- You’re starting a new app and prefer Clerk’s DX and hosted UIs.
- Supabase Auth is being phased out for other reasons (e.g. moving off Supabase entirely).

### Recommendation

- **For resolving current auth issues:** Fix the existing setup: ensure `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (and optionally JWKS), and `SUPABASE_ANON_KEY` are set correctly on the server; ensure users are provisioned in your DB so `getUserFromSupabaseToken` returns a user after magic link or OAuth callback. Prefer **email/password** and **OAuth** for MVP; treat magic link as optional or fix callback/JWT verification.
- **For considering Clerk later:** Treat it as a separate “auth migration” project: plan it, estimate effort (client + server + DB + E2E), and do it when you have capacity, not as a workaround for the current “invalid token” behavior.
