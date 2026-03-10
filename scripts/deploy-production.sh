#!/usr/bin/env bash
# =============================================================================
# Techivano EAM — Atomic Release Deployment (Intelligence Platform v1.0)
# Production base: /var/www/nrcseam
# Layout: releases/<YYYYMMDDHHMMSS>, shared/.env, current -> releases/<active>
# =============================================================================
set -euo pipefail

BASE_DIR="${DEPLOY_BASE_DIR:-/var/www/nrcseam}"
RELEASES_DIR="$BASE_DIR/releases"
SHARED_DIR="$BASE_DIR/shared"
CURRENT_LINK="$BASE_DIR/current"
DEPLOY_LOG_DIR="/var/log/nrcseam/deployments"
LOCK_FILE="${LOCK_FILE:-/var/run/nrcseam-deploy.lock}"

RELEASE_TAG="${RELEASE_TAG:-v1.0-intelligence-platform}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-6a6f8f2c7dfbd96a6e11dbf72b38e842534c92dc}"
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/Ivano-Technologies/techivano-eam.git}"
KEEP_RELEASES=5

# Tables to verify after migration (abort if missing)
REQUIRED_TABLES=(
  telemetry_points
  telemetry_aggregates
  vendor_risk_scores
  executive_metrics_snapshots
  operational_kpi_trends
)

# API routes to verify (warnings only)
API_VERIFY_ROUTES=(
  "/health"
  "/api/trpc/executive.computeMetrics"
  "/api/trpc/warehouse.rebalanceStock"
  "/api/trpc/vendor.computeRiskScores"
)

abort() {
  echo "[ABORT] $*"
  exit 1
}

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

