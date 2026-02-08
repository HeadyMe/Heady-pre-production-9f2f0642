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
<# ║  FILE: scripts/checkpoint-sync-fixed.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY SYSTEMS                                                    ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces     ║
# ║  FILE: scripts/checkpoint-sync.ps1                                ║
# ║  LAYER: root                                                      ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

<#
.SYNOPSIS
    Checkpoint Sync - Keep all files up to date at every checkpoint.

.DESCRIPTION
    Runs the Checkpoint Protocol: validates registry, checks doc freshness,
    updates timestamps, detects drift, and reports status.

    This script should be run at every checkpoint:
    - Before/after commits
    - After merges
    - After pipeline stage completions
    - Before releases

.PARAMETER Mode
    full    - Run all checks and updates (default)
    check   - Read-only drift detection, no modifications
    fix     - Auto-fix detected issues where possible
    report  - Generate a checkpoint report only

.EXAMPLE
    .\scripts\checkpoint-sync.ps1
    .\scripts\checkpoint-sync.ps1 -Mode check
    .\scripts\checkpoint-sync.ps1 -Mode fix
#>

param(
    [ValidateSet("full", "check", "fix", "report")]
    [string]$Mode = "full"
)

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
$RepoRoot = Split-Path -Parent $PSScriptRoot

# ─── COLORS ──────────────────────────────────────────────────────────────
function Write-Status($msg) { Write-Host "  [✓] $msg" -ForegroundColor Green }
function Write-Warning-Msg($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Error-Msg($msg) { Write-Host "  [✗] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [·] $msg" -ForegroundColor Cyan }
function Write-Section($msg) { Write-Host "`n━━━ $msg ━━━" -ForegroundColor Magenta }

# ─── BANNER ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ∞ HEADY CHECKPOINT SYNC ∞" -ForegroundColor Magenta
Write-Host "  Mode: $Mode" -ForegroundColor Cyan
Write-Host "  Root: $RepoRoot" -ForegroundColor DarkGray
Write-Host ""

$issues = @()
$fixed = @()
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"

# ═══════════════════════════════════════════════════════════════════════════
# 1. REGISTRY VALIDATION
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "1. Registry Validation"

$registryPath = Join-Path $RepoRoot "heady-registry.json"
if (Test-Path $registryPath) {
    try {
        $registry = Get-Content $registryPath -Raw | ConvertFrom-Json
        Write-Status "Registry loaded: $($registry.components.Count) components"
        
        # Check for missing sourceOfTruth files
        foreach ($component in $registry.components) {
            if ($component.PSObject.Properties.Name -contains "sourceOfTruth") {
                $sourcePath = Join-Path $RepoRoot $component.sourceOfTruth
                if (-not (Test-Path $sourcePath)) {
                    $issues += "Missing sourceOfTruth: $($component.sourceOfTruth)"
                    Write-Warning-Msg "MISSING: $($component.sourceOfTruth)"
                } else {
                    Write-Info "OK: $($component.sourceOfTruth)"
                }
            }
        }
    } catch {
        $issues += "Registry JSON parse error: $($_.Exception.Message)"
        Write-Error-Msg "Registry parse failed"
    }
} else {
    $issues += "Registry not found: heady-registry.json"
    Write-Error-Msg "Registry not found"
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. DOCUMENT FRESHNESS
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "2. Document Freshness"

$ownersPath = Join-Path $RepoRoot "docs/DOC_OWNERS.yaml"
if (Test-Path $ownersPath) {
    $today = Get-Date
    $content = Get-Content $ownersPath -Raw
    
    # Simple regex to extract review dates
    $pattern = 'review_by:\s*(\d{4}-\d{2}-\d{2})'
    $matches = [regex]::Matches($content, $pattern)
    
    foreach ($match in $matches) {
        $reviewBy = [datetime]::Parse($match.Groups[1].Value)
        if ($today -gt $reviewBy) {
            $daysOverdue = ($today - $reviewBy).Days
            $issues += "Doc review overdue by $daysOverdue days"
            Write-Warning-Msg "OVERDUE ($daysOverdue days)"
        } else {
            $daysUntil = ($reviewBy - $today).Days
            Write-Info "OK ($daysUntil days until review)"
        }
    }
} else {
    $issues += "DOC_OWNERS.yaml not found"
    Write-Warning-Msg "DOC_OWNERS.yaml not found - cannot check freshness"
}

# ═══════════════════════════════════════════════════════════════════════════
# 3. CONFIG HASH VALIDATION
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "3. Config Hash Validation"

$configFiles = @(
    "configs/hcfullpipeline.yaml",
    "configs/resource-policies.yaml",
    "configs/monte-carlo-scheduler.yaml"
)

foreach ($configFile in $configFiles) {
    $fullPath = Join-Path $RepoRoot $configFile
    if (Test-Path $fullPath) {
        $hash = Get-FileHash $fullPath -Algorithm SHA256 | Select-Object -ExpandProperty Hash
        Write-Info "Hash: $configFile = $hash.Substring(0, 8)"
    } else {
        $issues += "Missing config: $configFile"
        Write-Warning-Msg "MISSING: $configFile"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 4. GIT STATUS CHECK
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "4. Git Status Check"

Set-Location $RepoRoot
$gitStatus = git status --porcelain 2>$null

if ($LASTEXITCODE -eq 0) {
    $changedFiles = ($gitStatus | Measure-Object).Count
    if ($changedFiles -eq 0) {
        Write-Status "Working directory clean"
    } else {
        $issues += "$changedFiles uncommitted files"
        Write-Warning-Msg "$changedFiles uncommitted files"
    }
} else {
    $issues += "Git status check failed"
    Write-Error-Msg "Git status failed"
}

# ═══════════════════════════════════════════════════════════════════════════
# 5. SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "5. Checkpoint Summary"

Write-Host "  Timestamp: $timestamp" -ForegroundColor DarkGray
Write-Host "  Issues: $($issues.Count)" -ForegroundColor $(if ($issues.Count -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "  Mode: $Mode" -ForegroundColor Cyan

if ($Mode -eq "fix" -and $issues.Count -gt 0) {
    Write-Section "Auto-Fix Attempt"
    Write-Info "Auto-fix mode not yet implemented"
}

Write-Host ""

if ($issues.Count -eq 0) {
    Write-Host "  ∞ All files in sync. Checkpoint passed. ∞" -ForegroundColor Green
} else {
    Write-Host "  ⚠ $($issues.Count) issue(s) detected. Review and fix before proceeding." -ForegroundColor Yellow
}

Write-Host ""
