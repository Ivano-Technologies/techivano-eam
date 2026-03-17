# Domain, DNS, and CI/CD Audit

**Audit date:** 2026-03-16

---

## 1. Domains (from audit spec)

| Domain | Expected use | In codebase |
|--------|----------------|-------------|
| techivano.com | Marketing / apex | VITE_APP_URL, E2E_BASE_URL default; host-based org not tied to apex in context |
| www.techivano.com | Marketing redirect | Not referenced in app code |
| app.techivano.com | EAM application | Not explicitly in repo; can be Vercel domain for same project |
| api.techivano.com | Backend API | Not in repo; single Vercel project serves app + api on same domain |
| auth.techivano.com | Auth | Not in repo; Supabase + app callback URLs |

**Conclusion:** Repo does not define DNS or SSL; those are configured in Vercel and Supabase. App uses `VITE_APP_URL` and Host header for tenant resolution (admin.techivano.com, nrcseam.techivano.com per ENV). For api.techivano.com or auth.techivano.com, configure in DNS/Vercel/Supabase as needed.

---

## 2. Vercel configuration

- **vercel.json:** Rewrites: `(?!api/).*` → `/index.html` (SPA fallback). API routes under `api/` are serverless.
- **Build:** Vercel uses project root; build command and output directory must match (e.g. `pnpm build` and static output for EAM). Confirm in Vercel dashboard that build command is `pnpm build` (or equivalent) and that `api/` is detected as serverless functions.

---

## 3. CI/CD pipeline

- **File:** `.github/workflows/ci.yml`
- **Triggers:** push / pull_request to `main`, `staging`, `develop`, `feature/**`
- **Jobs:** `validate` — checkout, pnpm install, **Typecheck**, **Test** (test:ci), **Build** (build + build:worker)
- **No:** Supabase migrations, Vercel deploy step, or npm publish in this workflow. Deploy is assumed via Vercel GitHub integration (auto-deploy on push to linked branch).
- **Secrets:** CI does not reference repo secrets; Vercel and Supabase use their own env/secrets for deployment and DB.

---

## 4. Recommendations

1. **DNS:** In Vercel, add and verify techivano.com, www, app, api if desired; point A/CNAME as per Vercel docs.
2. **SSL:** Handled by Vercel for Vercel-hosted domains.
3. **CI:** Optional: add a job that runs Playwright e2e against a preview URL when env (e.g. E2E_BASE_URL, E2E_AUTH_EMAIL) is set.
4. **Secrets:** Keep GitHub Actions minimal; use Vercel env and Supabase secrets for production.
