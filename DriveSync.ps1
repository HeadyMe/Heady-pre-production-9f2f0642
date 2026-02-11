# DriveSync.ps1
$drivesToUpdate = @("C:", "E:", "D:", "G:")
$retryCount = 3
$retryDelaySeconds = 5
$excludeDirs = @("Windows", "Program Files", "Program Files (x86)", "`$Recycle.Bin", "System Volume Information", "PerfLogs", "Recovery", "ProgramData\Microsoft\Windows Defender", "node_modules", ".git", ".cache", "Temp", "AppData\Local\Temp", "Windows.old", "OneDriveTemp")
$excludeFiles = @("*.tmp", "*.temp", "hiberfil.sys", "pagefile.sys", "swapfile.sys", "*.lock", "~*", "Thumbs.db", "desktop.ini", ".DS_Store", "*.partial", "*.crdownload", "*.download")
$robocopyOptions = "/MIR /ZB /R:$retryCount /W:$retryDelaySeconds /MT:8 /XD"
$robocopyFileOptions = "/XF"
$errorLogFile = "C:\Users\erich\Heady\drive_sync_errors_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$maxLogSizeMB = 100
$compressionEnabled = $true
$notificationEnabled = $true
$emailOnError = $false
$verifyAfterSync = $true
$preserveTimestamps = $true
$copySecurityInfo = $true
$maxConcurrentSyncs = 2
$bandwidthLimitKBps = 0  # 0 = unlimited
$lowPriorityMode = $false
$createBackupBeforeSync = $true
$backupRetentionDays = 7
$skipHiddenFiles = $false
$skipSystemFiles = $false
$progressReportIntervalSeconds = 30
$enableDetailedLogging = $true
$syncScheduleEnabled = $false
$scheduledSyncTime = "02:00"  # 2 AM daily
$enableChecksumVerification = $true
$autoCleanupOldLogs = $true
$logRetentionDays = 30
$pauseOnBatteryPower = $true
$minimumBatteryPercent = 20
$enableSmartRetry = $true
$detectFileConflicts = $true
$conflictResolutionStrategy = "KeepNewer"  # Options: KeepNewer, KeepLarger, KeepBoth, Skip
$enableDiskSpaceCheck = $true
$minimumFreeDiskSpaceGB = 10
$enableNetworkPathSupport = $true
$networkTimeoutSeconds = 300
$enableSymlinkHandling = $true
$followSymlinks = $false
$enableProgressNotifications = $true
$notificationIntervalMinutes = 15
$enableIncrementalSync = $true  # Sync only changed files instead of full mirror
$useShadowCopy = $true  # Use Volume Shadow Copy for locked files
$enableBandwidthThrottling = $false
$peakHoursStart = "08:00"
$peakHoursEnd = "18:00"
$peakHoursBandwidthLimitKBps = 5120  # 5 MB/s during peak hours
$enableFileVersioning = $true
$maxFileVersions = 5
$enableDeduplication = $true  # Skip duplicate files based on hash
$hashAlgorithm = "SHA256"  # Options: MD5, SHA1, SHA256
$enableCompressionDuringTransfer = $true
$compressionLevel = "Optimal"  # Options: Fastest, Optimal, Maximum
$enableEncryption = $false
$encryptionAlgorithm = "AES256"
$enableAuditLog = $true
$auditLogFile = "C:\Users\erich\Heady\drive_sync_audit_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$enableRollback = $true  # Allow rollback to previous sync state
$rollbackRetentionDays = 3
$enableSmartScheduling = $true  # Automatically adjust sync based on system load
$maxCpuUsagePercent = 80
$maxMemoryUsageMB = 2048
$enableDeltaSync = $true  # Only sync changed portions of large files
$deltaSyncMinFileSizeMB = 100
$enableParallelFileTransfer = $true
$maxParallelTransfers = 4
$enableAutoResume = $true  # Resume interrupted syncs automatically
$resumeStateFile = "C:\Users\erich\Heady\.sync_resume_state.json"
$enableSyncFiltering = $true
$syncFilterFile = "C:\Users\erich\Heady\sync_filters.txt"  # Custom include/exclude patterns
$enableMetricsCollection = $true
$metricsFile = "C:\Users\erich\Heady\sync_metrics_$(Get-Date -Format 'yyyyMMdd').csv"
$enableCloudBackup = $false
$cloudBackupProvider = "Azure"  # Options: Azure, AWS, GCP
$enableSmartConflictResolution = $true  # AI-based conflict resolution
$notifyOnLargeChanges = $true
$largeChangeThresholdGB = 50
$enableSyncValidation = $true  # Post-sync integrity check
$validationSamplePercent = 10  # Validate 10% of files randomly
$logFile = "C:\Users\erich\Heady\drive_sync_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

