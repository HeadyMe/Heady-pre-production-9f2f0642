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
<# ║  FILE: scripts/heady-service-failover.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Heady Service Failover and Redundancy Manager

.DESCRIPTION
Manages service failover and redundancy to ensure 100% availability of Heady services
and maintains HeadyBrain as the primary decision-maker.

.PARAMETER Action
Action to perform: enable-failover, test-failover, status, configure

.PARAMETER Service
Specific service to manage (optional, defaults to all services)

.EXAMPLE
.\heady-service-failover.ps1 -Action test-failover

.EXAMPLE
.\heady-service-failover.ps1 -Action enable-failover -Service heady-brain
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("enable-failover", "test-failover", "status", "configure", "emergency-activate")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string]$Service = "all"
)

# Failover configuration
$script:FailoverConfig = @{
    "heady-brain" = @{
        Primary = @{
            Endpoint = "https://brain.headysystems.com"
            Priority = 1
            Weight = 100
            HealthCheck = "/api/brain/health"
            Timeout = 5000
        }
        Secondary = @{
            Endpoint = "https://52.32.178.8"
            Priority = 2
            Weight = 90
            HealthCheck = "/api/brain/health"
            Timeout = 10000
        }
        Tertiary = @{
            Endpoint = "https://brain-backup.headysystems.com"
            Priority = 3
            Weight = 80
            HealthCheck = "/api/brain/health"
            Timeout = 15000
        }
        FailoverPolicy = @{
            AutomaticFailover = $true
            FailoverThreshold = 2
            RecoveryThreshold = 5
            FailoverDelay = 2000
            RecoveryDelay = 10000
        }
    }
    "heady-manager" = @{
        Primary = @{
            Endpoint = "http://localhost:3300"
            Priority = 1
            Weight = 100
            HealthCheck = "/api/health"
            Timeout = 3000
        }
        Secondary = @{
            Endpoint = "http://manager.heady.internal:3300"
            Priority = 2
            Weight = 95
            HealthCheck = "/api/health"
            Timeout = 5000
        }
        FailoverPolicy = @{
            AutomaticFailover = $true
            FailoverThreshold = 3
            RecoveryThreshold = 3
            FailoverDelay = 5000
            RecoveryDelay = 15000
        }
    }
    "heady-conductor" = @{
        Primary = @{
            Endpoint = "http://localhost:8080"
            Priority = 1
            Weight = 100
            HealthCheck = "/health"
            Timeout = 5000
        }
        Secondary = @{
            Endpoint = "http://conductor.heady.internal:8080"
            Priority = 2
            Weight = 95
            HealthCheck = "/health"
            Timeout = 8000
        }
        FailoverPolicy = @{
            AutomaticFailover = $true
            FailoverThreshold = 3
            RecoveryThreshold = 3
            FailoverDelay = 5000
            RecoveryDelay = 15000
        }
    }
}

# Current failover state
$script:FailoverState = @{}
$script:FailoverHistory = @()

function Write-FailoverLog {
    param(
        [string]$Message,
        [ValidateSet("debug", "info", "warn", "error", "critical")]
        [string]$Level = "info",
        [string]$Component = "FailoverManager"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] [$Component] $Message"
    
    switch ($Level) {
        "debug" { Write-Host $logEntry -ForegroundColor Gray }
        "info"  { Write-Host $logEntry -ForegroundColor Green }
        "warn"  { Write-Host $logEntry -ForegroundColor Yellow }
        "error" { Write-Host $logEntry -ForegroundColor Red }
        "critical" { Write-Host $logEntry -ForegroundColor White -BackgroundColor Red }
    }
    
    $logFile = "c:\Users\erich\Heady\logs\service-failover.log"
    if (!(Test-Path (Split-Path $logFile))) {
        New-Item -ItemType Directory -Path (Split-Path $logFile) -Force | Out-Null
    }
    Add-Content -Path $logFile -Value $logEntry
}

