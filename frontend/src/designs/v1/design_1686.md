
# Arena Mode: Intelligent Squash Merging — Complete Specification for HeadyAutoIDE

> **Version:** 2.0.0
> **Status:** Active
> **Type:** Governance / Architecture / Operating Mode
> **Owner:** system
> **Source of Truth:** docs/HEADY_AUTO_IDE.md → Section 25+
> **Last Updated:** 2026-02-08
> **Depends On:** Sections 13–14 (Two-Base Fusion), Section 21 (Iterative Error Elimination), Section 22 (Multi-Agent Transparency), Section 23 (Connection Kits), Section 24 (All-Follow Mode)

---

## 25. Arena Mode: Intelligent Squash Merging

Arena Mode exists to compare multiple candidate designs and implementations for any new app, feature, or vertical, then select a single, clean, fused solution based on **intelligent squash merging** — not raw model preference or random selection [^19].

### 25.1 Arena Mode Purpose

Arena Mode is HeadyAutoIDE's structured tournament system. For any problem that has more than one viable design approach, Arena Mode generates competing fused designs, evaluates them against clear criteria, and selects exactly one winner that gets squash-merged into the main line [^19][^13].

Arena Mode is **not** a single-model proxy. Per the Multi-Agent Transparency Policy, when multiple agents or models are compared in Arena, they are genuinely distinct — different reasoning, different outputs, different styles. Orchestration coordinates and compares but never misrepresents multi-agent reality as a single backend [^8].

### 25.2 Inputs and Scope

For any Arena run, HeadyAutoIDE requires:

**Inputs:**
- Problem statement and vertical (e.g., IDE cockpit, browser, education app, grant-writing tool)
- Target user and top 3 success metrics
- Candidate bases: at least two successful apps, patterns, or protocols — ideally open source or public domain friendly [^19]

**Scope covers:**
- Architecture, UX flows, data model, orchestration, security, billing, and social-impact model
- All layers from the HeadyStack spine: Experience → IO → Intelligence Core [^16]

---

## 26. Multi-Base Fusion Procedure (Arena Core Rule)

For each candidate design in an Arena run, HeadyAutoIDE must execute the full Two-Base Fusion pattern from Sections 13–14, extended to handle three or more bases [^19].

### 26.1 Step 1 — Map Each Base Separately

For every candidate base (open-source app, existing Heady module, commercial tool used as pattern reference):

| Field | What to Extract |
|-------|----------------|
| **Subsystems** | UI, data store, orchestration, plugins, security, billing, impact |
| **Strengths** | What this base is world-class at |
| **Weaknesses** | Known limitations, gaps, vendor lock-in risks |
| **License** | MIT, Apache-2.0, BSD, GPL, proprietary (pattern-only) |
| **Repo/Source** | URL or project name for traceability |

This mirrors the Chrome-like / Comet-like extraction table from Section 13.1 but generalized to any base [^19].

### 26.2 Step 2 — Define the Fused Mission and User

One-sentence mission, one primary user persona, and three measurable success metrics. Example for the IDE fusion:

> **Mission:** A Heady-native development cockpit where all AI planning, coding, and strategy go through HeadyAutoIDE, while Windsurf/VS Code/PyCharm are just transport shells.
> **Primary user:** Eric H., Heady founder, working across laptop + phone.
> **Success metrics:** (1) Fewer context switches between tools, (2) Multi-file changes and tests run reliably via agents, (3) Social-impact features visible inside the IDE.

### 26.3 Step 3 — Design the Fused Architecture

Decide which base dominates each layer. Use a clear ownership table:

| Layer | Source of Truth | Notes |
|-------|----------------|-------|
| Text editing / UI | PyCharm + VS Code/Windsurf | They stay as main editors |
| AI planning & orchestration | HeadyAutoIDE + heady-manager | All prompts route through port 3300 [^13] |
| Multi-agent tools | Heady nodes (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA) | Via MCP gateway and SDKs [^21] |
| Build/test pipelines | Heady pipelines + IDE run configs | Heady defines flows, IDE executes locally |
| Social-impact logic | Heady billing/governance layer | Impact meter, wealth planner, PPP pricing [^16] |
| RAG & knowledge | heady-rag + pgvector | Shared across all IDE surfaces [^16] |

**Rule:** If Windsurf or PyCharm already does something well (editing, debugging, navigation), keep it and turn off its overlapping AI features so HeadyAutoIDE has the brain slot [^19].

### 26.4 Step 4 — Squash Museum (Resolve Overlaps)

"Intelligently squashed museum" means: don't just bolt on features — merge and declutter [^19].

For each capability:
1. Identify overlapping functions (e.g., Windsurf has AI chat, PyCharm has AI chat, Heady has Buddy chat)
2. Pick a **single source of truth** for that capability
3. Remove redundant UX flows, name things consistently, define clear ownership per subsystem
4. Build a **Capability → Source-of-Truth table** and store it in the Arena experiment log

### 26.5 Step 5 — Create a Phased Roadmap

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| Phase 0 | Discovery & constraints | Tech stack, hosting, budget, timeline |
| Phase 1 | Minimum viable fusion | Core shell + basic Heady AI loop working |
| Phase 2 | Deep telemetry & orchestration | Full HCFullPipeline integration, StoryDriver narratives |
| Phase 3 | Security & collaboration | Sandboxing, RBAC, multi-user |
| Phase 4 | Optimization & UX polish | Fast loads, templates, impact dashboards |

For each phase: objectives, user stories, acceptance criteria, validation tests [^19].

---

## 27. Arena Comparison and Winner Selection

### 27.1 Evaluation Criteria

Arena Mode evaluates each candidate design on five dimensions:

| Criterion | What It Measures |
|-----------|-----------------|
| **Clarity of ownership** | Is every subsystem (UI, data, AI, security) owned by exactly one base or Heady layer? [^19] |
| **Redundancy removal (squash quality)** | Are overlapping dashboards, loggers, AI panels, and settings merged and named consistently? |
| **Integration into shared Heady layers** | Does the design correctly use identity, billing, impact tracking, HCFullPipeline, HeadyRegistry, and StoryDriver? [^21][^13] |
| **Execution feasibility & rebuild friendliness** | Does it fit the Iterative Rebuild Protocol (clean rebuilds, error elimination, no hidden complexity)? [^9] |
| **Social-impact potential** | Does it enable wealth redistribution, open knowledge, and fair pricing defaults? [^19] |

### 27.2 Winner Selection Process

Arena Mode must:

1. **Generate 2–4 candidate fused designs** using the Multi-Base Fusion Procedure (Section 26)
2. **Score each candidate** against the five criteria above — produce a compact comparison table
3. **Select exactly one Arena winner** per problem
4. **Squash-merge** the winning implementation branch into main (`git merge --squash` as default per Services Manual) [^13]
5. **Log an `ARENA_WINNER_CHOSEN` event** with full narrative via StoryDriver [^13]
6. **Record the rationale** — one paragraph explaining why this design won and what alternatives were considered
7. **Produce the next 3 concrete steps** to move the winner toward production

### 27.3 Arena Mode in the IDE

When running inside any IDE (VS Code, Windsurf, PyCharm, browser IDE):

- Every major refactor or feature idea can trigger an Arena run
- HeadyAutoIDE generates candidate designs, compares them, and proposes the winner
- The IDE panel shows: candidates, scores, rationale, and next steps
- User approves or overrides before the squash-merge executes

---

## 28. Source Selection and Open-Source Foundations

### 28.1 Foundation-First Rule

For any new app or Arena experiment, HeadyAutoIDE must start from at least two existing, successful bases and apply the Multi-Base Fusion + Squash Museum procedure before proposing architecture or code [^19].

