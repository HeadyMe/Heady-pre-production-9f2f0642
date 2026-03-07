#!/usr/bin/env bash
# =============================================================================
# HeadyMe — Branch Protection Verify Script
# Checks all 13 repos for correct branch protection and reports deviations.
# Designed to run in CI for drift detection.
#
# Usage:
#   GITHUB_TOKEN=<your-token> ./branch-protection-verify.sh [--repo <repo>] [--branch <branch>] [--strict]
#
# Flags:
#   --repo <name>     Check only a specific repo
#   --branch <name>   Check only a specific branch (main|staging|dev)
#   --strict          Exit non-zero on ANY deviation (even warnings)
#   --org <name>      Override org name (default: HeadyMe)
#   --output <file>   Write JSON report to file (default: bp-compliance-report-<ts>.json)
#   --verbose         Print full API responses
#
# Exit codes:
#   0 — All checks passed
#   1 — One or more CRITICAL deviations found
#   2 — One or more WARNING deviations found (only with --strict)
# =============================================================================

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — Expected policy values
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

# ─────────────────────────────────────────────────────────────────────────────
# FLAGS
# ─────────────────────────────────────────────────────────────────────────────

TARGET_REPO=""
TARGET_BRANCH=""
STRICT_MODE=false
VERBOSE=false
ORG="${ORG_DEFAULT}"
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    shift; TARGET_REPO="$1" ;;
    --branch)  shift; TARGET_BRANCH="$1" ;;
    --strict)  STRICT_MODE=true ;;
    --verbose) VERBOSE=true ;;
    --org)     shift; ORG="$1" ;;
    --output)  shift; OUTPUT_FILE="$1" ;;
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
# PREREQUISITES
# ─────────────────────────────────────────────────────────────────────────────

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN environment variable is not set." >&2
  exit 1
fi

for cmd in curl jq; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "ERROR: ${cmd} is required but not installed." >&2
    exit 1
  }
done

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

readonly API_BASE="https://api.github.com"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPORT_ISSUES="[]"
CRITICAL_COUNT=0
WARNING_COUNT=0
PASS_COUNT=0

log()      { echo "[verify] $*"; }
log_pass() { echo "[verify] PASS  $*"; }
log_warn() { echo "[verify] WARN  $*"; }
log_fail() { echo "[verify] FAIL  $*" >&2; }

github_get() {
  local endpoint="$1"
  local response http_code

  # Use -w to get status code separately
  response=$(curl -s \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${API_BASE}${endpoint}")

  [[ "${VERBOSE}" == "true" ]] && echo "  [API] GET ${endpoint}: $(echo "${response}" | jq -c . 2>/dev/null || echo "${response}")" >&2

  echo "${response}"
}

# Record a compliance finding
record_issue() {
  local repo="$1" branch="$2" severity="$3" check="$4" expected="$5" actual="$6"
  REPORT_ISSUES=$(echo "${REPORT_ISSUES}" | jq \
    --arg r "${repo}" --arg b "${branch}" --arg s "${severity}" \
    --arg c "${check}" --arg e "${expected}" --arg a "${actual}" \
    '. + [{
      repo: $r,
      branch: $b,
      severity: $s,
      check: $c,
      expected: $e,
      actual: $a
    }]')
  case "${severity}" in
    CRITICAL) ((CRITICAL_COUNT++)) ;;
    WARNING)  ((WARNING_COUNT++)) ;;
  esac
}

record_pass() {
  local repo="$1" branch="$2" check="$3"
  REPORT_ISSUES=$(echo "${REPORT_ISSUES}" | jq \
    --arg r "${repo}" --arg b "${branch}" \
    --arg c "${check}" \
    '. + [{
      repo: $r,
      branch: $b,
      severity: "PASS",
      check: $c,
      expected: "compliant",
      actual: "compliant"
    }]')
  ((PASS_COUNT++))
}

