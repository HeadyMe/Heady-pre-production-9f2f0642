<#
.SYNOPSIS
Robust service management with proper error handling
#>

function Start-HeadyService {
    param($ServiceName, $ExecutablePath, $Arguments)
    
    try {
        $process = Start-Process -FilePath $ExecutablePath -ArgumentList $Arguments -PassThru -NoNewWindow
        Write-Host "[SUCCESS] Started $ServiceName (PID: $($process.Id))" -ForegroundColor Green
        return $process
    } catch {
        Write-Warning "[ERROR] Failed to start $ServiceName: $($_.Exception.Message)"
        return $null
    }
}

# Main execution
$services = @(
    @{Name="Nginx"; Path="$PSScriptRoot\..\nginx.exe"; Args="-c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`""},
    @{Name="Cloudflared"; Path="$PSScriptRoot\..\cloudflared.exe"; Args="--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`""}
)

foreach ($svc in $services) {
    $process = Start-HeadyService -ServiceName $svc.Name -ExecutablePath $svc.Path -Arguments $svc.Args
    if (-not $process) {
        exit 1
    }
}

# Continuous monitoring
while ($true) {
    foreach ($svc in $services) {
        $running = Get-Process -Name $svc.Name -ErrorAction SilentlyContinue
        if (-not $running) {
            Write-Warning "[WARNING] $($svc.Name) stopped - restarting"
            Start-HeadyService -ServiceName $svc.Name -ExecutablePath $svc.Path -Arguments $svc.Args
        }
    }
    Start-Sleep -Seconds 30
}
