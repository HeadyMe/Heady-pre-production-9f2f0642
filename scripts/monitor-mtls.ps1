<#
.SYNOPSIS
Monitors mTLS services and auto-remediates issues
#>

$ErrorActionPreference = "Stop"

function Test-Service {
    param($name)
    try {
        $status = systemctl is-active $name
        return $status -eq 'active'
    } catch {
        return $false
    }
}

while ($true) {
    # Check Nginx
    if (-not (Test-Service "nginx-mtls")) {
        Write-Warning "Nginx service down - restarting"
        systemctl restart nginx-mtls
    }
    
    # Check Cloudflared
    if (-not (Test-Service "cloudflared")) {
        Write-Warning "Cloudflared service down - restarting"
        systemctl restart cloudflared
    }
    
    # Check certificate expiry
    $certExpiry = openssl x509 -in /etc/nginx/ssl/server.crt -enddate -noout
    if ($certExpiry -match "notAfter=(.*)") {
        $expiryDate = [datetime]::Parse($matches[1])
        if (($expiryDate - (Get-Date)).TotalDays -lt 7) {
            Write-Warning "Certificates expiring soon - regenerating"
            .\scripts\generate-mtls-certs.ps1
            systemctl restart nginx-mtls
        }
    }
    
    Start-Sleep -Seconds 60
}
