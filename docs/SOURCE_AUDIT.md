# Source audit

This rebuild used the public HeadyMe and HeadySystems repositories as source material and distilled them into a working monorepo.

## What the public repos show

- The newest HeadyMe pre-production repository presents the main architecture intent: HCFullPipeline, vector memory, buddy orchestration, MCP integration, resilience, and Cloud Run deployment.
- The HeadyMe `headyme-core`, `headymcp-core`, `headyapi-core`, and related repos are minimal projection shells. They expose branding and domain intent but do not contain the full application logic.
- The older HeadySystems pre-production repository contains useful operational ideas, including admin endpoints, SSE log streaming, and a dockerized MCP stack, but it also carries environment-specific assumptions.

## Breakpoints found during reconstruction

- The main `heady-manager.js` boot sequence requires internal modules such as `../core/heady-yaml` and `../core/heady-server`, but those modules are not present in the checked-out source tree.
- The public projection repos are too small to function as a complete platform on their own.
- The older `docker-compose.mcp.yml` hard-codes a local workstation path (`/Users/erich/Heady`) for the filesystem MCP server, which would break on other machines.
- The zero-dependency rebuild blueprint under `docs/rebuild-blueprints/zero-dep/heady-zero-dep` contains strong design patterns, but the exported `core/` layer referenced by its package manifest is missing from the public tree.

## Rebuild decision

The new monorepo keeps the public architectural direction while replacing missing internals with a clean, working core:

- User-scoped auth and API keys
- Deterministic 384-dimensional embeddings with derived 3D coordinates
- File-backed and PostgreSQL-backed persistence behind one interface
- MCP tool access over HTTP, SSE, and WebSocket
- A simple built-in browser console for immediate use

## Public source URLs

- https://github.com/HeadyMe/Heady-pre-production-9f2f0642
- https://github.com/HeadySystems/Heady-pre-production
- https://github.com/HeadyMe/headyme-core
- https://github.com/HeadyMe/headymcp-core
- https://github.com/HeadyMe/headyapi-core
- https://github.com/HeadyMe/headybuddy-core
- https://github.com/HeadyMe/heady-docs