# Load shared env for preflight and rollback (when current may be broken)
load_shared_env() {
  if [[ -f "$SHARED_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$SHARED_DIR/.env"
    set +a
  fi
}

# Acquire deployment lock (prevents parallel deploys)
acquire_deploy_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    echo "Deployment already in progress (lock: $LOCK_FILE)"
    exit 1
  fi
  touch "$LOCK_FILE"
  trap 'rm -f "$LOCK_FILE"' EXIT
}

# -----------------------------------------------------------------------------
# STEP 1 — Preflight checks
# -----------------------------------------------------------------------------
step1_preflight() {
  log "STEP 1 — Preflight checks"
  command -v node >/dev/null 2>&1 || abort "Node.js not found"
  local node_ver
  node_ver=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0")
  [[ "${node_ver:-0}" -ge 20 ]] || abort "Node.js must be >= 20 (got $node_ver)"
  command -v pnpm >/dev/null 2>&1 || abort "pnpm not found"
  command -v pm2 >/dev/null 2>&1 || abort "pm2 not found"
  command -v redis-cli >/dev/null 2>&1 || abort "redis-cli not found"
  redis-cli ping 2>/dev/null | grep -q PONG || abort "Redis not responding (redis-cli ping)"
  load_shared_env
  [[ -n "${DATABASE_URL:-}" ]] || abort "DATABASE_URL is not set (check $SHARED_DIR/.env)"
  log "Preflight OK"
}

# -----------------------------------------------------------------------------
# STEP 2 — Create release directory
# -----------------------------------------------------------------------------
step2_create_release_dir() {
  log "STEP 2 — Create release directory"
  RELEASE_ID=$(date +%Y%m%d%H%M%S)
  RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
  mkdir -p "$RELEASES_DIR"
  log "Release ID: $RELEASE_ID (directory will be created by clone)"
}

# -----------------------------------------------------------------------------
# STEP 3 — Clone repo into release
# -----------------------------------------------------------------------------
step3_clone_repo() {
  log "STEP 3 — Clone repo into release"
  [[ -n "${RELEASE_DIR:-}" ]] || abort "RELEASE_DIR not set (run step2 first)"
  if [[ -d "$RELEASE_DIR" ]] && [[ -d "$RELEASE_DIR/.git" ]]; then
    log "Release dir already exists with git, fetching and checking out..."
    (cd "$RELEASE_DIR" && git fetch --tags origin 2>/dev/null; git checkout "$RELEASE_TAG" 2>/dev/null)
  else
    [[ ! -d "$RELEASE_DIR" ]] || rm -rf "$RELEASE_DIR"
    git clone --depth 1 --branch "$RELEASE_TAG" "$GIT_REPO_URL" "$RELEASE_DIR" 2>/dev/null || {
      log "Shallow clone failed, trying full clone..."
      rm -rf "$RELEASE_DIR"
      git clone --branch "$RELEASE_TAG" "$GIT_REPO_URL" "$RELEASE_DIR"
    }
  fi
  local actual
  actual=$(git -C "$RELEASE_DIR" rev-parse HEAD)
  if [[ "$actual" != "$EXPECTED_COMMIT" ]]; then
    abort "Commit mismatch: expected $EXPECTED_COMMIT, got $actual"
  fi
  log "Checked out $RELEASE_TAG at $actual"
}

# -----------------------------------------------------------------------------
# STEP 4 — Link shared environment
# -----------------------------------------------------------------------------
step4_link_shared_env() {
  log "STEP 4 — Link shared environment"
  [[ -n "${RELEASE_DIR:-}" ]] || abort "RELEASE_DIR not set"
  [[ -f "$SHARED_DIR/.env" ]] || abort "Shared env file missing: $SHARED_DIR/.env"
  ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
  log "Linked .env -> $SHARED_DIR/.env"
}

# -----------------------------------------------------------------------------
# STEP 5 — Install dependencies
# -----------------------------------------------------------------------------
step5_install_deps() {
  log "STEP 5 — Install dependencies"
  cd "$RELEASE_DIR"
  pnpm install --frozen-lockfile
  log "Dependencies OK"
}

# -----------------------------------------------------------------------------
# STEP 6 — Run database migrations
# -----------------------------------------------------------------------------
step6_migrate() {
  log "STEP 6 — Run database migrations"
  cd "$RELEASE_DIR"
  set -a
  # shellcheck source=/dev/null
  source "$RELEASE_DIR/.env"
  set +a
  pnpm run db:migrate
  if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
    for table in "${REQUIRED_TABLES[@]}"; do
      if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null | grep -q 1; then
        log "  Table present: $table"
      else
        abort "Required table missing: $table"
      fi
    done
  else
    log "WARN: Skipping table verification (psql or DATABASE_URL not available)"
  fi
  log "Migrations OK"
}

# -----------------------------------------------------------------------------
# STEP 7 — Build application
# -----------------------------------------------------------------------------
step7_build() {
  log "STEP 7 — Build application"
  cd "$RELEASE_DIR"
  set -a
  # shellcheck source=/dev/null
  source "$RELEASE_DIR/.env"
  set +a
  pnpm build
  pnpm run build:worker
  [[ -f "$RELEASE_DIR/dist/index.js" ]] || abort "Build artifact missing: dist/index.js"
  [[ -f "$RELEASE_DIR/dist/worker.js" ]] || abort "Build artifact missing: dist/worker.js"
  log "Build OK"
}

# -----------------------------------------------------------------------------
# STEP 8 — Switch active release (atomic cutover)
# -----------------------------------------------------------------------------
step8_switch_release() {
  log "STEP 8 — Switch active release"
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
  log "current -> $RELEASE_DIR"
}

# -----------------------------------------------------------------------------
# STEP 9 — Reload services (zero downtime)
# -----------------------------------------------------------------------------
step9_reload_services() {
  log "STEP 9 — Reload services (zero downtime)"
  [[ -L "$CURRENT_LINK" ]] || abort "current symlink not found"
  local current_path
  current_path=$(readlink -f "$CURRENT_LINK" 2>/dev/null || readlink "$CURRENT_LINK")
  cd "$current_path"
  if pm2 describe nrcseam &>/dev/null; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    log "PM2 processes not defined, starting..."
    pm2 start ecosystem.config.cjs --update-env
  fi
  pm2 list
  log "PM2 reloaded using $current_path"
}

# -----------------------------------------------------------------------------
# STEP 10 — Health check loop (HTTP 200 and status ok)
# -----------------------------------------------------------------------------
step10_health_check() {
  log "STEP 10 — Health check loop"
  local attempt=1
  local max_attempts=10
  local interval=2
  local tmp_health
  tmp_health=$(mktemp 2>/dev/null || echo "/tmp/nrcseam_health_$$")
  trap "rm -f $tmp_health" RETURN 2>/dev/null || true
  while [[ $attempt -le $max_attempts ]]; do
    local code body
    code=$(curl -s -o "$tmp_health" -w "%{http_code}" --max-time 5 "http://localhost:3000/health" 2>/dev/null || echo "000")
    body=$(cat "$tmp_health" 2>/dev/null || true)
    if [[ "$code" == "200" ]] && echo "$body" | grep -q '"status":"ok"'; then
      log "Health OK (attempt $attempt): HTTP $code, status ok"
      return 0
    fi
    log "Health check attempt $attempt/$max_attempts failed (HTTP $code)"
    [[ $attempt -lt $max_attempts ]] && sleep "$interval"
    attempt=$((attempt + 1))
  done
  abort "Health check failed after $max_attempts attempts (last HTTP code: ${code:-unknown})"
}

# -----------------------------------------------------------------------------
# STEP 11 — Redis health check
# -----------------------------------------------------------------------------
step11_redis_health() {
  log "STEP 11 — Redis health check"
  local ping
  ping=$(redis-cli ping 2>/dev/null || true)
  if [[ "$ping" != "PONG" ]]; then
    abort "Redis health check failed (expected PONG, got: $ping)"
  fi
  log "Redis OK"
}

# -----------------------------------------------------------------------------
# STEP 11.5 — Queue health (BullMQ)
# -----------------------------------------------------------------------------
step11_queue_health() {
  log "STEP 11.5 — Queue health (BullMQ)"
  local current_path
  current_path=$(readlink -f "$CURRENT_LINK" 2>/dev/null || readlink "$CURRENT_LINK")
  (cd "$current_path" && pnpm run queue:health) || abort "Queue health check failed (Redis/BullMQ unavailable)"
  log "Queue OK"
}

# -----------------------------------------------------------------------------
# STEP 12 — API route verification (warnings only)
# -----------------------------------------------------------------------------
step12_api_verification() {
  log "STEP 12 — API route verification"
  local base="${BASE_URL:-http://localhost:3000}"
  for route in "${API_VERIFY_ROUTES[@]}"; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$base$route" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]] || [[ "$status" == "401" ]]; then
      log "  $route -> $status"
    else
      log "  WARN: $route -> $status (expected 200 or 401)"
    fi
  done
}

# -----------------------------------------------------------------------------
# Write release metadata (release.json) inside release directory
# -----------------------------------------------------------------------------
write_release_metadata() {
  [[ -n "${RELEASE_DIR:-}" ]] || return 0
  local commit_hash deployed_at
  commit_hash=$(git -C "$RELEASE_DIR" rev-parse HEAD 2>/dev/null || echo "")
  deployed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > "$RELEASE_DIR/release.json" << METADATA
{
  "release_id": "$RELEASE_ID",
  "release_tag": "$RELEASE_TAG",
  "commit": "$commit_hash",
  "deployed_at": "$deployed_at"
}
METADATA
  log "Wrote $RELEASE_DIR/release.json"
}

# -----------------------------------------------------------------------------
# STEP 13 — Deployment logging and release metadata
# -----------------------------------------------------------------------------
step13_deployment_log() {
  log "STEP 13 — Deployment logging and release metadata"
  write_release_metadata
  mkdir -p "$DEPLOY_LOG_DIR"
  local log_file="$DEPLOY_LOG_DIR/${RELEASE_ID}.log"
  local commit_hash
  commit_hash=$(git -C "$RELEASE_DIR" rev-parse HEAD 2>/dev/null || echo "N/A")
  {
    echo "release_id=$RELEASE_ID"
    echo "release_tag=$RELEASE_TAG"
    echo "commit_hash=$commit_hash"
    echo "deployment_start=$DEPLOY_START_TIME"
    echo "deployment_end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "migration_status=ok"
    echo "health_check_result=ok"
  } > "$log_file"
  log "Deployment log: $log_file"
}

# -----------------------------------------------------------------------------
# Cleanup old releases (keep last KEEP_RELEASES); never delete current
# -----------------------------------------------------------------------------
cleanup_old_releases() {
  log "Cleanup: keeping last $KEEP_RELEASES releases"
  mkdir -p "$RELEASES_DIR"
  local current_resolved
  current_resolved=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)
  local count=0
  # Sort by release ID (timestamp) ascending; remove oldest beyond KEEP_RELEASES
  for dir in $(ls -1 "$RELEASES_DIR" 2>/dev/null | sort); do
    [[ -d "$RELEASES_DIR/$dir" ]] || continue
    count=$((count + 1))
    if [[ $count -gt $KEEP_RELEASES ]]; then
      local to_remove="$RELEASES_DIR/$dir"
      local to_remove_resolved
      to_remove_resolved=$(readlink -f "$to_remove" 2>/dev/null || true)
      if [[ -n "$current_resolved" ]] && [[ "$to_remove_resolved" == "$current_resolved" ]]; then
        log "Skipping cleanup of current release: $to_remove"
      else
        log "Removing old release: $to_remove"
        rm -rf "$to_remove"
      fi
    fi
  done
}

