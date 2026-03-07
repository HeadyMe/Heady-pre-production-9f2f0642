#!/bin/bash
# =============================================================================
# HeadySystems — Deploy New Vertical
# Usage: ./deploy-vertical.sh <vertical-id> <domain> [options]
#
# Options:
#   --subdomain         Use subdomain routing (e.g. health.headyme.com)
#   --redeploy          Trigger Cloud Run redeploy after config generation
#   --project <id>      GCP project ID (overrides HEADY_GCP_PROJECT env var)
#   --service <name>    Cloud Run service name (default: heady-web)
#   --region <region>   GCP region (default: us-central1)
#   --dry-run           Print actions without executing them
#
# Examples:
#   ./deploy-vertical.sh healthcare health.headyme.com --subdomain
#   ./deploy-vertical.sh legal legal.headyme.com --subdomain --redeploy
#   ./deploy-vertical.sh realestate homes.headyme.com --redeploy --project heady-prod
# =============================================================================

set -euo pipefail

# ── Color helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()    { echo -e "${CYAN}[heady]${NC} $*"; }
success(){ echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*" >&2; }
bold()   { echo -e "${BOLD}$*${NC}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
VERTICAL_ID=""
DOMAIN=""
USE_SUBDOMAIN=false
TRIGGER_REDEPLOY=false
DRY_RUN=false
GCP_PROJECT="${HEADY_GCP_PROJECT:-heady-production}"
CLOUD_RUN_SERVICE="${HEADY_SERVICE:-heady-web}"
GCP_REGION="${HEADY_REGION:-us-central1}"

if [[ $# -lt 2 ]]; then
  error "Missing required arguments."
  echo ""
  echo "Usage: $0 <vertical-id> <domain> [options]"
  echo "       $0 healthcare health.headyme.com --subdomain --redeploy"
  exit 1
fi

VERTICAL_ID="$1"
DOMAIN="$2"
shift 2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --subdomain)   USE_SUBDOMAIN=true ;;
    --redeploy)    TRIGGER_REDEPLOY=true ;;
    --dry-run)     DRY_RUN=true ;;
    --project)     GCP_PROJECT="$2"; shift ;;
    --service)     CLOUD_RUN_SERVICE="$2"; shift ;;
    --region)      GCP_REGION="$2"; shift ;;
    *) warn "Unknown option: $1" ;;
  esac
  shift
done

# ── Validate vertical ID ──────────────────────────────────────────────────────
if [[ ! "$VERTICAL_ID" =~ ^[a-z][a-z0-9-]{1,31}$ ]]; then
  error "vertical-id must be lowercase alphanumeric with hyphens (2-32 chars), got: '$VERTICAL_ID'"
  exit 1
fi

if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  error "Invalid domain format: '$DOMAIN'"
  exit 1
fi

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERTICALS_DIR="$REPO_ROOT/A3-verticals"
REGISTRY_FILE="$REPO_ROOT/vertical-registry.json"
VERTICAL_DIR="$VERTICALS_DIR/$VERTICAL_ID"
CONFIG_FILE="$VERTICAL_DIR/vertical_config.yaml"
INDEX_FILE="$VERTICAL_DIR/index.html"

bold "═══════════════════════════════════════════════════"
bold "  HeadySystems — New Vertical Deployment"
bold "═══════════════════════════════════════════════════"
log "Vertical ID : $VERTICAL_ID"
log "Domain      : $DOMAIN"
log "Subdomain   : $USE_SUBDOMAIN"
log "Redeploy    : $TRIGGER_REDEPLOY"
log "GCP Project : $GCP_PROJECT"
log "Dry run     : $DRY_RUN"
echo ""

# ── Check for existing vertical ───────────────────────────────────────────────
if [[ -d "$VERTICAL_DIR" ]]; then
  warn "Vertical '$VERTICAL_ID' already exists at $VERTICAL_DIR"
  read -p "Overwrite existing config? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Aborted."
    exit 0
  fi
fi

# ── Ensure dependencies ───────────────────────────────────────────────────────
for cmd in node jq; do
  if ! command -v "$cmd" &>/dev/null; then
    error "Required tool not found: $cmd"
    exit 1
  fi
done

