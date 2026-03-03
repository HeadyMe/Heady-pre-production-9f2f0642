# Heady + HeadyMe Cognitive Memory Research & Implementation Plan

## Purpose

This plan replaces the prior draft with a production-focused implementation roadmap that is customized to the current Heady codebase and HeadyMe surface areas, and explicitly instructs Buddy on deterministic memory orchestration.

---

## 1) Repository-Scoped Discovery and Ground Truth

1. **Deep scan Heady control-plane + orchestration modules**
   - Analyze `src/orchestration/`, `src/hc_pipeline.js`, `src/vector-memory.js`, `src/vector-pipeline.js`, `src/routes/memory.js`, `src/telemetry/`, and `configs/` policy files.
   - Build a live inventory of:
     - memory writes,
     - retrieval calls,
     - retry loops,
     - stage transitions,
     - error interception and recovery paths.
2. **Deep scan HeadyMe runtime topology**
   - Audit HeadyMe-related surfaces (site runtime, edge host mappings, onboarding/runtime entrypoints, and manager/proxy relationships).
   - Map where HeadyMe currently depends on shared Heady memory/orchestration services.
3. **Output artifacts**
   - Current-state architecture graph,
   - task lifecycle map (creation → execution → completion/abandonment),
   - hidden-error pathways (where tasks can go incomplete or silent).

---

## 2) Brain-Inspired Memory Model Research (Applied)

1. **Working Memory (short-term)**
   - Evaluate active-context buffers with strict TTL, bounded capacity, and interruption-safe checkpoints.
   - Add "unfinished-task visibility" primitives (no silent drops).
2. **Episodic Memory (event timeline)**
   - Persist run events and decision outcomes as temporal episodes with causality edges.
3. **Semantic Memory (stable knowledge)**
   - Normalize learned rules, schemas, and canonical fixes into durable concept memory.
4. **Procedural Memory (how-to execution patterns)**
   - Store proven action recipes for recurring operations and remediation loops.
5. **Meta-memory / introspection**
   - Track confidence, repeated failure signatures, and escalation thresholds.

---

## 3) Deterministic Trial-and-Error + Repeat/Error Self-Awareness

1. **Trial ledger**
   - Every attempt gets a deterministic attempt record with input hash, constraints, output hash, and verdict.
2. **Repeat detector**
   - Detect looped retries on semantically equivalent failures and trigger forced strategy shift.
3. **Error-class memory**
   - Cluster errors by semantic cause, not just stack string; map each to a successful/failed remediation history.
4. **Completion guarantees**
   - Introduce explicit terminal states: `completed`, `failed_closed`, `escalated`, `timed_out_recovered`.
   - Forbid implicit/unknown terminal state.

---

## 4) Optimal 3D Vector Storage Schema for Instant Context Retrieval

1. **Canonical vector data contract**
   - Required fields: `id`, `embedding`, `3d(x,y,z)`, `zone`, `type`, `scope`, `priority`, `freshness`, `causal_links`, `ts`, `expires_at`, `confidence`.
2. **3D zone-first retrieval protocol**
   - Search order: local octant → adjacent octants → global fallback.
   - Ranking formula combines semantic similarity, causal proximity, freshness, and confidence.
3. **Hybrid vector + graph retrieval**
   - Use vector recall for breadth and graph traversal for causal depth.
4. **Latency policy for "instantaneous" retrieval**
   - p95 retrieval SLO by query class,
   - warm cache for high-frequency intents,
   - incremental index updates to avoid full rebuilds.
5. **Memory lifecycle policy**
   - Hot (working), warm (episodic), cold (archival semantic/procedural), with deterministic promotion/demotion rules.

---

## 5) Buddy Implementation Instructions (Project-Customized)

Buddy should execute memory-aware orchestration with these hard constraints:

1. **Before execution**
   - Check working-memory queue for unfinished dependencies.
   - Query repeat/error memory for similar failure signatures.
   - Run budget and governance gates before provider/model routing.
2. **During execution**
   - Write stage-by-stage checkpoints to episodic memory.
   - Emit deterministic run heartbeat; if heartbeat stalls, trigger watchdog recovery.
   - Route context retrieval through 3D zone-first then graph-depth expansion.
