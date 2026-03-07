# HIPAA Security Risk Assessment
## HeadyMe Platform — Security Rule Compliance Checklist

**Version:** 1.0  
**Assessment Date:** [ASSESSMENT_DATE]  
**Assessor:** [ASSESSOR_NAME], [TITLE]  
**Review Period:** [START_DATE] to [END_DATE]  
**Next Assessment Due:** [NEXT_DATE] (annual minimum)

**Risk Scoring:** Likelihood (1-5) × Impact (1-5) = Risk Score  
**Risk Levels:** Low (1-8) | Medium (9-14) | High (15-19) | Critical (20-25)

---

## SECTION 1 — ADMINISTRATIVE SAFEGUARDS (§164.308)

### 1.1 Security Management Process (§164.308(a)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.1.1 | Risk Analysis — Conduct accurate and thorough assessment of potential risks and vulnerabilities to ePHI | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.1.2 | Risk Management — Implement security measures sufficient to reduce risks to a reasonable and appropriate level | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.1.3 | Sanction Policy — Apply appropriate sanctions against workforce members who fail to comply with security policies | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.1.4 | Information System Activity Review — Regularly review records of information system activity (audit logs, access reports, security incident tracking) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- Risk Analysis: Annual assessment per this document + continuous monitoring via `security-bee.js`
- Risk Management: Tracked in GitHub Issues with severity labels
- Sanction Policy: Documented in `/docs/policies/workforce-sanctions.md`
- Activity Review: Automated via `hipaa-audit-controls.js` with weekly log review cadence

---

### 1.2 Assigned Security Responsibility (§164.308(a)(2)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.2.1 | Identify the security official responsible for developing and implementing security policies and procedures | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Current HIPAA Security Officer:** [NAME], [EMAIL]  
**Backup/Deputy:** [NAME], [EMAIL]  
**Last Reviewed:** [DATE]

---

### 1.3 Workforce Security (§164.308(a)(3)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.3.1 | Authorization and/or Supervision — Implement procedures for authorization/supervision of workforce members who work with ePHI | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.3.2 | Workforce Clearance Procedure — Implement procedures to determine that workforce members have appropriate access to ePHI (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.3.3 | Termination Procedures — Implement procedures for terminating access to ePHI when employment ends (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- Access provisioning: RBAC via `auth-rbac.js` with role assignments in PostgreSQL
- Clearance: Background checks for all employees with PHI access
- Termination: Automated deprovisioning workflow (≤4 hours of termination)

---

### 1.4 Information Access Management (§164.308(a)(4)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.4.1 | Isolating Healthcare Clearinghouse Function — If part of a larger organization, isolate healthcare clearinghouse functions (Required if applicable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.4.2 | Access Authorization — Implement policies and procedures for granting access to ePHI (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.4.3 | Access Establishment and Modification — Implement policies and procedures that establish, document, review, and modify access rights (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- Minimum necessary enforced: `hipaa-access-controls.js` → `enforceMinimumNecessary()`
- Access reviews: Quarterly via `soc2-evidence-collector.js`

---

### 1.5 Security Awareness and Training (§164.308(a)(5)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.5.1 | Security Reminders — Periodic security updates to workforce members (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.5.2 | Protection from Malicious Software — Procedures for guarding against, detecting, and reporting malicious software (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.5.3 | Log-in Monitoring — Procedures for monitoring log-in attempts and reporting discrepancies (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.5.4 | Password Management — Procedures for creating, changing, and safeguarding passwords (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.5.5 | Annual HIPAA Training — All workforce members with PHI access complete annual training | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Training Records Location:** [LMS_LINK]  
**Last Training Date:** [DATE]  
**Completion Rate:** [X]%

---

### 1.6 Security Incident Procedures (§164.308(a)(6)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.6.1 | Response and Reporting — Identify and respond to suspected or known security incidents; mitigate harmful effects; document incidents and outcomes | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Incident Response Plan:** `/compliance-templates/soc2/soc2-incident-response.md`  
**Last Tabletop Exercise:** [DATE]  
**Breach Notification Trigger:** Automated via `hipaa-audit-controls.js` → `triggerBreachNotification()`

---

