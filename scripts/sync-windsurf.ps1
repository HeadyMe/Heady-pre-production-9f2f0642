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
<# ║  FILE: scripts/sync-windsurf.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Sync Windsurf directories
$sourceDir = "c:\Users\erich\Heady\distribution\ide\windsurf\"

# List of target directories
$targetDirs = @(
    "c:\Users\erich\windsurf2\",
    "c:\Users\erich\CrossDevice\E's OnePlus Open\HeadyStack\distribution\ide\windsurf\",
    "c:\Users\erich\CrossDevice\E's OnePlus Open\storage\distribution\ide\windsurf\",
    "c:\Users\erich\CrossDevice\E's OnePlus Open\storage\HeadySystems\distribution\ide\windsurf\"
)

foreach ($target in $targetDirs) {
    if (Test-Path $target) {
        Write-Host "Syncing $target"
        robocopy $sourceDir $target /MIR /NP /NDL /NFL
    }
    else {
        Write-Host "Directory not found: $target"
    }
}

Write-Host "Synchronization complete"
