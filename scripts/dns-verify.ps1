function Test-DNSPropagation {
    param([string]$Domain)
    try {
        $ips = [System.Net.Dns]::GetHostAddresses($Domain)
        Write-Host "✅ $Domain resolves to:" -ForegroundColor Green
        $ips | ForEach-Object { Write-Host "  - $($_.IPAddressToString)" }
        return $true
    } catch {
        Write-Host "❌ $Domain not resolved yet" -ForegroundColor Red
        return $false
    }
}

Test-DNSPropagation "headysystems.com"
Test-DNSPropagation "app.headysystems.com"
Test-DNSPropagation "api.headysystems.com"
