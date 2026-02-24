# Heady — Executive Brief

> **Last updated:** 2026-02-24  
> **Registry version:** 3.3.0 · **AI Nodes:** 7 active · **Services:** 19 healthy · **PM2 Processes:** 18  
> **Infrastructure:** Bossgame P6 (Ryzen 9 6900HX, 8C/16T, 32GB LPDDR5, 1TB NVMe) → Cloudflare Tunnel "heady-nexus" → 7+ custom domains

---

## What Heady Is (30 seconds)

Heady is an **AI execution platform** that routes tasks across multiple AI engines, validates results through competitive simulation (Arena Mode + HeadySims + HeadyBattle), and proves what happened with auditable receipts — across IDE, companion, and admin surfaces.

**The differentiation is not "another chatbot." It's an orchestrated, observable, policy-aware system that actually executes work and proves what happened.**

---

## Entity Model

| Entity | Type | Role |
|--------|------|------|
| **HeadyConnection** | 501(c)(3) Nonprofit | Mission, community, education — *the why* |
| **HeadySystems** | C-Corp | Hardened platform + commercial products — *the how* |

---

## The 3 Pillars

### Pillar A — Enterprise Platform Spine

**HeadyManager → HeadyPromoter → HCBrain → HeadyLens → HeadyConductor**

126KB Express gateway (port 3301) providing API routing, Helmet CSP, CORS, rate limiting, Swagger docs, WebSocket real-time events, and an internal event bus. 19 internal services spanning inference, orchestration, competition, persistence, monitoring, operations, and AI node management. Registry-driven with ensemble-first routing and anti-template policy enforcement.

### Pillar B — Developer Surface

**HeadyAI-IDE + HeadyCoder + 7 AI Nodes**

IDE where all AI routes through Heady. Arena Mode competes 7 strategies (fast_serial, fast_parallel, balanced, thorough, cached_fast, probe_then_commit, monte_carlo_optimal). HeadySims runs UCB1 Monte Carlo simulation. HeadyBattle validates with Socratic interrogation before promotion. 7 AI nodes: HeadyClaude (Claude Opus 4.6), HeadyCodex (GPT-5.3 Codex), HeadyGemini (Gemini 3.1 Pro), HeadyPerplexity (Sonar Pro), HeadyCopilot (GitHub/Opus 4.6), HeadyJules (orchestrator), HeadyGrok (Grok-4 adversarial).

### Pillar C — Companion Surface

**HeadyBuddy + HeadyBot + HeadyWeb**

Cross-device AI companion with voice, persistent vector memory (`vector-memory.js` + `vector-federation.js`), safe task execution with approvals, continuous learning (`continuous-learning.js`), self-optimization (`self-optimizer.js`), and self-awareness (`self-awareness.js`).

---

## The Unified Story: "The Heady Loop"

All three pillars run the same execution lifecycle:

```
Ask → Plan (HeadyJules decomposition)
    → Route (HeadyPromoter ensemble-first)
    → Execute (MCP tools + AI nodes)
    → Validate (Arena Mode + HeadySims + HeadyBattle)
    → Prove (receipt: models, tools, cost, scores)
    → Promote (branch merge if score ≥ 0.75)
    → Learn (HeadyMemory + HeadyVinci patterns)
```

---

## The 5 CPO Bets

### 1. Execution > Chat

North Star: **verified outcomes per active user per week.**

### 2. Distribution via Developer Surfaces

Win where builders are: IDE (Windsurf integration), terminal (CLI), browser (HeadyWeb). All AI requests route through Heady's ensemble.

### 3. MCP as the Ecosystem Wedge

HeadyMCP (`headymcp.com`) — connector registry, quality gates, governance. 17 verticals ship as curated connector packs.

### 4. Trust + Governance Is the Differentiator

Anti-template policy enforced. HeadyBattle Socratic validation on every change. Ensemble-first intelligence means no single-vendor lock-in.

### 5. Arena Mode Is the Moat

Competitors ship with hope. Heady ships with tournaments (7 strategies), Monte Carlo scoring (UCB1), and auditable receipts.

---

## What Exists Today (Registry + PM2 Verified)

### 8 Core Components

