Write-Host "Building Android app"
Set-Location "c:\Users\erich\Heady\headybuddy-mobile"
npm run build
npx react-native run-android
