<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# GTM Experiment Engine: 30 Concrete Tests

## How to Use This

Each experiment has: hypothesis → test → metric → pass/fail criteria → timeline.
Run 5–8 experiments per sprint. Kill losers fast.

---

## Developer Virality (Lane 1)

### Exp 1: "Arena Merge" Demo Video

**H:** Developers share Arena Merge demos because they're visually compelling.
**Test:** Create 90-second demo → post on X/Reddit/HN → measure shares + signups.
**Metric:** Views-to-signup rate > 2%
**Timeline:** 1 week

### Exp 2: IDE Quickstart (<5 min)

**H:** If setup takes <5 min, activation doubles.
**Test:** Time 10 new users from install → first successful Arena Merge.
**Metric:** Median time < 5 min
**Timeline:** 2 weeks

### Exp 3: "Golden Workflow" Templates

**H:** Pre-built workflows (deploy Next.js, scan vuln, review PR) increase retention.
**Test:** Publish 5 templates → measure template-started vs completed.
**Metric:** Completion rate > 60%
**Timeline:** 2 weeks

### Exp 4: CLI-first Onboarding

**H:** Power devs prefer CLI → offer `npx heady init` as primary.
**Test:** A/B: CLI quickstart vs web quickstart → compare activation.
**Metric:** Activation rate delta
**Timeline:** 2 weeks

### Exp 5: Cost Transparency Hook

**H:** Showing "this Arena run cost $0.23" increases trust + word-of-mouth.
**Test:** Add cost badge to every proof view → survey users on trust.
**Metric:** NPS delta
**Timeline:** 1 week

---

## MCP Ecosystem (Lane 2)

### Exp 6: Connector Install Wizard

**H:** Guided install reduces time-to-first-tool-call by 70%.
**Test:** Before/after wizard → measure activation.
**Metric:** Time to first tool call < 3 min
**Timeline:** 2 weeks

### Exp 7: "Verified Connector" Badge

**H:** Badged connectors get 3x more installs.
**Test:** Badge top 5 connectors → compare install rates vs unbadged.
**Metric:** Install rate ratio
**Timeline:** 3 weeks

### Exp 8: Permission Diff Viewer

**H:** Showing permission changes increases trust + reduces abandonment.
**Test:** Show diff before install → measure completion rate.
**Metric:** Install completion > 80%
**Timeline:** 2 weeks

### Exp 9: Connector Bounty Program

**H:** External devs will build connectors for bounties.
**Test:** Offer 5 bounties ($200 each) → measure submissions.
**Metric:** ≥ 3 quality submissions
**Timeline:** 4 weeks

### Exp 10: "Safe MCP" Blog Post

**H:** Content about MCP security gets high engagement from dev audience.
**Test:** Publish deep-dive → measure reads + shares + signups.
**Metric:** 1,000 reads + 50 signups
**Timeline:** 1 week

---

## Prosumer Habit (Lane 3)

### Exp 11: Voice Wake Word Activation

**H:** "Hey Heady" increases daily usage by 2x vs click-only.
**Test:** Enable voice for 50% of beta users → compare DAU.
**Metric:** DAU ratio
**Timeline:** 3 weeks

### Exp 12: Daily Briefing Notification

**H:** Morning briefing creates habit loop.
**Test:** Push daily briefing at 8am → measure open rate + task completion.
**Metric:** Open rate > 30%, task completion > 1/day
**Timeline:** 2 weeks

### Exp 13: Cross-Device Handoff

**H:** Desktop→mobile continuity reduces task abandonment.
**Test:** Track tasks started on desktop → % completed on mobile.
**Metric:** Handoff completion > 50%
**Timeline:** 4 weeks

### Exp 14: Approval UX Testing

**H:** "Preview → approve → execute" reduces regret rate to <2%.
**Test:** Track undo/cancel after approval.
**Metric:** Regret rate < 2%
**Timeline:** 2 weeks

