#!/usr/bin/env bash
# =============================================================================
# HeadyMe — Branch Protection Apply Script
# Applies enterprise-grade branch protection rules to all 13 HeadyMe repos
# via GitHub REST API (gh CLI or curl with GITHUB_TOKEN).
#
# Usage:
#   GITHUB_TOKEN=<your-token> ./branch-protection-apply.sh [--dry-run] [--repo <repo-name>]
#
# Flags:
#   --dry-run           Print API payloads without applying
#   --repo <name>       Apply only to a specific repo (default: all repos)
#   --org <name>        Override org name (default: HeadyMe)
#   --skip-signed       Skip "require signed commits" (useful for CI bootstrap)
#   --verbose           Print full API responses
#
# Requirements:
#   - GITHUB_TOKEN env var with scopes: repo, admin:org
#   - curl (or gh CLI — detected automatically)
#   - jq >= 1.6
# =============================================================================

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

readonly ORG_DEFAULT="HeadyMe"
readonly REPOS=(
  "Heady-pre-production-9f2f0642"
  "headysystems-production"
  "headymcp-production"
  "headyio-core"
  "headybot-core"
  "headybuddy-core"
  "headyapi-core"
  "headyos-core"
  "headymcp-core"
  "headyconnection-core"
  "headysystems-core"
  "headyme-core"
  "heady-docs"
)

# Status check context names that must pass before merge
readonly MAIN_STATUS_CHECKS=(
  "security-scan / sast"
  "security-scan / dependency-audit"
  "ci / test"
  "ci / lint"
  "ci / build"
)
readonly STAGING_STATUS_CHECKS=(
  "security-scan / sast"
  "ci / test"
  "ci / build"
)
readonly DEV_STATUS_CHECKS=(
  "ci / test"
  "ci / lint"
)

# ─────────────────────────────────────────────────────────────────────────────
# FLAGS
# ─────────────────────────────────────────────────────────────────────────────

DRY_RUN=false
VERBOSE=false
SKIP_SIGNED=false
TARGET_REPO=""
ORG="${ORG_DEFAULT}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)      DRY_RUN=true ;;
    --verbose)      VERBOSE=true ;;
    --skip-signed)  SKIP_SIGNED=true ;;
    --repo)         shift; TARGET_REPO="$1" ;;
    --org)          shift; ORG="$1" ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
  shift
done

# ─────────────────────────────────────────────────────────────────────────────
# PREREQUISITES CHECK
# ─────────────────────────────────────────────────────────────────────────────

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN environment variable is not set." >&2
  echo "       Generate a token at: https://github.com/settings/tokens" >&2
  echo "       Required scopes: repo, admin:org" >&2
  exit 1
fi

