# Repo Scan Summary

## Scope

This pack was designed from a scan of the public HeadyMe repository surface with the main architecture extracted from `Heady-pre-production-9f2f0642` and the projected repo shells compared against it.

Primary sources:
- https://github.com/HeadyMe
- https://github.com/HeadyMe/Heady-pre-production-9f2f0642
- https://github.com/HeadyMe/headyme-core
- https://github.com/HeadyMe/headymcp-core
- https://github.com/HeadyMe/headysystems-core
- https://github.com/HeadyMe/headybuddy-core
- https://github.com/HeadyMe/headyos-core
- https://github.com/HeadyMe/headybot-core
- https://github.com/HeadyMe/heady-docs

## Main findings

### 1. The bee factory is already strong

The main repo contains a runtime bee factory with dynamic domain creation, ephemeral bee spawning, work-unit injection, and template-based creation patterns. That makes it realistic to standardize the template layer instead of replacing the runtime.

Evidence paths from the scanned repo:
- `src/bees/bee-factory.js`
- `src/bees/registry.js`
- `src/bees/bee-template.js`

### 2. Template registry logic is duplicated

The scan found overlapping registry and optimization logic in:
- `src/services/headybee-template-registry.js`
- `src/agents/headybee-template-registry.js`
- `src/autonomy/heady-template-registry.js`
- `src/agents/template-registry-optimizer.js`
- `src/routes/headybee-templates.js`

The biggest improvement opportunity is consolidation into one canonical catalog plus adapters.

### 3. Scenario coverage exists but is split

Scenario selection exists in both:
- `src/config/headybee-template-scenarios.json`
- `configs/autonomy/headybee-template-matrix.yaml`

Those files express useful intent, but they use different structures and cannot serve as a single durable source of truth.

### 4. Swarm definitions are rich but inconsistent

The scan found one highly explicit UI-oriented swarm model and one broader swarm matrix:
- `src/onboarding/headyswarm-ui-configs.js`
- `configs/HeadySwarmMatrix.json`

Together they suggest that HeadySwarm needs one normalized schema that can drive runtime orchestration, UI/control-plane views, health checks, and projection planning.

### 5. Projection contracts are promising but the projected repos are thin

The projection layer is defined in:
- `configs/projection/projection-contracts.yaml`
- `configs/projection/projection-manifest.template.json`

But the projected repos such as `headyme-core`, `headymcp-core`, and `headysystems-core` are still mostly minimal Express shells with a health route and basic home page. The projection manifests in this pack are designed to give those repos a richer domain-specific surface.

### 6. Runtime and deployment hooks already exist

The scan found strong signals for autonomous setup and deployment in:
- `package.json` scripts such as `headybee:optimize`, `vector:project`, `system:sync`, `unified:runtime`, `rebuild:unified`, and `rebuild:autonomy`
- `configs/pipeline/dynamic-parallel-resource-allocation.yaml`
- `configs/autonomy/unified-liquid-runtime.yaml`
- `configs/observability/observability.yaml`
- `configs/resources/performance-budgets.yaml`
- `configs/governance/node-responsibility-matrix.yaml`
- `configs/governance/workflow-ownership.yaml`

## Recommended architecture

### Canonical layers

1. Schema layer
   - `templates/schemas/headybee-template.schema.json`
   - `templates/schemas/headyswarm-template.schema.json`
2. Canonical catalog layer
   - `registry/heady-template-catalog.json`
3. Scenario and optimization layer
   - `registry/scenario-matrix.yaml`
   - `configs/autonomy/heady-template-optimization-policy.yaml`
4. Runtime adapter layer
   - `adapters/node/headybee-template-registry.service.js`
   - `adapters/node/headyswarm-template-registry.service.js`
   - `adapters/node/autonomous-template-optimizer.js`
   - `adapters/node/projection-manifest-generator.js`

### What to retire or demote

Retire duplicated registry logic as primary sources and keep them only as compatibility shims until migration is complete.

## Source notes

This summary is based on local reads of the cloned repos and on the public GitHub repos listed above.
