# Data Processing Agreement (DPA)
**Aligned with GDPR Article 28 | HeadySystems Inc.**

Version: 1.0.0  
Effective Date: 2026-03-01  
Last Reviewed: 2026-03-07

---

## PARTIES

**Data Controller** ("Controller"):  
The customer entity identified in the accompanying Master Services Agreement or Order Form, having its principal place of business as specified therein.

**Data Processor** ("Processor"):  
HeadySystems Inc. (DBA Heady™)  
Registered Address: [Registered Office Address]  
Contact: privacy@headyme.com  
DPO Contact: dpo@headyme.com  
Primary Service URL: https://headyme.com

---

## RECITALS

WHEREAS, Controller wishes to use the HeadyOS platform, HeadyMe AI services, and associated microservices (collectively, "Services") provided by Processor;

WHEREAS, in the course of providing the Services, Processor may process Personal Data on behalf of Controller as a data processor within the meaning of the GDPR;

WHEREAS, both parties seek to ensure compliance with applicable data protection laws, including Regulation (EU) 2016/679 ("GDPR"), UK GDPR, and other applicable privacy legislation;

NOW THEREFORE, the parties agree to the following terms:

---

## 1. DEFINITIONS

1.1 **"Applicable Data Protection Law"** means GDPR, UK GDPR, CCPA/CPRA, and any other national or regional data protection laws applicable to the processing of Personal Data hereunder.

1.2 **"Controller"** has the meaning given under Article 4(7) GDPR.

1.3 **"Data Subject"** means an identified or identifiable natural person as defined under Article 4(1) GDPR.

1.4 **"Personal Data"** means any information relating to a Data Subject, as defined in Article 4(1) GDPR.

1.5 **"Personal Data Breach"** means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Personal Data.

1.6 **"Processing"** has the meaning given under Article 4(2) GDPR.

1.7 **"Processor"** has the meaning given under Article 4(8) GDPR.

1.8 **"Services"** means the HeadyOS platform, HeadyMe AI (headyme.com), multi-agent orchestration services (Heady Conductor), vector memory services, and all associated APIs and microservices.

1.9 **"Special Categories of Personal Data"** means personal data as defined in Article 9(1) GDPR.

1.10 **"Sub-processor"** means any processor engaged by Processor who agrees to receive Personal Data from Processor for processing activities to be carried out on behalf of Controller.

1.11 **"Supervisory Authority"** means the competent supervisory authority under Applicable Data Protection Law.

---

## 2. PROCESSING DETAILS

### 2.1 Subject Matter and Duration
The subject matter of the processing is the provision of HeadyOS Services as described in the applicable Master Services Agreement. Processing shall occur for the duration of the Services and until completion of post-termination deletion obligations.

### 2.2 Nature and Purpose of Processing
Processor processes Personal Data for the following purposes:

| Purpose | Legal Basis (GDPR Art. 6) | Retention |
|---------|---------------------------|-----------|
| Account management and authentication | Art. 6(1)(b) Contract | Duration of account + fib(13)=233 days |
| AI model inference and brain services | Art. 6(1)(b) Contract | Session + fib(9)=34 days |
| Vector memory storage and semantic search | Art. 6(1)(b) Contract | Per tenant config (default fib(13)=233 days) |
| Multi-agent orchestration (Heady Conductor) | Art. 6(1)(b) Contract | Task lifetime + fib(11)=89 days |
| Security, fraud prevention, audit logging | Art. 6(1)(f) Legitimate Interest | fib(13)=233 days |
| Analytics and service improvement | Art. 6(1)(a) Consent | fib(11)=89 days |
| Billing and financial records | Art. 6(1)(c) Legal Obligation | fib(15)=610 days |

### 2.3 Categories of Data Subjects
- Controller's employees, contractors, and authorized users
- End users of applications built on HeadyOS
- API consumers and integration users

### 2.4 Categories of Personal Data
- **Account Data**: name, email address, organization, role, authentication credentials (hashed)
- **Usage Data**: API call logs, feature usage metrics, session metadata
- **AI Interaction Data**: messages, prompts, AI-generated responses, conversation history
- **Vector Memory Data**: semantic embeddings, memory keys, associated metadata
- **Agent Configuration Data**: agent names, capability settings, workflow definitions
- **Technical Data**: IP addresses, device identifiers, browser/client metadata
- **Billing Data**: payment method metadata (tokenized), billing address, invoice history

### 2.5 Special Categories
Processor does not intentionally process Special Categories of Personal Data. Controller shall not submit Special Categories to the Services without explicit written agreement and additional safeguards.

---

## 3. PROCESSOR OBLIGATIONS

### 3.1 Instructions
Processor shall process Personal Data only on documented instructions from Controller, including for international transfers, unless required by applicable law. Processor shall promptly inform Controller if, in Processor's opinion, an instruction infringes Applicable Data Protection Law.

### 3.2 Confidentiality
Processor shall ensure that persons authorized to process Personal Data are subject to appropriate confidentiality obligations.

