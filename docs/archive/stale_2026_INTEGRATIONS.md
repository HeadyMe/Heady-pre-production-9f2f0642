<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady AI Platform — Integrations Guide

> Last updated: February 2026

## Core Integrations

### Cloudflare (Edge Infrastructure)

Heady runs an edge proxy on Cloudflare Workers that handles:

- **Workers AI** — Sub-50ms inference for lightweight tasks
- **Vectorize** — Edge-native vector similarity search
- **KV** — Global key-value cache for session state
- **Tunnels** — Secure ingress to the bare-metal conductor

**Configuration:** Managed via `wrangler.toml` and the Cloudflare dashboard.

### Redis

Redis powers two critical subsystems:

- **Rate Limiting** — Sliding-window counters with automatic IP banning (`src/security/rate-limiter.js`)
- **Predictive Caching** — Pre-emptive asset caching based on HeadyVinci route predictions

**Connection:** Set via `REDIS_URL` environment variable.

### DuckDB (Vector Memory V2)

Local embedded database for conversation vector storage:

- HNSW indexing for fast approximate nearest neighbor search
- `list_cosine_similarity()` for semantic retrieval
- Automatic session tracking and temporal indexing

**File:** `src/intelligence/duckdb-memory.js`  
**Database path:** `~/.headyme/heady-brain-v2.duckdb`

### Stripe (Billing)

Subscription management for Pro ($20/mo) and Enterprise ($99/mo) tiers:

- Checkout session creation via `/api/billing/checkout`
- Webhook signature verification via `/api/billing/webhook`
- Subscription-gated API access via `AuthMiddleware.requireProPlan`

**Files:** `src/api/payment-gateway.js`, `src/routes/billing-routes.js`

### Firebase

- **Authentication** — Google Sign-In, email/password, anonymous
- **Firestore** — User profiles, search history, subscription status
- **Hosting** — Static site deployment for branded properties

### Notion

- **Knowledge Vault Sync** — Bi-directional sync of 11 organized notebook pages
- HeadyBuddy personal knowledge, system documentation, and learning logs

### GitHub Actions

CI/CD pipelines:

- **Branding Enforcement** — Auto-fails PRs with competitor names in user-facing views
- **HF Spaces Sync** — Mirrors monorepo updates to 3 Hugging Face Spaces
- **Obfuscation Pipeline** — V8 Bytecode compilation for production deploys

### Hugging Face

- **3 Spaces** — HeadyBrain demo, HeadySystems platform overview, HeadyConnection topology
- **Inference API** — Fallback model inference via HF endpoints

---

## MCP Server Integration

Heady exposes a local MCP server (`heady-local`) with 40+ tools:

| Tool Category | Examples |
|--------------|---------|
| Chat & Reasoning | `heady_chat`, `heady_claude`, `heady_gemini`, `heady_groq` |
| Code Generation | `heady_coder`, `heady_codex`, `heady_copilot` |
| Analysis | `heady_analyze`, `heady_patterns`, `heady_risks` |
| Operations | `heady_deploy`, `heady_ops`, `heady_maintenance` |
| Research | `heady_perplexity_research`, `heady_search` |
| Memory | `heady_embed`, `heady_deep_scan`, `heady_soul` |

**Configuration:** `~/.config/windsurf-next/mcp_config.json`

---

## SDK & CLI

### Heady Hive SDK

```bash
npm install -g heady-hive-sdk
heady status
heady chat "Hello Heady"
heady deploy --target edge
```

**Package:** `heady-hive-sdk/`  
**CLI Entry:** `heady-hive-sdk/bin/heady.js`

---

## Security Integrations

| System | Technology | File |
|--------|-----------|------|
| Post-Quantum Crypto | ML-KEM + ML-DSA hybrid | `src/security/pqc.js` |
| Mutual TLS | PQC-signed certificates | `src/security/handshake.js` |
| Rate Limiting | Redis sliding window | `src/security/rate-limiter.js` |
| Secret Rotation | 24hr auto-rotation | `src/security/secret-rotation.js` |
| IP Classification | Trade secret tiering | `src/security/ip-classification.js` |
| Code Obfuscation | V8 Bytecode + AST | `scripts/bytenode-compiler.js` |
