# Heady Latent OS — Orchestration Patterns Guide

**Version:** 2.0.0  
**Scope:** Section 2 — Autonomous Agent Orchestration  
**Platform:** 17-swarm Sacred Geometry topology, Node.js/ES modules

---

## Table of Contents

1. [Topology Decision Matrix](#1-topology-decision-matrix)
2. [CSL Routing vs LLM Classification](#2-csl-routing-vs-llm-classification)
3. [Backpressure Management Playbook](#3-backpressure-management-playbook)
4. [Context Window Strategy Guide](#4-context-window-strategy-guide)
5. [Self-Correction Best Practices](#5-self-correction-best-practices)
6. [Integration Reference](#6-integration-reference)

---

## 1. Topology Decision Matrix

The Heady platform uses a **layered topology**: hierarchical at platform level, with internal per-swarm topologies chosen based on the swarm's role.

### 1.1 Topology Overview

```
Platform Level (Hierarchical):
─────────────────────────────
        [HeadySoul — Master Orchestrator]
                /        |         \
     [Inner Ring      Inner Ring   Inner Ring]
     Tactical×5        Coord        Coord
         │                │           │
  [Middle Ring]    [Middle Ring] [Middle Ring]
  Operational×7     Workers      Workers
         │
  [Outer Ring]      [Governance]
  Edge Workers×3    Policy×1
```

### 1.2 When to Use Each Topology

| Topology | Use Case | Scale Limit | Key Tradeoff |
|----------|----------|-------------|--------------|
| **Hierarchical** | Platform-level (17 swarms) | Unlimited with layers | Inter-layer latency |
| **Supervisor** | Within a single swarm (5-8 agents) | ~10 agents | Single point of failure |
| **Swarm (peer handoff)** | User-facing conversational flows | ~7 agents | No translation overhead |
| **Partial Mesh** | High-availability critical paths | ~5 swarms | O(N²) connection cost |
| **A2A Protocol** | Cross-vendor / cross-boundary swarms | Any | Protocol overhead |

### 1.3 Heady Platform Topology Rules

**Rule 1: HeadySoul owns top-level routing.**
All external tasks enter through `heady-soul`. It applies multi-layer routing (deterministic → CSL → LLM → load balance) and dispatches to ring coordinators.

**Rule 2: Inner ring coordinators use Supervisor topology internally.**
Each inner-ring swarm (cognition-core, memory-weave, task-planner, consensus-forge, context-bridge) has a primary agent that delegates to specialised workers. The coordinator aggregates and returns to HeadySoul.

**Rule 3: Outer ring uses fire-and-forget where possible.**
`stream-runner`, `cache-guardian`, and `integration-node` are designed for high-throughput, low-latency work. They do not escalate upstream unless they fail; they silently degrade to partial results.

**Rule 4: policy-sentinel intercepts, not routes.**
The governance swarm sits in the data path but does not appear in the routing table. It is triggered by intercept patterns (PII, secrets, compliance keywords) regardless of the intended target swarm.

### 1.4 Topology Anti-Patterns

| Anti-Pattern | Problem | Correct Pattern |
|---|---|---|
| Full mesh across 17 swarms | 136 connections, exponential debug complexity | Hierarchical with partial mesh only within high-availability pairs |
| HeadySoul processes all responses | Supervisor translation overhead ("telephone game") | Inner ring coordinators return directly to caller for conversational flows |
| Synchronous blocking chains | Swarm A waits for B waits for C → cascading latency | Async message passing with `SwarmMessageBus`; collect results via `Promise.allSettled` |
| Static task assignment | Hotspot on one swarm while others idle | CSL dynamic routing + Fibonacci-weighted load balancing |

---

## 2. CSL Routing vs LLM Classification

### 2.1 The Four-Layer Routing Architecture

```
Incoming Task
     │
     ▼
Layer 1: Deterministic Gate (regex/prefix patterns)
  → ~35% of traffic | <1ms | $0 cost
  → Use for: explicit commands (/code, /search, /stream)
     │ (no match)
     ▼
Layer 2: CSL Cosine Similarity Gate (FAISS + embeddings)
  → ~45% of traffic | ~100ms | ~$108/month at 50K tasks/day
  → Use for: domain-classifiable natural language requests
  → Threshold: domain-specific (0.55–0.85)
     │ (score below threshold)
     ▼
Layer 3: Fine-tuned Classifier (XGBoost/LightGBM)
  → ~10% of traffic | ~5ms | ~$0.001/query
  → Use for: borderline cases with historical data
  → Train on: HeadySoul routing decision logs
     │ (low confidence)
     ▼
Layer 4: LLM Classifier (claude-haiku)
  → ~5-10% of traffic | 300–600ms | ~$0.01–0.03/query
  → Use for: novel patterns, ambiguous multi-domain tasks
  → Output: { swarmId, confidence, reasoning }
```

### 2.2 CSL Gate Configuration

Each swarm has a domain-specific CSL threshold. Higher thresholds prevent false positives in precision domains:

| Swarm | CSL Threshold | Rationale |
|-------|---------------|-----------|
| `heady-soul`, `cognition-core`, `memory-weave`, `task-planner` | **0.85** | Strategic/reasoning — false routing is costly |
| `code-artisan`, `data-sculptor`, `research-herald`, `language-flow`, `tool-weaver`, `consensus-forge` | **0.72** | Standard operational — moderate precision needed |
| `vision-scribe`, `audio-pulse`, `integration-node`, `cache-guardian`, `stream-runner` | **0.55** | Edge/multimodal — accept broader match range |
| `policy-sentinel`, `context-bridge` | **0.85 / 0.72** | Policy: never miss; Context: broad match OK |

### 2.3 Building Domain Embeddings

Each swarm's routing capability is represented as an embedding vector. Build them from a rich description:

```javascript
// Good embedding description (comprehensive)
const description = `
  coding and software development swarm: code-artisan
  Capabilities: JavaScript, Python, TypeScript, Go, Rust code generation;
  code review; test writing; refactoring; debugging; architecture design;
  API implementation; build systems; CI/CD pipelines
`;

// Bad embedding description (too sparse)
const description = "coding swarm";
```

Rebuild embeddings when swarm capabilities change (not on every startup):

```javascript
// On swarm initialization or capability update
const embedding = await embedFn(swarmDescription);
coordinator.setSwarmEmbedding(swarmId, embedding);
```

### 2.4 CSL vs LLM Performance Comparison

| Metric | CSL (Cosine Similarity) | LLM Classifier (claude-haiku) |
|--------|-------------------------|-------------------------------|
| Latency | **~100ms** | 300–600ms |
| Cost (50K/day) | **~$108/month** | ~$450–1350/month |
| Accuracy (clear domains) | **~92–96%** | ~96–99% |
| Accuracy (ambiguous) | ~72–80% | **~92–96%** |
| Edge case handling | Poor | **Excellent** |
| Predictability | **High** | Medium |
| Maintenance | Low (rebuild embeddings) | Prompt updates |

**Rule:** CSL handles the known; LLM handles the novel. Use LLM for <10% of traffic.

### 2.5 Routing Decision Logging

Always log routing decisions with metadata for offline analysis and fine-tuned classifier training:

```javascript
coordinator.on('task:routed', ({ taskId, swarmId, strategy, domain }) => {
  // Log to observability pipeline
  telemetry.track('routing.decision', {
    taskId, swarmId, strategy,
    domain: domain ?? 'unknown',
    timestamp: Date.now(),
  });
});
```

---

## 3. Backpressure Management Playbook

### 3.1 Pressure Levels and Responses

```
Queue Utilization → Action
─────────────────────────
  0–40%   NONE      → Normal operation
 40–60%   LOW       → Log warning; no action
 60–80%   MEDIUM    → Emit slow-down signal to upstream
 80–95%   HIGH      → Shed SHEDDABLE tasks; throttle new tasks
 95–100%  CRITICAL  → Shed all but CRITICAL_PLUS; open circuit if sustained
```

### 3.2 The Google SRE Adaptive Throttling Algorithm

Every swarm self-regulates using the Google SRE formula. This prevents cascading overload **without any external dependencies**:

```
P(reject) = max(0, (requests - K × accepts) / (requests + 1))
K = 2.0   (default multiplier)
Window = 2-minute rolling
```

**Interpretation:** When a swarm accepts 50% fewer requests than it receives (K=2), it starts rejecting ~50% of incoming traffic. The rejection probability increases smoothly as overload worsens.

**Implementation in `SemanticBackpressureMonitor`:**

```javascript
// Register each swarm before it handles traffic
monitor.registerAgent('code-artisan', { maxQueueDepth: 80 });

// On each incoming task
const result = await monitor.admitTask('code-artisan', {
  id:          taskId,
  description: taskDescription,
  embedding:   taskEmbedding,      // Optional: enables semantic dedup
  criticality: 'critical',         // CRITICALITY enum
  urgency:     8,
  userImpact:  7,
});

if (!result.accepted) {
  // result.reason: 'circuit_open' | 'semantic_duplicate' | 'load_shed' | 'sre_throttle' | 'queue_full'
  handleRejection(result);
}

// On task completion
monitor.recordCompletion('code-artisan', taskId, /* success */ true, latencyMs);
```

### 3.3 Semantic Deduplication

Before enqueuing any task, check for semantic equivalence. At 17-swarm scale, 20–40% of requests may be near-duplicates:

```
New Task: "summarize the Q3 earnings report"
         ↓ embed
         ↓ compare against pending queue embeddings
   Score = 0.94 > threshold 0.92
         ↓
DUPLICATE of task-xyz "give me a summary of Q3 earnings"
         ↓
Merge: boost task-xyz priority if new request has higher priority
Return: reference to task-xyz result (no new execution)
```

**Threshold selection:**
- `0.92` catches near-duplicates while allowing legitimately different tasks through
- Lower (e.g. `0.85`) reduces compute but risks merging distinct requests
- Higher (e.g. `0.97`) increases compute waste; only catches exact rewrites

### 3.4 Task Priority Scoring

```
Priority = (criticality_weight × 0.40) + (urgency × 0.30) + (userImpact × 0.30)

criticality_weight:
  CRITICAL_PLUS  → 10  (revenue-impacting, provisioned capacity)
  CRITICAL       →  7  (production default, user-visible)
  SHEDDABLE_PLUS →  4  (batch, partial unavailability OK)
  SHEDDABLE      →  1  (background, frequently unavailable)
```

**Load shedding order** (first shed at HIGH pressure):
1. `SHEDDABLE` tasks → shed at 80% queue pressure
2. `SHEDDABLE_PLUS` tasks → shed at 90%
3. `CRITICAL` tasks → shed at 95%
4. `CRITICAL_PLUS` tasks → **never shed** (circuit breaker only)

### 3.5 Circuit Breaker Configuration

| Parameter | Default | When to Increase | When to Decrease |
|-----------|---------|------------------|------------------|
| `failureThreshold` | 5 | Flaky external services | Fast feedback critical |
| `recoveryTimeoutMs` | 45,000 | Slow downstream recovery | Quick-recovering services |
| `halfOpenProbes` | 3 | Unstable services | Very stable services |

**Circuit state flow:**

```
CLOSED (normal) ──► OPEN (all reject) ──► HALF-OPEN (probe)
                   [5 failures]          [45s timeout]
        ◄──────────────────────────────────────────────
              [3 successful probes → CLOSED]
```

### 3.6 Backpressure Propagation

When a downstream swarm signals HIGH/CRITICAL pressure, upstream callers must throttle:

```javascript
monitor.on('backpressure:signal', ({ from, to, pressure, shouldSlow, shouldStop }) => {
  if (shouldStop) {
    // Stop sending new tasks to `from` swarm
    coordinator.markSwarmOverloaded(from);
  } else if (shouldSlow) {
    // Reduce dispatch rate to `from` swarm
    coordinator.applyThrottle(from, pressure);
  }
});
```

### 3.7 Cascading Failure Prevention Checklist

- [ ] Each swarm has a **hard queue depth limit** (500 by default)
- [ ] **No unbounded retries** — max 2 retries with exponential backoff + jitter
- [ ] **Circuit breakers** at every swarm boundary (closed by default, opens on 5 failures)
- [ ] **Load shedding** enabled for SHEDDABLE tasks above 80% pressure
- [ ] **Semantic deduplication** active for LLM-generated task streams
- [ ] **Async message bus** — no synchronous blocking chains between swarms
- [ ] **Distributed failover** — failed swarm traffic spread across multiple healthy swarms (not piled onto one)

---

## 4. Context Window Strategy Guide

### 4.1 The Four-Tier Context Model

```
┌─────────────────────────────────────────────────────┐
│  Tier 1: WORKING (hot)  — 8K tokens                 │
│  Active inference window; rebuilt per LLM call       │
│  Lifetime: duration of current task                  │
├─────────────────────────────────────────────────────┤
│  Tier 2: SESSION (warm) — 32K tokens                │
│  Durable event log for current session               │
│  Lifetime: session (minutes to hours)                │
├─────────────────────────────────────────────────────┤
│  Tier 3: MEMORY (cold)  — 128K tokens               │
│  Cross-session long-term knowledge                   │
│  Lifetime: persistent (days to months)               │
├─────────────────────────────────────────────────────┤
│  Tier 4: ARTIFACTS (archive) — no token limit        │
│  Large data via handle pattern (byte references)     │
│  Lifetime: versioned; explicit deletion              │
└─────────────────────────────────────────────────────┘
```

### 4.2 When Each Tier Is Used

| Scenario | Tier | Action |
|----------|------|--------|
| Current conversation turn | WORKING | `addMessage()` → auto-compression at 90% |
| Past turns this session | SESSION | Demoted from WORKING; retrieved by GC |
| User preferences / long-term facts | MEMORY | `promoteToMemory(importance ≥ 8)` |
| Large tool outputs (>50KB) | ARTIFACTS | Auto-promoted; handle stored |
| Cross-agent handoff | Capsule | `createCapsule()` → `ingestCapsule()` |

### 4.3 Compression Strategy

Compression triggers when working context reaches 90% of the 8K token budget:

```
Working Context (8K tokens, 90% full = 7200 tokens)
         │
         ▼
Select 60% lowest-scored entries (by recency × importance × relevance)
         │
         ▼
LLM Summarization: compress N entries → 1 summary entry
         │
         ▼
Archive original entries to SESSION tier
Insert summary entry into WORKING (high importance: 8)
         │
Result: Working context drops to ~40–50% utilization
```

**Compression approaches by scenario:**

| Scenario | Strategy | Implementation |
|----------|----------|----------------|
| Conversational agent | Sliding window + LLM summary | Default: `compress()` auto-triggered |
| Long research task | Hierarchical summarization | Multiple compression passes |
| Agent-to-agent handoff | Context capsule | `createCapsule({ topK: 10, tokenBudget: 4000 })` |
| New session start | Clear + import memory | `clearSession()` then `retrieveFromMemory()` |

### 4.4 Priority-Based Eviction Formula

When a tier exceeds its token budget, entries are evicted lowest-score first:

```
eviction_score = (0.35 × recency) + (0.40 × importance) + (0.25 × relevance)

recency   = exp(-age_ms / 1_800_000)    // Decays over 30 minutes
importance = entry.importance / 10       // Normalised [0, 1]
relevance  = cosine_sim(entry, query)   // [0, 1], 0.5 if no embedding
```

**Practical guidelines:**
- Set `importance = 10` for task instructions and user goals (never evict)
- Set `importance = 8` for critical facts discovered during execution
- Set `importance = 5` (default) for routine assistant responses
- Set `importance = 2` for verbose tool outputs (likely to be evicted first)

### 4.5 Context Capsule Pattern for Cross-Swarm Transfers

When `task-planner` hands off a subtask to `code-artisan`, it doesn't transfer full history. Instead it creates a capsule:

```javascript
// In task-planner swarm
const capsule = await contextManager.createCapsule('code-artisan', {
  topK:         10,            // Max entries to include
  tokenBudget:  4_000,         // Keep capsule small
  queryEmbedding: taskEmbedding, // Select most relevant entries
  taskContext: {
    originalTask: task.description,
    constraints:  task.constraints,
    deadline:     task.deadline,
  },
});

// Transfer via SwarmMessageBus
coordinator.sendSwarmMessage('task-planner', 'code-artisan', {
  type:    'context_capsule',
  capsule: capsule.serialize(),
});

// In code-artisan swarm
coordinator.on('message:received', ({ envelope }) => {
  if (envelope.message.type === 'context_capsule') {
    const capsule = ContextCapsule.deserialize(envelope.message.capsule);
    codeArtisanContext.ingestCapsule(capsule);
  }
});
```

### 4.6 Agentic Garbage Collection

GC runs before every LLM inference call (`buildMessages()` triggers it automatically):

```
GC Steps (in order):
  1. Deduplicate: remove entries with identical MD5 content hash
  2. Evict WORKING tier: demote lowest-scored entries to SESSION
  3. Evict SESSION tier: remove lowest-scored entries from memory
  4. Promote: move importance ≥ 8 session entries to MEMORY
```

**Enable automatic GC** with an interval (recommended for long-running agents):

```javascript
const ctx = new ContextWindowManager({
  agentId:       'code-artisan-primary',
  gcIntervalMs:  30_000,   // GC every 30 seconds
  budgets: {
    working:  12_000,   // Override default 8K for larger models
    session:  64_000,
    memory:   256_000,
  },
});
```

---

## 5. Self-Correction Best Practices

### 5.1 Error Classification Decision Tree

```
Execution Error / Verification Failure
              │
              ├── Contains: json, parse, syntax, schema, unexpected token
              │   → ERROR_TYPE.SYNTAX
              │   → Correction: re-attempt with strict schema instructions
              │
              ├── Contains: timeout, timed out, deadline
              │   → ERROR_TYPE.TIMEOUT
              │   → Correction: reduce scope, focus on critical 80%
              │
              ├── Contains: incomplete, missing, required field, partial
              │   → ERROR_TYPE.INCOMPLETE
              │   → Correction: enumerate required sections explicitly
              │
              ├── Contains: hallucination, fabricat, citation, unverified
              │   → ERROR_TYPE.HALLUCINATION
              │   → Correction: "only assert what you are certain of"
              │
              ├── Contains: logic, incorrect, wrong answer, assertion failed
              │   → ERROR_TYPE.LOGIC
              │   → Correction: step-by-step reasoning walkthrough
              │
              └── Everything else → ERROR_TYPE.UNKNOWN
                  → Correction: generic re-attempt with requirements
```

### 5.2 Iteration Budget by Error Type

| Error Type | Max Iterations | Min Quality Score | Strategy |
|---|---|---|---|
| SYNTAX | 3 | 0.95 | Each iteration includes schema example |
| LOGIC | 4 | 0.80 | Chain-of-thought prompt on iter 2+ |
| HALLUCINATION | 3 | 0.90 | Strict grounding constraints |
| INCOMPLETE | 2 | 0.85 | Explicit checklist of missing sections |
| TIMEOUT | 2 | 0.70 | Reduced scope / streaming output |

### 5.3 Verification Strategy

Use all three verification layers in priority order:

```javascript
const loop = new SelfCorrectionLoop({
  executeFn: async (prompt) => myAgent.run(prompt),

  // Layer 1: Fast deterministic assertions (run first — cheapest)
  assertions: [
    { name: 'is-valid-json',     fn: (out) => { JSON.parse(out); return true; } },
    { name: 'has-required-keys', fn: (out) => out.result && out.confidence },
    { name: 'confidence-above-threshold', fn: (out) => out.confidence > 0.7 },
  ],

  // Layer 2: Custom domain logic
  verifyFn: async (output, task) => ({
    pass:    output.result.length >= task.minLength,
    score:   Math.min(1.0, output.result.length / task.maxLength),
    message: output.result.length < task.minLength ? 'Response too short' : 'OK',
  }),

  // Layer 3: LLM judge (only runs if layers 1-2 pass)
  llmJudgeFn: async (output, task) => {
    const response = await judgeAgent.evaluate(output, task.rubric);
    return { pass: response.score >= 0.75, score: response.score, feedback: response.feedback };
  },

  maxIterations:   4,
  minQualityScore: 0.80,
});
```

### 5.4 Circuit Breaker Integration

The self-correction circuit breaker prevents runaway loops when an agent consistently fails:

```javascript
// Check circuit status before scheduling work
if (loop.circuitStatus.state === 'open') {
  // Don't attempt — delegate to a different agent or escalate
  return escalateToSupervisor(task);
}

// Monitor circuit events
loop.on('circuit:opened', ({ taskId }) => {
  // Alert: agent is consistently failing
  telemetry.alert('self_correction.circuit_opened', { agentId, taskId });
});
```

**Circuit trips when:** `consecutiveFails >= circuitThreshold` (default: 3)  
**Recovery:** Automatic after `circuitRecoveryMs` (default: 60s)  
**Manual reset:** `loop.resetCircuit()` — use only after root cause investigation

### 5.5 Learning from Corrections

The `PatternStore` accumulates correction history and improves future correction prompts:

```javascript
// Access the shared pattern store
const patterns = loop.patternStore.getSummary();
// → { totalPatterns: 247, byErrorType: { syntax: { success: 0.94, total: 48 }, ... } }

// Find patterns for a specific error type
const hallPatterns = loop.patternStore.findSimilar('hallucination', 'research', 3);
// → Used automatically in next correction prompt as "past correction examples"
```

**Persisting patterns across restarts** (production pattern):

```javascript
// On shutdown: export
const state = JSON.stringify([...loop.patternStore._patterns]);
await redis.set('self_correction_patterns', state);

// On startup: import
const saved = await redis.get('self_correction_patterns');
if (saved) {
  const patternStore = new PatternStore(500);
  JSON.parse(saved).forEach(p => patternStore.store(p));
  const loop = new SelfCorrectionLoop({ patternStore, ...opts });
}
```

### 5.6 Self-Correction + Task Decomposition Integration

For complex tasks, self-correction should be applied at the subtask level, not the whole task:

```javascript
// In TaskDecompositionEngine: wrap executeSubtaskFn with a correction loop
const engine = new TaskDecompositionEngine({
  llmDecomposeFn: myDecomposeFn,
  executeSubtaskFn: async (subtask, swarmId) => {
    const loop = createCorrectionLoop(subtask.errorTypeHint ?? 'logic', {
      executeFn: async (prompt) => swarmCoordinator.routeTask({ ...subtask, description: prompt }),
      maxIterations: 2,   // Subtasks get fewer retries than standalone tasks
    });
    const result = await loop.run({ id: subtask.id, prompt: subtask.description });
    if (result.escalated && subtask.critical) throw new Error('Critical subtask failed after correction');
    return result.finalOutput;
  },
});
```

---

## 6. Integration Reference

### 6.1 Module Dependency Graph

```
hc_orchestrator.js
    │
    ├── SwarmCoordinator (modules/swarm-coordinator.js)
    │       ├── SwarmInstance × 17
    │       ├── SwarmMessageBus
    │       ├── DomainEmbeddings (via embedFn)
    │       └── CSL routing → HeadyBees dispatch
    │
    ├── TaskDecompositionEngine (modules/task-decomposition-engine.js)
    │       ├── DependencyDAG
    │       ├── SubTask × N
    │       └── → SwarmCoordinator.routeTask()
    │
    ├── SemanticBackpressureMonitor (modules/semantic-backpressure.js)
    │       ├── AgentBackpressureState × 17
    │       ├── DedupCache
    │       └── Backpressure signals → SwarmCoordinator
    │
    └── ContextWindowManager (modules/context-window-manager.js) × per-agent
            ├── ContextEntry store
            ├── ContextCapsule (cross-agent transfer)
            └── Agentic GC

hc_pipeline.js
    └── SelfCorrectionLoop (modules/self-correction-loop.js)
            ├── PatternStore
            └── EVC cycle wrapping pipeline stages
```

### 6.2 Quick-Start Integration Example

```javascript
// src/hc_orchestrator.js integration pattern
import SwarmCoordinator from '../heady-implementation/section2-agent-orchestration/modules/swarm-coordinator.js';
import SemanticBackpressureMonitor from '../heady-implementation/section2-agent-orchestration/modules/semantic-backpressure.js';
import TaskDecompositionEngine from '../heady-implementation/section2-agent-orchestration/modules/task-decomposition-engine.js';
import ContextWindowManager from '../heady-implementation/section2-agent-orchestration/modules/context-window-manager.js';
import SelfCorrectionLoop from '../heady-implementation/section2-agent-orchestration/modules/self-correction-loop.js';

// 1. Initialize coordinator
const coordinator = new SwarmCoordinator({
  embedFn:       async (text) => openai.embeddings.create({ input: text, model: 'text-embedding-3-small' })
                                       .then(r => r.data[0].embedding),
  llmClassifyFn: async (task) => {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Route this task to one of: ${SWARM_IDS.join(', ')}. Task: ${task.description}` }],
    });
    return JSON.parse(res.choices[0].message.content).swarmId;
  },
});
await coordinator.initialize();

