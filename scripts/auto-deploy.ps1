<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/auto-deploy.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Automated deployment script for Heady ecosystem with Monte Carlo optimization
#>

# Import environment variables
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        if ($key -and $value) {
            Set-Item -Path "env:\$key" -Value $value
        }
    }
}

# API configuration
$API_BASE = $env:HEADY_ENDPOINT
$API_KEY = $env:HEADY_API_KEY

# Headers for API requests
$headers = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

# 1. Pre-deployment health checks
function Invoke-HealthChecks {
    $healthUri = "$API_BASE/api/health"
    $response = Invoke-RestMethod -Uri $healthUri -Headers $headers -Method Get
    if ($response.status -ne "healthy") {
        Write-Error "Pre-deployment health checks failed. Aborting deployment."
        exit 1
    }
}

# 2. Get deployment strategy from Monte Carlo
function Get-DeploymentStrategy {
    $strategyUri = "$API_BASE/api/monte-carlo/plan"
    $body = @{
        taskType = "deployment"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri $strategyUri -Headers $headers -Method Post -Body $body
    return $response
}

# 3. Execute deployment
function Invoke-Deployment($strategy) {
    $jobs = @()
    foreach ($target in $strategy.targets) {
        $script = {
            param($target, $version)
            switch ($target) {
                "Windows" { .\scripts\build-windows.ps1 -Version $version; .\scripts\deploy-windows.ps1 }
                "Android" { .\scripts\build-android.ps1 -Version $version; .\scripts\deploy-android.ps1 }
                "Linux" { .\scripts\build-linux.ps1 -Version $version; .\scripts\deploy-linux.ps1 }
            }
        }
        $jobs += Start-Job -ScriptBlock $script -ArgumentList $target, $strategy.version
    }
    $jobs | Wait-Job | Receive-Job
}

# 4. Post-deployment steps
function Invoke-PostDeployment {
    # Sync state
    .\scripts\sync-state.ps1 -env production

    # Run benchmarks
    $benchmarkUri = "$API_BASE/api/benchmark"
    Invoke-RestMethod -Uri $benchmarkUri -Headers $headers -Method Post

    # Update deployment registry
    $deployData = @{
        timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        version = $strategy.version
        targets = $strategy.targets
    }
    $deployData | ConvertTo-Json | Out-File "deployments/latest.json"
}

# 5. Update Monte Carlo models
function Update-MonteCarloModels {
    $updateUri = "$API_BASE/api/monte-carlo/result"
    $body = @{
        taskType = "deployment"
        result = "success" # or failure, but we assume success for now
        metrics = @{
            duration = [int](New-TimeSpan -Start $startTime -End (Get-Date)).TotalSeconds
            # ... other metrics
        }
    } | ConvertTo-Json
    Invoke-RestMethod -Uri $updateUri -Headers $headers -Method Post -Body $body
}

# Main deployment process
try {
    $startTime = Get-Date
    Invoke-HealthChecks
    $strategy = Get-DeploymentStrategy
    Invoke-Deployment $strategy
    Invoke-PostDeployment
    Update-MonteCarloModels
} catch {
    Write-Error "Deployment failed: $_"
    exit 1
}
# Comprehensive project scan and auto-improvement system
$projectRoot = Split-Path -Parent $PSScriptRoot
$scanResults = @()
$appliedImprovements = 0

# Define beneficial patterns to inject
$beneficialPatterns = @{
    'ErrorHandling' = @'

# Auto-added: Robust error handling
try {
    $ErrorActionPreference = 'Stop'
    {0}
} catch {
    Write-Error "Operation failed: $_"
    Register-PatternEvent -PatternId 'error_occurred' -Context @{ Script = $PSCommandPath; Error = $_.Exception.Message }
    throw
}
'@
    'CircuitBreaker' = @'

# Auto-added: Circuit breaker for resilience
$breaker = Get-CircuitBreaker -Name '{0}'
if ($breaker.State -eq 'Open') {
    Write-Warning "Circuit breaker open for {0}, skipping operation"
    exit 0
}
Register-PatternEvent -PatternId 'operation_start' -Context @{ Script = '{0}' }
'@
    'Logging' = @'

# Auto-added: Structured logging
$logContext = @{
    Timestamp = Get-Date -Format 'o'
    Script = $PSCommandPath
    User = $env:USERNAME
    Machine = $env:COMPUTERNAME
}
Register-PatternEvent -PatternId 'script_start' -Context $logContext
'@
    'PerformanceMonitoring' = @'

# Auto-added: Performance tracking
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    $stopwatch.Stop()
    Register-PatternEvent -PatternId 'script_completed' -Context @{
        Duration = $stopwatch.ElapsedMilliseconds
        Script = $PSCommandPath
    }
}
'@
    'RetryLogic' = @'

# Auto-added: Retry logic with exponential backoff
function Invoke-WithRetry {
    param([ScriptBlock]$Operation, [int]$MaxAttempts = 3)
    $attempt = 0
    do {
        try {
            $attempt++
            & $Operation
            break
        } catch {
            if ($attempt -ge $MaxAttempts) { throw }
            Start-Sleep -Seconds ([Math]::Pow(2, $attempt))
        }
    } while ($attempt -lt $MaxAttempts)
}
'@
    'ParameterValidation' = @'
[CmdletBinding()]
param()

# Auto-added: Parameter validation
if ($PSBoundParameters.Count -eq 0 -and $args.Count -eq 0) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}
'@
}

