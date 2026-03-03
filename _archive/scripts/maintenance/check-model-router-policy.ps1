<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/maintenance/check-model-router-policy.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# ============================================================
# HEADY SYSTEMS | Model-Router Policy Verification
# ============================================================
# Validates that the model-router config matches this repo's
# declared type (hybrid / offline / cloud) in repo-type.yaml.

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot)

# --- Read repo type ---
$manifestPath = Join-Path $root 'repo-type.yaml'
if (-not (Test-Path $manifestPath)) {
    Write-Error "repo-type.yaml not found at $manifestPath"
    exit 1
}

# Simple YAML key extraction (no external module needed)
$manifest = [System.IO.File]::ReadAllText($manifestPath)
$repoType = if ($manifest -match '(?m)^type:\s*(\S+)') { $Matches[1] } else { 'unknown' }

Write-Host "`n=== Model-Router Policy Check ===" -ForegroundColor Cyan
Write-Host "Repo type: $repoType" -ForegroundColor White

$routerDir = Join-Path $root 'services\model-router'
$errors = @()

switch ($repoType) {
    'hybrid' {
        # Hybrid: must allow both local and cloud
        $policy = [System.IO.File]::ReadAllText($manifestPath)
        if ($policy -notmatch 'cloudFallback:\s*true') {
            $errors += "Hybrid repo should have cloudFallback: true"
        }
        Write-Host "  Policy: LOCAL_FIRST with cloud fallback" -ForegroundColor Green
    }
    'offline' {
        # Offline: must NOT have any cloud providers
        $policy = [System.IO.File]::ReadAllText($manifestPath)
        if ($policy -match 'cloud' -and $policy -notmatch 'cloudFallback:\s*false') {
            $errors += "Offline repo must have cloudFallback: false"
        }
        if ($policy -match 'allowedProviders:.*cloud') {
            $errors += "Offline repo must not list 'cloud' in allowedProviders"
        }
        Write-Host "  Policy: LOCAL_ONLY, no cloud endpoints" -ForegroundColor Green
    }
    'cloud' {
        # Cloud: should prefer cloud providers
        $policy = [System.IO.File]::ReadAllText($manifestPath)
        if ($policy -notmatch 'CLOUD') {
            $errors += "Cloud repo should have CLOUD_ONLY or CLOUD_FIRST strategy"
        }
        Write-Host "  Policy: CLOUD_ONLY or CLOUD_FIRST" -ForegroundColor Green
    }
    default {
        $errors += "Unknown repo type: $repoType"
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`nPolicy violations:" -ForegroundColor Red
    $errors | ForEach-Object { -Parallel { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Model-router policy matches repo type" -ForegroundColor Green
exit 0
