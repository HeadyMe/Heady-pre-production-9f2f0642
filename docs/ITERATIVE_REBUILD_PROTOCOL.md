<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/ITERATIVE_REBUILD_PROTOCOL.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
file_id: "FMSAP-002"
title: "Iterative Rebuild Protocol"
created: 2026-02-10
last_scan: 2026-02-10T03:39:00Z
scan_count: 1
next_scan_due: 2026-02-17
scan_priority: "high"
stability: "stable"
criticality: "core"
maintenance_notes:
  - "Initial protocol creation"
dependencies:
  - "SYSTEM_PROMPT.md"
  - "HEADY_AUTO_IDE.md"
learned_insights:
  - count: 0
  - last_updated: null
improvement_backlog: []
---
# HEADY SYSTEMS — Iterative Rebuild Protocol

> **Status:** Active | **Type:** Governance | **Owner:** system
> **Source of Truth:** `docs/ITERATIVE_REBUILD_PROTOCOL.md`
> **Goal:** After enough full rebuild iterations, the project converges toward an error-free, highly reliable, and maintainable system. Every iteration is both a fresh implementation and a deliberate learning pass over the entire design, code, and documentation.

---

## 1. Treat Each Rebuild as a Clean Slate

- Assume the project is being built from **zero**: no code, no configuration, no prior assumptions.
- Reconstruct architecture, components, and interfaces step by step, as if explaining them to a new engineer.
- Do **not** "handwave" any part of the system; every module, function, and integration must be explicitly defined and justified.
- Always prefer **clarity and explicitness** over brevity or cleverness.
- Reference the current `heady-registry.json` as the canonical catalog — nothing exists off the books.

---

## 2. Systematically Search for All Possible Errors

At every step (requirements, design, implementation, tests, deployment), proactively ask: **"What can go wrong here?"**

### 2.1 Error Spectrum

Consider the full spectrum of error types at every layer:

| Category | Examples |
|---|---|
| **Logic** | Off-by-one, incorrect conditionals, wrong operator precedence |
| **Concurrency** | Race conditions, deadlocks, stale reads, non-atomic operations |
| **Resources** | Memory leaks, file handle leaks, connection pool exhaustion |
| **Configuration** | Missing env vars, wrong ports, mismatched versions, stale secrets |
| **Security** | Injection, hardcoded credentials, missing auth checks, CORS misconfig |
| **Performance** | N+1 queries, unbounded loops, missing indexes, blocking I/O on main thread |
| **Integration** | API contract drift, schema mismatches, timeout misalignment |
| **Data** | Corruption, encoding issues, null/undefined propagation, timezone bugs |
| **UX** | Broken layouts, missing loading states, silent failures, unclear error messages |
| **Deployment** | Dockerfile errors, missing build steps, env leakage, port conflicts |

### 2.2 Error Documentation

- Treat every assumption as a potential source of error until explicitly validated or tested.
- Document each discovered error or risk as a concrete, traceable item:

```
Error-Candidate #N
- Description: [what the error is]
- Context: [where it occurs]
- Impact: [what breaks if it triggers]
- Root Cause: [why it happens]
- Fix: [what was changed]
- Safeguard: [what prevents recurrence]
- Iteration Discovered: [which rebuild cycle]
```

---

## 3. Learn from Previous Iterations Without Copying Blindly

- Treat previous versions as **data points**, not as fixed templates.
- For every error discovered in previous iterations, ensure that:
  - The root cause is understood and written down in plain language.
  - A specific design or process change is introduced to prevent recurrence.
- If an error **ever appears again** in a later iteration, treat this as a **serious process failure** and update development, review, and testing protocols accordingly.
- Avoid cargo-culting prior solutions; always revalidate them in the context of the current architecture.

### 3.1 Anti-Patterns to Watch For

| Anti-Pattern | Correct Behavior |
|---|---|
| Copy-pasting old code without understanding it | Rewrite from understanding, validate in current context |
| Assuming "it worked before, it'll work now" | Re-test every assumption; contexts change |
| Ignoring a previous bug because "we already fixed that" | Verify the fix is structurally present, not just historically applied |
| Fixing symptoms downstream | Always trace to root cause and fix upstream |
| Silencing errors to make tests pass | Fix the error; strengthen the test |

