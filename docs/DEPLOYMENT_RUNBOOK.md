# Techivano EAM — Production Deployment Runbook (Atomic Release System)

**Release:** `v1.0-intelligence-platform`  
**Expected commit:** `6a6f8f2c7dfbd96a6e11dbf72b38e842534c92dc`  
**Production base:** `/var/www/nrcseam`  
**Production URL:** https://techivano.com

---

## Atomic deployment structure

Directory layout:

```
/var/www/nrcseam/
├── current          -> releases/<active-release>   (symlink)
├── releases/
│   ├── 20260310113000/
│   ├── 20260310114500/
│   └── ...
└── shared/
    └── .env
```

- **releases/** — Each deployment creates a new timestamped directory `YYYYMMDDHHMMSS` (e.g. `20260310113000`).
- **current** — Symlink pointing at the active release. Switching this is the only step that activates a new release.
- **shared/.env** — Single env file; each release has `.env` symlinked to `shared/.env`. Must exist before deploy.

Rules:

- Do not delete previous releases manually; the script keeps the last **5** releases (never deletes the directory referenced by `current`).
- Idempotency: script does not fail if `releases/` or `shared/` already exist.
- Activation is only by updating the `current` symlink (Step 8), then `pm2 reload` (Step 9).
- **Deployment lock:** Only one deploy or rollback can run at a time. Lock file: `/var/run/nrcseam-deploy.lock`. If a deploy is already in progress, the script exits with an error.

---

## One-time setup (before first atomic deploy)

1. Create base and shared env:

   ```bash
   sudo mkdir -p /var/www/nrcseam/shared /var/www/nrcseam/releases
   # Copy or create /var/www/nrcseam/shared/.env with all required variables
   ```

2. Optional: if you already have the app at `/var/www/nrcseam` (legacy layout), migrate to atomic:

   ```bash
   # Create first release by cloning into releases/<timestamp>
   RELEASE_ID=$(date +%Y%m%d%H%M%S)
   mv /var/www/nrcseam /var/www/nrcseam/releases/$RELEASE_ID
   # Or: keep shared/.env and let first deploy clone into releases/$RELEASE_ID
   ln -sfn /var/www/nrcseam/releases/$RELEASE_ID /var/www/nrcseam/current
   ```

   Ensure `shared/.env` exists and `current` points at a release that has `dist/` and `ecosystem.config.cjs`.

---

## Quick start

From the server (run as user that owns `/var/www/nrcseam` and has pm2):

```bash
cd /var/www/nrcseam
# Ensure shared/.env exists and has DATABASE_URL, REDIS_URL, etc.
bash current/scripts/deploy-production.sh
```

Or from a release path:

```bash
/var/www/nrcseam/current/scripts/deploy-production.sh
```

The script uses `BASE_DIR=/var/www/nrcseam` by default. Override if needed:

```bash
DEPLOY_BASE_DIR=/var/www/nrcseam bash /var/www/nrcseam/current/scripts/deploy-production.sh
```

---

## Deployment steps (script order)

| Step | Description |
|------|-------------|
| 1 | **Preflight** — Node ≥20, pnpm, pm2, Redis, `DATABASE_URL` set (from `shared/.env`) |
| 2 | **Create release directory** — `RELEASE_ID=YYYYMMDDHHMMSS`, `RELEASE_DIR=$BASE_DIR/releases/$RELEASE_ID` |
| 3 | **Clone repo** — Clone repo into `RELEASE_DIR`, checkout `v1.0-intelligence-platform`, verify commit hash |
| 4 | **Link shared env** — `ln -sfn $BASE_DIR/shared/.env $RELEASE_DIR/.env`. Abort if `shared/.env` missing |
| 5 | **Install dependencies** — `pnpm install --frozen-lockfile` in release dir |
| 6 | **Migrations** — `pnpm run db:migrate`. Verify tables: `telemetry_points`, `telemetry_aggregates`, `vendor_risk_scores`, `executive_metrics_snapshots`, `operational_kpi_trends`. Abort if any missing |
| 7 | **Build** — `pnpm build` and `pnpm run build:worker`. Abort if `dist/index.js` or `dist/worker.js` missing |
| 8 | **Switch release** — `ln -sfn $RELEASE_DIR $BASE_DIR/current` (only step that activates new release) |
| 9 | **Reload services** — `cd $BASE_DIR/current && pm2 reload ecosystem.config.cjs --update-env` (zero-downtime) |
| 10 | **Health check** — Retry up to 10 times, every 2s. Require **HTTP 200** and body `{"status":"ok"}`. Abort if still failing |
| 11 | **Redis** — `redis-cli ping` → PONG. Abort if failure |
| 11.5 | **Queue health** — `pnpm run queue:health` (Redis + BullMQ). Abort if queue unavailable (prevents workers silently failing) |
| 12 | **API verification** — Check `/health`, `/api/trpc/executive.computeMetrics`, etc. Warnings only, do not abort |
| 13 | **Deployment logging** — Write `release.json` in release dir; write `/var/log/nrcseam/deployments/<release-id>.log` with release_id, tag, commit, start/end time, migration status, health result |

After Step 13, the script prunes old releases (keeps last 5 by release ID order; **never** deletes the directory referenced by `current`).

---

## Rollback procedure

To switch back to the previous release:

```bash
cd /var/www/nrcseam
bash current/scripts/deploy-production.sh rollback
```

Behavior:

1. Acquire deployment lock (same as deploy; prevents parallel rollback/deploy).
2. Resolve `current` to the active release directory.
3. Find the **previous** release by **release ID order** (sorted by directory name `YYYYMMDDHHMMSS`); previous = release immediately before current. Does not rely on mtime.
4. Update symlink: `ln -sfn releases/<previous> current`.
5. Run `pm2 reload ecosystem.config.cjs --update-env`.
6. Append a rollback event to `/var/log/nrcseam/deployments/rollback.log`.

No database rollback is performed; only the application version is reverted.

---

## Deployment logging and release metadata

- **Directory:** `/var/log/nrcseam/deployments/`
- **Per deploy:** `<release-id>.log` (e.g. `20260310113000.log`) with:
  - `release_id`, `release_tag`, `commit_hash`
  - `deployment_start` / `deployment_end`
  - `migration_status`, `health_check_result`
- **Rollbacks:** `rollback.log` (append-only).
- **Release metadata:** Each release directory contains `release.json` with:
  - `release_id`, `release_tag`, `commit`, `deployed_at`
  - Used for debugging, audits, and operations visibility.

Create the log directory if missing:

```bash
sudo mkdir -p /var/log/nrcseam/deployments
sudo chown <app-user> /var/log/nrcseam/deployments
```

---

## PM2 configuration

- **API (`nrcseam`):** `dist/index.js`, **cluster** mode, **instances: "max"**.
- **Worker (`nrcseam-worker`):** `dist/worker.js`, **fork** mode, **instances: 1**.

Ecosystem file lives in each release; `cwd` is the release directory (so `current` resolves to the active release). Reload uses the app under `current`:

```bash
cd /var/www/nrcseam/current
pm2 reload ecosystem.config.cjs --update-env
```

---

## Required environment variables

Set in **`/var/www/nrcseam/shared/.env`** (never in the repo):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase Postgres connection string |
| `JWT_SECRET` | Secret for JWT (min 32 chars) |
| `VITE_APP_ID` | Manus OAuth app ID |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `REDIS_URL` | Redis connection string (BullMQ) |
| `PHASE3_WORKERS_ENABLED` | `true` for intelligence workers |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

OAuth redirect URI for production: `https://techivano.com/api/oauth/callback` (must be whitelisted in Manus).

---

## Queue health script

Verify Redis and BullMQ queue:

```bash
cd /var/www/nrcseam/current
node scripts/queue-health.js
```

- Connects to Redis (`REDIS_URL`).
- Connects to BullMQ queue `eam-background-jobs` (used for `executive.computeMetrics`, `warehouse.rebalanceStock`, `vendor.computeRiskScores`).
- Exits **0** if healthy, **non-zero** if Redis or queue is unavailable.

Loads `.env` from current directory (symlinked to `shared/.env` when run from `current`).

---

## Release directory structure (after deploy)

Each release directory contains:

- Application code (from git clone).
- `.env` → symlink to `shared/.env`.
- `dist/index.js`, `dist/worker.js` (build artifacts).
- `ecosystem.config.cjs` (PM2 config for this release).

Only the last **5** releases are kept; older ones are removed by the deploy script.

---

## Status command

Quick overview for operations:

```bash
bash /var/www/nrcseam/current/scripts/deploy-production.sh status
```

Example output:

```
Current Release: 20260310113000
Commit: 6a6f8f2
PM2 Status: online
Health: ok
Redis: ok
Queue: ok
```

Uses `release.json` when present; falls back to `git rev-parse` for commit. Exits 0; individual lines indicate ok/fail for health, Redis, and queue.

---

## Single-step and rollback usage

Run a single step (e.g. preflight only):

```bash
bash /var/www/nrcseam/current/scripts/deploy-production.sh step1_preflight
```

Rollback to previous release:

```bash
bash /var/www/nrcseam/current/scripts/deploy-production.sh rollback
```

---

## Guardrails

- Do not delete the database or object storage until the new deployment has been stable for at least 48 hours.
- No production cutover without a successful health check (Step 10).
- Keep `shared/.env` secure and outside version control.

---

*Ivano Technologies Ltd / NRCS EAM — Domain: techivano.com | App ID: YNihSyDPBSASM93ZxstDRD*
