---
description: RAM-first operations — all ops in vector space, external stores are projections
---

# RAM-First Operations

All Heady operations happen in RAM (vector space). External stores are **projections** — derived state that auto-syncs when RAM changes.

## Source of Truth

```
RAM / Vector Space
    ↓ (delta detected)
sync-projection-bee
    ↓ (inject templates)
├── GitHub (code projection)
├── HF Spaces (UI projection)
├── Cloudflare (edge projection)
└── Cloud Run (origin projection)
```

## Core Principle

> **Deployment is the exception.** The system lives, breathes, and self-corrects inside 3D vector space. Only when changes must leave the vector substrate does deployment occur.

## How It Works

### 1. RAM State Hash

`sync-projection-bee` computes a SHA-256 hash of RAM state (site-registry + templates). This hash lives in memory.

### 2. Delta Detection

On every swarm cycle, the bee compares current hash vs last-projected hash. If they differ, sync fires.

### 3. Template Injection

`template-bee.renderSite()` renders fresh branded pages from `site-registry.json`, injected into:

- `heady-hf-spaces/main/index.html`
- `heady-hf-spaces/systems/index.html`
- `heady-hf-spaces/connection/index.html`

### 4. Git Projection

Changed files are staged, committed with `[sync-projection]` prefix, and pushed. Fully automatic.

### 5. HF Push

Each HF space directory is pushed to its Hugging Face repo.

## Bees Involved

| Bee | Role |
| --- | --- |
| `sync-projection-bee` | Delta detection, template injection, git projection |
| `template-bee` | Page rendering from site-registry |
| `vector-template-bee` | 3D template matching + swarm instantiation |
| `deployment-bee` | Full deployment pipeline (sync → push → verify) |
| `vector-ops-bee` | Anti-sprawl, security, maintenance in vector space |

## ProjectionManager

`vector-space-ops.js` contains the `ProjectionManager` class that tracks sync state for each target:

- `github` — code projection
- `hf-spaces` — UI projection
- `cloudflare` — edge projection
- `cloud-run` — origin projection

When RAM state changes, all projections are marked **stale** until re-synced.

## API Endpoints

- `GET /api/vector-ops/projections` — current projection sync status
- `GET /api/vector-ops/status` — full vector space ops status (includes projections)
- `GET /api/vector-ops/pre-deploy` — pre-deployment validation gate