### 1.7 Contingency Plan (§164.308(a)(7)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.7.1 | Data Backup Plan — Establish procedures to create and maintain retrievable exact copies of ePHI (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.7.2 | Disaster Recovery Plan — Establish procedures to restore any loss of data (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.7.3 | Emergency Mode Operation Plan — Establish procedures to enable continuation of critical business processes while operating in emergency mode (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.7.4 | Testing and Revision Procedures — Implement procedures for periodic testing and revision of contingency plans (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.7.5 | Applications and Data Criticality Analysis — Assess relative criticality of specific applications and data in support of contingency plan (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**RTO Target:** [X] hours  
**RPO Target:** [X] hours  
**Last DR Test:** [DATE]  
**Next DR Test:** [DATE]

---

### 1.8 Evaluation (§164.308(a)(8)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.8.1 | Perform periodic technical and non-technical evaluation in response to environmental or operational changes | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Last Technical Evaluation:** [DATE]  
**Penetration Test Vendor:** [VENDOR]  
**Last Pen Test Date:** [DATE]

---

### 1.9 Business Associate Contracts (§164.308(b)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 1.9.1 | Written contract or agreement with each business associate | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 1.9.2 | BAA executed before PHI is shared | ☐ Compliant ☐ Gap ☐ N/A | | | |

**BAA Register:** [LINK_TO_CONTRACT_TRACKER]

---

## SECTION 2 — PHYSICAL SAFEGUARDS (§164.310)

### 2.1 Facility Access Controls (§164.310(a)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 2.1.1 | Contingency Operations — Procedures to allow facility access in support of restoration of lost data under the disaster recovery plan (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.1.2 | Facility Security Plan — Policies and procedures to safeguard the facility and equipment therein from unauthorized physical access, tampering, and theft (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.1.3 | Access Control and Validation Procedures — Validate the access of persons operating in sensitive areas (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.1.4 | Maintenance Records — Document repairs and modifications to the physical components of a facility (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Note:** HeadyMe operates as a cloud-native platform. Physical infrastructure is managed by [CLOUD_PROVIDER] under their SOC2/ISO 27001 certifications. Physical safeguard responsibility is contractually delegated per BAA with cloud provider.

**Cloud Provider Physical Controls Evidence:** [LINK_TO_PROVIDER_ATTESTATIONS]

---

### 2.2 Workstation Use (§164.310(b)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 2.2.1 | Specify proper functions performed, physical attributes of surroundings of workstations accessing ePHI | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Policy Reference:** `/docs/policies/acceptable-use.md`

---

### 2.3 Workstation Security (§164.310(c)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 2.3.1 | Physical safeguards for all workstations that access ePHI to restrict access to authorized users | ☐ Compliant ☐ Gap ☐ N/A | | | |

**Endpoint Controls:** Full-disk encryption (BitLocker/FileVault), MDM enrollment required

---

### 2.4 Device and Media Controls (§164.310(d)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 2.4.1 | Disposal — Implement policies and procedures to address final disposition of ePHI and media on which it is stored (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.4.2 | Media Re-use — Implement procedures for removal of ePHI from media before reuse (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.4.3 | Accountability — Maintain a record of movements of hardware and electronic media and any person responsible therefore (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 2.4.4 | Data Backup and Storage — Create a retrievable exact copy of ePHI before movement of equipment (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

---

## SECTION 3 — TECHNICAL SAFEGUARDS (§164.312)

### 3.1 Access Control (§164.312(a)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 3.1.1 | Unique User Identification — Assign a unique name and/or number for identifying and tracking user identity (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 3.1.2 | Emergency Access Procedure — Establish procedures for obtaining necessary ePHI during emergency (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 3.1.3 | Automatic Logoff — Implement electronic procedures that terminate an electronic session after predetermined time of inactivity (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 3.1.4 | Encryption and Decryption — Implement mechanism to encrypt and decrypt ePHI (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- Unique User IDs: UUID-based, enforced in PostgreSQL schema
- Emergency Access: `hipaa-access-controls.js` → `breakGlass()` with mandatory audit trail
- Automatic Logoff: 15-minute idle timeout enforced in `hipaa-access-controls.js`
- Encryption: AES-256-GCM via `hipaa-access-controls.js` → `encryptPHI()`/`decryptPHI()`

---

### 3.2 Audit Controls (§164.312(b)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 3.2.1 | Implement hardware, software, and/or procedural mechanisms to record and examine activity in information systems that contain or use ePHI | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- PHI access logging: `hipaa-audit-controls.js` (who, what, when, where, why)
- Log integrity: SHA-256 hash chain from `audit-log.js`
- Retention: 6 years enforced via retention scheduler
- Review cadence: Automated alerts + weekly manual review

