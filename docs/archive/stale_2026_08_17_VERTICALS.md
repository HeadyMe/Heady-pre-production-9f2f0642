<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady — 17 Vertical Playbooks

> Each vertical ships on the same core primitives: Proof View, Policy Ladder, Connector Trust Model, Arena Mode.  
> **Source:** `src/verticals.json` (27KB), `src/generate-verticals.js` (31KB)

---

## Playbook Format

Each vertical follows a standard structure:

- **Buyer** — Who pays
- **Killer Workflow** — The one thing that proves value in 5 minutes
- **Surfaces** — Which Heady products are used
- **Integrations** — MCP connectors + external tools
- **Policy** — Permission ladder configuration
- **Metrics** — Success KPIs
- **Demo Script** — "Try this now" onboarding
- **Heady-Only Upgrade** — What competitors can't do

---

## 1. HeadyMe — Personal Cloud Hub

| Field | Detail |
|-------|--------|
| **Buyer** | Individual prosumer / power user |
| **Killer Workflow** | "Show me everything I worked on this week across all devices, and what's left" |
| **Surfaces** | HeadyMe dashboard (`app.headyme.com`), HeadyBuddy, HeadyBot |
| **Integrations** | Calendar, email, file storage, GitHub, Notion |
| **Policy** | L0–L1 (read/suggest only for personal data) |
| **Metrics** | DAU, tasks completed, memory utilization |
| **Demo Script** | Sign up → Buddy asks what you're working on → auto-generates daily plan |
| **Heady-Only** | Cross-device memory continuity + Arena Mode for personal task optimization |

---

## 2. HeadySystems — Platform Operations

| Field | Detail |
|-------|--------|
| **Buyer** | Platform/DevOps team lead |
| **Killer Workflow** | "Show me all services, their health, and what needs attention — with auto-fix proposals" |
| **Surfaces** | HeadyMe Admin, HeadyLens, HeadyOps |
| **Integrations** | PM2, Cloudflare, Docker, Coolify, GitHub Actions |
| **Policy** | L0–L3 (full ladder with human approval for destructive ops) |
| **Metrics** | Uptime %, MTTR, infrastructure cost, drift events |
| **Demo Script** | Open admin → see 18 PM2 processes → click unhealthy → Arena proposes 3 fixes |
| **Heady-Only** | Self-healing with Arena Mode competition for best remediation strategy |

---

## 3. HeadyConnection — Nonprofit Impact

| Field | Detail |
|-------|--------|
| **Buyer** | Nonprofit exec / program manager |
| **Killer Workflow** | "Generate a grant application for our new community program using our data" |
| **Surfaces** | HeadyConnection dashboard (`app.headyconnection.org`), HeadyBuddy |
| **Integrations** | Donor CRM, impact tracking, document generation |
| **Policy** | L0–L2 (write requires board-level HeadyBattle approval for public output) |
| **Metrics** | Grants submitted, impact reports generated, volunteer engagement |
| **Demo Script** | Describe program → AI drafts grant → HeadyBattle validates claims → export |
| **Heady-Only** | Proof View shows exactly what data supports each claim in grant applications |

---

## 4. HeadyMCP — Connector Marketplace

| Field | Detail |
|-------|--------|
| **Buyer** | Developer building AI integrations |
| **Killer Workflow** | "Find a connector for Stripe, verify it's safe, install it with one click" |
| **Surfaces** | HeadyMCP registry (`headymcp.com` / `api.headymcp.com`) |
| **Integrations** | npm, GitHub, security scanners, usage telemetry |
| **Policy** | Connector Trust Model (verified publishers, quality scores, permission scopes) |
| **Metrics** | Connectors published, installs, security incidents, publisher ratings |
| **Demo Script** | Browse → search "payments" → see Stripe connector (verified ✓) → install → use in Buddy |
| **Heady-Only** | Trust scoring + governance pipeline that competitors' registries lack |

---

## 5. HeadyIO — Developer Portal

| Field | Detail |
|-------|--------|
| **Buyer** | Developer / technical architect |
| **Killer Workflow** | "Show me how to add AI to my app in 5 minutes using the Heady API" |
| **Surfaces** | HeadyIO (`headyio.com` / `api.headyio.com`), HeadyAPI |
| **Integrations** | API sandbox, code examples, SDK packages |
| **Policy** | L0–L1 (read + generate code; write via authenticated API keys) |
| **Metrics** | Time to first API call, API requests/day, SDK downloads |
| **Demo Script** | Copy API key → `curl api.headyio.com/v1/chat` → get ensemble response → see Proof View receipt |
| **Heady-Only** | Ensemble-first response with 7-node routing visible in receipt |

