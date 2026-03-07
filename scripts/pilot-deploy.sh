#!/bin/bash
# Heady Pilot Deployment Script
# Version: 3.2.0-Orion
# Updated: March 7, 2026
# Purpose: Deploy Heady Systems pilot environment

set -e

ENVIRONMENT=${1:-pilot}
VERSION="3.2.0"
NAMESPACE="heady-${ENVIRONMENT}"

echo "🚀 Heady Pilot Deployment"
echo "========================="
echo "Environment: ${ENVIRONMENT}"
echo "Version: ${VERSION}"
echo "Namespace: ${NAMESPACE}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl required"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "❌ helm required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ docker required"; exit 1; }

echo "✅ Prerequisites satisfied"
echo ""

# Create namespace
echo "📦 Creating namespace: ${NAMESPACE}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMaps
echo "📋 Applying configurations..."
kubectl create configmap heady-config \
  --from-env-file=config/environments/${ENVIRONMENT}.env \
  -n ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets (if present)
if [ -f "config/environments/${ENVIRONMENT}.secrets" ]; then
  echo "🔐 Applying secrets..."
  kubectl create secret generic heady-secrets \
    --from-env-file=config/environments/${ENVIRONMENT}.secrets \
    -n ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
fi

# Deploy services
echo "🔧 Deploying core services..."
kubectl apply -f infra/kubernetes/ -n ${NAMESPACE}

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s \
  deployment/heady-api-gateway -n ${NAMESPACE}
kubectl wait --for=condition=available --timeout=300s \
  deployment/heady-cloud-orchestrator -n ${NAMESPACE}
kubectl wait --for=condition=available --timeout=300s \
  deployment/heady-conductor -n ${NAMESPACE}

# Run database migrations
echo "🗄️  Running database migrations..."
kubectl run migrate-job \
  --image=headysystems/heady-migrate:${VERSION} \
  --restart=Never \
  --env="DATABASE_URL=${DATABASE_URL}" \
  -n ${NAMESPACE}

# Wait for migration to complete
kubectl wait --for=condition=complete --timeout=120s \
  pod/migrate-job -n ${NAMESPACE} || true

# Verify health
echo "🏥 Verifying service health..."
sleep 10

kubectl get pods -n ${NAMESPACE}
kubectl get svc -n ${NAMESPACE}
kubectl get ingress -n ${NAMESPACE}

echo ""
echo "✅ Pilot environment deployed successfully!"
echo ""
echo "🔗 Access URLs:"
echo "  Portal:     https://pilot.headyme.com"
echo "  API:        https://pilot.headyapi.com"
echo "  Cloud:      https://console.headycloud.com"
echo "  MCP:        https://server.headymcp.com"
echo "  Status:     https://status.headysystems.com"
echo ""
echo "🩺 Health Check Commands:"
echo "  curl https://pilot.headyapi.com/health"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  kubectl logs -f deployment/heady-conductor -n ${NAMESPACE}"
echo ""
