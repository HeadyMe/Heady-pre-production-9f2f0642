# Heady Reliability & Deployment Analysis Report

**Generated:** 2026-03-07  
**Scope:** All repositories in `/home/user/workspace/headyme-repos`  
**Repos analyzed:** Heady-pre-production-9f2f0642 (monorepo), headyapi-core, headybot-core, headybuddy-core, headyconnection-core, headyio-core, headymcp-core, headyme-core, headyos-core, headysystems-core, headymcp-production, headysystems-production, heady-docs

---

## Executive Summary

The Heady ecosystem is a large Node.js monorepo with a sophisticated multi-layered deployment architecture: a single Cloud Run container serving 9 domains, a Cloudflare edge layer, HuggingFace Spaces, and a "liquid deploy" system that projects monorepo changes into 9 vertical satellite repos. The monorepo has a **strong foundation** — multi-stage Docker builds, non-root user enforcement, canary deployments, a self-healing workflow, circuit breakers, drift detection, OTEL instrumentation, and a governance engine. However, **seven critical-severity gaps** and **seventeen medium/low severity issues** were found that must be addressed before this system can be called production-hardened.

The single most urgent issue is a **hardcoded Cloudflare API token and Zone ID** committed in plaintext to two scripts in the production repository. This is a live credential exposure.

---

## Repository Inventory

| Repository | Role | CI/CD | Dockerfile | Tests |
|---|---|---|---|---|
| Heady-pre-production-9f2f0642 | Monorepo (source of truth) | ci.yml, deploy.yml, self-healing.yml, liquid-deploy.yml, quality-gates.yml | Multi-stage, non-root | Extensive (~50 test files) |
| headyme-core | Vertical: main site | deploy.yml (test + Cloud Run) | Single-stage, non-root | Placeholder (`exit 0`) |
| headysystems-core | Vertical: systems | deploy.yml (test + Cloud Run) | Single-stage, non-root + HEALTHCHECK | Placeholder (`exit 0`) |
| headyapi-core | Vertical: API | deploy.yml (test only — no deploy step) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headybot-core | Vertical: bot | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headybuddy-core | Vertical: buddy | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headyconnection-core | Vertical: connection | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headyio-core | Vertical: I/O | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headymcp-core | Vertical: MCP | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headyos-core | Vertical: OS | deploy.yml (test only) | Single-stage, no HEALTHCHECK | Placeholder (`exit 0`) |
| headymcp-production | Production MCP | None | None | None |
| headysystems-production | Production Systems | None | None | None |
| heady-docs | Documentation | None | None | None |

---

## Findings by Category

---

### 🔴 CRITICAL — Immediate Action Required

---

#### C-1: Hardcoded Cloudflare API Token and Zone ID in VCS

**Files:** `scripts/dns-check.js`, `scripts/dns-update.js`  
**Severity:** CRITICAL  
**Category:** Security / Secret Exposure

Both scripts contain plaintext Cloudflare API Bearer tokens and Zone IDs:

```javascript
// scripts/dns-check.js  (line 2-3)
const token = "[REDACTED_CLOUDFLARE_TOKEN]";
const zoneId = "[REDACTED_CLOUDFLARE_ZONE_ID]";

// scripts/dns-update.js  (lines 2-4)
const token = "[REDACTED_CLOUDFLARE_TOKEN]";
const zoneId = "[REDACTED_CLOUDFLARE_ZONE_ID]";
const target = "heady-manager-609590223909.us-central1.run.app";
```

The same token appears in both files. Even though BFG was run against the repo (`.bfg-report/2026-03-06/16-24-41` exists), these secrets appear to have survived or been re-added. The Cloud Run service URL is also hardcoded, leaking infrastructure topology.

**Fix:**
1. **Immediately rotate** the Cloudflare API token via the Cloudflare dashboard.
2. Replace both scripts to read from `process.env.CLOUDFLARE_API_TOKEN` and `process.env.CLOUDFLARE_ZONE_ID`.
3. Add a TruffleHog pre-commit hook and/or use `gitleaks` in the CI pipeline to prevent re-introduction.
4. Audit the full Git history with BFG again to scrub these values from all branches.

```javascript
// Fixed pattern
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (!token || !zoneId) throw new Error('Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID');
```

---

#### C-2: 7 of 9 Vertical Repos Have No Actual Deployment Step

**Files:** `headyapi-core/.github/workflows/deploy.yml`, `headybot-core`, `headybuddy-core`, `headyconnection-core`, `headyio-core`, `headymcp-core`, `headyos-core`  
**Severity:** CRITICAL  
**Category:** Deployment / CI-CD Gap

Seven of the nine vertical satellite repositories have a `deploy.yml` that only runs `npm ci && npm test`. The test script in all nine vertical repos is `echo "Tests coming soon" && exit 0` — meaning no real tests run and no actual deployment occurs. The workflow names say "Deploy HeadyAPI", "Deploy HeadyBot", etc., but nothing is deployed. Only `headyme-core` and `headysystems-core` have real Cloud Run deploy steps (guarded by `secrets.GCP_PROJECT_ID`).

