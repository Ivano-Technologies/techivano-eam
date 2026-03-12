# Techivano Deployment Workflow

This workflow makes deployments **safer and almost automatic** while keeping **development fast**. It combines Git worktrees, branch protection, and Vercel preview deployments.

**Related:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) (platform diagram), [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) (detailed flow), [DEPLOYMENT_AND_BRANCH_STRATEGY.md](./DEPLOYMENT_AND_BRANCH_STRATEGY.md) (env and strategy).

---

## Goal

- **Development is fast**
- **Every change gets a preview environment**
- **Production cannot break accidentally**
- **Work on multiple features simultaneously**

---

## 1. Branch structure

Three long-lived branches:

| Branch      | Purpose           | Deploys to              |
|------------|-------------------|-------------------------|
| `main`     | Production        | techivano.com           |
| `staging`  | Pre-production    | staging.techivano.com   |
| `feature/*`| Development work  | Preview deployments     |

**Examples:** `main`, `staging`, `feature/supabase-auth-fix`, `feature/asset-import`, `feature/ocr-pipeline`.

---

## 2. Vercel deployment mapping

In **Vercel project settings**:

| Branch      | Environment  | Example URL |
|------------|--------------|-------------|
| `main`     | Production   | https://techivano.com |
| `staging`  | Preview (shared staging) | https://staging.techivano.com |
| `feature/*`| Preview (per branch) | https://techivano-git-feature-ocr.vercel.app |

Every PR gets a live environment automatically.

---

## 3. Environment variables

Set these per environment in **Vercel → Project → Settings → Environment Variables** (and in `.env` / `.env.local` for local dev):

| Variable | Production (`main`) | Staging | Preview (`feature/*`) |
|----------|--------------------|---------|------------------------|
| `SUPABASE_URL` | Production Supabase project | Staging Supabase project | Same as staging (see [Database strategy](#4-database-strategy)) |
| `SUPABASE_ANON_KEY` | Production | Staging | Staging |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Staging | Staging |
| `SUPABASE_JWT_SECRET` | Production JWT secret | Staging JWT secret | Staging |
| `VITE_APP_URL` | `https://techivano.com` | `https://staging.techivano.com` | Preview URL or staging |
| Other app vars | Production values | Staging values | Staging (shared) |

**Important:** Preview deployments use the **staging** Supabase project (and staging DB). Never point a preview at the production database.

---

## 4. Database strategy

| Environment | Database | Supabase project |
|-------------|----------|------------------|
| **Production** | Production DB | Supabase **production** project |
| **Staging** | Staging DB | Supabase **staging** project (separate project recommended) |
| **Preview** (`feature/*`) | Staging DB | Same as staging — **never** production |

This avoids the mistake: *Preview deploy → writes to production DB.* Always keep production data isolated; use a dedicated Supabase project (or at least a separate schema/DB) for staging and preview.

---

## 5. Git worktrees (parallel work)

Avoid constant branch switching by using **worktrees**:

```bash
git worktree add ../techivano-auth feature/supabase-auth
git worktree add ../techivano-assets feature/asset-module
```

You get:

```
techivano-eam/        → e.g. staging
techivano-auth/       → feature/supabase-auth
techivano-assets/     → feature/asset-module
```

Each directory can run its own dev server. No branch switching.

---

## 6. Branch protection (critical)

In **GitHub → Settings → Branches → Branch protection** for `main`:

- **Require a pull request before merging**
- **Require status checks to pass** (e.g. CI)
- **Require deployment success** (if available)
- **Require 1 review**

Production cannot be updated without passing checks and review.

---

## 7. Safe deployment flow

```
Developer
    ↓
Feature branch (e.g. feature/supabase-auth-fix)
    ↓
Push
    ↓
Vercel preview → techivano-git-feature-supabase-auth.vercel.app
    ↓
Merge feature → staging
    ↓
Staging deploys → staging.techivano.com
    ↓
Merge staging → main
    ↓
Production deploys → techivano.com
```

---

## 8. Release tagging

For traceable releases and easier debugging:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tag after a successful production deploy (or when merging to `main`). Helps answer “what version is in production?” and supports rollback to a known good tag.

---

## 9. Optional: Git aliases

```bash
git config --global alias.st status
git config --global alias.cm commit
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.lg "log --oneline --graph"
```

Then: `git st`, `git cm -m "message"`, `git lg`.

---

## 10. Auto-deploy checks (CI)

Before deployments, CI runs (see `.github/workflows/ci.yml`):

- `pnpm install`
- `pnpm lint` / typecheck
- `pnpm test`
- `pnpm build`

If any step fails, the merge can be blocked (via branch protection).

**Supabase migrations:** CI does **not** run Supabase migrations (`supabase db push` / `supabase db reset`). Apply migrations manually (e.g. `supabase db push` from a linked project) or as part of a separate release/deploy step. Keep migration history in `supabase/migrations/` and run them against the correct environment (staging vs production) when deploying.

---

## 11. Emergency rollback procedure

If production breaks after a deploy, use one of these:

### Option A: Vercel Dashboard (fastest)

1. Open [Vercel Dashboard](https://vercel.com) → select project **techivano-eam**.
2. Go to **Deployments**.
3. Find the **last known good** deployment (e.g. the one before the bad merge).
4. Open the **⋯** menu on that deployment → **Redeploy**.
5. When prompted, confirm **Use existing Build Cache** (or leave unchecked to rebuild).
6. After redeploy finishes, production aliases (e.g. `techivano.com`) point to that build.

**Rollback time:** typically &lt; 1 minute.

### Option B: Git revert (keeps history)

1. Identify the merge commit that caused the issue: `git log origin/main -1`.
2. Revert it: `git revert -m 1 <merge_commit_sha>`
3. Push to `main`: `git push origin main`
4. Vercel automatically deploys the reverted commit.

Use Option A for immediate recovery; use Option B when you want the rollback recorded in Git and CI to run on the reverted state.

---

## Result

- **Zero-downtime deploys**
- **Safe rollbacks**
- **Preview testing** for every feature
- **Easy collaboration** with worktrees and protected `main`
