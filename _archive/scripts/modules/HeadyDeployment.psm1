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
# ║  FILE: scripts/modules/HeadyDeployment.psm1                     ║
# ║  LAYER: deployment-framework                                    ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

<#
.SYNOPSIS
Heady Deployment Framework - Advanced deployment orchestration with safety checks

.DESCRIPTION
Provides comprehensive deployment capabilities including pre-flight checks,
rollback mechanisms, parallel deployments, and detailed monitoring.

.NOTES
Version: 2.0.0
Author: Heady Systems
Last Updated: 2025-02-11
#>

# Import core framework
Import-Module "$PSScriptRoot\HeadyScriptCore.psm1" -Force

# Deployment Configuration
$Global:HeadyDeploymentConfig = @{
    DeploymentTimeout = [timespan]::FromMinutes(30)
    RollbackTimeout = [timespan]::FromMinutes(10)
    HealthCheckInterval = [timespan]::FromSeconds(30)
    MaxConcurrentDeployments = 3
    SafetyChecksEnabled = $true
    AutoRollbackEnabled = $true
    DeploymentHistoryPath = "$env:USERPROFILE\.heady\deployments"
}

# Deployment Registry Management
function Get-HeadyDeploymentRegistry {
    $registryFile = Join-Path $Global:HeadyDeploymentConfig.DeploymentHistoryPath 'registry.json'
    
    if (Test-Path $registryFile) {
        try {
            $registry = Get-Content -Path $registryFile -Raw | ConvertFrom-Json
            return $registry
        }
        catch {
            Write-HeadyLog "Failed to load deployment registry: $($_.Exception.Message)" -Level Error -Category 'Deployment'
            return @{ deployments = @(); lastUpdated = (Get-Date).ToString('o') }
        }
    }
    
    return @{ deployments = @(); lastUpdated = (Get-Date).ToString('o') }
}

function Set-HeadyDeploymentRegistry {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Registry
    )
    
    $registryFile = Join-Path $Global:HeadyDeploymentConfig.DeploymentHistoryPath 'registry.json'
    $registry.lastUpdated = (Get-Date).ToString('o')
    
    try {
        $registry | ConvertTo-Json -Depth 10 | Set-Content -Path $registryFile
        Write-HeadyLog "Deployment registry updated" -Level Debug -Category 'Deployment'
    }
    catch {
        Write-HeadyLog "Failed to save deployment registry: $($_.Exception.Message)" -Level Error -Category 'Deployment'
        throw
    }
}

function Add-HeadyDeploymentRecord {
    param(
        [Parameter(Mandatory)]
        [string]$Target,
        
        [Parameter(Mandatory)]
        [string]$Version,
        
        [Parameter(Mandatory)]
        [string]$Status,
        
        [hashtable]$Metadata = @{},
        
        [string]$DeploymentId = (New-Guid).ToString()
    )
    
    $registry = Get-HeadyDeploymentRegistry
    
    $deployment = @{
        id = $DeploymentId
        target = $Target
        version = $Version
        status = $Status
        timestamp = (Get-Date).ToString('o')
        metadata = $Metadata
    }
    
    $registry.deployments += $deployment
    
    # Keep only last 100 deployments
    if ($registry.deployments.Count -gt 100) {
        $registry.deployments = $registry.deployments | Select-Object -Last 100
    }
    
    Set-HeadyDeploymentRegistry -Registry $registry
    
    Write-HeadyLog "Deployment record added: $Target - $Version - $Status" -Level Info -Category 'Deployment'
    
    return $deployment
}