This creates a **false confidence problem**: pushes to these repos trigger a workflow that exits 0 while deploying nothing and testing nothing.

**Fix:**
1. For each vertical repo, implement a real Cloud Run deploy step using `google-github-actions/deploy-cloudrun@v2`, mirroring `headyme-core`.
2. Add at least a boot smoke test (`curl /health` against the deployed revision) as a post-deploy gate.
3. Replace the test placeholder with a real test harness (even minimal) — a passing `exit 0` test provides zero signal.
4. Consider adopting the liquid-deploy pattern from the monorepo so vertical repos receive changes via projection rather than being independently maintained.

---

#### C-3: Liquid Deploy Projection Matrix References Non-Existent Source Paths

**File:** `.github/workflows/liquid-deploy.yml`  
**Severity:** CRITICAL  
**Category:** Deployment / Projection Integrity

The liquid-deploy workflow maps vertical repos to source paths that **do not exist** in the monorepo:

| Vertical | Configured Path | Exists? |
|---|---|---|
| headyme-core | `src/app/` | ❌ Missing |
| headysystems-core | `src/systems/` | ❌ Missing |
| headyconnection-core | `src/connection/` | ❌ Missing |
| headybuddy-core | `src/buddy/` | ❌ Missing |
| headymcp-core | `src/mcp/` | ✅ Exists |
| headyio-core | `src/io/` | ❌ Missing |
| headybot-core | `src/bot/` | ❌ Missing |
| headyapi-core | `src/api/` | ✅ Exists |
| headyos-core | `src/os/` | ❌ Missing |

7 of 9 vertical projections will silently project empty content (the rsync step catches the missing path and logs "Skip (not found)"), meaning the liquid-deploy system currently writes nothing to most satellite repos on source changes. The post-projection validation checks for a SHA match in metadata but not for whether any actual files were projected.

**Fix:**
1. Align the projection path matrix with the actual monorepo directory structure (`src/services/`, `src/mcp/`, `src/api/`, etc.), or create the missing `src/app/`, `src/systems/`, etc. directories as proper module boundaries.
2. Add an assertion in the post-projection step that at least one substantive file was transferred.
3. Run `liquid-deploy` in dry-run mode against the current monorepo to produce a verified path map before re-enabling.

---

#### C-4: Terraform Remote State Backend Missing — State Stored Locally

**File:** `infra/main.tf`, `infra/terraform/main.tf`  
**Severity:** CRITICAL  
**Category:** Infrastructure / Drift Control

Neither Terraform configuration defines a `backend` block for remote state storage. Without a remote backend (GCS, Terraform Cloud, etc.), the state file is stored locally, meaning:
- Any team member running `terraform apply` without the current state file will destroy and recreate all resources.
- State cannot be shared across CI runs.
- There is no state locking, so concurrent applies will corrupt infrastructure.
- The entire "If the environment goes down, `terraform apply` rebuilds everything in minutes" disaster-recovery claim depends on having a valid state file, which is not protected.

Additionally, both `infra/main.tf` and `infra/terraform/main.tf` exist as separate, partially duplicated configs. `infra/terraform/main.tf` is a stripped-down version missing health probes, scaling config, and dead letter topics — these files are out of sync and it is unclear which is authoritative.

**Fix:**
```hcl
terraform {
  required_version = ">= 1.5"
  backend "gcs" {
    bucket  = "heady-terraform-state"
    prefix  = "production/state"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
```
1. Create a dedicated GCS bucket for Terraform state with versioning enabled.
2. Add the `backend "gcs"` block to `infra/main.tf` and run `terraform init -migrate-state`.
3. Delete or archive `infra/terraform/` to eliminate the duplicate config.
4. Enable `prevent_destroy` on critical resources.

---

#### C-5: All 9 Vertical Repo Dockerfiles Missing .gitignore and HEALTHCHECK

**Files:** All `*-core/Dockerfile` (except headyme-core and headysystems-core), all `*-core/.gitignore`  
**Severity:** CRITICAL  
**Category:** Security / Production Hardening

All 9 vertical repos have **no `.gitignore`** at all. This means `.env` files, `node_modules/`, private keys, or any local development artifacts can be committed by mistake with no protection.

Additionally, 7 of 9 Dockerfiles have no `HEALTHCHECK` directive. Cloud Run uses the startup probe and liveness probe from Terraform if defined, but Docker itself (and local orchestrators) will have no health signal. The main monorepo Dockerfile correctly includes a `HEALTHCHECK`.

**Fix for all vertical repos:**

1. Add `.gitignore` (at minimum):
```
.env
.env.*
!.env.example
node_modules/
*.log
dist/
.DS_Store
```

