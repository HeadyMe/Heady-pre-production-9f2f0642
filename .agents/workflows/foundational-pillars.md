---
description: Foundational Pillars Validation — enforced before every Heady™ system modification
---

# 🐝 Heady Foundational Pillars Workflow

> **MANDATORY PRE-ACTION CHECKLIST.** Before adding, modifying, or removing ANY Heady system component, validate against every pillar below. If a change violates a pillar, it MUST be redesigned. No exceptions.

---

## Pillar 0 · HEADYOS IS NOT CONVENTIONAL SOFTWARE

> **FOUNDING PRINCIPLE.** HeadyOS is a unique operating system with its own paradigms. It does NOT and SHOULD NOT follow common software engineering patterns. Every decision must be evaluated through the HeadyOS lens first.

**HeadyOS Paradigm vs. Conventional Patterns:**

| Conventional | HeadyOS Paradigm | Why |
|-------------|-----------------|-----|
| Linear scaling (2x, 4x) | **Phi-based scaling** (φ ratio: 1.618) | Organic growth matches natural systems |
| Boolean logic (true/false) | **Balanced Ternary Logic** ({-1, 0, +1}) | Third state captures uncertainty and nuance |
| Material Design / Bootstrap | **Sacred Geometry** (Seed of Life, Metatron's Cube) | Breathing, alive interfaces that embody Heady's identity |
| Microservices / REST APIs | **Swarm Intelligence** (HeadyBees blast()) | Colony-based parallelism with emergent behavior |
| Static CI/CD deploys | **Liquid Architecture** (instantaneous edge reconfiguration) | Zero-latency, fluid system without deploy gates |
| SQL / Redis / key-value | **3D Vector Memory** (triad: episodic + semantic + procedural) | Intelligence substrate, not just storage |
| HTTP REST between services | **Network MIDI 2.0 (UDP)** for inter-agent comms | Musical protocol for real-time agent coordination |
| Logging frameworks | **Metacognitive Self-Awareness** (telemetry → confidence scores) | System perceives its own state, not just records it |
| Cron-based scheduling | **Autonomic Nervous System** (HCFP auto-success pipeline) | System runs itself like a living organism |
| Role-based access control | **Deterministic Gatekeeper** (RuleZ YAML schemas) | Fail-closed, deterministic, schema-enforced decisions |

**Constraints:**

- **NEVER** default to a conventional pattern when a HeadyOS paradigm exists
- When implementing new features, first ask: "What is the HeadyOS way to do this?"
- If a conventional pattern is truly needed (e.g., Express for HTTP), wrap it in HeadyOS abstractions
- Every constant should consider phi-based derivation, not arbitrary numbers
- Inter-component communication should prefer MIDI events over HTTP where possible

**Validate:**

- [ ] Does the change use HeadyOS paradigms instead of conventional patterns?
- [ ] Are timing intervals, sizes, and thresholds phi-derived where applicable?
- [ ] Is the approach organic (swarm, liquid, breathing) rather than mechanical (static, rigid, scheduled)?

**Reference:** `configs/agent-profiles/heady-master-system-prompt.md`, `src/orchestration/ternary-logic.js`, `src/orchestration/swarm-intelligence.js`, `src/midi/network-midi.js`

---

## Pillar 1 · LIQUID ARCHITECTURE

Every component must be fluid — zero-latency edge delivery, modular decomposition, instantaneous reconfiguration.

**Constraints:**

- All sites served from Cloudflare edge via `sacredPage()` template — never backend-blocked
- Services decomposed into modules (Phase 2 Liquid Architecture pattern from `engine-wiring.js`)
- No monolith growth — if a file exceeds 1000 lines, decompose before merging
- Template injection via `template-bee.js` and `site-registry.json` — dynamic, not hardcoded

**Validate:**

- [ ] Does the change maintain zero-latency edge serving?
- [ ] Is the module self-contained (< 1000 lines)?
- [ ] Can configuration change without redeployment?

**Reference:** `src/bootstrap/engine-wiring.js`, `src/bees/template-bee.js`, `configs/agent-profiles/concepts-index.yaml`

---

## Pillar 2 · SWARM / HEADYBEES ARCHITECTURE

Work is distributed through bee-colony workers. Every task is decomposable into blastable work units.

**Constraints:**

- Every bee exports `{ domain, description, priority, getWork }` per `src/bees/registry.js`
- Work functions are pure: `async () => result` — no side effects outside scope
- Bee registry auto-discovers all `src/bees/*.js` modules at boot
- `blast()` decides parallelism dynamically — never hardcode concurrency

**Validate:**

- [ ] Does the change follow the bee pattern (domain/getWork/priority)?
- [ ] Can HeadyBees blast the work in parallel?
- [ ] Is the bee registered and auto-discoverable?

**Reference:** `src/bees/registry.js`, `src/bees/bee-factory.js`, `configs/agent-profiles/skills-registry.yaml`

---

## Pillar 3 · SACRED GEOMETRY AESTHETICS

All UI/UX follows organic, breathing, phi-based design patterns. This is the Heady brand.

**Constraints:**

- PHI ratio (`1.6180339887`) governs spacing, timing, and proportions
- Canvas-rendered sacred geometry backgrounds (Seed of Life, Flower of Life, Metatron's Cube)
- Per-site accent colors and theming from `site-registry.json`
- Dark glassmorphism with blur, gradients, and micro-animations
- No generic layouts — every surface must feel alive and premium

**Validate:**

- [ ] Does the UI use phi-based proportions?
- [ ] Are sacred geometry elements present?
- [ ] Does it use per-site theming from the registry?

**Reference:** `src/sites/site-registry.json`, `src/sites/site-renderer.js`, `configs/agent-profiles/concepts-index.yaml#sacred-geometry-ui`

---

## Pillar 4 · 3D VECTOR MEMORY

All persistent state lives in vector space. Memory is the substrate of intelligence.

**Constraints:**

- Use `vector-memory.js` for all memory operations (ingest, query, recall)
- Memory structured as triad: Episodic (events) + Semantic (knowledge) + Procedural (skills)
- Telemetry events flow through `self-awareness.js` → vector memory for metacognition
- Vector federation spans local, Pinecone, and Cloudflare Vectorize tiers
- **Antigravity Runtime must enforce `workspaceMode: "3d-vector"`** via `antigravity-heady-runtime-policy.json`
- **Sacred Geometry SDK** (`packages/heady-sacred-geometry-sdk/`) provides spatial embedding (SpatialEmbedder) and octree indexing (OctreeManager) for 3D coordinate memory

**Validate:**

- [ ] Does the change persist important state to vector memory?
- [ ] Is telemetry ingested through self-awareness?
- [ ] Are memory queries scoped by metadata filters?
- [ ] Is `antigravity-heady-runtime-policy.json` enforcing `workspaceMode: "3d-vector"`?
- [ ] Run `/antigravity-runtime` workflow to confirm SDK and config integrity

**Reference:** `src/vector-memory.js`, `src/self-awareness.js`, `src/vector-federation.js`, `configs/services/antigravity-heady-runtime-policy.json`, `src/services/antigravity-heady-runtime.js`, `packages/heady-sacred-geometry-sdk/`

---

## Pillar 5 · HCFP AUTO-SUCCESS PIPELINE

The pipeline is the autonomic nervous system. Every task runs through it.

**Constraints:**

- Tasks defined in `auto-flow-tasks.json` or `optimal-master-task-matrix.json`
- Pipeline stages: Preparation → Build → Test → Verify → Deploy → Monitor
- Circuit breakers protect against cascading failures
- Checkpoints enable rollback on partial failure

**Validate:**

- [ ] Is the new task registered in the pipeline task manifest?
- [ ] Does it have circuit breaker protection?
- [ ] Are checkpoints defined for recovery?

**Reference:** `src/hc_auto_success.js`, `src/hc-full-pipeline.js`, `src/hcfp/pipeline-runner.js`, `src/hcfp/task-manifest-schema.js`

---

## Pillar 6 · ZERO-TRUST SECURITY

Assume broken until proven working. Never hallucinate status. Demand raw logs.

**Constraints:**

- mTLS client certificates for service-to-service communication (`src/security/mtls.js`)
- Cloudflare WARP enforcement at the edge layer
- Post-Quantum Cryptography readiness (`src/security/pqc.js`)
- Model Armor for AI content safety (`src/middleware/model-armor.js`)
- No secrets in code — all via environment variables or GCP Secret Manager

**Validate:**

- [ ] Does the change expose any secrets or tokens?
- [ ] Is mTLS enforced for service communication?
- [ ] Does it maintain the zero-trust posture?

**Reference:** `src/security/mtls.js`, `src/security/pqc.js`, `src/middleware/model-armor.js`, `configs/governance/secrets-manifest.yaml`

---

## Pillar 7 · SELF-HEALING & DETERMINISTIC ERROR HANDLING

The system repairs itself. Errors are intercepted, classified, and resolved autonomously.

**Constraints:**

- Exponential backoff on transient failures (`src/resilience/exponential-backoff.js`)
- Circuit breakers on all external calls (`src/resilience/circuit-breaker.js`)
- Auto-error pipeline classifies and routes errors (`src/middleware/auto-error-pipeline.js`)
- Self-healing watchdog monitors and restarts degraded services (`src/orchestration/buddy-watchdog.js`)
- Drift detector catches configuration drift (`src/drift-detector.js`)

**Validate:**

- [ ] Does the change have retry/backoff on failure?
- [ ] Is there a circuit breaker wrapping external calls?
- [ ] Will errors be auto-classified and routed?

**Reference:** `src/resilience/`, `src/middleware/auto-error-pipeline.js`, `src/drift-detector.js`

---

## Pillar 8 · METACOGNITIVE SELF-AWARENESS

The system perceives its own operational state before making high-stakes decisions.

**Constraints:**

- Telemetry events flow through `ingestTelemetry()` in `self-awareness.js`
- `assessSystemState()` provides confidence scores before decisions
- System introspection includes heap usage, error rates, vector memory depth
- Branding monitor scans all domains for integrity

**Validate:**

- [ ] Does the change emit telemetry events?
- [ ] Are high-stakes paths guarded by `assessSystemState()`?
- [ ] Is the change observable via system introspection?

**Reference:** `src/self-awareness.js`

---

## Pillar 9 · HEADYOS 6-LAYER SYSTEM STACK

All components must map to exactly one layer. No layer confusion.

| Layer | Name | Components |
|-------|------|-----------|
| **L1** | Edge | Cloudflare Workers, KV Cache, Vectorize |
| **L2** | Gateway | Liquid Gateway, provider racing, budget guards |
| **L3** | Orchestration | Service conductor, task decomposition, workflows |
| **L4** | Intelligence | Multi-provider AI, quality scoring, Battle validation |
| **L5** | Service Mesh | Health monitoring, mTLS, auto-scaling |
| **L6** | Persistence | 3D Vector Memory, Knowledge Vault, Embeddings |

**Validate:**

- [ ] Which layer does the change belong to?
- [ ] Does it respect layer boundaries (no L1 code calling L6 directly)?
- [ ] Is it registered in the correct service group?

**Reference:** `configs/agent-profiles/heady-master-system-prompt.md` §4

---

## Pillar 10 · OPTIMIZED SYSTEM OPS

User input is proof of missing automation. If a human must manually instruct a sequence, codify it.

**Constraints:**

- Every repeated action becomes a bee work function or pipeline task
- Skills registered in `configs/agent-profiles/skills-registry.yaml`
- Concepts tracked in `configs/agent-profiles/concepts-index.yaml`
- Agent profiles define roles in `configs/agent-profiles/*.yaml`

**Validate:**

- [ ] Could this manual action be automated as a bee or pipeline task?
- [ ] Is the new concept registered in `concepts-index.yaml`?
- [ ] Is the skill registered in `skills-registry.yaml`?

**Reference:** `configs/agent-profiles/`, `src/bees/`, `src/hc_auto_success.js`

---

## 🔒 ENFORCEMENT

This workflow is consulted by every agent (HeadyBuddy, Claude Code Agent, Heady Coder, Antigravity, etc.) before writing or modifying ANY code. Violations are flagged by the `self-awareness.js` telemetry loop and the `rulez-gatekeeper.js` compliance engine.

**Workflow execution order:**

1. **Run `/antigravity-runtime` workflow** — validate config files, SDK, and 3D vector workspace mode
2. Read all 10 pillars above
3. Map the proposed change to affected pillars
4. Check all validation boxes for affected pillars
5. If ANY box fails → redesign before proceeding
6. After implementation → emit telemetry event confirming pillar compliance