if [[ "$TRIGGER_REDEPLOY" == "true" ]] && ! command -v gcloud &>/dev/null; then
  error "gcloud CLI not found. Install it or run without --redeploy."
  exit 1
fi

# ── Generate vertical_config.yaml ────────────────────────────────────────────
log "Generating vertical config: $CONFIG_FILE"

VERTICAL_NAME="$(echo "$VERTICAL_ID" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1))substr($i,2)}1')"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$DRY_RUN" == "false" ]]; then
  mkdir -p "$VERTICAL_DIR"

  cat > "$CONFIG_FILE" <<YAML
# =============================================================================
# HeadySystems Vertical Config — ${VERTICAL_NAME}
# Generated: ${CREATED_AT}
# Edit this file to customize the vertical's behavior and content.
# =============================================================================

vertical_id: ${VERTICAL_ID}
domain: ${DOMAIN}
fallback_path: /${VERTICAL_ID}
routing:
  type: $(if [[ "$USE_SUBDOMAIN" == "true" ]]; then echo "subdomain"; else echo "path"; fi)
  aliases: []

brand:
  name: "Heady ${VERTICAL_NAME}"
  tagline: "AI Orchestration for ${VERTICAL_NAME}"
  accent_color: "#06b6d4"
  logo_variant: ${VERTICAL_ID}
  font_family: "Inter, sans-serif"

content:
  hero:
    title: "AI Orchestration for ${VERTICAL_NAME}"
    subtitle: "Intelligent agent workflows for ${VERTICAL_NAME} professionals"
    cta_primary: "Get Started"
    cta_secondary: "View Docs"
  features:
    - "Intelligent Workflow Automation"
    - "Real-Time Data Orchestration"
    - "Compliance Monitoring"
    - "Custom Agent Templates"
  agents:
    - name: "Workflow Orchestrator"
      description: "Automates multi-step ${VERTICAL_NAME} processes"
    - name: "Data Processor"
      description: "Ingests and normalizes ${VERTICAL_NAME} data streams"
    - name: "Compliance Monitor"
      description: "Continuous regulatory compliance checks"
    - name: "Report Generator"
      description: "Automated reporting and analytics"
  compliance_badges: []
  case_study:
    client: "${VERTICAL_NAME} Enterprise (placeholder)"
    result: "Placeholder: describe measurable outcome here"

pricing:
  tiers:
    - name: Starter
      price: "\$29/mo"
      features:
        - "5 agent workflows"
        - "10K API calls/mo"
        - "Email support"
    - name: Professional
      price: "\$79/mo"
      features:
        - "Unlimited workflows"
        - "100K API calls/mo"
        - "Priority support"
        - "Custom integrations"
    - name: Enterprise
      price: "Custom"
      features:
        - "Dedicated infrastructure"
        - "SLA guarantee"
        - "Onboarding support"
        - "Compliance packages"

meta:
  title: "Heady ${VERTICAL_NAME} — AI Orchestration Platform"
  description: "AI-powered agent orchestration for ${VERTICAL_NAME} workflows. Automate, monitor, and scale your operations."
  keywords: ["AI", "${VERTICAL_ID}", "agent orchestration", "workflow automation"]
  og_image: "/assets/${VERTICAL_ID}-og.png"
  analytics_id: "G-$(echo "$VERTICAL_ID" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
  canonical_url: "https://${DOMAIN}"

server:
  cache_ttl: 3600
  rate_limit: 100
  cors_origins:
    - "https://headyme.com"
    - "https://${DOMAIN}"
  health_check: "/_health"

created_at: "${CREATED_AT}"
updated_at: "${CREATED_AT}"
YAML
  success "Created vertical config: $CONFIG_FILE"
else
  log "[DRY RUN] Would create: $CONFIG_FILE"
fi

# ── Generate placeholder landing page ────────────────────────────────────────
log "Generating placeholder landing page: $INDEX_FILE"

