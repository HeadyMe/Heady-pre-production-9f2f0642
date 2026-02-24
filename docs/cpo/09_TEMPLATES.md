# Heady — Templates

> Standard templates for PRDs, RFCs, launch checklists, and scorecards.  
> Used across all 17 verticals.

---

## 1. PRD Template

```markdown
# PRD: [Feature Name]

## Summary
One paragraph: what, for whom, why now.

## Problem
What pain does this solve? Evidence (user feedback, metrics, competitor gap).

## Proposed Solution
- **Surface(s):** [Buddy / IDE / Admin / MCP / API]
- **AI Nodes:** [Which of the 7 nodes are needed]
- **MCP Connectors:** [Which tool integrations]
- **Policy Level:** [L0 / L1 / L2 / L3]

## Success Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| [KPI 1] | — | — | [How measured] |
| [KPI 2] | — | — | [How measured] |

## Risks & Mitigations
| Risk | Severity | Mitigation |
|------|----------|-----------|
| [Risk 1] | [H/M/L] | [Strategy] |

## Dependencies
- **Requires:** [What must exist first]
- **Blocks:** [What this unlocks]

## HeadyBattle Questions
- What is the primary purpose?
- What could go wrong?
- Is this the most elegant solution?

## Timeline
Phase / relative sequencing (not dates).

## Approval
- [ ] CPO review
- [ ] Eng review
- [ ] HeadyBattle validation
```

---

## 2. RFC Template

```markdown
# RFC: [Technical Proposal Title]

## Status
[DRAFT | REVIEW | APPROVED | IMPLEMENTED | REJECTED]

## Context
What problem or opportunity triggers this RFC?

## Decision
What is the proposed technical decision?

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| [Alt 1] | | | |
| [Alt 2] | | | |

## Architecture Impact
- **Components affected:** [Registry components]
- **Services affected:** [Which of 19 services]
- **API changes:** [New / modified endpoints]
- **Config changes:** [Which YAML files]

## Arena Mode Strategy
Which Arena Mode strategy would validate this? Expected evaluation metrics.

## Migration Plan
Step-by-step for existing systems.

## Rollback Plan
How to revert if things go wrong.

## HeadyBattle Interrogation
- Purpose alignment?
- Unintended consequences?
- Simplification opportunities?

## Approvers
- [ ] Architecture owner
- [ ] Affected service owners
- [ ] Security review (if L2+ changes)
```

---

## 3. Launch Checklist

```markdown
# Launch Checklist: [Feature / Vertical Name]

## Pre-Launch
- [ ] PRD approved
- [ ] RFC approved (if architecture change)
- [ ] Implementation complete on development branch
- [ ] HeadyBattle interrogation passed (score ≥ 0.8)
- [ ] Arena Mode competition completed (best strategy selected)
- [ ] HeadySims confidence ≥ 0.85
- [ ] Security review (no committed secrets, no localhost refs)
- [ ] File governance check passed
- [ ] Anti-template policy verified
- [ ] Proof View receipts displaying correctly

## Staging Validation
- [ ] Deployed to staging via branch-automation-service
- [ ] HeadySims running continuous simulation
- [ ] HeadyLens monitoring active
- [ ] Performance within SLO bounds (P50/P95 targets)
- [ ] Error sentinel monitoring (no new error patterns)

## Production Deploy
- [ ] Final HeadyBattle validation passed
- [ ] Promotion to main branch
- [ ] PM2 process restarted (if applicable)
- [ ] Cloudflare tunnel routing verified
- [ ] Custom domain accessible
- [ ] Health endpoint returning 200

## Post-Launch
- [ ] HeadyLens dashboard updated with new metrics
- [ ] Documentation updated (HeadyIO if API change)
- [ ] Continuous learning observing new patterns
- [ ] Scorecard metrics baselined
- [ ] HeadyMemory storing new workflow patterns
```

---

## 4. Scorecard Template

```markdown
# Scorecard: [Vertical / Feature Name]

## Period: [Week/Month/Quarter of YYYY]

### North Star
| Metric | Target | Actual | Trend |
|--------|--------|--------|-------|
| [Primary KPI] | — | — | ↑/↓/→ |

### Health Metrics
| Category | Metric | Target | Actual | Status |
|----------|--------|--------|--------|--------|
| Usage | DAU / MAU | — | — | 🟢/🟡/🔴 |
| Performance | P50 latency | — | — | 🟢/🟡/🔴 |
| Performance | P95 latency | — | — | 🟢/🟡/🔴 |
| Reliability | Success rate | ≥ 0.97 | — | 🟢/🟡/🔴 |
| Cost | Cost per action | — | — | 🟢/🟡/🔴 |
| Quality | HeadyBattle avg score | ≥ 0.8 | — | 🟢/🟡/🔴 |
| Quality | Arena win rate | — | — | 🟢/🟡/🔴 |
| Memory | Vector utilization | — | — | 🟢/🟡/🔴 |

### Top Actions This Period
1. [What improved]
2. [What degraded]
3. [What's blocked]

### Next Period Focus
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
```
