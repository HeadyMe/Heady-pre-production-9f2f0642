#!/usr/bin/env bash
# =============================================================================
# HeadySystems — Canary Deployment with Automated Analysis
#
# Flow:
#   1. Deploy canary revision with fib(5)=5% traffic
#   2. Monitor for fib(8)=21 minutes: error rate, latency, success rate
#   3. φ-threshold check: promote to fib(10)=55%, then 100%
#   4. On regression: instant rollback + create incident
#
# φ thresholds (CSL):
#   Error rate warn  : 0.382 (MODERATE)
#   Error rate fail  : 0.618 (HIGH = 1/φ)
#   Latency warn     : fib(10)=55ms
#   Latency fail     : fib(11)=89ms (p99)
#   Success rate min : 0.618 (1/φ)
#
# Usage:
#   ./canary-deploy.sh --service heady-brain --image gcr.io/heady-production/heady-brain:sha
# =============================================================================
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# φ constants
# ─────────────────────────────────────────────────────────────────────────────
readonly PHI="1.618033988749895"
readonly PHI_INVERSE="0.618033988749895"    # 1/φ — minimum success rate
readonly PHI_SQUARE_INV="0.381966011250105" # 1/φ² — moderate threshold
readonly FIB_4=3
readonly FIB_5=5
readonly FIB_6=8
readonly FIB_7=13
readonly FIB_8=21
readonly FIB_9=34
readonly FIB_10=55
readonly FIB_11=89

# Canary configuration
readonly CANARY_INITIAL_PERCENT=${FIB_5}        # 5% initial traffic
readonly CANARY_MID_PERCENT=${FIB_10}           # 55% if analysis passes
readonly CANARY_FINAL_PERCENT=100
readonly ANALYSIS_DURATION_MIN=${FIB_8}         # 21 minutes monitoring window
readonly ANALYSIS_POLL_INTERVAL=${FIB_6}        # 8 second polling interval

# Thresholds (CSL-aligned)
readonly ERROR_RATE_WARN="${PHI_SQUARE_INV}"    # 0.382 — MODERATE CSL
readonly ERROR_RATE_FAIL="${PHI_INVERSE}"       # 0.618 — HIGH CSL (= 1/φ)
readonly SUCCESS_RATE_MIN="${PHI_INVERSE}"      # 0.618 — minimum acceptable
readonly LATENCY_WARN_MS=${FIB_10}              # 55ms warn
readonly LATENCY_FAIL_MS=${FIB_11}              # 89ms fail (p99)

# ─────────────────────────────────────────────────────────────────────────────
# Color helpers
# ─────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()      { echo -e "${BLUE}[$(date -u +%T)]${RESET} $*"; }
success()  { echo -e "${GREEN}[$(date -u +%T)] ✓${RESET} $*"; }
warn()     { echo -e "${YELLOW}[$(date -u +%T)] ⚠${RESET} $*"; }
error()    { echo -e "${RED}[$(date -u +%T)] ✗${RESET} $*" >&2; }
metric()   { echo -e "${CYAN}[$(date -u +%T)] 📊${RESET} $*"; }
section()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${RESET}\n"; }

# ─────────────────────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────────────────────
SERVICE=""
IMAGE=""
REGION="us-central1"
PROJECT="${GOOGLE_CLOUD_PROJECT:-heady-production}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus.monitoring.svc.cluster.local:9090}"
INCIDENT_WEBHOOK="${INCIDENT_WEBHOOK:-}"
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $0 --service SERVICE --image IMAGE [OPTIONS]

Required:
  --service NAME        Cloud Run service name
  --image IMAGE         Full image URI

Options:
  --region REGION       GCP region (default: us-central1)
  --project PROJECT     GCP project (default: heady-production)
  --prometheus URL      Prometheus endpoint for metrics query
  --incident-webhook URL PagerDuty/Opsgenie webhook for incident creation
  --dry-run             Print commands without executing
  -h, --help            Show help

