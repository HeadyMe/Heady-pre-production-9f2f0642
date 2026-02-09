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
<!-- ║  FILE: docs/notion-quick-start.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY SYSTEMS                                                    ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces     ║ -->
<!-- ║  FILE: docs/notion-quick-start.md                                 ║ -->
<!-- ║  LAYER: root                                                      ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# Heady Quick Start

> **Last Reviewed:** 2025-07-01 | **Version:** 3.0.0 | **Status:** Current

---

## Welcome to Heady

Heady is an **intelligent, parallel, dynamically distributed** system that orchestrates AI workloads across local and cloud environments using **Sacred Geometry** design principles — organic, breathing, rounded interfaces with deterministic execution.

### What Heady Does
- **Orchestrates** multi-agent AI pipelines (HCFullPipeline)
- **Manages** services, configs, and documentation through HeadyRegistry
- **Monitors** system health with continuous readiness scoring
- **Tells stories** about what happened, why, and what's next (Story Driver)
- **Keeps everything in sync** automatically at every checkpoint

---

## Getting Started in 5 Minutes

### 1. Clone & Install

```bash
git clone git@github.com:HeadySystems/Heady.git
cd Heady
npm install
cp .env.example .env
```

### 2. Start the System

```bash
npm run dev    # Development mode with hot reload
# or
npm start      # Production mode
```

### 3. Verify It's Running

```bash
curl http://localhost:3300/api/health
# → {"ok":true,"service":"heady-manager","ts":"..."}
```

### 4. Open the Interfaces

| Interface | URL | Description |
|-----------|-----|-------------|
| Sacred Geometry UI | http://localhost:3300 | Main dashboard |
| Admin IDE | http://localhost:3300/admin | Admin management |
| API Health | http://localhost:3300/api/health | Health check |
| System Status | http://localhost:3300/api/system/status | Full status |
| Pipeline State | http://localhost:3300/api/pipeline/state | Pipeline view |

---

## Core Concepts

### HCFullPipeline
The master pipeline that runs all workloads:
```
ingest → plan → execute-major-phase → recover → finalize
```
Each stage has a **checkpoint** where the system re-analyzes state, configs, and patterns.

### HeadyRegistry
The central catalog of everything in the ecosystem:
- **Services** — what's running, where, what version
- **Workflows** — pipeline definitions, arena configs
- **Patterns** — architecture patterns, resource policies
- **Environments** — local, cloud-me, cloud-sys, cloud-conn
- **Docs & Notebooks** — tracked with version and review status

### Operational Readiness Score (ORS)
0-100 score computed at each checkpoint:
- **>85:** Full speed, aggressive building
- **70-85:** Normal operation
- **50-70:** Maintenance mode
- **<50:** Recovery mode

### Story Driver
Turns system events into coherent narratives. Ask "What changed?" and get a human-readable answer.

### Checkpoint Protocol
At every commit, merge, pipeline completion, or release — ALL files are synced: code, config, docs, notebooks, registry.

---

## Key Repos

| Repo | Purpose | URL |
|------|---------|-----|
| HeadySystems/Heady | Primary system repo | github.com/HeadySystems/Heady |
| HeadyMe/Heady | Personal cloud instance | github.com/HeadyMe/Heady |
| HeadyConnection/Heady | Cross-system bridge | github.com/HeadyConnection/Heady |
| HeadySystems/sandbox | Experimental features | github.com/HeadySystems/sandbox |

---

## Cloud Layers

Switch between environments using the Heady Layer Switcher:

| Layer | Endpoint | Color |
|-------|----------|-------|
| `local` | localhost:3300 | Green |
| `cloud-me` | app.headysystems.com | Cyan |
| `cloud-sys` | app.headysystems.com | Magenta |
| `cloud-conn` | app.headysystems.com | Yellow |
| `hybrid` | Local + Cloud | White |

```powershell
hl list            # Show all layers
hl switch cloud-me # Switch to HeadyMe cloud
hl status          # Current active layer
```

---

## Essential Commands

### Pipeline Operations
```bash
curl -X POST localhost:3300/api/pipeline/run     # Trigger pipeline
curl localhost:3300/api/pipeline/state            # Current state
curl localhost:3300/api/pipeline/config           # Config summary
```

### System Operations
```bash
curl localhost:3300/api/health                    # Health check
curl localhost:3300/api/system/status             # Full status
curl localhost:3300/api/nodes                     # AI node status
curl localhost:3300/api/registry                  # Registry catalog
```

### Build & Deploy
```powershell
.\commit_and_build.ps1    # Local build cycle
.\nexus_deploy.ps1        # Push to all remotes
.\scripts\Heady-Sync.ps1  # Multi-remote sync
```

---

## First 10 Tasks to Try

1. **Check system health** — `curl localhost:3300/api/health`
2. **View pipeline state** — `curl localhost:3300/api/pipeline/state`
3. **Browse HeadyRegistry** — `curl localhost:3300/api/registry`
4. **Run a pipeline cycle** — `curl -X POST localhost:3300/api/pipeline/run`
5. **Check readiness score** — `curl localhost:3300/api/readiness/evaluate`
6. **View AI nodes** — `curl localhost:3300/api/nodes`
7. **Switch cloud layer** — `hl switch cloud-me`
8. **Run checkpoint sync** — `.\scripts\checkpoint-sync.ps1`
9. **Open a Colab notebook** — `notebooks/quick-start/heady-quick-start.ipynb`
10. **View system stories** — `curl localhost:3300/api/stories`

---

## Quick Links

- **Checkpoint Protocol:** `docs/CHECKPOINT_PROTOCOL.md`
- **Services Manual:** `docs/heady-services-manual.md`
- **Pipeline Config:** `configs/hcfullpipeline.yaml`
- **Registry:** `heady-registry.json`
- **Colab Notebooks:** `notebooks/`
- **Project Notebook (Notion):** `docs/notion-project-notebook.md`
- **Doc Ownership:** `docs/DOC_OWNERS.yaml`

---

## Getting Help

- Ask **HeadyBuddy**: "Show me my current projects in HeadyRegistry"
- Ask **Story Driver**: "What changed this week?"
- Check **Readiness**: `curl localhost:3300/api/readiness/evaluate`
- Run **Diagnostics**: `curl localhost:3300/api/health-checks/run`

---

*This document is maintained as part of the Checkpoint Protocol. It is reviewed and updated after every major release.*
