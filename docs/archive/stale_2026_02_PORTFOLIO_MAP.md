<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady — Portfolio Map

> All surfaces mapped with roles, users, domains, ports, and dependencies.  
> **Sources:** `heady-registry.json` v3.3.0, `STANDING_DIRECTIVE.md`, `ecosystem.config.js` (PM2), `verticals.json`

---

## 17 Product Verticals (from `src/verticals.json`)

| # | Vertical | Domain | Description |
|---|----------|--------|-------------|
| 1 | **HeadyMe** | headyme.com | Personal cloud hub — command center for your entire digital life |
| 2 | **HeadySystems** | headysystems.com | Infrastructure backbone — monitoring, management, orchestration |
| 3 | **HeadyConnection** | headyconnection.org | Nonprofit hub — AI bridging gaps in communities |
| 4 | **HeadyMCP** | headymcp.com | Protocol layer — MCP connector registry linking AI to tools |
| 5 | **HeadyIO** | headyio.com | Developer portal — APIs, IDE, documentation |
| 6 | **HeadyBuddy** | headybuddy.org | Always-on AI assistant — browser extension, web widget, voice |
| 7 | **HeadyBot** | headybot.com | Automation engine — 115 continuous background tasks |
| 8 | **HeadyCreator** | — | AI creative studio — design, remix, generate visual content |
| 9 | **HeadyMusic** | — | AI music generation — compositions, smart playlists, mixing |
| 10 | **HeadyTube** | — | AI video — create, edit, publish with AI enhancement |
| 11 | **HeadyCloud** | — | Scalable AI compute on demand — orchestration for resources |
| 12 | **HeadyLearn** | — | AI education — adaptive learning paths, tutoring |
| 13 | **HeadyStore** | — | Marketplace — buy/sell AI-powered plugins, templates, agents |
| 14 | **HeadyStudio** | — | Professional multi-project workspace for creators |
| 15 | **HeadyAgent** | — | Autonomous AI agents — build, deploy, manage |
| 16 | **HeadyData** | — | Data analytics — ingest, process, visualize with AI |
| 17 | **HeadyAPI** | — | Public API gateway — documented, rate-limited, developer-friendly |

---

## Live Production Sites (PM2 + Ports)

### Core Services

| PM2 Name | Script | Port | Purpose |
|----------|--------|------|---------|
| heady-manager | heady-manager.js | 3301 | API gateway — Express, Helmet, CORS, rate-limit, Swagger, WebSocket |
| hcfp-auto-success | scripts/hcfp-full-auto.js | — | HCFP Auto-Success pipeline (full-auto mode) |
| lens-feeder | scripts/lens-telemetry-feeder.js | — | HeadyLens telemetry data feeder |

### Primary Domain Sites

| PM2 Name | Port | Site Directory | Domain |
|----------|------|----------------|--------|
| site-headybuddy | 9000 | ~/sites/headybuddy | headybuddy.org app |
| site-headysystems | 9001 | ~/sites/headysystems | headysystems.com |
| site-headyconnection | 9002 | ~/sites/headyconnection | headyconnection.org |
| site-headymcp | 9003 | ~/sites/headymcp | headymcp.com |
| site-headyio | 9004 | ~/sites/headyio | headyio.com |
| site-headyme | 9005 | ~/sites/headyme | headyme.com |

### Secondary/Variant Sites

| PM2 Name | Port | Site Directory | Domain |
|----------|------|----------------|--------|
| site-headybuddy-org | 9010 | ~/sites/headybuddy-org | headybuddy.org alternate |
| site-headyconnection-org | 9011 | ~/sites/headyconnection-org | headyconnection.org alternate |
| site-headymcp-com | 9012 | ~/sites/headymcp-com | headymcp.com alternate |
| site-headyme-com | 9013 | ~/sites/headyme-com | headyme.com alternate |
| site-headysystems-com | 9014 | ~/sites/headysystems-com | headysystems.com alternate |
| site-instant | 9015 | ~/sites/INSTANT-SITE | Instant deployment site |
| site-1ime1 | 9016 | ~/sites/1ime1 | 1ime1 site |

### App Sites

| PM2 Name | Port | Site Directory | Purpose |
|----------|------|----------------|---------|
| site-headyweb | 3000 | ~/sites/headyweb | HeadyWeb browser (Chromium-based search + AI) |
| site-admin-ui | 5173 | ~/sites/admin-ui | Admin dashboard |

---

## Dynamic Backend Routing (Cloudflare Tunnel → Bossgame P6)

