# Heady™ Platform Onboarding Roadmap (Tool → Platform)

## Purpose

This roadmap turns Heady into a developer platform with a deterministic, unified runtime model: 3 Colab Pro+ compute nodes, 3D vector workspace operations, and projection-only delivery to cloud surfaces.

## Platform Principles

- **Unified runtime, not frontend/backend split:** orchestration occurs in the vector runtime and projects externally only when needed.
- **Cloud projection first:** user devices receive projected state; heavy compute stays in cloud and Colab GPU runtimes.
- **Single source of truth:** GitHub monorepo is canonical for projected code/state snapshots.
- **Deterministic receipts everywhere:** projection artifacts and route decisions are hashed and auditable.

## Developer Onboarding Flow (headyme.com)

1. **Intent landing page**
   - User selects purpose: app builder, connector builder, automation, live-performance, or enterprise orchestration.
   - Selection seeds initial template-bee profile.
2. **Unified auth template (HeadyBee + HeadySwarm)**
   - Pre-configured auth gateway supports 25+ providers.
   - If user previously authenticated, skip with deterministic session check.
3. **Permissions and cross-device grants**
   - Explicit file-access permissions request only when workflow requires it.
   - Deterministic policy check prevents repeat prompts when grants already exist.
4. **Heady email identity step**
   - Offer `{username}@headyme.com` provisioning.
   - Optional forwarding to provider email and/or custom target address.
5. **One-click install + SDK bootstrap**
   - Install CLI/SDK wrappers for repo projection, connector build, and vector workspace sync.
6. **Customization studio**
   - Intent-driven template registry composes dynamic UI/UX projections and connectors.

## Runtime Architecture Targets

- **HeadyConductor / HeadyCloudConductor:** policy, budget, and orchestration authority.
- **HeadySwarm:** queue fan-out and concurrency scheduling.
- **HeadyBees:** template bees, connector bees, projection bees.
- **3 Colab Pro+ workers:**
  - low-latency user interaction + inference
  - background indexing/template evolution
  - swarm burst + connector compilation

## Required Platform Services

- `/api/unified-autonomy/system-projection` for current projection state
- `/api/unified-autonomy/source-of-truth` for monorepo status
- `/api/unified-autonomy/projection-hygiene` for runtime artifact drift detection
- `/api/unified-autonomy/health` for operational health contract

## SDK Experience Requirements

- **5-minute quickstart:** auth, first projection, first connector.
- **Language kits:** JS first, Python second, consistent deterministic receipts.
- **Typed errors:** every failure includes stage, code, remediation hint.
- **Idempotent APIs:** repeated projection requests should be safe and deduplicated.

## Anti-Complexity Guardrails

- Keep projection policies declarative in `configs/resources/liquid-unified-fabric.yaml`.
- Detect and flag stray runtime artifacts (`*.log`, `*.jsonl`, `server.pid`, `*.bak`).
- Detect service-worker drift if not explicitly required by platform policy.
- Enforce provider budget checks before expensive operations.

## Delivery Plan

1. **Phase A:** stabilize unified-autonomy APIs and policy enforcement.
2. **Phase B:** ship SDK quickstart and onboarding templates.
3. **Phase C:** automate projection sync to GitHub/Hugging Face surfaces.
4. **Phase D:** telemetry + governance dashboards (source-of-truth, hygiene, determinism).