### Exp 15: Memory Controls

**H:** Users who can view/edit/delete memory trust the system more.
**Test:** Add memory viewer → survey trust score.
**Metric:** Trust score increase > 20%
**Timeline:** 2 weeks

---

## Enterprise Trust (Lane 4)

### Exp 16: Trust Center Landing Page

**H:** A public trust center converts enterprise leads.
**Test:** Build trust center page → link from sales emails → track conversions.
**Metric:** Page-to-demo-request rate > 5%
**Timeline:** 2 weeks

### Exp 17: Audit Replay Demo

**H:** "Replay what happened" is the #1 enterprise buying trigger.
**Test:** Include audit replay in every enterprise demo → track deal progression.
**Metric:** Deals with replay demo progress 2x faster
**Timeline:** 4 weeks

### Exp 18: Budget Controls POC

**H:** Per-org budget caps are required for enterprise pilots.
**Test:** Implement basic budget → test with 3 pilot orgs.
**Metric:** 3/3 pilots approve budget feature
**Timeline:** 3 weeks

### Exp 19: Security Questionnaire Auto-Answer

**H:** Auto-answering security questionnaires with evidence reduces sales cycle.
**Test:** Auto-fill 3 real questionnaires → measure accuracy + time saved.
**Metric:** 80% answers correct, 70% time reduction
**Timeline:** 2 weeks

### Exp 20: SOC2 Readiness Checklist

**H:** Publishing SOC2 readiness status increases enterprise trust.
**Test:** Publish checklist → track enterprise inquiry rate.
**Metric:** Inquiry rate increase
**Timeline:** 2 weeks

---

## Vertical-Specific (Lanes 1–4 intersections)

### Exp 21: DevSecOps Arena Red-Team

**H:** Adversarial validation lane catches bugs competitors miss.
**Test:** Run red-team on 20 real PRs → compare bug catch rate.
**Timeline:** 3 weeks

### Exp 22: SRE Postmortem Generator

**H:** Auto-generated postmortems from audit trail save 4+ hours per incident.
**Test:** Generate 5 postmortems → compare to manual.
**Timeline:** 2 weeks

### Exp 23: Research Brief with Counter-Argument

**H:** Adversarial research (counter-brief) increases decision quality.
**Test:** Produce 10 briefs with counter → survey decision-makers.
**Timeline:** 2 weeks

### Exp 24: Support Ticket Arena Scoring

**H:** Arena-scored responses (fast/empathetic/policy) improve CSAT.
**Test:** A/B: single response vs 3 arena responses → compare CSAT.
**Timeline:** 3 weeks

### Exp 25: Finance Invoice Automation

**H:** Overlay-based invoice capture reduces processing time by 60%.
**Test:** Process 50 invoices → compare to manual baseline.
**Timeline:** 3 weeks

### Exp 26: Legal Clause Red-Lining

**H:** HeadyBattle-style interrogation catches risky clauses humans miss.
**Test:** Run on 20 real contracts → expert reviews findings.
**Timeline:** 3 weeks

### Exp 27: Education Arena Learning

**H:** Competing solutions with tradeoff explanation improves learning retention.
**Test:** 2 cohorts: standard vs arena → quiz scores after 2 weeks.
**Timeline:** 4 weeks

### Exp 28: Nonprofit Impact Report Generator

**H:** Auto-generated impact reports save 10+ hours per quarter.
**Test:** Generate 3 reports → compare to manual.
**Timeline:** 2 weeks

### Exp 29: Healthcare PHI-Safe Mode

**H:** Local-only processing mode unlocks healthcare pilot interest.
**Test:** Demo PHI-safe mode to 5 clinics → measure interest.
**Timeline:** 3 weeks

### Exp 30: Manufacturing Pattern Detection

**H:** Repeated failure pattern detection reduces downtime by 30%.
**Test:** Analyze 3 months of maintenance logs → identify patterns → validate.
**Timeline:** 4 weeks
