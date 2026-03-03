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
<# ║  FILE: scripts/file_maintenance/pre_scan_check.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# PRE-SCAN CHECK SCRIPT
# Pull latest changes, build file inventory, prioritize scan order

# Step 1: Pull latest from all repos
Write-Host "Pulling latest changes from all repositories"
git -C "$PSScriptRoot\..\.." pull --all

# Step 2: Build file inventory
$fileInventory = Get-ChildItem -Path "$PSScriptRoot\..\.." -Recurse -Depth 5 -File | 
    Where-Object { $_.FullName -notmatch '\.git|node_modules|venv|__pycache__' } |
    Select-Object FullName, LastWriteTime

# Step 3: Identify changed files
$changedFiles = $fileInventory | Where-Object { 
    $_.LastWriteTime -gt (Get-Date).AddDays(-7) 
}

# Step 4: Prioritize scan order
$priorityFiles = $changedFiles | Sort-Object LastWriteTime -Descending

# Output for next steps
$priorityFiles | Export-Csv -Path "$PSScriptRoot\scan_priority.csv" -NoTypeInformation
Write-Host "Pre-scan complete. Prioritized ${($priorityFiles.Count)} files for scanning."
