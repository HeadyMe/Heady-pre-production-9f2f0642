# Control plane

The rebuilt control plane centers on four always-on services: `gateway-api`, `conductor`, `memory-service`, and `mcp-gateway`, because the current Heady materials consistently separate ingress, orchestration, memory, and tooling responsibilities even when they are still tangled in one repo ([Heady pre-production service registry](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/bootstrap/service-registry.js), [Heady pre-production vector stack](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/bootstrap/vector-stack.js), [Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).

## Services

- `gateway-api` is the universal ingress and domain switchboard.
- `conductor` is the thin planner and routing authority.
- `memory-service` owns persistent and ephemeral memory surfaces.
- `mcp-gateway` owns tools and connector awareness.
- `buddy-service` is a bounded companion surface instead of a cross-cutting concern.
- `projection-service` turns the monorepo into public projected repos and deployable slices.
- `worker-fabric` keeps background jobs out of latency-sensitive paths.