# -----------------------------------------------------------------------------
# Rollback: switch to previous release (by release ID order) and reload PM2
# -----------------------------------------------------------------------------
rollback() {
  acquire_deploy_lock
  log "Rollback — switching to previous release"
  load_shared_env
  [[ -d "$RELEASES_DIR" ]] || abort "No releases directory: $RELEASES_DIR"
  local current_target
  current_target=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)
  [[ -n "$current_target" ]] || abort "current symlink missing or broken"
  local current_id
  current_id=$(basename "$current_target")
  # Sort by release ID (timestamp); previous = release immediately before current
  local previous_id=""
  local prev=""
  for id in $(ls -1 "$RELEASES_DIR" 2>/dev/null | sort); do
    if [[ "$id" == "$current_id" ]]; then
      previous_id="$prev"
      break
    fi
    prev="$id"
  done
  [[ -n "$previous_id" ]] || abort "No previous release found to roll back to"
  local previous_dir="$RELEASES_DIR/$previous_id"
  [[ -d "$previous_dir" ]] || abort "Previous release directory missing: $previous_dir"
  log "Rolling back from $current_target to $previous_dir"
  ln -sfn "$previous_dir" "$CURRENT_LINK"
  cd "$previous_dir"
  if pm2 describe nrcseam &>/dev/null; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs --update-env
  fi
  log "Rollback complete. current -> $previous_dir"
  mkdir -p "$DEPLOY_LOG_DIR"
  echo "rollback from=$current_id to=$previous_id at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$DEPLOY_LOG_DIR/rollback.log"
}