Write-Host "🔍 Scanning project for improvements..." -ForegroundColor Cyan

# Scan all PowerShell files
$allScripts = Get-ChildItem -Path $projectRoot -Filter *.ps1 -Recurse -Exclude *test*,*build*,*node_modules*
$totalFiles = $allScripts.Count
$currentFile = 0

$allScripts | ForEach-Object {
    $file = $_
    $currentFile++
    Write-Progress -Activity "Scanning files" -Status "$currentFile of $totalFiles" -PercentComplete (($currentFile / $totalFiles) * 100)
    
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Check for unprotected web requests
    if ($content -match 'Invoke-(RestMethod|WebRequest)' -and $content -notmatch 'try\s*{.*Invoke-(RestMethod|WebRequest).*}\s*catch') {
        $scanResults += @{
            File = $file.Name
            Issue = "Unprotected API calls without error handling"
            Fix = "Wrap in try-catch with circuit breaker"
            Severity = 'High'
            AutoFix = $true
        }
        
        $lines = Get-Content $file.FullName
        $newContent = @()
        $inApiCall = $false
        
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'Invoke-(RestMethod|WebRequest)' -and $lines[$i] -notmatch '^\s*#') {
                if (-not $inApiCall) {
                    $indent = if ($lines[$i] -match '^(\s+)') { $matches[1] } else { '' }
                    $newContent += "${indent}try {"
                    $inApiCall = $true
                }
                $newContent += "    " + $lines[$i]
                
                if ($lines[$i] -notmatch '\\$' -and ($i -eq $lines.Count - 1 -or $lines[$i + 1] -notmatch '^\s+')) {
                    $indent = if ($lines[$i] -match '^(\s+)') { $matches[1] } else { '' }
                    $newContent += "${indent}} catch {"
                    $newContent += "${indent}    Write-Error `"API call failed: `$_`""
                    $newContent += "${indent}    Register-PatternEvent -PatternId 'api_failure' -Context @{ Endpoint = '$($lines[$i])'; Error = `$_.Exception.Message }"
                    $newContent += "${indent}    throw"
                    $newContent += "${indent}}"
                    $inApiCall = $false
                }
            } else {
                $newContent += $lines[$i]
            }
        }
        
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
        $modified = $true
    }
    
    # Refresh content if modified
    if ($modified) { $content = Get-Content $file.FullName -Raw }
    
    # Check for missing circuit breakers in deployment scripts
    if ($file.Name -match 'deploy|rollback|critical' -and $content -notmatch 'Get-CircuitBreaker|Register-PatternEvent.*deployment') {
        $scanResults += @{
            File = $file.Name
            Issue = "Critical operation lacks circuit breaker protection"
            Fix = "Add circuit breaker initialization"
            Severity = 'High'
            AutoFix = $true
        }
        
        $circuitBreakerCode = $beneficialPatterns['CircuitBreaker'] -f $file.BaseName, $file.BaseName, $file.BaseName
        $newContent = $circuitBreakerCode + "`n`n" + $content
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
        $modified = $true
    }
    
    if ($modified) { $content = Get-Content $file.FullName -Raw }
    
    # Check for missing performance monitoring
    if ($content -match 'ForEach-Object|Where-Object.*{' -and $content -notmatch '\[System\.Diagnostics\.Stopwatch\]|Measure-Command') {
        $scanResults += @{
            File = $file.Name
            Issue = "No performance monitoring for potentially slow operations"
            Fix = "Add stopwatch and metrics"
            Severity = 'Medium'
            AutoFix = $true
        }
        
        $perfCode = $beneficialPatterns['PerformanceMonitoring']
        $newContent = $perfCode + "`n`n" + $content
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
        $modified = $true
    }
    
    if ($modified) { $content = Get-Content $file.FullName -Raw }
    
    # Check for hardcoded credentials
    if ($content -match '(?i)(password|apikey|secret|token|credential)\s*=\s*["\'][^"\']+["\']') {
        $scanResults += @{
            File = $file.Name
            Issue = "Potential hardcoded credentials detected"
            Fix = "Move to environment variables or secure vault"
            Severity = 'Critical'
            AutoFix = $false
        }
    }
    
    # Check for missing logging in critical paths
    if ($file.Name -match 'deploy|start|stop|restart' -and $content -notmatch 'Write-(Verbose|Information|Host).*started|Register-PatternEvent') {
        $scanResults += @{
            File = $file.Name
            Issue = "Critical script lacks structured logging"
            Fix = "Add logging initialization"
            Severity = 'Medium'
            AutoFix = $true
        }
        
        $loggingCode = $beneficialPatterns['Logging']
        $newContent = $loggingCode + "`n`n" + $content
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
        $modified = $true
    }
    
    if ($modified) { $content = Get-Content $file.FullName -Raw }
    
    # Check for missing timeout configurations
    if ($content -match 'Invoke-(RestMethod|WebRequest)' -and $content -notmatch '-TimeoutSec') {
        $scanResults += @{
            File = $file.Name
            Issue = "API calls without timeout configuration"
            Fix = "Add -TimeoutSec parameter"
            Severity = 'Medium'
            AutoFix = $true
        }
        
        $lines = Get-Content $file.FullName
        $newContent = $lines | ForEach-Object {
            if ($_ -match '(Invoke-(?:RestMethod|WebRequest).*)(?=\s*$)' -and $_ -notmatch '-TimeoutSec') {
                $_ -replace '(Invoke-(?:RestMethod|WebRequest)[^\r\n]*)', '$1 -TimeoutSec 30'
            } else {
                $_
            }
        }
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
        $modified = $true
    }
    
    if ($modified) { $content = Get-Content $file.FullName -Raw }
    
    # Check for missing retry logic
    if ($content -match 'Invoke-(RestMethod|WebRequest)' -and $content -notmatch 'Invoke-WithRetry|for\s*\(\$i.*retry|while.*attempt') {
        $scanResults += @{
            File = $file.Name
            Issue = "Network operations lack retry logic"
            Fix = "Add retry wrapper function"
            Severity = 'Medium'
            AutoFix = $true
        }
        
        $retryCode = $beneficialPatterns['RetryLogic']
        $newContent = $retryCode + "`n`n" + $content
        Set-Content -Path $file.FullName -Value $newContent
        $appliedImprovements++
    }
}

