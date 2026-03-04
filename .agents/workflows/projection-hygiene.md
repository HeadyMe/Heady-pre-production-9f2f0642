---
description: Projection hygiene — ensures no sparse, one-off, or orphan files accumulate outside of vector memory's projection targets
---

# Projection Hygiene Workflow

// turbo-all

> **Every file in this repo must be a DESIRED PROJECTION of vector memory.** One-time scripts, scratch files, ad-hoc experiments, and orphaned modules must not accumulate. If data was embedded into vector memory, the script that did the embedding is no longer needed.

## Core Rule

Every file, worker, service, config, and menu entry across ALL targets must be a DESIRED projection of vector memory. If it's not, it's orphaned and should be cleaned or removed.

### Projection Targets (Full Scope)

```
Vector Memory (source of truth)
        │
        ├── LOCAL REPO projections
        │     src/         — active service modules
        │     configs/     — governance, policies, fabric
        │     .agents/     — workflows, skills, directives
        │     tests/       — validation suites
        │     docs/        — documentation
        │     packages/    — SDK, libraries
        │     scripts/     — operational tools (install, deploy)
        │     data/        — vector shards, persistent state
        │
        ├── CLOUDFLARE projections
        │     Workers      — heady-edge-node, routing workers
        │     KV namespaces — session data, config caches
        │     R2 buckets    — object storage
        │     Vectorize    — edge vector indices
        │     DNS/Tunnels  — domain routing
        │
        ├── GOOGLE CLOUD projections
        │     Cloud Run    — heady-colab-runtime service
        │     Secret Manager — API keys, credentials
        │     Artifact Registry — container images
        │
        ├── HUGGING FACE projections
        │     Spaces       — heady-demo, heady-systems, heady-connection
        │     Repos        — model weights, datasets
        │
        ├── LOCAL DEVICE projections
        │     ~/.config/   — app configs, MCP configs
        │     ~/.local/    — local data, state
        │     Desktop files — shortcuts, launchers
        │
        └── MATE DESKTOP projections
              Menu items   — .desktop entries
              Panel applets — custom launchers
              File manager bookmarks
              Custom actions
```

### What Must NOT Exist

- One-time embed/ingest scripts (data already in vector memory)
- Scratch/debug/temp files anywhere
- Non-functional menu items or .desktop entries
- Orphaned Workers or KV namespaces no longer referenced
- Cloud Run revisions for deleted services
- Stale HF Spaces with broken configs
- Device configs pointing to dead endpoints

## When to Run This Check

- **Before every commit** — scan for files that shouldn't be projections
- **After any batch operation** — scripts that served their purpose should be deleted
- **During `/concept-alignment`** — verify all files map to a concept or projection target
- **Weekly maintenance** — part of `/memory-compaction`

## Validation Steps

### 1. Check scripts/ for one-time-use files

```bash
ls -la scripts/
```

Rule: Every file in `scripts/` must be an **operational tool** (install, deploy, maintenance). One-time data embedding scripts are deleted after their data is in vector memory.

### 2. Check src/ for orphaned modules

Every file in `src/` must have at least one of:

- A bee that manages it
- A route wired in heady-manager
- An import from another active module
- A test file

```bash
# Find .js files in src/ not imported by anything
for f in src/*.js; do
  base=$(basename "$f" .js)
  count=$(grep -rl "$base" src/ heady-manager.js tests/ --include="*.js" 2>/dev/null | wc -l)
  if [ "$count" -le 1 ]; then
    echo "⚠  ORPHAN: $f (only $count references)"
  fi
done
```

### 3. Check for duplicate implementations

```bash
# Files with overlapping names or purposes
find src/ -name "*.js" | sort | uniq -d
```

### 4. Verify every file has a vector memory presence

All active files should have been embedded during the initial deep embed. If a file exists that isn't in vector memory, either embed it or delete it.

## Antigravity Directive

> [!IMPORTANT]
> **For Antigravity agents**: When creating files:
>
> 1. **Ask first**: "Is this a desired projection, or a one-time operation?"
> 2. **If one-time**: Write to `/tmp/`, execute, then delete. Or embed inline via `node -e`.
> 3. **If projection**: It must be tracked by a bee, tested, and imported by the system.
> 4. **After embedding data**: Delete the embedding script. The data IS the source of truth.
> 5. **Never leave scratch files**: No `test-*.js`, `debug-*.js`, `temp-*.js` in the repo.

## Approved Projection Directories

| Directory | What Belongs | What Does NOT |
| --- | --- | --- |
| `src/` | Active modules wired to bees/routes | One-time scripts, experiments |
| `src/bees/` | Auto-discovered bee workers | Static helpers, unreferenced files |
| `src/services/` | Services with API endpoints | Orphaned modules |
| `configs/` | Governance, policies, fabric, schemas | Scratch configs, temp overrides |
| `.agents/` | Workflows, skills, directives | Draft notes, personal logs |
| `tests/` | Test suites for active modules | Tests for deleted modules |
| `scripts/` | Install, deploy, ops tools | One-time data scripts |
| `packages/` | Distributable SDKs | Incomplete experiments |
| `docs/` | Documentation for users/devs | Personal notes, drafts |
