# Heady Platform — Documentation, Service Health, Observability & Operational Improvements

**Prepared for:** eric@headyconnection.org  
**Date:** 2026-03-07  
**Repos reviewed:** `Heady-pre-production-9f2f0642` (v3.1.0, primary production target) · `Heady` (main, active development) · supporting repos in `/heady_repos`

---

## Executive Summary

The Heady platform has strong architectural bones: a well-structured CI/CD pipeline, φ-weighted health scoring, vector-drift detection, a comprehensive production deployment guide, and an autonomous self-healing workflow. The gaps are concentrated in three areas: (1) **documentation consistency** across the two primary repos, (2) **observability connectivity** — configs that exist but lack confirmed backend wiring — and (3) **operational hygiene** items that could cause silent failures or on-call confusion during incidents.

The table below scores each domain on current state and recommended target.

| Domain | Current Maturity | Target | Key Gap |
|---|---|---|---|
| Documentation | 6 / 10 | 9 / 10 | Merge conflicts in `Heady` main, missing ADRs, no runbook index |
| Service Health | 7 / 10 | 9 / 10 | `/health/full` probe not mounted; `HealthProbes` and `HealthMonitor` coexist without unified entry point |
| Observability | 6 / 10 | 9 / 10 | OTel config exists but OTEL_EXPORTER_ENDPOINT defaults to localhost; no Grafana dashboards; 4 duplicate logger files |
| CI/CD Operations | 8 / 10 | 9 / 10 | `quality-gates.yml` uses `pnpm` while `ci.yml` uses `npm`; missing HNSW migration file referenced in CHANGELOG |
| Incident Response | 5 / 10 | 8 / 10 | `IncidentManager` is in-memory only, no persistence; no on-call rotation or escalation policy document |
| Security Ops | 7 / 10 | 9 / 10 | mTLS nginx certs committed to repo; dead Cloudflare tunnel `4a9d0759` not yet removed |

---

## 1. Documentation

### 1.1 Unresolved merge conflicts in `Heady/README.md`

**Severity: High**

`Heady/README.md` contains 5 unresolved `<<<<<<< HEAD` / `>>>>>>> a3d7d06c` conflict markers. This is the first file any contributor opens. Until resolved, the README is unparseable by documentation tooling and signals broken repo hygiene to external developers.

**Recommendation:** Resolve all conflicts immediately. The `HEAD` side (cloud-first, full service table) is richer and should be kept. Add a pre-commit hook checking for conflict markers:

```bash
# .githooks/pre-commit — add alongside the existing URL-check hook
git diff --cached --name-only | xargs grep -l "^<<<<<<" 2>/dev/null && \
  echo "ERROR: Unresolved merge conflicts found" && exit 1
```

---

### 1.2 Documentation lives in two repos with no single source of truth

**Severity: Medium**

`Heady-pre-production-9f2f0642` has a focused `docs/` directory (8 files, mostly operational). `Heady` (main) has a sprawling `docs/` with 30+ files covering naming standards, IDE fusion plans, and VM setup — many of which are not operational. There is no `docs/INDEX.md` or cross-repo documentation map.

**Recommendations:**

- Create `docs/INDEX.md` in each repo cataloguing every doc file, its owner (reference `docs/DOC_OWNERS.yaml` which already exists in `Heady`), and its review date.
- Establish a documentation tier system:
  - **Tier 1 — Operational** (PRODUCTION_DEPLOYMENT_GUIDE, SECURITY, CHANGELOG): Must be accurate before any release.
  - **Tier 2 — Architecture** (alive-software-architecture, API specs): Review quarterly.
  - **Tier 3 — Reference** (prompt libraries, naming standards): Review annually.
- The `DEPRECATIONS.md` in `Heady-pre-production-9f2f0642` is well-maintained and should be replicated in `Heady` main.

---

### 1.3 Architecture Decision Records (ADRs) are absent

**Severity: Medium**

