# Supabase Auth Setup — Best Practice (Vite + React)

This guide summarizes the recommended way to set up Supabase Auth for a **client-side React (Vite) app**: secure, efficient, and consistent with [Supabase’s React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) and community advice (e.g. [r/Supabase: Vite + React](https://www.reddit.com/r/Supabase/comments/1ef0iuo/set_up_using_supabase_auth_with_vite_reactjs/)).

---

## 1. Use `supabase-js` (not SSR package)

- **Vite + React SPA:** Use **`@supabase/supabase-js`** and create the client with your project URL and **anon** (or publishable) key.
- **Do not** use `@supabase/ssr` for a purely client-rendered app; that package is for server-side rendering (Next.js, SvelteKit, etc.).
- Create a single client instance (e.g. in `client/src/lib/supabase.ts`) and import it where needed.

```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

## 2. Environment variables

In **`.env.local`** (or `.env`), define:

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Client (Vite) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client (Vite) | Public anon key for browser |
| `SUPABASE_URL` | Server | Same project URL (for server-side verification) |
| `SUPABASE_ANON_KEY` | Server | Same anon key |
| `SUPABASE_JWT_SECRET` | Server only | JWT secret from Dashboard → Project Settings → API → JWT Settings. **Required** so the backend can verify Supabase tokens and set the app session. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | For admin operations; never expose to client. |

Never expose `SUPABASE_JWT_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` to the client. Get the JWT secret from the [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API** → **JWT Settings**.

---

## 3. Session handling: secure and efficient

- **Do not** store the Supabase access token in `localStorage` in plain form if you can avoid it; it’s long-lived and sensitive. Prefer:
  - Sending the token to your backend once after sign-in; the backend verifies it with `SUPABASE_JWT_SECRET` and sets an **httpOnly, secure, sameSite** cookie for the app session. The frontend then relies on that cookie for API calls.
- Supabase’s default persistence (e.g. localStorage) is still used by the Supabase client for its own session; the “best practice” here is to **additionally** hand the token to your API so the app has a single, secure session cookie (as in this repo: `auth.setSession` tRPC mutation).
- For **security**: Use httpOnly cookies for the app session, enforce HTTPS in production, and set `sameSite: "lax"` (or `"strict"` where appropriate).

---

## 4. Redirect URLs (Supabase Dashboard)

In **Supabase Dashboard** → **Authentication** → **URL Configuration** → **Redirect URLs**, add:

- Production: `https://yourdomain.com/**` (e.g. `https://techivano.com/**`)
- Local: `http://localhost:3000/**` (and `http://localhost:3001/**` if you use that port)

Supabase will only redirect to these URLs after sign-in, OAuth, or magic link. Without this, auth flows will fail.

---

## 5. Auth flows (sign up, sign in, reset)

- **Sign up:** `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`. If email confirmation is enabled, user confirms via the link sent by Supabase.
- **Sign in:** `supabase.auth.signInWithPassword({ email, password })`. On success, send the `session.access_token` to your backend (e.g. `auth.setSession`); backend verifies with `SUPABASE_JWT_SECRET` and sets the app cookie.
- **Magic link:** `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`. Redirect to a route like `/auth/callback` that exchanges the code/hash for a session and then calls your backend to set the app session.
- **Password reset:**  
  - **Request reset:** `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://yourdomain.com/reset-password' })`.  
  - **Change password (after user clicks link):** On the reset page, use `supabase.auth.updateUser({ password: newPassword })` when the user lands with a valid recovery link.  
  Alternatively, use your backend’s reset flow (token in email, verify on server, update password in DB); ensure the reset link and token are not logged or exposed.

Use a **single callback route** (e.g. `/auth/callback`) to handle OAuth and magic-link redirects: read `code` or `access_token` from the URL, exchange or use the session, then call your backend to set the app cookie and redirect to `/`.

---

## 6. Auth UI: consistent and accessible

- Use a **shared layout** for all auth pages (login, signup, forgot-password, reset-password, auth/callback) so branding and structure are consistent.
- Prefer **glass-style cards** and a clear visual hierarchy; keep forms simple and labels/errors visible.
- **Loading states:** Disable submit and show a spinner or “Processing…” during sign-in/sign-up and when calling `auth.setSession`.
- **Errors:** Show Supabase error messages in an alert or inline; avoid exposing raw tokens or stack traces.
- **Security:** Minimum password length 8 characters; optional strength indicator; link to terms and privacy on signup.

---

## 7. Summary

| Topic | Recommendation |
|-------|----------------|
| Client library | `@supabase/supabase-js` for Vite + React SPA |
| Session | Backend verifies Supabase JWT, sets httpOnly cookie; frontend uses that cookie for API calls |
| Env vars | `VITE_SUPABASE_*` for client; `SUPABASE_JWT_SECRET` (and optionally service role) for server only |
| Redirect URLs | Configure in Supabase Dashboard for each environment (prod + localhost) |
| Auth UI | Shared layout, glass card, loading/error states, 8+ char passwords |

For full migration details and backend wiring, see [SUPABASE_AUTH_MIGRATION_PLAN.md](./SUPABASE_AUTH_MIGRATION_PLAN.md).
