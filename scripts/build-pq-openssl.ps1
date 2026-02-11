# Heady Custom OpenSSL Build Script with PQ Support

# Requirements
$requiredTools = @('git', 'cmake', 'nasm', 'perl')

# Build parameters
$buildDir = "$PSScriptRoot\..\build\openssl-pq"
$installDir = "$PSScriptRoot\..\dist\openssl-pq"
$opensslVersion = "3.6.1"
$liboqsBranch = "main"

function Build-OpenSSLWithPQ {
    # Clone repositories
    git clone --branch $opensslVersion https://github.com/openssl/openssl.git "$buildDir\openssl"
    git clone --branch $liboqsBranch https://github.com/open-quantum-safe/liboqs.git "$buildDir\liboqs"
    
    # Build liboqs
    cd "$buildDir\liboqs"
    mkdir build
    cd build
    cmake -GNinja -DCMAKE_INSTALL_PREFIX="$installDir" ..
    ninja
    ninja install
    
    # Patch and build OpenSSL
    cd "$buildDir\openssl"
    git apply "$PSScriptRoot\..\patches\openssl-pq.patch"
    ./Configure --prefix="$installDir" --with-liboqs="$installDir"
    make
    make install
    
    # Verify build
    & "$installDir\bin\openssl.exe" list -public-key-algorithms | Select-String "kyber|dilithium"
}

# Main execution
Build-OpenSSLWithPQ
