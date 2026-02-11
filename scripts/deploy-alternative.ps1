# Cloud deployment option
$cloudPath = "\\cloudstorage\heady\deploys\latest"
Copy-Item "headybrowser-desktop\dist\*" $cloudPath -Recurse
Write-Host "Desktop build deployed to cloud at $cloudPath"

# Email APK option
$apkPath = "headybrowser-mobile\android\app\build\outputs\apk\release\app-release.apk"
Write-Host "Mobile APK ready at $apkPath for manual distribution"
