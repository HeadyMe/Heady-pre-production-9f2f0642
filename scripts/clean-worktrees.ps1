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
<# ║  FILE: scripts/clean-worktrees.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
@echo off

param(
    [string]$MainBranch = "main",
    [bool]$DryRun = $false
)

$BACKUP_DIR = "$HOME\heady-worktree-backups"
New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

Write-Host "🧹 Scanning worktrees for repo: $(Get-Location)"
Write-Host "📊 Main branch: $MainBranch"

$worktrees = git worktree list --porcelain | Where-Object { $_ -match 'worktree (.*)' } | ForEach-Object { $matches[1] }

$worktrees | ForEach-Object -Parallel {
    $wt = $_
    
    if ($wt -eq (Get-Location).Path) {
        Write-Host "✅ Skipping primary worktree: $wt"
        return
    }
    
    $branch = git -C "$wt" rev-parse --abbrev-ref HEAD 2>$null
    if (-not $branch) { $branch = "DETACHED" }
    
    $lastCommitDate = git -C "$wt" log -1 --format=%ci 2>$null
    $daysOld = if ($lastCommitDate) { [math]::Floor((Get-Date - (Get-Date $lastCommitDate)).TotalDays) } else { 999 }
    
    Write-Host "`n📂 Worktree: $wt"
    Write-Host "   Branch: $branch"
    Write-Host "   Last commit: $lastCommitDate ($daysOld days ago)"
    
    if ($branch -eq "DETACHED") {
        Write-Host "   ⚠️  Detached HEAD - manual review required"
        return
    }
    
    # Check for uncommitted changes
    if (git -C "$wt" diff-index --quiet HEAD 2>$null) {
        Write-Host "   💾 Backing up uncommitted changes..."
        $backupFile = "$BACKUP_DIR\$(Split-Path $wt -Leaf)_${branch}_$(Get-Date -Format 'yyyyMMdd_HHmmss').patch"
        git -C "$wt" diff > $backupFile
    }
    
    # Check if merged
    $isMerged = git branch --merged $MainBranch | Select-String -Pattern " $branch`$"
    
    $shouldDelete = $false
    $reason = ""
    
    if ($isMerged -and $daysOld -gt 2) {
        $shouldDelete = $true
        $reason = "merged into $MainBranch and inactive >2 days"
    }
    elseif ($daysOld -gt 14) {
        $shouldDelete = $true
        $reason = "no activity in 14+ days"
    }
    elseif ($wt -match "(scratch|experiment|test|wip|tmp)") {
        $shouldDelete = $true
        $reason = "temporary/experimental path"
    }
    
    if ($shouldDelete) {
        Write-Host "   🗑️  Marked for deletion: $reason"
        if (-not $DryRun) {
            git worktree remove --force "$wt" 2>$null
            if ($?) { Write-Host "   ✅ Removed" } else { Write-Host "   ❌ Failed to remove" }
        }
        else {
            Write-Host "   🔍 DRY RUN - would delete"
        }
    }
    else {
        Write-Host "   ✅ Keeping (active or not merged)"
    }
} -ThrottleLimit 5

Write-Host "`n🎯 Cleanup complete. Remaining worktrees:"
git worktree list

if (-not $DryRun) {
    Write-Host "`n🧹 Running git gc to reclaim disk space..."
    git gc --prune=now --aggressive
}
