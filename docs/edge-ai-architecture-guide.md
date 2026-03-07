# Edge AI Architecture Guide
## Heady Latent OS — Section 4: Edge AI and Cloudflare Workers

**Version:** 1.0.0  
**Date:** March 2026  
**Owner:** Heady Engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Reference](#component-reference)
4. [Edge Inference Worker](#edge-inference-worker)
5. [Durable Agent State](#durable-agent-state)
6. [Vectorize Sync](#vectorize-sync)
7. [Edge Origin Router](#edge-origin-router)
8. [Edge Embedding Cache](#edge-embedding-cache)
9. [Workload Partitioning](#workload-partitioning)
10. [Sacred Geometry Resource Allocation](#sacred-geometry-resource-allocation)
11. [Deployment Guide](#deployment-guide)
12. [Cost Analysis](#cost-analysis)
13. [Monitoring and Observability](#monitoring-and-observability)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The Heady Latent OS edge AI layer runs on Cloudflare's global network, serving AI inference from the nearest GPU-equipped Point of Presence (PoP) to each user. The architecture splits workloads across three tiers:

| Tier | Runtime | Target Latency | Use Case |
|---|---|---|---|
| **Tier 1 — Edge Only** | Cloudflare Workers AI | < 300ms | Embeddings, classification, simple chat |
| **Tier 2 — Edge Prefer** | Workers AI + Cloud Run fallback | < 800ms | Standard chat, RAG, reranking |
| **Tier 3 — Origin Only** | Cloud Run (GCP us-central1) | < 30s | Complex reasoning, document ingestion |

**Core design principle:** The edge Worker is the intelligent router. It serves responses from cache, handles them locally with edge models, or proxies to origin — in that priority order. This pattern reduces expensive model invocations by 60–80% at typical workloads.

### Cloudflare Platform Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge Layer (Cloudflare ~300 PoPs, ~200 GPU-equipped)                    │
│                                                                           │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐ │
│  │ edge-inference-  │  │  DurableAgentState │  │  Edge Embedding      │ │
│  │ worker.js        │  │  (DO + Hibernation)│  │  Cache (LRU + KV)    │ │
│  │ /api/chat        │  │  WebSocket + SQLite│  │  2-tier L1/L2        │ │
│  │ /api/embed       │  │  Alarms + Lifecycle│  └──────────────────────┘ │
│  │ /api/classify    │  └────────────────────┘                           │
│  │ /api/rerank      │                                                    │
│  └──────────────────┘                                                    │
│          │                                                                │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐ │
│  │  Workers AI      │  │  Vectorize         │  │  Workers KV          │ │
│  │  BGE + Llama     │  │  768-dim cosine    │  │  Cache + Rate Limits │ │
│  │  DistilBERT      │  │  10M vectors/index │  │  Watermarks          │ │
│  └──────────────────┘  └────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                    │ Complex queries / fallback
┌─────────────────────────────────────────────────────────────────────────┐
│  Origin Layer (Cloud Run — GCP us-central1)                              │
│                                                                           │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐ │
│  │  AI Gateway      │  │  pgvector          │  │  Document Ingestion  │ │
│  │  (Claude/GPT-4)  │  │  (Neon HTTP)       │  │  Pipeline            │ │
│  │  Long context    │  │  Hybrid search     │  │  Chunking + Embed    │ │
│  └──────────────────┘  └────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

### Request Flow (Tier 1 — Simple Chat)

```
Client
  │
  │ POST /api/chat  (messages=[{role:user,content:"Hello"}])
  ▼
edge-inference-worker.js (Cloudflare PoP, ~1ms cold start)
  │
  ├─ Auth check (Bearer token, ~0.1ms)
  ├─ CORS headers
  ├─ Rate limit check (KV counter, ~1ms)
  │
  ├─ Complexity scoring: scoreChatComplexity()
  │    Token estimate: 5 → score: 3 → tier: SIMPLE
  │
  ├─ Cache check (KV, temp=0 only, ~1ms) → MISS
  │
  ├─ Workers AI inference
  │    Model: @cf/meta/llama-3.2-1b-instruct
  │    stream: true  →  ReadableStream (SSE)
  │    TTFT: ~150ms
  │
  └─ SSE stream → Client
       Content-Type: text/event-stream
       X-Heady-Model: @cf/meta/llama-3.2-1b-instruct
       X-Heady-Complexity: simple
```

### Request Flow (Tier 2 — Standard RAG)

```
Client
  │
  │ POST /api/chat  (messages=[...8 turns], ragContext=[...5 chunks])
  ▼
edge-inference-worker.js
  │
  ├─ Auth + CORS + Rate limit
  ├─ Complexity scoring: score=38 → tier: EDGE_PREFER
  │
  ├─ EdgeOriginRouter.decide() → primary: edge, fallback: origin
  │
  ├─ Workers AI: @cf/baai/bge-base-en-v1.5 (embed query, ~50ms)
  │    └─ EdgeEmbeddingCache.get() → MISS → AI.run() → cache.set()
  │
  ├─ Vectorize.query() (internal RPC, ~3ms)
  │    Returns: top-5 similar chunks
  │
  ├─ Workers AI: @cf/baai/bge-reranker-base (rerank, ~30ms)
  │
  ├─ Workers AI: @cf/meta/llama-3.1-8b-instruct-fp8-fast (generate, ~300ms)
  │    stream: true  →  ReadableStream
  │
  └─ SSE stream → Client  (~400ms total TTFT)
```

### Request Flow (Tier 3 — Complex Reasoning + Edge Fallback)

```
Client
  │
  │ POST /api/chat  (messages=[...20 turns, 6k tokens], tools=[...5 tools])
  ▼
edge-inference-worker.js
  │
  ├─ Complexity scoring: score=75 → tier: ORIGIN_ONLY
  │   Response: 307 { route: "origin", reason: "complexity_score_exceeded_edge_threshold" }
  │
  ├─ EdgeOriginRouter.route() → primary: origin
  │
  └─ fetch(originUrl + "/api/chat", { body: original request })
       │
       ▼
     Cloud Run (GCP us-central1)
       │
       ├─ AI Gateway → Anthropic claude-3-5-sonnet
       ├─ pgvector hybrid search (vector + FTS)
       ├─ Tool execution (web search, code interpreter)
       └─ Streaming response proxied back through edge Worker
```

### Agent Session Flow (Durable Object)

```
Browser
  │
  │ WebSocket upgrade: GET /ws?session_id=user123:agent-heady
  ▼
edge-inference-worker.js
  │
  └─ env.AGENT_STATE.get(sessionId).fetch("/ws")
       │
       ▼
     DurableAgentState (Durable Object — single instance per session)
       │
       ├─ acceptWebSocket(server)  — Hibernation API registered
       ├─ serializeAttachment({ socketId, sessionId, connectedAt })
       ├─ _transitionLifecycle('init' → 'active')
       ├─ scheduleIdleAlarm(+5min)
       │
       │  ← send initial state { socketId, lifecycle: 'active' }
       │
       │  [User sends WS message: { type: 'chat', content: 'Hello' }]
       │
       ├─ webSocketMessage() — DO wakes from hibernation
       ├─ _transitionLifecycle('active' → 'thinking')
       ├─ _loadContextMessages(21)  — last 21 messages from SQLite
       ├─ _transitionLifecycle('thinking' → 'responding')
       ├─ AI.run(model, { messages, stream: true })
       ├─ Stream tokens → ws.send({ type: 'token', content })
       ├─ _persistMessage('assistant', fullResponse)
       ├─ _maybeCompressContext()  — check Fibonacci thresholds
       ├─ _transitionLifecycle('responding' → 'active')
       └─ scheduleIdleAlarm(+5min)
          │
          [5 min idle — no messages]
          │
          ├─ alarm() fires → IDLE_CHECK
          ├─ _transitionLifecycle('active' → 'hibernating')
          └─ DO hibernates — $0/hour cost while idle

       [User sends new message — DO wakes from hibernation]
       └─ webSocketMessage() → cycle repeats
```

---

## Component Reference

### File Structure

```
section4-edge-ai/
├── workers/
│   ├── edge-inference-worker.js     # Main Cloudflare Worker
│   ├── durable-agent-state.js       # Durable Object: agent sessions
│   └── wrangler.toml                # Wrangler configuration
├── modules/
│   ├── vectorize-sync.js            # Vectorize ↔ pgvector sync
│   ├── edge-origin-router.js        # Smart routing module
│   └── edge-embedding-cache.js      # LRU + KV embedding cache
├── configs/
│   └── workload-partitioning.yaml   # Operation → tier mapping
└── docs/
    └── edge-ai-architecture-guide.md  # This document
```

---

## Edge Inference Worker

**File:** `workers/edge-inference-worker.js`  
**Format:** Cloudflare Worker module (`export default { fetch, scheduled }`)

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/health` | GET | Health check — no auth required |
| `POST /api/chat` | POST | Chat completions (streaming SSE or JSON) |
| `POST /api/embed` | POST | Text embedding (single or batch) |
| `POST /api/classify` | POST | Text classification |
| `POST /api/rerank` | POST | Document reranking |

### Chat Request Body

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is Sacred Geometry?" }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 1024,
  "session_id": "user-123",
  "complexity": "low"
}
```

**Response (streaming):**  
`Content-Type: text/event-stream`  
Workers AI passes through native SSE. Client reads via `EventSource` or `fetch` + `ReadableStream`.

**Response (non-streaming):**
```json
{
  "result": { "response": "Sacred geometry is..." },
  "model": "@cf/meta/llama-3.2-1b-instruct",
  "complexity": "simple",
  "cached": false,
  "timestamp": 1741310400000
}
```

**Complex query response (307 → origin):**
```json
{
  "route": "origin",
  "reason": "complexity_score_exceeded_edge_threshold",
  "complexity": "complex"
}
```
The calling client (or `EdgeOriginRouter`) should retry this request against the origin URL.

### Complexity Scoring

Scores are computed using Fibonacci-weighted factors:

| Factor | Weight |
|---|---|
| Token estimate (`chars / 4`) | 34 (max) |
| Tool count | 21 (max) |
| Message depth | 13 (max) |
| System prompt length | 8 (max) |
| Explicit hint (`complexity: high`) | 5 |
| Multimodal input | 3 |
| Reasoning model required | 2 |
| RAG context chunks | 1–5 |

- Score < 20 → `simple` → `@cf/meta/llama-3.2-1b-instruct`
- Score 20–49 → `standard` → `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
- Score ≥ 50 → `complex` → route to origin

### Rate Limiting

Per-IP, 60-second sliding window. Fibonacci-based limits:

| Endpoint | Limit (req/min) |
|---|---|
| `/api/chat` | 21 |
| `/api/rerank` | 34 |
| `/api/embed` | 55 |
| `/api/classify` | 89 |

Limits enforced via Workers KV atomic counters (`expirationTtl: 120`).

---

## Durable Agent State

**File:** `workers/durable-agent-state.js`  
**Class:** `DurableAgentState`

### Key Design Decisions

**Hibernation API:** Every WebSocket connection uses `state.acceptWebSocket()` which enables the Hibernation API. The DO incurs zero duration charges while no messages are being processed. Only CPU-active time (while handling a message) is billed. For a chat agent receiving 10 messages/hour, expected billing: < $0.001/session/day.

**SQLite Storage:** All message history, memories, and tool calls stored in DO SQLite (V2 backend). Schema includes `messages`, `agent_state`, `memories`, and `tool_calls` tables. ACID-compliant, strongly consistent.

**State Machine:** Valid lifecycle transitions prevent invalid state combinations:

```
init → active
active → thinking → responding → active
active → idle → hibernating
idle/hibernating → active (on WebSocket message)
idle/hibernating → expired (on alarm)
```

### SQLite Schema

```sql
-- Message history
messages (id, role, content, metadata JSON, created_at)

-- Arbitrary key-value agent state
agent_state (key TEXT PRIMARY KEY, value JSON, updated_at)

-- Long-term memory with importance scoring
memories (id, content, memory_type, importance REAL, embedding_ref, ...)

-- Tool call tracking
tool_calls (id, message_id, tool_name, tool_args JSON, result JSON, status, ...)
```

### WebSocket Protocol

**Inbound messages (client → agent):**

| Type | Fields | Description |
|---|---|---|
| `chat` | `content`, `metadata`, `requestId` | Send a chat message |
| `state_query` | `requestId` | Request current state snapshot |
| `memory_add` | `content`, `metadata.type`, `metadata.importance` | Add a memory |
| `tool_result` | `metadata.tool_call_id`, `metadata.result` | Return tool execution result |
| `ping` | `requestId` | Keepalive ping |
| `reset` | — | Clear session state |

**Outbound messages (agent → client):**

| Type | Fields | Description |
|---|---|---|
| `token` | `content`, `requestId` | Streaming token from LLM |
| `done` | `data.model`, `data.tokens`, `requestId` | Stream complete |
| `state` | `data.lifecycle`, `data.sessionId` | State update notification |
| `error` | `content`, `requestId` | Error notification |
| `pong` | `requestId` | Ping response |
| `memory_ack` | `requestId` | Memory stored confirmation |

### Context Compression (Sacred Geometry)

Compression triggers at Fibonacci message counts: `[8, 13, 21, 34, 55, 89]`.

When triggered, the oldest `MAX_CONTEXT_MESSAGES` messages are summarized by the LLM into a single memory entry (importance=0.7), then those messages are deleted from SQLite. This keeps context windows bounded at O(log n) while preserving semantic information.

---

## Vectorize Sync

**File:** `modules/vectorize-sync.js`  
**Class:** `VectorizeSync`

### Sync Architecture

```
pgvector (origin — source of truth)
       │
       │  HTTP query: SELECT id, embedding, metadata, updated_at
       │  WHERE updated_at > $watermark ORDER BY updated_at ASC
       │  LIMIT 500 OFFSET $offset
       │
       ▼
  VectorizeSync.runIncrementalSync()
       │
       ├─ Load watermark from KV (last successful sync timestamp)
       ├─ Fetch batches from pgvector via Neon HTTP API
       ├─ Parse embeddings (pgvector wire format "[x,y,z,...]" → number[])
       ├─ Upsert to Vectorize in chunks of 1,000 (Workers limit)
       ├─ Update watermark in KV on success
       └─ Update health metrics (last_sync_at, total_synced, errors)
```

**Conflict resolution:** pgvector is always authoritative. If a vector exists in Vectorize with different content than pgvector, the pgvector version overwrites it on the next sync.

**Eventual consistency window:** New vectors in pgvector appear in Vectorize within 5 minutes (cron interval). For real-time consistency requirements, call `VectorizeSync.syncById(ids)` immediately after writing to pgvector.

### Sync Failure Handling

Failures use Fibonacci backoff: `[1s, 1s, 2s, 3s, 5s, 8s, 13s]`. After 3 failed attempts, the batch error count increments and sync continues with the next batch. Health metrics track degraded state.

### Query Fallback

`VectorizeSync.queryWithFallback()` provides transparent fallback:
1. Query Vectorize (sub-ms via internal RPC)
2. On failure → query pgvector via HTTP (20–100ms)

This ensures RAG retrieval continues working even during Vectorize outages.

---

## Edge Origin Router

**File:** `modules/edge-origin-router.js`  
**Class:** `EdgeOriginRouter`

### Routing Algorithm

```
routerRequest.type
       │
       ├─ embed/classify/rerank → score: 5 → tier: edge_only → primary: edge, fallback: null
       │
       └─ chat/rag →
              score = _scoreComplexity(request)
              │
              ├─ score < 25 → edge_only → primary: edge, fallback: null
              ├─ 25 ≤ score < 60 → edge_prefer → primary: edge, fallback: origin
              └─ score ≥ 60 → origin_only → primary: origin, fallback: null
              │
              [edge_prefer + cost optimization]
              │
              ├─ If edge P95 < origin P50 (from measured latency ring buffer)
              │    → strongly prefer edge even at medium complexity
              │
              └─ If client tier === 'enterprise' && score > 25
                   → always origin for quality guarantee
```

### Analytics Tagging

Every routed request receives a structured tag attached as `X-Heady-Tag`:

```
hdy:cht:e:m8j2k4  → chat, edge, timestamp base36
hdy:cht:o:m8j2k5  → chat, origin, next request
hdy:emb:e:m8j2k6  → embed, edge
```

Tags enable cost attribution and route-specific analytics in downstream systems.

### Fallback Behavior

On primary route failure:
1. Log warning with error message
2. Try fallback route (if non-null)
3. On fallback failure → throw combined error message
4. Add `X-Heady-Fallback: 1` header to response

Edge failures that trigger fallback: HTTP 5xx from Workers AI, timeout (>8s), network error.

---

## Edge Embedding Cache

**File:** `modules/edge-embedding-cache.js`  
**Class:** `EdgeEmbeddingCache`

### Two-Tier Architecture

```
Request: embed("What is the meaning of life?", model="bge-base")
       │
       ├─ L1 (in-memory LRU, max 1,000 items):
       │    key: SHA-256("@cf/baai/bge-base-en-v1.5::what is the meaning of life?")
       │    HIT → return embedding (sub-microsecond)
       │    MISS → check L2
       │
       └─ L2 (Workers KV, globally replicated):
            key: "emb:" + sha256key
            HIT → return embedding, promote to L1 (~1ms KV read)
            MISS → call Workers AI (~50ms), store in L1 + L2, return
```

### LRU Implementation

Custom doubly-linked list + Map for O(1) get/set/delete. Eviction on capacity:
- When `size > maxMemoryItems`, evict **8 entries** (Fibonacci batch) at once from the LRU end
- Batch eviction reduces memory pressure fluctuation vs single-entry eviction

### Cache Key Design

Keys are SHA-256 hashes of `model + normalized_text` (lowercase, collapsed whitespace). This means:
- `"Hello World"` and `"hello world"` share the same cache entry
- Different models always get different keys
- Content changes invalidate deterministically

### `createCachedEmbedder` Factory

Drop-in replacement for `env.AI.run(model, { text: [...] })`:

```javascript
import { EdgeEmbeddingCache, createCachedEmbedder } from './modules/edge-embedding-cache.js';

const cache = new EdgeEmbeddingCache({ kv: env.EDGE_CACHE_KV });
const embed = createCachedEmbedder(env.AI, cache);

// Cache-aware embed — only calls Workers AI for uncached texts
const { data, source, cacheHits } = await embed(['hello', 'world', 'hello']);
// source: 'mixed', cacheHits: 1 (third 'hello' hit cache)
```

### Hit Rate Metrics

Tracked in-memory, optionally flushed to KV every 5 minutes via `ctx.waitUntil()`:

```json
{
  "hits": { "l1": 420, "l2": 83, "total": 503 },
  "misses": 97,
  "hitRate": 83.83,
  "l1HitRate": 69.53,
  "totalLookups": 600,
  "l1Size": 342,
  "l1Utilization": 34
}
```

---

## Workload Partitioning

**File:** `configs/workload-partitioning.yaml`

The YAML config is the operational source of truth for which models and tiers serve each request type. The `EdgeOriginRouter` reads its logic from this specification.

### Key Partitioning Decisions

| Operation | Tier | Reason |
|---|---|---|
| `embed` | Edge Only | Sub-ms Vectorize RPC, no origin round-trip needed |
| `classify` | Edge Only | DistilBERT is < 100ms at edge |
| `rerank` | Edge Only | BGE-reranker fast and deterministic |
| `chat_simple` | Edge Only | 1B model handles short context well |
| `chat_standard` | Edge Prefer | 8B model at edge + Claude fallback |
| `chat_complex` | Origin Only | > 4k tokens needs Claude's 200k context |
| `rag_simple` | Edge Only | Vectorize retrieval + 1B synthesis |
| `rag_complex` | Edge Prefer | Hybrid search may need pgvector |
| `document_ingest` | Origin Only | CPU-intensive chunking, >128MB RAM |
| `agent_session` | Edge Only | Durable Objects run at edge |
| `image_generate` | Edge Only | FLUX models at edge |

### Geographic Rules

Edge GPU density varies by region. High-density regions (US, EU, AU, JP, SG) get aggressive edge preference. Sparse regions (Africa, parts of Asia) get `edge_prefer` with shorter abort timers.

GDPR: EU users making PII-tagged requests are restricted to EU-region edge PoPs (DE, FR, NL, IE) or EU Cloud Run origin only.

---

## Sacred Geometry Resource Allocation

The Heady Latent OS applies Fibonacci ratios across all resource allocation decisions. This is not cosmetic — Fibonacci proportions approximate the golden ratio (φ ≈ 1.618) and appear naturally in optimal packing and distribution problems.

### Resource Tier Ratios

| Tier | Ratio | Budget |
|---|---|---|
| Edge compute | 55% | Fast, cheap, global inference |
| Origin compute | 34% | High-quality, complex reasoning |
| Hybrid paths | 8% | Edge-orchestrated, origin-executed |
| Reserved/buffer | 3% | Error headroom, burst capacity |

55/34/8/3 are consecutive Fibonacci numbers (normalized to 100%).

### Fibonacci Constants Used

| Constant | Value | Usage |
|---|---|---|
| Context window | 21 messages | Agent max context |
| Compression triggers | 8, 13, 21, 34, 55, 89 | When to compress agent memory |
| Rate limits (req/min) | 5, 8, 13, 21, 34, 55, 89 | Per-endpoint limits |
| Batch eviction | 8 entries | LRU eviction batch size |
| Latency window | 55 samples | P50/P95 measurement ring buffer |
| Cache warmup batch | 13 texts | Pre-embed batch size |
| Context chunks (RAG) | 5, 13 | RAG retrieval top-k values |
| Retry delays (ms) | 1000, 1000, 2000, 3000, 5000, 8000, 13000 | Fibonacci backoff |

---

## Deployment Guide

### Prerequisites

```bash
# Install Wrangler
npm install -g wrangler@latest

# Authenticate
npx wrangler login

# Verify account
npx wrangler whoami
```

### Step 1: Create Cloudflare Resources

```bash
# KV Namespaces
npx wrangler kv namespace create EDGE_CACHE_KV
npx wrangler kv namespace create SESSION_KV
# → Copy IDs into wrangler.toml [[kv_namespaces]] id fields

# Vectorize Indexes
npx wrangler vectorize create heady-vectors --dimensions=768 --metric=cosine
npx wrangler vectorize create heady-docs --dimensions=768 --metric=cosine
npx wrangler vectorize create heady-memories --dimensions=384 --metric=cosine

# R2 Bucket
npx wrangler r2 bucket create heady-documents

# Queues
npx wrangler queues create heady-ingestion-queue
npx wrangler queues create heady-ingestion-dlq
npx wrangler queues create heady-analytics-queue
```

### Step 2: Set Secrets

```bash
npx wrangler secret put EDGE_API_KEY
# Enter: your-secure-api-key

npx wrangler secret put PG_HTTP_URL
# Enter: https://your-neon-project.neon.tech (or Supabase REST URL)

npx wrangler secret put PG_API_KEY
# Enter: your-service-role-key

npx wrangler secret put ORIGIN_URL
# Enter: https://your-cloud-run-service-abcdef-uc.a.run.app

npx wrangler secret put ORIGIN_API_KEY
# Enter: your-cloud-run-service-account-token
```

### Step 3: Deploy

```bash
# Development (local dev with remote AI/KV)
npx wrangler dev --remote

# Staging
npx wrangler deploy --env staging

# Production
npx wrangler deploy
```

### Step 4: Initialize Vectorize Sync

After first deploy, trigger a full resync to populate Vectorize from pgvector:

```bash
# Trigger the scheduled cron manually
npx wrangler cron trigger heady-edge-inference "*/5 * * * *"
```

Or call the health endpoint to verify bindings:

```bash
curl https://api.heady.ai/api/health \
  -H "Accept: application/json"
```

Expected response:
```json
{
  "status": "ok",
  "worker": "edge-inference-worker",
  "bindings": { "ai": true, "kv": true, "vectorize": true, "agentDO": true }
}
```

### Step 5: Verify Endpoints

```bash
# Embed
curl -X POST https://api.heady.ai/api/embed \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Sacred geometry in nature"}'

# Chat (non-streaming)
curl -X POST https://api.heady.ai/api/chat \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}], "stream":false, "temperature":0}'

# Classify
curl -X POST https://api.heady.ai/api/classify \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "This product is amazing"}'
```

---

## Cost Analysis

### Edge Inference (Workers AI Neurons)

| Model | Input | Output | Est. Cost per 1k requests |
|---|---|---|---|
| `llama-3.2-1b-instruct` | $0.027/M | $0.201/M | ~$0.03 |
| `llama-3.1-8b-instruct-fp8-fast` | $0.045/M | $0.384/M | ~$0.10 |
| `bge-base-en-v1.5` | $0.067/M | — | ~$0.007 |
| `distilbert-sst-2-int8` | $0.026/M | — | ~$0.003 |
| `bge-reranker-base` | $0.003/M | — | ~$0.0003 |

**Free tier:** 10,000 Neurons/day (~1,000 chat requests/day at 8B model).

### Durable Objects

| Resource | Cost | Expected Usage |
|---|---|---|
| DO requests | $0.15/M | Low — most traffic via WS |
| DO duration (active) | $12.50/M GB-s | ~0 with hibernation |
| SQLite reads | First 25B/mo free | Very low |
| SQLite writes | $1.00/M | Low — one write per message |

**With hibernation**, a 1,000-session deployment with average 1 message/min/session costs < $5/month in DO charges.

### Vectorize

| Workload | Monthly Cost |
|---|---|
| 50k vectors, 200k queries | ~$1.94 |
| 250k vectors, 500k queries | ~$5.86 |
| 1M vectors, 1M queries (768-dim) | ~$47 |

### Cache Cost Reduction

At a 75% L1 hit rate and 10% L2 hit rate, only 15% of embed requests reach Workers AI. For 1M embed requests/day:
- Without cache: ~$67/day
- With 85% hit rate: ~$10/day
- **Saving: ~85%**

---

## Monitoring and Observability

### Key Headers for Debugging

Every response includes analytics headers:

| Header | Value | Description |
|---|---|---|
| `X-Heady-Model` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | Model used |
| `X-Heady-Complexity` | `standard` | Complexity tier |
| `X-Heady-Cache` | `HIT` or `MISS` | Cache result |
| `X-Heady-Route` | `edge` or `origin` | Route taken |
| `X-Heady-Tag` | `hdy:cht:e:m8j2k4` | Correlation tag |
| `X-Heady-Latency` | `312` | Request latency (ms) |
| `X-Heady-Fallback` | `1` | Fallback was used |
| `X-RateLimit-Remaining` | `18` | Requests remaining this window |

### Cloudflare Dashboard

1. **Workers Analytics** → request counts, error rates, CPU time by endpoint
2. **AI Gateway** → token usage, model distribution, cache hit rates
3. **Workers AI** → per-model Neuron consumption
4. **Vectorize** → query counts, storage utilization
5. **Durable Objects** → active instances, request rates

### Wrangler Tail (Real-time Logs)

```bash
npx wrangler tail heady-edge-inference --format pretty
```

### Health Check Endpoint

```bash
curl https://api.heady.ai/api/health | jq .
```

Monitors: AI binding availability, KV connectivity, Vectorize binding, DO binding.

---

## Troubleshooting

### Symptom: Edge returning 307 for simple requests

**Cause:** Complexity score exceeding threshold for requests that should be simple.  
**Debug:** Check `X-Heady-Complexity` header. If score is unexpectedly high:
- Is the system prompt very long? Trim it.
- Are tools being passed? Remove if not needed.
- Is `complexity: "high"` set in the request body? Remove it.

### Symptom: High cache miss rate for embeddings

**Cause:** Slight whitespace/case variations in text inputs.  
**Note:** The cache normalizes to lowercase + collapsed whitespace. Ensure callers normalize their inputs consistently. Check `X-Heady-Cache` headers.

### Symptom: Vectorize returning stale results

**Cause:** Eventual consistency window. New pgvector entries take up to 5 minutes to appear in Vectorize.  
**Fix:** For real-time consistency, call `VectorizeSync.syncById(ids)` after writes to pgvector.

### Symptom: DurableAgentState not persisting between sessions

**Cause:** Different session IDs are generating different DO instances.  
**Fix:** Ensure the client sends the same `session_id` parameter on reconnect. The DO name = session ID.

### Symptom: WebSocket connections dropping after idle

**Cause:** Cloudflare has a 100-second WebSocket idle timeout that overrides hibernation keepalive.  
**Fix:** Clients should send `{ type: "ping" }` every 60 seconds. The DO responds with `{ type: "pong" }` and the alarm is rescheduled.

### Symptom: Workers AI rate limit errors (429)

**Cause:** Exceeding per-task rate limits (chat: 300 req/min, embed: 3,000 req/min).  
**Fix:** The edge inference Worker enforces internal rate limits (Fibonacci bounds) below the Workers AI limits. If 429s are seen from Workers AI directly, reduce `RATE_LIMIT_*_RPM` vars or implement request queuing.

### Symptom: `_initSchema` errors on first DO startup

**Cause:** SQLite V2 backend not available on the account (requires Workers Paid plan).  
**Fix:** Upgrade to Cloudflare Workers Paid plan ($5/month). Verify with `npx wrangler d1 list`.

---

*Sources: [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/), [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/), [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/), [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/), [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Smart Placement Docs](https://developers.cloudflare.com/workers/configuration/placement/)*
