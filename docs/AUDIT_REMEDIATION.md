# NRCS EAM Audit Remediation (March 2026)

This document tracks remediation of findings from the **NRCS EAM System — Comprehensive Audit Report** (Manus AI, March 11, 2026).

## Sprint 1 (Critical) — Completed in codebase

| Finding | Action |
|--------|--------|
| **CRITICAL-7** Password minimum 6 chars | Raised to **8 characters** in `server/routers.ts` (signup, resetPassword), `client/src/pages/Signup.tsx`, `client/src/pages/ResetPassword.tsx`, and `server/auth.passwordReset.test.ts`. |
| **CRITICAL-6** Password reset email not sent | Implemented: `auth.requestPasswordReset` now calls `sendEmail()` with reset link. Removed `console.log` of the link. Uses `ENV.appUrl` for the reset URL. If email send fails (e.g. Forge not configured), a warning is logged via pino; user still sees the same success message. |
| **HIGH-10** VITE_APP_URL not in env | Added **`ENV.appUrl`** in `server/_core/env.ts` (from `VITE_APP_URL` or `VERCEL_URL`). Used in password reset, `server/magicLinkAuth.ts`, and `server/qrcode.ts` for magic link and QR code base URLs. |
| **MEDIUM-12** Password reset link logged to console | Removed; no sensitive data is logged. |

## Sprint 1 (Critical) — Pending / Manual

| Finding | Notes |
|--------|--------|
| **CRITICAL-1** No RLS on Supabase | This repo uses **Drizzle + PostgreSQL**; Supabase migrations under `supabase/migrations/` include RLS-related files (e.g. `20260309190000_rls_optimize_auth_uid.sql`, `20260309200000_rls_policies_audit.sql`). If the audit referred to a separate Supabase project with `eam_*` tables, RLS must be enabled and policies added there. See `docs/RLS_SERVER_ONLY_TABLES.md` and existing migrations. |
| **CRITICAL-2** eam_quickbooksConfig missing columns | **Drizzle schema** (`drizzle/schema.ts`) already defines `redirectUri`, `realmId`, `isActive`, `autoSync` for `quickbooksConfig`. If a separate Supabase migration (e.g. `002_eam_prefix_schema.sql`) exists elsewhere, align that migration with the Drizzle schema. |

## Sprint 2 (High) — Completed

| Finding | Action |
|--------|--------|
| **HIGH-9** No rate limiting on auth | Added **express-rate-limit** for `/api/trpc`: 100 requests per 15 minutes per IP. Applied in `server/_core/index.ts` before the tRPC middleware. |

## Sprint 2 (High) — Pending

- **HIGH-3** Schema drift (6 tables): Add missing tables to PostgreSQL/Supabase schema.
- **HIGH-4** Foreign key constraints: Apply or add FK migration.
- **HIGH-8** Email domain whitelist: Restrict to official domains + admin override.
- **HIGH-11** Split `routers.ts` (2,437 lines) into feature sub-routers.
- **HIGH-14** Fix 7 failing tests (seed fixtures, Supabase test env).
- **HIGH-20/21** Phase 70 email setup: SMTP/config and template UI.

## Sprint 3–4 (Medium / Low)

See the full audit report for MEDIUM-5 (duplicate migration 0021), MEDIUM-15 (alt attributes — already present on DashboardLayout images), MEDIUM-16–19, MEDIUM-23–24, LOW-25, LOW-28.

---

*Last updated: March 2026.*