| Subdomain | Service Target |
|-----------|---------------|
| `app.headysystems.com` | HeadyBuddy web app + API gateway (→ port 3301) |
| `api.headysystems.com` | REST API for all nodes (→ port 3301) |
| `coolify.headysystems.com` | Coolify server management |
| `app.headyconnection.org` | Nonprofit dashboard |
| `api.headyconnection.org` | Nonprofit API |
| `app.headybuddy.org` | Live HeadyBuddy widget demo |
| `api.headymcp.com` | MCP server discovery API |
| `api.headyio.com` | Interactive API explorer |
| `app.headyme.com` | Personal dashboard (authenticated) |
| `app.headybot.com` | Automation builder |

---

## Source Code Map

### HeadyManager Gateway (126KB)

The central Express.js server providing all API routes, middleware, and service orchestration.

**20 Route Modules** (`src/routes/`):
auth, battle (9KB), brain (46KB), conductor (8KB), config (4KB), hcfp (8KB), headybuddy-config, hive-sdk (13KB), lens (7KB), maintenance, memory (24KB), nodes, ops, patterns, registry (4KB), soul, system, vinci, vinci-canvas (17KB), index

**10 Service Modules** (`src/services/`):
arena-mode-service (19KB), branch-automation-service (18KB), error-sentinel-service, heady-autonomy (17KB), heady-branded-output, heady-notion (31KB), monte-carlo-service (17KB), openai-business (10KB), service-manager (16KB), socratic-service (21KB)

### Core Source Modules (`src/`)

| Module | Size | Purpose |
|--------|------|---------|
| hc_auto_success.js | 54KB | Auto-success pipeline engine |
| hc_pipeline.js | 38KB | Full execution pipeline |
| generate-verticals.js | 31KB | Generates 17 vertical sites |
| hc_creative.js | 27KB | Creative/generative engine |
| agent-orchestrator.js | 24KB | Multi-agent fanout coordination |
| hc_auth.js | 24KB | Authentication + authorization |
| self-optimizer.js | 24KB | Self-optimization feedback loops |
| hc_scientist.js | 21KB | Scientific/empirical reasoning |
| hc_deep_scan.js | 19KB | Deep project scanning |
| vector-memory.js | 19KB | Semantic vector memory system |
| hc_deep_intel.js | 17KB | Deep intelligence analysis |
| hc_liquid.js | 16KB | Liquid compute abstraction |
| sdk-services.js | 15KB | External SDK integrations |
| heady-registry.js | 14KB | Registry management |
| continuous-learning.js | 14KB | Continuous learning engine |
| vector-federation.js | 12KB | Federated vector operations |
| heady-principles.js | 11KB | Core system principles |
| heady-conductor.js | 11KB | Request orchestration |
| provider-benchmark.js | 10KB | AI provider benchmarking |
| corrections.js | 10KB | Error correction engine |
| compute-dashboard.js | 9KB | Resource compute dashboard |
| remote-compute.js | 6KB | Remote compute dispatch |
| self-awareness.js | 6KB | System self-awareness |
| vector-pipeline.js | 6KB | Vector ingestion pipeline |

### Additional Codebases

| Directory | Contents |
|-----------|----------|
| `heady-buddy/` | HeadyBuddy companion app (React + Node) |
| `heady-ide-ui/` | HeadyAI-IDE interface (React) |
| `heady-hive-sdk/` | Hive distributed compute SDK |
| `headyconnection-web/` | HeadyConnection nonprofit site |
| `frontend/` | Frontend components |
| `backend/` | Backend stubs |
| `oracle_service/` | Oracle/prediction service |
| `midi_bridge/` | MIDI integration bridge |
| `scripts/` | 315 automation scripts |
| `configs/` | 106 YAML + JSON configuration files |

---

## Cross-Surface Data Flow

```
User (voice/chat/code/API)
    ↓
HeadyManager (port 3301, Express gateway)
    ├── Routes → brain.js (46KB) → AI inference
    ├── Routes → memory.js (24KB) → vector memory
    ├── Routes → battle.js → Arena competitions
    ├── Routes → hcfp.js → pipeline execution
    ├── Routes → conductor.js → request orchestration
    ├── Routes → vinci.js + vinci-canvas.js → creative/visual
    ├── Routes → lens.js → monitoring/telemetry
    └── Routes → registry.js → service catalog
    ↓
Services Layer:
    ├── arena-mode-service.js → 7-strategy tournament
    ├── monte-carlo-service.js → UCB1 simulation
    ├── socratic-service.js → HeadyBattle interrogation
    ├── branch-automation-service.js → Git branch gating
    ├── heady-autonomy.js → Autonomous operation
    ├── service-manager.js → Service lifecycle
    └── heady-notion.js → Knowledge sync
    ↓
AI Nodes (7) → ensemble routing per heady-intelligence.yaml
    ↓
Results → Proof View receipts → HeadyLens metrics → HeadyMemory learning
```
