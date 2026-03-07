#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Secret Manager Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
# Creates all required secrets in Google Cloud Secret Manager and grants
# the Cloud Run service account access to read them.
#
# Prerequisites:
#   - gcloud CLI authenticated with project owner/editor role
#   - A .env file with all secret values (or pass them interactively)
#
# Usage:
#   chmod +x setup-secrets.sh
#   ./setup-secrets.sh                    # Interactive mode (prompts for values)
#   ./setup-secrets.sh --from-env .env    # Load from .env file
#   ./setup-secrets.sh --dry-run          # Preview without creating
#
# © 2026 HeadySystems Inc. — Proprietary
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-heady-production}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_ACCOUNT="heady-cloudrun-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Secret Definitions ────────────────────────────────────────────────────────
# Format: SECRET_NAME:CATEGORY:DESCRIPTION
# Categories: critical, required, optional

SECRETS=(
  # Critical (app won't start without these)
  "DATABASE_URL:critical:Neon PostgreSQL connection string (postgres://...)"
  "HEADY_API_KEY:critical:Internal API gateway authentication key"

  # Required (full functionality depends on these)
  "PERPLEXITY_API_KEY:required:Perplexity Sonar Pro API key"
  "GEMINI_API_KEY:required:Google Gemini API key"
  "GITHUB_TOKEN:required:GitHub personal access token (repo + org scope)"
  "CLOUDFLARE_API_TOKEN:required:Cloudflare API token (Workers + DNS)"
  "SENTRY_DSN:required:Sentry error tracking DSN"

  # Auth & Session
  "JWT_SECRET:required:JWT signing secret (min 64 chars)"
  "SESSION_SECRET:required:Express session secret (min 64 chars)"
  "ADMIN_TOKEN:required:Admin access token"

  # AI Provider Keys
  "OPENAI_API_KEY:optional:OpenAI GPT-4o API key"
  "CLAUDE_API_KEY:optional:Anthropic Claude API key"
  "ANTHROPIC_ADMIN_KEY:optional:Anthropic admin API key"
  "GROQ_API_KEY:optional:Groq fast inference API key"
  "HF_TOKEN:optional:Hugging Face access token"

  # Infrastructure
  "UPSTASH_REDIS_REST_URL:optional:Upstash Redis REST URL"
  "UPSTASH_REDIS_REST_TOKEN:optional:Upstash Redis REST token"
  "NEON_API_KEY:optional:Neon database management API key"
  "PINECONE_API_KEY:optional:Pinecone vector database API key"

  # Payments & Services
  "STRIPE_SECRET_KEY:optional:Stripe payment processing secret key"
  "OP_SERVICE_ACCOUNT_TOKEN:optional:1Password service account token"
)

# ── Functions ─────────────────────────────────────────────────────────────────

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Heady™ Secret Manager Setup${NC}"
  echo -e "${CYAN}  Project: ${PROJECT_ID}${NC}"
  echo -e "${CYAN}  Region:  ${REGION}${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

check_prerequisites() {
  echo -e "${YELLOW}Checking prerequisites...${NC}"

  if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}ERROR: gcloud CLI not found. Install: https://cloud.google.com/sdk/install${NC}"
    exit 1
  fi

  # Verify project
  CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
  if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
    gcloud config set project "$PROJECT_ID"
  fi

  # Enable Secret Manager API
  echo -e "${YELLOW}Enabling Secret Manager API...${NC}"
  gcloud services enable secretmanager.googleapis.com --quiet 2>/dev/null || true

  # Ensure service account exists
  echo -e "${YELLOW}Verifying service account: ${SERVICE_ACCOUNT}${NC}"
  if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo -e "${YELLOW}Creating service account...${NC}"
    gcloud iam service-accounts create heady-cloudrun-sa \
      --display-name="Heady Cloud Run Service Account" \
      --description="Service account for Heady Cloud Run deployments"
  fi

  echo -e "${GREEN}Prerequisites OK${NC}"
  echo ""
}

