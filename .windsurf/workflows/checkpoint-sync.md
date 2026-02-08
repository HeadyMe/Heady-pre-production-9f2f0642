<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: .windsurf/workflows/checkpoint-sync.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
description: Checkpoint Sync - Keep all files up to date at every checkpoint
auto_execution_mode: 3
---

# Checkpoint Sync Workflow

## Overview
Runs the Checkpoint Protocol to ensure all files — code, config, docs, notebooks, registry — are in sync with the current system state. Should be run at every checkpoint (commit, merge, pipeline stage completion, release).

## When to Use
- Before committing significant changes
- After merging PRs
- After pipeline stage completions
- Before releases
- When you suspect doc or config drift
- When asked to "sync" or "checkpoint" the system

## Steps

### 1. Run Checkpoint Sync (Check Mode)
Review current state without making changes:
// turbo
```powershell
.\scripts\checkpoint-sync.ps1 -Mode check
```

### 2. Review Issues
Read the output carefully. Look for:
- Missing critical files
- Overdue doc reviews
- Registry drift
- Uncommitted changes
- Broken notebooks

### 3. Fix Issues
If issues were found, run in fix mode to auto-fix what's possible:
```powershell
.\scripts\checkpoint-sync.ps1 -Mode fix
```

### 4. Manual Fixes
For issues that can't be auto-fixed:
- Update docs that reference changed APIs/schemas
- Update `heady-registry.json` entries with new versions
- Fix broken notebooks
- Update `docs/DOC_OWNERS.yaml` review dates

### 5. Full Sync
Run full sync to validate everything and update timestamps:
```powershell
.\scripts\checkpoint-sync.ps1 -Mode full
```

### 6. Commit the Sync
```powershell
git add .
git commit -m "checkpoint: sync all files - $(Get-Date -Format 'yyyy-MM-dd')"
```

### 7. Push to All Remotes (Optional)
```powershell
.\scripts\Heady-Sync.ps1
```

## What Gets Checked

| Check | Description |
|-------|-------------|
| Registry validation | Parse `heady-registry.json`, verify sourceOfTruth paths exist |
| Doc freshness | Check `docs/DOC_OWNERS.yaml` review dates for overdue items |
| Config hashes | Compute SHA256 hashes for all config files |
| Notebook validation | Verify all registered notebooks parse correctly |
| Critical files | Ensure all critical files exist |
| Git state | Check for uncommitted changes |
| Registry timestamp | Update `updatedAt` timestamp |

## Related Files
- `docs/CHECKPOINT_PROTOCOL.md` — Full protocol specification
- `docs/DOC_OWNERS.yaml` — Document ownership and review tracker
- `heady-registry.json` — Central catalog
- `configs/notebook-ci.yaml` — Notebook CI configuration
