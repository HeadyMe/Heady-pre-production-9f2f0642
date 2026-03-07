# HeadySystems v3.2.2 — Key Management Procedures

**Version:** 3.2.2  
**Owner:** Eric Headington (eric@headyconnection.org)  
**Last Updated:** 2026-03-07  
**Classification:** CONFIDENTIAL — Security Team + Ops Only  

All rotation intervals derive from φ=1.618033988749895 and Fibonacci sequences.  
Fibonacci reference: fib(3)=2, fib(5)=5, fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55, fib(11)=89.

---

## 1. Key and Credential Inventory

| Credential Type | Storage | Rotation Interval | Fibonacci Ref | Algorithm |
|---|---|---|---|---|
| API keys (external) | GCP Secret Manager | **fib(11)=89 days** | fib(11) | 256-bit random |
| JWT signing secrets | K8s Secret | **fib(10)=55 days** | fib(10) | HMAC-SHA256 / RS256 |
| TLS certificates | cert-manager / GCP CA | **Renew fib(8)=21 days before expiry** | fib(8) | ECDSA-P384 / TLS 1.3 |
| Database credentials (Postgres) | GCP Secret Manager | **fib(9)=34 days** | fib(9) | 89-char random (fib(11)) |
| Redis auth token | K8s Secret | **fib(9)=34 days** | fib(9) | 55-char random (fib(10)) |
| Service account keys (GCP) | GCP IAM | **fib(10)=55 days** | fib(10) | RSA-2048 |
| Signing keys (cosign) | HSM / GCP KMS | **fib(11)=89 days** | fib(11) | ECDSA-P256 |
| PQC private keys (ML-KEM-768) | HSM | **fib(12)=144 days** | fib(12) | ML-KEM-768 (FIPS 203) |
| PQC signing keys (ML-DSA) | HSM | **fib(12)=144 days** | fib(12) | ML-DSA-65 (FIPS 204) |
| Webhook signing secrets | GCP Secret Manager | **fib(9)=34 days** | fib(9) | HMAC-SHA256 |
| Discord bot token | GCP Secret Manager | **fib(11)=89 days** | fib(11) | Discord OAuth2 |
| GitHub Actions secrets | GitHub OIDC + Vault | **fib(10)=55 days** | fib(10) | OIDC short-lived |

---

## 2. Rotation Schedules

### 2.1 Automated Rotation (via GCP Secret Manager + cert-manager)

Automated rotation is configured for:
- **TLS certificates:** cert-manager renews fib(8)=21 days before expiry
- **GCP Service accounts:** Rotation via GCP Managed Workload Identity where possible
- **GitHub Actions:** OIDC tokens are short-lived (< fib(5)=5 minutes); no rotation needed

**Automation verification:** Confirm automated rotation is active via:
```bash
# Check cert-manager certificates
kubectl get certificates -A

# Check GCP Secret Manager rotation metadata
gcloud secrets describe [secret-name] --format='value(rotation)'
```

### 2.2 Manual Rotation Schedule

For credentials requiring manual rotation, use the rotation calendar. Rotation should be:
- Scheduled during business hours (not late Friday)
- Pre-announced fib(5)=5 days in advance to affected teams
- Never done during active incidents

| Day of Month | Credential |
|---|---|
| Day fib(5)=5 | API keys expiring this month |
| Day fib(7)=13 | JWT secrets on rotation schedule |
| Day fib(8)=21 | Database credentials on rotation schedule |
| Day fib(9)=34 | Service account keys |

---

## 3. Zero-Downtime Dual-Key Rotation Procedure

This procedure applies to ALL credential types. It ensures rotation occurs without service interruption.

### Principle

Two keys are simultaneously valid during the rotation window:
- **KEY_CURRENT:** The current key (being phased out)
- **KEY_NEW:** The new key (being phased in)

Applications must accept BOTH keys during the transition window.

### Dual-Key Rotation Steps

#### Step 1: Generate New Key

```bash
# API key (fib(11)=89 bytes of entropy → 178-char hex)
NEW_KEY=$(openssl rand -hex 89)

# JWT secret (fib(11)=89-byte HMAC secret)
NEW_JWT_SECRET=$(openssl rand -base64 89 | tr -d '\n')

# TLS certificate (let cert-manager handle, or manually):
openssl ecparam -genkey -name prime384v1 -noout -out new-tls.key
openssl req -new -key new-tls.key -out new-tls.csr \
  -subj "/CN=headyme.com/O=HeadySystems Inc./C=US"
```

#### Step 2: Store New Key (Versioned Secret)

All secrets are versioned. Store the new version WITHOUT deleting the old.

