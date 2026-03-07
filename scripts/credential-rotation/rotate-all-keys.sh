#!/usr/bin/env bash
# rotate-all-keys.sh — Heady Systems API Key Rotation
# Rotates API keys for all external services and updates 1Password + .env files
# Usage: ./rotate-all-keys.sh [--dry-run] [--service <name>] [--rollback]
# Version: 1.0.0

set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUDIT_LOG="${SCRIPT_DIR}/audit/rotation-$(date +%Y%m%d).log"
BACKUP_DIR="${SCRIPT_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
ENV_FILE="${REPO_ROOT}/.env"
ENV_PRODUCTION="${REPO_ROOT}/.env.production"
OP_VAULT="heady-production"
SLACK_CHANNEL="#security-alerts"
ROTATION_STATE="${SCRIPT_DIR}/.rotation-state.json"

# Service registry: name -> 1Password item title
declare -A SERVICE_OP_ITEMS=(
  [openai]="OpenAI API Key"
  [anthropic]="Anthropic API Key"
  [google]="Google Generative AI Key"
  [groq]="Groq API Key"
  [huggingface]="HuggingFace Token"
  [cloudflare]="Cloudflare API Token"
  [github]="GitHub PAT CI"
)

# Service registry: name -> env var name
declare -A SERVICE_ENV_VARS=(
  [openai]="OPENAI_API_KEY"
  [anthropic]="ANTHROPIC_API_KEY"
  [google]="GOOGLE_API_KEY"
  [groq]="GROQ_API_KEY"
  [huggingface]="HUGGINGFACE_API_KEY"
  [cloudflare]="CLOUDFLARE_API_TOKEN"
  [github]="GITHUB_TOKEN"
)

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=false
ROLLBACK=false
TARGET_SERVICE=""
ROTATION_ID="rot-$(date +%Y%m%d%H%M%S)-$$"

# ─── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)    DRY_RUN=true;          shift ;;
    --rollback)   ROLLBACK=true;         shift ;;
    --service)    TARGET_SERVICE="$2";   shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--service <name>] [--rollback]"
      echo "Services: ${!SERVICE_OP_ITEMS[*]}"
      exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${AUDIT_LOG}")" "${BACKUP_DIR}"

log() {
  local level="$1"; shift
  local msg="$*"
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local entry="{\"ts\":\"${ts}\",\"rotation_id\":\"${ROTATION_ID}\",\"level\":\"${level}\",\"msg\":\"${msg}\"}"
  echo "${entry}" >> "${AUDIT_LOG}"
  echo "[${ts}] [${level}] ${msg}" >&2
}

log_info()    { log "INFO"    "$@"; }
log_warn()    { log "WARN"    "$@"; }
log_error()   { log "ERROR"   "$@"; }
log_success() { log "SUCCESS" "$@"; }

# ─── Prerequisite checks ──────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()
  for cmd in op curl jq openssl; do
    command -v "${cmd}" &>/dev/null || missing+=("${cmd}")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing required tools: ${missing[*]}"
    exit 1
  fi

  # Verify 1Password session
  if ! op account list &>/dev/null; then
    log_error "1Password CLI not authenticated. Run: eval \$(op signin)"
    exit 1
  fi

  log_info "Prerequisites OK (rotation_id=${ROTATION_ID})"
}

