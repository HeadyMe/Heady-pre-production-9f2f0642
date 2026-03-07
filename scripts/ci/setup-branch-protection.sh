#!/usr/bin/env bash
# =============================================================================
# scripts/ci/setup-branch-protection.sh
#
# Configure GitHub branch protection rules via the GitHub REST API.
#
# Protection rules:
#   main (production):
#     - Require pull request (no direct push)
#     - Require ALL CI checks to pass (promotion-pipeline + existing workflows)
#     - Require fib(1)=1 approval
#     - No force push
#     - No branch deletion
#     - Require linear history
#     - Require conversation resolution before merge
#     - Enforce for admins
#
#   pre-production (development):
#     - Require CI checks pass (promotion-pipeline)
#     - Allow direct push from authorized users
#     - No force push protection (allows rebasing)
#     - fib(0)=0 required reviewers (CI gates are the gate)
#
# Prerequisites:
#   - GitHub personal access token with repo:admin scope
#   - GITHUB_TOKEN env var OR pass as $1
#   - GITHUB_REPOSITORY env var (owner/repo) OR pass as $2
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=HeadyMe/Heady-pre-production-9f2f0642 \
#     bash scripts/ci/setup-branch-protection.sh
#
#   # Or with positional args:
#   bash scripts/ci/setup-branch-protection.sh ghp_xxx HeadyMe/Heady-pre-production-9f2f0642
#
# φ design:
#   Required approvals: fib(1)=1 (minimum meaningful review)
#   Dismiss stale reviews: true (new commits invalidate approval)
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
TOKEN="${1:-${GITHUB_TOKEN:-}}"
REPO="${2:-${GITHUB_REPOSITORY:-HeadyMe/Heady-pre-production-9f2f0642}}"

OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

# φ constants
PHI="1.618033988749895"
# fib(1)=1 required review
REQUIRED_APPROVALS=1

API_BASE="https://api.github.com/repos/${OWNER}/${REPO_NAME}"

# ─── Dependency check ────────────────────────────────────────────────────────
command -v curl  >/dev/null 2>&1 || { echo "ERROR: curl is required"; exit 1; }
command -v jq    >/dev/null 2>&1 || { echo "ERROR: jq is required"; exit 1; }

if [ -z "$TOKEN" ]; then
  echo "ERROR: GitHub token required (GITHUB_TOKEN env var or first positional arg)"
  exit 1
fi

echo "=== Heady Branch Protection Setup ==="
echo "φ = $PHI"
echo "Repository: ${OWNER}/${REPO_NAME}"
echo "API: ${API_BASE}"
echo ""

# ─── Helper function ──────────────────────────────────────────────────────────
# Make authenticated API call, return HTTP status
api_call() {
  local method="$1"
  local endpoint="$2"
  local body="${3:-}"
  local response
  local http_code

  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" \
      -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Content-Type: application/json" \
      "${API_BASE}${endpoint}" \
      -d "$body")
  else
    response=$(curl -s -w "\n%{http_code}" \
      -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      "${API_BASE}${endpoint}")
  fi

  http_code=$(echo "$response" | tail -1)
  echo "$response" | head -n -1  # body
  return "$( [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ] && echo 0 || echo 1 )"
}

# ─── Verify repo access ───────────────────────────────────────────────────────
echo "Verifying repository access..."
REPO_INFO=$(curl -s \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "${API_BASE}")

REPO_PRIVATE=$(echo "$REPO_INFO" | jq -r '.private // "unknown"')
DEFAULT_BRANCH=$(echo "$REPO_INFO" | jq -r '.default_branch // "main"')
echo "  Repo visibility: $([ "$REPO_PRIVATE" = "true" ] && echo "private" || echo "public")"
echo "  Default branch:  ${DEFAULT_BRANCH}"
echo ""

# ─── Get list of required CI checks ──────────────────────────────────────────
# These are the check names that MUST pass before merge to main
# Includes both existing workflows and new promotion pipeline

MAIN_REQUIRED_CHECKS=$(cat <<'EOF'
[
  "Gate 1 — ESLint",
  "Gate 2 — Security Scan",
  "Gate 3 — Jest Test Suite",
  "Gate 4 — Performance Benchmarks",
  "Gate 5 — Bundle Analysis",
  "Gate 6 — Dependency Audit",
  "Gate 7 — Dead Code Detection",
  "Gate 8 — Create Promotion PR",
  "ci / build",
  "ci / test",
  "quality-gates / quality-check",
  "security-gate / security-check",
  "sast-pipeline / sast-scan",
  "container-scan / container-scan",
  "dependency-review / dependency-review"
]
EOF
)

PRE_PROD_REQUIRED_CHECKS=$(cat <<'EOF'
[
  "Gate 1 — ESLint",
  "Gate 3 — Jest Test Suite"
]
EOF
)

# ─── Configure main branch protection ────────────────────────────────────────
echo "=== Configuring: main (production) ==="

MAIN_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${MAIN_REQUIRED_CHECKS}
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": ${REQUIRED_APPROVALS},
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
)

