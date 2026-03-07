#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Canary Rollout Script
# ═══════════════════════════════════════════════════════════════════════════════
# Implements progressive delivery for heady-manager on Cloud Run.
#
# Commands:
#   ./canary-rollout.sh deploy [IMAGE_TAG]    Deploy new revision as canary (5%)
#   ./canary-rollout.sh verify                Verify canary health
#   ./canary-rollout.sh promote               Promote canary to next stage
#   ./canary-rollout.sh rollback              Rollback canary to stable
#   ./canary-rollout.sh status                Show current traffic split
#
# © 2026 HeadySystems Inc. — Proprietary
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-heady-production}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="heady-manager"
REGISTRY="us-central1-docker.pkg.dev/${PROJECT_ID}/heady-docker-repo"
IMAGE="${REGISTRY}/${SERVICE}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Functions ─────────────────────────────────────────────────────────────────

get_service_url() {
  gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format 'value(status.url)'
}

get_canary_url() {
  gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format 'value(status.traffic[tag=canary].url)' 2>/dev/null || echo ""
}

get_current_traffic() {
  gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format json | python3 -c "
import json, sys
data = json.load(sys.stdin)
traffic = data.get('status', {}).get('traffic', [])
for t in traffic:
    rev = t.get('revisionName', 'latest')
    pct = t.get('percent', 0)
    tag = t.get('tag', '-')
    url = t.get('url', '-')
    print(f'  {tag:10s} {rev:40s} {pct:3d}%  {url}')
"
}

check_health() {
  local url="$1"
  local path="$2"
  local timeout="${3:-10}"

  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$timeout" "${url}${path}" 2>/dev/null || echo "000")
  echo "$HTTP_CODE"
}

verify_canary() {
  echo -e "${YELLOW}Verifying canary health...${NC}"
  echo ""

  local canary_url
  canary_url=$(get_canary_url)

  if [ -z "$canary_url" ]; then
    echo -e "${RED}No canary revision found${NC}"
    return 1
  fi

  echo -e "  Canary URL: ${canary_url}"

  # Health checks
  local all_healthy=true

  for path in "/health/live" "/health/ready"; do
    local code
    code=$(check_health "$canary_url" "$path")
    if [ "$code" = "200" ]; then
      echo -e "  ${GREEN}PASS${NC}  ${path} → HTTP ${code}"
    else
      echo -e "  ${RED}FAIL${NC}  ${path} → HTTP ${code}"
      all_healthy=false
    fi
  done

  # Check error rate from Cloud Monitoring
  echo ""
  echo -e "  ${YELLOW}Checking metrics (last 5 minutes)...${NC}"

  local service_url
  service_url=$(get_service_url)

  # Sample requests to both stable and canary
  local error_count=0
  local total_count=10

  for i in $(seq 1 $total_count); do
    code=$(check_health "$canary_url" "/health/live" 5)
    if [ "$code" != "200" ]; then
      ((error_count++))
    fi
  done

  local error_rate
  error_rate=$(echo "scale=1; $error_count * 100 / $total_count" | bc)
  echo -e "  Error rate: ${error_rate}% (${error_count}/${total_count} failures)"

  if [ "$error_count" -gt 1 ]; then
    echo -e "  ${RED}Error rate too high — recommend rollback${NC}"
    all_healthy=false
  fi

  echo ""
  if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}Canary is healthy. Safe to promote.${NC}"
    return 0
  else
    echo -e "${RED}Canary has issues. Consider rolling back.${NC}"
    return 1
  fi
}

