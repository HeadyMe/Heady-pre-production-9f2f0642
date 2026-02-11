# Clone repository creation with resource monitoring
using namespace System.Diagnostics
using namespace System.Threading.Tasks

# Resource-aware repository creation
function New-HeadyRepository {
    param(
        [string]$Name,
        [string]$Type,
        [string]$Profile
    )
    
    Write-Host "Creating $Type repository $Name" -ForegroundColor Cyan
    
    # Set canonical base path
    $basePath = "c:\Users\erich\Heady"
    
    # Clone canonical structure
    $repoPath = Join-Path (Split-Path $basePath) $Name
    New-Item -ItemType Directory -Path $repoPath -Force
    Get-ChildItem -Path $basePath -Exclude '.git','node_modules' | 
        Copy-Item -Destination $repoPath -Recurse -Force
    
    # Apply repo-specific configuration
    Set-Content -Path (Join-Path $repoPath "repo-type.yaml") -Value "type: $Type"
    
    # Update README with repo identity
    $readmePath = Join-Path $repoPath "README.md"
    $content = Get-Content $readmePath -Raw
    $content = $content -replace "# HeadyStack", "# $Name"
    $content = $content -replace "Entity:.*", "Entity: $Type"
    Set-Content -Path $readmePath -Value $content
    
    Write-Host "Created $Type repository at $repoPath" -ForegroundColor Green
}

# Monitor system resources
function Get-SystemLoad {
    $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
    $mem = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue
    return [PSCustomObject]@{
        CPU = $cpu
        Memory = $mem
    }
}

# Main execution with resource monitoring
$repos = @(
    @{Name="HeadyStack-Hybrid-Workstation-2026"; Type="hybrid"; Profile="hybrid.yml"},
    @{Name="HeadyStack-Offline-Secure-2026"; Type="offline"; Profile="local-offline.yml"},
    @{Name="HeadyStack-Cloud-Hub-2026"; Type="cloud"; Profile="cloud-saas.yml"}
)

$maxParallel = 2  # Conservative default
$runningTasks = @()

foreach ($repo in $repos) {
    # Check system load before spawning new tasks
    $load = Get-SystemLoad
    if ($load.CPU -gt 80 -or $load.Memory -lt 2048) {
        Write-Host "High system load detected - throttling creation" -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
    
    # Start task
    $task = [System.Threading.Tasks.Task]::Run({ 
        New-HeadyRepository $repo.Name $repo.Type $repo.Profile 
    })
    $runningTasks += $task
    
    # Maintain max parallelism
    while ($runningTasks.Count -ge $maxParallel) {
        $completed = $runningTasks | Where-Object { $_.IsCompleted }
        if ($completed) {
            $completed | ForEach-Object { $_.Dispose() }
            $runningTasks = $runningTasks | Where-Object { -not $_.IsCompleted }
        }
        Start-Sleep -Seconds 2
    }
}

# Wait for remaining tasks
[System.Threading.Tasks.Task]::WaitAll($runningTasks)
Write-Host "All repositories created successfully" -ForegroundColor Green
