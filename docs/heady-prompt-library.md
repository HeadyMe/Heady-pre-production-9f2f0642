# Heady Prompt Management System — v1.0.0

> **64 prompts** | **14 categories** | **168+ variables**
> **Source:** [`configs/prompts/heady-prompt-library.json`](../configs/prompts/heady-prompt-library.json)

## Usage

```js
const prompt = getPrompt("NODE_BEHAVIOR", "NODE-SCIENTIST-001");
const rendered = interpolate(prompt, { CLAIM_TO_VALIDATE: "...", EXPERIMENT_BUDGET: 10 });
```

## Categories

| # | Category | IDs | Description |
|---|----------|-----|-------------|
| 1 | **SYSTEM_IDENTITY** | SYS-001 → SYS-005 | Core identity, determinism, registry, layer awareness, brand |
| 2 | **PIPELINE_ORCHESTRATION** | PIPE-001 → PIPE-005 | 12-stage HCFullPipeline, Conductor routing, MC decomposition, gates |
| 3 | **NODE_BEHAVIOR** | NODE-*-001 (19 prompts) | HeadyScientist, Vinci, Soul, MC, Supervisor, Brain, Imagination, SASHA, NOVA, Pattern, Story, SelfCritique, Lens, ATLAS, BUILDER, JULES, QA, Check, Risk |
| 4 | **BEE_WORKER** | BEE-001 → BEE-006 | Bee factory, security, docs, health, deploy, self-improvement |
| 5 | **GOVERNANCE_SECURITY** | GOV-001 → GOV-003 | Policy engine, Rulez gatekeeper, credential management |
| 6 | **MEMORY_TELEMETRY** | MEM-001 → MEM-003 | Vector memory (pgvector), self-awareness loop, checkpoints |
| 7 | **ARENA_BATTLE** | ARENA-001 → ARENA-003 | Tournament orchestration, two-base fusion, branch orchestration |
| 8 | **COMPANION_UX** | COMP-001 → COMP-003 | HeadyBuddy personality, watchdog mode, browser assistant |
| 9 | **DEVOPS_OPERATIONAL** | OPS-001 → OPS-005 | Session start/end, incident response, inbox, graceful shutdown |
| 10 | **DETERMINISM_ENFORCEMENT** | DET-001 → DET-003 | Deterministic codegen, decision logging, phi-backoff |
| 11 | **ERROR_RECOVERY** | ERR-001 → ERR-002 | Self-healing lifecycle, circuit breaker |
| 12 | **ROUTING_GATEWAY** | ROUTE-001 → ROUTE-002 | AI gateway multi-provider, MCP protocol |
| 13 | **DOCUMENTATION** | DOC-001 → DOC-002 | README generator, API contract generator |
| 14 | **TASK_DECOMPOSITION** | TASK-001, TASK-002, SWARM-001 | Universal intake, autonomous improvement, swarm consensus |

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Determinism** | Identical inputs → identical outputs. All decisions logged. |
| **Composability** | Each prompt declares which others it chains with. |
| **Governance** | All prompts flow through pipeline and governance gates. |
| **Sacred Geometry** | Phi-ratio (1.618) proportions throughout. |
| **Social Impact** | HeadySoul evaluates all user-facing outputs. |

## Prompt Schema

```json
{
  "id": "SYS-001",
  "category": "SYSTEM_IDENTITY",
  "name": "Heady Core System Identity",
  "description": "Root identity prompt...",
  "version": "1.0.0",
  "tags": ["identity", "determinism", "root"],
  "composability": ["SYS-002", "SYS-003", "GOV-001"],
  "variables": ["{{CURRENT_LAYER}}", "{{ACTIVE_NODES}}"],
  "prompt": "You are the Heady Intelligence System..."
}
```

## Quick Reference — All 64 Prompts

