# SOC 2 Type II Controls Matrix
## HeadyMe Platform — Trust Services Criteria Mapping

**Version:** 1.0  
**Audit Period:** [START_DATE] to [END_DATE]  
**Service Auditor:** [AUDITOR_FIRM]  
**Applicable TSC:** Security (required) + [Availability / Confidentiality / Processing Integrity / Privacy]  
**Last Updated:** [DATE]  
**Controls Owner:** [CISO / Engineering Lead]

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Implemented | Control implemented and operating effectively |
| ⚠️ In Progress | Implementation underway |
| ❌ Gap | Control not yet implemented |
| N/A | Not applicable to HeadyMe environment |

| Evidence Type | Code |
|---|---|
| Policy/Procedure Document | POL |
| Configuration/Code | CFG |
| Screenshot/Log | LOG |
| Audit Report | RPT |
| Interview/Attestation | INT |

---

## CC1 — Control Environment

### CC1.1 — COSO Principle 1: Organization Demonstrates Commitment to Integrity and Ethical Values

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC1.1.1 | Code of conduct and ethics policy exists and is communicated to all personnel | ✅ | `CODE_OF_CONDUCT.md` in root repo; all employees acknowledge annually | POL | `/CODE_OF_CONDUCT.md` | HR system |
| CC1.1.2 | Security policies are documented and approved by management | ✅ | Security policies in `/docs/policies/`; reviewed annually | POL | `/docs/policies/` | Policy repo |
| CC1.1.3 | Tone at the top — executive commitment to security culture documented | ✅ | Executive security charter; quarterly board security briefings | INT | Board meeting minutes | Legal vault |

### CC1.2 — COSO Principle 2: Board Exercises Oversight Responsibility

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC1.2.1 | Board or equivalent oversight of security program | ✅ | Security committee meets quarterly; reviews risk register | INT | Board charter | Legal vault |
| CC1.2.2 | Risk oversight includes cybersecurity and data privacy | ✅ | Risk register reviewed at each board meeting | RPT | `/compliance-templates/hipaa/hipaa-risk-assessment.md` | Board materials |

### CC1.3 — COSO Principle 3: Management Establishes Structure, Authority, and Responsibility

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC1.3.1 | Organizational chart with defined security roles | ✅ | Org chart with CISO, DPO, Security Officer roles defined | POL | HR system | HR system |
| CC1.3.2 | RACI matrix for security responsibilities | ✅ | RACI documented per security domain | POL | `/docs/policies/raci-security.md` | Confluence |

### CC1.4 — COSO Principle 4: Demonstrates Commitment to Competence

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC1.4.1 | Security training and awareness program | ✅ | Annual security training; role-based additional training | LOG | LMS completion records | HR/LMS |
| CC1.4.2 | Background checks for employees with access to sensitive systems | ✅ | Background checks for all engineering and ops personnel | POL | `/docs/policies/hiring-security.md` | HR system |

### CC1.5 — COSO Principle 5: Enforces Accountability

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC1.5.1 | Performance metrics include security KPIs | ⚠️ | Security KPIs defined; integration with performance reviews in progress | POL | `/docs/policies/security-kpis.md` | Confluence |
| CC1.5.2 | Sanction policy for security violations | ✅ | Progressive discipline policy covers security incidents | POL | `/docs/policies/workforce-sanctions.md` | HR system |

---

## CC2 — Communication and Information

### CC2.1 — Uses Relevant, Quality Information

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC2.1.1 | Information systems capture and process relevant security data | ✅ | OpenTelemetry tracing + structured logging captures all security events | CFG | `src/lib/telemetry.js`, `src/middleware/audit-log.js` | Application |
| CC2.1.2 | Security dashboards and reporting are current and accurate | ✅ | Real-time dashboards; automated evidence via `soc2-evidence-collector.js` | LOG | `soc2-evidence-collector.js` | Monitoring |

### CC2.2 — Communicates Internally

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC2.2.1 | Security incidents are communicated to appropriate personnel | ✅ | PagerDuty alerting; incident response process in `soc2-incident-response.md` | POL | `/compliance-templates/soc2/soc2-incident-response.md` | PagerDuty |
| CC2.2.2 | Security policies distributed and acknowledged | ✅ | Annual acknowledgment via HR system | LOG | HR acknowledgment records | HR system |

### CC2.3 — Communicates Externally

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC2.3.1 | Security commitments communicated to customers (trust page, DPA) | ✅ | Trust page at headysystems.com/trust; DPA template | POL | `/compliance-templates/` | Website |
| CC2.3.2 | Vulnerability disclosure policy published | ✅ | `SECURITY.md` in all repos; responsible disclosure process | POL | `/.github/SECURITY.md` | GitHub |
| CC2.3.3 | Breach notification process for customers | ✅ | Defined in `soc2-incident-response.md`; SLA commitments in DPA | POL | `/compliance-templates/soc2/soc2-incident-response.md` | DPA |

