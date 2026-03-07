# HeadyStack Deployment Guide

**Version:** 3.0.1 "Aether"

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migrations](#database-migrations)
4. [Docker Compose (Local/Staging)](#docker-compose)
5. [Google Cloud Run](#google-cloud-run)
6. [Cloudflare Workers (Edge)](#cloudflare-workers)
7. [Render.com](#render)
8. [Kubernetes (Helm)](#kubernetes)
9. [Monitoring & Observability](#monitoring)
10. [Secrets Management](#secrets-management)
11. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

- Node.js ≥ 20.0.0
- Docker ≥ 24.0 and Docker Compose ≥ 2.20
- PostgreSQL 16 with pgvector extension
- Redis 7
- (For Cloud Run) Google Cloud SDK, project with billing enabled
- (For CI/CD) GitHub Actions secrets configured

---

## Environment Setup

```bash
# Copy example env file
cp .env.example .env

# Required minimum for production:
NODE_ENV=production
DATABASE_URL=postgresql://heady:STRONG_PASS@db-host:5432/headydb
REDIS_URL=redis://redis-host:6379
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
HEADY_API_KEY=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Validation runs at boot (Phase 0). Missing required vars abort startup in production mode.

---

## Database Migrations

```bash
# Run all pending migrations
npm run migrate

# Manually:
node scripts/migrate.js

# Using psql directly:
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

Migrations are idempotent — safe to re-run. The migration runner tracks applied migrations in the `schema_migrations` table.

---

## Docker Compose

### Start Full Stack

```bash
# Build images and start all services
docker compose up -d

# Tail logs
docker compose logs -f heady-manager

# Check status
docker compose ps

# Stop
docker compose down

# Stop and remove volumes (destructive!)
docker compose down -v
```

### Services

| Service | Port | Notes |
|---------|------|-------|
| heady-manager | 8080 | Main application |
| postgres | 5432 | pgvector PostgreSQL 16 |
| redis | 6379 | Redis 7 with 256MB limit |
| pgbouncer | 5433 | Connection pooler |
| otel-collector | 4317, 4318 | Telemetry receiver |

### Resource Limits (Production)

Configured in `docker-compose.yml`:
- heady-manager: 2 CPU, 2GB RAM
- postgres: 1 CPU, 1GB RAM
- redis: 0.5 CPU, 512MB RAM

---

## Google Cloud Run

### One-Time Setup

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com

# Create service account for Cloud Run
gcloud iam service-accounts create headystack-runner \
  --display-name="HeadyStack Cloud Run SA"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:headystack-runner@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Store Secrets in Secret Manager

```bash
# Store each secret
echo -n "$DATABASE_URL" | gcloud secrets create heady-database-url --data-file=-
echo -n "$REDIS_URL" | gcloud secrets create heady-redis-url --data-file=-
echo -n "$JWT_SECRET" | gcloud secrets create heady-jwt-secret --data-file=-
echo -n "$JWT_REFRESH_SECRET" | gcloud secrets create heady-jwt-refresh-secret --data-file=-
echo -n "$HEADY_API_KEY" | gcloud secrets create heady-api-key --data-file=-
echo -n "$ANTHROPIC_API_KEY" | gcloud secrets create heady-anthropic-key --data-file=-
echo -n "$OPENAI_API_KEY" | gcloud secrets create heady-openai-key --data-file=-

# Update a secret
echo -n "new-value" | gcloud secrets versions add heady-database-url --data-file=-
```

### Build and Deploy

```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT/headystack:3.0.1 .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT/headystack:3.0.1

# Deploy to Cloud Run
gcloud run deploy headystack \
  --image gcr.io/YOUR_PROJECT/headystack:3.0.1 \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 80 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --service-account headystack-runner@YOUR_PROJECT.iam.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets \
    DATABASE_URL=heady-database-url:latest,\
    REDIS_URL=heady-redis-url:latest,\
    JWT_SECRET=heady-jwt-secret:latest,\
    JWT_REFRESH_SECRET=heady-jwt-refresh-secret:latest,\
    HEADY_API_KEY=heady-api-key:latest,\
    ANTHROPIC_API_KEY=heady-anthropic-key:latest,\
    OPENAI_API_KEY=heady-openai-key:latest

# Get the service URL
gcloud run services describe headystack \
  --region us-central1 \
  --format "value(status.url)"
```

### Custom Domain

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service headystack \
  --domain api.headysystems.ai \
  --region us-central1

# Add DNS records as instructed by the output
```

### Traffic Management (Canary)

```bash
# Deploy new revision without traffic
gcloud run deploy headystack \
  --image gcr.io/YOUR_PROJECT/headystack:3.0.2 \
  --no-traffic

# Split traffic 10% canary
gcloud run services update-traffic headystack \
  --to-revisions LATEST=10,STABLE=90

# Promote to 100%
gcloud run services update-traffic headystack \
  --to-latest
```

---

## Cloudflare Workers

HeadyStack can deploy a lightweight edge proxy via Cloudflare Workers for geo-routing, caching, and DDoS protection in front of the Cloud Run origin.

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate
wrangler login

# Deploy edge proxy worker
wrangler deploy --config configs/cloudflare/wrangler.toml

# Set secrets
wrangler secret put ORIGIN_URL
wrangler secret put HEADY_API_KEY
```

The worker routes requests to the nearest Cloud Run region and applies edge-level rate limiting.

---

## Render

### Setup

1. Connect your GitHub repository in the Render dashboard
2. Create a new **Web Service**
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Set environment variables from `.env.example`
6. Create a **PostgreSQL** database (Render managed)
7. Create a **Redis** instance (Render managed)
8. Set `DATABASE_URL` and `REDIS_URL` from Render connection strings

### Auto-Deploy

Render auto-deploys on push to `main`. Trigger manually:

```bash
curl -X POST https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'
```

---

## Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Check rollout
kubectl rollout status deployment/headystack -n headystack

# Rollback
kubectl rollout undo deployment/headystack -n headystack
```

Helm chart coming in v3.1.0.

---

## Monitoring

### Health Endpoints

```bash
# Liveness
curl https://your-deployment/health

# Readiness
curl https://your-deployment/ready

# Deep system pulse
curl -H "Authorization: Bearer $TOKEN" https://your-deployment/pulse

# Prometheus metrics
curl https://your-deployment/metrics
```

### OpenTelemetry

Configure `OTEL_EXPORTER_ENDPOINT` to point to your OTEL collector or a cloud backend:
- **Google Cloud Trace:** `https://cloudtrace.googleapis.com`
- **Grafana Cloud:** `https://otlp-gateway-prod-xxx.grafana.net/otlp`
- **Honeycomb:** `https://api.honeycomb.io`
- **Self-hosted:** `http://otel-collector:4318/v1/traces`

### Logs (Cloud Run)

```bash
# Stream logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=headystack" \
  --limit 100 \
  --format "value(textPayload)"

# Or via the Logs Explorer in GCP console
```

---

## Secrets Management

### Local Development

Use `.env` file (never commit to git).

### Cloud Run / GCP

Use Google Cloud Secret Manager — all secrets injected as env vars at container startup.

### Rotation

```bash
# Rotate JWT secret (triggers forced re-login for all users)
NEW_SECRET=$(openssl rand -hex 32)
echo -n "$NEW_SECRET" | gcloud secrets versions add heady-jwt-secret --data-file=-

# Deploy with new secret version
gcloud run deploy headystack --update-secrets JWT_SECRET=heady-jwt-secret:latest
```

---

## Rollback Procedures

### Cloud Run Rollback

```bash
# List revisions
gcloud run revisions list --service headystack --region us-central1

# Rollback to previous revision
gcloud run services update-traffic headystack \
  --to-revisions headystack-00042-abc=100 \
  --region us-central1
```

### Docker Compose Rollback

```bash
# Pull previous image
docker pull gcr.io/YOUR_PROJECT/headystack:3.0.0

# Update compose override
IMAGE_TAG=3.0.0 docker compose up -d heady-manager
```

### Database Rollback

Migrations are forward-only. For rollback, restore from backup:

```bash
# List Cloud SQL backups (if using Cloud SQL)
gcloud sql backups list --instance heady-postgres

# Restore
gcloud sql backups restore BACKUP_ID \
  --restore-instance heady-postgres \
  --backup-instance heady-postgres
```
