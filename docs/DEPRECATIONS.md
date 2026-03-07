# Heady™ Deprecations

> Track items scheduled for removal. Nothing here is active in production.

## Removed (2026-03-07)

| Item | Reason | Replaced By |
|------|--------|-------------|
| `heady-manager-v1.js` (90KB) | Dead legacy entrypoint | `heady-manager.js` |
| `battle-synthesis-report.json` | One-off artifact | N/A |
| `infrastructure/` dir | Duplicate of `infra/` | `infra/` |
| `heady-hf-spaces/` | Separate HF repos | Individual HF Space repos |
| 11 loose `.json` task files in `src/` | One-off task artifacts | N/A |
| `docs/api-keys-reference.md` key prefixes | Security risk | Env var names only, no values |

## Scheduled for Removal

| Item | Target Date | Reason |
|------|-------------|--------|
| `_archive/` (1022 files) | After cutover | Move to `heady-archive` repo |
| `Heady-pre-production-9f2f0642` repo | After cutover | Archive on GitHub |
| Cloudflare Tunnel `4a9d0759` | After DNS verification | Dead tunnel, all DNS moved to Pages |

## Naming Rules

**Forbidden in active tree:** `backup`, `copy`, `temp`, `old`, `final`, `v1`, `archive` (except `_archive/`)
