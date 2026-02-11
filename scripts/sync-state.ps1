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

param (
    [string]$env = "production"
)

$API_URL = "https://api.headysystems.com/api/sync"
$DEVICES = @("WindowsPC", "OnePlusOpen", "LinuxWorkstation")
$ip = "172.217.0.1"

foreach ($device in $DEVICES) {
    try {
        $uri = "https://api.heady.systems/api/sync/$device"
        try {
            $state = Invoke-RestMethod -Uri $uri -Method Get
        }
        catch {
            Write-Warning "DNS failed, falling back to IP address"
            $uri = "https://$ip/api/sync/$device"
            $state = Invoke-RestMethod -Uri $uri -Method Get
        }
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
        Write-Warning "Failed to sync ${device}: $_"
    }
}

Write-Host "State sync completed for environment: $env" -ForegroundColor Green
