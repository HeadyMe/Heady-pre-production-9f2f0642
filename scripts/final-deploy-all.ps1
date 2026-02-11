<#
.SYNOPSIS
Comprehensive deployment script with error handling
#>

# 1. Verify Cloudflare credentials
if (-not $env:CLOUDFLARE_API_TOKEN) {
    throw "Cloudflare API token missing. Set with `$env:CLOUDFLARE_API_TOKEN='your-token'"
}

# 2. Deploy workers
$workers = @('service-worker', 'gateway-worker', 'secret-service')

foreach ($worker in $workers) {
    $workerPath = "$PSScriptRoot\..\workers\$worker"
    Push-Location $workerPath
    
    try {
        # Install dependencies
        npm install
        
        # Deploy worker
        wrangler deploy
        
        # Add secrets if applicable
        if ($worker -eq 'secret-service') {
            wrangler secret put ENCRYPTION_KEY
        }
    } finally {
        Pop-Location
    }
}

# 3. Configure DNS
$config = Get-Content "$PSScriptRoot\..\workers\config.json" | ConvertFrom-Json

foreach ($domain in $config.domains) {
    # Get zone ID
    $headers = @{
        "Authorization" = "Bearer $env:CLOUDFLARE_API_TOKEN"
        "Content-Type" = "application/json"
    }
    
    $zoneResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$domain" -Headers $headers
    $zoneId = $zoneResponse.result[0].id
    
    # Create DNS records
    $dnsBody = @{
        type = "CNAME"
        name = "auth.$domain"
        content = "$domain.workers.dev"
        ttl = 1
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" \
        -Method Post -Headers $headers -Body $dnsBody
}

Write-Host "Deployment completed successfully" -ForegroundColor Green
