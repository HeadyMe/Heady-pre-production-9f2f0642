# Migration Map

## Canonical replacements

| Existing area | Problem | Replace with |
|---|---|---|
| `src/services/headybee-template-registry.js` | Service-specific logic but not full-system canonical | `adapters/node/headybee-template-registry.service.js` |
| `src/agents/headybee-template-registry.js` | Static in-code registry duplicates service registry | `registry/heady-template-catalog.json` + `adapters/node/headybee-template-registry.service.js` |
| `src/autonomy/heady-template-registry.js` | Separate selection logic and fallback matrix | `registry/scenario-matrix.yaml` + `adapters/node/autonomous-template-optimizer.js` |
| `src/agents/template-registry-optimizer.js` | Partial optimizer with snapshot logic only | `adapters/node/autonomous-template-optimizer.js` |
| `src/routes/headybee-templates.js` | Route layer coupled to one registry variant | compatibility route backed by the new canonical services |
| `src/config/headybee-template-scenarios.json` | JSON scenario file diverges from YAML matrix | `registry/scenario-matrix.yaml` |
| `src/onboarding/headyswarm-ui-configs.js` | UI-heavy swarm model | `templates/schemas/headyswarm-template.schema.json` + examples |
| `configs/HeadySwarmMatrix.json` | Separate swarm inventory with different fields | canonical catalog + swarm registry service |
| Projected repo minimal shells | Too thin to express domain API surface | manifests in `projections/` + projection manifest generator |

## Suggested landing zones inside the main repo

- `src/templates/catalog/` for canonical catalog and schemas
- `src/templates/services/` for registry and optimizer services
- `src/templates/routes/` for route exposure
- `configs/templates/` for optimization policy, scenario matrix, and projection overlays

## Compatibility phase

During a first pass migration:

1. Keep old route URLs unchanged.
2. Make old registries import the canonical catalog.
3. Emit deprecation warnings when legacy modules are used directly.
4. Store template outcomes in one shared telemetry stream.

## Final state

The final state should have exactly one canonical data source for templates and exactly one selection engine.
