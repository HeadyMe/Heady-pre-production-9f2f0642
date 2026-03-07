# Heady™ Production Deployment Guide

Complete step-by-step guide for deploying the Heady platform to production on Google Cloud Run with Cloudflare edge routing.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │           Cloudflare Edge               │
                        │     (heady-edge Worker — 300+ PoPs)     │
                        │                                         │
                        │  headyme.com    headysystems.com         │
                        │  headymcp.com   headyconnection.org      │
                        │  headybuddy.org headyio.com              │
                        │  headybot.com   headyapi.com heady-ai.com │
                        └────────────────┬────────────────────────┘
                                         │ HTTPS
                                         ▼
                        ┌─────────────────────────────────────────┐
                        │       Google Cloud Run (us-central1)    │
                        │                                         │
                        │  heady-manager (Node 22, multi-agent)   │
                        │  Min: 1 instance — Max: 10 instances    │
                        │  2 vCPU / 1Gi RAM per instance          │
                        └────┬────────┬────────┬──────────────────┘
                             │        │        │
                    ┌────────┘   ┌────┘   ┌────┘
                    ▼            ▼        ▼
              ┌──────────┐ ┌─────────┐ ┌──────────┐
              │  Neon PG  │ │ Upstash │ │  Secret  │
              │ (pgvector)│ │  Redis  │ │ Manager  │
              └──────────┘ └─────────┘ └──────────┘
```

## Prerequisites

- **Google Cloud SDK** (`gcloud`) installed and authenticated
- **Docker** installed locally (for building/testing)
- **Node.js >= 22** (for local development)
- **Cloudflare account** with Workers plan and API token
- **GitHub repository** with Actions enabled
- A `.env` file with all secret values (see Step 2)

---

## Step 1: Infrastructure Setup (One-Time)

### 1.1 — Enable GCP APIs and Create Resources

```bash
# Set your project
export GCP_PROJECT_ID=heady-production
export GCP_REGION=us-central1

# Run the infrastructure setup script
chmod +x infra/cloudrun/vpc-connector-setup.sh
./infra/cloudrun/vpc-connector-setup.sh
```

This creates:
- Artifact Registry (`heady-docker-repo`) for Docker images
- Service account (`heady-cloudrun-sa`) with minimal IAM roles
- VPC connector for private database/Redis access
- Enables all required GCP APIs

### 1.2 — Verify

```bash
# Check Artifact Registry
gcloud artifacts repositories list --location=us-central1

# Check service account
gcloud iam service-accounts list --filter="email:heady-cloudrun-sa"

# Check VPC connector
gcloud compute networks vpc-access connectors list --region=us-central1
```

---

## Step 2: Configure Secrets

### 2.1 — Prepare Your .env File

Create a `.env` file with all secret values. Reference `infra/secrets/setup-secrets.sh` for the full list. At minimum you need:

```env
# CRITICAL (app won't start without these)
DATABASE_URL=postgresql://user:pass@host:5432/heady_production
HEADY_API_KEY=your-internal-api-key

# REQUIRED (full functionality)
PERPLEXITY_API_KEY=pplx-xxx
GEMINI_API_KEY=AIza-xxx
GITHUB_TOKEN=ghp_xxx
CLOUDFLARE_API_TOKEN=xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
JWT_SECRET=<64-char-random-string>
SESSION_SECRET=<64-char-random-string>
ADMIN_TOKEN=<your-admin-token>

# OPTIONAL (degraded without these)
OPENAI_API_KEY=sk-xxx
CLAUDE_API_KEY=sk-ant-xxx
GROQ_API_KEY=gsk_xxx
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
STRIPE_SECRET_KEY=sk_live_xxx
```

### 2.2 — Push Secrets to Secret Manager

```bash
chmod +x infra/secrets/setup-secrets.sh

# From .env file (recommended)
./infra/secrets/setup-secrets.sh --from-env .env

# Or interactive mode
./infra/secrets/setup-secrets.sh

# Dry run first to see what will happen
./infra/secrets/setup-secrets.sh --from-env .env --dry-run
```

### 2.3 — Verify Secrets

```bash
# List all secrets
gcloud secrets list --project=heady-production

# Verify a secret value
gcloud secrets versions access latest --secret=DATABASE_URL
```

---

## Step 3: Build and Push Docker Image

### 3.1 — Local Build (Test)

```bash
# Build the multi-stage image
docker build -t heady-manager:local .

# Run locally
docker run -p 8080:8080 --env-file .env heady-manager:local

