# Techivano EAM — Target Deployment Architecture

**Purpose:** Single source of truth for the CI/CD and deployment flow: developer commit → GitHub → CI → Preview (Vercel) → Staging → Production.

**Related:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) (platform diagram: Browser → Vercel → API → Redis → Workers → Supabase). [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) (step-by-step workflow: branches, worktrees, protection, rollback). Server atomic deploys (PM2): [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md). Branch strategy and env vars: [DEPLOYMENT_AND_BRANCH_STRATEGY.md](./DEPLOYMENT_AND_BRANCH_STRATEGY.md).

---

## 1. Target deployment flow

```
Developer commit
       │
       ▼
GitHub
       │
       ▼
CI (tests + security)
       │
       ▼
Preview Deployment (Vercel)
       │
       ▼
Staging approval
       │
       ▼
Production deploy
```

---

## 2. Three environments

| Environment   | Branch           | Purpose                          |
|--------------|------------------|----------------------------------|
| **Preview**  | `feature/*`      | Test individual changes in isolation |
| **Staging**  | `staging`        | Pre-production; QA and UAT       |
| **Production** | `main`         | Live system                      |

- **Preview:** Each feature branch gets a unique Vercel preview URL (e.g. `https://techivano-git-feature-new-dashboard.vercel.app`). No branch switching; test before merging.
- **Staging:** Merge from feature branches when ready; staging deploys automatically. Use for final validation before production.
- **Production:** Only after staging is approved; merge `staging` → `main`. Vercel deploys production.

---

## 3. Git worktree layout (local)

Recommended layout for parallel work without dirty trees:

```
Projects/
│
├── techivano-eam
│   └── staging (development / integration)
│
├── techivano-eam-main-deploy
│   └── main (production deploy worktree)
│
└── techivano-feature-*   (optional, per feature)
    └── feature/* branch
```

**Add a feature worktree (isolated development):**

```bash
git worktree add ../techivano-feature-auth feature/auth
```

Result: `techivano-feature-auth`, `techivano-eam`, and `techivano-eam-main-deploy` can be used in parallel—no branch switching, no dirty working trees.

---

## 4. Vercel deployment rules

In **Vercel project settings**:

- **Production Branch:** `main`

**Branch deployments:**

| Branch       | Deployment  | Example URL |
|-------------|-------------|-------------|
| `main`      | Production  | `https://techivano.com` |
| `staging`   | Staging     | `https://staging.techivano.com` |
| `feature/*` | Preview     | `https://techivano-git-feature-<name>.vercel.app` |

When you push a branch such as `feature/new-dashboard`, Vercel creates a full preview environment at the auto-generated URL. Use it for testing before merging to `staging`.

---

## 5. GitHub branch protection (main)

To prevent accidental production pushes and enforce quality:

**GitHub → Settings → Branch protection → Add rule (or edit for `main`):**

- **Branch name pattern:** `main`
- **Require status checks to pass before merging:** enabled  
  - Require: **CI** (the workflow name from `.github/workflows/ci.yml`)
- **Require pull request reviews:** enabled (e.g. 1 approval)
- **Do not allow bypassing the above settings** (no direct pushes that skip checks)

This ensures:

- CI (install, typecheck, lint, tests, build) must pass.
- At least one review before merge to `main`.
- No force-push or direct push to `main` that bypasses checks.

---

## 6. Automated deployment flow

### Development

1. Create a feature branch:
   ```bash
   git checkout -b feature/asset-dashboard
   ```
2. Push:
   ```bash
   git push origin feature/asset-dashboard
   ```
3. **Result:** CI runs; Vercel creates a preview deployment. Team tests on the preview URL.

### Merge to staging

When the feature is ready:

- Open a PR: `feature/asset-dashboard` → `staging`.
- After merge, **staging** deploys automatically (Vercel).
- Staging URL: `staging.techivano.com`. QA runs tests there.

### Production release

When staging is approved:

