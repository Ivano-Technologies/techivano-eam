# Final Auth Policy (Techivano EAM)

**Policy:** Email/password is the **required** baseline; Google OAuth is **optional** for preferred UX. Every account should have password capability for recovery, CI, and admin control.

See also: [SUPABASE_AUTH_MIGRATION_PLAN.md](./SUPABASE_AUTH_MIGRATION_PLAN.md), [AUTHENTICATION_STABILITY_REPORT.md](./AUTHENTICATION_STABILITY_REPORT.md).

---

## 1. Supabase configuration (do this first)

Configure in **Supabase Dashboard** before relying on auth in production.

### Auth → Providers

| Provider        | Status    |
|----------------|-----------|
| **Email**      | **Enabled** (required) |
| **Google**     | **Enabled** (optional, preferred UX) |

### Auth → URL Configuration

- **Site URL:** `https://techivano.com`
- **Redirect URLs** (add all that apply):
  - `https://techivano.com/auth/callback`
  - `http://localhost:5173/auth/callback`
  - `http://localhost:3000/auth/callback`
  - If using subdomains (see [scripts/supabase-add-redirect-urls.ts](../scripts/supabase-add-redirect-urls.ts)):  
    `https://admin.techivano.com/auth/callback`, `https://nrcseam.techivano.com/auth/callback`

### Auth settings (recommended)

- **Email confirmation:** ON
- **Rate limiting:** ON

### Project Settings → API → JWT Settings

- Copy **JWT Secret** into server env as `SUPABASE_JWT_SECRET`.
- Optional: set `SUPABASE_JWT_ISSUER` and `SUPABASE_JWT_AUDIENCE` for stricter validation.

---

## 2. Backend enforcement

**Never trust the frontend auth method.** All authorization is based on:

- Server-verified **Supabase JWT** (cookie or `Authorization: Bearer`)
- Resolved **user** and **organization** from context
- **RBAC** from `organization_members` (and global owner overrides)

The backend always validates the request via Supabase JWT and applies RBAC; it does not rely on the client saying how the user signed in (password vs OAuth).

---

## 3. Common mistake to avoid

**Do not** assume “Google users don’t need passwords.”

- Enforce or encourage **password setup after OAuth** (e.g. prompt on first OAuth login to set a password).
- For **global owner accounts**, require password access and stronger passwords (12+ chars).
- Avoiding this keeps recovery, admin access, and CI (E2E with email/password) reliable.

---

## 4. Future upgrade path

- **MFA:** Require MFA for global owner accounts; optional for admins.
- **Session policies:** Auto-expire idle sessions; device/session tracking.

No code changes in the current phase; document when you implement.

---

## 5. Quick reference

| Item                    | Location / note |
|-------------------------|-----------------|
| Login (Google + email)  | `client/src/pages/Login.tsx` |
| Auth callback           | `client/src/pages/AuthCallback.tsx` |
| Set password (OAuth)    | `client/src/pages/SetPassword.tsx` |
| Backend auth            | `server/_core/authenticateRequest.ts`, `server/_core/supabaseAuth.ts` |
| RBAC / membership       | `server/_core/getMembership.ts`, `organization_members` |
| Global owner emails     | Env: `GLOBAL_OWNER_EMAILS` (see `.env.example`) |
