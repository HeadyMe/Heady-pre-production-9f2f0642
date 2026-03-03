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
<# ║  FILE: scripts/maintenance/check-docker-profiles.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# ============================================================
# HEADY SYSTEMS | Docker Profile Verification
# ============================================================
# Ensures all 10 required Docker profiles exist and are valid.

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot)
$profileDir = Join-Path $root 'infra\docker\profiles'

$requiredProfiles = @(
    'local-offline',
    'local-dev',
    'hybrid',
    'cloud-saas',
    'api-only',
    'full-suite',
    'browser-only',
    'voice-enabled',
    'dev-tools',
    'minimal'
)

$missing = @()
$valid   = @()

foreach ($profile in $requiredProfiles) {
    $path = Join-Path $profileDir "$profile.yml"
    if (Test-Path $path) {
        $content = [System.IO.File]::ReadAllText($path)
        if ($content -match 'services:') {
            $valid += $profile
        } else {
            Write-Warning "Profile $profile.yml exists but has no 'services:' block"
            $missing += $profile
        }
    } else {
        $missing += $profile
    }
}

Write-Host "`n=== Docker Profile Check ===" -ForegroundColor Cyan
Write-Host "Valid : $($valid.Count) / $($requiredProfiles.Count)" -ForegroundColor Green
if ($missing.Count -gt 0) {
    Write-Host "Missing/Invalid:" -ForegroundColor Red
    $missing | ForEach-Object { -Parallel { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "All profiles present and valid" -ForegroundColor Green
exit 0
