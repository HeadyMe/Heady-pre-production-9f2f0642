<#
.SYNOPSIS
Automates mTLS deployment and continuous operation
#>

# 1. Generate certificates
.\scripts\generate-mtls-certs.ps1

# 2. Deploy configurations
Copy-Item -Path .\configs\nginx\mtls.conf -Destination /etc/nginx/conf.d/ -Force
Copy-Item -Path .\configs\nginx\ssl\* -Destination /etc/nginx/ssl/ -Force
Copy-Item -Path .\configs\cloudflared\ingress-rules.yaml -Destination /etc/cloudflared/config.yaml -Force

# 3. Enable services
systemctl enable --now nginx-mtls
systemctl enable --now cloudflared

# 4. Continuous monitoring setup
while ($true) {
    $status = systemctl is-active nginx-mtls
    if ($status -ne 'active') {
        Write-Warning "Nginx service down - restarting"
        systemctl restart nginx-mtls
    }
    Start-Sleep -Seconds 30
}
