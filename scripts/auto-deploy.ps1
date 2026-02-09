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
<# ║  FILE: scripts/auto-deploy.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Automated deployment script for Heady ecosystem
#>

# Parameters
$TARGETS = @("Windows", "Android", "Linux")
$VERSION = "2.4.0"

foreach ($target in $TARGETS) {
    switch ($target) {
        "Windows" {
            # Build and deploy Windows package
            .\scripts\build-windows.ps1 -Version $VERSION
            .\scripts\deploy-windows.ps1
        }
        "Android" {
            # Build and deploy Android package
            .\scripts\build-android.ps1 -Version $VERSION
            .\scripts\deploy-android.ps1
        }
        "Linux" {
            # Build and deploy Linux package
            .\scripts\build-linux.ps1 -Version $VERSION
            .\scripts\deploy-linux.ps1
        }
    }
}

# Trigger post-deployment sync
.\scripts\sync-state.ps1 -env production

# Update deployment registry
$deployData = @{
    timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    version = $VERSION
    targets = $TARGETS
}
$deployData | ConvertTo-Json | Out-File "deployments/latest.json"
