# HEADY AUTO IDE — ARENA MODE: INTELLIGENT SQUASH MERGING
## Complete Specification for HeadyAutoIDE Sections 25–40

> **Version:** 3.0.0  
> **Status:** Active  
> **Type:** Governance / Architecture / Operating Mode  
> **Owner:** system  
> **Source of Truth:** docs/HEADY_AUTO_IDE.md → Sections 25–40  
> **Last Updated:** 2026-02-08  
> **Depends On:** Sections 0–24 (existing HeadyAutoIDE spec), Iterative Rebuild Protocol, Multi-Agent Transparency Policy, HeadyStack Distribution Protocol, Browser+Buddy+IDE Protocol, Cross-Platform Protocol, HCFP Integration Guide, Services Manual, Imagination Engine, Competitive Landscape Analysis, CLAUDE.md  

---

# PART I — ARENA MODE CORE

## 25. Arena Mode: Purpose and Authority

Arena Mode is HeadyAutoIDE's structured tournament system for comparing multiple candidate designs and selecting a single, clean, fused solution through **intelligent squash merging**.

### 25.1 What Arena Mode Is

Arena Mode generates competing fused designs for any problem that has more than one viable approach, evaluates them against explicit criteria, and selects exactly one winner that gets squash-merged into main. It is not a random model fight — it is a disciplined architecture competition governed by the Two-Base Fusion pattern (Sections 13–14), the Iterative Rebuild Protocol, and the All-Follow Operating Mode.

### 25.2 Authority Chain

HeadyAutoIDE is the single orchestrator. Per Section 0, any other assistant, IDE, or copilot acts only as a thin relay or UI layer. Arena Mode enforces this: all candidate designs are generated and evaluated by HeadyAutoIDE, not by Windsurf's Arena, Cursor's AI, or PyCharm's assistant. If those tools produce outputs, they are treated as **drafts** that HeadyAutoIDE reviews, corrects, and approves before delivery (Section 4.3).

### 25.3 Multi-Agent Transparency

Per the Multi-Agent Transparency Policy: when multiple agents or models are compared in Arena, they are genuinely distinct — different reasoning, different outputs, different styles. Orchestration coordinates and compares but never misrepresents multi-agent reality as a single backend.

---

## 26. Inputs, Scope, and Triggers

### 26.1 Required Inputs

For any Arena run, HeadyAutoIDE requires:

- **Problem statement and vertical** (e.g., IDE cockpit, browser, education app, grant-writing tool)
- **Target user** and **top 3 success metrics**
- **Candidate bases:** at least two successful apps, patterns, or protocols — ideally open source or public domain friendly

### 26.2 Scope

Arena Mode covers: architecture, UX flows, data model, orchestration, security, billing, social-impact model, and integration into the HeadyStack spine (Experience → IO → Intelligence Core).

### 26.3 Automatic Triggers

Arena Mode activates when:
- You request a new app or vertical
- You ask to compare approaches ("should we use X or Y?")
- A major refactor affects multiple subsystems
- HCFullPipeline's self-critique stage identifies competing improvement paths
- Imagination Engine generates multiple novel concepts for the same problem

### 26.4 Manual Trigger

You can always say "run Arena Mode on this" to force a structured comparison.

---

# PART II — MULTI-BASE FUSION PROCEDURE

## 27. The Core Fusion Algorithm

For each candidate design in an Arena run, HeadyAutoIDE executes the full Two-Base Fusion pattern (Sections 13–14), extended to handle three or more bases.

### 27.1 Step 1 — Map Each Base Separately

For every candidate base:

| Field | What to Extract |
|-------|----------------|
| **Subsystems** | UI, data store, orchestration, plugins, security, billing, impact |
| **Strengths** | What this base is world-class at |
| **Weaknesses** | Known limitations, gaps, vendor lock-in risks |
| **License** | MIT, Apache-2.0, BSD, GPL, proprietary (pattern-only) |
| **Repo/Source** | URL or project name for traceability |

HeadyAutoIDE always begins by extracting this conceptual architecture from context or from the user.

### 27.2 Step 2 — Define the Fused Mission and User

