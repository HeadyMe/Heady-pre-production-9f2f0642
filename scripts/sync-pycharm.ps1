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
<# ║  FILE: scripts/sync-pycharm.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Sync PyCharm settings across devices
$sourceDir = "c:\Users\erich\Heady\configs\pycharm\"
$extensionSource = "c:\Users\erich\Heady\extensions\pycharm\"
$zipSource = "c:\Users\erich\Heady\distribution\pycharm-extension.zip"
$zipDest = "D:\AndroidSync\PyCharmExtensions\"
$devices = @(
    "C:\Users\erich\AppData\Roaming\JetBrains\PyCharm2023.3",
    "D:\AndroidSync\PyCharmSettings"
)

foreach ($device in $devices) {
    if (Test-Path $device) {
        Write-Host "Syncing $device"
        robocopy $sourceDir $device /MIR /NP /NDL /NFL
        robocopy $extensionSource "$device\extensions\heady" /MIR /NP /NDL /NFL
    }
}

if (Test-Path $zipDest) {
    Copy-Item -Path $zipSource -Destination $zipDest -Force
    Write-Host "Copied extension zip to $zipDest"
}

Write-Host "PyCharm settings synchronized"
