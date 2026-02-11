<#
.SYNOPSIS
Runs services directly without Windows Service manager
#>

# Start Nginx
Start-Process -FilePath "$PSScriptRoot\..\nginx.exe" -ArgumentList "-c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`"" -NoNewWindow

# Start Cloudflared
Start-Process -FilePath "$PSScriptRoot\..\cloudflared.exe" -ArgumentList "--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`"" -NoNewWindow

# Keep process alive
while ($true) {
    $nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    $cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    
    if (-not $nginx) {
        Write-Warning "Nginx stopped - restarting"
        Start-Process -FilePath "$PSScriptRoot\..\nginx.exe" -ArgumentList "-c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`"" -NoNewWindow
    }
    
    if (-not $cloudflared) {
        Write-Warning "Cloudflared stopped - restarting"
        Start-Process -FilePath "$PSScriptRoot\..\cloudflared.exe" -ArgumentList "--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`"" -NoNewWindow
    }
    
    Start-Sleep -Seconds 10
}
