# Heady Max Potential Rebuild

A clean-slate monorepo rebuild for the Heady ecosystem using the public HeadyMe repository layout as a foundation and upgrading it into a stronger operating model.

## What this package gives you

- One canonical monorepo as the source of truth
- Projection manifests for the public core repos
- A domain registry for product, service, and deployment coordination
- Functional service stubs for API, MCP, OS, memory, systems, and bot layers
- Frontend shells for HeadyMe, HeadyBuddy, and HeadyConnection
- Deployment scaffolding for Docker, Cloudflare, and Render
- Documentation for architecture, repo mapping, observability, and build order

## Recommended architecture

The rebuild centers on a single latent operating monorepo with three layers:

1. Experience layer: HeadyMe, HeadyBuddy, HeadyConnection
2. Intelligence layer: HeadyAPI, HeadyMCP, HeadyOS, HeadyMemory, HeadyBot
3. Infrastructure layer: HeadySystems, observability, deployment, projection

## Why this structure

The public HeadyMe repos already imply a projection model where one stronger source repo feeds multiple purpose-specific repos. This rebuild keeps that idea, but makes the source-of-truth monorepo explicit, versioned, and easier to operate.

## Quick start

```bash
pnpm install
pnpm run validate
pnpm run dev:api
pnpm run dev:mcp
pnpm run dev:os
pnpm run dev:memory
pnpm run dev:systems
pnpm run dev:bot
```

## Monorepo layout

```
apps/
  headyme/
  headybuddy/
  headyconnection/
services/
  headyapi/
  headymcp/
  headyos/
  headymemory/
  headysystems/
  headybot/
packages/
  heady-core/
  heady-contracts/
  heady-projection/
  heady-sdk/
infrastructure/
  docker/
  cloudflare/
  render/
projections/
docs/
```

## Build order

1. Stand up shared contracts and registry
2. Bring HeadyAPI, HeadyMCP, and HeadyOS online
3. Add memory and observability
4. Connect HeadyMe and HeadyBuddy experiences
5. Turn on repo projections and automated release flows

## Included source notes

See `docs/FOUNDATION-SOURCES.md` for the public HeadyMe repositories this rebuild was based on.
