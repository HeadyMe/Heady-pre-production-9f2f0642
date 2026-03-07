# Heady Deployment & Infrastructure Analysis
**Author:** Infrastructure Analysis Agent  
**Date:** 2026-03-07  
**Scope:** Docker, CI/CD, canary, health checks, provider gateway, IaC, monitoring  

---

## Executive Summary

The Heady platform has a sophisticated multi-provider AI gateway, a rich PM2 ecosystem, and a well-documented production deployment guide. The core architecture is sound (multi-stage Dockerfile, non-root user, Cloud Run target), but several critical gaps exist that would cause production incidents. This report documents every finding, ranks them by severity, and provides concrete remediation — all implemented in the companion files.

| Severity | Count | Examples |
|---|---|---|
| Critical | 6 | `NODE_TLS_REJECT_UNAUTHORIZED=0`, missing graceful shutdown, no real circuit-breaker half-open state, missing readiness gate on DB |
| High | 8 | Race mode uses `Promise.allSettled` (not `Promise.any`), no resource limits in compose, hardcoded filesystem paths in health check |
| Medium | 7 | Canary.yml has no executable implementation, no connection draining, no alerting integration in infra code |
| Low | 5 | Turbo pipeline missing `typecheck`, otel-collector pinned to `latest`, docker-compose version field deprecated |

---

## 1. Docker Multi-Stage Build Analysis

### 1.1 Current State (`Dockerfile`)

```
Stage 1 (builder): node:20-slim
  COPY package*.json → npm ci --ignore-scripts
  COPY src/ configs/ scripts/ docs/
  npm prune --production

Stage 2 (production): node:20-slim
  Non-root user: heady ✅
  EXPOSE 8080 ✅
  HEALTHCHECK: HTTP /health ✅
  NODE_ENV=production ✅
```

**Positive findings:**
- Multi-stage build exists (good)
- Non-root user creation with `useradd -r -g heady` ✅
- `.env` explicitly excluded from image ✅
- `npm ci --ignore-scripts` reduces supply-chain risk ✅

**Critical gaps:**

| # | Gap | Impact |
|---|---|---|
| 1 | Base image `node:20-slim` — not pinned to digest | Silent upstream CVE injection |
| 2 | `docs/` copied into production image | ~5-20 MB unnecessary layer |
| 3 | `scripts/` copied wholesale — includes dev tooling | Increases attack surface |
| 4 | No `.dockerignore` visible — likely copies `node_modules`, `.git`, `.env.*` | Image bloat + secret exposure |
| 5 | `HEALTHCHECK` uses raw `node -e` with inline HTTP — brittle, no timeout on TCP | False healthy under load |
| 6 | `heady-hive-sdk/` is a direct `COPY` with no stage-1 dependency resolution | SDK not pruned |
| 7 | No `SIGTERM` handler — Cloud Run sends SIGTERM on scale-in; Node exits immediately | Request loss |
| 8 | No explicit `--uid` / `--gid` mapping for rootless OCI runtimes | Portability issue |

### 1.2 Optimized Dockerfile (see `Dockerfile.optimized`)

Key improvements:
- Pin base image to digest (`node:20-slim@sha256:...`)
- Add comprehensive `.dockerignore` guidance
- Use `tini` as PID 1 for proper signal propagation
- Remove `docs/` from production image
- Use `COPY --chown=heady:heady` to avoid ownership-fix layers
- Explicit `--uid 1001 --gid 1001` for OCI runtime compatibility
- Add `/tmp` tmpfs hint via `VOLUME ["/tmp"]`
- Use `node --max-old-space-size=768` to prevent OOM before Cloud Run kills container
- Health check via `wget` (already in slim) instead of inline `node -e`

---

## 2. Container Security

### 2.1 Findings

| # | Severity | Finding | File |
|---|---|---|---|
| 1 | **CRITICAL** | `NODE_TLS_REJECT_UNAUTHORIZED: '0'` in `ecosystem.config.cjs` | ecosystem.config.cjs:14 |
| 2 | High | Gemini API key embedded in URL query string (`?key=...`) — appears in logs | provider-connector.js:253 |
| 3 | High | Health check reads `/home/headyme/Heady/heady-registry.json` — hardcoded bare-metal path | health-routes.js:49 |
| 4 | Medium | `heady-maintenance-ops.js` uses `execSync('git ...')` — shell injection if rootDir is tainted | heady-maintenance-ops.js:67 |
| 5 | Medium | `provider-benchmark.js` writes audit JSONL to `data/` — no size limit, disk exhaust possible | provider-benchmark.js:39 |
| 6 | Low | `ANTHROPIC_SECONDARY_KEY` used for batch — both primary/secondary logged under same label | inference-gateway.js:120 |