---

## CC3 — Risk Assessment

### CC3.1 — Specifies Objectives

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC3.1.1 | Security objectives are defined and aligned to business goals | ✅ | Security roadmap aligned to product roadmap; reviewed quarterly | POL | `/docs/security-roadmap.md` | Confluence |

### CC3.2 — Identifies and Analyzes Risk

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC3.2.1 | Annual risk assessment process | ✅ | Annual HIPAA risk assessment; SOC2 risk register | RPT | `/compliance-templates/hipaa/hipaa-risk-assessment.md` | Risk register |
| CC3.2.2 | Threat modelling for new features/infrastructure | ⚠️ | Threat model template exists; application in feature process in progress | POL | `/docs/policies/threat-model.md` | Confluence |
| CC3.2.3 | Vendor/third-party risk assessment | ✅ | Vendor security questionnaires; DPA review for all data processors | POL | Vendor risk register | Security team |

### CC3.3 — Considers Fraud Risk

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC3.3.1 | Fraud risk included in risk assessment | ✅ | Fraud scenarios in risk register | RPT | Risk register | Security team |

### CC3.4 — Identifies Changes

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC3.4.1 | Significant changes trigger risk re-assessment | ✅ | Change management process; security review for significant changes | POL | `/docs/policies/change-management.md` | Confluence |

---

## CC4 — Monitoring Activities

### CC4.1 — Conducts Ongoing Evaluations

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC4.1.1 | Continuous security monitoring | ✅ | `src/bees/security-bee.js` + telemetry + anomaly detection | CFG | `src/bees/security-bee.js`, `src/lib/telemetry.js` | Application |
| CC4.1.2 | Automated vulnerability scanning | ✅ | GitHub Advanced Security + Dependabot; security-scan.yml workflow | CFG | `.github/workflows/security-scan.yml` | GitHub Actions |
| CC4.1.3 | Log review process | ✅ | Automated log alerts + weekly manual review; audit log via audit-log.js | LOG | `src/middleware/audit-log.js` | Log system |

### CC4.2 — Evaluates and Communicates Deficiencies

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC4.2.1 | Security deficiencies tracked in issue tracker | ✅ | GitHub Issues with security label; SLA by severity | LOG | GitHub Issues | GitHub |
| CC4.2.2 | Deficiencies communicated to responsible parties | ✅ | Automated GitHub assignees + PagerDuty | LOG | PagerDuty | PagerDuty |

---

## CC5 — Control Activities

### CC5.1 — Selects and Develops Controls

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC5.1.1 | Security controls selected based on risk assessment | ✅ | Controls mapped to risk register findings | RPT | Risk register | Security team |
| CC5.1.2 | Controls over technology include automation where possible | ✅ | IaC, automated security testing, automated compliance checks | CFG | `.github/workflows/` | GitHub |

### CC5.2 — Selects General Controls Over Technology

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC5.2.1 | Infrastructure as Code (IaC) for reproducibility | ✅ | Dockerfiles, CI/CD pipelines define infrastructure | CFG | `Dockerfile`, `.github/workflows/` | GitHub |
| CC5.2.2 | Security scanning integrated into CI/CD | ✅ | security-scan.yml runs on all PRs | CFG | `.github/workflows/security-scan.yml` | GitHub |

### CC5.3 — Deploys Controls Through Policies and Procedures

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC5.3.1 | Policies enforced through technical controls where possible | ✅ | RBAC, rate limiting, security headers enforced in code | CFG | `src/middleware/auth-rbac.js`, `security-middleware/` | Application |

---

## CC6 — Logical and Physical Access Controls

### CC6.1 — Logical Access Security Software

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.1.1 | User authentication requires strong credentials + MFA | ✅ | SSO + SAML/OIDC + MFA enforced via `auth-rbac.js` | CFG | `src/middleware/auth-rbac.js` | Application |
| CC6.1.2 | Role-based access control (RBAC) implemented | ✅ | Tenant-scoped RBAC in `auth-rbac.js`; roles defined per service | CFG | `src/middleware/auth-rbac.js` | Application |
| CC6.1.3 | Privileged access managed and limited | ✅ | Admin roles require MFA + approval; break-glass for emergency | CFG | `hipaa-access-controls.js` | Application |
| CC6.1.4 | Access to production requires VPN or jump box | ✅ | Production access requires VPN + SSH key | POL | `/docs/policies/prod-access.md` | Runbooks |
| CC6.1.5 | API authentication via API keys with RBAC | ✅ | API key management in `key-rotation.js`; tied to tenant/role | CFG | `src/lib/key-rotation.js` | Application |
| CC6.1.6 | Secrets management — no hardcoded credentials | ✅ | `.gitignore` hardened; environment-variable injection; key-rotation.js | CFG | `.gitignore`, `src/lib/key-rotation.js` | Application |