No ADR directory exists in either repo. Decisions like "why φ-weighted health scoring instead of equal weights", "why Cloud Run over Kubernetes", and "why two separate logger implementations" are undocumented. This creates ramp-up friction for new contributors and on-call engineers.

**Recommendation:** Create `docs/decisions/` with a lightweight ADR template:

```markdown
# ADR-NNN: [Title]
Date: YYYY-MM-DD
Status: Accepted | Superseded by ADR-XXX
Context: …
Decision: …
Consequences: …
```

Seed with at minimum:
- ADR-001: Cloud Run over Kubernetes
- ADR-002: φ-weighted composite health scoring
- ADR-003: In-process vector memory vs external vector DB
- ADR-004: Single Cloud Run origin behind Cloudflare Tunnel for all 9 domains

---

### 1.4 Missing `migrations/003-hnsw-index.sql` referenced in CHANGELOG

**Severity: Medium**

`CHANGELOG.md` (v3.1.0) lists `migrations/003-hnsw-index.sql` as an added file, but only `scripts/migrate.js` exists — no `migrations/` directory. This means the HNSW index migration described as a discrete, versioned artifact is embedded somewhere in the runtime migration script, making it harder to audit, rollback, or replay independently.

**Recommendation:** Extract the HNSW index DDL into a proper `migrations/` directory with numbered files (e.g., `001-schema.sql`, `002-rls.sql`, `003-hnsw-index.sql`). Reference each file explicitly from `migrate.js`. This enables `--rollback` to target specific migrations cleanly.

---

### 1.5 `Heady` (main) CI workflow has no lint, security scan, or coverage steps

**Severity: Medium**

`Heady/.github/workflows/ci.yml` is 14 lines:

```yaml
- run: npm ci
- run: npm test -- --passWithNoTests
- run: npm run build
```

By contrast, `Heady-pre-production-9f2f0642/ci.yml` has lint, test with real Postgres+Redis services, security scan (CodeQL + Snyk + npm audit), and Docker build. The `Heady` (main) CI is so minimal it would pass with zero tests.

**Recommendation:** Bring `Heady/ci.yml` to parity with `Heady-pre-production-9f2f0642/ci.yml`. At minimum, add:
- ESLint step
- `npm audit --audit-level=high`
- Test service containers (pgvector, Redis) so tests don't rely on mocks for DB behavior
- A coverage threshold enforcement (see §3.3)

---

## 2. Service Health

### 2.1 Two parallel health systems without a unified mount point

**Severity: High**

The codebase has two separate health implementations:

| File | Scope |
|---|---|
| `src/observability/health-probes.js` (HealthProbes) | K8s-style liveness/readiness probes; mounts `/health/live`, `/health/ready`, `/health` |
| `src/monitoring/health-monitor.js` (HealthMonitor) | Sacred Geometry composite scoring; mounts `/health/live`, `/health/ready`, `/health/detailed`, `/metrics` |

Both register overlapping routes (`/health/live`, `/health/ready`). If both are mounted, the last one wins and the other is silently shadowed. It is unclear which one the production Cloud Run instance loads, because `heady-manager.js` was not visible in the tree — only that both classes exist.

**Recommendation:**
1. Audit `heady-manager.js` to confirm exactly which health module is mounted.
2. Remove `src/observability/health-probes.js` if `HealthMonitor` is the active one (it is strictly more capable). Update all tests that import `HealthProbes` to target `HealthMonitor`.
3. Document the single authoritative health endpoint map in `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` with a note about which file implements it.

---

### 2.2 `/health/full` endpoint mentioned in README is not implemented

**Severity: Medium**

`README.md` (pre-production) lists `GET /health/full — Deep introspection including self-awareness` in the Health Probes table. `HealthMonitor` exposes `/health/detailed` but not `/health/full`. The production smoke tests in `ci.yml` check `/health` and `/health/ready` but not any deep probe.

**Recommendation:** Either:
- **Option A:** Rename `/health/detailed` to `/health/full` to match the documented contract, and add an alias route.
- **Option B:** Remove `/health/full` from the README table if it is not implemented.