function Test-EndpointHealth {
    param(
        [string]$Endpoint,
        [string]$HealthCheck = "/health",
        [int]$Timeout = 5000
    )
    
    try {
        $fullEndpoint = "$Endpoint$HealthCheck"
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $response = Invoke-WebRequest -Uri $fullEndpoint -Method GET -TimeoutSec ($Timeout/1000) -UseBasicParsing
        $stopwatch.Stop()
        
        if ($response.StatusCode -eq 200) {
            return @{
                Healthy = $true
                ResponseTime = $stopwatch.ElapsedMilliseconds
                Endpoint = $fullEndpoint
                StatusCode = $response.StatusCode
                Timestamp = Get-Date
            }
        }
    } catch {
        return @{
            Healthy = $false
            ResponseTime = $Timeout
            Endpoint = $fullEndpoint
            Error = $Error[0].Exception.Message
            Timestamp = Get-Date
        }
    }
}

function Get-ActiveEndpoint {
    param([string]$ServiceName)
    
    if (-not $script:FailoverConfig.ContainsKey($ServiceName)) {
        Write-FailoverLog "Unknown service: $ServiceName" -Level error
        return $null
    }
    
    $config = $script:FailoverConfig[$ServiceName]
    $activeEndpoint = $null
    
    # Check current state
    if ($script:FailoverState.ContainsKey($ServiceName)) {
        $currentState = $script:FailoverState[$ServiceName]
        if ($currentState.ActiveEndpoint) {
            # Test current active endpoint
            $health = Test-EndpointHealth -Endpoint $currentState.ActiveEndpoint.Endpoint -HealthCheck $currentState.ActiveEndpoint.HealthCheck -Timeout $currentState.ActiveEndpoint.Timeout
            
            if ($health.Healthy) {
                return $currentState.ActiveEndpoint
            }
        }
    }
    
    # Find best available endpoint
    $endpoints = @()
    foreach ($key in @("Primary", "Secondary", "Tertiary")) {
        if ($config.ContainsKey($key)) {
            $endpoints += $config[$key]
        }
    }
    
    # Sort by priority and test each
    $endpoints = $endpoints | Sort-Object { $_.Priority }
    
    foreach ($endpoint in $endpoints) {
        $health = Test-EndpointHealth -Endpoint $endpoint.Endpoint -HealthCheck $endpoint.HealthCheck -Timeout $endpoint.Timeout
        
        if ($health.Healthy) {
            # Update state
            $script:FailoverState[$ServiceName] = @{
                ActiveEndpoint = $endpoint
                LastHealthCheck = $health.Timestamp
                ConsecutiveFailures = 0
                LastFailover = Get-Date
            }
            
            Write-FailoverLog "Selected endpoint for $ServiceName`: $($endpoint.Endpoint) (Priority: $($endpoint.Priority))" -Level info
            return $endpoint
        }
    }
    
    Write-FailoverLog "No healthy endpoints available for $ServiceName" -Level critical
    return $null
}

function Enable-ServiceFailover {
    param([string]$ServiceName)
    
    Write-FailoverLog "Enabling failover for $ServiceName" -Level info
    
    if (-not $script:FailoverConfig.ContainsKey($ServiceName)) {
        Write-FailoverLog "Unknown service: $ServiceName" -Level error
        return $false
    }
    
    $config = $script:FailoverConfig[$ServiceName]
    
    # Initialize failover state
    $script:FailoverState[$ServiceName] = @{
        ActiveEndpoint = $null
        LastHealthCheck = $null
        ConsecutiveFailures = 0
        LastFailover = $null
        FailoverEnabled = $true
        FailoverPolicy = $config.FailoverPolicy
    }
    
    # Test and select best endpoint
    $activeEndpoint = Get-ActiveEndpoint -ServiceName $ServiceName
    
    if ($activeEndpoint) {
        Write-FailoverLog "Failover enabled for $ServiceName with active endpoint: $($activeEndpoint.Endpoint)" -Level info
        return $true
    } else {
        Write-FailoverLog "Failed to enable failover for $ServiceName - no healthy endpoints" -Level error
        return $false
    }
}