| Component | Type | Criticality |
|-----------|------|-------------|
| HeadyPromoter | Orchestration (task routing, policy, workers) | Critical |
| HeadyManager | API Gateway (auth, rate-limit, routing) | Critical |
| HCBrain | Intelligence (meta-control, governance, auto-tuning) | Critical |
| HeadyCoder | Coding Orchestrator (ensemble, anti-template, battle integration) | Critical |
| HeadySupervisor | Supervisor (agent mgmt, failure recovery) | High |
| HeadyLens | Monitoring (real-time, ORS tracking, alerting) | High |
| HeadySims Scheduler | Optimizer (UCB1, drift detection, Monte Carlo, branch orchestration) | High |
| HeadyMaintenance | Governance (file governance, pre-commit, config sync) | High |

### 7 AI Nodes

| Node | Model | Role | SLO P50/P95 |
|------|-------|------|-------------|
| HeadyClaude | Claude Opus 4.6 (1M ctx) | Primary Architect | 1500/3000ms |
| HeadyCodex | GPT-5.3 Codex (400K ctx) | Primary Executor | 1200/2500ms |
| HeadyGemini | Gemini 3.1 Pro (1M ctx) | Logic/Visual Specialist | 1500/3000ms |
| HeadyPerplexity | Sonar Pro (200K ctx) | Research Specialist | 2000/5000ms |
| HeadyCopilot | GitHub Copilot (Opus 4.6) | IDE Completions | Low |
| HeadyJules | Internal | Orchestrator/Decomposition | Low |
| HeadyGrok | Grok-4 (256K ctx) | Adversarial Validator | 2000/4000ms |

### 19 Internal Services (all healthy, last scan Feb 24)

| Service | Role | Service | Role |
|---------|------|---------|------|
| heady-brain | Inference | heady-memory | Context store |
| heady-soul | Reflection | heady-config | Configuration |
| heady-conductor | Orchestration | heady-system | System info |
| heady-battle | Competition | heady-nodes | AI node registry |
| heady-hcfp | Pipeline | heady-stream | Real-time events |
| heady-patterns | Resilience | heady-cloud | Cloud connector |
| heady-lens | Differentials | heady-auto-success | Background tasks |
| heady-vinci | Creative | heady-registry | Catalog |
| heady-notion | Knowledge | heady-ops | Operations |
| heady-maintenance | Housekeeping | | |

### 18 PM2 Processes (Live Production)

**Core:** heady-manager (port 3301), hcfp-auto-success, lens-feeder  
**Primary Sites (ports 9000-9005):** headybuddy, headysystems, headyconnection, headymcp, headyio, headyme  
**Secondary Sites (ports 9010-9016):** headybuddy-org, headyconnection-org, headymcp-com, headyme-com, headysystems-com, INSTANT-SITE, 1ime1  
**App Sites:** headyweb (port 3000), admin-ui (port 5173)

### 20 API Route Modules

auth (5KB), battle (9KB), brain (46KB), conductor (8KB), config (4KB), hcfp (8KB), headybuddy-config (3KB), hive-sdk (13KB), index (1KB), lens (7KB), maintenance (2KB), memory (24KB), nodes (2KB), ops (3KB), patterns (3KB), registry (4KB), soul (2KB), system (2KB), vinci (2KB), vinci-canvas (17KB)

### 10 Service Modules

arena-mode-service (19KB), branch-automation-service (19KB), error-sentinel-service (5KB), heady-autonomy (17KB), heady-branded-output (3KB), heady-notion (31KB), monte-carlo-service (17KB), openai-business (10KB), service-manager (16KB), socratic-service (21KB)

### 17 Product Verticals (from `verticals.json`)

HeadyMe, HeadySystems, HeadyConnection, HeadyMCP, HeadyIO, HeadyBuddy, HeadyBot, HeadyCreator, HeadyMusic, HeadyTube, HeadyCloud, HeadyLearn, HeadyStore, HeadyStudio, HeadyAgent, HeadyData, HeadyAPI

### Key Source Modules (30 files, sorted by size)

