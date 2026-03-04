# Heady™ Systems

[![CI/CD Pipeline](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/heady-consolidated-ci.yml/badge.svg)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/heady-consolidated-ci.yml)
[![Security Scan](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/security-scan.yml/badge.svg)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/security-scan.yml)
[![SBOM & Container](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/sbom-container-scan.yml/badge.svg)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/sbom-container-scan.yml)
[![Branding](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/branding-enforcement.yml/badge.svg)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/branding-enforcement.yml)

> **v3.0.1** · Sacred Geometry Multi-Agent Orchestration · φ-Scaled Resilience · MCP Integration

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Systems](#core-systems)
- [API Endpoints](#api-endpoints)
- [Health Probes](#health-probes)
- [Resilience Stack](#resilience-stack)
- [HeadyBees (Agent Decomposition)](#headybees-agent-decomposition)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

> **Note:** This project uses `pnpm` exclusively. Do not use `npm` or `yarn`.

## Architecture

```
heady-manager.js                # Node.js MCP Server & API Gateway
├── src/
│   ├── hc-full-pipeline.js     # HCFullPipeline — 12-stage orchestration engine
│   ├── self-awareness.js       # Internal Monologue Loop — telemetry & metacognition
│   ├── vector-memory.js        # 3D Spatial Sharded Vector Store + Graph RAG
│   ├── orchestration/
│   │   ├── buddy-core.js       # Buddy — Central Intelligence Node (984 lines)
│   │   ├── buddy-watchdog.js   # Self-healing watchdog (hallucination detection)
│   │   └── heady-bees.js       # HeadyBees orchestration bridge
│   ├── bees/                   # 26 domain-specific HeadyBee workers (197 units)
│   │   ├── bee-factory.js      # Dynamic bee creation at runtime
│   │   └── registry.js         # Central bee registry + discovery
│   ├── resilience/
│   │   ├── circuit-breaker.js  # CLOSED→OPEN→HALF_OPEN for 16 services
│   │   ├── exponential-backoff.js # φ-scaled delays (PHI = 1.618...)
│   │   ├── pool.js             # Connection pooling
│   │   ├── rate-limiter.js     # Per-client rate limiting
│   │   ├── cache.js            # In-memory caching layer
│   │   └── retry.js            # Basic retry with jitter
│   ├── lifecycle/
│   │   └── graceful-shutdown.js # SIGTERM/SIGINT handlers, LIFO cleanup
│   └── routes/
│       └── health-routes.js    # /health/live, /health/ready, /health/full
├── config/                     # YAML configuration (single directory)
├── tests/                      # Unit, integration, and smoke tests
├── data/                       # Vector shards, buddy state, learned rules
└── .github/workflows/          # 10 CI/CD workflows
```

## Core Systems

| System | Description |
|---|---|
| **HCFullPipeline** | 12-stage pipeline: INTAKE → TRIAGE → MONTE\_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT |
| **Sacred Geometry** | Non-linear multi-agent orchestration with φ-based routing |
| **Buddy Core** | Sovereign orchestrator with MetacognitionEngine + DeterministicErrorInterceptor (5-phase ARCH loop) |
| **Self-Awareness** | Internal Monologue Loop — telemetry ingestion → ring buffer → vector memory → confidence scoring |
| **Vector Memory** | 3D spatial sharded store with Graph RAG, I(m) importance scoring, STM→LTM consolidation |
| **MCP Integration** | Model Context Protocol dual-role (Client + Server) with tool registry |

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Basic health check |
| `GET /api/pulse` | System pulse with layer info |
| `GET /api/system/status` | Full system status |
| `POST /api/pipeline/run` | Trigger pipeline run |
| `GET /api/pipeline/state` | Current pipeline state |
| `GET /api/nodes` | List all AI nodes |
| `GET /api/resilience/status` | Circuit breaker / pool / cache metrics |

## Health Probes

| Endpoint | Purpose | Checks |
|---|---|---|
| `GET /health/live` | Liveness (K8s) | Process alive, PID, uptime |
| `GET /health/ready` | Readiness (K8s) | Resilience, filesystem, memory, event loop, vector memory, self-awareness telemetry |
| `GET /health/full` | Deep introspection | Full system state including self-awareness introspection |

## Resilience Stack

| Primitive | Implementation |
|---|---|
| **Circuit Breakers** | CLOSED→OPEN→HALF\_OPEN, 16 pre-registered services |
| **φ-Exponential Backoff** | `1s → 1.6s → 2.6s → 4.2s → 6.9s → 11.1s → 17.9s → 29s` (PHI-scaled) |
| **Connection Pooling** | Pre-authenticated socket pools with timeout management |
| **Rate Limiting** | Per-client sliding window with configurable quotas |
| **Caching** | In-memory TTL cache with hit/miss metrics |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers, LIFO cleanup, 5s timeout per handler |

## HeadyBees (Agent Decomposition)

24 domains · 197 workers · Dynamic factory for runtime bee creation.

```javascript
const { createBee, spawnBee } = require('./src/bees/bee-factory');

// Create a full domain bee
const healthBee = createBee('health-monitoring', { interval: 30000 });

// Spawn an ephemeral single-purpose bee
const scanBee = spawnBee('port-scanner', async () => { /* work */ });
```

## Deployment

- **Platform:** Google Cloud Run via multi-stage Dockerfile
- **Container:** `node:22-alpine` · Non-root user (`heady:1001`)
- **CI/CD:** 10 GitHub Actions workflows (CodeQL SAST, Gitleaks, SBOM, dependency audit)
- **Edge:** Cloudflare Workers proxy layer
- **Lockfile:** `pnpm-lock.yaml` (pnpm-only)

## Security

- All secrets managed via Cloud Run environment variables (never in code)
- Git history sterilized via `git filter-repo` (no credentials in any commit)
- Pre-commit hook scans for high-entropy strings
- CodeQL + Gitleaks + SBOM scanning in CI
- See [SECURITY.md](SECURITY.md) for vulnerability disclosure

## License

© 2026 Heady™ Systems LLC. Proprietary and Confidential.

Heady™ is a trademark of HeadyConnection Inc. USPTO Serial No. 99680540.