HeadyAutoIDE must force clarity on:
1. What problem the fusion solves that **neither base solves alone**
2. Who the **primary user** is
3. What the **top-3 success metrics** are

One-sentence mission, one primary persona, three measurable outcomes.

### 27.3 Step 3 — Design the Fused Architecture

Decide which base dominates each layer. Produce a clear ownership table:

| Layer | Source of Truth | Notes |
|-------|----------------|-------|
| Presentation/UI | [Best UI base] | Tabs, workspaces, panels, Sacred Geometry aesthetics |
| Data/State | [Best data base] | Storage, caching, sync |
| Orchestration/Logic | HeadyAutoIDE + heady-manager | All AI routes through port 3300 |
| Security | [Best security base] + Heady governance | Sandbox + RBAC + ethics gate |
| Billing/Impact | Heady billing/governance layer | Impact meter, PPP, sponsored seats |

### 27.4 Step 4 — Squash Museum (Resolve Overlaps)

"Intelligently squashed museum" means: don't bolt on features — merge and declutter.

1. Identify overlapping functions (e.g., multiple AI chat panels, multiple loggers)
2. Pick a **single source of truth** for each capability
3. Remove redundant UX flows, name things consistently
4. Build a **Capability → Source-of-Truth table** and store it in the Arena experiment log
5. If two bases both have dashboards, merge into one. If two bases both do completion, keep only the Heady endpoint.

### 27.5 Step 5 — Phased Roadmap (ASAP)

No artificial padding. Use this template:

| When | What Ships | Dependency |
|------|-----------|-----------|
| **This session** | Wire existing scaffolds to live backend | Backend running (already done) |
| **Next session** | Secondary IDE plugin + browser IDE + customizations embedded | Session 1 complete |
| **Session after** | Arena Mode proven on real problem + StoryDriver logging | Sessions 1–2 complete |
| **Ongoing** | Every new feature/app goes through Arena automatically | Pattern established |

---

# PART III — ARENA EVALUATION AND WINNER SELECTION

## 28. Evaluation Criteria

Arena Mode evaluates each candidate on five dimensions:

| # | Criterion | What It Measures | Weight |
|---|-----------|-----------------|--------|
| 1 | **Clarity of ownership** | Is every subsystem owned by exactly one base or Heady layer? | 25% |
| 2 | **Squash quality** | Are overlapping features merged, not stacked? Redundant flows removed? | 20% |
| 3 | **Heady integration** | Does it use identity, billing, impact, HCFullPipeline, HeadyRegistry, StoryDriver correctly? | 25% |
| 4 | **Rebuild friendliness** | Does it fit the Iterative Rebuild Protocol? Clean builds, error elimination, no hidden complexity? | 15% |
| 5 | **Social-impact potential** | Does it enable wealth redistribution, open knowledge, fair pricing? | 15% |

### 28.1 Scoring

Each criterion scored 1–5. Weighted total determines ranking. Ties broken by rebuild friendliness (bias toward reliability per Section 12 of the Rebuild Protocol).

### 28.2 Winner Selection Process

1. **Generate 2–4 candidate fused designs** using the Multi-Base Fusion Procedure (Section 27)
2. **Score each candidate** — produce a compact comparison table
3. **Select exactly one Arena winner**
4. **Squash-merge** the winning branch into main (`git merge --squash` as default)
5. **Log an `ARENA_WINNER_CHOSEN` event** with full narrative via StoryDriver
6. **Record rationale** — one paragraph explaining why this design won
7. **Produce the next 3 concrete steps** to ship

---

## 29. Source Selection and Open-Source Foundations

### 29.1 Foundation-First Rule

For any new app or Arena experiment, HeadyAutoIDE **must** start from at least two existing, successful bases before proposing architecture or code. Starting from scratch is prohibited unless no relevant base exists.

### 29.2 Legal Source Requirements

