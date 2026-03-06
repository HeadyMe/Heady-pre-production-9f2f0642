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
# ║  FILE: configs/pki/scripts/init-ca.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# Heady Systems PKI Initialization Script
# Sets up root and intermediate CAs with hybrid PQ cryptography

set -e

# Configuration
HEADY_PKI_ROOT="$(pwd)/.."
ROOT_CA_CONFIG="$HEADY_PKI_ROOT/configs/root-ca.cnf"
INTERMEDIATE_CA_CONFIG="$HEADY_PKI_ROOT/configs/intermediate-ca.cnf"

# Initialize CA directories
init_ca_dir() {
  local dir=$1
  mkdir -p "$dir"
  touch "$dir/index.txt"
  echo 1000 > "$dir/serial"
  echo 1000 > "$dir/crlnumber"
  chmod 700 "$dir/private"
}

# Generate root CA
init_root_ca() {
  echo "Initializing Root CA..."
  
  # Generate private key (PQ-enhanced)
  openssl genpkey -algorithm x25519 -out "$HEADY_PKI_ROOT/ca/root/private/root-ca.key" \
    -pkeyopt pq_kem:kyber768 \
    -pkeyopt pq_sig:dilithium5
  
  # Generate self-signed root certificate
  openssl req -config "$ROOT_CA_CONFIG" \
    -key "$HEADY_PKI_ROOT/ca/root/private/root-ca.key" \
    -new -x509 -days 7300 -sha384 -extensions v3_ca \
    -out "$HEADY_PKI_ROOT/ca/root/certs/root-ca.crt"
  
  # Initialize CRL
  openssl ca -config "$ROOT_CA_CONFIG" \
    -gencrl -out "$HEADY_PKI_ROOT/ca/root/crl/root-ca.crl"
}

# Generate intermediate CA
init_intermediate_ca() {
  echo "Initializing Intermediate CA..."
  
  # Generate private key (PQ-enhanced)
  openssl genpkey -algorithm x25519 -out "$HEADY_PKI_ROOT/ca/intermediate/private/intermediate-ca.key" \
    -pkeyopt pq_kem:kyber768 \
    -pkeyopt pq_sig:dilithium5
  
  # Generate CSR
  openssl req -config "$INTERMEDIATE_CA_CONFIG" \
    -new -sha384 \
    -key "$HEADY_PKI_ROOT/ca/intermediate/private/intermediate-ca.key" \
    -out "$HEADY_PKI_ROOT/ca/intermediate/csr/intermediate-ca.csr"
  
  # Sign CSR with root CA
  openssl ca -config "$ROOT_CA_CONFIG" \
    -extensions v3_intermediate_ca \
    -days 1825 -notext -md sha384 \
    -in "$HEADY_PKI_ROOT/ca/intermediate/csr/intermediate-ca.csr" \
    -out "$HEADY_PKI_ROOT/ca/intermediate/certs/intermediate-ca.crt"
  
  # Create certificate chain
  cat "$HEADY_PKI_ROOT/ca/intermediate/certs/intermediate-ca.crt" \
    "$HEADY_PKI_ROOT/ca/root/certs/root-ca.crt" > \
    "$HEADY_PKI_ROOT/ca/intermediate/certs/ca-chain.crt"
  
  # Initialize CRL
  openssl ca -config "$INTERMEDIATE_CA_CONFIG" \
    -gencrl -out "$HEADY_PKI_ROOT/ca/intermediate/crl/intermediate-ca.crl"
}

# Main execution
echo "Setting up Heady Systems PKI Infrastructure"
init_ca_dir "$HEADY_PKI_ROOT/ca/root"
init_ca_dir "$HEADY_PKI_ROOT/ca/intermediate"
init_root_ca
init_intermediate_ca

echo "PKI initialization complete"
echo "Root CA: $HEADY_PKI_ROOT/ca/root/certs/root-ca.crt"
echo "Intermediate CA: $HEADY_PKI_ROOT/ca/intermediate/certs/intermediate-ca.crt"
echo "CA Chain: $HEADY_PKI_ROOT/ca/intermediate/certs/ca-chain.crt"
