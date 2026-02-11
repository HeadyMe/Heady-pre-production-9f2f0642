---
description: HeadyBrowser Deployment Workflow
---

## Installation Steps
1. **Desktop**:
   ```pwsh
   .\scripts\install-headybrowser.ps1 -Platform desktop
   ```
   
2. **Android**:
   ```pwsh
   .\scripts\install-headybrowser.ps1 -Platform android
   ```

## Update Existing Installation
Add `-UpdateOnly` flag to skip build process:
```pwsh
.\scripts\install-headybrowser.ps1 -Platform android -UpdateOnly
```