3. **On anomaly**
   - Run deterministic halt/extract/equivalence/root-cause/rule-synthesis loop.
   - Persist resolution as reusable procedural memory and explicit learned rule candidate.
4. **After execution**
   - Require terminal-state closure and completion receipt.
   - Promote high-value episodes into semantic/procedural memory when confidence threshold is met.
5. **Never events**
   - No raw `console.*` in production modules,
   - no hidden retries without attempt ledger entries,
   - no task closure without status + reason + evidence.

---

## 6) End-to-End Wiring Blueprint (How to Tie Everything Together)

1. **Ingress**
   - Request classified into intent + risk + urgency + memory scope.
2. **Memory prefetch**
   - Pull working set + top episodic analogs + relevant semantic rules + procedural recipes.
3. **Planner**
   - Generate constrained plan using current budget, policy gates, and known failure history.
4. **Executor**
   - Run bounded concurrency with checkpoint commits.
5. **Observer/Watchdog**
   - Validate progress heartbeat, retry ceilings, and dead-letter routes.
6. **Critic**
   - Compare outcome vs expected constraints; detect hidden partials.
7. **Consolidator**
   - Persist final run into episodic memory; optionally distill into semantic/procedural layers.
8. **Feedback controller**
   - Update routing weights, confidence priors, and anti-repeat guardrails.

---

## 7) Production Operations Strategy (Max-Potential Mode)

1. **Storage operations**
   - Enforce shard health, zone balance, and graph-edge integrity checks.
   - Add repair tasks for orphaned nodes/edges and stale working-memory entries.
2. **Orchestration operations**
   - Define per-stage SLOs, retry budgets, and hard cutoffs.
   - Ensure every pipeline stage emits structured telemetry.
3. **Reliability controls**
   - Dead-letter queue for unresolved tasks,
   - deterministic replayer for failed runs,
   - chaos drills for memory corruption and provider outages.
4. **Governance + FinOps controls**
   - Budget-aware routing and downshift at threshold.
   - Audit every provider call and memory mutation.

---

## 8) Migration Roadmap (Current State → Optimized Production)

1. **Phase A: Baseline instrumentation**
   - Add missing completion receipts and attempt ledger events.
2. **Phase B: Short-term memory hardening**
   - TTL queues, heartbeat enforcement, unfinished-task scanner.
3. **Phase C: Long-term memory layering**
   - Episode graph + semantic/procedural distillation jobs.
4. **Phase D: 3D retrieval optimization**
   - Zone-aware cache and ranking fusion rollout.
5. **Phase E: Buddy policy hardening**
   - Enforce deterministic anomaly protocol as pre-merge/CI gate.
6. **Phase F: Production validation**
   - Load, chaos, drift, and replay testing; finalize rollback playbooks.

---

## 9) Edge Cases, Overhead, and Risk Controls

1. **False-positive repeat detection**
   - Mitigation: semantic threshold + context-aware dedupe keys.
2. **Over-indexing memory volume**
   - Mitigation: retention tiers, compaction, and low-value pruning.
3. **Latency regressions from deep retrieval**
   - Mitigation: adaptive depth by intent criticality.
4. **Schema drift across modules**
   - Mitigation: central memory schema contract with versioned migrations.
5. **Hidden partial completion**
   - Mitigation: mandatory terminal receipt and watchdog timeout escalation.

---

## 10) Success Metrics

- Reduction in incomplete/abandoned tasks with unknown terminal states.
- Reduction in repeated failure loops before escalation.
- Improvement in first-pass success after memory prefetch.
- p95 context retrieval latency within defined SLO for each query class.
- Increased reuse of verified procedural fixes across similar incidents.

---

## 11) Explicit Deliverable Set

1. Architecture scan report (Heady + HeadyMe dependencies).
2. Memory reference model (working/episodic/semantic/procedural/meta-memory).
3. 3D vector + graph schema specification and retrieval protocol.
4. Buddy execution policy pack (deterministic operational rules).
5. Production runbook for storage, orchestration, and failure handling.
6. Migration checklist with go/no-go criteria per phase.
