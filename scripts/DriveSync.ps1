param(
    [Parameter(Mandatory=$true)]
    [string[]]$DestinationDrives,
    [ValidateSet('mirror','bidirectional')]
    [string]$Mode = 'mirror'
)

foreach ($drive in $DestinationDrives) {
    if (Test-Path $drive) {
        robocopy "c:\Users\erich\Heady" "$drive\HeadyBackup" /MIR /NP /R:3 /W:5
        # New: Sync to HeadyCloud directory
        robocopy "c:\Users\erich\Heady\cloud_configs" "$drive\HeadyCloud\configs" /MIR /NP /R:3 /W:5
        Write-Host "Successfully synced to $drive" -ForegroundColor Green
    } else {
        Write-Host "Drive $drive not found. Skipping." -ForegroundColor Yellow
    }
}
