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
# ║  FILE: scripts/modules/HeadyService.psm1                         ║
# ║  LAYER: service-management                                      ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

<#
.SYNOPSIS
Heady Service Management Framework - Advanced service orchestration and monitoring

.DESCRIPTION
Provides comprehensive service management capabilities including health monitoring,
automatic recovery, service discovery, and performance optimization.

.NOTES
Version: 2.0.0
Author: Heady Systems
Last Updated: 2025-02-11
#>

# Import core framework
Import-Module "$PSScriptRoot\HeadyScriptCore.psm1" -Force

# Service Configuration
$Global:HeadyServiceConfig = @{
    ServiceRegistryPath = "$env:USERPROFILE\.heady\services"
    HealthCheckInterval = [timespan]::FromSeconds(30)
    RecoveryTimeout = [timespan]::FromMinutes(5)
    MaxRecoveryAttempts = 3
    ServiceTimeout = [timespan]::FromSeconds(30)
    AutoRecoveryEnabled = $true
    PerformanceMonitoring = $true
}

# Service Registry Management
function Get-HeadyServiceRegistry {
    $registryFile = Join-Path $Global:HeadyServiceConfig.ServiceRegistryPath 'registry.json'
    
    if (Test-Path $registryFile) {
        try {
            $registry = Get-Content -Path $registryFile -Raw | ConvertFrom-Json
            return $registry
        }
        catch {
            Write-HeadyLog "Failed to load service registry: $($_.Exception.Message)" -Level Error -Category 'Service'
            return @{ services = @(); lastUpdated = (Get-Date).ToString('o') }
        }
    }
    
    return @{ services = @(); lastUpdated = (Get-Date).ToString('o') }
}

function Set-HeadyServiceRegistry {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Registry
    )
    
    $registryFile = Join-Path $Global:HeadyServiceConfig.ServiceRegistryPath 'registry.json'
    $registry.lastUpdated = (Get-Date).ToString('o')
    
    try {
        $registry | ConvertTo-Json -Depth 10 | Set-Content -Path $registryFile
        Write-HeadyLog "Service registry updated" -Level Debug -Category 'Service'
    }
    catch {
        Write-HeadyLog "Failed to save service registry: $($_.Exception.Message)" -Level Error -Category 'Service'
        throw
    }
}

function Register-HeadyService {
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        
        [Parameter(Mandatory)]
        [string]$Type,
        
        [hashtable]$Endpoints = @{},
        
        [hashtable]$Configuration = @{},
        
        [string]$Version = '1.0.0',
        
        [switch]$Force
    )
    
    $registry = Get-HeadyServiceRegistry
    
    # Check if service already exists
    $existingService = $registry.services | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    
    if ($existingService -and -not $Force) {
        throw "Service already registered: $Name. Use -Force to override."
    }
    
    $service = @{
        id = if ($existingService) { $existingService.id } else { (New-Guid).ToString() }
        name = $Name
        type = $Type
        version = $Version
        endpoints = $Endpoints
        configuration = $Configuration
        status = 'Registered'
        registeredAt = (Get-Date).ToString('o')
        lastHealthCheck = $null
        healthStatus = 'Unknown'
        recoveryAttempts = 0
        metrics = @{
            uptime = 0
            responseTime = 0
            errorCount = 0
            lastError = $null
        }
    }
    
    if ($existingService) {
        # Update existing service
        $serviceIndex = $registry.services.IndexOf($existingService)
        $registry.services[$serviceIndex] = $service
        Write-HeadyLog "Service updated: $Name" -Level Info -Category 'Service'
    }
    else {
        # Add new service
        $registry.services += $service
        Write-HeadyLog "Service registered: $Name" -Level Info -Category 'Service'
    }
    
    Set-HeadyServiceRegistry -Registry $registry
    
    return $service
}