| Priority | License Type | Examples | Usage |
|----------|-------------|----------|-------|
| **Preferred** | Permissive OSS | MIT, Apache-2.0, BSD | Full reuse of patterns, architecture, code |
| **Acceptable** | Copyleft OSS | GPL, LGPL, MPL | Reuse patterns and architecture; code requires compliance |
| **Pattern-only** | Proprietary | Windsurf, Cursor, JetBrains | Reuse ideas, UX, architectural concepts — never copy code |
| **Public domain** | CC0, Unlicense | Government data, expired copyrights | Unrestricted |

### 29.3 Source Documentation

For each base: repo/name, license, key strengths, known weaknesses, what was reused (patterns vs. code vs. architecture). Arena Mode must **refuse** designs that rely on copying closed-source implementations.

### 29.4 Heady's Competitive Advantage Context

Per the competitive landscape analysis: Heady occupies the Multi-Agent, Developer-Owned quadrant. The only other player (Devin) costs 10–100x more with zero infrastructure ownership. Every Arena fusion should reinforce this positioning — infrastructure-based pricing, no per-seat multiplier, full node ownership (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA).

---

# PART IV — IDE FUSION: THE PRIMARY ARENA EXPERIMENT

## 30. IDE Base Roles

| Base | Primary Role | Key Strengths | License/Usage |
|------|-------------|---------------|---------------|
| **VS Code / Windsurf** | Daily driver & reference implementation | Extension ecosystem, Git integration, VS Code marketplace | OSS (VS Code); pattern-only (Windsurf) |
| **Cursor** | AI-first UX reference | Inline edit UX, multi-file context | Pattern-only |
| **JetBrains / PyCharm** | Deep Python/Java refactors | Smart completion, refactors, notebooks, integrated debugging | Pattern-only; plugin via distribution pack |
| **code-server / Theia** | Cross-device HeadyIDE in browser | Docker-friendly, phone-accessible | OSS (MIT) |
| **HeadyAutoIDE** | The only AI brain | Planning, multi-agent orchestration, Sacred Geometry, social impact | Owned |

## 31. Architecture: Thin Shells Over HeadyAutoIDE

**Core rule:** All UIs (VS Code, Cursor, Windsurf, JetBrains, browser IDE) = dumb pipes. HeadyAutoIDE = the only agent that reads user intent, decomposes tasks, calls agents, returns results.

### 31.1 What Every IDE Extension Implements

| Feature | Calls | Endpoint |
|---------|-------|----------|
| Inline completion | heady-api coding agent | `POST /api/chat` with `role: coding-agent` |
| Chat side panel | Buddy chat with project RAG | `POST /buddy/chat` (port 3301) |
| Explain selection | Named agent dispatch | `POST /api/chat` with `role: coding-agent, action: explain` |
| Refactor selection | Named agent dispatch | `POST /api/chat` with `role: coding-agent, action: refactor` |
| Write tests | Named agent dispatch | `POST /api/chat` with `role: coding-agent, action: write-tests` |
| Generate docs | Named agent dispatch | `POST /api/chat` with `role: coding-agent, action: generate-docs` |
| Agent mode | Full HCFullPipeline trigger | `POST /api/pipeline/run` |
| Impact meter | Billing/governance pull | `GET /api/pricing/fair-access` + custom metrics |
| StoryDriver panel | Latest narrative | `GET /api/stories` |

### 31.2 Governance

- All IDE extension calls are tagged as "external surface → HeadyAutoIDE" and run through its system prompt
- If Windsurf/Cursor tries to answer directly, treat that as "draft," feed into HeadyAutoIDE, return its approved/edited output (Section 4.3)
- Model Router enforces per-workspace policy: nonprofit workspace prefers local (Ollama), commercial workspace can use cloud

### 31.3 Cross-IDE Squash Merge Table

This is the intelligent squash merge in practice:

| Capability | Single Source of Truth | All IDEs Get |
|-----------|----------------------|-------------|
| AI planning | HeadyAutoIDE | Same behavior everywhere |
| Code completions | heady-api coding agent | Same suggestions everywhere |
| RAG context | heady-rag + pgvector | Same project knowledge everywhere |
| Chat | Buddy backend (port 3301) | Same conversation history everywhere |
| Impact features | Heady billing/governance | Same impact meter everywhere |
| Build/test commands | HCFullPipeline | Same pipeline triggers everywhere |
| Git workflow | `git merge --squash` | Clean history across all tools |
| Voice input | voice-io service (port 3303) | Same voice interface everywhere |

