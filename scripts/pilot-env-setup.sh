#!/bin/bash
# =============================================================================
# Heady™ Pilot Environment Setup
# Creates isolated pilot infrastructure on GCP
# =============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-heady-pilot}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="heady-pilot"
DB_INSTANCE="heady-pilot-db"
REDIS_INSTANCE="heady-pilot-redis"

echo "=========================================="
echo "  Heady™ Pilot Environment Setup"
echo "=========================================="

# --- 1. Create Pilot Database ---
echo "[1/6] Creating pilot database..."
gcloud sql databases create heady_pilot \
  --instance="$DB_INSTANCE" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Database may already exist"

# Enable pgvector
gcloud sql connect "$DB_INSTANCE" --project="$PROJECT_ID" << 'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS pilot;

-- Projection tables for pilot
CREATE TABLE IF NOT EXISTS pilot.projections (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  version INTEGER DEFAULT 1,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot.projection_history (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  version INTEGER,
  state JSONB,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot.telemetry (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot.vector_memory (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384),
  x FLOAT, y FLOAT, z FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_vector_embedding
  ON pilot.vector_memory USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_pilot_telemetry_event
  ON pilot.telemetry (event_type, created_at);
SQL

echo "✅ Pilot database created with pgvector"

# --- 2. Create Redis Namespace ---
echo "[2/6] Configuring Redis pilot namespace..."
echo "Using namespace prefix: pilot:*"
echo "Ensure REDIS_KEY_PREFIX=pilot: in pilot env config"

# --- 3. Create Pilot Secrets ---
echo "[3/6] Creating pilot secrets in Secret Manager..."
PILOT_SECRETS=(
  "pilot-jwt-secret"
  "pilot-db-password"
  "pilot-api-key"
  "pilot-anthropic-key"
)

for secret in "${PILOT_SECRETS[@]}"; do
  VALUE=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
  echo -n "$VALUE" | gcloud secrets create "$secret" \
    --data-file=- \
    --project="$PROJECT_ID" 2>/dev/null || \
  echo -n "$VALUE" | gcloud secrets versions add "$secret" \
    --data-file=- \
    --project="$PROJECT_ID"
  echo "  ✅ $secret"
done

# --- 4. Deploy Pilot Cloud Run Service ---
echo "[4/6] Deploying pilot Cloud Run service..."
gcloud run deploy "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="gcr.io/$PROJECT_ID/heady-manager:pilot" \
  --platform=managed \
  --min-instances=1 \
  --max-instances=3 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=pilot,HEADY_ENVIRONMENT=pilot,LOG_LEVEL=debug,PILOT_MODE=true" \
  --allow-unauthenticated

PILOT_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)')

echo "✅ Pilot service deployed: $PILOT_URL"

# --- 5. Configure Cloudflare DNS ---
echo "[5/6] Configure Cloudflare DNS (manual step)..."
echo "  Add CNAME record: pilot.headyme.com → $PILOT_URL"
echo "  Enable Cloudflare proxy (orange cloud)"

# --- 6. Verify ---
echo "[6/6] Verifying pilot environment..."
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PILOT_URL/health")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Pilot environment is healthy"
else
  echo "⚠️  Health check returned $HTTP_CODE — check logs"
fi

echo ""
echo "=========================================="
echo "  Pilot Environment Ready"
echo "  URL: $PILOT_URL"
echo "  Domain: pilot.headyme.com (after DNS)"
echo "  Dashboard: $PILOT_URL:3850"
echo "=========================================="