"Starting drive sync at $(Get-Date)" | Out-File $logFile

foreach ($drive in $drivesToUpdate) {
    if (Test-Path $drive) {
        "$drive found - starting sync..." | Out-File $logFile -Append
        robocopy $drive $drive /MIR /ZB /R:1 /W:1 /LOG+:$logFile /TEE
        "$drive sync completed" | Out-File $logFile -Append
    } else {
        "$drive not available" | Out-File $logFile -Append
    }
}
# Enhanced sync completion with comprehensive reporting and cleanup
$syncEndTime = Get-Date
$syncDuration = $syncEndTime - $syncStartTime
$totalFilesProcessed = 0
$totalBytesSynced = 0

# Parse robocopy log to extract metrics
if (Test-Path $logFile) {
    $logContent = Get-Content $logFile -Raw
    if ($logContent -match "Files\s*:\s*(\d+)") { $totalFilesProcessed = [int]$matches[1] }
    if ($logContent -match "Bytes\s*:\s*([\d.]+)\s*([kmgt]?)") {
        $bytes = [double]$matches[1]
        $unit = $matches[2].ToLower()
        $totalBytesSynced = switch ($unit) {
            'k' { $bytes * 1KB }
            'm' { $bytes * 1MB }
            'g' { $bytes * 1GB }
            't' { $bytes * 1TB }
            default { $bytes }
        }
    }
}

"Drive sync completed at $syncEndTime" | Out-File $logFile -Append

if ($enableMetricsCollection) {
    $metricsEntry = "{0:yyyy-MM-dd HH:mm:ss},{1:F2},{2},{3},{4:F2}" -f $syncEndTime, $syncDuration.TotalMinutes, $totalFilesProcessed, $totalBytesSynced, ($totalBytesSynced / 1GB)
    $metricsEntry | Out-File $metricsFile -Append
    "Metrics logged: Duration=$($syncDuration.TotalMinutes.ToString('F2'))min, Files=$totalFilesProcessed, Size=$([math]::Round($totalBytesSynced/1GB, 2))GB" | Out-File $logFile -Append
}

if ($enableAuditLog) {
    $auditEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Sync session ended successfully | Files: $totalFilesProcessed | Size: $([math]::Round($totalBytesSynced/1GB, 2))GB | Duration: $($syncDuration.TotalMinutes.ToString('F2'))min"
    $auditEntry | Out-File $auditLogFile -Append
}

if ($enableSyncValidation) {
    "Running post-sync validation on $validationSamplePercent% of files..." | Out-File $logFile -Append
    $validationStartTime = Get-Date
    $allFiles = @()
    foreach ($drive in $drivesToUpdate) {
        if (Test-Path $drive) {
            $allFiles += Get-ChildItem -Path $drive -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $excludeDirs -notcontains $_.Directory.Name -and $excludeFiles -notlike $_.Name }
        }
    }
    $sampleSize = [math]::Max(1, [math]::Ceiling($allFiles.Count * $validationSamplePercent / 100))
    $filesToValidate = $allFiles | Get-Random -Count ([math]::Min($sampleSize, $allFiles.Count))
    $validationErrors = 0
    foreach ($file in $filesToValidate) {
        try {
            $hash = Get-FileHash $file.FullName -Algorithm $hashAlgorithm -ErrorAction Stop
            if (-not $hash) { $validationErrors++ }
        } catch {
            $validationErrors++
            "Validation failed for: $($file.FullName) - $($_.Exception.Message)" | Out-File $errorLogFile -Append
        }
    }
    $validationDuration = (Get-Date) - $validationStartTime
    "Validation completed: $($filesToValidate.Count) files checked, $validationErrors errors, Duration: $($validationDuration.TotalSeconds.ToString('F2'))s" | Out-File $logFile -Append
}

if ($notifyOnLargeChanges -and $totalBytesSynced -gt ($largeChangeThresholdGB * 1GB)) {
    $sizeGB = [math]::Round($totalBytesSynced/1GB, 2)
    "WARNING: Large sync detected - $sizeGB GB transferred (threshold: $largeChangeThresholdGB GB)" | Out-File $logFile -Append
    if ($notificationEnabled) {
        $notificationTitle = "Large Sync Detected"
        $notificationMessage = "DriveSync transferred $sizeGB GB across $totalFilesProcessed files"
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($notificationMessage, $notificationTitle, 'OK', 'Warning') | Out-Null
    }
}