### CC6.2 — Prior to Issuing Access Credentials

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.2.1 | Access provisioned based on approved request | ✅ | Access provisioning workflow documented | POL | `/docs/policies/access-provisioning.md` | HR/IT |
| CC6.2.2 | Unique user accounts — shared accounts prohibited | ✅ | Enforced in auth system; no shared service accounts | CFG | `src/middleware/auth-rbac.js` | Application |

### CC6.3 — Registers and Authorizes Users

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.3.1 | User access reviews conducted quarterly | ✅ | Automated evidence collection via `soc2-evidence-collector.js` | LOG | `soc2-evidence-collector.js` | Access review records |
| CC6.3.2 | Terminated user access removed within 4 hours | ✅ | Automated deprovisioning on HR termination event | POL | `/docs/policies/offboarding.md` | HR system |

### CC6.6 — Logical Access Measures Against Threats

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.6.1 | Rate limiting and DDoS protection | ✅ | `rate-limiter-advanced.js` + circuit breaker | CFG | `security-middleware/rate-limiter-advanced.js`, `src/lib/circuit-breaker.js` | Application |
| CC6.6.2 | Security headers enforced | ✅ | CSP, HSTS, X-Frame-Options, COOP, COEP via `security-headers.js` | CFG | `security-middleware/security-headers.js` | Application |
| CC6.6.3 | Input validation and sanitisation | ✅ | XSS, SQLi, NoSQL injection prevention via `request-sanitizer.js` | CFG | `security-middleware/request-sanitizer.js` | Application |
| CC6.6.4 | Prompt injection protection for AI endpoints | ✅ | `prompt-guard.js` screens all LLM inputs | CFG | `src/security/prompt-guard.js` | Application |
| CC6.6.5 | Encryption at rest and in transit | ✅ | AES-256-GCM at rest; TLS 1.3 in transit; HSTS enforced | CFG | `security-middleware/security-headers.js`, `hipaa-access-controls.js` | Application |

### CC6.7 — Transmission and Movement of Information

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.7.1 | All data transmitted over TLS 1.2+ | ✅ | HSTS max-age=31536000 enforced; TLS 1.2 minimum | CFG | `security-middleware/security-headers.js` | Application |
| CC6.7.2 | CORS policy restricts cross-origin requests to approved domains | ✅ | `cors-policy.js` allowlist of heady* domains | CFG | `security-middleware/cors-policy.js` | Application |

### CC6.8 — Prevents Unauthorized Access

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC6.8.1 | Malware/vulnerability scanning on dependencies | ✅ | Dependabot + GitHub Advanced Security + npm audit in CI | CFG | `.github/workflows/security-scan.yml` | GitHub |

---

## CC7 — System Operations

### CC7.1 — Vulnerability and Configuration Management

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC7.1.1 | System configuration managed via IaC/GitOps | ✅ | All config in version control; no manual prod changes | CFG | GitHub repos | GitHub |
| CC7.1.2 | Dependency vulnerability scanning automated | ✅ | Dependabot PRs; security-scan.yml; npm audit | CFG | `.github/workflows/security-scan.yml` | GitHub |
| CC7.1.3 | Container image scanning | ✅ | Docker image scanning in CI pipeline | CFG | `.github/workflows/` | GitHub |

### CC7.2 — Monitors System Components

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC7.2.1 | System health monitoring with alerting | ✅ | OpenTelemetry + health dashboards; PagerDuty alerts | CFG | `src/lib/telemetry.js`, `src/monitoring/` | Monitoring |
| CC7.2.2 | Capacity monitoring and planning | ✅ | Resource metrics monitored; alerts on threshold breach | LOG | Monitoring dashboards | Monitoring |
| CC7.2.3 | Log aggregation and centralised storage | ✅ | Structured logs; immutable audit log via `audit-log.js` | CFG | `src/middleware/audit-log.js` | Log system |

### CC7.3 — Evaluates Security Events

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC7.3.1 | Security event detection and alerting | ✅ | `security-bee.js` + anomaly detection; PagerDuty integration | CFG | `src/bees/security-bee.js` | Application |
| CC7.3.2 | Incident classification and prioritisation | ✅ | Severity matrix in `soc2-incident-response.md` | POL | `/compliance-templates/soc2/soc2-incident-response.md` | Runbooks |

