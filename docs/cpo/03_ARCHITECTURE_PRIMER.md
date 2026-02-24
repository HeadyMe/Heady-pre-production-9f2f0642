# Heady — Architecture Primer (CPO Altitude)

> How the system works: components, AI routing, service mesh, execution lifecycle.  
> **Sources:** `heady-registry.json` v3.3.0, `heady-intelligence.yaml`, `ecosystem.config.js`, `heady-manager.js`

---

## The Heady Loop (Every Action, Every Surface)

```
1. ASK       → Intent captured (voice, chat, code change, API call)
2. PLAN      → HeadyJules decomposes into DAG subtasks
3. ROUTE     → Headypromoter selects AI nodes + MCP tools (ensemble-first)
4. EXECUTE   → Tools run via MCP connectors; 7 AI nodes produce results
5. VALIDATE  → Arena Mode (7 strategies) + HeadySims (UCB1) + HeadyBattle (Socratic)
6. PROVE     → Receipt: models used, tools invoked, cost, scores, outcome
7. PROMOTE   → Winner branch merged if score ≥ 0.75, HeadyBattle validation passes
8. LEARN     → HeadyMemory stores vectors; HeadyVinci tracks patterns; continuous-learning.js evolves
```

---

## 8 Core Components (Registry)

| Component | Type | Role | Criticality | Source |
|-----------|------|------|-------------|--------|
| **Headypromoter** | Orchestration | Task routing, policy enforcement, parallel execution, worker management | Critical | `src/hc/Headypromoter.js` |
| **HeadyManager** | API Gateway | Request routing, authentication, rate limiting | Critical | `heady-manager.js` (126KB) |
| **HCBrain** | Intelligence | Meta-control, readiness evaluation, governance, auto-tuning | Critical | `src/hcbrain.js` |
| **HeadyCoder** | Coding Orchestrator | Ensemble coding, multi-node routing, anti-template enforcement, HeadyBattle integration, cost optimization | Critical | `configs/heady-coder.yaml` |
| **HeadySupervisor** | Supervisor | Agent supervision (max ~6 parallel), task distribution, failure recovery | High | `src/hcsupervisor.js` |
| **HeadyLens** | Monitoring | Real-time monitoring, system overview, ORS tracking, alerting | High | `src/monitoring/health-monitor.js` |
| **HeadySims Scheduler** | Optimizer | UCB1 plan selection, drift detection, speed/priority modes, branch orchestration, HeadyBattle Mode | High | `src/hcmontecarlo.js` |
| **HeadyMaintenance** | Governance | File governance, root cleanup, directory contracts, pre-commit enforcement, config sync | High | `src/configs/file-governance.yaml` |

See the [Architecture Target State Blueprints](04_TARGET_STATE_BLUEPRINTS.md) for concrete PostgreSQL schemas, pipeline definitions, and API contracts planned for the next implementation phase.

---

## AI Node Catalog (7 Active Nodes)

The default reasoning mode is **ensemble** — Heady Intelligence Layer, not any single vendor model. Single-model overrides require explicit triggers ("Claude only", "Gemini only", "local only").

| Node | Provider + Model | Role | Strengths | SLO P50/P95 | Cost (in/out $/MTok) |
|------|-----------------|------|-----------|-------------|---------------------|
| **HeadyClaude** | Anthropic / Claude Opus 4.6 (1M ctx, 128K out) | Primary Architect | Architecture, debugging, self-critique, policy reasoning, long-context | 1500/3000ms | $5/$25 |
| **HeadyCodex** | OpenAI / GPT-5.3 Codex (400K ctx, xhigh-fast) | Primary Executor | Agentic coding, multi-file refactors, terminal execution, security scans, test gen | 1200/2500ms | $2/$14 |
| **HeadyGemini** | Google / Gemini 3.1 Pro (1M ctx) | Logic/Visual Specialist | Advanced reasoning, multimodal, SVG animation, creative coding, vision, logic benchmarks | 1500/3000ms | $2/$12 |
| **HeadyPerplexity** | Perplexity / Sonar Pro (200K ctx) | Research Specialist | Real-time web research, documentation search, API discovery, fact-checking, trend analysis | 2000/5000ms | $3/$15 |
| **HeadyCopilot** | GitHub / Copilot (Opus 4.6 backend) | IDE Completion | Inline completions, PR review, IDE integration, speed, local context | Low | Subscription |
| **HeadyJules** | Internal | Orchestrator | Task decomposition, parallel distribution, conflict resolution, workflow selection, policy-aware routing | Low | Low |
| **HeadyGrok** | xAI / Grok-4 (256K ctx) | Adversarial Validator | Adversarial testing, edge-case discovery, attack surface analysis, red-team thinking, real-time data | 2000/4000ms | $3/$15 |

