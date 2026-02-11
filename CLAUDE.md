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
<!-- ║  FILE: CLAUDE.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                     ║ -->
<!-- ║  █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║█║  █║ ╚████╔╝                      ║ -->
<!-- ║  █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                       ║ -->
<!-- ║  █║  █║███████╗█║  █║██████╔╝   █║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: CLAUDE.md                                                  ║ -->
<!-- ║  LAYER: root                                                      ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# HEADY SYSTEMS | CLAUDE CODE INTEGRATION PROTOCOL

## SYSTEM IDENTITY

You are operating inside the **HeadyMonorepo** — the canonical implementation of
**HCFullPipeline** and the **Heady Orchestrator-Conductor** system.

Your goal: run as an **intelligent, parallel, dynamically distributed, optimized,
deterministic, and secure** execution environment for Heady workloads, both local
and remote.

## TECH STACK

- **Manager:** Node.js (Express, MCP Protocol) — `heady-manager.js` on port 3300
- **Worker:** Python (Render Worker) — `src/heady_project/heady_conductor.py`
- **Frontend:** React with Sacred Geometry Aesthetics (Rounded, Organic, Breathing)
- **Pipeline Engine:** `src/hc_pipeline.js` — loads YAML configs, runs stages
- **Deployment:** Render.com Blueprint (`render.yaml`)
- **Packages:** `packages/` — networking, hc-supervisor, hc-checkpoint, hc-brain, hc-readiness, hc-health

## CRITICAL PATHS

| Path | Purpose |
|------|---------|
| `heady-manager.js` | Node.js MCP server & API gateway (port 3300) |
| `src/hc_pipeline.js` | HCFullPipeline runtime engine |
| `src/agents/` | Agent implementations (builder, researcher, deployer, claude-code) |
| `configs/` | All YAML configs (pipeline, resources, services, governance, data, concepts, IP) |
| `packages/networking/` | Direct no-proxy HTTP client for internal calls |
| `packages/hc-supervisor/` | Multi-agent Supervisor pattern (parallel fan-out) |
| `packages/hc-checkpoint/` | Checkpoint protocol analyzer |
| `packages/hc-brain/` | System Brain meta-controller |
| `packages/hc-readiness/` | Operational readiness evaluator |
| `packages/hc-health/` | Node health checks + cron integration |
| `public/` | Sacred Geometry React UI |
| `frontend/` | Vite React frontend |
| `scripts/` | PowerShell ops scripts |
| `render.yaml` | Infrastructure as Code |

## HCFULLPIPELINE STAGES

The pipeline runs in strict dependency order with checkpoints at each stage:

```
ingest → plan → execute-major-phase → recover → finalize
```

Each stage is defined in `configs/hcfullpipeline.yaml`. At every checkpoint,
the system **deeply re-analyzes** state, configs, and patterns — this is the
primary self-correction moment.

### Stop Rule
> Build aggressively when healthy; repair first when not.
> Do NOT keep building when significant errors exist in core infra, data integrity, or security.

## CONFIGS (Source of Truth)

All pipeline definitions, resource rules, and concept indexes live in `configs/`:

| File | Purpose |
|------|---------|
| `hcfullpipeline.yaml` | Master pipeline definition, stages, stop rules, checkpoint protocol |
| `resource-policies.yaml` | Concurrency, rate limits, cost budgets, retry/backoff, circuit breakers |
| `service-catalog.yaml` | All services, agents, tools, SLOs, external integrations |
| `governance-policies.yaml` | Access control, data domains, cost governance, change policies, security |
| `data-schema.yaml` | Layered data model (L0→L3), persistent/ephemeral storage schemas |
| `concepts-index.yaml` | Implemented, planned, and public-domain pattern tracking |
| `system-components.yaml` | Canonical registry of ALL system components |
| `app-readiness.yaml` | Business-level health probes, readiness scoring |
| `ip-registry.yaml` | Owned IP, licensed components, public-domain patterns in use |
| `public-domain-patterns.md` | Registry of beneficial patterns available for integration |

## ENVIRONMENT VARIABLES

- `DATABASE_URL` — Postgres connection (from Render)
- `HEADY_API_KEY` — Auto-generated API key
- `ANTHROPIC_API_KEY` — Claude API key (for Claude Code agent)
- `PORT` — Server port (default 3300)
- `NODE_ENV` — Environment (development/production)

## CLAUDE CODE AGENT ROLE

You are registered as the `claude-code` agent in the Supervisor pattern.
Your skills: `code-generation`, `code-analysis`, `refactoring`, `architecture`, `debugging`.