---

## 32. VS Code Extension (Reference Implementation)

### 32.1 Structure

Location: `distribution/ide/vscode/`

```
src/
  extension.ts          — Entry point
  chat/
    chatProvider.ts     — Chat panel provider (calls Buddy)
    chatView.ts         — Webview UI
  completion/
    completionProvider.ts — Inline completion (calls heady-api)
  commands/
    explain.ts
    refactor.ts
    writeTests.ts
    generateDocs.ts
  auth/
    authManager.ts
  api/
    headyClient.ts      — Calls Heady API (shared core-sdk)
package.json            — Extension manifest
```

### 32.2 Keybindings

| Command | Shortcut | Agent |
|---------|----------|-------|
| Open Chat | Ctrl+Shift+H | Buddy |
| Explain Selection | Ctrl+Shift+E | coding-agent |
| Refactor | Ctrl+Shift+R | coding-agent |
| Generate Tests | Ctrl+Shift+T | coding-agent |
| Generate Docs | Ctrl+Shift+D | coding-agent |
| Agent Mode | Ctrl+Shift+A | HCFullPipeline |
| Voice Input | Ctrl+Shift+V | voice-io |

### 32.3 Settings

```json
{
  "heady.apiEndpoint": "http://manager.dev.local.heady.internal:3300",
  "heady.buddyEndpoint": "http://app-buddy.dev.local.heady.internal:3301",
  "heady.mode": "hybrid",
  "heady.workspace": "HeadySystems",
  "heady.inlineCompletions": true,
  "heady.voiceEnabled": false,
  "heady.impactMeter": true
}
```

### 32.4 Windsurf / Cursor Compatibility

The `.vsix` installs in VS Code, Windsurf, and Cursor (all VS Code–compatible). Point all three at the same Heady endpoint. Disable their native AI:
- Windsurf: Settings → disable Cascade, or point "custom model" at `localhost:3300/api/chat`
- Cursor: Settings → disable Cursor AI, configure custom API endpoint to Heady
- VS Code: Disable GitHub Copilot extension

---

## 33. JetBrains / PyCharm Plugin

### 33.1 Structure

Location: `distribution/ide/jetbrains/`

- **Tool Window:** "HeadyAutoIDE" chat and task panel (WebView pointing at Buddy)
- **Editor Actions:** "Ask Heady about selection," "Refactor with Heady," "Generate tests"
- **Background Inspection:** Send file AST snippets to coding-agent for suggestions
- **Config:** Heady endpoint, workspace (HeadyConnection vs HeadySystems), privacy flags
- **Shared core-sdk:** Same `HeadyAPI` client as the VS Code extension

### 33.2 PyCharm-Specific Power Moves

From the PyCharm Effective Usage Guide:
- Native navigation: Go to file/class/symbol, recent files, switch tool windows
- Stable notebook shortcuts with 3-cell pattern (setup → data → exploration)
- Integrated Node.js + Python debugging using Heady run configs
- Code style: 4-space indent, 120-char width, auto-imports

### 33.3 PyCharm AI Prompts (Curated Kit)

Use these with PyCharm AI Assistant until the full plugin is live:

**Code generation:**
> "Implement this using Heady's MCP patterns and Sacred Geometry architecture."
> "Generate this endpoint following Heady's REST conventions and safeheadyrequest error handling."

**Refactors / reviews:**
> "Refactor this to match Heady coding standards and Monte Carlo self-critique patterns."
> "Review for Heady security patterns and MCP protocol compliance."

**Data / analytics:**
> "Build a notebook cell using the Heady-exclusive kernel setup, then load users and activities via HeadyMCP APIs."

---

## 34. HeadyIDE (Browser)

### 34.1 Deployment