### Routing Tiers (Standing Directive)

```
User request → HeadyBuddy Router
├─ Fast/simple       → Ollama on Bossgame (FREE, <100ms)
├─ General chat      → OpenAI (2x ChatGPT Pro Business seats)
├─ Deep reasoning    → OpenAI o1 pro mode (Business seats)
├─ Long context      → Anthropic (2x Claude Individual Pro + API Credit)
├─ Code generation   → Claude 3.5 Sonnet / Opus (via API / Pro plans)
├─ Multimodal        → Google AI Ultra / Gemini Ultra
└─ Compute/Training  → 4x Colab Pro+ Memberships (A100 GPUs, massive CU pool)
```

### Fallback Policy (from `heady-intelligence.yaml`)

```
1. Retry same node with more context
2. Reroute to alternate node (same role)
3. Escalate to ensemble battle
4. Surface partial result with explicit risk callouts (NEVER template apology)
```

---

## 19 Internal Services (All Healthy)

| Service | Role | Service | Role |
|---------|------|---------|------|
| heady-brain | Inference (primary AI) | heady-memory | Context/vector store |
| heady-soul | Reflection/consciousness | heady-config | Configuration mgmt |
| heady-conductor | Request orchestration | heady-system | System info/health |
| heady-battle | Arena competition | heady-nodes | AI node registry |
| heady-hcfp | Execution pipeline | heady-stream | Real-time events (WebSocket) |
| heady-patterns | Resilience/anti-fragility | heady-cloud | Cloud connector |
| heady-lens | Monitoring/differentials | heady-auto-success | Background automation |
| heady-vinci | Creative/pattern learning | heady-registry | Service catalog |
| heady-notion | Knowledge sync (Notion) | heady-ops | Operations/DevOps |
| heady-maintenance | Housekeeping/cleanup | | |

Last health scan: **Feb 24, 2026** — all 19 returning sub-5ms latency.

---

## HeadyManager Gateway Architecture

```
Express.js Application (port 3301)
├── Middleware Stack
│   ├── helmet()         → CSP, XSS protection, frame guards
│   ├── cors()           → Cross-origin policy
│   ├── compression()    → Gzip response compression
│   ├── rateLimit()      → Request rate limiting
│   └── express.json()   → Body parsing
│
├── 20 Route Modules (src/routes/)
│   ├── brain.js    (46KB) → Core AI inference, chat, completions
│   ├── memory.js   (24KB) → Vector memory CRUD, search, federation
│   ├── vinci-canvas.js (17KB) → Creative canvas, visual generation
│   ├── hive-sdk.js (13KB) → Distributed compute SDK
│   ├── battle.js   (9KB)  → Arena competitions, scoring
│   ├── conductor.js (8KB) → Request orchestration
│   ├── hcfp.js     (8KB)  → Pipeline execution
│   ├── lens.js     (7KB)  → Monitoring, telemetry
│   └── ... (+12 more)
│
├── WebSocket Server (ws)  → Real-time event streaming
├── Swagger UI             → API documentation
├── Event Bus (EventEmitter → global.eventBus)
│
└── Service Layer
    ├── arena-mode-service.js    (19KB) → 7-strategy tournaments
    ├── monte-carlo-service.js   (17KB) → UCB1 simulation engine
    ├── socratic-service.js      (21KB) → HeadyBattle interrogation
    ├── branch-automation-service (18KB) → Git branch lifecycle
    ├── heady-autonomy.js        (17KB) → Autonomous operation
    ├── service-manager.js       (16KB) → Service lifecycle mgmt
    ├── heady-notion.js          (31KB) → Notion knowledge sync
    ├── openai-business.js       (10KB) → OpenAI integration
    ├── error-sentinel-service   (5KB)  → Error detection/recovery
    └── heady-branded-output     (3KB)  → Brand-consistent output
```

