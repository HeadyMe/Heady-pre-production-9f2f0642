#!/usr/bin/env bash
# =============================================================================
# Heady Sovereign AI Platform — Production Startup Script
# =============================================================================
# Monorepo: github.com/HeadyMe/Heady-pre-production-9f2f0642
# Maintained by: eric@headyconnection.org
#
# Usage:
#   ./scripts/startup.sh               # normal start
#   ./scripts/startup.sh --skip-migrate  # skip DB migrations (fast restart)
#   ./scripts/startup.sh --dry-run     # preflight only, do not start processes
#
# Environment: loaded from .env.production (or $ENV_FILE)
#
# Exit codes:
#   0  — graceful shutdown
#   1  — startup failure (see logs)
#   2  — preflight failed
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ─── Script metadata ──────────────────────────────────────────────────────────

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly STARTUP_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ─── Argument parsing ─────────────────────────────────────────────────────────

SKIP_MIGRATE=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-migrate) SKIP_MIGRATE=true  ;;
    --dry-run)      DRY_RUN=true       ;;
    --help|-h)
      echo "Usage: $SCRIPT_NAME [--skip-migrate] [--dry-run]"
      exit 0
      ;;
  esac
done

# ─── PID / lock file ─────────────────────────────────────────────────────────

readonly PID_FILE="${APP_DIR}/heady-manager.pid"
readonly LOCK_FILE="/tmp/heady-startup.lock"

# ─── Logging ─────────────────────────────────────────────────────────────────

LOG_LEVEL="${LOG_LEVEL:-info}"
LOG_FILE="${LOG_FILE:-${APP_DIR}/logs/startup.log}"

mkdir -p "$(dirname "$LOG_FILE")"

# ANSI colors (disabled when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local line="[$ts] [$level] $msg"
  echo "$line" >> "$LOG_FILE"

  case "$level" in
    ERROR) echo -e "${RED}${BOLD}[ERROR]${RESET} $msg" >&2 ;;
    WARN)  echo -e "${YELLOW}[WARN]${RESET}  $msg"      ;;
    OK)    echo -e "${GREEN}[OK]${RESET}    $msg"        ;;
    INFO)  echo -e "${CYAN}[INFO]${RESET}  $msg"        ;;
    DEBUG) [[ "$LOG_LEVEL" == "debug" ]] && echo "[DEBUG] $msg" ;;
  esac
}

log_info()  { log INFO  "$@"; }
log_ok()    { log OK    "$@"; }
log_warn()  { log WARN  "$@"; }
log_error() { log ERROR "$@"; }
log_debug() { log DEBUG "$@"; }

# ─── Environment loading ─────────────────────────────────────────────────────

ENV_FILE="${ENV_FILE:-${APP_DIR}/.env.production}"
if [[ -f "$ENV_FILE" ]]; then
  log_info "Loading environment from $ENV_FILE"
  # shellcheck disable=SC2046
  set -a
  # Source only variable assignments (skip comments and blanks)
  # Use 'grep' + 'eval' approach to avoid subshell issues
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "${line// }" ]] && continue
    # Strip inline comments
    line="${line%%#*}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    eval "export $line" 2>/dev/null || true
  done < "$ENV_FILE"
  set +a
  log_ok "Environment loaded"
else
  log_warn "No .env.production found at $ENV_FILE — relying on existing environment"
fi

# ─── Process tracking ─────────────────────────────────────────────────────────

# Array of background process PIDs to manage
declare -a BG_PIDS=()
MAIN_PID=""

# ─── Graceful shutdown handler ────────────────────────────────────────────────

