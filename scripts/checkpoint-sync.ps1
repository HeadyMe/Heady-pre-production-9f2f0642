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
<# ║  FILE: scripts/checkpoint-sync.ps1                                                    ║
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
    [ValidateSet('full', 'check', 'fix', 'report')]
    [string]$Mode = 'full'
)

$ErrorActionPreference = 'Continue'
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
        Write-Status "Registry loaded: v$($registry.registryVersion)"
        Write-Info "Components: $($registry.components.Count)"
        Write-Info "Workflows: $($registry.workflows.Count)"
        Write-Info "Environments: $($registry.environments.Count)"
        Write-Info "Docs: $($registry.docs.Count)"
        Write-Info "Notebooks: $($registry.notebooks.Count)"
        Write-Info "AI Nodes: $($registry.aiNodes.Count)"
        Write-Info "Patterns: $($registry.patterns.Count)"
        Write-Info "Repos: $($registry.repos.Count)"

        # Check that all component sourceOfTruth files exist
        foreach ($comp in $registry.components) {
            $sot = Join-Path $RepoRoot $comp.sourceOfTruth
            if (-not (Test-Path $sot)) {
                $issues += "Component '$($comp.id)' sourceOfTruth missing: $($comp.sourceOfTruth)"
                Write-Warning-Msg "Missing: $($comp.sourceOfTruth) (component: $($comp.id))"
            }
        }

        # Check doc paths exist
        foreach ($doc in $registry.docs) {
            $docPath = Join-Path $RepoRoot $doc.path
            if (-not (Test-Path $docPath)) {
                $issues += "Doc '$($doc.id)' missing: $($doc.path)"
                Write-Error-Msg "Missing doc: $($doc.path)"
            }
        }

        # Check notebook paths exist
        foreach ($nb in $registry.notebooks) {
            $nbPath = Join-Path $RepoRoot $nb.path
            if (-not (Test-Path $nbPath)) {
                $issues += "Notebook '$($nb.id)' missing: $($nb.path)"
                Write-Error-Msg "Missing notebook: $($nb.path)"
            }
        }

    } catch {
        $issues += "Registry JSON parse error: $_"
        Write-Error-Msg "Failed to parse registry: $_"
    }
} else {
    $issues += "heady-registry.json not found"
    Write-Error-Msg "heady-registry.json not found at $registryPath"
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. DOC OWNERSHIP & FRESHNESS CHECK
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "2. Doc Ownership & Freshness"

$docOwnersPath = Join-Path $RepoRoot "docs" "DOC_OWNERS.yaml"
if (Test-Path $docOwnersPath) {
    Write-Status "DOC_OWNERS.yaml found"

    # Simple YAML parsing for reviewBy dates (lightweight, no external deps)
    $docOwnersContent = Get-Content $docOwnersPath -Raw
    $today = Get-Date

    # Find all reviewBy entries and check if overdue
    $reviewByMatches = [regex]::Matches($docOwnersContent, 'path:\s*(.+?)[\r\n].*?reviewBy:\s*"(\d{4}-\d{2}-\d{2})"', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($match in $reviewByMatches) {
        $docFile = $match.Groups[1].Value.Trim()
        $reviewBy = [datetime]::Parse($match.Groups[2].Value)
        if ($today -gt $reviewBy) {
            $daysOverdue = ($today - $reviewBy).Days
            $issues += "Doc '$docFile' review overdue by $daysOverdue days"
            Write-Warning-Msg "OVERDUE ($daysOverdue days): $docFile"
        } else {
            $daysUntil = ($reviewBy - $today).Days
            Write-Info "OK ($daysUntil days until review): $docFile"
        }
    }
} else {
    $issues += "docs/DOC_OWNERS.yaml not found"
    Write-Warning-Msg "DOC_OWNERS.yaml not found - cannot check freshness"
}

# ═══════════════════════════════════════════════════════════════════════════
# 3. CONFIG HASH VALIDATION
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "3. Config Hash Validation"

$configFiles = @(
    "configs/hcfullpipeline.yaml",
    "configs/resource-policies.yaml",
    "configs/service-catalog.yaml",
    "configs/governance-policies.yaml",
    "configs/concepts-index.yaml",
    "configs/system-components.yaml",
    "configs/story-driver.yaml"
)

$configHashes = @{}
foreach ($cf in $configFiles) {
    $cfPath = Join-Path $RepoRoot $cf
    if (Test-Path $cfPath) {
        $hash = (Get-FileHash $cfPath -Algorithm SHA256).Hash.Substring(0, 12)
        $configHashes[$cf] = $hash
        Write-Info "$cf → $hash"
    } else {
        $issues += "Config file missing: $cf"
        Write-Warning-Msg "Missing: $cf"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 4. NOTEBOOK EXISTENCE CHECK
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "4. Notebook Validation"

$notebookDir = Join-Path $RepoRoot "notebooks"
if (Test-Path $notebookDir) {
    $notebooks = Get-ChildItem -Path $notebookDir -Filter "*.ipynb" -Recurse
    Write-Status "Found $($notebooks.Count) notebook(s)"
    foreach ($nb in $notebooks) {
        $relPath = $nb.FullName.Replace($RepoRoot, '').TrimStart('\', '/')
        try {
            $nbContent = Get-Content $nb.FullName -Raw | ConvertFrom-Json
            $cellCount = $nbContent.cells.Count
            Write-Info "$relPath ($cellCount cells)"
        } catch {
            $issues += "Notebook parse error: $relPath"
            Write-Error-Msg "Parse error: $relPath"
        }
    }
} else {
    $issues += "notebooks/ directory not found"
    Write-Warning-Msg "notebooks/ directory not found"
}

# ═══════════════════════════════════════════════════════════════════════════
# 5. CRITICAL FILE EXISTENCE CHECK
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "5. Critical File Check"

$criticalFiles = @(
    "README.md",
    "CLAUDE.md",
    "heady-manager.js",
    "heady-registry.json",
    "package.json",
    "render.yaml",
    "Dockerfile",
    ".env.example",
    ".gitignore",
    ".github/copilot-instructions.md",
    "docs/CHECKPOINT_PROTOCOL.md",
    "docs/DOC_OWNERS.yaml",
    "docs/notion-quick-start.md",
    "docs/notion-project-notebook.md",
    "configs/hcfullpipeline.yaml",
    "configs/resource-policies.yaml",
    "configs/service-catalog.yaml",
    "configs/system-components.yaml"
)

$missingCritical = 0
foreach ($f in $criticalFiles) {
    $fPath = Join-Path $RepoRoot $f
    if (Test-Path $fPath) {
        Write-Info "OK: $f"
    } else {
        $missingCritical++
        $issues += "Critical file missing: $f"
        Write-Error-Msg "MISSING: $f"
    }
}

if ($missingCritical -eq 0) {
    Write-Status "All $($criticalFiles.Count) critical files present"
} else {
    Write-Error-Msg "$missingCritical critical file(s) missing"
}

# ═══════════════════════════════════════════════════════════════════════════
# 6. GIT STATE CHECK
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "6. Git State"

try {
    Push-Location $RepoRoot
    $gitStatus = git status --porcelain 2>&1
    $uncommitted = ($gitStatus | Measure-Object).Count
    $branch = git rev-parse --abbrev-ref HEAD 2>&1
    $lastCommit = git log -1 --format="%h %s" 2>&1

    Write-Info "Branch: $branch"
    Write-Info "Last commit: $lastCommit"

    if ($uncommitted -gt 0) {
        Write-Warning-Msg "$uncommitted uncommitted change(s)"
        $issues += "$uncommitted uncommitted changes detected"
    } else {
        Write-Status "Working tree clean"
    }
    Pop-Location
} catch {
    Write-Warning-Msg "Git check failed: $_"
    if ((Get-Location).Path -ne $RepoRoot) { Pop-Location }
}

# ═══════════════════════════════════════════════════════════════════════════
# 7. REGISTRY TIMESTAMP UPDATE (if mode = full or fix)
# ═══════════════════════════════════════════════════════════════════════════
if ($Mode -in @('full', 'fix')) {
    Write-Section "7. Registry Timestamp Update"

    if (Test-Path $registryPath) {
        $regContent = Get-Content $registryPath -Raw
        $newContent = $regContent -replace '"updatedAt":\s*"[^"]*"', "`"updatedAt`": `"$timestamp`""
        if ($regContent -ne $newContent) {
            Set-Content -Path $registryPath -Value $newContent -NoNewline
            $fixed += "Registry updatedAt → $timestamp"
            Write-Status "Registry updatedAt updated to $timestamp"
        } else {
            Write-Info "Registry timestamp already current"
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════════════════
Write-Section "CHECKPOINT SYNC REPORT"

Write-Host ""
Write-Host "  Timestamp: $timestamp" -ForegroundColor DarkGray
Write-Host "  Mode:      $Mode" -ForegroundColor DarkGray
Write-Host "  Issues:    $($issues.Count)" -ForegroundColor $(if ($issues.Count -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "  Fixed:     $($fixed.Count)" -ForegroundColor $(if ($fixed.Count -gt 0) { 'Green' } else { 'DarkGray' })
Write-Host ""

if ($issues.Count -gt 0) {
    Write-Host "  Issues Found:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "    - $issue" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($fixed.Count -gt 0) {
    Write-Host "  Auto-Fixed:" -ForegroundColor Green
    foreach ($f in $fixed) {
        Write-Host "    - $f" -ForegroundColor Green
    }
    Write-Host ""
}

# Config hashes summary
Write-Host "  Config Hashes:" -ForegroundColor Cyan
foreach ($key in $configHashes.Keys | Sort-Object) {
    Write-Host "    $key → $($configHashes[$key])" -ForegroundColor DarkGray
}
Write-Host ""

if ($issues.Count -eq 0) {
    Write-Host "  ∞ All files in sync. Checkpoint passed. ∞" -ForegroundColor Green
} else {
    Write-Host "  ⚠ $($issues.Count) issue(s) detected. Review and fix before proceeding." -ForegroundColor Yellow
}

Write-Host ""