In either case, add `/health/detailed` (or `/health/full`) to the production smoke test loop in `ci.yml`.

---

### 2.3 Self-healing workflow fires `REDIS FLUSHDB` on stale key pattern — risky default

**Severity: Medium**

In `self-healing.yml`, the Redis remediation step runs:

```javascript
const keys = await client.keys('session:stale:*');
if (keys.length > 0) {
  await client.del(...keys);
}
```

The comment says "Only flush volatile session keys, not persistent data", but `client.keys()` is an O(N) blocking Redis call that freezes the instance for the duration of the scan on large keyspaces. On a production Redis with millions of keys this will cause latency spikes at exactly the worst time — during an incident.

**Recommendation:** Replace `client.keys()` with a non-blocking `SCAN`-based cursor loop:

```javascript
let cursor = '0';
do {
  const [nextCursor, found] = await client.scan(cursor, 'MATCH', 'session:stale:*', 'COUNT', 200);
  if (found.length > 0) await client.del(...found);
  cursor = nextCursor;
} while (cursor !== '0');
```

Also add a max-keys-per-run guard to prevent runaway remediation in extreme scenarios.

---

### 2.4 Composite health score threshold inconsistency

**Severity: Low**

The `self-healing.yml` workflow uses `HEALTH_SCORE_THRESHOLD: 50` to decide whether to trigger auto-remediation. `HealthMonitor` also uses `50` as the critical boundary. However, `PRODUCTION_DEPLOYMENT_GUIDE.md §11.1` states the expected health score post-deployment is `95+`. The alert comment in the guide says "< 50 → critical (red) — triggers PagerDuty/Slack alert", which is correct.

The risk is that there is no intermediate warning alert (50–79 = degraded) in the self-healing workflow — only a hard trigger at 50. A system that degrades slowly from 95 to 52 over several hours will not trigger any workflow until it hits the critical threshold.

**Recommendation:** Add a degraded-range Slack alert to `self-healing.yml` at score < 80 (warning) in addition to the critical < 50 remediation trigger. This creates an early-warning channel without automatic remediation noise.

---

## 3. Observability

### 3.1 Four duplicate logger implementations

**Severity: High**

The following five logger files exist, with overlapping functionality:

| File | Features | Issues |
|---|---|---|
| `src/observability/structured-logger.js` | JSON, secret redaction, child loggers, Express middleware | Appears to be the canonical SPEC-5 implementation |
| `src/observability/enterprise-logger.js` | JSON, correlation IDs, child loggers | Duplicate of above; uses different field names (`correlationId` vs `requestId`) |
| `src/services/structured-logger.js` | Minimal JSON | Duplicate of observability version; lives in wrong directory |
| `src/utils/logger.js` | Unknown | Third location |
| `src/ops/mlops-logger.js` | MLOps-specific | May be legitimate specialization |

This means different parts of the platform emit logs with different field names, making them incompatible with a unified log query (e.g., Grafana LogQL searching for `requestId` will miss logs that used `correlationId`).

**Recommendation:**
1. Designate `src/observability/structured-logger.js` (SPEC-5) as the single canonical logger.
2. Delete `src/services/structured-logger.js` and `src/utils/logger.js`. Update all imports.
3. Migrate `src/observability/enterprise-logger.js` to re-export from the canonical file with any field aliases needed, then delete it.
4. Add an ESLint rule banning direct `console.log` / `console.error` outside tests:
   ```json
   "no-console": ["error", { "allow": [] }]
   ```

---

### 3.2 OTel exporter defaults to `localhost` — traces are dropped silently in production

**Severity: High**

`configs/observability/otel-config.yml`:
```yaml
exporters:
  otlp:
    endpoint: ${OTEL_EXPORTER_ENDPOINT:-http://localhost:4318}
```

`.env.example`:
```
OTEL_EXPORTER_ENDPOINT=http://localhost:4318
```