---

## 6. HeadyBuddy — AI Companion

| Field | Detail |
|-------|--------|
| **Buyer** | Knowledge worker / prosumer |
| **Killer Workflow** | "Hey Buddy, summarize my unread messages and draft replies" |
| **Surfaces** | HeadyBuddy (`headybuddy.org` / `app.headybuddy.org`), browser extension, voice |
| **Integrations** | Email, calendar, Slack, browser tabs, HeadyMemory |
| **Policy** | L0–L2 (actions on external services require user approval) |
| **Metrics** | DAU, sessions/day, tasks executed, memory items stored |
| **Demo Script** | Open Buddy → say "What should I focus on?" → get prioritized task list from memory |
| **Heady-Only** | Persistent memory across devices + Arena Mode for task strategy selection |

---

## 7. HeadyBot — Automation Engine

| Field | Detail |
|-------|--------|
| **Buyer** | Ops/automation lead |
| **Killer Workflow** | "Set up a bot that monitors my sites and restarts any that crash" |
| **Surfaces** | HeadyBot (`headybot.com` / `app.headybot.com`), webhooks, CLI |
| **Integrations** | PM2, GitHub, Slack, email, custom webhooks |
| **Policy** | L0–L3 (destructive automations require human approval) |
| **Metrics** | Automations deployed, tasks executed/day, MTTR |
| **Demo Script** | Create rule: "If site-headybuddy crashes → restart → notify Slack" → test → see execution receipt |
| **Heady-Only** | 115 continuous background tasks + self-healing via HCFP auto-success |

---

## 8. HeadyCreator — AI Creative Studio

| Field | Detail |
|-------|--------|
| **Buyer** | Designer / content creator |
| **Killer Workflow** | "Generate a hero image for my landing page in our brand style" |
| **Surfaces** | HeadyCreator, HeadyVinci canvas (`vinci-canvas.js`), HeadyLens |
| **Integrations** | Image generation APIs, brand asset libraries, export formats |
| **Policy** | L0–L2 (publish requires brand compliance check) |
| **Metrics** | Assets generated, time saved vs manual, brand compliance score |
| **Heady-Only** | Arena Mode competes 4+ creative variations; HeadyBattle validates brand alignment |

---

## 9–17. Remaining Verticals (Summary)

| # | Vertical | Buyer | Killer Workflow |
|---|----------|-------|-----------------|
| 9 | **HeadyMusic** | Musicians / producers | AI-generated compositions + smart playlist creation |
| 10 | **HeadyTube** | Video creators | AI-enhanced video editing + auto-generated content |
| 11 | **HeadyCloud** | DevOps / platform teams | Scalable AI compute orchestration on demand |
| 12 | **HeadyLearn** | Students / educators | Adaptive learning paths + AI tutoring |
| 13 | **HeadyStore** | AI entrepreneurs | Buy/sell AI plugins, templates, trained agents |
| 14 | **HeadyStudio** | Professional developers | Multi-project workspace with cross-project memory |
| 15 | **HeadyAgent** | AI builders | Build, deploy, manage autonomous AI agents |
| 16 | **HeadyData** | Analysts / data teams | AI-powered data ingestion, processing, visualization |
| 17 | **HeadyAPI** | Developers | Public documented API gateway to entire Heady ecosystem |

Each follows the same playbook format: buyer → killer workflow → surfaces → integrations → policy (L0–L3) → metrics → demo script → Heady-only upgrade.

---

## Shared Primitives Across All 17

| Primitive | What It Does | Where It's Built |
|-----------|-------------|------------------|
| **Proof View** | Displays action receipts (models, tools, costs, scores) | Frontend component + `memory.js` / `hcfp.js` routes |
| **Policy Ladder** | L0–L3 permission escalation with HeadyBattle gating | HeadyManager middleware |
| **Connector Trust** | Verified MCP connectors with quality scores | HeadyMCP registry |
| **Arena Mode** | 7-strategy tournament with Monte Carlo scoring | `arena-mode-service.js` + `monte-carlo-service.js` |
| **HeadyMemory** | Persistent vector memory with 3D embedding | `vector-memory.js` + `vector-federation.js` |
| **HeadyBattle** | Socratic validation gate | `socratic-service.js` |