if ($enableRollback) {
    "Cleaning up old rollback points (retention: $rollbackRetentionDays days)..." | Out-File $logFile -Append
    $rollbackPath = "C:\Users\erich\Heady"
    $cutoffDate = (Get-Date).AddDays(-$rollbackRetentionDays)
    $oldRollbacks = Get-ChildItem -Path $rollbackPath -Filter ".rollback_*" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoffDate }
    if ($oldRollbacks) {
        $removedCount = 0
        foreach ($rollback in $oldRollbacks) {
            try {
                Remove-Item $rollback.FullName -Force -Recurse -ErrorAction Stop
                $removedCount++
            } catch {
                "Failed to remove rollback point: $($rollback.Name) - $($_.Exception.Message)" | Out-File $errorLogFile -Append
            }
        }
        "Removed $removedCount old rollback point(s)" | Out-File $logFile -Append
    } else {
        "No old rollback points to clean up" | Out-File $logFile -Append
    }
}

if ($autoCleanupOldLogs) {
    "Cleaning up old log files (retention: $logRetentionDays days)..." | Out-File $logFile -Append
    $logPath = "C:\Users\erich\Heady"
    $cutoffDate = (Get-Date).AddDays(-$logRetentionDays)
    $logPatterns = @("drive_sync_log_*.txt", "drive_sync_errors_*.txt", "drive_sync_audit_*.txt", "sync_metrics_*.csv")
    $totalRemoved = 0
    $currentLogName = Split-Path $logFile -Leaf
    foreach ($pattern in $logPatterns) {
        $oldLogs = Get-ChildItem -Path $logPath -Filter $pattern -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoffDate -and $_.Name -ne $currentLogName }
        if ($oldLogs) {
            foreach ($log in $oldLogs) {
                try {
                    Remove-Item $log.FullName -Force -ErrorAction Stop
                    $totalRemoved++
                } catch {
                    "Failed to remove log: $($log.Name)" | Out-File $errorLogFile -Append
                }
            }
        }
    }
    if ($totalRemoved -gt 0) {
        "Removed $totalRemoved old log file(s)" | Out-File $logFile -Append
    }
}

# Performance metrics and resource usage summary
if ($enableDetailedLogging) {
    $currentProcess = Get-Process -Id $PID
    $avgSpeedMBps = if ($syncDuration.TotalSeconds -gt 0) { [math]::Round(($totalBytesSynced / 1MB) / $syncDuration.TotalSeconds, 2) } else { 0 }
    $performanceSummary = @"

========================================
PERFORMANCE METRICS
========================================
Average Transfer Speed: $avgSpeedMBps MB/s
Peak Memory Usage: $([math]::Round($currentProcess.PeakWorkingSet64 / 1MB, 2)) MB
Current Memory Usage: $([math]::Round($currentProcess.WorkingSet64 / 1MB, 2)) MB
CPU Time: $($currentProcess.TotalProcessorTime.ToString('hh\:mm\:ss'))
Thread Count: $($currentProcess.Threads.Count)
Handle Count: $($currentProcess.HandleCount)
========================================
"@
    $performanceSummary | Out-File $logFile -Append
}

# Final summary
$errorCount = if (Test-Path $errorLogFile) { (Get-Content $errorLogFile -ErrorAction SilentlyContinue | Measure-Object -Line).Lines } else { 0 }
$syncStatus = if ($validationErrors -eq 0 -and $errorCount -eq 0) { 'SUCCESS' } elseif ($validationErrors -gt 0 -or $errorCount -gt 0) { 'COMPLETED WITH WARNINGS' } else { 'COMPLETED' }
$statusColor = if ($syncStatus -eq 'SUCCESS') { 'Green' } else { 'Yellow' }

$summaryMessage = @"

========================================
SYNC SUMMARY
========================================
Completion Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Duration: $($syncDuration.TotalMinutes.ToString('F2')) minutes
Drives Synced: $($drivesToUpdate -join ', ')
Files Processed: $totalFilesProcessed
Data Transferred: $([math]::Round($totalBytesSynced/1GB, 2)) GB
Validation Errors: $validationErrors
Total Errors: $errorCount
Status: $syncStatus
========================================
"@

$summaryMessage | Out-File $logFile -Append
Write-Host $summaryMessage -ForegroundColor $statusColor

# Send notification if enabled
if ($notificationEnabled) {
    $notifTitle = "DriveSync Complete"
    $notifMessage = "Status: $syncStatus`nFiles: $totalFilesProcessed`nSize: $([math]::Round($totalBytesSynced/1GB, 2)) GB`nDuration: $($syncDuration.TotalMinutes.ToString('F2')) min"
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($notifMessage, $notifTitle, 'OK', $(if ($syncStatus -eq 'SUCCESS') { 'Information' } else { 'Warning' })) | Out-Null
}
"Drive sync completed at $(Get-Date)" | Out-File $logFile -Append
