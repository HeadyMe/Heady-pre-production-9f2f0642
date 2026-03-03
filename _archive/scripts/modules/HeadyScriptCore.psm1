# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/modules/HeadyScriptCore.psm1                     ║
# ║  LAYER: core-framework                                         ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

<#
.SYNOPSIS
Heady Script Core Framework - Robust foundation for all Heady automation scripts

.DESCRIPTION
Provides advanced error handling, logging, configuration management, monitoring,
and performance optimization capabilities for Heady scripts ecosystem.

.NOTES
Version: 2.0.0
Author: Heady Systems
Last Updated: 2025-02-11
#>

# Global Configuration - Cloud Only (NO LOCAL STORAGE)
$Global:HeadyScriptConfig = @{
    LogLevel = 'Info'
    LogPath = "https://headysystems.com/api/logs"
    ConfigPath = "https://headysystems.com/api/config"
    CachePath = "https://headysystems.com/api/cache"
    MonitoringEnabled = $true
    PerformanceTracking = $true
    ErrorRecovery = $true
    MaxRetries = 3
    RetryDelay = 1000
    ParallelExecution = $true
    CloudOnly = $true
    LocalStorageForbidden = $true
}

# Initialize directories
function Initialize-HeadyEnvironment {
    param(
        [switch]$Force
    )
    
    $paths = @(
        $Global:HeadyScriptConfig.LogPath,
        $Global:HeadyScriptConfig.ConfigPath,
        $Global:HeadyScriptConfig.CachePath
    )
    
    foreach ($path in $paths) {
        if (-not (Test-Path $path) -or $Force) {
            New-Item -Path $path -ItemType Directory -Force | Out-Null
            Write-HeadyLog "Initialized directory: $path" -Level Debug
        }
    }
}

# Advanced Logging System
function Write-HeadyLog {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        
        [ValidateSet('Debug', 'Verbose', 'Info', 'Warning', 'Error', 'Critical')]
        [string]$Level = 'Info',
        
        [string]$Category = 'General',
        
        [hashtable]$Metadata = @{},
        
        [switch]$NoConsole
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    $logEntry = @{
        Timestamp = $timestamp
        Level = $Level
        Category = $Category
        Message = $Message
        Metadata = $Metadata
        ScriptName = $MyInvocation.PSCommandPath
        LineNumber = $MyInvocation.ScriptLineNumber
    }
    
    # Console output with colors
    if (-not $NoConsole) {
        $color = switch ($Level) {
            'Debug' { 'Gray' }
            'Verbose' { 'Cyan' }
            'Info' { 'Green' }
            'Warning' { 'Yellow' }
            'Error' { 'Red' }
            'Critical' { 'Magenta' }
            default { 'White' }
        }
        
        Write-Host "[$timestamp] [$Level] [$Category] $Message" -ForegroundColor $color
    }
    
    # File logging with structured JSON
    $logFile = Join-Path $Global:HeadyScriptConfig.LogPath "heady-$(Get-Date -Format 'yyyy-MM-dd').log"
    $jsonEntry = $logEntry | ConvertTo-Json -Compress
    Add-Content -Path $logFile -Value $jsonEntry
    
    # Performance metrics
    if ($Global:HeadyScriptConfig.PerformanceTracking) {
        Update-HeadyMetrics -Action 'Log' -Category $Category -Metadata @{
            Level = $Level
            MessageLength = $Message.Length
        }
    }
}

