<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady AI — Enterprise Deployment Guide

> Last updated: February 2026  
> Classification: PROPRIETARY

## Overview

This guide covers deploying Heady AI for enterprise customers with SOC2, HIPAA, and high-availability requirements.

## Architecture for Enterprise

```
┌─ Customer VPC ──────────────────────────────────┐
│                                                  │
│  ┌─ Cloudflare Edge ──────────────────────────┐  │
│  │  Workers AI + Vectorize + WAF + DDoS       │  │
│  └────────────────────┬───────────────────────┘  │
│                       │ CF Tunnel (encrypted)     │
│  ┌────────────────────▼───────────────────────┐  │
│  │  HeadyConductor                            │  │
│  │  ├── PQC Handshake (ML-KEM + ML-DSA)       │  │
│  │  ├── Redis Rate Limiter                     │  │
│  │  ├── 19 Service Groups                      │  │
│  │  └── Audit JSONL Stream                     │  │
│  ├────────────────────────────────────────────┤  │
│  │  DuckDB Vector Memory V2                   │  │
│  │  HNSW Index + Cosine Similarity             │  │
│  ├────────────────────────────────────────────┤  │
│  │  Redis (Rate Limiting + Caching)            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Security Compliance

### Post-Quantum Cryptography

- All inter-service RPCs signed with ML-KEM-768 + ML-DSA-65 hybrid signatures
- Key rotation every 24 hours via `src/security/secret-rotation.js`
- Forward secrecy maintained across rotation cycles

### Rate Limiting

- Enterprise tier: Unlimited requests (custom SLA)
- Redis sliding-window counters with automatic IP banning
- Internal mesh traffic (`10.x.x.x`) exempt from limits

### IP Classification

| Tier | Access Level |
|------|-------------|
| PUBLIC | Open documentation, marketing assets |
| INTERNAL | Admin tools, internal APIs, dashboards |
| PROPRIETARY | Conductor logic, PQC implementation, Arena algorithms |
| RESTRICTED | Encryption keys, billing secrets, founder-only |

### Code Protection

- All backend services compiled to V8 Bytecode (`.jsc` binaries)
- AST obfuscation via `javascript-obfuscator` before compilation
- Source code never shipped to production edge nodes

### Audit Trail

- All routing decisions logged to `data/conductor-audit.jsonl`
- Stripe webhook events logged with signature verification
- PQC handshake outcomes recorded for compliance reporting

## Deployment Steps

### 1. Infrastructure

```bash
# Install Node.js 20+, Redis, DuckDB
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs redis-server
```

### 2. Application

```bash
git clone https://github.com/headysystems/Heady.git
cd Heady
npm install
cp .env.example .env
# Configure HEADY_BRAIN_KEY, REDIS_URL, STRIPE_SECRET_KEY
```

### 3. Build Production Binaries

```bash
node scripts/bytenode-compiler.js
```

### 4. Start Services

```bash
redis-server --daemonize yes
node src/heady-conductor.js &
cloudflared tunnel run heady-main &
```

### 5. Verify

```bash
curl -sf https://api.headysystems.com/api/conductor/health | jq .
```

## SLA Targets

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Edge latency P95 | <100ms |
| API response P95 | <500ms |
| Key rotation cycle | 24 hours |
| Incident response | <1 hour |
