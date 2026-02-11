<#
.SYNOPSIS
Verifies mTLS deployment status on Windows
#>

param(
    [string]$DeploymentId
)

if (-not $DeploymentId) {
    $DeploymentId = "LATEST"
}

Write-Host "Verifying deployment status for ID: $DeploymentId"

# Check services
$services = @('HeadyNginx','HeadyCloudflared')
$allRunning = $true

foreach ($svc in $services) {
    $status = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($status -and $status.Status -eq 'Running') {
        Write-Host "$svc is running" -ForegroundColor Green
    } else {
        Write-Warning "$svc is NOT running"
        $allRunning = $false
    }
}

# Test connectivity
if ($allRunning) {
    try {
        $response = Invoke-WebRequest -Uri "https://api.internal.headymcp.com/health" \
            -Certificate (Get-PfxCertificate -FilePath "configs\nginx\ssl\client.pfx")
        Write-Host "Connectivity verified: $($response.Content)" -ForegroundColor Green
    } catch {
        Write-Warning "Connectivity test failed: $_"
    }
}