### 3.3 Security
Processor shall implement appropriate technical and organizational measures as specified in Section 5 (Data Security Measures).

### 3.4 Sub-processors
Processor shall comply with the requirements in Section 4 (Sub-Processors) and not engage Sub-processors without prior general or specific written authorization from Controller.

### 3.5 Data Subject Rights
Processor shall assist Controller in fulfilling its obligations to respond to Data Subject rights requests, including:
- Access (Article 15 GDPR)
- Rectification (Article 16 GDPR)
- Erasure (Article 17 GDPR)
- Restriction (Article 18 GDPR)
- Data Portability (Article 20 GDPR)
- Objection (Article 21 GDPR)

Assistance shall be provided via the automated DSAR handler at `/api/v1/dsar` and within the 30-day compliance window. See `compliance/gdpr/dsar-handler.js`.

### 3.6 Deletion
Upon termination of Services, Processor shall, at Controller's choice, delete or return all Personal Data within fib(9)=34 calendar days and certify such deletion in writing.

### 3.7 Audit Cooperation
Processor shall make available all information necessary to demonstrate compliance with Article 28 GDPR obligations, including access for audits as specified in Section 7.

---

## 4. SUB-PROCESSORS

### 4.1 Authorized Sub-Processors

| Sub-Processor | Service | Location | Safeguard |
|---------------|---------|----------|-----------|
| Google Cloud (GCP) | Cloud Run compute, Cloud Storage, Cloud SQL | US, EU | SCC + DPA |
| Cloudflare, Inc. | CDN, Workers, Zero Trust | US, EU | DPA |
| Redis Ltd. | In-memory data store | US | DPA |
| Neon, Inc. | Serverless PostgreSQL (pgvector) | US | DPA |
| Sentry, Inc. | Error monitoring and observability | US | SCC + DPA |
| OpenAI, L.P. | AI model inference (optional, tenant-configured) | US | DPA |
| Anthropic, PBC | AI model inference (optional, tenant-configured) | US | DPA |
| Stripe, Inc. | Payment processing | US | DPA |
| SendGrid (Twilio) | Transactional email | US | DPA |

### 4.2 Changes to Sub-Processors
Processor shall notify Controller of any intended changes to Sub-processors at least fib(7)=13 calendar days in advance via email to the designated Controller contact. Controller may object within fib(6)=8 calendar days of such notice.

### 4.3 Sub-Processor Obligations
Processor shall impose data protection terms on each Sub-processor that provide at least equivalent protections as this DPA.

---

## 5. DATA SECURITY MEASURES

Pursuant to Article 32 GDPR, Processor maintains the following technical and organizational security measures:

### 5.1 Technical Measures

**Encryption:**
- Encryption at rest: AES-256-GCM for all stored Personal Data
- Encryption in transit: TLS 1.3 minimum for all data transmission
- Database encryption: pgvector data encrypted at column level
- Backup encryption: AES-256 with separate key management (Google KMS)

**Access Control:**
- RBAC with JWT capability bitmask (see `src/security/`)
- Zero-Trust network architecture via Cloudflare
- Multi-factor authentication required for administrative access
- Privileged access management with session recording
- Principle of least privilege enforced via 4-layer rate limiter

**Monitoring and Logging:**
- SHA-256 chained audit logging (tamper-evident, see `src/security/audit-logger.js`)
- OpenTelemetry-based distributed tracing
- Real-time security event monitoring via Sentry
- Structured JSON logs with retention per Fibonacci schedule
- DAST/SAST pipelines in CI/CD (`.github/workflows/`)

**Data Isolation:**
- Tenant-level data isolation with namespaced Redis keys
- Separate pgvector collections per tenant
- Container-level isolation via Google Cloud Run

**Vulnerability Management:**
- OWASP Top 10 threat modeling (see `docs/threat-model.md`)
- Dependency scanning via GitHub Actions (`dependency-check.yml`, `dependency-review.yml`)
- Container scanning (`container-scan.yml`)
- Secret scanning (`secret-scanning.yml`)
- Regular penetration testing

### 5.2 Organizational Measures
- Information security policy and procedures
- Security awareness training for all personnel with access to Personal Data
- Background checks for personnel in sensitive roles
- Incident response plan with defined escalation paths
- Business continuity and disaster recovery procedures
- Annual security review and assessment

---

## 6. PERSONAL DATA BREACH NOTIFICATION

### 6.1 Notification Timeline
Processor shall notify Controller without undue delay and, where feasible, within **72 hours** of becoming aware of a Personal Data Breach, as required by Article 33 GDPR.

### 6.2 Notification Contents
Initial notification shall include, to the extent available:
- Nature of the breach (categories and approximate number of Data Subjects and records affected)
- Contact details of the DPO or other point of contact (dpo@headyme.com)
- Likely consequences of the breach
- Measures taken or proposed to address the breach

### 6.3 Notification Method
Initial notification: security@headyme.com (automated) + phone call to Controller's designated security contact  
Written follow-up: Within fib(7)=13 calendar days with full incident report

