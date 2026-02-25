<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady — Operating Model

> How Heady ships: Arena Mode, branch gating, quality gates, cadences, and Proof View.  
> **Sources:** `WORKSPACE-ARCHITECTURE.md`, `heady-intelligence.yaml`, `src/services/arena-mode-service.js`, `src/services/socratic-service.js`, `src/services/branch-automation-service.js`

---

## Shipping Lifecycle

### Branch Strategy

```
main (production)     ←── staging ←── development ←── feature branches
     ↑                      ↑              ↑
  Production           Arena Mode      IDE Changes
  Live Sites         HeadySims 100%   windsurf-next
                       Simulations
```

### Quality Gates

| Stage | Gate | Enforced By | Threshold |
|-------|------|-------------|-----------|
| Feature → Development | HeadyBattle interrogation | `socratic-service.js` (21KB) | Score ≥ 0.8 |
| Development → Staging | Arena Mode competition | `arena-mode-service.js` (19KB) | Best of 7 strategies |
| Staging → Main | HeadySims + HeadyBattle + human review | `monte-carlo-service.js` (17KB) + `branch-automation-service.js` (18KB) | MC confidence ≥ 0.85, HeadyBattle ≥ 0.8, human if < 0.7 |
| Main → Production | Final HeadyBattle validation | Automatic | HeadyBattle passed |

### Arena Mode (7 Strategies)

Each task generates up to 7 candidate execution strategies that compete:

| Strategy | Approach | When Selected |
|----------|----------|---------------|
| fast_serial | Quick sequential | Low-complexity, time-critical |
| fast_parallel | Concurrent processing | Independent subtasks |
| balanced | Resource-optimized | Default for most tasks |
| thorough | Comprehensive analysis | High-risk changes |
| cached_fast | Optimized caching | Repeated patterns |
| probe_then_commit | Validation-first | Unknown territory |
| monte_carlo_optimal | MC-selected best | Complex, multi-variable |

Evaluation weights: latency (0.3), accuracy (0.25), efficiency (0.2), satisfaction (0.15), quality (0.1)

### HeadyBattle Interrogation

3-depth Socratic questioning on every change:

**Purpose:** What is the primary goal? How does this serve the mission?  
**Consequences:** What could go wrong? Who might be affected? Trade-offs?  
**Optimization:** Is this the most elegant solution? Can it be simplified? What patterns does it establish or break?

---

## The Proof View (Receipt System)

Every executed action produces a receipt containing:

| Field | Content |
|-------|---------|
| **Action ID** | Unique identifier |
| **Timestamp** | When executed |
| **Surface** | Which entry point (Buddy, IDE, API, Admin) |
| **Intent** | Original user request |
| **Plan** | HeadyJules decomposition (DAG of subtasks) |
| **AI Nodes Used** | Which of the 7 nodes were invoked and why |
| **MCP Tools** | Which connectors were used |
| **Strategy** | Which Arena Mode strategy won |
| **HeadySims Score** | UCB1 confidence score |
| **HeadyBattle Score** | Socratic validation score |
| **Cost** | Total compute cost (tokens + API calls) |
| **Outcome** | What changed (files, configs, deployments) |
| **Risks** | Flagged concerns from HeadyBattle or HeadyGrok |

---

## Process Management (PM2)

### Resource Budget

```
Total RAM: 32GB LPDDR5 (4GB allocated to PM2)
├── Core Services: 512M max each
│   ├── heady-manager: 512M
│   ├── hcfp-auto-success: 256M
│   └── lens-feeder: 128M
├── Sites: 64M each × 15 = 960M max
└── OS + buffers: ~500M
```

### Restart Policies

- heady-manager: max 20 restarts, 1s exponential backoff, 10s min uptime
- hcfp-auto-success: max 10 restarts, 5s exponential backoff, 30s min uptime
- lens-feeder: max 5 restarts
- Sites: autorestart with 64M memory limit

---

## HCFP Auto-Success Pipeline

The `hcfp-auto-success` process (`scripts/hcfp-full-auto.js`) runs continuously in PM2:

```
Full Auto Mode trigger
    → Run HeadySims simulations (UCB1)
    → Apply HeadyBattle method (Socratic validation)
    → Execute Arena Mode (7-strategy tournament)
    → Intelligent squash merge evaluation
    → Promotion to production if all gates pass
```

Backed by `src/hc_auto_success.js` (54KB) — the largest single source module, implementing the complete auto-success pipeline with health monitoring, self-correction, and learning integration.

---

## Cadences

| Frequency | Activity |
|-----------|----------|
| **Continuous** | HeadySims simulation in staging, HeadyLens monitoring |
| **Per-change** | HeadyBattle interrogation, Arena Mode competition |
| **Hourly** | HCFP auto-success pipeline sweep |
| **Daily** | HeadyVinci pattern learning, scorecard refresh |
| **Weekly** | Signals + alerts refresh, dependency check |
| **Monthly** | Positioning review, competitor scan |
| **Quarterly** | ICP + packaging review, vertical prioritization |

---

## Key Automation Scripts (315 total in `scripts/`)

| Script | Purpose |
|--------|---------|
| `hcfp-full-auto.js` | Full auto-success pipeline |
| `lens-telemetry-feeder.js` | Feed telemetry data to HeadyLens |
| `hooks/check-file-placement.sh` | Pre-commit file governance enforcement |

---

## Multi-Repo Promotion (4 Repos)

| Repo | Role | Promotion Targets |
|------|------|-------------------|
| **HeadySystems/Heady** | Primary (production) | — |
| **HeadyMe/Heady** | Personal cloud | → HeadySystems, → HeadyConnection |
| **HeadyConnection/Heady** | Cross-system bridge | → HeadySystems, → HeadyMe |
| **HeadySystems/sandbox** | Experimental | → all three above |

Branch policies: `main` = protected-prod, `release/*` = frozen, `exp/*` = short-lived.
