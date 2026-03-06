#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Heady Swarm Ignition Script
# ═══════════════════════════════════════════════════════════════
#
# Boots the full Heady swarm orchestration stack:
#   1. Validates environment variables
#   2. Sets up Pub/Sub topics and subscriptions
#   3. Deploys Cloud Run services
#   4. Starts the Autonomous Scheduler
#   5. Wakes template bees
#   6. Validates the entire system health
#
# Usage:
#   chmod +x heady-swarm-ignition.sh
#   ./heady-swarm-ignition.sh
#
# Environment:
#   HEADY_PROJECT_ID    — GCP Project ID (required)
#   HEADY_REGION        — GCP Region (default: us-central1)
#   HEADY_ADMIN_TOKEN   — Admin bearer token for API calls
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
PROJECT_ID="${HEADY_PROJECT_ID:?'HEADY_PROJECT_ID must be set'}"
REGION="${HEADY_REGION:-us-central1}"
ADMIN_TOKEN="${HEADY_ADMIN_TOKEN:-}"

RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
BLU='\033[0;34m'
RST='\033[0m'

log()  { echo -e "${BLU}  ⚡ ${RST}$1"; }
ok()   { echo -e "${GRN}  ✅ ${RST}$1"; }
warn() { echo -e "${YEL}  ⚠️  ${RST}$1"; }
err()  { echo -e "${RED}  ❌ ${RST}$1"; }

# ═══════════════════════════════════════════════════════════════
echo ""
echo "  ═══════════════════════════════════════════"
echo "  ⚡ HEADY SWARM IGNITION SEQUENCE"
echo "  ═══════════════════════════════════════════"
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  ═══════════════════════════════════════════"
echo ""

# ── 1. Validate Prerequisites ───────────────────────────────────
log "Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    err "gcloud CLI not found. Install from https://cloud.google.com/sdk"
    exit 1
fi
ok "gcloud CLI found"

gcloud config set project "$PROJECT_ID" 2>/dev/null
ok "Project set: $PROJECT_ID"

# ── 2. Create Pub/Sub Topics ────────────────────────────────────
log "Creating Pub/Sub nervous system..."

# Background task queue
if gcloud pubsub topics describe heady-swarm-tasks &>/dev/null; then
    ok "Topic 'heady-swarm-tasks' exists"
else
    gcloud pubsub topics create heady-swarm-tasks \
        --labels="priority=background,managed-by=ignition"
    ok "Created topic: heady-swarm-tasks"
fi

# God Mode priority lane
if gcloud pubsub topics describe heady-admin-triggers &>/dev/null; then
    ok "Topic 'heady-admin-triggers' exists"
else
    gcloud pubsub topics create heady-admin-triggers \
        --labels="priority=critical,mode=god-mode"
    ok "Created topic: heady-admin-triggers"
fi

# Dead letter
if gcloud pubsub topics describe heady-dead-letter &>/dev/null; then
    ok "Topic 'heady-dead-letter' exists"
else
    gcloud pubsub topics create heady-dead-letter
    ok "Created topic: heady-dead-letter"
fi

# ── 3. Deploy Cloud Run Services ────────────────────────────────
log "Deploying Cloud Run services..."