φ Analysis thresholds:
  Initial traffic:  ${CANARY_INITIAL_PERCENT}%  (fib5)
  Monitor window:   ${ANALYSIS_DURATION_MIN}m  (fib8)
  Error rate warn:  ${ERROR_RATE_WARN} (1/φ²)
  Error rate fail:  ${ERROR_RATE_FAIL} (1/φ)
  Success rate min: ${SUCCESS_RATE_MIN} (1/φ)
  Latency warn:     ${LATENCY_WARN_MS}ms (fib10)
  Latency fail:     ${LATENCY_FAIL_MS}ms (fib11)
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --service)          SERVICE="$2";           shift 2 ;;
    --image)            IMAGE="$2";             shift 2 ;;
    --region)           REGION="$2";            shift 2 ;;
    --project)          PROJECT="$2";           shift 2 ;;
    --prometheus)       PROMETHEUS_URL="$2";    shift 2 ;;
    --incident-webhook) INCIDENT_WEBHOOK="$2";  shift 2 ;;
    --dry-run)          DRY_RUN=true;           shift ;;
    -h|--help)          usage ;;
    *)                  error "Unknown argument: $1"; usage ;;
  esac
done

[[ -z "$SERVICE" ]] && { error "--service required"; usage; }
[[ -z "$IMAGE"   ]] && { error "--image required";   usage; }

# ─────────────────────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────────────────────
CANARY_TAG="heady-canary-$(date +%Y%m%d-%H%M%S)"
STABLE_REVISION=""
CANARY_REVISION=""
DEPLOY_START=$(date +%s)
ANALYSIS_FAILURES=0
INCIDENT_CREATED=false

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
gcloud_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then echo "[DRY-RUN] gcloud $*"
  else gcloud "$@"; fi
}

get_stable_revision() {
  gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --format="value(status.traffic[0].revisionName)" 2>/dev/null || echo ""
}

get_service_url() {
  gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --format="value(status.url)" 2>/dev/null || echo ""
}

# Query Prometheus for a metric over the last N minutes
query_prometheus() {
  local query="$1"
  local encoded
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${query}'))")
  curl -sf "${PROMETHEUS_URL}/api/v1/query?query=${encoded}" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" \
    2>/dev/null || echo "0"
}

# Get error rate for the canary revision over last N minutes
get_canary_error_rate() {
  local window="${1:-5m}"
  query_prometheus \
    "sum(rate(http_requests_total{service=\"${SERVICE}\",revision=\"${CANARY_REVISION}\",code=~\"5..\"}[${window}])) / sum(rate(http_requests_total{service=\"${SERVICE}\",revision=\"${CANARY_REVISION}\"}[${window}]))"
}

# Get p99 latency for the canary revision
get_canary_p99_latency_ms() {
  local window="${1:-5m}"
  local result
  result=$(query_prometheus \
    "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service=\"${SERVICE}\",revision=\"${CANARY_REVISION}\"}[${window}])) by (le))")
  echo "$(python3 -c "print(round(float('${result}') * 1000, 2))")"
}

# Get success rate for the canary revision
get_canary_success_rate() {
  local window="${1:-5m}"
  query_prometheus \
    "sum(rate(http_requests_total{service=\"${SERVICE}\",revision=\"${CANARY_REVISION}\",code=~\"[23]..\"}[${window}])) / sum(rate(http_requests_total{service=\"${SERVICE}\",revision=\"${CANARY_REVISION}\"}[${window}]))"
}

# Evaluate metrics against φ thresholds
evaluate_metrics() {
  local error_rate
  local latency_ms
  local success_rate
  error_rate=$(get_canary_error_rate "5m")
  latency_ms=$(get_canary_p99_latency_ms "5m")
  success_rate=$(get_canary_success_rate "5m")

  metric "Error rate:   ${error_rate} (warn: ${ERROR_RATE_WARN}, fail: ${ERROR_RATE_FAIL})"
  metric "Success rate: ${success_rate} (min: ${SUCCESS_RATE_MIN} = 1/φ)"
  metric "p99 latency:  ${latency_ms}ms (warn: ${LATENCY_WARN_MS}ms, fail: ${LATENCY_FAIL_MS}ms)"

  local regression_detected=false

  # Check error rate
  if (( $(echo "${error_rate} >= ${ERROR_RATE_FAIL}" | bc -l) )); then
    error "REGRESSION: error rate ${error_rate} ≥ ${ERROR_RATE_FAIL} (CSL HIGH = 1/φ)"
    regression_detected=true
  elif (( $(echo "${error_rate} >= ${ERROR_RATE_WARN}" | bc -l) )); then
    warn "WARNING: error rate ${error_rate} ≥ ${ERROR_RATE_WARN} (CSL MODERATE = 1/φ²)"
    (( ANALYSIS_FAILURES++ )) || true
  fi

  # Check success rate
  if (( $(echo "${success_rate} < ${SUCCESS_RATE_MIN}" | bc -l) )); then
    error "REGRESSION: success rate ${success_rate} < ${SUCCESS_RATE_MIN} (1/φ threshold)"
    regression_detected=true
  fi

  # Check p99 latency
  if (( $(echo "${latency_ms} >= ${LATENCY_FAIL_MS}" | bc -l) )); then
    error "REGRESSION: p99 latency ${latency_ms}ms ≥ ${LATENCY_FAIL_MS}ms (fib11)"
    regression_detected=true
  elif (( $(echo "${latency_ms} >= ${LATENCY_WARN_MS}" | bc -l) )); then
    warn "WARNING: p99 latency ${latency_ms}ms ≥ ${LATENCY_WARN_MS}ms (fib10)"
    (( ANALYSIS_FAILURES++ )) || true
  fi

  # Too many warnings = soft failure
  if [[ $ANALYSIS_FAILURES -ge $FIB_4 ]]; then  # fib(4)=3 warnings = fail
    error "Too many warnings (${ANALYSIS_FAILURES} ≥ fib(4)=${FIB_4}) — treating as regression"
    regression_detected=true
  fi

  if [[ "$regression_detected" == "true" ]]; then
    return 1
  fi

  success "All metrics within φ-thresholds"
  return 0
}