| Module | Size | Purpose |
|--------|------|---------|
| `heady-manager.js` | 126KB | Main Express gateway (root) |
| `hc_auto_success.js` | 54KB | Auto-success pipeline |
| `mcp/heady-mcp-server.js` | 47KB | MCP protocol server |
| `hc_pipeline.js` | 38KB | Full execution pipeline |
| `generate-verticals.js` | 31KB | Vertical site generator |
| `hc_creative.js` | 27KB | Creative engine |
| `agent-orchestrator.js` | 24KB | Multi-agent coordination |
| `self-optimizer.js` | 24KB | Self-optimization loops |
| `hc_auth.js` | 24KB | Authentication system |
| `hc_scientist.js` | 21KB | Scientific reasoning |
| `hc_deep_scan.js` | 19KB | Deep project scanning |
| `vector-memory.js` | 19KB | Vector memory system |
| `hc_deep_intel.js` | 17KB | Deep intelligence |
| `hc_liquid.js` | 16KB | Liquid compute |
| `sdk-services.js` | 15KB | SDK service layer |
| `agents/pipeline-handlers.js` | 15KB | Pipeline agent handlers |
| `heady-registry.js` | 14KB | Registry management |
| `continuous-learning.js` | 14KB | Continuous learning engine |
| `agents/claude-code-agent.js` | 13KB | Claude Code agent integration |
| `vector-federation.js` | 12KB | Federated vector ops |
| `heady-principles.js` | 11KB | Core principles engine |
| `heady-conductor.js` | 11KB | Conductor orchestration |
| `provider-benchmark.js` | 10KB | AI provider benchmarking |
| `corrections.js` | 10KB | Error correction engine |
| `compute-dashboard.js` | 9KB | Compute dashboard |
| `remote-compute.js` | 6KB | Remote compute bridge |
| `self-awareness.js` | 6KB | Self-awareness module |
| `vector-pipeline.js` | 6KB | Vector processing pipeline |

### 224 Configuration Files

Spread across `configs/` — YAML, JSON, and JS covering AI routing, domain architecture, service contracts, security policies, deployment strategies, file governance, and dynamic resource allocation.

### Domains (from Standing Directive)

**Static (Cloudflare Pages):** headysystems.com, headyconnection.org, headybuddy.org, headymcp.com, headyio.com, headyme.com, headybot.com  
**Dynamic (Cloudflare Tunnel → Bossgame):** app.headysystems.com, api.headysystems.com, coolify.headysystems.com, app.headyconnection.org, api.headyconnection.org, app.headybuddy.org, api.headymcp.com, api.headyio.com, app.headyme.com, app.headybot.com

### Infrastructure

| Layer | Technology |
|-------|-----------|
| Compute | Bossgame P6 (Ryzen 9 6900HX, 8C/16T, 32GB LPDDR5, 1TB NVMe) |
| Tunnel | Cloudflare Tunnel "heady-nexus" |
| PaaS | Coolify on Bossgame |
| Local Inference | Ollama (Llama 3.1 8B, CodeLlama 13B, Mistral 7B, nomic-embed-text) |
| Static Sites | Cloudflare Pages (GitHub auto-deploy) |
| CDN | Cloudflare Pro (WAF, Workers, Polish, Mirage) |
| Process Manager | PM2 (18 processes, 32GB RAM available, 64M per site) |

### AI Subscriptions

| Service | Tier | Key Capability |
|---------|------|---------------|
| Claude Code | Enterprise | Agent teams, 1M context, 128K output |
| OpenAI | Pro ($200/mo) | Unlimited GPT-4o, o1 pro mode |
| Google AI | Ultra | Gemini Ultra, multimodal, 2TB storage |
| GitHub | Enterprise | Copilot Enterprise, Advanced Security |
| Colab Pro+ | ×2 accounts | GPU training (A100), 1000 CU total |
| Cloudflare | Pro (headysystems.com) | WAF, CDN, Pages, Tunnel, Workers |

---

## Navigation

→ [Portfolio Map](02_PORTFOLIO_MAP.md) → [Architecture Primer](03_ARCHITECTURE_PRIMER.md) → [Trust & Security](04_TRUST_AND_SECURITY.md)  
→ [Operating Model](05_OPERATING_MODEL.md) → [HeadyMemory Spec](06_HEADY_MEMORY_SPEC.md) → [Roadmap](07_ROADMAP.md)  
→ [17 Verticals](08_17_VERTICALS.md) → [Templates](09_TEMPLATES.md)
