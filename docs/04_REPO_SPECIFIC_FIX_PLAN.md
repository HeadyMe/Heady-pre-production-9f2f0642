# Repo-specific fix plan

## Source-of-truth monorepo

### Heady-pre-production-9f2f0642

- Remove committed developer and infrastructure credentials, because tracked editor config and operational scripts currently include live-style auth material and hardcoded infra values ([.vscode/mcp.json](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.vscode/mcp.json), [scripts/dns-check.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-check.js), [scripts/dns-update.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-update.js)).
- Change privileged mutation routes to fail closed in production, because `_requireAdminMutation` currently falls through when no admin token is configured ([src/heady-conductor.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/heady-conductor.js)).
- Fix canary rollback to target the last known good revision instead of `--to-latest`, because the current CI rollback path can point traffic back to the bad revision ([.github/workflows/ci.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/ci.yml)).
- Replace the projection path matrix with real module boundaries, because the current liquid-deploy workflow maps most satellites to source paths that do not exist ([.github/workflows/liquid-deploy.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/liquid-deploy.yml)).
- Reconcile package-manager guidance and architecture links, because `README.md` says npm while `CONTRIBUTING.md` instructs pnpm and points contributors to a missing architecture file ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [CONTRIBUTING.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/CONTRIBUTING.md)).
- Align API version truth, because `docs/openapi.yaml` exposes an OpenAPI 3.1 document whose `info.version` still shows `3.0.1` while package metadata is `3.1.0` ([docs/openapi.yaml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/openapi.yaml), [package.json](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/package.json)).

## Docs hub

### heady-docs

- Make `heady-docs` the canonical external knowledge hub and remove duplicate notebook-source copies from the monorepo, because the analysis found duplicated source files across both repos that will drift over time ([heady-docs](https://github.com/HeadyMe/heady-docs), [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).
- Add a self-contained source index and prune redundant source bundles, because the current source structure overlaps heavily and the docs repo is being used as an ingestion surface ([heady-docs](https://github.com/HeadyMe/heady-docs)).

## Satellite projection family

### headyme-core

- Keep only if it becomes an explicitly labeled projection target with status metadata, because the repo currently has a real deploy workflow but still only placeholder tests (`exit 0`) and thin shell code ([headyme-core workflow](https://github.com/HeadyMe/headyme-core/blob/main/.github/workflows/deploy.yml), [headyme-core package.json](https://github.com/HeadyMe/headyme-core/blob/main/package.json), [headyme-core](https://github.com/HeadyMe/headyme-core)).

### headymcp-core

- Replace the no-op deploy workflow with either a real deployment pipeline and smoke checks or a projection-only declaration, because the current workflow stops after `npm ci` and `npm test` and the package still uses placeholder tests ([headymcp-core workflow](https://github.com/HeadyMe/headymcp-core/blob/main/.github/workflows/deploy.yml), [headymcp-core package.json](https://github.com/HeadyMe/headymcp-core/blob/main/package.json), [headymcp-core](https://github.com/HeadyMe/headymcp-core)).

### headysystems-core

- Keep the repo only if it exposes actual projection status and health metadata, because the current public footprint still behaves like a shell rather than an independently verifiable service ([headysystems-core](https://github.com/HeadyMe/headysystems-core)).

### Remaining `-core` repos

- Treat `headyapi-core`, `headybot-core`, `headybuddy-core`, `headyconnection-core`, `headyio-core`, and `headyos-core` as one projection family rather than six distinct products, because the broader repo analysis found they are largely templated shells with duplicated structure and minimal unique implementation ([headyapi-core](https://github.com/HeadyMe/headyapi-core), [headybot-core](https://github.com/HeadyMe/headybot-core), [headybuddy-core](https://github.com/HeadyMe/headybuddy-core), [headyconnection-core](https://github.com/HeadyMe/headyconnection-core), [headyio-core](https://github.com/HeadyMe/headyio-core), [headyos-core](https://github.com/HeadyMe/headyos-core)).

## Production target repos

### headymcp-production and headysystems-production

- Either automate population with clear status metadata or remove the public ambiguity, because these repos currently read as deployment targets rather than informative standalone repositories ([headymcp-production](https://github.com/HeadyMe/headymcp-production), [headysystems-production](https://github.com/HeadyMe/headysystems-production)).

## Recommended ownership split

- Security and rollback fixes should be one immediate workstream, because the exposed credentials and rollback behavior create the highest operational risk ([scripts/dns-check.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-check.js), [.github/workflows/ci.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/ci.yml)).
- Projection integrity and repo simplification should be a second workstream, because the liquid-deploy matrix and templated repo family are the clearest sources of drift and maintenance waste ([.github/workflows/liquid-deploy.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/liquid-deploy.yml), [headyme-core](https://github.com/HeadyMe/headyme-core), [headymcp-core](https://github.com/HeadyMe/headymcp-core)).
- Documentation and source-of-truth cleanup should be a third workstream, because onboarding and agent retrieval are being degraded by contradictory docs and duplicated sources ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [CONTRIBUTING.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/CONTRIBUTING.md), [heady-docs](https://github.com/HeadyMe/heady-docs)).
