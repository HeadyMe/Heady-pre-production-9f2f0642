param(
    [ValidateSet('desktop','android')]
    [string]$Platform,
    [switch]$UpdateOnly
)

$ErrorActionPreference = "Stop"

# Load configuration
$config = Get-Content -Raw -Path "$PSScriptRoot\..\configs\headybuddy-config.yaml" | ConvertFrom-Yaml

if ($Platform -eq 'desktop') {
    if (-not $UpdateOnly) {
        Write-Host "Building HeadyBuddy Desktop..." -ForegroundColor Cyan
        Set-Location "$PSScriptRoot\..\headybuddy"
        npm install
        npm run build
        npx electron-builder --win --x64
    }
    Write-Host "Starting HeadyBuddy Desktop..." -ForegroundColor Green
    Start-Process -FilePath "$PSScriptRoot\..\headybuddy\dist\win-unpacked\headybuddy.exe" -ArgumentList "--autostart"
}
elseif ($Platform -eq 'android') {
    if (-not $UpdateOnly) {
        Write-Host "Building Android APK..." -ForegroundColor Cyan
        Set-Location "$PSScriptRoot\..\headybuddy-mobile"
        & ".\gradlew.bat" assembleRelease
    }
    $apkPath = "$PSScriptRoot\..\headybuddy-mobile\app\build\outputs\apk\release\app-release.apk"
    Write-Host "Installing APK: $apkPath" -ForegroundColor Green
    & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" install -r $apkPath
}