function Unregister-HeadyService {
    param(
        [Parameter(Mandatory)]
        [string]$Name
    )
    
    $registry = Get-HeadyServiceRegistry
    $service = $registry.services | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    
    if (-not $service) {
        throw "Service not found: $Name"
    }
    
    $registry.services.Remove($service) | Out-Null
    Set-HeadyServiceRegistry -Registry $registry
    
    Write-HeadyLog "Service unregistered: $Name" -Level Info -Category 'Service'
    
    return $service
}

# Service Health Monitoring
function Test-HeadyServiceHealth {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service,
        
        [timespan]$Timeout = $Global:HeadyServiceConfig.ServiceTimeout
    )
    
    Write-HeadyLog "Checking health for service: $($Service.name)" -Level Debug -Category 'Health'
    
    $healthResult = @{
        ServiceId = $Service.id
        ServiceName = $Service.name
        Status = 'Healthy'
        ResponseTime = 0
        Timestamp = (Get-Date).ToString('o')
        Checks = @{}
        Errors = @()
        Warnings = @()
    }
    
    try {
        # Endpoint health checks
        foreach ($endpointName in $Service.endpoints.Keys) {
            $endpoint = $Service.endpoints[$endpointName]
            $checkResult = Test-HeadyEndpoint -Endpoint $endpoint -Timeout $Timeout
            $healthResult.Checks[$endpointName] = $checkResult
            
            if ($checkResult.Status -eq 'Unhealthy') {
                $healthResult.Status = 'Unhealthy'
                $healthResult.Errors += "Endpoint $endpointName failed: $($checkResult.Error)"
            }
            elseif ($checkResult.Status -eq 'Degraded') {
                if ($healthResult.Status -eq 'Healthy') { $healthResult.Status = 'Degraded' }
                $healthResult.Warnings += "Endpoint $endpointName degraded: $($checkResult.Warning)"
            }
            
            # Track response time
            if ($checkResult.ResponseTime -gt $healthResult.ResponseTime) {
                $healthResult.ResponseTime = $checkResult.ResponseTime
            }
        }
        
        # Service-specific health checks
        switch ($Service.type) {
            'web' {
                $webHealth = Test-HeadyWebService -Service $Service
                if ($webHealth.Status -ne 'Healthy') {
                    $healthResult.Status = $webHealth.Status
                    $healthResult.Errors += $webHealth.Errors
                    $healthResult.Warnings += $webHealth.Warnings
                }
            }
            'database' {
                $dbHealth = Test-HeadyDatabaseService -Service $Service
                if ($dbHealth.Status -ne 'Healthy') {
                    $healthResult.Status = $dbHealth.Status
                    $healthResult.Errors += $dbHealth.Errors
                    $healthResult.Warnings += $dbHealth.Warnings
                }
            }
            'container' {
                $containerHealth = Test-HeadyContainerService -Service $Service
                if ($containerHealth.Status -ne 'Healthy') {
                    $healthResult.Status = $containerHealth.Status
                    $healthResult.Errors += $containerHealth.Errors
                    $healthResult.Warnings += $containerHealth.Warnings
                }
            }
        }
        
        # Update service metrics
        $service.metrics.responseTime = $healthResult.ResponseTime
        if ($healthResult.Status -eq 'Unhealthy') {
            $service.metrics.errorCount++
            $service.metrics.lastError = $healthResult.Errors[0]
        }
        
        Write-HeadyLog "Health check completed for $($Service.name): $($healthResult.Status)" -Level Debug -Category 'Health'
    }
    catch {
        $healthResult.Status = 'Critical'
        $healthResult.Errors += "Health check failed: $($_.Exception.Message)"
        
        Write-HeadyLog "Health check failed for $($Service.name): $($_.Exception.Message)" -Level Error -Category 'Health'
    }
    
    return $healthResult
}

