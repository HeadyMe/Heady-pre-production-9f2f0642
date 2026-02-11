<#
.SYNOPSIS
Deploys Cloudflare Workers with full automation
#>

# 1. Install dependencies
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    winget install -e --id OpenJS.NodeJS
}

# 2. Build workers
Push-Location "$PSScriptRoot\..\workers\service-worker"
npm install
wrangler publish --env production
Pop-Location

Push-Location "$PSScriptRoot\..\workers\gateway-worker"
npm install
wrangler publish --env production
Pop-Location

# 3. Update DNS and routes using Cloudflare API
function Update-CloudflareConfig {
    param($domain, $envConfig)
    
    $headers = @{
        "Authorization" = "Bearer $env:CLOUDFLARE_API_TOKEN"
        "Content-Type" = "application/json"
    }
    
    # Create DNS records
    $body = @{
        type = "CNAME"
        name = "auth.$domain"
        content = "$domain.workers.dev"
        ttl = 1
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$($envConfig.zone_id)/dns_records" \
        -Method Post -Headers $headers -Body $body
    
    # Add Worker routes
    $body = @{
        pattern = "$domain/*"
        script = "service-worker"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$($envConfig.zone_id)/workers/routes" \
        -Method Post -Headers $headers -Body $body
}

$config = Get-Content "$PSScriptRoot\..\workers\config.json" | ConvertFrom-Json

foreach ($domain in $config.domains) {
    Update-CloudflareConfig -domain $domain -envConfig $config.env_config
}

Write-Host "Deployment complete" -ForegroundColor Green
