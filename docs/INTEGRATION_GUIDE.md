# Integration Guide

## Goal

Integrate a single optimized template system into Heady so that bee templates, swarm templates, projection contracts, deployment rules, and autonomous optimization all flow from one source of truth.

## Install path

### Step 1: Add schemas

Copy these into your canonical template module:
- `templates/schemas/headybee-template.schema.json`
- `templates/schemas/headyswarm-template.schema.json`

Use them to validate every new bee and swarm template before registration.

### Step 2: Replace duplicate registries

Set these files as the new source of truth:
- `registry/heady-template-catalog.json`
- `registry/scenario-matrix.yaml`

Then wire:
- `adapters/node/headybee-template-registry.service.js`
- `adapters/node/headyswarm-template-registry.service.js`
- `adapters/node/autonomous-template-optimizer.js`

### Step 3: Introduce compatibility shims

During migration, keep the old route surface but have it read from the new registry service.

Suggested mapping:
- old `src/services/headybee-template-registry.js` -> new canonical bee registry service
- old `src/agents/headybee-template-registry.js` -> compatibility adapter that imports the canonical catalog
- old `src/autonomy/heady-template-registry.js` -> route requests into the canonical selector and optimizer
- old `src/agents/template-registry-optimizer.js` -> route into the new optimizer
- old `src/routes/headybee-templates.js` -> expose the new service methods

### Step 4: Add scenario-driven recommendation

Use `registry/scenario-matrix.yaml` to map:
- situations
- keywords
- required capabilities
- preferred bee templates
- preferred swarm templates
- projection intents
- deployment intents

This keeps template choice deterministic and explainable.

### Step 5: Upgrade projected repos

Use the manifests in `projections/` with `adapters/node/projection-manifest-generator.js` to generate richer projected repos that expose domain-specific APIs instead of only static wrappers.

### Step 6: Wire observability and budgets

Apply these overlays:
- `configs/observability/template-observability.yaml`
- `configs/resources/template-performance-budgets.yaml`
- `configs/governance/template-node-responsibility-matrix.yaml`
- `configs/projection/projection-contracts.enhanced.yaml`
- `configs/autonomy/unified-template-runtime.yaml`

## Runtime contracts

Each bee template should declare:
- skills
- workflows
- nodes
- triggers
- outputs
- runtime requirements
- projection hooks
- observability hooks
- optimization channels

Each swarm template should declare:
- allocation model
- worker composition
- scaling policy
- communication channels
- health checks
- projection surface
- governance gates

## Success criteria

You are done when:

1. One canonical catalog powers bee and swarm registration.
2. Every scenario maps to both a bee template and a swarm template.
3. Every projected repo has a generated manifest with minimum domain-specific API surface.
4. Health, receipts, and outcome telemetry feed back into the optimizer.
5. Old registry files become thin compatibility layers instead of competing sources of truth.

## Evidence repos

- https://github.com/HeadyMe/Heady-pre-production-9f2f0642
- https://github.com/HeadyMe/headyme-core
- https://github.com/HeadyMe/headymcp-core
- https://github.com/HeadyMe/headysystems-core
