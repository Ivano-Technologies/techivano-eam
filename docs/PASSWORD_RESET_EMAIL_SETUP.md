# Password Reset Link — Email Setup Confirmation

The **Send Password Reset Link** flow is wired end-to-end. For the reset email to be sent, an email transport must be configured.

## Flow (already implemented)

1. **Frontend** (`client/src/pages/ForgotPassword.tsx`)
   - User enters email and submits.
   - Calls `trpc.auth.requestPasswordReset.mutate({ email })`.

2. **Backend** (`server/routers/auth.ts` → `requestPasswordReset`)
   - Validates email.
   - Calls `generateResetToken(email)` (finds user in app `users` table, creates token in `password_reset_tokens`, 15‑min expiry).
   - Builds link: `ENV.appUrl + "/reset-password?token=" + token`.
   - Renders HTML via `renderPasswordResetEmail(resetLink)` (`server/emailTemplates.ts`).
   - Calls `sendEmail({ to, subject: "Reset your NRCS EAM password", html })`.
   - Always returns the same success message (no “user not found” leak).

3. **Email sending** (`server/emailService.ts`)
   - **Option A — Forge (Manus):** if `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are set, sends via Forge API.
   - **Option B — SMTP:** if `SMTP_HOST` is set, sends via nodemailer using SMTP (port, user, pass, from).
   - If neither is set, logs a warning and does not send (UI still shows success).

4. **Reset link**
   - Link target is `ENV.appUrl` (see below). Set this correctly for production (e.g. `https://techivano.com`) so the link opens your app.

## Required environment variables

**At least one** of the following must be configured for emails to be sent:

### Option A — Forge (Manus)

- `BUILT_IN_FORGE_API_URL` — Forge email API base URL (from Manus dashboard).
- `BUILT_IN_FORGE_API_KEY` — Forge API key.

### Option B — SMTP

- `SMTP_HOST` — SMTP server host (e.g. SendGrid, Mailgun, or your SMTP server).
- `SMTP_PORT` — Optional; default `587`.
- `SMTP_USER` / `SMTP_PASS` — If your SMTP server requires auth.
- `EMAIL_FROM` — Sender address (defaults to `SMTP_USER` or `noreply@nrcs.org.ng`).

### Reset link base URL

- **Production:** set `VITE_APP_URL` (or `VERCEL_URL` is used on Vercel) so the reset link uses your real domain (e.g. `https://techivano.com`).
- **Local:** defaults to `http://localhost:3000` if not set.

## Quick check

- **Code:** Request → `generateResetToken` → `sendEmail` → same success response. No code change needed for “setup”; only env is required.
- **Env:** Ensure either Forge or SMTP vars are set and (for production) `VITE_APP_URL` (or equivalent) points to your app URL.
- **User lookup:** Reset token is created only if the email exists in the **app** `users` table (same DB as signup). If you use Supabase Auth for login, ensure users are also present in the app `users` table (e.g. via provisioning after first Supabase sign-in) so they can receive reset emails.

## Summary

Send Password Reset Link is correctly set up with the email flow. Configure either Forge or SMTP (and the app URL for production) and the reset email will be sent when a user requests a reset and has an account in the app `users` table.
