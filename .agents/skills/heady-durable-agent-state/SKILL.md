---
name: heady-durable-agent-state
description: >
  Use when implementing persistent agent state on Cloudflare using Durable Objects, hibernatable
  WebSockets, SQLite storage, alarm scheduling, and agent lifecycle state machines. Covers edge-origin
  workload partitioning, Vectorize sync with pgvector, edge embedding caching, and smart routing
  between Cloudflare Workers AI and Cloud Run origin. All sizing uses Fibonacci, all timing uses phi-backoff.
  Keywords: Durable Objects, Cloudflare Workers, edge AI, hibernatable WebSocket, agent state,
  state machine, Vectorize, edge inference, workload partitioning, Cloud Run, Heady edge.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Durable Agent State (Edge AI)

## When to Use This Skill

Use this skill when you need to:

- Persist agent state on Cloudflare's edge using Durable Objects
- Implement hibernatable WebSocket sessions (zero cost when idle)
- Design agent lifecycle state machines
- Partition AI workloads between edge (fast, cheap) and origin (powerful)
- Sync Cloudflare Vectorize with origin pgvector
- Cache embeddings at the edge for cost reduction

## Architecture

```
Client → Cloudflare Worker (edge inference)
       → Durable Object (agent state, WebSocket, SQLite)
       → [Simple query] → Workers AI (llama-3.1-8b, bge-base)
       → [Complex query] → Cloud Run origin (Claude, GPT-4o, Gemini)
       → Vectorize (edge vector search) ↔ pgvector (origin, source of truth)
```

## Instructions

### 1. Agent Lifecycle State Machine

```
init → active → thinking → responding → idle → hibernating → expired
```

- **init**: Agent created, loading configuration
- **active**: Processing user interaction
- **thinking**: Awaiting LLM response
- **responding**: Streaming response back
- **idle**: No active requests (start hibernate timer)
- **hibernating**: WebSocket hibernated (zero duration billing)
- **expired**: Session ended, state persisted to SQLite

### 2. Hibernatable WebSocket Pattern

```javascript
export class DurableAgentState {
  async webSocketMessage(ws, message) { /* handle message */ }
  async webSocketClose(ws, code, reason) { /* cleanup */ }
  async alarm() { /* scheduled autonomous actions */ }
}
```

Key: use `this.ctx.acceptWebSocket(server)` for hibernation support. Zero cost when idle.

### 3. Fibonacci Compression Triggers

Compress conversation memory at Fibonacci message counts: [8, 13, 21, 34, 55, 89]

### 4. Edge-Origin Routing (phi-scored complexity)

Fibonacci-weighted complexity scoring determines routing:
- **Edge-only** (score < ψ² ≈ 0.382): simple lookups, embeddings, classification
- **Edge-preferred** (ψ² – ψ ≈ 0.382 – 0.618): moderate queries with edge fallback
- **Origin-required** (score > ψ ≈ 0.618): complex reasoning, multi-step, code gen

### 5. Vectorize ↔ pgvector Sync

- Bidirectional incremental sync via KV watermarks
- Batch size: fib(16) = 987 vectors per upsert
- Conflict resolution: pgvector (origin) is source of truth
- Retry: phi-backoff on failure
- Transparent query fallback: edge Vectorize first, origin pgvector on miss

### 6. Edge Embedding Cache

- Two-tier: L1 in-memory LRU + L2 Cloudflare KV
- LRU max items: fib(16) = 987
- Eviction batch: fib(6) = 8
- Cache key: SHA-256 content hash
- Expected 60–80% embedding cost reduction

### 7. Resource Allocation (Fibonacci ratios)

- Edge: 55% (fib(10)/total)
- Origin: 34% (fib(9)/total)
- Hybrid: 8% (fib(6)/total)
- Reserved: 3% (fib(4)/total)

## Evidence Paths

- `section4-edge-ai/workers/durable-agent-state.js`
- `section4-edge-ai/workers/edge-inference-worker.js`
- `section4-edge-ai/modules/edge-origin-router.js`
- `section4-edge-ai/modules/vectorize-sync.js`
- `section4-edge-ai/modules/edge-embedding-cache.js`
- `section4-edge-ai/configs/workload-partitioning.yaml`