2. Add `HEALTHCHECK` to all vertical Dockerfiles:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:8080/health',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"
```

---

#### C-6: Auto-Heal Implementation is a No-Op in Production

**File:** `src/resilience/auto-heal.js`  
**Severity:** CRITICAL  
**Category:** Self-Healing / Production Hardening

The `AutoHeal` class responds to circuit-breaker OPEN/HALF_OPEN states but the actual remediation code is commented out and replaced with a `setTimeout` that merely removes the component from the healing-in-progress set:

```javascript
async heal(componentId, status) {
    // ...
    if (componentId.startsWith('site-')) {
        this.log(`Restarting web-service for ${componentId}...`);
        // exec(`npm run restart:${componentId.replace('site-', '')}`);  // ← COMMENTED OUT
    } else if (componentId === 'heady-manager') {
        this.log('CRITICAL: Manager reset requested. Triggering safe-mode fallback.');
        // ← no action taken
    }
    
    // Simulated success for now, would integrate with process managers in prod
    setTimeout(() => {
        this.healingInProgress.delete(componentId);
        this.log(`Recovery cycle complete for '${componentId}'.`);
    }, 5000);
}
```

This means in-process auto-healing does nothing. The self-healing GitHub Actions workflow (which redeploys Cloud Run) is the only real healing mechanism, but it only runs on a 15-minute cron — not in real-time.

**Fix:**
1. For Cloud Run deployments, implement real-time healing by calling the Cloud Run API to redeploy or by sending a `SIGTERM` + restart via the service management interface.
2. At minimum, integrate with the circuit breaker's `onOpen` callback to emit a PubSub event that triggers the Cloud Scheduler `self_healing_cycle` job immediately rather than waiting for the 15-minute cron.
3. Remove or clearly mark the commented-out code as "TODO" with an issue reference so it is not mistaken for functional code.

---

#### C-7: Canary Rollback Routes Traffic to `--to-latest` (Could Re-Deploy Bad Revision)

**File:** `.github/workflows/ci.yml`, canary validation step  
**Severity:** CRITICAL  
**Category:** Deployment / Rollback Safety

During canary failure the rollback command is:
```bash
gcloud run services update-traffic ${{ env.CLOUD_RUN_SERVICE_PRODUCTION }} \
  --region="${{ env.REGION }}" \
  --to-latest
```

`--to-latest` points to the most recently deployed revision, which **is the canary itself** if it is the latest revision. This means on canary failure, traffic is re-sent to the broken revision at 100%, not rolled back to the previous stable revision.

**Fix:** Pin the stable revision before sending canary traffic, then roll back to the named stable revision on failure:

```bash
# Before canary deploy, capture the stable revision
STABLE_REV=$(gcloud run services describe ${{ env.CLOUD_RUN_SERVICE_PRODUCTION }} \
  --region="${{ env.REGION }}" \
  --format="value(status.traffic[0].revisionName)")
echo "stable-revision=$STABLE_REV" >> $GITHUB_OUTPUT

# On canary failure, roll back to named stable revision
gcloud run services update-traffic ${{ env.CLOUD_RUN_SERVICE_PRODUCTION }} \
  --region="${{ env.REGION }}" \
  --to-revisions="${STABLE_REV}=100"
```

---

### 🟠 HIGH — Fix Within Sprint

---

#### H-1: Node Version Inconsistency Across Workflows (Node 20 vs 22)

**Files:** `.github/workflows/ci.yml` (Node 20), `deploy.yml` (Node 22), `quality-gates.yml` (Node 22), `liquid-deploy.yml` (Node 20)

Tests and lint run on Node 20; some deployment and quality gate jobs run on Node 22. This creates a version skew where tests pass on 20 but the deployed artifact runs on 22 (or vice versa). The Dockerfile uses `node:20-slim`.

**Fix:** Pin all workflows to Node 20 LTS (matching the Dockerfile) or upgrade Dockerfile to Node 22. Use a single `.nvmrc` or `engines.node` in `package.json` as the single source of truth, then reference it in all workflows with `node-version-file: '.nvmrc'`.

---

#### H-2: Package Manager Inconsistency (npm vs pnpm)

**Files:** `ci.yml` (uses `npm ci`), `quality-gates.yml` (uses `pnpm install --frozen-lockfile`), `docker-compose.yml` (uses `pnpm dev`)

The monorepo uses `npm ci` in the main CI pipeline but `pnpm` in quality-gates and local development. If a `pnpm-lock.yaml` exists but `package-lock.json` is stale or vice versa, lock file drift will cause non-reproducible builds. The quality-gates workflow also lacks `pnpm` setup (`setup-node` with `cache: pnpm` requires `pnpm` to already be installed).

**Fix:** Choose one package manager (pnpm is the modern choice for monorepos). Update all workflows to use `corepack enable && pnpm install --frozen-lockfile`. Remove `package-lock.json` if `pnpm-lock.yaml` is the source of truth.

---

#### H-3: Snyk Scan is Advisory-Only and Does Not Block Deployment

**File:** `.github/workflows/ci.yml`, line 157

```yaml
- name: Snyk security scan
  continue-on-error: true  # advisory — does not block deploy
