<#
.SYNOPSIS
Handles alerts from worker monitoring
#>

# Load alert config
$alerts = Get-Content "$PSScriptRoot\..\configs\worker-alerts.yaml" | ConvertFrom-Yaml

function Send-Alert {
    param($alert, $metrics)
    
    foreach ($channel in $alert.channels) {
        switch -wildcard ($channel) {
            "email:*" {
                $address = $channel.Split(':')[1]
                # Send email alert
            }
            "slack:*" {
                $channelName = $channel.Split(':')[1]
                $webhook = $alerts.notification_channels.slack.$channelName.webhook
                # Send Slack alert
            }
        }
    }
}

# Check alerts every minute
while ($true) {
    $metrics = Get-WorkerMetrics "heady-auth-service-prod-worker"
    
    foreach ($alert in $alerts.alerts) {
        if (Invoke-Expression $alert.condition) {
            Send-Alert $alert $metrics
        }
    }
    
    Start-Sleep -Seconds 60
}
