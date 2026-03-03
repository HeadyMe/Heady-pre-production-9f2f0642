# HeadyBuddy Service Expansion and Integration Research Report

## Information Needs and Research Method

**What must be learned:**

- (a) Runtime services in each allowed repo (apps, servers, workers, CLIs)
- (b) Entrypoints and exposed interfaces (HTTP routes, WebSockets, queues, SDK/tool protocols)
- (c) Data models (databases, migrations, queues, storage)
- (d) Feature flags and config surfaces (env vars, config files, build-time flags)
- (e) Delivery pipelines (CI workflows, Docker, deploy scripts)
- (f) Known gaps/TODOs (issues/PRs, TODO comments, failing tests, "not implemented" code paths)

**Constraint:** GitHub API connector not available in session. Repos are private/not indexed. Solution: local static analysis procedure with existing GitHub access.

**External references used:** MCP transport & authorization (MCP spec), JSON-RPC 2.0 spec, OpenTelemetry Collector config, Prometheus client instrumentation, BullMQ retry/backoff, Docker Compose, OpenAPI 3.1.1 spec, Playwright docs, OAuth2 Bearer Token security.

---

## Local Static Analysis Procedure

### Allowed Repos

```
HeadyMe/Heady-pre-production-9f2f0642
HeadyMe/HeadyConnection
HeadyMe/Heady-1
HeadySystems/HeadyMe
HeadySystems/HeadyMonorepo
HeadySystems/main
HeadySystems/Projects
HeadySystems/sandbox
HeadySystems/sandbox-pre-production
```

### Service Enumeration Rules of Evidence

A "service" requires at least one of:

1. `docker-compose.yml` service stanzas
2. Deployable artifact: `Dockerfile`, `Procfile`, `helm/`, `k8s/`, `terraform/`, `server.ts`, `index.ts`, `main.py`
3. Package boundary: `apps/*`, `packages/*`, `services/*`, `backend/*`, `workers/*`
4. CI workflow jobs that build/test/publish a discrete component
5. Well-defined interface surface: OpenAPI spec, route tables, WebSocket events, queue names, RPC protocols, MCP servers/tools

### Automated Inventory Extraction

- Docker Compose services → `yq` parse
- Node/TS workspaces → `package.json` workspace enumeration
- Feature flags/config → `rg` for `process.env.`, `FEATURE_`, `ENABLE_`, `FLAG_`, `TODO`, `FIXME`
- API surface → `rg` for route registrations (Express, Fastify, Nest)
- Issues/PR/TODO mining → `rg` for `TODO|FIXME|HACK|XXX`

---

## Gap Identification and Scoring Rubric

**Priority Index:**

```
PriorityIndex = (0.35 * BusinessValue + 0.35 * UserImpact) - (0.20 * Effort + 0.10 * SecurityRisk)
```

### High-Value Service Archetypes

A tool & agent ecosystem approaches extreme versatility with:

1. **Task substrate** — durable tasks, retries, progress, auditability
2. **Toolplane** — standard tool protocol, dynamic registry, capability gating
3. **Automation executors** — browser automation, OS automation, connectors
4. **Observability & self-healing** — metrics, traces, circuit breakers, safe rollback
5. **Governance** — authN/Z, secrets handling, data retention, redaction

---

## Five Integration Plans

### Plan 1: Durable Task Substrate

- **API:** `POST /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/cancel`, `WS /api/tasks/stream`
- **Data model:** `tasks` table — `id`, `type`, `payload`, `status`, `attempts`, `maxAttempts`, `progress`, `result`, `error`, timestamps, `metadata`, `parentId`
- **Queue:** Redis + BullMQ, `UnrecoverableError` for stop-retry
- **Metrics:** task latency histogram, queue depth gauge, failures counter by type
- **Rollback:** Feature-flag routing; legacy synchronous fallback

### Plan 2: MCP Toolplane

- **API:** `GET /api/tools`, `POST /api/tools/:toolName/call`, start/stop tool servers
- **Protocol:** MCP stdio = newline-delimited UTF-8 JSON-RPC; HTTP transport uses standard auth
- **Security:** Deny-by-default, allowlist high-risk tools, correlate all calls with `requestId` + `taskId`
- **Rollback:** Graceful degradation to core tools only

### Plan 3: Browser Automation Executor

- **API:** `POST /api/automation/screenshot`, `POST /api/automation/run`, `GET /api/artifacts/:id`
- **Engine:** Playwright — full-page screenshots, trace-on-failure
- **Storage:** Object storage with TTL, linked to task IDs
- **Safety:** Domain allowlist, user confirmation for logins, rate limiting

### Plan 4: Observability & Self-Healing Baseline

- **Collector:** OTel receiver→processor→exporter pipeline
- **Self-healing:** Circuit breaking, exponential backoff, concurrency reduction, offline-first mobile mode
- **Required metrics:** `http_request_duration_seconds`, `task_queue_depth`, `task_failures_total`, `tool_calls_total`, `tool_call_duration_seconds`
- **Deploy:** Blue/green or canary for high-risk subsystems

### Plan 5: API Contracts & Governance

- **Standard:** OpenAPI 3.1.1 — every service exposes `/openapi.json` + `/health`
- **Bearer token rules:** TLS mandatory, no tokens in URLs, short-lived + scoped
- **Data governance:** Annotate endpoints with PII/secrets/internal-only tags; define retention SLAs
- **Default posture:** Treat all data as PII, all access as auditable, all actions as least-privilege

---

## Integration Approach Decision Table

| Approach | Pros | Cons | When |
|----------|------|------|------|
| Sidecar microservices behind gateway | Strong isolation, easy rollback | More deployables, networking/auth work | **Default for reliability** |
| Monorepo library embedding | Fewer deployables | Higher coupling, harder rollback | Only if ops constraints demand single process |
| Hybrid | Balanced | Requires careful boundaries | Good long-term posture |

---

## Security & Operational Doctrine

### Buddy's Safety-First Control Loop

1. User intent → Risk classify (low/med/high)
2. High risk? → Require confirmation + least-privilege tools
3. Plan tasks + tool calls → Execute via Task Substrate
4. Observe metrics/traces + progress stream
5. Failure? → Auto-mitigate (backoff/circuit-break/degrade)
6. Recovered? → Deliver result. Not recovered? → Stop safely + ask for guidance

### Must-Have Security Controls

- Bearer tokens: TLS, no URL transmission, short-lived + scoped
- Toolplane authZ: deny-by-default, allowlist high-risk tools
- Abuse prevention: rate limit high-cost endpoints
- Auditing: every task/tool call logged with correlation ID, never log secrets

### Data Governance Rules

- **Minimize:** smallest payloads, prefer references to encrypted blobs
- **Retain intentionally:** set TTLs for artifacts
- **Redact:** mask tokens/PII in logs and traces
- **Separate:** production vs staging secrets/data must not mix
- **Default compliance posture:** data contains PII, access is least privilege, actions are auditable