if [[ "$DRY_RUN" == "false" ]]; then
  cat > "$INDEX_FILE" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady ${VERTICAL_NAME} — AI Orchestration Platform</title>
  <meta name="description" content="AI-powered agent orchestration for ${VERTICAL_NAME} workflows.">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0e17;
      color: #e2e8f0;
      font-family: 'Inter', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 3rem;
      max-width: 480px;
      backdrop-filter: blur(12px);
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #06b6d4; }
    p { color: #94a3b8; margin-bottom: 1.5rem; }
    .badge {
      display: inline-block;
      background: rgba(6,182,212,0.15);
      border: 1px solid rgba(6,182,212,0.3);
      color: #06b6d4;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    footer { margin-top: 2rem; font-size: 0.75rem; color: #475569; }
    footer a { color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Coming Soon</div>
    <h1>Heady ${VERTICAL_NAME}</h1>
    <p>AI Orchestration for ${VERTICAL_NAME} workflows.<br>This landing page is a placeholder — customize index.html.</p>
    <p style="font-size:0.875rem;">Domain: <code style="color:#06b6d4">${DOMAIN}</code></p>
    <footer>
      <a href="https://headyme.com">← Back to HeadySystems</a>
      &nbsp;·&nbsp;
      <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
    </footer>
  </div>
</body>
</html>
HTML
  success "Created placeholder landing page: $INDEX_FILE"
else
  log "[DRY RUN] Would create: $INDEX_FILE"
fi

# ── Update vertical-registry.json ─────────────────────────────────────────────
log "Updating vertical registry: $REGISTRY_FILE"

if [[ "$DRY_RUN" == "false" ]]; then
  # Initialize registry if it doesn't exist
  if [[ ! -f "$REGISTRY_FILE" ]]; then
    echo '{"verticals": [], "updated_at": ""}' > "$REGISTRY_FILE"
  fi

  # Check if vertical already exists in registry
  EXISTING=$(jq --arg id "$VERTICAL_ID" '.verticals[] | select(.id == $id)' "$REGISTRY_FILE")

  if [[ -n "$EXISTING" ]]; then
    # Update existing entry
    jq --arg id "$VERTICAL_ID" \
       --arg domain "$DOMAIN" \
       --arg ts "$CREATED_AT" \
       '(.verticals[] | select(.id == $id)) |= . + {
         "domain": $domain,
         "updated_at": $ts
       } | .updated_at = $ts' \
       "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
    success "Updated registry entry for: $VERTICAL_ID"
  else
    # Append new entry
    jq --arg id "$VERTICAL_ID" \
       --arg domain "$DOMAIN" \
       --arg name "Heady $VERTICAL_NAME" \
       --arg ts "$CREATED_AT" \
       --argjson subdomain "$USE_SUBDOMAIN" \
       '.verticals += [{
         "id": $id,
         "domain": $domain,
         "name": $name,
         "subdomain_routing": $subdomain,
         "status": "active",
         "created_at": $ts,
         "updated_at": $ts
       }] | .updated_at = $ts' \
       "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
    success "Registered new vertical: $VERTICAL_ID ($(jq '.verticals | length' "$REGISTRY_FILE") total)"
  fi
else
  log "[DRY RUN] Would update registry: $REGISTRY_FILE"
fi

# ── Validate config against schema ───────────────────────────────────────────
log "Validating generated config..."

if [[ "$DRY_RUN" == "false" ]] && [[ -f "$CONFIG_FILE" ]]; then
  # Basic YAML structure validation using Node.js
  node - "$CONFIG_FILE" <<'NODESCRIPT'
const fs = require('fs');
const path = require('path');
const configPath = process.argv[2];

try {
  const content = fs.readFileSync(configPath, 'utf8');
  // Required fields check
  const requiredFields = ['vertical_id', 'domain', 'brand', 'content', 'meta'];
  for (const field of requiredFields) {
    if (!content.includes(`${field}:`)) {
      console.error(`Missing required field: ${field}`);
      process.exit(1);
    }
  }
  console.log('Config validation passed.');
} catch (e) {
  console.error('Config validation failed:', e.message);
  process.exit(1);
}
NODESCRIPT
  success "Config validation passed"
fi

# ── Print DNS configuration instructions ─────────────────────────────────────
echo ""
bold "═══════════════════════════════════════════════════"
bold "  DNS Configuration Instructions"
bold "═══════════════════════════════════════════════════"
echo ""