---

## 4. Make Error Prevention a First-Class Design Goal

- Design APIs, modules, and data structures to make **invalid states difficult or impossible** to represent.
- Prefer strong typing, clear boundaries, and explicit invariants over loosely defined structures.
- Encapsulate risky operations in well-designed, well-tested abstractions rather than duplicating delicate logic across the codebase.
- Use patterns that naturally reduce error probability:

| Pattern | Why It Helps |
|---|---|
| **Pure functions** | No hidden side effects; output depends only on input |
| **Minimized shared state** | Eliminates race conditions and coupling |
| **Clear data ownership** | One writer, many readers; no ambiguous mutation |
| **Idempotent operations** | Safe to retry; critical for distributed systems |
| **Explicit error types** | Forces callers to handle every failure mode |
| **Builder/factory patterns** | Prevents partially-initialized objects |
| **Validation at boundaries** | Bad data never enters core logic |

---

## 5. Enforce Rigorous Documentation with Each Rebuild

For every component, record:

- **Purpose** — Why does this exist?
- **Inputs** — What does it receive? Types, constraints, defaults.
- **Outputs** — What does it produce? Types, error cases.
- **Assumptions** — What must be true for this to work?
- **Invariants** — What must remain true throughout execution?
- **Known limitations** — What does this NOT do? Where will it break?

### 5.1 Living Error Log

Maintain a living **Error Log** document (`docs/ERROR_LOG.md`) that lists:

| Field | Description |
|---|---|
| Error ID | Unique identifier (e.g., `ERR-042`) |
| Description | What happened |
| Detection Method | How it was found (test, production, review, rebuild) |
| Root Cause | Why it happened |
| Fix Applied | Code/config change made |
| Safeguard Added | Test, lint rule, or design change to prevent recurrence |
| Iteration | Which rebuild cycle discovered or re-discovered it |
| Status | open / fixed / verified / regressed |

### 5.2 Documentation-Code Coupling

- Documentation changes and code changes **must** be tightly coupled in the same changeset.
- Per the Checkpoint Protocol: outdated documentation is treated as a **defect**.
- All docs must be registered in `heady-registry.json` and tracked in `docs/DOC_OWNERS.yaml`.

---

## 6. Implement Strong Testing at Multiple Levels

### 6.1 Testing Pyramid

| Level | What It Covers | When to Write |
|---|---|---|
| **Unit tests** | Individual functions, modules, edge cases, boundary conditions, error handling | Every non-trivial function |
| **Integration tests** | External dependencies: databases, APIs, queues, file systems, message buses | Every external boundary |
| **End-to-end tests** | Key user journeys and system workflows from entry to output | Every critical path |
| **Property-based / fuzz tests** | Unexpected input combinations, invariant verification | Parsers, serializers, validators, state machines |
| **Regression tests** | Previously-discovered bugs | Every bug fix — the bug must have a test before the fix |

### 6.2 Test Gap Rule

Treat any bug discovered in production or manual testing as a **test gap**. Add or strengthen tests so the same bug would be caught automatically in future iterations.

### 6.3 Test Integrity

- Never delete or weaken a test without explicit justification documented in the Error Log.
- Tests must be deterministic. Flaky tests are bugs.
- Tests must run in CI for every commit.

---

## 7. Aggressively Handle and Surface Errors

### 7.1 No Silent Failures

Do **not** ignore or silently swallow exceptions and error codes. All errors must either:

1. Be **handled locally** with a clear, correct, and documented strategy, or
2. Be **propagated upward** with sufficient context to debug the issue.

### 7.2 Structured Error Logging

Log errors in a structured way with:

- **Identifiers** (error codes, request IDs)
- **Timestamps** (ISO 8601, UTC)
- **Correlation IDs** (trace across services)
- **Essential context** (inputs that triggered the error, system state)

