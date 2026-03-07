# Heady Ecosystem — Windsurf IDE Instructions

> **Maintained by:** eric@headyconnection.org | HeadySystems Inc.  
> **Version:** 3.2.0 (architecture improvement release)  
> **Source truth:** `/home/user/workspace/heady-improvements/architecture/`  
> **Production source:** `https://github.com/heady-project/heady-manager` (see source-map.json)  
> **Last updated:** 2026-03-07

---

## Table of Contents

1. [Ecosystem Overview](#1-ecosystem-overview)
2. [Repository & File Map](#2-repository--file-map)
3. [The 9 Core Packages](#3-the-9-core-packages)
4. [The 9 Domains](#4-the-9-domains)
5. [Naming Conventions](#5-naming-conventions)
6. [The 10-Phase Bootstrap](#6-the-10-phase-bootstrap)
7. [Event System & Topics](#7-event-system--topics)
8. [API Versioning Rules](#8-api-versioning-rules)
9. [Bee Naming & Creation](#9-bee-naming--creation)
10. [Architecture Integration Files](#10-architecture-integration-files)
11. [Known Bugs & Fixes](#11-known-bugs--fixes)
12. [How to Make Changes](#12-how-to-make-changes)
13. [Configuration Reference](#13-configuration-reference)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Testing Standards](#15-testing-standards)
16. [Do's and Don'ts](#16-dos-and-donts)

---

## 1. Ecosystem Overview

Heady is a **multi-domain AI orchestration ecosystem** structured around the principle of **Sacred Geometry** — the golden ratio φ (1.6180339887) governs timing intervals, load-balancing weights, routing logic, and ring buffer sizes throughout the codebase.

### Core Concepts

| Concept | Description |
|---|---|
| **HeadyConductor** | Swarm orchestrator — spawns and manages bee workers |
| **HCFullPipeline** | 9-stage content pipeline (INTAKE → CONTEXTUALIZE → DISTILL → REFINE → SYNTHESIZE → ARENA → TERNARY → SCULPT → RECEIPT) |
| **BuddyCore** | Sovereign AI orchestrator with MetacognitionEngine, DeterministicErrorInterceptor, TaskLockManager, MCPToolRegistry |
| **VectorMemory** | In-memory + pgvector semantic memory |
| **SelfAwareness** | Telemetry loop, branding monitor, drift detection |
| **CreativeEngine** | 7-style creative generation (GOLDEN_RATIO, FIBONACCI_CASCADE, MANDALA_PULSE, FRACTAL_BLOOM, SACRED_SPIRAL, QUANTUM_LATTICE, HARMONIC_RESONANCE) |
| **EdgeDiffusion** | Image generation (stub — needs real HuggingFace endpoint) |
| **TernaryLogic** | Three-valued decision matrix {-1, 0, +1} for TERNARY pipeline stage |
| **HeadyManager** | 10-phase application bootstrap shell |

### Architecture Pillars (from alive-software-architecture.md)

1. Sovereign AI Identity
2. Sacred Geometry Computing
3. Adaptive Swarm Intelligence
4. Recursive Self-Improvement
5. Ternary Logic Processing
6. Temporal Coherence Engine
7. Edge Diffusion Network
8. Metacognitive Awareness
9. Distributed Memory Fabric
10. Autonomous Tool Orchestration
11. Identity Preservation Protocol
12. Harmonic Resonance Scheduler
13. Living Codebase Evolution

---

## 2. Repository & File Map

### Primary Monorepo: `heady-manager`

```
heady-manager/
├── heady-manager.js          ← 10-phase bootstrap entry point
├── heady-conductor.js        ← Swarm orchestrator (HeadyConductor class)
├── hc-full-pipeline.js       ← 9-stage pipeline (HCFullPipeline class)
├── bee-factory.js            ← Dynamic bee factory (BeeFactory class)
├── vector-memory.js          ← Semantic memory (VectorMemory class)
├── buddy-core.js             ← Sovereign AI (BuddyCore class, 1084 lines)
├── self-awareness.js         ← Telemetry/branding (SelfAwareness class, 360 lines)
├── creative-engine.js        ← 7-style generation (CreativeEngine class)
├── edge-diffusion.js         ← Image generation STUB (EdgeDiffusion class)
├── ternary-logic.js          ← Decision matrix (TernaryDecisionMatrix class)
├── source-map.json           ← GitHub URL truth + architecture notes
├── heady-registry.json       ← Service registry (v3.0.1 — note: inconsistency with pkg v3.1.0)
├── package.json              ← v3.1.0 — only 3 production deps
├── README.md                 ← v3.1.0 overview, 24 domains, 197 workers
├── alive-software-architecture.md  ← 13 pillars, full API surface
└── PRODUCTION_DEPLOYMENT_GUIDE.md  ← GCP/Cloudflare/PostgreSQL/Redis deployment
```

### Architecture Integration Files (new — in `heady-improvements/architecture/`)

```
heady-improvements/architecture/
├── MASTER_IMPROVEMENT_PLAN.md      ← Comprehensive improvement plan with line refs
├── ecosystem-integration-map.js    ← SERVICES map, EVENT_TOPICS, HEADY_DOMAINS
├── heady-event-bus.js              ← Centralized event bus (Redis + local fallback)
├── heady-service-mesh.js           ← Service discovery, routing, circuit-breaking
├── heady-config-server.js          ← Centralized config, hot-reload, GCP secrets
├── heady-observability.js          ← Tracing, Prometheus metrics, structured logs
├── heady-api-gateway-v2.js         ← Unified API gateway v1+v2, auth, rate-limiting
└── WINDSURF_INSTRUCTIONS.md        ← This file
```

### Core Package Repos (all empty shells — need implementation)

```
headymcp-core/      → headymcp.com      (P0 — 31 MCP tools)
headyapi-core/      → headyapi.com      (P0 — API gateway)
headybuddy-core/    → headybuddy.org
headyos-core/       → (no domain yet — headyos.com missing from routing table)
headyio-core/       → headyio.com
headybot-core/      → headybot.com
headysystems-core/  → headysystems.com
headyme-core/       → headyme.com
headyconnection-core/ → headyconnection.org
```

**All 9 core repos currently have only one dependency: `express@^4.21.0`.** No implementations exist. Add the architecture integration files above as the foundation.

---

## 3. The 9 Core Packages

### Priority matrix

| Core | Domain | Priority | Status | Action |
|---|---|---|---|---|
| `headymcp-core` | headymcp.com | **P0** | Empty shell | Implement 31 MCP tools |
| `headyapi-core` | headyapi.com | **P0** | Empty shell | Install `heady-api-gateway-v2.js` |
| `headybuddy-core` | headybuddy.org | P1 | Empty shell | Port BuddyCore from monorepo |
| `headyos-core` | *(missing)* | P1 | Empty shell | Register headyos.com in routing |
| `headyio-core` | headyio.com | P2 | Empty shell | Implement I/O adapters |
| `headybot-core` | headybot.com | P2 | Empty shell | Implement bot integrations |
| `headysystems-core` | headysystems.com | P2 | Empty shell | Implement infra management |
| `headyme-core` | headyme.com | P3 | Empty shell | Implement user identity |
| `headyconnection-core` | headyconnection.org | P3 | Empty shell | Implement connection hub |

### What every core package must include

Each `*-core` package **must** wire these 4 integration modules at startup:

```javascript
// In every core package's index.js / server.js:
const { getConfigServer }  = require('./heady-config-server');
const { getObservability } = require('./heady-observability');
const { getServiceMesh }   = require('./heady-service-mesh');
const { getEventBus }      = require('./heady-event-bus');

async function bootstrap() {
  const cfg = getConfigServer();
  await cfg.start();

  const obs = getObservability({ service: 'heady<name>' });
  await obs.start();

  const mesh = getServiceMesh();
  await mesh.start();

  const bus = getEventBus();
  await bus.start();

  // ... rest of initialization
}
```

---

## 4. The 9 Domains

| Domain | Service Key | Cloud Run Path | Cloudflare Worker |
|---|---|---|---|
| `headyme.com` | `headyme` | `/me` | Yes |
| `headysystems.com` | `headysystems` | `/systems` | Yes |
| `headyapi.com` | `headyapi` | `/api` | Yes |
| `headyconnection.org` | `headyconnection` | `/connection` | Yes |
| `headybuddy.org` | `headybuddy` | `/buddy` | Yes |
| `headymcp.com` | `headymcp` | `/mcp` | Yes |
| `headyio.com` | `headyio` | `/io` | Yes |
| `headybot.com` | `headybot` | `/bot` | Yes |
| `heady-ai.com` | `heady-ai` | `/ai` | Yes |

**Note:** `headyos.com` is referenced in the codebase but absent from the routing table and Cloudflare config. This is a known gap — file an issue before adding any code that assumes headyos.com is live.

### CORS policy

All 9 domains are whitelisted in `heady-api-gateway-v2.js` (`HEADY_DOMAINS` constant). When adding a new domain:

1. Add to `HEADY_DOMAINS` array in `heady-api-gateway-v2.js`
2. Add to `HEADY_DOMAINS` in `ecosystem-integration-map.js`
3. Add Cloudflare route in `heady-registry.json`
4. Update `PRODUCTION_DEPLOYMENT_GUIDE.md` routing table

---

## 5. Naming Conventions

### Files

| Pattern | Use |
|---|---|
| `heady-*.js` | Core infrastructure files (orchestrators, buses, gateways) |
| `*-core/` | Per-domain package repositories |
| `*-bee.js` | Individual bee worker files (in `bees/` directory) |
| `*-core-readme.md` | Per-core documentation (in heady-scan/) |

### Classes

| Pattern | Example |
|---|---|
| `PascalCase` for all classes | `HeadyConductor`, `BuddyCore`, `VectorMemory` |
| No `Heady` prefix inside core packages | `ApiGateway` not `HeadyApiGateway` |
| `Heady` prefix for cross-cutting infra | `HeadyEventBus`, `HeadyServiceMesh` |

### Events

**Format:** `heady:{service}:{noun}:{verb}`

```
heady:pipeline:run:created       ← pipeline run was created
heady:pipeline:run:completed     ← pipeline run finished
heady:bee:worker:spawned         ← new bee worker spawned
heady:bee:worker:failed          ← bee worker failed
heady:buddy:task:started         ← BuddyCore took a task
heady:awareness:drift:detected   ← identity drift detected
heady:config:value:changed       ← config value hot-reloaded
heady:service:health:degraded    ← service mesh health drop
```

Full topic list lives in `heady-event-bus.js` (`TOPICS` constant) and `ecosystem-integration-map.js` (`EVENT_TOPICS` constant). **Always use constants — never raw strings.**

```javascript
// CORRECT:
const { TOPICS } = require('./heady-event-bus');
bus.publish(TOPICS.PIPELINE_RUN_COMPLETED, data);

// WRONG:
bus.publish('heady:pipeline:run:completed', data);  // typo-prone
```

### Config keys

**Format:** `{namespace}.{camelCaseProp}`

```
buddy.maxLog
conductor.maxBees
selfAwareness.driftThreshold
pipeline.maxConcurrentRuns
gateway.port
infra.redisUrl
```

Use `cfg.get('namespace.key')` — never `process.env.XYZ` directly in application code. Config server maps env vars automatically.

### Env vars

Auto-generated from config key: `buddy.maxLog` → `HEADY_BUDDY_MAX_LOG`

```
HEADY_BUDDY_MAX_LOG=400
HEADY_CONDUCTOR_MAX_BEES=100
HEADY_SELF_AWARENESS_DRIFT_THRESHOLD=0.8
```

### Constants

```javascript
// Sacred constants — NEVER change these values:
const PHI = 1.6180339887;          // Golden ratio — used EVERYWHERE
const TERNARY = { REJECT: -1, ABSTAIN: 0, ACCEPT: 1 };

// Use PHI for any timing interval:
const HEARTBEAT_MS = Math.round(PHI * 10_000);  // 16 180 ms
const PROBE_MS     = Math.round(PHI * 60_000);  // 97 081 ms
```

---

## 6. The 10-Phase Bootstrap

`heady-manager.js` orchestrates startup in exactly 10 phases. **Do not reorder phases.** Dependencies flow downward.

| Phase | Name | What it initializes | Key file |
|---|---|---|---|
| 1 | **CONFIG** | ConfigServer (all config values) | `heady-config-server.js` |
| 2 | **OBSERVABILITY** | Tracer, Prometheus metrics, logger | `heady-observability.js` |
| 3 | **MEMORY** | VectorMemory + pgvector connection | `vector-memory.js` |
| 4 | **EVENT_BUS** | HeadyEventBus (Redis + local) | `heady-event-bus.js` |
| 5 | **SERVICE_MESH** | Service registry + health probes | `heady-service-mesh.js` |
| 6 | **CONDUCTOR** | HeadyConductor swarm orchestrator | `heady-conductor.js` |
| 7 | **PIPELINE** | HCFullPipeline 9-stage processor | `hc-full-pipeline.js` |
| 8 | **BUDDY** | BuddyCore sovereign orchestrator | `buddy-core.js` |
| 9 | **AWARENESS** | SelfAwareness telemetry loop | `self-awareness.js` |
| 10 | **GATEWAY** | API Gateway v2 (starts HTTP server) | `heady-api-gateway-v2.js` |

### Bootstrap code pattern

```javascript
// heady-manager.js — correct phase ordering
const phases = [
  { name: 'CONFIG',       init: () => require('./heady-config-server').getConfigServer().start() },
  { name: 'OBSERVABILITY',init: () => require('./heady-observability').getObservability({ service: 'heady-manager' }).start() },
  { name: 'MEMORY',       init: () => require('./vector-memory').VectorMemory.getInstance().connect() },
  { name: 'EVENT_BUS',    init: () => require('./heady-event-bus').getEventBus().start() },
  { name: 'SERVICE_MESH', init: () => require('./heady-service-mesh').getServiceMesh().start() },
  { name: 'CONDUCTOR',    init: () => require('./heady-conductor').HeadyConductor.getInstance().start() },
  { name: 'PIPELINE',     init: () => require('./hc-full-pipeline').HCFullPipeline.getInstance().initialize() },
  { name: 'BUDDY',        init: () => require('./buddy-core').BuddyCore.getInstance().awaken() },
  { name: 'AWARENESS',    init: () => require('./self-awareness').SelfAwareness.getInstance().startLoop() },
  { name: 'GATEWAY',      init: () => require('./heady-api-gateway-v2').createGateway().start() },
];
```

### Adding a new phase

**Do not add phases.** If you need new initialization, add it to the existing phase that owns that concern (e.g., new storage = Phase 3 MEMORY, new service = Phase 5 SERVICE_MESH).

---

## 7. Event System & Topics

### Architecture

```
Publisher                    HeadyEventBus                  Subscriber
────────                     ─────────────────              ──────────
bus.publish(topic, data) ──► LocalEventEmitter ─────────► handler(event)
                         ──► RedisPubSub ────────────────► (cross-process)
                         ──► DeadLetterQueue ─────────────► (on failure)
```

### Full topic registry

```javascript
// From heady-event-bus.js TOPICS constant:

// Pipeline
'heady:pipeline:run:created'
'heady:pipeline:run:started'
'heady:pipeline:run:completed'
'heady:pipeline:run:failed'
'heady:pipeline:stage:started'     // includes: { stage, runId }
'heady:pipeline:stage:completed'
'heady:pipeline:stage:failed'

// Bees
'heady:bee:worker:spawned'
'heady:bee:worker:healthy'
'heady:bee:worker:degraded'
'heady:bee:worker:failed'
'heady:bee:worker:terminated'

// Buddy / Metacognition
'heady:buddy:task:started'
'heady:buddy:task:completed'
'heady:buddy:task:failed'
'heady:buddy:reflection:triggered'
'heady:buddy:lock:acquired'
'heady:buddy:lock:released'
'heady:buddy:lock:timeout'

// Self-awareness
'heady:awareness:heartbeat'
'heady:awareness:drift:detected'   // payload: { score, threshold }
'heady:awareness:realignment:triggered'
'heady:awareness:branding:anomaly'

// Vector memory
'heady:memory:ingested'
'heady:memory:queried'
'heady:memory:evicted'

// Config
'heady:config:value:changed'       // payload: { key, oldValue, newValue }
'heady:config:reloaded'

// Service mesh
'heady:service:registered'
'heady:service:deregistered'
'heady:service:health:degraded'
'heady:service:health:restored'
'heady:service:circuit:opened'
'heady:service:circuit:closed'

// Pub/Sub
'heady:pubsub:message:received'
'heady:pubsub:task:dispatched'
```

### Subscribing patterns

```javascript
const { getEventBus, TOPICS } = require('./heady-event-bus');
const bus = getEventBus();

// Single topic
bus.subscribe(TOPICS.PIPELINE_RUN_COMPLETED, (event) => {
  console.log('Run done:', event.data.runId, 'in', event.data.durationMs, 'ms');
});

// Wildcard pattern (all pipeline events)
bus.subscribePattern('heady:pipeline:*', (event) => {
  console.log('Pipeline event:', event.topic, event.data);
});

// One-shot (auto-unsubscribes after first delivery)
bus.once(TOPICS.GATEWAY_STARTED, () => {
  console.log('Gateway is up');
});

// Replay missed events (useful on service restart)
const missed = bus.replay(TOPICS.PIPELINE_RUN_COMPLETED, { since: Date.now() - 60_000 });
```

---

## 8. API Versioning Rules

### Version policy

| Version | Status | Rules |
|---|---|---|
| `/api/v1/*` | **Legacy** | Stable, no new features. Sunset: 2027-01-01. Add `Deprecation: true` header. |
| `/api/v2/*` | **Current** | All new features go here. |
| `/api/v3/*` | **Reserved** | Do not implement until v2 has a breaking change. |

### Adding a new endpoint

**Always add to v2. Mirror to v1 only if it existed in v1 before.**

```javascript
// In heady-api-gateway-v2.js, _v2Router() method:

// CORRECT — new endpoint in v2 only:
router.post('/my-new-feature', async (req, res) => {
  return this._proxyToService(req, res, 'headyapi', '/api/v2/my-new-feature');
});

// DO NOT add to _v1Router() unless the endpoint already existed in v1.
```

### URL structure

```
https://headyapi.com/api/v2/{resource}/{id}/{action}

Examples:
  GET  /api/v2/pipeline/runs/{runId}
  POST /api/v2/pipeline/run
  GET  /api/v2/pipeline/stream/{runId}   ← SSE
  POST /api/v2/bees
  GET  /api/v2/bees/{id}
  POST /api/v2/creative/generate
  POST /api/v2/image/generate
  POST /api/v2/memory/ingest
  GET  /api/v2/memory/query
  GET  /api/v2/mcp/tools
  POST /api/v2/mcp/tools/{toolName}/run
  POST /api/v2/auth/login
  POST /api/v2/auth/refresh
  GET  /api/v2/obs/metrics              ← Prometheus scrape (no auth)
  GET  /api/v2/admin/config/{key}       ← Admin only
  PUT  /api/v2/admin/config/{key}       ← Admin only
```

### Authentication headers

```
Authorization: Bearer <JWT>     ← Standard user auth
X-Heady-Key: <keyId>.<hmac>     ← Service-to-service auth
X-Admin-Token: <token>          ← Admin operations only

Response headers always include:
X-Heady-Trace-Id: <uuid>
X-Heady-Span-Id: <uuid>
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 60
```

---

## 9. Bee Naming & Creation

### Bee file location

Bees live in the `bees/` directory **at the project root** (NOT `__dirname` — this was a bug in `bee-factory.js:35`).

```javascript
// CORRECT (from heady-config-server.js):
const BEES_DIR = cfg.get('beeFactory.beesDir');  // → /path/to/project/bees/

// WRONG (bug in bee-factory.js:35):
const BEES_DIR = __dirname;  // ← pollutes source directory
```

### Bee naming convention

```
{domain}-{function}-{type}-bee.js

Examples:
  headyapi-ingest-worker-bee.js
  headymcp-tool-executor-bee.js
  headybuddy-reflection-task-bee.js
  headyio-stream-processor-bee.js
  heady-ai-diffusion-inference-bee.js
```

### Bee structure template

```javascript
// bees/heady{domain}-{function}-bee.js
'use strict';

const { getEventBus, TOPICS }  = require('../heady-event-bus');
const { getObservability }     = require('../heady-observability');
const { getConfigServer }      = require('../heady-config-server');

const BEE_NAME = 'heady{domain}-{function}-bee';
const BEE_TYPE = '{function}';

class Heady{Domain}{Function}Bee {
  constructor(opts = {}) {
    this.name     = BEE_NAME;
    this.type     = BEE_TYPE;
    this.id       = opts.id || require('crypto').randomUUID();
    this._bus     = getEventBus();
    this._obs     = getObservability({ service: BEE_NAME });
    this._cfg     = getConfigServer();
    this._running = false;
  }

  async start() {
    this._running = true;
    await this._bus.publish(TOPICS.BEE_WORKER_SPAWNED, { beeId: this.id, type: this.type });
    this._obs.logger.info(`${BEE_NAME} started`, { beeId: this.id });
  }

  async process(task) {
    return this._obs.tracer.withSpan(`bee.${this.type}.process`, { taskId: task.id }, async (span) => {
      // ... implementation
    });
  }

  async stop() {
    this._running = false;
    await this._bus.publish(TOPICS.BEE_WORKER_TERMINATED, { beeId: this.id, type: this.type });
  }

  // Required: BeeFactory calls this for health checks
  async healthCheck() {
    return { healthy: this._running, beeId: this.id, type: this.type };
  }
}

module.exports = { Heady{Domain}{Function}Bee, BEE_NAME, BEE_TYPE };
```

### Registering a bee type

In `bee-factory.js`, bee types are loaded dynamically from `BEES_DIR`. File naming is the registry — there is no separate registration step. The factory scans for `*-bee.js` files.

---

## 10. Architecture Integration Files

These 6 files are the **new infrastructure backbone**. They live in `heady-improvements/architecture/` during development and must be copied to the root of each core package during implementation.

### `ecosystem-integration-map.js`

**What it is:** The single source of truth for service URLs, event topics, and domain mappings.

**Key exports:**
```javascript
const { SERVICES, EVENT_TOPICS, HEADY_DOMAINS, HeadyEcosystemMap } = require('./ecosystem-integration-map');

SERVICES['headyapi']       // → { name, domains, cloudRun, worker, priority, ... }
EVENT_TOPICS.PIPELINE_RUN  // → 'heady:pipeline:run:completed'
HEADY_DOMAINS              // → ['headyme.com', 'headysystems.com', ...]
```

**When to edit:** When adding a new domain, service, or canonical event topic. Edit `SERVICES` map and `EVENT_TOPICS` object, then run `HeadyEcosystemMap.validate()`.

### `heady-event-bus.js`

**What it is:** Centralized pub/sub. Replaces `global.eventBus`, `process.on()`, and scattered local EventEmitters.

**Key API:**
```javascript
const { getEventBus, TOPICS } = require('./heady-event-bus');
const bus = getEventBus();
await bus.start();                            // connects to Redis if available
await bus.publish(TOPICS.X, { ...data });    // publish
bus.subscribe(TOPICS.X, handler);            // subscribe
bus.subscribePattern('heady:pipeline:*', h); // wildcard
bus.replay(TOPICS.X, { since });             // replay missed events
```

**Backends:** Local EventEmitter (always on) + Redis pubsub (if `REDIS_URL` set) + GCP Pub/Sub (if `GCP_PROJECT` set).

### `heady-service-mesh.js`

**What it is:** Dynamic service registry replacing hard-coded URLs in `heady-registry.json`, `edge-diffusion.js:14`, and `buddy-core.js`.

**Key API:**
```javascript
const { getServiceMesh } = require('./heady-service-mesh');
const mesh = getServiceMesh();
await mesh.start();
const url = await mesh.resolve('headyapi');  // returns healthy endpoint URL
mesh.register({ name: 'headyapi', url: '...', weight: 1.0 });
```

**Circuit breaker states:** `CLOSED` (healthy) → `OPEN` (tripped after 5 failures) → `HALF_OPEN` (probe after φ² × 10 s).

### `heady-config-server.js`

**What it is:** All hardcoded constants extracted into one configurable location.

**Key API:**
```javascript
const { getConfigServer, KNOWN_KEYS } = require('./heady-config-server');
const cfg = getConfigServer();
await cfg.start();

cfg.get('buddy.maxLog')                       // → 200
cfg.get('selfAwareness.driftThreshold')       // → 0.75
cfg.set('pipeline.maxConcurrentRuns', 20)     // runtime hot override
cfg.watch('buddy.maxLog', (nv) => { ... })    // subscribe to changes
```

**Config file:** `/etc/heady/config.json` (or `HEADY_CONFIG_FILE` env var).  
**GCP secrets:** Set `HEADY_SECRETS=heady-prod-config` and the server polls Secret Manager.  
**Env override:** `HEADY_BUDDY_MAX_LOG=400` overrides `buddy.maxLog`.

### `heady-observability.js`

**What it is:** Distributed tracing + Prometheus metrics + structured JSON logs.

**Key API:**
```javascript
const { getObservability } = require('./heady-observability');
const obs = getObservability({ service: 'headyapi' });
await obs.start();

// In Express:
app.use(obs.requestMiddleware());   // adds X-Heady-Trace-Id to all requests
app.use(obs.errorMiddleware());

// Manual span:
await obs.tracer.withSpan('my.operation', async (span) => {
  span.setAttribute('userId', userId);
  // ... your code
});

// Metrics:
obs.metrics.counter('heady_pipeline_runs_total').inc({ service: 'headyapi', status: 'started' });
obs.metrics.histogram('heady_pipeline_stage_duration_ms').observe(durationMs, { stage: 'ARENA' });

// Logger (structured JSON → Cloud Logging):
obs.logger.info('Pipeline run completed', { runId, durationMs });
obs.logger.error('Stage failed', { stage: 'ARENA', error: err.message, stack: err.stack });
```

**Prometheus endpoint:** `GET /api/v2/obs/metrics` (no auth — Prometheus scrapes directly).  
**Trace headers propagated:** `X-Heady-Trace-Id`, `X-Heady-Span-Id`, `X-Heady-Parent-Id`.

### `heady-api-gateway-v2.js`

**What it is:** The single HTTP entry point for all Heady API traffic.

**Key API:**
```javascript
const { createGateway } = require('./heady-api-gateway-v2');
const gw = createGateway();
await gw.start();  // listens on gateway.port (default 8080)
```

**Auth flows:**
- `Authorization: Bearer <JWT>` — HS256 signed (secret from config server `gateway.jwtSecret`)
- `X-Heady-Key: <keyId>.<hmac>` — service-to-service
- `X-Admin-Token: <token>` — admin routes only

**Rate limits:** 60 req/min anonymous, 1000 req/min authenticated (all configurable via config server).

---

## 11. Known Bugs & Fixes

These bugs exist in the production codebase. **Do not introduce new code that replicates them.**

### Bug 1: `heady-conductor.js:136` — durationMs always 0

```javascript
// BUG (current code):
delete this.activeExecution;   // line ~133 — deletes startTime
// ...
const durationMs = Date.now() - this.activeExecution?.startTime;  // line 136 — always undefined → 0

// FIX:
const startTime = this.activeExecution?.startTime ?? Date.now();
delete this.activeExecution;
const durationMs = Date.now() - startTime;
```

### Bug 2: `vector-memory.js` — missing methods called throughout codebase

`queryMemory()` and `ingestMemory()` are called in `self-awareness.js`, `buddy-core.js`, and `hc-full-pipeline.js` but do not exist on the `VectorMemory` class.

```javascript
// FIX: Add to VectorMemory class:
async ingestMemory(text, metadata = {}) {
  const embedding = await this._embed(text);
  const id = crypto.randomUUID();
  this._store.set(id, { id, text, embedding, metadata, ts: Date.now() });
  return id;
}

async queryMemory(query, topK = this._topK) {
  const queryEmbed = await this._embed(query);
  // cosine similarity against all stored vectors
  const results = [];
  for (const [id, entry] of this._store) {
    const score = cosineSimilarity(queryEmbed, entry.embedding);
    results.push({ id, score, text: entry.text, metadata: entry.metadata });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}
```

### Bug 3: `self-awareness.js:33-34` — imports class, not instance

```javascript
// BUG:
const VectorMemory = require('./vector-memory');  // line 33 — imports the class
// ...
this.vectorMemory = new VectorMemory();            // line 34 — creates a new disconnected instance

// FIX:
const { VectorMemory } = require('./vector-memory');
// Use singleton if available:
this.vectorMemory = VectorMemory.getInstance ? VectorMemory.getInstance() : new VectorMemory();
```

### Bug 4: `bee-factory.js:35` — BEES_DIR = `__dirname`

```javascript
// BUG:
const BEES_DIR = __dirname;    // line 35 — bees would be created in source dir

// FIX:
const { getConfigServer } = require('./heady-config-server');
const BEES_DIR = getConfigServer().get('beeFactory.beesDir');  // → /project/root/bees/
```

### Bug 5: `hc-full-pipeline.js:48` — runs Map never pruned (memory leak)

```javascript
// BUG:
this.runs = new Map();           // entries are added but never removed

// FIX: Add TTL-based pruning:
_pruneRuns() {
  const ttl = this._cfg.get('pipeline.runTtlMs', 3_600_000);
  const cutoff = Date.now() - ttl;
  for (const [id, run] of this.runs) {
    if (run.completedAt && run.completedAt < cutoff) {
      this.runs.delete(id);
    }
  }
}
// Call _pruneRuns() in setInterval every PHI * 60_000 ms
```

### Bug 6: `hc-full-pipeline.js` ARENA stage — fake LLM scores

```javascript
// BUG: Line ~200 — ARENA stage uses Math.random() instead of real LLM evaluation
const score = Math.random();   // ← not real scoring

// FIX: Wire to actual LLM scoring via BuddyCore.mcpToolRegistry or direct API call
```

### Bug 7: `ternary-logic.js` — JSON.stringify shadow index comparison

```javascript
// BUG: Shadow index uses JSON.stringify as Map key — objects with same values
// but different key order produce different keys:
const key = JSON.stringify(input);  // ← order-sensitive

// FIX: Sort keys before stringify, or use a stable hash:
const key = JSON.stringify(Object.keys(input).sort().reduce((acc, k) => { acc[k] = input[k]; return acc; }, {}));
```

### Bug 8: `edge-diffusion.js:14` — complete stub

```javascript
// BUG: Returns fake URLs, never calls any real API
return { url: 'https://placeholder.heady.ai/image.png' };

// FIX: Call real HuggingFace endpoint (configured via config server):
const endpoint = cfg.get('edgeDiffusion.realEndpoint');
// ... real HTTP call
```

### Bug 9: `heady-registry.json` vs `package.json` version mismatch

- `package.json` declares `"version": "3.1.0"`
- `heady-registry.json` declares `"version": "3.0.1"`

Keep both in sync. `heady-registry.json` is the service registry version, `package.json` is the software version. They are allowed to differ, but both must be documented.

---

## 12. How to Make Changes

### Decision tree: which file to edit

```
Is it a configuration value (threshold, timeout, limit)?
  → heady-config-server.js  (add to DEFAULTS, never hardcode)

Is it a new API endpoint?
  → heady-api-gateway-v2.js  (add to _v2Router(), never v1 unless existing)
  → (plus: the implementing service's route handler)

Is it a new cross-service event?
  → heady-event-bus.js  (add to TOPICS constant)
  → ecosystem-integration-map.js  (add to EVENT_TOPICS)

Is it a new service or domain?
  → ecosystem-integration-map.js  (add to SERVICES)
  → heady-service-mesh.js  (register)
  → heady-api-gateway-v2.js  (_fallbackUrl + CORS)
  → PRODUCTION_DEPLOYMENT_GUIDE.md  (routing table)

Is it a new metric to track?
  → heady-observability.js  (_registerStandardMetrics())

Is it in the pipeline processing logic?
  → hc-full-pipeline.js  (one of 9 stages)

Is it bee spawning / lifecycle?
  → heady-conductor.js  (orchestration)
  → bee-factory.js  (creation, health-checking)
  → bees/{name}-bee.js  (individual bee implementation)

Is it AI reasoning / metacognition?
  → buddy-core.js  (BuddyCore, MetacognitionEngine)
  → self-awareness.js  (telemetry, drift detection)

Is it creative content generation?
  → creative-engine.js

Is it image / diffusion generation?
  → edge-diffusion.js  (replace stub with real implementation)

Is it a three-valued decision?
  → ternary-logic.js  (TernaryDecisionMatrix)
```

### Change checklist

Before committing any change:

- [ ] Does it reference a config key instead of a hardcoded constant?
- [ ] Does it publish events through HeadyEventBus (not process.on or global.eventBus)?
- [ ] Does it use `obs.tracer.withSpan()` for operations > 10ms?
- [ ] Does it increment relevant Prometheus metrics?
- [ ] Does it use `obs.logger.info/error()` instead of `console.log`?
- [ ] Does it resolve service URLs through HeadyServiceMesh, not hardcoded URLs?
- [ ] Does it follow the `heady:{service}:{noun}:{verb}` event naming pattern?
- [ ] New API endpoints go to `/api/v2/` (not v1)?
- [ ] BEES_DIR comes from config server, not `__dirname`?
- [ ] durationMs measured BEFORE deleting activeExecution?

---

## 13. Configuration Reference

All configurable values. Override via env var or `/etc/heady/config.json`.

| Config Key | Default | Env Var | Source File |
|---|---|---|---|
| `phi` | `1.6180339887` | *(readonly)* | `ternary-logic.js:8` |
| `conductor.maxBees` | `50` | `HEADY_CONDUCTOR_MAX_BEES` | `heady-conductor.js:22` |
| `conductor.heartbeatIntervalMs` | `5000` | `HEADY_CONDUCTOR_HEARTBEAT_INTERVAL_MS` | `heady-conductor.js:30` |
| `pipeline.maxConcurrentRuns` | `10` | `HEADY_PIPELINE_MAX_CONCURRENT_RUNS` | `hc-full-pipeline.js:47` |
| `pipeline.runTtlMs` | `3600000` | `HEADY_PIPELINE_RUN_TTL_MS` | *(new — fixes memory leak)* |
| `selfAwareness.driftThreshold` | `0.75` | `HEADY_SELF_AWARENESS_DRIFT_THRESHOLD` | `self-awareness.js:42` |
| `selfAwareness.heartbeatIntervalMs` | `30000` | `HEADY_SELF_AWARENESS_HEARTBEAT_INTERVAL_MS` | `self-awareness.js:41` |
| `selfAwareness.telemetryRingSize` | `500` | `HEADY_SELF_AWARENESS_TELEMETRY_RING_SIZE` | `self-awareness.js:46` |
| `buddy.maxLog` | `200` | `HEADY_BUDDY_MAX_LOG` | `buddy-core.js:28` |
| `buddy.taskLockTtlMs` | `30000` | `HEADY_BUDDY_TASK_LOCK_TTL_MS` | `buddy-core.js:26` |
| `vectorMemory.defaultTopK` | `5` | `HEADY_VECTOR_MEMORY_DEFAULT_TOP_K` | `vector-memory.js:45` |
| `vectorMemory.embeddingDimension` | `1536` | `HEADY_VECTOR_MEMORY_EMBEDDING_DIMENSION` | `vector-memory.js:12` |
| `beeFactory.beesDir` | `./bees` | `HEADY_BEE_FACTORY_BEES_DIR` | `bee-factory.js:35` |
| `edgeDiffusion.realEndpoint` | `https://api-inference.huggingface.co/...` | `EDGE_DIFFUSION_URL` | `edge-diffusion.js:14` |
| `gateway.port` | `8080` | `PORT` | Cloud Run default |
| `gateway.rateLimitWindowMs` | `60000` | `HEADY_GATEWAY_RATE_LIMIT_WINDOW_MS` | `heady-api-gateway-v2.js:60` |
| `gateway.rateLimitMaxRequests` | `100` | `HEADY_GATEWAY_RATE_LIMIT_MAX_REQUESTS` | `heady-api-gateway-v2.js:61` |
| `gateway.jwtSecret` | *(GCP secret)* | `JWT_SECRET` | MUST set in production |
| `infra.cloudRunUrl` | `https://heady-manager-609590223909.us-central1.run.app` | `CLOUD_RUN_URL` | registry |
| `infra.redisUrl` | `redis://localhost:6379` | `REDIS_URL` | deployment guide |
| `infra.postgresUrl` | `postgresql://localhost:5432/heady` | `DATABASE_URL` | deployment guide |
| `infra.gcpProject` | `heady-prod-609590223909` | `GCP_PROJECT` | registry |

### Runtime override via API

```bash
# Get current value
curl -H "X-Admin-Token: $ADMIN_TOKEN" https://headyapi.com/api/v2/admin/config/buddy.maxLog

# Change at runtime (no restart needed)
curl -X PUT -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"value": 400}' \
     https://headyapi.com/api/v2/admin/config/buddy.maxLog

# Revert to default
curl -X DELETE -H "X-Admin-Token: $ADMIN_TOKEN" \
     https://headyapi.com/api/v2/admin/config/buddy.maxLog

# Force reload from file/GCP
curl -X POST -H "X-Admin-Token: $ADMIN_TOKEN" \
     https://headyapi.com/api/v2/admin/config/reload
```

---

## 14. Infrastructure & Deployment

### GCP Architecture

```
Internet
    │
    ▼
Cloudflare (WAF + DDoS)
    │
    ▼  (Cloudflare Tunnel)
Cloud Run — heady-manager (us-central1)
    │            └─ PORT 8080
    │            └─ Node 22 Alpine
    │            └─ Min instances: 1, Max: 10
    │
    ├─ Cloud SQL (PostgreSQL 16 + pgvector)
    │    └─ 18 tables (see PRODUCTION_DEPLOYMENT_GUIDE.md)
    │
    ├─ Cloud Memorystore (Redis 7)
    │    └─ Used by: event bus, rate limiter, session store
    │
    ├─ GCP Pub/Sub
    │    ├─ heady-swarm-tasks      ← task distribution
    │    ├─ heady-admin-triggers   ← admin operations
    │    └─ heady-dead-letter      ← failed message queue
    │
    ├─ Secret Manager
    │    └─ JWT_SECRET, DATABASE_URL, REDIS_URL, API_KEY_SECRET
    │
    └─ HuggingFace Spaces (edge-diffusion)
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "heady-manager.js"]
```

### Cloud Run deployment

```bash
gcloud run deploy heady-manager \
  --image gcr.io/heady-prod-609590223909/heady-manager:latest \
  --region us-central1 \
  --port 8080 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars NODE_ENV=production,GCP_PROJECT=heady-prod-609590223909 \
  --set-secrets JWT_SECRET=heady-jwt-secret:latest,DATABASE_URL=heady-db-url:latest,REDIS_URL=heady-redis-url:latest
```

### Environment variables (required in production)

```bash
# Required
NODE_ENV=production
PORT=8080
JWT_SECRET=<from GCP Secret Manager>
DATABASE_URL=postgresql://...  # Cloud SQL
REDIS_URL=redis://...          # Cloud Memorystore
GCP_PROJECT=heady-prod-609590223909
GCP_REGION=us-central1

# Optional (config server provides defaults)
HEADY_LOG_LEVEL=info
HEADY_LOG_PRETTY=false         # Set true for local dev
EDGE_DIFFUSION_URL=https://api-inference.huggingface.co/...
HEADY_CONFIG_FILE=/etc/heady/config.json
HEADY_SECRETS=heady-prod-config  # GCP Secret Manager secret ID
```

### PostgreSQL schema tables (18 tables)

See `PRODUCTION_DEPLOYMENT_GUIDE.md` for full DDL. Key tables:

```
users, sessions, api_keys, pipeline_runs, pipeline_stages,
bee_registry, bee_health, vector_memories, creative_generations,
telemetry_snapshots, config_overrides, event_log, mcp_tools,
mcp_executions, ternary_decisions, audit_log, rate_limit_windows, service_registry
```

---

## 15. Testing Standards

### Unit tests

```javascript
// Every module must have a companion test file: *.test.js
// Use Node's built-in test runner (Node 22):
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Reset singletons between tests:
const { _resetConfigServerForTests } = require('./heady-config-server');
const { _resetObservabilityForTests } = require('./heady-observability');
const { _resetGatewayForTests }       = require('./heady-api-gateway-v2');

describe('HeadyConfigServer', () => {
  before(async () => {
    _resetConfigServerForTests();
    cfg = getConfigServer({ configFile: '/tmp/test-config.json' });
    await cfg.start();
  });
  after(() => cfg.stop());

  it('returns default value', () => {
    assert.equal(cfg.get('buddy.maxLog'), 200);
  });

  it('blocks readonly override', () => {
    assert.throws(() => cfg.set('phi', 3.14), /readonly/);
  });
});
```

### Integration tests

Test the full pipeline end-to-end:

```bash
# POST a pipeline run and verify SSE stream
curl -N -H "Authorization: Bearer $TOKEN" \
     https://headyapi.com/api/v2/pipeline/stream/test-run-001 &

curl -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content": "test input", "runId": "test-run-001"}' \
     https://headyapi.com/api/v2/pipeline/run
```

### Health checks

```bash
# Liveness
curl https://heady-manager-609590223909.us-central1.run.app/health

# Readiness
curl https://heady-manager-609590223909.us-central1.run.app/ready

# Prometheus metrics
curl https://headyapi.com/api/v2/obs/metrics

# Service mesh status
curl -H "X-Admin-Token: $ADMIN_TOKEN" https://headyapi.com/api/v2/admin/mesh

# Config diff vs defaults
curl -H "X-Admin-Token: $ADMIN_TOKEN" https://headyapi.com/api/v2/admin/config/diff
```

---

## 16. Do's and Don'ts

### DO

- **DO** use `getConfigServer().get('key')` for every constant that should be tunable
- **DO** use `TOPICS.X` constants, never raw event-name strings
- **DO** use `obs.tracer.withSpan()` for any async operation exceeding 10ms
- **DO** use `obs.logger.info/error()` instead of `console.log/error`
- **DO** resolve service URLs through `mesh.resolve('serviceName')`
- **DO** put new API endpoints in `/api/v2/`
- **DO** export classes (not singletons) from modules; expose `getInstance()` / `get*()` factory
- **DO** use `PHI` for timing intervals: `Math.round(PHI * N_ms)`
- **DO** put bee files in `bees/` directory (config: `beeFactory.beesDir`)
- **DO** propagate `X-Heady-Trace-Id` on all outbound HTTP calls
- **DO** test `readonly` config keys cannot be overridden at runtime
- **DO** use `crypto.timingSafeEqual` for all secret comparisons (never `===`)

### DON'T

- **DON'T** hardcode any number that appears in `heady-config-server.js`'s `DEFAULTS`
- **DON'T** use `process.on('message', ...)` or `global.eventBus` — use HeadyEventBus
- **DON'T** use `console.log` in production code — use structured logger
- **DON'T** hardcode domain URLs like `https://headyapi.com` — use service mesh
- **DON'T** add new features to `/api/v1/` routes
- **DON'T** set `BEES_DIR = __dirname` — use config server
- **DON'T** delete `activeExecution` before reading its `startTime` (conductor bug)
- **DON'T** use `JSON.stringify` as a Map key for objects — sort keys first
- **DON'T** return fake/placeholder data from production endpoints (edge-diffusion.js pattern)
- **DON'T** create a new VectorMemory instance in each service — use the singleton
- **DON'T** skip `await cfg.start()` before calling `cfg.get()`
- **DON'T** add new domains without updating all 4 locations (CORS, routing, Cloudflare, docs)
- **DON'T** change `PHI = 1.6180339887` — it is a mathematical constant, not a config

---

## Quick Reference Card

```
ENTRY POINT:     heady-manager.js (10-phase bootstrap)
SWARM:           heady-conductor.js → bee-factory.js → bees/*.js
PIPELINE:        hc-full-pipeline.js (INTAKE→RECEIPT, 9 stages)
AI:              buddy-core.js (BuddyCore, MetacognitionEngine)
MEMORY:          vector-memory.js (VectorMemory — needs ingestMemory/queryMemory FIX)
TELEMETRY:       self-awareness.js (SelfAwareness — needs VectorMemory import FIX)
CREATIVE:        creative-engine.js (7 styles)
IMAGES:          edge-diffusion.js (STUB — replace with real HuggingFace call)
DECISIONS:       ternary-logic.js (TernaryDecisionMatrix {-1,0,+1})

INFRA:
  Config:        heady-config-server.js    → cfg.get('key')
  Events:        heady-event-bus.js        → bus.publish(TOPICS.X, data)
  Discovery:     heady-service-mesh.js     → mesh.resolve('service')
  Observability: heady-observability.js    → obs.tracer / obs.metrics / obs.logger
  Gateway:       heady-api-gateway-v2.js   → /api/v2/* endpoints

CLOUD RUN:       https://heady-manager-609590223909.us-central1.run.app
GCP PROJECT:     heady-prod-609590223909
GCP REGION:      us-central1
NODE VERSION:    22-alpine
PORT:            8080 (Cloud Run)

PHI:             1.6180339887  ← USE EVERYWHERE for timing/routing/sizing
EMAIL:           eric@headyconnection.org
COMPANY:         HeadySystems Inc.
```

---

*This document is the authoritative Windsurf IDE reference for the Heady ecosystem. When in doubt, consult the source files referenced by line number, or ask eric@headyconnection.org.*