create_incident() {
  local reason="$1"
  if [[ "$INCIDENT_CREATED" == "true" ]] || [[ -z "$INCIDENT_WEBHOOK" ]]; then
    return
  fi

  INCIDENT_CREATED=true
  local payload
  payload=$(cat <<EOF
{
  "event_action": "trigger",
  "routing_key": "${PAGERDUTY_ROUTING_KEY:-}",
  "payload": {
    "summary": "Canary deployment regression: ${SERVICE} (${CANARY_REVISION})",
    "severity": "critical",
    "source": "heady-canary-deploy",
    "custom_details": {
      "service": "${SERVICE}",
      "revision": "${CANARY_REVISION}",
      "region": "${REGION}",
      "reason": "${reason}",
      "canary_tag": "${CANARY_TAG}",
      "phi": "${PHI}"
    }
  }
}
EOF
  )

  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${INCIDENT_WEBHOOK}" >/dev/null 2>&1 || true

  warn "Incident created: ${reason}"
}

rollback_and_abort() {
  local reason="$1"
  error "ROLLBACK: ${reason}"

  # Immediately route 100% to stable revision
  gcloud_cmd run services update-traffic "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --to-revisions="${STABLE_REVISION}=100"

  create_incident "$reason"
  error "Deployment FAILED and rolled back to ${STABLE_REVISION}"
  exit 1
}

shift_traffic() {
  local percent="$1"
  local canary_rev="$2"
  local stable_rev="$3"
  local stable_percent=$(( 100 - percent ))

  log "Traffic shift → canary: ${percent}%, stable: ${stable_percent}%"

  if [[ "$percent" -eq 100 ]]; then
    gcloud_cmd run services update-traffic "$SERVICE" \
      --region="$REGION" --project="$PROJECT" \
      --to-latest
  else
    gcloud_cmd run services update-traffic "$SERVICE" \
      --region="$REGION" --project="$PROJECT" \
      --to-revisions="${canary_rev}=${percent},${stable_rev}=${stable_percent}"
  fi
  success "Traffic: ${percent}% → ${canary_rev}, ${stable_percent}% → ${stable_rev}"
}