# Error Handling with Recovery
function Invoke-HeadyOperation {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,
        
        [string]$OperationName = 'Unknown Operation',
        
        [int]$MaxRetries = $Global:HeadyScriptConfig.MaxRetries,
        
        [int]$RetryDelay = $Global:HeadyScriptConfig.RetryDelay,
        
        [scriptblock]$RecoveryAction,
        
        [switch]$ContinueOnError
    )
    
    $attempt = 0
    $success = $false
    $result = $null
    $errorRecord = $null
    
    while ($attempt -lt $MaxRetries -and -not $success) {
        $attempt++
        
        try {
            Write-HeadyLog "Attempting $OperationName (attempt $attempt/$MaxRetries)" -Level Debug -Category 'Operation'
            
            $result = & $ScriptBlock
            $success = $true
            
            Write-HeadyLog "Operation $OperationName completed successfully" -Level Info -Category 'Operation'
        }
        catch {
            $errorRecord = $_
            Write-HeadyLog "Operation $OperationName failed (attempt $attempt/$MaxRetries): $($_.Exception.Message)" -Level Error -Category 'Operation' -Metadata @{
                Attempt = $attempt
                ExceptionType = $_.Exception.GetType().Name
                StackTrace = $_.ScriptStackTrace
            }
            
            if ($attempt -lt $MaxRetries) {
                Write-HeadyLog "Retrying in $RetryDelay ms..." -Level Warning -Category 'Operation'
                Start-Sleep -Milliseconds $RetryDelay
                
                # Attempt recovery if specified
                if ($RecoveryAction) {
                    try {
                        Write-HeadyLog "Attempting recovery action for $OperationName" -Level Debug -Category 'Recovery'
                        & $RecoveryAction
                    }
                    catch {
                        Write-HeadyLog "Recovery action failed: $($_.Exception.Message)" -Level Warning -Category 'Recovery'
                    }
                }
                
                # Exponential backoff
                $RetryDelay = [Math]::Min($RetryDelay * 2, 30000)
            }
        }
    }
    
    if (-not $success) {
        Write-HeadyLog "Operation $OperationName failed after $MaxRetries attempts" -Level Critical -Category 'Operation' -Metadata @{
            FinalError = $errorRecord.Exception.Message
            TotalAttempts = $attempt
        }
        
        if (-not $ContinueOnError) {
            throw $errorRecord
        }
    }
    
    return $result
}

# Configuration Management
function Get-HeadyConfig {
    param(
        [Parameter(Mandatory)]
        [string]$ConfigName,
        
        [hashtable]$DefaultValues = @{},
        
        [switch]$CreateIfMissing
    )
    
    $configFile = Join-Path $Global:HeadyScriptConfig.ConfigPath "$ConfigName.json"
    
    if (Test-Path $configFile) {
        try {
            $config = Get-Content -Path $configFile -Raw | ConvertFrom-Json
            Write-HeadyLog "Loaded configuration: $ConfigName" -Level Debug -Category 'Config'
            return $config
        }
        catch {
            Write-HeadyLog "Failed to load configuration $ConfigName`: $($_.Exception.Message)" -Level Error -Category 'Config'
        }
    }
    
    if ($CreateIfMissing) {
        Write-HeadyLog "Creating default configuration: $ConfigName" -Level Info -Category 'Config'
        $config = $DefaultValues
        try {
            $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile
        }
        catch {
            Write-HeadyLog "Failed to create configuration $ConfigName`: $($_.Exception.Message)" -Level Error -Category 'Config'
        }
        return $config
    }
    
    return $DefaultValues
}

function Set-HeadyConfig {
    param(
        [Parameter(Mandatory)]
        [string]$ConfigName,
        
        [Parameter(Mandatory)]
        [hashtable]$Values,
        
        [switch]$Merge
    )
    
    $configFile = Join-Path $Global:HeadyScriptConfig.ConfigPath "$ConfigName.json"
    
    $existingConfig = @{}
    if ($Merge -and (Test-Path $configFile)) {
        try {
            $existingConfig = Get-Content -Path $configFile -Raw | ConvertFrom-Json
        }
        catch {
            Write-HeadyLog "Failed to load existing config for merge: $($_.Exception.Message)" -Level Warning -Category 'Config'
        }
    }
    
    # Merge configurations
    $mergedConfig = $existingConfig
    foreach ($key in $Values.Keys) {
        $mergedConfig[$key] = $Values[$key]
    }
    
    try {
        $mergedConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile
        Write-HeadyLog "Updated configuration: $ConfigName" -Level Info -Category 'Config'
    }
    catch {
        Write-HeadyLog "Failed to save configuration $ConfigName`: $($_.Exception.Message)" -Level Error -Category 'Config'
        throw
    }
}

