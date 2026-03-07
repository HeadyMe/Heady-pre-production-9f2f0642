#!/usr/bin/env bash
# deploy-sites.sh — Deploy all Heady static sites to Cloud Run
# Usage: ./deploy-sites.sh [PROJECT_ID] [REGION]
# © 2026 HeadySystems Inc.

set -euo pipefail

PROJECT="${1:-gen-lang-client-0920560496}"
REGION="${2:-us-central1}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Site → Cloud Run service name → Custom domain
declare -A SITES=(
  [headyme]="heady-web-headyme:headyme.com"
  [heady-ai]="heady-web-ai:heady-ai.com"
  [headyos]="heady-web-os:headyos.com"
  [headysystems]="heady-web-systems:headysystems.com"
  [headyex]="heady-web-ex:headyex.com"
  [headyfinance]="heady-web-finance:headyfinance.com"
  [headyconnection-com]="heady-web-conn-com:headyconnection.com"
  [headyconnection-org]="heady-web-conn-org:headyconnection.org"
  [admin-portal]="heady-web-admin:admin.headyme.com"
)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  HeadyWeb — Cloud Run Deployment                            ║"
echo "║  Project: $PROJECT | Region: $REGION                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Enable required APIs
echo "» Enabling Cloud Run API..."
gcloud services enable run.googleapis.com --project="$PROJECT" 2>/dev/null || true

for SITE in "${!SITES[@]}"; do
  IFS=':' read -r SERVICE DOMAIN <<< "${SITES[$SITE]}"
  
  echo ""
  echo "━━━ Deploying $SITE → $SERVICE ($DOMAIN) ━━━"
  
  # Build and push
  IMAGE="gcr.io/$PROJECT/$SERVICE:latest"
  
  echo "  📦 Building $SITE..."
  docker build \
    -f "$DIR/Dockerfile.static" \
    --build-arg "SITE=$SITE" \
    -t "$IMAGE" \
    "$DIR"
  
  echo "  🚀 Pushing to GCR..."
  docker push "$IMAGE"
  
  echo "  ☁️  Deploying to Cloud Run..."
  gcloud run deploy "$SERVICE" \
    --image="$IMAGE" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated \
    --port=8080 \
    --memory=128Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3 \
    --project="$PROJECT" \
    --quiet
  
  # Get the Cloud Run URL
  URL=$(gcloud run services describe "$SERVICE" \
    --platform=managed --region="$REGION" --project="$PROJECT" \
    --format="value(status.url)")
  
  echo "  ✅ Live at: $URL"
  
  # Map custom domain
  echo "  🌐 Mapping domain: $DOMAIN"
  gcloud run domain-mappings create \
    --service="$SERVICE" \
    --domain="$DOMAIN" \
    --region="$REGION" \
    --project="$PROJECT" 2>/dev/null || \
  echo "  ⚠️  Domain mapping already exists or requires DNS verification"
  
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ All 9 sites deployed!                                   ║"
echo "║  Next: Configure DNS CNAME records pointing to ghs.google   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