run_analysis_loop() {
  local duration_min="$1"
  local total_secs=$(( duration_min * 60 ))
  local poll_interval=$ANALYSIS_POLL_INTERVAL
  local elapsed=0
  local poll_count=0
  local pass_count=0

  log "Analysis loop: ${duration_min}m (${total_secs}s), polling every ${poll_interval}s"

  while [[ $elapsed -lt $total_secs ]]; do
    sleep "$poll_interval"
    elapsed=$(( elapsed + poll_interval ))
    (( poll_count++ )) || true

    local remaining=$(( total_secs - elapsed ))
    log "Analysis progress: ${elapsed}s/${total_secs}s (${remaining}s remaining)"

    if evaluate_metrics; then
      (( pass_count++ )) || true
      log "Poll ${poll_count}: PASS (${pass_count}/${poll_count} passing)"
    else
      local fail_count=$(( poll_count - pass_count ))
      warn "Poll ${poll_count}: FAIL (fail_count=${fail_count})"

      # φ-threshold: if ≥ 38.2% of polls fail, abort early
      local fail_rate
      fail_rate=$(echo "scale=4; ${fail_count}/${poll_count}" | bc)
      if (( $(echo "${fail_rate} >= ${PHI_SQUARE_INV}" | bc -l) )); then
        rollback_and_abort "Canary fail rate ${fail_rate} ≥ 1/φ² threshold after ${poll_count} polls"
      fi
    fi
  done

  # Final verdict: require ≥ 61.8% (1/φ) of polls passing
  local final_rate
  final_rate=$(echo "scale=4; ${pass_count}/${poll_count}" | bc)
  metric "Analysis complete: ${pass_count}/${poll_count} polls passed (rate: ${final_rate})"

  if (( $(echo "${final_rate} >= ${SUCCESS_RATE_MIN}" | bc -l) )); then
    success "Analysis PASSED (${final_rate} ≥ 1/φ = ${SUCCESS_RATE_MIN})"
    return 0
  else
    rollback_and_abort "Insufficient poll pass rate: ${final_rate} < 1/φ (${SUCCESS_RATE_MIN})"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN CANARY FLOW
# ─────────────────────────────────────────────────────────────────────────────
section "Heady Canary Deploy — φ=${PHI}"
log "Service:         ${SERVICE}"
log "Image:           ${IMAGE}"
log "Region:          ${REGION}"
log "Initial traffic: ${CANARY_INITIAL_PERCENT}% (fib5)"
log "Monitor window:  ${ANALYSIS_DURATION_MIN}m (fib8)"
log "Error threshold: ${ERROR_RATE_FAIL} (1/φ)"
log "Success minimum: ${SUCCESS_RATE_MIN} (1/φ)"

# ── Capture stable baseline ──────────────────────────────────────────────────
section "Step 1: Capture baseline"
STABLE_REVISION=$(get_stable_revision)
log "Stable: ${STABLE_REVISION}"

# ── Deploy canary revision ───────────────────────────────────────────────────
section "Step 2: Deploy canary (0% traffic)"
gcloud_cmd run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --tag="$CANARY_TAG" \
  --no-traffic \
  --set-env-vars="CANARY=true,CANARY_TAG=${CANARY_TAG}" \
  --concurrency="${FIB_9}" \
  --timeout="${FIB_10}s"

CANARY_REVISION=$(gcloud run revisions list \
  --service="$SERVICE" --region="$REGION" --project="$PROJECT" \
  --format="value(name)" --limit=1 \
  --sort-by="~metadata.creationTimestamp" 2>/dev/null || echo "")
log "Canary revision: ${CANARY_REVISION}"

# ── Initial traffic: fib(5)=5% ───────────────────────────────────────────────
section "Step 3: Canary at ${CANARY_INITIAL_PERCENT}% (fib5)"
shift_traffic "$CANARY_INITIAL_PERCENT" "$CANARY_REVISION" "$STABLE_REVISION"
log "Waiting ${FIB_7}s for initial traffic to flow..."
sleep "$FIB_7"

# ── Analysis loop: fib(8)=21 minutes ─────────────────────────────────────────
section "Step 4: Analysis (${ANALYSIS_DURATION_MIN}m = fib8)"
run_analysis_loop "$ANALYSIS_DURATION_MIN"

# ── Promote to fib(10)=55% ───────────────────────────────────────────────────
section "Step 5: Promote → ${CANARY_MID_PERCENT}% (fib10)"
shift_traffic "$CANARY_MID_PERCENT" "$CANARY_REVISION" "$STABLE_REVISION"
sleep $(( FIB_7 * 60 ))    # wait fib(7)=13 minutes at 55%
evaluate_metrics || rollback_and_abort "Regression detected at ${CANARY_MID_PERCENT}%"

# ── Full promotion: 100% ─────────────────────────────────────────────────────
section "Step 6: Full promotion → 100%"
shift_traffic "$CANARY_FINAL_PERCENT" "$CANARY_REVISION" "$STABLE_REVISION"
success "Canary promotion COMPLETE!"

# ── Summary ───────────────────────────────────────────────────────────────────
DEPLOY_END=$(date +%s)
DURATION=$(( DEPLOY_END - DEPLOY_START ))
section "Deployment Summary"
success "Service:           ${SERVICE}"
success "Canary revision:   ${CANARY_REVISION}"
success "Previous revision: ${STABLE_REVISION}"
success "Total duration:    ${DURATION}s"
success "URL:               $(get_service_url)"
log ""
log "Rollback: gcloud run services update-traffic ${SERVICE} --region=${REGION} --to-revisions=${STABLE_REVISION}=100"
