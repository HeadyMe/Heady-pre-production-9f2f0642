# Heady Rebuild Monorepo

This package rebuilds Heady as a single cloud-first monorepo that keeps the six-layer platform model from the Heady architecture docs, preserves the thin orchestrator pattern visible in `heady-manager.js`, and treats the public `*-core` repositories as projections generated from one stronger source of truth ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md), [Heady pre-production thin orchestrator](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-manager.js), [Heady documentation hub](https://github.com/HeadyMe/heady-docs/blob/main/README.md), [HeadyMe organization repositories](https://github.com/HeadyMe)).

## What is inside

- `apps/` contains the public-facing domain apps for HeadyMe, HeadySystems, HeadyConnection, HeadyBuddy, and the admin console, aligned to the domain map used across the Heady ecosystem ([Heady OS orchestrator domain map](https://github.com/HeadyMe/heady-docs/blob/main/README.md), [HeadyMe org repositories](https://github.com/HeadyMe)).
- `services/` contains the operational core: gateway, conductor, memory, buddy, MCP, projection, and worker fabric, which reorganizes the sprawling service mounts from the current bootstrap into bounded services ([Heady pre-production service registry](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/bootstrap/service-registry.js), [Heady pre-production vector stack](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/bootstrap/vector-stack.js)).
- `packages/` holds shared contracts for resilience, sacred geometry, vector memory, UI shell, and configuration, which is the clean replacement for large cross-cutting logic spread through the current codebase ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md), [latent OS blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/latent-os-blueprint.md)).
- `configs/` centralizes registry, memory, domain, pipeline, and policy files, while removing local Windows path assumptions still present in the old cloud-first config ([cloud-first pipeline source](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/infrastructure/cloud/cloud-first-pipeline.yaml)).
- `infra/` provides Docker, Cloud Run, Cloudflare, Terraform, and CI foundations designed for a cloud-only operating model with projected vertical deploy targets ([Heady registry projections](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-registry.json), [Heady README deployment notes](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md)).
- `docs/` explains the source-to-rebuild mapping and the reasoning for what was preserved, replaced, or elevated.

## Rebuild principles

1. One monorepo is the source of truth, while public vertical repositories are generated projections, matching how the public `headyme-core`, `headyos-core`, `headymcp-core`, `headysystems-core`, `headyapi-core`, `headyconnection-core`, and `headybuddy-core` repositories present themselves today ([headyme-core README](https://github.com/HeadyMe/headyme-core/blob/main/README.md), [headyos-core README](https://github.com/HeadyMe/headyos-core/blob/main/README.md), [headymcp-core README](https://github.com/HeadyMe/headymcp-core/blob/main/README.md), [headysystems-core README](https://github.com/HeadyMe/headysystems-core/blob/main/README.md), [headyapi-core README](https://github.com/HeadyMe/headyapi-core/blob/main/README.md), [headyconnection-core README](https://github.com/HeadyMe/headyconnection-core/blob/main/README.md), [headybuddy-core README](https://github.com/HeadyMe/headybuddy-core/blob/main/README.md)).
2. The conductor stays thin and compositional rather than collapsing back into a god class, following the direction already visible in the current pre-production repository ([Heady pre-production thin orchestrator](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-manager.js)).
3. Cloud-first means cloud-first for real, so local machine paths, localhost-only assumptions, and mixed package-manager drift are removed from the platform baseline ([latent OS blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/latent-os-blueprint.md), [cloud-first pipeline source](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/infrastructure/cloud/cloud-first-pipeline.yaml), [Heady README package manager note](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md)).
4. The six-layer stack, liquid architecture planes, circuit breaker patterns, CQRS, event sourcing, self-tuning, and skill-based routing remain first-class instead of marketing-only concepts ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm validate
pnpm dev
```

## Suggested rollout

- Start with `services/conductor`, `services/gateway-api`, `services/memory-service`, and `services/mcp-gateway` as the control plane.
- Bring up the admin console and one public domain app first.
- Use `scripts/project-verticals.mjs` to emit the thin public repos once the monorepo reaches stability.


## v2 additions

- stronger service and memory contracts under `configs/contracts/`
- fuller control-plane routes for conductor, memory, MCP, buddy, projection, and worker services
- projection generation that emits repo folders with manifests under `dist/projections/`
- expanded Docker Compose with PostgreSQL and Redis
- a dedicated workflow and manifest layer in `packages/workflow-engine`, `packages/contracts`, and `packages/projection-manifest`