# -----------------------------------------------------------------------------
# Status: current release, commit, PM2, health, Redis, queue
# -----------------------------------------------------------------------------
status() {
  load_shared_env
  echo "Current Release: $(basename "$(readlink -f "$CURRENT_LINK" 2>/dev/null)" 2>/dev/null || echo "none")"
  local cur
  cur=$(readlink -f "$CURRENT_LINK" 2>/dev/null)
  if [[ -n "$cur" ]] && [[ -f "$cur/release.json" ]]; then
    local commit
    commit=$(grep -o '"commit": *"[^"]*"' "$cur/release.json" 2>/dev/null | cut -d'"' -f4 | cut -c1-7)
    echo "Commit: ${commit:-unknown}"
  elif [[ -n "$cur" ]] && [[ -d "$cur/.git" ]]; then
    echo "Commit: $(git -C "$cur" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
  else
    echo "Commit: unknown"
  fi
  if pm2 describe nrcseam &>/dev/null; then
    echo "PM2 Status: online"
  else
    echo "PM2 Status: not running"
  fi
  local health_code health_body health_tmp
  health_tmp=$(mktemp 2>/dev/null || echo "/tmp/nrcseam_status_health_$$")
  health_code=$(curl -s -o "$health_tmp" -w "%{http_code}" --max-time 3 "http://localhost:3000/health" 2>/dev/null || echo "000")
  health_body=$(cat "$health_tmp" 2>/dev/null); rm -f "$health_tmp" 2>/dev/null
  if [[ "$health_code" == "200" ]] && echo "$health_body" | grep -q '"status":"ok"'; then
    echo "Health: ok"
  else
    echo "Health: fail (HTTP $health_code)"
  fi
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "Redis: ok"
  else
    echo "Redis: fail"
  fi
  if [[ -n "$cur" ]] && (cd "$cur" && pnpm run queue:health &>/dev/null); then
    echo "Queue: ok"
  else
    echo "Queue: fail"
  fi
}

# -----------------------------------------------------------------------------
# Main deployment flow
# -----------------------------------------------------------------------------
main() {
  acquire_deploy_lock
  DEPLOY_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  log "Starting atomic deployment (base: $BASE_DIR)"
  step1_preflight
  step2_create_release_dir
  step3_clone_repo
  step4_link_shared_env
  step5_install_deps
  step6_migrate
  step7_build
  step8_switch_release
  step9_reload_services
  step10_health_check
  step11_redis_health
  step11_queue_health
  step12_api_verification
  step13_deployment_log
  cleanup_old_releases

  log "Deployment complete."
  cat << REPORT
================================================================================
TECHIVANO EAM — DEPLOYMENT SUMMARY
================================================================================
Release ID       : $RELEASE_ID
Release directory: $RELEASE_DIR
Release tag      : $RELEASE_TAG
Commit           : $(git -C "$RELEASE_DIR" rev-parse HEAD 2>/dev/null || echo "N/A")
current ->      : $(readlink "$CURRENT_LINK")
Deployment log   : $DEPLOY_LOG_DIR/${RELEASE_ID}.log
================================================================================
REPORT
}

# Dispatch
if [[ "${1:-}" == "rollback" ]]; then
  rollback
elif [[ "${1:-}" == "status" ]]; then
  status
elif [[ -n "${1:-}" ]] && declare -f "$1" >/dev/null 2>&1; then
  load_shared_env
  "$1"
else
  main
fi
