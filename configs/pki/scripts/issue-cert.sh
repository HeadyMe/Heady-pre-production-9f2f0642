#!/bin/bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: configs/pki/scripts/issue-cert.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# Heady Systems Certificate Issuance Script
# Generates server/client certificates with hybrid PQ cryptography

set -e

# Configuration
HEADY_PKI_ROOT="$(pwd)/.."
INTERMEDIATE_CA_CONFIG="$HEADY_PKI_ROOT/configs/intermediate-ca.cnf"

# Usage
usage() {
  echo "Usage: $0 [server|client] <common_name> [days_valid]"
  echo "Example: $0 server api.heady.internal 365"
  exit 1
}

# Validate arguments
if [ $# -lt 2 ]; then
  usage
fi

TYPE=$1
COMMON_NAME=$2
DAYS_VALID=${3:-365}

# Set output paths
CERT_DIR="$HEADY_PKI_ROOT/ca/intermediate/certs"
PRIVATE_DIR="$HEADY_PKI_ROOT/ca/intermediate/private"
CSR_DIR="$HEADY_PKI_ROOT/ca/intermediate/csr"

# Generate certificate
generate_cert() {
  local cert_type=$1
  local common_name=$2
  local days_valid=$3
  
  # Generate private key (PQ-enhanced)
  local private_key="$PRIVATE_DIR/$common_name.key"
  openssl genpkey -algorithm x25519 -out "$private_key" \
    -pkeyopt pq_kem:kyber768 \
    -pkeyopt pq_sig:dilithium5
  
  # Generate CSR
  local csr="$CSR_DIR/$common_name.csr"
  openssl req -config "$INTERMEDIATE_CA_CONFIG" \
    -key "$private_key" \
    -new -sha384 \
    -out "$csr" \
    -subj "/CN=$common_name/O=Heady Systems"
  
  # Sign certificate
  local cert="$CERT_DIR/$common_name.crt"
  openssl ca -config "$INTERMEDIATE_CA_CONFIG" \
    -extensions "v3_$cert_type" \
    -days "$days_valid" -notext -md sha384 \
    -in "$csr" \
    -out "$cert"
  
  # Create .pem bundle
  cat "$cert" "$HEADY_PKI_ROOT/ca/intermediate/certs/ca-chain.crt" > \
    "$CERT_DIR/$common_name.pem"
  
  # Output results
  echo "Generated $cert_type certificate:"
  echo "  Private key: $private_key"
  echo "  Certificate: $cert"
  echo "  PEM bundle: $CERT_DIR/$common_name.pem"
}

# Main execution
case "$TYPE" in
  server)
    generate_cert "server" "$COMMON_NAME" "$DAYS_VALID"
    ;;
  client)
    generate_cert "client" "$COMMON_NAME" "$DAYS_VALID"
    ;;
  *)
    echo "Invalid certificate type: $TYPE"
    usage
    ;;
esac

echo "Certificate generation complete"
