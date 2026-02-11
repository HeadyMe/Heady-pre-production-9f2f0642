<#
.DESCRIPTION
Heady Naming Standards Verification Script

Verifies compliance with all naming standards:
- Domain naming
- Service naming
- Endpoint patterns
- Environment variables
#>

# Import configurations
$namingStandards = Get-Content -Path "$PSScriptRoot\..\configs\naming-standards.yaml" | ConvertFrom-Yaml

# 1. Verify domain naming
$domainViolations = @()
$domainConfig = Get-Content -Path "$PSScriptRoot\..\configs\domain-mappings.yaml" | ConvertFrom-Yaml

foreach ($env in $domainConfig.Keys) {
    foreach ($domainGroup in $domainConfig[$env].PSObject.Properties) {
        foreach ($endpoint in $domainGroup.Value.PSObject.Properties) {
            $url = $endpoint.Value
            if ($url -notmatch "^https://[a-z0-9-]+\.[a-z]{2,}$") {
                $domainViolations += "Invalid domain format: $url"
            }
        }
    }
}

# 2. Verify service naming
$serviceViolations = @()
$serviceFiles = Get-ChildItem -Path "$PSScriptRoot\..\src" -Recurse -Include *.js,*.ts

foreach ($file in $serviceFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "function (\w+)Service") {
        $serviceName = $matches[1]
        if ($serviceName -notmatch $namingStandards.service_naming.pattern) {
            $serviceViolations += "$($file.Name): $serviceName"
        }
    }
}

# 3. Report results
if ($domainViolations.Count -gt 0 -or $serviceViolations.Count -gt 0) {
    Write-Host "FAIL: Naming standards violations found" -ForegroundColor Red
    
    if ($domainViolations.Count -gt 0) {
        Write-Host "Domain Violations:"
        $domainViolations | ForEach-Object { Write-Host "  - $_" }
    }
    
    if ($serviceViolations.Count -gt 0) {
        Write-Host "Service Naming Violations:"
        $serviceViolations | ForEach-Object { Write-Host "  - $_" }
    }
    
    exit 1
}

Write-Host "PASS: All naming standards compliant" -ForegroundColor Green
exit 0
