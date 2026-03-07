---
name: heady-task-decomposition
description: >
  Use when decomposing complex tasks into CSL-scored subtask graphs with dependency DAG execution.
  Covers LLM-based subtask generation, CSL cosine similarity scoring against 17-swarm capabilities,
  topological sort with cycle detection, adaptive parallel execution, and progress tracking.
  All thresholds and limits use phi-continuous scaling.
  Keywords: task decomposition, subtask, DAG, dependency graph, CSL scoring, topological sort,
  parallel execution, task routing, swarm assignment, Heady task engine, divide and conquer.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Task Decomposition Engine

## When to Use This Skill

Use this skill when you need to:

- Break complex tasks into manageable subtasks using LLM
- Score subtasks against agent/swarm capabilities via CSL gates
- Build and execute dependency graphs (DAGs)
- Run independent subtasks in parallel with concurrency control
- Route subtasks to the optimal swarm based on semantic alignment

## Architecture

```
Complex Task
  → LLM Decomposition (structured prompt)
  → Subtask Array with types and dependencies
  → CSL Scoring: cos(subtask_embedding, swarm_capability_embedding)
  → Dependency DAG Construction
  → Topological Sort (Kahn's algorithm, cycle detection via DFS)
  → Parallel Execution (respecting dependencies, maxParallel=fib(6)=8)
  → Result Aggregation
```

## Instructions

### 1. Subtask Types

Map to swarm capabilities:
- `research` → research-swarm
- `coding` → coding-swarm (JULES)
- `data` → data-swarm
- `reasoning` → reasoning-swarm
- `synthesis` → synthesis-swarm
- `validation` → governance-swarm
- `retrieval` → memory-swarm
- `integration` → integration-node
- `planning` → strategic-layer
- `communication` → communication-swarm

### 2. CSL Scoring (phi-gated, not hard threshold)

```javascript
const score = cosineSimilarity(subtaskEmbedding, swarmCapabilityEmbedding);
const gatedScore = cslGate(score, score, CSL_THRESHOLDS.LOW);
// Smooth sigmoid transition around threshold ≈ 0.691
```

Minimum assignment threshold: `CSL_THRESHOLDS.LOW ≈ 0.691`

### 3. Dependency DAG

- Build: extract `dependsOn` from each subtask
- Validate: DFS cycle detection → reject circular dependencies
- Sort: Kahn's topological sort for execution order
- Layers: group subtasks by dependency depth for parallel batching

### 4. Parallel Execution

- Max concurrent: `fib(6) = 8`
- Max subtasks per decomposition: `fib(10) = 55`
- Per-subtask retry: configurable with phi-backoff
- Timeout: phi-scaled per subtask type

### 5. LLM Decomposition Prompt

Structure the decomposition prompt to return:
```json
[{
  "id": "subtask_1",
  "description": "...",
  "type": "coding",
  "dependsOn": [],
  "estimatedComplexity": "medium"
}]
```

## Evidence Paths

- `section2-agent-orchestration/modules/task-decomposition-engine.js`
- `section2-agent-orchestration/modules/swarm-coordinator.js`
