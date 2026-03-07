# Heady™ Master Architecture Improvement Plan
## Ecosystem-Wide Technical Roadmap — v3.2.0 Target

> **Maintainer:** eric@headyconnection.org  
> **Created:** 2026-03-07  
> **Source Analyzed:** HeadyMe/Heady-pre-production-9f2f0642 (v3.1.0)  
> **Status:** Active — Pre-Production → Production Bridge

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Gaps](#2-architecture-gaps)
3. [Missing Integrations](#3-missing-integrations)
4. [Technical Debt](#4-technical-debt)
5. [Naming Inconsistencies](#5-naming-inconsistencies)
6. [Cross-Repo Coordination Issues](#6-cross-repo-coordination-issues)
7. [Optimization Opportunities](#7-optimization-opportunities)
8. [New Capabilities to Add](#8-new-capabilities-to-add)
9. [Security Improvements](#9-security-improvements)
10. [Observability Gaps](#10-observability-gaps)
11. [Infrastructure Improvements](#11-infrastructure-improvements)
12. [Core Repo Buildout Plan](#12-core-repo-buildout-plan)
13. [Prioritized Roadmap](#13-prioritized-roadmap)
14. [File-Level Change Map](#14-file-level-change-map)

---

## 1. Executive Summary

The Heady ecosystem has reached an impressive architectural maturity with v3.1.0 — implementing sacred geometry orchestration, 3D vector memory, self-awareness telemetry, the 5-phase deterministic error interceptor, and a 9-stage HCFullPipeline. However, the codebase exhibits several critical gaps that must be addressed before the ecosystem can scale from a unified monorepo to a true multi-repo distributed platform.

**Critical findings:**

| Category | Count | Severity |
|---|---|---|
| Architecture gaps | 12 | Mixed (3 Critical) |
| Missing integrations | 9 | High |
| Technical debt items | 14 | Mixed |
| Naming inconsistencies | 7 | Medium |
| New capability opportunities | 11 | High value |
| Security improvements | 8 | High |

**Top 3 Critical Issues:**
1. **No centralized event bus** — Services communicate via fragile `global.eventBus` references and `process.on()` hooks. Cross-repo communication is undefined.
2. **Core repos are empty shells** — All 9 `*-core` packages have only `express@^4.21.0` as a dependency and `echo "Tests coming soon"` as test scripts. The "battle" split has not produced functional services.
3. **Vector memory has no pgvector pathway from `VectorMemory` class** — `vector-memory.js` (line 14-245) implements a pure in-memory store with JSON-lines persistence, but `PRODUCTION_DEPLOYMENT_GUIDE.md` (line 240) describes a pgvector backend. These are disconnected — the VectorMemory class has no database adapter.

---

## 2. Architecture Gaps

### 2.1 No Centralized Event Bus (CRITICAL)

**Files affected:** `heady-conductor.js`, `self-awareness.js`, `buddy-core.js`, `hc-full-pipeline.js`

**Problem:** Events propagate via three incompatible mechanisms:
- `global.eventBus` (set in `src/bootstrap/config-globals.js` — referenced but not present in scan)
- `process.on('heady:circuit', ...)` — `self-awareness.js:312`
- `new EventEmitter()` local instances — `heady-conductor.js:22`, `hc-full-pipeline.js:16`, `buddy-core.js:25`

When the system splits into multiple repos/services, these mechanisms break entirely. There is no pub/sub layer connecting `headymcp-core`, `headybuddy-core`, `headyapi-core`, etc.

**Fix:** Implement `heady-event-bus.js` (provided in this deliverable) as the single cross-service event backbone. Wire all three mechanisms to it.

**Specific code locations:**
- `heady-conductor.js:22` — Replace `const EventEmitter = require('events')` with HeadyEventBus
- `buddy-core.js:340-341` — `global.eventBus.emit('bee:alerts', ...)` uses global as bus
- `self-awareness.js:312` — `process.on('heady:circuit', ...)` — process-local, breaks in multi-process
- `hc-full-pipeline.js:71-114` — `_wireAutoTelemetry()` wires to selfAwareness via callback, not events

### 2.2 VectorMemory Class Disconnected from pgvector Backend

**Files affected:** `vector-memory.js:1-245`, `PRODUCTION_DEPLOYMENT_GUIDE.md:240`

**Problem:** The production deployment guide describes a `memory_vectors` table with `vector(384)` columns and HNSW indexing in PostgreSQL. The `VectorMemory` class (`vector-memory.js`) implements only in-memory storage with JSON-lines file persistence. There is no `PgVectorAdapter` or database backend implementation in the scanned files.

**Specific gap:**
- `vector-memory.js:31` — `this._store = new Map()` — pure in-memory
- `vector-memory.js:187-242` — `persist()` writes JSON-lines, `load()` reads JSON-lines
- Missing: `PgVectorAdapter` class, `queryMemory()` method referenced throughout but not in VectorMemory class
- `buddy-core.js:632` — `vectorMem.queryMemory(input.query, ...)` — called on VectorMemory but no such method exists in `vector-memory.js`

**Fix:** Add a `PgVectorAdapter` wrapper and a `queryMemory()` / `ingestMemory()` API layer that routes to either in-memory (dev) or pgvector (production).

### 2.3 No Service-to-Service Authentication

**Files affected:** `worker-api-gateway.js`, `worker-auth-service.js`, `heady-manager.js`

**Problem:** Internal service-to-service calls have no standardized auth mechanism. The `INTERNAL_API_KEY` environment variable is mentioned in the production guide, but no middleware enforces it uniformly. When `headymcp-core` calls `headysystems-core`, there is no JWT/mTLS mechanism.

**Fix:** Add HMAC-signed request headers with a rotating key, verified by `heady-service-mesh.js` (provided).

### 2.4 No Configuration Management Server

**Files affected:** All services use `process.env.*` directly

**Problem:** Every service reads environment variables independently with no runtime configuration update capability. Changing a threshold (e.g., `DRIFT_THRESHOLD` in `vector-memory.js:20`) requires a full redeployment.

**Notable hardcoded values:**
- `vector-memory.js:20` — `const DRIFT_THRESHOLD = 0.75` — hardcoded, not configurable
- `heady-conductor.js:26` — `const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 5000)` — hardcoded
- `self-awareness.js:117` — `const TELEMETRY_RING_SIZE = 500` — hardcoded
- `buddy-core.js:67` — `this.MAX_LOG = 200` — hardcoded
- `ternary-logic.js:37-41` — All thresholds hardcoded with no env fallback

**Fix:** Implement `heady-config-server.js` (provided) with watch endpoints so running services can receive config updates without restart.

### 2.5 EdgeDiffusion is a Stub

**File:** `edge-diffusion.js:17-28`

**Problem:** The entire image generation capability is stubbed:
```javascript
// edge-diffusion.js:17-28
async generateImage(prompt, config = { width: 1024, height: 1024, steps: 30 }) {
    // Simulated fast-path generation call to clustered edge GPUs
    return {
        success: true,
        url: `https://cdn.headysystems.com/generated/${Date.now()}.png`,  // FAKE URL
        latency_ms: 850,
        model: 'heady-diffusion-v2'
    };
}
```

The `EDGE_DIFFUSION_API` endpoint (`https://api.headysystems.com/v1/edge/generate`) has no implementation. This entire capability is advertised but non-functional.

**Fix:** Wire to HuggingFace Inference API, Replicate, or Stable Diffusion API as the actual backend.

### 2.6 Conductor Routing is O(n) Linear Scan

**File:** `heady-conductor.js:82-98`

**Problem:** Task routing iterates the entire bee registry sequentially:
```javascript
// heady-conductor.js:82-98
for (const [id, entry] of this.bees) {
    const bee = entry.bee;
    if (bee.category === taskType || bee.domain === taskType) {
        targetBee = id;
        break;
    }
}
```

With 197 workers (per README), this is O(197) per dispatch. Should be an indexed map: `Map<taskType, beeId[]>`.

**Fix:** Add a `_categoryIndex = new Map()` that's updated on `registerBee()`. Dispatch becomes O(1) lookup.

### 2.7 Execution Log Bug in Conductor

**File:** `heady-conductor.js:136`

**Problem:** Critical bug — `durationMs` is always 0 because the execution is deleted from `activeExecutions` before reading `startTime`:
```javascript
// heady-conductor.js:129-138
this.activeExecutions.delete(executionId);  // LINE 129: Deleted here

const execution = {
    executionId,
    beeId: targetBee,
    taskType,
    result,
    durationMs: Date.now() - this.activeExecutions.get(executionId)?.startTime || 0,  // LINE 136: Already deleted!
    completedAt: Date.now(),
};
```

**Fix:** Capture `startTime` before deletion:
```javascript
const startTime = this.activeExecutions.get(executionId)?.startTime;
this.activeExecutions.delete(executionId);
const durationMs = startTime ? Date.now() - startTime : 0;
```

### 2.8 HCFullPipeline: Runs Map Never Pruned

**File:** `hc-full-pipeline.js:48`

**Problem:** `this.runs = new Map()` — completed runs are stored forever. With high throughput, this will cause unbounded memory growth. 

**Fix:** Add `maxRuns` config (default 1000), implement LRU eviction:
```javascript
// After run.status = STATUS.COMPLETED / FAILED:
if (this.runs.size > this.maxRuns) {
    const oldestKey = this.runs.keys().next().value;
    this.runs.delete(oldestKey);
}
```

### 2.9 TernaryLogic Shadow Index: JSON.stringify Comparison

**File:** `ternary-logic.js:127-134`

**Problem:** Shadow index duplicate detection uses full JSON serialization for comparison:
```javascript
// ternary-logic.js:127-134
const shadowMatch = this._shadowIndex.find(s =>
    s.signal && s.signal.type === signal.type &&
    JSON.stringify(s.signal.data).slice(0, 100) === JSON.stringify(signal.data).slice(0, 100)
);
```

This is O(n) linear scan with expensive JSON serialization on every classify() call. The shadow index can grow to `maxShadowSize = 500` entries.

**Fix:** Maintain a `Set<string>` of hashed signal fingerprints alongside the array.

### 2.10 No WebSocket Reconnection Logic

**Files:** `heady-manager.js:59`, `event-stream.js`

**Problem:** Voice relay WebSocket sessions (`voiceSessions`) have no reconnection strategy. If Cloud Run scales in (cold container), all live WebSocket sessions are dropped with no client-side recovery mechanism.

### 2.11 Arena Stage Uses Random Float Scores — Not Actual LLM Competition

**File:** `hc-full-pipeline.js:376-384`

**Problem:** The ARENA stage generates fake scores using a seeded PRNG:
```javascript
// hc-full-pipeline.js:376-384
const outputs = nodes.map(node => ({
    node,
    output: `[${node} output for: ${run.request.task || ...}]`,  // STRING PLACEHOLDER
    score: rng() * 40 + 60,  // RANDOM SCORE
    latencyMs: Math.floor(rng() * 3000) + 500,  // FAKE LATENCY
}));
```

The arena produces deterministic but fake competition results. No actual LLM calls are made. The README advertises "Multi-node competition" but this is simulated.

### 2.12 Self-Awareness Module Missing `vectorMemory` Reference

**File:** `self-awareness.js:33-34`

**Problem:**
```javascript
// self-awareness.js:33-34
let vectorMemory = null;
try { vectorMemory = require('./vector-memory'); } catch { /* loaded later */ }
```

This imports the module directly, not an instance. `vector-memory.js` exports `{ VectorMemory, DRIFT_THRESHOLD }` — a class, not an instance. Line 173-179 calls `vectorMemory.ingestMemory(...)` which will fail because `VectorMemory` class has no `ingestMemory()` method (it has `store()`). The actual `ingestMemory()` method is referenced in `buddy-core.js:341` and elsewhere but appears to be on a different implementation (`src/vector-memory.js` vs root `vector-memory.js`).

---

## 3. Missing Integrations

### 3.1 No Webhook System

The 9 core repos all need a webhook delivery system for cross-service notifications. Currently there is no webhook dispatcher, delivery queue, retry logic, or signature verification. The `headyio.com` domain is designated for I/O integrations but has no implementation.

**Needed:** `heady-webhook-dispatcher.js` with:
- Delivery queue (use existing pub/sub topics: `heady-swarm-tasks`)
- HMAC-SHA256 request signatures
- Exponential backoff retries (use existing `exponential-backoff.js`)
- Delivery receipts to `projection-governance.js`

### 3.2 No Streaming SSE from Pipeline to UI

**File:** `hc-full-pipeline.js` — emits events but no SSE bridge exists

The pipeline emits stage events via EventEmitter, but there's no Server-Sent Events bridge to push these to browser clients. The `heady-manager.js` bootstraps inline-routes, but pipeline progress streaming requires an explicit SSE handler.

**Fix:** Add `/api/pipeline/stream/:runId` SSE endpoint that subscribes to HCFullPipeline events for a specific run.

### 3.3 headyai.com Has No Inference Implementation

**From PRODUCTION_DEPLOYMENT_GUIDE.md line 760:**
> `headyai.com` — AI model gateway + inference proxy — `/inference/*`, `/embeddings`, `/completions`

The inference gateway routes exist in the domain routing table but `inference-gateway.js` in the scan is not wired to `headyai.com` responses. The LLM router (`src/services/llm-router.js`) handles model selection but doesn't expose a public completions API.

### 3.4 No Cross-Core Authentication Federation

Each `*-core` repo has only `express@^4.21.0` as a dependency. When a user authenticates at `headyme.com`, that session is not automatically valid at `headymcp.com`, `headybuddy.org`, etc. There is no SSO bridge, federated JWT, or cross-domain session sharing.

**Fix:** 
- Issue JWTs with `aud` claim covering all 9 domains
- Implement cross-domain session tokens via `headyapi.com` as the auth authority
- Add OIDC discovery endpoint at `headyapi.com/.well-known/openid-configuration`

### 3.5 No Pub/Sub Consumer Implementation

**From `heady-registry.json:195-198`:**
```json
"pubsub": {
    "backgroundTopic": "heady-swarm-tasks",
    "priorityTopic": "heady-admin-triggers",
    "deadLetterTopic": "heady-dead-letter"
}
```

Three GCP Pub/Sub topics are declared but no consumer code exists in the scanned files. The topics are referenced in `heady-registry.json` but no `src/services/pubsub-consumer.js` or equivalent is present.

### 3.6 No MCP Client Implementation for External LLMs

**File:** `buddy-core.js:569-696` — MCPToolRegistry handles server-side tool exposure, but there is no MCP Client that connects to external MCP servers (e.g., Claude's MCP endpoint, or other MCP-compatible services).

The `@modelcontextprotocol/sdk` package is in `package.json:96` but only the server side is implemented.

### 3.7 No Rate Limiting Between Internal Services

The Cloudflare Worker rate-limits external requests, but there's no internal rate limiter between services. If `headybuddy-core` calls the LLM router 1000 times/second, there's nothing to prevent it from exhausting the budget.

**Fix:** Implement token-bucket rate limiting in `heady-service-mesh.js` (provided) per service pair.

### 3.8 No Distributed Tracing Propagation

**File:** `heady-registry.json:124-128` — declares `opentelemetry-tracing` as "active" but no trace context (`traceparent` headers) is propagated between services in any scanned file.

### 3.9 No Terraform for Core Repos

`heady-registry.json:191` — `"terraform": "infra/main.tf"` — exists for the monorepo, but the 9 core repos have no infrastructure-as-code for their own deployments. Each will need its own Cloud Run service, IAM permissions, and secret bindings.

---

## 4. Technical Debt

### 4.1 `heady-manager.js` Bootstrap Has 10 Phases But No Error Isolation

**File:** `heady-manager.js:19-62`

The 10-phase bootstrap (`validateEnvironment → config-globals → middleware → auth → vector-stack → engine-wiring → pipeline-wiring → service-registry → inline-routes → voice-relay → server-boot`) has no per-phase error isolation. If Phase 4 (vector-stack) fails, phases 5-10 still attempt to execute with undefined dependencies.

**Fix:** Wrap each `require()` call in a try/catch with a degraded-mode flag.

### 4.2 `bee-factory.js` Loads `registry.js` Via Try/Catch Silence

**File:** `bee-factory.js:94-97` and `bee-factory.js:135-139`

```javascript
// bee-factory.js:94-97
try {
    const registry = require('./registry');
    registry.registry.set(domain, entry);
} catch { /* registry not loaded yet */ }
```

Silent failures here mean dynamic bees may silently fail to register in the main registry. The comment "registry not loaded yet" implies a race condition during bootstrap.

### 4.3 Audit Log Uses Synchronous `fs.appendFileSync`

**File:** `buddy-core.js:1069`

```javascript
// buddy-core.js:1069
fs.appendFileSync(BUDDY_AUDIT_PATH, entry + '\n');
```

`appendFileSync` blocks the event loop for every decision. With `decisionCount` potentially in the thousands per minute, this is a significant performance bottleneck.

**Fix:** Buffer audit entries and flush asynchronously with a drain interval.

### 4.4 `DeterministicErrorInterceptor` Learned Rules Stored as Array

**File:** `buddy-core.js:328-335`

```javascript
// buddy-core.js:327-335
const existing = this.learnedRules.find(r => r.errorKey === rule.errorKey);
```

`Array.find()` on `learnedRules` (max 500 entries) — O(n) lookup on every interception. Should be `Map<errorKey, rule>`.

### 4.5 Self-Awareness Ring Buffer Filter is O(n) on Every Event

**File:** `self-awareness.js:165-170`

```javascript
// self-awareness.js:165-170
const events1m = _telemetryRing.filter(e => now - e.ts < 60000);
const events5m = _telemetryRing.filter(e => now - e.ts < 300000);
const errors1m = events1m.filter(e => e.severity === 'error'...);
const errors5m = events5m.filter(e => e.severity === 'error'...);
```

Four O(n) filter passes on every `ingestTelemetry()` call. With 500-entry ring buffer and high event rate, this is expensive.

**Fix:** Maintain rolling counters updated on push/pop rather than recalculating.

### 4.6 `BeeFactory._persistBee` Writes to BEES_DIR (Same Directory)

**File:** `bee-factory.js:35` and `bee-factory.js:487`

```javascript
// bee-factory.js:35
const BEES_DIR = __dirname;  // Same directory as bee-factory.js
```

Persisted bee files are written to the same directory as the source code. This pollutes the repo with auto-generated files that will be committed accidentally.

**Fix:** Use a dedicated `data/dynamic-bees/` directory and add it to `.gitignore`.

### 4.7 Monte Carlo in Pipeline Uses 1000 Iterations Synchronously

**File:** `hc-full-pipeline.js:365`

```javascript
// hc-full-pipeline.js:365
return this.monteCarlo.runFullCycle(scenario, 1000); // 1K for speed in pipeline
```

If `monteCarlo.runFullCycle()` is CPU-intensive (1000 Monte Carlo simulations), this blocks the event loop. Should be offloaded to a worker thread or made async.

### 4.8 `ternary-logic.js` Has Unref'd `setInterval` But No Exported Destroy

**File:** `ternary-logic.js:45-46`

```javascript
// ternary-logic.js:45-46
this._decayTimer = setInterval(() => this._decayShadowIndex(), this._thresholds.decayInterval);
if (this._decayTimer.unref) this._decayTimer.unref();
```

`destroy()` is exported at line 307, but it's not called anywhere in the scanned files. Timers accumulate if multiple `TernaryDecisionMatrix` instances are created.

### 4.9 `edge-diffusion.js` is a Singleton Export

**File:** `edge-diffusion.js:30`

```javascript
// edge-diffusion.js:30
module.exports = new EdgeDiffusion();
```

Singletons prevent testing and make dependency injection impossible. All other major components correctly export the class.

### 4.10 Package.json Missing Critical Production Dependencies

**File:** `package.json:95-99`

```json
"dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "@octokit/auth-app": "^8.2.0",
    "@octokit/rest": "^21.0.0"
}
```

Three dependencies for a system with PostgreSQL, Redis, pgvector, OpenTelemetry, JWT, bcrypt, WebSocket, Express, and 40+ service files. The `headyCore.replacedPackages` list (lines 144-174) shows 25 packages that are "replaced" by internal modules — but these internal modules don't exist as npm packages yet (they're planned as `heady-fetch`, `heady-env`, etc.). This means the codebase depends on modules that aren't installable.

### 4.11 Version Inconsistency: heady-registry.json vs package.json

**Files:** `heady-registry.json:4` (`"version": "3.0.1"`) vs `package.json:4` (`"version": "3.1.0"`)

The registry is one minor version behind the package.json.

### 4.12 `domains.json` Not Included in Scan But Referenced

Multiple files reference domain configurations from `domains.json` (present in directory listing), but the deployment guide mentions 9 domains while `heady-registry.json:151-155` only lists 3 Cloudflare zones.

### 4.13 Test Suite Uses `fuser` to Kill Port

**File:** `package.json:38`

```json
"test": "fuser -k 3300/tcp 2>/dev/null; jest"
```

`fuser` is Linux-specific and will fail on macOS/Windows. CI should use a proper port cleanup or random port assignment.

### 4.14 No Graceful Degradation When Redis is Unavailable

**File:** `buddy-core.js:441-512` — `TaskLockManager` has an in-memory fallback, but other Redis-dependent features (session storage, rate limiting, ephemeral ternary cache) have no degradation path documented.

---

## 5. Naming Inconsistencies

### 5.1 Company Name: "HeadySystems Inc." vs "Heady Systems LLC" vs "HeadyConnection Inc."

| File | Entity Name |
|---|---|
| `package.json:7` | `"HeadyMe"` (author.name) |
| `README.md:133` | `© 2026 Heady™ — HeadySystems Inc.` |
| `README.md:135` | `Heady™ is a trademark of HeadyConnection Inc.` |
| `headysystems-core-package.json` | `Heady Systems LLC` |
| `headyapi-core-package.json` | `Heady Systems LLC` |
| `alive-software-architecture.md:3` | `HeadySystems Inc.` |

**Resolution:** Standardize on **HeadySystems Inc.** for legal entity, **Heady™** for brand, per USPTO registration (Serial No. 99680540).

### 5.2 Author Email: headysystems.com vs headyconnection.org

| File | Email |
|---|---|
| `package.json:9` | `eric@headyconnection.org` |
| `headyapi-core-package.json` | `eric@headysystems.com` |
| `headybuddy-core-package.json` | `eric@headysystems.com` |
| `PRODUCTION_DEPLOYMENT_GUIDE.md:4` | `eric@headyconnection.org` |

**Resolution:** Use `eric@headyconnection.org` as the canonical maintainer email across all repos.

### 5.3 `heady-manager.js` vs Entry Point Description

**Issue:** `heady-manager.js` is described in the README as "Node.js MCP Server & API Gateway" but is actually a thin orchestration shell (63 lines). The actual gateway logic is in `worker-api-gateway.js`. The naming is misleading.

**Resolution:** Rename conceptually: `heady-manager.js` → `heady-bootstrap.js` or update the README description.

### 5.4 `HCFullPipeline` / `hc-full-pipeline.js` / `hcfullpipeline.json`

Three different naming conventions for the same component:
- PascalCase class: `HCFullPipeline`
- Kebab-case file: `hc-full-pipeline.js`
- Camel-json: `hcfullpipeline.json`

**Resolution:** Standardize to `HCFullPipeline` (class), `hc-full-pipeline.js` (file), `hc-full-pipeline.json` (config).

### 5.5 Inconsistent API Version Prefixes

| File | Path prefix |
|---|---|
| `ternary-logic.js:295` | `/api/v2/ternary/...` |
| `heady-conductor.js:242` | `/api/conductor/...` (no version) |
| `buddy-core.js:972` | `/api/buddy/...` (no version) |
| `alive-software-architecture.md:74` | `/api/vector/...` (no version) |

**Resolution:** All internal APIs should use `/api/v1/` or `/api/v2/` consistently. New APIs from this plan use `/api/v2/`.

### 5.6 `headyos-core` Has No Domain

**File:** `headyos-core-package.json` — `"homepage": "https://headyos.com"` — but `headyos.com` is not in the 9-domain routing table, the `heady-registry.json` zone list, or the deployment guide.

**Resolution:** Either register `headyos.com` and add it to the routing table, or route HeadyOS through `headysystems.com/os`.

### 5.7 `heady-doctor.js` vs `auto-heal.js` vs Self-Healing in Multiple Files

Self-healing logic is distributed across:
- `heady-doctor.js` (scan: present)
- `auto-heal.js` (scan: present)
- `hc-full-pipeline.js:532-587` (`_selfHeal()`)
- `buddy-core.js:369-435` (5-phase interceptor)
- `heady-maintenance-ops.js` (scan: present)

**Resolution:** Consolidate healing logic under a single `HeadyHealer` class with clear tier definitions: Stage-level → Service-level → Infrastructure-level.

---

## 6. Cross-Repo Coordination Issues

### 6.1 "Battle" Split Is Incomplete

**Files:** `battle-blueprint.json`, `battle-script.js`, `battle-build.js`, `battle-extract.js`

The "battle" scripts are designed to split the monorepo into individual core repos. The `package.json:88-93` scripts show this is in progress. However:
- All 9 core repos have only `express@^4.21.0` as a dependency
- None have actual service implementations
- None have test suites
- None have CI/CD workflows
- None have Docker configurations

The split is architecturally planned but not executed.

### 6.2 Projection System Has No Cross-Repo Projection

**File:** `heady-registry.json:210-238` — projections target Cloud Run, Cloudflare, HuggingFace, and GitHub. But when the monorepo splits into 9 repos, the projection engine (`src/services/projection-engine.js`) doesn't know how to project to `headymcp-core`, `headybuddy-core`, etc.

### 6.3 `source-map.json` Missing Secondary Sources

**File:** `source-map.json:4-9`

```json
"secondary_sources": [
    "https://github.com/HeadySystems/Heady-pre-production",
    "https://github.com/HeadyMe/headyme-core",
    "https://github.com/HeadyMe/headymcp-core",
    ...
]
```

The `HeadySystems/Heady-pre-production` (note: HeadySystems org, not HeadyMe org) is referenced but its relationship to the primary `HeadyMe/Heady-pre-production-9f2f0642` is not documented. Two separate GitHub organizations maintaining the same codebase creates confusion.

### 6.4 No Shared Package (`@heady/shared`) for Common Utilities

All 9 core repos will need: PHI constant, logger, circuit breaker, exponential backoff, error handling. Currently these are duplicated or missing from the core repos. A `@heady/shared` npm package should contain:
- `phi.js` — PHI constant and phi-based utilities
- `logger.js` — Structured logger
- `circuit-breaker.js` — The existing circuit breaker
- `exponential-backoff.js` — The existing exponential backoff
- `errors.js` — Error tracking utilities

---

## 7. Optimization Opportunities

### 7.1 VectorMemory Search: SIMD-Friendly Float32 Arrays

**File:** `vector-memory.js:49-52`

```javascript
// vector-memory.js:49-52
_toFloat64(v) {
    if (v instanceof Float64Array) return v;
    if (v instanceof Float32Array || Array.isArray(v)) return Float64Array.from(v);
```

`Float64Array` uses 8 bytes/value vs `Float32Array`'s 4 bytes. For 384-dimensional embeddings, the memory overhead is 2x unnecessary. Modern embedding models use float32 precision. Switching to float32 halves memory and doubles cache efficiency.

**Impact:** 50% memory reduction for vector store, potential 20-30% search speedup.

### 7.2 Conductor: Index Bees by Category for O(1) Dispatch

**File:** `heady-conductor.js:82-98` — see §2.6

**Impact:** With 197 workers, O(1) dispatch replaces O(197) scan.

### 7.3 Self-Awareness: Incremental Error Rate Calculation

**File:** `self-awareness.js:164-170` — see §4.5

**Impact:** Avoid 4× O(500) filter passes per event.

### 7.4 Batch Vector Ingest in DeterministicErrorInterceptor

**File:** `buddy-core.js:339-351` — Each error triggers an individual `ingestMemory()` call. High error rates cause thundering herd to the vector store.

**Fix:** Queue error resolutions and batch-ingest every 100ms.

### 7.5 DuckDB for Analytical Queries on Execution History

**File:** `duckdb-memory.js` — DuckDB is already imported. The `HCFullPipeline.executionLog` (100-entry rolling buffer) could be persisted to DuckDB for analytical queries like "what is the average stage duration for MONTE_CARLO over the last 24 hours?" without hitting PostgreSQL.

### 7.6 Compress Vector JSON-Lines Persistence

**File:** `vector-memory.js:187-211` — JSON-lines files for 384-dim float arrays are extremely verbose. Using MessagePack or CBOR would reduce file size by ~60%.

---

## 8. New Capabilities to Add

### 8.1 Streaming Pipeline (SSE/WebSocket)

**Priority:** HIGH  
Add Server-Sent Events endpoint at `/api/pipeline/stream/:runId` that streams stage progress to browser clients. The HCFullPipeline already emits events — just needs an SSE bridge.

### 8.2 HeadyOS Kernel Services

**Priority:** HIGH  
`headyos-core` is positioned as "The Latent Operating System" but has no implementation. Define and build:
- **Process Manager** — Manage bee lifecycle (spawn, terminate, restart)  
- **Memory Manager** — Vector memory quota enforcement per user/service
- **Scheduler** — Wrap `autonomous-scheduler.js` with a proper cron API
- **IPC Bus** — The `heady-event-bus.js` provided is the foundation

### 8.3 `@heady/sdk` Public NPM Package

`alive-software-architecture.md:154-158` mentions `npx heady init` but this doesn't exist on npm. Publish `@heady/sdk` with:
- CLI (`npx heady init`)
- TypeScript types for all Heady APIs
- Browser client for vector memory queries
- WebSocket client for pipeline streaming

### 8.4 Multi-Tenant Namespace Isolation

The vector memory has namespace support (`vector-memory.js:29`), but there's no enforcement that User A cannot access User B's namespace. Multi-tenant isolation requires:
- Namespace = `user:<userId>` enforced at API layer
- Per-user vector quotas
- Namespace-scoped API keys

### 8.5 Heady Swarm Dashboard (Real-Time)

`heady-registry.json:261-264` — `swarm-dashboard` is `"status": "planned"`. Build using:
- WebSocket connection to HeadyConductor events
- Real-time bee status grid
- Pipeline run timeline visualization
- Vector space 3D viewer (using Three.js against the 3D topology API)

### 8.6 A/B Testing Framework for Pipeline Stages

The ARENA stage (`hc-full-pipeline.js:368-383`) has the right idea but uses fake data. Replace with real A/B testing:
- Route X% of traffic to alternative stage implementations
- Collect metrics per variant
- Auto-promote winning variant after N samples

### 8.7 Heady Intelligence Feed (RSS → Vector Memory)

**From:** `deep-research.js` (present in scan)  
Add an autonomous research feed that:
1. Ingests RSS/news from configurable sources
2. Embeds articles into vector memory with source metadata
3. Surfaces relevant context during pipeline INTAKE stage

### 8.8 MIDI/Music Intelligence Layer (Production-Ready)

`buddy-core.js:576-590` has MIDI tool stubs. The `heady-manager.js` references a realtime engine with MIDI capabilities. Build this out as a proper capability:
- MIDI note parsing and semantic encoding into vector space
- DAW integration via the existing `daw-mcp-bridge` reference
- Music theory-aware agent behaviors

### 8.9 Governance Dashboard (Projection Receipt Explorer)

`heady-registry.json:269-272` — `governance-panel` is `"status": "planned"`. The `projection-governance.js` emits hash-chained receipts. Build a governance dashboard showing:
- Receipt chain visualization
- Projection freshness status across all targets
- Audit timeline

### 8.10 Cross-Domain Search

Build a federated search API that queries:
- Vector memory (semantic search)
- Email (`headyme.com` inbox)
- Code (GitHub API)
- Documents (future headyio integrations)

Single `/api/search` endpoint that fans out to all data sources and merges results by relevance score.

### 8.11 Heady Billing & Usage Analytics

The `budget-tracker.js` already tracks LLM costs. Extend to:
- Per-user billing based on LLM token usage
- Tier enforcement (Free: 10k tokens/day, Pro: 500k/day, Sovereign: unlimited)
- Stripe integration for subscription management
- Usage dashboard at `headyme.com/settings/usage`

---

## 9. Security Improvements

### 9.1 JWT `aud` Claim Not Validated Cross-Domain

The auth system issues JWTs but the `aud` (audience) claim must include all 9 production domains for cross-service calls to work without re-authentication.

### 9.2 No SSRF Protection in BeeFactory Health Check Template

**File:** `bee-factory.js:191-211`

The `health-check` template fetches arbitrary URLs:
```javascript
// bee-factory.js:191-211
const url = cfg.url || `https://${cfg.target}/api/health`;
const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
```

If `cfg.target` is user-controlled, this is a Server-Side Request Forgery vector. The fetch can hit internal GCP metadata endpoints (`http://169.254.169.254`), Redis, or PostgreSQL.

**Fix:** Add URL allowlist validation and block RFC 1918 / link-local addresses.

### 9.3 Buddy Audit Log Written to Local Disk

**File:** `buddy-core.js:1066-1071`

```javascript
// buddy-core.js:1066-1071
_audit(type, data) {
    safeOp('buddy:audit', () => {
        const entry = JSON.stringify({ type, ...data, ... });
        fs.appendFileSync(BUDDY_AUDIT_PATH, entry + '\n');
    });
}
```

Audit logs on the local filesystem are ephemeral on Cloud Run (container restarts wipe them). Audit logs MUST be written to a durable store (PostgreSQL `audit_log` table or Cloud Logging).

### 9.4 `checkPreemptive()` Uses Exact String Match Only

**File:** `buddy-core.js:397-399`

```javascript
// buddy-core.js:397-399
checkPreemptive(errorKey) {
    return this.learnedRules.find(r => r.errorKey === errorKey) || null;
}
```

An attacker who can control the `errorKey` string (via crafted task names) could potentially bypass rule matching by using slightly different strings (`TypeError:buddy:decide` vs `TypeError: buddy:decide`).

### 9.5 No Input Sanitization on Conductor `taskType`

**File:** `heady-conductor.js:242-250`

```javascript
// heady-conductor.js:242-250
app.post('/api/conductor/dispatch', async (req, res) => {
    const { taskType, payload, opts } = req.body;
    const result = await conductor.dispatch(taskType, payload, opts);
```

No validation of `taskType` before it's used as a map key. Prototype pollution possible if `taskType = "__proto__"`.

**Fix:** Validate `taskType` is a non-empty alphanumeric string before dispatch.

### 9.6 `_persistBee()` Writes to Path Derived from User Input

**File:** `bee-factory.js:487-488`

```javascript
// bee-factory.js:487-488
const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
const filePath = path.join(BEES_DIR, filename);
```

While `replace()` sanitizes most characters, the pattern is insufficient. A `domain` of `.....` becomes `------bee.js` which is a valid filename. Path traversal via `..` is blocked by the regex, but this should use a stronger validator.

### 9.7 SelfAwareness Brand Check Fetches Production URLs in Tests

**File:** `self-awareness.js:60-79`

The `scanDomain()` function fetches real production URLs. This should be guarded with `if (process.env.NODE_ENV !== 'test')` to prevent test suites from making external HTTP calls.

### 9.8 No Security Headers on Internal API Routes

The Cloudflare Worker adds security headers at the edge, but internal routes registered directly on the Express app (e.g., `/api/buddy/*`, `/api/conductor/*`) don't have security headers if accessed directly (bypassing Cloudflare).

---

## 10. Observability Gaps

### 10.1 No Distributed Trace IDs

No `trace-id` / `span-id` headers are generated or propagated. Each service operates in isolation with no correlation between:
- An incoming API request
- The pipeline run it triggers
- The bee tasks that execute
- The LLM calls that are made

**Fix:** Generate a `X-Heady-Trace-Id` on ingress and thread it through all sub-calls. Implement in `heady-observability.js` (provided).

### 10.2 Self-Awareness Telemetry Has No Export to External Systems

**File:** `self-awareness.js` — telemetry stays in-memory ring buffer with no export to Prometheus, Datadog, or OpenTelemetry collector.

**Fix:** Add Prometheus counter/gauge export in `heady-observability.js`.

### 10.3 No LLM Token Usage Tracking in Traces

LLM calls go through `llm-router.js` but token usage is tracked in `budget-tracker.js` with no correlation to traces. Can't answer "which pipeline runs are most expensive?"

### 10.4 Error Rate SLOs Not Defined

The `self-awareness.js` computes error rates but there's no SLO definition or alerting threshold beyond the confidence scoring. No Prometheus alerting rules. No PagerDuty integration (mentioned in production guide but not wired).

### 10.5 No Structured Event Logging for Bee Execution

Bee execution results are stored in `executionLog` (100-entry rolling buffer) and emitted via EventEmitter, but not persisted to any structured log store for retrospective analysis.

---

## 11. Infrastructure Improvements

### 11.1 Single Cloud Region

**File:** `heady-registry.json:143-148` — Only `us-central1` is defined

For a sovereign AI platform, single-region deployment is a reliability risk. Recommendation: Add `europe-west1` as a secondary region with Cloudflare routing traffic to the nearest healthy region.

### 11.2 No Blue/Green Deployment Implementation

`PRODUCTION_DEPLOYMENT_GUIDE.md:738` references `liquid-deploy.yml` for blue/green deployment, but no such file is present in the scan. The workflow must be created.

### 11.3 `node:22-alpine` vs `node:20-alpine` Inconsistency

**Files:** `README.md:118` (`node:22-alpine`) vs `PRODUCTION_DEPLOYMENT_GUIDE.md:378` (`node:20-alpine`)

These should be synchronized.

### 11.4 No Database Backup Automation

The production guide mentions backup configuration but no automated backup verification or restore testing workflow is defined.

### 11.5 Vector Shard Path Not Validated at Startup

`VECTOR_SHARD_PATH` environment variable is referenced but no startup validation ensures the path exists, is writable, or is on an encrypted volume as required by security checklist.

---

## 12. Core Repo Buildout Plan

Each of the 9 core repos currently has only an Express skeleton. Here is the buildout priority and content for each:

| Repo | Priority | Key Files to Create | Domain |
|---|---|---|---|
| `headymcp-core` | P0 | `mcp-server.js`, `tool-registry.js`, `31 MCP tools` | headymcp.com |
| `headyapi-core` | P0 | `gateway.js` (use heady-api-gateway-v2.js), `auth-middleware.js` | headyapi.com |
| `headyos-core` | P1 | `kernel.js`, `process-manager.js`, `scheduler.js` | headysystems.com |
| `headybuddy-core` | P1 | `buddy-service.js`, `chat-api.js`, `memory-api.js` | headybuddy.org |
| `headyme-core` | P1 | `dashboard-api.js`, `onboarding.js`, `user-service.js` | headyme.com |
| `headysystems-core` | P1 | `health-monitor.js`, `admin-api.js`, `telemetry.js` | headysystems.com |
| `headyconnection-core` | P2 | `community-api.js`, `webhook-api.js`, `docs-server.js` | headyconnection.org |
| `headyio-core` | P2 | `sdk.js`, `connector-registry.js`, `sync-engine.js` | headyio.com |
| `headybot-core` | P2 | `bot-orchestrator.js`, `platform-adapters.js` | headybot.com |

Each core repo MUST include:
1. `Dockerfile` (multi-stage, node:22-alpine)
2. `.github/workflows/ci.yml` (lint, test, build, scan)
3. `.github/workflows/deploy.yml` (blue/green Cloud Run)
4. `heady-registry.json` (service-specific registry)
5. Tests (>70% coverage target)
6. OpenAPI spec (`openapi.yaml`)

---

## 13. Prioritized Roadmap

### Phase 1: Foundation (Weeks 1-2) — Unblock Multi-Repo

| # | Task | Files | Impact |
|---|---|---|---|
| 1.1 | Fix Conductor durationMs bug | `heady-conductor.js:136` | Data integrity |
| 1.2 | Add O(1) category index to Conductor | `heady-conductor.js:82-98` | Performance |
| 1.3 | Fix VectorMemory `queryMemory()` / `ingestMemory()` | `vector-memory.js` | Core functionality |
| 1.4 | Add PgVector adapter to VectorMemory | New: `pg-vector-adapter.js` | Production readiness |
| 1.5 | Implement `heady-event-bus.js` | **Provided** | Multi-repo comms |
| 1.6 | Wire event bus to all EventEmitter instances | Multiple files | Consistency |
| 1.7 | Fix self-awareness `vectorMemory` require | `self-awareness.js:33-34` | Runtime error prevention |
| 1.8 | Add HCFullPipeline runs LRU eviction | `hc-full-pipeline.js:48` | Memory leak prevention |

### Phase 2: Integration Layer (Weeks 3-4)

| # | Task | Files | Impact |
|---|---|---|---|
| 2.1 | Deploy `heady-service-mesh.js` | **Provided** | Service discovery |
| 2.2 | Deploy `heady-config-server.js` | **Provided** | Dynamic configuration |
| 2.3 | Deploy `heady-observability.js` | **Provided** | Distributed tracing |
| 2.4 | Deploy `heady-api-gateway-v2.js` | **Provided** | API versioning + rate limiting |
| 2.5 | Deploy `ecosystem-integration-map.js` | **Provided** | Documentation + runtime |
| 2.6 | Add SSE pipeline streaming endpoint | `heady-manager.js` + pipeline | Real-time UX |
| 2.7 | Fix BeeFactory BEES_DIR path | `bee-factory.js:35` | Clean repo |

### Phase 3: Core Repo Buildout (Weeks 5-8)

| # | Task | Impact |
|---|---|---|
| 3.1 | Build `headymcp-core` with 31 MCP tools | Unlocks external LLM connections |
| 3.2 | Build `headyapi-core` as production API gateway | Public API surface |
| 3.3 | Build `headyos-core` kernel services | Platform foundation |
| 3.4 | Build `headyme-core` + `headybuddy-core` | Consumer product |
| 3.5 | Add `@heady/shared` npm package | Reusable utilities |
| 3.6 | Add cross-domain auth federation | SSO across all domains |

### Phase 4: Production Hardening (Weeks 9-12)

| # | Task | Impact |
|---|---|---|
| 4.1 | Multi-region Cloud Run deployment | 99.99% uptime target |
| 4.2 | Blue/green deployment pipeline | Zero-downtime deploys |
| 4.3 | SSRF protection in BeeFactory | Security |
| 4.4 | Async audit log (PostgreSQL) | Durability + performance |
| 4.5 | LLM billing + Stripe integration | Revenue enablement |
| 4.6 | Real ARENA stage with actual LLM calls | Accurate competition |

### Phase 5: Advanced Capabilities (Q2 2026+)

| # | Task | Impact |
|---|---|---|
| 5.1 | `@heady/sdk` public npm package | Developer ecosystem |
| 5.2 | Multi-tenant namespace isolation | Enterprise readiness |
| 5.3 | Heady Intelligence Feed (RSS→vectors) | Autonomous knowledge |
| 5.4 | Cross-domain federated search | Power user feature |
| 5.5 | Swarm Dashboard (3D vector viewer) | Product differentiation |
| 5.6 | Governance Dashboard | Enterprise compliance |

---

## 14. File-Level Change Map

This section provides a specific change map linking every improvement to a file and line number.

### Critical Changes (Must-Fix)

| File | Line(s) | Change | Phase |
|---|---|---|---|
| `heady-conductor.js` | 129-136 | Fix durationMs bug (delete after read) | 1 |
| `heady-conductor.js` | 82-98 | Add `_categoryIndex` Map for O(1) dispatch | 1 |
| `heady-conductor.js` | 242-250 | Add `taskType` validation (alphanumeric only) | 3 |
| `hc-full-pipeline.js` | 48 | Add `maxRuns` + LRU eviction | 1 |
| `hc-full-pipeline.js` | 365 | Move Monte Carlo to worker thread or async | 2 |
| `hc-full-pipeline.js` | 376-384 | Wire real LLM calls to ARENA stage | 4 |
| `vector-memory.js` | 30-32 | Add `queryMemory()` + `ingestMemory()` methods | 1 |
| `vector-memory.js` | 20 | Make `DRIFT_THRESHOLD` configurable via env | 2 |
| `vector-memory.js` | 49-52 | Downgrade to Float32Array for 2x memory efficiency | 1 |
| `self-awareness.js` | 33-34 | Fix vectorMemory require to use instance, not class | 1 |
| `self-awareness.js` | 164-170 | Replace 4x O(n) filter with rolling counters | 1 |
| `self-awareness.js` | 312 | Replace `process.on()` with HeadyEventBus | 1 |
| `buddy-core.js` | 139 | Convert `learnedRules` Array to Map for O(1) lookup | 1 |
| `buddy-core.js` | 1069 | Replace `appendFileSync` with async audit queue | 2 |
| `buddy-core.js` | 397-399 | Add fuzzy matching to `checkPreemptive()` | 3 |
| `bee-factory.js` | 35 | Change `BEES_DIR` to `data/dynamic-bees/` | 1 |
| `bee-factory.js` | 191-211 | Add SSRF protection (block RFC 1918 URLs) | 3 |
| `ternary-logic.js` | 127-134 | Replace JSON.stringify comparison with hash set | 2 |
| `edge-diffusion.js` | 17-28 | Wire to real inference API (HuggingFace/Replicate) | 4 |
| `edge-diffusion.js` | 30 | Export class, not singleton | 2 |
| `package.json` | 38 | Fix test script (remove Linux-only `fuser`) | 1 |

### High-Priority Changes

| File | Line(s) | Change | Phase |
|---|---|---|---|
| `heady-registry.json` | 4 | Align version with `package.json` (3.0.1 → 3.1.0) | 1 |
| `heady-registry.json` | 151-155 | Add all 9 domains to Cloudflare zones | 2 |
| `buddy-core.js` | 340-341 | Replace `global.eventBus.emit()` with HeadyEventBus | 1 |
| `hc-full-pipeline.js` | 67-114 | Wire `_wireAutoTelemetry()` to HeadyEventBus | 1 |
| `heady-conductor.js` | 22 | Import HeadyEventBus, not Node EventEmitter | 1 |
| All `*-core-package.json` | `author.email` | Standardize to `eric@headyconnection.org` | 1 |
| New file | — | `PgVectorAdapter` class | 1 |
| New file | — | `@heady/shared` package | 2 |
| New file | — | `heady-webhook-dispatcher.js` | 2 |
| New file | — | `/api/pipeline/stream/:runId` SSE handler | 2 |

---

*© 2026 HeadySystems Inc. — Proprietary and Confidential*  
*Architecture review by Heady AI Platform Team*  
*Next review date: 2026-04-01*
