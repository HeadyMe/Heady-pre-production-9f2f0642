# MANIFEST

## Root

- `package.json` — workspace metadata and build scripts
- `pnpm-workspace.yaml` — pnpm workspace layout
- `turbo.json` — Turborepo pipeline
- `tsconfig.base.json` — shared TypeScript compiler settings and path aliases
- `tsconfig.json` — project references
- `README.md` — runtime overview
- `SETUP_GUIDE.md` — merge instructions

## Packages

### `packages/phi-math`
Shared φ constants, Fibonacci helpers, CSL score bands, and vector math.

### `packages/csl-router`
Continuous semantic logic gate evaluation, weighted factor fusion, and provider or node ranking.

### `packages/spatial-events`
Spatial event bus with octant indexing, resonance filtering, attenuation, and replay buffers.

### `packages/agent-identity`
Agent identities, Ed25519 signing, scoped workflow tokens, capability envelopes, and trust scoring.

### `packages/memory-stream`
Vector-native memory records for observations, reflections, and plans with access control and retrieval scoring.

### `packages/observability-kernel`
Workflow traces, audit-chain records, neural-stream event capture, and latency metrics.

### `packages/latent-boundary`
External boundary primitives for API gateway trust scoring, MCP tool execution, model routing, and connector lifecycle.

### `packages/kernel`
Unified latent runtime coordinating lifecycle, observe/reflect/plan loops, and event projection.

## Infra

- `infra/cloudrun/latent-kernel-service.yaml` — Cloud Run deployment template
- `infra/openapi/heady-latent-boundary.openapi.yaml` — external boundary contract

## Scripts

- `scripts/clean.mjs` — removes package dist folders
- `scripts/make_zip.py` — creates a distributable zip without `node_modules`
