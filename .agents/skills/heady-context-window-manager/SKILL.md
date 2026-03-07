---
name: heady-context-window-manager
description: >
  Use when managing limited context windows across multi-agent systems. Covers tiered context
  (working/session/memory/artifacts), automatic compression, LLM-based summarization, context
  capsules for inter-agent transfer, priority-based eviction with phi-weighted scoring, and token
  budget tracking. All budgets and weights use phi-continuous scaling.
  Keywords: context window, context management, token budget, context compression, summarization,
  context capsule, eviction, tiered context, agent context, Heady context, working memory.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Context Window Manager

## When to Use This Skill

Use this skill when you need to:

- Manage context windows for multi-agent orchestration
- Implement tiered context (hot/warm/cold/archive)
- Compress context when approaching token limits
- Transfer context between agents (context capsules)
- Score and evict low-value context entries
- Track token usage across conversation tiers

## Architecture

```
Working Context (hot, 8K tokens)
  ↓ overflow
Session Context (warm, ~21K tokens)    ← φ² scaling
  ↓ overflow
Memory Context (cold, ~56K tokens)     ← φ⁴ scaling
  ↓ overflow
Artifacts (archive, handles only)      ← φ⁶ scaling
```

## Instructions

### 1. Phi-Scaled Token Budgets

`phiTokenBudgets(base=8192)`:
- Working: 8,192 tokens (base)
- Session: ~21,450 tokens (base × φ²)
- Memory: ~56,131 tokens (base × φ⁴)
- Artifacts: ~146,920 tokens (base × φ⁶)

### 2. Compression Trigger

Compress when working context reaches `1 - ψ⁴ ≈ 91.0%` of budget.

### 3. Eviction Scoring (phi-weighted)

```
score = importance × 0.486 + recency × 0.300 + relevance × 0.214
```

Weights from `EVICTION_WEIGHTS = phiFusionWeights(3)`:
- Importance: φ²/(φ²+φ+1) ≈ 0.486
- Recency: φ/(φ²+φ+1) ≈ 0.300
- Relevance: 1/(φ²+φ+1) ≈ 0.214

### 4. Context Capsules

For inter-agent transfer:
```javascript
const capsule = contextManager.createCapsule({
  targetAgent: 'coding-swarm',
  maxTokens: phiTokenBudgets(8192).session,
  includeSystemMsg: true,
  summarizeIfOver: true,
});
```

A capsule packages: system context, compressed working entries, relevant memory entries, and metadata.

### 5. Memory Retrieval

`retrieveFromMemory(queryEmbedding, topK=fib(5), threshold=PSI)`:
- Threshold ψ ≈ 0.618 — phi-harmonic similarity floor
- Returns scored entries sorted by relevance

### 6. Tier Promotion/Demotion

- Working → Session: when entry ages past `PHI × sessionTTL`
- Session → Memory: when entry importance < `CSL_THRESHOLDS.LOW`
- Memory → Archive: handle-based reference, original evicted

## Evidence Paths

- `section2-agent-orchestration/modules/context-window-manager.js`
- `src/vector-memory.js`
