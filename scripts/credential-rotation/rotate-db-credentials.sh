#!/usr/bin/env bash
# rotate-db-credentials.sh — Heady Systems Database Credential Rotation
# Rotates PostgreSQL/Neon and Redis credentials with dual-password overlap.
# Usage: ./rotate-db-credentials.sh [--dry-run] [--service postgres|redis|all]
# Version: 1.0.0

set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUDIT_LOG="${SCRIPT_DIR}/audit/db-rotation-$(date +%Y%m%d).log"
BACKUP_DIR="${SCRIPT_DIR}/backups/db-$(date +%Y%m%d_%H%M%S)"
ENV_FILE="${REPO_ROOT}/.env"
ENV_PRODUCTION="${REPO_ROOT}/.env.production"
OP_VAULT="heady-production"
OVERLAP_SECONDS=300   # 5 minute dual-password overlap
ROTATION_ID="dbrot-$(date +%Y%m%d%H%M%S)-$$"
SLACK_CHANNEL="#security-alerts"

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=false
TARGET_SERVICE="all"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true;          shift ;;
    --service)   TARGET_SERVICE="$2";   shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--service postgres|redis|all]"
      exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${AUDIT_LOG}")" "${BACKUP_DIR}"

log() {
  local level="$1"; shift
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local entry="{\"ts\":\"${ts}\",\"rotation_id\":\"${ROTATION_ID}\",\"level\":\"${level}\",\"msg\":\"$*\"}"
  echo "${entry}" >> "${AUDIT_LOG}"
  echo "[${ts}] [${level}] $*" >&2
}
log_info()    { log "INFO"    "$@"; }
log_warn()    { log "WARN"    "$@"; }
log_error()   { log "ERROR"   "$@"; }
log_success() { log "SUCCESS" "$@"; }

# ─── Prerequisite checks ──────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()
  for cmd in op psql redis-cli openssl jq curl; do
    command -v "${cmd}" &>/dev/null || missing+=("${cmd}")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing tools: ${missing[*]}"
    exit 1
  fi
  op account list &>/dev/null || { log_error "1Password CLI not authenticated"; exit 1; }
}

# ─── Password generation ──────────────────────────────────────────────────────
generate_password() {
  # 32-byte URL-safe base64 password
  openssl rand -base64 32 | tr -d '/+=' | head -c 40
}

# ─── Env file helpers ─────────────────────────────────────────────────────────
get_env_var() {
  local var="$1"
  local file="${2:-${ENV_FILE}}"
  grep "^${var}=" "${file}" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo ""
}

set_env_var() {
  local var="$1"
  local val="$2"
  local file="${3:-${ENV_FILE}}"
  [[ -f "${file}" ]] || return 0
  if grep -q "^${var}=" "${file}"; then
    sed -i "s|^${var}=.*|${var}=${val}|" "${file}"
  else
    echo "${var}=${val}" >> "${file}"
  fi
}

# ─── Slack notification ───────────────────────────────────────────────────────
send_slack() {
  local status="$1"
  local msg="$2"
  local color="${3:-good}"
  local webhook
  webhook="$(op item get "Slack Webhook Security" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "${SLACK_WEBHOOK:-}")"
  [[ -z "${webhook}" ]] && return 0

  local payload
  payload="$(jq -n \
    --arg ch "${SLACK_CHANNEL}" \
    --arg st "${status}" \
    --arg msg "${msg}" \
    --arg color "${color}" \
    --arg rid "${ROTATION_ID}" \
    '{channel:$ch,username:"HeadyBot DB Rotation",icon_emoji:":database:",
      attachments:[{color:$color,title:("DB Credential Rotation: "+$st),
        text:$msg,fields:[{title:"Rotation ID",value:$rid,short:true}]}]}')"

  [[ "${DRY_RUN}" == "true" ]] && { log_info "[DRY-RUN] Slack: ${msg}"; return 0; }
  curl -sf -X POST -H 'Content-type: application/json' --data "${payload}" "${webhook}" &>/dev/null || true
}

