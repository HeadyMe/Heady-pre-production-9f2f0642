<#
.SYNOPSIS
Generates mTLS certificates using native PowerShell
#>

# Create certificate directory
$certDir = "$PSScriptRoot\..\configs\nginx\ssl"
if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

# 1. Create CA certificate
$caParams = @{
    Subject = "CN=HeadyInternalCA, O=Heady Systems, C=US"
    KeyLength = 4096
    KeyAlgorithm = "RSA"
    HashAlgorithm = "SHA256"
    CertStoreLocation = "Cert:\CurrentUser\My"
    KeyExportPolicy = "Exportable"
}
$caCert = New-SelfSignedCertificate @caParams

# Export CA cert
Export-Certificate -Cert $caCert -FilePath "$certDir\ca.crt" -Type CERT | Out-Null
$caCert | Export-PfxCertificate -FilePath "$certDir\ca.pfx" -Password (ConvertTo-SecureString -String "password" -AsPlainText -Force) | Out-Null

# 2. Create server certificate
$serverParams = @{
    Subject = "CN=internal.headymcp.com, O=Heady Systems, C=US"
    Signer = $caCert
    KeyLength = 4096
    KeyAlgorithm = "RSA"
    HashAlgorithm = "SHA256"
    CertStoreLocation = "Cert:\CurrentUser\My"
    KeyExportPolicy = "Exportable"
}
$serverCert = New-SelfSignedCertificate @serverParams

# Export server cert
Export-Certificate -Cert $serverCert -FilePath "$certDir\server.crt" -Type CERT | Out-Null
$serverKey = [System.Convert]::ToBase64String($serverCert.PrivateKey.ExportRSAPrivateKey())
Set-Content -Path "$certDir\server.key" -Value $serverKey

# 3. Create client certificate
$clientParams = @{
    Subject = "CN=HeadyClient, O=Heady Systems, C=US"
    Signer = $caCert
    KeyLength = 4096
    KeyAlgorithm = "RSA"
    HashAlgorithm = "SHA256"
    CertStoreLocation = "Cert:\CurrentUser\My"
    KeyExportPolicy = "Exportable"
}
$clientCert = New-SelfSignedCertificate @clientParams

# Export client cert
Export-Certificate -Cert $clientCert -FilePath "$certDir\client.crt" -Type CERT | Out-Null
$clientKey = [System.Convert]::ToBase64String($clientCert.PrivateKey.ExportRSAPrivateKey())
Set-Content -Path "$certDir\client.key" -Value $clientKey

Write-Host "Certificates generated in $certDir" -ForegroundColor Green
