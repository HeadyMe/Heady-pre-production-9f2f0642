<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady System Architecture — Target State Blueprints

> Last updated: February 2026

> **Context:** This document defines the production architecture for Heady AI's backend infrastructure including database schemas, API contracts, and pipeline definitions.

---

## 1. HeadyConductor — Federated Liquid Routing (LIVE)

The HeadyConductor is the single routing brain for all application-level decisions.

### 1.1 Routing Layers

| Layer | Type | Status |
|-------|------|--------|
| Task Router | Dynamic table (19 service groups) | ✅ Active |
| Vector Zone | 3D spatial octant (DuckDB HNSW) | ✅ Active |
| Brain Router | HCSys orchestrator dispatch | 🔄 Pending |
| Pattern Engine | Known optimization paths | ✅ Active |

### 1.2 Service Group Topology

```sql
-- HeadyConductor routes actions → service groups
-- Each group has a weight for load-aware scaling
reasoning   (1.0)  ← chat, complete, analyze, refactor
coding      (0.95) ← code, refactor_logic, pr_review
intelligence(0.9)  ← meta, logic, brain
sims        (0.85) ← simulate, predict, monte_carlo
embedding   (0.8)  ← embed, store
swarm       (0.8)  ← forage, hive, swarm_nudge
search      (0.75) ← search, query
battle      (0.7)  ← validate, arena
creative    (0.6)  ← generate, remix
vision      (0.5)  ← scan, detect, ocr
governance  (0.4)  ← audit, policy, compliance
ops         (0.3)  ← health, deploy, status
```

### 1.3 Defense Pipeline

Every request passes through 4 layers before touching AI:

1. **Rate Limiter** — Redis sliding-window, 120 req/min (Pro), auto-ban on abuse
2. **PQC Handshake** — ML-KEM key encapsulation + ML-DSA digital signatures
3. **mTLS** — Mutual TLS for all mesh communications
4. **IP Classification** — PUBLIC → INTERNAL → PROPRIETARY → RESTRICTED

---

## 2. DuckDB Vector Memory V2 (LIVE)

### 2.1 Schema

```sql
CREATE TABLE conversation_vectors (
    id VARCHAR PRIMARY KEY,
    ts BIGINT NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    embedding DOUBLE[],
    token_count INTEGER DEFAULT 0,
    session_id VARCHAR,
    metadata JSON
);

CREATE INDEX idx_vectors_ts ON conversation_vectors(ts);
-- HNSW index via VSS extension for approximate nearest neighbor search
```

### 2.2 Core APIs

| Method | Description |
|--------|-------------|
| `insertVector(content, embedding, metadata)` | Insert conversation turn |
| `similaritySearch(queryEmbedding, topK)` | Cosine similarity search |
| `getZoneForQuery(queryText)` | 3D spatial zone classification |
| `getStats()` | Total vectors, sessions, time range |

---

## 3. HCFP Auto-Success Pipeline (LIVE)

### 3.1 The 9-Stage Pipeline

| Stage | Name | Responsibility |
|-------|------|---------------|
| 0 | Channel Entry | Request ingestion |
| 1 | Ingest | Payload validation |
| 2 | Plan | Monte Carlo readiness simulation |
| 3 | Execute | Bounded parallelism (max 6 concurrent) |
| 4 | Recover | Compensation hooks + circuit breakers |
| 5 | Self-Critique | Output quality assessment |
| 6 | Optimize | Performance tuning |
| 7 | Finalize | Result packaging |
| 8 | Monitor | Feedback loop & drift detection |

---

## 4. Billing & Subscription Architecture (LIVE)

### 4.1 Stripe Integration

```
User → /api/billing/checkout → Stripe Checkout Session
Stripe → /api/billing/webhook → AuthMiddleware updates user tier
User → /api/brain/chat → AuthMiddleware.requireProPlan gates premium access
```

### 4.2 Tier Enforcement

| Tier | Rate Limit | API Access | Price |
|------|-----------|------------|-------|
| Free | 30 req/min | Basic chat, search, analyze | $0 |
| Pro | 120 req/min | All tools, HeadyBuddy sync | $20/mo |
| Enterprise | Unlimited | Custom routing, PQC API keys | $99/mo |

---

## 5. Edge Infrastructure (Cloudflare)

```
┌─ Cloudflare Edge ─────────────────────────────┐
│  Workers AI    — Sub-50ms lightweight inference │
│  Vectorize     — Edge-native vector search      │
│  KV            — Global session cache           │
│  Tunnels       — Secure ingress to conductor    │
│  Pages/DNS     — 22 branded domain routing      │
└────────────────────────────────────────────────┘
         │
         ▼
┌─ Bare Metal Conductor ────────────────────────┐
│  HeadyConductor — Federated liquid routing     │
│  Redis          — Rate limiting + caching       │
│  DuckDB         — Local vector memory           │
│  Node.js        — Service orchestration         │
└────────────────────────────────────────────────┘
```

---

## 6. Security Architecture (LIVE)

### 6.1 Post-Quantum Cryptography

| Algorithm | Purpose | Module |
|-----------|---------|--------|
| ML-KEM-768 | Key encapsulation | `src/security/pqc.js` |
| ML-DSA-65 | Digital signatures | `src/security/pqc.js` |
| Hybrid mode | Classical + PQC fallback | `src/security/handshake.js` |

### 6.2 Code Protection Pipeline

```
Source → javascript-obfuscator (AST flattening) → bytenode (V8 bytecode .jsc) → dist/
```

### 6.3 IP Classification Tiers

| Tier | Access | Examples |
|------|--------|---------|
| PUBLIC | Open source or marketing | Documentation, landing pages |
| INTERNAL | Heady employees only | Admin tools, internal APIs |
| PROPRIETARY | Trade secret | Conductor routing logic, PQC implementation |
| RESTRICTED | Founder-only | Encryption keys, billing secrets |

---

## 7. 22 Branded Properties

| # | Domain | Stack | Status |
|---|--------|-------|--------|
| 1 | headysystems.com | Static + CF Pages | ✅ Live |
| 2 | headyme.com | Static + CF Pages | ✅ Live |
| 3 | headyio.com | Static + CF Pages | ✅ Live |
| 4 | headyapi.com | Static + CF Pages | ✅ Live |
| 5 | headymcp.com | Static + CF Pages | ✅ Live |
| 6 | headyconnection.org | Static + CF Pages | ✅ Live |
| 7 | headybuddy.org | Static + CF Pages | ✅ Live |
| 8 | headyweb.com | Static + CF Pages | ✅ Live |
| 9 | headyos (Admin UI) | React + Vite | ✅ Live |
| 10-12 | HF Spaces ×3 | Static HTML | ✅ Live |
| 13 | Heady Discord | Bot + OAuth | ✅ Live |
| 14 | 1ime1 | Static + CF Pages | ✅ Live |
