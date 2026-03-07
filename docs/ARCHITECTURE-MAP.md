# Heady™ Architecture Map

> Source: Deep scan of HeadyMe/Heady-pre-production-9f2f0642 (v3.1.0)

---

## System Topology

```
                    ┌─────────────────────────────────────┐
                    │         CLIENTS / CONSUMERS          │
                    │  IDE (Windsurf/Antigravity)          │
                    │  HeadyBuddy Chrome Extension         │
                    │  Admin Dashboard SPA                 │
                    │  3rd-Party MCP Clients               │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     CLOUDFLARE EDGE LAYER             │
                    │  heady-edge-node (Workers)            │
                    │  12+ domain routing                   │
                    │  DDoS / WAF / SSL termination         │
                    │  Edge AI inference (Workers AI)       │
                    └──────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼────────┐ ┌────────▼────────┐ ┌─────────▼────────┐
    │  PROJECTION PLANE │ │  BUILDER PLANE  │ │ ORCHESTRATION     │
    │  liquid-deploy.js │ │  Battle Arena   │ │ PLANE             │
    │  Dynamic UI gen   │ │  JSON ASTs      │ │ HeadyConductor    │
    │  Template repos   │ │  Code gen       │ │ :3848             │
    └─────────┬────────┘ └────────┬────────┘ └─────────┬────────┘
              │                    │                     │
              └────────────────────┼────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     GOOGLE CLOUD RUN                  │
                    │  heady-manager (API Gateway)          │
                    │  MCP Bridge (30+ tools)               │
                    │  Background task execution            │
                    └──────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼────────┐ ┌────────▼────────┐ ┌─────────▼────────┐
    │  INTELLIGENCE     │ │  MEMORY LAYER   │ │ PERSISTENCE       │
    │  Multi-model      │ │  pgvector/Neon  │ │ PostgreSQL        │
    │  Claude/GPT/      │ │  384D → 3D PCA  │ │ Audit trails      │
    │  Gemini/Groq      │ │  8-octant zones │ │ Config store      │
    │  Ternary logic    │ │  Fibonacci shard│ │ Projection hist   │
    └──────────────────┘ └─────────────────┘ └──────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     COLAB GPU CLUSTER (3 Nodes)       │
                    │  Overmind: Cognitive orchestration     │
                    │  Forge:    Code gen + Battle Arena     │
                    │  Edge:     Embeddings + vector ops     │
                    │  Connected via Tailscale mesh VPN      │
                    │  Redis for inter-node messaging        │
                    └─────────────────────────────────────┘
```

---

## Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| HeadyConductor | 3848 | HTTP/SSE |
| Projection Service | 3849 | HTTP/SSE |
| Dashboard | 3850 | HTTP |
| HeadyManager (legacy) | 3300 | HTTP |
| Redis | 6379 | Redis |
| PostgreSQL | 5432 | TCP |

---

## Data Flow: Task Execution

```
Client Request
    │
    ▼
Cloudflare Edge Worker (routing + auth check)
    │
    ▼
HeadyConductor (:3848)
    ├── Task Decomposition Engine
    │     └── CSL scoring against 17-swarm capabilities
    ├── Skill Router (match task → agent by capability tags)
    ├── Monte Carlo Optimizer (UCB1 plan selection)
    │
    ▼
Swarm Assignment
    ├── HeadyBee Factory (spawn task-specific workers)
    ├── Semantic Backpressure (load shedding if overloaded)
    ├── Circuit Breaker (fail-fast on degraded services)
    │
    ▼
Agent Execution (JULES / BUILDER / OBSERVER / ATLAS / PYTHIA)
    ├── Vector Memory read/write (384D embeddings)
    ├── Multi-model inference (routed by LLM Router)
    ├── Self-Awareness loop (coherence check)
    │
    ▼
Result Aggregation
    ├── Swarm Consensus (decentralized agreement)
    ├── HeadyCheck / HeadyAssure (two-key validation)
    ├── Projection Update (SSE broadcast)
    │
    ▼
Client Response (streamed via SSE or HTTP)
```

---

## PHI-Scaled Timing Constants

All system timing derives from φ (1.6180339887):

| Component | Interval | Formula |
|-----------|----------|---------|
| Vector memory bee | ~8,090ms | 5000 × φ¹ |
| Health bee | ~6,180ms | φ⁶ × 1000 |
| Config bee | 10,000ms | fixed |
| Telemetry bee | 4,000ms | fixed |
| Topology bee | 15,000ms | fixed |
| Task queue bee | 5,000ms | fixed |
| SSE heartbeat | ~10,000ms | fixed |
| Circuit breaker recovery | ~16,180ms | φ⁵ × 10000 |
| PHI backoff sequence | 809ms → 1309ms → 2118ms → 3427ms → 5545ms → ... | base × φⁿ |

---

## Fibonacci Resource Allocation

| Pool | Allocation | Purpose |
|------|-----------|---------|
| Hot | 34% | User-facing, latency-critical |
| Warm | 21% | Background processing |
| Cold | 13% | Ingestion, analytics |
| Reserve | 8% | Burst capacity |
| Governance | 5% | Quality gates, audit |