Cloud Run instances have no local OTel collector. Unless `OTEL_EXPORTER_ENDPOINT` is overridden in the Cloud Run service environment, all traces are silently dropped. The `SENTRY_DSN` variable is present in the production secrets config, but the OTel endpoint is not mentioned in the production secrets list in `PRODUCTION_DEPLOYMENT_GUIDE.md §2.3`.

**Recommendations:**
1. Add `OTEL_EXPORTER_ENDPOINT` to the critical secrets table in the deployment guide.
2. Add a preflight check in `scripts/startup.sh` that warns if `OTEL_EXPORTER_ENDPOINT` still points to localhost in a non-development environment:
   ```bash
   if [[ "$NODE_ENV" == "production" && "$OTEL_EXPORTER_ENDPOINT" == *"localhost"* ]]; then
     echo "[WARN] OTEL_EXPORTER_ENDPOINT points to localhost — traces will be dropped"
   fi
   ```
3. Configure a production OTel collector (Google Cloud Trace, Grafana Cloud, or self-managed). Document the choice in an ADR.

---

### 3.3 No Grafana dashboards or alert rule files

**Severity: Medium**

The observability stack has:
- ✅ Prometheus metrics endpoint (`/metrics`) with well-named metrics
- ✅ SLO definitions in `configs/observability/slo-latency.yaml` and `otel-config.yml`
- ✅ Alert rules in `configs/observability/worker-alerts.yaml`
- ❌ No Grafana dashboard JSON files
- ❌ No Prometheus `alert_rules.yml` in Prometheus-compatible format
- ❌ Alert webhook URL in `worker-alerts.yaml` is still a placeholder (`https://hooks.slack.com/services/...`)

**Recommendation:** Create `configs/observability/dashboards/` with at minimum:
- `heady-overview.json` — service health score, error rate, p99 latency by domain
- `heady-llm.json` — token spend per provider, eval scores, hallucination rate
- `heady-vector-memory.json` — drift cosine similarity, vector insert rate, HNSW index size

The SLO targets already in `otel-config.yml` (p99 < 5s, hallucination < 5%, uptime 99.9%) are well-defined; they just need to be wired to actual alert queries.

---

### 3.4 `self-healing.yml` drift check silently skips on module-not-found

**Severity: Medium**

The drift check in `self-healing.yml` has:

```javascript
try {
  DriftDetector = require('./src/monitoring/drift-detector');
} catch (e) {
  console.log('DriftDetector module not yet available — skipping drift check');
  process.exit(0);
}
```

A `require()` failure (wrong path, missing npm package, syntax error in the module) silently marks drift as `ok` and allows the self-healing workflow to pass. This is a false-green.

**Recommendation:** Change the catch block to write `drift-ok=false` to `$GITHUB_OUTPUT` and emit a `::warning::` annotation rather than silently passing:

```javascript
} catch (e) {
  console.error('DriftDetector failed to load:', e.message);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'drift-ok=false\ndrift-score=load_error\n');
  process.exit(0); // Non-fatal but recorded as degraded
}
```

---

### 3.5 Coverage thresholds are not enforced in CI

**Severity: Medium**

The test suite has 57 test files and coverage is uploaded as an artifact in `ci.yml`. However, there is no Jest coverage threshold configuration, meaning CI passes at 0% coverage. `package.json` has no `"jest": { "coverageThreshold": ... }` key.

**Recommendation:** Add minimum coverage thresholds to `package.json`:

```json
"jest": {
  "coverageThreshold": {
    "global": {
      "branches": 60,
      "functions": 65,
      "lines": 65,
      "statements": 65
    },
    "./src/auth/": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./src/monitoring/": {
      "branches": 75,
      "functions": 75,
      "lines": 75,
      "statements": 75
    }
  }
}
```

Authentication and monitoring code should have the highest thresholds given their security and availability criticality.

---

## 4. CI/CD Operations

### 4.1 Package manager conflict between `ci.yml` and `quality-gates.yml`

**Severity: High**

`ci.yml` (main CI) uses `npm` (`npm ci --prefer-offline`).  
`quality-gates.yml` uses `pnpm` (`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`).