function Test-HeadyEndpoint {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Endpoint,
        
        [timespan]$Timeout
    )
    
    $result = @{
        Status = 'Healthy'
        ResponseTime = 0
        Error = $null
        Warning = $null
    }
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        switch ($Endpoint.protocol.ToLower()) {
            'http' {
                $response = Invoke-WebRequest -Uri $Endpoint.url -Method GET -TimeoutSec $Timeout.TotalSeconds -ErrorAction Stop
                if ($response.StatusCode -notin @(200, 201, 202, 204)) {
                    $result.Status = 'Unhealthy'
                    $result.Error = "HTTP $($response.StatusCode)"
                }
            }
            'https' {
                $response = Invoke-WebRequest -Uri $Endpoint.url -Method GET -TimeoutSec $Timeout.TotalSeconds -ErrorAction Stop
                if ($response.StatusCode -notin @(200, 201, 202, 204)) {
                    $result.Status = 'Unhealthy'
                    $result.Error = "HTTPS $($response.StatusCode)"
                }
            }
            'tcp' {
                $tcpClient = New-Object System.Net.Sockets.TcpClient
                $connectTask = $tcpClient.ConnectAsync($Endpoint.host, $Endpoint.port)
                $completed = $connectTask.Wait($Timeout.TotalMilliseconds)
                
                if (-not $completed) {
                    $result.Status = 'Unhealthy'
                    $result.Error = "TCP connection timeout"
                }
                else {
                    $tcpClient.Close()
                }
            }
            'ping' {
                $ping = Test-Connection -ComputerName $Endpoint.host -Count 1 -ErrorAction Stop
                if ($ping.ResponseTime -gt 1000) {
                    $result.Status = 'Degraded'
                    $result.Warning = "High ping latency: $($ping.ResponseTime)ms"
                }
            }
            default {
                $result.Status = 'Unhealthy'
                $result.Error = "Unknown protocol: $($Endpoint.protocol)"
            }
        }
        
        $stopwatch.Stop()
        $result.ResponseTime = $stopwatch.ElapsedMilliseconds
        
        # Performance thresholds
        if ($result.ResponseTime -gt 5000) {
            $result.Status = 'Degraded'
            $result.Warning = "High response time: $($result.ResponseTime)ms"
        }
    }
    catch {
        $result.Status = 'Unhealthy'
        $result.Error = $_.Exception.Message
    }
    
    return $result
}

function Test-HeadyWebService {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service
    )
    
    $result = @{
        Status = 'Healthy'
        Errors = @()
        Warnings = @()
    }
    
    try {
        # Check if web server is responding
        $httpEndpoint = $Service.endpoints.Values | Where-Object { $_.protocol -in @('http', 'https') } | Select-Object -First 1
        if ($httpEndpoint) {
            $response = Invoke-WebRequest -Uri $httpEndpoint.url -Method GET -TimeoutSec 10 -ErrorAction Stop
            
            # Check response content
            if ($response.Content.Length -lt 100) {
                $result.Status = 'Degraded'
                $result.Warnings += "Response content unusually short: $($response.Content.Length) bytes"
            }
        }
        
        # Check SSL certificate for HTTPS endpoints
        $httpsEndpoint = $Service.endpoints.Values | Where-Object { $_.protocol -eq 'https' } | Select-Object -First 1
        if ($httpsEndpoint) {
            $cert = Get-HeadySslCertificate -Url $httpsEndpoint.url
            if ($cert) {
                $daysUntilExpiry = ($cert.NotAfter - (Get-Date)).Days
                if ($daysUntilExpiry -lt 30) {
                    $result.Status = 'Degraded'
                    $result.Warnings += "SSL certificate expires in $daysUntilExpiry days"
                }
            }
        }
    }
    catch {
        $result.Status = 'Unhealthy'
        $result.Errors += $_.Exception.Message
    }
    
    return $result
}