### 2.2 Recommendations

**Critical — Fix before next deploy:**

```js
// ecosystem.config.cjs — REMOVE this line entirely
// NODE_TLS_REJECT_UNAUTHORIZED: '0',
// Instead: supply proper CA bundle via NODE_EXTRA_CA_CERTS
```

```js
// health-routes.js — replace hardcoded path
const REGISTRY_PATH = process.env.HEADY_REGISTRY_PATH
  || path.join(process.cwd(), 'heady-registry.json');
```

**Secrets handling — use Secret Manager mounts:**
```bash
# Cloud Run — mount secrets as volume, not env vars
gcloud run services update heady-manager \
  --update-secrets=/secrets/env=heady-env-production:latest
```

**Read-only filesystem (Cloud Run supports):**
```yaml
# In cloud run service YAML
containers:
  - volumeMounts:
    - name: tmpdir
      mountPath: /tmp
volumes:
  - name: tmpdir
    emptyDir: {}
```

---

## 3. CI/CD Pipeline Assessment

### 3.1 Current State

`deploy-script.js` describes 5 pipeline phases (P0–P5) but **no `.github/workflows/` file was found**. The canary.yml is a declarative config with no execution engine. The deploy script commits directly to `main` and pushes — bypassing PR review.

**Gaps vs. a production-grade pipeline:**

| Phase | Current | Gap |
|---|---|---|
| P0 Security Scan | Mentioned in comments | No actual TruffleHog/CodeQL workflow |
| P1 Tests | `turbo.json` has `test` task | No CI runner invokes it |
| P2 Cloud Run Deploy | `gcloud run deploy --source .` | No image digest pinning, no traffic split |
| P3 HuggingFace | Mentioned in comments | No workflow |
| P4 Edge | `wrangler deploy` called directly | No staging → production promotion |
| P5 Verification | "Auto-Success" | No actual readiness poll with timeout |
| Missing | — | No SAST (Semgrep/CodeQL), no SCA (npm audit), no image scan (Trivy), no branch protection |

### 3.2 Git-Based Deploy Risk

`deploy-script.js` line 107–109 auto-commits all working tree changes to `main`:
```js
run('git add -A');
run(`git commit -m "🐝 heady deploy: ${date} projection"`);
run('git push origin main');
```

**This is a critical deployment anti-pattern** — any unreviewed local change ships to production with no test gate. The `ci-cd-pipeline.yml` companion file enforces branch protection + required status checks.

---

## 4. Canary Deployment Robustness

### 4.1 Current `canary.yml`

The file is a well-structured YAML specification (1%→5%→20%→100% with metric gates). However:

| Gap | Detail |
|---|---|
| **No execution engine** | YAML is documentation, not runtime code |
| **Metrics undefined** | `error_rate`, `eval_score`, `p99_latency` are named but not collected |
| **Rollback is "instant"** but not implemented | No Cloud Run traffic split management code |
| **No baseline comparison** | Canary metrics need a stable/canary split, not absolute thresholds |
| **No warmup period** | Traffic immediately hits canary at weight |
| **Feature flags referenced** but `heady-feature-flags` integration doesn't exist | |

### 4.2 Implemented Solution (see `canary-deployment.js`)

The new file provides:
- Cloud Run traffic split management via `gcloud` CLI
- Real metrics collection from `/health/ready` and `/api/ai/status`
- Prometheus scrape for error rate and p99 latency
- Automatic rollback on threshold breach with PagerDuty/Slack hooks
- State machine: `DEPLOYING → CANARY_1PCT → CANARY_5PCT → CANARY_20PCT → FULL → COMPLETE | ROLLED_BACK`
- Configurable analysis interval with exponential backoff on metric fetch failures

---

## 5. Health Check Depth and Readiness Probes

### 5.1 Current `health-routes.js`