When invoked by the Supervisor during `execute-major-phase`:
1. You receive a task with context (stage, configs, prior results).
2. You execute the task using your coding capabilities.
3. You return structured results to the Supervisor for aggregation.

### Direct Routing Protocol
- All calls between Supervisor and agents use **direct routing** (no proxy).
- Use the `@heady/networking` client with `proxy: false` for internal calls.
- External API calls go through circuit breakers with retry + backoff.

## NAMING STANDARDS FOR AGENTS

When showing URLs or paths to the user, always use canonical domains and abstract roots (HEADY_PROJECT_ROOT, HEADY_DATA_ROOT). Never emit drive letters, localhost, raw Render domains, or private IPs.

When you need to be precise for engineers, refer to internal dev hosts as manager.dev.local.heady.internal:3300 etc., never C:\ or .onrender.com.

## CODING CONVENTIONS

- **Brand Header:** All source files start with `HEADY_BRAND:BEGIN` / `HEADY_BRAND:END` block
- **Style:** Standard Node.js (CommonJS `require`), Python 3.x for workers
- **Config:** YAML in `configs/`, JSON for registries
- **Testing:** Jest for Node.js, pytest for Python
- **Security:** Timing-safe API key validation, no hardcoded secrets, least-privilege access

## OPERATIONAL READINESS

Operational Readiness Score (ORS) 0–100, computed at each checkpoint:
- **>85:** Full parallelism, aggressive building, new optimizations allowed
- **70–85:** Normal operation, standard parallelism
- **50–70:** Maintenance mode, reduced load, no new large builds
- **<50:** Recovery mode, repair only, escalate to owner

## CHECKPOINT PROTOCOL

At each checkpoint, you MUST:
1. **Validate run state** — pipeline def + resource policies still current
2. **Compare config hashes** — detect drift from repo state
3. **Re-evaluate health** — bottlenecks, errors, spend vs budget
4. **Check concept alignment** — which patterns active, suggest missing
5. **Apply approved patterns** — gradual enablement at boundaries
6. **Sync registry entries** — update HeadyRegistry with new versions, endpoints, statuses
7. **Sync documentation** — update all docs that reference changed APIs/schemas/configs
8. **Validate notebooks** — ensure Colab notebooks still parse and reference correct APIs
9. **Check doc ownership freshness** — flag overdue reviews per `docs/DOC_OWNERS.yaml`
10. **Report** — comprehensive status with concept usage + config hashes

> Full protocol: `docs/CHECKPOINT_PROTOCOL.md`
> Automation: `scripts/checkpoint-sync.ps1`
> Workflow: `.windsurf/workflows/checkpoint-sync.md`

### Standing Rule
Outdated documentation is treated as a defect. When a mismatch between docs
and behavior is detected, create an incident task and prevent that class of
drift in future.

## COMMANDS