# Performance Monitoring
function Update-HeadyMetrics {
    param(
        [Parameter(Mandatory)]
        [string]$Action,
        
        [string]$Category = 'General',
        
        [hashtable]$Metadata = @{}
    )
    
    if (-not $Global:HeadyScriptConfig.MonitoringEnabled) { return }
    
    $metricsFile = Join-Path $Global:HeadyScriptConfig.CachePath 'heady-metrics.json'
    $timestamp = (Get-Date).ToString('o')
    
    $metrics = @{}
    if (Test-Path $metricsFile) {
        try {
            $metrics = Get-Content -Path $metricsFile -Raw | ConvertFrom-Json
        }
        catch {
            Write-HeadyLog "Failed to load metrics file: $($_.Exception.Message)" -Level Warning -Category 'Metrics'
        }
    }
    
    # Update metrics
    $key = "$Category-$Action"
    if (-not $metrics.ContainsKey($key)) {
        $metrics[$key] = @{
            Count = 0
            FirstSeen = $timestamp
            LastSeen = $timestamp
            Metadata = @{}
        }
    }
    
    $metrics[$key].Count++
    $metrics[$key].LastSeen = $timestamp
    $metrics[$key].Metadata = $Metrics[$key].Metadata + $Metadata
    
    try {
        $metrics | ConvertTo-Json -Depth 10 | Set-Content -Path $metricsFile
    }
    catch {
        Write-HeadyLog "Failed to update metrics: $($_.Exception.Message)" -Level Warning -Category 'Metrics'
    }
}

function Get-HeadyMetrics {
    param(
        [string]$Category,
        [string]$Action,
        [datetime]$Since
    )
    
    $metricsFile = Join-Path $Global:HeadyScriptConfig.CachePath 'heady-metrics.json'
    
    if (-not (Test-Path $metricsFile)) { return @{} }
    
    try {
        $metrics = Get-Content -Path $metricsFile -Raw | ConvertFrom-Json
        
        $filteredMetrics = @{}
        foreach ($key in $metrics.Keys) {
            $keyParts = $key -split '-'
            $keyCategory = $keyParts[0]
            $keyAction = $keyParts[1]
            
            $includeKey = $true
            if ($Category -and $keyCategory -ne $Category) { $includeKey = $false }
            if ($Action -and $keyAction -ne $Action) { $includeKey = $false }
            if ($Since -and [datetime]$metrics[$key].LastSeen -lt $Since) { $includeKey = $false }
            
            if ($includeKey) {
                $filteredMetrics[$key] = $metrics[$key]
            }
        }
        
        return $filteredMetrics
    }
    catch {
        Write-HeadyLog "Failed to retrieve metrics: $($_.Exception.Message)" -Level Error -Category 'Metrics'
        return @{}
    }
}

# Parallel Execution Manager
function Invoke-HeadyParallel {
    param(
        [Parameter(Mandatory)]
        [scriptblock[]]$ScriptBlocks,
        
        [int]$MaxConcurrency = 4,
        
        [string]$OperationName = 'Parallel Operation',
        
        [switch]$ContinueOnError
    )
    
    if (-not $Global:HeadyScriptConfig.ParallelExecution) {
        Write-HeadyLog "Parallel execution disabled, running sequentially" -Level Warning -Category 'Performance'
        $results = @()
        foreach ($block in $ScriptBlocks) {
            try {
                $results += (& $block)
            }
            catch {
                if (-not $ContinueOnError) { throw }
                $results += $null
            }
        }
        return $results
    }
    
    Write-HeadyLog "Starting parallel execution: $OperationName ($($ScriptBlocks.Count) tasks, max concurrency: $MaxConcurrency)" -Level Info -Category 'Performance'
    
    $jobs = @()
    $results = @()
    $completed = 0
    $failed = 0
    
    # Start jobs with throttling
    for ($i = 0; $i -lt $ScriptBlocks.Count; $i++) {
        # Wait for available slot
        while ((Get-Job -State Running).Count -ge $MaxConcurrency) {
            Start-Sleep -Milliseconds 100
            # Check completed jobs
            $completedJobs = Get-Job -State Completed
            foreach ($job in $completedJobs) {
                $result = Receive-Job -Job $job
                $results += $result
                $completed++
                Remove-Job -Job $job
                Write-HeadyLog "Parallel task completed ($completed/$($ScriptBlocks.Count))" -Level Debug -Category 'Performance'
            }
            
            $failedJobs = Get-Job -State Failed
            foreach ($job in $failedJobs) {
                $error = Receive-Job -Job $job -ErrorAction SilentlyContinue
                Write-HeadyLog "Parallel task failed: $error" -Level Error -Category 'Performance'
                $failed++
                Remove-Job -Job $job
                
                if (-not $ContinueOnError) {
                    # Clean up remaining jobs
                    Get-Job | Remove-Job -Force
                    throw "Parallel execution failed: $error"
                }
            }
        }
        
        # Start new job
        $job = Start-Job -ScriptBlock $ScriptBlocks[$i] -Name "Task-$i"
        $jobs += $job
        Write-HeadyLog "Started parallel task: Task-$i" -Level Debug -Category 'Performance'
    }
    
    # Wait for remaining jobs
    $remainingJobs = Get-Job
    foreach ($job in $remainingJobs) {
        $result = Receive-Job -Job $job -Wait
        $results += $result
        $completed++
        Remove-Job -Job $job
    }
    
    Write-HeadyLog "Parallel execution completed: $completed successful, $failed failed" -Level Info -Category 'Performance'
    
    Update-HeadyMetrics -Action 'ParallelExecution' -Category 'Performance' -Metadata @{
        TaskCount = $ScriptBlocks.Count
        MaxConcurrency = $MaxConcurrency
        Completed = $completed
        Failed = $failed
    }
    
    return $results
}

