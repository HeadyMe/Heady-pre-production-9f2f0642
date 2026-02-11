using namespace System.Management.Automation

function Invoke-MCAllocation {
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Task
    )

    $jsPath = Join-Path $PSScriptRoot 'mc_scheduler.js'
    if (-not (Test-Path $jsPath)) {
        Write-Error "MCScheduler JS not found at $jsPath"
        return $null
    }

    # Bridge to Node.js scheduler implementation
    $taskJson = ($Task | ConvertTo-Json -Compress -Depth 5)
    try {
        $result = node $jsPath $taskJson 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "MCScheduler exited with code $LASTEXITCODE : $result"
            return $null
        }
        return $result
    } catch {
        Write-Error "MCScheduler failed: $_"
        return $null
    }
}

Export-ModuleMember -Function Invoke-MCAllocation
