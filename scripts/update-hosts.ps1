<#
.SYNOPSIS
Updates Windows hosts file for internal DNS resolution
#>

$hostsEntry = "127.0.0.1 api.internal.headymcp.com"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

# Add entry if not exists
if (-not (Select-String -Path $hostsPath -Pattern "api.internal.headymcp.com" -Quiet)) {
    Add-Content -Path $hostsPath -Value "`n$hostsEntry"
    Write-Host "Added hosts file entry" -ForegroundColor Green
} else {
    Write-Host "Hosts entry already exists" -ForegroundColor Yellow
}