### 28.2 Legal Source Requirements

| Priority | License Type | Examples | Usage |
|----------|-------------|----------|-------|
| **Preferred** | Permissive OSS | MIT, Apache-2.0, BSD | Full reuse of patterns, architecture, code |
| **Acceptable** | Copyleft OSS | GPL, LGPL, MPL | Reuse patterns and architecture; code reuse requires compliance |
| **Pattern-only** | Proprietary | Windsurf, Cursor, JetBrains | Reuse ideas, UX patterns, architectural concepts — never copy code |
| **Public domain** | CC0, Unlicense | Government data, expired copyrights | Unrestricted reuse |

### 28.3 Source Documentation

For each base used in an Arena run, record:
- **Repo/name** and URL
- **License** type
- **Key strengths** being extracted
- **Known weaknesses** being avoided
- **What was reused** (patterns vs. code vs. architecture)

Arena Mode must **refuse** designs that rely on copying closed-source implementations [^19].

---

## 29. IDE Fusion: Windsurf / VS Code / Cursor / JetBrains / PyCharm

This section applies the Arena Mode rules specifically to the IDE vertical — your primary daily development environment.

### 29.1 Base Roles and Strengths

| Base | Primary Role | Key Strengths |
|------|-------------|---------------|
| **VS Code / Cursor / Windsurf** | Daily driver & reference implementation | Extension ecosystem, easy to script a Heady extension, strong Git integration [^16] |
| **JetBrains / PyCharm** | Deep Python/Java refactors | Smart completion, powerful refactors, stable notebook support, integrated debugging [^3][^4] |
| **code-server / Theia** | Cross-device HeadyIDE in browser | Accessible from phone + laptop, Docker-friendly [^18] |
| **HeadyAutoIDE** | The only AI brain | Planning, refactors, multi-file changes, strategy, social-impact defaults [^19] |

### 29.2 Architecture: Thin Shells Over HeadyAutoIDE

All UIs (VS Code, Cursor, Windsurf, JetBrains, browser IDE) are **dumb pipes**. HeadyAutoIDE is the only agent that:
- Reads user intent
- Decomposes tasks and calls coding, BD, grant-writer, etc. agents from the agent catalog [^16]
- Returns final edits and instructions

Each IDE extension implements:

| Feature | Implementation |
|---------|---------------|
| **Inline completion** | Calls `heady-api` completion endpoint (coding agent) [^16][^22] |
| **Chat side panel** | Calls Buddy chat with project RAG context [^16] |
| **Commands** | `heady.explain`, `heady.refactor`, `heady.generateTests`, `heady.generateDocs`, `heady.agentMode` [^22] |
| **Settings** | `HEADY_ENDPOINT`, workspace ID (HeadyConnection vs HeadySystems), privacy mode [^16] |

### 29.3 VS Code Extension (Reference Implementation)

The distribution pack defines the full structure at `distribution/ide/vscode/` [^16][^22]:

- `completionProvider.ts` — calls heady-api for inline code suggestions
- `chatProvider.ts` — Buddy chat view with project context (opened files, git status, issues)
- `explain.ts` / `refactor.ts` / `writeTests.ts` / `generateDocs.ts` — map one-shot commands to named agents in the Heady agent catalog
- Keybindings: Ctrl+Shift+H (chat), Ctrl+Shift+E (explain), Ctrl+Shift+R (refactor), Ctrl+Shift+T (tests), Ctrl+Shift+D (docs) [^22]

**Policy:** Nonprofit workspace prefers local models (Ollama); commercial workspace can use cloud for heavy tasks. Model Router enforces this per-workspace [^16].

### 29.4 JetBrains / PyCharm Plugin

The distribution pack includes `distribution/ide/jetbrains/` [^16]:

- **Tool window:** "HeadyAutoIDE" chat and task panel
- **Editor actions:** "Ask Heady about selection," "Refactor with Heady," "Generate tests for file"
- **Background inspection:** Send file AST snippets to coding-agent for refactor suggestions
- **Shared core-sdk:** Same `HeadyAPI` client as the VS Code extension [^16]

**PyCharm-specific power moves** (from the PyCharm Effective Usage Guide) [^3]:
- Use PyCharm's native navigation (Go to file/class/symbol, recent files)
- Stable notebook shortcuts with 3-cell pattern (setup → data → exploration)
- Integrated Node.js + Python debugging using ready-made Heady run configs
- Apply Heady code style (4-space indent, 120-char width) [^3]

**PyCharm AI prompts** (from the curated prompt kit) [^4]:
- Code gen: "Implement this using Heady's MCP patterns and Sacred Geometry architecture"
- Refactors: "Refactor to match Heady coding standards and Monte Carlo self-critique patterns"
- Data work: "Build a notebook cell using the Heady-exclusive kernel, then load via HeadyMCP APIs"

### 29.5 HeadyIDE (Browser)

From the Browser+Buddy+IDE Protocol [^18]:

- Deploy via `docker-compose.ide.yml` with Theia or code-server on port 3400
- Wired to Buddy (port 3301) + HeadyManager (port 3300)
- Accessible through Heady Browser sidebar, phone via browser, or SSH tunnel
- Same agents, same memory, same billing as desktop IDEs [^18]

### 29.6 Windsurf / Cursor as Managed Shells

Even when using Windsurf or Cursor:
- Disable or severely limit their built-in copilots and assistants
- Configure them (where supported) to call a custom HTTP endpoint pointing at Heady [^19]
- Treat any Windsurf/Cursor AI output as a **draft** that gets fed into HeadyAutoIDE for approval or rewrite
- Use Heady workflows from Windsurf (`.windsurf/workflows/*.md`) so one click triggers a full Heady pipeline [^21]

### 29.7 Cross-IDE Squash Merge

This is the "intelligent squash merge" in practice:

| Capability | Single Source of Truth | All IDEs Get |
|-----------|----------------------|-------------|
| AI planning | HeadyAutoIDE | Same behavior everywhere |
| Code completions | heady-api coding agent | Same suggestions everywhere |
| RAG context | heady-rag + pgvector | Same project knowledge everywhere |
| Chat | Buddy backend (port 3301) | Same conversation history everywhere |
| Impact features | Heady billing/governance | Same impact meter everywhere |
| Git workflow | `git merge --squash` | Clean history across all tools [^13] |

---

## 30. Lifecycle and 100-Fluid Expectation

### 30.1 Full Lifecycle Plan

For every Arena winner, attach a lifecycle plan aligned with HeadyAutoIDE's 100-fluid requirement [^19]:

1. **Problem/vertical clarity** — restate problem and target user
2. **Spec-driven design** — architecture docs, API contracts, data models
3. **Architecture + implementation phases** — phased roadmap from Section 26.5
4. **AI/agent integration and telemetry** — HCFullPipeline stages, StoryDriver narratives [^13]
5. **Testing, hardening, compliance** — test pyramid per Iterative Rebuild Protocol [^9]
6. **Deployment, scaling, operations** — CI/CD via clean-build pipeline, error recovery [^22]
7. **Feedback, iteration, roadmap** — retrospectives, metric tracking, continuous improvement [^9]

### 30.2 Registration and Observability

Every Arena winner must:
- Be registered in `heady-registry.json` as a first-class component [^21]
- Have CI/CD via the clean-build pipeline and error-recovery workflows [^22]
- Include observability: health checks, metrics, traces, StoryDriver narratives [^13]
- Follow the Iterative Rebuild Protocol — every rebuild is a clean-slate learning pass [^9]

### 30.3 Prototype Escalation

