# Data Classification Framework
**HeadySystems Inc. (DBA Heady™) | HeadyOS Platform**

Version: 1.0.0  
Effective Date: 2026-03-01  
Owner: Data Protection Officer (dpo@headyme.com)  
Review Cycle: Every fib(11)=89 days

---

## 1. PURPOSE AND SCOPE

This framework establishes classification levels for all data processed by HeadyOS, HeadyMe AI (headyme.com), and associated services. All employees, contractors, and system components must handle data according to its classification level.

**Scope:** All data at rest, in transit, and in processing across all 21 HeadyOS microservices, 9 domains, and all cloud infrastructure.

---

## 2. CLASSIFICATION LEVELS

### Level 1: PUBLIC

**Definition:** Information that has been formally approved for public release and poses no risk if disclosed.

**Characteristics:**
- Intentionally made available to the general public
- Disclosure causes no harm to HeadySystems or its users
- Examples: Marketing materials, public API documentation, open-source code, published blog posts

**Handling Procedures:**
- No access controls required
- May be stored in public repositories
- No encryption requirement (though TLS for transit is standard)
- No special disposal procedures
- May be shared freely via all channels

**HeadyOS Data Types Classified as PUBLIC:**
- Public API documentation (docs.headyme.com)
- Open-source SDK code (github.com/heady-ai)
- Published product updates and blog posts
- Public status page data (status.headyme.com)
- Marketing materials and press releases

---

### Level 2: INTERNAL

**Definition:** Information intended for use within HeadySystems Inc. only. Disclosure could cause minor disruption but is not catastrophic.

**Characteristics:**
- Default classification for all internally-created documents
- Not approved for public release but not sensitive
- Examples: Internal documentation, engineering wikis, meeting notes, operational runbooks

**Handling Procedures:**
- Requires authentication to access (Heady SSO)
- Encrypt in transit (TLS 1.3 — always enforced)
- Encryption at rest recommended
- Limit sharing to employees and vetted contractors
- Dispose via standard deletion (no cryptographic erasure required)
- Internal email is acceptable for sharing

**HeadyOS Data Types Classified as INTERNAL:**
- Internal engineering documentation and RFCs
- Non-sensitive operational logs (error codes, latency metrics)
- Aggregated/anonymized usage statistics
- Development and staging environment data
- Internal cost and resource metrics
- Team communication archives

**Retention:** Per RETENTION_WINDOWS defaults — minimum fib(11)=89 days for operational data.

---

### Level 3: CONFIDENTIAL

**Definition:** Sensitive information that, if disclosed without authorization, could harm HeadySystems, its users, or business partners. Requires active protection.

**Characteristics:**
- Contains personal data (PII) or business-sensitive information
- Regulated by GDPR, CCPA, or contractual obligations
- Disclosure could result in regulatory penalties, reputation damage, or financial loss

**Handling Procedures:**
- **Access Control:** Role-based access (RBAC) with JWT capability bitmask; principle of least privilege
- **Encryption at Rest:** AES-256-GCM required for all storage
- **Encryption in Transit:** TLS 1.3 minimum; end-to-end encryption for API communications
- **Logging:** All access logged in SHA-256 audit chain
- **Sharing:** Only via encrypted channels; no forwarding to personal email
- **Disposal:** Cryptographic erasure (NIST SP 800-88 Rev. 1) or secure deletion with verification
- **Third-Party Sharing:** Requires DPA or equivalent written agreement
- **Copy/Export:** Track and log all exports; limit to authorized personnel

**HeadyOS Data Types Classified as CONFIDENTIAL:**

| Data Type | Location | Classification Reason |
|-----------|----------|----------------------|
| **User Account Data** | Postgres/users table | PII — GDPR Art. 4, CCPA Category A |
| **AI Interaction History** | Postgres/ai_interactions | Contains user prompts and responses; potentially sensitive content |
| **Usage Logs** | Redis/usage_logs | PII (IP address), behavioral data |
| **Vector Memory Data** | pgvector/vector_memories | User-generated content and semantic embeddings |
| **Agent Configurations** | Postgres/agents | Business-sensitive workflow definitions |
| **Conductor Task History** | Postgres/conductor_tasks | Business-sensitive automation data |
| **Consent Records** | Postgres/consent_records | Privacy-sensitive legal records |
| **DSAR Records** | Postgres/dsar_requests | Legal compliance data with PII |
| **Audit Logs** | Postgres/audit_events (SHA-256 chain) | Security-sensitive operational data |
| **Session Tokens** | Redis/sessions | Authentication credentials |
| **Integration Credentials** | Redis/Postgres (encrypted) | Third-party API access tokens |
| **Billing Information** | Postgres (Stripe-tokenized) | Financial and PII data |
| **Employee Records** | HR systems | PII — employment data |

