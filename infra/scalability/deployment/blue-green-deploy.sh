#!/usr/bin/env bash
# =============================================================================
# HeadySystems — Blue-Green Deployment Script for Cloud Run
#
# Traffic shift schedule (φ-scaled intervals):
#   0% → 5% (fib5=5%)  wait fib(5)=5 min
#   5% → 13% (fib7=13%) wait fib(6)=8 min
#   13% → 55% (fib10=55%) wait fib(7)=13 min
#   55% → 100%
#
# Usage:
#   ./blue-green-deploy.sh --service heady-brain --image gcr.io/heady-production/heady-brain:sha-abc123
#   ./blue-green-deploy.sh --service heady-gateway --image gcr.io/heady-production/heady-gateway:1.2.3 --region europe-west1
#
# Requirements: gcloud CLI, jq, curl
# =============================================================================
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# φ constants
# ─────────────────────────────────────────────────────────────────────────────
readonly PHI="1.618033988749895"
readonly FIB_5=5
readonly FIB_6=8
readonly FIB_7=13
readonly FIB_8=21
readonly FIB_9=34
readonly FIB_10=55

# Traffic percentages (Fibonacci)
readonly TRAFFIC_STEP_1=5      # fib(5)=5%
readonly TRAFFIC_STEP_2=13     # fib(7)=13%
readonly TRAFFIC_STEP_3=55     # fib(10)=55%
readonly TRAFFIC_FINAL=100

# Wait intervals between traffic shifts (minutes)
readonly WAIT_1_MIN=${FIB_5}    # 5 minutes
readonly WAIT_2_MIN=${FIB_6}    # 8 minutes
readonly WAIT_3_MIN=${FIB_7}    # 13 minutes

# Health check config
readonly HEALTH_CHECK_PATH="/healthz"
readonly HEALTH_CHECK_RETRIES=${FIB_5}   # 5 retries
readonly HEALTH_CHECK_TIMEOUT=${FIB_5}   # 5s per check
readonly SMOKE_TEST_DURATION=${FIB_7}    # 13s smoke test window

# ─────────────────────────────────────────────────────────────────────────────
# Color output helpers
# ─────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()     { echo -e "${BLUE}[$(date -u +%T)]${RESET} $*"; }
success() { echo -e "${GREEN}[$(date -u +%T)] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[$(date -u +%T)] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[$(date -u +%T)] ✗${RESET} $*" >&2; }
section() { echo -e "\n${BOLD}${CYAN}═══ $* ═══${RESET}\n"; }

# ─────────────────────────────────────────────────────────────────────────────
# Defaults
# ─────────────────────────────────────────────────────────────────────────────
SERVICE=""
IMAGE=""
REGION="us-central1"
PROJECT="${GOOGLE_CLOUD_PROJECT:-heady-production}"
DRY_RUN=false
SKIP_SMOKE=false
ROLLBACK_ON_FAILURE=true

# ─────────────────────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $0 --service SERVICE --image IMAGE [OPTIONS]

Required:
  --service NAME    Cloud Run service name
  --image IMAGE     Full image URI (gcr.io/project/service:tag)

Options:
  --region REGION   GCP region (default: us-central1)
  --project PROJECT GCP project (default: heady-production)
  --dry-run         Print commands without executing
  --skip-smoke      Skip smoke tests (not recommended)
  --no-rollback     Disable automatic rollback on failure
  -h, --help        Show this help

φ Traffic schedule:
  0% → ${TRAFFIC_STEP_1}% (wait ${WAIT_1_MIN}m) → ${TRAFFIC_STEP_2}% (wait ${WAIT_2_MIN}m) → ${TRAFFIC_STEP_3}% (wait ${WAIT_3_MIN}m) → 100%
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --service)    SERVICE="$2";    shift 2 ;;
    --image)      IMAGE="$2";      shift 2 ;;
    --region)     REGION="$2";     shift 2 ;;
    --project)    PROJECT="$2";    shift 2 ;;
    --dry-run)    DRY_RUN=true;    shift ;;
    --skip-smoke) SKIP_SMOKE=true; shift ;;
    --no-rollback) ROLLBACK_ON_FAILURE=false; shift ;;
    -h|--help)    usage ;;
    *)            error "Unknown argument: $1"; usage ;;
  esac
done

[[ -z "$SERVICE" ]] && { error "--service is required"; usage; }
[[ -z "$IMAGE"   ]] && { error "--image is required";   usage; }

# ─────────────────────────────────────────────────────────────────────────────
# gcloud wrapper
# ─────────────────────────────────────────────────────────────────────────────
gcloud_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] gcloud $*"
  else
    gcloud "$@"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# State tracking
# ─────────────────────────────────────────────────────────────────────────────
DEPLOY_START_EPOCH=$(date +%s)
STABLE_REVISION=""
NEW_REVISION=""
DEPLOY_TAG="heady-bg-$(date +%Y%m%d-%H%M%S)"

# ─────────────────────────────────────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────────────────────────────────────

