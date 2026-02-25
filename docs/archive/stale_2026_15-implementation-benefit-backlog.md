<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Implementation Benefit Backlog (Scan-Derived Priorities)

## Priority Classification

- **P0** — Security/trust blocker (do before scaling)
- **P1** — Core product capability (competitive requirement)
- **P2** — Quality/reliability (reduces incidents)
- **P3** — Growth/distribution (increases adoption)
- **P4** — Nice-to-have (when bandwidth allows)

---

## P0 — Security & Trust (Do Now)

### 1. Purge committed secrets from git history

**Benefit:** Eliminates existential trust risk. Required for enterprise.
**Effort:** 2-4 hours (BFG/filter-repo + rotation)
**Status:** Called out in hardening roadmap

### 2. Harden .gitignore

**Benefit:** Prevents operational log/pid/env leakage going forward.
**Files:** `data/*.jsonl`, `*.pid`, `*.bak`, `audit_logs.jsonl`, `.env*`, `*.log`
**Effort:** 30 min

### 3. Enable GitHub secret scanning

**Benefit:** Automated detection + PR blocking for secrets.
**Effort:** 1 hour (repo settings + GitHub Advanced Security)

### 4. Add pre-commit secret scanning hook

**Benefit:** Catches secrets before they enter history.
**Effort:** 1 hour (gitleaks or detect-secrets)

### 5. Rotate all exposed credentials

**Benefit:** Limits blast radius of any leaked secrets.
**Effort:** 2 hours (identify + rotate + update configs)

### 6. Remove bearer tokens from docs/summaries

**Benefit:** Docs should use `<REDACTED>` placeholders.
**Effort:** 1 hour

---

## P1 — Core Product (Competitive Requirement)

### 7. Validator-before-Dispatch middleware

**Benefit:** Universal policy gate for every action. Product differentiator.
**Implementation:** Middleware that checks identity, allowlist, sanitization, approval, audit receipt.
**Effort:** 1-2 days

### 8. Arena Merge dashboard UI

**Benefit:** Turns Arena Mode from concept to visible product feature.
**Implementation:** Show strategies, scores, winner, audit links.
**Effort:** 2-3 days

### 9. Per-request cost tracking (expand)

**Benefit:** Cost transparency = trust = enterprise readiness.
**Implementation:** Extend existing claude-usage endpoint to all providers.
**Effort:** 1-2 days

### 10. Proof View component

**Benefit:** Every workflow shows what happened, why, cost, and rollback path.
**Implementation:** Reusable UI component for Admin + IDE.
**Effort:** 2-3 days

### 11. Consensus Engine productization

**Benefit:** Multi-model agreement is unique. Make it visible + configurable.
**Implementation:** Confidence scores, agreement visualization, threshold config.
**Effort:** 2-3 days

---

## P2 — Reliability & Quality

### 12. Circuit breakers for core services

**Benefit:** Registry scores this at 0. Prevents cascading failures.
**Implementation:** Wrap service calls with circuit breaker pattern.
**Effort:** 1-2 days

### 13. Response caching layer

**Benefit:** Registry scores this at 0. Reduces latency + cost.
**Implementation:** Cache identical requests with TTL.
**Effort:** 1 day

### 14. Connection pooling

**Benefit:** Registry scores this at 0. Improves throughput.
**Implementation:** Pool HTTP/DB connections.
**Effort:** 1 day

### 15. Reconcile port/environment drift

**Benefit:** Eliminates onboarding confusion and config bugs.
**Implementation:** Canonical PORTS_AND_ROUTES.md generated from registry.
**Effort:** 2 hours

### 16. Fix Cloudflare origin routing (app., mobile.)

**Benefit:** Stops 403 challenges for subdomains.
**Effort:** 2-4 hours (DNS + WAF config)

### 17. Standardized health endpoints

**Benefit:** Every service discoverable and monitorable.
**Implementation:** `/health` returning `{status, version, uptime, checks}`.
**Effort:** 2-4 hours

---

## P3 — Growth & Distribution

### 18. IDE Quickstart (<5 min)

**Benefit:** Activation rate increase.
**Implementation:** `npx heady init` or guided setup.
**Effort:** 1-2 days

### 19. Golden Workflow templates

**Benefit:** Reduces time-to-first-win.
**Implementation:** 5 pre-built workflows (deploy, scan, review, etc.)
**Effort:** 2-3 days

### 20. MCP Connector install wizard

**Benefit:** Reduces connector activation friction.
**Implementation:** Guided flow with permission preview.
**Effort:** 2 days

### 21. Trust Center landing page

**Benefit:** Enterprise GTM asset.
**Implementation:** Public page showing controls, audit, data handling.
**Effort:** 1-2 days

### 22. "Safe MCP" content series

**Benefit:** Developer mindshare + SEO.
**Implementation:** Blog posts + code examples.
**Effort:** 1 day per post

### 23. Voice commands expansion

**Benefit:** Increases Buddy DAU.
**Implementation:** Expand wake word + command library.
**Effort:** 1-2 days

---

## P4 — Nice-to-Have

### 24. Adversarial validation lane (red-team mode)

**Benefit:** Catches issues competitors miss. Unique story.
**Effort:** 2-3 days

### 25. Refactor heatmap (HeadyMaid visualization)

**Benefit:** Prioritizes cleanup work visually.
**Effort:** 2 days

### 26. Connector bounty program

**Benefit:** Ecosystem growth.
**Effort:** 1 day to set up + ongoing management

### 27. Auto-generated postmortems

**Benefit:** SRE time savings.
**Effort:** 2 days

### 28. Quiz/flashcard onboarding integration

**Benefit:** Better knowledge retention.
**Effort:** 1-2 days

### 29. Memory viewer/editor

**Benefit:** Increases trust in companion.
**Effort:** 2-3 days

### 30. Browser extension (pre-Chromium)

**Benefit:** Distribution without Chromium fork cost.
**Effort:** 3-5 days

---

## Effort Summary

| Priority | Items | Total Effort Est. |
|----------|-------|-------------------|
| P0 | 6 | ~1 day |
| P1 | 5 | ~1.5 weeks |
| P2 | 6 | ~1 week |
| P3 | 6 | ~1.5 weeks |
| P4 | 7 | ~2 weeks |
| **Total** | **30** | **~6 weeks** |
