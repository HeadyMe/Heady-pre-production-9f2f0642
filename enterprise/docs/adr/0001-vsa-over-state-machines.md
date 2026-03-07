# ADR 0001: Use Vector Symbolic Architecture (VSA) Instead of Traditional State Machines

**Status:** Accepted  
**Date:** 2026-03-07  
**Authors:** Eric Headington, Platform Architecture  
**Deciders:** HeadySystems Core Team  
**φ-revision:** 1.618  

---

## Context

HeadySystems builds multi-agent AI systems that must represent and manipulate complex, high-dimensional knowledge. The platform needs a mechanism for:

1. Representing agent state (active tasks, memory, reasoning context)
2. Routing decisions between cognitive modules
3. Merging and comparing semantic similarity
4. Managing uncertainty and partial knowledge
5. Supporting distributed, eventually-consistent state across Cloud Run instances

Traditional finite state machines (FSMs) and hierarchical state machines (e.g., XState) were the initial candidate. Vector Symbolic Architecture (VSA) — specifically Hyperdimensional Computing (HDC) using high-dimensional binary or bipolar vectors — was evaluated as an alternative.

---

## Decision

**We will use Vector Symbolic Architecture (VSA) with hyperdimensional computing as the primary state representation layer, rather than traditional state machines.**

The implementation is housed in `@heady-ai/sacred-geometry-sdk` and integrated throughout `heady-brain`, `heady-conductor`, and `heady-orchestration`.

---

## Rationale

### Why VSA beats FSMs for AI agent systems

#### 1. FSM Limitations in AI Contexts

Traditional state machines require:
- **Explicit state enumeration** — all states must be defined upfront. AI agents encounter novel situations that no designer anticipated.
- **Discrete transitions** — state changes are binary (in state S1 or not). Reality is continuous: an agent may be "mostly composing a response" while "still gathering data."
- **Combinatorial explosion** — with N features × M contexts, FSM state count grows as O(N×M). HeadySystems agents handle thousands of contexts.
- **No similarity** — FSMs cannot reason "is this state *like* state X?" without explicit rules.
- **Poor distribution** — synchronizing FSM state across multiple Cloud Run instances is complex and expensive.

#### 2. VSA Advantages

VSA represents state as high-dimensional vectors (typically 10,000 dimensions) with key properties:

| Property | FSM | VSA |
|----------|-----|-----|
| State representation | Discrete, enumerated | Continuous, n-dimensional |
| Unknown states | Hard failure | Graceful degradation |
| State similarity | Requires explicit rules | Cosine similarity natively |
| Composition | Complex transitions | Bundle (XOR/superposition) |
| Distribution | Requires consensus protocol | Vectors are easily replicated |
| Memory | Explicit state history | Associative memory via AM |
| Uncertainty | Not representable | Native (noise tolerance) |

#### 3. Mathematical Foundation

VSA uses three operations on D-dimensional vectors (D=10,000):

- **Binding (⊗):** XOR of binary vectors. `agent ⊗ context` creates a unique bound pair.
- **Bundling (+):** Majority vote over multiple vectors. `state + memory + context` creates a superposition.
- **Similarity (∼):** Hamming distance or cosine similarity. `query ∼ memory` retrieves best match.

These operations allow:
```
agent_state = bind(agent_id, task_id) + bundle(task_context, memory_context, csl_score)
```

CSL scores (0.0–1.0) integrate naturally as vector weights, enabling "soft" state transitions that align with the HeadySystems CSL framework.

#### 4. Alignment with φ-scaling

VSA vectors exhibit natural Fibonacci-like properties: the capacity of a VSA system scales logarithmically with dimensionality, and the similarity thresholds align with the CSL levels (DORMANT=0.236 ≈ 1/φ³, HIGH=0.618 = 1/φ, CRITICAL=0.854 ≈ 1-1/φ²).

#### 5. Multi-Agent Composition

VSA naturally supports the multi-agent topology:
- Agent vectors can be **bundled** to create a swarm consensus state.
- Memory vectors can be **retrieved associatively** without explicit indexing.
- Cross-agent communication becomes vector comparison rather than protocol messaging.

---

## Consequences

### Positive

- **Graceful degradation:** Unknown or novel agent states don't cause hard failures — they produce low-similarity matches that trigger uncertainty handling.
- **Richer state:** Agent state is continuous and composable. Partial completion, uncertainty, and context all live in the same vector space.
- **Natural memory integration:** Vector memory (pgvector) and VSA share the same mathematical foundation, enabling seamless retrieval.
- **Distributed-friendly:** VSA vectors are self-describing and require no distributed locking for read operations.
- **CSL alignment:** Continuous Semantic Logic (CSL) scores map directly to vector similarity, unifying the semantic layer.

### Negative

- **Higher cognitive load:** Engineers unfamiliar with linear algebra face a steeper learning curve than FSM diagrams.
- **Debugging complexity:** Inspecting a 10,000-dimensional vector is less intuitive than reading an FSM transition table. Requires dedicated tooling (sacred-geometry-sdk visualizer).
- **Computational overhead:** VSA operations are O(D) per operation. At D=10,000, this is measurable but not prohibitive on modern hardware. Profiling shows <1ms per VSA operation on Cloud Run CPU instances.
- **Testing:** Deterministic testing requires seeded random vector generation. The testing harness in `heady-testing` handles this.

### Mitigations

- The `sacred-geometry-sdk` exposes a high-level API that hides dimensionality from application developers.
- FSM-style state logging is maintained for human-readable audit trails alongside VSA vectors.
- The `ProfilingToolkit` monitors VSA computation overhead.
- K8s manifests (enterprise option) include dedicated node pools for VSA-heavy workloads.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|----------------|
| XState (hierarchical FSM) | Combinatorial explosion for AI contexts; poor similarity support |
| Petri Nets | Good for concurrency but still discrete; no semantic similarity |
| Reinforcement Learning (policy-based) | Too slow to adapt; requires environment simulation |
| Rule engines (Drools, Jess) | Brittle for open-ended AI; poor real-time performance |
| Pure LLM reasoning | Expensive per-decision; no persistent state across invocations |

---

## References

- Kanerva, P. (2009). Hyperdimensional computing: An introduction to computing in distributed representation with high-dimensional random vectors.
- Rachkovskij, D.A. (2001). Representation and processing of structures with binary sparse distributed codes.
- HeadySystems `@heady-ai/sacred-geometry-sdk` — internal package documentation.
- `heady-context-brief.md` — HeadySystems platform architecture.

---

## Review

| Reviewer | Date | Decision |
|----------|------|----------|
| Eric Headington | 2026-03-07 | Accepted |
| Platform Arch | 2026-03-07 | Accepted |