**Positive:**
- `/health/live` — lightweight liveness ✅
- `/health/ready` — checks resilience, memory, event loop lag, vector memory ✅
- `/health/full` — full system status ✅

**Gaps:**

| # | Gap | Severity |
|---|---|---|
| 1 | `/health/ready` checks `heady-registry.json` at hardcoded `/home/headyme/` path — always fails in containers | Critical |
| 2 | No database connectivity check in readiness probe | Critical |
| 3 | No Redis connectivity check in readiness probe | High |
| 4 | Event loop lag measured with `setImmediate` — unreliable under load (measures scheduling, not actual lag) | High |
| 5 | Memory threshold hardcoded at 450 MB — should be configurable | Medium |
| 6 | `/health/full` exposes `pid`, `platform`, `arch` — information disclosure in public endpoint | Medium |
| 7 | `selfAwareness.getSystemIntrospection()` can be slow — no timeout wrapping | Medium |
| 8 | No startup probe — Cloud Run readiness check fires too early | Medium |

### 5.2 Prometheus Metrics Missing

The production guide references `heady_http_requests_total`, `heady_db_pool_size`, etc. but no `prom-client` integration exists in `health-routes.js`. The `heady-manager-v2.js` wires this.

---

## 6. Provider Gateway Failover Patterns

### 6.1 `inference-gateway.js` Analysis

**Positive:**
- Circuit breaker pattern exists ✅
- Race mode (fastest wins) ✅
- Battle mode (all providers) ✅
- Priority cascade (free → credits → paid) ✅

**Bugs and gaps:**

| # | Severity | Issue |
|---|---|---|
| 1 | **Bug** | `race()` uses `Promise.allSettled` + `results.find(r => r.value)` — does NOT return fastest winner; returns first result in array order | inference-gateway.js:326 |
| 2 | **High** | Circuit breaker has no half-open state — once closed on reset, next call may hammer a still-degraded provider | inference-gateway.js:247 |
| 3 | **High** | `complete()` fallback recurses: `this.complete(messages, {...opts, provider: fallback[0]})` — can stack overflow if all providers fail in sequence | inference-gateway.js:296 |
| 4 | **High** | No per-provider timeout — a slow provider blocks the race for up to 120s | provider-connector.js:179 |
| 5 | **Medium** | Stats not persisted — circuit breaker state lost on restart | inference-gateway.js:236 |
| 6 | **Medium** | No request hedging — only triggered in explicit `race` mode | — |
| 7 | **Medium** | `race()` cancels no in-flight requests after winner found — all providers complete, wasting tokens | inference-gateway.js:326 |
| 8 | **Low** | `getStatus()` exposes `costPerMTok` as `$0` for free tiers — misleading if rate limits apply | — |

### 6.2 `provider-connector.js` Analysis

- `KeyHealth.isHealthy()` cooldown 5 min is reasonable ✅  
- `fanOut()` / `fanOutAllKeys()` are well-designed ✅  
- `AbortSignal.timeout(120000)` — too long for gateway; should be 30s max with provider-specific overrides ✅ needs tuning

---

## 7. Infrastructure-as-Code Coverage

### 7.1 Assessment

| IaC Layer | Status | Gap |
|---|---|---|
| Dockerfile | Exists | Not pinned; no `.dockerignore` |
| docker-compose.yml | Dev only | No production compose |
| Cloud Run deployment | Manual `gcloud` commands in guide | No Terraform / no IaC |
| Cloudflare | Manual dashboard instructions | No `wrangler.toml` in scan |
| PM2 ecosystem | `ecosystem.config.cjs` exists | 40+ processes, no health dependency graph |
| Secret rotation | Manual | No automation |
| Database migrations | `scripts/migrate.js` (not scanned) | Migration runner exists per guide |
| Redis config | Inline in compose | No standalone config |

### 7.2 Key Missing IaC Components

1. **No Terraform** for GCP resources (Cloud Run service, Cloud SQL, Memorystore, Artifact Registry, Secret Manager, IAM bindings)
2. **`docker-compose.production.yml`** missing — the guide references it but it doesn't exist
3. **No `wrangler.toml`** for Cloudflare Workers
4. **PM2 `ecosystem.config.cjs`** has `NODE_TLS_REJECT_UNAUTHORIZED: '0'` which must be removed

---

## 8. Monitoring and Alerting Gaps