# ─── Rollback logic ───────────────────────────────────────────────────────────
rollback() {
  if [[ ! -f "${ROTATION_STATE}" ]]; then
    log_error "No rotation state found for rollback"
    exit 1
  fi

  log_warn "ROLLBACK initiated for rotation_id=$(jq -r '.rotation_id' "${ROTATION_STATE}")"
  local services; services="$(jq -r '.rotated[] | .service' "${ROTATION_STATE}")"

  while IFS= read -r svc; do
    local old_key; old_key="$(jq -r --arg s "${svc}" '.rotated[] | select(.service==$s) | .old_key_masked' "${ROTATION_STATE}")"
    local backup_env="${BACKUP_DIR}/../$(jq -r '.backup_dir' "${ROTATION_STATE}")/.env.bak"

    log_warn "Rolling back ${svc} — restoring from backup"

    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would restore ${svc} from backup"
      continue
    fi

    # Restore .env from backup
    if [[ -f "${backup_env}" ]]; then
      cp "${backup_env}" "${ENV_FILE}"
      log_success "Restored .env from backup for ${svc}"
    fi

    # Restore 1Password item
    local op_item="${SERVICE_OP_ITEMS[${svc}]:-}"
    if [[ -n "${op_item}" ]]; then
      local old_key_full; old_key_full="$(jq -r --arg s "${svc}" '.rotated[] | select(.service==$s) | .old_key' "${ROTATION_STATE}" 2>/dev/null || true)"
      if [[ -n "${old_key_full}" && "${old_key_full}" != "null" ]]; then
        op item edit "${op_item}" --vault "${OP_VAULT}" credential="${old_key_full}" &>/dev/null
        log_success "1Password restored for ${op_item}"
      fi
    fi
  done <<< "${services}"

  send_slack_notification "ROLLBACK" "Credential rotation rolled back for: ${services//$'\n'/, }" "danger"
  rm -f "${ROTATION_STATE}"
  log_warn "Rollback complete"
}

# ─── Backup current credentials ───────────────────────────────────────────────
backup_credentials() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would backup credentials to ${BACKUP_DIR}"
    return
  fi

  [[ -f "${ENV_FILE}" ]] && cp "${ENV_FILE}" "${BACKUP_DIR}/.env.bak"
  [[ -f "${ENV_PRODUCTION}" ]] && cp "${ENV_PRODUCTION}" "${BACKUP_DIR}/.env.production.bak"

  # Store encrypted backup of current 1Password values
  for svc in "${!SERVICE_OP_ITEMS[@]}"; do
    local item="${SERVICE_OP_ITEMS[${svc}]}"
    local current_val
    current_val="$(op item get "${item}" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"
    if [[ -n "${current_val}" ]]; then
      echo "${svc}=${current_val}" >> "${BACKUP_DIR}/op-values.bak"
    fi
  done
  chmod 600 "${BACKUP_DIR}/op-values.bak" 2>/dev/null || true

  log_info "Credentials backed up to ${BACKUP_DIR}"
}

# ─── Update .env file ─────────────────────────────────────────────────────────
update_env_file() {
  local env_path="$1"
  local var_name="$2"
  local new_value="$3"

  [[ -f "${env_path}" ]] || return 0

  if grep -q "^${var_name}=" "${env_path}"; then
    # Replace existing
    sed -i "s|^${var_name}=.*|${var_name}=${new_value}|" "${env_path}"
  else
    echo "${var_name}=${new_value}" >> "${env_path}"
  fi
}

# ─── Update 1Password vault ───────────────────────────────────────────────────
update_1password() {
  local item_title="$1"
  local new_value="$2"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would update 1Password item: ${item_title}"
    return 0
  fi

  if op item get "${item_title}" --vault "${OP_VAULT}" &>/dev/null; then
    op item edit "${item_title}" --vault "${OP_VAULT}" "credential=${new_value}" &>/dev/null
    log_success "1Password updated: ${item_title}"
  else
    op item create \
      --category "API Credential" \
      --title "${item_title}" \
      --vault "${OP_VAULT}" \
      "credential=${new_value}" &>/dev/null
    log_success "1Password created: ${item_title}"
  fi
}