```

Also, the Cosign image signing step has `continue-on-error: true`, meaning images can be pushed unsigned with no failure signal. The SARIF upload also has `continue-on-error: true`.

For a system handling AI/LLM keys, payment credentials (Stripe), and user data, allowing high-severity vulnerabilities to deploy silently contradicts the security model.

**Fix:**
1. Set `continue-on-error: false` on Snyk for high-severity findings (Snyk already has `--severity-threshold=high`).
2. Make Cosign signing a hard gate or remove it — silent signing failures create false assurance. Use a separate non-blocking advisory job for `continue-on-error: true` scans.

---

#### H-4: `docker-compose.yml` Port Mismatch — Container Listens on 8080, Compose Maps 3000:3000

**File:** `docker-compose.yml`

The Dockerfile sets `ENV PORT=8080` and `EXPOSE 8080`, but docker-compose maps port `3000:3000` and overrides to `NODE_ENV=development`. The server-boot.js falls back to port `3301` if `PORT` is unset. This means local development likely fails to connect properly unless `PORT=3000` is explicitly set via `.env`.

**Fix:** Align the port: use `3000:8080` in docker-compose (or `8080:8080`) so the host port 3000 maps to container port 8080, or set `PORT=3000` in the compose environment block.

---

#### H-5: Smoke Tests After Deploy Do Not Fail the Pipeline on Failure

**File:** `.github/workflows/deploy.yml`, `smoke-tests` job

```bash
# At end of smoke test step:
exit 0   # ← always exits success regardless of FAIL/PASS counts
```

The smoke-tests job reports `❌ Health endpoint: 000` but then exits 0. The `verify-projections` final job only fails if *zero* projections are healthy, meaning a partially broken deployment will be marked green.

**Fix:** Make smoke test failures block promotion. Exit non-zero if the critical health endpoint check fails:
```bash
if [ "$STATUS" != "200" ]; then
    echo "CRITICAL smoke test failed"
    exit 1
fi
```

---

#### H-6: Self-Healing Drift Check Silently Skips on Module Import Failure

**File:** `.github/workflows/self-healing.yml`, drift-check job

```javascript
try {
    DriftDetector = require('./src/monitoring/drift-detector');
} catch (e) {
    console.log('DriftDetector module not yet available — skipping drift check');
    process.exit(0);  // ← silently passes
}
```

If the drift detector module fails to load (dependency error, syntax error, missing database connection), the drift check returns `drift-ok=true` and `drift-score=unknown`. This means the self-healing loop can miss critical drift conditions when the detector itself is broken.

**Fix:** Differentiate between "module intentionally not yet implemented" (skip) and "module load error" (fail). Log the actual error. Consider writing `drift-ok=unknown` and treating `unknown` as a warning rather than pass.

---

#### H-7: `--allow-unauthenticated` on Both Staging and Production Cloud Run Services

**File:** `.github/workflows/ci.yml`, both deploy steps; `infra/main.tf`

Both Cloud Run services are deployed with `--allow-unauthenticated`, granting public access. While this may be intentional for the public-facing web service, the swarm-orchestrator (which receives Pub/Sub push messages and handles admin tasks) is also `allUsers` invoker per the Terraform IAM binding:

```hcl
resource "google_cloud_run_v2_service_iam_member" "manager_public" {
  role   = "roles/run.invoker"
  member = "allUsers"
}
```

Internal services (orchestrator, swarm background workers) should use service-account authentication, not public access.

**Fix:** Restrict `swarm_orchestrator` and any admin-path services to require a GCP service account or OIDC token. Only the user-facing heady-manager service needs public unauthenticated access.

---

### 🟡 MEDIUM — Fix Within 2 Sprints

---

#### M-1: Canary Validation Uses Only 5xx Log Count (Not SLO Metrics)

**File:** `.github/workflows/ci.yml`

The canary validation waits 60 seconds then checks if there are more than 5 log entries with `status>=500` in the last 2 minutes. This is a very coarse signal:
- It uses Cloud Logging (pull-based, has ingestion delay) not real-time Cloud Monitoring metrics.
- `--limit=10` caps the log query at 10 results regardless of actual error count.
- It ignores latency, p99 response time, and memory exhaustion — which can cause user-visible degradation without 5xx errors.

**Fix:** Use Cloud Monitoring metrics API for canary validation:
```bash
# Check error rate via Monitoring API
gcloud monitoring query --project=$PROJECT --query="
  fetch cloud_run_revision
  | metric 'run.googleapis.com/request_count'
  | filter (resource.revision_name =~ 'canary')
  | filter (metric.response_code_class == '5xx')
  | sum