get_stable_revision() {
  gcloud run services describe "$SERVICE" \
    --region="$REGION" \
    --project="$PROJECT" \
    --format="value(status.traffic[0].revisionName)" 2>/dev/null || echo ""
}

get_service_url() {
  gcloud run services describe "$SERVICE" \
    --region="$REGION" \
    --project="$PROJECT" \
    --format="value(status.url)" 2>/dev/null || echo ""
}

phi_backoff() {
  local attempt="$1"
  # φ^attempt × 1000ms — 1000, 1618, 2618, 4236, 6854
  python3 -c "import math; print(int(1000 * (${PHI} ** ${attempt})))"
}

# Health check with φ-backoff retry
health_check() {
  local url="$1"
  local endpoint="${url}${HEALTH_CHECK_PATH}"
  local attempt=0

  log "Health check: ${endpoint}"
  while [[ $attempt -lt $HEALTH_CHECK_RETRIES ]]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time "${HEALTH_CHECK_TIMEOUT}" \
      --header "User-Agent: heady-blue-green-deployer/1.0" \
      "${endpoint}" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]]; then
      success "Health check passed (HTTP ${http_code})"
      return 0
    fi

    warn "Health check attempt $((attempt+1))/${HEALTH_CHECK_RETRIES} failed (HTTP ${http_code})"
    local backoff_ms
    backoff_ms=$(phi_backoff "$attempt")
    sleep "$(echo "scale=3; ${backoff_ms}/1000" | bc)"
    (( attempt++ ))
  done

  error "Health check failed after ${HEALTH_CHECK_RETRIES} attempts"
  return 1
}

# Smoke test against a tagged revision URL
smoke_test() {
  local service_url="$1"
  local revision_url="${service_url}?tag=${DEPLOY_TAG}"
  local smoke_passed=0

  log "Running smoke tests for ${FIB_7}s against: ${revision_url}"
  local end_time=$(( $(date +%s) + SMOKE_TEST_DURATION ))

  local test_count=0
  local pass_count=0

  while [[ $(date +%s) -lt $end_time ]]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 5 \
      "${revision_url}" 2>/dev/null || echo "000")

    (( test_count++ ))
    if [[ "$http_code" =~ ^[23] ]]; then
      (( pass_count++ ))
    fi
    sleep 1
  done

  local pass_rate=0
  if [[ $test_count -gt 0 ]]; then
    pass_rate=$(echo "scale=4; ${pass_count}/${test_count}" | bc)
  fi

  log "Smoke test results: ${pass_count}/${test_count} passed (rate: ${pass_rate})"

  # Require ≥ 61.8% (1/φ) pass rate
  local min_rate="0.618"
  if (( $(echo "${pass_rate} >= ${min_rate}" | bc -l) )); then
    success "Smoke tests passed (${pass_rate} ≥ ${min_rate} = 1/φ threshold)"
    return 0
  else
    error "Smoke tests failed (${pass_rate} < ${min_rate} = 1/φ threshold)"
    return 1
  fi
}

rollback() {
  local stable_rev="$1"
  if [[ -z "$stable_rev" ]]; then
    error "No stable revision to roll back to"
    return 1
  fi

  warn "ROLLBACK initiated → ${stable_rev}"
  gcloud_cmd run services update-traffic "$SERVICE" \
    --region="$REGION" \
    --project="$PROJECT" \
    --to-revisions="${stable_rev}=100"

  error "Deployment FAILED. Rolled back to ${stable_rev}"
  exit 1
}

shift_traffic() {
  local percent="$1"
  local new_rev="$2"
  local stable_rev="$3"

  log "Shifting traffic → ${percent}% to ${new_rev}"

  if [[ "$percent" -eq 100 ]]; then
    gcloud_cmd run services update-traffic "$SERVICE" \
      --region="$REGION" \
      --project="$PROJECT" \
      --to-latest
  else
    local stable_percent=$(( 100 - percent ))
    gcloud_cmd run services update-traffic "$SERVICE" \
      --region="$REGION" \
      --project="$PROJECT" \
      --to-revisions="${new_rev}=${percent},${stable_rev}=${stable_percent}"
  fi

  success "Traffic split: ${percent}% → ${new_rev}, $(( 100 - percent ))% → ${stable_rev:-stable}"
}

