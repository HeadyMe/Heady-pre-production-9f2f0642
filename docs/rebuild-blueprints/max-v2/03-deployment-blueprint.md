# Deployment blueprint

The source registry already points toward Cloud Run for core services and Cloudflare for edge delivery, so this rebuild keeps that split and turns it into first-class infrastructure code ([Heady registry](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-registry.json)).

## Cloud layout

- Cloudflare routes public domains and lightweight workers.
- Cloud Run hosts gateway, conductor, memory, buddy, MCP, projection, and worker services.
- PostgreSQL with pgvector backs durable state and vector memory, following the memory and persistence ambitions in the docs ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).
- Redis carries short-lived workflow coordination and hot state.

## Profiles

- `personal` is the cloud-me layer.
- `systems` is the product and operations layer.
- `connection` is the nonprofit and community layer.
- `shared` is the multi-tenant user layer.

This structure matches the layered environment concepts discussed throughout the Heady design material and keeps each layer policy-aware without needing a separate codebase ([latent OS blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/latent-os-blueprint.md), [buddy orchestrator blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/architectural-blueprint-buddy-orchestrator.md)).
