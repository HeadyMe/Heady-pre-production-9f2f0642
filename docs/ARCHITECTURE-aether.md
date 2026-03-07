# HeadyStack Architecture

**Version:** 3.0.1 "Aether"  
**© 2026 HeadySystems Inc.**

---

## Table of Contents

1. [Overview](#overview)
2. [5-Layer Architecture](#5-layer-architecture)
3. [Component Diagram](#component-diagram)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Boot Sequence](#boot-sequence)
6. [Auth Flow](#auth-flow)
7. [Vector Memory Topology](#vector-memory-topology)
8. [12-Stage Pipeline](#12-stage-pipeline)
9. [24 Bee Domains](#24-bee-domains)
10. [31 MCP Tools](#31-mcp-tools)

---

## Overview

HeadyStack is architected as a **thin orchestrator** over a set of focused, independently bootable micro-modules. The `heady-manager.js` entry point is intentionally minimal — each subsystem encapsulates its own initialization logic and exposes only what subsequent phases need.

Design principles:
- **Phase isolation**: each boot module is self-contained and testable independently
- **Event-driven**: internal communication via an EventEmitter bus, not direct coupling
- **Graceful degradation**: non-critical services fail silently; critical services abort boot
- **Self-healing**: the watchdog and pipeline retry mechanisms recover from transient failures
- **Observable**: OTEL spans on every significant operation; structured JSON logs throughout

---

## 5-Layer Architecture

```
┌══════════════════════════════════════════════════════════════════╗
║  LAYER 1 — INTERFACE / EDGE                                      ║
║                                                                  ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   ║
║  │  REST API    │  │  MCP Server  │  │  WebSocket (Voice)   │   ║
║  │  /api/*      │  │  /mcp/*      │  │  /ws/voice           │   ║
║  └──────────────┘  └──────────────┘  └──────────────────────┘   ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 2 — GATEWAY / ROUTING                                     ║
║                                                                  ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   ║
║  │HeadyAuth │  │  CORS /  │  │  Rate    │  │  Request      │   ║
║  │JWT/OAuth │  │  Helmet  │  │  Limiter │  │  Correlation  │   ║
║  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 3 — EXECUTION / MODEL                                     ║
║                                                                  ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │  LLM Engines                                             │   ║
║  │  Anthropic │ OpenAI │ Google │ Groq │ Perplexity │ HF    │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │  Bee Swarm — 24 Domain Agents                            │   ║
║  │  research│coding│writing│analysis│planning│memory│...    │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │  12-Stage Task Pipeline                                  │   ║
║  │  intake→classify→plan→retrieve→enrich→execute→           │   ║
║  │  tool-use→validate→synthesize→persist→notify→respond     │   ║
║  └──────────────────────────────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 4 — MEMORY / PERSISTENCE                                  ║
║                                                                  ║
║  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐  ║
║  │  pgvector        │  │  Redis         │  │  PostgreSQL 16 │  ║
║  │  Vector Memory   │  │  Cache/Pub-Sub │  │  Relational    │  ║
║  │  HNSW index      │  │  Sessions      │  │  Users/Audit   │  ║
║  │  384-dim         │  │  Rate Limits   │  │  API Keys      │  ║
║  └──────────────────┘  └────────────────┘  └────────────────┘  ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 5 — OBSERVABILITY / CONTROL                               ║
║                                                                  ║
║  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐  ║
║  │  OpenTelemetry   │  │  Pino Logs     │  │  Watchdog      │  ║
║  │  Traces+Metrics  │  │  Structured    │  │  Self-Healing  │  ║
║  │  /metrics        │  │  JSON          │  │  SelfAwareness │  ║
║  └──────────────────┘  └────────────────┘  └────────────────┘  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Component Diagram

```
heady-manager.js (Orchestrator)
│
├── Phase 0: env-schema.js
│   └── Validates all required env vars; aborts on missing required vars in production
│
├── Phase 1: config-globals.js
│   ├── Express app instance
│   ├── Pino logger (structured JSON)
│   ├── EventEmitter event bus
│   ├── RemoteConfig (YAML loader from configs/remote-resources.yaml)
│   └── SecretsManager (env + optional Vault/GCP Secret Manager)
│
├── Phase 2: middleware-stack.js
│   ├── cors() — origin whitelist from env
│   ├── helmet() — CSP, HSTS, X-Frame-Options
│   ├── express-rate-limit — per-route windows
│   ├── express.json() — body parsing
│   ├── requestId — UUID correlation ID injection
│   └── morgan/pino-http — request logging
│
├── Phase 3: auth-engine.js
│   ├── JWT sign/verify (RS256 or HS256)
│   ├── Refresh token rotation (Redis-backed)
│   ├── OAuth2 PKCE (GitHub, Google)
│   ├── API key validation (DB lookup + cache)
│   └── authMiddleware() factory
│
├── Phase 4: vector-stack.js
│   ├── VectorMemory (pg + pgvector, HNSW)
│   │   ├── store(namespace, key, vector, metadata)
│   │   ├── search(namespace, vector, topK)
│   │   └── delete(id)
│   ├── BuddyAI (persistent AI companion)
│   ├── BeeSWarm (24-domain agent pool)
│   ├── SelfAwareness (system introspection loop)
│   └── Watchdog (health monitor + auto-restart)
│
├── Phase 5: engine-wiring.js
│   ├── AnthropicEngine → claude-3-5-sonnet, claude-3-opus
│   ├── OpenAIEngine → gpt-4o, o1, embeddings
│   ├── GoogleEngine → gemini-2.0-flash, gemini-1.5-pro
│   ├── GroqEngine → llama3-70b, mixtral
│   ├── PerplexityEngine → sonar-online
│   └── ModelRouter (selects engine by task type/cost/latency)
│
├── Phase 6: pipeline-wiring.js
│   └── 12-stage pipeline (see below)
│
├── Phase 7: service-registry.js
│   └── Mounts all 40+ route modules (see routes/registry.js)
│
├── Phase 8: inline-routes.js
│   ├── GET /health
│   ├── GET /ready
│   ├── GET /pulse
│   ├── GET /metrics
│   └── GET /version
│
├── Phase 9: voice-relay.js
│   └── WebSocket server on /ws/voice
│       ├── Session management
│       ├── STT bridge (Whisper via OpenAI)
│       └── TTS bridge (ElevenLabs / Google TTS)
│
└── Phase 10: server-boot.js
    ├── server.listen(PORT)
    ├── SIGTERM → gracefulShutdown()
    └── SIGINT  → gracefulShutdown()
```

---

## Data Flow Diagrams

### Chat Request Flow

```
Client
  │
  ▼
POST /api/chat
  │
  ▼
Rate Limiter → 429 if exceeded
  │
  ▼
HeadyAuth → 401 if invalid token
  │
  ▼
Request Logger (OTEL span starts)
  │
  ▼
ChatController
  │
  ├── Pipeline.enqueue(task)
  │     │
  │     ├── Stage 1: intake      — parse payload, extract intent
  │     ├── Stage 2: classify    — task type, priority, engine selection
  │     ├── Stage 3: plan        — generate tool call plan
  │     ├── Stage 4: retrieve    — VectorMemory.search() → top-K context
  │     ├── Stage 5: enrich      — Perplexity/web augmentation
  │     ├── Stage 6: execute     — LLM API call (streaming or batch)
  │     ├── Stage 7: tool-use    — execute tool calls from model
  │     ├── Stage 8: validate    — schema + quality check
  │     ├── Stage 9: synthesize  — merge multi-agent outputs
  │     ├── Stage 10: persist    — VectorMemory.store() + DB write
  │     ├── Stage 11: notify     — eventBus.emit() + webhooks
  │     └── Stage 12: respond    — format + stream to client
  │
  └── SSE/JSON stream → Client
```

### Vector Memory Write Path

```
Input text/data
  │
  ▼
EmbeddingEngine.embed(text)  → 384-dim float32 vector
  │
  ▼
VectorMemory.store({
  namespace,    // e.g. "user", "agent", "document"
  key,          // unique identifier
  vector,       // float32[384]
  metadata      // JSONB
})
  │
  ▼
PostgreSQL INSERT INTO vector_memories
  (id, namespace, key, vector, metadata, updated_at)
  VALUES (uuid, $1, $2, $3::vector, $4::jsonb, now())
  ON CONFLICT (namespace, key) DO UPDATE SET ...
  │
  ▼
HNSW index update (automatic via pgvector)
```

---

## Boot Sequence

```
t=0ms    Phase 0: validateEnvironment()
t=10ms   Phase 1: Express init, Pino logger, EventBus
t=50ms   Phase 2: Middleware stack mounted
t=80ms   Phase 3: Auth engine initialized, JWT keys loaded
t=200ms  Phase 4: pgvector connection established, bees initialized
t=400ms  Phase 5: LLM engine adapters connected
t=420ms  Phase 6: Pipeline stages wired, watchdog started
t=500ms  Phase 7: 40+ service routes registered
t=510ms  Phase 8: Health/pulse/metrics routes registered
t=520ms  Phase 9: WebSocket voice relay started
t=530ms  Phase 10: HTTP server bound to PORT
         >> HeadyStack v3.0.1 listening on :8080 ∞
```

---

## Auth Flow

```
┌─────────────────────────────────────────────────────────┐
│  Login Flow (JWT + Refresh)                             │
│                                                         │
│  Client → POST /api/auth/login                          │
│        ← { accessToken (15m), refreshToken (7d) }       │
│                                                         │
│  Client → API request + Authorization: Bearer <at>      │
│        ← 200 OK (if valid)                              │
│        ← 401 (if expired)                               │
│                                                         │
│  Client → POST /api/auth/refresh + refreshToken          │
│        ← { new accessToken, new refreshToken }           │
│          (old refresh token is rotated / invalidated)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  API Key Flow                                           │
│                                                         │
│  Client → request + X-Heady-Key: hdy_live_xxx           │
│        → authEngine.validateApiKey(key)                 │
│          → Redis cache check (TTL 5m)                   │
│          → DB lookup on cache miss                      │
│          → scope check                                  │
│        ← 200 OK / 401 / 403                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  OAuth2 PKCE Flow                                       │
│                                                         │
│  Client → GET /api/auth/oauth/github                    │
│        ← redirect to GitHub with code_challenge         │
│                                                         │
│  GitHub → GET /api/auth/oauth/github/callback           │
│         → exchange code + verifier → access token       │
│         → upsert user in DB                             │
│         → issue HeadyStack JWT pair                     │
│        ← redirect to client with tokens                 │
└─────────────────────────────────────────────────────────┘
```

---

## Vector Memory Topology

```
Namespaces (logical partitions in vector_memories table):

  global        — platform-wide shared context
  user/<id>     — per-user private memory
  agent/<id>    — per-agent working memory
  session/<id>  — transient session context (TTL-based)
  tool/<name>   — tool result cache
  document      — indexed file content
  code          — code snippets and repo context
  research      — web search + Perplexity results
  planning      — task plans and projections
  audit         — immutable audit trail vectors

HNSW Index Parameters:
  Dimensions:       384
  Distance:         cosine
  m:                16 (connections per layer)
  ef_construction:  64 (build-time accuracy)
  ef_search:        40 (query-time accuracy, dynamic)

Search response includes:
  - id
  - namespace
  - key
  - similarity score (0.0–1.0)
  - metadata (JSONB)
  - vector (float32[384]) — optional
```

---

## 12-Stage Pipeline

| Stage | Name | Input | Output | Failure Mode |
|-------|------|-------|--------|--------------|
| 1 | intake | Raw request | Normalized task | Abort |
| 2 | classify | Task | Type + priority | Default to medium |
| 3 | plan | Task | Execution plan | Minimal plan |
| 4 | retrieve | Plan | Vector context | Empty context |
| 5 | enrich | Context | Augmented context | Skip enrichment |
| 6 | execute | Augmented context | LLM response | Retry x3 |
| 7 | tool-use | Response | Tool results | Skip tools |
| 8 | validate | Tool results | Validated output | Log + continue |
| 9 | synthesize | Multi-outputs | Unified result | Use primary |
| 10 | persist | Result | DB write confirmation | Log + continue |
| 11 | notify | Result | Events emitted | Log + continue |
| 12 | respond | Final result | HTTP/SSE response | Error response |

Self-healing: stages 6–7 have automatic retry with exponential backoff. The watchdog monitors pipeline queue depth and triggers alerts if tasks age beyond 5 minutes.

---

## 24 Bee Domains

| ID | Domain | Responsibility |
|----|--------|----------------|
| 1 | research | Web search, Perplexity, literature review |
| 2 | coding | Code generation, review, debugging |
| 3 | writing | Long-form content, editing, summarization |
| 4 | analysis | Data analysis, interpretation, insights |
| 5 | planning | Task decomposition, roadmaps, scheduling |
| 6 | memory | Vector recall, context retrieval |
| 7 | retrieval | RAG, document search, indexing |
| 8 | synthesis | Multi-source fusion, report generation |
| 9 | critique | Quality review, fact checking, red-teaming |
| 10 | validation | Schema validation, output verification |
| 11 | design | UI/UX suggestions, wireframing, architecture |
| 12 | data | Data processing, transformation, visualization |
| 13 | finance | Financial analysis, modeling, projections |
| 14 | legal | Contract review, compliance, risk flags |
| 15 | security | Threat modeling, code security review |
| 16 | devops | CI/CD, infrastructure, Dockerfile review |
| 17 | testing | Test generation, coverage analysis |
| 18 | documentation | Docs generation, README, API docs |
| 19 | api | REST/GraphQL design, integration patterns |
| 20 | database | Schema design, query optimization |
| 21 | ux | User research synthesis, journey mapping |
| 22 | marketing | Copy, campaigns, SEO, positioning |
| 23 | support | Customer ticket triage, response drafting |
| 24 | orchestration | Meta-agent routing, swarm coordination |

---

## 31 MCP Tools

See [docs/MCP.md](./MCP.md) for full input/output schemas.

| # | Tool Name | Category |
|---|-----------|----------|
| 1 | `heady_chat` | Inference |
| 2 | `heady_memory_store` | Memory |
| 3 | `heady_memory_search` | Memory |
| 4 | `heady_memory_delete` | Memory |
| 5 | `heady_bee_invoke` | Swarm |
| 6 | `heady_bee_list` | Swarm |
| 7 | `heady_pipeline_enqueue` | Pipeline |
| 8 | `heady_pipeline_status` | Pipeline |
| 9 | `heady_agent_spawn` | Agents |
| 10 | `heady_agent_list` | Agents |
| 11 | `heady_agent_terminate` | Agents |
| 12 | `heady_tool_execute` | Tools |
| 13 | `heady_tool_list` | Tools |
| 14 | `heady_file_upload` | Files |
| 15 | `heady_file_search` | Files |
| 16 | `heady_notion_page_create` | Notion |
| 17 | `heady_notion_page_read` | Notion |
| 18 | `heady_notion_db_query` | Notion |
| 19 | `heady_github_repo_read` | GitHub |
| 20 | `heady_github_file_read` | GitHub |
| 21 | `heady_github_issue_create` | GitHub |
| 22 | `heady_github_pr_create` | GitHub |
| 23 | `heady_perplexity_search` | Search |
| 24 | `heady_cloudflare_dns_list` | Cloudflare |
| 25 | `heady_cloudflare_dns_create` | Cloudflare |
| 26 | `heady_cloudflare_zone_purge` | Cloudflare |
| 27 | `heady_render_deploy` | Deployment |
| 28 | `heady_render_service_list` | Deployment |
| 29 | `heady_stripe_customer_create` | Payments |
| 30 | `heady_stripe_subscription_list` | Payments |
| 31 | `heady_system_pulse` | System |
