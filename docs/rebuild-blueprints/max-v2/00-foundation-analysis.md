# Foundation analysis

## Core findings

- The current public picture shows one rich monorepo plus several thin public projections, which strongly suggests the correct rebuild is one powerful source repo with generated domain outputs rather than many manually maintained siblings ([HeadyMe organization repositories](https://github.com/HeadyMe), [Heady documentation hub](https://github.com/HeadyMe/heady-docs/blob/main/README.md)).
- The strongest implementation clue is the current `heady-manager.js`, which has already been reduced to a thin shell that delegates to bootstrap modules instead of owning all behavior itself ([Heady pre-production thin orchestrator](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-manager.js)).
- The platform registry already encodes the right long-term direction: cloud projections, 384-dimensional embeddings, three projection dimensions, Cloud Run, Cloudflare, Hugging Face, and a GitHub monorepo as the source of truth ([Heady registry](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-registry.json)).
- The architecture docs define a six-layer stack and three runtime planes that are more coherent than the current repo sprawl, so the rebuild should promote those documents into enforceable package and service boundaries ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).
- The latent OS and buddy blueprints show a more ambitious target than the current implementation, especially around vector state, projection, self-healing, and distributed execution, so the rebuild should aim above a simple cleanup ([latent OS blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/latent-os-blueprint.md), [buddy orchestrator blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/architectural-blueprint-buddy-orchestrator.md)).

## What was kept

- Thin conductor boot model.
- Sacred Geometry orchestration as a routing concept.
- 384D vector memory and 3D projection semantics.
- Cloud Run plus Cloudflare edge deployment posture.
- Public vertical domains as first-class products.

## What was changed

- Massive route and service registration is split into bounded services.
- Registry, policies, and pipelines move into a single config system.
- Public sites become apps that share one UI shell instead of isolated islands.
- Projection generation becomes explicit rather than informal.
- Cloud-only configs remove local Windows path assumptions and local-first drift ([cloud-first pipeline source](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/infrastructure/cloud/cloud-first-pipeline.yaml)).
