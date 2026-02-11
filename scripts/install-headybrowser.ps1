param(
    [ValidateSet('desktop','android')]
    [string]$Platform,
    [switch]$UpdateOnly
)

$ErrorActionPreference = "Stop"

# Import custom YAML parser
. "$PSScriptRoot\yaml_parser.ps1"

# Load configuration
$configContent = Get-Content -Raw -Path "$PSScriptRoot\..\configs\headybrowser-config.yaml"
$config = Parse-Yaml $configContent

if ($Platform -eq 'desktop') {
    if (-not $UpdateOnly) {
        Write-Host "Building HeadyBrowser Desktop..." -ForegroundColor Cyan
        Set-Location "$PSScriptRoot\..\headybrowser-desktop"
        npm install
        npm run build
    }
    Write-Host "Starting HeadyBrowser Desktop..." -ForegroundColor Green
    Start-Process -FilePath "$env:LOCALAPPDATA\HeadyBrowser\HeadyBrowser.exe"
}
elseif ($Platform -eq 'android') {
    if (-not $UpdateOnly) {
        Write-Host "Building Android APK..." -ForegroundColor Cyan
        Set-Location "$PSScriptRoot\..\headybrowser-mobile"
        npx react-native run-android --variant=release
    }
    $apkPath = "$PSScriptRoot\..\headybrowser-mobile\android\app\build\outputs\apk\release\app-release.apk"
    Write-Host "Installing APK: $apkPath" -ForegroundColor Green
    & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" install -r $apkPath
}