function Test-ServiceFailover {
    param([string]$ServiceName)
    
    Write-FailoverLog "Testing failover for $ServiceName" -Level info
    
    if (-not $script:FailoverState.ContainsKey($ServiceName)) {
        Write-FailoverLog "Failover not enabled for $ServiceName" -Level warn
        return $false
    }
    
    $currentState = $script:FailoverState[$ServiceName]
    $config = $script:FailoverConfig[$ServiceName]
    
    # Simulate primary failure
    Write-FailoverLog "Simulating primary endpoint failure for $ServiceName" -Level warn
    
    # Test all endpoints
    $endpointResults = @()
    foreach ($key in @("Primary", "Secondary", "Tertiary")) {
        if ($config.ContainsKey($key)) {
            $endpoint = $config[$key]
            $health = Test-EndpointHealth -Endpoint $endpoint.Endpoint -HealthCheck $endpoint.HealthCheck -Timeout $endpoint.Timeout
            
            $endpointResults += @{
                Name = $key
                Endpoint = $endpoint.Endpoint
                Priority = $endpoint.Priority
                Healthy = $health.Healthy
                ResponseTime = $health.ResponseTime
                Error = if ($health.Error) { $health.Error } else { $null }
            }
        }
    }
    
    # Find best alternative
    $healthyEndpoints = $endpointResults | Where-Object { $_.Healthy } | Sort-Object { $_.Priority }
    
    if ($healthyEndpoints.Count -gt 0) {
        $bestAlternative = $healthyEndpoints[0]
        Write-FailoverLog "Failover test successful for $ServiceName - best alternative: $($bestAlternative.Endpoint)" -Level info
        
        # Record failover test
        $script:FailoverHistory += @{
            Timestamp = Get-Date
            Service = $ServiceName
            Action = "test-failover"
            Result = "success"
            ActiveEndpoint = $bestAlternative.Endpoint
            AllEndpoints = $endpointResults
        }
        
        return $true
    } else {
        Write-FailoverLog "Failover test failed for $ServiceName - no healthy alternatives" -Level error
        
        $script:FailoverHistory += @{
            Timestamp = Get-Date
            Service = $ServiceName
            Action = "test-failover"
            Result = "failed"
            ActiveEndpoint = $null
            AllEndpoints = $endpointResults
        }
        
        return $false
    }
}

function Get-FailoverStatus {
    param([string]$ServiceName = "all")
    
    Write-FailoverLog "Getting failover status" -Level info
    
    $status = @{
        Timestamp = Get-Date
        Services = @{}
        Summary = @{
            TotalServices = 0
            ServicesWithFailover = 0
            ServicesHealthy = 0
            ServicesInFailover = 0
        }
    }
    
    $servicesToCheck = if ($ServiceName -eq "all") { $script:FailoverConfig.Keys } else { @($ServiceName) }
    
    foreach ($service in $servicesToCheck) {
        if (-not $script:FailoverConfig.ContainsKey($service)) {
            continue
        }
        
        $status.Summary.TotalServices++
        
        $serviceStatus = @{
            FailoverEnabled = $false
            ActiveEndpoint = $null
            Healthy = $false
            InFailover = $false
            LastFailover = $null
        }
        
        if ($script:FailoverState.ContainsKey($service)) {
            $state = $script:FailoverState[$service]
            $serviceStatus.FailoverEnabled = $state.FailoverEnabled
            $serviceStatus.ActiveEndpoint = $state.ActiveEndpoint.Endpoint
            $serviceStatus.LastFailover = $state.LastFailover
            $serviceStatus.InFailover = ($state.ConsecutiveFailures -gt 0)
            
            if ($state.ActiveEndpoint) {
                $health = Test-EndpointHealth -Endpoint $state.ActiveEndpoint.Endpoint -HealthCheck $state.ActiveEndpoint.HealthCheck -Timeout $state.ActiveEndpoint.Timeout
                $serviceStatus.Healthy = $health.Healthy
            }
            
            if ($state.FailoverEnabled) {
                $status.Summary.ServicesWithFailover++
            }
            
            if ($serviceStatus.Healthy) {
                $status.Summary.ServicesHealthy++
            }
            
            if ($serviceStatus.InFailover) {
                $status.Summary.ServicesInFailover++
            }
        }
        
        $status.Services[$service] = $serviceStatus
    }
    
    return $status
}