# Verify health
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
```

### 3.2 — Push to Artifact Registry

```bash
# Authenticate Docker to GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build with production tag
IMAGE=us-central1-docker.pkg.dev/heady-production/heady-docker-repo/heady-manager
docker build -t ${IMAGE}:latest .

# Push
docker push ${IMAGE}:latest
```

---

## Step 4: Deploy to Cloud Run

### Option A: Using the Service YAML (Declarative)

```bash
# Deploy the full service spec
gcloud run services replace infra/cloudrun/service.yaml \
  --region us-central1 \
  --project heady-production
```

### Option B: Using gcloud CLI (Imperative)

```bash
IMAGE=us-central1-docker.pkg.dev/heady-production/heady-docker-repo/heady-manager:latest

gcloud run deploy heady-manager \
  --image ${IMAGE} \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 1Gi \
  --timeout 300 \
  --concurrency 100 \
  --cpu-boost \
  --execution-environment gen2 \
  --set-env-vars "NODE_ENV=production,HEADY_SERVICE_NAME=heady-manager,HEADY_VERSION=3.1.0" \
  --update-secrets "DATABASE_URL=DATABASE_URL:latest,HEADY_API_KEY=HEADY_API_KEY:latest,PERPLEXITY_API_KEY=PERPLEXITY_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### Option C: Using Cloud Build

```bash
# Full deploy
gcloud builds submit --config cloudbuild.yaml

# Canary deploy (5% traffic)
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_CANARY_PERCENT=5
```

### 4.1 — Verify Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe heady-manager \
  --region us-central1 --format 'value(status.url)')

# Health checks
curl ${SERVICE_URL}/health/live
curl ${SERVICE_URL}/health/ready
curl ${SERVICE_URL}/health/full
```

---

## Step 5: Deploy Cloudflare Edge Worker

### 5.1 — Update Origin URL

Edit `infra/cloudflare/heady-edge-worker.js` and update `CLOUD_RUN_ORIGIN`:

```javascript
const CLOUD_RUN_ORIGIN = 'https://heady-manager-XXXXXXXXXX-uc.a.run.app';
```

Get your actual URL:
```bash
gcloud run services describe heady-manager \
  --region us-central1 --format 'value(status.url)'
```

Also update `CLOUD_RUN_ORIGIN` in `infra/cloudflare/wrangler.toml`.

### 5.2 — Deploy the Worker

```bash
cd infra/cloudflare

# Install wrangler if needed
npm install -g wrangler

# Authenticate
wrangler login

# Deploy
wrangler deploy --config wrangler.toml

# Set secrets
wrangler secret put HEADY_EDGE_AUTH_TOKEN
wrangler secret put ORIGIN_AUTH_HEADER
```

### 5.3 — Verify Edge

```bash
# Test edge health endpoint
curl https://headyme.com/health/edge

# Test each domain
for domain in headyme.com headysystems.com headyconnection.org headybuddy.org headymcp.com headyio.com headybot.com headyapi.com heady-ai.com; do
  echo -n "${domain}: "
  curl -sf -o /dev/null -w "%{http_code}" "https://${domain}/health/edge"
  echo ""
done
```

---

## Step 6: Set Up Monitoring

```bash
chmod +x infra/monitoring/setup-monitoring.sh

# Create dashboard and alert policies
./infra/monitoring/setup-monitoring.sh --email eric@headysystems.com

# Or dry run
./infra/monitoring/setup-monitoring.sh --dry-run
```

### 6.1 — View Dashboard

Open: `https://console.cloud.google.com/monitoring/dashboards?project=heady-production`

### 6.2 — Alert Policies Created

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | 5xx > 5% for 5 min | CRITICAL |
| High Latency | p99 > 5s for 10 min | WARNING |
| High Memory | > 80% for 10 min | WARNING |
| Max Scale | All 10 instances for 5 min | WARNING |
| Crash Loop | > 10 container starts in 5 min | CRITICAL |

---

## Step 7: Configure CI/CD (GitHub Actions)

### 7.1 — Set GitHub Secrets

Go to `Settings → Secrets and variables → Actions` and add:

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | GCP service account JSON key (base64 encoded) |
| `GCP_PROJECT_ID` | `heady-production` |
| `CF_API_TOKEN` | Cloudflare API token |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `HF_TOKEN` | Hugging Face token (for HF Spaces sync) |

### 7.2 — Generate GCP SA Key