```bash
# Start the system
npm start                          # Start heady-manager on port 3300

# Pipeline operations
curl -X POST localhost:3300/api/pipeline/run     # Trigger pipeline run
curl localhost:3300/api/pipeline/state            # Current run state
curl localhost:3300/api/pipeline/config           # Pipeline config summary
curl localhost:3300/api/pipeline/dag              # Stage dependency graph
curl localhost:3300/api/pipeline/history          # Run history
curl localhost:3300/api/pipeline/circuit-breakers # Circuit breaker status
curl localhost:3300/api/pipeline/log              # Pipeline log entries

# Claude Code direct access
curl -X POST localhost:3300/api/pipeline/claude -d '{"prompt":"..."}'        # Ad-hoc Claude execution
curl -X POST localhost:3300/api/pipeline/claude/analyze -d '{"paths":["src/"]}' # Code analysis
curl -X POST localhost:3300/api/pipeline/claude/security                     # Security audit

# Supervisor (multi-agent routing)
curl localhost:3300/api/supervisor/status                                     # Agent status
curl -X POST localhost:3300/api/supervisor/route -d '{"type":"build"}'       # Route task to agents

# System Brain
curl localhost:3300/api/brain/status                                         # Brain status + readiness
curl -X POST localhost:3300/api/brain/tune -d '{"errorRate":0.05}'           # Auto-tune concurrency
curl -X POST localhost:3300/api/brain/governance-check -d '{"action":"execute","actor":"builder","domain":"build"}'
curl -X POST localhost:3300/api/brain/evaluate-pattern -d '{"patternId":"circuit-breaker"}'

# Readiness Evaluator
curl localhost:3300/api/readiness/evaluate                                   # Run readiness probes
curl localhost:3300/api/readiness/history                                    # Evaluation history

# Health Checks
curl localhost:3300/api/health-checks/snapshot                               # Current health snapshot
curl -X POST localhost:3300/api/health-checks/run                            # Run all checks now
curl localhost:3300/api/health-checks/history                                # Check history

# Checkpoint Analyzer
curl -X POST localhost:3300/api/checkpoint/analyze -d '{"stage":"manual"}'   # Run checkpoint analysis
curl localhost:3300/api/checkpoint/records                                    # Checkpoint records

# Combined overview
curl localhost:3300/api/subsystems                                           # All subsystem status
curl localhost:3300/api/agents/claude-code/status                            # Claude Code agent status

# Registry API
curl localhost:3300/api/registry                             # Full registry catalog
curl localhost:3300/api/registry/component/heady-manager      # Lookup component
curl localhost:3300/api/registry/environments                 # List environments
curl localhost:3300/api/registry/docs                         # List registered docs
curl localhost:3300/api/registry/notebooks                    # List registered notebooks
curl localhost:3300/api/registry/patterns                     # List patterns
curl localhost:3300/api/registry/workflows                    # List workflows
curl localhost:3300/api/registry/ai-nodes                     # List AI nodes

# System status
curl localhost:3300/api/health                    # Health check
curl localhost:3300/api/system/status             # Full system status
curl localhost:3300/api/nodes                     # Node status
curl -X POST localhost:3300/api/system/production # Activate production mode

# Build & Deploy
.\commit_and_build.ps1             # Local build cycle
.\nexus_deploy.ps1                 # Push to all remotes
.\heady_sync.ps1                   # Multi-remote sync

# Checkpoint Sync
.\scripts\checkpoint-sync.ps1                    # Full checkpoint sync
.\scripts\checkpoint-sync.ps1 -Mode check        # Read-only drift detection
.\scripts\checkpoint-sync.ps1 -Mode fix          # Auto-fix issues
.\scripts\checkpoint-sync.ps1 -Mode report       # Generate report only

# Health check script
.\scripts\ops\node-health-check.ps1              # NHC-style health check
```

## SCRIPTS

| Script | Purpose |
|--------|---------|
| `commit_and_build.ps1` | Local build cycle |
| `nexus_deploy.ps1` | Push to all remotes |
| `heady_sync.ps1` | Multi-remote git sync |
| `hcautobuild.ps1` | Automated build pipeline |
| `heady_protocol.ps1` | Protocol enforcement |
| `scripts/auto-checkpoint.ps1` | Automated checkpoint saves |
| `scripts/checkpoint-sync.ps1` | Checkpoint Protocol sync (all files) |
| `scripts/hc.ps1` | HC CLI tool |

## KEY DOCUMENTATION

| Path | Purpose |
|------|---------|
| `docs/CHECKPOINT_PROTOCOL.md` | Master protocol for keeping all files in sync at every checkpoint |
| `docs/DOC_OWNERS.yaml` | Document ownership, review dates, and freshness tracking |
| `docs/notion-quick-start.md` | Notion Quick Start notebook template (exportable) |
| `docs/notion-project-notebook.md` | Notion Project Notebook template (exportable) |
| `docs/heady-services-manual.md` | Comprehensive services manual |
| `heady-registry.json` | HeadyRegistry — central catalog of all components, workflows, environments, docs, notebooks |
| `configs/notebook-ci.yaml` | Notebook CI validation configuration |
| `notebooks/` | Colab notebooks (quick-start, tutorials, examples) |

## DETERMINISM RULE

Given the same input, `hcfullpipeline.yaml`, `resource-policies.yaml`, and
dependency versions, the system MUST produce the same plan graph and same
task routing decisions. Randomness is seeded and logged per run.

## SYSTEM PROMPT (Embeddable)

```
You are the HCFullPipeline Orchestrator-Conductor for the HeadyMonorepo.
Operate as an intelligent, parallel, dynamically distributed, optimized,
deterministic, and secure system for all Heady workloads (local and remote).
Use the versioned pipeline definitions, resource policies, and concept indexes
in this repository as your single source of truth.
At each checkpoint, deeply re-analyze system state, configs, and patterns;
update plans, tune resources, apply or recommend public-domain best practices,
and send a comprehensive status report to the owner.
Maintain explicit awareness of which architectural concepts and public-domain
patterns are implemented, which are pending, and which are not applicable.
Integrate beneficial, legally and ethically acceptable patterns where they
improve reliability, performance, or safety, without violating Heady's data
ownership, security, or social impact goals.
