# HeadyOS Founder Community Portal — Configuration Specification

**Version**: 1.0.0  
**Platform**: Discourse (self-hosted) or Circle.so  
**Community name**: HeadyOS Founders  
**φ Reference**: 1.618033988749895

---

## Community Overview

The HeadyOS Founders Community is a private portal for Founder Tier pilot participants. It provides structured discussion categories, a shared product roadmap, feature voting, and access to the founding team.

**Access**: Invite-only. Provisioned automatically upon pilot onboarding confirmation.  
**Cohort 1 capacity**: fib(7) = **13 organizations**

---

## Forum Categories

### 1. Welcome & Introductions
**Slug**: `welcome`  
**Description**: Introduce yourself, your organization, and your primary use case.  
**Moderation**: Auto-pinned welcome thread from Eric Headington.  
**Required post**: All new members must post introduction within fib(5)=5 days.

### 2. Getting Started
**Slug**: `getting-started`  
**Description**: Questions about onboarding, workspace setup, first agent creation.  
**Tags**: `onboarding`, `agents`, `mcp-tools`, `api`, `sdk`  
**SLA**: HeadyOS team responds within fib(5)=5 hours.

### 3. Use Cases & Workflows
**Slug**: `use-cases`  
**Description**: Share how you're using HeadyOS. Grant writing workflows, document automation, research synthesis, code review pipelines.  
**Featured**: Non-profit grant writing (primary Cohort 1 use case).  
**Minimum**: Each org should post fib(3)=2 workflow examples before Day 55.

### 4. Feature Requests & Voting
**Slug**: `features`  
**Description**: Propose and vote on new features. Directly feeds the HeadyOS roadmap.  
**Integration**: Linked to `pilot/feedback/feature-voting.js` API.  
**Voting rules**:
  - Each org gets fib(5)=5 votes per month
  - Fibonacci vote weighting: First vote = 1pt, second = 1pt, third = 2pt, fourth = 3pt, fifth = 5pt
  - Top fib(5)=5 features reviewed at each office hours

### 5. Technical Deep Dives
**Slug**: `technical`  
**Description**: Advanced technical discussions. Architecture questions, custom integrations, agent patterns, CSL gate configuration.  
**Tags**: `architecture`, `csl`, `vector-memory`, `mcp`, `conductor`, `security`  
**Thread examples**:
  - "Best practices for vector memory namespace design"
  - "CSL gate tuning for grant writing workloads"
  - "Multi-agent pipeline patterns with heady-conductor"

### 6. Bug Reports
**Slug**: `bugs`  
**Description**: Report platform issues.  
**Format**: Subject: `[BUG] {service} — {brief description}`  
**Required fields**: Steps to reproduce, expected vs. actual, trace ID from audit log  
**SLA**: P0 — 1 hour; P1 — fib(5)=5 hours; P2 — fib(7)=13 hours

### 7. Roadmap & Announcements
**Slug**: `announcements`  
**Description**: HeadyOS team posts only. Release notes, roadmap updates, pilot milestones.  
**Visibility**: Read-only for members. Comments open.  
**Frequency**: Updates at each Fibonacci milestone (day 8, 13, 21, 34, 55, 89).

### 8. Office Hours
**Slug**: `office-hours`  
**Description**: Pre-meeting agenda threads, post-meeting notes, and recording links.  
**Schedule**: See "Office Hours Schedule" below.  
**Format**: Each session has an agenda post, open questions thread, and follow-up notes.

### 9. Showcase & Wins
**Slug**: `showcase`  
**Description**: Share your results. Grants submitted, workflows automated, time saved.  
**Incentive**: Top showcase per month gets featured in HeadyOS marketing (with consent).  
**Goal**: fib(3)=2+ showcases per org during pilot.

### 10. Meta & Feedback
**Slug**: `meta`  
**Description**: Feedback about the community itself, the pilot program, and the forum platform.

---

## Office Hours Schedule

