#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Monitoring Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
# Creates Cloud Monitoring dashboard, alert policies, and notification channels.
#
# Usage:
#   chmod +x setup-monitoring.sh
#   ./setup-monitoring.sh
#   ./setup-monitoring.sh --email eric@headysystems.com
#   ./setup-monitoring.sh --dry-run
#
# © 2026 HeadySystems Inc. — Proprietary
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-heady-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=false
NOTIFICATION_EMAIL=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)    DRY_RUN=true; shift ;;
    --email)      NOTIFICATION_EMAIL="$2"; shift 2 ;;
    --project)    PROJECT_ID="$2"; shift 2 ;;
    *)            echo "Unknown: $1"; exit 1 ;;
  esac
done

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Heady™ Monitoring Setup — ${PROJECT_ID}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Enable APIs
echo -e "${YELLOW}Enabling monitoring APIs...${NC}"
if [ "$DRY_RUN" = false ]; then
  gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID" --quiet
  gcloud services enable logging.googleapis.com --project="$PROJECT_ID" --quiet
  gcloud services enable cloudtrace.googleapis.com --project="$PROJECT_ID" --quiet
fi

# Create notification channel
CHANNEL_ID=""
if [ -n "$NOTIFICATION_EMAIL" ]; then
  echo -e "${YELLOW}Creating email notification channel: ${NOTIFICATION_EMAIL}${NC}"
  if [ "$DRY_RUN" = false ]; then
    CHANNEL_ID=$(gcloud alpha monitoring channels create \
      --project="$PROJECT_ID" \
      --display-name="Heady Alerts — ${NOTIFICATION_EMAIL}" \
      --type=email \
      --channel-labels="email_address=${NOTIFICATION_EMAIL}" \
      --format='value(name)' 2>/dev/null || echo "")

    if [ -n "$CHANNEL_ID" ]; then
      echo -e "${GREEN}Notification channel created: ${CHANNEL_ID}${NC}"
    else
      echo -e "${YELLOW}Could not create channel (may already exist)${NC}"
    fi
  fi
fi

# Create dashboard
echo -e "${YELLOW}Creating monitoring dashboard...${NC}"
if [ "$DRY_RUN" = false ]; then
  gcloud monitoring dashboards create \
    --project="$PROJECT_ID" \
    --config-from-file="${SCRIPT_DIR}/dashboard.json" \
    2>/dev/null && echo -e "${GREEN}Dashboard created${NC}" \
    || echo -e "${YELLOW}Dashboard may already exist${NC}"
else
  echo -e "${CYAN}DRY-RUN: Would create dashboard from dashboard.json${NC}"
fi

# Create alert policies
echo -e "${YELLOW}Creating alert policies...${NC}"
POLICIES=$(cat "${SCRIPT_DIR}/alert-policies.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for i, policy in enumerate(data['alertPolicies']):
    print(json.dumps(policy))
" 2>/dev/null || echo "")

if [ -n "$POLICIES" ]; then
  echo "$POLICIES" | while IFS= read -r policy; do
    POLICY_NAME=$(echo "$policy" | python3 -c "import json,sys; print(json.load(sys.stdin)['displayName'])" 2>/dev/null)
    echo -e "  Creating: ${POLICY_NAME}"

    # Inject notification channel if available
    if [ -n "$CHANNEL_ID" ]; then
      policy=$(echo "$policy" | python3 -c "
import json, sys
p = json.load(sys.stdin)
p['notificationChannels'] = ['$CHANNEL_ID']
print(json.dumps(p))
" 2>/dev/null)
    fi

    if [ "$DRY_RUN" = false ]; then
      echo "$policy" | gcloud alpha monitoring policies create \
        --project="$PROJECT_ID" \
        --policy-from-file=- \
        2>/dev/null && echo -e "  ${GREEN}Created${NC}" \
        || echo -e "  ${YELLOW}May already exist${NC}"
    fi
  done
else
  echo -e "${YELLOW}Could not parse alert policies (ensure python3 is available)${NC}"
fi

# Create log-based metric for custom health check failures
echo -e "${YELLOW}Creating log-based metrics...${NC}"
if [ "$DRY_RUN" = false ]; then
  gcloud logging metrics create heady_health_check_failures \
    --project="$PROJECT_ID" \
    --description="Count of health check failures in heady-manager" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="heady-manager" AND textPayload=~"HEALTH CHECK FAILED"' \
    2>/dev/null && echo -e "${GREEN}Log metric created${NC}" \
    || echo -e "${YELLOW}Log metric may already exist${NC}"

  gcloud logging metrics create heady_graceful_shutdown \
    --project="$PROJECT_ID" \
    --description="Count of graceful shutdown events" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="heady-manager" AND textPayload=~"Graceful shutdown initiated"' \
    2>/dev/null && echo -e "${GREEN}Shutdown metric created${NC}" \
    || echo -e "${YELLOW}Shutdown metric may already exist${NC}"

  gcloud logging metrics create heady_circuit_breaker_open \
    --project="$PROJECT_ID" \
    --description="Count of circuit breaker OPEN events" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="heady-manager" AND textPayload=~"circuit.*OPEN"' \
    2>/dev/null && echo -e "${GREEN}Circuit breaker metric created${NC}" \
    || echo -e "${YELLOW}Circuit breaker metric may already exist${NC}"
fi

echo ""
echo -e "${GREEN}Monitoring setup complete.${NC}"
echo ""
echo "  View dashboard:"
echo "    https://console.cloud.google.com/monitoring/dashboards?project=${PROJECT_ID}"
echo ""
echo "  View alert policies:"
echo "    https://console.cloud.google.com/monitoring/alerting?project=${PROJECT_ID}"
echo ""
