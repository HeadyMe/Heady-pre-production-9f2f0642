Write-Host "Building desktop app"
Set-Location "c:\Users\erich\Heady\headybuddy"
npm run build
New-Item -ItemType Directory -Force -Path dist
Copy-Item package.json dist\
Copy-Item *.js dist\
Copy-Item -Recurse src dist\src