check_bool() {
  local repo="$1" branch="$2" check_name="$3" actual_val="$4" expected_val="$5" severity="${6:-CRITICAL}"
  if [[ "${actual_val}" == "${expected_val}" ]]; then
    log_pass "${repo}/${branch}: ${check_name}"
    record_pass "${repo}" "${branch}" "${check_name}"
  else
    log_fail "${repo}/${branch}: ${check_name} — expected=${expected_val} actual=${actual_val}"
    record_issue "${repo}" "${branch}" "${severity}" "${check_name}" "${expected_val}" "${actual_val}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY main BRANCH
# ─────────────────────────────────────────────────────────────────────────────

verify_main() {
  local repo="$1"
  local bp

  log "  Checking ${repo}/main..."
  bp=$(github_get "/repos/${ORG}/${repo}/branches/main/protection")

  local api_msg
  api_msg=$(echo "${bp}" | jq -r '.message // empty')
  if [[ "${api_msg}" == "Branch not protected" || "${api_msg}" == "Not Found" ]]; then
    log_fail "${repo}/main: NO PROTECTION CONFIGURED"
    record_issue "${repo}" "main" "CRITICAL" "branch_protection_enabled" "true" "false"
    return
  fi

  # required_pull_request_reviews
  local pr_reviews dismiss_stale require_owners min_approvals
  pr_reviews=$(echo "${bp}" | jq -r '.required_pull_request_reviews // empty')
  if [[ -z "${pr_reviews}" ]]; then
    log_fail "${repo}/main: required_pull_request_reviews missing"
    record_issue "${repo}" "main" "CRITICAL" "required_pull_request_reviews" "configured" "missing"
  else
    dismiss_stale=$(echo "${bp}"    | jq -r '.required_pull_request_reviews.dismiss_stale_reviews')
    require_owners=$(echo "${bp}"   | jq -r '.required_pull_request_reviews.require_code_owner_reviews')
    min_approvals=$(echo "${bp}"    | jq -r '.required_pull_request_reviews.required_approving_review_count')
    check_bool "${repo}" "main" "dismiss_stale_reviews"          "${dismiss_stale}"  "true"
    check_bool "${repo}" "main" "require_code_owner_reviews"     "${require_owners}" "true"
    if [[ "${min_approvals}" -ge 1 ]]; then
      log_pass "${repo}/main: required_approving_review_count >= 1 (actual: ${min_approvals})"
      record_pass "${repo}" "main" "required_approving_review_count"
    else
      log_fail "${repo}/main: required_approving_review_count — expected>=1 actual=${min_approvals}"
      record_issue "${repo}" "main" "CRITICAL" "required_approving_review_count" ">=1" "${min_approvals}"
    fi
  fi

  # required_status_checks
  local has_strict status_checks_count
  has_strict=$(echo "${bp}"         | jq -r '.required_status_checks.strict // "false"')
  status_checks_count=$(echo "${bp}" | jq -r '(.required_status_checks.checks // []) | length')
  check_bool "${repo}" "main" "required_status_checks.strict" "${has_strict}" "true"
  if [[ "${status_checks_count}" -ge 1 ]]; then
    log_pass "${repo}/main: required_status_checks configured (${status_checks_count} checks)"
    record_pass "${repo}" "main" "required_status_checks"
  else
    log_fail "${repo}/main: No required status checks configured"
    record_issue "${repo}" "main" "CRITICAL" "required_status_checks" ">=1 check" "${status_checks_count}"
  fi

  # enforce_admins
  local enforce_admins
  enforce_admins=$(echo "${bp}" | jq -r '.enforce_admins.enabled // .enforce_admins // "false"')
  check_bool "${repo}" "main" "enforce_admins" "${enforce_admins}" "true"

  # linear history
  local linear_history
  linear_history=$(echo "${bp}" | jq -r '.required_linear_history.enabled // .required_linear_history // "false"')
  check_bool "${repo}" "main" "required_linear_history" "${linear_history}" "true"

  # no force pushes
  local allow_force
  allow_force=$(echo "${bp}" | jq -r '.allow_force_pushes.enabled // .allow_force_pushes // "true"')
  check_bool "${repo}" "main" "allow_force_pushes=false" "${allow_force}" "false"

  # no deletions
  local allow_deletions
  allow_deletions=$(echo "${bp}" | jq -r '.allow_deletions.enabled // .allow_deletions // "true"')
  check_bool "${repo}" "main" "allow_deletions=false" "${allow_deletions}" "false"

  # restrictions (push restrictions)
  local has_restrictions
  has_restrictions=$(echo "${bp}" | jq -r '.restrictions | if . != null then "true" else "false" end')
  check_bool "${repo}" "main" "push_restrictions_configured" "${has_restrictions}" "true" "WARNING"

  # signed commits
  local signed_commits
  signed_commits_raw=$(github_get "/repos/${ORG}/${repo}/branches/main/protection/required_signatures")
  signed_commits=$(echo "${signed_commits_raw}" | jq -r '.enabled // "false"')
  check_bool "${repo}" "main" "required_signed_commits" "${signed_commits}" "true" "WARNING"
}

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY staging BRANCH
# ─────────────────────────────────────────────────────────────────────────────

verify_staging() {
  local repo="$1"
  local bp

  log "  Checking ${repo}/staging..."
  bp=$(github_get "/repos/${ORG}/${repo}/branches/staging/protection")

  local api_msg
  api_msg=$(echo "${bp}" | jq -r '.message // empty')
  if [[ "${api_msg}" == "Branch not protected" || "${api_msg}" == "Not Found" ]]; then
    log_warn "${repo}/staging: No protection (branch may not exist)"
    record_issue "${repo}" "staging" "WARNING" "branch_protection_enabled" "true" "false/not-found"
    return
  fi

  # PR reviews
  local min_approvals
  min_approvals=$(echo "${bp}" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
  if [[ "${min_approvals}" -ge 1 ]]; then
    log_pass "${repo}/staging: required_approving_review_count >= 1"
    record_pass "${repo}" "staging" "required_approving_review_count"
  else
    record_issue "${repo}" "staging" "WARNING" "required_approving_review_count" ">=1" "${min_approvals}"
    log_warn "${repo}/staging: required_approving_review_count < 1"
  fi

  # status checks
  local sc_count
  sc_count=$(echo "${bp}" | jq -r '(.required_status_checks.checks // []) | length')
  if [[ "${sc_count}" -ge 1 ]]; then
    log_pass "${repo}/staging: status checks configured (${sc_count})"
    record_pass "${repo}" "staging" "required_status_checks"
  else
    record_issue "${repo}" "staging" "WARNING" "required_status_checks" ">=1" "${sc_count}"
  fi

  # no deletions
  local allow_deletions
  allow_deletions=$(echo "${bp}" | jq -r '.allow_deletions.enabled // .allow_deletions // "true"')
  check_bool "${repo}" "staging" "allow_deletions=false" "${allow_deletions}" "false" "WARNING"
}

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY dev BRANCH
# ─────────────────────────────────────────────────────────────────────────────

verify_dev() {
  local repo="$1"
  local bp

  log "  Checking ${repo}/dev..."
  bp=$(github_get "/repos/${ORG}/${repo}/branches/dev/protection")

  local api_msg
  api_msg=$(echo "${bp}" | jq -r '.message // empty')
  if [[ "${api_msg}" == "Branch not protected" || "${api_msg}" == "Not Found" ]]; then
    log_warn "${repo}/dev: No protection (branch may not exist)"
    record_issue "${repo}" "dev" "WARNING" "branch_protection_enabled" "true" "false/not-found"
    return
  fi

  # status checks
  local sc_count
  sc_count=$(echo "${bp}" | jq -r '(.required_status_checks.checks // []) | length')
  if [[ "${sc_count}" -ge 1 ]]; then
    log_pass "${repo}/dev: status checks configured (${sc_count})"
    record_pass "${repo}" "dev" "required_status_checks"
  else
    record_issue "${repo}" "dev" "WARNING" "required_status_checks" ">=1" "${sc_count}"
  fi

  # no deletions
  local allow_deletions
  allow_deletions=$(echo "${bp}" | jq -r '.allow_deletions.enabled // .allow_deletions // "true"')
  check_bool "${repo}" "dev" "allow_deletions=false" "${allow_deletions}" "false" "WARNING"
}

# ─────────────────────────────────────────────────────────────────────────────
# PROCESS A SINGLE REPO
# ─────────────────────────────────────────────────────────────────────────────

process_repo() {
  local repo="$1"
  log "────────────────────────────────────────"
  log "Repo: ${ORG}/${repo}"

  [[ -z "${TARGET_BRANCH}" || "${TARGET_BRANCH}" == "main"    ]] && verify_main    "${repo}"
  [[ -z "${TARGET_BRANCH}" || "${TARGET_BRANCH}" == "staging" ]] && verify_staging "${repo}"
  [[ -z "${TARGET_BRANCH}" || "${TARGET_BRANCH}" == "dev"     ]] && verify_dev     "${repo}"

  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────────────

log "═══════════════════════════════════════════════════════════════"
log "HeadyMe Branch Protection — Verify Script"
log "Organization: ${ORG}"
log "Started:      ${TIMESTAMP}"
log "Strict mode:  ${STRICT_MODE}"
log "═══════════════════════════════════════════════════════════════"
echo ""

# Validate token
TOKEN_LOGIN=$(github_get "/user" | jq -r '.login // empty')
if [[ -z "${TOKEN_LOGIN}" ]]; then
  echo "ERROR: GitHub token validation failed." >&2
  exit 1
fi
log "Authenticated as: ${TOKEN_LOGIN}"
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
# GENERATE JSON COMPLIANCE REPORT
# ─────────────────────────────────────────────────────────────────────────────

TOTAL_CHECKS=$((CRITICAL_COUNT + WARNING_COUNT + PASS_COUNT))
COMPLIANCE_SCORE=0
[[ "${TOTAL_CHECKS}" -gt 0 ]] && COMPLIANCE_SCORE=$((PASS_COUNT * 100 / TOTAL_CHECKS))

REPORT=$(jq -n \
  --arg ts "${TIMESTAMP}" \
  --arg org "${ORG}" \
  --arg runner "${TOKEN_LOGIN}" \
  --argjson total "${TOTAL_CHECKS}" \
  --argjson pass "${PASS_COUNT}" \
  --argjson critical "${CRITICAL_COUNT}" \
  --argjson warning "${WARNING_COUNT}" \
  --argjson score "${COMPLIANCE_SCORE}" \
  --argjson issues "${REPORT_ISSUES}" \
  '{
    report_type: "branch_protection_compliance",
    timestamp: $ts,
    org: $org,
    run_by: $runner,
    summary: {
      total_checks: $total,
      passed: $pass,
      critical_deviations: $critical,
      warning_deviations: $warning,
      compliance_score_pct: $score
    },
    policy: {
      main: {
        require_pr_reviews: true,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        min_approvals: 1,
        require_status_checks: true,
        strict_status_checks: true,
        enforce_admins: true,
        require_linear_history: true,
        allow_force_pushes: false,
        allow_deletions: false,
        require_signed_commits: true
      },
      staging: {
        require_pr_reviews: true,
        min_approvals: 1,
        require_status_checks: true,
        allow_deletions: false
      },
      dev: {
        require_status_checks: true,
        allow_force_pushes: true,
        allow_deletions: false
      }
    },
    findings: $issues
  }')

# Write report
[[ -z "${OUTPUT_FILE}" ]] && OUTPUT_FILE="bp-compliance-report-$(date -u +"%Y%m%d-%H%M%S").json"
echo "${REPORT}" > "${OUTPUT_FILE}"

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

echo ""
log "═══════════════════════════════════════════════════════════════"
log "COMPLIANCE REPORT SUMMARY"
log "═══════════════════════════════════════════════════════════════"
log "Total checks:       ${TOTAL_CHECKS}"
log "Passed:             ${PASS_COUNT}"
log "Critical deviations:${CRITICAL_COUNT}"
log "Warning deviations: ${WARNING_COUNT}"
log "Compliance score:   ${COMPLIANCE_SCORE}%"
log "Report written to:  ${OUTPUT_FILE}"
log "═══════════════════════════════════════════════════════════════"

# Print critical deviations for quick CI review
if [[ "${CRITICAL_COUNT}" -gt 0 ]]; then
  echo ""
  log "CRITICAL DEVIATIONS:"
  echo "${REPORT}" | jq -r '.findings[] | select(.severity == "CRITICAL") | "  [\(.repo)/\(.branch)] \(.check): expected=\(.expected) actual=\(.actual)"'
fi

if [[ "${WARNING_COUNT}" -gt 0 ]]; then
  echo ""
  log "WARNINGS:"
  echo "${REPORT}" | jq -r '.findings[] | select(.severity == "WARNING") | "  [\(.repo)/\(.branch)] \(.check): expected=\(.expected) actual=\(.actual)"'
fi

# Exit codes
if [[ "${CRITICAL_COUNT}" -gt 0 ]]; then
  exit 1
fi
if [[ "${STRICT_MODE}" == "true" && "${WARNING_COUNT}" -gt 0 ]]; then
  exit 2
fi
exit 0