### 7.3 Recurring Error Rule

Never treat recurring errors as "just noise." Recurring errors are **signals** that design, code, or process must be improved. If the same error appears in two or more rebuild iterations, escalate it to an architectural review item.

---

## 8. Use Each Rebuild to Strengthen Architecture

After every full build, perform an **architectural review**:

### 8.1 Review Checklist

- [ ] **Complexity hotspots** — Which modules have the most bugs, the most churn, or the deepest nesting?
- [ ] **Brittle modules** — Which modules break when neighboring code changes?
- [ ] **Tight coupling** — Where are modules entangled in ways that prevent independent testing or deployment?
- [ ] **Unnecessary abstractions** — Where does abstraction increase confusion or error risk without adding value?
- [ ] **Observability** — Can every failure be diagnosed from logs, metrics, and traces without guessing?
- [ ] **Dependency health** — Are all external dependencies pinned, audited, and up to date?
- [ ] **Configuration hygiene** — Are all env vars documented, validated at startup, and never hardcoded?

### 8.2 Simplification Rule

If a module can be made simpler without losing correctness or capability, **simplify it**. Complexity is a liability that compounds across iterations.

---

## 9. Build in Feedback Loops and Retrospectives

After each complete iteration, conduct a **structured retrospective**:

### 9.1 Retrospective Questions

1. What **new errors** were found in this iteration?
2. Which errors **reappeared** from prior iterations, and why?
3. Which safeguards **worked well** and which **failed**?
4. What changes are needed in:
   - Requirements and design?
   - Coding standards?
   - Testing strategy?
   - Review process?
   - Deployment procedures?

### 9.2 Actionable Outcomes

Translate retrospective outcomes into **specific, enforceable changes** for the next iteration:

| Outcome Type | Example |
|---|---|
| New lint rule | "All async functions must have try/catch or explicit error propagation" |
| New checklist item | "Verify all env vars are set before starting the server" |
| New test category | "Add timeout tests for every external API call" |
| New deployment gate | "Health check must pass within 30s before traffic is routed" |
| New review requirement | "All error handling changes require two reviewers" |

---

## 10. Strengthen Code Quality and Review Standards

### 10.1 Linting and Formatting

- Use **strict** linting and formatting rules to reduce trivial mistakes and style inconsistencies.
- Automate formatting so it is never a manual concern.
- Treat linter warnings as errors in CI.

### 10.2 Code Review Requirements

Enforce code review for all non-trivial changes. Reviewers must explicitly check:

| Review Dimension | What to Look For |
|---|---|
| **Correctness** | Does this do what it claims? Are edge cases covered? |
| **Clarity** | Can a new engineer understand this without oral explanation? |
| **Error handling** | Are all failure modes handled or propagated? |
| **Performance** | Any unbounded operations, missing caches, or hot paths? |
| **Security** | Any injection vectors, missing auth, or data exposure? |
| **Test coverage** | Are new/changed paths tested? Are edge cases covered? |
| **Documentation** | Are docs updated to match code changes? |

### 10.3 Readability Rule

Any reviewer must be able to understand a change quickly from the code plus its accompanying tests and docs. If they cannot, the change is **not clear enough** and must be revised.

---

## 11. Treat "Error-Free" as an Asymptotic Goal

Recognize that "error-free" is an ideal you continually approach by systematically reducing the space of unknowns and eliminating recurring patterns of failure.

### 11.1 Convergence Model

The purpose of repeated rebuilding is to **compress the set of possible errors**:

```
Iteration 1:  Many errors discovered, many unknown unknowns
Iteration 2:  Known errors fixed; some reappear → process gaps identified
Iteration 3:  Fewer new errors; safeguards catch most regressions
Iteration N:  New errors rare, shallow, quickly eliminated
              Architecture naturally prevents common mistakes
              Test suite catches regressions instantly
              Docs and error logs make future issues easy to diagnose
```

### 11.2 Progress Metrics

Track these across iterations:

| Metric | Target Trend |
|---|---|
| Bugs per iteration | Decreasing |
| Time-to-detect (avg) | Decreasing |
| Time-to-fix (avg) | Decreasing |
| Test coverage | Increasing |
| Regression rate (bugs that reappear) | Decreasing toward zero |
| Operational incidents | Decreasing |

If these metrics are **not** improving across iterations, the process itself needs adjustment.

---

## 12. Never Sacrifice Correctness for Speed

- If there is ever a trade-off between "ship faster" and "build more reliably," bias **strongly** toward reliability.
- Avoid shortcuts that bypass testing, documentation, or review for core components.
- When under time pressure, explicitly note any intentional compromises and schedule concrete tasks to remove them in the next iteration.

### 12.1 Technical Debt Tracking

Any intentional compromise creates **technical debt**. Track it explicitly:

```
Debt-Item #N
- Description: [what was compromised]
- Reason: [why it was acceptable short-term]
- Risk: [what could go wrong]
- Remediation: [exact task to fix it]
- Deadline: [which iteration must resolve it]
```

No debt item may survive more than **two iterations** without remediation or explicit owner escalation.

---

## 13. Treat Every Build as a Chance to Refine the Process

Each rebuild is not just a rewrite of code, but also an **experiment in improving methodology**.

### 13.1 Process Refinement Targets

Continuously refine:

- **Coding standards and patterns** — Are they preventing errors or just adding ceremony?
- **Testing strategies** — Are tests catching real bugs or just achieving coverage numbers?
- **CI/CD pipelines** — Are builds fast, reliable, and informative on failure?
- **Monitoring and alerting** — Are alerts actionable or just noisy?
- **Developer experience** — Any friction or confusion is a process smell.

### 13.2 Process Smell Catalog

| Smell | Likely Root Cause | Fix |
|---|---|---|
| "I don't know which config is active" | Config sprawl, no single source of truth | Centralize in registry; validate at startup |
| "Tests pass locally but fail in CI" | Environment drift | Containerize test env; pin all dependencies |
| "I fixed this bug before" | Missing regression test | Add test before fixing; audit test gaps |
| "Nobody knows what this module does" | Missing or stale docs | Enforce doc-code coupling per Checkpoint Protocol |
| "Deploys are scary" | Missing smoke tests, no rollback plan | Add deployment gates; automate rollback |
| "Errors are lost in log noise" | Unstructured logging | Structured logs with correlation IDs and severity |

---

## 14. Final Convergence Expectation

After many cycles of rebuilding from scratch under these rules, the project is expected to:

1. **Have significantly fewer defects** — errors become rare and shallow.
2. **Possess a robust architecture** — the structure naturally prevents common mistakes.
3. **Include a strong test suite** — regressions are caught automatically within seconds.
4. **Be accompanied by clear documentation** — historical error logs make future issues easy to understand and fix.
5. **Run a refined process** — development, review, testing, and deployment are smooth and predictable.

The long-term objective is to converge on a system where new errors are **rare, shallow, and quickly eliminated**, and where the project is, in practice, as close to "error-free" as a real-world system can reasonably get.

---

## 15. Heady-Specific Integration

This protocol integrates with the existing Heady ecosystem:

| System | Integration |
|---|---|
| `heady-registry.json` | Central catalog; all components must be registered before they exist |
| `docs/CHECKPOINT_PROTOCOL.md` | Every rebuild checkpoint triggers full sync |
| `configs/hcfullpipeline.yaml` | Pipeline stages map to rebuild phases |
| `src/hc_monte_carlo.js` | UCB1 plan selection optimizes rebuild strategy over iterations |
| `src/hc_pattern_engine.js` | Pattern recognition tracks error categories across iterations |
| `src/hc_self_critique.js` | Self-critique engine records and analyzes rebuild retrospectives |
| `scripts/checkpoint-sync.ps1` | Automated sync at every rebuild checkpoint |
| `docs/DOC_OWNERS.yaml` | Ownership tracking for all rebuild artifacts |
| `.windsurf/workflows/hc-full-pipeline.md` | HCFullPipeline archive-and-rebuild workflow |