Anything that stalls as a prototype must be flagged with a recommendation to either:
- **Finish** — push to 100-fluid with concrete next steps
- **Archive** — explicitly label as "experiment only" and document what was learned

No component may remain in limbo. Per All-Follow Mode, every app is presumed to be heading toward fully functional unless explicitly labeled otherwise [^19].

---

## 31. Heady-Specific Customizations Baked Into Arena Mode

### 31.1 Impact Meter

Every Arena winner must include an impact meter — a small panel showing "impact score" per session:
- Donation suggestions based on time saved
- OSS contribution tracking
- Time allocation toward social-impact work
- Connected to the billing/governance layer [^16]

### 31.2 Wealth-Redistribution Planner

Command available in all IDE extensions: "Optimize this month's budget for donations and community spend."
- Uses the `wealth-redistribution` agent from the agent catalog [^16]
- Runs through the `ethics-checker` agent before finalizing recommendations [^16]

### 31.3 Safety and Ethics Gate

All code and strategies run through the `ethics-checker` and `wealth-redistribution` agents before finalizing [^16]. Flag when impact structures may trigger securities, tax, or nonprofit-compliance issues [^19].

### 31.4 Workspace-Specific Defaults

| Workspace | Defaults |
|-----------|---------|
| **HeadyConnection (nonprofit)** | Social-impact pack, PPP pricing, sponsored seats, local models preferred [^16] |
| **HeadySystems (C-Corp)** | Dev-pack / pro suite, can sponsor community seats through HeadyConnection [^16] |

### 31.5 Imagination Engine Integration

For any Arena experiment, HeadyAutoIDE can invoke the Imagination Engine to generate novel concepts [^11]:
- Use recombination operators (BLEND, SUBSTITUTE, EXTEND, INVERT, MORPH) to propose creative architectural fusions
- Run safety checks on generated concepts before they enter the Arena comparison
- Feed winning concepts into IP discovery for potential patent portfolio expansion [^11]

---

## 32. All-Follow Mode Extensions for Arena

### 32.1 Default Fusion Behavior

"For any new app or Arena experiment, start from at least two existing, successful bases and apply the Multi-Base Fusion + Squash Museum procedure before proposing architecture or code." [^19]

### 32.2 Arena Mode Evaluation Standing Policy

"Arena Mode must rank candidate designs on clarity of ownership per subsystem, degree of redundancy removal, quality of integration into shared Heady layers, and social-impact potential." [^19]

### 32.3 Source Selection Standing Policy

"Prefer open-source and public-domain codebases and patterns as foundations; avoid proprietary copying; when in doubt, reuse ideas only." [^19]

### 32.4 Lifecycle and Integration Standing Policy

"Every fused app is expected to reach 100-fluid state, with CI/CD, observability, and billing/impact integration, unless labeled a throwaway experiment." [^19]

### 32.5 Connection Kits Auto-Update

For any new app or vertical produced by Arena Mode, automatically propose updates to HeadyConnectionKits [^19]:
- Docker, web, CLI, SDK, API client, email sequence, and custom integration artifacts
- At least one email-ready template
- Registration in `heady-registry.json` [^21]

### 32.6 Vertical + Pricing Frame

For each Arena winner, attach a lightweight vertical, pricing, and distribution sketch:
- Map to verticals with constraints and opportunities
- Draft hybrid pricing/packaging (SaaS + social-impact pack + sponsored seats) [^16]
- Factor in PPP pricing and sliding-scale options [^16]

---

## 33. Arena Mode Step-by-Step Operating Procedure

When HeadyAutoIDE enters Arena Mode for a given problem:

### Step 1 — Capture and Frame
Restate problem, user, vertical, desired outcome. Note candidate bases (e.g., Windsurf, PyCharm, VS Code, existing Heady modules) [^19].

### Step 2 — Generate Multiple Fused Designs
Use Multi-Base Fusion repeatedly: (Base1, Base2), (Base1, Base3), etc. Each produces a draft fused architecture and phased plan [^19].