"
```
Also check p99 latency against the SLO baseline in `configs/observability/slo-latency-baseline.json`.

---

#### M-2: Two Duplicate, Out-of-Sync Terraform Configurations

**Files:** `infra/main.tf` vs `infra/terraform/main.tf`

`infra/main.tf` is the complete, current configuration. `infra/terraform/main.tf` is a stripped-down version missing: health/liveness probes, dead-letter topics, Cloud Storage buckets, scaling config, and resource labels. Running `terraform apply` from the wrong directory would remove critical infrastructure.

**Fix:** Delete `infra/terraform/` or convert it to a child module. Add a comment at the root of `infra/main.tf` marking it as authoritative. Add a CI job that validates `terraform plan` produces no unexpected destroys.

---

#### M-3: Redis in Docker Compose Has No Persistence (Ephemeral Session State)

**File:** `docker-compose.yml`

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

The `allkeys-lru` eviction policy with no `--save` or `appendonly yes` means all Redis data (sessions, rate-limit counters, cache) is ephemeral and lost on container restart. The production Redis (via `REDIS_URL` / `UPSTASH_REDIS_URL`) should be configured for persistence separately, but the dev environment gives false confidence.

**Fix:** Add `--save 60 1 --appendonly yes` to the Redis command in docker-compose (or use a Redis image with persistence pre-configured). The infrastructure cloud config already has `--save 60 1` in `cmd-center-compose.yaml` but this is not reflected in the primary `docker-compose.yml`.

---

#### M-4: Env Validator Has Two Separate Implementations with Different Required Variables

**Files:** `src/security/env-validator.js` vs `src/config/env-schema.js`

Two environment validators exist with different "required" lists:
- `env-validator.js`: requires `NODE_ENV` and `DATABASE_URL` + `HEADY_API_SECRET` (production only)
- `env-schema.js`: requires `DATABASE_URL` + `HEADY_API_KEY` (different key name) and lists `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `SENTRY_DSN` as "required"

The `heady-manager.js` entry point calls `validateEnvironment` from `src/config/env-schema.js`. It is unclear which is the authoritative schema and which keys are actually enforced at startup.

**Fix:** Merge into a single `src/config/env-schema.js`. Ensure the `.env.example` reflects all required keys. Add an automated test that boots the app with only required vars set and verifies it starts.

---

#### M-5: Monorepo CI (ci.yml) and Autonomous Projection (deploy.yml) Both Deploy to Same Cloud Run Service

**Files:** `ci.yml` (`heady-production` Cloud Run service), `deploy.yml` (`heady-manager` Cloud Run service)

`ci.yml` deploys to `heady-production` Cloud Run service using `GCP_SA_KEY` + fixed project `heady-production`. `deploy.yml` deploys to `heady-manager` using `GCP_PROJECT_ID` secret. These appear to be the same service under different names, or two separate deployments of the same code to different services. Both can trigger on a push to `main`, potentially creating a race condition where both workflows deploy simultaneously with different configurations (different memory/CPU settings: 4Gi/4CPU in ci.yml vs 1Gi/1CPU in deploy.yml).

**Fix:** Designate one workflow as the canonical production deployer. The `ci.yml` with its full lint→test→security-scan→build→staging→canary→production pipeline is far more rigorous and should be the single deployment path. The `deploy.yml` "autonomous projections" should not also deploy to the production Cloud Run service.

---

#### M-6: Self-Healing Workflow Auto-Remediates by Re-Deploying With Same Image + Timestamp Env Var

**File:** `.github/workflows/self-healing.yml`

The auto-remediation step forces a new Cloud Run revision by injecting a timestamp environment variable:

```bash
gcloud run deploy heady-production \
  --image="$CURRENT_IMAGE" \
  --update-env-vars="HEADY_REMEDIATION_TS=$(date -u +%s)"
```

This creates unnecessary revision churn (a new revision every 15 minutes if any health check fails) and pollutes the revision history. Cloud Run keeps at most 1000 revisions; excessive remediation cycles can exhaust this. More critically, this does not actually fix the underlying issue — it just restarts instances.

**Fix:** Only remediate when there is a genuine failure pattern (e.g., 3 consecutive failed health checks). Use Cloud Run's `--revision-suffix` to clearly identify remediation revisions. Set a minimum interval between remediations (e.g., skip if last remediation was within 30 minutes).

---

#### M-7: `configs/keys/` Directory Contains GPG Key Files Committed to Repo

**File:** `configs/keys/windsurf-next.gpg`, `configs/keys/windsurf-stable.gpg`

These are GPG public key files (for Windsurf/Codeium repository signing), not private keys, so the immediate risk is lower. However, committing any key material to a production repository is poor practice. The directory is named `keys/` which may attract future accidental private key commits.

**Fix:** Remove these files from the repo and distribute them via a configuration management system. Add `configs/keys/` to `.gitignore`. The BFG report suggests a recent secret-scrub — verify that any previously committed sensitive material in this directory was removed.

---

#### M-8: Single-Region Deployment (us-central1 Only)

**File:** `infra/main.tf`, all workflow deploy commands