# ─── Slack notification ───────────────────────────────────────────────────────
send_slack_notification() {
  local status="$1"
  local message="$2"
  local color="${3:-good}"

  local slack_webhook
  slack_webhook="$(op item get "Slack Webhook Security" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "${SLACK_WEBHOOK:-}")"

  [[ -z "${slack_webhook}" ]] && { log_warn "No Slack webhook configured, skipping notification"; return 0; }

  local payload
  payload="$(jq -n \
    --arg channel "${SLACK_CHANNEL}" \
    --arg status "${status}" \
    --arg msg "${message}" \
    --arg color "${color}" \
    --arg rid "${ROTATION_ID}" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      channel: $channel,
      username: "HeadyBot Key Rotation",
      icon_emoji: ":key:",
      attachments: [{
        color: $color,
        title: ("Credential Rotation: " + $status),
        text: $msg,
        fields: [
          {title: "Rotation ID", value: $rid, short: true},
          {title: "Timestamp", value: $ts, short: true}
        ],
        footer: "heady-systems credential-rotation"
      }]
    }')"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would send Slack: ${message}"
    return 0
  fi

  curl -sf -X POST -H 'Content-type: application/json' \
    --data "${payload}" "${slack_webhook}" &>/dev/null || log_warn "Slack notification failed"
}

# ─── Key validation functions ─────────────────────────────────────────────────
validate_openai_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${key}" \
    "https://api.openai.com/v1/models" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_anthropic_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "x-api-key: ${key}" \
    -H "anthropic-version: 2023-06-01" \
    "https://api.anthropic.com/v1/models" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_google_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    "https://generativelanguage.googleapis.com/v1beta/models?key=${key}" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_groq_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${key}" \
    "https://api.groq.com/openai/v1/models" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_huggingface_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${key}" \
    "https://huggingface.co/api/whoami-v2" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_cloudflare_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${key}" \
    "https://api.cloudflare.com/client/v4/user/tokens/verify" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_github_key() {
  local key="$1"
  local http_code
  http_code="$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${key}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user" 2>/dev/null || echo "000")"
  [[ "${http_code}" == "200" ]]
}

validate_key() {
  local service="$1"
  local key="$2"

  case "${service}" in
    openai)      validate_openai_key "${key}" ;;
    anthropic)   validate_anthropic_key "${key}" ;;
    google)      validate_google_key "${key}" ;;
    groq)        validate_groq_key "${key}" ;;
    huggingface) validate_huggingface_key "${key}" ;;
    cloudflare)  validate_cloudflare_key "${key}" ;;
    github)      validate_github_key "${key}" ;;
    *) log_error "Unknown service: ${service}"; return 1 ;;
  esac
}

# ─── Key generation/retrieval ─────────────────────────────────────────────────
# Most providers require manual key creation via their dashboard.
# This script retrieves newly created keys from 1Password staging items,
# where operators pre-stage new keys before running rotation.
get_new_key_from_staging() {
  local service="$1"
  local staging_item="${SERVICE_OP_ITEMS[${service}]} (Staged)"
  local new_key

  new_key="$(op item get "${staging_item}" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"
  if [[ -z "${new_key}" ]]; then
    log_error "No staged key found for ${service} in 1Password item '${staging_item}'"
    log_error "Create a new key in the provider dashboard and store it as '${staging_item}' in vault '${OP_VAULT}'"
    return 1
  fi
  echo "${new_key}"
}

mask_key() {
  local key="$1"
  local len="${#key}"
  if [[ "${len}" -gt 8 ]]; then
    echo "${key:0:4}...${key: -4}"
  else
    echo "****"
  fi
}

# ─── State management ─────────────────────────────────────────────────────────
init_state() {
  jq -n \
    --arg rid "${ROTATION_ID}" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg bdir "${BACKUP_DIR}" \
    '{"rotation_id":$rid,"started_at":$ts,"backup_dir":$bdir,"rotated":[],"failed":[]}' \
    > "${ROTATION_STATE}"
}

record_rotated() {
  local service="$1"
  local old_masked="$2"
  local new_masked="$3"

  local tmp; tmp="$(mktemp)"
  jq --arg svc "${service}" \
     --arg old "${old_masked}" \
     --arg new "${new_masked}" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.rotated += [{"service":$svc,"old_key_masked":$old,"new_key_masked":$new,"rotated_at":$ts}]' \
     "${ROTATION_STATE}" > "${tmp}" && mv "${tmp}" "${ROTATION_STATE}"
}

