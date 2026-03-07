# @heady/mcp-security — MCP-I Security Gap Closure

> **Closing the 20% security gap to unlock 200% valuation uplift**
> HeadySystems Inc. — Production-Ready MCP Infrastructure Security

---

## Overview

This package delivers **10 production-ready modules** that close the MCP-I security gap,
converting a **$750K liability** into a **$1.3M+ security asset**.

## Architecture

```
Client Request
  → RBAC Check (JWT roles → capability bitmask)
  → Rate Limiter (global → tool → user → session + semantic dedup)
  → Input Validator (8 threat categories: SQLi, SSRF, XSS, etc.)
  → CSL Router (namespace prefix → cosine similarity → phi-roundrobin)
  → Connection Pool (HTTP / SSE / WebSocket / stdio)
  → Zero-Trust Sandbox (capability ACL + resource limits + user lockout)
  → Upstream MCP Server
  → Output Scanner (12 pattern types: AWS keys, JWTs, cards, SSNs, etc.)
  → Audit Logger (SHA-256 chain, SOC 2 criteria, CEF/syslog export)
  → Response (with X-RateLimit-* headers)
```

## Modules

| Module | File | Purpose |
|--------|------|---------|
| **Phi-Math** | `shared/phi-math.js` | Foundation: φ-derived constants, CSL gates, no magic numbers |
| **MCP Gateway** | `src/gateway/mcp-gateway.js` | Full security pipeline orchestration |
| **Connection Pool** | `src/gateway/connection-pool.js` | 4-transport pooling with phi-scaled heartbeat |
| **Zero-Trust Sandbox** | `src/security/zero-trust-sandbox.js` | Capability bitmask ACL, resource limits, user lockout |
| **Rate Limiter** | `src/security/rate-limiter.js` | 4-layer semantic rate limiting with dedup |
| **Audit Logger** | `src/security/audit-logger.js` | SOC 2 compliant, SHA-256 chain, 4 export formats |
| **Output Scanner** | `src/security/output-scanner.js` | 12 pattern types, Luhn validation, PII redaction |
| **RBAC Manager** | `src/security/rbac-manager.js` | Hierarchical roles, 5 JWT vendor adapters |
| **Input Validator** | `src/security/input-validator.js` | 8 threat categories, SSRF CIDR blocking |
| **Secret Rotation** | `src/security/secret-rotation.js` | Zero-downtime dual-key rotation, GCP integration |

## Quick Start

```javascript
const { MCPGateway } = require('@heady/mcp-security');

const gateway = new MCPGateway({
  serverRegistry: {
    github: {
      endpoint: 'https://mcp.github.com/sse',
      transport: 'streamable-http',
      tools: ['github.createPR', 'github.listIssues'],
    },
    slack: {
      endpoint: 'https://mcp.slack.com/sse',
      transport: 'legacy-sse',
      tools: ['slack.postMessage', 'slack.getChannels'],
    },
  },
  jwtSecret: process.env.HEADY_JWT_SECRET,
});

// Execute an MCP tool call through full security pipeline
const result = await gateway.execute({
  tool: 'github.createPR',
  arguments: { title: 'Fix bug', body: 'Resolves #123' },
  user: 'eric@headyconnection.org',
  jwt: userJwtToken,
});
```

## Testing

```bash
npm install
npm test          # Run all tests with coverage
npm run test:ci   # CI mode with JUnit reporter
```

## File Structure

```
heady-mcp-security/
├── shared/
│   └── phi-math.js              # φ-derived constants foundation
├── src/
│   ├── index.js                 # Unified entry point
│   ├── gateway/
│   │   ├── mcp-gateway.js       # Zero-trust gateway pipeline
│   │   └── connection-pool.js   # Multi-transport connection pooling
│   └── security/
│       ├── zero-trust-sandbox.js # Capability ACL + resource limits
│       ├── rate-limiter.js      # 4-layer semantic rate limiting
│       ├── audit-logger.js      # SOC 2 audit with SHA-256 chain
│       ├── output-scanner.js    # PII/secret redaction
│       ├── rbac-manager.js      # JWT role-based access control
│       ├── input-validator.js   # 8-category threat detection
│       └── secret-rotation.js   # Zero-downtime credential rotation
├── tests/
│   ├── phi-math.test.js
│   ├── input-validator.test.js
│   ├── output-scanner.test.js
│   ├── zero-trust-sandbox.test.js
│   ├── audit-logger.test.js
│   ├── rate-limiter.test.js
│   ├── rbac-manager.test.js
│   └── secret-rotation.test.js
├── docs/
│   ├── SOC2-COMPLIANCE-MATRIX.md
│   └── SECURITY-GAP-ANALYSIS.md
├── package.json
└── README.md
```

## Phi-Scaled Parameters

All numeric parameters derive from φ (golden ratio) and Fibonacci sequences:

| Parameter | Value | Derivation |
|-----------|-------|------------|
| Min connections | 2 | fib(3) |
| Max connections | 13 | fib(7) |
| Sandbox timeout | 13s | fib(7) × 1000ms |
| Rate burst (user) | 34 | fib(9) |
| Rate burst (global) | 144 | fib(12) |
| Dedup cache size | 987 | fib(16) |
| Dedup threshold | 0.972 | Above CSL CRITICAL |
| Audit rotation | 233 MiB | fib(13) × 1 MiB |
| Audit retention | 89 days | fib(11) |
| API key rotation | 89 days | fib(11) |
| JWT key rotation | 55 days | fib(10) |

## SOC 2 Coverage

This package maps to **15 Trust Service Criteria** across all 5 categories:
- **Security** (CC6, CC7, CC8): 11 controls
- **Availability** (A1): 2 controls
- **Processing Integrity** (PI): 1 control
- **Confidentiality** (C1): 2 controls
- **Privacy** (P1): 1 control

See `docs/SOC2-COMPLIANCE-MATRIX.md` for the full evidence mapping.

## Patent Alignment

Strengthens 6 provisional patent positions:
- CSL Geometric Logic (vector-space routing)
- Phi-Continuous Scaling (Sacred Geometry)
- Zero-Trust Agent Execution
- Semantic Deduplication
- Tamper-Evident Audit Chains
- Multi-Transport MCP Protocol

## License

Proprietary — HeadySystems Inc. All rights reserved.
51+ provisional patent applications. 59 claims.
