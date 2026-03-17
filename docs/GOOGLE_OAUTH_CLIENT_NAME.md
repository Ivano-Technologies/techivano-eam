# "Continue to EAM" on Google Sign-in

Google’s account chooser shows **“to continue to &lt;X&gt;”**. With Supabase’s built-in Google provider, &lt;X&gt; is your Supabase project URL (e.g. `itzigdbbkkwmnaitlqfy.supabase.co`). To show **“continue to EAM”** for all tenants with a **single** Google OAuth client, use the app’s custom OAuth flow.

## How it works

1. **One Google OAuth client**  
   In Google Cloud you create **one** OAuth 2.0 Client (Web application) and set the **Application name** to **“EAM”** on the OAuth consent screen. Google will then show “continue to **EAM**” for both nrcseam.techivano.com and admin.techivano.com (and any other host you add to redirect URIs).

2. **Custom flow**  
   - User clicks “Continue with Google” on any tenant (e.g. nrcseam.techivano.com or admin.techivano.com).  
   - App redirects to **your** backend: `/api/auth/google`.  
   - Backend redirects to **Google** with your single `client_id` and `redirect_uri = https://<current-host>/api/auth/google/callback`.  
   - User signs in at Google and sees “continue to **EAM**”.  
   - Google redirects to your `/api/auth/google/callback` with a `code`.  
   - Backend exchanges the code for a Google **ID token**, then calls **Supabase** `signInWithIdToken({ provider: 'google', token })` to create a session.  
   - Backend redirects to your frontend `/auth/callback` with the Supabase tokens; the app sets the session cookie as usual.

3. **When custom flow is used**  
   The app uses this flow when **GOOGLE_OAUTH_CLIENT_ID** (and **GOOGLE_OAUTH_CLIENT_SECRET**) are set. If they are not set, “Continue with Google” uses Supabase’s built-in provider and Google will show the Supabase project URL.

## Google Cloud setup (one client)

1. In [Google Cloud Console](https://console.cloud.google.com/), use one project (or create one).
2. **APIs & Services → OAuth consent screen**  
   - **User type:** External (or Internal for workspace-only).  
   - **App name:** **EAM** (this is the “continue to” text).  
   - Set **User support email** and **Developer contact**.  
   - **Authorized domains:** add your app domain (e.g. `techivano.com`).
3. **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**  
   - **Application type:** Web application.  
   - **Name:** e.g. “EAM Web”.  
   - **Authorized redirect URIs:** add **all** hosts where the app runs, for example:
     - `https://nrcseam.techivano.com/api/auth/google/callback`
     - `https://admin.techivano.com/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback` (for local dev)
4. Copy **Client ID** and **Client secret** into your env (see below).

No need for multiple OAuth clients or multiple Google accounts — one client, one app name “EAM”, works for every tenant.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_OAUTH_CLIENT_ID` | For custom flow | Google OAuth 2.0 Client ID (single client for all tenants). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For custom flow | Client secret for that client. |

When both are set, “Continue with Google” uses `/api/auth/google` and Google shows “continue to **EAM**”. Redirect URI is derived from the request host; ensure each host’s callback URL is in the Google OAuth client’s Authorized redirect URIs.

## Supabase

- Keep your existing Supabase project and Auth config.  
- The app still uses Supabase for sessions (via `signInWithIdToken` in the callback).  
- You do **not** need to add the custom callback URL to Supabase’s “Redirect URLs”; the custom flow finishes on your app’s `/auth/callback`.

## Security

- Client secret is **server-only** (used in `/api/auth/google/callback`).  
- Redirect URIs must be **exact** and **HTTPS** in production.  
- Tokens are passed once from callback to frontend via query (then cleared); avoid logging or exposing them.

## Summary

- **Goal:** Google shows “continue to **EAM**” instead of the Supabase project URL, with **one** Google OAuth client for all tenants.  
- **Means:** One OAuth 2.0 Client in Google Cloud with Application name **“EAM”**, env vars **GOOGLE_OAUTH_CLIENT_ID** and **GOOGLE_OAUTH_CLIENT_SECRET**, and app routes `/api/auth/google` and `/api/auth/google/callback`.
