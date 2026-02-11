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
<# ║  FILE: scripts/resource-enforcer.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Enforces resource limits for Windsurf workspaces
.DESCRIPTION
Monitors open workspaces and processes, enforcing configurable limits
#>

param(
    [int]$MaxWorkspaces = 3,
    [int]$MaxRAMGB = 6
)

# Load configuration
$configPath = "$PSScriptRoot\..\configs\resource-rules.yaml"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Yaml
    $MaxWorkspaces = $config.max_workspaces
    $MaxRAMGB = $config.max_ram_gb
}

# Get current workspace processes
$workspaceProcs = Get-Process | Where-Object { $_.ProcessName -match "code|windsurf|tsc|python" }

# Enforce workspace limit
if ($workspaceProcs.Count -gt $MaxWorkspaces) {
    $oldest = $workspaceProcs | Sort-Object StartTime | Select-Object -First ($workspaceProcs.Count - $MaxWorkspaces)
    $oldest | ForEach-Object { 
        Write-Host "Closing workspace: $($_.ProcessName) (PID: $($_.Id))"
        Stop-Process -Id $_.Id -Force 
    }
}

# Check RAM pressure
$ramUsage = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue / 1024
if ($ramUsage -lt (Get-Counter '\Memory\Committed Bytes').CounterSamples.CookedValue / 1GB - $MaxRAMGB) {
    Write-Host "RAM pressure detected - triggering aggressive cleanup"
    & "$PSScriptRoot\resource-cleaner.ps1" -Aggressive
}

# Offload to remote resources
& "$PSScriptRoot\remote-resource-router.ps1"

# Start remote resource manager
Start-Job -ScriptBlock { 
    & "$PSScriptRoot\remote-resource-manager.ps1" 
}

# Report to Heady resource manager
$body = @{
    timestamp = [DateTime]::UtcNow.ToString('o')
    workspace_count = $workspaceProcs.Count
    ram_available_gb = [Math]::Round($ramUsage, 2)
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://resource-manager.internal.headyio.com/metrics" -Method Post -Body $body
