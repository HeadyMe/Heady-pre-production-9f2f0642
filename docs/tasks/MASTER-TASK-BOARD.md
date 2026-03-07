# Heady™ Master Task Board — Infrastructure Hardening

> All tasks: Start NOW | Priority: IMMEDIATE
> Goal: >80% readiness via public pilot + 100% test coverage on core orchestration

---

## Critical Path Tasks

### CP-01: Security Hardening (Module 02)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| SEC-01 | Run BFG repo cleaner on monorepo | Terminal / Git | ⬜ TODO |
| SEC-02 | Rotate all secrets (JWT, DB, Redis, API) | `02-infrastructure-hardening/scripts/secret-rotation-immediate.sh` | ⬜ TODO |
| SEC-03 | Harden .gitignore | `.gitignore` at monorepo root | ⬜ TODO |
| SEC-04 | Add coverage gate to CI | `02-infrastructure-hardening/configs/ci-security-gates.yml` | ⬜ TODO |
| SEC-05 | Add lockfile integrity check | `02-infrastructure-hardening/configs/ci-security-gates.yml` | ⬜ TODO |
| SEC-06 | Add SBOM generation | `02-infrastructure-hardening/configs/ci-security-gates.yml` | ⬜ TODO |
| SEC-07 | Add integration test stage to CI | `02-infrastructure-hardening/configs/ci-security-gates.yml` | ⬜ TODO |
| SEC-08 | Deploy Helmet security headers | `src/middleware/security-headers.js` | ⬜ TODO |
| SEC-09 | Deploy hardened rate limiter | `src/resilience/rate-limiter-hardened.js` | ⬜ TODO |
| SEC-10 | Deploy env validator | `src/security/env-validator-hardened.js` | ⬜ TODO |
| SEC-11 | Deploy secret rotation scheduler | `src/security/rotation-scheduler.js` | ⬜ TODO |
| SEC-12 | Define SLO framework | `configs/slo-definitions.yaml` | ⬜ TODO |
| SEC-13 | Add canary deployment workflow | `02-infrastructure-hardening/configs/canary-deploy.yml` | ⬜ TODO |
| SEC-14 | Add load testing to CI | k6 baseline script | ⬜ TODO |
| SEC-15 | Verify all health endpoints | `/health/live`, `/health/ready`, `/health/startup` | ⬜ TODO |

### CP-02: Test Coverage (Module 07)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| TEST-01 | Drop jest.config.js with 100% core thresholds | `07-test-coverage-plan/jest.config.js` → monorepo root | ⬜ TODO |
| TEST-02 | Write HeadyConductor v2 unit tests | `tests/unit/heady-conductor-v2.test.js` | ⬜ TODO |
| TEST-03 | Write HCFullPipeline v2 unit tests | `tests/unit/hc-full-pipeline-v2.test.js` | ⬜ TODO |
| TEST-04 | Write SwarmConsensus v2 unit tests | `tests/unit/swarm-consensus-v2.test.js` | ⬜ TODO |
| TEST-05 | Write MonteCarloOptimizer unit tests | `tests/unit/monte-carlo-optimizer.test.js` | ⬜ TODO |
| TEST-06 | Write TaskDecomposition unit tests | `tests/unit/task-decomposition-engine.test.js` | ⬜ TODO |
| TEST-07 | Write SemanticBackpressure unit tests | `tests/unit/semantic-backpressure.test.js` | ⬜ TODO |
| TEST-08 | Write ContextWindowManager unit tests | `tests/unit/context-window-manager.test.js` | ⬜ TODO |
| TEST-09 | Write RedisPool unit tests | `tests/unit/redis-pool.test.js` | ⬜ TODO |
| TEST-10 | Write Security module unit tests | `tests/unit/security-*.test.js` (3 files) | ⬜ TODO |
| TEST-11 | Write Pipeline integration tests | `tests/integration/full-pipeline.test.js` | ⬜ TODO |
| TEST-12 | Write Swarm integration tests | `tests/integration/swarm-coordination.test.js` | ⬜ TODO |
| TEST-13 | Write Security integration tests | `tests/integration/security-flow.test.js` | ⬜ TODO |
| TEST-14 | Write E2E grant-writing test | `tests/e2e/grant-writing.test.js` | ⬜ TODO |
| TEST-15 | Verify 80% global + 100% core coverage passes | CI pipeline | ⬜ TODO |

