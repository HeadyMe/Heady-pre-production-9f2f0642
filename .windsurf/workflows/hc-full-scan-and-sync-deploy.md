---
description: HC Full Scan and Sync with Auto Deploy
---

# HC Full Scan and Sync with Auto Deploy

This workflow executes a complete system scan, syncs all repositories, and deploys in auto mode.

## Steps

1. **Run full system scan**:

   ```powershell
   .\hc.ps1 scan-all
   ```

   Updates `lastScanned` in registry for all files

2. **Sync all repositories**:

   ```powershell
   .\scripts\Heady-Sync.ps1 -Mode Auto
   ```

   Synchronizes all local and remote repositories

3. **Execute auto deployment**:

   ```powershell
   .\hcfp-build.ps1 -Mode Auto -Environment Production
   ```

   Runs HCFullPipeline in auto deployment mode

4. **Verify deployment**:

   ```powershell
   .\scripts\verify-deployment.ps1
   ```

   Checks deployment status and operational readiness

## Execution

Run the entire workflow with:

```powershell
.\hc.ps1 full-scan-and-deploy
```
