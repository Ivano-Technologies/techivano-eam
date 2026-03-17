# Platform Stabilization Summary

**Date:** 2026-03-16  
**Goal:** Production-grade best practices for auth, env, domain routing, API security, and CI/CD.

---

## Changes applied

### 1. Secure authentication flows

- **Removed debug instrumentation:** Client-side and server-side fetch calls to the debug ingest endpoint were removed from `Login.tsx` and `auth.ts` (no production traffic to debug servers).
- **Cookies:** Already production-ready (`httpOnly`, `secure` in production, `sameSite: lax`) in `server/_core/cookies.ts`.
- **Rate limiting:** Already in place on `/api/trpc` (100 requests / 15 min per IP); applies to auth procedures.

### 2. Stable environment configuration

- **Startup validation:** `server/_core/envValidation.ts` runs in production and logs a warning if any of `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are missing or empty. Does not block startup.
- **.env.example:** Documented `ALLOWED_ORIGINS` for CORS in production.

### 3. Domain routing and API security

- **CORS:** Middleware added in `server/_core/index.ts`. In development, the request `Origin` is reflected. In production, only origins listed in `ALLOWED_ORIGINS` (or `VITE_APP_URL` if single origin) are allowed; if neither is set, same-origin only. Credentials and common headers/methods allowed.
- **API 404:** Unmatched `/api/*` requests now return `404` with JSON `{ "error": "Not found" }` instead of falling through to the SPA.
- **Global error handler:** Express 4-arg error middleware added. Catches errors passed to `next(err)` and returns JSON; in production the message is generic ("Internal server error"); in development the error message is returned.

### 4. CI/CD reliability

- **CI:** No code change. Existing workflow (typecheck → test:ci → build) remains the gate. See `docs/DEPLOYMENT_CHECKLIST.md` for deployment and verification steps.

### 5. Documentation

- **DEPLOYMENT_CHECKLIST.md:** Checklist for env vars, auth, domain, API security, CI/CD, and post-deploy verification.
- **.env.example:** Comment for `ALLOWED_ORIGINS`.

---

## Files modified

| File | Change |
|------|--------|
| `client/src/pages/Login.tsx` | Removed debug fetch calls |
| `server/routers/auth.ts` | Removed debug fetch calls |
| `server/_core/index.ts` | CORS middleware, API 404 handler, global error handler, `validateProductionEnv()` |
| `server/_core/envValidation.ts` | New: production env validation |
| `.env.example` | `ALLOWED_ORIGINS` comment |
| `docs/DEPLOYMENT_CHECKLIST.md` | New: deployment checklist |
| `docs/STABILIZATION_SUMMARY.md` | This file |

---

## Optional next steps

- **Auth rate limit:** Add a stricter rate limit (e.g. 10/15 min) for `auth.setSession`, `auth.migrateLegacyPasswordUser`, and `auth.requestPasswordReset` via tRPC middleware or a dedicated Express route.
- **Vercel serverless:** If using Vercel, ensure `api/trpc/[...path].ts` and `api/auth/google*` load `.env.local` (already done) and that `ALLOWED_ORIGINS` is set in Vercel env when using a separate API domain.
