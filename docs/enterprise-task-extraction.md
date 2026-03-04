# Heady Enterprise Task Extraction (Current Pre-Production Snapshot)

This task set converts the architecture narrative into actionable engineering work for the HeadyMe base repositories.

## Priority 0 — Security and Repo Hygiene

- [ ] Purge any historical credentials from git history with `git filter-repo` and rotate exposed secrets.
- [ ] Enforce `.gitignore` coverage for runtime files (`*.pid`, `*.log`, `*.jsonl`, deploy logs, backups).
- [ ] Enable and gate on secret scanning + SAST in CI for every push and PR.
- [ ] Enforce mTLS + token-auth requirements for cross-device and service-to-service traffic.

## Priority 1 — Runtime Hardening

- [ ] Add request/message size guards for real-time sync channels.
- [ ] Add per-device/per-client rate limiting to prevent abuse and noisy neighbors.
- [ ] Standardize `/health/*` endpoints for all service modules.
- [ ] Add structured metrics for accepted/rejected traffic and stale-device disconnects.

## Priority 2 — CI/CD Determinism

- [ ] Consolidate duplicated build/deploy scripts into a single parameterized orchestrator.
- [ ] Keep `pnpm` as the single package manager in CI (`pnpm install`, `pnpm audit`, `pnpm test`).
- [ ] Add integration tests for swarm routing, sync handoff, and edge failure recovery.
- [ ] Add SBOM/container scanning gates before deployment.

## Priority 3 — Architecture Decomposition

- [ ] Continue splitting monolithic manager/generator files into domain modules.
- [ ] Keep strict language boundaries (`src/` JavaScript vs Python in dedicated folders).
- [ ] Move all tests to `/tests` and enforce with lint/check rules.
- [ ] Make connector and projection modules independently deployable.

## Priority 4 — Observability & Operations

- [ ] Replace any remaining unstructured logs with structured logger output.
- [ ] Add topology-aware dashboards (edge latency, swarm saturation, projection queue depth).
- [ ] Add circuit-breaker and cache-hit telemetry for edge services.
- [ ] Standardize runbooks for auto-remediation and post-incident rule synthesis.

## Priority 5 — Product / UX Projection

- [ ] Define projection contracts from 3D vector state to 2D UI schemas.
- [ ] Add deterministic tests for central vs parallel projection rendering.
- [ ] Add cross-device context delta reconciliation tests (mobile ↔ desktop).
- [ ] Add FastResponse budgets (TTI, API p95, sync RTT) and fail CI when exceeded.

## Tasks completed in this change-set

- [x] Added optional token-based authorization for sync WebSocket connections.
- [x] Added message size limits and per-device message rate limits.
- [x] Added `/api/sync/health` endpoint and rejected-message telemetry.
- [x] Added Jest coverage for sync hardening guards and route registration.
- [x] Extended continuous embedder coverage to explicitly capture user actions, analyst actions, system actions, and periodic environment snapshots via event hooks.
- [x] Added embedder health endpoint and adaptive burst batching for lower staleness under high event throughput.
- [x] Corrected projection sync query invocation to use vector-memory query signature for deterministic projection refresh.
- [x] Added unified autonomy projection cleanup planning and safe apply endpoint to remove stale local projection artifacts.
- [x] Added live context snapshot endpoint for always-available retrieval of user, analyst, system, and environment context slices.
- [x] Added cross-device persistent user/widget/workspace sync state with vector-memory ingest hooks for continuous context durability.
- [x] Added injectable template projection payload generation to map vector projections into preconfigured headybee/headyswarm templates.
- [x] Added onboarding/auth-flow validation and alternate paradigm directives endpoint in unified autonomy service.
- [x] Added autonomous optimization cycle for live context + template projection refresh with runtime endpoint for manual self-heal execution.
- [x] Added cross-device template retrieval endpoint and task widget sync alias for device interaction continuity.
- [x] Added unified autonomy self-healing cycle endpoint combining hygiene, onboarding validation, directives, and optional cleanup apply.
