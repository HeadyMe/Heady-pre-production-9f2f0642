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
<# ║  FILE: scripts/auto-deploy-orchestrator.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Orchestrates fully automated deployments with safety checks
#>

# Import configuration
$config = Get-Content -Raw -Path "$PSScriptRoot\..\configs\auto-deploy-config.json" | ConvertFrom-Json

# Add priority parameter
param(
    [switch]$Priority
)

if ($Priority) {
    Write-Host "Running PRIORITY deployment" -ForegroundColor Magenta
    # Skip safety checks for priority deployments

    # Proceed with deployment
    Write-Host "Initiating automated deployment sequence" -ForegroundColor Green

    # Execute deployment pipeline
    foreach ($target in $config.DeploymentTargets) {
        try {
            Write-Host "Deploying to $target" -ForegroundColor Cyan
            
            # Platform-specific deployment
            switch ($target) {
                "Windows" { .\scripts\deploy-windows.ps1 }
                "Android" { .\scripts\deploy-android.ps1 }
                "Linux" { .\scripts\deploy-linux.ps1 }
            }
            
            # Post-deployment verification
            .\scripts\verify-deployment.ps1 -Target $target
        }
        catch {
            Write-Host "Deployment to $target failed: $_" -ForegroundColor Red
            
            # Only abort if critical deployment
            if ($config.CriticalTargets -contains $target) {
                exit 3
            }
        }
    }

    # Final synchronization
    .\scripts\sync-state.ps1 -env production

    # Update deployment registry
    .\scripts\update-deployment-registry.ps1 -Version $config.Version -Status "success"

    Write-Host "Deployment completed successfully" -ForegroundColor Green
} else {
    # Safety Check 1: Verify system health
    $systemHealth = .\scripts\check-system-health.ps1
    if (-not $systemHealth.AllSystemsGo) {
        Write-Host "Aborting deployment: System health check failed" -ForegroundColor Red
        exit 1
    }

    # Safety Check 2: Verify no active user sessions
    $activeSessions = .\scripts\check-user-sessions.ps1
    if ($activeSessions.Count -gt 0) {
        Write-Host "Aborting deployment: Active user sessions detected" -ForegroundColor Yellow
        exit 2
    }

    # Proceed with deployment
    Write-Host "Initiating automated deployment sequence" -ForegroundColor Green

    # Execute deployment pipeline
    foreach ($target in $config.DeploymentTargets) {
        try {
            Write-Host "Deploying to $target" -ForegroundColor Cyan
            
            # Platform-specific deployment
            switch ($target) {
                "Windows" { .\scripts\deploy-windows.ps1 }
                "Android" { .\scripts\deploy-android.ps1 }
                "Linux" { .\scripts\deploy-linux.ps1 }
            }
            
            # Post-deployment verification
            .\scripts\verify-deployment.ps1 -Target $target
        }
        catch {
            Write-Host "Deployment to $target failed: $_" -ForegroundColor Red
            
            # Only abort if critical deployment
            if ($config.CriticalTargets -contains $target) {
                exit 3
            }
        }
    }

    # Final synchronization
    .\scripts\sync-state.ps1 -env production

    # Update deployment registry
    .\scripts\update-deployment-registry.ps1 -Version $config.Version -Status "success"

    Write-Host "Deployment completed successfully" -ForegroundColor Green
}
