---
description: HC Scan All Files - Update last scanned date for all files
---
# HC Scan All Files

This workflow updates the `lastScanned` date for every tracked file in the registry.

## Steps

1. Run the `hc-scan-all.ps1` script:
   - Enumerate all tracked files (e.g., `git ls-files`)
   - For each file, update the `heady-registry.json`:
     - If the file has an entry, set `lastScanned` to today's date
     - If not, create a registry record and set `lastScanned`
   - Commit the updated `heady-registry.json`

2. (Optional) Run Pattern Engine on a sample or diffs since last scan

3. (Optional) Run SelfCritiqueEngine to generate improvement tasks

4. Log a "Scan summary" story in StoryDriver

## Manual Command
Run:
```powershell
.\hc.ps1 scan-all
```

## API Endpoint
`POST /api/pipeline/scan-all`
