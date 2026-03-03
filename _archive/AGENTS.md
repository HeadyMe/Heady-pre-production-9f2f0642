# AGENTS.md — Heady AI Agent Governance

> **Universal deterministic rule repository for all AI agents operating within the Heady ecosystem.**
> Rules in this file are enforced before any agent writes code. They replace probabilistic review with deterministic prevention.

---

## Core Directives

### Security Rules (Zero-Tolerance)

1. **No credentials in code or logs.** API keys, tokens, passwords, and connection strings must NEVER appear in source files, commit history, or log output. Use environment variables exclusively.
2. **No localhost in production.** All endpoints must use cloud-deployed URLs. Local-only patterns are forbidden in production configs.
3. **No `.bak` files in repository.** Backup files expose deprecated code paths. Remove immediately.
4. **No runtime files in version control.** Never track `server.pid`, `*.log`, `*.jsonl` audit files, or deploy logs.
5. **No `NODE_TLS_REJECT_UNAUTHORIZED=0` in production.** TLS validation must be enabled in all production environments.

### Architectural Rules

1. **Single source of truth for versioning.** The version in `package.json` is the canonical version. All other references must match.
2. **Strict language boundaries.** Python files reside in `src/python/` or dedicated directories. JavaScript files reside in `src/`. No comingling of `__init__.py` alongside `.js` modules.
3. **No God classes.** Files exceeding 1500 lines must be decomposed into domain-specific modules.
4. **Tests in `/tests/` only.** All test files must reside in the `tests/` directory. Root-level test files are forbidden.
5. **All modules expose health checks.** Every service module must register a health endpoint under `/health/` or `/api/<module>/health`.
6. **Structured logging only.** All production output must use the pino-based logger (`src/utils/logger.js`). Raw `console.log/warn/error` is forbidden in `src/routes/` and `src/orchestration/`.

### Provider Budget Rules

1. **Pre-check budget before routing.** Every provider call must pass through `checkProviderBudget()` before execution. Budget-exceeded providers are automatically excluded from routing candidates.
2. **Record every transaction.** Every AI provider call must be recorded via `provider-usage-tracker.record()` with full metadata (provider, account, model, tokens, cost, latency).
3. **Down-shift on budget exhaustion.** When a provider exceeds 80% of its monthly budget, the finops router must prefer cheaper alternatives.

### CI/CD Rules

1. **All tests must pass before merge.** Branch protection requires passing Jest suite.
2. **Dependency audit on every build.** `pnpm audit` runs as a CI gate. Block deployment on high/critical CVEs.
3. **No `|| true` in quality gates.** CI steps for ESLint, tests, audit, and build must never suppress failures.
4. **SAST on every push.** CodeQL and TruffleHog secret scanning run on every push and PR.
5. **Container scanning required.** Trivy container scan and CycloneDX SBOM generation must pass before deployment.

---

## Buddy Agent — Deterministic Optimization Protocol

> The Buddy supervisory agent is the mathematical antidote to context rot and probabilistic drift.
> Its mandate: **every error becomes permanent structural armor.**

### Foundational Axiom

Errors are not faults to be patched. They are critical optimization opportunities to extract deterministic state, isolate root causes, and permanently immunize the swarm. Once a problem is resolved, it MUST be categorically prevented from recurring.

### The 5-Phase Deterministic Optimization Loop

When **any** anomaly is detected — stack trace, test failure, logical hallucination, or unexpected output — Buddy executes this loop immediately:

#### Phase 1: Error Detection & Probabilistic Halt

**Action:** Intercept the failing thread. Halt probabilistic generation.

- Do NOT attempt conversational debugging ("fix the error" prompting is forbidden)
- Do NOT feed the error back into a degraded context window
- Freeze execution state entirely
- Acknowledge the error as a trigger for systemic hard reset, not a chat prompt

**Rationale:** Asking a degraded context to fix its own error compounds context rot. The LLM will hallucinate further flawed code from corrupted history.

#### Phase 2: Deterministic State Extraction

**Action:** Capture the objective computational reality at the point of failure.

- Abandon all conversational history and natural language context
- Extract: complete dependency graph, active call stack, memory layout, active config rules
- Compile a pure state snapshot stripped of assumptions and "vibes"
- Format as a compact, structured data block (JSON/XML) for clean injection
- Inject into a fresh, zero-context session for analysis

**Rationale:** Re-grounds the swarm in objective code reality. Eliminates probabilistic drift accumulated over long sessions.

#### Phase 3: Semantic Equivalence Analysis

**Action:** Filter environmental noise to isolate pure logic errors.

- Replay the failing call graph under controlled conditions
- Virtualize non-deterministic sources (network latency, thread scheduling, randomness)
- Use the seeded PRNG (`_createSeededRng`) to eliminate pipeline randomness
- Test for semantic equivalence across controlled execution paths
- Confirm whether the error is in code semantics vs. environmental phantom

**Rationale:** Ensures the error is perfectly reproducible and tied to logic, not environment. Moves troubleshooting from probabilistic guessing to deterministic certainty.

#### Phase 4: Root-Cause Derivation via Constraint Analysis

**Action:** Pinpoint the exact logic gate, config, or code path that failed.

- Map the control flow graph of the failed execution path
- Trace constraint violations backward through Boolean logic
- Identify the specific configuration, regex, API call, or data transform that diverged
- The failure is now a mathematically reproducible flaw, not an ambiguous anomaly
- Persist the root-cause analysis in vector memory with `type: "error_resolution"`

**Rationale:** With deterministic state, the error is a specific, traceable constraint violation — not a vague "it broke."

#### Phase 5: Upstream Rule Synthesis & Baseline Update

**Action:** Permanently immunize the system against this failure pathway.