All Cloud Run services, Pub/Sub topics, GCS buckets, and Cloud Scheduler jobs are in `us-central1` only. A single regional outage would take down all 9 domains. Cloudflare acts as the edge CDN but the origin is single-region.

**Fix:** For production hardening, add a second Cloud Run deployment in `us-east1` or `us-west1` as a warm standby. Use Cloudflare Load Balancing with health-check-based failover to the secondary region. At minimum, document the RPO/RTO for a regional failure.

---

#### M-9: No Database Backup Automation in Terraform/CI

**File:** `infra/main.tf`

The Terraform config provisions a cold-archive GCS bucket labeled `disaster-recovery` but includes no automated database backup jobs, Cloud Scheduler jobs for `pg_dump`, or Neon/Cloud SQL PITR configuration. The `auto-deploy-config.json` references `BACKUP_ENDPOINT=https://headysystems.com/api/backup` but this appears to be an HTTP endpoint rather than a proper backup pipeline.

**Fix:** Add a Cloud Scheduler job that triggers a Cloud Run job or Cloud Function to perform daily `pg_dump` to the GCS cold-archive bucket. Enable Cloud SQL automated backups if using Cloud SQL, or Neon PITR if using Neon. Test restore procedures quarterly.

---

### 🔵 LOW — Fix When Capacity Allows

---

#### L-1: `headymcp-production` and `headysystems-production` Are Empty Shells

Both production repos contain only a `README.md` (headymcp-production) or a static `index.html` with `_headers`/`_redirects` (headysystems-production). There are no deployment workflows, no Dockerfiles, no CI/CD. If these are intended as production environments they need the same treatment as the `*-core` repos.

---

#### L-2: AI-Change Eval Gate Only Triggers on Labeled PRs

**File:** `.github/workflows/quality-gates.yml`

```yaml
eval-gate:
  if: contains(github.event.pull_request.labels.*.name, 'ai-change')
```

The eval gate only runs if a PR has the `ai-change` label applied manually. This means AI model changes, prompt template changes, or governance engine changes can merge without evaluation if the label is forgotten.

**Fix:** Automatically detect AI-related changes via path filters (`src/intelligence/`, `configs/prompts/`, `src/governance/`) rather than relying on manual labeling.

---

#### L-3: Monte Carlo Projection Validation Uses Random Number Generation, Not Real Data

**File:** `.github/workflows/liquid-deploy.yml`

The pre-projection Monte Carlo validation generates random `fidelity` values (`0.95 + Math.random() * 0.05`) and random `conflictRisk` values. It will pass at 98%+ confidence virtually every time regardless of the actual state of the files being projected. This provides no real signal about projection safety.

**Fix:** Replace the random-number simulation with actual file diff analysis: count files to be overwritten, check for merge conflicts, verify no empty files would be projected, and compare file sizes against expected ranges.

---

#### L-4: `heady-manager.js` Falls Back to Port 3301, Dockerfile Exposes 8080

**File:** `src/bootstrap/server-boot.js`

```javascript
const PORT = process.env.PORT || process.env.HEADY_PORT || 3301;
```

The fallback port (3301) differs from the Dockerfile's `EXPOSE 8080` and Cloud Run's `--port=8080`. If `PORT` is not set, the health check (`http://localhost:8080/health`) will fail. Cloud Run always sets `PORT=8080`, so this is only a risk in non-Cloud-Run deployments, but the fallback to 3301 is misleading.

**Fix:** Remove the 3301 fallback and default to 8080: `const PORT = process.env.PORT || 8080;`

---

#### L-5: Observability Config References `${OTEL_EXPORTER_ENDPOINT:-http://localhost:4318}` — Local Fallback in Production

**File:** `configs/observability/otel-config.yml`

The OTEL exporter falls back to `localhost:4318` if the env var is unset. In a Cloud Run environment with no local OTEL collector, telemetry will silently fail to export if `OTEL_EXPORTER_ENDPOINT` is not set. This is not caught by the env validator.

**Fix:** Add `OTEL_EXPORTER_ENDPOINT` to `src/config/env-schema.js` as a required variable (or at least warn loudly if missing in production). Consider using Cloud Trace directly via the GCP OTLP exporter when running on Cloud Run.

---

#### L-6: `configs/sso/GoogleIDPMetadata.xml` Contains Production SAML Metadata

**File:** `configs/sso/GoogleIDPMetadata.xml`