### CP-03: Redis Pooling (Module 05)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| RED-01 | Install ioredis dependency | `npm install ioredis` | ⬜ TODO |
| RED-02 | Deploy RedisPoolManager v3 | `src/resilience/redis-pool-v3.js` | ⬜ TODO |
| RED-03 | Wire agentHandoff() to HeadyConductor | `src/orchestration/heady-conductor-v2.js` | ⬜ TODO |
| RED-04 | Add pool metrics to health endpoint | `/health` response | ⬜ TODO |
| RED-05 | Write Redis pool load test | `tests/load/redis-handoff-k6.js` | ⬜ TODO |
| RED-06 | Validate p95 handoff < 50ms | Load test results | ⬜ TODO |

### CP-04: Public Pilot (Module 03)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| PIL-01 | Create pilot database schema (pgvector) | `03-public-pilot-phase/pilot-env-setup.sh` | ⬜ TODO |
| PIL-02 | Deploy pilot Cloud Run service | Cloud Run Console / CLI | ⬜ TODO |
| PIL-03 | Configure Cloudflare DNS (pilot.headyme.com) | Cloudflare Dashboard | ⬜ TODO |
| PIL-04 | Deploy pilot MCP tool subset | `configs/pilot-mcp-tools.json` | ⬜ TODO |
| PIL-05 | Deploy pilot telemetry collection | Telemetry service | ⬜ TODO |
| PIL-06 | Onboard 3-5 non-profit partners | HeadyConnection outreach | ⬜ TODO |
| PIL-07 | Run pilot for 4 weeks | Monitoring + weekly calls | ⬜ TODO |
| PIL-08 | Generate pilot assessment report | Metrics analysis | ⬜ TODO |

---

## Feature Tasks

### FT-01: Logic Visualizer (Module 04)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| VIZ-01 | Create visualizer API service | `src/visualizer/visualizer-api.js` | ⬜ TODO |
| VIZ-02 | Create conductor instrumentation hook | `src/visualizer/conductor-hook.js` | ⬜ TODO |
| VIZ-03 | Create dashboard SPA | `src/visualizer/dashboard.html` | ⬜ TODO |
| VIZ-04 | Wire visualizer to HeadyConductor init | Conductor startup code | ⬜ TODO |
| VIZ-05 | Add VIZ_ENABLED env toggle | Config / env | ⬜ TODO |
| VIZ-06 | Write visualizer tests | `tests/unit/visualizer-api.test.js` | ⬜ TODO |

### FT-02: create-heady-agent CLI (Module 06)

| Task ID | Task | File/Location | Status |
|---------|------|---------------|--------|
| CLI-01 | Finalize CLI source | `06-create-heady-agent-cli/src/cli.js` | ⬜ TODO |
| CLI-02 | Write CLI tests | `06-create-heady-agent-cli/tests/` | ⬜ TODO |
| CLI-03 | Create all 6 templates | Template code in CLI | ⬜ TODO |
| CLI-04 | Publish to npm as create-heady-agent | `npm publish` | ⬜ TODO |
| CLI-05 | Document at headyio.com/docs/create-agent | heady-docs repo | ⬜ TODO |

---

## Dependency Graph

```
SEC-01..SEC-15 (Security) ───┐
                              ├──→ PIL-01..PIL-08 (Public Pilot)
TEST-01..TEST-15 (Coverage) ──┘
                              
RED-01..RED-06 (Redis) ──────────→ PIL-01 (Pilot needs fast handoffs)

VIZ-01..VIZ-06 (Visualizer) ────→ PIL-05 (Pilot telemetry dashboard)

CLI-01..CLI-05 (CLI) ───────────→ Community Launch (post-pilot)
```

---

## Summary

| Category | Total Tasks | Critical | Files Provided |
|----------|------------|----------|----------------|
| Security Hardening | 15 | 15 | 5 |
| Test Coverage | 15 | 15 | 2 |
| Redis Pooling | 6 | 6 | 2 |
| Public Pilot | 8 | 8 | 3 |
| Logic Visualizer | 6 | 4 | 4 |
| CLI Scaffold | 5 | 2 | 3 |
| **TOTAL** | **55** | **50** | **19** |

---

## Valuation Impact (per Q1 2026 Assessment)

| Completed Module | Valuation Impact |
|-----------------|-----------------|
| Security Hardening | +$1M (eliminates deal-breaker risk) |
| Test Coverage | +$2M (enterprise-grade quality signal) |
| Structural Refactoring | +$2M (licensable software) |
| Multi-Tenancy (future) | +$5M (SaaS scalability) |
| **Total achievable now** | **+$3M–$5M** |
| **Target NAV** | **$7M–$9M** (from current $4.2M) |