# ─── PostgreSQL / Neon rotation ───────────────────────────────────────────────
rotate_postgres() {
  log_info "=== PostgreSQL/Neon credential rotation ==="

  # Load current connection details from 1Password
  local pg_op_item="Neon PostgreSQL"
  local current_url; current_url="$(op item get "${pg_op_item}" --vault "${OP_VAULT}" --fields "connection string" 2>/dev/null || get_env_var "DATABASE_URL")"

  if [[ -z "${current_url}" ]]; then
    log_error "Cannot find PostgreSQL connection string"
    return 1
  fi

  # Parse connection URL: postgresql://user:pass@host:port/dbname?sslmode=require
  local pg_user pg_host pg_port pg_db pg_sslmode
  pg_user="$(echo "${current_url}" | grep -oP '(?<=://)([^:]+)(?=:)')"
  pg_host="$(echo "${current_url}" | grep -oP '(?<=@)([^:/]+)')"
  pg_port="$(echo "${current_url}" | grep -oP '(?<=:)(\d+)(?=/)' | tail -1)"
  pg_db="$(echo "${current_url}" | grep -oP '(?<=/)([^?]+)')"
  pg_sslmode="$(echo "${current_url}" | grep -oP '(?<=sslmode=)[^&]+')"
  pg_port="${pg_port:-5432}"
  pg_sslmode="${pg_sslmode:-require}"

  local old_password; old_password="$(echo "${current_url}" | grep -oP '(?<=:)([^@]+)(?=@)')"
  local new_password; new_password="$(generate_password)"

  log_info "Generating new PostgreSQL password for user: ${pg_user}@${pg_host}:${pg_port}/${pg_db}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would rotate PostgreSQL password for ${pg_user}"
    return 0
  fi

  # Phase 1: Add new password (dual-password overlap)
  # Neon/PostgreSQL: ALTER USER supports multiple passwords via pg_hba or we use a temp role
  # Strategy: Create new password, keep old valid via connection pool for OVERLAP_SECONDS
  log_info "Phase 1: Setting new password (overlap period begins)"

  local alter_sql="ALTER USER ${pg_user} WITH PASSWORD '${new_password}';"

  PGPASSWORD="${old_password}" psql \
    "postgresql://${pg_user}@${pg_host}:${pg_port}/${pg_db}?sslmode=${pg_sslmode}" \
    -c "${alter_sql}" &>/dev/null || {
      log_error "Failed to set new PostgreSQL password"
      return 1
    }

  log_success "Phase 1: New password set. Starting ${OVERLAP_SECONDS}s overlap period..."

  # Test new password connectivity
  log_info "Testing new password connectivity..."
  local new_url="postgresql://${pg_user}:${new_password}@${pg_host}:${pg_port}/${pg_db}?sslmode=${pg_sslmode}"

  if ! PGPASSWORD="${new_password}" psql "${new_url}" -c "SELECT 1;" &>/dev/null; then
    log_error "New PostgreSQL password test FAILED — rolling back to old password"
    PGPASSWORD="${old_password}" psql \
      "postgresql://${pg_user}@${pg_host}:${pg_port}/${pg_db}?sslmode=${pg_sslmode}" \
      -c "ALTER USER ${pg_user} WITH PASSWORD '${old_password}';" &>/dev/null || true
    return 1
  fi

  log_success "New password validated. Waiting ${OVERLAP_SECONDS}s for in-flight connections..."

  # Phase 2: Wait for overlap period (connections using old password can drain)
  sleep "${OVERLAP_SECONDS}"

  # Phase 3: Update all services and config
  log_info "Phase 3: Updating connection strings in all services"

  # Update .env files
  set_env_var "DATABASE_URL" "${new_url}" "${ENV_FILE}"
  set_env_var "DATABASE_URL" "${new_url}" "${ENV_PRODUCTION}"

  # Update 1Password
  op item edit "${pg_op_item}" --vault "${OP_VAULT}" \
    "connection string=${new_url}" \
    "password=${new_password}" &>/dev/null
  log_success "1Password updated: ${pg_op_item}"

  # Check for service-specific DATABASE_URL variants
  for var in NEON_DATABASE_URL PG_DATABASE_URL HEADY_NEON_URL PGVECTOR_URL; do
    if get_env_var "${var}" &>/dev/null | grep -q "${pg_host}"; then
      set_env_var "${var}" "${new_url}" "${ENV_FILE}"
      set_env_var "${var}" "${new_url}" "${ENV_PRODUCTION}"
      log_info "Updated ${var}"
    fi
  done

  log_success "PostgreSQL rotation complete (overlap period ended)"
}