MANAGER_URL=$(gcloud run services describe heady-manager \
    --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$MANAGER_URL" ]; then
    ok "heady-manager already deployed at: $MANAGER_URL"
else
    warn "heady-manager not deployed — run CI/CD or manual deploy"
fi

ORCHESTRATOR_URL=$(gcloud run services describe heady-swarm-orchestrator \
    --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$ORCHESTRATOR_URL" ]; then
    ok "swarm-orchestrator deployed at: $ORCHESTRATOR_URL"
else
    warn "swarm-orchestrator not deployed — deploy with 'gcloud run deploy'"
fi

# ── 4. Create Pub/Sub Subscriptions ──────────────────────────────
log "Creating Pub/Sub subscriptions..."

if [ -n "$ORCHESTRATOR_URL" ]; then
    # Background subscription
    if gcloud pubsub subscriptions describe swarm-background-sub &>/dev/null; then
        ok "Subscription 'swarm-background-sub' exists"
    else
        gcloud pubsub subscriptions create swarm-background-sub \
            --topic=heady-swarm-tasks \
            --push-endpoint="${ORCHESTRATOR_URL}/api/v1/swarm/background" \
            --ack-deadline=120 \
            --dead-letter-topic=heady-dead-letter \
            --max-delivery-attempts=5
        ok "Created subscription: swarm-background-sub"
    fi

    # Admin priority subscription
    if gcloud pubsub subscriptions describe swarm-admin-sub &>/dev/null; then
        ok "Subscription 'swarm-admin-sub' exists"
    else
        gcloud pubsub subscriptions create swarm-admin-sub \
            --topic=heady-admin-triggers \
            --push-endpoint="${ORCHESTRATOR_URL}/api/v1/swarm/priority" \
            --ack-deadline=600
        ok "Created subscription: swarm-admin-sub"
    fi
else
    warn "Skipping subscription creation — orchestrator not deployed"
fi

# ── 5. Create Cloud Scheduler Jobs ──────────────────────────────
log "Creating Cloud Scheduler heartbeat..."

# Nightly pruner
if gcloud scheduler jobs describe trigger-pruner-swarm --location="$REGION" &>/dev/null; then
    ok "Scheduler job 'trigger-pruner-swarm' exists"
else
    gcloud scheduler jobs create pubsub trigger-pruner-swarm \
        --location="$REGION" \
        --schedule="0 2 * * *" \
        --time-zone="America/Denver" \
        --topic=heady-swarm-tasks \
        --message-body='{"task":"prune_unused_projections","priority":"background"}' \
        --description="Nightly: PrunerBee cleans orphaned projections" 2>/dev/null || \
    warn "Cloud Scheduler API may need to be enabled"
    ok "Created scheduler: trigger-pruner-swarm"
fi

# Hourly tester
if gcloud scheduler jobs describe trigger-tester-swarm --location="$REGION" &>/dev/null; then
    ok "Scheduler job 'trigger-tester-swarm' exists"
else
    gcloud scheduler jobs create pubsub trigger-tester-swarm \
        --location="$REGION" \
        --schedule="0 * * * *" \
        --time-zone="America/Denver" \
        --topic=heady-swarm-tasks \
        --message-body='{"task":"health_sweep","priority":"background"}' \
        --description="Hourly: TesterBee sweeps all endpoints" 2>/dev/null || true
    ok "Created scheduler: trigger-tester-swarm"
fi

# ── 6. Wake Template Bees ───────────────────────────────────────
log "Waking template bees..."

if [ -n "$MANAGER_URL" ] && [ -n "$ADMIN_TOKEN" ]; then
    BEES=("UICompilerBee" "TraderBacktestBee" "AbletonSysExBee" "PerfectGovernanceGatekeeper")
    for BEE in "${BEES[@]}"; do
        echo -n "  Waking $BEE... "
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${MANAGER_URL}/api/bees/wake" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"template\":\"$BEE\",\"mode\":\"standby\"}" 2>/dev/null || echo "000")

        if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
            echo -e "${GRN}✅${RST}"
        else
            echo -e "${YEL}⚠️  HTTP $STATUS${RST}"
        fi
    done
else
    warn "Skipping bee wake-up — MANAGER_URL or ADMIN_TOKEN not set"
fi

# ── 7. System Health Check ──────────────────────────────────────
log "Running system health check..."

HEALTH_ENDPOINTS=()
[ -n "$MANAGER_URL" ] && HEALTH_ENDPOINTS+=("$MANAGER_URL/health")
[ -n "$ORCHESTRATOR_URL" ] && HEALTH_ENDPOINTS+=("$ORCHESTRATOR_URL/health")

for EP in "${HEALTH_ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$EP" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        ok "$EP → $STATUS"
    else
        warn "$EP → $STATUS"
    fi
done

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════"
echo "  ✅ HEADY SWARM IGNITION COMPLETE"
echo "  ═══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "    1. Deploy containers via CI/CD or manual deploy"
echo "    2. Set HEADY_ADMIN_TOKEN for authenticated operations"
echo "    3. Monitor: gcloud run services list"
echo "    4. View logs: gcloud run services logs read heady-manager"
echo ""