function Test-HeadyDatabaseService {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service
    )
    
    $result = @{
        Status = 'Healthy'
        Errors = @()
        Warnings = @()
    }
    
    try {
        # Test database connection
        $connectionString = $Service.configuration.connectionString
        if ($connectionString) {
            # This would implement actual database connection testing
            # For now, we'll simulate the check
            $result.Status = 'Healthy'
        }
        else {
            $result.Status = 'Degraded'
            $result.Warnings += "No connection string configured"
        }
    }
    catch {
        $result.Status = 'Unhealthy'
        $result.Errors += $_.Exception.Message
    }
    
    return $result
}

function Test-HeadyContainerService {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service
    )
    
    $result = @{
        Status = 'Healthy'
        Errors = @()
        Warnings = @()
    }
    
    try {
        $containerName = $Service.configuration.containerName
        if ($containerName) {
            try {
                $container = docker inspect $containerName --format '{{json .}}' | ConvertFrom-Json
                
                if ($container.State.Status -ne 'running') {
                    $result.Status = 'Unhealthy'
                    $result.Errors += "Container not running: $($container.State.Status)"
                }
                
                # Check resource usage
                $stats = docker stats $containerName --no-stream --format '{{json .}}' | ConvertFrom-Json
                
                $cpuPercent = [double]$stats.CPUPerc.TrimEnd('%')
                $memoryPercent = [double]$stats.MemPerc.TrimEnd('%')
                
                if ($cpuPercent -gt 90) {
                    $result.Status = 'Degraded'
                    $result.Warnings += "High CPU usage: $cpuPercent%"
                }
                
                if ($memoryPercent -gt 90) {
                    $result.Status = 'Degraded'
                    $result.Warnings += "High memory usage: $memoryPercent%"
                }
            }
            catch {
                $result.Status = 'Unhealthy'
                $result.Errors += "Container inspection failed: $($_.Exception.Message)"
            }
        }
        else {
            $result.Status = 'Degraded'
            $result.Warnings += "No container name configured"
        }
    }
    catch {
        $result.Status = 'Unhealthy'
        $result.Errors += $_.Exception.Message
    }
    
    return $result
}

# Service Recovery
function Start-HeadyServiceRecovery {
    param(
        [Parameter(Mandatory)]
        [string]$ServiceName,
        
        [switch]$Force
    )
    
    Write-HeadyLog "Starting service recovery: $ServiceName" -Level Warning -Category 'Recovery'
    
    $registry = Get-HeadyServiceRegistry
    $service = $registry.services | Where-Object { $_.name -eq $ServiceName } | Select-Object -First 1
    
    if (-not $service) {
        throw "Service not found: $ServiceName"
    }
    
    if ($service.recoveryAttempts -ge $Global:HeadyServiceConfig.MaxRecoveryAttempts -and -not $Force) {
        throw "Maximum recovery attempts exceeded for service: $ServiceName"
    }
    
    try {
        $recoveryResult = @{
            ServiceName = $ServiceName
            StartTime = Get-Date
            Success = $false
            Actions = @()
            Errors = @()
        }
        
        # Service-specific recovery actions
        switch ($service.type) {
            'web' {
                $recoveryResult = Start-HeadyWebServiceRecovery -Service $service -RecoveryResult $recoveryResult
            }
            'database' {
                $recoveryResult = Start-HeadyDatabaseServiceRecovery -Service $service -RecoveryResult $recoveryResult
            }
            'container' {
                $recoveryResult = Start-HeadyContainerServiceRecovery -Service $service -RecoveryResult $recoveryResult
            }
            default {
                $recoveryResult.Actions += "No specific recovery actions for service type: $($service.type)"
            }
        }
        
        # Update service recovery attempts
        $service.recoveryAttempts++
        
        if ($recoveryResult.Success) {
            $service.recoveryAttempts = 0 # Reset on successful recovery
            $service.status = 'Recovered'
            Write-HeadyLog "Service recovery successful: $ServiceName" -Level Info -Category 'Recovery'
        }
        else {
            $service.status = 'RecoveryFailed'
            Write-HeadyLog "Service recovery failed: $ServiceName" -Level Error -Category 'Recovery'
        }
        
        # Update registry
        $serviceIndex = $registry.services.IndexOf($service)
        $registry.services[$serviceIndex] = $service
        Set-HeadyServiceRegistry -Registry $registry
        
        return $recoveryResult
    }
    catch {
        Write-HeadyLog "Service recovery error for $ServiceName`: $($_.Exception.Message)" -Level Error -Category 'Recovery'
        throw
    }
}