wait_minutes() {
  local minutes="$1"
  local label="$2"
  local total_secs=$(( minutes * 60 ))

  log "Waiting ${minutes} min (${total_secs}s) — monitoring: ${label}"
  local elapsed=0
  while [[ $elapsed -lt $total_secs ]]; do
    local remaining=$(( total_secs - elapsed ))
    printf "\r  [%3ds remaining]" "$remaining"
    sleep 5
    elapsed=$(( elapsed + 5 ))

    # Health check every fib(7)=13 seconds during wait
    if (( elapsed % FIB_7 == 0 )); then
      local svc_url
      svc_url=$(get_service_url)
      if ! health_check "$svc_url" 2>/dev/null; then
        echo ""
        error "Health check failed during traffic shift wait!"
        if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
          rollback "$STABLE_REVISION"
        fi
        exit 1
      fi
    fi
  done
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN DEPLOYMENT FLOW
# ─────────────────────────────────────────────────────────────────────────────
section "Heady Blue-Green Deploy — φ=${PHI}"

log "Service:  ${SERVICE}"
log "Image:    ${IMAGE}"
log "Region:   ${REGION}"
log "Project:  ${PROJECT}"
log "Tag:      ${DEPLOY_TAG}"
log "Dry-run:  ${DRY_RUN}"
log "Traffic:  0% → ${TRAFFIC_STEP_1}% (${WAIT_1_MIN}m) → ${TRAFFIC_STEP_2}% (${WAIT_2_MIN}m) → ${TRAFFIC_STEP_3}% (${WAIT_3_MIN}m) → 100%"

# ── Step 1: Capture stable revision ──────────────────────────────────────────
section "Step 1: Capture stable revision"
STABLE_REVISION=$(get_stable_revision)
log "Stable revision: ${STABLE_REVISION:-<none>}"

# ── Step 2: Deploy new revision with 0% traffic ───────────────────────────────
section "Step 2: Deploy new revision (0% traffic)"
gcloud_cmd run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --tag="$DEPLOY_TAG" \
  --no-traffic \
  --set-env-vars="DEPLOY_TAG=${DEPLOY_TAG},DEPLOY_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --concurrency="${FIB_9}" \
  --timeout="${FIB_10}s" \
  --min-instances=2 \
  --max-instances=21

NEW_REVISION=$(gcloud run revisions list \
  --service="$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --format="value(name)" \
  --limit=1 \
  --sort-by="~metadata.creationTimestamp" 2>/dev/null || echo "")

log "New revision deployed: ${NEW_REVISION}"
success "Revision deployed with 0% traffic"

# ── Step 3: Smoke tests ───────────────────────────────────────────────────────
if [[ "$SKIP_SMOKE" == "false" ]]; then
  section "Step 3: Smoke tests (${FIB_7}s)"
  SERVICE_URL=$(get_service_url)

  if ! smoke_test "$SERVICE_URL"; then
    error "Smoke tests failed — aborting deployment"
    [[ "$ROLLBACK_ON_FAILURE" == "true" ]] && rollback "$STABLE_REVISION"
    exit 1
  fi
else
  warn "Smoke tests SKIPPED"
fi

# ── Step 4: 5% traffic ────────────────────────────────────────────────────────
section "Step 4: Traffic → ${TRAFFIC_STEP_1}% (fib5)"
shift_traffic "$TRAFFIC_STEP_1" "$NEW_REVISION" "$STABLE_REVISION"
wait_minutes "$WAIT_1_MIN" "fib(5)=${TRAFFIC_STEP_1}% canary phase"

# ── Step 5: 13% traffic ───────────────────────────────────────────────────────
section "Step 5: Traffic → ${TRAFFIC_STEP_2}% (fib7)"
shift_traffic "$TRAFFIC_STEP_2" "$NEW_REVISION" "$STABLE_REVISION"
wait_minutes "$WAIT_2_MIN" "fib(7)=${TRAFFIC_STEP_2}% canary phase"

# ── Step 6: 55% traffic ───────────────────────────────────────────────────────
section "Step 6: Traffic → ${TRAFFIC_STEP_3}% (fib10)"
shift_traffic "$TRAFFIC_STEP_3" "$NEW_REVISION" "$STABLE_REVISION"
wait_minutes "$WAIT_3_MIN" "fib(10)=${TRAFFIC_STEP_3}% canary phase"

# ── Step 7: 100% traffic ──────────────────────────────────────────────────────
section "Step 7: Traffic → 100%"
shift_traffic "$TRAFFIC_FINAL" "$NEW_REVISION" "$STABLE_REVISION"
success "Full traffic migration complete!"

# ── Step 8: Final health check ────────────────────────────────────────────────
section "Step 8: Final health validation"
SERVICE_URL=$(get_service_url)
if ! health_check "$SERVICE_URL"; then
  error "Post-deployment health check failed!"
  [[ "$ROLLBACK_ON_FAILURE" == "true" ]] && rollback "$STABLE_REVISION"
  exit 1
fi

# ── Summary ───────────────────────────────────────────────────────────────────
DEPLOY_END_EPOCH=$(date +%s)
DEPLOY_DURATION=$(( DEPLOY_END_EPOCH - DEPLOY_START_EPOCH ))

section "Deployment Complete"
success "Service:   ${SERVICE}"
success "Revision:  ${NEW_REVISION}"
success "Duration:  ${DEPLOY_DURATION}s"
success "URL:       $(get_service_url)"
log "Previous:  ${STABLE_REVISION} (retained for rollback)"
log ""
log "To rollback: gcloud run services update-traffic ${SERVICE} --region=${REGION} --to-revisions=${STABLE_REVISION}=100"
