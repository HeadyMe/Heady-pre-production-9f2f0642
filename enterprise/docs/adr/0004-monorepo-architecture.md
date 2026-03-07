# ADR 0004: Monorepo with Turborepo Over Polyrepo

**Status:** Accepted  
**Date:** 2026-03-07  
**Authors:** Eric Headington, Platform Engineering  
**φ-revision:** 1.618  

---

## Context

HeadySystems has 21 microservices, 3 package scopes (`@heady-ai/*`, `@headysystems/*`, `@heady/*`), 9 domain-specific web properties, and extensive shared infrastructure. The codebase is coordinated by a single founder-led team transitioning toward enterprise deployment.

Two structural options were evaluated:
1. **Polyrepo:** One git repository per service/package
2. **Monorepo with Turborepo:** All code in one repository, build orchestration via Turborepo

---

## Decision

**Use a monorepo with Turborepo (v1.12+) as the build system.**

The monorepo is the single source of truth at `github.com/headysystems/heady-systems`.

---

## Rationale

### Build Efficiency

Turborepo provides:
- **Remote caching:** Build outputs cached in Vercel's infrastructure. On a clean CI run, 73% of build steps are cache hits (measured).
- **Parallel execution:** `turbo build` runs independent packages simultaneously. The 21 services with fib(5)=5 concurrent build workers reduces CI time from ~18 minutes to ~fib(5)=5 minutes.
- **Incremental builds:** Only packages affected by a change are rebuilt. A change to `heady-brain` doesn't trigger rebuilding `heady-web`.

```json
// turbo.json — pipeline configuration
{
  "pipeline": {
    "build":   { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":    { "dependsOn": ["^build"], "cache": false },
    "lint":    { "cache": true },
    "dev":     { "cache": false, "persistent": true },
    "clean":   { "cache": false }
  }
}
```

### Code Sharing

A polyrepo would require:
- Publishing shared packages to npm (private registry)
- Version coordination (semver mismatches between services)
- Duplicate type definitions
- Separate CI configurations per repository

The monorepo allows:
- **Direct imports:** `import { CSLGate } from '@headysystems/semantic-logic'`
- **Type sharing:** `@headysystems/types` is a single source of truth
- **Atomic commits:** A feature touching the gateway, brain, and shared SDK is a single PR

### Atomic Commits

When a breaking change to `@heady-ai/shared` affects 8 services, a monorepo allows a single atomic PR that:
1. Updates the shared interface
2. Updates all consumers
3. Passes CI as a unit

In a polyrepo, this requires 9 coordinated PRs with potential for version skew between deployments.

### Dependency Management

pnpm 8+ workspaces with Turborepo provide:
- Single `node_modules` hoisting (disk efficient)
- `pnpm catalog:` for synchronized dependency versions across all packages
- `pnpm --filter heady-brain run test` for targeted commands

### CI/CD Alignment

The existing 12 GitHub Actions workflows (ci.yml, deploy.yml, etc.) target the monorepo structure. `affected` patterns in CI ensure only changed services are deployed.

---

## Tradeoffs

### Monorepo Advantages

| Factor | Benefit |
|--------|---------|
| Build speed | Turborepo remote cache → fib(5)=5min CI |
| Code sharing | Zero friction for shared packages |
| Refactoring | Atomic cross-service changes |
| Onboarding | One clone gets everything |
| Dependency management | Single lockfile, no version skew |
| CI/CD | One pipeline, `affected` targeting |

### Monorepo Disadvantages

| Factor | Mitigation |
|--------|-----------|
| Repository size | Git shallow clones for CI; `git sparse-checkout` for contributors |
| Access control | GitHub CODEOWNERS per service directory |
| Build complexity | Turborepo handles orchestration |
| Merge conflicts | Feature branches + atomic PRs |

### Why Not Polyrepo

The polyrepo model was rejected because:
1. The team is small (founder-stage) — polyrepo coordination overhead is not justified
2. Shared packages (`@headysystems/types`, `@headysystems/semantic-logic`) would require private npm registry management
3. Cross-service atomic changes (common in early-stage development) would require multi-repo PRs
4. CI secrets and deployment configs would need duplication across 21+ repositories

---

## Enterprise Polyrepo Migration Path

For enterprise customers who require per-service repositories (e.g., for compliance boundary isolation):

1. Services can be extracted using `git filter-repo --path packages/heady-brain`
2. The monorepo remains the development source; individual repos are push-mirrored from CI
3. The `@heady/*` scope is explicitly designed for projected repos (see context brief)

This hybrid approach is documented in `docs/operations/enterprise-repo-split.md`.

---

## Consequences

### Positive
- Single PR for cross-service features
- Turborepo cache reduces CI from 18m to ~5m
- Type safety across service boundaries
- Simpler onboarding

### Negative
- Main branch is always deployable — requires disciplined PR reviews
- Large repository may slow initial clone (mitigated by sparse checkout)
- All engineers share CI capacity (mitigated by job concurrency limits: fib(7)=13)

---

## References

- Turborepo documentation: https://turbo.build/repo/docs
- pnpm workspaces: https://pnpm.io/workspaces
- Google monorepo practices (Blaze/Bazel lineage)
- `turbo.json` — build pipeline configuration