---

### 3.3 Integrity (§164.312(c)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 3.3.1 | Authentication mechanism to corroborate that ePHI has not been altered or destroyed in an unauthorized manner (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:** SHA-256 checksums on all ePHI records; hash-chain audit log verifies integrity

---

### 3.4 Person or Entity Authentication (§164.312(d)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 3.4.1 | Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:** SSO + SAML/OIDC via `auth-rbac.js`; MFA required for all PHI-touching roles

---

### 3.5 Transmission Security (§164.312(e)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 3.5.1 | Encryption — Implement security measure to guard against unauthorized access to ePHI transmitted over electronic communications network (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 3.5.2 | Integrity Controls — Implement security measures to ensure electronically transmitted ePHI is not improperly modified without detection (Addressable) | ☐ Compliant ☐ Gap ☐ N/A | | | |

**HeadyMe Implementation:**
- TLS 1.3 enforced via `security-headers.js` HSTS header
- No ePHI in query parameters or URL paths
- All ePHI transmission logged with source/destination

---

## SECTION 4 — ORGANIZATIONAL REQUIREMENTS (§164.314)

### 4.1 Business Associate Contracts and Other Arrangements (§164.314(a)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 4.1.1 | Contract with business associate must meet requirements of §164.314(a)(2) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 4.1.2 | Other arrangements — if both are government entities, may use memo of understanding | ☐ Compliant ☐ Gap ☐ N/A | | | |

---

## SECTION 5 — POLICIES, PROCEDURES AND DOCUMENTATION (§164.316)

### 5.1 Policies and Procedures (§164.316(a)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 5.1.1 | Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, or other requirements of the Security Rule | ☐ Compliant ☐ Gap ☐ N/A | | | |

---

### 5.2 Documentation (§164.316(b)(1)) — REQUIRED

| Item | Requirement | Status | Finding | Risk | Remediation |
|------|-------------|--------|---------|------|-------------|
| 5.2.1 | Maintain written documentation of policies and procedures (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 5.2.2 | Time limit — Retain documentation for 6 years from date of creation or last effective date (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 5.2.3 | Availability — Make documentation available to those responsible for implementing procedures (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |
| 5.2.4 | Updates — Review and update documentation periodically (Required) | ☐ Compliant ☐ Gap ☐ N/A | | | |

---

## SECTION 6 — RISK REGISTER

### Current Risk Items

| Risk ID | Category | Description | Likelihood | Impact | Risk Score | Level | Owner | Remediation | Due Date | Status |
|---------|----------|-------------|-----------|--------|------------|-------|-------|-------------|----------|--------|
| R-001 | Access Control | Privileged user insider threat — unauthorized PHI access | 2 | 5 | 10 | Medium | Security Officer | Role-based access + break-glass audit | [DATE] | Open |
| R-002 | Technical | Unencrypted ePHI in application logs | 3 | 5 | 15 | High | Engineering Lead | Log scrubbing in audit-log.js | [DATE] | Open |
| R-003 | Third-Party | Subcontractor BA lacks adequate security controls | 2 | 4 | 8 | Low | Legal | Annual BA security review | [DATE] | Open |
| R-004 | Physical | Cloud provider physical breach | 1 | 5 | 5 | Low | Engineering Lead | Provider-level control; attestations reviewed | [DATE] | Accepted |
| R-005 | Operational | Insufficient workforce HIPAA training | 3 | 3 | 9 | Medium | HR | Annual training program | [DATE] | Open |
| R-006 | Technical | Session hijacking via stolen tokens | 2 | 4 | 8 | Low | Engineering Lead | Short-lived JWTs + 15min session timeout | [DATE] | Mitigated |
| R-007 | Operational | Breach not detected within 60-day window | 2 | 5 | 10 | Medium | Security Officer | Automated breach detection in audit-controls | [DATE] | Open |

---

## SECTION 7 — ASSESSMENT SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| HIPAA Security Officer | | | |
| Chief Technology Officer | | | |
| Legal Counsel | | | |
| Executive Sponsor | | | |

**Next Risk Assessment Scheduled:** [DATE]  
**Assessment Methodology Reference:** NIST SP 800-30 Rev. 1; HHS Security Risk Assessment Tool v3.x

---

*This risk assessment template complies with 45 C.F.R. § 164.308(a)(1)(ii)(A). Completing this checklist does not guarantee HIPAA compliance. Consult qualified healthcare compliance counsel.*
