<#
.DESCRIPTION
Heady Domain Verification Script

Checks all services for compliance with domain governance rules:
- No .onrender.com in user-facing contexts
- All production URLs use HTTPS
- Custom domains properly configured
#>

# Import domain mappings
$domainConfig = Get-Content -Path "$PSScriptRoot\..\configs\domain-mappings.yaml" | ConvertFrom-Yaml

# 1. Check for .onrender.com in user-facing files
$filesWithRenderRefs = Get-ChildItem -Path "$PSScriptRoot\.." -Recurse -Include *.js,*.ts,*.yaml,*.json,*.md | 
    Select-String -Pattern "\.onrender\.com" | 
    Select-Object -ExpandProperty Path

if ($filesWithRenderRefs.Count -gt 0) {
    Write-Host "FAIL: Found $($filesWithRenderRefs.Count) files with .onrender.com references" -ForegroundColor Red
    $filesWithRenderRefs | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

# 2. Verify production URLs use HTTPS
$insecureUrls = Get-ChildItem -Path "$PSScriptRoot\.." -Recurse -Include *.js,*.ts,*.yaml,*.json | 
    Select-String -Pattern "http://(api|app|admin)\." | 
    Select-Object -ExpandProperty Path

if ($insecureUrls.Count -gt 0) {
    Write-Host "FAIL: Found $($insecureUrls.Count) files with insecure HTTP URLs" -ForegroundColor Red
    $insecureUrls | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

# 3. Check Cloudflare DNS configuration
$missingDns = @()
foreach ($domain in $domainConfig.production.headysystems.GetEnumerator()) {
    $dnsRecord = nslookup $domain.Value | Select-String "answer"
    if (-not $dnsRecord) {
        $missingDns += $domain.Value
    }
}

if ($missingDns.Count -gt 0) {
    Write-Host "FAIL: Missing DNS records for domains:" -ForegroundColor Red
    $missingDns | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

Write-Host "PASS: All domain checks completed successfully" -ForegroundColor Green
exit 0
