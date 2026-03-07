# Projection strategy

The public repos should be generated products, not parallel hand-maintained codebases, because the current public `*-core` repositories already describe themselves as projected from the latent OS ([headyme-core README](https://github.com/HeadyMe/headyme-core/blob/main/README.md), [headyos-core README](https://github.com/HeadyMe/headyos-core/blob/main/README.md), [headymcp-core README](https://github.com/HeadyMe/headymcp-core/blob/main/README.md), [headysystems-core README](https://github.com/HeadyMe/headysystems-core/blob/main/README.md), [headyapi-core README](https://github.com/HeadyMe/headyapi-core/blob/main/README.md), [headyconnection-core README](https://github.com/HeadyMe/headyconnection-core/blob/main/README.md), [headybuddy-core README](https://github.com/HeadyMe/headybuddy-core/blob/main/README.md)).

## Projection outputs

- `headyme-core` projects the personal cloud app and selected memory contracts.
- `headyos-core` projects the operating system kernel packages and conductor contracts.
- `headymcp-core` projects MCP routes, schemas, and tool registry assets.
- `headysystems-core` projects operations, resilience, and admin capabilities.
- `headyapi-core` projects public APIs and gateway contracts.
- `headyconnection-core` projects collaborative workspace features and community-facing docs.
- `headybuddy-core` projects the companion application and memory-aware service contracts.

`projection-service` plus `scripts/project-verticals.mjs` is the new explicit mechanism for those outputs.
