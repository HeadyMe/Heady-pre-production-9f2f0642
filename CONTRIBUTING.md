# Heady™ Contributing Guide

> Enterprise-grade contribution standards for the Heady ecosystem.

## Branch Strategy

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready only | PR required, CI must pass |
| `feature/*` | New features | PR to main |
| `fix/*` | Bug fixes | PR to main |
| `hotfix/*` | Emergency production fixes | PR to main, expedited review |

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(orchestration): add retry logic to pipeline stages
fix(auth): handle expired JWT tokens gracefully
chore(ci): remove continue-on-error from security gates
docs(api): add OpenAPI spec for health endpoints
test(memory): add vector search unit tests
refactor(src): move loose files into domain modules
```

## Code Standards

### Naming Rules

**Forbidden in active tree:**

- `backup`, `copy`, `temp`, `old`, `final`, `v1`, `misc`
- Timestamped variants (`file-2026-03-07.js`)
- Duplicate suffixes (`file-new.js`, `file-fixed.js`)

**Required:**

- kebab-case for files: `env-schema.js`
- PascalCase for classes: `StructuredLogger`
- camelCase for functions: `validateEnvironment`

### File Decision Rules

| Keep | Archive | Delete |
|------|---------|--------|
| Loaded by running app | Patent-traceable old code | Dead `*-v1.js` files |
| Imported by current source | Historical architecture docs | Duplicated task JSONs |
| Used by CI/CD or Dockerfile | Original blueprints | `_archive/` contents |

### Domain Module Structure

All source code belongs in a domain module under `src/`:

```
src/
├── orchestration/    # Pipeline, conductor, self-optimizer
├── memory/           # Vector memory, search, federation
├── agents/           # Bees, buddy, templates
├── auth/             # Authentication, authorization, tiers
├── mcp/              # MCP server, connectors
├── intelligence/     # Research, scanning, ML
├── runtime/          # Cloud infra, compute, deployment
├── observability/    # Logging, monitoring, health
├── integrations/     # Provider connectors, SDKs
├── shared/           # Utils, registry, policies
└── types/            # TypeScript definitions
```

**Never add loose `.js` files to `src/` root.**

## CI/CD

- Security scan (TruffleHog + CodeQL) **must pass** before deploy
- Test suite **must pass** before deploy
- No `continue-on-error: true` on security or test gates
- All deploy jobs require `needs: [security-scan, validate]`

## Secrets

- **Never** commit secrets, keys, or tokens to any file
- **Never** commit partial key prefixes (e.g., `pplx-FvR1...`)
- Use GCP Secret Manager for production
- Use GitHub Secrets for CI/CD
- Use `.env` for local development (never committed)
