# Deployment Plan

## Preferred split

- Cloudflare: edge routing, caching, Workers, public entry points
- Container runtime: long-lived services like HeadyAPI, HeadyOS, HeadyMemory, HeadySystems
- Managed Postgres with pgvector: durable memory and graph metadata
- Redis: queues, event fanout, short-lived coordination state

## Release strategy

- main = protected integration branch
- release/* = staged promotion branch
- tags = immutable release points
- projected repos publish from tagged monorepo releases

## Critical policies

- one ingress layer
- one registry
- one projection path
- one health contract across services
