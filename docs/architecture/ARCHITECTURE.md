<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
-->
# Heady AI Platform — Architecture

> Last updated: February 2026  
> Consolidated canonical architecture reference.

## System Overview

Heady is an autonomous multi-agent AI operating system that federates 20 AI intelligence nodes through a liquid routing conductor, secured by post-quantum cryptography.

## Layer Architecture

### 1. Edge Layer (Cloudflare)

- **Workers AI** — Sub-50ms inference for lightweight tasks
- **Vectorize** — Edge-native vector search
- **KV** — Global key-value session cache
- **Tunnels** — Encrypted ingress to bare-metal conductor

### 2. Conductor Layer (HeadyConductor)

The federated liquid router that dispatches all requests:

- **Task Router** — Routes actions to service groups by type
- **Zone Router** — Assigns 3D vector coordinates for semantic locality
- **Pattern Engine** — Applies streaming, caching, and priority strategies
- **Supervisor Ring** — Distributed consensus for fault tolerance

### 3. Intelligence Layer (20 AI Nodes)

| Node | Function |
|------|----------|
| HeadyBrain | Core reasoning engine |
| HeadyBattle | Arena mode — multi-node competition |
| HeadyCoder | Code generation & orchestration |
| HeadyCopilot | Inline code suggestions |
| HeadyCodex | Code transformation & documentation |
| HeadyVinci | Pattern recognition & prediction |
| HeadySoul | Consciousness & learning layer |
| HeadyLens | Visual analysis & GPU vision |
| HeadyJules | Async background coding agent |
| HeadyPythia | Deep reasoning & analytics |
| HeadyGroq | Ultra-fast inference |
| HeadyGemini | Multimodal AI generation |
| HeadyClaude | Advanced reasoning (thinking mode) |
| HeadyOpenAI | Chat & function calling |
| HeadyEdge | Edge-native Cloudflare inference |
| HeadyPerplexity | Real-time web research |
| HeadyHuggingFace | Model search & inference |
| HeadyOrchestrator | Trinity communication |
| HeadySwarm | Task delegation & swarm orchestrator |
| HeadyBees | Headless browser task completion fleet |

### 4. Swarm Layer (HeadySwarm + HeadyBees)

HeadyBuddy acts as Swarm Commander, orchestrating HeadyBees — headless browser agents that execute workflows autonomously:

- Form filling, data extraction, multi-step web tasks
- Delegated from HeadyBuddy via natural language
- Fleet scaling based on task complexity and priority

### 5. Memory Layer (DuckDB V2)

- HNSW vector index for fast similarity search
- Cosine similarity scoring
- Session memory with temporal indexing
- Knowledge vault with hybrid lexical + vector retrieval

### 6. Security Layer

- **Post-Quantum Crypto** — ML-KEM (key encapsulation) + ML-DSA (digital signatures)
- **Mutual TLS** — PQC-signed certificates for all mesh traffic
- **Rate Limiting** — Redis sliding-window with auto-ban
- **Secret Rotation** — 24-hour automated key rotation
- **IP Classification** — Trade secret tiering (CONFIDENTIAL / SECRET / TOP SECRET)
- **Code Obfuscation** — V8 Bytecode + AST mangling for production

## Service Groups

The Conductor organizes capabilities into weighted groups:

| Group | Weight | Purpose |
|-------|--------|---------|
| reasoning | 1.0 | Chat, analysis, refactoring |
| coding | 0.95 | Code generation, PR review |
| intelligence | 0.9 | Meta-reasoning, logic |
| sims | 0.85 | Simulation, prediction |
| embedding | 0.8 | Vector storage |
| swarm | 0.8 | HeadyBees task dispatch |
| search | 0.75 | Knowledge retrieval |
| battle | 0.7 | Validation, arena mode |
| creative | 0.6 | Content generation |
| vision | 0.5 | Image analysis, OCR |
| governance | 0.4 | Audit, compliance |
| ops | 0.3 | Health, deployment |

## Port Map

| Port | Service |
|------|---------|
| 3300 | HeadyConductor / Manager |
| 4800 | HeadyBuddy |
| 5001 | HeadyOS Admin UI (dev) |
| 8080 | Edge Proxy (dev) |

## Domain Architecture

| Domain | Purpose |
|--------|---------|
| headysystems.com | Commercial hub |
| headyme.com | Personal AI portal |
| headyio.com | Developer ecosystem |
| headyapi.com | API reference |
| headymcp.com | MCP tooling |
| headyconnection.org | Nonprofit |
| headybuddy.org | Peer support |
| headyos.com | OS dashboard |
