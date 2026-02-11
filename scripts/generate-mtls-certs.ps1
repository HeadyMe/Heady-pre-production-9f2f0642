<#
.SYNOPSIS
Generates mTLS certificates for internal service communication
.DESCRIPTION
Creates CA, server, and client certificates for mutual TLS authentication
#>

# Certificate parameters
$certDir = "$PSScriptRoot\..\configs\nginx\ssl"
$caName = "HeadyInternalCA"
$serverName = "internal.headymcp.com"
$validDays = 365

# Create directory if not exists
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
}

# 1. Generate CA certificate
openssl req -x509 -newkey rsa:4096 -sha256 -days $validDays -nodes \
    -keyout "$certDir\ca.key" -out "$certDir\ca.crt" \
    -subj "/CN=$caName/O=Heady Systems/C=US"

# 2. Generate server certificate
openssl req -newkey rsa:4096 -sha256 -nodes \
    -keyout "$certDir\server.key" -out "$certDir\server.csr" \
    -subj "/CN=$serverName/O=Heady Systems/C=US"

openssl x509 -req -days $validDays -sha256 \
    -in "$certDir\server.csr" -out "$certDir\server.crt" \
    -CA "$certDir\ca.crt" -CAkey "$certDir\ca.key" -CAcreateserial

# 3. Generate client certificate
openssl req -newkey rsa:4096 -sha256 -nodes \
    -keyout "$certDir\client.key" -out "$certDir\client.csr" \
    -subj "/CN=HeadyClient/O=Heady Systems/C=US"

openssl x509 -req -days $validDays -sha256 \
    -in "$certDir\client.csr" -out "$certDir\client.crt" \
    -CA "$certDir\ca.crt" -CAkey "$certDir\ca.key"

# Create combined PEM files
Get-Content "$certDir\client.crt", "$certDir\client.key" | Set-Content "$certDir\client.pem"
Get-Content "$certDir\server.crt", "$certDir\server.key" | Set-Content "$certDir\server.pem"

Write-Host "mTLS certificates generated in $certDir" -ForegroundColor Green