The repo has `package-lock.json` (npm) but no `pnpm-lock.yaml`. `quality-gates.yml` will fail on `pnpm install` unless pnpm is installed and a lockfile exists. This means the quality gate workflow — which runs on every PR to `main` — is silently broken.

**Recommendation:** Standardize on `npm` (since the repo uses `package-lock.json`) in all workflows. Update `quality-gates.yml` to use `npm ci` and `npm run lint` / `npm test`. If migration to `pnpm` is planned, add a task to generate `pnpm-lock.yaml` and update all workflow files atomically.

---

### 4.2 Canary promotion in `ci.yml` is immediate — 60-second validation window is too short

**Severity: Medium**

The production deployment step in `ci.yml`:

```bash
gcloud run services update-traffic ... --to-tags canary=10
echo "Canary running at 10% — waiting 60s for metrics..."
sleep 60
```

A 60-second window at 10% traffic is insufficient to surface slow-burn failure modes like memory leaks, cache mismatches, or P99 tail latency regressions. The canary configuration in `configs/canary.yml` actually specifies 10-minute and 30-minute analysis windows at 1% and 5% — these more conservative thresholds are not being enforced by the actual deployment workflow.

**Recommendation:** Extend the canary validation window to at minimum 5 minutes, and implement actual error-rate polling rather than a single count at the end of the sleep:

```bash
for i in $(seq 1 10); do
  sleep 30
  ERROR_COUNT=$(gcloud logging read ... --freshness=30s ... | wc -l)
  if [ "$ERROR_COUNT" -gt "2" ]; then
    echo "FAIL: Error spike detected at step $i. Rolling back."
    gcloud run services update-traffic ... --to-latest
    exit 1
  fi
  echo "Check $i/10 passed"
done
```

Also reconcile `configs/canary.yml` (1% → 5% → 20% → 100%) with the actual deployment workflow (which goes directly to 10% → 100%).

---

### 4.3 Snyk scan is advisory-only (`continue-on-error: true`) — allows known-high-severity deps to deploy

**Severity: Medium**

In `ci.yml`, the Snyk security scan step has `continue-on-error: true`. This means even if Snyk detects a high-severity CVE, the build proceeds. The `npm audit --audit-level=high` step does enforce (`continue-on-error: false`), but Snyk's deeper analysis (transitive vulns, license issues) is bypassed.

**Recommendation:** Change Snyk to `continue-on-error: false` for production-destined builds (i.e., add the condition `if: github.ref == 'refs/heads/main'`). For feature branch PRs, advisory is acceptable. Consider adding a JIRA/GitHub Issues label automation that auto-creates a "security/snyk" issue on any Snyk finding regardless of severity, so nothing gets lost even when it doesn't block.

---

### 4.4 Dead Cloudflare Tunnel `4a9d0759` not yet removed

**Severity: Low**

`DEPRECATIONS.md` explicitly notes Cloudflare Tunnel `4a9d0759` as scheduled for removal ("Dead tunnel, all DNS moved to Pages"). A dead tunnel represents an orphaned credential that could be used if leaked and isn't rotated when the active tunnel credential is rotated.

**Recommendation:** Add removal of this tunnel to the next sprint's definition of done. Verify in the CF dashboard that no DNS record still points to it, then delete it:

```bash
cloudflared tunnel delete 4a9d0759
```

---

## 5. Incident Response

### 5.1 `IncidentManager` is entirely in-memory — incidents lost on restart

**Severity: High**

`src/observability/incident-manager.js` stores incidents in `this.incidents = []` with a 500-item ring buffer. Every Cloud Run instance restart (which happens on every deploy, every auto-remediation trigger, and every scaling event) wipes the incident history. This means:
- Post-incident queries for "when did this start?" cannot be answered from the incident log.
- The postmortem generator (`generatePostmortem()`) can only reference incidents from the current process lifetime.

