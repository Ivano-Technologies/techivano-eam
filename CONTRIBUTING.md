# Contributing

## Branch workflow

- **feature/\*** — Work in progress. Branch from `staging`, open PR to `staging` when ready.
- **staging** — Integration. All feature work merges here first. Run typecheck, tests, and smoke locally before pushing.
- **main** — Production. Updated only via **pull request** from `staging`. Merging triggers deploy.

**Standard flow:** `feature/*` → `staging` → PR → `main` → deploy.

## Before merging to main

1. Open a PR: **staging** → **main** on GitHub.
2. Ensure required checks pass:
   - Typecheck
   - `pnpm test:ci`
   - Smoke test (`/login`)
   - Migrations + schema verify (in CI)
3. E2E runs in CI but is non-blocking until stabilized.
4. Merge the PR. Deploy runs automatically after merge.

## Branch protection (main)

In **GitHub → Settings → Branches → Add rule** for `main`:

- **Require a pull request before merging** — no direct pushes.
- **Require status checks to pass** — e.g. `validate` (or your CI job name).
- **Require branches to be up to date** before merging.
- (Optional) **Require approval** (e.g. 1 reviewer).

Do **not** allow bypassing or direct pushes to `main` except in rare emergencies (hotfix, CI broken, rollback), and follow up with a PR.

## Local checks before pushing

```bash
pnpm typecheck
pnpm test:ci
pnpm build
# Optional: pnpm e2e:local (with server + .env.local)
```

## PR template

New PRs (staging → main) use the template in `.github/PULL_REQUEST_TEMPLATE.md`. Fill in Summary, Changes, Tests checklist, and Risk level.
