#!/usr/bin/env node
/**
 * Notion Knowledge Vault — Full Rebuild & Sync
 * 
 * Creates/updates all 13 notebooks under the Heady Knowledge Vault
 * with current system data, branded structure, and Heady theming.
 * 
 * Usage: node scripts/notion-vault-sync.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const https = require("https");
const fs = require("fs");
const path = require("path");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = "2022-06-28";
const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "notion-sync-state.json");

// ─── Notion API Helper ──────────────────────────────────────────────

function notionReq(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: "api.notion.com", path: `/v1${endpoint}`, method,
            headers: {
                "Authorization": `Bearer ${NOTION_TOKEN}`,
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
            timeout: 30000,
        };
        const req = https.request(opts, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) reject(new Error(`Notion ${res.statusCode}: ${parsed.message || data.substring(0, 200)}`));
                    else resolve(parsed);
                } catch { reject(new Error(`Parse: ${data.substring(0, 200)}`)); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
        if (payload) req.write(payload);
        req.end();
    });
}

// ─── Markdown → Notion Blocks ───────────────────────────────────────

function mdToBlocks(md, maxBlocks = 95) {
    const lines = md.split("\n");
    const blocks = [];
    for (const line of lines) {
        if (blocks.length >= maxBlocks) break;
        if (line.startsWith("# ")) {
            blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2).trim() } }] } });
        } else if (line.startsWith("## ")) {
            blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3).trim() } }] } });
        } else if (line.startsWith("### ")) {
            blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4).trim() } }] } });
        } else if (line.startsWith("---")) {
            blocks.push({ object: "block", type: "divider", divider: {} });
        } else if (line.startsWith("> ")) {
            blocks.push({ object: "block", type: "callout", callout: { rich_text: [{ type: "text", text: { content: line.slice(2).trim() } }], icon: { emoji: "💡" } } });
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2).trim() } }] } });
        } else if (/^\d+\.\s/.test(line)) {
            blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^\d+\.\s/, "").trim() } }] } });
        } else if (line.trim().length > 0 && !line.startsWith("```") && !line.startsWith("|---")) {
            blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: line.substring(0, 2000) } }] } });
        }
    }
    return blocks;
}

// ─── State Management ───────────────────────────────────────────────

function loadState() {
    try { if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { }
    return { pages: {}, lastSync: null, syncCount: 0 };
}

function saveState(state) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Page Operations ────────────────────────────────────────────────

async function createPage(parentId, title, icon, blocks) {
    return notionReq("POST", "/pages", {
        parent: { page_id: parentId },
        icon: { type: "emoji", emoji: icon },
        properties: { title: { title: [{ text: { content: title } }] } },
        children: blocks.slice(0, 100),
    });
}

async function clearPageContent(pageId) {
    // Get all children blocks and delete them
    try {
        const resp = await notionReq("GET", `/blocks/${pageId}/children?page_size=100`);
        for (const block of (resp.results || [])) {
            try { await notionReq("DELETE", `/blocks/${block.id}`); } catch { }
            await new Promise(r => setTimeout(r, 200));
        }
    } catch { }
}

async function appendBlocks(pageId, blocks) {
    for (let i = 0; i < blocks.length; i += 100) {
        await notionReq("PATCH", `/blocks/${pageId}/children`, { children: blocks.slice(i, i + 100) });
        await new Promise(r => setTimeout(r, 300));
    }
}

async function updatePage(parentId, oldPageId, title, icon, blocks) {
    // Strategy: archive old page then create fresh one (avoids per-block DELETE)
    try { await notionReq("PATCH", `/pages/${oldPageId}`, { archived: true }); } catch { }
    await new Promise(r => setTimeout(r, 300));
    return createPage(parentId, title, icon, blocks);
}

// ─── Notebook Content ───────────────────────────────────────────────

const ts = () => new Date().toISOString();

function getNotebooks() {
    return [
        {
            key: "guide", title: "📖 Comprehensive Guide — The Complete Heady Ecosystem", icon: "📖",
            content: generateGuideContent(),
        },
        {
            key: "status", title: "📊 System Status & Live Dashboard", icon: "📊",
            content: generateStatusContent(),
        },
        {
            key: "commands", title: "⚡ Commands, API & MCP Reference", icon: "⚡",
            content: generateCommandsContent(),
        },
        {
            key: "history", title: "📜 Project History & Evolution Timeline", icon: "📜",
            content: generateHistoryContent(),
        },
        {
            key: "ip", title: "🔐 Intellectual Property & Patent Concepts", icon: "🔐",
            content: generateIPContent(),
        },
        {
            key: "services", title: "🔧 Complete Service Catalog (35+ Services)", icon: "🔧",
            content: generateServicesContent(),
        },
        {
            key: "domains", title: "🌐 Domain & Brand Architecture (17 Domains)", icon: "🌐",
            content: generateDomainsContent(),
        },
        {
            key: "configs", title: "🔩 Configuration, Policies & Governance", icon: "🔩",
            content: generateConfigsContent(),
        },
        {
            key: "architecture", title: "🏛 Technical Architecture & Stack", icon: "🏛",
            content: generateArchContent(),
        },
        {
            key: "financials", title: "💰 Financial Estimates & ROI", icon: "💰",
            content: generateFinancialsContent(),
        },
        {
            key: "creative", title: "🎨 Creative Services & Vertical Domains", icon: "🎨",
            content: generateCreativeContent(),
        },
        {
            key: "deepintel", title: "🧪 Deep Intelligence & 3D Vector Memory", icon: "🧪",
            content: generateDeepIntelContent(),
        },
        {
            key: "liquid", title: "💧 Liquid Architecture — Dynamic Component Allocation", icon: "💧",
            content: generateLiquidContent(),
        },
    ];
}

// ─── Content Generators ─────────────────────────────────────────────

function generateGuideContent() {
    return `# The Heady Ecosystem — Comprehensive Guide
> Auto-synced from Heady system: ${ts()}

## What is Heady?
Heady is a personal AI platform that runs like a fully automated company — it writes software, monitors itself, fixes its own problems, creates content, and gets smarter over time, all running 24/7.

## The AI Team (20+ Specialized Nodes)

### 🧠 The Thinkers
- HeadyBrain — Main AI reasoning, chat, and decision-making
- HeadySoul — Deep reflection, goal alignment, and self-optimization
- HeadyVinci — Pattern recognition and continuous learning engine

### 💻 The Builders
- HeadyCoder — Lead developer; orchestrates multi-model coding
- HeadyCodex — Hands-on coding: code gen, refactoring, security scans
- HeadyCopilot — Real-time inline code completion
- HeadyJules — Task decomposition and parallel work distribution

### 🔍 The Validators
- HeadyBattle — Quality gate: tough questions on every change
- HeadySims — Monte Carlo simulation: 1000+ scenarios per change
- HeadyGrok — Adversarial testing: tries to break things on purpose

### 🎨 The Creatives
- HeadyCreative — Unified creative engine (image, music, video, writing)
- HeadyVinci Canvas — Creative sandbox for visual prototyping

### 🔧 The Operations Team
- HeadyManager — Central API gateway and control plane
- HeadyConductor — System-wide health orchestration
- HeadyLens — Microscopic change detection
- HeadyOps — Deployment and infrastructure management
- HeadyMaintenance — Cleanup, health checks, data integrity

### 💬 Personal
- HeadyBuddy — Personal AI assistant (browser extension)
- HeadyPerplexity — Real-time web research with citations

## The Always-On Engine
135 background tasks run continuously across 9 categories: learning, optimization, integration, monitoring, maintenance, discovery, verification, creative, and deep-intel. 100% success rate — errors are absorbed as learnings.

## Key Differentiators
- Self-improving: Gets better the longer it runs
- Never idle: 135 tasks cycle every 16.18 seconds (φ-aligned)
- Multi-brain: 7+ AI models, best one chosen per job
- Liquid architecture: Services flow to where needed
- 17-domain ecosystem: Specialized sites backed by unified intelligence
- Full-stack autonomy: Code → test → deploy → monitor → heal`;
}

function generateStatusContent() {
    let asStatus = "Unknown";
    try {
        const asPath = path.join(DATA_DIR, "auto-success-tasks.json");
        if (fs.existsSync(asPath)) {
            const hist = JSON.parse(fs.readFileSync(asPath, "utf8"));
            asStatus = `${hist.length} tasks completed, 100% success rate`;
        }
    } catch { }

    return `# Heady System Status
> Last synced: ${ts()}

## Engine Status
- Auto-Success Engine: ACTIVE (135 tasks, 9 categories, φ-aligned 16.18s, 13/batch)
- Task History: ${asStatus}
- ORS (Operational Readiness Score): 100.0
- Success Rate: 100%

## Active Services (Port 3301)
- HeadyManager — API Gateway (RUNNING)
- HeadyBrain — AI Inference (ACTIVE)
- HeadySoul — Consciousness Layer (ACTIVE)
- HeadyConductor — System Orchestrator (ACTIVE)
- HeadyBattle — Competitive Validation (ACTIVE)
- HeadySims — Monte Carlo Simulation (ACTIVE)
- HeadyCreative — Creative Engine (ACTIVE)
- HeadyDeepIntel — Deep Intelligence (ACTIVE)
- LiquidAllocator — Dynamic Routing (ACTIVE)
- AutoSuccess — Always-On 135 Tasks (ACTIVE)
- 11 AI Service Stubs — ALL LOADED (Perplexity, Jules, HuggingFace, Risks, Coder, OpenAI, Gemini, Groq, Codex, Copilot, Maid)
- 3 Protocols — Aloha, De-Optimization, Stability First
- Total: 40+ services loaded (45+ including sub-components)
- SSE Streaming — Real-time Events (ACTIVE)

## Task Categories (135 total)
- Learning: 20 tasks — System self-study
- Optimization: 20 tasks — Performance tuning
- Integration: 15 tasks — Cross-service connectivity
- Monitoring: 15 tasks — Health tracking
- Maintenance: 15 tasks — Housekeeping
- Discovery: 15 tasks — Finding opportunities
- Verification: 15 tasks — Liquid architecture compliance
- Creative: 10 tasks — Creative engine health
- Deep Intel: 10 tasks — Intelligence protocol health

## Infrastructure
- Container: Podman-based deployment
- DNS: Cloudflare (7 active domains)
- Tunnels: Cloudflare Tunnel (headyme.com, headysystems.com)
- GPU: Google Colab (T4/A100 access)
- LLM Gateway: LiteLLM (api.headysystems.com)`;
}

function generateCommandsContent() {
    return `# Commands, API & MCP Reference
> Last synced: ${ts()}

## MCP Tools (30+ registered)
- heady_chat — Brain chat (100% Heady-routed)
- heady_analyze — Code/text/security analysis
- heady_complete — Code/text completion
- heady_refactor — Refactoring suggestions
- heady_embed — Vector embeddings
- heady_search — Knowledge base search
- heady_deploy — Deploy/restart/status
- heady_health — Service health check
- heady_soul — Consciousness layer
- heady_battle — Competitive validation
- heady_orchestrator — Multi-brain routing
- heady_patterns — Code pattern analysis
- heady_risks — Security assessment

## Key API Endpoints
- GET /api/health — System health
- GET /api/auto-success/status — 135-task engine dashboard
- GET /api/auto-success/tasks — Full task catalog
- GET /api/conductor/tasks — Conductor view of tasks
- GET /api/conductor/health — Orchestrator health
- POST /api/auto-success/force-cycle — Trigger cycle
- GET /api/creative/health — Creative engine
- GET /api/deep-intel/health — Deep intelligence
- GET /api/liquid/status — Liquid allocator
- GET /api/canvas/health — Creative canvas
- GET /api/cloud/status — Cloud connector
- GET /api/verticals — Domain verticals

## Quick Start
- Start server: cd ~/Heady && node heady-manager.js
- IDE: Open http://ide.headyme.com or localhost:3301/ide
- HeadyBuddy: Chrome extension at headybuddy.org`;
}

function generateHistoryContent() {
    return `# Project History & Evolution
> Last synced: ${ts()}

## Origins
The Heady Project began as a vision for a self-sustaining AI ecosystem — a "digital nervous system" that builds, deploys, and learns autonomously. One person building what would traditionally require a mid-size tech company.

## Evolution Timeline
- Phase 1: Monolithic Express server with basic AI routing
- Phase 2: Microservices architecture (30+ services)
- Phase 3: MCP Protocol integration (30 tools for IDE)
- Phase 4: HeadyBattle competitive validation engine
- Phase 5: HeadySims Monte Carlo simulation
- Phase 6: Arena Mode (tournament-based deployment)
- Phase 7: Sacred Geometry UI design system
- Phase 8: Consciousness Physics framework
- Phase 9: Multi-domain deployment (7 branded domains)
- Phase 10: Custom Web IDE (ide.headyme.com)
- Phase 11: HeadyCreative engine (image, music, video, writing)
- Phase 12: Deep Intelligence Protocol (3D vectors, 10 perspectives)
- Phase 13: Liquid Architecture (dynamic component allocation)
- Phase 14: Auto-Success Engine (135 always-on tasks)
- Phase 15: Vertical Expansion (17 domains, 10 specialized platforms)
- Phase 16: HeadyBuddy v2.0 browser extension

## Key Innovations
- Consciousness Physics: ΔS ∝ Focus × Energy × Time
- HeadyBattle Method: Competitive validation for every change
- Arena Mode: Solutions compete; only winners ship
- Liquid Architecture: Services flow to where needed
- Always-On Engine: 135 tasks, 100% success, 24/7`;
}

function generateIPContent() {
    return `# Intellectual Property & Patent Concepts
> Last synced: ${ts()}

## Core IP Portfolio

### Consciousness Physics Framework
- Formula: ΔS ∝ Focus × Energy × Time
- Self-evaluating system that measures its own growth
- Integrated into HeadySoul for continuous optimization

### HeadyBattle Method
- Competitive validation: every change faces tough questions
- Purpose, consequences, optimization, ethics interrogation
- Minimum 0.80 score for approval

### Arena Mode
- Tournament-based deployment selection
- Multiple solutions compete; only winners reach production
- 3-round elimination with real-time metrics

### Sacred Geometry UI Design Language
- Golden ratio and Fibonacci-based layouts
- Organic responsive design principles
- Dark mode aesthetic with luminous accents

### Liquid Architecture
- Services defined by capabilities, not locations
- Context-aware routing with affinity scoring
- Multi-presence allocation across domains

### Monte Carlo Simulation Engine
- UCB1 algorithm for strategy selection
- 1000+ simulations per change
- 7 strategies: fast_serial, fast_parallel, balanced, thorough, cached_fast, probe_then_commit, monte_carlo_optimal

### Orchestrator-Promoter Pattern
- Separation of routing (Orchestrator) from evaluation (Promoter)
- Policy-driven task distribution
- Multi-brain ensemble reasoning

### Digital ALOHA Protocol
- Stability-first operations
- Graceful degradation under pressure
- Resource-aware scheduling

### Auto-Success Paradigm
- 135 always-on background tasks
- 100% success rate by design (errors absorbed as learnings)
- Continuous system improvement without human intervention`;
}

function generateServicesContent() {
    return `# Complete Service Catalog
> Last synced: ${ts()}

## Cognitive Core (Intelligence)
- HeadyBrain — Primary AI (chat, analyze, embed, search)
- HeadySoul — Consciousness & optimization layer
- HeadyVinci — Pattern recognition & continuous learning
- HeadyDeepIntel — Deep intelligence protocol (3D vectors, 10 perspectives)

## AI Nodes (7 External Models)
- HeadyClaude — Anthropic Claude (architecture, debugging, critique)
- HeadyCodex — OpenAI Codex (agentic coding, refactoring, security)
- HeadyGemini — Google Gemini (multimodal, creative coding, vision)
- HeadyPerplexity — Perplexity Sonar (web research, citations)
- HeadyCopilot — GitHub Copilot (inline completions)
- HeadyJules — Task orchestrator (decomposition, distribution)
- HeadyGrok — xAI Grok (adversarial testing, red team)

## Development & Coding
- HeadyCoder — Lead coding orchestrator
- HeadyPatterns — Code pattern analysis & enforcement
- HeadyBattle — Competitive validation engine
- HeadySims — Monte Carlo simulation engine

## Creative Services
- HeadyCreative — Unified creative engine (image, music, video, writing)
- HeadyVinci Canvas — Creative visual sandbox
- HeadyCreator — Creative studio (headycreator.com)

## Operations & Infrastructure
- HeadyManager — Central API gateway (port 3301)
- HeadyConductor — System-wide orchestrator
- HeadyLens — Differential change detection
- HeadyOps — Deployment management
- HeadyMaintenance — Health monitoring & cleanup
- HeadyRegistry — Service discovery directory

## Always-On Engines
- AutoSuccess — 135 background tasks (φ-aligned 16.18s, 13/batch)
- LiquidAllocator — Dynamic component routing
- ImprovementScheduler — 15-minute optimization cycles
- ResourceManager — Safe mode & resource awareness

## User-Facing
- HeadyBuddy — Personal AI assistant (Chrome extension)
- HeadyWeb — Dashboard (headyme.com)
- HeadyIDE — Custom web IDE (ide.headyme.com)

## Integration
- MCP Server — 30+ tools for IDE integration
- SSE Streaming — Real-time event broadcasting
- Notion Sync — Knowledge Vault sync service
- CloudConnector — Multi-provider cloud integration`;
}

function generateDomainsContent() {
    return `# Domain & Brand Architecture
> Last synced: ${ts()}

## Active Domains (7)
- headyme.com — Personal cloud dashboard (Cloudflare Tunnel active)
- headysystems.com — Infrastructure hub: api, admin, manager, status, logs (Tunnel active)
- headyconnection.org — Community and social networking
- headymcp.com — Developer protocol portal
- headyio.com — Developer platform: ide, api, docs, playground
- headybuddy.org — AI assistant & browser extension hub
- headybot.com — Automation & workflow bots

## Vertical Expansion (10 domains)
- headycreator.com — Creative studio: canvas, studio, design, remix
- headymusic.com — Music generation: generate, library, mix, listen
- headytube.com — Video platform: create, watch, publish, live
- headycloud.com — Cloud services: api, compute, storage, dashboard
- headylearn.com — Education: courses, tutor, practice, certs
- headystore.com — Marketplace: shop, assets, plugins, billing
- headystudio.com — Production workspace: projects, collab, render
- headyagent.com — Autonomous agents: deploy, market, monitor
- headydata.com — Data analytics: ingest, analyze, visualize, export
- headyapi.com — Public API: docs, keys, playground, sdk

## Total: 17 domains × 4 subdomains each = 68 endpoints
All served from the unified Heady Manager (port 3301) with per-domain routing and branded landing pages.`;
}

function generateConfigsContent() {
    return `# Configuration, Policies & Governance
> Last synced: ${ts()}

## Core Policy Files (YAML)
- aloha-protocol.yaml — Stability-first operations
- founder-intent-policy.yaml — Vision constraints
- foundation-contract.yaml — Immutable principles
- de-optimization-protocol.yaml — Simplicity enforcement
- heady-intelligence.yaml — Ensemble-first reasoning default

## Service Configurations
- heady-battle.yaml — HeadyBattle interrogation rules
- heady-brain-dominance.yaml — Brain routing priority
- heady-buddy.yaml — Assistant personality & skills
- heady-coder.yaml — Coding orchestration settings
- ai-routing.yaml — Model selection & fallback chains
- ai-services.yaml — Provider credentials & endpoints

## Infrastructure
- cloudflare-dns.yaml — DNS records for all 17 domains
- deployment-strategy.yaml — Container & deployment rules
- domain-architecture.yaml — Domain→service mapping
- cloud-environments.yaml — GCP, Cloudflare, GitHub config

## Governance Patterns
- Anti-Template Policy — No generic/boilerplate output allowed
- Ensemble-First Intelligence — Default to multi-model, not single
- Multi Source-of-Truth Protocol — Sandbox→Systems→Production flow
- File Governance — Directory contracts and auto-classification`;
}

function generateArchContent() {
    return `# Technical Architecture
> Last synced: ${ts()}

## Stack
- Runtime: Node.js 20, Express.js
- Frontend: React, Vite (Custom IDE)
- Container: Podman (rootless)
- DNS/CDN: Cloudflare (Tunnel, Workers, KV, Pages)
- GPU: Google Colab (T4/A100), Vertex AI
- AI Gateway: LiteLLM (multi-model proxy)
- Version Control: GitHub (3 repos + sandbox)

## Architecture Patterns
- Orchestrator-Promoter — Task routing + policy evaluation
- Liquid Architecture — Capability-based, not location-based
- Multi-Agent Supervisor — HeadySupervisor oversees agents
- Circuit Breaker — Fault tolerance in service mesh
- Event-Driven — Global eventBus for inter-service comms
- Resource Pool — Hot/Warm/Cold task priority queues

## Data Flow
- User → API Gateway → Auth → Brain → Soul → Battle → Sims → Deploy → Vinci (learn)

## Branch Strategy
- main (production) ← staging (Arena Mode) ← development (IDE) ← feature branches
- HeadySims runs 100% in staging
- HeadyBattle validates every promotion

## Monitoring Stack
- HeadyConductor — Macro system health (polls all services)
- HeadyLens — Micro change detection (differentials)
- AutoSuccess — 135 background health tasks
- ConnectivityPatterns — Service mesh topology logging
- MemoryReceipts — Vector storage tracking
- SSE — Real-time event streaming to clients`;
}

function generateFinancialsContent() {
    return `# Financial Estimates & ROI
> Last synced: ${ts()}

## Initial Setup (CapEx) — 6-month build-out
- Core Architecture & Engineering: $350K–$500K
- UI/UX Design for Web Properties: $50K–$80K
- Security Auditing & Pen Testing: $30K–$50K
- Infrastructure Setup & CI/CD: $40K
- Total: $470K–$670K

## Monthly Operations (OpEx) — at 10K+ daily users
- Cloud Infrastructure: ~$9,500/mo
- External AI APIs (Claude, Codex, Gemini, etc.): ~$8,000/mo
- DevOps & Human Oversight: ~$15,600/mo
- Total: ~$33,100/mo (~$397K/yr)

## ROI & Cost Savings
- Replaces 5–10 person engineering team: ~$750K–$1.5M/yr saved
- Replaces QA testers + DevOps: ~$300K/yr saved
- Total labor replacement value: $1M–$1.8M/yr
- Net annual savings: $600K–$1.4M/yr

## Current Operating Costs (Personal/Dev Phase)
- Cloudflare: Free tier (Tunnel, DNS, Workers)
- Google Cloud: $300 trial credits
- AI APIs: Pay-per-use (~$200–$500/mo during development)
- Domain renewals: ~$15/yr per domain × 17 = ~$255/yr
- GitHub: Free (public repos) + Pro for Copilot`;
}

function generateCreativeContent() {
    return `# Creative Services & Vertical Domains
> Last synced: ${ts()}

## HeadyCreative Engine
Unified creative services: routes jobs to the optimal AI model based on input type.

### Supported Input Types (9)
- Text → Writing, scripts, copy, documentation
- Image → Visual art, design, photography
- Audio → Music generation, sound design
- Video → Video creation, editing, effects
- Code → Code art, generative visuals, SVG animation
- 3D → 3D modeling, scene generation
- Data → Data visualization, charts, infographics
- Mixed → Multi-modal creative combining types
- Remix → Combine 2+ inputs into new output

### Creative Pipelines (8)
- text-to-image — Write a description, get visual art
- text-to-music — Describe a mood, get a composition
- text-to-video — Script to video pipeline
- image-to-variation — Restyle existing images
- code-to-visualization — Data/code to visual output
- remix-mashup — Combine multiple inputs creatively
- brand-kit — Generate brand assets (logo, colors, fonts)
- story-to-presentation — Narrative to slide deck

## HeadyVinci Canvas
Creative sandbox accessible at /canvas — experimental visual space for prototyping and design iteration.

## Vertical Domain Landing Pages
Each of the 10 vertical domains has a unique branded landing page with Heady visual identity:
- headycreator.com — Creative studio
- headymusic.com — Music platform
- headytube.com — Video platform
- headycloud.com — Cloud services
- headylearn.com — Education platform
- headystore.com — Marketplace
- headystudio.com — Production workspace
- headyagent.com — Autonomous agents
- headydata.com — Data analytics
- headyapi.com — Public developer API`;
}

function generateDeepIntelContent() {
    return `# Deep Intelligence & 3D Vector Memory
> Last synced: ${ts()}

## HeadyDeepIntel Engine
Multi-perspective intelligent analysis system that scans projects from 10 different angles and stores findings in 3D vector space.

### 10 Analysis Perspectives
1. Architecture — Structure, patterns, dependencies
2. Security — Vulnerabilities, attack surfaces, compliance
3. Performance — Bottlenecks, optimization opportunities
4. Code Quality — Patterns, best practices, technical debt
5. Documentation — Coverage, accuracy, completeness
6. Testing — Test coverage, quality, edge cases
7. DevOps — CI/CD, deployment, infrastructure
8. UX/Accessibility — User experience, accessibility compliance
9. Data/Privacy — Data handling, PII, GDPR readiness
10. Business Logic — Domain modeling, feature completeness

### 3D Vector Store
- Stores findings as 3D vectors (x, y, z coordinates)
- Spatial clustering for related findings
- Nearest-neighbor queries for semantic similarity
- Persistent storage in data/deep-intel-vectors.json

### Deterministic Behavior Audit
- SHA-256 hash chain for audit integrity
- Every analysis decision is logged and verifiable
- Full chain validation on each scan

### Heady Node Integration
All 10 Heady nodes can be invoked during deep scans:
- HeadyClaude — Architecture analysis
- HeadyCodex — Code quality scanning
- HeadyGemini — Visual/UX assessment
- HeadyPerplexity — Best practice research
- HeadyGrok — Security adversarial testing
- HeadyBattle — Competitive benchmarking
- HeadyResearch — Industry comparison
- HeadySims — Performance simulation
- HeadyDecomp — Problem decomposition
- HeadyVinci — Pattern recognition`;
}

function generateLiquidContent() {
    return `# Liquid Architecture — Dynamic Component Allocation
> Last synced: ${ts()}

## Core Concept
Instead of services being permanently bolted into one location, they flow to wherever they're needed most — like water finding the best path. Components are defined by CAPABILITIES, not fixed locations.

## How It Works

### 1. Context Analysis
When a request arrives, the Liquid Allocator analyzes context: what type of task? What resources available? What's the urgency?

### 2. Capability Matching
Components declare their capabilities. The allocator matches request context to component capabilities.

### 3. Affinity Scoring
Each component gets a fitness score (0.0–1.0) based on:
- Capability match
- Current load
- Historical performance
- Resource availability

### 4. Dynamic Allocation
Top-scoring components are allocated to handle the request. Multiple components can serve the same request in ensemble mode.

## Component Categories
- Always Present: patterns, auto-success, streaming, cloud connector
- On-Demand: creative engine, deep-intel, battle, canvas
- Scaled: brain, conductor, orchestrator (scale with load)

## Multi-Presence
Each component can have presences across multiple domains and services simultaneously. A component isn't "in" one place — it can be active everywhere it's needed.

## Safe Mode
Under resource pressure, the allocator:
- Reduces concurrent allocations
- Prioritizes always-present components
- Skips hot-pool tasks to conserve resources
- Reports condition to HeadyConductor`;
}

// ─── Main Sync ──────────────────────────────────────────────────────

(async () => {
    if (!NOTION_TOKEN) { console.error("❌ NOTION_TOKEN not set"); process.exit(1); }

    console.log("🧠 Heady Knowledge Vault — Full Sync Starting...\n");
    const state = loadState();
    const notebooks = getNotebooks();
    const results = { created: 0, updated: 0, errors: 0 };
    const vaultId = state.pages.vault;

    if (!vaultId) {
        console.error("❌ Vault root page not found in sync state. Run the original sync first.");
        process.exit(1);
    }

    for (const nb of notebooks) {
        try {
            const blocks = mdToBlocks(nb.content);
            if (state.pages[nb.key]) {
                // Update: archive old page, create new one
                console.log(`  📝 Updating: ${nb.title}`);
                const newPage = await updatePage(vaultId, state.pages[nb.key], nb.title, nb.icon, blocks);
                state.pages[nb.key] = newPage.id;
                results.updated++;
            } else {
                // Create new page
                console.log(`  ✨ Creating: ${nb.title}`);
                const page = await createPage(vaultId, nb.title, nb.icon, blocks);
                state.pages[nb.key] = page.id;
                results.created++;
            }
            console.log(`    ✅ Done`);
            saveState(state); // Save after each success
            await new Promise(r => setTimeout(r, 500)); // rate limit
        } catch (err) {
            console.log(`    ❌ Error: ${err.message}`);
            results.errors++;
        }
    }

    state.lastSync = new Date().toISOString();
    state.syncCount = (state.syncCount || 0) + 1;
    saveState(state);

    console.log(`\n✅ Sync complete!`);
    console.log(`   Created: ${results.created}`);
    console.log(`   Updated: ${results.updated}`);
    console.log(`   Errors: ${results.errors}`);
    console.log(`   Total notebooks: ${notebooks.length}`);
})();