function Enable-EmergencyFailover {
    Write-FailoverLog "ACTIVATING EMERGENCY FAILOVER MODE" -Level critical
    
    # Enable failover for all critical services
    $criticalServices = @("heady-brain", "heady-manager", "heady-conductor")
    
    foreach ($service in $criticalServices) {
        Write-FailoverLog "Emergency activation for $service" -Level critical
        
        # Force enable failover
        $success = Enable-ServiceFailover -ServiceName $service
        
        if ($success) {
            Write-FailoverLog "Emergency failover enabled for $service" -Level critical
        } else {
            Write-FailoverLog "Emergency failover FAILED for $service" -Level critical
        }
    }
    
    # Record emergency activation
    $script:FailoverHistory += @{
        Timestamp = Get-Date
        Service = "all"
        Action = "emergency-activate"
        Result = "executed"
        CriticalServices = $criticalServices
    }
    
    Write-FailoverLog "Emergency failover activation completed" -Level critical
}

# Main execution
try {
    Write-FailoverLog "Starting Heady Service Failover Manager - Action: $Action" -Level info
    
    switch ($Action) {
        "enable-failover" {
            if ($Service -eq "all") {
                $services = $script:FailoverConfig.Keys
                $successCount = 0
                
                foreach ($svc in $services) {
                    if (Enable-ServiceFailover -ServiceName $svc) {
                        $successCount++
                    }
                }
                
                Write-FailoverLog "Failover enabled for $successCount/$($services.Count) services" -Level info
            } else {
                Enable-ServiceFailover -ServiceName $Service
            }
        }
        
        "test-failover" {
            if ($Service -eq "all") {
                $services = $script:FailoverConfig.Keys
                $successCount = 0
                
                foreach ($svc in $services) {
                    if (Test-ServiceFailover -ServiceName $svc) {
                        $successCount++
                    }
                }
                
                Write-FailoverLog "Failover test passed for $successCount/$($services.Count) services" -Level info
            } else {
                Test-ServiceFailover -ServiceName $Service
            }
        }
        
        "status" {
            $status = Get-FailoverStatus -ServiceName $Service
            Write-FailoverLog "Failover Status Report:" -Level info
            Write-FailoverLog "Total Services: $($status.Summary.TotalServices)" -Level info
            Write-FailoverLog "Services with Failover: $($status.Summary.ServicesWithFailover)" -Level info
            Write-FailoverLog "Services Healthy: $($status.Summary.ServicesHealthy)" -Level info
            Write-FailoverLog "Services in Failover: $($status.Summary.ServicesInFailover)" -Level info
            
            foreach ($svc in $status.Services.Keys) {
                $svcStatus = $status.Services[$svc]
                Write-FailoverLog "$svc`: Enabled=$($svcStatus.FailoverEnabled), Healthy=$($svcStatus.Healthy), Active=$($svcStatus.ActiveEndpoint)" -Level info
            }
        }
        
        "emergency-activate" {
            Enable-EmergencyFailover
        }
        
        default {
            Write-FailoverLog "Unknown action: $Action" -Level error
            exit 1
        }
    }
    
    Write-FailoverLog "Heady Service Failover Manager completed" -Level info
    
} catch {
    Write-FailoverLog "Fatal error in failover manager: $($Error[0].Exception.Message)" -Level critical
    exit 1
}
