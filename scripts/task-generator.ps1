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
<# ║  FILE: scripts/task-generator.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Generates 1000+ improvement tasks using HeadyBrain with fallback
#>

# Load configuration
$config = Get-Content "$PSScriptRoot\..\configs\auto-pipeline.yaml" | ConvertFrom-Yaml
$brainEndpoint = ($config.services | Where-Object { $_.name -eq "HeadyBrain" }).endpoint

# Fallback endpoint
$fallbackEndpoint = "https://cloud.headysystems.com/api/brain"

# Get project context
$context = Get-Content "$PSScriptRoot\..\project-context.json" | ConvertFrom-Json

# Request task generation
$body = @{
    count = 1000
    context = $context
} | ConvertTo-Json

try {
    $tasks = Invoke-RestMethod -Uri "$brainEndpoint/api/v1/generate-tasks" -Method POST -Body $body
} catch {
    Write-Host "Primary brain endpoint failed, using fallback"
    $tasks = Invoke-RestMethod -Uri "$fallbackEndpoint/api/v1/generate-tasks" -Method POST -Body $body
}

# Save tasks
$tasks | ConvertTo-Json | Set-Content "$PSScriptRoot\..\data\improvement-tasks.json"

Write-Host "Generated $($tasks.Count) improvement tasks"