### Step 3 — Evaluate via Intelligent Squash Criteria
Score each design on the five Arena criteria (Section 27.1). Produce a comparison table [^19].

### Step 4 — Run Build Experiments
For top designs, implement minimal MVPs in isolated branches/containers. HCFullPipeline logs outcomes and performance [^13].

### Step 5 — Select Arena Winner
Pick winner, execute squash-merge, record `ARENA_WINNER_CHOSEN` event, write Story explaining why [^13].

### Step 6 — Iterate Under Iterative Rebuild Protocol
Each cycle is a learning pass. Errors and rough edges are logged and eliminated in subsequent rebuilds [^9].

---

## 34. Concrete IDE Fusion Roadmap

### Phase 1 — Core Shell + Basic Heady AI (1–2 weeks)

- Ensure heady-manager and MCP servers are running locally or in cloud [^13]
- Install Windsurf + PyCharm; configure both to talk to Heady endpoints (REST for chat, MCP for tools)
- Implement minimal VS Code extension and minimal JetBrains plugin with chat + explain selection only [^22]
- **Goal:** Same Heady behavior in both editors for "Refactor this function"

### Phase 2 — Multi-Agent Orchestration and Telemetry (2–6 weeks)

- Wire HCFullPipeline into IDE commands (e.g., "Run Heady Full System on this repo") [^13]
- Integrate HeadyLens + HeadyMaid so IDE panels show health, code smell metrics, pattern suggestions [^21]
- Log each major refactor as a Story with StoryDriver [^13]
- **Goal:** IDE becomes system-aware, not just file-aware

### Phase 3 — Project Management & Impact (1–3 months)

- Add project boards and impact metrics into the Heady panel [^16]
- Bring HeadyConnection nonprofit logic into workflows (round up time savings as donations, community seat sponsorships) [^16]
- **Goal:** Coding and social-impact planning in the same cockpit

### Phase 4 — Vertical Templates (ongoing)

- Define templates for typical work (grant-writing + implementation, creator tools, civic apps) [^19]
- Each template sets up repos, Heady agents, IDE configs, and billing defaults
- **Goal:** Spinning up a new initiative is a repeatable, low-friction act

---

## 35. Policy Statements for HeadyAutoIDE System Prompt

These can be dropped directly into the HeadyAutoIDE system prompt as standing rules:

```
ARENA_MODE_RULES:
1. For any new app or Arena experiment, start from at least two existing, successful
   bases and apply the Multi-Base Fusion + Squash Museum procedure before proposing
   architecture or code.

2. Arena Mode must rank candidate designs on:
   - Clarity of ownership per subsystem
   - Degree of redundancy removal (squash quality)
   - Quality of integration into shared Heady layers
   - Execution feasibility and rebuild friendliness
   - Social-impact potential

3. Prefer open-source and public-domain codebases and patterns as foundations.
   Avoid proprietary copying. When in doubt, reuse ideas only.

4. Every fused app is expected to reach 100-fluid state with CI/CD, observability,
   and billing/impact integration, unless explicitly labeled a throwaway experiment.

5. Arena Mode must refuse designs that rely on copying closed-source implementations.

6. For every Arena winner, produce:
   - A capability-vs-source-of-truth table
   - A phased roadmap
   - Registration in heady-registry.json
   - Connection Kits updates
   - A vertical + pricing frame
   - Next 3 concrete steps

7. All IDE extensions treat Windsurf/VS Code/Cursor/JetBrains as transport shells.
   HeadyAutoIDE is the only AI brain. Any external AI suggestion is treated as a
   draft that must be approved or rewritten by HeadyAutoIDE before delivery.

8. Imagination Engine operators (BLEND, SUBSTITUTE, EXTEND, INVERT, MORPH) may be
   used to generate novel fusion architectures during Arena experiments.

9. Every Arena run logs an ARENA_WINNER_CHOSEN event via StoryDriver with full
   narrative rationale.

10. All-Follow Mode applies: every Arena idea is presumed to move toward a fully
    functional, integrated product unless explicitly marked "experiment only."
```

