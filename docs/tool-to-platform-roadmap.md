# Heady™ Tool-to-Platform Roadmap (Unified Liquid Paradigm)

## Objective

Move Heady from a utility workflow into a developer platform that is:

- deterministic and autonomous,
- easy to onboard,
- cloud-projected from a single GitHub monorepo source of truth,
- driven by HeadyConductor + HeadyCloudConductor + HeadySwarm + HeadyBees.

## Current Baseline in Repo

- Unified autonomy runtime + routes: `src/services/unified-enterprise-autonomy.js`
- 3-colab orchestration policy: `configs/resources/colab-pro-plus-orchestration.yaml`
- Vector ingestion sources: `configs/resources/vector-embedding-catalog.yaml`
- Liquid-fabric projection policy: `configs/resources/liquid-unified-fabric.yaml`
- Platform onboarding blueprint: `configs/resources/developer-platform-blueprint.yaml`

## Platform Architecture (No Frontend/Backend Split)

Heady operates as a **unified liquid fabric** where UI/API projections are generated views of current vector-space state.

### Runtime planes

1. **Projection plane**
   - Projects current state to `headyme.com`, Hugging Face sites, and SDK clients.
2. **Builder plane**
   - Assembles dynamic UIs, connectors, and service wrappers from templates.
3. **Orchestration plane**
   - Coordinates conductor/swarm/bee execution and deterministic receipts.

## Developer Onboarding Blueprint

Start at `https://headyme.com` and drive users through deterministic stages:

1. **Auth provider select** (25+ providers via preconfigured auth templates).
2. **Permissions grant** (cross-device filesystem + repo sync + connector deploy).
3. **Username provisioning** (`{username}@headyme.com`, mailbox or forwarding mode).
4. **One-click install** (CLI + extension + IDE connector).
5. **Intent customization** (auto-generate custom UX/UI + connectors from intent).

## SDK + Service Adoption Model

- Provide one canonical SDK initialization path with stable defaults.
- Bind SDK calls to `/api/unified-autonomy/platform-blueprint` and `/api/unified-autonomy/system-projection` for deterministic metadata bootstrapping.
- Generate language-specific wrappers from one OpenAPI contract to avoid drift.

## Governance + Quality Gates

- Maintain GitHub monorepo-only source-of-truth policy.
- Continuously scan tracked files for runtime artifact drift (`*.bak`, `*.log`, `*.jsonl`, `server.pid`).
- Keep service-worker usage explicit via allowlist, not ad-hoc inclusion.
- Enforce deterministic receipts in projection snapshots and workflow dispatches.

## Delivery Plan

### Phase 1 — Platform contract hardening

- Stabilize projection, source-of-truth, and hygiene endpoints.
- Add typed schema validation for blueprint/projection payloads.

### Phase 2 — Onboarding productization

- Build onboarding templates directly from `developer-platform-blueprint.yaml`.
- Add idempotent auth/permission checks (skip completed stages).

### Phase 3 — SDK expansion

- Publish SDK quickstart packages with one-command install and local dev simulation mode.
- Add webhook + event-stream subscriptions for state projection updates.

### Phase 4 — Autonomous projection operations

- Run scheduled projection diffs to GitHub and Hugging Face targets.
- Add rollback/receipt replay for deterministic remediation.

## Secure Local Bridge + Projection Mechanics

- Use **File System Access API** for explicit, user-granted workspace mounting during onboarding (`permissions-grant` stage).
- Persist granted handles and onboarding state using **IndexedDB serialization** so users skip repeated permission prompts.
- Use **npx-based one-click wrappers** as the bootstrap surface for SDK install and runtime connector setup.
- Use **Model Context Protocol (MCP)** as the main contract between projected UI surfaces and autonomous runtime.
- Keep core execution in the three Colab Pro+ notebooks and project only synchronized, current state to public surfaces.
