# Heady Systems — Developer Portal

> **Version**: 3.0.0-rc4 | **License**: UNLICENSED (Proprietary) | **Owner**: Heady Systems LLC

---

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode
node heady-manager.js

# Run tests
npm test

# Run full pipeline
npm run pipeline
```

**Default gateway**: `http://localhost:3301`
**API Docs**: `http://localhost:3301/api-docs`
**Health**: `http://localhost:3301/api/health`

---

## Architecture Overview

Heady is a **unified autonomous AI operating system** built on three mathematical pillars:

| Pillar | Foundation | Usage |
|--------|-----------|-------|
| **Sacred Geometry (φ)** | Golden Ratio 1.618... | Agent capacity, retry timing, load splits, UI proportions |
| **Base-13** | Proprietary number system | Tier classification, quality scoring, thresholds |
| **Log-42** | Logarithmic scaling | System parameter normalization |

All operations run in **3D vector workspace mode** where memory is stored as spatial coordinates (X=semantic, Y=temporal, Z=hierarchy) and indexed via Octree for O(log n) retrieval.

### Core Entry Point

[`heady-manager.js`](../heady-manager.js) — the main orchestrator that wires all services at boot:

```
Boot Sequence:
  1. Express + Security Middleware (Helmet, CORS, Rate Limiting)
  2. Core API + Swagger UI
  3. Auth Engine (4 methods: manual, device, WARP, Google OAuth)
  4. Vector Memory + Spatial Embedder + Octree Manager
  5. VectorSpaceOps (anti-sprawl, security, maintenance — all in 3D)
  6. Bee Swarm Discovery (33 bees auto-loaded)
  7. Antigravity Runtime (3D vector workspace enforcement)
  8. Buddy Chat Contract (user-scoped spatial namespaces)
  9. HeadyBee Template Registry (20 templates, 113 swarm tasks)
  10. Agent Orchestrator + Conductor + Pipeline
  11. Deep Research Engine + Cross-Device Sync
  12. Auto-Success Reactor (12 task catalogs loaded)
```

---

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Core services, routes, utilities |
| `src/bees/` | 33 autonomous bee agents (discovery, health, deployment, etc.) |
| `src/bootstrap/` | Modular boot wiring (engine, routes, static hosting, voice relay, health) |
| `src/services/` | Service layer (antigravity, buddy-chat, spatial-embedder, octree, etc.) |
| `src/routes/` | Express route handlers |
| `src/security/` | Code governance, secret rotation, handshake |
| `src/orchestration/` | Buddy Core, watchdog |
| `src/trading/` | Apex Risk Agent |
| `configs/` | JSON/YAML configuration files |
| `configs/services/` | Runtime policies, template registries, optimization reports |
| `scripts/` | Autonomous scripts (sync, optimize, maintenance) |
| `tests/` | Jest test suites |
| `docs/` | Architecture docs, API specs, IP/patent strategy |
| `sites/` | React apps (HeadyOS) |
| `heady-buddy/` | Chrome/Kiwi browser extension |
| `heady-hive-sdk/` | Official SDK for Heady AI services |
| `heady-ide-ui/` | VS Code-style IDE interface |
| `midi_bridge/` | Python MIDI ↔ Heady bridge |
| `oracle_service/` | Python oracle/prediction service |
| `packages/` | MCP server, Claude skill packages |
| `.github/workflows/` | 10 CI/CD workflows (CI, security, SBOM, deploy, etc.) |

---

## Key API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Service health |
| `/api/pulse` | GET | Full system pulse (version, layer, secrets, endpoints) |
| `/healthz` | GET | Kubernetes liveness probe |
| `/health/live` | GET | K8s liveness |
| `/health/ready` | GET | K8s readiness |

### Antigravity (3D Vector Workspace)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/antigravity/health` | GET | Runtime enforcement status |
| `/api/antigravity/enforce` | POST | Enforce operation through heady gateway |
| `/api/antigravity/policy` | GET | Read runtime policy |
| `/api/buddy-chat/request` | POST | Build 3D workspace chat request |
| `/api/buddy-chat/workspace` | POST | Generate user-scoped workspace ID |

### HeadyBee Templates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/headybee-template-registry/health` | GET | Registry health |
| `/api/headybee-template-registry/select` | POST | Select optimal templates for situation |
| `/api/headybee-template-registry/report` | GET | Full optimization report |

### Intelligence

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/brain/*` | POST | Chat, analyze, embed, search |
| `/api/buddy/deep-research` | POST | Multi-provider research fan-out |
| `/api/orchestrator/*` | GET/POST | Agent spawning, routing, execution |

### Security & Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate (manual/device/WARP/Google) |
| `/api/governance/*` | GET/POST | Code governance, protected path audit |
| `/api/secrets/*` | GET/POST | Secret management, audit, rotation |

---

## Sub-Project READMEs

| Package | Path | Description |
|---------|------|-------------|
| **Root** | [`README.md`](../README.md) | Main project overview |
| **Heady Hive SDK** | [`heady-hive-sdk/README.md`](../heady-hive-sdk/README.md) | Official SDK (40+ services) |
| **MCP Server** | [`packages/heady-mcp-server/README.md`](../packages/heady-mcp-server/README.md) | 60+ AI tools via MCP |
| **Claude Skill** | [`packages/claude-skill/README.md`](../packages/claude-skill/README.md) | HeadyJules MCP integration |
| **HeadyOS UI** | [`heady-ide-ui/README.md`](../heady-ide-ui/README.md) | React + Vite IDE interface |
| **Browser Extension** | [`heady-buddy/`](../heady-buddy/) | Chrome/Kiwi extension |
| **Ableton Remote** | [`ableton-remote-script/README.md`](../ableton-remote-script/README.md) | Buddy ↔ Ableton bridge |
| **Desktop Packages** | [`configs/INSTALLABLE_PACKAGES/README.md`](../configs/INSTALLABLE_PACKAGES/README.md) | Production build packages |

---

## Configuration

### Environment Variables

See [`.env.example`](../.env.example) for full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `HEADY_API_KEY` | ✅ | Admin API key |
| `PORT` | ❌ | Server port (default: 3301) |
| `NODE_ENV` | ❌ | Environment (development/production/test) |
| `OPENAI_API_KEY` | ❌ | OpenAI provider key |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic provider key |

### CI/CD Workflows

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `heady-consolidated-ci.yml` | push/PR to main | Quality → Security → Test → Build → Deploy |
| `security-scan.yml` | push + weekly cron | CodeQL + TruffleHog secret detection |
| `sbom-container-scan.yml` | push | SBOM generation + container scanning |
| `deploy.yml` | manual | Production deployment |

---

## IP & Legal

- **Patent Architecture**: [`docs/ip-patent-architecture.md`](ip-patent-architecture.md) — 10 patentable concepts
- **Sacred Geometry Foundation**: [`src/heady-principles.js`](../src/heady-principles.js) — mathematical core (φ, base-13, log-42)
- **Classification**: Proprietary / Confidential

---

## Testing

```bash
npm test                    # Run all Jest tests
npm run maintenance:ops     # Run maintenance operations
npm run headybee:optimize   # Generate optimization report
npm run antigravity:sync    # Sync runtime state
```