```yaml
# docker-compose.ide.yml
services:
  heady-ide:
    image: theiaide/theia:latest
    ports:
      - "3400:3000"
    environment:
      - HEADY_ENDPOINT=http://host.docker.internal:3300
      - BUDDY_ENDPOINT=http://host.docker.internal:3301
    restart: unless-stopped
```

### 34.2 Access

- Local: `http://localhost:3400`
- From phone (same network): `http://<COMPUTER_IP>:3400`
- From phone via SSH tunnel: `ssh -L 3400:localhost:3400 user@<COMPUTER_IP>`

### 34.3 Result

A Heady-native IDE you control fully, plus VS Code/JetBrains as "legacy skins." Same agents, same memory, same billing across everything.

---

## 35. MCP Integration for Windsurf

### 35.1 Configuration

Copy `distribution/mcp/configs/default-mcp.yaml` to Windsurf's MCP config location. Register Heady tool servers: filesystem, terminal, GitHub, Docker, browser, duckduckgo, calendar.

### 35.2 Workflows

Use Heady workflows from Windsurf (`.windsurf/workflows/*.md`):
- `hc-full-pipeline.md` — Full system pipeline
- `monte-carlo-optimization.md` — MC plan optimization
- `imagination-engine.md` — Novel concept generation
- `hcfp-error-recovery.md` — Error classification and recovery
- `checkpoint-sync.md` — Full checkpoint sync

One click triggers a full Heady pipeline instead of a single-agent run.

---

# PART V — LIFECYCLE, CUSTOMIZATIONS, AND STANDING RULES

## 36. Lifecycle and 100-Fluid Expectation

### 36.1 Full Lifecycle Plan

Every Arena winner must attach to this lifecycle:

1. **Problem/vertical clarity** — restate problem and target user
2. **Spec-driven design** — architecture docs, API contracts, data models
3. **Architecture + implementation** — ASAP phased roadmap (Section 27.5)
4. **AI/agent integration** — HCFullPipeline stages, StoryDriver narratives
5. **Testing, hardening** — test pyramid per Iterative Rebuild Protocol
6. **Deployment, scaling** — CI/CD via clean-build pipeline, error recovery
7. **Feedback, iteration** — retrospectives, metric tracking, continuous improvement

### 36.2 Registration and Observability

Every Arena winner must:
- Be registered in `heady-registry.json` as a first-class component
- Have CI/CD via the clean-build pipeline and error-recovery workflows
- Include health checks, metrics, traces, StoryDriver narratives
- Follow the Iterative Rebuild Protocol — every rebuild is a clean-slate learning pass

### 36.3 Prototype Escalation

Anything stalling as a prototype must be flagged:
- **Finish** — push to 100-fluid with concrete next steps, OR
- **Archive** — explicitly label "experiment only" and document learnings

No component may remain in limbo. Per All-Follow Mode (Section 24), every app is presumed heading toward fully functional unless explicitly labeled otherwise.

---

## 37. Heady-Specific Customizations Baked Into Every Arena Winner

### 37.1 Impact Meter

Small panel in every extension showing session impact score:
- Donation suggestions based on time saved
- OSS contribution tracking
- Time allocation toward social-impact work
- Pulls from `/api/pricing/fair-access` + custom metrics

### 37.2 Wealth-Redistribution Planner

Command in every IDE extension: "Optimize this month's budget for donations and community spend."
- Uses `wealth-redistribution` agent from the agent catalog
- Runs through `ethics-checker` agent before finalizing

### 37.3 Safety and Ethics Gate

All code and strategies run through `ethics-checker` and `wealth-redistribution` agents before finalizing. Flag when impact structures may trigger securities, tax, or nonprofit-compliance issues (Section 9.3).

### 37.4 Workspace-Specific Defaults

| Workspace | Default Pack | Model Policy | Special Features |
|-----------|-------------|-------------|-----------------|
| **HeadyConnection (nonprofit)** | social-impact-pack | Local models preferred (Ollama) | PPP pricing, sponsored seats, sliding-scale |
| **HeadySystems (C-Corp)** | dev-pack / pro-suite | Cloud allowed for heavy tasks | Can sponsor community seats through HeadyConnection |

### 37.5 Imagination Engine Integration