---

### Level 4: RESTRICTED

**Definition:** The highest classification level. Information whose unauthorized disclosure would cause severe harm, including catastrophic security compromise, major legal liability, patent loss, or regulatory enforcement action.

**Characteristics:**
- Enables complete system compromise if exposed
- Contains trade secrets or pending patent IP
- Specific to highly sensitive legal or regulatory matters
- Very limited distribution on strict need-to-know

**Handling Procedures:**
- **Access Control:** Multi-factor authentication required; only explicitly named individuals; board/CEO-level authorization for external sharing
- **Encryption:** AES-256-GCM at rest + HSM-backed key management (Google KMS HSM); end-to-end encrypted for any transmission
- **Storage:** Only in approved, encrypted, audited systems; never personal devices
- **Logging:** All access triggers immediate alert to security team + CEO
- **Sharing:** No email; only encrypted, authenticated channels with delivery confirmation
- **Printing:** Prohibited without CEO authorization; watermarked if printed
- **Disposal:** Physical media: NSA/CSS Evaluated Products List approved shredder; Digital: multi-pass cryptographic erasure with certificate
- **Third-Party:** Requires board approval + NDA + legal review
- **Audit:** Quarterly access review required

**HeadyOS Data Types Classified as RESTRICTED:**

| Data Type | Location | Classification Reason |
|-----------|----------|----------------------|
| **API Keys and Secrets** | Environment variables (encrypted) | Enable complete system access if exposed |
| **Database Credentials** | Google Secret Manager | Enable full data access |
| **JWT Signing Keys** | Google KMS | Enable authentication bypass if compromised |
| **Patent Provisional Filings** (51+ provisional patents) | `docs/patents/` (encrypted at rest) | USPTO provisional patent IP |
| **Trade Secrets:** CSL Algorithm, Sacred Geometry SDK, φ-framework source | Core microservice code | Core competitive differentiators |
| **Encryption Keys** | Google KMS HSM | Protect all other CONFIDENTIAL/RESTRICTED data |
| **heady-guard Configuration** | Deploy config (encrypted) | Zero-trust sandbox configuration |
| **Security Incident Details** | Postgres/security_incidents (restricted) | Operational security details |
| **Legal Hold Data** | Legal systems | Active litigation; attorney-client privilege |
| **M&A / Investor Data** | Board-level systems | Material non-public information |
| **Employee SSN/Tax IDs** | HR systems (encrypted) | Highly sensitive PII |

---

## 3. DATA TYPE MAPPING SUMMARY

| HeadyOS Data Type | Classification | Retention | Encryption | Access |
|-------------------|---------------|-----------|------------|--------|
| Vector memory (embeddings) | CONFIDENTIAL | fib(13)=233d | AES-256 + pgvector | User + tenant admin |
| Vector memory (metadata) | CONFIDENTIAL | fib(13)=233d | AES-256 | User + tenant admin |
| Agent configurations | CONFIDENTIAL | fib(13)=233d | AES-256 | Owner + org admin |
| User PII (account) | CONFIDENTIAL | fib(13)=233d | AES-256 | User + compliance team |
| API keys (hashed prefix) | CONFIDENTIAL | Lifetime of key | SHA-256 hash | User only |
| API keys (raw, at creation) | RESTRICTED | 0 days (never stored) | N/A — show once | User only, once |
| JWT signing keys | RESTRICTED | Rotated fib(11)=89d | KMS HSM | System only |
| Patent filings | RESTRICTED | Perpetual | AES-256 + HSM | CEO, Legal |
| CSL source code | RESTRICTED | Perpetual | AES-256 | Core eng only |
| AI interaction history | CONFIDENTIAL | fib(11)=89d | AES-256 | User + compliance |
| Audit chain | CONFIDENTIAL | fib(13)=233d | AES-256 | Compliance + auditors |
| Usage logs | CONFIDENTIAL | fib(11)=89d | AES-256 (Redis) | Ops + security |
| Financial records | CONFIDENTIAL | fib(15)=610d | AES-256 | Finance + compliance |
| Consent records | CONFIDENTIAL | fib(15)=610d | AES-256 | Compliance + user |
| Public docs | PUBLIC | N/A | TLS only | Everyone |
| Marketing content | PUBLIC | N/A | TLS only | Everyone |

