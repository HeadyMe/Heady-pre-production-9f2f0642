# HeadyStack API Reference

**Version:** 3.0.1 "Aether"  
**Base URL:** `https://your-deployment.run.app`  
**Content-Type:** `application/json`

---

## Authentication

All `/api/*` endpoints (except `/api/auth/*`) require authentication.

### Bearer Token (JWT)

```http
Authorization: Bearer <accessToken>
```

### API Key

```http
X-Heady-Key: hdy_live_xxxxxxxxxxxxx
```

---

## Health & System

### GET /health

Liveness probe. No authentication required.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T08:00:00.000Z",
  "version": "3.0.1",
  "uptime": 3600
}
```

---

### GET /ready

Readiness probe. Returns 503 if dependencies not ready.

**Response 200:**
```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "vectorMemory": "ok"
  }
}
```

---

### GET /pulse

Deep system status across all subsystems.

**Auth:** Bearer or API Key

**Response 200:**
```json
{
  "status": "healthy",
  "version": "3.0.1",
  "codename": "Aether",
  "uptime": 3600,
  "memory": { "rss": 128000000, "heapUsed": 64000000 },
  "database": { "status": "ok", "latency_ms": 2 },
  "redis": { "status": "ok", "latency_ms": 1 },
  "vectorMemory": { "status": "ok", "count": 4200 },
  "pipeline": { "queued": 0, "processing": 2, "completed": 1840 },
  "bees": { "active": 8, "idle": 16, "domains": 24 },
  "engines": {
    "anthropic": "ok",
    "openai": "ok",
    "groq": "ok"
  },
  "voiceSessions": 3
}
```

---

### GET /metrics

Prometheus-compatible metrics. No authentication required (internal use; restrict at network level).

**Response 200:** Prometheus text format

---

### GET /version

**Response 200:**
```json
{
  "name": "headystack",
  "version": "3.0.1",
  "codename": "Aether",
  "nodeVersion": "20.11.0",
  "platform": "linux",
  "startedAt": "2026-03-07T07:00:00.000Z"
}
```

---

## Authentication Endpoints

### POST /api/auth/register

**Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Jane Doe"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "user",
    "createdAt": "2026-03-07T08:00:00.000Z"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

---

### POST /api/auth/login

**Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400...",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### POST /api/auth/refresh

**Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 900
}
```

---

### POST /api/auth/logout

**Auth:** Bearer required

**Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response 200:**
```json
{ "message": "Logged out successfully" }
```

---

### GET /api/auth/oauth/:provider

Redirect-based OAuth2 PKCE flow.

**Providers:** `github`, `google`

**Response:** 302 redirect to OAuth provider

---

### GET /api/auth/oauth/:provider/callback

OAuth callback handler. Issues HeadyStack JWT pair.

**Response:** 302 redirect with tokens

---

## Chat

### POST /api/chat

Send a chat message with automatic engine selection.

**Auth:** Bearer or API Key

**Body:**
```json
{
  "message": "Explain quantum entanglement",
  "model": "claude-3-5-sonnet-20241022",
  "namespace": "user",
  "stream": false,
  "systemPrompt": "You are a helpful expert.",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "temperature": 0.7,
  "maxTokens": 2048
}
```

**Response 200 (non-streaming):**
```json
{
  "id": "msg_01xxxxxxxxxxx",
  "content": "Quantum entanglement is...",
  "model": "claude-3-5-sonnet-20241022",
  "engine": "anthropic",
  "usage": {
    "inputTokens": 42,
    "outputTokens": 280
  },
  "latency_ms": 1240,
  "pipelineTaskId": "uuid"
}
```

---

### POST /api/chat/stream

Streaming chat via Server-Sent Events.

**Response:** `text/event-stream`

```
data: {"type":"start","id":"msg_01xxx"}
data: {"type":"delta","content":"Quantum "}
data: {"type":"delta","content":"entanglement "}
data: {"type":"end","usage":{"inputTokens":42,"outputTokens":280}}
```

---

## Agents

### POST /api/agents/spawn

Spawn an autonomous agent.

**Auth:** Bearer

**Body:**
```json
{
  "goal": "Research and summarize quantum computing papers from 2025",
  "engine": "anthropic",
  "tools": ["heady_perplexity_search", "heady_memory_store"],
  "beeDomains": ["research", "synthesis"],
  "maxSteps": 20,
  "timeout_ms": 300000
}
```

**Response 201:**
```json
{
  "agentId": "agent_01xxx",
  "status": "running",
  "goal": "Research and summarize...",
  "createdAt": "2026-03-07T08:00:00.000Z",
  "streamUrl": "/api/agents/agent_01xxx/stream"
}
```

---

### GET /api/agents

List active agents.

**Auth:** Bearer

