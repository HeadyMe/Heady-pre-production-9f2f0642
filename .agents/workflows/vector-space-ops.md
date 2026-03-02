---
description: Vector space operations — ensure all internal ops run in 3D vector space before any deployment
---

# Vector Space Operations Workflow

> HeadyOS lives in 3D vector space. Deployment is the **exception**, not the rule.
> This workflow ensures all anti-sprawl, security, maintenance, and pre-deployment
> validation runs INSIDE vector space first.

// turbo-all

## Phase 1 — Vector Space Health Check

1. Check vector memory health:

```bash
curl -s https://manager.headysystems.com/api/vector-ops/health | jq .
```

1. Verify zone distribution — no zone should hold >50% of vectors:

```bash
curl -s https://manager.headysystems.com/api/vector/memory/stats | jq '.zones'
```

1. If unhealthy → STOP. Run compaction first (Phase 4).

---

## Phase 2 — Anti-Sprawl Scan

1. Run sprawl detection:

```bash
curl -s -X POST https://manager.headysystems.com/api/vector-ops/sprawl-check | jq .
```

1. Evaluate results:
   - `sprawlDetected: false` → PASS, continue
   - `sprawlDetected: true` with `severity: warn` → Note, continue with caution
   - `sprawlDetected: true` with `severity: critical` → **STOP**. Architectural sprawl detected.
     - Investigate which zone is growing beyond φ² (2.618x) baseline
     - Consider if new vectors are properly clustered or creating sprawl
     - Compact and rebalance before proceeding

---

## Phase 3 — Security Scan (In Vector Space)

1. Run security scan:

```bash
curl -s -X POST https://manager.headysystems.com/api/vector-ops/security-scan | jq .
```

1. Check for:
   - `ZONE_CONCENTRATION` — possible data poisoning
   - `QUERY_ONLY_PATTERN` — possible data extraction attempt
   - Any high-severity threats → **STOP** and investigate

2. Verify no anomalous vectors exist outside expected zone boundaries.

---

## Phase 4 — Maintenance & Compaction

1. Run compaction cycle:

```bash
curl -s -X POST https://manager.headysystems.com/api/vector-ops/compact | jq .
```

1. Verify zone rebalancing:
   - `zonesRebalanced: 0` = balanced, good
   - `zonesRebalanced: N` = N zones need attention

2. Check graph integrity:

```bash
curl -s https://manager.headysystems.com/api/vector/memory/stats | jq '.graphEdgeCount'
```

---

## Phase 5 — Pre-Deployment Gate (Only If Deploying)

> **CRITICAL**: Skip this phase if changes live entirely in vector space.
> Only run if changes MUST leave the vector substrate (edge workers, Cloud Run, etc.)

1. Run pre-deploy validation:

```bash
curl -s https://manager.headysystems.com/api/vector-ops/pre-deploy | jq .
```

1. Gate rules:
   - `clear: true` → Deployment allowed
   - `clear: false` → **DEPLOYMENT BLOCKED**
     - Review `blockers[]` — these MUST be resolved
     - Review `warnings[]` — these SHOULD be addressed
   - HTTP 422 = deployment not allowed

2. If deploying, run deployment verification after:

```bash
# See /deployment-verification workflow
```

---

## Phase 6 — Post-Operation Vector Integrity

1. Re-check health after any operations:

```bash
curl -s https://manager.headysystems.com/api/vector-ops/status | jq .
```

1. Verify:
   - `started: true` — autonomic ops loop is running
   - `cycles` — should be incrementing (PHI-timed)
   - `antiSprawl.recentAlerts` — should be empty or low-severity
   - `security.recentScans` — all `healthy: true`

---

## Decision Matrix

| Situation | Action |
| --- | --- |
| Changes are vector-space only | Skip Phase 5, operate in memory |
| Changes affect edge workers | Run Phase 5, deploy only if `clear: true` |
| Changes affect Cloud Run | Run Phase 5 + full `/deployment-verification` |
| Sprawl detected | Compact + rebalance BEFORE any other action |
| Security threat found | Halt all ops, investigate, then resume |
| Pre-deploy gate fails | Fix blockers in vector space, re-validate |

## PHI Timing Reference

| Interval | Value | Use |
| --- | --- | --- |
| φ² | 2.6s | Heartbeat pulse |
| φ⁴ | 6.85s | Security scan cycle |
| φ⁶ | 17.9s | Anti-sprawl detection |
| φ⁸ | 46.9s | Maintenance compaction |
| φ¹⁰ | 122.9s | Full audit cycle |