CLOUD_RUN_IP="${HEADY_CLOUD_RUN_IP:-<YOUR_CLOUD_RUN_IP>}"
CLOUD_RUN_URL="${HEADY_CLOUD_RUN_URL:-<YOUR_CLOUD_RUN_URL>.run.app}"

if [[ "$USE_SUBDOMAIN" == "true" ]]; then
  log "Subdomain routing detected for: ${DOMAIN}"
  echo ""
  echo "  Option A — Direct A record (if Cloud Run has static IP via NEG):"
  echo "  ┌─────────────────────────────────────────────────────────────┐"
  echo "  │  Type  │ Name                      │ Value                  │"
  echo "  │────────┼───────────────────────────┼────────────────────────│"
  SUBDOMAIN_PART="${DOMAIN%%.*}"
  PARENT_DOMAIN="${DOMAIN#*.}"
  echo "  │  A     │ ${SUBDOMAIN_PART}                        │ ${CLOUD_RUN_IP}      │"
  echo "  └─────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  Option B — CNAME to Cloud Run URL (recommended for managed cert):"
  echo "  ┌─────────────────────────────────────────────────────────────┐"
  echo "  │  Type  │ Name                      │ Value                  │"
  echo "  │────────┼───────────────────────────┼────────────────────────│"
  echo "  │  CNAME │ ${SUBDOMAIN_PART}                        │ ${CLOUD_RUN_URL}     │"
  echo "  └─────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  Option C — Cloudflare Proxy (orange cloud enabled):"
  echo "    1. Add CNAME record: ${SUBDOMAIN_PART} → ${CLOUD_RUN_URL}"
  echo "    2. Enable Cloudflare proxy (orange cloud)"
  echo "    3. SSL/TLS mode: Full (strict)"
  echo "    4. Page Rule: ${DOMAIN}/* → Cache Level: Bypass (for API paths)"
else
  log "Path-based routing: https://headyme.com/${VERTICAL_ID}"
  echo ""
  echo "  No DNS changes required — vertical served at path:"
  echo "  https://headyme.com/${VERTICAL_ID}"
  echo ""
  echo "  Ensure site-router.js includes path routing for: /${VERTICAL_ID}"
fi

echo ""
bold "  Cloud Run Domain Mapping (required for custom subdomain):"
echo "  gcloud run domain-mappings create \\"
echo "    --service ${CLOUD_RUN_SERVICE} \\"
echo "    --domain ${DOMAIN} \\"
echo "    --region ${GCP_REGION} \\"
echo "    --project ${GCP_PROJECT}"
echo ""

# ── Trigger Cloud Run redeploy ────────────────────────────────────────────────
if [[ "$TRIGGER_REDEPLOY" == "true" ]]; then
  echo ""
  bold "═══════════════════════════════════════════════════"
  bold "  Triggering Cloud Run Redeploy"
  bold "═══════════════════════════════════════════════════"

  if [[ "$DRY_RUN" == "false" ]]; then
    log "Deploying updated container to Cloud Run..."
    gcloud run deploy "$CLOUD_RUN_SERVICE" \
      --source . \
      --region "$GCP_REGION" \
      --project "$GCP_PROJECT" \
      --allow-unauthenticated \
      --set-env-vars "VERTICAL_REGISTRY=/app/vertical-registry.json" \
      --quiet
    success "Cloud Run deployment triggered."
    log "Monitor at: https://console.cloud.google.com/run/detail/${GCP_REGION}/${CLOUD_RUN_SERVICE}"
  else
    log "[DRY RUN] Would run: gcloud run deploy $CLOUD_RUN_SERVICE --source . --region $GCP_REGION --project $GCP_PROJECT"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
bold "═══════════════════════════════════════════════════"
bold "  Vertical '${VERTICAL_ID}' ready"
bold "═══════════════════════════════════════════════════"
success "Config:      $CONFIG_FILE"
success "Landing page: $INDEX_FILE"
success "Registry:    $REGISTRY_FILE"
echo ""
log "Next steps:"
echo "  1. Edit $INDEX_FILE with production content"
echo "  2. Edit $CONFIG_FILE to customize brand/features"
echo "  3. Configure DNS as shown above"
echo "  4. Run with --redeploy to push to Cloud Run"
echo ""