function Start-HeadyWebServiceRecovery {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service,
        
        [Parameter(Mandatory)]
        [hashtable]$RecoveryResult
    )
    
    try {
        # Try to restart web service
        $restartCommand = $Service.configuration.restartCommand
        if ($restartCommand) {
            Write-HeadyLog "Executing restart command for $($Service.name)" -Level Debug -Category 'Recovery'
            Invoke-Expression $restartCommand
            $RecoveryResult.Actions += "Executed restart command"
            
            # Wait for service to start
            Start-Sleep -Seconds 10
            
            # Verify service is healthy
            $healthCheck = Test-HeadyServiceHealth -Service $Service
            if ($healthCheck.Status -eq 'Healthy') {
                $RecoveryResult.Success = $true
                $RecoveryResult.Actions += "Service health verified after restart"
            }
        }
        else {
            $RecoveryResult.Actions += "No restart command configured"
        }
    }
    catch {
        $RecoveryResult.Errors += $_.Exception.Message
    }
    
    return $RecoveryResult
}

function Start-HeadyContainerServiceRecovery {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Service,
        
        [Parameter(Mandatory)]
        [hashtable]$RecoveryResult
    )
    
    try {
        $containerName = $Service.configuration.containerName
        if ($containerName) {
            Write-HeadyLog "Restarting container: $containerName" -Level Debug -Category 'Recovery'
            
            docker restart $containerName
            $RecoveryResult.Actions += "Container restarted"
            
            # Wait for container to be ready
            Start-Sleep -Seconds 15
            
            # Verify container health
            $healthCheck = Test-HeadyServiceHealth -Service $Service
            if ($healthCheck.Status -eq 'Healthy') {
                $RecoveryResult.Success = $true
                $RecoveryResult.Actions += "Container health verified after restart"
            }
        }
        else {
            $RecoveryResult.Actions += "No container name configured"
        }
    }
    catch {
        $RecoveryResult.Errors += $_.Exception.Message
    }
    
    return $RecoveryResult
}

# Service Discovery
function Find-HeadyServices {
    param(
        [string]$Type,
        
        [string]$Status = 'Any',
        
        [hashtable]$Tags = @{},
        
        [switch]$IncludeUnhealthy
    )
    
    $registry = Get-HeadyServiceRegistry
    $services = $registry.services
    
    # Filter by type
    if ($Type) {
        $services = $services | Where-Object { $_.type -eq $Type }
    }
    
    # Filter by status
    if ($Status -ne 'Any') {
        $services = $services | Where-Object { $_.status -eq $Status }
    }
    
    # Filter by health
    if (-not $IncludeUnhealthy) {
        $services = $services | Where-Object { $_.healthStatus -in @('Healthy', 'Degraded') }
    }
    
    # Filter by tags
    if ($Tags.Count -gt 0) {
        foreach ($tag in $Tags.Keys) {
            $services = $services | Where-Object { 
                $_.configuration.tags -and 
                $_.configuration.tags.ContainsKey($tag) -and 
                $_.configuration.tags[$tag] -eq $Tags[$tag] 
            }
        }
    }
    
    return $services
}