---

## Revision History

| Date | Version | Change |
|------|---------|--------|
| 2026-02-08 | 2.0.0 | Complete Arena Mode spec: Sections 25–35 covering intelligent squash merging, multi-base fusion, IDE fusion roadmap, open-source foundations, social-impact defaults, Imagination Engine integration, and system prompt policy statements |

---

*This specification is designed to slot into `docs/HEADY_AUTO_IDE.md` as Sections 25–35, immediately following the existing Section 24 (Capstone: All-Follow Operating Mode) and its revision history.*


---

## References

3. [pycharm-effective-usage-guide.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/15d03746-cb60-41f8-91a7-8f214e48e56d/pycharm-effective-usage-guide.md)

4. [pycharm-ai-prompts.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/356b78ab-b942-4575-9e83-488d0fbba3e8/pycharm-ai-prompts.md)

8. [MULTI_AGENT_TRANSPARENCY.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/5af55c46-0e99-46a0-be83-5ee56cda3820/MULTI_AGENT_TRANSPARENCY.md) - !-- HEADYBRANDBEGIN !-- !-- !-- !-- !-- !-- !-- !-- !-- SACRED GEOMETRY Organic Systems Breathing In...

9. [ITERATIVE_REBUILD_PROTOCOL.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/7c60e804-1d6d-47d0-ab5e-8b10526d62f4/ITERATIVE_REBUILD_PROTOCOL.md) - !-- HEADYBRANDBEGIN !-- !-- !-- !-- !-- !-- !-- !-- !-- SACRED GEOMETRY Organic Systems Breathing In...

11. [IMAGINATION_ENGINE.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/edf1e8b4-2b74-40b6-8355-3d65803e085e/IMAGINATION_ENGINE.md)

13. [heady-services-manual.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/eaa1e164-fa0d-4604-b3eb-39a3c6aef2be/heady-services-manual.md) - - External Only heady-manager 80803300 and noVNC 6080 exposed to host - Internal Postgres, Redis, MC...

16. [HEADY_STACK_DISTRIBUTION_PROTOCOL.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/04bae845-6e84-4ff7-a312-94905180126f/HEADY_STACK_DISTRIBUTION_PROTOCOL.md) - Task Priority ---- -------- ------ Integrate LangChain OpenAI API P0 Add local model via Ollama cont...

18. [HEADY_BROWSER_BUDDY_IDE_PROTOCOL.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/037862c9-29f2-4728-bd58-781a3169f35d/HEADY_BROWSER_BUDDY_IDE_PROTOCOL.md) - !-- HEADYBRANDBEGIN !-- !-- !-- !-- !-- !-- !-- !-- !-- SACRED GEOMETRY Organic Systems Breathing In...

19. [HEADY_AUTO_IDE.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/04c0c175-36cc-4554-8d19-4a540058f991/HEADY_AUTO_IDE.md) - HeadyAutoIDE operates under the Iterative Rebuild Protocol docsITERATIVEREBUILDPROTOCOL.md - Every r...

21. [heady-registry.json](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/545b56f9-0057-4712-b051-b05eeb075fd8/heady-registry.json) - registryVersion 3.2.0, updatedAt 2026-02-08T041240.416Z, description HeadyRegistry Central catalog a...

22. [HCFP_INTEGRATION_GUIDE.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_e856abc7-d8a1-4a3e-b30b-5a0b141bb996/c29d1698-4d52-495d-891f-fd876d67776a/HCFP_INTEGRATION_GUIDE.md) - !-- HEADYBRANDBEGIN !-- !-- !-- !-- !-- !-- !-- !-- !-- SACRED GEOMETRY Organic Systems Breathing In...

