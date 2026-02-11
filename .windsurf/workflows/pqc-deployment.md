---
description: Post-Quantum Cryptography Deployment Workflow
---
# PQC Deployment Protocol

## Pre-Deployment Checks
1. Verify OpenSSL version supports PQ algorithms (3.2.0+)
2. Confirm Nginx built with PQ-enabled OpenSSL
3. Check all services support TLS 1.3

## Deployment Steps

### Phase 1: Certificate Authority Setup
```bash
// turbo
./configs/pki/scripts/init-ca.sh
```

### Phase 2: Service Certificate Issuance
```bash
# API Services
./configs/pki/scripts/issue-cert.sh server api.heady.internal

# Nginx Proxy
./configs/pki/scripts/issue-cert.sh server nginx.heady.internal

# Internal Services
./configs/pki/scripts/issue-cert.sh client manager.heady.internal
```

### Phase 3: Configuration Updates
1. Update Nginx TLS configurations (`mtls.conf`)
2. Deploy new certificates to services
3. Restart services with new certificates

### Phase 4: Validation
```bash
# Verify certificate chain
openssl verify -CAfile /etc/nginx/ssl/pki/intermediate/certs/ca-chain.crt \
  /etc/nginx/ssl/pki/intermediate/certs/server.pem

# Test TLS connection
openssl s_client -connect api.heady.internal:8443 -showcerts \
  -CAfile /etc/nginx/ssl/pki/intermediate/certs/ca-chain.crt
```

## Automation Integration
Add to HCFullPipeline:
```yaml
# configs/hcfullpipeline.yaml
pqc_deployment:
  triggers:
    - schedule: "0 2 * * *"  # 2AM daily
    - on_config_change: pqc/
  steps:
    - verify_openssl
    - generate_certs
    - deploy_configs
    - validate_connections
```

## Rollback Procedure
1. Revert to previous certificates
2. Restore old Nginx configs
3. Force CRL update

## Monitoring
Key metrics to alert on:
- Certificate expiration < 30 days
- Failed handshakes
- Unsupported clients attempting connection