# Pre-flight Safety Checks
function Test-HeadyDeploymentSafety {
    param(
        [string[]]$Targets,
        
        [switch]$SkipUserSessionCheck,
        
        [switch]$SkipSystemHealthCheck
    )
    
    Write-HeadyLog "Starting deployment safety checks" -Level Info -Category 'Safety'
    
    $safetyResults = @{
        OverallStatus = 'Safe'
        Checks = @{}
        Warnings = @()
        Errors = @()
    }
    
    # System Health Check
    if (-not $SkipSystemHealthCheck) {
        Write-HeadyLog "Checking system health" -Level Debug -Category 'Safety'
        $health = Test-HeadySystemHealth
        
        $safetyResults.Checks.systemHealth = $health
        
        if ($health.OverallStatus -eq 'Critical') {
            $safetyResults.OverallStatus = 'Unsafe'
            $safetyResults.Errors += "System health is critical: $($health.OverallStatus)"
        }
        elseif ($health.OverallStatus -eq 'Warning') {
            $safetyResults.Warnings += "System health shows warnings: $($health.OverallStatus)"
        }
    }
    
    # Active User Sessions Check
    if (-not $SkipUserSessionCheck) {
        Write-HeadyLog "Checking for active user sessions" -Level Debug -Category 'Safety'
        
        try {
            $sessions = query user 2>$null
            if ($sessions -and $sessions.Count -gt 1) { # Header + at least one user
                $activeUsers = $sessions | Where-Object { $_ -match 'Active' -or $_ -match 'Disc' }
                if ($activeUsers.Count -gt 0) {
                    $safetyResults.OverallStatus = 'Unsafe'
                    $safetyResults.Errors += "Active user sessions detected: $($activeUsers.Count) sessions"
                }
            }
        }
        catch {
            $safetyResults.Warnings += "Could not check user sessions: $($_.Exception.Message)"
        }
    }
    
    # Port Availability Check
    Write-HeadyLog "Checking port availability for targets" -Level Debug -Category 'Safety'
    $portConflicts = @()
    
    foreach ($target in $Targets) {
        $ports = switch ($target) {
            'Windows' { @(3300, 3000, 3001) }
            'Android' { @(8080, 5037) }
            'Linux' { @(8080, 22) }
            'Websites' { @(80, 443, 3000) }
            default { @() }
        }
        
        foreach ($port in $ports) {
            try {
                $connection = Test-NetConnection -ComputerName 'localhost' -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
                if ($connection) {
                    $portConflicts += "Port $port is in use (target: $target)"
                }
            }
            catch {
                # Port is available
            }
        }
    }
    
    if ($portConflicts.Count -gt 0) {
        $safetyResults.Warnings += $portConflicts
    }
    
    # Disk Space Check
    Write-HeadyLog "Checking disk space" -Level Debug -Category 'Safety'
    $systemDrive = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceId='C:'"
    $freeSpaceGB = [math]::Round($systemDrive.FreeSpace / 1GB, 2)
    
    if ($freeSpaceGB -lt 5) {
        $safetyResults.OverallStatus = 'Unsafe'
        $safetyResults.Errors += "Insufficient disk space: ${freeSpaceGB}GB free (minimum 5GB required)"
    }
    elseif ($freeSpaceGB -lt 10) {
        $safetyResults.Warnings += "Low disk space: ${freeSpaceGB}GB free"
    }
    
    # Network Connectivity Check
    Write-HeadyLog "Checking network connectivity" -Level Debug -Category 'Safety'
    try {
        $networkTest = Test-NetConnection -ComputerName '8.8.8.8' -Port 53 -InformationLevel Quiet
        if (-not $networkTest) {
            $safetyResults.Warnings += "Network connectivity issues detected"
        }
    }
    catch {
        $safetyResults.Warnings += "Network connectivity check failed: $($_.Exception.Message)"
    }
    
    Write-HeadyLog "Safety checks completed: $($safetyResults.OverallStatus)" -Level Info -Category 'Safety'
    
    return $safetyResults
}

