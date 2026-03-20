# Auth Architecture

Supabase is the only authentication provider in this codebase.

## Principles

- Single source of truth: Supabase JWT session (`app_session_id`) is required for authenticated API access.
- No mixed providers: Clerk/Auth0/Firebase auth SDKs are forbidden by policy and CI checks.
- No token leakage: access and refresh tokens are never appended to URLs or returned in API payloads.
- Serverless-first runtime: auth endpoints and protected APIs run from `api/*` handlers.

## End-to-End Flow

1. User signs in from the frontend (email/password, magic link, or Google OAuth) via Supabase.
2. OAuth callback/magic-link verification lands in serverless auth handlers under `api/auth/*`.
3. The backend sets secure cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
4. Protected routes read `Authorization: Bearer` or `app_session_id` cookie and validate Supabase JWT.
5. User resolution and org/tenant context are derived server-side before procedures execute.

## Security Controls

- `server/_core/authenticateRequest.ts` performs centralized auth checks.
- `server/_core/supabaseAuth.ts` verifies JWTs (HS256 secret and JWKS fallback).
- `api/auth/google/callback.ts` blocks test mock paths outside test mode.
- CI runs `pnpm check:serverless-compliance` to prevent auth/provider drift.

## Test-Only Auth Rules

- Test OAuth mock path requires both:
  - `NODE_ENV === "test"`
  - `ENABLE_TEST_AUTH === "true"` plus `OAUTH_E2E_MOCK=1`
- Any attempt to execute test OAuth mock logic in production throws an error.

## Operational Notes

- Configure Supabase redirect URLs for both production and localhost callback routes.
- Keep `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` aligned across environments.
- Use serverless auth/API tests (`test:api:routes`, `test:e2e:serverless`) as deploy gates.