# System Health Checks
function Test-HeadySystemHealth {
    param(
        [string[]]$Checks = @('memory', 'disk', 'network', 'services'),
        
        [hashtable]$Thresholds = @{
            MemoryUsagePercent = 80
            DiskFreePercent = 10
            NetworkLatencyMs = 1000
        }
    )
    
    Write-HeadyLog "Starting system health checks" -Level Info -Category 'Health'
    
    $healthResults = @{
        OverallStatus = 'Healthy'
        Checks = @{}
        Timestamp = (Get-Date).ToString('o')
    }
    
    foreach ($check in $Checks) {
        switch ($check) {
            'memory' {
                $memory = Get-CimInstance -ClassName Win32_OperatingSystem
                $usagePercent = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)
                
                $status = if ($usagePercent -lt $Thresholds.MemoryUsagePercent) { 'Healthy' } else { 'Warning' }
                if ($usagePercent -gt 95) { $status = 'Critical' }
                
                $healthResults.Checks.memory = @{
                    Status = $status
                    UsagePercent = $usagePercent
                    TotalGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
                    FreeGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
                }
            }
            
            'disk' {
                $systemDrive = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceId='C:'"
                $freePercent = [math]::Round(($systemDrive.FreeSpace / $systemDrive.Size) * 100, 2)
                
                $status = if ($freePercent -gt $Thresholds.DiskFreePercent) { 'Healthy' } else { 'Warning' }
                if ($freePercent -lt 5) { $status = 'Critical' }
                
                $healthResults.Checks.disk = @{
                    Status = $status
                    FreePercent = $freePercent
                    TotalGB = [math]::Round($systemDrive.Size / 1GB, 2)
                    FreeGB = [math]::Round($systemDrive.FreeSpace / 1GB, 2)
                }
            }
            
            'network' {
                try {
                    $testResult = Test-NetConnection -ComputerName '8.8.8.8' -Port 53 -InformationLevel Quiet
                    $latency = if ($testResult) { 
                        $ping = Test-Connection -ComputerName '8.8.8.8' -Count 1
                        $ping.ResponseTime
                    } else { $null }
                    
                    $status = if ($testResult -and ($latency -lt $Thresholds.NetworkLatencyMs)) { 'Healthy' } else { 'Warning' }
                    if (-not $testResult) { $status = 'Critical' }
                    
                    $healthResults.Checks.network = @{
                        Status = $status
                        Connected = $testResult
                        LatencyMs = $latency
                    }
                }
                catch {
                    $healthResults.Checks.network = @{
                        Status = 'Critical'
                        Error = $_.Exception.Message
                    }
                }
            }
            
            'services' {
                $criticalServices = @('Docker', 'postgresql', 'redis')
                $serviceStatus = @{}
                
                foreach ($serviceName in $criticalServices) {
                    try {
                        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                        $serviceStatus[$serviceName] = @{
                            Status = if ($service) { $service.Status } else { 'NotFound' }
                            Running = if ($service) { $service.Status -eq 'Running' } else { $false }
                        }
                    }
                    catch {
                        $serviceStatus[$serviceName] = @{
                            Status = 'Error'
                            Error = $_.Exception.Message
                        }
                    }
                }
                
                $runningCount = ($serviceStatus.Values | Where-Object { $_.Running -eq $true }).Count
                $status = if ($runningCount -eq $criticalServices.Count) { 'Healthy' } else { 'Warning' }
                if ($runningCount -eq 0) { $status = 'Critical' }
                
                $healthResults.Checks.services = @{
                    Status = $status
                    Services = $serviceStatus
                    RunningCount = $runningCount
                    TotalCount = $criticalServices.Count
                }
            }
        }
        
        # Update overall status
        $checkStatus = $healthResults.Checks[$check].Status
        if ($checkStatus -eq 'Critical') {
            $healthResults.OverallStatus = 'Critical'
        }
        elseif ($checkStatus -eq 'Warning' -and $healthResults.OverallStatus -ne 'Critical') {
            $healthResults.OverallStatus = 'Warning'
        }
    }
    
    Write-HeadyLog "System health check completed: $($healthResults.OverallStatus)" -Level Info -Category 'Health'
    
    return $healthResults
}