### CC7.4 — Responds to Security Incidents

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC7.4.1 | Incident response plan documented and tested | ✅ | `soc2-incident-response.md`; annual tabletop exercises | POL | `/compliance-templates/soc2/soc2-incident-response.md` | Runbooks |
| CC7.4.2 | Post-incident reviews documented | ✅ | PIR template in incident response plan | POL | `/compliance-templates/soc2/soc2-incident-response.md` | PIR records |

### CC7.5 — Identifies Security Deficiencies

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC7.5.1 | Penetration testing conducted annually | ✅ | Annual pen test by external firm; findings tracked | RPT | Pen test reports | Security vault |

---

## CC8 — Change Management

### CC8.1 — Authorizes, Designs, Develops, Implements Changes

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC8.1.1 | All changes require PR review and approval | ✅ | Branch protection rules; minimum 1 reviewer for main | CFG | `.github/branch-protection-rules.json`, branch protection settings | GitHub |
| CC8.1.2 | Security review required for changes touching auth/crypto/PHI | ✅ | CODEOWNERS includes security team for sensitive paths | CFG | `.github/CODEOWNERS` | GitHub |
| CC8.1.3 | Automated testing required before merge | ✅ | CI pipeline with tests, security scan, linting | CFG | `.github/workflows/` | GitHub |
| CC8.1.4 | Production deployments require explicit approval | ✅ | GitHub Environments with required reviewers | CFG | `.github/workflows/deploy.yml` | GitHub |
| CC8.1.5 | Change rollback plan required for significant changes | ✅ | Rollback procedure in deployment runbooks | POL | `/docs/runbooks/rollback.md` | Runbooks |

---

## CC9 — Risk Mitigation

### CC9.1 — Identifies and Assesses Risks

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC9.1.1 | Vendor risk management program | ✅ | Vendor security questionnaires; DPA register | POL | Vendor risk register | Security team |
| CC9.1.2 | Third-party access monitored and limited | ✅ | API key scoping; RBAC for integrations; `key-rotation.js` | CFG | `src/lib/key-rotation.js`, `src/middleware/auth-rbac.js` | Application |

### CC9.2 — Monitors Third-Party Risk

| Control ID | Control Description | Status | HeadyMe Implementation | Evidence Type | Code File / Config | Evidence Location |
|---|---|---|---|---|---|---|
| CC9.2.1 | Sub-processor/vendor security assessed annually | ✅ | Annual vendor security reviews; SOC2 reports collected | RPT | Vendor SOC2 reports | Security vault |
| CC9.2.2 | Business continuity plan exists for critical vendor failure | ✅ | Failover to backup providers via `failover.js` | CFG | `src/lib/failover.js` | Application |

---

## Controls Summary Dashboard

| Category | Total Controls | Implemented ✅ | In Progress ⚠️ | Gap ❌ |
|---|---|---|---|---|
| CC1 Control Environment | 9 | 8 | 1 | 0 |
| CC2 Communication | 6 | 6 | 0 | 0 |
| CC3 Risk Assessment | 6 | 5 | 1 | 0 |
| CC4 Monitoring | 5 | 5 | 0 | 0 |
| CC5 Control Activities | 6 | 6 | 0 | 0 |
| CC6 Access Controls | 16 | 16 | 0 | 0 |
| CC7 System Operations | 11 | 11 | 0 | 0 |
| CC8 Change Management | 5 | 5 | 0 | 0 |
| CC9 Risk Mitigation | 5 | 5 | 0 | 0 |
| **TOTAL** | **69** | **67** | **2** | **0** |

**Overall Readiness: 97% (67/69 controls implemented)**

---

## Evidence Collection Schedule

| Frequency | Controls | Collected By |
|-----------|---------|-------------|
| Continuous | CC4.1.1, CC6.6.1, CC7.2.1 | Automated (`soc2-evidence-collector.js`) |
| Daily | CC4.1.3, CC7.3.1 | Automated |
| Weekly | CC6.3.1, CC8.1.3 | Automated + Engineering |
| Monthly | CC9.2.1 | Security team |
| Quarterly | CC4.2.2, CC6.3.1 | Security Officer |
| Annual | CC1.4.1, CC3.2.1, CC7.5.1 | Security Officer + External |

---

*This controls matrix was prepared for the period [START_DATE] – [END_DATE]. Evidence packages are generated by `soc2-evidence-collector.js`. Consult your SOC2 auditor for final control mapping validation.*