**Response 200:**
```json
{
  "agents": [
    {
      "id": "agent_01xxx",
      "goal": "Research and summarize...",
      "status": "running",
      "steps": 4,
      "createdAt": "2026-03-07T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### DELETE /api/agents/:agentId

Terminate an agent.

**Auth:** Bearer

**Response 200:**
```json
{ "terminated": true, "agentId": "agent_01xxx" }
```

---

## Bees

### POST /api/bees/:domain

Invoke a bee domain agent.

**Auth:** Bearer or API Key

**Domains:** `research`, `coding`, `writing`, `analysis`, `planning`, `memory`, `retrieval`, `synthesis`, `critique`, `validation`, `design`, `data`, `finance`, `legal`, `security`, `devops`, `testing`, `documentation`, `api`, `database`, `ux`, `marketing`, `support`, `orchestration`

**Body:**
```json
{
  "task": "Review this code for security vulnerabilities",
  "context": "...",
  "engine": "anthropic",
  "stream": false
}
```

**Response 200:**
```json
{
  "domain": "security",
  "result": "...",
  "beeId": "bee_01xxx",
  "latency_ms": 980
}
```

---

### GET /api/bees

List bee domain status.

**Auth:** Bearer

**Response 200:**
```json
{
  "domains": [
    { "id": "research", "status": "active", "tasksCompleted": 142 },
    { "id": "coding", "status": "active", "tasksCompleted": 88 }
  ]
}
```

---

## Vector Memory

### POST /api/memory

Store a vector memory entry.

**Auth:** Bearer or API Key

**Body:**
```json
{
  "namespace": "user",
  "key": "project-summary-2026-q1",
  "content": "Q1 2026 project summary...",
  "metadata": {
    "source": "manual",
    "tags": ["project", "q1-2026"]
  }
}
```

**Response 201:**
```json
{
  "id": "550e8400-...",
  "namespace": "user",
  "key": "project-summary-2026-q1",
  "dimensions": 384,
  "createdAt": "2026-03-07T08:00:00.000Z"
}
```

---

### GET /api/memory/search

Semantic vector search.

**Auth:** Bearer or API Key

**Query params:**
- `q` (required) — natural language query
- `namespace` — filter by namespace (default: all)
- `topK` — number of results (default: 10, max: 100)
- `minScore` — minimum similarity threshold (0.0–1.0, default: 0.7)

**Response 200:**
```json
{
  "results": [
    {
      "id": "550e8400-...",
      "namespace": "user",
      "key": "project-summary-2026-q1",
      "score": 0.94,
      "metadata": { "source": "manual", "tags": ["project"] }
    }
  ],
  "total": 1,
  "query": "Q1 project status"
}
```

---

### DELETE /api/memory/:id

Delete a memory entry.

**Auth:** Bearer

**Response 200:**
```json
{ "deleted": true, "id": "550e8400-..." }
```

---

## Pipeline

### POST /api/pipeline/enqueue

Enqueue a task into the 12-stage pipeline.

**Auth:** Bearer or API Key

**Body:**
```json
{
  "type": "chat",
  "priority": "normal",
  "data": {
    "message": "...",
    "namespace": "user"
  }
}
```

**Response 202:**
```json
{
  "taskId": "task_01xxx",
  "status": "queued",
  "stage": 1,
  "enqueuedAt": "2026-03-07T08:00:00.000Z"
}
```

---

### GET /api/pipeline/:taskId

Get pipeline task status.

**Auth:** Bearer

**Response 200:**
```json
{
  "taskId": "task_01xxx",
  "status": "completed",
  "stage": 12,
  "data": { "result": "..." },
  "completedAt": "2026-03-07T08:00:02.000Z",
  "latency_ms": 2100
}
```

---

## Files

### POST /api/files/upload

Upload and vector-index a file.

**Auth:** Bearer  
**Content-Type:** `multipart/form-data`

**Fields:**
- `file` (required) — file binary
- `namespace` — memory namespace (default: `document`)
- `tags` — comma-separated tags

**Response 201:**
```json
{
  "fileId": "file_01xxx",
  "name": "research-paper.pdf",
  "size": 204800,
  "mimeType": "application/pdf",
  "chunks": 12,
  "vectorized": true,
  "namespace": "document"
}
```

---

### GET /api/files/search

Semantic search across indexed files.

**Auth:** Bearer

**Query params:** `q`, `namespace`, `topK`

**Response 200:**
```json
{
  "results": [
    {
      "fileId": "file_01xxx",
      "name": "research-paper.pdf",
      "chunk": 3,
      "score": 0.91,
      "excerpt": "...relevant text..."
    }
  ]
}
```

---

## Integrations

### Notion

**POST /api/notion/pages** — Create page  
**GET /api/notion/pages/:pageId** — Read page  
**POST /api/notion/databases/:dbId/query** — Query database

### GitHub

**GET /api/github/repos/:owner/:repo** — Repository info  
**GET /api/github/repos/:owner/:repo/contents/:path** — File content  
**POST /api/github/repos/:owner/:repo/issues** — Create issue  
**POST /api/github/repos/:owner/:repo/pulls** — Create PR

### Stripe

**POST /api/stripe/customers** — Create customer  
**GET /api/stripe/subscriptions** — List subscriptions  
**POST /api/stripe/webhooks** — Stripe webhook handler

### Cloudflare

**GET /api/cloudflare/dns** — List DNS records  
**POST /api/cloudflare/dns** — Create DNS record  
**POST /api/cloudflare/purge** — Purge cache

### Render

**GET /api/render/services** — List services  
**POST /api/render/services/:serviceId/deploys** — Trigger deploy

---

## MCP Server

### GET /mcp

Returns MCP server info and tool manifest.

### POST /mcp/tools/call

Invoke an MCP tool.

**Body:**
```json
{
  "name": "heady_memory_search",
  "arguments": {
    "namespace": "user",
    "query": "project status",
    "topK": 5
  }
}
```

**Response 200:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 relevant memories..."
    }
  ]
}
```

See [MCP.md](./MCP.md) for all 31 tool schemas.

---

## Admin

All admin routes require `ADMIN_TOKEN` bearer or admin-role JWT.

**GET /api/admin/users** — List all users  
**GET /api/admin/users/:id** — Get user details  
**PUT /api/admin/users/:id** — Update user role  
**DELETE /api/admin/users/:id** — Delete user  
**GET /api/admin/audit** — Audit log with filters  
**GET /api/admin/api-keys** — List API keys  
**DELETE /api/admin/api-keys/:id** — Revoke API key

---

## Error Responses

All error responses follow this schema:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is required",
    "requestId": "req_01xxx",
    "timestamp": "2026-03-07T08:00:00.000Z"
  }
}
```

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable |
