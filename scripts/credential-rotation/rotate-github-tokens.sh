#!/usr/bin/env bash
# rotate-github-tokens.sh — Heady Systems GitHub Token Rotation
# Rotates GitHub App installation tokens and CI PATs, updates GitHub Actions secrets.
# Usage: ./rotate-github-tokens.sh [--dry-run] [--org <org>]
# Version: 1.0.0

set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUDIT_LOG="${SCRIPT_DIR}/audit/github-rotation-$(date +%Y%m%d).log"
BACKUP_DIR="${SCRIPT_DIR}/backups/github-$(date +%Y%m%d_%H%M%S)"
ENV_FILE="${REPO_ROOT}/.env"
ENV_PRODUCTION="${REPO_ROOT}/.env.production"
OP_VAULT="heady-production"
ROTATION_ID="ghrot-$(date +%Y%m%d%H%M%S)-$$"
SLACK_CHANNEL="#security-alerts"
GITHUB_ORG="${GITHUB_ORG:-HeadyMe}"
GITHUB_API="https://api.github.com"

# GitHub Actions secrets to update per-repo (secret_name -> env var source)
declare -A REPO_SECRETS=(
  [OPENAI_API_KEY]="OPENAI_API_KEY"
  [ANTHROPIC_API_KEY]="ANTHROPIC_API_KEY"
  [GOOGLE_API_KEY]="GOOGLE_API_KEY"
  [DATABASE_URL]="DATABASE_URL"
  [REDIS_URL]="REDIS_URL"
  [CLOUDFLARE_API_TOKEN]="CLOUDFLARE_API_TOKEN"
)

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)  DRY_RUN=true;          shift ;;
    --org)      GITHUB_ORG="$2";       shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--org <org>]"
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
  echo "{\"ts\":\"${ts}\",\"rotation_id\":\"${ROTATION_ID}\",\"level\":\"${level}\",\"msg\":\"$*\"}" >> "${AUDIT_LOG}"
  echo "[${ts}] [${level}] $*" >&2
}
log_info()    { log "INFO"    "$@"; }
log_warn()    { log "WARN"    "$@"; }
log_error()   { log "ERROR"   "$@"; }
log_success() { log "SUCCESS" "$@"; }

