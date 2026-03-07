# Changelog

All notable changes to the Heady Sovereign AI Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-03-06

### Added

- **OTel Tracing** (`src/lib/telemetry.js`) — AI-specific metrics: token counters, request latency histograms, eval scores, tool call tracking
- **Graceful Shutdown** (`src/lib/shutdown.js`) — Ordered hook execution with SIGTERM/SIGINT handling and timeout safety
- **Feature Flags** (`src/lib/feature-flags.js`) — Deterministic hash-based rollout with env overrides for agent routing
- **API Key Rotation** (`src/lib/key-rotation.js`) — Automated rotation with dual-key validation and status reporting
- **Eval Pipeline** (`src/lib/eval-pipeline.js`) — LLM-as-judge framework with relevance, faithfulness, safety, and trajectory judges
- **Prompt Guard** (`src/lib/prompt-guard.js`) — 5-layer prompt injection defense (validation, isolation, RAG triad, monitoring, HITL)
- **Circuit Breaker** (`src/lib/circuit-breaker.js`) — 3-state circuit breaker + token bucket rate limiter with Express middleware
- **Worker Pool** (`src/lib/worker-pool.js`) — Worker thread pool for CPU-bound embedding generation
- **Graph Orchestrator** (`src/lib/graph-orchestrator.js`) — LangGraph-equivalent agent orchestration with conditional edges
- **Multi-Cloud Failover** (`src/lib/failover.js`) — GCP→AWS automatic failover with health-check recovery
- **SSO + RBAC** (`src/middleware/auth-rbac.js`) — Tenant-scoped role-based access control
- **Audit Logging** (`src/middleware/audit-log.js`) — Immutable SHA-256 hash chain for GDPR Art. 30
- **MCP Gateway Auth** (`src/middleware/mcp-auth.js`) — SSO-integrated MCP authentication with scope validation
- **Swarm Dashboard** (`src/services/swarm-dashboard.js`) — Monte Carlo exploration tracking and convergence analysis
- **HNSW Migration** (`migrations/003-hnsw-index.sql`) — pgvector HNSW index with multi-tenant RLS
- **OTel Config** (`configs/observability/otel-config.yml`) — AI-specific metrics, SLOs, and alerting rules
- **Canary Config** (`configs/canary.yml`) — Progressive rollout (1% → 5% → 20% → 100%)
- **Compliance Bundles** (`configs/compliance/bundles.yml`) — HIPAA, GDPR, SOX, SOC 2 templates
- **PgBouncer Config** (`configs/infrastructure/pgbouncer.ini`) — Transaction-mode pooling for pgvector
- **Production Deployment Guide** (`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`) — Complete 1300-line deployment procedures
- **Production Suite** — Auth modules, monitoring (drift/health), onboarding flows, CI/CD workflows
- **Cloudflare Worker** (`cloudflare/worker.js`) — Edge routing worker
- **CI Quality Gates** (`.github/workflows/ci.yml`) — Lint, test, security scan pipeline
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`

### Fixed

- Repository URL → `HeadyMe/Heady-pre-production-9f2f0642` (was HeadySystems)
- Author email → `eric@headyconnection.org`
- Legal entity → `HeadySystems Inc.` (was LLC)
- Version sync across README, CI, and package.json

## [3.0.1] - 2026-02-15

### Added

- Initial monorepo structure
- Basic Express server with health route
- Docker and Cloud Run deployment
- GitHub Actions CI/CD pipeline