# Scan for missing parameter validation
Get-ChildItem -Path "$projectRoot\scripts" -Filter *.ps1 | Where-Object {
    $content = Get-Content $_.FullName -Raw
    $content -match 'param\s*\(' -and $content -notmatch '\[ValidateNotNullOrEmpty\]|\[ValidateSet|\[CmdletBinding'
} | ForEach-Object {
    $scanResults += @{
        File = $_.Name
        Issue = "Parameters lack validation attributes"
        Fix = "Add [ValidateNotNullOrEmpty()] or [ValidateSet()]"
        Severity = 'Low'
        AutoFix = $false
    }
}

# Check for missing .gitignore entries
$gitignorePath = Join-Path $projectRoot '.gitignore'
$requiredPatterns = @('*.log', '*.tmp', '.heady_cache/', 'logs/', 'node_modules/', '*.swp', '*~', '.DS_Store', 'Thumbs.db', '*.bak', 'bin/', 'obj/')
if (Test-Path $gitignorePath) {
    $existingIgnores = Get-Content $gitignorePath
    $missingPatterns = $requiredPatterns | Where-Object { $existingIgnores -notcontains $_ }
    if ($missingPatterns) {
        $scanResults += @{
            File = '.gitignore'
            Issue = "Missing common ignore patterns: $($missingPatterns -join ', ')"
            Fix = "Add missing patterns to .gitignore"
            Severity = 'Low'
            AutoFix = $true
        }
        Add-Content -Path $gitignorePath -Value "`n# Auto-added patterns`n$($missingPatterns -join "`n")"
        $appliedImprovements++
    }
} else {
    $scanResults += @{
        File = '.gitignore'
        Issue = "No .gitignore file found"
        Fix = "Create .gitignore with common patterns"
        Severity = 'Medium'
        AutoFix = $true
    }
    Set-Content -Path $gitignorePath -Value "# Auto-generated .gitignore`n$($requiredPatterns -join "`n")"
    $appliedImprovements++
}

# Check for missing module manifests
Get-ChildItem -Path "$projectRoot\src" -Filter *.psm1 -ErrorAction SilentlyContinue | Where-Object {
    $manifestPath = $_.FullName -replace '\.psm1$', '.psd1'
    -not (Test-Path $manifestPath)
} | ForEach-Object {
    $moduleName = $_.BaseName
    $manifestPath = $_.FullName -replace '\.psm1$', '.psd1'
    $scanResults += @{
        File = "$moduleName.psm1"
        Issue = "Module lacks manifest file"
        Fix = "Create module manifest"
        Severity = 'Medium'
        AutoFix = $true
    }
    New-ModuleManifest -Path $manifestPath -RootModule "$moduleName.psm1" -ModuleVersion '1.0.0' -Author 'Heady' -Description "Auto-generated manifest for $moduleName"
    $appliedImprovements++
}

# Check for missing README files
$readmePath = Join-Path $projectRoot 'README.md'
if (-not (Test-Path $readmePath)) {
    $scanResults += @{
        File = 'README.md'
        Issue = "Project lacks README documentation"
        Fix = "Create basic README"
        Severity = 'Medium'
        AutoFix = $true
    }
    $readmeContent = @"
# Heady Project

Auto-generated README - please update with project details.

## Overview
This project includes automated deployment and monitoring capabilities.

## Getting Started
Run ``scripts/auto-deploy.ps1`` to begin deployment.

## Features
- Circuit breaker protection
- Performance monitoring
- Structured logging
- Auto-improvement scanning
"@
    Set-Content -Path $readmePath -Value $readmeContent
    $appliedImprovements++
}

Write-Progress -Activity "Scanning files" -Completed

# Report findings
if ($scanResults.Count -gt 0) {
    Write-Host "`n🔍 Project Scan Results: Found $($scanResults.Count) improvement opportunities" -ForegroundColor Yellow
    
    $scanResults | Group-Object Severity | Sort-Object { 
        switch ($_.Name) { 
            'Critical' { 0 } 
            'High' { 1 } 
            'Medium' { 2 } 
            'Low' { 3 } 
        } 
    } | ForEach-Object {
        $color = switch ($_.Name) {
            'Critical' { 'Red' }
            'High' { 'Red' }
            'Medium' { 'Yellow' }
            'Low' { 'Cyan' }
        }
        Write-Host "`n  [$($_.Name)] - $($_.Group.Count) issues:" -ForegroundColor $color
        $_.Group | ForEach-Object
