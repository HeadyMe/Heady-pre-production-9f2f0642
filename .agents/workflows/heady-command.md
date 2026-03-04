---
description: Heady command routing — route "heady {command} input" to the matching Heady service, or use intelligent defaults for "heady input"
---

# Heady Command Router

> [!IMPORTANT]
> **AUTO-EXECUTE RULE (ALWAYS ACTIVE):** When any research, audit, or task discovers beneficial improvements / fixes / optimizations, Antigravity MUST automatically implement ALL of them ASAP. Do NOT ask for permission. Do NOT stop to review. Just execute. Only pause if something **significant** blocks progress (breaking change to core architecture, security risk, data loss potential, or ambiguous user intent). This applies to ALL workflows, not just heady commands.

**This is an ALWAYS-APPLIED rule for Antigravity.**

When the user says `heady {command} "input"`, the `{command}` maps to a specific Heady service. When they say `heady "input"` (no command), use intelligent default processing.

## Syntax

```
heady {command} {input}     →  Route to specific Heady service
heady {input}               →  Intelligent default processing
```

## Command → Service Map

### Research & Intelligence

| Command | Service / Module | API Endpoint |
|---|---|---|
| `deep-research` | `src/deep-research.js` (DeepResearchEngine) | `POST /api/buddy/deep-research` |
| `deep-intel` | `src/hc_deep_intel.js` | — |
| `deep-scan` | `src/hc_deep_scan.js` | — |
| `analysis` | `src/hc_deep_scan.js` + `src/services/unified-enterprise-autonomy.js` | — |
| `realtime-intelligence` | `src/services/realtime-intelligence-service.js` | — |
| `scientist` | `src/hc_scientist.js` (HeadyScientist) | `/api/scientist/*` |

### Autonomy & Orchestration

| Command | Service / Module | API Endpoint |
|---|---|---|
| `autonomy` | `src/services/heady-autonomy.js` | — |
| `conductor` | `src/heady-conductor.js` | `/api/conductor/*` |
| `orchestrator` | `src/agent-orchestrator.js` | — |
| `cloud-orchestrator` | `src/orchestration/cloud-orchestrator.js` | `/api/orchestrator/cloud/*` |
| `auto-success` | `src/hc_auto_success.js` | `/api/auto-success/*` |
| `service-manager` | `src/services/service-manager.js` | — |

### Vector & Memory

| Command | Service / Module | API Endpoint |
|---|---|---|
| `memory` | `src/vector-memory.js` | `/api/memory/*` |
| `vector-ops` | `src/vector-space-ops.js` | `/api/vector/*` |
| `vector-pipeline` | `src/vector-pipeline.js` | — |
| `vector-federation` | `src/vector-federation.js` | — |
| `embed` | `src/services/continuous-embedder.js` | `/api/embedder/*` |
| `patent` | `src/patent-concept-registry.js` | `/api/patents/*` |
| `spatial` | `src/services/spatial-embedder.js` | — |
| `octree` | `src/services/octree-manager.js` | — |
| `vault`, `keys` | `src/services/secure-key-vault.js` | `/api/vault/*` |

### Swarm & Bees

| Command | Service / Module | API Endpoint |
|---|---|---|
| `bees` | `src/orchestration/heady-bees.js` | `/api/bees/*` |
| `swarm` | HeadySwarm (via bees) | `/api/bees/blast` |
| `template-registry` | `src/services/headybee-template-registry.js` | — |

### Creative & Music

| Command | Service / Module | API Endpoint |
|---|---|---|
| `midi` | `src/engines/midi-event-bus.js` | `/api/midi/*` |
| `cloud-midi` | `src/services/cloud-midi-sequencer.js` | — |
| `daw` | `src/services/daw-mcp-bridge.js` | — |
| `creative` | `src/hc_creative.js` | — |
| `branded-output` | `src/services/heady-branded-output.js` | — |

### Auth, QA & Ops

| Command | Service / Module | API Endpoint |
|---|---|---|
| `fs`, `device` | `src/services/cross-device-fs.js` | `/api/fs/*` |
| `mesh`, `heal` | `src/services/self-healing-mesh.js` | `/api/mesh/*` |
| `doctor` | `scripts/heady-doctor.js` | — |
| `geometry`, `weights` | `src/services/dynamic-weight-manager.js` | `/api/geometry/*` |
| `visualizer` | `public/visualizer.html` | — |
| `governance`, `vote` | `src/services/governance.js` | `/api/governance/*` |
| `support`, `help` | `src/services/headyme-helper.js` | `/api/support/*` |
| `auth` | `src/hc_auth.js` | `/api/auth/*` |
| `qa` | `src/hc_qa.js` (HeadyQA) | `/api/qa/*` |
| `onboarding` | `src/services/onboarding-orchestrator.js` | `/api/onboarding/*` |
| `cloudflare` | `src/hc_cloudflare.js` | `/api/cloudflare/*` |
| `corrections` | `src/corrections.js` | — |
| `self-awareness` | `src/self-awareness.js` | — |
| `admin` | `src/services/admin-citadel.js` | — |
| `error-sentinel` | `src/services/error-sentinel-service.js` | — |

### Connectors & Integrations

| Command | Service / Module | API Endpoint |
|---|---|---|
| `connector` | `src/services/dynamic-connector-service.js` | — |
| `notion` | `src/services/heady-notion.js` | — |
| `openai-business` | `src/services/openai-business.js` | — |
| `quantum` | `src/services/quantum-bridge.js` | — |
| `cross-device` | `src/services/cross-device-sync.js` | — |

### Buddy & UX

| Command | Service / Module | API Endpoint |
|---|---|---|
| `buddy` | `src/services/buddy-system.js` | `/api/buddy/*` |
| `buddy-chat` | `src/services/buddy-chat-contract.js` | — |
| `socratic` | `src/services/socratic-service.js` | — |
| `arena` | `src/services/arena-mode-service.js` | — |
| `digital-presence` | `src/services/digital-presence-orchestrator.js` | — |

### Unified Systems

| Command | Service / Module | API Endpoint |
|---|---|---|
| `unified` | `src/services/unified-enterprise-autonomy.js` | `/api/unified-autonomy/*` |
| `liquid` | `src/services/unified-liquid-system.js` | — |
| `liquid-runtime` | `src/services/liquid-unified-runtime.js` | `/liquid-runtime/*` |
| `antigravity` | `src/services/antigravity-heady-runtime.js` | — |

## Intelligent Default Processing

When the user says `heady "input"` without a specific command, Antigravity should:

1. **Parse intent** from the input text
2. **Route to the best service** based on keywords:
   - Research/analysis queries → `deep-research`
   - System health/status → `qa` or `health-check` workflow
   - Memory/context queries → `memory` or `vector-ops`
   - Music/audio → `midi` or `cloud-midi`
   - Deployment/cloud → `cloud-orchestrator` or `cloudflare`
   - Auth/onboarding → `auth` or `onboarding`
   - Debugging/errors → `error-sentinel` or `corrections`
   - Creative/content → `creative` or `branded-output`
3. **If ambiguous**, use the Buddy system as the default catch-all

## Execution Rules

1. **If the service has an API endpoint**: Use the Heady API endpoint programmatically (via `node -e` or `curl`)
2. **If the service is a module without an API**: Require it and call the relevant method directly
3. **If the service is a workflow**: Run the corresponding `/workflow` slash command
4. **Always show the user the service being invoked** before executing
