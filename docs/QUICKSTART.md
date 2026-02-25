<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 🚀 Heady AI Platform — Quick Start Guide

> Last updated: February 2026

## Prerequisites

- Node.js 20+
- npm 10+
- Redis (for rate limiting and caching)
- DuckDB (auto-installed via `npm install`)

## 1. Clone & Install

```bash
git clone https://github.com/headysystems/Heady.git
cd Heady
npm install
```

## 2. Environment Setup

```bash
cp .env.example .env
```

Required secrets (managed via PQC-rotated vault):

- `HEADY_BRAIN_KEY` — HeadyBrain API master key
- `REDIS_URL` — Redis connection string
- `STRIPE_SECRET_KEY` — Stripe billing integration

Optional:

- `HEADY_MEMORY_DB` — Path to DuckDB vector store (default: `~/.headyme/heady-brain-v2.duckdb`)
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated)

## 3. Start HeadyConductor

```bash
node src/heady-conductor.js
```

You should see:

```
🛡️ [Conductor] PQC Quantum-Resistant Hybrid Signatures ACTIVE for all mesh RPCs.
🛡️ [Conductor] Redis Sliding-Window Rate Limiter Armed.
  ∞ HeadyConductor: LOADED (federated liquid routing)
    → Endpoints: /api/conductor/status, /route-map, /health, /analyze-route
    → Layers: taskRouter, patternEngine
```

## 4. Verify Health

```bash
curl https://api.headysystems.com/api/conductor/health
```

Response:

```json
{
  "ok": true,
  "uptime": 12345,
  "totalRoutes": 0,
  "layers": { "taskRouter": true, "vectorZone": false, "brainRouter": false, "patternEngine": true },
  "supervisors": 0
}
```

## 5. Chat with HeadyBrain

```bash
curl -X POST https://api.headysystems.com/api/brain/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello Heady!"}'
```

HeadyBrain uses the **Liquid Gateway** — an intelligent auto-routing layer that selects the optimal intelligence engine for each request:

- **HeadyBrain Core** — Primary reasoning engine
- **HeadyReasoner** — Deep analytical tasks
- **HeadyMultimodal** — Vision, audio, and cross-modal inference
- **HeadyEdge** — Sub-50ms edge-native inference via Cloudflare Workers AI

## 6. Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/conductor/health` | System health + layer status |
| `GET /api/conductor/status` | Full routing telemetry |
| `GET /api/conductor/route-map` | Service group topology |
| `POST /api/conductor/analyze-route` | Test a hypothetical route |
| `POST /api/brain/chat` | AI chat (Liquid Gateway) |
| `POST /api/brain/analyze` | Code/text analysis |
| `POST /api/brain/embed` | Vector embeddings |
| `POST /api/brain/search` | Knowledge search |
| `POST /api/swarm/dispatch` | Deploy HeadyBees for task completion |

## 7. Admin UI

The HeadyOS Admin Canvas provides a premium glassmorphism dashboard for managing the entire fleet:

```bash
cd sites/headyos-react
npm install
npm run dev
```

Access via `https://admin.headysystems.com` when deployed, or the local Vite dev server during development. Includes Command Center, Fleet Manager, Package Builder, Security Panel, Billing Config, and Network Topology views.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│            HeadyBuddy Overlay                    │
│  (Browser Extension • Chrome Tab • Mobile)       │
├──────────────────────────────────────────────────┤
│         Cloudflare Edge Proxy Layer              │
│  Workers AI  •  Vectorize  •  KV Cache           │
├──────────────────────────────────────────────────┤
│         HeadyConductor (Federated Liquid Router)  │
│  Task Routing • Zone Routing • Pattern Engine     │
├──────────────────────────────────────────────────┤
│         HeadyBrain + 20 AI Nodes                 │
│  Arena Mode • Liquid Gateway • Auto-Success       │
├──────────────────────────────────────────────────┤
│         HeadySwarm + HeadyBees                   │
│  Headless Browser Fleet • Task Completion Engine  │
├──────────────────────────────────────────────────┤
│         DuckDB Vector Memory V2                  │
│  HNSW Index • Cosine Similarity • Session Memory  │
├──────────────────────────────────────────────────┤
│         Security Layer                           │
│  PQC (ML-KEM + ML-DSA) • mTLS • Rate Limiter    │
└──────────────────────────────────────────────────┘
```

## Live Properties

| Property | URL |
|----------|-----|
| HeadySystems | <https://headysystems.com> |
| HeadyMe | <https://headyme.com> |
| HeadyIO | <https://headyio.com> |
| HeadyAPI | <https://headyapi.com> |
| HeadyMCP | <https://headymcp.com> |
| HeadyConnection | <https://headyconnection.org> |
| HeadyBuddy | <https://headybuddy.org> |
| HeadyOS | <https://headyos.com> |
