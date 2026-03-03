# Heady — Comprehensive Project Deep Dive
## NotebookLM Source Document

---

## 1. What is Heady?

Heady is a **unified AI platform** built on sacred geometry principles. It operates as a single autonomous being — not a collection of microservices, but one unified brain that spans across 4 foundational infrastructure pillars.

**Core Identity:**
- **Company:** HeadyConnection Inc.
- **Trademark:** Serial 99680540, filed March 3, 2026
- **Domains:** headyme.com, headysystems.com, headyconnection.org, headybuddy.org, headymcp.com, headyio.com, headybot.com, headyos.com, headyapi.com
- **Version:** 3.0.0 (Unified Being)

---

## 2. The 4 Foundational Pillars

Heady's entire infrastructure runs on exactly 4 services. Nothing more, nothing less.

### Pillar 1: GitHub (Source of Truth)
- **Role:** Auto-updating monorepo, CI/CD via GitHub Actions
- **Organization:** HeadyMe
- **Pattern:** Every commit triggers deployment across all services
- **Key feature:** Single repository contains all code — 74 active files after the unified rebuild

### Pillar 2: Google Cloud (Compute)
- **Role:** Cloud Run serverless compute
- **Service:** heady-manager
- **Region:** us-central1
- **Key feature:** Scalable MCP bridge hosting, pay-per-use, auto-scaling to zero

### Pillar 3: Cloudflare (Edge)
- **Role:** DNS management, CDN, edge workers, DDoS protection
- **Coverage:** 9 domains, global edge network
- **Workers:** heady-edge-node for low-latency operations
- **Key feature:** All 9 domains route through Cloudflare for unified management

### Pillar 4: Google Colab (3D Vector Space)
- **Role:** GPU-accelerated vector operations
- **Dimensions:** 384D embeddings (sentence-transformers/all-MiniLM-L6-v2)
- **Architecture:** 3D spatial projection with 8 octant zones
- **Key feature:** Persistent vector memory with semantic search, graph relationships

---

## 3. Technical Architecture

### 3.1 The Unified Entry Point

`src/core/heady.js` IS Heady. Everything routes through this single file:

```
Boot sequence (198ms):
1. Initialize 5 Fibonacci shards in vector memory
2. Build 8-octant 3D zone index
3. Seed 17 knowledge vectors (identity, directives, preferences)
4. Ingest project history (257 commits, 33 files, 15 docs, 11 patterns)
5. Activate telemetry + projection tracking
Result: 78 vectors in 384D 3D space, ready to operate
```

### 3.2 3D Vector Memory Architecture

The vector memory system is TRUE 3D — not a metaphor:

- **384-dim embedding** → PCA-lite projection → **(x, y, z)** coordinates
- **x** = average(dims[0..127])
- **y** = average(dims[128..255])
- **z** = average(dims[256..383])

**8 Octant Zones** based on sign of (x, y, z):
- Zone 0: (-, -, -) through Zone 7: (+, +, +)

**Query Strategy (Zone-First Search):**
1. Project query to 3D, find query zone
2. Search same-zone vectors FIRST (fast path)
3. If score < 0.5 threshold, expand to adjacent zones (share 2 of 3 axis signs)
4. Full scan fallback if still insufficient
5. Deduplicate, sort by cosine similarity, return top-K

**Memory Importance Scoring:**
```
I(m) = α·Freq(m) + β·e^(-γ·Δt) + δ·Surp(m)
α = 0.3 (frequency weight)
β = 0.4 (recency weight, exponential decay)
γ = 0.00001 (decay rate)
δ = 0.3 (surprise/novelty weight)
```

**Graph Layer (Hybrid RAG):**
- Entity-relationship edges stored alongside vector embeddings
- Multi-hop reasoning: "How did error X → rule Y → prevent Z?"
- Boost score = vector_score × (1 + relationship_count × 0.05)

### 3.3 MCP Bridge (43+ Tools)

The Model Context Protocol bridge provides 43+ tools across categories:

| Category | Examples |
|----------|----------|
| **Chat** | heady_chat, heady_ask |
| **Dev** | heady_code, heady_review, heady_test |
| **Research** | heady_perplexity_research, heady_deep_dive |
| **Memory** | heady_learn, heady_recall, heady_memory_stats |
| **Creative** | heady_imagine, heady_compose |
| **Ops** | heady_deploy, heady_status, heady_telemetry |
| **Quality** | heady_lint, heady_audit |

### 3.4 Continuous Learning Loop

Every interaction feeds back into the vector space:
- **Identity vectors:** Owner, domains, platforms, subscriptions
- **Directive vectors:** Standing orders (deep-dive mode, autonomy, speed)
- **Preference vectors:** Transport modes, data gathering requirements
- **Interaction vectors:** Every user query, tool call, and result