### 8.1 Alerting

| Alert Condition | Documented | Implemented |
|---|---|---|
| Health score < 50 | Guide §11.4 ✅ | No code in scanned files ❌ |
| Drift severity = critical | Guide §11.2 ✅ | drift-detector.js not scanned |
| LLM provider timeout ×3 | Guide §11.3 ✅ | Circuit breaker fires but no outbound alert ❌ |
| Worker queue depth > 1000 | Guide §11.3 ✅ | No queue depth metric emitted ❌ |
| Circuit breaker OPEN | — | `logger.error()` only, no alert channel ❌ |
| Canary rollback | canary.yml ✅ | `notify: [pagerduty, slack]` but no code ❌ |

### 8.2 Metrics Gaps

The Prometheus metrics listed in the guide (`heady_http_requests_total`, `heady_db_pool_size`, etc.) require `prom-client` integration. Current code emits no Prometheus metrics.

### 8.3 Missing Observability

- No distributed tracing (OTEL `TraceId` on all requests) — endpoint configured but not wired
- No error budget tracking (SLO/SLI)
- Provider benchmark results stored in flat JSON file, not in time-series DB
- No cost-per-request tracking in gateway responses

---

## 9. Prioritized Improvement Backlog

### P0 — Fix Before Next Deploy (Critical)

| # | Action | File |
|---|---|---|
| 1 | Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` | ecosystem.config.cjs |
| 2 | Fix hardcoded `/home/headyme/` path in health check | health-routes.js |
| 3 | Fix race() to use `Promise.any` for true fastest-wins | inference-gateway.js |
| 4 | Add SIGTERM handler with connection draining | heady-manager.js |
| 5 | Add DB + Redis connectivity to `/health/ready` | health-routes.js |

### P1 — This Sprint (High)

| # | Action | File |
|---|---|---|
| 6 | Pin Docker base image to digest | Dockerfile |
| 7 | Create `.dockerignore` | project root |
| 8 | Add resource limits to all compose services | docker-compose.yml |
| 9 | Add circuit-breaker half-open state | inference-gateway.js |
| 10 | Add per-provider request timeout (30s) | inference-gateway.js |
| 11 | Create production docker-compose | docker-compose.production.yml |
| 12 | Create GitHub Actions CI/CD pipeline | .github/workflows/ |

### P2 — Next Sprint (Medium)

| # | Action | File |
|---|---|---|
| 13 | Implement canary deployment engine | canary-deployment.js (new) |
| 14 | Implement infrastructure monitor + alerting | infrastructure-monitor.js (new) |
| 15 | Add prom-client metrics to gateway + health | heady-manager-v2.js |
| 16 | Add OTEL tracing middleware | heady-manager-v2.js |
| 17 | Add benchmark audit size limits | provider-benchmark.js |

### P3 — Hardening (Low)

| # | Action |
|---|---|
| 18 | Terraform for Cloud Run + Cloud SQL + Memorystore |
| 19 | Secret rotation automation (Secret Manager versions) |
| 20 | Read-only container filesystem (except `/tmp` and `/app/data`) |
| 21 | Add SBOM generation to CI (`syft`) |
| 22 | Add container image signing (`cosign`) |

---

## 10. Companion Files Summary

| File | Purpose | Key Changes |
|---|---|---|
| `Dockerfile.optimized` | Multi-stage, pinned, secure, minimal | tini PID1, no docs/, .dockerignore guidance, proper signal handling |
| `docker-compose.production.yml` | Production-grade full stack | Resource limits, restart policies, secrets via env_file, healthcheck gates |
| `heady-manager-v2.js` | Enhanced orchestrator | Graceful shutdown, connection draining, SIGTERM/SIGINT, metrics bootstrap |
| `inference-gateway-v2.js` | Fixed + enhanced gateway | `Promise.any` race, half-open circuit breaker, per-provider timeout, AbortController cancel |
| `canary-deployment.js` | New: automated canary engine | State machine, Cloud Run traffic splits, metrics-based rollback, Slack/PD alerts |
| `infrastructure-monitor.js` | New: infra health monitor | Polling all health endpoints, provider latency, alerting, Prometheus push |
| `ci-cd-pipeline.yml` | GitHub Actions workflow | Security scan → test → build → push → deploy → verify → canary |
