# Prioritized remediation plan

## Phase 0

### Critical in 24 hours

- Rotate any exposed Cloudflare credentials and replace committed values with environment-variable access patterns in operational scripts and local developer config within the main monorepo ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Remove committed MCP bearer material from editor config and switch to injected environment-based auth for local tooling ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Enforce admin-token presence for privileged mutation paths in production so a missing token cannot silently fall through to open admin routes ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Fix canary rollback logic so failure returns traffic to the last known good revision instead of implicitly targeting the latest revision again ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Phase 1

### Stabilize source-of-truth integrity

- Choose one canonical registry path and version source, then update prompt libraries, cloud configs, docs, and workflows to point only there, because the current repo references both root-level and config-level registry locations ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Reconcile pipeline definitions so runtime code, config JSON, and documentation describe the same stage model and the same approval behavior ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Unify version strings across package metadata, OpenAPI, registry metadata, and docs to eliminate version drift in published artifacts ([docs/openapi.yaml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/openapi.yaml), [package.json](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/package.json)).
- Resolve the npm-versus-pnpm contradiction in onboarding docs and enforce the chosen package manager in CI and contributor guidance ([CONTRIBUTING.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/CONTRIBUTING.md), [README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md)).

## Phase 2

### Make projections real

- Replace stub-only satellite validation with real tests, real deploys, and post-deploy health checks so each projected repo either proves deployment health or clearly declares itself as a projection-only artifact ([headyme-core](https://github.com/HeadyMe/headyme-core), [headymcp-core](https://github.com/HeadyMe/headymcp-core), [headysystems-core](https://github.com/HeadyMe/headysystems-core)).
- Fix the liquid projection path matrix so every target repo maps to a real source boundary in the monorepo instead of silently skipping nonexistent folders ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Add `.gitignore`, health checks, and consistent Docker hardening across all public satellite repos ([headyme-core](https://github.com/HeadyMe/headyme-core), [headymcp-core](https://github.com/HeadyMe/headymcp-core), [headysystems-core](https://github.com/HeadyMe/headysystems-core)).
- Create a projection-status manifest with source module, projection target, last sync hash, last deploy, and live URL to make the projection model observable ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642), [heady-docs](https://github.com/HeadyMe/heady-docs)).

## Phase 3

### Reduce repo and docs drag

- Remove exact-duplicate notebook source files from the monorepo and keep `heady-docs` as the canonical ingestion hub for shared strategic and architecture briefing files ([heady-docs](https://github.com/HeadyMe/heady-docs), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Promote the governance document currently stranded in archive to a canonical top-level location so agents and developers can reliably discover it ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Set a hard cutover for `_archive/` removal or extraction into a dedicated historical repo, because archive noise is now actively undermining code navigation and AI retrieval quality ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Standardize legal entity naming across root documents, package authorship, and public docs to reduce future diligence and brand ambiguity ([heady-docs](https://github.com/HeadyMe/heady-docs), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Phase 4

### Complete the architecture you already designed

- Persist vector memory automatically and restore it on boot so pod restarts do not wipe short-term system memory despite the architecture’s stated memory goals ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Add approximate nearest-neighbor indexing and explicit STM→LTM consolidation to move vector memory closer to the claimed Graph RAG and long-term memory model ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md)).
- Finish wiring the Buddy execution layer to the real model-routing stack so the public companion shell stops behaving like a template façade ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Implement a real approval gate surface for HCFullPipeline with signed links, explicit run state, and reject/approve endpoints so the governance model is enforceable instead of mostly aspirational ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Phase 5

### Hardening and platform clarity

- Add remote Terraform state and remove duplicate infrastructure definitions so disaster recovery and team-safe infrastructure changes become real instead of implied ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Designate one canonical production deploy workflow and one canonical runtime baseline for Node version, package manager, CPU, and memory settings ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Convert advisory security checks and smoke tests into real gates that can fail deployment, especially where current workflows can succeed while skipping meaningful validation ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Best sequence

Security and rollback fixes first, then source-of-truth cleanup, then projection integrity, then repo/docs consolidation, then deeper memory-and-orchestration completion work ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642), [heady-docs](https://github.com/HeadyMe/heady-docs)).