### 15.1 Rebuild Workflow Stages

```
1. ARCHIVE    → Archive current state to pre-production branch
2. SCAFFOLD   → Clean scaffold from registry + configs
3. IMPLEMENT  → Build each component per registry order
4. TEST       → Run full test pyramid
5. REVIEW     → Architectural review + error log update
6. DOCUMENT   → Sync all docs, configs, notebooks
7. CHECKPOINT → Registry validation + checkpoint sync
8. RETRO      → Structured retrospective + metric update
9. ITERATE    → Apply retro outcomes → return to step 2
```

### 15.2 Global Multi-Source-of-Truth Repository Reset
This phase defines how to perform a full, coordinated reset of all Heady repositories and cloud layers to restore deterministic behavior and eliminate accumulated drift. It is only invoked when incremental fixes are insufficient.

Scope

Repositories:
- HeadySystems/Heady (C-Corp production source of truth)
- HeadyMe/Heady (personal cloud source of truth)
- HeadyConnection/Heady (bridge cloud source of truth)
- HeadySystems/sandbox (experimental/development source of truth)
- Any monorepo or legacy repo feeding these systems.

Phases

Archive
- Rename existing GitHub repos to *-pre-production or move them to an Archive organization.
- Tag current main as pre-production-archive-YYYYMMDD.
- Move all local working directories to an archived folder with date stamps.

Scaffold
- Create fresh, empty repos for each of the four sources of truth.
- Preserve roles (primary, personal cloud, etc.)

### 15.3 Rebuild Protocol Document

# Iterative Rebuild Protocol

## Production Readiness Check & Auto-Deploy
- HCFullPipeline runs fully automated with deployment enabled
- Halts only for core infrastructure/data/security errors (ORS ≤70)
- Applies Checkpoint Protocol at each stage boundary

## 100% Functionality Checkpoint Criteria
1. All critical services running with passing health probes
2. HCFullPipeline completes without entering Recovery mode
3. ORS ≥70 with no active stop rules
4. All documented APIs function without breaking discrepancies

## Recon & Inventory Procedure
1. Invoke full Checkpoint Protocol
2. Run Heady-Sync in checkpoint mode
3. Generate checkpoint report with:
   - Commit hashes for all repos
   - Registry snapshot (heady-registry.json)
   - ORS/health check history
4. Store as "pre-rebuild production snapshot"

## Archive-and-Rebuild Sequence
### Pre-flight
- Confirm all commits pushed
- Create backup tags for production snapshot

### Archive Existing Repos
- Use archive-to-pre-production workflow
- Rename to *-pre-production variants
- Ensure no active CI/deployment pipelines remain

### Create Fresh Repos
- Provision brand-new empty repositories
- Preserve roles (primary, personal cloud, etc.)

### Scaffold from Scratch
- Run hc-scaffold-fresh
- Embed naming standards/domain conventions
- Eliminate prohibited patterns

### Selective Migration
- Copy only essential business logic
- Re-implement or retire legacy code

### Initialize & Push
- Commit scaffold + migrated logic
- Push to all remotes
- Update registry with new sourceOfTruth locations

### Swap Active Directories
- Rename old directories to archived names
- Update tooling/scripts/CI pipelines
- Update deployment targets and DNS

### Post-Rebuild Verification
- Run full HCFullPipeline
- Confirm ORS returns to Normal/Aggressive bands

## Build Order
1. **Core Services & Internals**: HeadyManager, HCFullPipeline runtime, Registry
2. **Shared Infrastructure**: Cross-platform tools, CLI, internal dashboards
3. **Websites & Vertical Applications**: Marketing sites, web apps, partner integrations

## Continuous Enforcement
- Apply Checkpoint Protocol at every commit/merge/release
- Treat outdated docs/registry entries as defects
- Use StoryDriver for rebuild narrative tracking

---

## 16. Revision History

| Date | Change |
|---|---|
| 2026-02-06 | Initial protocol created |
| 2026-02-10 | Added rebuild protocol document |