create_secret() {
  local secret_name="$1"
  local secret_value="$2"
  local description="$3"

  # Check if secret already exists
  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "  ${YELLOW}EXISTS${NC}  $secret_name — adding new version"
    echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
      --project="$PROJECT_ID" \
      --data-file=- \
      --quiet
  else
    echo -e "  ${GREEN}CREATE${NC}  $secret_name"
    echo -n "$secret_value" | gcloud secrets create "$secret_name" \
      --project="$PROJECT_ID" \
      --replication-policy="user-managed" \
      --locations="$REGION" \
      --labels="app=heady,managed-by=heady-deploy" \
      --data-file=- \
      --quiet
  fi

  # Grant Cloud Run SA access to read this secret
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
}

load_env_file() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo -e "${RED}ERROR: .env file not found: ${env_file}${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Loading secrets from ${env_file}...${NC}"
  echo ""

  local created=0
  local skipped=0

  for entry in "${SECRETS[@]}"; do
    IFS=':' read -r secret_name category description <<< "$entry"

    # Extract value from .env file
    local value
    value=$(grep -E "^${secret_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'"'"']//;s/["'"'"']$//')

    if [ -n "$value" ] && [ "$value" != "" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "  ${CYAN}DRY-RUN${NC}  Would create: $secret_name (${category})"
      else
        create_secret "$secret_name" "$value" "$description"
      fi
      ((created++))
    else
      if [ "$category" = "critical" ]; then
        echo -e "  ${RED}MISSING${NC}  $secret_name — ${RED}CRITICAL: App will not start without this${NC}"
      elif [ "$category" = "required" ]; then
        echo -e "  ${YELLOW}MISSING${NC}  $secret_name — Required for full functionality"
      else
        echo -e "  ${YELLOW}SKIP${NC}    $secret_name — Optional (not in .env)"
      fi
      ((skipped++))
    fi
  done

  echo ""
  echo -e "${GREEN}Done: ${created} secrets created/updated, ${skipped} skipped${NC}"
}

interactive_mode() {
  echo -e "${YELLOW}Interactive mode: Enter values for each secret (press Enter to skip optional ones)${NC}"
  echo ""

  local created=0

  for entry in "${SECRETS[@]}"; do
    IFS=':' read -r secret_name category description <<< "$entry"

    local prompt_color="${NC}"
    local label=""
    if [ "$category" = "critical" ]; then
      prompt_color="${RED}"
      label="[CRITICAL]"
    elif [ "$category" = "required" ]; then
      prompt_color="${YELLOW}"
      label="[REQUIRED]"
    else
      prompt_color="${NC}"
      label="[OPTIONAL]"
    fi

    echo -e "${prompt_color}${label}${NC} ${description}"
    read -r -s -p "  ${secret_name}= " value
    echo ""

    if [ -n "$value" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "  ${CYAN}DRY-RUN${NC}  Would create: $secret_name"
      else
        create_secret "$secret_name" "$value" "$description"
      fi
      ((created++))
    else
      if [ "$category" = "critical" ]; then
        echo -e "  ${RED}WARNING: Skipping critical secret ${secret_name}${NC}"
      fi
    fi
    echo ""
  done

  echo -e "${GREEN}Done: ${created} secrets created/updated${NC}"
}

grant_compute_sa_access() {
  echo ""
  echo -e "${YELLOW}Granting default Compute Engine SA access (for Cloud Build)...${NC}"

  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
  COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

  for entry in "${SECRETS[@]}"; do
    IFS=':' read -r secret_name category description <<< "$entry"
    gcloud secrets add-iam-policy-binding "$secret_name" \
      --project="$PROJECT_ID" \
      --member="serviceAccount:${COMPUTE_SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet 2>/dev/null || true
  done

  echo -e "${GREEN}Compute SA access granted${NC}"
}

print_summary() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Setup Complete${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Verify secrets:"
  echo "    gcloud secrets list --project=${PROJECT_ID}"
  echo ""
  echo "  View a secret version:"
  echo "    gcloud secrets versions access latest --secret=DATABASE_URL"
  echo ""
  echo "  Rotate a secret:"
  echo "    echo -n 'new-value' | gcloud secrets versions add SECRET_NAME --data-file=-"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

DRY_RUN=false
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --from-env)
      ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--from-env .env] [--dry-run] [--project PROJECT_ID]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

print_header
check_prerequisites

if [ -n "$ENV_FILE" ]; then
  load_env_file "$ENV_FILE"
else
  interactive_mode
fi

if [ "$DRY_RUN" = false ]; then
  grant_compute_sa_access
fi

print_summary
