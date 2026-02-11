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
<# ║  FILE: scripts/verify-redundancy.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Verifies deployment redundancy requirements

.DESCRIPTION
Checks if deployment results meet configured redundancy levels
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ResultsPath,
    
    [string]$ConfigPath = "$PSScriptRoot\..\configs\auto-deploy.yaml"
)

# Load configuration
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Yaml

# Load deployment results
$results = Get-Content $ResultsPath -Raw | ConvertFrom-Json

# Verify per-target redundancy
foreach ($target in $config.targets) {
    $targetResults = $results | Where-Object { $_.TargetName -eq $target.name }
    $successCount = ($targetResults | Where-Object { $_.Status -eq "Success" }).Count
    
    if ($successCount -lt $target.redundancy) {
        Write-Error "Target $($target.name) failed redundancy requirement! Success: $successCount, Required: $($target.redundancy)"
        exit 1
    }
}

# Verify overall success rate
$totalSuccess = ($results | Where-Object { $_.Status -eq "Success" }).Count
$requiredSuccess = [math]::Ceiling($config.targets.Count * $config.policies.required_success_rate)

if ($totalSuccess -lt $requiredSuccess) {
    Write-Error "Overall deployment failed! Success: $totalSuccess, Required: $requiredSuccess"
    exit 1
}

Write-Host "Redundancy requirements met!" -ForegroundColor Green
exit 0
