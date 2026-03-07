# Heady Template Pack

This pack consolidates the strongest reusable HeadyBee and HeadySwarm patterns I found across the public HeadyMe repositories into an integration-ready template system focused on full template functionality, optimized projection, deployment wiring, and autonomous setup.

## What this pack fixes

1. Duplicate template registry logic is collapsed into one canonical catalog, one scenario matrix, and one optimizer.
2. Bee templates and swarm templates now use normalized schemas with explicit runtime, projection, observability, and autonomous optimization sections.
3. Thin projected repos can be generated from projection manifests instead of staying as minimal wrappers.
4. Projection, governance, performance budgets, and observability are wired directly into the template model.
5. Scenario-to-template selection is deterministic and can still learn from runtime outcomes.

## Recommended integration order

1. Read `docs/REPO_SCAN_SUMMARY.md`
2. Read `docs/INTEGRATION_GUIDE.md`
3. Install the canonical registry from `registry/`
4. Add schemas from `templates/schemas/`
5. Add example bees and swarms from `templates/examples/`
6. Apply config overlays from `configs/`
7. Use projection manifests from `projections/`
8. Run the Node adapters from `adapters/node/`

## Pack structure

- `docs/` — scan synthesis, migration map, and integration guide
- `registry/` — canonical catalog, scenario matrix, selector, and health helpers
- `templates/` — normalized schemas plus example bee and swarm templates
- `adapters/node/` — drop-in Node services for registry, selection, optimization, and projection manifests
- `configs/` — autonomy, projection, governance, observability, and performance overlays
- `projections/` — enhanced projection manifests for projected repos
- `scripts/` — install helper

## Primary evidence repos

- Heady main public repo: https://github.com/HeadyMe/Heady-pre-production-9f2f0642
- Projected repos:
  - https://github.com/HeadyMe/headyme-core
  - https://github.com/HeadyMe/headymcp-core
  - https://github.com/HeadyMe/headysystems-core
  - https://github.com/HeadyMe/headybuddy-core
  - https://github.com/HeadyMe/headyos-core
  - https://github.com/HeadyMe/headybot-core
  - https://github.com/HeadyMe/heady-docs
- Public profile inventory: https://github.com/HeadyMe

## Key design decision

The canonical source of truth in this pack is:

- `registry/heady-template-catalog.json`
- `registry/scenario-matrix.yaml`
- `templates/schemas/headybee-template.schema.json`
- `templates/schemas/headyswarm-template.schema.json`

Everything else derives from those four layers.