```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=heady-cloudrun-sa@heady-production.iam.gserviceaccount.com

# Copy the JSON content to GitHub Secrets as GCP_SA_KEY
cat key.json

# Clean up local key
rm key.json
```

### 7.3 — Copy Workflow

```bash
# Copy the workflow to your repo
cp .github/workflows/deploy.yml /path/to/Heady/.github/workflows/deploy.yml
```

Push to `main` triggers the full pipeline automatically.

---

## Step 8: Canary Deployments

### 8.1 — Deploy a Canary

```bash
chmod +x infra/cloudrun/canary-rollout.sh

# Deploy new image as canary (5% traffic)
./infra/cloudrun/canary-rollout.sh deploy abc1234

# Check status
./infra/cloudrun/canary-rollout.sh status

# Verify canary health
./infra/cloudrun/canary-rollout.sh verify
```

### 8.2 — Progressive Promotion

```bash
# Promote: 5% → 25%
./infra/cloudrun/canary-rollout.sh promote

# Verify, then promote: 25% → 50%
./infra/cloudrun/canary-rollout.sh verify
./infra/cloudrun/canary-rollout.sh promote

# Verify, then promote: 50% → 100% (stable)
./infra/cloudrun/canary-rollout.sh verify
./infra/cloudrun/canary-rollout.sh promote
```

### 8.3 — Rollback

```bash
# Instant rollback to stable revision
./infra/cloudrun/canary-rollout.sh rollback
```

### 8.4 — Via GitHub Actions

Trigger a canary from GitHub Actions:
```
Actions → Heady Production Deploy → Run workflow
  target: cloudrun
  canary_percent: 5
```

---

## Operational Runbook

### Common Commands

```bash
# View logs
gcloud logs read --service=heady-manager --limit=100

# Tail logs in real-time
gcloud beta run services logs tail heady-manager --region us-central1

# List revisions
gcloud run revisions list --service=heady-manager --region=us-central1

# Scale to zero (save costs during maintenance)
gcloud run services update heady-manager --min-instances=0 --region=us-central1

# Scale back up
gcloud run services update heady-manager --min-instances=1 --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic heady-manager \
  --to-revisions=REVISION_NAME=100 --region=us-central1

# Force redeploy (same image, new instance)
gcloud run services update heady-manager --region=us-central1 \
  --set-env-vars "DEPLOY_TIMESTAMP=$(date +%s)"
```

### Rotate Secrets

```bash
# Update a secret value
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run picks up new secret values on next instance start
# Force a restart:
gcloud run services update heady-manager --region=us-central1 \
  --set-env-vars "SECRET_VERSION=$(date +%s)"
```

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Container won't start | Missing critical env vars | Check env-schema validation in logs |
| 503 on all requests | Readiness probe failing | Check `/health/ready`, look for open circuit breakers |
| High latency | DB connection pool exhaustion | Check PgBouncer, increase pool size |
| Memory OOM | Vector memory cache unbounded | Reduce cache TTL, increase memory limit |
| Edge 502 | Cloud Run origin down | Check Cloud Run status, verify origin URL in Worker |
| Rate limited | Too many requests from one IP | Adjust RATE_LIMIT in edge worker |

---

## File Reference

```
heady-deploy/
├── Dockerfile                              # Multi-stage production Dockerfile
├── .dockerignore                           # Docker build context exclusions
├── cloudbuild.yaml                         # Cloud Build CI/CD pipeline
│
├── .github/workflows/
│   └── deploy.yml                          # GitHub Actions CI/CD workflow
│
├── infra/
│   ├── cloudrun/
│   │   ├── service.yaml                    # Cloud Run service spec (declarative)
│   │   ├── canary-rollout.yaml             # Canary rollout config
│   │   ├── canary-rollout.sh               # Canary rollout CLI script
│   │   └── vpc-connector-setup.sh          # One-time infra setup
│   │
│   ├── cloudflare/
│   │   ├── heady-edge-worker.js            # Edge proxy & router Worker
│   │   └── wrangler.toml                   # Wrangler deployment config
│   │
│   ├── secrets/
│   │   └── setup-secrets.sh                # Secret Manager setup script
│   │
│   └── monitoring/
│       ├── dashboard.json                  # Cloud Monitoring dashboard
│       ├── alert-policies.json             # Alert policy definitions
│       ├── setup-monitoring.sh             # Monitoring setup script
│       └── otel-config.yml                 # OpenTelemetry collector config
│
└── docs/
    └── DEPLOYMENT-GUIDE.md                 # This file
```

---

© 2026 HeadySystems Inc. — All Rights Reserved.
