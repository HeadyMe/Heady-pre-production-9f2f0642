# Simple HTTP server for APK sharing
$apkPath = Resolve-Path "headybrowser-mobile\android\app\build\outputs\apk\release\app-release.apk"
python -m http.server 8080 --directory $apkPath.Directory
