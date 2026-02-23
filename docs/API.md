# Heady Manager API Reference

**Base URL**: `https://manager.headysystems.com` (port 3301 locally)

---

## Core

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pulse` | None | System health + version |
| GET | `/api/edge/status` | None | Deep system scan |

## Brain (AI Chat)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/brain/chat` | None | Multi-provider parallel race chat |
| POST | `/api/brain/stream` | None | Server-Sent Events streaming (Claude SDK) |
| POST | `/api/brain/analyze` | None | Code/text analysis |
| POST | `/api/brain/embed` | None | Vector embeddings |
| POST | `/api/brain/complete` | None | Text completion |
| POST | `/api/brain/refactor` | None | Code refactoring |
| GET | `/api/brain/claude-usage` | None | Claude credit tracking + model stats |
| GET | `/api/brain/memory-receipts` | None | Memory audit trail |

### POST /api/brain/chat

```json
{
  "message": "Hello!",
  "model": "heady-brain",
  "system": "Optional system prompt",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**Response**:
```json
{
  "ok": true,
  "response": "Hi! I'm HeadyBuddy...",
  "source": "claude-sonnet-4",
  "race": { "winner": "claude", "time_ms": 1234 },
  "memory": { "receipt": "abc123" }
}
```

### POST /api/brain/stream

Server-Sent Events stream. Send same body as `/chat`.

```
data: {"type":"text","content":"Hello"}
data: {"type":"text","content":" world"}
data: {"type":"done","model":"claude-sonnet-4","input_tokens":12,"output_tokens":8}
```

## Claude

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/claude/chat` | Key | Direct Claude chat |
| POST | `/api/claude/think` | Key | Extended thinking mode |
| GET | `/api/claude/status` | Key | Claude connection status |

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/manual` | None | Username/password |
| POST | `/api/auth/device` | None | Device code flow |
| POST | `/api/auth/warp` | None | Cloudflare WARP |
| GET | `/api/auth/google` | None | Google OAuth redirect |
| GET | `/api/auth/google/callback` | None | OAuth callback |

## Battle

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/battle/session` | Key | Start battle session |
| POST | `/api/battle/evaluate` | Key | Evaluate code |
| POST | `/api/battle/arena` | Key | Arena mode |
| GET | `/api/battle/leaderboard` | None | Node rankings |

## Conductor

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/conductor/orchestrate` | Key | Multi-agent task |
| GET | `/api/conductor/status` | Key | Agent status |

## Vector Memory

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/vector/store` | Key | Store vector |
| POST | `/api/vector/search` | Key | Semantic search |
| GET | `/api/vector/stats` | Key | Memory statistics |

## HCFP (Governance)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hcfp/status` | None | Governance engine status |
| POST | `/api/hcfp/evaluate` | Key | Policy evaluation |

---

## Edge Proxy Routes

**Base**: `https://heady-edge-proxy.headysystems.workers.dev`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/health` | None | Edge health |
| GET | `/v1/determinism` | None | Edge metrics |
| POST | `/v1/chat` | None | Public chat |
| POST | `/v1/buddy` | None | Buddy endpoint |
| POST | `/v1/arena` | Key | Arena mode |
| POST | `/v1/colab` | Key | Compute orchestration |
| GET | `/v1/services` | Key | Service groups |
| POST | `/v1/stream` | Key | Event streaming |
| POST | `/v1/sandbox` | Key | Code execution |
| POST | `/v1/forge` | Key | Schema generation |
| POST | `/v1/create` | Key | Multimodal creative |
| POST | `/v1/embed` | Key | Embeddings |
| GET | `/v1/models` | Key | Model catalog |
| GET | `/v1/lens` | Key | Monitoring SoT |
| GET | `/v1/memory` | Key | System memory |
| GET | `/v1/integrations` | Key | Integration patterns |

---

## Authentication

All authenticated endpoints accept:
- Header: `X-Heady-API-Key: heady_api_key_001`
- Header: `Authorization: Bearer heady_api_key_001`
- Query: `?key=heady_api_key_001`

Valid keys: `heady_api_key_001` through `heady_api_key_005`
