# Rebuilt architecture

## Layers

### Gateway
The gateway owns HTTP routes, JWT sessions, API keys, CORS policy, JSON-RPC MCP routing, WebSocket upgrades, and SSE event delivery.

### Memory engine
The memory engine persists user-scoped memories. Each memory record carries:

- `userId`
- `namespace`
- `content`
- `embedding[384]`
- `x, y, z`
- `metadata`
- timestamps

### Persistence strategy
Two real backends are supported:

1. File backend for zero-setup local operation
2. PostgreSQL + pgvector backend for indexed vector search in production

### Auth
Auth is built around:

- local user registration
- password hashing with `scrypt`
- JWT bearer tokens
- revocable API keys hashed at rest

### MCP access
The MCP bridge supports:

- `POST /mcp/rpc`
- `GET /mcp/sse`
- `WS /ws/mcp`

Tool calls are scoped to the authenticated user.

## Security posture

- passwords are hashed with salted `scrypt`
- API keys are never stored in plaintext
- JWTs are signed with a configurable secret
- all memory queries are user-scoped
- CORS is explicit and configurable
- event streams require auth

## 3D vector persistence
The 3D coordinates are derived from the normalized 384-dimensional embedding and stored with each memory row. That allows UI layers to render memory positions directly while retrieval continues to use the higher-dimensional embedding for ranking.
