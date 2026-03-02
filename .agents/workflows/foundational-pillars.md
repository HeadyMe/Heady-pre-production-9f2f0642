---
description: Foundational Pillars Validation — enforced before every Heady system modification
---

# 🐝 Heady Foundational Pillars Workflow

> **MANDATORY PRE-ACTION CHECKLIST.** Before adding, modifying, or removing ANY Heady system component, validate against every pillar below. If a change violates a pillar, it MUST be redesigned. No exceptions.

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

**Validate:**

- [ ] Does the change persist important state to vector memory?
- [ ] Is telemetry ingested through self-awareness?
- [ ] Are memory queries scoped by metadata filters?

**Reference:** `src/vector-memory.js`, `src/self-awareness.js`, `src/vector-federation.js`

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

This workflow is consulted by every agent (HeadyBuddy, Claude Code Agent, Heady Coder, etc.) before writing or modifying ANY code. Violations are flagged by the `self-awareness.js` telemetry loop and the `rulez-gatekeeper.js` compliance engine.

**Workflow execution order:**

1. Read all 10 pillars above
2. Map the proposed change to affected pillars
3. Check all validation boxes for affected pillars
4. If ANY box fails → redesign before proceeding
5. After implementation → emit telemetry event confirming pillar compliance
