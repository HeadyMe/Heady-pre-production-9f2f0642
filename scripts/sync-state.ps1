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
<# ║  FILE: scripts/sync-state.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Synchronizes HeadyBuddy state across all devices
#>

$API_URL = "http://localhost:3300/api/buddy/state"
$DEVICES = @("WindowsPC", "OnePlusOpen", "LinuxWorkstation")

foreach ($device in $DEVICES) {
    try {
        $state = Invoke-RestMethod -Uri "$API_URL?device=$device" -Method Get
        Write-Host "Fetched state from $device"
        
        # Merge states (simplified example)
        $globalState = @{}
        if ($state) {
            $globalState[$device] = $state
        }
        
        # Send merged state to all devices
        Invoke-RestMethod -Uri $API_URL -Method Post -Body ($globalState | ConvertTo-Json) `
            -ContentType "application/json"
    }
    catch {
        Write-Warning "Failed to sync $device: $_"
    }
}
