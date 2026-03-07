# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.1.0] - 2026-03-07

### Added

- Environment variable validation at boot (`src/config/env-schema.js`)
- Enterprise structured logger with correlation IDs (`src/observability/enterprise-logger.js`)
- Kubernetes-style health probes (`src/observability/health-probes.js`)
- TypeScript configuration and core type definitions (`tsconfig.json`, `src/types/core.d.ts`)
- OpenAPI 3.1 specification (`docs/openapi.yaml`)
- Test pyramid: unit, integration, and e2e tests
- `CONTRIBUTING.md` with branch strategy and code standards
- `SECURITY.md` with vulnerability reporting policy
- `docs/LIVE_SURFACES.md` — canonical list of all live deployments
- `docs/DEPRECATIONS.md` — tracking removed and scheduled items

### Changed

- **[BREAKING]** CI pipeline: `continue-on-error` removed from security and test gates
- **[BREAKING]** Deploy requires passing `security-scan`, `validate`, and `sbom-scan` jobs
- Reorganized `src/` from 76 loose files into 10 domain modules
- README updated: badges → real workflows, pnpm → npm, architecture → domain modules
- `package.json`: version 3.0.1 → 3.1.0, org URLs → HeadyMe, real build scripts
- Legal entity corrected: "Heady Systems LLC" → "HeadySystems Inc." across all files

### Removed

- `heady-manager-v1.js` (90KB dead legacy entrypoint)
- `battle-synthesis-report.json` (one-off artifact)
- 11 loose JSON task files from `src/` root
- Duplicate `infrastructure/` directory (merged into `infra/`)
- `heady-hf-spaces/` (separate HF Space repos exist)
- Partial API key prefixes from `docs/api-keys-reference.md`

### Security

- Scrubbed 30+ partial API key prefixes from documentation
- CI security scan (TruffleHog + CodeQL) now blocks deployment on failure
- Final verification job fails if zero projections are healthy (was `exit 0`)

## [3.0.1] - 2026-03-01

### Added

- Initial monorepo consolidation
- 20-node AI system with Sacred Geometry orchestration
- MCP SSE transport endpoint
- HCFullPipeline 12-stage orchestration engine
- HeadyBees agent decomposition (26 domains, 197 workers)

---

© 2026 HeadySystems Inc.
