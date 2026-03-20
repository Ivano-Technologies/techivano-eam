# NRCS / Admin Landing Page – Deployment Verification

This doc explains where the **NRCS client dashboard / landing page** and **admin landing** live in the app, and how to fix them when they are "not available" on deployment.

## Where the landing lives

- **Unauthenticated landing (NRCS sign-in):** When a user is not logged in, **DashboardLayout** (wrapping the whole app) shows a **landing card** instead of the sidebar + content:
  - NRCS logo (`/nrcs-logo.png`)
  - "NRCS Asset Management" / "Sign in to access the Enterprise Asset Management System"
  - **Sign In** button → `getLoginUrl()` (OAuth portal)
- **Authenticated “admin” landing:** After login, the root path **`/`** renders the **Home** dashboard (metrics, upcoming maintenance, low stock). There is no separate “admin landing” URL; the main app dashboard at `/` is it.

So “landing not available” usually means either:

1. The deployment never serves the SPA for `/` or `/login`, or  
2. The app loads but the user never sees the sign-in card (stuck loading, blank, or error).

---

## 1. SPA routing (404 on `/` or `/login`)

**Symptom:** Opening `https://your-deployment.com/` or `https://your-deployment.com/login` returns **404** or a generic error page instead of the NRCS app.

**Cause:** The host (e.g. Vercel) is treating paths as file paths. There is no file at `/` or `/login`, so it returns 404 instead of serving `index.html` for the SPA.

**Fix:**

- **Vercel:** Use the included **`vercel.json`** so that every non-API path is rewritten to `index.html`:

  ```json
  {
    "rewrites": [
      { "source": "/((?!api/).*)", "destination": "/index.html" }
    ]
  }
  ```

  Redeploy after adding or changing this. Requests to `/`, `/login`, `/assets`, etc. will then serve `index.html` and the client router (wouter) will show the right screen.

- **Other hosts:** Configure the server so that:
  - Routes under `/api/*` hit your Node/API server.
  - All other routes serve the same `index.html` (the one that loads the React app).

---

## 2. Stuck on loading or blank screen

**Symptom:** The deployment URL loads but you see only a **spinner** or a **blank page**, and never the NRCS sign-in card or the dashboard.

**Typical causes:**

| Cause | What to check |
|--------|----------------|
| **Auth never settles** | `auth.me` (tRPC) must run and eventually resolve (success or 401). If the API is unreachable, wrong origin, or CORS blocks the request, the app can stay in a loading state. Ensure the frontend’s API base URL and CORS on the server match the deployment origin. |
| **Missing or wrong env at build time** | Supabase client config (`SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be present. If missing, login/session setup can fail and the app may stay in a loading state. |
| **Runtime error before layout** | An error in `main.tsx`, `AppProviders`, or before `DashboardLayout` renders can result in a blank screen. Check the browser console and any error reporting (e.g. Sentry) for the deployment URL. |
| **Static assets 404** | If `/nrcs-logo.png` (or other assets) 404, the layout can still render; only the image fails. Confirm `client/public` (or your build’s public output) is deployed and that paths match (e.g. `/nrcs-logo.png`). |

**Quick checks:**

- Open DevTools → Network: does `GET /api/trpc/auth.me` (or your tRPC auth endpoint) run and return (200 or 401)?
- Open DevTools → Console: any red errors or failed requests?
- Try opening the deployment URL in an incognito window to rule out cached/old JS or cookies.

---

## 3. Routes that should show the “landing”

- **`/`** – If unauthenticated: NRCS sign-in card. If authenticated: Home dashboard (admin/main landing).
- **`/login`** – Dedicated Login page (same app, different route). Also needs the SPA to be served (see §1).

There is no separate “NRCS client dashboard” URL; the **client dashboard** is the same app after login (Home at `/`, plus Assets, Work Orders, etc.). The **admin landing** is that same post-login experience, starting at `/`.

---

## 4. Checklist for “landing not available” on Vercel

1. **`vercel.json`** in repo root with the rewrites above; redeploy.
2. **Build:** Vercel build must produce the client (e.g. Vite build output in `dist/public` or whatever your config uses) so `index.html` and assets exist.
3. **Env in Vercel:** `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and any other required `VITE_*`) set for the environment that serves the frontend.
4. **API reachable:** From the browser at the deployment origin, `/api/trpc/...` (and `/api/health` if you use it) must be reachable and not blocked by CORS.
5. **Console/Network:** No 404 for `index.html` on `/` or `/login`; no persistent loading or errors blocking the first paint of `DashboardLayout`.

Once the SPA is served and auth can complete or fail cleanly, the NRCS landing (sign-in card) and the admin dashboard at `/` should both be available on deployment.