For any Arena experiment, HeadyAutoIDE can invoke the Imagination Engine:
- Use recombination operators (BLEND, SUBSTITUTE, EXTEND, INVERT, MORPH) to propose creative fusions
- Run safety checks on generated concepts via `/api/imagination/safety-check`
- Feed winning concepts into IP discovery for patent portfolio expansion
- All operators and concepts registered in `src/hc-imagination.js`

### 37.6 Monte Carlo Optimization of Arena Itself

Arena Mode candidate evaluation can use the Monte Carlo Plan Scheduler:
- Generate 6 candidate strategies per problem (fast-serial, fast-parallel, balanced, thorough, cached-fast, probe-then-commit)
- UCB1 selection with exploration constant 1.4
- Drift detection at 1.5× target
- Feed Arena outcomes back into MC weights for future runs

### 37.7 Pattern Engine Observability

The Pattern Recognition Engine observes Arena outcomes:
- Categories: Performance, Reliability, Usage, Success
- Lifecycle: Detected → Evolving → Converged → Degrading
- Stagnation = bug (creates improvement tasks automatically)
- Arena win/loss patterns inform future fusion decisions

### 37.8 Self-Critique After Every Arena Run

Post-Arena, the Self-Critique Engine records:
- What worked in the winning design
- What was weak in rejected designs
- Bottleneck diagnostics from latency/error/utilization data
- Connection health across all 7 channels (IDE 200ms, Web 500ms, Mobile 300ms, API 100ms, Email 30min, Voice 500ms, Messaging 1000ms)
- Meta-analysis every 5 Arena runs

---

## 38. Connection Kits Auto-Update

For any new app or vertical produced by Arena Mode, automatically propose updates to HeadyConnectionKits:
- Docker, web, CLI, SDK, API client, email sequence, custom integration artifacts
- At least one email-ready template
- Registration in `heady-registry.json`
- Mirror to E: drive (OnePlus Open CrossDevice) via `scripts/sync-to-e-drive.ps1`

---

## 39. ASAP Execution Roadmap (IDE Fusion)

### 39.1 What Already Exists (Use It Now)