---

## 4. CLASSIFICATION WORKFLOWS

### 4.1 Data Ingestion Classification
All data entering HeadyOS through APIs is automatically classified by the input validator (8-pattern scanner). Classification is stored as metadata on the data object.

```
Data Ingress
    ↓
Input Validator (8 patterns)
    ↓
CSL Router (classification check)
    ↓
Automatic metadata tagging: { classification: 'CONFIDENTIAL', sensitivity: 0.618 }
    ↓
Storage with appropriate encryption tier
```

### 4.2 Reclassification
Data may only be reclassified upward (e.g., INTERNAL → CONFIDENTIAL) without special approval.  
Reclassification downward requires written approval from the DPO and CEO, and must be logged in the audit chain.

### 4.3 Data Residency
- **PUBLIC**: Any geographic location
- **INTERNAL**: US or EU data centers only (GCP regions)
- **CONFIDENTIAL**: US or EU only; cross-border transfer requires SCC/IDTA
- **RESTRICTED**: US only (GCP us-central1); no cross-border transfer

---

## 5. HANDLING BY LIFECYCLE STAGE

| Lifecycle Stage | PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED |
|-----------------|--------|----------|--------------|------------|
| Creation | No controls | Authentication | AES-256 + access log | HSM + alert + auth |
| Storage | Any | GCP storage | GCP encrypted + KMS | GCP HSM + dedicated project |
| Transmission | HTTP/TLS | TLS 1.3 | TLS 1.3 + e2e | TLS 1.3 + e2e + VPN |
| Access | Anyone | SSO | RBAC + MFA | Named + MFA + CEO approval |
| Copying/Export | Unrestricted | Log action | Log + authorize | Prohibited by default |
| Disposal | Delete | Delete | Crypto-erase | Multi-pass erase + certificate |
| Audit | None | Annual | Quarterly | Continuous (real-time alert) |

---

## 6. RESPONSIBILITY MATRIX (RACI)

| Activity | CEO/Founder | DPO | Engineering | Legal | Compliance |
|----------|------------|-----|-------------|-------|------------|
| Set classification policy | A | R | C | C | C |
| Classify new data types | C | A | R | C | C |
| Implement access controls | I | C | A/R | I | C |
| Data breach response | A | R | R | C | R |
| Quarterly review | A | R | C | C | R |
| Audit evidence | I | C | R | I | A |

*A=Accountable, R=Responsible, C=Consulted, I=Informed*

---

## 7. REGULATORY MAPPING

| Classification | GDPR Relevance | CCPA Relevance | SOC 2 TSC |
|---------------|----------------|----------------|-----------|
| PUBLIC | N/A | N/A | N/A |
| INTERNAL | Not personal data | Not personal information | CC2, CC5 |
| CONFIDENTIAL | Personal data (Art. 4) | Personal information (§ 1798.140) | CC6, CC7, C1, P1-P8 |
| RESTRICTED | Special categories (Art. 9) or high risk | Sensitive PI (§ 1798.121) | CC6.7, C1.1, CC6.1 |

---

## 8. INCIDENT RESPONSE FOR DATA EXPOSURE

If CONFIDENTIAL or RESTRICTED data is suspected to be exposed:

1. **Immediate** (T+0): Isolate affected system component; notify security@headyme.com
2. **T+4h**: CSL classification of incident severity (using φ-based thresholds)
3. **T+24h**: Internal incident report; identify affected data subjects
4. **T+72h**: GDPR breach notification to Controller/Supervisory Authority (if applicable)
5. **T+fib(7)=13 days**: Full root cause analysis and remediation report
6. **T+fib(8)=21 days**: Updated controls implemented; lessons learned documented

---

*Document ID: HSI-DC-2026-004 | HeadySystems Inc. | dpo@headyme.com*
