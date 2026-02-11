<#
.SYNOPSIS
Heady Smart Deployment System - Automates DNS, SSL and cloud deployment with fallbacks

.DESCRIPTION
Handles the full deployment lifecycle with intelligent condition checking and automatic fallbacks to manual steps when needed.
#>

param(
    [switch]$Force,
    [switch]$SkipDNS,
    [switch]$SkipSSL,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Import dependencies
. $PSScriptRoot\dns-verify.ps1
. $PSScriptRoot\ssl-verify.ps1
. $PSScriptRoot\deploy-core.ps1

# Phase 1: Infrastructure Check
Write-Host "[HeadyDeploy] Checking infrastructure..." -ForegroundColor Cyan
$hasDNS = Test-DNSPropagation "headysystems.com"
$hasSSL = Test-SSLCertificate "headysystems.com"

# Phase 2: Conditional Deployment
if ((-not $hasDNS) -and (-not $SkipDNS)) {
    Write-Host "[HeadyDeploy] Configuring DNS..." -ForegroundColor Yellow
    try {
        Initialize-DNSConfiguration -DryRun:$DryRun
    } catch {
        Write-Host "[HeadyDeploy] DNS auto-config failed" -ForegroundColor Red
        Write-Host "Manual DNS setup required - see docs/deploy/DNS-SETUP.md"
        if (-not $Force) { exit 1 }
    }
}

if ((-not $hasSSL) -and (-not $SkipSSL)) {
    Write-Host "[HeadyDeploy] Configuring SSL..." -ForegroundColor Yellow
    try {
        Initialize-SSLCertificate -DryRun:$DryRun
    } catch {
        Write-Host "[HeadyDeploy] SSL auto-config failed" -ForegroundColor Red
        Write-Host "Manual SSL setup required - see docs/deploy/SSL-SETUP.md"
        if (-not $Force) { exit 1 }
    }
}

# Phase 3: Core Deployment
if (($hasDNS -and $hasSSL) -or $Force) {
    Write-Host "[HeadyDeploy] Deploying services..." -ForegroundColor Green
    try {
        Deploy-ToCloud -DryRun:$DryRun
    } catch {
        Write-Host "[HeadyDeploy] Deployment failed" -ForegroundColor Red
        exit 1
    }
}

# Phase 4: Verification
Write-Host "[HeadyDeploy] Verifying deployment..." -ForegroundColor Cyan
Test-CloudDeployment

Write-Host "[HeadyDeploy] Smart deployment complete" -ForegroundColor Green

# Deployment functions
function Invoke-GlobalDeployment {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet('Full','Partial','Test')]
        [string]$Mode,
        
        [Parameter(Mandatory=$true)]
        [ValidateRange(1,10)]
        [int]$Concurrency
    )
    
    # Deployment logic placeholder
    Write-Host "Starting $Mode deployment with concurrency $Concurrency"
    
    # Return deployment object
    return [PSCustomObject]@{
        Id = [guid]::NewGuid()
        StartTime = Get-Date
        Status = 'Running'
    }
}

function Get-GlobalDeploymentStatus {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Id
    )
    
    # Status retrieval logic placeholder
    return [PSCustomObject]@{
        Id = $Id
        Status = 'InProgress'
        Progress = 50
        EstimatedCompletion = (Get-Date).AddMinutes(10)
    }
}

# Comprehensive project scan and beneficial pattern injection
$projectRoot = Split-Path -Parent $PSScriptRoot
$scanResults = @()
$appliedImprovements = 0

Write-Host "`n🔍 Scanning Heady project for beneficial patterns..." -ForegroundColor Cyan