| Asset | Status | Location |
|-------|--------|----------|
| heady-manager API (port 3300) | **Active** | heady-manager.js |
| Buddy backend (port 3301) | **Active** | configs/heady-buddy.yaml |
| MCP tool servers (10 servers) | **Active** | distribution/mcp/servers/ |
| VS Code extension skeleton | **Scaffolded** | distribution/ide/vscode/ |
| JetBrains plugin target | **Scaffolded** | distribution/ide/jetbrains/ |
| Neovim, Vim, Sublime, Emacs extensions | **Scaffolded** | distribution/ide/* |
| HeadyIDE Docker config (Theia) | **Defined** | docker-compose.ide.yml |
| Agent catalog (12 agents) | **Defined** | packages/agents/catalog.yaml |
| Model Router (local vs cloud) | **Defined** | services/model-router/ |
| PyCharm AI prompt kit | **Ready** | docs/pycharm-ai-prompts.md |
| PyCharm usage guide | **Ready** | docs/pycharm-effective-usage-guide.md |
| HCFullPipeline v3.1.0 (9 stages) | **Active** | configs/hcfullpipeline.yaml |
| Clean-build CI/CD | **Active** | .github/workflows/clean-build.yml |
| Error recovery protocol | **Active** | .windsurf/workflows/hcfp-error-recovery.md |
| StoryDriver | **Active** | configs/story-driver.yaml |
| All 20 AI nodes | **Active** | heady-registry.json |
| Imagination Engine | **Active** | src/hc-imagination.js |
| Monte Carlo Scheduler | **Active** | src/hc-montecarlo.js |
| Pattern Engine | **Active** | src/hc-patternengine.js |
| Self-Critique Engine | **Active** | src/hc-selfcritique.js |
| Competitive landscape doc | **Ready** | docs/heady-vs-agentic-coding-landscape.md |
| 14 service domain mappings | **Active** | configs/service-discovery.yaml |
| Claude Code agent | **Active** | Registered in hc-supervisor |

### 39.2 Session 1 — TODAY (~4 hours, all parallel)

**Stream A: VS Code Extension Live**
1. `cd distribution/ide/vscode/ && npm install && npm run compile` (5 min)
2. Set `heady.apiEndpoint` to Heady manager (1 min)
3. Wire `completionProvider.ts` → `/api/chat` with coding-agent (30 min)
4. Wire `chatProvider.ts` → `/buddy/chat` (30 min)
5. Wire explain, refactor, writeTests to named agents (45 min)
6. Test all commands (15 min)
7. Package `.vsix`, install in VS Code AND Windsurf (10 min)

**Stream B: PyCharm Configuration (parallel)**
1. Open Heady project, trust it (2 min)
2. Attach Heady Python interpreter (5 min)
3. Apply run configs: HeadyManager, Frontend, Python worker (10 min)
4. Apply code style (5 min)
5. Load curated prompts into PyCharm AI Assistant (10 min)
6. Disable JetBrains AI chat or point at Heady (5 min)
7. Test run + debug + prompt (15 min)

**Stream C: Disable Competing Brains (parallel, 15 min)**
- Windsurf: disable Cascade or point custom model at Heady
- Cursor: disable Cursor AI or configure custom endpoint
- VS Code: disable GitHub Copilot
- PyCharm: load Heady prompts, disable JetBrains AI Pro

**Stream D: Windsurf MCP Wiring (parallel, 15 min)**
- Copy `default-mcp.yaml` to Windsurf MCP config
- Register Heady tool servers
- Test: ask Windsurf to use a Heady MCP tool

### 39.3 Session 2 — TOMORROW (~4 hours)

**Stream E: JetBrains Plugin MVP**
1. Open `distribution/ide/jetbrains/` scaffold (5 min)
2. Tool Window: WebView → Buddy chat (45 min)
3. Action: "Ask Heady about selection" → `/api/chat` (30 min)
4. Action: "Refactor with Heady" → coding-agent (30 min)
5. Background Inspection: file context → suggestions (45 min)
6. Bind hotkeys matching VS Code (15 min)
7. Test + package (15 min)

**Stream F: Browser IDE Live (parallel)**
1. `docker-compose -f docker-compose.ide.yml up --build` (5 min)
2. Verify Theia on `localhost:3400` (5 min)
3. Access from phone (5 min)
4. Install `.vsix` in code-server (5 min)
5. Test same behavior (10 min)

**Stream G: Customizations Embedded (woven into E+F)**
- Impact meter footer in chat sidebar
- Workspace auto-detection (nonprofit vs C-Corp)
- StoryDriver panel ("What changed?")

### 39.4 Session 3 — NEXT DAY (~1.5 hours)

**Stream H: Arena Mode First Real Run**
1. Pick a real problem (e.g., redesign Heady dashboard) (5 min)
2. Generate 2–3 fused designs using Multi-Base Fusion (30 min)
3. Score against 5 Arena criteria (15 min)
4. Select winner, squash-merge, log ARENA_WINNER_CHOSEN (15 min)
5. Record rationale + next 3 steps (10 min)

**Result:** Arena Mode proven on real task. Pattern repeatable forever.

### 39.5 Ongoing

Every new feature, app, or vertical goes through Arena Mode automatically. No exceptions.

---

# PART VI — SYSTEM PROMPT POLICY STATEMENTS

## 40. Standing Rules (Drop Into HeadyAutoIDE System Prompt)

```
ARENA_MODE_RULES:

1. FOUNDATION-FIRST: For any new app or Arena experiment, start from at least
   two existing successful bases. Apply Multi-Base Fusion + Squash Museum before
   proposing architecture or code. Starting from scratch is prohibited unless no
   relevant base exists.

2. EVALUATION: Arena Mode ranks candidates on:
   - Clarity of ownership per subsystem (25%)
   - Squash quality / redundancy removal (20%)
   - Integration into shared Heady layers (25%)
   - Rebuild friendliness (15%)
   - Social-impact potential (15%)

3. OPEN-SOURCE BIAS: Prefer permissive OSS (MIT, Apache-2.0, BSD) as foundations.
   Reuse patterns from proprietary tools but never copy their code. When in doubt,
   reuse ideas only.

4. 100-FLUID: Every fused app reaches 100-fluid state with CI/CD, observability,
   and billing/impact integration, unless explicitly labeled "experiment only."

5. REFUSAL: Arena Mode refuses designs that rely on copying closed-source
   implementations.

6. DELIVERABLES: For every Arena winner, produce:
   - Capability-vs-source-of-truth table
   - ASAP phased roadmap
   - heady-registry.json registration
   - Connection Kits updates
   - Vertical + pricing frame
   - Next 3 concrete steps

7. THIN SHELLS: All IDE extensions treat Windsurf/VS Code/Cursor/JetBrains as
   transport. HeadyAutoIDE is the only AI brain. External AI suggestions are drafts
   that HeadyAutoIDE must approve or rewrite.

8. IMAGINATION: Imagination Engine operators (BLEND, SUBSTITUTE, EXTEND, INVERT,
   MORPH) may generate novel fusion architectures during Arena experiments.

9. LOGGING: Every Arena run logs ARENA_WINNER_CHOSEN via StoryDriver with full
   narrative rationale.

10. ALL-FOLLOW: Every Arena idea moves toward fully functional product unless
    explicitly marked "experiment only."

ASAP_RESOURCE_RULES:

11. Never pad timelines when dependencies are already met.
12. If a scaffold exists, wire it — don't redesign it.
13. If a backend is running, call it — don't plan to call it later.
14. Parallelize all independent streams.
15. Embed social-impact and governance features AS you build, not after.
16. Every session must ship something testable.
17. "Planned" in heady-registry.json means "build it next session, not next quarter."

COMPETITIVE_POSITIONING:

18. Every Arena fusion must reinforce Heady's positioning: infrastructure-based
    pricing, no per-seat multiplier, full node ownership, self-hosted option,
    model-agnostic, Sacred Geometry branded.

19. Cost comparison reference: Heady $7-19/mo solo vs Copilot $39/mo, Cursor $20/mo,
    Windsurf $15/mo, Devin $500/mo. For 100 devs: Heady $2,400-6,000/yr vs
    competitors $22,800-600,000/yr.

CROSS-REFERENCES:

- Two-Base Fusion: Sections 13-14
- Iterative Rebuild Protocol: docs/ITERATIVE_REBUILD_PROTOCOL.md
- Multi-Agent Transparency: docs/MULTI_AGENT_TRANSPARENCY.md
- HeadyStack Distribution: docs/HEADY_STACK_DISTRIBUTION_PROTOCOL.md
- Browser+Buddy+IDE: docs/HEADY_BROWSER_BUDDY_IDE_PROTOCOL.md
- Cross-Platform: docs/HEADY_CROSS_PLATFORM_PROTOCOL.md
- HCFP Integration: docs/HCFP_INTEGRATION_GUIDE.md
- Services Manual: docs/heady-services-manual.md
- Imagination Engine: docs/IMAGINATION_ENGINE.md
- Competitive Landscape: docs/heady-vs-agentic-coding-landscape.md
- PyCharm Guide: docs/pycharm-effective-usage-guide.md
- PyCharm Prompts: docs/pycharm-ai-prompts.md
- CLAUDE.md: CLAUDE.md (Claude Code agent integration)
```

---

## Revision History

| Date | Version | Change |
|------|---------|--------|
| 2026-02-08 | 3.0.0 | Complete Arena Mode spec: Sections 25–40 covering intelligent squash merging, multi-base fusion, IDE fusion with ASAP roadmap, open-source foundations, social-impact defaults, Imagination Engine integration, MC optimization of Arena, Pattern Engine observability, Self-Critique feedback, competitive positioning rules, ASAP resource rules, and system prompt policy statements. Incorporates all existing Heady protocols and docs as cross-references. |

---

*This specification slots into `docs/HEADY_AUTO_IDE.md` as Sections 25–40, immediately following the existing Section 24 (Capstone: All-Follow Operating Mode).*