### 6.4 Incident Response
Processor maintains a documented incident response procedure:
1. **Detection** (T+0): Automated alerting via Sentry/OpenTelemetry
2. **Assessment** (T+0 to T+4h): Severity classification per CSL framework
3. **Containment** (T+0 to T+8h): Automated circuit breakers + manual intervention
4. **Notification** (T+0 to T+72h): Controller notification per Article 33
5. **Remediation** (T+72h onward): Root cause analysis and fix
6. **Post-Incident Review** (T+fib(8)=21 days): Full incident report

---

## 7. AUDIT RIGHTS

### 7.1 Controller Audit Rights
Controller or a mandated auditor (subject to confidentiality obligations) has the right to audit Processor's compliance with this DPA upon:
- Reasonable written notice of at least fib(6)=8 business days
- During normal business hours (9am-5pm Pacific)
- No more than once per calendar year absent a specific compliance concern
- At Controller's own cost

### 7.2 Audit Scope
Audits may cover:
- Security policies and procedures documentation
- Access control records and logs
- Sub-processor agreements
- Training records
- Incident logs
- Automated evidence package from `compliance/soc2/evidence-collector.js`

### 7.3 Processor Cooperation
Processor shall cooperate fully with audits and provide all reasonably requested documentation. Processor may use SOC 2 Type II reports, ISO 27001 certificates, or equivalent third-party audits as a substitute for Controller audits where appropriate.

---

## 8. CROSS-BORDER DATA TRANSFERS

### 8.1 EEA Transfers
Where Personal Data is transferred from the EEA to a third country not recognized as providing adequate protection, such transfers shall be governed by:
- Standard Contractual Clauses (SCCs) as adopted by the European Commission Decision 2021/914
- Module 2 (Controller-to-Processor) applies to transfers between Controller and HeadySystems
- Module 3 (Processor-to-Processor) applies to Sub-processor transfers

### 8.2 UK Transfers
For transfers from the UK, the UK International Data Transfer Agreement (IDTA) or UK Addendum to EU SCCs applies.

### 8.3 Additional Safeguards
- Technical measures: end-to-end encryption, pseudonymization where possible
- Organizational measures: contractual limitations on government access
- Transparency report published at headyme.com/legal/transparency

### 8.4 Transfer Impact Assessment
Processor maintains Transfer Impact Assessments (TIAs) for all third-country transfers, available to Controller upon request.

---

## 9. TERMINATION

### 9.1 Survival
This DPA shall survive termination of the underlying Master Services Agreement for the period necessary to complete deletion obligations.

### 9.2 Post-Termination Obligations
Upon termination of the Services Agreement:
1. Controller may request data export within fib(9)=34 days of termination
2. Processor shall delete all Personal Data within fib(9)=34 days of Controller's instruction or expiry of export window
3. Processor shall provide written certification of deletion within fib(7)=13 days of completion
4. Backup deletion: encrypted backups rotated out within fib(11)=89 days

### 9.3 Deletion Standards
Deletion shall comply with NIST SP 800-88 Rev. 1 (Guidelines for Media Sanitization) using cryptographic erasure for cloud storage.

---

## 10. GENERAL PROVISIONS

### 10.1 Entire Agreement
This DPA forms part of and is incorporated into the Master Services Agreement between the parties. In case of conflict, this DPA governs for matters related to data processing.

### 10.2 Amendment
Processor may update this DPA to reflect changes in law or regulatory guidance, providing Controller with fib(7)=13 days' notice.

### 10.3 Governing Law
This DPA is governed by the laws of the State of Delaware, USA, without prejudice to mandatory protections under GDPR.

### 10.4 Liability
Each party's liability under this DPA is subject to the limitations set forth in the Master Services Agreement.

### 10.5 Precedence
In the event of a conflict between this DPA and the SCCs, the SCCs shall prevail with respect to international transfers.

---

## EXHIBIT A: STANDARD CONTRACTUAL CLAUSES

[Standard Contractual Clauses (EU Commission Decision 2021/914, Module 2) are incorporated by reference and available at headyme.com/legal/scc]

---

## EXHIBIT B: TECHNICAL AND ORGANIZATIONAL MEASURES

[Full TOM document available at headyme.com/legal/tom — summarized in Section 5 above]

---

## EXHIBIT C: APPROVED SUB-PROCESSORS

[See Section 4.1 above. Current list maintained at headyme.com/legal/sub-processors]

---

## SIGNATURES

**On behalf of Data Controller:**

Signature: _______________________  
Name: _______________________  
Title: _______________________  
Date: _______________________

**On behalf of Data Processor (HeadySystems Inc.):**

Signature: _______________________  
Name: Eric Headington  
Title: Chief Executive Officer  
Date: _______________________  
Email: eric@headyconnection.org

---

*Document ID: HSI-DPA-2026-001 | HeadySystems Inc. | headyme.com | privacy@headyme.com*
