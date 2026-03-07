# Heady™ Systems

[![Deploy](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/deploy.yml/badge.svg)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/actions/workflows/deploy.yml)

> **v3.1.0** · Sacred Geometry Multi-Agent Orchestration · φ-Scaled Resilience · MCP Integration

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
npm install
cp .env.example .env
npm run dev
```

> **Note:** This project uses `npm` as its package manager.

## Architecture

```
heady-manager.js                # Node.js MCP Server & API Gateway
├── src/
│   ├── orchestration/          # Pipeline, conductor, self-optimizer (25 files)
│   ├── memory/                 # Vector memory, search, federation (11 files)
│   ├── agents/                 # Bees (58 workers), buddy, templates (13 files)
│   ├── intelligence/           # Research, scanning, ML (14 files)
│   ├── runtime/                # Cloud infra, compute, deployment (12 files)
│   ├── auth/                   # Authentication, authorization, tiers (5 files)
│   ├── mcp/                    # MCP server, connectors (7 files)
│   ├── observability/          # Structured logger, health probes (7 files)
│   ├── integrations/           # Provider connectors, SDKs (4 files)
│   ├── shared/                 # Utils, registry, policies (11 files)
│   ├── types/                  # TypeScript definitions
│   ├── routes/                 # HTTP route handlers (52 files)
│   ├── services/               # Service implementations (75 files)
│   └── bees/                   # 26 domain-specific HeadyBee workers
├── tests/                      # Unit, integration, and e2e tests
├── configs/                    # YAML configuration
├── docs/                       # Architecture, patents, API specs
└── .github/workflows/          # Deploy pipeline (security → validate → deploy)
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
- **Lockfile:** `package-lock.json` (npm)

## Security

- All secrets managed via Cloud Run environment variables (never in code)
- Git history sterilized via `git filter-repo` (no credentials in any commit)
- Pre-commit hook scans for high-entropy strings
- CodeQL + Gitleaks + SBOM scanning in CI
- See [SECURITY.md](SECURITY.md) for vulnerability disclosure

## License

© 2026 Heady™ — HeadySystems Inc. Proprietary and Confidential.

Heady™ is a trademark of HeadyConnection Inc. USPTO Serial No. 99680540.