| ID | Name | Composes With |
|----|------|---------------|
| SYS-001 | Heady Core System Identity | SYS-002, SYS-003, GOV-001 |
| SYS-002 | Determinism Enforcement | SYS-001, GOV-001, ERR-001 |
| SYS-003 | Registry-Aware Context Loader | SYS-001 |
| SYS-004 | Layer Awareness | SYS-001, SYS-003 |
| SYS-005 | Sacred Geometry Brand Alignment | SYS-001 |
| PIPE-001 | HCFullPipeline Stage Router | SYS-002 |
| PIPE-002 | HeadyConductor Task Routing | PIPE-001, SYS-003 |
| PIPE-003 | HeadyMC Fractal Decomposition | PIPE-001, SYS-002 |
| PIPE-004 | Pipeline Stage Gate Validator | PIPE-001, GOV-001 |
| PIPE-005 | Lightweight Pipeline Mode | SYS-002, PIPE-004 |
| NODE-SCIENTIST-001 | HeadyScientist — Hypothesis Validation | SYS-002, PIPE-001 |
| NODE-VINCI-001 | HeadyVinci — Systems Design | SYS-001, NODE-SOUL-001, GOV-002 |
| NODE-SOUL-001 | HeadySoul — Ethical Guardrails | SYS-001, GOV-001 |
| NODE-MC-001 | HeadyMC — The Strategist | SYS-002, PIPE-003 |
| NODE-SUPERVISOR-001 | HCSupervisor — Escalation Authority | SYS-001, GOV-001, ERR-001 |
| NODE-BRAIN-001 | HCBrain — Cognitive Interleaving | SYS-001, SYS-002 |
| NODE-IMAGINATION-001 | Imagination Engine | NODE-VINCI-001, NODE-SOUL-001 |
| NODE-SASHA-001 | SASHA — Gap Analysis | SYS-003, NODE-IMAGINATION-001 |
| NODE-NOVA-001 | NOVA — Pattern Synthesis | NODE-IMAGINATION-001, NODE-SCIENTIST-001 |
| NODE-PATTERN-001 | PatternRecognitionEngine | SYS-002, NODE-MC-001 |
| NODE-STORY-001 | StoryDriver — Timeline | SYS-002 |
| NODE-SELFCRITIQUE-001 | SelfCritiqueEngine | SYS-002, NODE-PATTERN-001 |
| NODE-LENS-001 | HeadyLens — Observability | SYS-001, SYS-002 |
| NODE-ATLAS-001 | ATLAS — Dependency Tracking | SYS-003, NODE-LENS-001 |
| NODE-BUILDER-001 | BUILDER — Code Generation | SYS-002, GOV-002, NODE-QA-001 |
| NODE-JULES-001 | JULES — Refactoring | SYS-002, NODE-BUILDER-001, NODE-QA-001 |
| NODE-QA-001 | HeadyQA — Quality Assurance | SYS-002, GOV-001, NODE-CHECK-001 |
| NODE-CHECK-001 | HeadyCheck — Final Approval | NODE-QA-001, GOV-001, NODE-SOUL-001 |
| NODE-RISK-001 | HeadyRisk — Risk Assessment | GOV-001, NODE-SOUL-001, NODE-CHECK-001 |
| BEE-001 | Bee Factory — Dynamic Workers | SYS-003 |
| BEE-002 | Security Bee | GOV-001, BEE-001 |
| BEE-003 | Documentation Bee | BEE-001, SYS-003 |
| BEE-004 | Health Bee | BEE-001, NODE-LENS-001 |
| BEE-005 | Deploy Bee | BEE-001, GOV-001, NODE-CHECK-001 |
| BEE-006 | Self-Improvement Bee | BEE-001, NODE-JULES-001, NODE-PATTERN-001 |
| GOV-001 | Governance Policy Engine | SYS-001, SYS-002 |
| GOV-002 | Rulez Gatekeeper — Access Control | GOV-001 |
| GOV-003 | Credential Bee — Secrets | BEE-001, GOV-001 |
| MEM-001 | Vector Memory — Semantic Store | SYS-002, NODE-PATTERN-001 |
| MEM-002 | Self-Awareness Telemetry Loop | SYS-001, NODE-LENS-001, MEM-001 |
| MEM-003 | Checkpoint Protocol | SYS-002, PIPE-001 |
| ARENA-001 | HeadyBattle — Tournament | PIPE-001, NODE-MC-001, NODE-SCIENTIST-001 |
| ARENA-002 | Two-Base Fusion Protocol | ARENA-001, NODE-VINCI-001 |
| ARENA-003 | HeadyBattle Branch Orchestration | ARENA-001, NODE-MC-001 |
| COMP-001 | HeadyBuddy — Companion | SYS-001, NODE-SOUL-001, MEM-001 |
| COMP-002 | HeadyBuddy — Watchdog Mode | COMP-001, SYS-002 |
| COMP-003 | HeadyBrowser — In-Browser | COMP-001, SYS-004 |
| OPS-001 | Session Start Protocol | SYS-001, SYS-003, SYS-004 |
| OPS-002 | Session End Protocol | MEM-003, OPS-001 |
| OPS-003 | Incident Response Protocol | ERR-001, NODE-SUPERVISOR-001, BEE-004 |
| OPS-004 | Heady Inbox — Data Dump | PIPE-002, MEM-001 |
| OPS-005 | Graceful Shutdown (LIFO) | OPS-002, MEM-003 |
| DET-001 | Deterministic Code Generation | SYS-002, NODE-BUILDER-001 |
| DET-002 | Deterministic Decision Logging | SYS-002 |
| DET-003 | Phi-Exponential Backoff | SYS-005 |
| ERR-001 | Self-Healing Lifecycle | SYS-001, BEE-004, NODE-SUPERVISOR-001 |
| ERR-002 | Circuit Breaker Pattern | DET-003, ERR-001 |
| ROUTE-001 | AI Gateway — Multi-Provider | SYS-001, ERR-002 |
| ROUTE-002 | MCP Protocol — Tool Integration | SYS-001, SYS-003 |
| DOC-001 | README Generator | BEE-003 |
| DOC-002 | API Contract Generator | BEE-003, DOC-001 |
| TASK-001 | Universal Task Intake | PIPE-001, OPS-004 |
| TASK-002 | Autonomous Improvement Generator | BEE-006, NODE-SELFCRITIQUE-001, NODE-PATTERN-001 |
| SWARM-001 | Swarm Consensus Protocol | SYS-001, NODE-MC-001 |

---

*© 2026 HeadySystems Inc. / HeadyConnection Inc.*
