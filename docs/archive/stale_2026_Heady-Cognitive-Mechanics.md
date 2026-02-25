<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady AI — Cognitive Mechanics

> Last updated: February 2026

## Overview

Heady AI operates on a **federated liquid routing** architecture. Unlike monolithic AI systems that funnel all requests through a single model, Heady decomposes intelligence into 20 specialized nodes that compete, collaborate, and self-heal across an edge-native mesh.

## The Three Routing Layers

### Layer 1: Task Router

Every incoming request is classified by **action type** and mapped to one of 19 service groups:

| Service Group | Actions | Weight |
|--------------|---------|--------|
| reasoning | chat, complete, analyze, refactor | 1.0 |
| coding | code, refactor_logic, pr_review | 0.95 |
| intelligence | meta, logic, brain | 0.9 |
| sims | simulate, predict, monte_carlo | 0.85 |
| embedding | embed, store | 0.8 |
| swarm | forage, hive, swarm_nudge | 0.8 |
| search | search, query | 0.75 |
| battle | validate, arena | 0.7 |
| creative | generate, remix | 0.6 |
| vision | scan, detect, ocr | 0.5 |
| governance | audit, policy, compliance | 0.4 |
| ops | health, deploy, status | 0.3 |

Weights influence load balancing and scaling priority.

### Layer 2: Vector Zone Router

For queries with semantic content, the conductor computes a **3D spatial zone** to optimize locality:

| Zone ID | Coordinate | Triggers |
|---------|-----------|----------|
| z-security | [0.8, -0.2, 0.5] | security, pqc, auth, encrypt |
| z-frontend | [-0.6, 0.9, 0.1] | react, ui, css, frontend |
| z-ops | [0.3, 0.3, -0.8] | deploy, docker, cloud, infra |
| z-commerce | [-0.1, -0.7, 0.6] | billing, stripe, payment |
| z-general | [0, 0, 0] | fallback |

This enables **zone-aware routing** — queries about security hit security-specialized nodes, UI queries hit frontend-specialized nodes.

### Layer 3: Pattern Engine

Known optimization paths are applied automatically:

| Pattern | Strategy | Cache | Priority |
|---------|----------|-------|----------|
| chat | stream-first | No | High |
| analyze | batch-friendly | Yes | Medium |
| embed | cache-embeddings | Yes | Low |
| search | zone-first | Yes | High |
| complete | context-window | No | Medium |
| refactor | diff-only | No | Low |
| generate | parallel-variants | No | Medium |
| validate | deterministic | Yes | High |
| simulate | monte-carlo | No | High |

## Arena Mode

When a task is classified as `battle` or explicitly invoked via Arena Mode:

1. **All 20 AI nodes** receive the same prompt simultaneously
2. Each node produces an independent response
3. Responses are scored on: correctness, latency, creativity, and code quality
4. The **winning response** is returned to the user
5. Node rankings are updated in the **leaderboard**

This creates a competitive pressure that continuously surfaces the best reasoning path for each task type.

## HCFP Auto-Success Pipeline

The Heady Core Functionality Platform (HCFP) runs a 9-stage pipeline:

1. **Channel Entry** — Request ingestion and classification
2. **Ingest** — Payload validation and normalization
3. **Plan** — Monte Carlo readiness simulation
4. **Execute** — Bounded parallelism (max 6 concurrent tasks)
5. **Recover** — Compensation hooks + circuit breakers
6. **Self-Critique** — Output quality assessment
7. **Optimize** — Performance tuning
8. **Finalize** — Result packaging and delivery
9. **Monitor** — Feedback loop and drift detection

## Memory Architecture

### DuckDB Vector Memory V2

Production-grade local vector database:

- **Table:** `conversation_vectors` (id, ts, role, content, embedding, token_count, session_id, metadata)
- **Index:** HNSW (M=16, ef_construction=200)
- **Search:** `list_cosine_similarity()` with fallback to recency-based retrieval
- **Capacity:** 10,000+ conversation turns per session

### Knowledge Vault

Structured knowledge store synced with Notion:

- 11 organized notebook pages
- Bi-directional sync with incremental cursors
- Embedding-based semantic search

## Defense-in-Depth Security

Every request passes through 4 defense layers before reaching any AI node:

1. **Rate Limiter** — Redis sliding-window (120 req/min for Pro, auto-ban on violation)
2. **PQC Handshake** — ML-KEM key encapsulation + ML-DSA signatures
3. **mTLS** — Mutual TLS for all inter-service mesh communications
4. **IP Classification** — Trade secret tiering (PUBLIC → INTERNAL → PROPRIETARY → RESTRICTED)

## The 20 AI Nodes

| Node | Specialization |
|------|---------------|
| HeadyBrain | Primary reasoning engine |
| HeadyReasoner | Deep analytical tasks |
| HeadyCoder | Full-stack code generation |
| HeadyVinci | Predictive caching & pattern recognition |
| HeadyLens | Computer vision & image analysis |
| HeadySentinel | PQC security compliance |
| HeadyArchitect | Systems design |
| HeadyAnalyst | Data telemetry |
| HeadyValidator | Quality assurance |
| HeadyOps | Infrastructure operations |
| HeadyScribe | Documentation generation |
| HeadyDesigner | UI/UX design |
| HeadyGrowth | Marketing & growth strategy |
| HeadyPrime | Orchestrator / supervisor |
| HeadyBuddy | Personal AI companion |
| HeadyEdge | Edge-native inference |
| HeadyMultimodal | Cross-modal (vision, audio, text) |
| HeadyCreative | Generative art & content |
| HeadyCompliance | Legal & regulatory |
| HeadySwarm | Distributed hive intelligence |