```bash
# GCP Secret Manager (creates new version, old version still active)
echo -n "$NEW_KEY" | gcloud secrets versions add [SECRET_NAME] --data-file=-

# K8s: Add new key alongside old (dual-key pattern)
kubectl create secret generic jwt-secret \
  --from-literal=current="$CURRENT_JWT_SECRET" \
  --from-literal=new="$NEW_JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### Step 3: Deploy Application Update to Accept BOTH Keys

Update the application configuration to accept both current and new keys.

For JWT verification — accept both versions:
```javascript
// Dual-key JWT verification (transition window)
const jwtSecrets = [process.env.JWT_SECRET_NEW, process.env.JWT_SECRET_CURRENT]
  .filter(Boolean);

// Verify against any accepted secret
for (const secret of jwtSecrets) {
  try {
    return jwt.verify(token, secret);
  } catch {}
}
throw new Error('Token invalid against all accepted secrets');
```

Deploy and verify all pods running new config:
```bash
kubectl rollout status deployment/heady-brain -n production
kubectl rollout status deployment/heady-conductor -n production
kubectl rollout status deployment/heady-mcp -n production
# ... all 21 services
```

#### Step 4: Transition Clients to New Key

- Rotate API keys for external clients: notify them fib(8)=21 days in advance
- Allow fib(5)=5 days for clients to update
- Monitor old key usage metrics: `heady_api_key_usage{key_version="current"}`

#### Step 5: Decommission Old Key

After the transition window (minimum fib(5)=5 days):
```bash
# Verify old key is no longer used
# heady_api_key_usage{key_version="current"} should be 0

# Remove old key version from GCP Secret Manager
gcloud secrets versions disable [SECRET_NAME] --version=N

# Update K8s secret to remove old key
kubectl patch secret jwt-secret -n production \
  --type='json' \
  -p='[{"op":"remove","path":"/data/current"},{"op":"move","from":"/data/new","path":"/data/current"}]'

# Remove dual-key acceptance from application code
# Deploy single-key config
```

#### Step 6: Verify and Document

```bash
# Verify old key is revoked and rejected
curl -H "Authorization: Bearer $OLD_API_KEY" https://headyme.com/api/brain/status
# Expected: 401 Unauthorized

# Confirm audit log records rotation event
# Look for: event_type="CREDENTIAL_ROTATED", credential_type="[type]"
```

---

## 4. Credential-Specific Procedures

### 4.1 API Keys (rotation every fib(11)=89 days)

**Storage:** GCP Secret Manager with IAM bindings  
**Format:** `hdy_[environment]_[service]_[89-char-random]`  
**Access:** Service accounts via Workload Identity (no plain-text in source code)

**Rotation checklist:**
- [ ] Generate new key with `openssl rand -hex 89`
- [ ] Upload new version to Secret Manager
- [ ] Notify external clients fib(8)=21 days before old key expires
- [ ] Monitor usage of old key (grace period: fib(5)=5 days)
- [ ] Revoke old key version after zero usage for fib(3)=2 consecutive days

**Emergency revocation (immediate):**
```bash
gcloud secrets versions disable heady-api-key-[NAME] --version=CURRENT
```

### 4.2 JWT Signing Secrets (rotation every fib(10)=55 days)

**Storage:** Kubernetes Secret (encrypted at rest via GCP KMS envelope encryption)  
**Algorithm:** HMAC-SHA256 (HS256) for service-to-service; RS256 for external tokens  
**Key length:** fib(11)=89 bytes minimum entropy for HMAC secrets  

**Impact:** JWT rotation invalidates ALL active user sessions. Plan accordingly.

**Rotation window:** Saturday 02:00-04:00 UTC (low traffic)

**Pre-rotation notification:**
- Post in #platform: "JWT rotation in fib(8)=21 days — all sessions will be invalidated"
- Update status page: Planned Maintenance fib(8)=21 days out

**Rotation steps (dual-key):**
1. Generate new JWT secret
2. Configure service to accept both old and new (dual-key window: fib(5)=5 days)
3. Issue new tokens with new secret; old tokens with old secret still valid
4. After fib(5)=5 days: remove old secret acceptance

### 4.3 TLS Certificates (renewal fib(8)=21 days before expiry)

**Issuance:** cert-manager with Let's Encrypt or GCP CA Service  
**Algorithm:** ECDSA-P384 (TLS 1.3 preferred)  
**SAN coverage:** All 9 domains + `*.headyme.com`  
**Wildcard:** Yes for API subdomains  

**Automated renewal configuration (cert-manager):**
```yaml
# Already configured in cluster
spec:
  renewBefore: 504h  # 21 days = fib(8)=21 × 24h
  dnsNames:
    - headyme.com
    - headyconnection.com
    - headyconnection.org
    - headyos.com
    - heady.exchange
    - heady.investments
    - headysystems.com
    - headyai.com
