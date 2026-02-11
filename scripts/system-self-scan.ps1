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
<# ║  FILE: scripts/system-self-scan.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Scans system for duplicate responsibilities and workflow conflicts

.DESCRIPTION
Checks registry and file system for:
- Duplicate workflow responsibilities
- Conflicting auto-deploy scripts
- Nodes/services with overlapping responsibilities
Implements requirements from docs/ERROR_REPORTING_RULES.md
#>

param(
    [string]$RegistryPath = "$PSScriptRoot\..\heady-registry.json",
    [string]$WorkflowPath = "$PSScriptRoot\..\.github\workflows"
)

# Load registry
$registry = Get-Content $RegistryPath | ConvertFrom-Json

# 1. Check for duplicate responsibilities
$responsibilityMap = @{}
$conflicts = @()

foreach ($item in $registry.nodes + $registry.workflows) {
    foreach ($resp in $item.responsibilities) {
        if (-not $responsibilityMap.ContainsKey($resp)) {
            $responsibilityMap[$resp] = @()
        }
        $responsibilityMap[$resp] += $item.id
    }
}

foreach ($resp in $responsibilityMap.Keys) {
    if ($responsibilityMap[$resp].Count -gt 1) {
        $conflicts += [PSCustomObject]@{
            Type = "Duplicate Responsibility"
            Responsibility = $resp
            Items = $responsibilityMap[$resp] -join ", "
            Recommendation = "Mark one as canonical, deprecate others"
        }
    }
}

# 2. Check for conflicting auto-deploy scripts
$deployScripts = Get-ChildItem -Path $WorkflowPath -Filter *deploy*.yml*
$scriptMap = @{}

foreach ($script in $deployScripts) {
    $content = Get-Content $script.FullName -Raw
    if ($content -match 'name:\s*(.*)') {
        $name = $matches[1].Trim()
        if (-not $scriptMap.ContainsKey($name)) {
            $scriptMap[$name] = @()
        }
        $scriptMap[$name] += $script.Name
    }
}

foreach ($name in $scriptMap.Keys) {
    if ($scriptMap[$name].Count -gt 1) {
        $conflicts += [PSCustomObject]@{
            Type = "Conflicting Deploy Scripts"
            Responsibility = $name
            Items = $scriptMap[$name] -join ", "
            Recommendation = "Consolidate into single canonical script"
        }
    }
}

# Output results
if ($conflicts) {
    Write-Host "CONFLICTS DETECTED!" -ForegroundColor Red
    $conflicts | Format-Table -AutoSize
    exit 1
}

Write-Host "No conflicts detected" -ForegroundColor Green
exit 0
