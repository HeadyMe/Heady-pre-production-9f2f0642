# Heady — Roadmap

> Sequenced execution plan. No dates — relative sequencing by dependency.  
> **Principle:** Each phase unlocks the next. Trust before distribution, factory before verticals.

---

## Phase 0 — Trust & Hygiene (Foundation)

> Must be true before anything scales. Credibility blocker.

| Item | Status | Details |
|------|--------|---------|
| Rotate all committed credentials | In progress | Previous sessions addressed partial; complete audit needed |
| Secret scanning in CI | Not started | GitHub Actions + pre-commit hooks |
| Log sanitization | Not started | Mask tokens/keys in all HeadyManager output |
| Port/route canonical manifest | Not started | Generate from registry — resolve 3300 vs 3301 drift |
| Circuit breakers for external APIs | Not started | HeadyManager → external AI node calls |
| STANDING_DIRECTIVE compliance audit | Not started | Verify all surfaces use custom domains, never localhost |
| File governance enforcement | Active | `configs/file-governance.yaml` + pre-commit hooks |
| Anti-template policy enforcement | Active | 14 banned patterns in `heady-intelligence.yaml` |
| HeadyBattle gate on all changes | Active | `socratic-service.js` interrogation |

---

## Phase 1 — Verticalization Factory (Core Primitives)

> Ship the 4 reusable primitives that power every vertical.

### 1A — Proof View UI

Display receipts (models, tools, costs, scores, risks) into a readable, shareable format. Used by every surface.

- **Where:** HeadyBuddy, HeadyAI-IDE, HeadyMe Admin
- **Data source:** Existing receipt system from routes
- **Work:** Frontend component + REST endpoint from existing `memory.js` / `hcfp.js`

### 1B — Policy Ladder (L0–L3)

Permission system with escalating approval requirements (read → suggest → write → destructive).

- **Where:** HeadyManager middleware
- **Data source:** `heady-intelligence.yaml` + `automation-policy.yaml`
- **Work:** Middleware layer + HeadyBattle score-based auto-approval

### 1C — Connector Trust Model (MCP)

Verified, governed MCP connectors with quality scores, usage telemetry, and install UX.

- **Where:** HeadyMCP (`headymcp.com`)
- **Data source:** `configs/headymcp.json` (22KB)
- **Work:** Registry UI + connector governance pipeline

### 1D — Arena Mode Productization

Package Arena Mode (7 strategies, HeadySims scoring, HeadyBattle validation) as a named, sellable capability.

- **Where:** All surfaces
- **Data source:** `src/services/arena-mode-service.js` (19KB), `monte-carlo-service.js` (17KB)
- **Work:** User-facing tournament UI, strategy leaderboard, Proof View integration

---

## Phase 2 — Flood Distribution (Multi-Channel Launch)

> Saturate all channels simultaneously.

### Wave 1 — Users Fastest (Companion)

| Target | Channel | Vehicle |
|--------|---------|---------|
| HeadyBuddy | Browser extension, web widget | Voice activation, cross-device sync, HeadyMemory |
| HeadyWeb | Chromium-based browse | AI sidebar, smart search |
| HeadyBot | Chat, webhooks | 115 automated background tasks |

### Wave 2 — Credibility Fastest (Developer)

| Target | Channel | Vehicle |
|--------|---------|---------|
| HeadyAI-IDE | Windsurf integration | Arena Merge receipts, ensemble coding |
| HeadyIO | Developer portal | API docs, SDK, examples |
| HeadyMCP | MCP registry | Connector marketplace, verified publishers |

### Wave 3 — Ecosystem Moat

| Target | Channel | Vehicle |
|--------|---------|---------|
| HeadyAgent | Agent platform | Build/deploy autonomous agents |
| HeadyStore | Marketplace | Plugins, templates, agent packs |
| HeadyAPI | Public gateway | Rate-limited, documented, developer-friendly |

### Wave 4 — Expansion Verticals

| Target | Channel | Vehicle |
|--------|---------|---------|
| HeadyCreator | Creative | AI design, remix, visual generation |
| HeadyMusic | Entertainment | AI composition, mixing |
| HeadyTube | Video | AI video creation/editing |
| HeadyLearn | Education | Adaptive learning, tutoring |
| HeadyData | Analytics | AI-powered data visualization |
| HeadyStudio | Professional | Multi-project workspace |
| HeadyCloud | Infrastructure | Scalable AI compute on demand |

---

## Phase 3 — Enterprise Scale

> [!IMPORTANT]
> Phase 3 requires Phase 0 completion (trust) and Phase 1 production-readiness.

| Item | Details |
|------|---------|
| SOC 2 Type II audit | Logging, access control, encryption at rest |
| GDPR/CCPA controls | HeadyMemory data handling, user consent |
| Tenant isolation | Multi-tenant deployment for enterprise customers |
| mTLS | Service-to-service mutual TLS |
| SLA framework | Uptime guarantees, support tiers |
| On-premise deployment | Dockerized deployment for regulated industries |

---

## Dependency Graph

```
Phase 0 (Trust)
    ↓ unlocks
Phase 1 (Factory) ← builds primitives
    ↓ feeds
Phase 2 (Flood) ← launches on primitives
    ↓ generates revenue + signal
Phase 3 (Enterprise) ← scales on trust + signal
```
