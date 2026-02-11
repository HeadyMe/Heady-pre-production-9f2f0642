<#
.SYNOPSIS
Manages services directly with robust error handling
#>

# Ensure required executables exist
$requiredFiles = @(
    "$PSScriptRoot\..\nginx.exe",
    "$PSScriptRoot\..\cloudflared.exe"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Missing required file: $file"
    }
}

# Start services function
function Start-HeadyService {
    param($name, $exe, $arguments)
    
    try {
        $process = Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -NoNewWindow
        Write-Host "Started $name (PID: $($process.Id))" -ForegroundColor Green
        return $process
    } catch {
        Write-Warning "Failed to start $name: $($_.Exception.Message)"
        return $null
    }
}

# Main service management
$services = @(
    @{name="Nginx"; exe="$PSScriptRoot\..\nginx.exe"; arguments="-c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`""},
    @{name="Cloudflared"; exe="$PSScriptRoot\..\cloudflared.exe"; arguments="--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`""}
)

foreach ($svc in $services) {
    $process = Start-HeadyService $svc.name $svc.exe $svc.arguments
    if (-not $process) {
        exit 1
    }
}

# Continuous monitoring
while ($true) {
    foreach ($svc in $services) {
        $running = Get-Process -Name $svc.name -ErrorAction SilentlyContinue
        if (-not $running) {
            Write-Warning "$($svc.name) stopped - restarting"
            Start-HeadyService $svc.name $svc.exe $svc.arguments
        }
    }
    Start-Sleep -Seconds 30
}
