<#
.SYNOPSIS
Verifies full Cloudflare Worker auth system operation
#>

function Test-AuthFlow {
    # Test OAuth login flow
    $login = Invoke-WebRequest "https://auth.headyconnection.org/oauth/login"
    if ($login.StatusCode -ne 200) { throw "Login endpoint failed" }
    
    # Test API gateway
    $api = Invoke-WebRequest "https://api.headyconnection.org/health"
    if ($api.StatusCode -ne 200) { throw "API gateway failed" }
}

function Test-Alerts {
    # Force test alert
    $alertTest = Invoke-RestMethod "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/workers/scripts/heady-auth-service-prod-worker/subdomain"
    if (-not $alertTest.notification_sent) { throw "Alert test failed" }
}

# Run tests
try {
    Test-AuthFlow
    Test-Alerts
    Write-Host "System verification passed" -ForegroundColor Green
    exit 0
} catch {
    Write-Warning "Verification failed: $_"
    exit 1
}
