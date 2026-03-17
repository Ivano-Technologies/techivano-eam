# E2E and CI auth

## MFA and global owners

- **E2E auth tests**: Use an `E2E_AUTH_EMAIL` that is **not** a global owner. Global owners require MFA; the E2E suite does not automate TOTP (no /mfa/setup or /mfa/verify flows). If the test user is a global owner, the app will redirect to MFA setup and tests will fail.
- **Global owner emails** are configured in `server/_core/env.ts` (default: `kezieokpala@gmail.com`, `ivanonigeria@gmail.com`, `kezie@ivanotechnologies.com`) or via the `GLOBAL_OWNER_EMAILS` env var.
- **Optional bypass**: If you must run E2E with a global owner account, set `E2E_MFA_BYPASS=1` so that `requireMFA` middleware skips enforcement. Prefer using a non–global-owner test user.

## Session

- E2E sign-in uses password + cookie (Supabase token in `app_session_id`). Do not automate TOTP in Playwright.
