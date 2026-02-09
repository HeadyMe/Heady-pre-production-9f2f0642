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
<# ║  FILE: scripts/Add-HcPriorityTask.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Title,
    
    [string]$Description = $null,
    
    [ValidateSet('CRITICAL','HIGH','NORMAL','LOW')]
    [string]$Priority = 'HIGH',
    
    [ValidateSet('HCFP','USER')]
    [string]$Queue = 'HCFP'
)

$apiEndpoint = "http://localhost:3300/api/scheduler/submit"

$priorityMap = @{
    CRITICAL = 0
    HIGH     = 1
    NORMAL   = 2
    LOW      = 3
}

$taskPayload = @{
    type = "user_defined"
    priority = $priorityMap[$Priority]
    taskClass = "interactive"
    constraints = @{ 
        queue = $Queue
    }
    payload = @{
        title = $Title
        description = $Description
    }
}

$jsonPayload = $taskPayload | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiEndpoint -Method Post -Body $jsonPayload -ContentType "application/json"
    Write-Host "✅ Priority task '$Title' submitted to $Queue queue (ID: $($response.task.id))"
} catch {
    Write-Error "❌ Failed to submit task: $($_.Exception.Message)"
}
