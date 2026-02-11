<#
.SYNOPSIS
Manages mTLS services as Windows native services
#>

param(
    [ValidateSet('install','start','stop','uninstall')]
    [string]$Action = 'start'
)

# Service definitions
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
    switch ($Action) {
        'install' {
            nssm install $svc.Name $svc.Binary $svc.Args
            nssm set $svc.Name AppDirectory "$PSScriptRoot\.."
        }
        'start' { nssm start $svc.Name }
        'stop' { nssm stop $svc.Name }
        'uninstall' { nssm remove $svc.Name confirm }
    }
}