# Cache Management
function Get-HeadyCache {
    param(
        [Parameter(Mandatory)]
        [string]$Key,
        
        [timespan]$MaxAge = [timespan]::FromHours(1)
    )
    
    $cacheFile = Join-Path $Global:HeadyScriptConfig.CachePath "cache-$Key.json"
    
    if (Test-Path $cacheFile) {
        try {
            $cache = Get-Content -Path $cacheFile -Raw | ConvertFrom-Json
            $cacheTime = [datetime]$cache.Timestamp
            
            if ((Get-Date) - $cacheTime -lt $MaxAge) {
                Write-HeadyLog "Cache hit: $Key" -Level Debug -Category 'Cache'
                return $cache.Value
            }
            else {
                Write-HeadyLog "Cache expired: $Key" -Level Debug -Category 'Cache'
                Remove-Item -Path $cacheFile -Force
            }
        }
        catch {
            Write-HeadyLog "Cache read error for $Key`: $($_.Exception.Message)" -Level Warning -Category 'Cache'
        }
    }
    
    return $null
}

function Set-HeadyCache {
    param(
        [Parameter(Mandatory)]
        [string]$Key,
        
        [Parameter(Mandatory)]
        $Value,
        
        [timespan]$TTL = [timespan]::FromHours(1)
    )
    
    $cacheFile = Join-Path $Global:HeadyScriptConfig.CachePath "cache-$Key.json"
    $cache = @{
        Timestamp = (Get-Date).ToString('o')
        TTL = $TTL.ToString()
        Value = $Value
    }
    
    try {
        $cache | ConvertTo-Json -Depth 10 | Set-Content -Path $cacheFile
        Write-HeadyLog "Cache set: $Key (TTL: $($TTL.TotalMinutes) minutes)" -Level Debug -Category 'Cache'
    }
    catch {
        Write-HeadyLog "Cache write error for $Key`: $($_.Exception.Message)" -Level Warning -Category 'Cache'
    }
}

# Module Initialization
Write-HeadyLog "Initializing Heady Script Core Framework v2.0.0" -Level Info -Category 'System'

# Initialize environment
Initialize-HeadyEnvironment

# Export functions
Export-ModuleMember -Function @(
    'Write-HeadyLog',
    'Invoke-HeadyOperation',
    'Get-HeadyConfig',
    'Set-HeadyConfig',
    'Update-HeadyMetrics',
    'Get-HeadyMetrics',
    'Invoke-HeadyParallel',
    'Test-HeadySystemHealth',
    'Get-HeadyCache',
    'Set-HeadyCache',
    'Initialize-HeadyEnvironment'
)
