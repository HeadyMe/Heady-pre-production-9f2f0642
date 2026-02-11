# Dropzone Sync Service
$dropzonePath = 'G:\Dropzone\'
$repos = @('C:\Users\erich\Heady', 'C:\Users\erich\CrossDevice\E''s OnePlus Open\HeadyStack')

# Initialize FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $dropzonePath
$watcher.Filter = '*.*'
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Define actions
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    $changeType = $Event.SourceEventArgs.ChangeType
    
    # Sync to all repos
    foreach ($repo in $repos) {
        $targetPath = Join-Path $repo 'Dropzone'
        New-Item -Path $targetPath -ItemType Directory -Force
        Copy-Item $path $targetPath -Force
    }
    
    # Process and delete
    Start-Sleep -Seconds 5
    Remove-Item $path -Force
}

# Register event
Register-ObjectEvent $watcher 'Created' -Action $action
Write-Host 'Dropzone sync service started. Monitoring: ' $dropzonePath -ForegroundColor Cyan
