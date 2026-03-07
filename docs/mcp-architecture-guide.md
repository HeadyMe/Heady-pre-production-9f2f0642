# Heady Latent OS — MCP Ecosystem Architecture Guide

**Section 3: Model Context Protocol Ecosystem and Tool Routing**

*Version 1.0 | March 2026 | Heady Connection*

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Reference](#3-component-reference)
4. [Transport Layer](#4-transport-layer)
5. [Routing Architecture (CSL-Gated)](#5-routing-architecture-csl-gated)
6. [Connection Pool Design](#6-connection-pool-design)
7. [Zero-Trust Security Model](#7-zero-trust-security-model)
8. [Rate Limiting and Deduplication](#8-rate-limiting-and-deduplication)
9. [Audit Logging and Compliance](#9-audit-logging-and-compliance)
10. [Meta-Server Proxy Pattern](#10-meta-server-proxy-pattern)
11. [Configuration Guide](#11-configuration-guide)
12. [Integration with Heady Bee/Swarm Pattern](#12-integration-with-heady-beeswarm-pattern)
13. [Deployment Guide](#13-deployment-guide)
14. [Operations Runbook](#14-operations-runbook)

---

## 1. Overview

The Heady MCP Ecosystem provides a production-grade Model Context Protocol (MCP) implementation for the Heady Latent OS. It enables agent bees and swarm workers to call external tools (GitHub, Slack, PostgreSQL, filesystem, web search, and Heady-internal services) through a unified, secured, and observable gateway.

### Why MCP?

MCP (introduced by Anthropic, November 2024; donated to Agentic AI Foundation, December 2025) standardizes the connection layer between AI agents and external tools. Unlike OpenAI function calling (vendor-specific, stateless) or LangChain tools (framework-coupled), MCP provides:

- **Cross-vendor portability**: The same MCP server works with Claude, GPT-4, Gemini, and any LLM
- **Stateful sessions**: Persistent connections reduce per-call overhead vs. stateless APIs
- **Protocol-level discovery**: Agents discover tools at runtime via `tools/list`
- **10,000+ public servers**: Ready-to-deploy integrations for every major service

### Heady MCP Stack

```
Agent Bee / Swarm Worker
         │
         ▼
  [MCPGateway]          ← CSL-gated routing, load balancing, failover
         │
  ┌──────┴──────┐
  │  Security   │       ← ZeroTrustSandbox + SemanticRateLimiter + MCPAuditLogger
  └──────┬──────┘
         │
  [MCPConnectionPoolManager]    ← Pooled connections, phi-backoff reconnect
         │
  [MCPTransportAdapter]         ← Streamable HTTP / SSE / stdio / WebSocket
         │
  [Upstream MCP Servers]        ← github.* / slack.* / db.* / fs.* / heady.*
```

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      HEADY LATENT OS                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AGENT LAYER                               │  │
│  │  [mcp-bee.js]  [heady-manager.js]  [swarm workers]         │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │ tool calls                               │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │                MCP GATEWAY LAYER                             │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │              MCPGateway (gateway/mcp-gateway.js)    │    │  │
│  │  │                                                     │    │  │
│  │  │  • CSL cosine similarity routing (threshold: 0.72) │    │  │
│  │  │  • Namespace-prefix routing (github.*, slack.*)    │    │  │
│  │  │  • Round-robin / least-connections load balancing  │    │  │
│  │  │  • Graceful failover (max 3 attempts)              │    │  │
│  │  │  • Rolling request log (last 1000)                 │    │  │
│  │  └──────────────────────┬──────────────────────────────┘    │  │
│  │                         │                                    │  │
│  │  ┌──────────────────────▼──────────────────────────────┐    │  │
│  │  │            SECURITY LAYER                           │    │  │
│  │  │                                                     │    │  │
│  │  │  ZeroTrustSandbox  SemanticRateLimiter  AuditLogger │    │  │
│  │  │  • Capability ACL  • Token bucket       • 6 fields │    │  │
│  │  │  • Input validation • Sliding window    • NDJSON   │    │  │
│  │  │  • Output scan      • Semantic dedup    • Rotation │    │  │
│  │  │  • Timeout enforce  • Priority queue   • SIEM fwd  │    │  │
│  │  └──────────────────────┬──────────────────────────────┘    │  │
│  │                         │                                    │  │
│  │  ┌──────────────────────▼──────────────────────────────┐    │  │
│  │  │         CONNECTION POOL MANAGER                     │    │  │
│  │  │  • Min/max/idle connection pooling                  │    │  │
│  │  │  • Per-transport pooling strategies                 │    │  │
│  │  │  • Heartbeat monitoring (every 15s)                 │    │  │
│  │  │  • Phi-ratio (φ=1.618) exponential backoff          │    │  │
│  │  │  • Connection warm-up on startup                    │    │  │
│  │  └──────────────────────┬──────────────────────────────┘    │  │
│  │                         │                                    │  │
│  │  ┌──────────────────────▼──────────────────────────────┐    │  │
│  │  │            TRANSPORT ADAPTER LAYER                  │    │  │
│  │  │                                                     │    │  │
│  │  │  StreamableHTTP  │  LegacySSE  │  Stdio  │  WS     │    │  │
│  │  │  (2025-03-26+)   │  (compat)   │  (local)│  (web)  │    │  │
│  │  └──────────────────────┬──────────────────────────────┘    │  │
│  └─────────────────────────┼────────────────────────────────────┘  │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │ MCP protocol (JSON-RPC 2.0)
         ┌───────────────────┼───────────────────────┐
         │                   │                       │
    ┌────▼────┐         ┌────▼────┐           ┌─────▼────┐
    │ github  │         │  slack  │           │  db      │
    │   MCP   │         │   MCP   │           │   MCP    │
    │ server  │         │ server  │           │  server  │
    └─────────┘         └─────────┘           └──────────┘
         │
    ┌────▼────┐         ┌──────────┐
    │   fs    │         │  heady   │
    │   MCP   │         │ internal │
    │ (stdio) │         │   MCP   │
    └─────────┘         └──────────┘
```

---

## 3. Component Reference

### 3.1 MCPGateway (`gateway/mcp-gateway.js`)

The central routing hub. Extends `EventEmitter`.

**Key responsibilities:**
- Maintain a registry of upstream MCP servers organized by namespace
- Route tool calls via namespace prefix OR CSL cosine similarity fallback
- Load balance across multiple instances (round-robin, least-connections, CSL-weighted)
- Run periodic health checks and reconnect failed servers
- Log all requests to a rolling 1000-entry request log

**Primary API:**

```js
const gateway = new MCPGateway({
  strategy: LoadBalanceStrategy.LEAST_CONNECTIONS,
  cslThreshold: 0.72,
  enableSemanticRouting: true,
});

gateway.registerServer({
  id: 'github-0',
  namespace: 'github',
  url: 'https://mcp.example.com/github',
  transport: 'streamable-http',
  auth: { type: 'bearer', token: process.env.GITHUB_MCP_TOKEN },
});

await gateway.initialize();
const result = await gateway.callTool('github.create_issue', { title: 'Bug' }, { userId: 'u1' });
```

**Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| `tool_routed` | `{requestId, toolName, serverId, duration}` | Tool call completed |
| `server_registered` | `{id, namespace}` | New server registered |
| `server_unhealthy` | `{serverId, reason}` | Server health degraded |
| `failover` | `{requestId, fromServer, attempt}` | Failover triggered |
| `log` | `{level, event, ...data}` | Internal log entry |

### 3.2 MCPConnectionPoolManager (`modules/connection-pool-manager.js`)

Connection pool for MCP server connections. One pool per server.

**Pool states:** `connecting → idle → active → draining → closed`

**Phi-ratio backoff:**
```
delay = min(base * φ^attempt, maxDelay)
φ = 1.618033988749895
```

**Primary API:**

```js
const poolManager = new MCPConnectionPoolManager();

poolManager.createPool({
  serverId: 'github',
  transportType: TransportType.STREAMABLE_HTTP,
  transportFactory: async () => { /* create and connect Client */ },
  min: 2, max: 10,
  warmUpOnStart: true,
});

await poolManager.initialize();
const result = await poolManager.withConnection('github', async (conn) => {
  return conn.client.callTool({ name: 'create_issue', arguments: {} });
});
```

**Metrics:** `active`, `idle`, `total`, `waiting` connections per pool.

### 3.3 MCPTransportAdapter (`modules/transport-adapter.js`)

Unified transport layer supporting all MCP transport types.

**Transport hierarchy:**
```
MCPTransportAdapter (unified interface)
├── StreamableHTTPTransport  (MCP spec 2025-03-26+)
├── LegacySSETransport       (MCP spec 2024-11-05, backward compat)
├── StdioTransport           (subprocess, local tools)
└── WebSocketTransport       (ws:// and wss://)
```

**Auto-detection:**
```js
const adapter = new MCPTransportAdapter('https://mcp.example.com/github', {
  transportType: TransportId.AUTO,  // Probe and negotiate
  headers: { Authorization: 'Bearer ...' },
});
const { transportType, protocolVersion } = await adapter.connect();
```

### 3.4 ZeroTrustSandbox (`modules/zero-trust-sandbox.js`)

Capability-based security layer wrapping every tool execution.

**Execution pipeline:**
1. Authorization check (capabilities bitmask + JWT roles)
2. Input validation (size + injection patterns: SQL, path traversal, SSRF)
3. Rate limit enforcement (per-tool, per-user, per-session)
4. Timed execution (configurable timeout per tool)
5. Output scan (PII, credentials, IMDS URLs)
6. Audit record generation (6 SOC 2 required fields)

**Capability flags:**
```js
Capability.FILE_READ     // 0b00000001
Capability.FILE_WRITE    // 0b00000010
Capability.NETWORK       // 0b00000100
Capability.SUBPROCESS    // 0b00001000
Capability.DATABASE_READ // 0b00010000
Capability.DATABASE_WRITE// 0b00100000
Capability.SECRETS_READ  // 0b01000000
Capability.ADMIN         // 0b10000000
```

### 3.5 SemanticRateLimiter (`modules/rate-limiter.js`)

Multi-layer rate limiting with semantic deduplication.

**Rate limit layers (checked in order):**
1. Gateway global bucket (all tools combined)
2. Per-tool token bucket (protect individual servers)
3. Per-user-per-tool sliding window (user quota)
4. Per-session sliding window (agent loop protection)

**Semantic deduplication:**
- Embeds tool name + params into 64-dim vector
- Compares against cache using cosine similarity
- Requests with similarity ≥ 0.95 within TTL window return cached result
- Saves downstream round-trips for repeated identical agent calls

**Response headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1741391400
X-RateLimit-Burst: 119
X-RateLimit-Policy: 60;w=60
Retry-After: 12    (on 429 response)
```

### 3.6 MCPAuditLogger (`modules/audit-logger.js`)

SOC 2 / ISO 27001 / GDPR-compliant audit logging.

**Six required audit fields** (Aembit MCP auditing framework):
1. `timestamp` — ISO 8601 with timezone
2. `tool` — Specific qualified tool name (`github.create_issue`, not "github")
3. `user` — Workload identity (never anonymous in production)
4. `input_hash` — SHA-256 of serialized params (never raw params)
5. `output_hash` — SHA-256 of serialized result (never raw result)
6. `duration_ms` — Precise execution timing for SLA monitoring

**Chain-of-custody:**
Each record includes `prev_hash` (hash of previous record) and `record_hash` (hash of core fields). Tampering with any record is detectable via `verifyChain()`.

### 3.7 MCPMetaServerProxy (`gateway/meta-server-proxy.js`)

Aggregates all upstream MCP servers into a single MCP server endpoint.

**Namespace management:**
- Tools from `github` server become `github.create_issue`, `github.list_prs`, etc.
- Schema collision strategy: `best_effort` (merge compatible schemas)
- Cache TTL: 5 minutes; auto-refresh on expiry
- Built-in `meta.health` tool returns full health dashboard

---

## 4. Transport Layer

### Transport Comparison

| Transport | MCP Spec | Use Case | Bidirectional | Auth |
|-----------|----------|----------|---------------|------|
| **Streamable HTTP** | 2025-03-26 | Remote/shared servers | Yes (POST + GET/SSE) | HTTP headers |
| **Legacy SSE** | 2024-11-05 | Backward compat | Partial | HTTP headers |
| **stdio** | All | Local tools, dev | Yes (stdin/stdout) | Process isolation |
| **WebSocket** | Community | Web environments | Yes (full-duplex) | HTTP upgrade headers |

### Streamable HTTP Session Management

```
Client → Server: POST /mcp
  Headers: MCP-Protocol-Version: 2025-11-25
           Content-Type: application/json

Server → Client: 200 OK
  Headers: MCP-Session-Id: sess_<uuid>
           MCP-Protocol-Version: 2025-11-25

Client → Server: All subsequent requests
  Headers: MCP-Session-Id: sess_<uuid>

Client → Server: GET /mcp  (server-initiated messages channel)
  Headers: Accept: text/event-stream
           Last-Event-ID: <last-event-id>  (for resumability)
```

### Transport Negotiation (AUTO mode)

```
detectTransport(endpoint):
  1. Check protocol prefix: stdio:// → STDIO, ws:// → WEBSOCKET
  2. Probe HTTP endpoint with POST + MCP-Protocol-Version header
  3. 200/400 with JSON/SSE content-type → STREAMABLE_HTTP
  4. 404/405 on POST → LEGACY_SSE (older server)
  5. Default fallback → STREAMABLE_HTTP
```

---

## 5. Routing Architecture (CSL-Gated)

### Primary Routing: Namespace Prefix

Tool calls with qualified names (`namespace.tool_name`) route directly:

```
github.create_issue  →  github namespace  →  github-primary server
slack.send_message   →  slack namespace   →  slack-primary server
db.query             →  db namespace      →  db-primary server
```

### Fallback Routing: CSL Cosine Similarity

When a tool name has no direct namespace match (or when called with a natural language description), the gateway falls back to CSL (Contextual Semantic Lattice) cosine similarity:

```
query: "create a PR in github"
   ↓
embedFn("create a PR in github") → 128-dim vector
   ↓
Compare against all registered tool embeddings
   ↓
Best match: github.create_pr (score: 0.83 > threshold 0.72)
   ↓
Route to github namespace server
```

**CSL embedding function:**
- Tokenizes tool name + description
- Produces deterministic 128-dim L2-normalized vector
- In production, replace with Heady vector service for higher accuracy

**Debug routing decisions:**
```js
const rankings = gateway.cslRankTools("create an issue on github", 5);
// Returns: [{toolName, serverId, description, score}, ...]
```

### Load Balancing

| Strategy | Algorithm | Best For |
|----------|-----------|----------|
| `round_robin` | Sequential index rotation | Uniform request sizes |
| `least_connections` | Min active connections | Variable request duration |
| `csl_weighted` | `weight / (connections + 1)` | Mixed workloads |
| `random` | Random selection | Testing |

---

## 6. Connection Pool Design

### Pool States

```
 transportFactory()
        ↓
   [CONNECTING]
        ↓
    [IDLE] ←──── acquire()  ──────→ [ACTIVE]
      ↑                                  │
    release() ◄──────────────────────────┘
      │
      ▼
[DRAINING] → [CLOSED]

On heartbeat failure:
[IDLE] → [ERROR] → reconnect (phi-backoff) → [CONNECTING] → [IDLE]
```

### Transport-Specific Pooling

**Streamable HTTP:** HTTP keep-alive connection reuse; multiple logical MCP sessions per TCP connection via `MCP-Session-Id`. Heartbeat = `listTools()` call.

**stdio:** One-to-one process-per-connection; pool size = number of subprocess instances. Heartbeat = check `process.exitCode !== null`.

**WebSocket:** Persistent connection; heartbeat = WebSocket ping frame.

### Phi-Ratio Exponential Backoff

```
delay(attempt) = min(base * φ^attempt, maxDelay)

attempt 0: 500 ms
attempt 1: 809 ms
attempt 2: 1308 ms
attempt 3: 2114 ms
attempt 4: 3419 ms
attempt 5: 5527 ms
...
attempt 9: 60000 ms (cap)
```

The golden ratio φ (1.618) provides smooth sub-exponential growth that converges to the cap faster than e but gentler than 2^n, reducing thundering-herd reconnects in cluster failures.

---

## 7. Zero-Trust Security Model

### Defense in Depth

```
Layer 0: Infrastructure isolation (Docker → gVisor → Firecracker)
Layer 1: MCPGateway namespace enforcement (this codebase)
Layer 2: ZeroTrustSandbox capability ACL (this codebase)
Layer 3: OAuth 2.1 + PKCE token validation
Layer 4: Input validation (injection pattern blocking)
Layer 5: Output scanning (PII, credential detection)
Layer 6: Audit logging (tamper-evident chain-of-custody)
```

### Capability Model

Every tool has a declared capability bitmask. Users are granted capabilities via JWT claims. A call only proceeds when `user_capabilities & required_capabilities === required_capabilities`.

```
Tool: db.query
  required: DATABASE_READ (0b00010000)

User JWT:
  capabilities: ["DATABASE_READ", "NETWORK"] → bitmask: 0b00010100

Check: 0b00010100 & 0b00010000 = 0b00010000 ✓ → ALLOWED
```

### Injection Prevention

| Attack | Pattern Detection | Response |
|--------|------------------|----------|
| SQL injection | `SELECT/INSERT/DROP/UNION` patterns | Block with `SQL_INJECTION` error |
| Path traversal | `../`, `/etc/passwd`, `/proc/self` | Block with `PATH_TRAVERSAL` error |
| SSRF | Private IPs, `169.254.169.254`, `file://` | Block with `SSRF` error |

### Token Security (MCP Spec Requirement)

**Token passthrough is STRICTLY FORBIDDEN** (MCP specification 2025-11-25):

```
❌ FORBIDDEN:
Client → Gateway: Bearer token_A
Gateway → Upstream: Bearer token_A   ← bypasses rate limiting, breaks audit

✅ REQUIRED:
Client → Gateway: Bearer token_A (scoped to gateway)
Gateway → Auth Server: Exchange token_A for token_B
                        (audience=upstream, scope=minimal)
Gateway → Upstream: Bearer token_B
```

---

## 8. Rate Limiting and Deduplication

### Limit Hierarchy

```
Global (1000 RPM) ← single bucket for all gateway traffic
  └── Per-tool (configurable per namespace)
        └── Per-user-per-tool (20% of tool limit)
              └── Per-session (3× tool limit)
```

### Semantic Deduplication Flow

```
callTool('github.list_issues', {repo: 'heady'})
         ↓
embedRequest('github.list_issues', {repo: 'heady'})
  → 64-dim vector V1
         ↓
SemanticDedupCache.check(V1)
  → Found entry V0 with cosine(V0, V1) = 0.97 ≥ 0.95
         ↓
Return cached result (no upstream call)
emit('duplicate_detected', {similarity: '≥0.95'})
```

**Deduplication window:** 5 seconds (configurable). Prevents agent retry storms where the same question is asked multiple times in rapid succession.

### Priority Queue

Rate-limited requests are not rejected immediately if `enableQueue: true`. They enter a min-heap priority queue:
- Default priority: 1 (lower = higher priority)
- Queue drained when token bucket refills
- Requests expire after `queueTimeoutMs` (default 5s)

---

## 9. Audit Logging and Compliance

### Log Record Structure

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-07T05:00:00.000Z",
  "level": "AUDIT",
  "tool": "github.create_issue",
  "tool_version": "1.2.3",
  "user": "u:alice@headyconnection.org",
  "user_type": "human",
  "session_id": "sess_abc123",
  "request_id": "req_xyz789",
  "input_hash": "sha256:a9b7c...",
  "output_hash": "sha256:f3e2d...",
  "duration_ms": 234,
  "success": true,
  "error_code": null,
  "authorization": {
    "roles": ["developer"],
    "capabilities": ["NETWORK"],
    "policy_match": true
  },
  "environment": "production",
  "cloud_region": "us-east-1",
  "prev_hash": "sha256:prev...",
  "record_hash": "sha256:this..."
}
```

### Retention and Rotation

- Files: JSONL format, 50 MB max per file
- Daily rotation by default
- 90-day retention (regulatory minimum for SOC 2 / ISO 27001)
- Older files automatically pruned

### SIEM Export Formats

| Format | Use Case |
|--------|----------|
| `ndjson` | Splunk, Elastic, Datadog (default) |
| `json` | REST API ingestion |
| `cef` | ArcSight, legacy SIEM systems |
| `syslog` | Traditional syslog infrastructure |

### Chain-of-Custody Verification

```js
const records = logger.query({ since: '2026-01-01', limit: 1000 });
const result = logger.verifyChain(records);
// { valid: true, details: 'Chain valid for 1000 records' }
```

---

## 10. Meta-Server Proxy Pattern

### Namespace Aggregation

```
                  ┌─────────────────────────┐
Agent sees:       │  MCPMetaServerProxy     │
                  │                         │
                  │  github.create_issue    │────► github MCP server
                  │  github.list_prs        │
                  │  slack.send_message     │────► slack MCP server
                  │  slack.list_channels    │
                  │  db.query               │────► postgres MCP server
                  │  meta.health            │◄─── built-in
                  └─────────────────────────┘
```

### Schema Merge Strategies

| Strategy | Collision Behavior | Use When |
|----------|-------------------|----------|
| `first_wins` | Keep existing schema | Stable environments |
| `last_wins` | Replace with newer schema | Rolling updates |
| `strict` | Error on collision | Enforcement needed |
| `best_effort` | Merge compatible schemas | Recommended default |

### Health Dashboard Tool

The built-in `meta.health` tool returns a full health dashboard:

```js
const result = await client.callTool({ name: 'meta.health', arguments: {} });
// Returns: { status, upstreamServers, toolsByNamespace, metrics, generatedAt }
```

---

## 11. Configuration Guide

Configuration is managed via `configs/mcp-gateway-config.yaml`. All secrets must be provided via environment variables; never hardcode credentials.

### Minimal Production Config

```yaml
gateway:
  load_balance_strategy: least_connections
  csl_threshold: 0.72
  default_timeout_ms: 30000

servers:
  - id: github-primary
    namespace: github
    transport: streamable-http
    url: ${GITHUB_MCP_URL}
    auth:
      type: bearer
      token: ${GITHUB_MCP_TOKEN}

audit:
  enabled: true
  file_logging:
    enabled: true
    log_dir: ./logs/audit
    retention_days: 90

auth:
  oauth2:
    enabled: true
    issuer_url: ${OAUTH_ISSUER_URL}
    token_passthrough: false
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_MCP_TOKEN` | Yes | Bearer token for GitHub MCP server |
| `SLACK_MCP_TOKEN` | Yes | Bearer token for Slack MCP server |
| `DB_MCP_TOKEN` | Yes | Bearer token for PostgreSQL MCP server |
| `OAUTH_ISSUER_URL` | Yes | OAuth 2.1 authorization server URL |
| `OAUTH_AUDIENCE` | Yes | Token audience for this gateway |
| `SIEM_WEBHOOK_URL` | No | SIEM ingest URL for audit log forwarding |
| `AUDIT_LOG_DIR` | No | Override audit log directory |
| `GATEWAY_PORT` | No | HTTP port (default: 3000) |
| `LOG_LEVEL` | No | Log level: debug/info/warn/error |

---

## 12. Integration with Heady Bee/Swarm Pattern

### mcp-bee.js Integration

The `MCPGateway` is designed to be used inside Heady bee workers. The bee maintains a single gateway instance (singleton per worker) and routes all tool calls through it:

```js
// In src/bees/mcp-bee.js
import { MCPGateway, LoadBalanceStrategy } from
  '../../heady-implementation/section3-mcp-ecosystem/gateway/mcp-gateway.js';
import { ZeroTrustSandbox } from
  '../../heady-implementation/section3-mcp-ecosystem/modules/zero-trust-sandbox.js';
import { SemanticRateLimiter } from
  '../../heady-implementation/section3-mcp-ecosystem/modules/rate-limiter.js';
import { MCPAuditLogger } from
  '../../heady-implementation/section3-mcp-ecosystem/modules/audit-logger.js';

export class MCPBee {
  constructor(config) {
    this.gateway = new MCPGateway({
      strategy: LoadBalanceStrategy.LEAST_CONNECTIONS,
      cslThreshold: 0.72,
    });
    this.sandbox = new ZeroTrustSandbox({ environment: 'production' });
    this.limiter = new SemanticRateLimiter();
    this.logger  = new MCPAuditLogger({ logDir: config.auditLogDir });
  }

  async callTool(toolName, params, context) {
    // 1. Rate limit check
    const limitResult = await this.limiter.check(toolName, params, context);
    if (!limitResult.allowed) throw new Error('Rate limited');
    if (limitResult.deduplicated) return limitResult.cachedResult;

    // 2. Sandbox execution (delegates to gateway)
    const result = await this.sandbox.execute(
      toolName, params,
      (p) => this.gateway.callTool(toolName, p, context),
      context
    );

    // 3. Cache result for deduplication
    this.limiter.cacheResult(toolName, params, result, context.requestId);

    // 4. Log to audit trail (sandbox already generates audit records)
    return result;
  }
}
```

### heady-manager.js Integration

The `MCPMetaServerProxy` can be used to expose all downstream MCP tools as a unified server for the heady-manager orchestration layer:

```js
// In heady-manager.js
import { MCPMetaServerProxy } from
  './heady-implementation/section3-mcp-ecosystem/gateway/meta-server-proxy.js';

const metaProxy = new MCPMetaServerProxy({
  serverInfo: { name: 'heady-orchestrator-mcp', version: '1.0.0' },
});
// ... register upstreams, initialize
// ... expose via transport for downstream agents
```

---

## 13. Deployment Guide

### Node.js Requirements

- Node.js 22+ (native WebSocket support, `fetch` built-in)
- `@modelcontextprotocol/sdk` ^1.0.1
- ES modules (`"type": "module"` in package.json)

### Production Deployment Checklist

| Control | Requirement |
|---------|-------------|
| **Transport** | HTTPS only; TLS 1.2+ minimum |
| **Authentication** | OAuth 2.1 with PKCE (`S256` method) |
| **Token scoping** | Progressive least-privilege; no wildcards |
| **Token passthrough** | STRICTLY FORBIDDEN (exchange tokens) |
| **Session IDs** | Cryptographically random UUIDs |
| **Sandbox** | ZeroTrustSandbox enabled for all tools |
| **Rate limiting** | SemanticRateLimiter enabled |
| **Audit logging** | MCPAuditLogger with SIEM forwarding |
| **Chain-of-custody** | Enabled; verify daily |
| **Health checks** | 30s interval; alert on UNHEALTHY |
| **Connection pools** | warmUpOnStart: true; min ≥ 2 |
| **Log retention** | 90-day minimum |

### Docker Deployment

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
ENV GATEWAY_PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Kubernetes (with gVisor for enhanced isolation)

```yaml
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: gvisor      # syscall interception for MCP tool execution
  containers:
  - name: heady-mcp-gateway
    image: heady/mcp-gateway:1.0.0
    securityContext:
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop: [ALL]
    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
    env:
    - name: GITHUB_MCP_TOKEN
      valueFrom:
        secretKeyRef:
          name: mcp-secrets
          key: github-token
```

---

## 14. Operations Runbook

### Health Check Endpoints

```
GET /health           → Meta-server health dashboard (JSON)
GET /health/live      → Liveness probe (200 = alive)
GET /health/ready     → Readiness probe (200 = all upstreams healthy)
GET /.well-known/mcp.json → Server Card (capabilities, auth info)
```

### Common Issues

**Server UNHEALTHY after restart:**
```js
// Force reconnection and tool rediscovery
await gateway.deregisterServer('github-primary');
gateway.registerServer({ id: 'github-primary', ... });
await gateway._connectServer('github-primary');
await gateway._discoverServerTools('github-primary', registration);
```

**Rate limit 429 errors in agent loops:**
- Check `X-RateLimit-Remaining` header
- Increase `requestsPerMinute` in config, or
- Enable semantic deduplication to short-circuit identical calls

**CSL routing wrong tool:**
```js
// Debug which tools match a query
const ranked = gateway.cslRankTools('describe the query here', 10);
console.log(ranked); // Shows scores for all candidates
// If score < 0.72, add namespace prefix to the tool call
```

**Audit log chain broken:**
```js
const records = logger.query({ limit: 1000 });
const result = logger.verifyChain(records);
if (!result.valid) {
  console.error('Chain broken at:', result.brokenAt, result.details);
  // Check for disk corruption or unauthorized log edits
}
```

**Connection pool exhausted:**
```js
// Check pool metrics
const metrics = poolManager.getAllMetrics();
console.log(metrics.totals); // { active, idle, total, waiting }
// If waiting > 0 for extended time, increase pool max or investigate slow tools
```

---

*Architecture guide for Heady Latent OS Section 3: MCP Ecosystem.*
*MCP specification references: [modelcontextprotocol.io](https://modelcontextprotocol.io)*
*Security references: [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)*
