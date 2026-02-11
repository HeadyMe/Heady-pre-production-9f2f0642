# Heady Custom OpenSSL Debug Build Script with PQ Support

# Enhanced tool verification
$missingTools = @()
$requiredTools = @('git', 'cmake', 'nasm', 'perl')

foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        $missingTools += $tool
        Write-Host "Missing required tool: $tool" -ForegroundColor Yellow
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host "Please install missing tools: $($missingTools -join ', ')" -ForegroundColor Red
    exit 1
}

# Build parameters
$buildDir = "$PSScriptRoot\..\build\openssl-pq"
$installDir = "$PSScriptRoot\..\dist\openssl-pq"
$opensslVersion = "3.2.1"
$liboqsBranch = "main"
$ErrorActionPreference = "Stop"

function Build-OpenSSLWithPQ {
    try {
        # Clean previous attempts
        Remove-Item -Path $buildDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $installDir -Recurse -Force -ErrorAction SilentlyContinue
        
        # Create fresh directories
        New-Item -Path $buildDir -ItemType Directory -Force
        New-Item -Path $installDir -ItemType Directory -Force
        
        # Clone repositories with debug info
        Write-Host "Cloning OpenSSL repository..."
        git clone --branch $opensslVersion --verbose https://github.com/openssl/openssl.git "$buildDir\openssl"
        
        Write-Host "Cloning liboqs repository..."
        git clone --branch $liboqsBranch --verbose https://github.com/open-quantum-safe/liboqs.git "$buildDir\liboqs"
        
        # Build liboqs with debug symbols
        Write-Host "Building liboqs..."
        cd "$buildDir\liboqs"
        mkdir build
        cd build
        cmake -GNinja -DCMAKE_INSTALL_PREFIX="$installDir" -DCMAKE_BUILD_TYPE=Debug ..
        ninja -v
        ninja install -v
        
        # Build OpenSSL with debug and PQ support
        Write-Host "Building OpenSSL with PQ support..."
        cd "$buildDir\openssl"
        git apply "$PSScriptRoot\..\patches\openssl-pq.patch"
        ./Configure --prefix="$installDir" --with-liboqs="$installDir" --debug
        make -j4 VERBOSE=1
        make install VERBOSE=1
        
        # Verify build
        if (Test-Path "$installDir\bin\openssl.exe") {
            Write-Host "OpenSSL with PQ support built successfully!" -ForegroundColor Green
        } else {
            throw "Build completed but openssl.exe not found"
        }
    } catch {
        Write-Host "Build failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Main execution
Build-OpenSSLWithPQ
