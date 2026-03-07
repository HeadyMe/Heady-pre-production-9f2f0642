# Setup guide

## Merge steps

1. Copy the `packages/*` folders into the target Heady monorepo.
2. Merge the root workspace entries from `package.json`, `pnpm-workspace.yaml`, `turbo.json`, and `tsconfig.base.json`.
3. If the target repo already defines `@heady-ai/sacred-geometry-sdk` helpers, you can either keep `@heady-ai/phi-math` as-is or fold its exports into the existing sacred-geometry package.
4. Wire the external boundary package into the existing gateway and MCP surfaces.
5. Promote internal service-to-service traffic onto `@heady-ai/spatial-events` and keep HTTP only for external boundary ingress.
6. Route agent loop persistence through `@heady-ai/memory-stream`.
7. Route lifecycle control through `@heady-ai/kernel`.

## Build

```bash
pnpm install
pnpm build
pnpm test
```

## Suggested integration order

1. `phi-math`
2. `csl-router`
3. `agent-identity`
4. `spatial-events`
5. `memory-stream`
6. `observability-kernel`
7. `latent-boundary`
8. `kernel`

## Integration notes

- The bundle intentionally collapses the original 10 requested systems into kernel primitives plus one external boundary package.
- The OpenAPI document exists only for external ingress and automation contracts.
- MCP remains available for third-party tools and boundary-facing orchestration, not for internal kernel traffic.
