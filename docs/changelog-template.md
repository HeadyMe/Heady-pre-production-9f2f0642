# Changelog

All notable changes to HeadySystems are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)  
φ-revision: 1.618  

---

<!-- ─────────────────────────────────────────────────────────────────
  CHANGELOG FORMAT GUIDE
  ────────────────────────────────────────────────────────────────────
  Each version entry MUST follow this structure.
  Entries are listed in reverse chronological order (newest first).

  Change categories:
    Added        — New features
    Changed      — Changes to existing functionality
    Deprecated   — Features marked for removal (fib(13)=233 day sunset)
    Removed      — Features removed in this release
    Fixed        — Bug fixes
    Security     — Security vulnerability patches
    Performance  — Performance improvements
    API [BREAKING] — Breaking API changes (increment MAJOR version)

  φ-labels:
    [CSL]        — Changes to CSL logic or thresholds
    [φ]          — Changes to Fibonacci/golden-ratio scaling
    [AGENT]      — Agent/orchestration changes
    [MCP]        — Model Context Protocol changes
    [MEMORY]     — Vector memory changes
    [BILLING]    — Billing/subscription changes
    [API]        — API changes (public-facing)
    [INFRA]      — Infrastructure/deployment changes
    [SECURITY]   — Security changes
    [PERF]       — Performance changes
  ──────────────────────────────────────────────────────────────────── -->

## [Unreleased]

### Added
<!-- New features that will be in the next release -->
- 

### Changed
<!-- Non-breaking changes to existing behavior -->
- 

### Fixed
<!-- Bug fixes -->
- 

---

## [3.2.2] — 2026-03-07

### Added
- [MCP] WebSocket scaling with Redis-backed sticky sessions and fib(16)=987 connection limit per instance
- [INFRA] Multi-layer cache (L1: fib(16)=987 entries / L2: fib(20)=6765 entries / L3: Cloudflare CDN)
- [INFRA] Blue-green deployment script with φ-scaled traffic rollout (5%→13%→55%→100%)
- [INFRA] Canary deployment with fib(8)=21 minute analysis window and 1/φ success threshold
- [AGENT] Priority task queue with Fibonacci-scaled priorities (1,1,2,3,5,8,13,21)
- [PERF] Profiling toolkit: CPU flame graphs, heap snapshots at CSL CRITICAL (0.854), event loop lag alerts at >fib(8)=21ms
- [CSL] Graceful shutdown with LIFO stage ordering and fib(8)=21s grace period
- [BILLING] Revenue metrics: MRR, ARR, LTV, CAC, LTV:CAC (threshold: φ), NRR (target: 115%)
- [API] Analytics ingestion pipeline: batch size fib(12)=144, flush interval fib(10)=55s
- [INFRA] A/B testing framework with φ-weighted allocation (61.8% control / 38.2% variant)
- [INFRA] Feature flag system with Fibonacci rollout steps: 1→2→3→5→8→13→21→34→55→89→100

### Changed
- [φ] All numeric constants validated against Fibonacci/φ derivation — zero magic numbers remaining
- [CSL] Pressure levels unified: NOMINAL(0–0.382), ELEVATED(0.382–0.618), HIGH(0.618–0.854), CRITICAL(0.854+)
- [INFRA] HPA scale-up stabilization reduced from 15s to fib(5)=5s for faster response
- [INFRA] HPA scale-down stabilization updated to fib(9)=34s

### Fixed
- [MEMORY] Vector memory search returning stale results after namespace deletion
- [MCP] Tool call timeout not respected when upstream API hangs
- [AGENT] Agent not emitting `task.completed` event on partial success

### Security
- [SECURITY] JWT capability bitmask validation tightened — scope overflow attack vector closed
- [SECURITY] Audit log SHA-256 chain integrity verification added

---

## [3.2.1] — 2026-02-13

### Fixed
- [AGENT] Race condition in conductor when fib(8)=21+ agents complete simultaneously
- [API] Rate limit headers missing on 429 responses
- [MCP] `web_search` tool returning HTML instead of parsed JSON for certain domains

### Security
- [SECURITY] Updated `express` to 4.21.2 (CVE-2024-XXXX)
- [SECURITY] Updated `jose` to 5.9.6 (security patch)

---

## [3.2.0] — 2026-01-21

### Added
- [AGENT] Multi-region active-active deployment (us-central1, europe-west1, asia-east1)
- [MEMORY] Conflict resolution with last-write-wins + vector clock for cross-region consistency
- [API] `POST /api/v1/agents/batch` — create up to fib(7)=13 agents in a single request
- [CSL] CSL gates available in SDK: `CSLGate.and()`, `CSLGate.or()`, `CSLGate.not()`
- [MCP] New MCP tool: `agent_delegate` — orchestrate sub-agents from within tasks

### Changed
- [API] [BREAKING] `GET /api/v1/tasks` now returns paginated results (page size: fib(9)=34)
  - Migration: add `?page=1&limit=34` to existing calls
- [φ] Cache TTL updated to φ^5=11.09s (L1) and φ^8=46.98s (L2) for better hit rates

### Deprecated
- [API] `POST /api/v1/agents/create` — deprecated in favor of `POST /api/v1/agents` (sunset: 2026-09-11, fib(13)=233 days)

### Performance
- [PERF] Agent memory search latency reduced by 38.2% (1/φ² improvement) via index optimization
- [PERF] Task queue throughput increased to fib(11)=89 tasks/second per orchestration instance

---

## [3.1.0] — 2025-12-08

### Added
- [AGENT] VSA (Vector Symbolic Architecture) integration in heady-brain
- [CSL] Continuous Semantic Logic framework in `@headysystems/semantic-logic`
- [MCP] MCP server supporting fib(8)=21 concurrent tool contexts
- [API] Streaming task responses via WebSocket

### Changed
- [INFRA] Migrated from AWS ECS to Google Cloud Run
- [BILLING] Pricing tiers updated: Free/Pro(fib(10)=55)/Enterprise

---

<!-- LINK REFERENCES — add new version links at the bottom -->
[Unreleased]: https://github.com/headysystems/heady-systems/compare/v3.2.2...HEAD
[3.2.2]: https://github.com/headysystems/heady-systems/compare/v3.2.1...v3.2.2
[3.2.1]: https://github.com/headysystems/heady-systems/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/headysystems/heady-systems/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/headysystems/heady-systems/releases/tag/v3.1.0
