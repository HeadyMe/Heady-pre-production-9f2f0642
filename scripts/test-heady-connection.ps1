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
<# ║  FILE: scripts/test-heady-connection.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Enhanced Heady Cloud connection test with DNS diagnostics
#>

# Load environment variables
$envFile = "$PSScriptRoot\..\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

# DNS resolution test
Write-Host "Testing DNS resolution for api.headysystems.com"
try {
    $dnsResult = Resolve-DnsName api.headysystems.com -Type A -ErrorAction Stop
    Write-Host "DNS Resolution SUCCESS"
    $dnsResult | Format-Table
} catch {
    Write-Host "DNS Resolution FAILED: $_"
    exit 1
}

# API connectivity test
$cloudEndpoint = $env:HEADY_API_ENDPOINT + "/health"
if (-not $cloudEndpoint) {
    $cloudEndpoint = "https://headysystems.com/health"
}

try {
    $response = Invoke-RestMethod -Uri $cloudEndpoint -Method GET -ErrorAction Stop
    Write-Host "API Connection SUCCESS: $($response.status)"
} catch {
    Write-Host "API Connection FAILED: $_"
}

# API key validation
$apiKey = [System.Environment]::GetEnvironmentVariable("HEADY_API_KEY")
if (-not $apiKey) {
    Write-Host "HEADY_API_KEY not set - skipping authentication test"
    exit
}

try {
    # Use the health endpoint with authentication
    $authEndpoint = $env:HEADY_API_ENDPOINT + "/api/v1/users/me"
    $authResponse = Invoke-RestMethod -Uri $authEndpoint -Headers @{
        "Authorization" = "Bearer $apiKey"
    }
    Write-Host "API Key VALID: Service status $($authResponse.status)"
} catch {
    Write-Host "API Key INVALID: $_"
}