# ─── Prereqs ──────────────────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()
  for cmd in op curl jq openssl gh; do
    command -v "${cmd}" &>/dev/null || missing+=("${cmd}")
  done
  [[ ${#missing[@]} -gt 0 ]] && { log_error "Missing tools: ${missing[*]}"; exit 1; }
  op account list &>/dev/null || { log_error "1Password CLI not authenticated"; exit 1; }
  gh auth status &>/dev/null || { log_error "GitHub CLI not authenticated. Run: gh auth login"; exit 1; }
}

# ─── GitHub API helpers ───────────────────────────────────────────────────────
gh_api_get() {
  local path="$1"
  local token="$2"
  curl -sf \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${GITHUB_API}${path}"
}

gh_api_put() {
  local path="$1"
  local token="$2"
  local body="$3"
  curl -sf -X PUT \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    --data "${body}" \
    "${GITHUB_API}${path}"
}

gh_api_post() {
  local path="$1"
  local token="$2"
  local body="$3"
  curl -sf -X POST \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    --data "${body}" \
    "${GITHUB_API}${path}"
}

# ─── Encrypt secret for GitHub Actions ───────────────────────────────────────
# Uses libsodium-sealed-box (via Python sodium bindings or openssl workaround)
encrypt_secret_for_github() {
  local public_key_b64="$1"
  local secret_value="$2"

  # Use Python with PyNaCl if available
  if python3 -c "import nacl" &>/dev/null 2>&1; then
    python3 - <<PYEOF
import base64
from nacl import encoding, public

public_key_bytes = base64.b64decode("${public_key_b64}")
pk = public.PublicKey(public_key_bytes)
sealed_box = public.SealedBox(pk)
encrypted = sealed_box.encrypt("${secret_value}".encode("utf-8"))
print(base64.b64encode(encrypted).decode("utf-8"))
PYEOF
  else
    # Fallback: install PyNaCl on the fly
    pip install PyNaCl --quiet 2>/dev/null
    python3 - <<PYEOF
import base64
from nacl import encoding, public

public_key_bytes = base64.b64decode("${public_key_b64}")
pk = public.PublicKey(public_key_bytes)
sealed_box = public.SealedBox(pk)
encrypted = sealed_box.encrypt("${secret_value}".encode("utf-8"))
print(base64.b64encode(encrypted).decode("utf-8"))
PYEOF
  fi
}

# ─── Update a single GitHub Actions secret ───────────────────────────────────
update_actions_secret() {
  local repo="$1"        # org/repo format
  local secret_name="$2"
  local secret_value="$3"
  local token="$4"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would update secret ${secret_name} in ${repo}"
    return 0
  fi

  # Get repo public key for encryption
  local key_response
  key_response="$(gh_api_get "/repos/${repo}/actions/secrets/public-key" "${token}")"
  local key_id; key_id="$(echo "${key_response}" | jq -r '.key_id')"
  local public_key; public_key="$(echo "${key_response}" | jq -r '.key')"

  if [[ -z "${key_id}" || "${key_id}" == "null" ]]; then
    log_error "Could not get public key for repo: ${repo}"
    return 1
  fi

  # Encrypt the secret value
  local encrypted_value
  encrypted_value="$(encrypt_secret_for_github "${public_key}" "${secret_value}")"

  # Upload encrypted secret
  local body; body="$(jq -n --arg kid "${key_id}" --arg ev "${encrypted_value}" \
    '{"encrypted_value":$ev,"key_id":$kid}')"

  gh_api_put "/repos/${repo}/actions/secrets/${secret_name}" "${token}" "${body}" &>/dev/null
  log_success "Updated Actions secret: ${repo}/${secret_name}"
}

# ─── Update org-level secret ──────────────────────────────────────────────────
update_org_secret() {
  local secret_name="$1"
  local secret_value="$2"
  local token="$3"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would update org secret ${secret_name} in ${GITHUB_ORG}"
    return 0
  fi

  # Get org public key
  local key_response
  key_response="$(gh_api_get "/orgs/${GITHUB_ORG}/actions/secrets/public-key" "${token}")"
  local key_id; key_id="$(echo "${key_response}" | jq -r '.key_id')"
  local public_key; public_key="$(echo "${key_response}" | jq -r '.key')"

  if [[ -z "${key_id}" || "${key_id}" == "null" ]]; then
    log_error "Could not get org public key for: ${GITHUB_ORG}"
    return 1
  fi

  local encrypted_value
  encrypted_value="$(encrypt_secret_for_github "${public_key}" "${secret_value}")"

  local body; body="$(jq -n \
    --arg kid "${key_id}" \
    --arg ev "${encrypted_value}" \
    '{"encrypted_value":$ev,"key_id":$kid,"visibility":"all"}')"

  gh_api_put "/orgs/${GITHUB_ORG}/actions/secrets/${secret_name}" "${token}" "${body}" &>/dev/null
  log_success "Updated org-level Actions secret: ${GITHUB_ORG}/${secret_name}"
}

# ─── Rotate GitHub App installation token ────────────────────────────────────
rotate_app_token() {
  log_info "=== GitHub App Installation Token Rotation ==="

  local app_id; app_id="$(op item get "GitHub App Heady" --vault "${OP_VAULT}" --fields "app_id" 2>/dev/null || echo "${GITHUB_APP_ID:-}")"
  local private_key_b64; private_key_b64="$(op item get "GitHub App Heady" --vault "${OP_VAULT}" --fields "private_key_b64" 2>/dev/null || echo "")"
  local install_id; install_id="$(op item get "GitHub App Heady" --vault "${OP_VAULT}" --fields "installation_id" 2>/dev/null || echo "${GITHUB_APP_INSTALLATION_ID:-}")"

  if [[ -z "${app_id}" || -z "${install_id}" ]]; then
    log_warn "GitHub App credentials not found in 1Password — skipping App token rotation"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would rotate GitHub App installation token for app_id=${app_id}"
    return 0
  fi

  # Decode private key
  local private_key_file; private_key_file="$(mktemp)"
  trap "rm -f ${private_key_file}" EXIT
  echo "${private_key_b64}" | base64 -d > "${private_key_file}"

  # Create JWT for GitHub App authentication
  local now; now="$(date +%s)"
  local exp=$(( now + 600 ))
  local header='{"alg":"RS256","typ":"JWT"}'
  local payload; payload="$(jq -n --arg iss "${app_id}" --arg iat "${now}" --arg exp "${exp}" \
    '{"iss":$iss,"iat":($iat|tonumber),"exp":($exp|tonumber)}')"

  local header_b64; header_b64="$(echo -n "${header}" | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
  local payload_b64; payload_b64="$(echo -n "${payload}" | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
  local signing_input="${header_b64}.${payload_b64}"
  local signature; signature="$(echo -n "${signing_input}" | openssl dgst -sha256 -sign "${private_key_file}" | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
  local jwt="${signing_input}.${signature}"

  # Get new installation token
  local token_response
  token_response="$(curl -sf -X POST \
    -H "Authorization: Bearer ${jwt}" \
    -H "Accept: application/vnd.github+json" \
    "${GITHUB_API}/app/installations/${install_id}/access_tokens")"

  local new_token; new_token="$(echo "${token_response}" | jq -r '.token')"
  if [[ -z "${new_token}" || "${new_token}" == "null" ]]; then
    log_error "Failed to get new GitHub App installation token"
    return 1
  fi

  # Validate the new token
  local user_info; user_info="$(gh_api_get "/app" "${new_token}")"
  if [[ -z "${user_info}" ]]; then
    log_error "GitHub App token validation failed"
    return 1
  fi

  # Store in 1Password
  op item edit "GitHub App Heady" --vault "${OP_VAULT}" \
    "installation_token=${new_token}" &>/dev/null
  log_success "GitHub App installation token rotated (expires: $(echo "${token_response}" | jq -r '.expires_at'))"
}

# ─── Rotate CI PAT ────────────────────────────────────────────────────────────
rotate_ci_pat() {
  log_info "=== GitHub CI PAT Rotation ==="

  # Note: GitHub Personal Access Tokens (classic) cannot be programmatically rotated.
  # GitHub Fine-Grained PATs can be refreshed via the API (beta).
  # This function handles Fine-Grained PAT refresh and stores the new token.

  local pat_op_item="GitHub PAT CI"
  local current_pat; current_pat="$(op item get "${pat_op_item}" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"

  if [[ -z "${current_pat}" ]]; then
    log_error "GitHub CI PAT not found in 1Password (item: '${pat_op_item}')"
    log_warn "Create a new PAT at https://github.com/settings/tokens and store as '${pat_op_item}' in vault '${OP_VAULT}'"
    return 1
  fi

  # Validate current PAT
  local user_info; user_info="$(gh_api_get "/user" "${current_pat}" 2>/dev/null || echo "{}")"
  local username; username="$(echo "${user_info}" | jq -r '.login')"

  if [[ "${username}" == "null" || -z "${username}" ]]; then
    log_error "Current CI PAT is invalid or expired"
    return 1
  fi

  log_info "Current CI PAT valid for user: ${username}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would stage new CI PAT for ${username}"
    log_warn "[DRY-RUN] NOTE: PAT rotation requires manual creation at https://github.com/settings/tokens"
    return 0
  fi

  # Check if a staged new PAT exists in 1Password
  local new_pat; new_pat="$(op item get "${pat_op_item} (Staged)" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"

  if [[ -z "${new_pat}" ]]; then
    log_warn "No staged PAT found. Manual steps required:"
    log_warn "  1. Go to https://github.com/settings/tokens/new"
    log_warn "  2. Create new PAT with scopes: repo, workflow, admin:org, read:packages"
    log_warn "  3. Store in 1Password as '${pat_op_item} (Staged)' in vault '${OP_VAULT}'"
    log_warn "  4. Re-run this script"
    return 1
  fi

  # Validate new PAT
  local new_user_info; new_user_info="$(gh_api_get "/user" "${new_pat}" 2>/dev/null || echo "{}")"
  local new_username; new_username="$(echo "${new_user_info}" | jq -r '.login')"

  if [[ "${new_username}" == "null" || -z "${new_username}" ]]; then
    log_error "Staged PAT validation FAILED"
    return 1
  fi

  log_success "New PAT validated for user: ${new_username}"

  # Update GitHub Actions secrets in all org repos with the new token
  log_info "Fetching all repos in org: ${GITHUB_ORG}"
  local repos; repos="$(gh api "/orgs/${GITHUB_ORG}/repos" --paginate 2>/dev/null | jq -r '.[].full_name')"

  # Update org-level GITHUB_TOKEN secret
  update_org_secret "HEADY_CI_TOKEN" "${new_pat}" "${new_pat}"

  # Update per-repo secrets
  while IFS= read -r repo; do
    [[ -z "${repo}" ]] && continue
    update_actions_secret "${repo}" "HEADY_CI_TOKEN" "${new_pat}" "${new_pat}" || \
      log_warn "Failed to update secret in ${repo}"
  done <<< "${repos}"

  # Update .env files
  local env_var="GITHUB_TOKEN"
  sed -i "s|^${env_var}=.*|${env_var}=${new_pat}|" "${ENV_FILE}" 2>/dev/null || true
  sed -i "s|^${env_var}=.*|${env_var}=${new_pat}|" "${ENV_PRODUCTION}" 2>/dev/null || true

  # Promote staged key in 1Password
  op item edit "${pat_op_item}" --vault "${OP_VAULT}" "credential=${new_pat}" &>/dev/null
  op item delete "${pat_op_item} (Staged)" --vault "${OP_VAULT}" &>/dev/null || true

  log_success "CI PAT rotated and all repo secrets updated"
}

# ─── Update all Actions secrets from .env ─────────────────────────────────────
update_all_actions_secrets() {
  log_info "=== Syncing GitHub Actions secrets from current .env ==="

  local ci_token; ci_token="$(op item get "GitHub PAT CI" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"
  [[ -z "${ci_token}" ]] && { log_error "No CI token available for secret sync"; return 1; }

  # Load env vars
  set -a; source "${ENV_PRODUCTION}" 2>/dev/null || source "${ENV_FILE}" 2>/dev/null || true; set +a

  log_info "Fetching repos in ${GITHUB_ORG}..."
  local repos; repos="$(gh api "/orgs/${GITHUB_ORG}/repos" --paginate 2>/dev/null | jq -r '.[].full_name')"

  # Update org-level secrets
  for secret_name in "${!REPO_SECRETS[@]}"; do
    local env_var="${REPO_SECRETS[${secret_name}]}"
    local val="${!env_var:-}"
    if [[ -n "${val}" ]]; then
      update_org_secret "${secret_name}" "${val}" "${ci_token}"
    fi
  done

  log_success "Actions secrets sync complete"
}

# ─── Validate repo access ─────────────────────────────────────────────────────
validate_repo_access() {
  local token="$1"
  log_info "Validating repository access with new token..."

  local repos
  repos="$(gh_api_get "/orgs/${GITHUB_ORG}/repos?per_page=5" "${token}" 2>/dev/null | jq -r '.[].name' 2>/dev/null || echo "")"

  if [[ -z "${repos}" ]]; then
    log_error "Cannot list repositories — token lacks org access"
    return 1
  fi

  local count; count="$(echo "${repos}" | wc -l | tr -d ' ')"
  log_success "Token validated — can access ${count} repos in ${GITHUB_ORG}"
}

# ─── Slack notification ───────────────────────────────────────────────────────
send_slack() {
  local status="$1"
  local msg="$2"
  local color="${3:-good}"
  local webhook
  webhook="$(op item get "Slack Webhook Security" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "${SLACK_WEBHOOK:-}")"
  [[ -z "${webhook}" ]] && return 0

  local payload; payload="$(jq -n \
    --arg ch "${SLACK_CHANNEL}" --arg st "${status}" --arg msg "${msg}" \
    --arg color "${color}" --arg rid "${ROTATION_ID}" \
    '{channel:$ch,username:"HeadyBot GitHub Rotation",icon_emoji:":octocat:",
      attachments:[{color:$color,title:("GitHub Token Rotation: "+$st),
        text:$msg,fields:[{title:"Rotation ID",value:$rid,short:true}]}]}')"

  [[ "${DRY_RUN}" == "true" ]] && { log_info "[DRY-RUN] Slack: ${msg}"; return 0; }
  curl -sf -X POST -H 'Content-type: application/json' --data "${payload}" "${webhook}" &>/dev/null || true
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log_info "GitHub token rotation starting (rotation_id=${ROTATION_ID}, org=${GITHUB_ORG}, dry_run=${DRY_RUN})"
  check_prerequisites

  local failed=false

  rotate_app_token  || { log_warn "App token rotation skipped/failed"; }
  rotate_ci_pat     || { log_error "CI PAT rotation failed"; failed=true; }

  if [[ "${failed}" != "true" ]]; then
    # After successful PAT rotation, sync all secrets
    update_all_actions_secrets || log_warn "Secret sync partially failed"

    # Validate final access
    local final_token; final_token="$(op item get "GitHub PAT CI" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "")"
    [[ -n "${final_token}" ]] && validate_repo_access "${final_token}"
  fi

  if [[ "${failed}" == "true" ]]; then
    log_error "GitHub token rotation completed with errors"
    send_slack "FAILURE" "GitHub token rotation encountered errors. Rotation ID: ${ROTATION_ID}" "danger"
    exit 1
  else
    log_success "GitHub token rotation complete (rotation_id=${ROTATION_ID})"
    [[ "${DRY_RUN}" == "false" ]] && send_slack "SUCCESS" "GitHub tokens rotated and Actions secrets updated. Rotation ID: ${ROTATION_ID}" "good"
  fi
}

main "$@"