cleanup() {
  local exit_code="${1:-0}"
  log_info "Shutdown signal received — initiating graceful shutdown..."

  # Stop HeadyManager (main process)
  if [[ -n "$MAIN_PID" ]] && kill -0 "$MAIN_PID" 2>/dev/null; then
    log_info "Sending SIGTERM to HeadyManager (PID $MAIN_PID)..."
    kill -SIGTERM "$MAIN_PID" 2>/dev/null || true
    # Wait up to 30s for graceful shutdown
    local wait_count=0
    while kill -0 "$MAIN_PID" 2>/dev/null && [[ $wait_count -lt 30 ]]; do
      sleep 1
      ((wait_count++))
    done
    if kill -0 "$MAIN_PID" 2>/dev/null; then
      log_warn "HeadyManager did not stop within 30s — sending SIGKILL"
      kill -SIGKILL "$MAIN_PID" 2>/dev/null || true
    else
      log_ok "HeadyManager stopped gracefully"
    fi
  fi

  # Stop background processes
  for pid in "${BG_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log_info "Stopping background process PID $pid..."
      kill -SIGTERM "$pid" 2>/dev/null || true
    fi
  done

  # Remove PID file
  [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
  [[ -f "$LOCK_FILE" ]] && rm -f "$LOCK_FILE"

  log_info "Shutdown complete. Exit code: $exit_code"
  exit "$exit_code"
}

trap 'cleanup 0' SIGTERM SIGINT SIGQUIT
trap 'cleanup 1' ERR

# ─── Startup lock ─────────────────────────────────────────────────────────────

acquire_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local lock_pid
    lock_pid="$(cat "$LOCK_FILE" 2>/dev/null || echo '')"
    if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
      log_error "Another startup is already in progress (PID $lock_pid). Aborting."
      exit 1
    else
      log_warn "Stale lock file found — removing."
      rm -f "$LOCK_FILE"
    fi
  fi
  echo "$$" > "$LOCK_FILE"
}

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================

PREFLIGHT_ERRORS=0

preflight_fail() {
  log_error "PREFLIGHT FAILED: $*"
  ((PREFLIGHT_ERRORS++))
}

# ── 1. Required environment variables ────────────────────────────────────────

