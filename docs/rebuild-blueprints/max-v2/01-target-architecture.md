# Target architecture

## Platform stack

The rebuilt monorepo keeps the six-layer model: edge, gateway, orchestration, intelligence, memory, and persistence, because that is the clearest systems view found in the Heady documentation set ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).

## Service map

- `gateway-api` owns public request ingress, auth context, rate limits, and domain dispatch, matching the documented gateway layer ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md)).
- `conductor` owns workflow decomposition, policy gates, and service coordination, preserving the conductor pattern and the thin orchestrator direction from the current codebase ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md), [Heady pre-production thin orchestrator](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-manager.js)).
- `memory-service` owns vector coordinates, context retention, and memory-tier operations, reflecting the vector memory and persistence layers described in the docs and registry ([Heady registry](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/heady-registry.json), [latent OS blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/latent-os-blueprint.md)).
- `mcp-gateway` owns tool registration and connector mediation, following the public identity of HeadyMCP as a central tool nerve center ([headymcp-core README](https://github.com/HeadyMe/headymcp-core/blob/main/README.md)).
- `buddy-service` owns companion workflows and persistent identity, following the buddy blueprint and the public HeadyBuddy positioning ([buddy orchestrator blueprint](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/strategic/architectural-blueprint-buddy-orchestrator.md), [headybuddy-core README](https://github.com/HeadyMe/headybuddy-core/blob/main/README.md)).
- `projection-service` owns thin repo and deploy target generation, which formalizes the projection plane described in the architecture docs and the public projected repo pattern ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md), [headyme-core README](https://github.com/HeadyMe/headyme-core/blob/main/README.md)).
- `worker-fabric` owns durable background execution, self-healing workers, and policy-aware queueing, which is the practical form of the swarm and self-healing concepts already present in the docs and code ([Heady architecture patterns](https://github.com/HeadyMe/heady-docs/blob/main/sources/05-heady-architecture-and-patterns.md), [Heady pre-production vector stack](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/bootstrap/vector-stack.js)).