**Recommendation:** Persist incidents to the existing PostgreSQL `audit_log` table (which is already GDPR Art. 30 compliant per `CHANGELOG.md`). Alternatively, add a `heady_incidents` table with `id`, `severity`, `title`, `status`, `source`, `detected_at`, `resolved_at`, `actions JSONB`, `details JSONB`. Wire `IncidentManager.create()` to do a non-blocking async insert:

```javascript
async _persistIncident(inc) {
  if (!this.db) return; // graceful if DB unavailable
  await this.db.query(
    `INSERT INTO heady_incidents (id, severity, title, status, source, detected_at, details, actions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [inc.id, inc.severity, inc.title, inc.status, inc.source, inc.detectedAt,
     JSON.stringify(inc.details), JSON.stringify(inc.actions)]
  );
}
```

---

### 5.2 No on-call runbook index or escalation policy

**Severity: High**

The `auto-remediation-runbook.yaml` in `configs/resources/` covers edge latency, swarm saturation, and projection queue backup. However:
- There is no document listing what PagerDuty routing key maps to which team.
- There is no "who to call when X fails" document.
- The runbook does not cover the most likely production failures: database connection pool exhaustion, Redis OOM, LLM provider outage, or full Cloud Run revision rollback.

**Recommendation:** Create `docs/ONCALL_GUIDE.md` containing:

```markdown
## On-Call Rotation
- Primary: eric@headyconnection.org
- Escalation: [define]
- PagerDuty Service Key: heady-production (routing key in GCP Secret Manager)

## Incident Severity Matrix
| Severity | Example | SLA | Response |
|---|---|---|---|
| P0 — System down | /health returns 503 across all domains | 15 min | Immediate rollback + PagerDuty |
| P1 — Degraded | Health score 50–79 for > 30 min | 1 hr | Investigate + Slack alert |
| P2 — Warning | Drift > 0.15, TLS cert < 14 days | 4 hr | Schedule fix |
| P3 — Informational | Coverage drop, slow query | 24 hr | Next sprint |

## Key Runbooks
- [Cloud Run rollback](link)
- [Redis recovery](link)
- [Vector drift recalibration](link)
- [LLM provider failover](link)
```

---

### 5.3 Alert webhook placeholder in `worker-alerts.yaml`

**Severity: Medium**

```yaml
slack:
  "#alerts":
    webhook: "https://hooks.slack.com/services/..."
```

This is a template placeholder. If the system ever fires a worker alert in production, the notification will silently fail (HTTP 404 to a non-existent Slack webhook URL).

**Recommendation:** Move the Slack webhook URL to the GCP Secret Manager (already set up for `SLACK_WEBHOOK_URL`). Reference it at runtime rather than hardcoding in a config file. Add a preflight check that validates the webhook URL is reachable on startup (a simple HTTP GET to `https://hooks.slack.com/` with a 2-second timeout is sufficient).

---

## 6. Security Operations

### 6.1 mTLS TLS keys committed to repository

**Severity: High**

`configs/nginx/ssl/` contains committed TLS private keys:
```
configs/nginx/ssl/ca.key
configs/nginx/ssl/client.key
configs/nginx/ssl/server.key
```

Even if these are development/test certs (which `SECURITY.md` may clarify), private key material in a git repository creates two risks: (1) any contributor with repo access has them, and (2) they will exist in git history indefinitely even after removal.

**Recommendation:**
1. Immediately rotate these keys (treat them as compromised).
2. Remove from git history: `git filter-repo --path configs/nginx/ssl/ca.key --invert-paths` (and equivalent for the other key files). Push with `--force`.
3. Add `configs/nginx/ssl/*.key` and `configs/nginx/ssl/*.pem` to `.gitignore`.
4. Store production mTLS keys in GCP Secret Manager. Provide a `scripts/generate-dev-certs.sh` for local development.
5. Add a Gitleaks pattern for PEM-encoded private keys (Gitleaks covers this by default, but verify the `.github/codeql/codeql-config.yml` referenced in `ci.yml` exists — it is not visible in the file tree).

---

### 6.2 `_archive/` directory contains 1,022 files — scheduled for removal since DEPRECATIONS.md

**Severity: Low**

