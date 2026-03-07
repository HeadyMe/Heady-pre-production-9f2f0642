# HeadyStack Repository Roles

**Version:** 3.0.1 "Aether"

---

## Overview

HeadyStack operates across multiple Git remotes and local clone environments. This document defines the canonical roles, responsibilities, and sync protocols for each.

---

## Single Source of Truth

**`HeadyStack`** is the canonical source of truth for the entire platform.

All production code, configuration, migrations, documentation, and CI/CD pipelines originate here. Changes to any other remote or clone must eventually be reconciled back to HeadyStack main.

---

## Remote Repositories

| Remote ID | URL | Role | Access |
|-----------|-----|------|--------|
| `heady-sys` | `https://github.com/HeadyMe/HeadyStack` | Primary canonical remote — production platform | Admin |
| `heady-me` | `https://github.com/HeadyMe/HeadyStack.Me` | Consumer-facing product (heady.me) | Admin |
| `heady-conn` | `https://github.com/HeadyMe/HeadyStack.Conn` | Community/connection platform (headyconnection.org) | Admin |
| `sandbox` | `https://github.com/HeadyMe/HeadyStack.Sandbox` | Experimental branches, spike work, throwaway | Admin |

### heady-sys (Primary)

- **Purpose:** The production platform codebase. All features, fixes, and releases are cut from here.
- **Branch protection:** `main` requires 1 approving review + CI pass before merge
- **Deploy:** Pushes to `main` trigger the Cloud Run CI/CD pipeline
- **Secrets:** Only this repo has GCP_SA_KEY and production secrets in GitHub Secrets

### heady-me (Product)

- **Purpose:** The heady.me consumer product, powered by HeadyStack APIs
- **Relationship:** Consumes HeadyStack as a dependency/API, not a code fork
- **Sync:** Pull upstream changes from `heady-sys/main` weekly via merge commit
- **Deploy:** Render.com web service

### heady-conn (Community)

- **Purpose:** headyconnection.org — the community platform and knowledge hub
- **Relationship:** Lightweight HeadyStack consumer; contains community-specific routes/UI
- **Sync:** Pull upstream changes from `heady-sys/main` on releases only
- **Deploy:** Cloudflare Pages + Workers

### sandbox (Experimental)

- **Purpose:** Spike work, prototypes, and experimental AI features not yet production-ready
- **Relationship:** Temporary; successful experiments are PR'd back to `heady-sys/main`
- **Lifespan:** Branches older than 90 days without a PR are archived

---

## Local Clone Environments

| Clone | Path | Remote | Purpose |
|-------|------|--------|---------|
| `HeadyStack` | `~/HeadyStack/` | `heady-sys` | Primary development environment |
| `HeadyStack.Me` | `~/HeadyStack.Me/` | `heady-me` | heady.me product development |
| `HeadyStack.Conn` | `~/HeadyStack.Conn/` | `heady-conn` | headyconnection.org development |

### HeadyStack (Primary Dev)

```bash
# Standard workflow
cd ~/HeadyStack
git fetch heady-sys
git checkout -b feature/my-feature heady-sys/main
# ... develop ...
git push heady-sys feature/my-feature
# Open PR via GitHub
```

### Cross-Clone Sync

When a fix in `HeadyStack` needs to propagate to `HeadyStack.Conn`:

```bash
# In HeadyStack.Conn
git remote add heady-sys https://github.com/HeadyMe/HeadyStack
git fetch heady-sys
git merge heady-sys/main --no-ff -m "sync: pull upstream from heady-sys v3.0.1"
```

---

## Data Drive Mirrors

For disaster recovery, all Git repos are mirrored to the Heady data drive:

| Source | Mirror Path | Sync Frequency |
|--------|-------------|----------------|
| `heady-sys/main` | `/data/mirrors/heady-sys.git` | Every push (webhook) |
| `heady-me/main` | `/data/mirrors/heady-me.git` | Daily |
| `heady-conn/main` | `/data/mirrors/heady-conn.git` | Daily |

Mirror script:

```bash
# /data/mirrors/sync.sh
#!/bin/bash
for REPO in heady-sys heady-me heady-conn; do
  git -C /data/mirrors/${REPO}.git remote update --prune
done
```

---

## Branch Naming Conventions

| Prefix | Purpose | Examples |
|--------|---------|---------|
| `feature/` | New features | `feature/mcp-tool-31`, `feature/groq-engine` |
| `fix/` | Bug fixes | `fix/jwt-refresh-race`, `fix/pgvector-timeout` |
| `chore/` | Maintenance | `chore/dep-upgrades-mar2026`, `chore/lint-cleanup` |
| `release/` | Release prep | `release/3.0.1`, `release/3.1.0-rc1` |
| `hotfix/` | Emergency production fixes | `hotfix/auth-bypass-cve` |
| `spike/` | Experimental (→ sandbox) | `spike/swarm-consensus`, `spike/sacred-geometry-v2` |

---

## Release Protocol

1. Create `release/X.Y.Z` branch from `heady-sys/main`
2. Bump version in `package.json`, `heady-registry.json`, `CHANGELOG.md`
3. PR to `heady-sys/main` — must pass all CI checks
4. Merge with merge commit (no squash on releases)
5. Tag: `git tag v3.0.1 -m "v3.0.1 Aether — stable release"`
6. Push tag: `git push heady-sys v3.0.1`
7. GitHub Release auto-created from tag
8. CI/CD deploys to production
9. Update `heady-me` and `heady-conn` via sync PRs

---

## Access Control

| Role | heady-sys | heady-me | heady-conn | sandbox |
|------|-----------|----------|------------|---------|
| Eric (Owner) | Admin | Admin | Admin | Admin |
| CI Bot | Write (Actions) | Write (Actions) | Write (Actions) | Write (Actions) |
| Collaborators | Write | Write | Write | Write |
| Public | Read (if public) | — | — | — |