# Define beneficial patterns to inject
$beneficialPatterns = @{
    'ErrorHandling' = @'
try {
    $ErrorActionPreference = 'Stop'
    {0}
} catch {
    Write-Error "Operation failed: $_"
    throw
}
'@
    'Logging' = @'
function Write-DeployLog {
    param([string]$Message, [string]$Level = 'Info')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logEntry = "[$timestamp] [$Level] $Message"
    $logPath = "$PSScriptRoot\..\logs\deploy.log"
    if (-not (Test-Path (Split-Path $logPath))) { New-Item -ItemType Directory -Path (Split-Path $logPath) -Force | Out-Null }
    Add-Content -Path $logPath -Value $logEntry
    Write-Host $logEntry -ForegroundColor $(if($Level -eq 'Error'){'Red'}elseif($Level -eq 'Warning'){'Yellow'}else{'Gray'})
}
'@
    'RetryLogic' = @'
function Invoke-WithRetry {
    param([ScriptBlock]$Operation, [int]$MaxAttempts = 3, [int]$InitialDelaySeconds = 1)
    $attempt = 0
    do {
        try {
            $attempt++
            & $Operation
            break
        } catch {
            if ($attempt -ge $MaxAttempts) { throw }
            $delay = $InitialDelaySeconds * [Math]::Pow(2, $attempt - 1)
            Write-Warning "Attempt $attempt failed, retrying in $delay seconds..."
            Start-Sleep -Seconds $delay
        }
    } while ($attempt -lt $MaxAttempts)
}
'@
    'HealthCheck' = @'
function Test-ServiceHealth {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec -ErrorAction Stop
        return $response.status -eq 'healthy' -or $response.ok -eq $true
    } catch {
        Write-Warning "Health check failed for $Url : $_"
        return $false
    }
}
'@
    'ParameterValidation' = @'
[CmdletBinding()]
param()

if ($PSBoundParameters.Count -eq 0 -and $args.Count -eq 0) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}
'@
    'CircuitBreaker' = @'
$script:circuitBreakerState = @{}
function Invoke-WithCircuitBreaker {
    param([string]$Name, [ScriptBlock]$Operation, [int]$FailureThreshold = 5, [int]$TimeoutSeconds = 60)
    
    if (-not $script:circuitBreakerState.ContainsKey($Name)) {
        $script:circuitBreakerState[$Name] = @{ Failures = 0; LastFailure = $null; State = 'Closed' }
    }
    
    $breaker = $script:circuitBreakerState[$Name]
    
    if ($breaker.State -eq 'Open') {
        if ((Get-Date) -gt $breaker.LastFailure.AddSeconds($TimeoutSeconds)) {
            $breaker.State = 'HalfOpen'
        } else {
            throw "Circuit breaker '$Name' is open"
        }
    }
    
    try {
        & $Operation
        $breaker.Failures = 0
        $breaker.State = 'Closed'
    } catch {
        $breaker.Failures++
        $breaker.LastFailure = Get-Date
        if ($breaker.Failures -ge $FailureThreshold) {
            $breaker.State = 'Open'
        }
        throw
    }
}
'@
    'PerformanceMonitoring' = @'
$script:performanceMetrics = @{}
function Measure-OperationPerformance {
    param([string]$Name, [ScriptBlock]$Operation)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Operation
    } finally {
        $stopwatch.Stop()
        if (-not $script:performanceMetrics.ContainsKey($Name)) {
            $script:performanceMetrics[$Name] = @()
        }
        $script:performanceMetrics[$Name] += $stopwatch.ElapsedMilliseconds
        Write-Verbose "$Name completed in $($stopwatch.ElapsedMilliseconds)ms"
    }
}
'@
    'RateLimiting' = @'
$script:rateLimitState = @{}
function Invoke-RateLimited {
    param([string]$Key, [int]$MinIntervalMs = 100, [ScriptBlock]$Operation)
    
    if ($script:rateLimitState.ContainsKey($Key)) {
        $elapsed = ((Get-Date) - $script:rateLimitState[$Key]).TotalMilliseconds
        if ($elapsed -lt $MinIntervalMs) {
            Start-Sleep -Milliseconds ($MinIntervalMs - $elapsed)
        }
    }
    
    $script:rateLimitState[$Key] = Get-Date
    & $Operation
}
'@
    'CacheManagement' = @'
