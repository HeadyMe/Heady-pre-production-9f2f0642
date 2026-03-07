#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ VPC & Artifact Registry Setup
# ═══════════════════════════════════════════════════════════════════════════════
# One-time infrastructure setup for Cloud Run deployment.
# Creates: Artifact Registry, VPC connector, service account, IAM bindings.
#
# Usage: ./vpc-connector-setup.sh [--project heady-production]
# © 2026 HeadySystems Inc.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-heady-production}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_ACCOUNT="heady-cloudrun-sa"
REPO_NAME="heady-docker-repo"
VPC_CONNECTOR="heady-vpc-connector"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --project) PROJECT_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Heady™ Infrastructure Setup — ${PROJECT_ID}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

# Enable APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com \
  --project="$PROJECT_ID" --quiet

# Create Artifact Registry
echo -e "${YELLOW}Creating Artifact Registry...${NC}"
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Heady Docker images" \
  --project="$PROJECT_ID" \
  2>/dev/null && echo -e "${GREEN}Created${NC}" || echo "Already exists"

# Create service account
echo -e "${YELLOW}Creating service account...${NC}"
gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
  --display-name="Heady Cloud Run SA" \
  --description="Service account for Heady Cloud Run services" \
  --project="$PROJECT_ID" \
  2>/dev/null && echo -e "${GREEN}Created${NC}" || echo "Already exists"

SA_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant IAM roles
echo -e "${YELLOW}Granting IAM roles...${NC}"
ROLES=(
  "roles/secretmanager.secretAccessor"
  "roles/logging.logWriter"
  "roles/monitoring.metricWriter"
  "roles/cloudtrace.agent"
  "roles/artifactregistry.reader"
)

for role in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --quiet 2>/dev/null
  echo -e "  ${GREEN}Granted${NC} ${role}"
done

# Create VPC connector
echo -e "${YELLOW}Creating VPC connector (for private DB/Redis access)...${NC}"
gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
  --region="$REGION" \
  --range="10.8.0.0/28" \
  --project="$PROJECT_ID" \
  2>/dev/null && echo -e "${GREEN}VPC connector created${NC}" || echo "Already exists"

echo ""
echo -e "${GREEN}Infrastructure setup complete.${NC}"
echo ""
echo "  Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
echo "  Service Account:   ${SA_EMAIL}"
echo "  VPC Connector:     ${VPC_CONNECTOR}"
echo ""
echo "  Next: Run setup-secrets.sh to create secrets in Secret Manager"
