<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/heady-services-manual.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
file_id: "FMSAP-003"
title: "Heady Services Manual"
created: 2026-02-10
last_scan: 2026-02-10T03:39:00Z
scan_count: 1
next_scan_due: 2026-02-17
scan_priority: "high"
stability: "stable"
criticality: "core"
maintenance_notes:
  - "Initial protocol creation"
dependencies:
  - "SYSTEM_PROMPT.md"
  - "ITERATIVE_REBUILD_PROTOCOL.md"
learned_insights:
  - count: 0
  - last_updated: null
improvement_backlog: []
---

<!--
    ╭─────────────────────────────────────────────────────────────╮
    │  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                  │
    │  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                  │
    │  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                   │
    │  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                    │
    │  ██║  ██║███████╗██║  ██║██████╔╝   ██║                     │
    │  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                     │
    │                                                              │
    │  ∞ Sacred Geometry Architecture ∞                            │
    ╰─────────────────────────────────────────────────────────────╯
-->

# Heady Systems — Comprehensive Services Manual & Quickstart

> **Version 3.0.0** | Last Updated: February 6, 2026  
> Every way to use, connect to, and operate the Heady ecosystem.

---

## Table of Contents

1. [Quickstart (5 Minutes)](#1-quickstart-5-minutes)
2. [All Services at a Glance](#2-all-services-at-a-glance)
3. [Connection Methods](#3-connection-methods)
4. [API Reference](#4-api-reference)
5. [Cloud Layers & Switching](#5-cloud-layers--switching)
6. [Docker Environments](#6-docker-environments)
7. [HeadyBuddy — Desktop AI Companion](#7-headybuddy--desktop-ai-companion)
8. [AI Nodes & Tools](#8-ai-nodes--tools)
9. [Pipeline Engine](#9-pipeline-engine)
10. [Scripts & CLI](#10-scripts--cli)
11. [Git Remotes & Sync](#11-git-remotes--sync)
12. [MCP Servers](#12-mcp-servers)
13. [Deployment (Render.com)](#13-deployment-rendercom)
14. [App Readiness & Health Monitoring](#14-app-readiness--health-monitoring)
15. [HCFullPipeline — Archive & Rebuild](#15-hcfullpipeline--archive--rebuild)
16. [Environment Variables](#16-environment-variables)
17. [Workflows](#17-workflows)
18. [Troubleshooting](#18-troubleshooting)
19. [Story Driver — Narrative Intelligence](#19-story-driver--narrative-intelligence)
20. [Service Implementation Best Practices](#20-service-implementation-best-practices)

---

## 1. Quickstart (5 Minutes)

### Option A: Local Dev (Fastest)

```bash
cd C:\Users\erich\Heady
npm install
cp .env.example .env        # Edit with your secrets
npm start                    # → http://localhost:3300
```

**Verify:**
```bash
curl http://localhost:3300/api/health
# → {"ok":true,"service":"heady-manager","version":"3.0.0",...}
```

### Option B: Full Stack with Docker

```bash
cd C:\Users\erich\Heady
docker compose up --build
# heady-manager → http://localhost:3300
# Postgres      → localhost:5432
# Redis         → localhost:6379
```

### Option C: HeadyBuddy Desktop (Docker Desktop in Browser)

```bash
docker compose -f docker-compose.desktop.yml up --build
# Full Linux desktop → http://localhost:6080 (VNC password: heady)
# heady-manager API  → http://localhost:3300
# HeadyBuddy widget  → http://localhost:3400
```

### Option D: HeadyBuddy Widget Only (Dev)

```bash
# Terminal 1 — API backend
cd C:\Users\erich\Heady && npm start

# Terminal 2 — Widget dev server
cd C:\Users\erich\Heady\headybuddy && npm install && npm run dev
# → http://localhost:3400
```

### Option E: Electron Desktop Overlay

```bash
cd C:\Users\erich\Heady\desktop-overlay
npm install
npm run dev
# Launches native overlay — toggle with Ctrl+Shift+H
```

### Option F: Connect to Cloud (No Local Setup)

```bash
curl https://app.headysystems.com/api/health
```

No local install needed — all API endpoints are available at the cloud URLs listed in [Section 5](#5-cloud-layers--switching).

### Option G: Frontend Dev (Vite + React)

```bash
cd C:\Users\erich\Heady\frontend
npm install
npm run dev
# → http://localhost:5173 (proxies API to localhost:3300)
```

---

## 2. All Services at a Glance

| Service | Type | Port | Health Check | Status |
|---------|------|------|-------------|--------|
| **heady-manager** | Node.js API Gateway | 3300 | `GET /api/health` | Primary |
| **heady-frontend** | React (Vite) | 5173 (dev) / served by manager (prod) | `GET /` | Active |
| **HeadyBuddy Widget** | React (Vite) | 3400 | `GET /api/buddy/health` | Active |
| **HeadyBuddy Electron** | Electron overlay | N/A (desktop) | N/A | Active |
| **HeadyBuddy Docker Desktop** | noVNC + Chromium | 6080 | `curl localhost:6080` | Active |
| **python-worker** | Python background worker | 5000 | N/A | Available |
| **MCP Server (stdio)** | Model Context Protocol | stdio | N/A | Active |
| **Render MCP Server** | MCP over stdio | stdio | N/A | Active |
| **Story Driver** | Narrative intelligence | — (in-process) | `GET /api/stories/summary` | Active |
| **Postgres** | Database | 5432 | TCP connection | Available |
| **Redis** | Cache | 6379 | TCP connection | Available |

---

## 3. Connection Methods

### 3.1 HTTP / REST API

The primary way to interact with Heady. All endpoints are served by `heady-manager.js`.

**Local:**
```
http://localhost:3300/api/{endpoint}
```

**Cloud (pick your layer):**
```
https://app.headysystems.com/api/{endpoint}
https://app.headysystems.com/api/{endpoint}
https://app.headysystems.com/api/{endpoint}
```

### 3.2 MCP (Model Context Protocol)

Heady exposes MCP servers for IDE integration (Copilot, Windsurf, Claude):

**Render MCP Server** (`mcp-servers/render-mcp-server.js`):
- Transport: stdio
- Tools: `render_list_services`, `render_deploy_service`, `render_get_service`, `render_deploy_latest_commit`
- Requires: `RENDER_API_KEY` env var

**Usage in Copilot/Windsurf:**
```json
{
  "servers": {
    "render": {
      "command": "node",
      "args": ["mcp-servers/render-mcp-server.js"],
      "env": { "RENDER_API_KEY": "${RENDER_API_KEY}" }
    }
  }
}
```

### 3.3 Docker

**Standard stack** (manager + Postgres + Redis):
```bash
docker compose up --build
```

**Desktop environment** (full Linux desktop with HeadyBuddy):
```bash
docker compose -f docker-compose.desktop.yml up --build
```

**Standalone container** (manager only):
```bash
docker build -t heady/manager:latest .
docker run --rm -p 3300:3300 heady/manager:latest
```

**Distributable desktop image** (for sharing via file):
```bash
docker build -f headybuddy/docker/Dockerfile.desktop -t heady/desktop:latest .
docker save heady/desktop:latest | gzip > heady-desktop.tar.gz
# Share heady-desktop.tar.gz — recipient loads with:
docker load < heady-desktop.tar.gz
docker run --rm -p 6080:6080 -p 3300:3300 heady/desktop:latest
```

### 3.4 Electron (Native Desktop)

```bash
cd desktop-overlay && npm install && npm run dev
```

- **Hotkey**: `Ctrl+Shift+H` toggles the overlay
- **Preload bridge**: `preload.js` provides secure IPC between renderer and main process
- Loads HeadyBuddy widget from `http://localhost:3400` (dev) or bundled build (prod)

### 3.5 Browser (Direct)

| URL | What You See |
|-----|-------------|
| `http://localhost:3300` | Sacred Geometry dashboard (React frontend) |
| `http://localhost:3300/admin` | Admin IDE with Monaco editor |
| `http://localhost:3400` | HeadyBuddy widget (dev server) |
| `http://localhost:6080` | Full Linux desktop via noVNC (Docker Desktop) |
| `http://localhost:5173` | Vite dev server for frontend |

### 3.6 PowerShell CLI

```powershell
# Layer management
.\scripts\heady-layer.ps1 status
.\scripts\heady-layer.ps1 list
.\scripts\heady-layer.ps1 switch cloud-me

# Sync all remotes
.\scripts\Heady-Sync.ps1

# Sync with restart
.\scripts\Heady-Sync.ps1 -Restart

# Custom action
.\scripts\Heady-Sync.ps1 -Action "node-health-check.ps1"

# Checkpoint
.\scripts\Heady-Sync.ps1 -Checkpoint
```

### 3.7 npm Scripts

```bash
npm start              # Start heady-manager (production)
npm run dev            # Start with nodemon (auto-reload)
npm run build          # Build frontend (Vite)
npm run frontend       # Start frontend dev server
npm run backend        # Start Python backend
npm test               # Run Jest tests
npm run lint           # ESLint auto-fix
npm run sync           # HeadySync (PowerShell)
npm run brand:check    # Check branding headers
npm run brand:fix      # Apply branding headers
npm run pipeline       # Run pipeline engine
npm run pipeline:config # Show pipeline configuration
```

### 3.8 Git (Direct Repository Access)

```bash
git clone git@github.com:HeadySystems/Heady.git
git clone git@github.com:HeadyMe/Heady.git
git clone https://github.com/HeadySystems/HeadyConnection.git
git clone git@github.com:HeadySystems/sandbox.git
```

---

## 4. API Reference

### Core Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/health` | Health check (ok, version, uptime, memory) | No |
| `GET` | `/api/pulse` | System pulse (status, endpoints list) | No |
| `GET` | `/api/system/status` | Full status (nodes, tools, workflows, services, readiness) | No |
| `POST` | `/api/system/production` | Activate all nodes to production mode | No |
| `GET` | `/api/registry` | Full registry (heady-registry.json) | No |

### Node Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nodes` | List all nodes (total, active, details) |
| `GET` | `/api/nodes/:nodeId` | Get single node details |
| `POST` | `/api/nodes/:nodeId/activate` | Activate a node |
| `POST` | `/api/nodes/:nodeId/deactivate` | Deactivate a node |

### HeadyBuddy Companion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/buddy/chat` | Send message, get reply (body: `{message, history}`) |
| `GET` | `/api/buddy/health` | HeadyBuddy service health |
| `GET` | `/api/buddy/suggestions` | Context-aware suggestion chips (time-based) |

### Pipeline

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pipeline/config` | Pipeline configuration |
| `POST` | `/api/pipeline/run` | Trigger pipeline run |
| `GET` | `/api/pipeline/state` | Current pipeline state |

### Admin (when enabled)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/config/render-yaml` | Render.yaml configuration |
| `GET` | `/api/admin/config/mcp` | MCP configuration |
| `GET` | `/api/admin/settings/gpu` | GPU settings |
| `POST` | `/api/admin/gpu/infer` | GPU inference |
| `POST` | `/api/admin/assistant` | AI assistant for code editing |
| `POST` | `/api/admin/lint` | Code linting |
| `POST` | `/api/admin/test` | Run tests |
| `GET` | `/api/admin/roots` | Available admin roots |
| `GET` | `/api/admin/files` | File browser |
| `GET/POST` | `/api/admin/file` | File read/write |
| `POST` | `/api/admin/build` | Run build script |
| `POST` | `/api/admin/audit` | Run audit script |
| `GET` | `/api/admin/ops` | List operations |
| `GET` | `/api/admin/ops/:id/status` | Operation status |
| `GET` | `/api/admin/ops/:id/stream` | SSE log streaming |

### Hugging Face Proxy

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `*` | `/api/hf/*` | Hugging Face inference passthrough | `HEADY_API_KEY` |

---

## 5. Cloud Layers & Switching

Heady supports **5 deployment layers**, switchable at runtime:

| Layer ID | Name | Endpoint | Color | Git Remote |
|----------|------|----------|-------|------------|
| `local` | Local Dev | `http://localhost:3300` | Green | — |
| `cloud-me` | Cloud HeadyMe | `https://app.headysystems.com` | Cyan | `heady-me` |
| `cloud-sys` | Cloud HeadySystems | `https://app.headysystems.com` | Magenta | `origin` |
| `cloud-conn` | Cloud HeadyConnection | `https://app.headysystems.com` | Yellow | `connection` |
| `hybrid` | Hybrid Local+Cloud | `http://localhost:3300` (with cloud sync) | White | — |

### CLI Usage

```powershell
# Quick shortcut (if hl.bat is on PATH)
hl                           # Show current layer + health
hl status                    # Detailed status
hl list                      # All layers with live health check
hl switch cloud-me           # Switch to HeadyMe cloud
hl switch local              # Switch back to local
hl health                    # Health check all layers

# Full path
.\scripts\heady-layer.ps1 status
.\scripts\heady-layer.ps1 switch cloud-sys
```

### What Switching Does

1. Writes active layer to `scripts/.heady-active-layer`
2. Sets `$env:HEADY_ACTIVE_LAYER` and `$env:HEADY_ACTIVE_ENDPOINT`
3. Updates `cascade-heady-proxy.py` to route Cascade hooks to the new layer
4. Runs health check on the target before confirming

### API-Based Switching

```bash
# Get current layer
curl http://localhost:3300/api/layer

# Switch via API
curl -X POST http://localhost:3300/api/layer/switch \
  -H "Content-Type: application/json" \
  -d '{"layer": "cloud-me"}'
```

---

## 6. Docker Environments

### 6.1 Standard Stack (`docker-compose.yml`)

```yaml
Services:
  heady-manager  → :3300 (Node.js API)
  heady-redis    → :6379 (Redis 7)
  heady-postgres → :5432 (Postgres 16)
```

```bash
docker compose up --build       # Start all
docker compose down             # Stop all
docker compose logs -f          # Tail logs
docker compose ps               # Service status
```

### 6.2 Desktop Environment (`docker-compose.desktop.yml`)

```yaml
Services:
  heady-desktop → :6080 (noVNC), :3300 (API), :3400 (Widget)
```

Includes:
- Full Linux desktop (XFCE or lightweight WM)
- noVNC web access at port 6080
- HeadyBuddy widget auto-starts
- HeadyAutoIDE (VS Code) desktop icon
- Supervised by `supervisord.conf`
- VNC password: `heady`
- Resolution: 1920×1080

```bash
docker compose -f docker-compose.desktop.yml up --build
# Open browser → http://localhost:6080
```

### 6.3 Standalone Manager (`Dockerfile`)

```bash
docker build -t heady/manager:latest .
docker run --rm -p 3300:3300 \
  -e NODE_ENV=production \
  -e HEADY_API_KEY=your-key \
  heady/manager:latest
```

### 6.4 Building a Shareable Image

```bash
# Build
docker build -f headybuddy/docker/Dockerfile.desktop -t heady/desktop:latest .

# Push to GitHub Container Registry
docker tag heady/desktop:latest ghcr.io/headysystems/desktop:latest
docker push ghcr.io/headysystems/desktop:latest

# OR export as file
docker save heady/desktop:latest | gzip > heady-desktop.tar.gz
# → Share heady-desktop.tar.gz (recipient: docker load < heady-desktop.tar.gz)
```

---

## 7. HeadyBuddy — Desktop AI Companion

**"Your Perfect Day AI Companion"** — a branded overlay widget.

### Architecture

```
User's Desktop
├── HeadyBuddy Widget (:3400) ──→ heady-manager (:3300)
│   ├── /api/buddy/chat              POST message → reply
│   ├── /api/buddy/health            GET service health
│   └── /api/buddy/suggestions       GET time-based chips
├── Electron Shell (desktop-overlay/)
│   ├── main.js (main process)
│   ├── preload.js (IPC bridge)
│   └── Hotkey: Ctrl+Shift+H
└── Docker Desktop (:6080 via noVNC)
```

### Widget States

| State | Size | Content |
|-------|------|---------|
| Collapsed Pill | 320×120 | Avatar + status + 3 suggestion chips |
| Main Widget | 380×560 | Chat + suggestions + input |
| Expanded View | 420×680 | Tabs: Overview / Steps / History |

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `heady-bg` | `#0a0e17` | App background |
| `heady-surface` | `#111827` | Card surfaces |
| `heady-cyan` | `#22d3ee` | Primary accent, avatar idle |
| `heady-emerald` | `#34d399` | Success states |
| `heady-amber` | `#fbbf24` | Warning / error |
| `heady-magenta` | `#c084fc` | Thinking state |

### Suggestion Chips (Time-Based)

| Time | Chips |
|------|-------|
| Morning (<12:00) | Plan my morning, Review goals, Quick win |
| Afternoon (12–17) | Plan afternoon, Focus session, Take a break |
| Evening (>17:00) | Wrap up day, Tomorrow prep, Learn something |

---

## 8. AI Nodes & Tools

### 8.1 Registered Nodes (20 Active)

| Node | Codename | Primary Tool | Triggers |
|------|----------|-------------|----------|
| BRIDGE | The Connector | `mcp_server` | mcp, connect, warp, network, tunnel |
| MUSE | The Brand Architect | `content_generator` | generate_content, whitepaper, marketing |
| SENTINEL | The Guardian | `heady_chain` | grant_auth, verify_auth, audit_ledger |
| NOVA | The Expander | `gap_scanner` | scan_gaps |
| OBSERVER | The Natural Observer | `observer_daemon` | monitor |
| JANITOR | The Custodian | `clean_sweep` | clean |
| JULES | The Hyper-Surgeon | `goose` | optimization |
| SOPHIA | The Matriarch | `hardware_sentience` | learn_tool |
| CIPHER | The Cryptolinguist | `heady_crypt` | obfuscate |
| ATLAS | The Auto-Archivist | `auto_doc` | documentation |
| MURPHY | The Inspector | `semgrep` | security_audit |
| SASHA | The Dreamer | `yandex_gpt` | brainstorming |
| SCOUT | The Hunter | `pygithub` | scan_github |
| OCULUS | The Visualizer | `gource` | visualize |
| BUILDER | The Constructor | `hydrator` | new_project |
| PYTHIA | The Oracle | `HuggingFace_Tool` | huggingface, predict, infer, ask_oracle |
| LENS | The All-Seeing Eye | `heady_lens` | monitor, watch, status, health, metrics |
| MEMORY | The Eternal Archive | `heady_memory` | remember, store, recall, retrieve, history |
| BRAIN | The Central Intelligence | `heady_brain` | think, analyze, decide, process, reason |
| CONDUCTOR | The Orchestrator | `heady_conductor` | orchestrate, coordinate, route, execute |

### 8.2 Registered Tools (21)

| Tool | Category | Path |
|------|----------|------|
| Auto_Doc | general | `HeadyAcademy/Tools/Auto_Doc.py` |
| Brainstorm | general | `HeadyAcademy/Tools/Brainstorm.py` |
| Clean_Sweep | general | `HeadyAcademy/Tools/Clean_Sweep.py` |
| consolidator | general | `HeadyAcademy/Tools/consolidator.py` |
| Content_Generator | general | `HeadyAcademy/Tools/Content_Generator.py` |
| Gap_Scanner | general | `HeadyAcademy/Tools/Gap_Scanner.py` |
| Github_Scanner | general | `HeadyAcademy/Tools/Github_Scanner.py` |
| Heady_Chain | general | `HeadyAcademy/Tools/Heady_Chain.py` |
| Heady_Crypt | general | `HeadyAcademy/Tools/Heady_Crypt.py` |
| HuggingFace_Tool | general | `HeadyAcademy/Tools/HuggingFace_Tool.py` |
| Hydrator | general | `HeadyAcademy/Tools/Hydrator.py` |
| Optimizer | general | `HeadyAcademy/Tools/Optimizer.py` |
| Security_Audit | general | `HeadyAcademy/Tools/Security_Audit.py` |
| Tool_Learner | general | `HeadyAcademy/Tools/Tool_Learner.py` |
| Visualizer | general | `HeadyAcademy/Tools/Visualizer.py` |
| Natural_Observer | Daemons | `HeadyAcademy/Tools/Daemons/Natural_Observer.py` |
| Client | MCP | `HeadyAcademy/Tools/MCP/Client.py` |
| Server | MCP | `HeadyAcademy/Tools/MCP/Server.py` |
| Warp_Manager | Network | `HeadyAcademy/Tools/Network/Warp_Manager.py` |
| Auth_Protocol | Security | `HeadyAcademy/Tools/Security/Auth_Protocol.py` |
| Key_Manager | Security | `HeadyAcademy/Tools/Security/Key_Manager.py` |
| MCP_Auth | Security | `HeadyAcademy/Tools/Security/MCP_Auth.py` |

### 8.3 Node Management via API

```bash
# List all nodes
curl http://localhost:3300/api/nodes

# Get specific node
curl http://localhost:3300/api/nodes/PYTHIA

# Activate a node
curl -X POST http://localhost:3300/api/nodes/PYTHIA/activate

# Deactivate a node
curl -X POST http://localhost:3300/api/nodes/JULES/deactivate

# Activate ALL nodes (production mode)
curl -X POST http://localhost:3300/api/system/production
```

---

## 9. Pipeline Engine

The **HCFullPipeline** runtime engine (`src/hc_pipeline.js`) executes multi-stage pipelines with:

- **Topological sorting** — stages run in dependency order
- **Worker pool** — concurrent task execution with semaphore-based limits
- **Circuit breakers** — per-endpoint failure thresholds (open/half-open/closed)
- **Task result caching** — config-hash-keyed, 1-hour TTL, 200-entry max
- **Stop rules** — error rate, readiness score, critical alarms, data integrity
- **Checkpoint protocol** — config drift detection, readiness scoring, escalation thresholds

### Task Priority Pools

| Pool | Priority | Tasks |
|------|----------|-------|
| **Hot** | 0 (highest) | route_to_agents, monitor_agent_execution, collect_agent_results, compute_readiness_score |
| **Warm** | 1 | generate_task_graph, assign_priorities, validate_governance, persist_results |
| **Cold** | 2 | ingest_news_feeds, ingest_external_apis, estimate_costs, update_concept_index |

### Run States

`idle` → `running` → `completed` | `paused` | `recovery` | `halted` | `failed`

### Usage

```bash
# CLI
npm run pipeline              # Run pipeline
npm run pipeline:config       # Show config summary

# API
curl -X POST http://localhost:3300/api/pipeline/run
curl http://localhost:3300/api/pipeline/state
curl http://localhost:3300/api/pipeline/config

# Programmatic
const { pipeline } = require('./src/hc_pipeline');
pipeline.on('stage:start', (e) => console.log(e));
const state = await pipeline.run();
```

---

## 10. Scripts & CLI

| Script | Path | Description | Usage |
|--------|------|-------------|-------|
| **Heady-Sync** | `scripts/Heady-Sync.ps1` | Master orchestration: pause → fetch → lint → optimize → checkpoint → sync → push | `.\scripts\Heady-Sync.ps1` |
| **Heady-Sync (restart)** | — | Full cycle with auto-restart | `.\scripts\Heady-Sync.ps1 -Restart` |
| **Heady-Sync (force)** | — | Force push to all remotes | `.\scripts\Heady-Sync.ps1 -Force` |
| **Heady-Sync (checkpoint)** | — | Generate checkpoint report only | `.\scripts\Heady-Sync.ps1 -Checkpoint` |
| **Heady-Sync (action)** | — | Run a specific script/command | `.\scripts\Heady-Sync.ps1 -Action "node-health-check.ps1"` |
| **Layer Switcher** | `scripts/heady-layer.ps1` | Switch between cloud layers | `.\scripts\heady-layer.ps1 switch cloud-me` |
| **Archive to Pre-Prod** | `scripts/hc-archive-to-preproduction.ps1` | Rename repos to `*-pre-production` variants | `.\scripts\hc-archive-to-preproduction.ps1` |
| **Scaffold Fresh** | `scripts/hc-scaffold-fresh.ps1` | Create clean project from scratch | `.\scripts\hc-scaffold-fresh.ps1 -OutputPath C:\Heady-Fresh` |
| **Node Health Check** | `scripts/ops/node-health-check.ps1` | Check health of all system nodes | `.\scripts\ops\node-health-check.ps1` |
| **Profile Node** | `scripts/ops/profile_node.py` | Python-based node profiling | `python scripts/ops/profile_node.py` |

### Heady-Sync Full Cycle

```
1. PAUSE      → Stop services
2. CATCH      → git fetch --all --prune, worktree prune
3. FIX        → npm run lint -- --fix
4. IMPROVE    → optimize_repos.ps1
5. CHECKPOINT → checkpoint-validation.ps1
6. SYNC       → git add -A, commit, push to ALL remotes
7. RESTART    → start-heady-system.ps1 (if -Restart flag)
```

---

## 11. Git Remotes & Sync

### Configured Remotes

| Remote | URL | Org |
|--------|-----|-----|
| `origin` | `git@github.com:HeadySystems/Heady.git` | HeadySystems |
| `heady-me` | `git@github.com:HeadyMe/Heady.git` | HeadyMe |
| `heady-sys` | `git@github.com:HeadySystems/Heady.git` | HeadySystems |
| `connection` | `https://github.com/HeadySystems/HeadyConnection.git` | HeadyConnection |
| `sandbox` | `git@github.com:HeadySystems/sandbox.git` | HeadySystems |

### Sync Commands

```bash
# Push to all remotes (via HeadySync)
.\scripts\Heady-Sync.ps1

# Manual push to specific remote
git push heady-me main
git push origin main
git push sandbox main

# npm shortcut
npm run sync
```

**Note:** Push to `heady-conn` (HeadyConnection) may fail due to `GH013` (Verified Signatures Required) policy.

---

## 12. MCP Servers

### Render MCP Server

**File:** `mcp-servers/render-mcp-server.js`

| Tool | Description |
|------|-------------|
| `render_list_services` | List all Render services |
| `render_deploy_service` | Trigger deploy by service ID |
| `render_get_service` | Get service details |
| `render_deploy_latest_commit` | Deploy latest commit by service name |

**Run standalone:**
```bash
RENDER_API_KEY=your-key node mcp-servers/render-mcp-server.js
```

### Other MCP Integrations (via `.github/copilot-mcp-config.json`)

| Server | Purpose |
|--------|---------|
| filesystem | File system operations |
| sequential-thinking | Reasoning chains |
| memory | Persistent memory storage |
| fetch | Web requests |
| postgres | Database operations |
| git | Git operations |
| puppeteer | Web automation |
| cloudflare | Cloudflare API |

---

## 13. Deployment (Render.com)

### render.yaml Blueprint

```yaml
services:
  - type: web
    name: heady-manager
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node heady-manager.js
    envVars:
      PORT: 3300
      NODE_ENV: production
      ENABLE_CODEMAP: true
      JULES_ENABLED: true
      OBSERVER_ENABLED: true
      BUILDER_ENABLED: true
      ATLAS_ENABLED: true
      DATABASE_URL: (from secret)
      HEADY_API_KEY: (from secret)
      HF_TOKEN: (from env)
```

### Deploy Targets

| Service | URL |
|---------|-----|
| HeadySystems | `https://app.headysystems.com` |
| HeadyMe | `https://app.headysystems.com` |
| HeadyConnection | `https://app.headysystems.com` |

### Deploy via MCP

```bash
# Using Render MCP Server
render_deploy_latest_commit --serviceName heady-manager-headysystems
```

### Deploy via Git Push

Render auto-deploys when you push to the connected branch:
```bash
git push origin main    # Triggers HeadySystems deploy
git push heady-me main  # Triggers HeadyMe deploy
```

---

## 14. App Readiness & Health Monitoring

### Readiness Probes (`configs/app-readiness.yaml`)

| Probe | Type | URL | Criticality | Interval |
|-------|------|-----|-------------|----------|
| heady-manager-api | HTTP | `localhost:3300/api/health` | Critical | 60s |
| heady-manager-pulse | HTTP | `localhost:3300/api/pulse` | High | 60s |
| heady-frontend | HTTP | `localhost:3300/` | High | 300s |
| heady-admin | HTTP | `localhost:3300/api/registry` | Medium | 300s |
| postgres-connection | TCP | `$DATABASE_URL` | Low | 120s |
| render-deployment | HTTP | `app.headysystems.com/api/health` | High | 300s |
| headybuddy-api | HTTP | `localhost:3300/api/buddy/health` | High | 60s |
| headybuddy-widget | HTTP | `localhost:3400` | Medium | 300s |
| headybuddy-suggestions | HTTP | `localhost:3300/api/buddy/suggestions` | Low | 120s |

### Operational Readiness Score (ORS)

| Weight | Component |
|--------|-----------|
| 40% | Critical probes passing |
| 20% | High probes passing |
| 10% | Medium probes passing |
| 15% | Error budget remaining |
| 15% | Config hash alignment |

### Thresholds & Actions

| ORS Score | Mode | Action |
|-----------|------|--------|
| ≥ 85 | Aggressive | Full parallelism, new optimizations allowed |
| 70–85 | Normal | Standard operation |
| 50–70 | Maintenance | Reduced load, no large builds |
| < 50 | Recovery | Repair only, escalate to owner |

---

## 15. HCFullPipeline — Archive & Rebuild

The nuclear option: archives all repos to `*-pre-production` variants and scaffolds from scratch.

### Phases

| Phase | Action |
|-------|--------|
| 1. Pre-Flight | Verify commits pushed, `gh` authenticated, create backup tag |
| 2. Archive | Rename repos to `*-pre-production` via GitHub API |
| 3. Create Fresh | Create new empty repos on GitHub |
| 4. Scaffold | Run `hc-scaffold-fresh.ps1` to generate clean project |
| 5. Migrate | Copy essential business logic (clean rewrites, not raw copies) |
| 6. Push | Initialize git and push to all fresh repos |
| 7. Swap | Rename local directories (old → archived, fresh → active) |
| 8. Post-Rebuild | Re-deploy to Render, verify sync |

### Workflow File

```
.windsurf/workflows/hc-full-pipeline.md
```

### Rollback

1. Pre-production repos still exist with all history
2. Local `C:\Users\erich\Heady-archived` preserves the full workspace
3. Tag `pre-production-archive` marks the exact commit
4. Rename repos back via `gh repo rename`

### 15.3 Global Multi-SOT Rebuild Playbook
This playbook applies HCFullPipeline Archive Rebuild across all major Heady repositories and clouds in a single coordinated operation.

Target repos
- HeadySystems/Heady → role: primary (C-Corp)
- HeadyMe/Heady → role: personal-cloud
- HeadyConnection/Heady → role: cross-system-bridge
- HeadySystems/sandbox → role: experimental

1. Clone and archive everything (local)
```powershell
# Clone all current remotes into an archive root  
mkdir C:\Heady-archived-$(Get-Date -Format yyyyMMdd)  
cd C:\Heady-archived-$(Get-Date -Format yyyyMMdd)  
git clone git@github.com:HeadySystems/Heady.git HeadySystems-Heady-pre-production  
git clone git@github.com:HeadyMe/Heady.git HeadyMe-Heady-pre-production  
git clone https://github.com/HeadySystems/HeadyConnection.git HeadyConnection-Heady-pre-production  
git clone git@github.com:HeadySystems/sandbox.git HeadySystems-sandbox-pre-production  
```
2. Archive remotes (GitHub UI or gh CLI)
- Rename each repo to *-pre-production or move to an Archive org.
- Tag current main as pre-production-archive-YYYYMMDD.

3. Create fresh repos (remote)
- Create new empty repos:
  - HeadySystems/Heady
  - HeadyMe/Heady
  - HeadyConnection/Heady
  - HeadySystems/sandbox
- Enable branch protection on main for the three production repos (Systems, Me, Connection).

4. Scaffold from registry
- Clone the new Sandbox repo locally.
- Copy in:
  - heady-registry.json
  - Core docs listed in the registry (services-manual, iterative-rebuild-protocol, headystack-distribution-protocol, etc.)
  - Core configs and scripts (Heady-Sync.ps1, checkpoint-sync.ps1, hc-full-pipeline workflow files)
- Use hc-scaffold-fresh.ps1 to create the standard folder layout and placeholder files.

5. Rebuild minimal deterministic slice
- Implement heady-manager + health endpoints + registry access.
- Implement Heady-Sync.ps1 driven by heady-registry.json.repos (no hard-coded remotes).
- Add tests and GitHub Actions workflows so main cannot advance without a clean build, tests, and ORS above threshold.

6. Promote to other sources of truth
- From Sandbox, use promotion scripts/skills to push the validated slice into:
  - HeadySystems/Heady:main
  - HeadyMe/Heady:main
  - HeadyConnection/Heady:main
- Allow Render to auto-deploy based on these branches as configured in render.yaml.

7. Register the new state
- Update heady-registry.json.repos with correct URLs, roles, and promotion targets.
- Update environments entries for cloud-me, cloud-sys, cloud-conn with new commit hashes and health status.
- Log a Story Driver event marking this as "Global Multi-SOT Rebuild vN".

---

## 16. Environment Variables

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3300` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Postgres connection string | — |
| `HEADY_API_KEY` | API authentication key | — |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_TOKEN` | Admin endpoint auth | — |
| `HF_TOKEN` | Hugging Face API token | — |
| `HEADY_TARGET` | Deployment target identifier | `LocalDev` |
| `HEADY_VERSION` | System version | `3.0.0` |
| `ENABLE_CODEMAP` | Enable codemap optimization | `true` |
| `JULES_ENABLED` | Enable JULES node | `true` |
| `OBSERVER_ENABLED` | Enable OBSERVER node | `true` |
| `BUILDER_ENABLED` | Enable BUILDER node | `true` |
| `ATLAS_ENABLED` | Enable ATLAS node | `true` |
| `PYTHON_WORKER_PATH` | Path to Python worker | `backend/python_worker` |
| `HEADY_PYTHON_BIN` | Python binary | `python` |
| `RENDER_API_KEY` | Render.com API key (for MCP server) | — |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `*` |
| `CLOUD_HEADYME_URL` | HeadyMe cloud endpoint | `https://app.headysystems.com` |
| `CLOUD_HEADYSYSTEMS_URL` | HeadySystems cloud endpoint | `https://app.headysystems.com` |
| `CLOUD_HEADYCONNECTION_URL` | HeadyConnection cloud endpoint | `https://app.headysystems.com` |

### Render Secret Group (`heady-shared-secrets`)

- `DATABASE_URL`, `HEADY_API_KEY`, `HF_TOKEN`, `ADMIN_TOKEN`
- `COPILOT_MCP_CLOUDFLARE_API_TOKEN`, `COPILOT_MCP_CLOUDFLARE_ACCOUNT_ID`

---

## 17. Workflows

Defined in `.windsurf/workflows/`:

| Workflow | Slash Command | Description |
|----------|--------------|-------------|
| `autobuild.md` | `/autobuild` | Automated build cycle |
| `branding-protocol.md` | `/branding-protocol` | Enforce Sacred Geometry headers across all files |
| `codemap-optimization.md` | `/codemap-optimization` | AI node integration for enhanced performance scoring |
| `docker-mcp-setup.md` | `/docker-mcp-setup` | Configure and start HeadyMCP Docker services |
| `hc-autobuild.md` | `/hc-autobuild` | Automated checkpoint system |
| `hcautobuild.md` | `/hcautobuild` | HCAutoBuild — 100% functionality target |
| `heady-sync.md` | `/heady-sync` | Comprehensive sync with full system awareness |
| `headysync-prep.md` | `/headysync-prep` | Pre-sync preparation |
| `workspace-integration.md` | `/workspace-integration` | IDE workspace integration |
| `hc-full-pipeline.md` | `/hc-full-pipeline` | Archive repos + scaffold fresh rebuild |

---

## 18. Troubleshooting

### Manager won't start

```bash
# Check port conflict
netstat -ano | findstr :3300

# Check Node version (need 20+)
node -v

# Check .env exists
test -f .env && echo "OK" || echo "Missing — run: cp .env.example .env"
```

### Can't connect to cloud layer

```powershell
# Health check all layers
.\scripts\heady-layer.ps1 health

# Check specific endpoint
curl -s https://app.headysystems.com/api/health
```

Render free-tier services spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.

### Docker Desktop not starting

```bash
# Check Docker is running
docker info

# Rebuild from scratch
docker compose -f docker-compose.desktop.yml down -v
docker compose -f docker-compose.desktop.yml up --build --force-recreate
```

### HeadySync push fails

```bash
# Check remote config
git remote -v

# Check SSH key
ssh -T git@github.com

# Force push (use with caution)
.\scripts\Heady-Sync.ps1 -Force
```

### Pipeline won't run

```bash
# Check configs exist
ls configs/*.yaml

# Verify pipeline config loads
npm run pipeline:config

# Check for circular dependencies in stage definitions
node -e "const {pipeline}=require('./src/hc_pipeline');console.log(pipeline.getStageDag())"
```

### Nodes show as "available" instead of "active"

```bash
# Activate all nodes
curl -X POST http://localhost:3300/api/system/production
```

---

## 19. Story Driver — Narrative Intelligence

The **Story Driver** (`src/hc_story_driver.js`) turns system events into coherent narratives, keeping humans and agents aligned on project evolution.

### Architecture

```
System Events (Pipeline, Builds, Arena, Resources, Registry, Buddy)
    │
    ▼
┌──────────────────────────────────────┐
│  Story Driver (hc_story_driver.js)   │
│  ├── Event Ingestion & Filtering     │
│  ├── Narrative Generation            │
│  ├── Timeline Management             │
│  └── Summary Generation              │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  .heady/stories.json (persistent)    │
│  ├── Story objects (4 scopes)        │
│  └── StoryEvent timelines            │
└──────────────────────────────────────┘
    │
    ▼
  HeadyBuddy (chat, suggestions, Story tab)
```

### Story Scopes

| Scope | Retention | Summary Interval |
|-------|-----------|-----------------|
| **project** | 365 days | Weekly |
| **feature** | 180 days | On completion |
| **incident** | 365 days | On resolution |
| **experiment** | 90 days | On completion |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stories` | List all active stories |
| `GET` | `/api/stories/recent` | Recent events across all stories |
| `GET` | `/api/stories/summary` | System-wide narrative summary |
| `GET` | `/api/stories/:id` | Get full story with timeline |
| `GET` | `/api/stories/:id/timeline` | Get story timeline events |
| `GET` | `/api/stories/:id/summary` | Get generated narrative summary |
| `POST` | `/api/stories` | Create a new story |
| `POST` | `/api/stories/:id/events` | Add event to a story |
| `POST` | `/api/stories/:id/pin/:eventId` | Pin an important event |
| `POST` | `/api/stories/:id/annotate` | Add user annotation |
| `POST` | `/api/stories/:id/complete` | Mark story as completed |

### Usage

```bash
# List stories
curl http://localhost:3300/api/stories

# System narrative summary
curl http://localhost:3300/api/stories/summary

# Create a story
curl -X POST http://localhost:3300/api/stories \
  -H "Content-Type: application/json" \
  -d '{"scope":"feature","title":"Landing Page Rebuild"}'

# Add event
curl -X POST http://localhost:3300/api/stories/{id}/events \
  -H "Content-Type: application/json" \
  -d '{"type":"BUILD_SUCCESS","refs":{"buildId":"142"}}'

# Annotate
curl -X POST http://localhost:3300/api/stories/{id}/annotate \
  -H "Content-Type: application/json" \
  -d '{"text":"Decided to pivot to new layout approach"}'

# Ask HeadyBuddy
curl -X POST http://localhost:3300/api/buddy/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What changed recently?"}'
```

### Integration Points

| System | How Stories Connect |
|--------|-------------------|
| **HCFullPipeline** | Cycle completions, gate pass/fail auto-logged |
| **Resource Manager** | WARN_HARD and CRITICAL events auto-logged |
| **HeadyBuddy** | "What changed?" / "story" / "narrative" queries |
| **Registry** | Node activations, pattern changes |
| **Maid** | Archives old stories, cleans broken refs |

---

## 20. Service Implementation Best Practices

### Standardized Patterns Across All Services

| Pattern | Implementation |
|---------|---------------|
| **Health endpoint** | Every service exposes `GET /health` or `GET /api/health` |
| **Structured logging** | JSON format with `service`, `request_id`, `timestamp`, `level` |
| **Config via env** | All configuration through environment variables |
| **Graceful shutdown** | Handle `SIGTERM`, drain connections, flush state |
| **Error boundaries** | Never crash on unhandled promise rejections |

### Docker Health Checks

```yaml
# Node.js services
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:PORT/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# Postgres
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U heady -d heady"]
  interval: 10s
  timeout: 5s
  retries: 5

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Network Scoping

- **External**: Only `heady-manager` (8080/3300) and noVNC (6080) exposed to host
- **Internal**: Postgres, Redis, MCP Server, Python Worker on internal `heady-net` only
- Use `expose` (not `ports`) for internal-only services

### Observability Checklist

- [ ] Metrics: latency, error rate, throughput, resource usage per service
- [ ] Logs: structured JSON with correlation IDs
- [ ] Tracing: OpenTelemetry spans across service boundaries
- [ ] Dashboards: HeadyBuddy Orchestrator tab shows live system state
- [ ] Story Driver: significant events auto-narrated for context

### Squash-Merge as Default

For every feature branch that goes through Arena Mode or significant refactors:
- Use `git merge --squash` so main stays clean
- Each feature = one well-described commit
- Story Driver records the merge event for transparency

---

*Proprietary — Heady Systems | Sacred Geometry :: Organic Systems :: Breathing Interfaces*

```