Hosted by Eric Headington (Founder & CEO) + relevant engineers.  
Cadence: Every **fib(7) = 13 days** from activation date.  
Duration: 55 minutes (fib(10)) per session.  
Format: Video (Zoom/Google Meet) + Slack thread for async Q&A.  
Recording: Uploaded to #announcements within fib(3)=2 hours.

| Session | Day | Focus |
|---|---|---|
| Kickoff | Day 13 [fib(7)] | Platform orientation, use case alignment, Q&A |
| Technical | Day 26 | Architecture deep-dive, CSL gates, vector memory |
| Midpoint Review | Day 39 | Feature voting, roadmap preview, mid-pilot NPS review |
| Advanced Patterns | Day 52 | Multi-agent conductor patterns, MCP integrations |
| Pre-Conversion | Day 65 | Pricing discussion, Pro tier planning, migration prep |
| Final Planning | Day 78 | Transition planning, contract terms, Founder discount |
| Graduation | Day 89 [fib(11)] | Pilot retrospective, conversion celebration, roadmap reveal |

**Scheduling**: Calendar invites sent on Day 0. Managed via cal.com/headysystems.

---

## Shared Roadmap

The HeadyOS Founders Community has access to a **shared product roadmap** with Fibonacci-phased milestones.

### Roadmap Visibility Levels
| Level | Accessible to |
|---|---|
| **Discovered** | Public (headyme.com/roadmap) |
| **Under Consideration** | Founder community |
| **Planned** | Founder community + voting |
| **In Progress** | Founder community + updates |
| **Shipped** | Public + detailed notes |

### Fibonacci Roadmap Phases

**Phase 1 (Days 1–13)** — Foundation  
- Stable Founder Tier provisioning  
- MCP tool catalog expansion (target: fib(5)=5 new tools)  
- Vector memory UI improvements  
- SDK documentation completeness  

**Phase 2 (Days 13–34)** — Scale  
- heady-conductor pipeline builder UI  
- Advanced CSL gate configuration  
- Webhook integrations (Zapier, Make, n8n)  
- Batch agent execution (up to fib(7)=13 agents)  

**Phase 3 (Days 34–89)** — Enterprise  
- SOC 2 Type II completion  
- SAML/SSO support  
- Multi-workspace federation  
- Custom model fine-tuning pipeline  
- heady-hive swarm intelligence preview  

### Voting Mechanism
Founder members vote on "Under Consideration" features monthly.  
Voting opens on Day fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55.  
Top fib(5)=5 voted features per cycle move to "Planned."

---

## Community Norms

1. **Confidentiality**: Community discussions are NDA-protected. Do not share screenshots, feature previews, or roadmap details externally.
2. **Constructive feedback**: All criticism should include a suggested improvement.
3. **Signal over noise**: Quality > quantity. Aim for fib(3)=2 thoughtful posts over fib(8)=21 brief ones.
4. **Respect**: This is a small, trusted cohort. Treat every member as a co-founder-level collaborator.
5. **Disclosure**: If sharing AI-generated content, label it. HeadyOS values authentic human insight.

---

## Integration Points

| Integration | Details |
|---|---|
| Slack | `#founder-community` mirror channel for Discourse activity |
| Feature voting API | `POST /features/:id/vote` auto-creates Discourse threads |
| NPS survey | Day 8/21/55 survey results shared (anonymized) in `#announcements` |
| Office hours | Cal.com + Zoom + Discourse recording upload |
| Roadmap | Linear.app (internal) → Discourse sync via webhook |
| Audit log | All community actions logged in heady-chain SHA-256 audit |

---

## Success Criteria for Community

By Day 89 (pilot graduation), the Founder community should have achieved:

| Metric | Target |
|---|---|
| Member participation rate | >fib(9)/fib(7) = 62% |
| Feature requests submitted | >fib(6)=8 total |
| Showcase posts | >fib(4)=3 total |
| Office hours attendance | >61.8% per session |
| Average NPS from community | >40 |
| Bug reports resolved <24h | >85.4% |

---

*φ = 1.618033988749895. All Fibonacci references: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987.*