check_required_env() {
  log_info "Checking required environment variables..."

  local required_vars=(
    "DATABASE_URL_DIRECT"
    "DATABASE_URL"
    "REDIS_URL"
    "AUTH_SECRET"
    "SESSION_SECRET"
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "PRIMARY_DOMAIN"
    "API_BASE_URL"
    "APP_BASE_URL"
    "NODE_ENV"
    "PORT"
  )

  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      preflight_fail "Required env var '$var' is not set"
    fi
  done

  # Check for un-rotated CHANGE_ME placeholders
  local change_me_vars=()
  while IFS= read -r line; do
    if [[ "$line" == *"CHANGE_ME"* ]]; then
      local var_name="${line%%=*}"
      change_me_vars+=("$var_name")
    fi
  done < <(env | grep CHANGE_ME 2>/dev/null || true)

  if [[ ${#change_me_vars[@]} -gt 0 ]]; then
    preflight_fail "Unrotated CHANGE_ME placeholder(s) detected: ${change_me_vars[*]}"
  fi

  if [[ "${NODE_ENV:-}" != "production" ]]; then
    log_warn "NODE_ENV is '${NODE_ENV:-unset}' — expected 'production'"
  fi

  log_ok "Environment variables OK"
}

# ── 2. PostgreSQL connectivity ────────────────────────────────────────────────

check_postgres() {
  log_info "Checking PostgreSQL connectivity..."

  local db_url="${DATABASE_URL_DIRECT:-$DATABASE_URL}"
  local max_retries=20
  local retry_interval=3
  local attempt=0

  while [[ $attempt -lt $max_retries ]]; do
    ((attempt++))
    if node -e "
      import pg from 'pg';
      const p = new pg.Pool({ connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
      p.query('SELECT 1').then(() => { p.end(); process.exit(0); }).catch(() => { p.end(); process.exit(1); });
    " --input-type=module 2>/dev/null; then
      log_ok "PostgreSQL is reachable (attempt $attempt/$max_retries)"
      return 0
    fi

    # Fallback: use pg_isready if psql-client available
    if command -v pg_isready &>/dev/null; then
      local pg_host="${POSTGRES_HOST:-localhost}"
      local pg_port="${POSTGRES_PORT:-5432}"
      local pg_db="${POSTGRES_DB:-heady_production}"
      local pg_user="${POSTGRES_USER:-heady}"
      if pg_isready -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" -t 5 &>/dev/null; then
        log_ok "PostgreSQL is reachable (pg_isready, attempt $attempt/$max_retries)"
        return 0
      fi
    fi

    log_warn "PostgreSQL not ready yet (attempt $attempt/$max_retries) — waiting ${retry_interval}s..."
    sleep "$retry_interval"
  done

  preflight_fail "PostgreSQL is not reachable after $max_retries attempts"
}

# ── 3. Redis connectivity ─────────────────────────────────────────────────────

check_redis() {
  log_info "Checking Redis connectivity..."

  local max_retries=15
  local retry_interval=2
  local attempt=0

  while [[ $attempt -lt $max_retries ]]; do
    ((attempt++))
    if node -e "
      import Redis from 'ioredis';
      const r = new Redis(process.env.REDIS_URL, { connectTimeout: 5000, maxRetriesPerRequest: 1 });
      r.ping().then(res => { r.quit(); process.exit(res === 'PONG' ? 0 : 1); }).catch(() => { r.quit(); process.exit(1); });
    " --input-type=module 2>/dev/null; then
      log_ok "Redis is reachable (attempt $attempt/$max_retries)"
      return 0
    fi

    log_warn "Redis not ready yet (attempt $attempt/$max_retries) — waiting ${retry_interval}s..."
    sleep "$retry_interval"
  done

  preflight_fail "Redis is not reachable after $max_retries attempts"
}

# ── 4. Node.js version ────────────────────────────────────────────────────────

check_node_version() {
  log_info "Checking Node.js version..."
  local node_version
  node_version="$(node --version 2>/dev/null || echo 'none')"
  local major="${node_version//v/}"
  major="${major%%.*}"

  if [[ "$node_version" == "none" ]]; then
    preflight_fail "Node.js not found in PATH"
    return
  fi

  if [[ "$major" -lt 20 ]]; then
    preflight_fail "Node.js v20+ required (found $node_version)"
    return
  fi

  log_ok "Node.js $node_version OK"
}

# ── 5. File system prerequisites ──────────────────────────────────────────────

check_filesystem() {
  log_info "Checking required directories and files..."

  local dirs=(
    "${APP_DIR}/logs"
    "${VECTOR_SHARD_PATH:-${APP_DIR}/data/vector-shards}"
    "${APP_DIR}/data"
  )

  for d in "${dirs[@]}"; do
    if [[ ! -d "$d" ]]; then
      mkdir -p "$d" && log_ok "Created directory: $d" || preflight_fail "Cannot create directory: $d"
    fi
  done

  local required_files=(
    "${APP_DIR}/package.json"
  )

  for f in "${required_files[@]}"; do
    if [[ ! -f "$f" ]]; then
      preflight_fail "Required file missing: $f"
    fi
  done

  log_ok "Filesystem checks passed"
}

# ── 6. Memory check ───────────────────────────────────────────────────────────

check_memory() {
  log_info "Checking available memory..."
  if command -v free &>/dev/null; then
    local available_mb
    available_mb=$(free -m | awk 'NR==2 {print $7}')
    if [[ "${available_mb:-0}" -lt 256 ]]; then
      log_warn "Low available memory: ${available_mb}MB (recommend ≥256MB free)"
    else
      log_ok "Available memory: ${available_mb}MB"
    fi
  fi
}

# =============================================================================
# INITIALIZATION STEPS
# =============================================================================

# ── Run database migrations ───────────────────────────────────────────────────

run_migrations() {
  if [[ "$SKIP_MIGRATE" == "true" ]]; then
    log_warn "--skip-migrate flag set — skipping database migrations"
    return 0
  fi

  log_info "Running database migrations (direct connection)..."
  local migrate_script="${APP_DIR}/scripts/migrate.js"

  if [[ ! -f "$migrate_script" ]]; then
    log_error "Migration script not found: $migrate_script"
    exit 1
  fi

  if node "$migrate_script"; then
    log_ok "Database migrations complete"
  else
    log_error "Database migration failed"
    exit 1
  fi
}

# ── Verify vector memory tables ───────────────────────────────────────────────

verify_vector_tables() {
  log_info "Verifying vector memory tables..."
  local result
  result=$(node -e "
    import pg from 'pg';
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL });
    const res = await pool.query(\`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('memory_vectors', 'memory_baseline_vectors')
      ORDER BY table_name
    \`);
    console.log(res.rows.map(r => r.table_name).join(','));
    await pool.end();
  " --input-type=module 2>/dev/null || echo "error")

  if [[ "$result" == "memory_baseline_vectors,memory_vectors" ]]; then
    log_ok "Vector memory tables verified: memory_vectors, memory_baseline_vectors"
  else
    log_warn "Vector memory tables not found (result: $result) — run migrations first"
  fi
}

# ── Initialize HeadyBee template registry ────────────────────────────────────

init_bee_templates() {
  log_info "Initializing HeadyBee template registry..."
  local registry_path="${HEADY_REGISTRY_PATH:-${APP_DIR}/heady-registry.json}"

  if [[ ! -f "$registry_path" ]]; then
    log_info "Creating initial HeadyBee registry at $registry_path"
    cat > "$registry_path" << 'JSON'
{
  "version": "1.0.0",
  "initialized_at": null,
  "templates": {
    "cosmic-command":   { "id": "cosmic-command",   "palette": "cosmic",  "status": "active" },
    "emerald-forge":    { "id": "emerald-forge",     "palette": "emerald", "status": "active" },
    "amber-oracle":     { "id": "amber-oracle",      "palette": "amber",   "status": "active" },
    "rose-garden":      { "id": "rose-garden",       "palette": "rose",    "status": "active" },
    "obsidian-temple":  { "id": "obsidian-temple",   "palette": "obsidian","status": "active" },
    "sapphire-matrix":  { "id": "sapphire-matrix",   "palette": "sapphire","status": "active" },
    "solar-commons":    { "id": "solar-commons",     "palette": "solar",   "status": "active" }
  },
  "swarms": {
    "operations-swarm":         { "allocation": 34, "priority": 1 },
    "intelligence-swarm":       { "allocation": 21, "priority": 2 },
    "creation-swarm":           { "allocation": 21, "priority": 3 },
    "security-swarm":           { "allocation": 13, "priority": 4 },
    "edge-cloud-swarm":         { "allocation": 8,  "priority": 5 },
    "companion-swarm":          { "allocation": 8,  "priority": 6 },
    "analytics-swarm":          { "allocation": 5,  "priority": 7 },
    "sacred-governance-swarm":  { "allocation": 5,  "priority": 8 }
  }
}
JSON
    # Stamp the initialized_at timestamp
    node -e "
      import fs from 'fs';
      const p = '${registry_path}';
      const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
      reg.initialized_at = new Date().toISOString();
      fs.writeFileSync(p, JSON.stringify(reg, null, 2));
    " --input-type=module 2>/dev/null || true
  fi

  log_ok "HeadyBee template registry initialized ($(jq '.templates | length' "$registry_path" 2>/dev/null || echo '?') templates, $(jq '.swarms | length' "$registry_path" 2>/dev/null || echo '?') swarms)"
}

# ── Initialize HeadySwarm configurations ─────────────────────────────────────

init_swarm_configs() {
  log_info "Initializing HeadySwarm configurations..."
  # Verify swarm config file exists; create a stub if not
  local swarm_config_path="${APP_DIR}/data/swarm-configs.json"

  if [[ ! -f "$swarm_config_path" ]]; then
    cat > "$swarm_config_path" << 'JSON'
{
  "version": "1.0.0",
  "initialized_at": null,
  "active_swarms": [],
  "fibonacci_allocations": {
    "operations-swarm":         34,
    "intelligence-swarm":       21,
    "creation-swarm":           21,
    "security-swarm":           13,
    "edge-cloud-swarm":          8,
    "companion-swarm":           8,
    "analytics-swarm":           5,
    "sacred-governance-swarm":   5
  }
}
JSON
    node -e "
      import fs from 'fs';
      const p = '${swarm_config_path}';
      const c = JSON.parse(fs.readFileSync(p, 'utf8'));
      c.initialized_at = new Date().toISOString();
      fs.writeFileSync(p, JSON.stringify(c, null, 2));
    " --input-type=module 2>/dev/null || true
  fi

  log_ok "HeadySwarm configurations initialized"
}

# =============================================================================
# BACKGROUND PROCESS LAUNCHERS
# =============================================================================

# ── Health monitor ────────────────────────────────────────────────────────────

start_health_monitor() {
  local monitor_script="${APP_DIR}/src/monitoring/health-monitor.js"
  if [[ ! -f "$monitor_script" ]]; then
    log_warn "health-monitor.js not found — skipping health monitor"
    return 0
  fi

  log_info "Starting health monitor..."
  node "${monitor_script}" \
    >> "${APP_DIR}/logs/health-monitor.log" 2>&1 &
  local pid=$!
  BG_PIDS+=("$pid")
  echo "$pid" > "${APP_DIR}/health-monitor.pid"
  log_ok "Health monitor started (PID $pid)"
}

# ── Drift detector ────────────────────────────────────────────────────────────

start_drift_detector() {
  local drift_script="${APP_DIR}/src/monitoring/drift-detector.js"
  if [[ ! -f "$drift_script" ]]; then
    log_warn "drift-detector.js not found — skipping drift detector"
    return 0
  fi

  log_info "Starting drift detector..."
  node "${drift_script}" \
    >> "${APP_DIR}/logs/drift-detector.log" 2>&1 &
  local pid=$!
  BG_PIDS+=("$pid")
  echo "$pid" > "${APP_DIR}/drift-detector.pid"
  log_ok "Drift detector started (PID $pid)"
}

# =============================================================================
# MAIN STARTUP SEQUENCE
# =============================================================================

main() {
  log_info "============================================================"
  log_info "Heady Sovereign AI Platform — Startup Sequence"
  log_info "Timestamp : $STARTUP_TIMESTAMP"
  log_info "App dir   : $APP_DIR"
  log_info "Env       : ${NODE_ENV:-unset}"
  log_info "Dry run   : $DRY_RUN"
  log_info "============================================================"

  # Acquire startup lock
  acquire_lock

  # ── Phase 1: Pre-flight ───────────────────────────────────────────────────

  log_info "--- Phase 1: Pre-flight checks ---"
  check_node_version
  check_required_env
  check_filesystem
  check_memory
  check_postgres
  check_redis

  if [[ $PREFLIGHT_ERRORS -gt 0 ]]; then
    log_error "Pre-flight failed with $PREFLIGHT_ERRORS error(s). Aborting."
    rm -f "$LOCK_FILE"
    exit 2
  fi
  log_ok "All pre-flight checks passed"

  # ── Dry run exit ──────────────────────────────────────────────────────────

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "DRY RUN — pre-flight complete. Exiting without starting processes."
    rm -f "$LOCK_FILE"
    exit 0
  fi

  # ── Phase 2: Database setup ───────────────────────────────────────────────

  log_info "--- Phase 2: Database setup ---"
  run_migrations
  verify_vector_tables

  # ── Phase 3: Platform initialization ─────────────────────────────────────

  log_info "--- Phase 3: Platform initialization ---"
  init_bee_templates
  init_swarm_configs

  # ── Phase 4: Background processes ─────────────────────────────────────────

  log_info "--- Phase 4: Starting background processes ---"
  start_health_monitor
  start_drift_detector

  # Release startup lock (main process is about to take over)
  rm -f "$LOCK_FILE"

  # ── Phase 5: Start HeadyManager ───────────────────────────────────────────

  log_info "--- Phase 5: Starting HeadyManager ---"

  local manager_script="${APP_DIR}/heady-manager.js"
  if [[ ! -f "$manager_script" ]]; then
    log_warn "heady-manager.js not found at $APP_DIR — falling back to node src/index.js"
    manager_script="${APP_DIR}/src/index.js"
  fi

  if [[ ! -f "$manager_script" ]]; then
    log_error "No entry point found. Expected heady-manager.js or src/index.js in $APP_DIR"
    cleanup 1
  fi

  log_info "Starting HeadyManager: node $manager_script"
  log_info "Logs: ${APP_DIR}/logs/heady-manager.log"

  # Start HeadyManager — foreground so the container stays alive
  # stdout/stderr are tee'd to both the terminal and log file
  exec node "$manager_script" \
    >> >(tee -a "${APP_DIR}/logs/heady-manager.log") \
    2>> >(tee -a "${APP_DIR}/logs/heady-manager.log" >&2) &

  MAIN_PID=$!
  echo "$MAIN_PID" > "$PID_FILE"
  log_ok "HeadyManager started (PID $MAIN_PID)"

  log_info "============================================================"
  log_info "Heady startup complete — all systems nominal"
  log_info "Manager PID : $MAIN_PID"
  log_info "PID file    : $PID_FILE"
  log_info "Listening on: ${PORT:-8080}"
  log_info "============================================================"

  # Wait for HeadyManager — when it exits, trigger cleanup
  wait "$MAIN_PID"
  local exit_status=$?
  log_warn "HeadyManager exited with status $exit_status"
  cleanup "$exit_status"
}

# Run
main "$@"