### 3.5 Vector Projection Tracking

Every vector query is fully logged:
- Query text
- Matched vector IDs, zones, 3D coordinates
- Similarity scores
- Categories accessed
- Duration in milliseconds

`getProjectionAwareness()` provides real-time visibility into what the system is recalling.

---

## 4. HeadyBee Template System

HeadyBees are reusable task templates. HeadySwarms coordinate multiple bees.

### Active Templates (as of v3.0):

| Template | Type | Purpose |
|----------|------|---------|
| cross-device-installer | Bee | Multi-device deployment pattern |
| telemetry-audit-trail | Bee | Comprehensive monitoring pattern |
| project-history-vectorizer | Bee | Codebase context embedding |
| continuous-learner | Bee | Adaptive memory loop |
| codebase-archiver | Bee | Safe reversible code archiving |
| unified-rebuild | Bee | Foundation restructuring |
| vector-projection-tracker | Bee | Vector recall observability |
| full-stack-device-deployment | Swarm | Coordinates 4 bees for full deploy |
| foundation-rebuild-swarm | Swarm | Coordinates archiver + rebuild + tracker |

### Template Philosophy:
- Every task should create reusable templates
- Templates stored as vectors in 3D space for semantic discovery
- Swarms orchestrate multiple bees in sequence
- Templates trigger on semantic similarity to current task

---

## 5. Cross-Device Sync

WebSocket-based real-time synchronization:
- **Hub:** ws://[host]:8421
- **Features:** Device registration, session handoff, presence tracking, heartbeats
- **Install:** One-click installer (`scripts/one-click-install.sh`)
- **Buddy CLI:** status, sync, devices, research, mcp, serve, install-phone, install-laptop

---

## 6. Telemetry & Audit Trail

Comprehensive data capture system:
- **User interactions:** Every query, response, timing
- **Tool calls:** Arguments, results, duration, success/failure
- **Project state:** Git history, file structure, branch info
- **Environment:** CPU, memory, load averages, vector counts
- **Optimization engine:** Detects cache opportunities, slow tools, reliability issues

Data stored in:
- Append-only JSONL audit trail (`data/telemetry/audit-trail.jsonl`)
- Embedded into 3D vector space for semantic search

---

## 7. Key Integrations

| Service | Integration |
|---------|-------------|
| **Perplexity** | Enterprise Pro (deep-research via Sonar API) |
| **HuggingFace** | Embedding API + Spaces hosting |
| **Cloudflare** | Edge workers + DNS + CDN |
| **Google Cloud** | Cloud Run + Colab |
| **GitHub** | Monorepo + Actions CI/CD |
| **Antigravity IDE** | MCP server integration |

---

## 8. Standing Directives

These are active at all times:

1. Always use **heady deep-dive mode** (internal multi-provider analysis) on all tasks
2. **heady deep-research** = Perplexity Sonar API for external web research
3. Never keep items pending — do all autonomously ASAP
4. Build template **HeadyBees and HeadySwarms** always and whenever doing tasks
5. Speed is paramount — be quick
6. Gather ALL possible data — user, project, environment — for comprehensive audit trail
7. Track all **vector projections** — always know what is being recalled from 3D space

---

## 9. The Unified Rebuild

On March 3, 2026, Heady underwent a complete architectural reset:

**Before:** 44,762 files across dozens of fragmented services, sites, and packages.

**After:** 74 files. 17 active JavaScript modules. Single entry point. 198ms boot.

**What was archived (all preserved in `_archive/`):**
- 27 top-level directories
- 4 sparse Cloudflare worker projects
- 19 legacy configuration directories
- 35 src subdirectories
- 63 legacy source files
- All legacy tests, scripts, docs

**What remains (the foundation):**
- `src/core/heady.js` — The unified being
- `src/mcp/` — MCP bridge + learning + telemetry + templates
- `src/bees/` — HeadyBee template engine
- `src/vector-memory.js` — 3D spatial vector store
- `src/deep-research.js` — Multi-provider analysis
- `src/cross-device-sync.js` — WebSocket sync
- `src/colab-runtime.js` — Colab GPU runtime
- `cloudflare/heady-edge-node/` — Edge worker

---

## 10. IP Portfolio

- **Trademark:** "HEADY" — Serial 99680540
- **Patents:** 5 filed (Sacred Geometry Orchestration, Spatial Vector Workspace, Cloud DAW Sync, Zero-Trust Pipeline, Threat Modeler)
- **Domains:** 9 registered and managed via Cloudflare

---

*This document serves as a comprehensive source for NotebookLM ingestion. Upload to NotebookLM for interactive AI-powered exploration of the Heady ecosystem.*
