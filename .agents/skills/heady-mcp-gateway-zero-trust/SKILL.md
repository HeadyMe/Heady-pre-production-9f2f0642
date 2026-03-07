---
name: heady-mcp-gateway-zero-trust
description: >
  Use when building an MCP (Model Context Protocol) gateway with CSL-gated routing, connection pooling,
  multi-transport support (SSE/WebSocket/stdio), zero-trust tool execution sandboxing, semantic rate
  limiting, cryptographic audit logging, and meta-server aggregation. Covers the full MCP ecosystem
  for sovereign AI deployments with phi-scaled parameters.
  Keywords: MCP, Model Context Protocol, gateway, tool routing, zero trust, sandbox, rate limiter,
  audit log, connection pool, meta-server, SSE, WebSocket, stdio, Heady MCP, tool execution.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady MCP Gateway with Zero-Trust Execution

## When to Use This Skill

Use this skill when you need to:

- Build an MCP gateway routing tool calls to multiple upstream servers
- Implement CSL-gated intelligent tool routing (not just prefix matching)
- Pool and manage MCP server connections across transports
- Sandbox tool execution with capability-based permissions
- Rate-limit tool calls with semantic deduplication
- Audit all tool invocations with tamper-evident logging
- Aggregate multiple MCP servers behind a unified meta-server

## Architecture

```
Client Request
  → Rate Limiter (token bucket + sliding window + semantic dedup)
  → CSL Router (namespace prefix → CSL cosine fallback)
  → Connection Pool (transport-aware: SSE/WebSocket/stdio)
  → Zero-Trust Sandbox (capability check → input validation → resource limits)
  → Upstream MCP Server
  → Output Scanning (sensitive data redaction)
  → Audit Logger (SHA-256 chain, SOC 2 format)
  → Response
```

## Instructions

### 1. CSL-Gated Routing

Replace hard threshold routing with smooth CSL gates:
```javascript
// Old: if (cosineSim >= 0.72) route(server)
// New: gatedScore = cslGate(1.0, cosineSim, CSL_THRESHOLDS.MEDIUM)
```

Routing cascade:
1. Namespace prefix match (exact: `github.*`, `slack.*`)
2. CSL cosine similarity (threshold: `CSL_THRESHOLDS.MEDIUM ≈ 0.809`)
3. Load-balanced fallback (phi-weighted round-robin)

### 2. Connection Pooling (phi-scaled)

- Min connections: fib(3) = 2
- Max connections: fib(7) = 13
- Idle timeout: phi-scaled adaptive
- Reconnect backoff: `phiBackoff(attempt)` — φ-exponential
- Max reconnect attempts: fib(7) = 13
- Heartbeat: `phiAdaptiveInterval()` — grows when healthy, shrinks when unhealthy

### 3. Multi-Transport Support

| Transport | Use Case | Protocol |
|-----------|----------|----------|
| Streamable HTTP | Remote servers (2025 spec) | POST + GET/SSE |
| Legacy SSE | Backward compat (2024 spec) | Two-endpoint |
| stdio | Local process servers | Newline-delimited JSON-RPC |
| WebSocket | Full-duplex real-time | WS frames |

Auto-detection: probe HTTP response to negotiate transport.

### 4. Zero-Trust Sandbox

- Capability bitmask ACL (FILE_READ, NETWORK, DATABASE_READ, etc.)
- JWT role-based checks
- Input validation: SQL injection, path traversal, SSRF blocking
- Output scanning: AWS keys, JWTs, credit cards, SSNs → `[REDACTED]`
- Resource limits: CPU time, memory, network per execution
- Execution timeout: phi-scaled per tool category

### 5. Semantic Rate Limiting

- Token bucket (burst) + sliding window (sustained)
- 4 layers: global → per-tool → per-user → per-session
- Semantic dedup: cosine ≥ `DEDUP_THRESHOLD ≈ 0.972` → return cached
- Priority queue for rate-limited requests (min-heap)
- `X-RateLimit-*` headers on every response

### 6. Audit Logging (SOC 2 ready)

6 required fields per record: timestamp, tool, user, input_hash, output_hash, duration_ms
- Cryptographic chain: `prev_hash + record_hash` per entry
- Tamper detection: `verifyChain()` validates integrity
- JSONL rotation at fib(13) × 1MiB = 233 MiB
- Retention: fib(11) = 89 days
- Export formats: NDJSON, JSON, CEF (ArcSight), syslog

### 7. Meta-Server Aggregation

Aggregate N upstream MCP servers into one unified interface:
- Namespace-prefixed tool names to avoid collisions
- Schema caching with TTL = fib(14) × 1000 ≈ 377s
- Built-in `meta.health` tool for dashboard
- CSL-scored schema merge conflict resolution

## Evidence Paths

- `section3-mcp-ecosystem/gateway/mcp-gateway.js`
- `section3-mcp-ecosystem/gateway/meta-server-proxy.js`
- `section3-mcp-ecosystem/modules/zero-trust-sandbox.js`
- `section3-mcp-ecosystem/modules/rate-limiter.js`
- `section3-mcp-ecosystem/modules/audit-logger.js`
- `section3-mcp-ecosystem/modules/connection-pool-manager.js`
- `section3-mcp-ecosystem/modules/transport-adapter.js`
