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
<# ║  FILE: scripts/sync-priority.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Synchronizes priority changes across repositories using parallel distributed processing
#>

# Load environment
. $PSScriptRoot\..\.env.local

# Connect to Heady Cloud
$cloudEndpoint = "https://cloud.headysystems.com"

# Get priority changes
$changes = Get-Content "$PSScriptRoot\..\data\priority-changes.json" | ConvertFrom-Json

# Split into batches
$batchSize = [math]::Ceiling($changes.Count / 10)
$batches = @()
for ($i=0; $i -lt $changes.Count; $i += $batchSize) {
    $batches += , $changes[$i..($i+$batchSize-1)]
}

# Process batches in parallel
$batches | ForEach-Object -Parallel {
    $batch = $_
    $params = @{
        Uri = "$using:cloudEndpoint/api/v1/priority-sync"
        Method = "POST"
        Headers = @{
            "Authorization" = "Bearer $using:HEADY_API_KEY"
        }
        Body = $batch | ConvertTo-Json
        ContentType = "application/json"
    }
    try {
        $response = Invoke-RestMethod @params
        Write-Host "Batch processed: $($response.successCount)/$($batch.Count)"
    } catch {
        Write-Host "Batch failed: $_"
    }
} -ThrottleLimit 10
