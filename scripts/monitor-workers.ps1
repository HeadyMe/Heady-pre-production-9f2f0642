<#
.SYNOPSIS
Monitors Cloudflare Worker performance and traffic
#>

function Get-WorkerMetrics {
    param($workerName)
    
    $headers = @{
        "Authorization" = "Bearer $env:CLOUDFLARE_API_TOKEN"
        "Content-Type" = "application/json"
    }
    
    $metrics = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/workers/scripts/$workerName/analytics" -Headers $headers
    
    return $metrics
}

# Check workers every 5 minutes
while ($true) {
    $serviceMetrics = Get-WorkerMetrics "heady-auth-service-prod-worker"
    $gatewayMetrics = Get-WorkerMetrics "heady-auth-gateway-prod-worker"
    
    Write-Host "[$(Get-Date)] Service Worker: $($serviceMetrics.requests) requests | Gateway: $($gatewayMetrics.requests) requests"
    
    Start-Sleep -Seconds 300
}