`DEPRECATIONS.md` targets `_archive/` for migration to a separate `heady-archive` repo. Until that happens, the directory inflates clone times, muddies `grep` and `find` results, and may contain outdated configurations that confuse on-call engineers consulting the repo during an incident.

**Recommendation:** Create a time-boxed task: archive the `_archive/` directory to a `heady-archive` private GitHub repo, then delete it from this repo. Set a hard date (suggested: end of March 2026 per the planned cutover in `DEPRECATIONS.md`).

---

## 7. Quick-Win Checklist

The following items can be completed in a single sprint (1–3 days each) and have immediate impact:

| Priority | Item | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Resolve merge conflicts in `Heady/README.md` | 30 min | Unblocks contributors |
| 🔴 P0 | Fix `quality-gates.yml` pnpm → npm | 30 min | Unblocks PR checks |
| 🔴 P0 | Remove or rotate mTLS private keys from `configs/nginx/ssl/` | 2 hr | Security critical |
| 🔴 P0 | Add `OTEL_EXPORTER_ENDPOINT` to production secrets checklist and preflight | 1 hr | Restores trace visibility |
| 🟠 P1 | Consolidate 4 logger files → 1 canonical logger | 4 hr | Unified log queries |
| 🟠 P1 | Fix Redis remediation `client.keys()` → SCAN cursor | 1 hr | Prevents incident-time Redis freeze |
| 🟠 P1 | Add drift-check false-green fix (module load failure → drift-ok=false) | 30 min | Eliminates silent health blind spot |
| 🟠 P1 | Extend canary validation window from 60s to 5 min with polling | 1 hr | Catches slow-burn regressions |
| 🟡 P2 | Persist `IncidentManager` to PostgreSQL | 1 day | Enables post-incident forensics |
| 🟡 P2 | Create `docs/ONCALL_GUIDE.md` | 2 hr | Reduces MTTR |
| 🟡 P2 | Add Jest coverage thresholds to `package.json` | 30 min | Prevents coverage regression |
| 🟡 P2 | Create `docs/decisions/` ADR directory with 4 seed ADRs | 1 day | Reduces contributor ramp-up time |
| 🟢 P3 | Delete dead Cloudflare Tunnel `4a9d0759` | 15 min | Credential hygiene |
| 🟢 P3 | Schedule `_archive/` migration to `heady-archive` repo | 2 hr | Reduces repo noise |
| 🟢 P3 | Add Grafana dashboard JSON files to `configs/observability/dashboards/` | 1 day | Closes observability loop |

---

## 8. Observability Stack — Recommended Target Architecture

The existing components are strong. The gaps are wiring and persistence. The recommended target state:

```
Cloud Run (heady-production)
  │
  ├── HealthMonitor (single authoritative)
  │     ├── /health/live        → K8s liveness
  │     ├── /health/ready       → K8s readiness
  │     └── /health/detailed    → Full composite (renamed from /health/full per docs)
  │
  ├── StructuredLogger (single canonical, src/observability/structured-logger.js)
  │     └── JSON to stdout → Cloud Run Logging → Cloud Logging
  │
  ├── OTel SDK (src/lib/telemetry.js)
  │     └── OTLP → Cloud Trace or Grafana Cloud
  │
  ├── Prometheus /metrics endpoint
  │     └── Scraped by Cloud Monitoring or self-managed Prometheus
  │           └── Grafana dashboards (to be created)
  │
  ├── DriftDetector (src/monitoring/drift-detector.js)
  │     └── Results → PostgreSQL drift_history → Grafana alert
  │
  └── IncidentManager (src/observability/incident-manager.js)
        └── Events → PostgreSQL heady_incidents (to be created)

GitHub Actions (self-healing.yml, every 15 min)
  ├── /health/detailed check → all 9 domains
  ├── DriftDetector.runFullCheck() → drift-history
  ├── TLS expiry check → 14-day warning
  └── Cloud Run 5xx spike check → auto-remediate or alert
```

---

*End of memo. Contact eric@headyconnection.org for follow-up.*
