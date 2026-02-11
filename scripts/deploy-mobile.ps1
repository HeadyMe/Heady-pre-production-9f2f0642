$devices = & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" devices

if ($devices -match "device$") {
    & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" install -r headybrowser-mobile\android\app\build\outputs\apk\release\app-release.apk
} else {
    # Get device IP from config
    $config = Get-Content -Raw -Path "c:\Users\erich\Heady\configs\headybrowser-config.yaml" | ConvertFrom-Yaml
    if ($config.android.device_ip) {
        & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" connect $config.android.device_ip
        & "c:\Users\erich\Heady\AndroidSDK\platform-tools\adb.exe" install -r headybrowser-mobile\android\app\build\outputs\apk\release\app-release.apk
    } else {
        Write-Host "Mobile deployment failed - no connected devices found"
        Write-Host "Please either:"
        Write-Host "1. Connect device via USB with debugging enabled"
        Write-Host "2. Set device_ip in configs/headybrowser-config.yaml"
    }
}