- Open a PR: `staging` → `main`.
- After CI passes and review, merge to `main`.
- Vercel automatically deploys production.
- Production URL: `techivano.com`.

---

## 7. Optional: safe release tags

For major releases and rollback points:

```bash
git tag v1.2.0
git push origin v1.2.0
```

You get a permanent reference; if needed, you can deploy a specific tag (e.g. from a release worktree or CI that deploys on tag push).

---

## 8. Instant rollback

If production fails after a merge to `main`:

```bash
git revert <commit>
git push origin main
```

Vercel redeploys the reverted version. Rollback time is typically on the order of **~15 seconds**.

---

## 9. CI + deployment pipeline (summary)

```
Feature branch push
        │
        ▼
GitHub Actions
  - install
  - typecheck
  - lint
  - tests (incl. phase4, workers)
  - build (API + frontend + worker)
        │
        ▼
Vercel preview deployment (feature branch)
        │
        ▼
Merge → staging
        │
        ▼
Vercel staging deployment
        │
        ▼
Merge → main
        │
        ▼
Vercel production deployment
```

CI runs on push and pull requests to `main`, `staging`, `develop`, and `feature/**` so that every branch (including feature branches) is validated before merge and preview deployments are backed by passing CI.

---

## 10. Why this matters for Techivano

Techivano is a complex SaaS platform (assets, telemetry, analytics, queues). This setup provides:

| Capability            | Benefit |
|-----------------------|--------|
| Preview deployments   | Test features before merging; no “works on my machine” |
| Branch protection     | Prevents broken production; CI + review required for `main` |
| Worktrees             | Parallel development without branch switching or dirty trees |
| CI security / quality | Lint, typecheck, tests block bad merges |
| Atomic deploy (Vercel)| Safe releases; instant rollback via revert + push |
| Instant rollback      | Recover quickly if a release fails |

This pattern is used by companies such as Vercel, Linear, Supabase, and Stripe for internal tools and product deployments.

---

## Quick reference

| Item              | Location / value |
| **Platform diagram** | [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) |
|-------------------|------------------|
| Production URL    | `https://techivano.com` |
| Staging URL       | `https://staging.techivano.com` |
| Preview URL       | `https://techivano-git-<branch>.vercel.app` (Vercel auto) |
| Production branch | `main` |
| CI workflow       | `.github/workflows/ci.yml` |
| Server (PM2) runbook | [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) |
| Branch strategy   | [DEPLOYMENT_AND_BRANCH_STRATEGY.md](./DEPLOYMENT_AND_BRANCH_STRATEGY.md) |

---

## Setup status (CLI-completed)

The following was applied via **GitHub CLI** (`gh`) and **Vercel CLI** (`vercel`):

| Step | Status | How |
|------|--------|-----|
| **Vercel project link** | Done | `vercel link --yes` (project: techivano/techivano-eam) |
| **GitHub branch protection (main)** | Done | `gh api` PUT: require status check **validate**, 1 approval, no force push |
| **Vercel production branch** | Manual | Set in [Vercel Dashboard](https://vercel.com/techivano/techivano-eam/settings) → **Git** → **Production Branch** → `main` |

To confirm branch protection:

```bash
gh api repos/Ivano-Technologies/techivano-eam/branches/main/protection -X GET -q ".required_status_checks.contexts, .required_pull_request_reviews.required_approving_review_count"
# Expected: ["validate"] and 1
```

To set Vercel production branch via API (optional, requires `VERCEL_TOKEN` from [Vercel Account Settings](https://vercel.com/account/tokens)):

```bash
# PowerShell (Windows)
$headers = @{ Authorization = "Bearer $env:VERCEL_TOKEN" }
$body = '{"productionBranch":"main"}' | ConvertTo-Json
Invoke-RestMethod -Method PATCH -Uri "https://api.vercel.com/v9/projects/techivano-eam?teamId=techivano" -Headers $headers -Body $body -ContentType "application/json"
```
