$pycharmConfig = Test-Path "~/.PyCharm/config/options/ai.xml"
$windsurfConfig = Test-Path "$PSScriptRoot\..\.windsurf\model_config.yaml"

if ($pycharmConfig -and $windsurfConfig) {
    Write-Host "Model setup verified successfully" -ForegroundColor Green
} else {
    Write-Host "Configuration incomplete" -ForegroundColor Yellow
}
