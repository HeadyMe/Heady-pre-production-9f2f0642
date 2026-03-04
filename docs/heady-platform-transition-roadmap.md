# Heady Platform Transition Roadmap (Tool → Platform)

## Objective

Move Heady from a powerful internal toolset to a developer-ready platform centered on **unified liquid architecture**, where the runtime is projected as a continuously updated system view and consumed through platform APIs/SDKs.

## Current Foundation in Repo

- Unified autonomy runtime services and routes in `src/services/unified-enterprise-autonomy.js`.
- Deterministic Colab orchestration plan in `configs/resources/colab-pro-plus-orchestration.yaml`.
- Vector-template and projection architecture in `configs/resources/vector-embedding-catalog.yaml` and autonomy modules under `src/autonomy/`.

## Platform North-Star

1. **Single source of truth:** GitHub monorepo remains canonical system state.
2. **Cloud-first projection:** User devices mostly render projected state, not execute heavy orchestration.
3. **Intent-driven onboarding:** Start at `https://headyme.com`, complete identity and permissions once, then launch use-case-tailored Heady UIs.
4. **Template-driven generation:** Preconfigured HeadyBee/HeadySwarm templates generate connectors/apps/workflows from user intent.

## Implementation Tracks

### Track A — Developer Onboarding Plane

- Add declarative onboarding config (`configs/resources/developer-platform-onboarding.yaml`) with:
  - 25+ auth providers,
  - permission grant lifecycle,
  - one-click install strategy,
  - `@headyme.com` email provisioning/forwarding options,
  - runtime projection targets.
- Expose onboarding blueprint via API so SDK and UIs are generated from the same source.

### Track B — Projection Governance Plane

- Keep liquid fabric policy config as source for:
  - source-of-truth governance,
  - projection hygiene rules,
  - staleness and transport targets.
- Surface runtime introspection endpoints that emit deterministic receipts for state replay/auditing.

### Track C — SDK & Platform Packaging

- SDK should consume `developer-platform-blueprint` for dynamic bootstrap.
- Generate language SDK quickstarts from the same config contract.
- Add CLI bootstrap path: one command to authenticate, register project intent, and sync projection.

### Track D — Enterprise Operations

- Budget-aware routing before provider calls and full usage recording per call.
- Deterministic receipts for projection snapshots and critical orchestration state transitions.
- CI gates for audit/SAST/SBOM enforced per AGENTS policy.

## Recommended Delivery Phases

1. **Phase 1 (Now):** Config + endpoint contracts for onboarding/projection governance.
2. **Phase 2:** SDK bootstrap + hosted docs portal with live API examples.
3. **Phase 3:** Intent-to-template marketplace for dynamic app/connector generation.
4. **Phase 4:** Usage analytics, quota controls, and enterprise admin controls.

## Success Metrics

- Time to first successful SDK integration < 10 minutes.
- Auth + permissions completion rate > 85%.
- Projection freshness within configured staleness budget.
- Deterministic receipt coverage across all projection and orchestration endpoints.