# ─── Redis rotation ───────────────────────────────────────────────────────────
rotate_redis() {
  log_info "=== Redis AUTH password rotation ==="

  local redis_op_item="Redis heady-kv"
  local current_url; current_url="$(op item get "${redis_op_item}" --vault "${OP_VAULT}" --fields "connection string" 2>/dev/null || get_env_var "REDIS_URL")"

  if [[ -z "${current_url}" ]]; then
    log_error "Cannot find Redis connection string"
    return 1
  fi

  # Parse: redis://:password@host:port/db or rediss://
  local redis_host redis_port redis_db redis_tls
  redis_host="$(echo "${current_url}" | grep -oP '(?<=@)([^:/]+)')"
  redis_port="$(echo "${current_url}" | grep -oP '(?<=:)(\d+)(?=/)' | tail -1)"
  redis_db="$(echo "${current_url}" | grep -oP '(?<=/)(\d+)$' || echo "0")"
  redis_port="${redis_port:-6379}"
  redis_db="${redis_db:-0}"

  local old_password
  old_password="$(echo "${current_url}" | grep -oP '(?<=://:)([^@]+)(?=@)' || echo "")"
  local new_password; new_password="$(generate_password)"

  local tls_flag=""
  [[ "${current_url}" == rediss://* ]] && tls_flag="--tls"

  log_info "Rotating Redis AUTH for ${redis_host}:${redis_port}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would rotate Redis password for ${redis_host}"
    return 0
  fi

  # Phase 1: Set new password (Redis CONFIG SET requirepass uses immediate effect)
  # Redis 6+ supports ACL users for dual-password; fallback to CONFIG SET
  log_info "Phase 1: Configuring new Redis password"

  local redis_cli_auth=()
  [[ -n "${old_password}" ]] && redis_cli_auth=(-a "${old_password}")

  # Check Redis version for ACL support
  local redis_version
  redis_version="$(redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
    "${redis_cli_auth[@]}" --no-auth-warning INFO server 2>/dev/null \
    | grep "redis_version" | cut -d: -f2 | tr -d '[:space:]')"

  local major_version="${redis_version%%.*}"

  if [[ "${major_version:-0}" -ge 6 ]]; then
    # Redis 6+: Use ACL for dual-password overlap
    log_info "Redis 6+ detected — using ACL dual-password strategy"

    # Add new password to default user ACL
    redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      "${redis_cli_auth[@]}" --no-auth-warning \
      ACL SETUSER default on ">=${new_password}" allkeys allchannels allcommands &>/dev/null

    log_success "Phase 1: New Redis password added (old still valid, overlap begins)"

    # Validate new password
    if ! redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      -a "${new_password}" --no-auth-warning PING &>/dev/null; then
      log_error "New Redis password validation FAILED"
      return 1
    fi

    log_info "New Redis password validated. Waiting ${OVERLAP_SECONDS}s..."
    sleep "${OVERLAP_SECONDS}"

    # Phase 2: Remove old password from ACL
    log_info "Phase 2: Removing old password from ACL"
    redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      -a "${new_password}" --no-auth-warning \
      ACL SETUSER default on "<${old_password}" &>/dev/null || true

    # Persist ACL changes
    redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      -a "${new_password}" --no-auth-warning ACL SAVE &>/dev/null || true

  else
    # Redis <6: CONFIG SET (instant cutover)
    log_warn "Redis <6 detected — no dual-password support, using instant cutover"
    redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      "${redis_cli_auth[@]}" --no-auth-warning \
      CONFIG SET requirepass "${new_password}" &>/dev/null

    # Validate
    if ! redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
      -a "${new_password}" --no-auth-warning PING &>/dev/null; then
      log_error "New Redis password validation FAILED — trying rollback"
      redis-cli ${tls_flag} -h "${redis_host}" -p "${redis_port}" \
        -a "${new_password}" --no-auth-warning \
        CONFIG SET requirepass "${old_password}" &>/dev/null || true
      return 1
    fi
  fi

  # Phase 3: Update connection strings
  local scheme="redis"
  [[ "${current_url}" == rediss://* ]] && scheme="rediss"
  local new_url="${scheme}://:${new_password}@${redis_host}:${redis_port}/${redis_db}"

  set_env_var "REDIS_URL" "${new_url}" "${ENV_FILE}"
  set_env_var "REDIS_URL" "${new_url}" "${ENV_PRODUCTION}"

  for var in HEADY_KV_URL HEADY_REDIS_URL UPSTASH_REDIS_URL; do
    if get_env_var "${var}" 2>/dev/null | grep -q "${redis_host}"; then
      set_env_var "${var}" "${new_url}" "${ENV_FILE}"
      set_env_var "${var}" "${new_url}" "${ENV_PRODUCTION}"
      log_info "Updated ${var}"
    fi
  done

  # Update 1Password
  op item edit "${redis_op_item}" --vault "${OP_VAULT}" \
    "connection string=${new_url}" \
    "password=${new_password}" &>/dev/null
  log_success "1Password updated: ${redis_op_item}"

  log_success "Redis rotation complete"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log_info "Heady DB credential rotation starting (rotation_id=${ROTATION_ID}, dry_run=${DRY_RUN})"
  check_prerequisites

  # Backup
  if [[ "${DRY_RUN}" == "false" ]]; then
    [[ -f "${ENV_FILE}" ]] && cp "${ENV_FILE}" "${BACKUP_DIR}/.env.bak"
    [[ -f "${ENV_PRODUCTION}" ]] && cp "${ENV_PRODUCTION}" "${BACKUP_DIR}/.env.production.bak"
    log_info "Backed up .env files to ${BACKUP_DIR}"
  fi

  local failed=false

  case "${TARGET_SERVICE}" in
    postgres)
      rotate_postgres || failed=true ;;
    redis)
      rotate_redis || failed=true ;;
    all)
      rotate_postgres || failed=true
      rotate_redis    || failed=true ;;
    *)
      log_error "Unknown service: ${TARGET_SERVICE}. Use: postgres, redis, all"
      exit 1 ;;
  esac

  if [[ "${failed}" == "true" ]]; then
    log_error "DB rotation completed with errors"
    [[ "${DRY_RUN}" == "false" ]] && \
      send_slack "FAILURE" "Database credential rotation encountered errors. Rotation ID: ${ROTATION_ID}" "danger"
    exit 1
  else
    log_success "DB rotation complete (rotation_id=${ROTATION_ID})"
    [[ "${DRY_RUN}" == "false" ]] && \
      send_slack "SUCCESS" "Database credentials rotated successfully. Rotation ID: ${ROTATION_ID}" "good"
  fi
}

main "$@"
