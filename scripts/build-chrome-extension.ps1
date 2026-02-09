Write-Host "Building Chrome extension"
Set-Location "c:\Users\erich\Heady\extensions\chrome"
npm run build
New-Item -ItemType Directory -Force -Path dist
Copy-Item manifest.json -Destination dist\
Copy-Item *.js -Destination dist\
Copy-Item *.html -Destination dist\
Copy-Item *.css -Destination dist\