The SAML IDP metadata XML contains the entity ID `https://accounts.google.com/o/saml2?idpid=C01bjma2b` (a specific Workspace tenant IDP ID) and a full X.509 certificate. While this is not a secret (it is the IDP's public metadata), committing tenant-specific production SSO configuration to VCS risks accidental exposure of org identity and makes configuration changes harder to manage.

---

## Findings Summary Table

| ID | Severity | Category | Title | Effort |
|---|---|---|---|---|
| C-1 | 🔴 Critical | Security | Hardcoded Cloudflare API token in VCS | 1h |
| C-2 | 🔴 Critical | Deployment | 7/9 vertical repos: test-only pipelines, no real deploy | 2d |
| C-3 | 🔴 Critical | Deployment | Liquid-deploy projection paths don't exist in monorepo | 1d |
| C-4 | 🔴 Critical | Infrastructure | Terraform remote state backend missing | 2h |
| C-5 | 🔴 Critical | Security/Ops | All vertical repos missing .gitignore and HEALTHCHECK | 2h |
| C-6 | 🔴 Critical | Self-Healing | Auto-heal is a no-op in production | 3d |
| C-7 | 🔴 Critical | Deployment | Canary rollback uses --to-latest (re-deploys bad revision) | 2h |
| H-1 | 🟠 High | CI/CD | Node version skew (20 vs 22) across workflows | 1h |
| H-2 | 🟠 High | CI/CD | npm vs pnpm inconsistency across workflows | 2h |
| H-3 | 🟠 High | Security | Snyk scan and Cosign signing are advisory-only | 1h |
| H-4 | 🟠 High | Deployment | docker-compose port mismatch (3000:3000 vs 8080) | 30m |
| H-5 | 🟠 High | Deployment | Smoke tests exit 0 regardless of failure | 30m |
| H-6 | 🟠 High | Self-Healing | Drift check silently passes on module load error | 1h |
| H-7 | 🟠 High | Security | swarm-orchestrator publicly accessible (allUsers) | 2h |
| M-1 | 🟡 Medium | Deployment | Canary uses coarse log-count, not SLO metrics | 1d |
| M-2 | 🟡 Medium | Infrastructure | Two duplicate, out-of-sync Terraform configs | 2h |
| M-3 | 🟡 Medium | Data | Redis in dev compose has no persistence | 30m |
| M-4 | 🟡 Medium | Security | Two env validators with different required-key lists | 2h |
| M-5 | 🟡 Medium | Deployment | Two CI workflows both deploying to production Cloud Run | 1d |
| M-6 | 🟡 Medium | Self-Healing | Self-healing adds timestamp env var every 15min (revision churn) | 2h |
| M-7 | 🟡 Medium | Security | GPG key files committed to configs/keys/ | 1h |
| M-8 | 🟡 Medium | Reliability | Single-region deployment only | 2-3d |
| M-9 | 🟡 Medium | Data | No database backup automation | 1-2d |
| L-1 | 🔵 Low | Deployment | headymcp-production and headysystems-production are empty | TBD |
| L-2 | 🔵 Low | CI/CD | AI eval gate requires manual label | 1h |
| L-3 | 🔵 Low | Deployment | Monte Carlo projection uses random numbers, not real data | 2d |
| L-4 | 🔵 Low | Config | server-boot.js falls back to port 3301 | 15m |
| L-5 | 🔵 Low | Observability | OTEL exporter silently falls back to localhost | 30m |
| L-6 | 🔵 Low | Security | Production SAML metadata committed to VCS | 1h |

---

## What's Working Well

The following patterns are solid and should be preserved:

1. **Multi-stage Docker build with non-root user** — The monorepo Dockerfile correctly separates builder and production stages, drops to a non-root `heady` user, and excludes `.env` files. The HEALTHCHECK is well-formed.

2. **Canary deploy architecture** — The approach of deploying with `--no-traffic --tag=canary` and then progressively routing is architecturally correct. The rollback bug (C-7) is fixable without changing the overall pattern.

3. **Secret Manager integration** — Production secrets (`DATABASE_URL`, `JWT_SECRET`, AI API keys, etc.) are properly injected via Cloud Run's `--set-secrets` from GCP Secret Manager rather than hardcoded. This is the right pattern.

4. **Self-healing workflow structure** — The 15-minute cron health check with parallel jobs for endpoint health, TLS cert expiry, drift detection, and resource utilization is well-designed. The auto-remediation logic for Cloud Run is correct (modulo C-7). The all-clear/alert notification pattern via Slack is good.

5. **Circuit breaker implementation** — `src/resilience/circuit-breaker.js` is a well-implemented state machine with CLOSED/OPEN/HALF_OPEN transitions, metric tracking, and fallback support.

6. **Governance engine** — The `GovernanceEngine` class with tamper-evident audit trail, budget limits, content safety patterns, and quality gate certifications is a strong foundation for AI governance.

7. **OTEL instrumentation** — AI-specific metrics (tokens, eval scores, tool calls, circuit breaker state) alongside standard HTTP metrics are well-defined in `configs/observability/otel-config.yml`.

8. **Drift detection** — `src/monitoring/drift-detector.js` is a sophisticated 384-dimensional embedding drift monitor with Monte Carlo trajectory simulation, multi-category detection, and PostgreSQL persistence. This is production-grade.

9. **TLS configuration** — `configs/nginx/nginx-mtls.conf` enforces TLS 1.3 only with post-quantum cipher suites (X25519:kyber768). The mTLS module in `src/security/mtls.js` enforces TLS 1.3 and strong cipher selection.

10. **Liquid-deploy architecture concept** — The projection matrix pattern (monorepo → satellite repos via rsync with metadata injection and Monte Carlo pre-flight) is architecturally sound, just broken at the path configuration level (C-3).

---

## Prioritized Fix Roadmap

### Week 1 — Immediate (All Critical Issues)

| Day | Action |
|---|---|
| Day 1 AM | **C-1**: Rotate Cloudflare token, fix dns-check.js and dns-update.js, run BFG to scrub history |
| Day 1 PM | **C-7**: Fix canary rollback to use named stable revision |
| Day 2 | **C-4**: Add GCS backend to Terraform, migrate state, delete duplicate terraform/ dir |
| Day 3 | **C-5**: Add .gitignore and HEALTHCHECK to all 9 vertical repos |
| Day 4-5 | **C-3**: Fix liquid-deploy projection path matrix to match actual monorepo structure |
| Day 6-7 | **C-2**: Add real Cloud Run deploy steps to 7 vertical repo workflows |

### Week 2 — High Priority

| Day | Action |
|---|---|
| Day 8 | **H-5** + **H-4**: Fix smoke test exit codes and docker-compose port alignment |
| Day 9 | **H-1** + **H-2**: Standardize Node version to 20 LTS and package manager to pnpm |
| Day 10 | **H-3**: Make Snyk a hard gate; fix Cosign |
| Day 11 | **H-7**: Restrict swarm-orchestrator IAM to service-account invocation |
| Day 12 | **M-5**: Designate single canonical deploy workflow for production |

### Week 3-4 — Medium Priority

| Day | Action |
|---|---|
| Week 3 | **C-6**: Implement real auto-heal (PubSub trigger or Cloud Run API restart) |
| Week 3 | **M-4**: Merge dual env validators into single schema |
| Week 3 | **M-6**: Add remediation throttling to self-healing workflow |
| Week 4 | **M-1**: Upgrade canary validation to use Cloud Monitoring SLO metrics |
| Week 4 | **M-8**: Design multi-region warm-standby architecture |
| Week 4 | **M-9**: Implement automated daily database backup to GCS |

### Month 2 — Low Priority and Strategic

- **L-3**: Replace Monte Carlo random simulation with real file diff analysis
- **L-2**: Auto-detect AI-change PRs via path filters
- **M-8**: Implement and test multi-region failover
- **L-1**: Properly build out headymcp-production and headysystems-production repos
- **L-6**: Move SAML metadata to config management

---

## Top 10 Recommendations (Summary)

1. **Rotate the leaked Cloudflare token immediately** — Two scripts commit a live Bearer token in plaintext. Rotate it now, fix the scripts to use env vars, re-run BFG. (C-1)

2. **Fix the canary rollback to pin the stable revision** — `--to-latest` during rollback re-deploys the broken canary at 100%. Capture the stable revision name before deploying the canary tag. (C-7)

3. **Add a Terraform remote state backend** — Without GCS remote state, the entire IaC disaster-recovery story is broken. One `terraform apply` from the wrong machine destroys everything. (C-4)

4. **Fix the liquid-deploy projection paths** — 7 of 9 vertical projections are silently skipped because the configured source paths (`src/app/`, `src/systems/`, etc.) don't exist. The system produces no errors and writes nothing. (C-3)

5. **Replace placeholder tests and add real deploy steps in vertical repos** — All 9 vertical repos have `echo "Tests coming soon" && exit 0` as their test script, and 7 have no actual deploy step. These pipelines create false confidence. (C-2)

6. **Add .gitignore files to all vertical repos** — No vertical satellite repo has a `.gitignore`. Any developer working in these repos can accidentally commit `.env` files, credentials, or `node_modules`. (C-5)

7. **Make the in-process auto-heal functional** — `src/resilience/auto-heal.js` detects circuit breaker failures but the remediation code is commented out. The system believes it is self-healing but does nothing in-process. Emit a real signal (PubSub, API call) on circuit open. (C-6)

8. **Designate a single canonical CI/CD deployment path** — Two workflows (`ci.yml` and `deploy.yml`) both deploy to production Cloud Run on push to main, with different memory/CPU configurations. The race condition and configuration conflict must be resolved. (M-5)

9. **Standardize Node version and package manager across all workflows** — Mixed Node 20/22 and npm/pnpm creates reproducibility gaps. Pin to a single LTS version via `.nvmrc` and a single lock file. (H-1, H-2)

10. **Make security scans hard gates** — Snyk high-severity findings are advisory and non-blocking. For a system handling AI API keys, session tokens, and user data, this is unacceptable. Snyk, Cosign, and SBOM generation should block deployment on critical findings. (H-3)

---

*Report generated by automated analysis of repository contents. All file references are relative to `/home/user/workspace/headyme-repos/`. Timestamps and SHA values reflect the state of the repos at analysis time (2026-03-07).*