```

**Alert trigger:** `CertificateExpiringSoon` Prometheus alert fires at fib(8)=21 days.  
**Emergency trigger:** `CertificateExpiringCritical` fires at fib(5)=5 days.

**Monitoring:**
```bash
# Check all cert expiry
kubectl get certificates -A -o custom-columns='NAME:.metadata.name,EXPIRY:.status.notAfter,READY:.status.conditions[0].status'
```

### 4.4 Database Credentials (rotation every fib(9)=34 days)

**Storage:** GCP Secret Manager + Cloud SQL Auth Proxy  
**Postgres:** Service-specific users (no shared `postgres` superuser in production)  
**Format:** `[service]_user_[random-fib(10)=55-chars]`  
**Password length:** fib(11)=89 characters (alphanumeric + symbols)  

**Rotation using Cloud SQL:**
```bash
# Generate new password (fib(11)=89 chars)
NEW_PW=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 89)

# Update Cloud SQL user (immediate dual-key not needed — Auth Proxy handles)
gcloud sql users set-password heady_brain_user \
  --instance=heady-postgres-prod \
  --password="$NEW_PW"

# Update Secret Manager
echo -n "$NEW_PW" | gcloud secrets versions add postgres-heady-brain-password --data-file=-

# Trigger pod restart to pick up new credential
kubectl rollout restart deployment/heady-brain -n production
```

### 4.5 PQC Keys (rotation every fib(12)=144 days)

**Algorithm:** ML-KEM-768 (FIPS 203) for key encapsulation; ML-DSA-65 (FIPS 204) for signing  
**Storage:** HSM (Hardware Security Module) or GCP Cloud HSM  
**Rotation complexity:** HIGH — requires coordination with mTLS configuration  

**PQC key rotation steps:**
1. Generate new ML-KEM-768 key pair in HSM
2. Create dual-key configuration (accept both old and new during transition)
3. Update mTLS configuration in heady-guard and heady-chain
4. Test mTLS handshake with new keys in staging
5. Transition all service-to-service calls to new keys
6. Archive old keys (HSM deletion only after fib(9)=34-day retention period)

**Emergency PQC key rotation** (suspected compromise):
- Contact cryptography advisor immediately
- Fall back to classical ECDSA-P384 mTLS temporarily
- PQC key rotation within fib(3)=2 business hours

### 4.6 Service Account Keys (rotation every fib(10)=55 days)

**Storage:** GCP IAM  
**Principle:** Use Workload Identity Federation where possible (no key files)  
**Fallback:** Service account JSON keys stored in Secret Manager (not in code/config)  

**Rotation:**
```bash
# Create new key
gcloud iam service-accounts keys create new-key.json \
  --iam-account=heady-brain@heady-systems.iam.gserviceaccount.com

# Upload to Secret Manager (new version)
gcloud secrets versions add sa-heady-brain-key --data-file=new-key.json

# Test new key
GOOGLE_APPLICATION_CREDENTIALS=new-key.json gcloud auth activate-service-account \
  --key-file=new-key.json

# After validation: delete old key
gcloud iam service-accounts keys delete [OLD_KEY_ID] \
  --iam-account=heady-brain@heady-systems.iam.gserviceaccount.com

# Securely delete local key file
shred -vzu new-key.json
```

---

## 5. Emergency Procedures

### 5.1 Immediate Credential Revocation

If a credential is confirmed or suspected compromised:

```bash
# Revoke API key immediately
gcloud secrets versions disable [SECRET_NAME] --version=CURRENT

# Revoke JWT secret (all sessions invalidated)
kubectl create secret generic jwt-secret \
  --from-literal=current=$(openssl rand -base64 89) \
  -n production --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment -n production  # All pods pick up new secret

# Revoke TLS certificate (OCSP stapling + certificate revocation)
# Contact cert-manager or CA for immediate revocation

# Revoke GCP service account key
gcloud iam service-accounts keys delete [KEY_ID] \
  --iam-account=[SA_EMAIL]
```

### 5.2 Mass Credential Rotation (Breach Scenario)

If a full credentials compromise is suspected (e.g., Secret Manager breach):
1. Rotate ALL credentials in this order:
   - JWT secrets (immediate — invalidates all sessions)
   - API keys (dual-key; notify clients)
   - TLS certificates (cert-manager emergency renewal)
   - Database credentials
   - Service account keys
   - PQC keys (if mTLS compromise suspected)
2. Target: Complete rotation within fib(10)=55 minutes of breach confirmation
3. Verification: Run `security/scanning/image-signing.sh` on all running images post-rotation

---

## 6. Audit and Compliance

- All rotation events are logged to the audit chain (SHA-256 chained entries)
- Rotation events appear in Prometheus: `heady_credential_rotation_total{type, environment}`
- Quarterly review: Verify all rotation intervals are being met
- SOC 2 evidence: GCP Secret Manager version history + Kubernetes audit logs

---

*See also: `security/incident-response/incident-response-plan.md`, `security/scanning/image-signing.sh`*
