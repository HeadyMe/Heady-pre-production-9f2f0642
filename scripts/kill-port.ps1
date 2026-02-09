param([int]$Port = 3300)

$Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object OwningProcess
if ($Process) {
  Stop-Process -Id $Process.OwningProcess -Force
  Write-Host "Killed process on port $Port"
} else {
  Write-Host "No process found on port $Port"
}
