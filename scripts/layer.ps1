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
<# ║  FILE: scripts/layer.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>

param(
    [string]$Action = "status",
    [string]$Layer
)

$LAYERS = @{
    "local" = @{ Name = "Local Dev"; Color = "Green"; Endpoint = "http://localhost:3300/api" }
    "cloud-me" = @{ Name = "Cloud HeadyMe"; Color = "Cyan"; Endpoint = "https://heady-manager-headyme.onrender.com/api" }
    "cloud-sys" = @{ Name = "Cloud HeadySystems"; Color = "Magenta"; Endpoint = "https://heady-manager-headysystems.onrender.com/api" }
    "cloud-conn" = @{ Name = "Cloud HeadyConnection"; Color = "Yellow"; Endpoint = "https://heady-manager-headyconnection.onrender.com/api" }
    "hybrid" = @{ Name = "Hybrid Local+Cloud"; Color = "White"; Endpoint = "http://localhost:3300/api" }
}

function Show-Status {
    $activeLayer = Get-Content "$PSScriptRoot\.heady-active-layer" -ErrorAction SilentlyContinue
    if (-not $activeLayer) { $activeLayer = "cloud-sys" }
    
    $layer = $LAYERS[$activeLayer]
    $color = if ($layer.Color) { $layer.Color } else { "White" }
    Write-Host "Active Layer: " -NoNewline
    Write-Host $layer.Name -ForegroundColor $color
    Write-Host "Endpoint: $($layer.Endpoint)"
    
    # Health check
    try {
        $health = Invoke-RestMethod "$($layer.Endpoint)/health" -TimeoutSec 3
        Write-Host "Health: " -NoNewline
        Write-Host "OK" -ForegroundColor Green
    } catch {
        Write-Host "Health: " -NoNewline
        Write-Host "UNREACHABLE" -ForegroundColor Red
    }
}

function Switch-Layer {
    param($Layer)
    
    if (-not $LAYERS.ContainsKey($Layer)) {
        Write-Host "Invalid layer: $Layer" -ForegroundColor Red
        Write-Host "Valid layers: $($LAYERS.Keys -join ', ')"
        return
    }
    
    $layer = $LAYERS[$Layer]
    
    # Health check before switching
    try {
        $health = Invoke-RestMethod "$($layer.Endpoint)/health" -TimeoutSec 3
        if (-not $health.ok) { throw "Health check failed" }
    } catch {
        Write-Host "Health check failed for $($layer.Name)" -ForegroundColor Red
        return
    }
    
    # Update active layer
    $Layer | Out-File "$PSScriptRoot\.heady-active-layer"
    
    # Update environment
    [Environment]::SetEnvironmentVariable("HEADY_ACTIVE_LAYER", $Layer, "User")
    [Environment]::SetEnvironmentVariable("HEADY_ACTIVE_ENDPOINT", $layer.Endpoint, "User")
    
    Write-Host "Switched to layer: " -NoNewline
    Write-Host $layer.Name -ForegroundColor $layer.Color
}

function List-Layers {
    $activeLayer = Get-Content "$PSScriptRoot\.heady-active-layer" -ErrorAction SilentlyContinue
    if (-not $activeLayer) { $activeLayer = "cloud-sys" }
    
    Write-Host "Available Layers:"
    foreach ($key in $LAYERS.Keys) {
        $layer = $LAYERS[$key]
        $prefix = if ($key -eq $activeLayer) { "* " } else { "  " }
        Write-Host "$prefix$($layer.Name) ($key)" -ForegroundColor $layer.Color
    }
}

# Main command routing
switch ($Action) {
    "status" { Show-Status }
    "list" { List-Layers }
    "switch" { Switch-Layer -Layer $Layer }
    default { Write-Host "Unknown action: $Action" }
}
