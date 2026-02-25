<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Metrics Dashboard Specification

## Purpose

Single executive view that answers: "Is Heady winning?" Updated in real-time from registry + telemetry.

---

## North Star Metric

**Verified outcomes completed per active user per week**

- "Verified" = executed through tools, logged, success/failure known
- Forces Heady to be an execution platform, not a chat toy

---

## Dashboard Sections

### 1. Adoption Panel

| Metric | Source | Target |
|--------|--------|--------|
| Weekly Active Users (WAU) | Auth events | +10% MoM |
| Daily Active Users (DAU) | Session starts | WAU * 0.4+ |
| Time to first verified outcome | Onboarding funnel | < 5 min |
| Setup success rate | Connector + IDE activation | > 80% |
| W1 retention | Cohort analysis | > 40% |
| W4 retention | Cohort analysis | > 25% |
| Surface coverage per user | Multi-surface events | > 1.5 surfaces/user |

### 2. Outcomes Panel

| Metric | Source | Target |
|--------|--------|--------|
| Verified outcomes / user / week | Audit log | > 5 |
| Top 5 workflows | Workflow completion events | — |
| Workflow success rate | Completion vs failure | > 85% |
| Arena Merge promotions | Branch gating system | > 85% success |
| Consensus confidence mean | Multi-model scoring | > 0.80 |
| Fix-loop time (proxy) | Change-accept to revert | Decreasing |

### 3. Trust & Reliability Panel

| Metric | Source | Target |
|--------|--------|--------|
| Tool-call success rate | MCP audit logs | > 99% |
| Audit log completeness | % actions with receipts | 100% |
| Policy violations blocked | Validator middleware | Track trend |
| Security incidents / month | Incident tracker | 0 |
| MTTR (mean time to recover) | Incident timeline | Decreasing |
| Rollback rate | Revert events / total merges | < 5% |

### 4. Cost Panel

| Metric | Source | Target |
|--------|--------|--------|
| Inference cost / outcome | Cost tracking endpoint | Decreasing |
| Infra cost / active user | Cloud billing | < $2/user/month |
| Model routing efficiency | Cheaper model selection rate | > 30% |
| Budget utilization | Budget controls | < 90% of cap |
| Cost per Arena run | Per-request tracking | < $0.50 |

### 5. Platform Health Panel

| Metric | Source | Target |
|--------|--------|--------|
| Registry system score | heady-registry.json | > 85 |
| Services healthy | Health scan | 100% |
| P95 latency (gateway) | APM / registry scan | < 500ms |
| Circuit breaker triggers | Middleware events | < 5/day |
| Domain accessibility | External probe | 100% (9/9 domains) |

### 6. Delivery Panel

| Metric | Source | Target |
|--------|--------|--------|
| Roadmap milestones hit | Task tracker | > 80% |
| Cycle time (idea → shipped) | PR/deploy timestamps | Decreasing |
| Quality gates pass rate | CI + HeadyBattle | > 90% |
| File governance score | HeadyMaintenance | > 90 |
| Test coverage | CI reports | Increasing |

---

## Implementation Notes

### Data Sources

1. **heady-registry.json** → services, health scans, scores, providers
2. **Audit logs** → tool calls, approvals, outcomes, costs
3. **Auth events** → user sessions, activations, retention
4. **CI pipeline** → quality gates, test results, deploy events
5. **Cost tracking endpoint** → per-request costs, model usage

### Instrumentation Priority

1. **Must have (Week 1):** WAU, outcomes/week, tool-call success rate, cost/outcome
2. **Should have (Week 2-3):** Arena metrics, retention cohorts, policy blocks
3. **Nice to have (Week 4+):** Surface coverage, fix-loop proxy, routing efficiency

### Display

- Real-time web dashboard (Admin UI component)
- Weekly email digest (scorecard template)
- Slack/webhook alerts for threshold violations
