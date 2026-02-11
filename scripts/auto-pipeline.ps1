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
<# ║  FILE: scripts/auto-pipeline.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Self-optimizing pipeline using Heady services
#>

# Load configuration
$config = Get-Content "$PSScriptRoot\..\configs\auto-pipeline.yaml" | ConvertFrom-Yaml

# Validate configuration
if (-not $config.task_types) {
    Write-Error "Missing task_types in configuration"
    exit 1
}

if (-not $config.task_types.default) {
    Write-Error "Missing default task type in configuration"
    exit 1
}

# Connect to HeadyBrain for task planning
$brainEndpoint = ($config.services | Where-Object { $_.name -eq "HeadyBrain" }).endpoint

# Main pipeline loop
while ($true) {
    # Get next task from HeadyBrain
    try {
        $task = Invoke-RestMethod -Uri "$brainEndpoint/api/v1/next-task" -Method GET
    } catch {
        # Fallback to local task generator
        . "$PSScriptRoot\local-task-generator.ps1"
        $tasks = Get-Content "$PSScriptRoot\..\data\improvement-tasks.json" | ConvertFrom-Json
        $task = $tasks[0]
    }
    
    if (-not $task) {
        Start-Sleep -Seconds 10
        continue
    }
    
    # Get task type
    $taskType = $task.type
    if (-not $taskType) {
        $taskType = "default"
    }

    # Select service
    $serviceConfig = $config.task_types[$taskType]
    if (-not $serviceConfig) {
        $serviceConfig = $config.task_types["default"]
    }
    
    # Select optimal service - always prefer remote
    $service = $serviceConfig.services | Where-Object { $_.endpoint -notlike "*localhost*" } | Sort-Object weight -Descending | Select-Object -First 1

    # If no remote available, log warning but use local
    if (-not $service) {
        $service = $serviceConfig.services | Sort-Object weight -Descending | Select-Object -First 1
        Write-Warning "No remote services available - using local"
    }
    
    # Execute task
    $result = Invoke-RestMethod -Uri "$service/api/v1/execute" -Method POST -Body ($task | ConvertTo-Json)
    
    # Report result to HeadyBrain
    Invoke-RestMethod -Uri "$brainEndpoint/api/v1/task-result" -Method POST -Body ($result | ConvertTo-Json)
    
    # Optimization cycle
    if ((Get-Date).Second % $config.optimization.interval -eq 0) {
        Invoke-RestMethod -Uri "$brainEndpoint/api/v1/optimize" -Method POST
    }
}
    # Circuit breaker for resilience
    $breaker = Get-CircuitBreaker -Name $service.name
    if ($breaker -and $breaker.State -eq 'Open') {
        Write-Warning "Circuit breaker open for $($service.name) - skipping"
        Register-PatternEvent -PatternId 'circuit_breaker_triggered' -Context @{
            Service = $service.name
            State = $breaker.State
            Timestamp = Get-Date
            TaskId = $task.id
            TaskType = $taskType
        }
        continue
    }
    
    # Health check before execution with retry
    $healthCheckAttempts = 0
    $healthCheckMax = 2
    $serviceHealthy = $false
    $testedServices = @()
    $healthCheckStartTime = Get-Date
    $healthCheckMetrics = @{
        TotalAttempts = 0
        FailedServices = @()
        ResponseTimes = @()
    }
    
    while ($healthCheckAttempts -lt $healthCheckMax -and -not $serviceHealthy) {
        try {
            $healthCheckAttempts++
            $healthCheckMetrics.TotalAttempts++
            $testedServices += $service.name
            
            $healthCheckTimer = [System.Diagnostics.Stopwatch]::StartNew()
            $healthCheck = Invoke-RestMethod -Uri "$($service.endpoint)/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
            $healthCheckTimer.Stop()
            
            $healthCheckMetrics.ResponseTimes += $healthCheckTimer.ElapsedMilliseconds
            
            if ($healthCheck.status -eq "healthy") {
                $serviceHealthy = $true
                Register-PatternEvent -PatternId 'service_health_check_passed' -Context @{
                    Service = $service.name
                    Endpoint = $service.endpoint
                    Timestamp = Get-Date
                    Attempt = $healthCheckAttempts
                    ResponseTime = $healthCheckTimer.ElapsedMilliseconds
                    TotalHealthCheckDuration = ((Get-Date) - $healthCheckStartTime).TotalMilliseconds
                    AverageResponseTime = ($healthCheckMetrics.ResponseTimes | Measure-Object -Average).Average
                }
            } else {
                Write-Warning "$($service.name) unhealthy (status: $($healthCheck.status)) - trying next service"
                $healthCheckMetrics.FailedServices += @{
                    Name = $service.name
                    Status = $healthCheck.status
                    ResponseTime = $healthCheckTimer.ElapsedMilliseconds
                }
                
                $service = $serviceConfig.services | Where-Object { $_.name -notin $testedServices } | Sort-Object weight -Descending | Select-Object -First 1
                if (-not $service) {
                    Write-Error "No healthy services available for task type: $taskType"
                    Register-PatternEvent -PatternId 'no_healthy_services' -Context @{ 
                        TaskType = $taskType
                        TestedServices = $testedServices -join ', '
                        Timestamp = Get-Date
                        TotalAttempts = $healthCheckAttempts
                        Metrics = $healthCheckMetrics
                    }
                    break
                }
            }
        } catch {
            Write-Warning "Health check failed for $($service.name) (attempt $healthCheckAttempts/$healthCheckMax): $_"
            $healthCheckMetrics.FailedServices += @{
                Name = $service.name
                Error = $_.Exception.Message
                ErrorType = $_.Exception.GetType().Name
            }
            
            Register-PatternEvent -PatternId 'service_health_check_failed' -Context @{ 
                Service = $service.name
                Endpoint = $service.endpoint
                Error = $_.Exception.Message
                ErrorType = $_.Exception.GetType().Name
                Attempt = $healthCheckAttempts
                Timestamp = Get-Date
                TaskId = $task.id
                StackTrace = $_.ScriptStackTrace
            }
            
            # Record circuit breaker failure
            Register-CircuitBreakerFailure -Service $service.name -Exception $_
            
            if ($healthCheckAttempts -ge $healthCheckMax) {
                # Fallback to next service
                $service = $serviceConfig.services | Where-Object { $_.name -notin $testedServices } | Sort-Object weight -Descending | Select-Object -First 1
                if ($service) {
                    $healthCheckAttempts = 0  # Reset for new service
                    Write-Host "Falling back to service: $($service.name)" -ForegroundColor Yellow
                    Register-PatternEvent -PatternId 'service_fallback' -Context @{
                        FromService = $testedServices[-1]
                        ToService = $service.name
                        Timestamp = Get-Date
                        TaskId = $task.id
                    }
                } else {
                    Write-Error "Exhausted all available services"
                    Register-PatternEvent -PatternId 'all_services_exhausted' -Context @{
                        TaskId = $task.id
                        TaskType = $taskType
                        TestedServices = $testedServices -join ', '
                        Timestamp = Get-Date
                        Metrics = $healthCheckMetrics
                    }
                    break
                }
            } else {
                $backoff = 500 * [Math]::Pow(2, $healthCheckAttempts - 1)
                Write-Verbose "Backing off for $backoff ms before retry"
                Start-Sleep -Milliseconds $backoff
            }
        }
    }
    
    if (-not $serviceHealthy -or -not $service) {
        Write-Error "Could not find healthy service for task execution"
        Register-PatternEvent -PatternId 'task_execution_aborted' -Context @{
            TaskId = $task.id
            TaskType = $taskType
            Reason = 'No healthy services'
            TestedServices = $testedServices -join ', '
            Timestamp = Get-Date
            TotalHealthCheckDuration = ((Get-Date) - $healthCheckStartTime).TotalMilliseconds
            Metrics = $healthCheckMetrics
        }
        continue
    }
    
    # Add retry logic with exponential backoff
    $maxRetries = 3
    $retryCount = 0
    $backoffMs = 1000
    $requestId = [guid]::NewGuid().ToString()
    $executionStartTime = Get-Date
    $executionMetrics = @{
        Attempts = @()
        TotalDuration = 0
        Success = $false
    }
    
    while ($retryCount -lt $maxRetries) {
        try {
            $attemptStartTime = Get-Date
            
            # Add request timeout and headers
            $headers = @{
                "Content-Type" = "application/json"
                "X-Task-Id" = $task.id
                "X-Task-Type" = $taskType
                "X-Service-Name" = $service.name
                "X-Retry-Attempt" = $retryCount
                "X-Request-Id" = $requestId
                "X-Client-Version" = "1.0.0"
                "X-Timestamp" = (Get-Date -Format 'o')
                "X-Correlation-Id" = "$($task.id)-$requestId"
            }