deploy_canary() {
  local tag="${1:-latest}"
  local image_ref="${IMAGE}:${tag}"

  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Deploying canary: ${image_ref}${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""

  # Deploy with no traffic
  echo -e "${YELLOW}Deploying new revision (no traffic)...${NC}"
  gcloud run deploy "$SERVICE" \
    --image "$image_ref" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --platform managed \
    --no-traffic \
    --tag canary \
    --quiet

  # Route 5% to canary
  echo -e "${YELLOW}Routing 5% traffic to canary...${NC}"
  gcloud run services update-traffic "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --to-tags canary=5 \
    --quiet

  echo ""
  echo -e "${GREEN}Canary deployed with 5% traffic${NC}"
  echo ""
  echo "  Next steps:"
  echo "    1. Monitor: ./canary-rollout.sh status"
  echo "    2. Verify:  ./canary-rollout.sh verify"
  echo "    3. Promote: ./canary-rollout.sh promote"
  echo "    4. Abort:   ./canary-rollout.sh rollback"
}

promote_canary() {
  echo -e "${YELLOW}Getting current traffic split...${NC}"
  echo ""

  local canary_pct
  canary_pct=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data.get('status', {}).get('traffic', []):
    if t.get('tag') == 'canary':
        print(t.get('percent', 0))
        sys.exit(0)
print(0)
")

  local next_pct=0
  local stage=""

  if [ "$canary_pct" -le 5 ]; then
    next_pct=25
    stage="burn-in"
  elif [ "$canary_pct" -le 25 ]; then
    next_pct=50
    stage="promoted"
  elif [ "$canary_pct" -le 50 ]; then
    next_pct=100
    stage="stable"
  else
    echo -e "${GREEN}Canary is already at ${canary_pct}% — fully promoted${NC}"
    return 0
  fi

  echo -e "  Current canary: ${canary_pct}%"
  echo -e "  Promoting to:   ${next_pct}% (${stage})"
  echo ""

  if [ "$next_pct" -eq 100 ]; then
    # Full promotion: move canary tag to stable
    echo -e "${YELLOW}Full promotion to 100% — making canary the stable revision...${NC}"
    local canary_rev
    canary_rev=$(gcloud run services describe "$SERVICE" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --format json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data.get('status', {}).get('traffic', []):
    if t.get('tag') == 'canary':
        print(t.get('revisionName', ''))
        sys.exit(0)
")

    gcloud run services update-traffic "$SERVICE" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --to-revisions "${canary_rev}=100" \
      --quiet

    # Update the stable tag
    gcloud run services update-traffic "$SERVICE" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --set-tags "stable=${canary_rev}" \
      --quiet 2>/dev/null || true

    echo -e "${GREEN}Canary promoted to stable (100%)${NC}"
  else
    gcloud run services update-traffic "$SERVICE" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --to-tags "canary=${next_pct}" \
      --quiet

    echo -e "${GREEN}Canary promoted to ${next_pct}% (${stage})${NC}"
    echo ""
    echo "  Next: verify health, then promote again"
    echo "    ./canary-rollout.sh verify"
    echo "    ./canary-rollout.sh promote"
  fi
}

rollback_canary() {
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}  ROLLING BACK canary deployment${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo ""

  # Route 100% to stable tag
  local stable_rev
  stable_rev=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data.get('status', {}).get('traffic', []):
    if t.get('tag') == 'stable' or (t.get('percent', 0) > 50 and t.get('tag') != 'canary'):
        print(t.get('revisionName', ''))
        sys.exit(0)
# Fallback: use the non-canary revision with most traffic
for t in sorted(data.get('status', {}).get('traffic', []), key=lambda x: x.get('percent', 0), reverse=True):
    if t.get('tag') != 'canary':
        print(t.get('revisionName', ''))
        sys.exit(0)
")

  if [ -n "$stable_rev" ]; then
    gcloud run services update-traffic "$SERVICE" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --to-revisions "${stable_rev}=100" \
      --quiet

    echo -e "${GREEN}Rolled back to: ${stable_rev} (100% traffic)${NC}"
  else
    echo -e "${RED}Could not determine stable revision — manual intervention needed${NC}"
    echo "  gcloud run revisions list --service=${SERVICE} --region=${REGION}"
    exit 1
  fi
}

show_status() {
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  ${SERVICE} — Traffic Split${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${YELLOW}Tag        Revision                                  Traffic  URL${NC}"
  get_current_traffic
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

COMMAND="${1:-status}"
shift || true

case "$COMMAND" in
  deploy)   deploy_canary "${1:-latest}" ;;
  verify)   verify_canary ;;
  promote)  promote_canary ;;
  rollback) rollback_canary ;;
  status)   show_status ;;
  *)
    echo "Usage: $0 {deploy|verify|promote|rollback|status} [IMAGE_TAG]"
    exit 1
    ;;
esac