- Synthesize a new, explicit architectural rule from the root cause
- Formulate as a **rigid constraint**, not a suggestion or hint
- Append the rule to the **Learned Rules** section below
- Update HCFullPipeline schemas if applicable
- Ingest the rule into 3D vector memory for semantic retrieval
- The rule is enforced **before** agents write code (deterministic prevention, not probabilistic review)

**Rationale:** Shifts enforcement upstream. Future agents are governed by rule lookup before writing code. The divergent path is mathematically blocked from being considered.

### Buddy Orchestration Directives

#### Real-Time Execution via Event-Driven Protocols

- Route high-velocity state changes through MIDI 2.0 UMP / WebSocket event-driven protocols
- Bypass REST polling for latency-sensitive generation flows
- Map architectural commands to System Exclusive 8 messages for instant agent coordination
- Use Mixed Data Set Messages for transferring JSON payloads between decentralized agents
- The RTP-MIDI standard provides session management and lost-packet regeneration

#### 3D Vector Memory Management (Hybrid RAG)

The vector memory system operates as a **Hybrid RAG** architecture combining:

**Vector Layer (Breadth):**

- All system knowledge, user context, and deterministic rules stored as 384-dim embeddings
- 3D PCA-lite projection into 8-octant spatial zones for locality-optimized search
- Zone-first query with automatic expansion to adjacent octants
- Sharded across 5 Fibonacci shards for parallel scan

**Graph Layer (Depth):**

- Explicit entity-relationship edges stored alongside vector embeddings
- Causal chains between errors, resolutions, and rules are traversable
- Multi-hop reasoning: "How did error X lead to rule Y which prevented issue Z?"
- Temporal awareness: relationships track creation time for version-aware retrieval

**Retrieval Strategy:**

1. Query enters → embed → project to 3D → identify octant zone
2. Zone-first vector search for semantic similarity (breadth)
3. Graph traversal from top results for relationship depth
4. Merge results: vector score × relationship proximity = final rank
5. Return enriched results with both content and relationship context

#### Provider Orchestration

- Always check `configs/provider-budgets.yaml` before routing provider calls
- Prefer spatially-proximate nodes in the Sacred Geometry lattice
- Cascade through provider tiers on failure: primary → secondary → edge fallback
- Record all provider transitions in vector memory for pattern detection

#### Self-Healing Pipeline Protocol

When HCFullPipeline detects a stage failure:

1. **Capture**: Record full stage context (inputs, config, timing, error)
2. **Analyze**: Check vector memory for similar past failures using semantic search
3. **Remediate**: If a matching resolution exists, attempt automatic retry with the learned fix
4. **Escalate**: If no resolution exists, trigger Buddy's 5-Phase Optimization Loop
5. **Persist**: Store the resolution in vector memory with `type: "pipeline_resolution"`
6. **Harden**: Synthesize a new Learned Rule if the error class is novel

---

## Learned Rules (Auto-Generated by Buddy Error Protocol)

> These rules are automatically synthesized from production errors.
> Each rule represents a permanently resolved failure pathway.

### LR-001: Edge Proxy Deploy Path (2026-02-28)

- **Error:** `deploy-edge` CI job deploying from non-existent `cloudflare-workers/` directory
- **Root Cause:** Directory path in `deploy.yml` was stale — actual source is `cloudflare/heady-edge-proxy/`
- **Rule:** Edge proxy deployments must use `workingDirectory: cloudflare/heady-edge-proxy` with `wrangler deploy` (no extra args — `wrangler.toml` has `main` defined)

### LR-002: npm Audit Lockfile Mismatch (2026-02-28)

- **Error:** `npm audit` fails with `ENOLOCK` — project uses pnpm, not npm
- **Root Cause:** CI audit step used `npm audit` but the project lockfile is `pnpm-lock.yaml`
- **Rule:** Dependency auditing must use `pnpm audit` (or `npx pnpm audit`), never `npm audit`, in this repository

### LR-003: Redis Pool Port Exhaustion Prevention (2026-02-28)

- **Error:** Potential port exhaustion under sustained swarm load from unbounded Redis connections
- **Root Cause:** `redis-pool.js` had no `connectTimeout`, no `maxRetriesPerRequest`, and no graceful shutdown
- **Rule:** Redis pool must enforce: `connectTimeout: 5000ms`, `maxRetries: 10`, capped backoff (`Math.min(retries * 100, 3000)`), and register `close()` with graceful shutdown lifecycle

### LR-004: Console.log in Production Routes (2026-03-01)

- **Error:** Unstructured log output in `src/routes/` disrupting JSON log aggregation in Cloud Run
- **Root Cause:** 23 `console.log/warn/error` calls across 9 route files bypassing the pino logger
- **Rule:** All log output in `src/routes/` and `src/orchestration/` must use `require('../utils/logger')` methods. Raw `console.*` calls are forbidden in these paths.

### LR-005: Host Header Loop in Edge Proxy (2026-03-01)

- **Error:** 503 Service Unavailable on `manager.headysystems.com` caused by infinite proxy loop
- **Root Cause:** `proxyToService` was forwarding the original Host header to Cloud Run, causing the request to loop back to the worker
- **Rule:** Edge proxy must delete the `Host` header before forwarding to Cloud Run origins. The `fetch()` call to the origin must not carry the original hostname.

### LR-006: Structured Logging Enforcement (2026-03-01)

- **Error:** Mixed structured and unstructured log output causing JSON parse failures in log aggregation
- **Root Cause:** `src/orchestration/buddy-core.js` and `src/vector-memory.js` contained raw `console.log` calls alongside the pino logger
- **Rule:** ALL modules in `src/` must use `logger.logSystem()`, `logger.logError()`, or `logger.logNodeActivity()`. Zero tolerance for `console.*` in production code paths.
