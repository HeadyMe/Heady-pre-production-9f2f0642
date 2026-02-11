<#
.SYNOPSIS
Proper Windows service setup for mTLS components
#>

# 1. Install Chocolatey if missing
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# 2. Install NSSM
choco install nssm -y

# 3. Create services
$services = @(
    @{
        Name = 'HeadyNginx'
        Binary = 'nginx.exe'
        Args = '-c "$PSScriptRoot\..\configs\nginx\nginx-mtls.conf"'
    },
    @{
        Name = 'HeadyCloudflared'
        Binary = 'cloudflared.exe'
        Args = '--config "$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml"'
    }
)

foreach ($svc in $services) {
    & "C:\ProgramData\chocolatey\bin\nssm.exe" install $svc.Name $svc.Binary $svc.Args
    & "C:\ProgramData\chocolatey\bin\nssm.exe" set $svc.Name AppDirectory "$PSScriptRoot\.."
    Start-Service $svc.Name
}