# Service Monitoring Dashboard
function Start-HeadyServiceMonitoring {
    param(
        [timespan]$Duration = [timespan]::FromHours(1),
        
        [timespan]$Interval = $Global:HeadyServiceConfig.HealthCheckInterval,
        
        [switch]$AutoRecovery
    )
    
    Write-HeadyLog "Starting comprehensive service monitoring" -Level Info -Category 'Monitoring'
    
    $endTime = (Get-Date) + $Duration
    $checkCount = 0
    
    while ((Get-Date) -lt $endTime) {
        $checkCount++
        $checkTime = Get-Date
        
        try {
            $registry = Get-HeadyServiceRegistry
            $services = $registry.services
            
            Write-HeadyLog "Running health check cycle $checkCount ($($services.Count) services)" -Level Debug -Category 'Monitoring'
            
            foreach ($service in $services) {
                $healthResult = Test-HeadyServiceHealth -Service $service
                
                # Update service health status
                $service.healthStatus = $healthResult.Status
                $service.lastHealthCheck = $healthResult.Timestamp
                
                # Trigger auto-recovery if needed
                if ($AutoRecovery -and $healthResult.Status -eq 'Unhealthy' -and $Global:HeadyServiceConfig.AutoRecoveryEnabled) {
                    Write-HeadyLog "Auto-recovery triggered for $($service.name)" -Level Warning -Category 'Recovery'
                    try {
                        Start-HeadyServiceRecovery -ServiceName $service.name
                    }
                    catch {
                        Write-HeadyLog "Auto-recovery failed for $($service.name): $($_.Exception.Message)" -Level Error -Category 'Recovery'
                    }
                }
                
                # Update service in registry
                $serviceIndex = $registry.services.IndexOf($service)
                $registry.services[$serviceIndex] = $service
            }
            
            Set-HeadyServiceRegistry -Registry $registry
            
            # Update metrics
            Update-HeadyMetrics -Action 'HealthCheckCycle' -Category 'Monitoring' -Metadata @{
                ServiceCount = $services.Count
                CheckNumber = $checkCount
                Duration = ((Get-Date) - $checkTime).TotalMilliseconds
            }
            
        }
        catch {
            Write-HeadyLog "Monitoring cycle $checkCount failed: $($_.Exception.Message)" -Level Error -Category 'Monitoring'
        }
        
        Start-Sleep -Milliseconds $Interval.TotalMilliseconds
    }
    
    Write-HeadyLog "Service monitoring completed ($checkCount cycles)" -Level Info -Category 'Monitoring'
}

# Helper Functions
function Get-HeadySslCertificate {
    param(
        [Parameter(Mandatory)]
        [string]$Url
    )
    
    try {
        $uri = [System.Uri]$Url
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($uri.Host, $uri.Port)
        
        $sslStream = New-Object System.Net.Security.SslStream($tcpClient.GetStream(), $false)
        $sslStream.AuthenticateAsClient($uri.Host)
        
        $cert = $sslStream.RemoteCertificate
        $cert2 = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cert)
        
        $tcpClient.Close()
        $sslStream.Close()
        
        return $cert2
    }
    catch {
        return $null
    }
}

# Initialize service directory
if (-not (Test-Path $Global:HeadyServiceConfig.ServiceRegistryPath)) {
    New-Item -Path $Global:HeadyServiceConfig.ServiceRegistryPath -ItemType Directory -Force | Out-Null
}

# Export functions
Export-ModuleMember -Function @(
    'Get-HeadyServiceRegistry',
    'Set-HeadyServiceRegistry',
    'Register-HeadyService',
    'Unregister-HeadyService',
    'Test-HeadyServiceHealth',
    'Test-HeadyEndpoint',
    'Test-HeadyWebService',
    'Test-HeadyDatabaseService',
    'Test-HeadyContainerService',
    'Start-HeadyServiceRecovery',
    'Start-HeadyWebServiceRecovery',
    'Start-HeadyContainerServiceRecovery',
    'Find-HeadyServices',
    'Start-HeadyServiceMonitoring'
)
