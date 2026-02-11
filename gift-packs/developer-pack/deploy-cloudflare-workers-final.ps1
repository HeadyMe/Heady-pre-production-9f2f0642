<#
.SYNOPSIS
Deploys Cloudflare Workers with full automation using direct API calls
#>

param(
    [switch]$TestMode
)

# 1. Install dependencies
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    winget install -e --id OpenJS.NodeJS
}

# 2. Load config
$configPath = "$PSScriptRoot\..\workers\config.json"
$config = Get-Content $configPath | ConvertFrom-Json

# 3. Deploy workers
function Deploy-Worker {
    param($workerPath, $envName)
    
    Push-Location $workerPath
    npm install
    if (-not $TestMode) {
        wrangler publish --env $envName
    }
    Pop-Location
}

Deploy-Worker "$PSScriptRoot\..\workers\service-worker" "production"
Deploy-Worker "$PSScriptRoot\..\workers\gateway-worker" "production"

# 4. Update Cloudflare config
function Update-CloudflareConfig {
    param($domain, $envConfig)
    
    # Add proper authentication header format
    $headers = @{
        "Authorization" = "Bearer $env:CLOUDFLARE_API_TOKEN"
        "Content-Type" = "application/json"
    }
    
    try {
        # Get zone ID dynamically
        $zoneResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$domain" -Headers $headers
        if (-not $zoneResponse.success) {
            throw "Zone lookup failed: $($zoneResponse.errors[0].message)"
        }
        $zoneId = $zoneResponse.result[0].id
        
        # Create DNS records
        $dnsBody = @{
            type = "CNAME"
            name = "auth.$domain"
            content = "$domain.workers.dev"
            ttl = 1
        } | ConvertTo-Json
        
        $dnsResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" \
            -Method Post -Headers $headers -Body $dnsBody
        if (-not $dnsResponse.success) {
            throw "DNS record creation failed: $($dnsResponse.errors[0].message)"
        }
        
        # Add Worker routes
        $routeBody = @{
            pattern = "$domain/*"
            script = "service-worker"
        } | ConvertTo-Json
        
        $routeResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/workers/routes" \
            -Method Post -Headers $headers -Body $routeBody
        if (-not $routeResponse.success) {
            throw "Worker route creation failed: $($routeResponse.errors[0].message)"
        }
    } catch {
        Write-Error "Cloudflare API error: $_"
        exit 1
    }
}

foreach ($domain in $config.domains) {
    $envConfig = $config.environments.production
    Update-CloudflareConfig $domain $envConfig
}

Write-Host "Deployment complete" -ForegroundColor Green