---

## Arena Mode + HeadySims + HeadyBattle

### Arena Mode (7 Strategies)

```
fast_serial       → Quick sequential execution
fast_parallel     → Concurrent processing
balanced          → Resource-optimized
thorough          → Comprehensive analysis
cached_fast       → Optimized caching
probe_then_commit → Validation-first
monte_carlo_optimal → MC-selected best
```

### HeadySims (Monte Carlo)

- Algorithm: UCB1 (Upper Confidence Bound)
- Candidates per task: 4
- Simulation runs: 1,000
- Promotion threshold: 0.75
- Stagnation intervals: 5
- Evaluation weights: latency 0.3, accuracy 0.25, efficiency 0.2, satisfaction 0.15, quality 0.1

### HeadyBattle (Socratic Interrogation)

Every change validated with 3-depth interrogation:

- **Purpose:** What is the goal? How does it serve the mission? What problem does it solve?
- **Consequences:** What could go wrong? Who's affected? What are the trade-offs?
- **Optimization:** Most elegant solution? Can it be simplified? What patterns does it establish?
- Minimum validation score: 0.8
- Human review threshold: 0.7

### Branch Gating

```
feature → development (IDE, HeadyBattle interrogation)
    → staging (Arena Mode, HeadySims 100%, competitive simulation)
    → main (production, final HeadyBattle validation)
```

---

## Enforced Architectural Patterns

| Pattern | Description | Source |
|---------|-------------|--------|
| **Ensemble-First** | Default reasoning is the Heady aggregate, not any single vendor model. Full-spectrum utilization unless explicitly overridden. | `heady-intelligence.yaml` |
| **Anti-Template Policy** | Systems never return generic boilerplate. 14 banned patterns including "As an AI…", "lorem ipsum", "TODO:", "placeholder". Violations trigger reject → reroute → RAG → HeadyBattle escalation. | `heady-intelligence.yaml` |
| **Multi Source-of-Truth Protocol** | Sandbox as change origin, controlled promotion to Systems/Me/Connection repos with registry-driven sync and hard gates. | `ITERATIVE_REBUILD_PROTOCOL.md` |

---

## Infrastructure Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Compute** | Bossgame P6 | Ryzen 9 6900HX, 8C/16T, 32GB LPDDR5, 1TB NVMe |
| **Process Manager** | PM2 | 18 processes, 4GB budget (512M core, 64M per site) |
| **Gateway** | Express.js | Port 3301, Helmet, CORS, rate-limit, Swagger, WebSocket |
| **Tunnel** | Cloudflare Tunnel | "heady-nexus" → all custom domains |
| **PaaS** | Coolify | On Bossgame |
| **Local Inference** | Ollama | Llama 3.1 8B, CodeLlama 13B, Mistral 7B, nomic-embed-text |
| **Static Sites** | Cloudflare Pages | GitHub auto-deploy on push |
| **CDN** | Cloudflare Pro | WAF, Workers, Polish, Mirage |
| **Memory** | Vector (in-process) | `vector-memory.js` + `vector-federation.js` + `vector-pipeline.js` |
| **Learning** | Continuous | `continuous-learning.js` + `self-optimizer.js` + `self-awareness.js` |

---

## Configuration Landscape

106 YAML/JSON configs in `configs/` covering:

- **Domains:** 10+ domain-related configs (branded-domains, clean-domains, domain-architecture, rationalized-domains, etc.)
- **AI:** heady-intelligence, ai-routing, ai-services, brain-profiles, heady-coder, heady-battle
- **Infrastructure:** cloudflared-config, cloudflare-dns, deployment-strategy, resource-allocation, resource-policies
- **Governance:** file-governance, governance-policies, automation-policy, founder-intent-policy
- **Operations:** observability, service-contracts, service-discovery, service-catalog
- **Security:** secrets-manifest, pki/, connection-integrity
- **Applications:** heady-buddy, heady-browser, heady-ide, heady-auto-ide, vr-overlay