// 2. Initialize backpressure monitor
const monitor = createHeadyBackpressureMonitor({ embedFn: coordinator._embedFn });
// Register all 17 swarms
for (const swarm of coordinator.getSwarmHealth()) {
  monitor.registerAgent(swarm.id, { maxQueueDepth: 80 });
}

// 3. Wire up backpressure signals
monitor.on('pressure:change', ({ agentId, currentLevel }) => {
  if (currentLevel === 'high' || currentLevel === 'critical') {
    coordinator.broadcastSignal('backpressure', { swarmId: agentId, level: currentLevel });
  }
});

// 4. Task execution with full admission control
async function executeTask(task) {
  // Admit task (dedup + throttle + circuit break)
  const admission = await monitor.admitTask(task.targetSwarm ?? 'heady-soul', task);
  if (!admission.accepted) {
    throw new Error(`Task rejected: ${admission.reason}`);
  }

  try {
    const result = await coordinator.routeTask(task);
    monitor.recordCompletion(task.targetSwarm ?? 'heady-soul', task.id, true, result.latencyMs);
    return result;
  } catch (err) {
    monitor.recordCompletion(task.targetSwarm ?? 'heady-soul', task.id, false);
    throw err;
  }
}
```

### 6.3 Observability Events Reference

| Module | Event | Payload Fields |
|--------|-------|----------------|
| `SwarmCoordinator` | `task:routed` | taskId, swarmId, strategy, ring, layer |
| `SwarmCoordinator` | `task:completed` | taskId, swarmId, latencyMs, result |
| `SwarmCoordinator` | `swarm:degraded` | swarmId, circuitState, error |
| `SwarmCoordinator` | `metrics:snapshot` | global, swarms[] |
| `SemanticBackpressureMonitor` | `task:accepted` | agentId, taskId, priority, queueDepth |
| `SemanticBackpressureMonitor` | `task:rejected` | agentId, taskId, reason, priority |
| `SemanticBackpressureMonitor` | `task:deduplicated` | agentId, taskId, originalTaskId, similarityScore |
| `SemanticBackpressureMonitor` | `pressure:change` | agentId, previousLevel, currentLevel |
| `SemanticBackpressureMonitor` | `circuit:opened` | agentId, failCount |
| `TaskDecompositionEngine` | `decomposed` | taskId, subtaskCount, subtasks[] |
| `TaskDecompositionEngine` | `subtask:assigned` | subtaskId, swarmId, cslScore, type |
| `TaskDecompositionEngine` | `progress` | taskId, completed, total, running, pct |
| `TaskDecompositionEngine` | `task:completed` | taskId, runId, summary, elapsedMs |
| `SelfCorrectionLoop` | `iteration:verified` | taskId, runId, iteration, result, score |
| `SelfCorrectionLoop` | `loop:escalated` | taskId, runId, iterations, lastErrorType |
| `ContextWindowManager` | `compressed` | agentId, compressedCount, savedTokens |
| `ContextWindowManager` | `capsule:created` | capsuleId, fromAgentId, toAgentId, totalTokens |

### 6.4 Configuration Tuning Guide

| Parameter | Conservative (stability) | Aggressive (throughput) | Production Default |
|-----------|--------------------------|-------------------------|-------------------|
| `cslThreshold` | 0.85 | 0.60 | 0.72 |
| `maxQueueDepth` | 200 | 1000 | 500 |
| `circuitFailThreshold` | 3 | 10 | 5 |
| `circuitRecoveryMs` | 60,000 | 30,000 | 45,000 |
| `maxParallel` (decomp) | 4 | 16 | 8 |
| `maxIterations` (correction) | 2 | 6 | 4 |
| `compressTrigger` | 0.80 | 0.95 | 0.90 |
| `dedupThreshold` | 0.88 | 0.96 | 0.92 |

---

*Generated from research at `/home/user/workspace/research/section2_agent_orchestration.md`*  
*See also: `configs/supervisor-hierarchy.yaml` for full 17-swarm topology configuration.*
