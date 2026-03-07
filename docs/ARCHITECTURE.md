# Heady™ Projection System — Architecture

> © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.

---

## Overview

The Heady™ Projection System is the real-time state observation layer of the Heady AI Platform. It maintains six continuously-updated domain projections that any service in the platform can query to understand the current state of the swarm.

**Core principles:**
- **Event-driven** — projections push updates via SSE to interested consumers
- **Golden ratio timing** — all intervals are derived from PHI (1.6180339887) to stagger polling and avoid thundering-herd effects
- **Domain isolation** — each projection domain is owned by a dedicated HeadyBee
- **Eventual consistency** — projections converge on truth as bees complete their work cycles

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Heady™ AI Platform                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  HeadyConductor (port 3848)                                  │  │
│  │  Orchestrates bee assignments, health aggregation            │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                           │  register / heartbeat                  │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Projection Service (port 3849)                              │  │
│  │                                                              │  │
│  │  ┌─────────────────┐   ┌────────────────────────────────┐   │  │
│  │  │ ProjectionManager│   │        ProjectionSwarm         │   │  │
│  │  │                 │◄──┤                                │   │  │
│  │  │  Map<domain,    │   │  ┌──────────────────────────┐  │   │  │
│  │  │   state>        │   │  │  vector-memory-bee  φ×8s │  │   │  │
│  │  │                 │   │  │  config-bee         10s  │  │   │  │
│  │  │  emits:         │   │  │  health-bee         φ×6s │  │   │  │
│  │  │  'projection'   │   │  │  telemetry-bee      4s   │  │   │  │
│  │  └────────┬────────┘   │  │  topology-bee       15s  │  │   │  │
│  │           │            │  │  task-queue-bee     5s   │  │   │  │
│  │           │            │  └──────────────────────────┘  │   │  │
│  │           ▼            └────────────────────────────────┘   │  │
│  │  ┌─────────────────┐                                         │  │
│  │  │  SSEBroadcaster │   GET /api/projections/sse              │  │
│  │  │  n clients ────►├──────────────────────────────────────► │  │
│  │  └─────────────────┘                                         │  │
│  │                                                              │  │
│  │  GET /api/projections        (snapshot all)                  │  │
│  │  GET /api/projections/:domain (snapshot one)                 │  │
│  │  GET /health                  (service health)               │  │
│  │  GET /api/swarm               (swarm stats)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           │  HTTP proxy /api/*                     │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Dashboard Server (port 3850)                                │  │
│  │                                                              │  │
│  │  Serves index.html (SPA)                                     │  │
│  │  Proxies /api/* → Projection Service                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           │  Browser SSE                           │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Dashboard SPA (browser)                                     │  │
│  │                                                              │  │
│  │  6 projection cards — auto-updates via SSE                   │  │
│  │  PHI-backoff reconnect on disconnect                         │  │
│  │  Mock data fallback for offline preview                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Redis (port 6379)   — optional caching layer               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL           — projection persistence + history    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Bee Poll Loop (every φ×N ms)
         │
         ▼
 worker functions run in parallel (maxConcurrent = 6)
         │
         ▼
 ProjectionManager.update(domain, state)
   ├── version++
   ├── stores in Map<domain, ProjectionState>
   └── emits 'projection' event
                │
                ├── SSEBroadcaster.broadcast(projection)
                │       └── sends event frame to all SSE clients
                │
                └── (optional) PostgreSQL upsert via upsert_projection()
                        └── appends to projection_history
```

---

## PHI-Scaled Timing

All bee polling intervals derive from PHI to stagger load:

| Bee             | Interval         | Formula              |
|-----------------|------------------|----------------------|
| vector-memory   | ~8,090 ms        | 5000 × φ¹            |
| config          | 10,000 ms        | fixed                |
| health          | ~6,180 ms        | φ⁶ × 1000            |
| telemetry       | 4,000 ms         | fixed                |
| topology        | 15,000 ms        | fixed                |
| task-queue      | 5,000 ms         | fixed                |
| SSE heartbeat   | ~10,000 ms       | fixed                |
| Circuit breaker recovery | ~16,180 ms | φ⁵ × 10000    |

PHI backoff sequence (base=500ms): 809ms → 1309ms → 2118ms → 3427ms → 5545ms → …

---

## Monorepo Structure

```
heady-projection/
├── package.json              # Workspace root (npm workspaces)
├── turbo.json                # Turborepo pipeline config
├── tsconfig.json             # Root TS config + @heady/* path aliases
├── Dockerfile                # Multi-stage production image
├── docker-compose.yml        # Local dev: service + dashboard + redis
│
├── apps/
│   ├── projection-service/   # Core projection service (port 3849)
│   │   └── index.js          # Entry point: Express + Swarm + SSE
│   └── dashboard/            # Dashboard server (port 3850)
│       ├── index.html        # SPA — all CSS/JS embedded
│       └── server.js         # Express proxy + static serve
│
├── packages/
│   ├── shared-types/         # @heady/shared-types
│   │   └── src/index.js      # Enums, JSDoc types, constants
│   └── shared-utils/         # @heady/shared-utils
│       └── src/index.js      # debounce, throttle, phiInterval, etc.
│
├── scripts/
│   ├── scaffold-cli.js       # node scripts/scaffold-cli.js --type app --name my-app
│   └── generate-bee.js       # node scripts/generate-bee.js --domain my-domain
│
├── configs/
│   └── projection-config.yaml
│
├── migrations/
│   └── 001_projection_tables.sql
│
├── docs/
│   ├── ARCHITECTURE.md       # This file
│   └── PROJECTION-TYPES.md   # Per-domain schema & examples
│
└── .github/workflows/
    ├── ci.yml                # Lint → Test → Build
    └── deploy-cloud-run.yml  # Build Docker → Push → Deploy
```

---

## API Reference

### Projection Service (port 3849)

| Method | Path                        | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/health`                   | Service health including swarm stats           |
| GET    | `/api/projections`          | Snapshot of all current projections            |
| GET    | `/api/projections/:domain`  | Snapshot of a single domain                    |
| GET    | `/api/projections/sse`      | SSE stream — receives events as bees update    |
| GET    | `/api/swarm`                | Swarm health: run counts, error ratios         |

#### SSE Event Format

```
event: vector-memory
data: {"domain":"vector-memory","version":42,"state":{...},"updatedAt":1710000000000}

event: heartbeat
data: {"ts":1710000000000}

event: connected
data: {"ts":1710000000000,"phi":1.6180339887}
```

#### ProjectionState Shape

```json
{
  "domain":    "health",
  "version":   17,
  "state":     { ...domain-specific fields... },
  "prev":      { ...previous state or null... },
  "updatedAt": 1710000000000
}
```

### Dashboard Server (port 3850)

| Method | Path         | Description                                |
|--------|--------------|--------------------------------------------|
| GET    | `/`          | Serves dashboard SPA (index.html)          |
| GET    | `/_health`   | Dashboard server health check              |
| ANY    | `/api/*`     | Proxied to Projection Service              |

---

## Configuration Reference

See `configs/projection-config.yaml` for the full annotated configuration.

Key settings:

| Key                            | Default        | Description                          |
|-------------------------------|----------------|--------------------------------------|
| `phi`                          | 1.6180339887   | Golden ratio constant                |
| `swarm.max_concurrent`         | 6              | Max parallel bee workers             |
| `swarm.error_threshold`        | 0.3            | Circuit breaker trip ratio           |
| `sse.heartbeat_interval_ms`    | 10000          | Heartbeat ping frequency             |
| `sse.max_clients`              | 100            | Max concurrent SSE connections       |
| `cloud.pubsub.enabled`         | false          | Enable GCP Pub/Sub broadcast         |
| `features.drift_detection`     | true           | Enable config drift detection        |

---

## Deployment Guide

### Local Development

```bash
# Install dependencies
npm install

# Start projection service + dashboard
npm run projection:dev
npm run dashboard

# Or with Docker Compose
docker compose up --build
```

Access the dashboard at: http://localhost:3850

### Cloud Run

1. Set GitHub secrets:
   - `WIF_PROVIDER` — Workload Identity Federation provider
   - `WIF_SERVICE_ACCOUNT` — WIF service account email

2. Set GitHub variables:
   - `GCP_PROJECT_ID` — GCP project ID
   - `GCP_REGION` — deployment region (default: `us-central1`)

3. Push to `main` — CI runs lint/test/build, then deploys on success.

Deployment pipeline: `.github/workflows/ci.yml` → `.github/workflows/deploy-cloud-run.yml`

### Scaffold a new package

```bash
node scripts/scaffold-cli.js --type package --name my-analyzer
node scripts/scaffold-cli.js --type app --name my-service
```

### Generate a new bee

```bash
node scripts/generate-bee.js --domain logs --description "Monitors application logs" --priority 0.6 --category monitor
node scripts/generate-bee.js --domain logs --template monitor
```

---

## Database

Run migrations:

```bash
psql -d heady_db -f migrations/001_projection_tables.sql
```

Useful queries:

```sql
-- Current state of all projections
SELECT type, version, state, updated_at FROM latest_projections;

-- Health projection history (last 24h)
SELECT version, state->>'overallScore' AS score, snapshot_at
FROM projection_history
WHERE type = 'health'
  AND snapshot_at > NOW() - INTERVAL '24 hours'
ORDER BY snapshot_at DESC;

-- CPU metric trend
SELECT value, recorded_at
FROM projection_metrics
WHERE type = 'telemetry' AND metric_name = 'cpu_percent'
ORDER BY recorded_at DESC
LIMIT 100;
```

---

*PHI = 1.6180339887 — the golden ratio governs all timing in this system.*
