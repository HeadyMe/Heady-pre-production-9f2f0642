<#
.DESCRIPTION
Heady Localhost Elimination Verification Script

Enforces the Localhost Elimination Protocol:
- No localhost or 127.0.0.1 references
- All services use canonical domains
#>

# Import protocol rules
$protocol = Get-Content -Path "$PSScriptRoot\..\configs\localhost-elimination-protocol.yaml" | ConvertFrom-Yaml

# Scan for prohibited patterns
$offenders = @()

foreach ($pattern in $protocol.scan_patterns) {
    $matches = Get-ChildItem -Path "$PSScriptRoot\.." -Recurse -Include *.js,*.ts,*.yaml,*.json,*.md,*.ps1,*.bat,*.conf | 
        Select-String -Pattern $pattern | 
        Select-Object -ExpandProperty Path
    
    if ($matches.Count -gt 0) {
        $offenders += $matches
    }
}

# Remove duplicates
$offenders = $offenders | Sort-Object -Unique

# Check for exceptions
$finalOffenders = @()
foreach ($file in $offenders) {
    $content = Get-Content $file -Raw
    $isException = $false
    
    # Check if file matches any exception rules
    foreach ($exception in $protocol.exceptions) {
        if ($content -match $exception) {
            $isException = true
            break
        }
    }
    
    if (-not $isException) {
        $finalOffenders += $file
    }
}

# Report results
if ($finalOffenders.Count -gt 0) {
    Write-Host "FAIL: Found $($finalOffenders.Count) files with localhost references" -ForegroundColor Red
    $finalOffenders | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

Write-Host "PASS: No localhost references found" -ForegroundColor Green
exit 0