$script:cache = @{}
function Get-CachedValue {
    param([string]$Key, [ScriptBlock]$ValueFactory, [int]$ExpirationMinutes = 10)
    
    if ($script:cache.ContainsKey($Key)) {
        $cached = $script:cache[$Key]
        if ((Get-Date) -lt $cached.Expiration) {
            return $cached.Value
        }
    }
    
    $value = & $ValueFactory
    $script:cache[$Key] = @{
        Value = $value
        Expiration = (Get-Date).AddMinutes($ExpirationMinutes)
    }
    return $value
}
'@
    'InputSanitization' = @'
function Test-SafeInput {
    param([string]$Input, [switch]$AllowSpecialChars)
    
    if ([string]::IsNullOrWhiteSpace($Input)) {
        throw "Input cannot be empty"
    }
    
    if (-not $AllowSpecialChars -and $Input -match '[;&|<>$`]') {
        throw "Input contains potentially dangerous characters"
    }
    
    return $true
}
'@
    'AsyncOperations' = @'
function Invoke-ParallelOperation {
    param([array]$Items, [ScriptBlock]$Operation, [int]$ThrottleLimit = 5)
    
    $Items | ForEach-Object -ThrottleLimit $ThrottleLimit -Parallel {
        & $using:Operation -Item $_
    }
}
'@
    'ConfigManagement' = @'
function Get-ConfigValue {
    param([string]$Key, [string]$DefaultValue = $null, [string]$ConfigPath = "$PSScriptRoot\..\config.json")
    
    if (Test-Path $ConfigPath) {
        $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        if ($config.PSObject.Properties.Name -contains $Key) {
            return $config.$Key
        }
    }
    return $DefaultValue
}
'@
    'SecretManagement' = @'
function Get-SecureValue {
    param([string]$Key, [string]$VaultName = 'HeadyVault')
    
    try {
        if (Get-Command Get-Secret -ErrorAction SilentlyContinue) {
            return Get-Secret -Name $Key -Vault $VaultName -AsPlainText -ErrorAction Stop
        }
    } catch {
        Write-Warning "Secret retrieval failed for $Key, checking environment variables"
    }
    
    return [Environment]::GetEnvironmentVariable($Key)
}
'@
    'DependencyCheck' = @'
function Test-RequiredModule {
    param([string[]]$Modules)
    
    $missing = @()
    foreach ($module in $Modules) {
        if (-not (Get-Module -ListAvailable -Name $module)) {
            $missing += $module
        }
    }
    
    if ($missing.Count -gt 0) {
        throw "Missing required modules: $($missing -join ', '). Install with: Install-Module $($missing -join ',')"
    }
}
'@
    'BackupRestore' = @'
function Backup-Configuration {
    param([string]$SourcePath, [string]$BackupPath = "$PSScriptRoot\..\backups")
    
    if (-not (Test-Path $BackupPath)) { New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null }
    
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupFile = Join-Path $BackupPath "backup_$timestamp.zip"
    
    Compress-Archive -Path $SourcePath -DestinationPath $backupFile -Force
    return $backupFile
}
'@
    'ResourceCleanup' = @'
function Clear-TempResources {
    param([string]$Path = "$env:TEMP\heady_*", [int]$OlderThanHours = 24)
    
    Get-ChildItem -Path (Split-Path $Path) -Filter (Split-Path $Path -Leaf) -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-$OlderThanHours) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
'@
}

# Scan all PowerShell files
$filesToScan = Get-ChildItem -Path $projectRoot -Recurse -Include *.ps1,*.psm1 -Exclude *node_modules*,*.git*,*\.heady_cache*,*test*
$totalFiles = $filesToScan.Count

Write-Host "📁 Found $totalFiles files to analyze..." -ForegroundColor Cyan