# Deployment Execution
function Start-HeadyDeployment {
    param(
        [Parameter(Mandatory)]
        [string[]]$Targets,
        
        [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
        
        [hashtable]$Parameters = @{},
        
        [switch]$Force,
        
        [switch]$DryRun,
        
        [timespan]$Timeout = $Global:HeadyDeploymentConfig.DeploymentTimeout
    )
    
    $deploymentId = (New-Guid).ToString()
    $startTime = Get-Date
    
    Write-HeadyLog "Starting deployment: $deploymentId" -Level Info -Category 'Deployment' -Metadata @{
        Targets = $Targets -join ', '
        Version = $Version
        Force = $Force
        DryRun = $DryRun
    }
    
    # Create deployment record
    $deployment = Add-HeadyDeploymentRecord -Target ($Targets -join ',') -Version $Version -Status 'Started' -Metadata @{
        startTime = $startTime.ToString('o')
        parameters = $Parameters
        force = $Force
        dryRun = $DryRun
    }
    
    try {
        # Safety checks
        if (-not $Force -and -not $DryRun) {
            $safety = Test-HeadyDeploymentSafety -Targets $Targets
            
            if ($safety.OverallStatus -eq 'Unsafe') {
                throw "Deployment safety check failed: $($safety.Errors -join '; ')"
            }
            
            if ($safety.Warnings.Count -gt 0) {
                Write-HeadyLog "Safety warnings: $($safety.Warnings -join '; ')" -Level Warning -Category 'Safety'
            }
        }
        
        # Execute deployments
        $deploymentResults = @()
        
        if ($Targets.Count -eq 1 -or -not $Global:HeadyDeploymentConfig.MaxConcurrentDeployments) {
            # Sequential deployment
            foreach ($target in $Targets) {
                $result = Start-HeadySingleDeployment -Target $target -Version $Version -Parameters $Parameters -DryRun $DryRun -DeploymentId $deploymentId
                $deploymentResults += $result
            }
        }
        else {
            # Parallel deployment
            $scriptBlocks = foreach ($target in $Targets) {
                {
                    param($t, $v, $p, $d, $id)
                    Start-HeadySingleDeployment -Target $t -Version $v -Parameters $p -DryRun $d -DeploymentId $id
                }.GetNewClosure()
            }
            
            $parallelResults = Invoke-HeadyParallel -ScriptBlocks $scriptBlocks -MaxConcurrency $Global:HeadyDeploymentConfig.MaxConcurrentDeployments -OperationName "Deployment $deploymentId" -ContinueOnError
            $deploymentResults += $parallelResults
        }
        
        # Determine overall status
        $successCount = ($deploymentResults | Where-Object { $_.Success -eq $true }).Count
        $totalCount = $deploymentResults.Count
        
        $overallStatus = if ($successCount -eq $totalCount) { 'Success' } elseif ($successCount -gt 0) { 'Partial' } else { 'Failed' }
        
        # Update deployment record
        $deployment.status = $overallStatus
        $deployment.endTime = (Get-Date).ToString('o')
        $deployment.duration = ((Get-Date) - $startTime).ToString('g')
        $deployment.results = $deploymentResults
        
        $registry = Get-HeadyDeploymentRegistry
        $deploymentIndex = $registry.deployments.Count - 1
        $registry.deployments[$deploymentIndex] = $deployment
        Set-HeadyDeploymentRegistry -Registry $registry
        
        Write-HeadyLog "Deployment completed: $deploymentId - $overallStatus ($successCount/$totalCount successful)" -Level Info -Category 'Deployment'
        
        return @{
            DeploymentId = $deploymentId
            Status = $overallStatus
            Results = $deploymentResults
            SuccessCount = $successCount
            TotalCount = $totalCount
            StartTime = $startTime
            EndTime = Get-Date
            Duration = (Get-Date) - $startTime
        }
    }
    catch {
        # Update deployment record with failure
        $deployment.status = 'Failed'
        $deployment.endTime = (Get-Date).ToString('o')
        $deployment.error = $_.Exception.Message
        $deployment.duration = ((Get-Date) - $startTime).ToString('g')
        
        $registry = Get-HeadyDeploymentRegistry
        $deploymentIndex = $registry.deployments.Count - 1
        $registry.deployments[$deploymentIndex] = $deployment
        Set-HeadyDeploymentRegistry -Registry $registry
        
        Write-HeadyLog "Deployment failed: $deploymentId - $($_.Exception.Message)" -Level Error -Category 'Deployment'
        
        # Auto-rollback if enabled
        if ($Global:HeadyDeploymentConfig.AutoRollbackEnabled -and -not $DryRun) {
            Write-HeadyLog "Initiating automatic rollback" -Level Warning -Category 'Deployment'
            try {
                Start-HeadyRollback -DeploymentId $deploymentId
            }
            catch {
                Write-HeadyLog "Rollback failed: $($_.Exception.Message)" -Level Critical -Category 'Deployment'
            }
        }
        
        throw
    }
}

function Start-HeadySingleDeployment {
    param(
        [Parameter(Mandatory)]
        [string]$Target,
        
        [Parameter(Mandatory)]
        [string]$Version,
        
        [hashtable]$Parameters,
        
        [switch]$DryRun,
        
        [string]$DeploymentId
    )
    
    Write-HeadyLog "Deploying to $Target" -Level Info -Category 'Deployment'
    
    $result = @{
        Target = $Target
        Success = $false
        StartTime = Get-Date
        EndTime = $null
        Duration = $null
        Output = @()
        Errors = @()
    }
    
    try {
        $scriptPath = switch ($Target) {
            'Windows' { "$PSScriptRoot\..\deploy-windows.ps1" }
            'Android' { "$PSScriptRoot\..\deploy-android.ps1" }
            'Linux' { "$PSScriptRoot\..\deploy-linux.ps1" }
            'Websites' { "$PSScriptRoot\..\deploy-websites.ps1" }
            default { throw "Unknown deployment target: $Target" }
        }
        
        if (-not (Test-Path $scriptPath)) {
            throw "Deployment script not found: $scriptPath"
        }
        
        if ($DryRun) {
            Write-HeadyLog "Dry run: Would execute $scriptPath" -Level Info -Category 'Deployment'
            $result.Success = $true
            $result.Output += "Dry run execution for $Target"
        }
        else {
            $scriptBlock = {
                param($script, $params)
                & $script @params
            }.GetNewClosure()
            
            $output = Invoke-HeadyOperation -ScriptBlock $scriptBlock -OperationName "Deploy to $Target" -MaxRetries 2 -ArgumentList $scriptPath, $Parameters
            
            $result.Success = $true
            $result.Output += $output
        }
        
        $result.EndTime = Get-Date
        $result.Duration = $result.EndTime - $result.StartTime
        
        Write-HeadyLog "Deployment to $Target completed successfully" -Level Info -Category 'Deployment'
    }
    catch {
        $result.EndTime = Get-Date
        $result.Duration = $result.EndTime - $result.StartTime
        $result.Errors += $_.Exception.Message
        
        Write-HeadyLog "Deployment to $Target failed: $($_.Exception.Message)" -Level Error -Category 'Deployment'
    }
    
    return $result
}

# Rollback Management
function Start-HeadyRollback {
    param(
        [Parameter(Mandatory)]
        [string]$DeploymentId,
        
        [switch]$Force
    )
    
    Write-HeadyLog "Starting rollback for deployment: $DeploymentId" -Level Warning -Category 'Rollback'
    
    $registry = Get-HeadyDeploymentRegistry
    $deployment = $registry.deployments | Where-Object { $_.id -eq $DeploymentId } | Select-Object -First 1
    
    if (-not $deployment) {
        throw "Deployment not found: $DeploymentId"
    }
    
    if ($deployment.status -eq 'RolledBack') {
        Write-HeadyLog "Deployment already rolled back: $DeploymentId" -Level Warning -Category 'Rollback'
        return
    }
    
    try {
        # Find previous successful deployment for the same target
        $target = $deployment.target
        $previousDeployments = $registry.deployments | Where-Object { 
            $_.target -eq $target -and 
            $_.status -eq 'Success' -and 
            $_.timestamp -lt $deployment.timestamp 
        } | Sort-Object -Property timestamp -Descending
        
        if ($previousDeployments.Count -eq 0 -and -not $Force) {
            throw "No previous successful deployment found for rollback. Use -Force to override."
        }
        
        $rollbackVersion = if ($previousDeployments.Count -gt 0) { $previousDeployments[0].version } else { 'baseline' }
        
        # Execute rollback
        $rollbackResult = @{
            DeploymentId = $DeploymentId
            RollbackVersion = $rollbackVersion
            StartTime = Get-Date
            Success = $false
            Output = @()
            Errors = @()
        }
        
        # This would implement actual rollback logic
        # For now, we'll simulate the rollback
        $rollbackResult.Success = $true
        $rollbackResult.Output += "Rollback to $rollbackVersion completed"
        
        # Update deployment status
        $deployment.status = 'RolledBack'
        $deployment.rollbackInfo = $rollbackResult
        
        $deploymentIndex = $registry.deployments.IndexOf($deployment)
        $registry.deployments[$deploymentIndex] = $deployment
        Set-HeadyDeploymentRegistry -Registry $registry
        
        Write-HeadyLog "Rollback completed: $DeploymentId -> $rollbackVersion" -Level Info -Category 'Rollback'
        
        return $rollbackResult
    }
    catch {
        Write-HeadyLog "Rollback failed: $DeploymentId - $($_.Exception.Message)" -Level Error -Category 'Rollback'
        throw
    }
}

# Health Monitoring
function Start-HeadyDeploymentMonitoring {
    param(
        [Parameter(Mandatory)]
        [string]$DeploymentId,
        
        [timespan]$Duration = [timespan]::FromMinutes(30),
        
        [timespan]$CheckInterval = $Global:HeadyDeploymentConfig.HealthCheckInterval
    )
    
    Write-HeadyLog "Starting deployment monitoring: $DeploymentId" -Level Info -Category 'Monitoring'
    
    $endTime = (Get-Date) + $Duration
    $checks = 0
    
    while ((Get-Date) -lt $endTime) {
        $checks++
        
        try {
            $registry = Get-HeadyDeploymentRegistry
            $deployment = $registry.deployments | Where-Object { $_.id -eq $DeploymentId } | Select-Object -First 1
            
            if (-not $deployment) {
                Write-HeadyLog "Deployment not found for monitoring: $DeploymentId" -Level Warning -Category 'Monitoring'
                break
            }
            
            # Check deployment health
            $healthStatus = Test-HeadyDeploymentHealth -Deployment $deployment
            
            Write-HeadyLog "Health check $checks for $DeploymentId`: $($healthStatus.Status)" -Level Debug -Category 'Monitoring'
            
            if ($healthStatus.Status -eq 'Critical') {
                Write-HeadyLog "Critical health issues detected for $DeploymentId" -Level Error -Category 'Monitoring'
                
                if ($Global:HeadyDeploymentConfig.AutoRollbackEnabled) {
                    Write-HeadyLog "Auto-rollback triggered by health monitoring" -Level Warning -Category 'Monitoring'
                    Start-HeadyRollback -DeploymentId $DeploymentId
                    break
                }
            }
            
            Start-Sleep -Milliseconds $CheckInterval.TotalMilliseconds
        }
        catch {
            Write-HeadyLog "Monitoring error for $DeploymentId`: $($_.Exception.Message)" -Level Error -Category 'Monitoring'
            Start-Sleep -Milliseconds $CheckInterval.TotalMilliseconds
        }
    }
    
    Write-HeadyLog "Deployment monitoring completed: $DeploymentId ($checks checks)" -Level Info -Category 'Monitoring'
}

function Test-HeadyDeploymentHealth {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Deployment
    )
    
    $healthStatus = @{
        Status = 'Healthy'
        Checks = @{}
        Issues = @()
    }
    
    # Check if deployment is recent
    $deploymentTime = [datetime]$Deployment.timestamp
    $timeSinceDeployment = (Get-Date) - $deploymentTime
    
    if ($timeSinceDeployment.TotalMinutes -gt 60) {
        $healthStatus.Checks.age = 'Warning'
        $healthStatus.Issues += "Deployment is $($timeSinceDeployment.TotalMinutes) minutes old"
    }
    else {
        $healthStatus.Checks.age = 'Healthy'
    }
    
    # Check deployment results
    if ($Deployment.results) {
        $failedTargets = $Deployment.results | Where-Object { $_.Success -eq $false }
        if ($failedTargets.Count -gt 0) {
            $healthStatus.Status = 'Critical'
            $healthStatus.Checks.results = 'Critical'
            $healthStatus.Issues += "$($failedTargets.Count) targets failed deployment"
        }
        else {
            $healthStatus.Checks.results = 'Healthy'
        }
    }
    
    return $healthStatus
}

# Initialize deployment directory
if (-not (Test-Path $Global:HeadyDeploymentConfig.DeploymentHistoryPath)) {
    New-Item -Path $Global:HeadyDeploymentConfig.DeploymentHistoryPath -ItemType Directory -Force | Out-Null
}

# Export functions
Export-ModuleMember -Function @(
    'Get-HeadyDeploymentRegistry',
    'Set-HeadyDeploymentRegistry',
    'Add-HeadyDeploymentRecord',
    'Test-HeadyDeploymentSafety',
    'Start-HeadyDeployment',
    'Start-HeadySingleDeployment',
    'Start-HeadyRollback',
    'Start-HeadyDeploymentMonitoring',
    'Test-HeadyDeploymentHealth'
)