command -v jq >/dev/null 2>&1 || {
  echo "ERROR: jq is required but not installed. Install: https://jqlang.github.io/jq/" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || {
  echo "ERROR: curl is required but not installed." >&2
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

readonly API_BASE="https://api.github.com"
readonly LOG_PREFIX="[branch-protection]"
RESULTS_JSON="[]"

log()     { echo "${LOG_PREFIX} $*"; }
log_ok()  { echo "${LOG_PREFIX} ✓ $*"; }
log_err() { echo "${LOG_PREFIX} ✗ ERROR: $*" >&2; }
log_dry() { echo "${LOG_PREFIX} [DRY-RUN] $*"; }

# GitHub API call via curl
# Usage: github_api METHOD ENDPOINT PAYLOAD
github_api() {
  local method="$1"
  local endpoint="$2"
  local payload="${3:-}"
  local url="${API_BASE}${endpoint}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_dry "${method} ${url}"
    [[ -n "${payload}" ]] && echo "  Payload: $(echo "${payload}" | jq -c .)"
    echo '{"dry_run":true}'
    return 0
  fi

  local curl_args=(
    -s
    -X "${method}"
    -H "Authorization: Bearer ${GITHUB_TOKEN}"
    -H "Accept: application/vnd.github+json"
    -H "X-GitHub-Api-Version: 2022-11-28"
    -H "Content-Type: application/json"
  )

  [[ -n "${payload}" ]] && curl_args+=(-d "${payload}")

  local response
  response=$(curl "${curl_args[@]}" "${url}")

  if [[ "${VERBOSE}" == "true" ]]; then
    echo "  Response: $(echo "${response}" | jq -c .)"
  fi

  # Check for API errors
  local err_msg
  err_msg=$(echo "${response}" | jq -r '.message // empty')
  if [[ -n "${err_msg}" && "${err_msg}" != "null" ]]; then
    # Some 404s on branch existence are expected — surface them as warnings
    echo "${response}"
    return 1
  fi

  echo "${response}"
}

# Record result for summary
record_result() {
  local repo="$1" branch="$2" status="$3" message="$4"
  RESULTS_JSON=$(echo "${RESULTS_JSON}" | jq --arg r "${repo}" --arg b "${branch}" \
    --arg s "${status}" --arg m "${message}" \
    '. + [{"repo": $r, "branch": $b, "status": $s, "message": $m}]')
}

# Build required_status_checks JSON array
build_status_checks() {
  local -a checks=("$@")
  local json_checks="[]"
  for c in "${checks[@]}"; do
    json_checks=$(echo "${json_checks}" | jq --arg ctx "${c}" '. + [{"context": $ctx}]')
  done
  echo "${json_checks}"
}

# ─────────────────────────────────────────────────────────────────────────────
# BRANCH PROTECTION PAYLOADS
# ─────────────────────────────────────────────────────────────────────────────

# Apply main branch protection
apply_main_protection() {
  local repo="$1"
  local endpoint="/repos/${ORG}/${repo}/branches/main/protection"

  local status_checks
  status_checks=$(build_status_checks "${MAIN_STATUS_CHECKS[@]}")

  local require_signed="true"
  [[ "${SKIP_SIGNED}" == "true" ]] && require_signed="false"

  local payload
  payload=$(jq -n \
    --argjson sc "${status_checks}" \
    --argjson signed "${require_signed}" \
    '{
      required_status_checks: {
        strict: true,
        checks: $sc
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        dismissal_restrictions: {
          users: [],
          teams: ["core-team", "security-team"]
        },
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        required_approving_review_count: 1,
        require_last_push_approval: true
      },
      restrictions: {
        users: [],
        teams: ["devops-team"],
        apps: ["github-actions"]
      },
      required_linear_history: true,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
      lock_branch: false,
      allow_fork_syncing: false
    }')

  log "  Applying main branch protection to ${repo}..."
  if response=$(github_api PUT "${endpoint}" "${payload}"); then
    log_ok "  main branch protected for ${repo}"
    record_result "${repo}" "main" "success" "Branch protection applied"
  else
    local err
    err=$(echo "${response}" | jq -r '.message // "Unknown error"')
    log_err "  Failed to protect main branch for ${repo}: ${err}"
    record_result "${repo}" "main" "error" "${err}"
  fi

  # Apply signed commits requirement separately (requires different endpoint)
  if [[ "${require_signed}" == "true" && "${DRY_RUN}" == "false" ]]; then
    log "  Requiring signed commits for ${repo}/main..."
    if github_api POST "/repos/${ORG}/${repo}/branches/main/protection/required_signatures" "" >/dev/null; then
      log_ok "  Signed commits required for ${repo}/main"
    else
      log "  Note: Signed commits endpoint returned non-200 — may already be configured or unsupported for this repo"
    fi
  fi
}

# Apply staging branch protection
apply_staging_protection() {
  local repo="$1"
  local endpoint="/repos/${ORG}/${repo}/branches/staging/protection"

  local status_checks
  status_checks=$(build_status_checks "${STAGING_STATUS_CHECKS[@]}")

  local payload
  payload=$(jq -n \
    --argjson sc "${status_checks}" \
    '{
      required_status_checks: {
        strict: true,
        checks: $sc
      },
      enforce_admins: false,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1,
        require_last_push_approval: false
      },
      restrictions: null,
      required_linear_history: false,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: false,
      lock_branch: false,
      allow_fork_syncing: false
    }')

  log "  Applying staging branch protection to ${repo}..."
  if response=$(github_api PUT "${endpoint}" "${payload}"); then
    log_ok "  staging branch protected for ${repo}"
    record_result "${repo}" "staging" "success" "Branch protection applied"
  else
    local err
    err=$(echo "${response}" | jq -r '.message // "Unknown error"')
    log_err "  Failed to protect staging branch for ${repo}: ${err}"
    record_result "${repo}" "staging" "error" "${err}"
  fi

  # Allow force push for admins on staging
  log "  Allowing admin force pushes on ${repo}/staging..."
  github_api POST "/repos/${ORG}/${repo}/branches/staging/protection" \
    '{"allow_force_pushes": true}' >/dev/null 2>&1 || true
}

# Apply dev branch protection
apply_dev_protection() {
  local repo="$1"
  local endpoint="/repos/${ORG}/${repo}/branches/dev/protection"

  local status_checks
  status_checks=$(build_status_checks "${DEV_STATUS_CHECKS[@]}")

  local payload
  payload=$(jq -n \
    --argjson sc "${status_checks}" \
    '{
      required_status_checks: {
        strict: false,
        checks: $sc
      },
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
      required_linear_history: false,
      allow_force_pushes: true,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: false,
      lock_branch: false,
      allow_fork_syncing: true
    }')

  log "  Applying dev branch protection to ${repo}..."
  if response=$(github_api PUT "${endpoint}" "${payload}"); then
    log_ok "  dev branch protected for ${repo}"
    record_result "${repo}" "dev" "success" "Branch protection applied"
  else
    local err
    err=$(echo "${response}" | jq -r '.message // "Unknown error"')
    log_err "  Failed to protect dev branch for ${repo}: ${err}"
    record_result "${repo}" "dev" "error" "${err}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK BRANCH EXISTS
# ─────────────────────────────────────────────────────────────────────────────

branch_exists() {
  local repo="$1" branch="$2"
  local response
  response=$(github_api GET "/repos/${ORG}/${repo}/branches/${branch}" "" 2>/dev/null)
  local name
  name=$(echo "${response}" | jq -r '.name // empty')
  [[ "${name}" == "${branch}" ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# PROCESS A SINGLE REPO
# ─────────────────────────────────────────────────────────────────────────────

process_repo() {
  local repo="$1"
  log "Processing repo: ${ORG}/${repo}"

  # ── main branch (required for all repos)
  if [[ "${DRY_RUN}" == "true" ]] || branch_exists "${repo}" "main"; then
    apply_main_protection "${repo}"
  else
    log "  Skipping main: branch does not exist in ${repo}"
    record_result "${repo}" "main" "skipped" "Branch does not exist"
  fi

  # ── staging branch (optional)
  if [[ "${DRY_RUN}" == "true" ]] || branch_exists "${repo}" "staging"; then
    apply_staging_protection "${repo}"
  else
    log "  Skipping staging: branch does not exist in ${repo}"
    record_result "${repo}" "staging" "skipped" "Branch does not exist"
  fi

  # ── dev branch (optional)
  if [[ "${DRY_RUN}" == "true" ]] || branch_exists "${repo}" "dev"; then
    apply_dev_protection "${repo}"
  else
    log "  Skipping dev: branch does not exist in ${repo}"
    record_result "${repo}" "dev" "skipped" "Branch does not exist"
  fi

  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPORT_FILE="branch-protection-apply-report-$(date -u +"%Y%m%d-%H%M%S").json"

log "═══════════════════════════════════════════════════════════════"
log "HeadyMe Branch Protection — Apply Script"
log "Organization:  ${ORG}"
log "Started:       ${TIMESTAMP}"
log "Dry run:       ${DRY_RUN}"
log "Signed commits:$([ "${SKIP_SIGNED}" == "true" ] && echo " SKIPPED" || echo " REQUIRED")"
log "═══════════════════════════════════════════════════════════════"
echo ""

# Validate GitHub token
log "Validating GitHub token..."
TOKEN_CHECK=$(github_api GET "/user" "")
TOKEN_LOGIN=$(echo "${TOKEN_CHECK}" | jq -r '.login // empty')
if [[ -z "${TOKEN_LOGIN}" ]]; then
  log_err "GitHub token validation failed. Check your GITHUB_TOKEN and scopes."
  exit 1
fi
log_ok "Authenticated as: ${TOKEN_LOGIN}"
echo ""

# Process repos
if [[ -n "${TARGET_REPO}" ]]; then
  process_repo "${TARGET_REPO}"
else
  for repo in "${REPOS[@]}"; do
    process_repo "${repo}"
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY REPORT
# ─────────────────────────────────────────────────────────────────────────────

TOTAL=$(echo "${RESULTS_JSON}" | jq 'length')
SUCCESS=$(echo "${RESULTS_JSON}" | jq '[.[] | select(.status == "success")] | length')
ERRORS=$(echo "${RESULTS_JSON}" | jq '[.[] | select(.status == "error")] | length')
SKIPPED=$(echo "${RESULTS_JSON}" | jq '[.[] | select(.status == "skipped")] | length')

FINAL_REPORT=$(jq -n \
  --arg ts "${TIMESTAMP}" \
  --arg org "${ORG}" \
  --arg dry "${DRY_RUN}" \
  --argjson total "${TOTAL}" \
  --argjson success "${SUCCESS}" \
  --argjson errors "${ERRORS}" \
  --argjson skipped "${SKIPPED}" \
  --argjson results "${RESULTS_JSON}" \
  '{
    timestamp: $ts,
    org: $org,
    dry_run: ($dry == "true"),
    summary: {
      total: $total,
      success: $success,
      errors: $errors,
      skipped: $skipped
    },
    results: $results
  }')

echo "${FINAL_REPORT}" > "${REPORT_FILE}"

echo ""
log "═══════════════════════════════════════════════════════════════"
log "SUMMARY"
log "═══════════════════════════════════════════════════════════════"
log "Total:   ${TOTAL}"
log_ok "Success: ${SUCCESS}"
[[ "${ERRORS}" -gt 0 ]] && log_err "Errors:  ${ERRORS}" || log "Errors:  ${ERRORS}"
log "Skipped: ${SKIPPED}"
log "Report:  ${REPORT_FILE}"
log "═══════════════════════════════════════════════════════════════"

[[ "${ERRORS}" -gt 0 ]] && exit 1 || exit 0