$progressCount = 0
$filesToScan | ForEach-Object {
    $file = $_
    $progressCount++
    Write-Progress -Activity "Scanning files" -Status "$progressCount of $totalFiles" -PercentComplete (($progressCount / $totalFiles) * 100)
    
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    $newContent = $content
    $fileImprovements = @()
    
    # Check for missing error handling
    if ($content -notmatch 'try\s*{' -and $content -match 'Invoke-RestMethod|Invoke-WebRequest|New-Item|Remove-Item|Set-Content|Copy-Item') {
        $scanResults += @{ File = $file.Name; Issue = "Missing error handling"; Severity = 'High' }
    }
    
    # Check for missing retry logic on network operations
    if ($content -match 'Invoke-RestMethod|Invoke-WebRequest' -and $content -notmatch 'Invoke-WithRetry') {
        $scanResults += @{ File = $file.Name; Issue = "Network operations lack retry logic"; Severity = 'Medium' }
        if (-not $DryRun -and $content -notmatch 'function Invoke-WithRetry') {
            $newContent = $beneficialPatterns['RetryLogic'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'RetryLogic'
        }
    }
    
    # Check for missing health checks in deployment scripts
    if ($file.Name -match 'deploy|start|init' -and $content -notmatch 'Test-ServiceHealth') {
        $scanResults += @{ File = $file.Name; Issue = "Missing health verification"; Severity = 'High' }
        if (-not $DryRun -and $content -notmatch 'function Test-ServiceHealth') {
            $newContent = $beneficialPatterns['HealthCheck'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'HealthCheck'
        }
    }
    
    # Check for missing structured logging
    if ($file.Name -match 'deploy|start|stop|restart|build' -and $content -notmatch 'Write-DeployLog') {
        $scanResults += @{ File = $file.Name; Issue = "Missing structured logging"; Severity = 'Medium' }
        if (-not $DryRun -and $content -notmatch 'function Write-DeployLog') {
            $newContent = $beneficialPatterns['Logging'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'Logging'
        }
    }
    
    # Check for missing parameter validation
    if ($content -match 'param\s*\(' -and $content -notmatch '\[CmdletBinding\(\)\]') {
        $scanResults += @{ File = $file.Name; Issue = "Parameters lack validation"; Severity = 'Low' }
    }
    
    # Check for performance-critical operations without monitoring
    if ($file.Name -match 'deploy|build|test|benchmark' -and $content -notmatch 'Measure-OperationPerformance|Measure-Command') {
        $scanResults += @{ File = $file.Name; Issue = "Missing performance monitoring"; Severity = 'Low' }
        if (-not $DryRun -and $content -notmatch 'function Measure-OperationPerformance') {
            $newContent = $beneficialPatterns['PerformanceMonitoring'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'PerformanceMonitoring'
        }
    }
    
    # Check for missing circuit breaker on external service calls
    if ($content -match 'Invoke-RestMethod.*api\.|Invoke-WebRequest.*api\.' -and $content -notmatch 'Invoke-WithCircuitBreaker') {
        $scanResults += @{ File = $file.Name; Issue = "API calls lack circuit breaker"; Severity = 'Medium' }
        if (-not $DryRun -and $content -notmatch 'function Invoke-WithCircuitBreaker') {
            $newContent = $beneficialPatterns['CircuitBreaker'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'CircuitBreaker'
        }
    }
    
    # Check for missing rate limiting on bulk API calls
    if ($content -match 'Invoke-RestMethod|Invoke-WebRequest' -and $content -match 'foreach|ForEach-Object' -and $content -notmatch 'Invoke-RateLimited|Start-Sleep') {
        $scanResults += @{ File = $file.Name; Issue = "Bulk API calls lack rate limiting"; Severity = 'Medium' }
        if (-not $DryRun -and $content -notmatch 'function Invoke-RateLimited') {
            $newContent = $beneficialPatterns['RateLimiting'] + "`n`n" + $newContent
            $modified = $true
            $fileImprovements += 'RateLimiting'
        }
    }
    
    # Check for missing input sanitization
    if ($content -match 'param.*\[string\]' -and $content -match 'Invoke-Expression|iex|&\s*