echo "  Setting protection rules..."
HTTP_STATUS=$(curl -s -o /tmp/main_branch_response.json -w "%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  "${API_BASE}/branches/main/protection" \
  -d "$MAIN_PAYLOAD")

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "  ✅ main branch protection configured (HTTP $HTTP_STATUS)"
  echo "     - Required PR: YES"
  echo "     - Required approvals: fib(1)=${REQUIRED_APPROVALS}"
  echo "     - Force push: BLOCKED"
  echo "     - Deletion: BLOCKED"
  echo "     - Linear history: REQUIRED"
  echo "     - Enforce for admins: YES"
  echo "     - Required checks: $(echo "$MAIN_REQUIRED_CHECKS" | jq '. | length') checks"
else
  echo "  ❌ Failed to configure main branch (HTTP $HTTP_STATUS)"
  echo "  Response:"
  cat /tmp/main_branch_response.json | jq '.' 2>/dev/null || cat /tmp/main_branch_response.json
  echo ""
  echo "  Common causes:"
  echo "    - Token lacks admin:org or repo admin scope"
  echo "    - Branch 'main' doesn't exist yet"
  echo "    - Repository is a fork"
fi

echo ""

# ─── Configure pre-production branch protection ───────────────────────────────
echo "=== Configuring: pre-production (development) ==="

# Check if pre-production branch exists, create it if not
echo "  Checking pre-production branch..."
BRANCH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "${API_BASE}/branches/pre-production")

if [ "$BRANCH_CHECK" = "404" ]; then
  echo "  Branch pre-production not found — creating from main..."
  MAIN_SHA=$(curl -s \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "${API_BASE}/git/refs/heads/main" | jq -r '.object.sha')

  if [ -n "$MAIN_SHA" ] && [ "$MAIN_SHA" != "null" ]; then
    CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Content-Type: application/json" \
      "${API_BASE}/git/refs" \
      -d "{\"ref\":\"refs/heads/pre-production\",\"sha\":\"${MAIN_SHA}\"}")
    echo "  Branch created (HTTP $CREATE_STATUS)"
  else
    echo "  ⚠️  Could not get main SHA — skipping pre-production creation"
  fi
fi

PRE_PROD_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": false,
    "contexts": ${PRE_PROD_REQUIRED_CHECKS}
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": true,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false
}
EOF
)

echo "  Setting protection rules..."
HTTP_STATUS=$(curl -s -o /tmp/preprod_branch_response.json -w "%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  "${API_BASE}/branches/pre-production/protection" \
  -d "$PRE_PROD_PAYLOAD")

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "  ✅ pre-production branch protection configured (HTTP $HTTP_STATUS)"
  echo "     - Required PR: NO (direct push allowed)"
  echo "     - Force push: ALLOWED (for rebasing)"
  echo "     - Deletion: BLOCKED"
  echo "     - Required checks: $(echo "$PRE_PROD_REQUIRED_CHECKS" | jq '. | length') checks"
  echo "     - Enforce for admins: NO"
else
  echo "  ❌ Failed to configure pre-production branch (HTTP $HTTP_STATUS)"
  cat /tmp/preprod_branch_response.json | jq '.' 2>/dev/null || cat /tmp/preprod_branch_response.json
fi

echo ""

# ─── Configure CODEOWNERS (advisory) ─────────────────────────────────────────
echo "=== Checking CODEOWNERS ==="
CODEOWNERS_PATH=".github/CODEOWNERS"
if [ -f "$CODEOWNERS_PATH" ]; then
  echo "  ✅ CODEOWNERS exists: ${CODEOWNERS_PATH}"
else
  echo "  ⚠️  CODEOWNERS not found — creating default..."
  mkdir -p .github
  cat > "$CODEOWNERS_PATH" <<'CODEOWNERS'
# Heady Systems CODEOWNERS
# These owners are automatically requested for review on promotion PRs

# Global owners (all files)
*   @HeadyMe/heady-core-team

# CI/CD workflows
.github/   @HeadyMe/heady-core-team
scripts/ci/ @HeadyMe/heady-core-team

# Security-sensitive files
src/security/   @HeadyMe/heady-security-team
src/observability/ @HeadyMe/heady-security-team
docs/compliance/ @HeadyMe/heady-security-team

# Infrastructure
Dockerfile*       @HeadyMe/heady-infra-team
cloudbuild.yaml   @HeadyMe/heady-infra-team
docker-compose*   @HeadyMe/heady-infra-team
CODEOWNERS
  echo "  ✅ CODEOWNERS created"
fi

echo ""
echo "=== Branch Protection Setup Complete ==="
echo ""
echo "Summary:"
echo "  main:           full protection, fib(1)=${REQUIRED_APPROVALS} approval required"
echo "  pre-production: CI checks required, direct push allowed"
echo ""
echo "Next steps:"
echo "  1. Verify rules at: https://github.com/${OWNER}/${REPO_NAME}/settings/branches"
echo "  2. Ensure all CI check names match exactly what GitHub Actions reports"
echo "  3. Add team members to heady-core-team and heady-infra-team"
