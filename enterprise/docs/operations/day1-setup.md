# Day 1 Operations Guide

**HeadySystems v3.2.2**  
**φ-revision:** 1.618  
**Audience:** DevOps, SRE, founding engineers  

---

## Overview

This guide walks through setting up a new HeadySystems deployment from zero to production-ready in a single day. Estimated time: fib(8)=21 hours (3 engineers) or fib(10)=55 hours (1 engineer).

---

## Prerequisites

- [ ] Google Cloud Project created with billing enabled
- [ ] Cloudflare account with 9 domains pointed to Cloudflare nameservers
- [ ] GitHub repository access (`headysystems/heady-systems`)
- [ ] `gcloud` CLI authenticated: `gcloud auth login`
- [ ] `pnpm` 8+ installed: `npm install -g pnpm`
- [ ] `node` 20+ installed

---

## Phase 1: Environment Setup (2–3 hours)

### 1.1 Clone the Repository

```bash
git clone https://github.com/headysystems/heady-systems.git
cd heady-systems
pnpm install
```

### 1.2 Create Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local` with all required values (see Secrets Configuration below).

### 1.3 GCP Project Setup

```bash
export PROJECT_ID="heady-production"
export REGION="us-central1"

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sql.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  cloudtrace.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  pubsub.googleapis.com \
  artifactregistry.googleapis.com \
  --project=$PROJECT_ID

echo "✓ GCP APIs enabled"
```

### 1.4 Create Service Account

```bash
gcloud iam service-accounts create heady-platform \
  --display-name="Heady Platform SA" \
  --project=$PROJECT_ID

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:heady-platform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:heady-platform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:heady-platform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

echo "✓ Service account created"
```

---

## Phase 2: Secrets Configuration (1–2 hours)

### 2.1 Create Secrets in GCP Secret Manager

```bash
# Create all required secrets
secrets=(
  "heady-database-url"
  "heady-redis-url"
  "heady-jwt-secret"
  "heady-openai-api-key"
  "heady-anthropic-api-key"
  "heady-stripe-secret-key"
  "heady-cloudflare-api-token"
  "heady-sentry-dsn"
  "heady-otel-api-key"
)

for secret in "${secrets[@]}"; do
  gcloud secrets create "$secret" \
    --replication-policy="automatic" \
    --project=$PROJECT_ID
  echo "Created secret: $secret"
done

echo "✓ Secrets created. Now populate each secret:"
echo "  gcloud secrets versions add SECRET_NAME --data-file=value.txt"
```

### 2.2 Populate Critical Secrets

```bash
# Database URL
echo -n "postgresql://heady:PASSWORD@/heady?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets versions add heady-database-url --data-file=- --project=$PROJECT_ID

# Redis URL (from Cloud Memorystore)
echo -n "redis://10.x.x.x:6379" | \
  gcloud secrets versions add heady-redis-url --data-file=- --project=$PROJECT_ID

# JWT Secret (must be ≥ fib(16)=987 bit entropy)
openssl rand -base64 89 | \
  gcloud secrets versions add heady-jwt-secret --data-file=- --project=$PROJECT_ID

echo "✓ Critical secrets populated"
```

### 2.3 GitHub Actions Secrets

In GitHub repository Settings → Secrets, add:
- `GCP_PROJECT_ID`
- `GCP_SA_KEY` (base64-encoded service account key)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_IDS` (JSON object: domain → zoneId)
- `SENTRY_AUTH_TOKEN`

---

## Phase 3: Database Initialization (2–3 hours)

### 3.1 Create Cloud SQL Instance

```bash
gcloud sql instances create heady-primary \
  --database-version=POSTGRES_16 \
  --tier=db-custom-8-32768 \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=610GB \
  --backup-start-time=03:00 \
  --retained-backups-count=8 \
  --enable-point-in-time-recovery \
  --retained-transaction-log-days=34 \
  --project=$PROJECT_ID

echo "✓ Cloud SQL instance created (takes ~5 minutes)"
```

### 3.2 Create Database and User

```bash
# Create database
gcloud sql databases create heady \
  --instance=heady-primary \
  --project=$PROJECT_ID

# Create user
gcloud sql users create heady \
  --instance=heady-primary \
  --password=$(openssl rand -base64 34) \
  --project=$PROJECT_ID

echo "✓ Database and user created"
```

### 3.3 Run Migrations

```bash
# Connect via Cloud SQL Auth Proxy
cloud-sql-proxy $PROJECT_ID:$REGION:heady-primary &
sleep 5

# Run migrations
DATABASE_URL="postgresql://heady:PASSWORD@localhost:5432/heady" \
  pnpm --filter @heady-ai/core run migrate

# Enable pgvector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

echo "✓ Database migrations complete"
```

### 3.4 Create Redis Instance

```bash
gcloud redis instances create heady-redis-primary \
  --size=8 \
  --region=$REGION \
  --redis-version=redis_7_0 \
  --enable-auth \
  --persistence-mode=RDB \
  --project=$PROJECT_ID