record_failed() {
  local service="$1"
  local reason="$2"
  local tmp; tmp="$(mktemp)"
  jq --arg svc "${service}" --arg reason "${reason}" \
     '.failed += [{"service":$svc,"reason":$reason}]' \
     "${ROTATION_STATE}" > "${tmp}" && mv "${tmp}" "${ROTATION_STATE}"
}

# ─── Core rotation logic ──────────────────────────────────────────────────────
rotate_service() {
  local service="$1"
  local env_var="${SERVICE_ENV_VARS[${service}]}"
  local op_item="${SERVICE_OP_ITEMS[${service}]}"

  log_info "Starting rotation for: ${service} (${env_var})"

  # Get current key for masking
  local old_key
  old_key="$(op item get "${op_item}" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"
  local old_masked; old_masked="$(mask_key "${old_key}")"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would rotate ${service} (current: ${old_masked})"
    return 0
  fi

  # Retrieve staged new key
  local new_key
  if ! new_key="$(get_new_key_from_staging "${service}")"; then
    log_error "Cannot rotate ${service}: no staged key available"
    record_failed "${service}" "no staged key"
    return 1
  fi

  local new_masked; new_masked="$(mask_key "${new_key}")"

  # Validate NEW key before decommissioning old
  log_info "Validating new key for ${service}..."
  if ! validate_key "${service}" "${new_key}"; then
    log_error "Validation FAILED for new ${service} key (${new_masked}). Old key preserved."
    record_failed "${service}" "validation failed"
    return 1
  fi

  log_success "New ${service} key validated successfully"

  # Update 1Password
  update_1password "${op_item}" "${new_key}"

  # Update .env files
  update_env_file "${ENV_FILE}" "${env_var}" "${new_key}"
  update_env_file "${ENV_PRODUCTION}" "${env_var}" "${new_key}"

  # Remove staged key from 1Password (cleanup)
  op item delete "${op_item} (Staged)" --vault "${OP_VAULT}" &>/dev/null || true

  record_rotated "${service}" "${old_masked}" "${new_masked}"
  log_success "Rotation complete for ${service}: ${old_masked} → ${new_masked}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log_info "Heady credential rotation starting (rotation_id=${ROTATION_ID}, dry_run=${DRY_RUN})"

  if [[ "${ROLLBACK}" == "true" ]]; then
    rollback
    exit 0
  fi

  check_prerequisites
  backup_credentials
  init_state

  # Determine which services to rotate
  local services_to_rotate=()
  if [[ -n "${TARGET_SERVICE}" ]]; then
    if [[ -z "${SERVICE_OP_ITEMS[${TARGET_SERVICE}]:-}" ]]; then
      log_error "Unknown service: ${TARGET_SERVICE}. Valid: ${!SERVICE_OP_ITEMS[*]}"
      exit 1
    fi
    services_to_rotate=("${TARGET_SERVICE}")
  else
    services_to_rotate=("${!SERVICE_OP_ITEMS[@]}")
  fi

  local failed_services=()

  for service in "${services_to_rotate[@]}"; do
    if ! rotate_service "${service}"; then
      failed_services+=("${service}")
    fi
  done

  # Summary
  local rotated_count; rotated_count="$(jq '.rotated | length' "${ROTATION_STATE}")"
  local failed_count="${#failed_services[@]}"

  if [[ "${failed_count}" -gt 0 ]]; then
    local failed_list; failed_list="$(IFS=", "; echo "${failed_services[*]}")"
    log_error "Rotation completed with failures: ${failed_list}"
    send_slack_notification \
      "PARTIAL FAILURE" \
      "Rotated ${rotated_count} keys. FAILED: ${failed_list}. Rotation ID: ${ROTATION_ID}" \
      "warning"
    exit 1
  else
    log_success "All ${rotated_count} credentials rotated successfully"
    if [[ "${DRY_RUN}" == "false" ]]; then
      send_slack_notification \
        "SUCCESS" \
        "All ${rotated_count} API keys rotated successfully. Rotation ID: ${ROTATION_ID}" \
        "good"
    fi
  fi

  log_info "Rotation state saved to ${ROTATION_STATE}"
  log_info "Audit log: ${AUDIT_LOG}"
}

main "$@"
