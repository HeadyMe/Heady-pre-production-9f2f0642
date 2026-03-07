#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HIVE-003: Git Forge Deployment Script
# © 2024-2026 HeadySystems Inc. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════
#
# Builds, tags, and deploys HeadyOS containers to Cloud Run
# with multi-role support and zero-downtime rollouts.
#
# Usage:
#   ./git-forge-deploy.sh                    # Deploy manager
#   ./git-forge-deploy.sh --role worker      # Deploy worker
#   ./git-forge-deploy.sh --all              # Deploy all roles
#   ./git-forge-deploy.sh --dry-run          # Preview only
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────
PROJECT="${GCP_PROJECT:-heady-production}"
REGION="${GCP_REGION:-us-central1}"
REGISTRY="${GCR_REGISTRY:-gcr.io/${PROJECT}}"
IMAGE_NAME="heady-universal"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "3.2.2")
ROLE="${2:-manager}"
DRY_RUN=false
DEPLOY_ALL=false

# ─── Parse arguments ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --role) ROLE="$2"; shift 2 ;;
        --all) DEPLOY_ALL=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --project) PROJECT="$2"; shift 2 ;;
        --region) REGION="$2"; shift 2 ;;
        *) shift ;;
    esac
done

ALL_ROLES=(manager mcp worker probe gateway web)

echo "═══ HeadyOS Git Forge Deployer ═══"
echo "  Project:  ${PROJECT}"
echo "  Region:   ${REGION}"
echo "  Version:  ${VERSION}"
echo "  Image:    ${IMAGE_NAME}:${VERSION}"
echo "  Mode:     $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'LIVE')"
echo "═══════════════════════════════════"
echo ""

# ─── Step 1: Build universal container ────────────────────────
echo "📦 Building universal container..."

if [ "$DRY_RUN" = false ]; then
    docker build \
        -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
        -t "${REGISTRY}/${IMAGE_NAME}:latest" \
        -f Dockerfile.universal \
        .
    echo "✅ Container built: ${IMAGE_NAME}:${VERSION}"
else
    echo "[DRY RUN] Would build: ${IMAGE_NAME}:${VERSION}"
fi

# ─── Step 2: Push to registry ─────────────────────────────────
echo ""
echo "📤 Pushing to registry..."

if [ "$DRY_RUN" = false ]; then
    docker push "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    docker push "${REGISTRY}/${IMAGE_NAME}:latest"
    echo "✅ Pushed to ${REGISTRY}"
else
    echo "[DRY RUN] Would push: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
fi

# ─── Step 3: Deploy to Cloud Run ──────────────────────────────
deploy_role() {
    local role=$1
    local service="heady-${role}"
    local port=3301

    echo ""
    echo "🚀 Deploying: ${service} (role=${role})"

    if [ "$DRY_RUN" = false ]; then
        gcloud run deploy "${service}" \
            --image "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
            --region "${REGION}" \
            --project "${PROJECT}" \
            --platform managed \
            --set-env-vars "HEADY_ROLE=${role},NODE_ENV=production,PORT=${port}" \
            --port "${port}" \
            --min-instances 1 \
            --max-instances 10 \
            --cpu 2 \
            --memory 1Gi \
            --timeout 300 \
            --allow-unauthenticated \
            --quiet

        echo "✅ Deployed: ${service}"

        # Get service URL
        local url=$(gcloud run services describe "${service}" \
            --region "${REGION}" \
            --project "${PROJECT}" \
            --format='value(status.url)' 2>/dev/null || echo "unknown")
        echo "   URL: ${url}"
    else
        echo "[DRY RUN] Would deploy: ${service} with HEADY_ROLE=${role}"
    fi
}

if [ "$DEPLOY_ALL" = true ]; then
    echo "Deploying ALL roles: ${ALL_ROLES[*]}"
    for r in "${ALL_ROLES[@]}"; do
        deploy_role "$r"
    done
else
    deploy_role "$ROLE"
fi

# ─── Step 4: Health verification ──────────────────────────────
echo ""
echo "🏥 Health verification..."

if [ "$DRY_RUN" = false ] && [ "$DEPLOY_ALL" = false ]; then
    service="heady-${ROLE}"
    url=$(gcloud run services describe "${service}" \
        --region "${REGION}" \
        --project "${PROJECT}" \
        --format='value(status.url)' 2>/dev/null || echo "")

    if [ -n "$url" ]; then
        echo "  Checking: ${url}/health/live"
        if curl -sf "${url}/health/live" --max-time 10 > /dev/null 2>&1; then
            echo "  ✅ Health check passed"
        else
            echo "  ⚠️  Health check failed — service may still be starting"
        fi
    fi
else
    echo "[DRY RUN] Would verify health"
fi

echo ""
echo "═══ Deployment Complete ═══"
echo "  Version: ${VERSION}"
echo "  Time:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════"