echo "✓ Redis instance created"
```

---

## Phase 4: Service Deployment (3–5 hours)

### 4.1 Build Container Images

```bash
# Build all services
pnpm build

# Build and push Docker images via Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_PROJECT=$PROJECT_ID \
  --project=$PROJECT_ID

echo "✓ Container images built and pushed"
```

### 4.2 Deploy Services to Cloud Run

```bash
# Deploy each service (example: heady-gateway)
services=(
  "heady-gateway"
  "heady-brain"
  "heady-conductor"
  "heady-security"
  "heady-vector"
  "heady-mcp"
  "heady-embed"
  "heady-orchestration"
  "heady-web"
)

for service in "${services[@]}"; do
  gcloud run deploy "$service" \
    --image="gcr.io/$PROJECT_ID/$service:latest" \
    --region=$REGION \
    --platform=managed \
    --port=8080 \
    --concurrency=89 \
    --min-instances=2 \
    --max-instances=21 \
    --timeout=55s \
    --set-env-vars="NODE_ENV=production,REGION=$REGION" \
    --set-secrets="DATABASE_URL=heady-database-url:latest,REDIS_URL=heady-redis-url:latest" \
    --service-account="heady-platform@${PROJECT_ID}.iam.gserviceaccount.com" \
    --project=$PROJECT_ID

  echo "✓ Deployed: $service"
done
```

### 4.3 Configure VPC Connector

```bash
gcloud compute networks vpc-access connectors create heady-connector \
  --region=$REGION \
  --subnet=heady-subnet \
  --project=$PROJECT_ID

# Attach to all services
for service in "${services[@]}"; do
  gcloud run services update "$service" \
    --region=$REGION \
    --vpc-connector=heady-connector \
    --project=$PROJECT_ID
done

echo "✓ VPC connector attached to all services"
```

---

## Phase 5: Smoke Testing (1 hour)

### 5.1 Health Checks

```bash
# Get gateway URL
GATEWAY_URL=$(gcloud run services describe heady-gateway \
  --region=$REGION --format='value(status.url)' --project=$PROJECT_ID)

# Run health checks
echo "Testing health endpoints..."
for endpoint in /healthz /readyz /api/v1/health; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL$endpoint")
  if [ "$status" == "200" ]; then
    echo "✓ $endpoint → HTTP $status"
  else
    echo "✗ $endpoint → HTTP $status (FAILED)"
  fi
done
```

### 5.2 API Smoke Test

```bash
# Test agent creation
curl -s -X POST "$GATEWAY_URL/api/v1/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_JWT" \
  -d '{"name":"smoke-test-agent","type":"assistant"}' | jq .

# Test memory store/retrieve
curl -s -X POST "$GATEWAY_URL/api/v1/memory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_JWT" \
  -d '{"content":"smoke test memory","namespace":"test"}' | jq .

echo "✓ API smoke tests passed"
```

---

## Phase 6: Monitoring Setup (1–2 hours)

### 6.1 Create Alert Policies

```bash
# High error rate alert (>61.8% = 1/φ error rate triggers alert)
gcloud monitoring policies create \
  --policy-from-file=ops/alerts/error-rate.json \
  --project=$PROJECT_ID

# High latency alert (>fib(11)=89ms p99)
gcloud monitoring policies create \
  --policy-from-file=ops/alerts/latency-p99.json \
  --project=$PROJECT_ID

echo "✓ Monitoring alerts created"
```

### 6.2 Configure Log-Based Metrics

```bash
# Error rate metric
gcloud logging metrics create heady-error-rate \
  --description="HTTP 5xx error rate" \
  --log-filter='resource.type="cloud_run_revision" severity>=ERROR' \
  --project=$PROJECT_ID

echo "✓ Log metrics created"
```

### 6.3 Sentry Configuration

```bash
# Initialize Sentry release tracking
npx @sentry/cli releases new "heady-systems@3.2.2" --org headysystems
npx @sentry/cli releases finalize "heady-systems@3.2.2" --org headysystems

echo "✓ Sentry release tracking configured"
```

---

## Phase 7: DNS and CDN (1–2 hours)

### 7.1 Configure Cloudflare

```bash
# Apply Cloudflare configuration
node scalability/cdn/cloudflare-config.js --apply --all-domains

# Verify DNS propagation for each domain
domains=(
  "headyme.com"
  "headyconnection.com"
  "headyos.com"
  "heady.exchange"
  "headyai.com"
)

for domain in "${domains[@]}"; do
  dig +short "$domain" A
  echo "✓ DNS verified: $domain"
done
```

---

## Completion Checklist

- [ ] All 9 secrets created in Secret Manager
- [ ] Database migrations ran successfully
- [ ] All services returning HTTP 200 on /healthz
- [ ] API smoke tests passing
- [ ] Monitoring alerts created
- [ ] DNS resolving for all 9 domains
- [ ] Sentry error tracking active
- [ ] CloudBuild CI/CD trigger configured

---

## Next Steps

→ See `docs/operations/day2-operations.md` for ongoing operations.  
→ See `docs/operations/emergency-procedures.md` for incident response.
