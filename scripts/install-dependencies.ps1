Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
Install-Module -Name powershell-yaml -Scope CurrentUser -Force

# Install build tools for OpenSSL
Write-Host "Installing build tools..." -ForegroundColor Cyan

# Download and install CMake
$cmakeUrl = "https://github.com/Kitware/CMake/releases/download/v3.27.7/cmake-3.27.7-windows-x86_64.msi"
$cmakePath = "$env:TEMP\cmake.msi"
Invoke-WebRequest -Uri $cmakeUrl -OutFile $cmakePath
Start-Process -FilePath $cmakePath -Wait -ArgumentList "/SILENT"

# Download and install Git
$gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.42.0.windows.2/Git-2.42.0.2-64-bit.exe"
$gitPath = "$env:TEMP\git.exe"
Invoke-WebRequest -Uri $gitUrl -OutFile $gitPath
Start-Process -FilePath $gitPath -Wait -ArgumentList "/SILENT"

# Download NASM
$nasmUrl = "https://www.nasm.us/pub/nasm/releasebuilds/2.16.01/win64/nasm-2.16.01-win64.zip"
$nasmPath = "$env:TEMP\nasm.zip"
Invoke-WebRequest -Uri $nasmUrl -OutFile $nasmPath
Expand-Archive -Path $nasmPath -DestinationPath "$env:ProgramFiles\NASM"

# Update PATH
$env:Path += ";$env:ProgramFiles\CMake\bin;$env:ProgramFiles\Git\bin;$env:ProgramFiles\NASM"
[Environment]::SetEnvironmentVariable("Path", $env:Path, "Machine")

Write-Host "Build tools installed successfully" -ForegroundColor Green
