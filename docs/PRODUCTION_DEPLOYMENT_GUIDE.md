# Heady Sovereign AI Platform — Master Production Deployment Guide

> **Maintainer:** eric@headyconnection.org  
> **Repository:** github.com/HeadyMe/Heady-pre-production-9f2f0642  
> **Stack:** Node.js 20 · PostgreSQL 16 + pgvector · Redis 7 · Cloud Run · Cloudflare Edge  
> **Last Updated:** 2026-03-06

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Initial Setup](#2-initial-setup)
3. [Database Migration](#3-database-migration)
4. [Cloudflare Configuration](#4-cloudflare-configuration)
5. [Docker Build & Push](#5-docker-build--push)
6. [Cloud Run Deployment](#6-cloud-run-deployment)
7. [User Onboarding Flow](#7-user-onboarding-flow)
8. [File Manifest](#8-file-manifest)
9. [Domain Routing Table](#9-domain-routing-table)
10. [Security Checklist](#10-security-checklist)
11. [Monitoring & Operations](#11-monitoring--operations)
12. [Scaling Guide](#12-scaling-guide)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

### 1.1 GCP Project

```bash
# Set your project
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud config set compute/region us-central1

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create heady \
  --repository-format=docker \
  --location=us-central1 \
  --description="Heady production images"
```

### 1.2 PostgreSQL 16 + pgvector

**Option A — Cloud SQL (recommended for managed ops):**

```bash
gcloud sql instances create heady-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-custom-4-15360 \
  --region=us-central1 \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --deletion-protection

# Create database and user
gcloud sql databases create heady_production --instance=heady-postgres
gcloud sql users create heady \
  --instance=heady-postgres \
  --password=YOUR_STRONG_PASSWORD

# Install pgvector extension (run once after instance creation)
gcloud sql connect heady-postgres --user=heady
# In psql:
# CREATE EXTENSION IF NOT EXISTS vector;
# \q
```

**Option B — Self-managed PostgreSQL 16 with pgvector:**

```bash
# On Ubuntu/Debian
apt-get install -y postgresql-16 postgresql-16-pgvector

# Enable extension
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;" heady_production
```

**Minimum specs:**  
- 4 vCPU / 16 GB RAM for `memory_vectors` with HNSW index  
- 100 GB SSD storage (expand as vector store grows)  
- TLS enforced for all connections

### 1.3 Redis Instance

**Option A — Cloud Memorystore:**

```bash
gcloud redis instances create heady-redis \
  --size=2 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=STANDARD_HA \
  --auth-enabled
```

**Option B — Self-managed Redis 7:**

```bash
# Docker
docker run -d --name heady-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass YOUR_REDIS_PASSWORD --appendonly yes
```

### 1.4 SMTP Provider

Recommended: **Mailgun** (transactional reliability + MX routing for `@headyme.com` inboxes)

```bash
# Mailgun setup
# 1. Add headyme.com as a sending domain
# 2. Configure MX records (see §4.2)
# 3. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env.production
```

Alternative providers: SendGrid, Postmark, AWS SES.

### 1.5 Secrets Manager

Store the canonical `.env.production` in **1Password Secrets Automation** or **GCP Secret Manager**:

```bash
# GCP Secret Manager example
gcloud secrets create heady-env-production \
  --data-file=.env.production \
  --replication-policy=automatic

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding heady-env-production \
  --member="serviceAccount:heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.6 Cloudflare Account

- Account with access to all 9 domains
- Cloudflare Zero Trust plan (for tunnels)
- Workers & Pages plan (for edge router)
- KV namespace quota sufficient for rate limiting

---

## 2. Initial Setup

### 2.1 Clone the Repository

```bash
git clone git@github.com:HeadyMe/Heady-pre-production-9f2f0642.git heady-production
cd heady-production
```

### 2.2 Install Dependencies

```bash
# Node.js 20+ required
node --version   # must be v20.x or higher

npm ci --omit=dev   # production install
```

### 2.3 Configure Environment

```bash
# Copy and edit the production environment file
cp .env.production .env.production.local

# Open in your editor and replace ALL CHANGE_ME values
nano .env.production.local
```

**Critical secrets to rotate before first deploy:**

| Variable | Description | How to generate |
|---|---|---|
| `POSTGRES_PASSWORD` | Database password | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis auth password | `openssl rand -base64 32` |
| `AUTH_SECRET` | JWT signing secret | `openssl rand -base64 48` |
| `SESSION_SECRET` | Session cookie signing | `openssl rand -base64 48` |
| `BYOK_ENCRYPTION_KEY` | BYOK secret encryption | `openssl rand -base64 32` |
| `INTERNAL_API_KEY` | Service-to-service auth | `openssl rand -hex 32` |
| `CLOUDFLARE_TUNNEL_TOKEN` | From CF Zero Trust dashboard | see §4.1 |
| `ANTHROPIC_API_KEY` | Anthropic Claude | console.anthropic.com |
| `OPENAI_API_KEY` | OpenAI (embeddings) | platform.openai.com |
| `SENTRY_DSN` | Error tracking | sentry.io project settings |

### 2.4 Verify Configuration

```bash
# Run preflight checks without starting the server
./scripts/startup.sh --dry-run
```

---

## 3. Database Migration

### 3.1 Run Migrations

Migrations use `DATABASE_URL_DIRECT` to bypass PgBouncer (required for DDL statements):

```bash
# Standard run (creates all tables, indexes, extensions, enums)
DATABASE_URL_DIRECT=postgresql://heady:PASSWORD@POSTGRES_HOST:5432/heady_production \
  node scripts/migrate.js

# Verbose output (shows all SQL)
DATABASE_URL_DIRECT=... node scripts/migrate.js --verbose

# Dry run (prints what would be executed without making changes)
DATABASE_URL_DIRECT=... node scripts/migrate.js --dry-run

# Roll back the last applied migration
DATABASE_URL_DIRECT=... node scripts/migrate.js --rollback
```

### 3.2 What Gets Created

The migration script creates the following in order:

1. **Extensions:** `vector` (pgvector), `uuid-ossp`, `pg_trgm`, `pgcrypto`
2. **Enum types:** `user_role`, `user_tier`, `permission_level`, `permission_status`, `drift_severity`, `email_folder`
3. **Core tables:** `users`, `sessions`, `refresh_tokens`, `api_keys`
4. **RBAC tables:** `permissions`, `permission_requests`
5. **Feature tables:** `emails`, `onboarding_progress`, `buddy_configs`, `bee_configs`
6. **Monitoring tables:** `drift_history`, `health_snapshots`
7. **Vector tables:** `memory_vectors`, `memory_baseline_vectors` (with `vector(384)` columns)
8. **Security tables:** `login_attempts`, `audit_log`
9. **Indexes:** btree on FKs/timestamps, GIN on JSONB fields, HNSW (default) or IVFFlat on vector columns
10. **Row-level security:** enabled on all user-scoped tables

### 3.3 Migration Version Tracking

Each migration is recorded in `schema_migrations`:

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

### 3.4 Cloud SQL Migration via Cloud Run Job

For Cloud SQL connections from Cloud Run, use the Cloud SQL Auth Proxy:

```bash
# Create a Cloud Run Job for migrations (one-shot)
gcloud run jobs create heady-migrate \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT/heady/heady-manager:latest \
  --command="node" \
  --args="scripts/migrate.js" \
  --set-secrets="DATABASE_URL_DIRECT=heady-env-production:latest" \
  --add-cloudsql-instances=YOUR_PROJECT:us-central1:heady-postgres \
  --service-account=heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com \
  --region=us-central1

# Execute migration job
gcloud run jobs execute heady-migrate --region=us-central1 --wait
```

---

## 4. Cloudflare Configuration

### 4.1 Cloudflare Tunnel

The Cloudflare Tunnel (cloudflared) routes all 9 domains to Cloud Run without exposing public ports.

```bash
# Install cloudflared
brew install cloudflared   # macOS
# or: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create heady-production

# Configure tunnel (~/.cloudflared/config.yml)
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: TUNNEL_ID
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: headyme.com
    service: https://heady-production-uc.a.run.app
  - hostname: www.headyme.com
    service: https://heady-production-uc.a.run.app
  - hostname: api.headyapi.com
    service: https://heady-production-uc.a.run.app
  - hostname: headyapi.com
    service: https://heady-production-uc.a.run.app
  - hostname: headysystems.com
    service: https://heady-production-uc.a.run.app
  - hostname: headyconnection.org
    service: https://heady-production-uc.a.run.app
  - hostname: headybuddy.org
    service: https://heady-production-uc.a.run.app
  - hostname: headymcp.com
    service: https://heady-production-uc.a.run.app
  - hostname: headyio.com
    service: https://heady-production-uc.a.run.app
  - hostname: headybot.com
    service: https://heady-production-uc.a.run.app
  - hostname: heady-ai.com
    service: https://heady-production-uc.a.run.app
  - service: http_status:404
EOF

# Get tunnel token (paste into CLOUDFLARE_TUNNEL_TOKEN)
cloudflared tunnel token heady-production
```

### 4.2 DNS Records

For each domain, add the following DNS records in the Cloudflare dashboard (or via API):

```
# CNAME for tunnel routing (proxy enabled / orange cloud)
@    CNAME    TUNNEL_ID.cfargotunnel.com   (proxied)
www  CNAME    TUNNEL_ID.cfargotunnel.com   (proxied)

# headyme.com — MX records for sovereign email
@    MX  10   mxa.mailgun.org
@    MX  10   mxb.mailgun.org
@    TXT      "v=spf1 include:mailgun.org ~all"
```

### 4.3 Deploy Cloudflare Worker

```bash
cd cloudflare/

# Install Wrangler
npm install -g wrangler

# Edit wrangler.toml — fill in account_id and KV namespace IDs
nano wrangler.toml

# Create KV namespaces
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "CACHE_KV"
wrangler kv:namespace create "CONFIG_KV"
# Copy the returned IDs into wrangler.toml

# Set worker secrets
wrangler secret put INTERNAL_API_KEY
wrangler secret put SENTRY_DSN

# Deploy to production
wrangler deploy

# Verify
curl -I https://headyme.com/health
```

---

## 5. Docker Build & Push

### 5.1 Dockerfile

Create a `Dockerfile` in the project root if not already present:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs data/vector-shards

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["./scripts/startup.sh"]
```

### 5.2 Build and Push

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build (multi-platform for Cloud Run)
docker buildx build \
  --platform linux/amd64 \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT/heady/heady-manager:latest \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT/heady/heady-manager:$(git rev-parse --short HEAD) \
  --push \
  .

# Verify
gcloud artifacts docker images list us-central1-docker.pkg.dev/YOUR_PROJECT/heady
```

---

## 6. Cloud Run Deployment

### 6.1 Create Service Account

```bash
# Create dedicated service account
gcloud iam service-accounts create heady-cloudrun \
  --display-name="Heady Cloud Run Service Account"

# Grant Cloud SQL access
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 6.2 Deploy HeadyManager

```bash
gcloud run deploy heady-production \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT/heady/heady-manager:latest \
  --platform=managed \
  --region=us-central1 \
  --port=8080 \
  --cpu=2 \
  --memory=1Gi \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=100 \
  --timeout=3600 \
  --service-account=heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com \
  --set-secrets="ENV_FILE=heady-env-production:latest" \
  --add-cloudsql-instances=YOUR_PROJECT:us-central1:heady-postgres \
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --allow-unauthenticated \
  --ingress=all \
  --execution-environment=gen2 \
  --cpu-boost

# Verify deployment
gcloud run services describe heady-production --region=us-central1
curl https://heady-production-uc.a.run.app/health
```

### 6.3 Deploy HeadyWorker (Background Jobs)

```bash
gcloud run deploy heady-worker \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT/heady/heady-manager:latest \
  --platform=managed \
  --region=us-central1 \
  --port=8081 \
  --cpu=2 \
  --memory=1Gi \
  --min-instances=1 \
  --max-instances=5 \
  --concurrency=1 \
  --timeout=3600 \
  --service-account=heady-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com \
  --set-secrets="ENV_FILE=heady-env-production:latest" \
  --set-env-vars="NODE_ENV=production,SERVICE_ROLE=worker" \
  --no-allow-unauthenticated \
  --ingress=internal
```

### 6.4 Post-Deployment Verification

```bash
# Health check
curl https://headyme.com/health
# Expected: { "status": "healthy", "score": 95+ }

# Detailed health
curl https://headyme.com/health/detailed

# Auth endpoint
curl -X POST https://headyme.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@headyme.com","password":"test"}'

# Onboarding endpoint
curl https://headyme.com/onboarding/steps
```

---

## 7. User Onboarding Flow

This section describes the complete end-user journey from first visit to personalized dashboard.

### Overview

```
headyme.com → [WELCOME] → [AUTH] → [PERMISSIONS] → [ACCOUNT SETUP]
          → [EMAIL SETUP (optional)] → [UI CUSTOMIZATION]
          → [COMPANION CONFIG (optional)] → [COMPLETE] → Dashboard
```

Progress is persisted in both **Redis** (fast resume) and **PostgreSQL** (`onboarding_progress` table) so users can pause and continue across sessions and devices.

---

### Step 1 — WELCOME: HeadyBuddy Introduction

**URL:** `https://headyme.com/`  
**Component:** `onboarding-controller.js` → `WELCOME` step

The user lands on headyme.com and is greeted by HeadyBuddy. The welcome screen:
- Introduces HeadyBuddy by name with animated entry
- Displays a brief overview of what Heady can do (sovereign AI, privacy-first, bring your own keys)
- Presents a prominent "Get Started" CTA
- Offers a "Sign In" link for returning users (bypasses onboarding)

**Behind the scenes:**
```
POST /onboarding/start
→ Creates onboarding_progress record (or resumes existing)
→ Stores session fingerprint in Redis
→ Returns: { sessionId, currentStep: "WELCOME", ... }
```

---

### Step 2 — AUTH: Sign In or Create Account

**URL:** `https://headyme.com/auth`  
**Module:** `src/auth/auth-provider.js`

HeadyBuddy presents sign-in options:

| Method | Provider | Notes |
|---|---|---|
| Google OAuth | OAuth2 via Google | Fastest path |
| GitHub OAuth | OAuth2 via GitHub | Preferred for devs |
| Microsoft OAuth | OAuth2/OIDC | Enterprise orgs |
| Apple OAuth | Sign in with Apple | Mobile-first |
| Email + Password | argon2 hashed | Full sovereignty |

**New user flow:**
1. User selects auth method → OAuth redirect or email form
2. On success: JWT access token issued (15-min TTL), refresh token set (30-day TTL) in HttpOnly Secure cookie
3. Redis session created with device fingerprint
4. `users` table record created with auto-generated `username` (changeable in next step)
5. `audit_log` entry written for first login

**Returning user flow:**
1. Existing session detected → skip to dashboard  
2. Expired session → silent token refresh via refresh token rotation  
3. Token family invalidated → force re-auth

**MFA (if enabled):**  
TOTP code requested after primary auth. QR code setup available in account settings post-onboarding.

---

### Step 3 — PERMISSIONS: Access Scope Selection

**URL:** `https://headyme.com/onboarding/permissions`  
**Module:** `src/auth/permission-manager.js`

HeadyBuddy explains what it can access and asks the user to grant explicit permissions:

| Resource | Description | Default |
|---|---|---|
| Cloud Drives | Google Drive, OneDrive, Dropbox | Off |
| Code Repositories | GitHub, GitLab, Bitbucket | Off |
| Local Filesystem | Browser File System API paths | Off |
| Email | headyme.com mailbox | Off |
| LLM Providers | API key management | Off |
| Vector Memory | Personal knowledge store | **On** (required) |
| MCP Tools | Model Context Protocol integrations | Off |

Each permission is stored in `permissions` table with an explicit `granted_by` (user themselves for self-grants, admin for admin grants).

**Technical implementation:**
```
POST /auth/permissions/grant
Body: { resourceType, resourcePath, permissionLevel }
→ Validates against ROLES and RESOURCE_TYPES
→ Inserts into permissions table
→ Updates users.permissions JSONB cache
```

---

### Step 4 — ACCOUNT SETUP: Create Your Heady Identity

**URL:** `https://headyme.com/onboarding/account`  
**Module:** `src/auth/account-provisioner.js`

1. **Choose username:** `{username}@headyme.com` — alphanumeric, 3–32 chars, unique across platform
2. **Display name:** Full name or alias shown on dashboard
3. **Avatar:** Upload custom image or pick from avatar library
4. **Tier selection:** Free / Pro / Enterprise / Sovereign — shows feature comparison matrix

On completion:
- `users` record updated with confirmed `username`, `display_name`, `avatar_url`, `tier`
- `onboarding_progress.current_step` → `EMAIL_SETUP`

---

### Step 5 — EMAIL SETUP: Sovereign Inbox (Optional)

**URL:** `https://headyme.com/onboarding/email`  
**Module:** `src/auth/email-client.js`

Users can skip this step. If they proceed:

1. HeadyBuddy explains the sovereign encrypted inbox (`{username}@headyme.com`)
2. User activates the inbox (provisions MX routing via Mailgun or self-managed SMTP)
3. S/MIME key generation (optional): browser generates key pair; private key stored encrypted in `emails` table
4. Import existing contacts (optional): vCard upload
5. Set spam threshold and folder preferences

**DNS validation:**
```
CNAME: mail.headyme.com → mailgun.org  (or custom SMTP)
TXT: v=spf1 include:mailgun.org ~all
DKIM: automatically generated by Mailgun
```

---

### Step 6 — UI CUSTOMIZATION: HeadyBee + HeadySwarm

**URL:** `https://headyme.com/onboarding/ui`  
**Modules:** `src/onboarding/headybee-ui-templates.js`, `src/onboarding/headyswarm-ui-configs.js`, `src/onboarding/ui-projection-engine.js`

**Choose a HeadyBee template** (workspace visual theme):

| Template | Palette | Character |
|---|---|---|
| Cosmic Command | Indigo + deep space dark | Power user, multi-pane |
| Emerald Forge | Emerald green | Builder, code-heavy |
| Amber Oracle | Warm amber | Research, analysis |
| Rose Garden | Rose + petal | Creative, writing |
| Obsidian Temple | Near-black + gold | Minimal, focused |
| Sapphire Matrix | Deep blue | Data, dashboards |
| Solar Commons | Light warm | Accessibility, reading |

**Choose a HeadySwarm configuration** (agent allocation):

| Swarm | Allocation | Best for |
|---|---|---|
| Operations | 34% | DevOps, infra, automation |
| Intelligence | 21% | Research, analysis |
| Creation | 21% | Writing, design, code gen |
| Security | 13% | Compliance, audit |
| Edge-Cloud | 8% | Deployments, cloud ops |
| Companion | 8% | Conversational, personal |
| Analytics | 5% | Metrics, reporting |
| Sacred Governance | 5% | Oversight, ethics layer |

**Live preview:** UIProjectionEngine renders a real-time preview of the selected template + swarm.

Choices are persisted to `bee_configs` table.

---

### Step 7 — COMPANION CONFIG: Configure HeadyBuddy (Optional)

**URL:** `https://headyme.com/onboarding/companion`

Users can skip this step (defaults applied). If they proceed:

1. **Name your companion:** Default "Heady" — rename to anything
2. **Personality preset:**
   - `analytical` — data-first, precise, structured
   - `balanced` — default mix of all traits
   - `creative` — narrative, exploratory, generative
   - `guardian` — security-conscious, privacy-first
   - `sage` — philosophical, long-context reasoning
3. **Memory:** Toggle persistent contextual memory (vector store writes)
4. **Proactive suggestions:** Allow HeadyBuddy to surface relevant content unprompted
5. **Voice:** Enable TTS/STT integration (Web Speech API or ElevenLabs BYOK)

Persisted to `buddy_configs` table.

---

### Step 8 — COMPLETE: Redirect to Dashboard

```
POST /onboarding/complete
→ Sets onboarding_progress.completed_at = NOW()
→ Sets users.onboarding_completed = true
→ Triggers audit_log entry
→ Returns: { redirectUrl: "/dashboard" }
```

The user is redirected to their personalized dashboard with their chosen HeadyBee template rendered by the UIProjectionEngine, HeadyBuddy loaded with their companion config, and their first SwarmAgent report ready.

---

## 8. File Manifest

| File | Description |
|---|---|
| `.env.production` | All environment variables and secrets (never commit) |
| `docker-compose.production.yml` | Full stack: postgres, pgbouncer, redis, heady-manager, heady-worker, cloudflared |
| `package.json` | Node.js package manifest |
| `scripts/migrate.js` | Idempotent PostgreSQL migration runner — all 18 tables, indexes, extensions, enums |
| `scripts/startup.sh` | Production startup script — preflight, migrations, background processes, HeadyManager |
| `src/auth/auth-provider.js` | OAuth2/OIDC + email/password auth, JWT RS256, TOTP MFA, session management |
| `src/auth/auth-routes.js` | Express routes: `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/oauth/*` |
| `src/auth/account-provisioner.js` | New user provisioning, username reservation, avatar handling |
| `src/auth/permission-manager.js` | RBAC, resource permission grants, scope validation, rate limit tiers |
| `src/auth/email-client.js` | Sovereign email: SMTP, S/MIME, inbox provisioning, folder management |
| `src/onboarding/onboarding-controller.js` | Multi-step onboarding orchestrator, Redis progress persistence, step transitions |
| `src/onboarding/onboarding-routes.js` | Express routes: `/onboarding/*` — start, step navigation, complete |
| `src/onboarding/headybee-ui-templates.js` | 7 Sacred-Geometry-aligned HeadyBee workspace templates |
| `src/onboarding/headyswarm-ui-configs.js` | 8 Fibonacci-allocated HeadySwarm agent orchestration configs |
| `src/onboarding/ui-projection-engine.js` | Runtime UI projection from template + swarm config into concrete workspace layout |
| `src/monitoring/health-monitor.js` | Sacred Geometry weighted health scoring, Prometheus metrics, self-healing, Kubernetes probes |
| `src/monitoring/drift-detector.js` | 384-dim cosine vector drift detection, Monte Carlo trajectory, auto-recalibration |
| `.github/workflows/ci.yml` | CI pipeline: lint, type-check, test, Docker build, image scan |
| `.github/workflows/liquid-deploy.yml` | Blue/green Cloud Run deployment with automatic rollback |
| `.github/workflows/self-healing.yml` | Scheduled drift + health checks with auto-remediation triggers |
| `cloudflare/worker.js` | Cloudflare edge router: rate limiting, domain-based routing, maintenance mode, CORS |
| `cloudflare/wrangler.toml` | Wrangler config: routes for all 9 domains, KV namespaces, staging env |
| `PRODUCTION_DEPLOYMENT_GUIDE.md` | This document |

---

## 9. Domain Routing Table

All 9 domains are routed through the Cloudflare Worker (`cloudflare/worker.js`) which applies edge-level rate limiting, security headers, and CORS before forwarding to the Cloud Run origin.

| Domain | Primary Purpose | Key Routes |
|---|---|---|
| `headyme.com` | Consumer-facing app, onboarding entry point | `/`, `/auth/*`, `/onboarding/*`, `/dashboard`, `/settings` |
| `headyapi.com` | Public REST + WebSocket API | `/v1/*`, `/ws`, `/health`, `/metrics` |
| `headysystems.com` | Internal platform monitoring + ops | `/admin`, `/health/detailed`, `/metrics`, `/otel` |
| `headyconnection.org` | Developer portal + community | `/docs`, `/sdk`, `/webhooks`, `/auth/callback` |
| `headybuddy.org` | HeadyBuddy companion landing + embed | `/chat`, `/embed`, `/companion/*` |
| `headymcp.com` | Model Context Protocol endpoint | `/mcp`, `/mcp/tools`, `/mcp/resources` |
| `headyio.com` | I/O integrations hub (connectors) | `/integrations/*`, `/webhooks/*`, `/sync/*` |
| `headybot.com` | Chatbot / messaging channel integrations | `/bot/*`, `/slack`, `/discord`, `/telegram` |
| `heady-ai.com` | AI model gateway + inference proxy | `/inference/*`, `/embeddings`, `/completions` |

### Edge Routing Logic (cloudflare/worker.js)

```
Request arrives at Cloudflare edge
  ↓
1. Rate limit check (KV sliding window)
   → 429 if exceeded
  ↓
2. Maintenance mode check (KV flag)
   → 503 if active
  ↓
3. Country block check (configurable)
   → 403 if blocked
  ↓
4. Domain-based route matching
   → Sets X-Heady-Domain and X-Heady-Route headers
  ↓
5. Security headers injection
   (HSTS, CSP, X-Frame-Options, etc.)
  ↓
6. Forward to Cloud Run origin
   → CLOUD_RUN_ORIGIN from wrangler vars
  ↓
7. Cache static assets in CACHE_KV (5 min TTL)
```

---

## 10. Security Checklist

Run through this checklist before every production deployment.

### Secrets & Credentials

- [ ] All `CHANGE_ME` values rotated (run `grep -r CHANGE_ME .env.production`)
- [ ] `AUTH_SECRET` is ≥32 random characters (`openssl rand -base64 48`)
- [ ] `SESSION_SECRET` is ≥32 random characters (`openssl rand -base64 48`)
- [ ] `BYOK_ENCRYPTION_KEY` is exactly 32 bytes base64 (`openssl rand -base64 32`)
- [ ] `INTERNAL_API_KEY` is ≥32 random hex (`openssl rand -hex 32`)
- [ ] Database password stored in Secret Manager (not hardcoded in environment)
- [ ] Redis password set and not the default
- [ ] Admin account created with a strong password and MFA enabled

### Authentication

- [ ] MFA enforced for all `admin` role accounts
- [ ] OAuth redirect URIs locked down to exact production URIs in provider settings
- [ ] Refresh token family rotation enabled (prevents token replay)
- [ ] Account lockout after 5 failed attempts (configured in `auth-provider.js`)
- [ ] JWT access token TTL is 15 minutes (not longer)
- [ ] Refresh token TTL is 30 days (not indefinite)
- [ ] HttpOnly + Secure + SameSite=Strict on all session cookies

### Network & Edge

- [ ] Rate limiting active on all public endpoints (100 req/min unauthenticated, 500 authenticated)
- [ ] CORS origins locked to the 9 production domains (no `*` wildcard)
- [ ] CSP headers active with restrictive `script-src` and `connect-src`
- [ ] HSTS max-age ≥ 63,072,000 seconds (2 years) with `includeSubDomains`
- [ ] TLS 1.3 enforced at Cloudflare (TLS 1.0 and 1.1 disabled)
- [ ] Cloudflare "Always Use HTTPS" enabled for all 9 domains
- [ ] PostgreSQL port `5432` bound to `127.0.0.1` only (not `0.0.0.0`)
- [ ] Redis port `6379` bound to `127.0.0.1` only
- [ ] No public Docker ports (all traffic via cloudflared tunnel)

### Data Security

- [ ] PostgreSQL encrypted at rest (Cloud SQL disk encryption, or LUKS for self-managed)
- [ ] Redis RDB/AOF persistence files on encrypted volume
- [ ] Vector shard path (`VECTOR_SHARD_PATH`) on encrypted volume
- [ ] Email bodies stored encrypted (`body_encrypted BYTEA`)
- [ ] BYOK secrets AES-256-GCM encrypted before storage
- [ ] Row-level security enabled on all user-scoped tables (migration `0020`)
- [ ] `audit_log` table append-only (revoke DELETE privilege from app user)

### Application

- [ ] `NODE_ENV=production` (disables stack traces in API responses)
- [ ] `LOG_LEVEL=info` (not `debug` in production)
- [ ] Sentry DSN configured and `SENTRY_TRACES_SAMPLE_RATE=0.1`
- [ ] Request body limit set (`REQUEST_BODY_LIMIT=10485760` — 10 MB)
- [ ] PgBouncer in `transaction` pool mode (safe for Node.js async patterns)
- [ ] Dependency audit clean (`npm audit --omit=dev`)
- [ ] Docker image scanned for CVEs (via CI workflow `ci.yml`)

---

## 11. Monitoring & Operations

### 11.1 Health Endpoints

| Endpoint | Purpose | Expected Response |
|---|---|---|
| `GET /health` | Fast liveness probe (no DB call) | `{ status: "ok" }` |
| `GET /health/live` | Kubernetes liveness | `200 OK` |
| `GET /health/ready` | Kubernetes readiness | `200 OK` when all deps ready |
| `GET /health/detailed` | Full composite check | JSON with component scores |
| `GET /metrics` | Prometheus metrics | `text/plain` metric lines |

**Composite health scoring (Sacred Geometry weighted):**

```
Score = Σ(component_score × weight) / Σ(weights)

Tier 1 (φ² = 2.618):  database, vector_memory
Tier 2 (φ  = 1.618):  redis, llm_provider
Tier 3 (1.0):          memory, cpu, disk_space, external_apis, queue_depth

Thresholds:
  ≥ 80  → healthy   (green)
  50–79 → degraded  (amber)
  < 50  → critical  (red) — triggers PagerDuty/Slack alert
```

### 11.2 Drift Detection

The drift detector (`src/monitoring/drift-detector.js`) runs on a configurable interval and:

1. Fetches current memory vector centroids per namespace
2. Compares against baseline centroids stored in `memory_baseline_vectors`
3. Computes cosine similarity per category (semantic, structural, mission-alignment)
4. Classifies severity: `nominal → minor → moderate → critical`
5. Runs Monte Carlo simulation (1,000 iterations by default) to project drift trajectory
6. Persists results to `drift_history` table

**Self-healing behaviors triggered at severity thresholds:**

| Severity | Cosine Similarity | Auto-action |
|---|---|---|
| Nominal | ≥ 0.75 | None — log only |
| Minor | 0.65–0.74 | Increment retraining counter in Redis |
| Moderate | 0.55–0.64 | Trigger index recalibration, notify Slack |
| Critical | < 0.55 | Force recalibration + baseline reset + PagerDuty |

### 11.3 Self-Healing Behaviors

| Trigger | Response |
|---|---|
| Database connection pool exhausted | Restart PgBouncer, alert ops |
| Redis OOM | Flush LRU cache keys, alert ops |
| LLM provider timeout (3 consecutive) | Switch to backup provider |
| Health score < 50 | Auto-restart degraded container via Cloud Run revision update |
| Drift severity = critical | Recalibrate vector indexes, reset baselines |
| Worker queue depth > 1,000 jobs | Scale out heady-worker instances |

### 11.4 Alert Channels

Configure in `.env.production`:

```bash
# Slack webhook (for ops alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty (for critical alerts)
PAGERDUTY_ROUTING_KEY=YOUR_PAGERDUTY_KEY

# Generic webhook (for custom integrations)
ALERT_WEBHOOK_URL=https://your-alert-endpoint.com/heady
```

Alerts fire for:
- Health score drops below 50
- Drift severity reaches `critical`
- Any `ERROR` level log in auth or permission modules
- Failed deployment detected by CI/CD workflow

### 11.5 Prometheus Metrics

Key metrics exposed at `GET /metrics`:

```
heady_http_requests_total{method,route,status}
heady_http_request_duration_seconds{method,route}
heady_active_sessions_total
heady_db_pool_size{state}  (active|idle|waiting)
heady_redis_connected
heady_health_score{component}
heady_drift_cosine_similarity{category}
heady_vector_search_duration_seconds
heady_llm_request_duration_seconds{provider}
heady_onboarding_completions_total{step}
heady_queue_depth{queue_name}
```

Scrape config for Prometheus:

```yaml
scrape_configs:
  - job_name: heady-production
    static_configs:
      - targets: ['headysystems.com']
    scheme: https
    metrics_path: /metrics
    bearer_token: YOUR_METRICS_TOKEN
    scrape_interval: 30s
```

### 11.6 Log Locations

| Log | Location | Content |
|---|---|---|
| Startup | `logs/startup.log` | Pre-flight, migration, init messages |
| HeadyManager | `logs/heady-manager.log` | All application logs (JSON structured) |
| Health Monitor | `logs/health-monitor.log` | Periodic health check results |
| Drift Detector | `logs/drift-detector.log` | Drift scan results, Monte Carlo output |
| Cloud Run | `gcloud run services logs read heady-production` | Container stdout/stderr |

For Cloud Run log streaming:

```bash
gcloud run services logs tail heady-production \
  --region=us-central1 \
  --format="json"
```

---

## 12. Scaling Guide

### 12.1 Cloud Run Auto-Scaling

```bash
# Update scaling parameters
gcloud run services update heady-production \
  --region=us-central1 \
  --min-instances=2 \
  --max-instances=20 \
  --concurrency=80 \
  --cpu=4 \
  --memory=2Gi

# Scale worker independently
gcloud run services update heady-worker \
  --region=us-central1 \
  --min-instances=2 \
  --max-instances=10
```

**Scaling triggers (Cloud Run defaults):**
- CPU utilization > 60% → scale out
- Request queue depth > 100 → scale out
- CPU utilization < 10% for 5 min → scale in (not below `min-instances`)

### 12.2 Database Connection Pooling (PgBouncer)

PgBouncer sits between the application and PostgreSQL. Key tuning parameters in `.env.production`:

| Parameter | Default | Guidance |
|---|---|---|
| `PGBOUNCER_MAX_CLIENT_CONN` | 500 | Set to (max Cloud Run instances × concurrency) |
| `PGBOUNCER_DEFAULT_POOL_SIZE` | 25 | Set to (PostgreSQL max_connections / 2) |
| `PGBOUNCER_POOL_MODE` | transaction | Use `transaction` for async Node.js |

At 20 Cloud Run instances × 80 concurrency = 1,600 potential connections → PgBouncer pools these to ≤50 actual PostgreSQL connections.

For very high throughput (>50k req/min), scale PgBouncer horizontally or use **Cloud SQL's built-in connection pooling** (pgpool).

### 12.3 Redis Cluster Mode

For > 10k ops/sec or > 10 GB dataset, switch to Redis Cluster:

```bash
# Cloud Memorystore cluster
gcloud redis instances create heady-redis-cluster \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=STANDARD_HA \
  --cluster-mode=enabled \
  --replica-count=1 \
  --auth-enabled
```

Update `REDIS_URL` in `.env.production` to the cluster endpoint.

### 12.4 Vector Index Tuning

For `memory_vectors` with > 1M rows, switch from HNSW to IVFFlat after initial data population:

```bash
# In .env.production
VECTOR_INDEX_TYPE=ivfflat
VECTOR_IVFFLAT_PROBES=10

# Re-run migrations to recreate index
node scripts/migrate.js --rollback   # rolls back 0019_indexes
node scripts/migrate.js              # re-applies with new index type
```

**HNSW vs IVFFlat tradeoffs:**

| | HNSW | IVFFlat |
|---|---|---|
| Build time | Fast (works on empty tables) | Slow (needs data for clusters) |
| Query speed | Faster | Slightly slower |
| Memory | Higher | Lower |
| Recall accuracy | Higher | Tunable via `probes` |
| Best for | < 1M vectors | > 1M vectors |

### 12.5 CDN Cache Optimization

Configure in `cloudflare/worker.js`:

```javascript
// Cache-Control headers for static assets (served from Cloud Run)
const CACHE_TTL = {
  '/static/*':     86400,   // 24 hours
  '/assets/*':     604800,  // 7 days
  '/*.js':         3600,    // 1 hour
  '/*.css':        3600,    // 1 hour
  '/health':       0,       // never cache
  '/api/*':        0,       // never cache
};
```

Enable Cloudflare **Tiered Cache** for origin offload:
- Dashboard → Caching → Tiered Cache → Smart Tiered Cache Topology

---

## 13. Troubleshooting

### 13.1 Common Issues & Fixes

#### `pgvector` extension not found

```
Error: type "vector" does not exist
```

**Fix:**
```bash
# Connect directly to Postgres (not through PgBouncer)
psql $DATABASE_URL_DIRECT -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Or via Cloud SQL
gcloud sql connect heady-postgres --user=heady -d heady_production
# In psql: CREATE EXTENSION IF NOT EXISTS vector;
```

#### Migrations fail with "permission denied"

```
Error: permission denied to create extension "vector"
```

**Fix:** The migration user needs superuser or `CREATE EXTENSION` privilege:
```sql
-- Run as superuser
GRANT CREATE ON DATABASE heady_production TO heady;
ALTER USER heady SUPERUSER;  -- only during migration; remove after
```

#### `CHANGE_ME` pre-flight failure

```
[ERROR] PREFLIGHT FAILED: Unrotated CHANGE_ME placeholder(s) detected
```

**Fix:**
```bash
grep -n "CHANGE_ME" .env.production
# Edit each flagged variable with the real value
```

#### Redis connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
```bash
# Verify Redis is running
docker ps | grep redis
redis-cli -a $REDIS_PASSWORD ping   # should return PONG

# Check REDIS_URL in .env.production
echo $REDIS_URL

# If using Cloud Memorystore, ensure VPC peering is configured
gcloud redis instances describe heady-redis --region=us-central1
```

#### Health score consistently below 80

```
GET /health/detailed → { score: 67, status: "degraded" }
```

**Debug steps:**
1. Check component scores: `curl /health/detailed | jq '.component_scores'`
2. Database slow? Check `pg_stat_activity` for long-running queries
3. Redis OOM? Check `redis-cli info memory | grep used_memory_human`
4. High CPU? Check Cloud Run metrics in GCP Console

#### Onboarding stuck at a step

```
User cannot proceed past PERMISSIONS step
```

**Debug:**
```bash
# Check onboarding_progress record
psql $DATABASE_URL -c "
  SELECT user_id, current_step, completed_steps, step_data
  FROM onboarding_progress
  WHERE user_id = 'USER_UUID';
"

# Check Redis for cached state
redis-cli -a $REDIS_PASSWORD GET "onboarding:USER_UUID"

# Manually advance (admin action)
psql $DATABASE_URL -c "
  UPDATE onboarding_progress
  SET current_step = 'ACCOUNT_SETUP',
      completed_steps = completed_steps || ARRAY['PERMISSIONS']
  WHERE user_id = 'USER_UUID';
"
```

#### Vector similarity search returning no results

```
Memory query returns [] with high similarity threshold
```

**Fix:**
```bash
# Check threshold in .env.production
echo $VECTOR_SIMILARITY_THRESHOLD
# Lower from 0.75 to 0.65 for broader results

# Check that embeddings were actually inserted
psql $DATABASE_URL -c "
  SELECT user_id, namespace, COUNT(*) 
  FROM memory_vectors 
  GROUP BY user_id, namespace;
"

# Verify vector index is being used
psql $DATABASE_URL -c "
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT id, content
  FROM memory_vectors
  ORDER BY embedding <=> '[0.1,0.2,...]'::vector
  LIMIT 5;
"
```

#### Drift detector reports cosine_similarity = null

**Fix:**
```bash
# Baseline vectors not initialized yet
psql $DATABASE_URL -c "SELECT COUNT(*) FROM memory_baseline_vectors;"
# If 0, run baseline initialization:
node -e "
  import { DriftDetector } from './src/monitoring/drift-detector.js';
  const d = new DriftDetector({ databaseUrl: process.env.DATABASE_URL });
  await d.initialize();
  await d.calibrateBaseline();
  await d.destroy();
" --input-type=module
```

### 13.2 Debug Mode

Enable verbose logging temporarily without a full redeploy:

```bash
# Cloud Run — set env var
gcloud run services update heady-production \
  --region=us-central1 \
  --update-env-vars="LOG_LEVEL=debug"

# Revert after debugging
gcloud run services update heady-production \
  --region=us-central1 \
  --update-env-vars="LOG_LEVEL=info"
```

For startup script debugging:

```bash
LOG_LEVEL=debug ./scripts/startup.sh --verbose 2>&1 | tee /tmp/heady-debug.log
```

### 13.3 Useful Diagnostic Queries

```sql
-- Recent login attempts (last hour)
SELECT identifier, ip_address, success, attempted_at
FROM login_attempts
WHERE attempted_at > NOW() - INTERVAL '1 hour'
ORDER BY attempted_at DESC
LIMIT 50;

-- Active sessions by user
SELECT u.username, COUNT(s.id) AS session_count, MAX(s.created_at) AS last_active
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.expires_at > NOW()
GROUP BY u.username
ORDER BY session_count DESC;

-- Onboarding funnel drop-off
SELECT current_step, COUNT(*) AS users_at_step
FROM onboarding_progress
WHERE completed_at IS NULL
GROUP BY current_step
ORDER BY MIN(started_at);

-- Recent drift events
SELECT category, severity, cosine_similarity, diagnosis, detected_at
FROM drift_history
WHERE detected_at > NOW() - INTERVAL '24 hours'
ORDER BY detected_at DESC;

-- Audit log for a specific user
SELECT action, resource_type, resource_id, ip_address, created_at
FROM audit_log
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 100;

-- Vector index health
SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('memory_vectors', 'memory_baseline_vectors')
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

*End of Master Production Deployment Guide*

*For questions or production incidents, contact: eric@headyconnection.org*
