# SOC 2 Type II Compliance Checklist
## Heady Latent OS — HeadySystems, Inc.

> **Purpose:** Structured compliance roadmap for achieving SOC 2 Type II certification for the Heady Latent OS sovereign AI platform running on Google Cloud Run + Cloudflare.
>
> **Status:** Living document. Reviewed quarterly.
>
> **Last Updated:** March 2026
>
> **Estimated Cost (Phase 1-2):** $30,000–$80,000 all-in
>
> **Target Timeline:** SOC 2 Type I in 6–8 weeks; Type II in 6–12 months from kickoff
>
> **Reference:** AICPA Trust Services Criteria (TSC 2017, updated 2022) — [aicpa-cima.com](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services)
>
> **Cost source data:** [Comp AI](https://trycomp.ai/soc-2-cost-breakdown), [DSALTA](https://www.dsalta.com/resources/articles/soc-2-certification-2025-auditor-cost-timeline-guide), [GRC Insights](https://grcinsightsroc.com/insights/real-cost-building-grc-compliance-timeline/)

---

## Table of Contents

1. [Scope & Boundaries](#1-scope--boundaries)
2. [CC1 — Control Environment (CC1)](#2-cc1--control-environment)
3. [CC2 — Communication & Information (CC2)](#3-cc2--communication--information)
4. [CC3 — Risk Assessment (CC3)](#4-cc3--risk-assessment)
5. [CC4 — Monitoring Activities (CC4)](#5-cc4--monitoring-activities)
6. [CC5 — Control Activities (CC5)](#6-cc5--control-activities)
7. [CC6 — Logical & Physical Access (CC6)](#7-cc6--logical--physical-access)
8. [CC7 — System Operations (CC7)](#8-cc7--system-operations)
9. [CC8 — Change Management (CC8)](#9-cc8--change-management)
10. [CC9 — Risk Mitigation (CC9)](#10-cc9--risk-mitigation)
11. [Availability (A-Series)](#11-availability-a-series)
12. [Processing Integrity (PI-Series)](#12-processing-integrity-pi-series)
13. [Confidentiality (C-Series)](#13-confidentiality-c-series)
14. [Privacy (P-Series)](#14-privacy-p-series)
15. [Evidence Collection Guide](#15-evidence-collection-guide)
16. [Vendor Management Requirements](#16-vendor-management-requirements)
17. [Employee Security Training Requirements](#17-employee-security-training-requirements)
18. [Timeline & Cost Estimates](#18-timeline--cost-estimates)

---

## 1. Scope & Boundaries

### 1.1 System Description

**System Name:** Heady Latent OS Cloud Platform
**Entity:** HeadySystems, Inc.
**Description:** A sovereign AI orchestration platform providing vector memory, agent swarm execution, MCP protocol support, and managed LLM inference. Hosted on Google Cloud Run (backend) and Cloudflare (edge/CDN).

### 1.2 Scope Boundary

**In scope:**
- [ ] Google Cloud Run production environment (`heady-api` service, `heady-worker` service)
- [ ] Cloudflare Workers / Pages (edge layer, authentication)
- [ ] PostgreSQL (Cloud SQL) — subscription and user data
- [ ] Redis (Memorystore) — session cache, rate limiting, feature flags
- [ ] Vector database (Pinecone or Qdrant Cloud) — customer vector memory
- [ ] Stripe API integration — billing and payment processing
- [ ] GitHub Actions CI/CD pipeline — production deployments
- [ ] Google Cloud Storage — audit logs, model artifacts
- [ ] Corporate IT systems used to manage the platform (laptops, G Suite)

**Out of scope:**
- [ ] Self-hosted Community edition deployed by end users
- [ ] Customer infrastructure in on-premises Enterprise deployments
- [ ] Third-party LLM providers (OpenAI, Anthropic) used via BYOM

### 1.3 Trust Service Categories Selected

| Category | Included? | Rationale |
|---|---|---|
| Security (CC) | ✅ Always required | Foundational TSC |
| Availability (A) | ✅ Yes | We offer SLA commitments (99.9%, 99.99%) |
| Processing Integrity (PI) | ✅ Yes | AI agent execution must be complete and accurate |
| Confidentiality (C) | ✅ Yes | Customer data and AI model IP must be protected |
| Privacy (P) | ✅ Yes | Personal data processed for authentication/billing |

---

## 2. CC1 — Control Environment

*Demonstrates commitment to integrity, ethics, and competence. Board/management oversight.*

### CC1.1 — COSO Principles

- [ ] **Board/leadership oversight:** Document executive responsibility for security program. Assign CISO or security-responsible executive.
- [ ] **Organizational structure:** Create and publish an org chart showing security reporting lines.
- [ ] **Commitment to competence:** Define required security competencies for all roles. Document how these are assessed at hiring and annually.
- [ ] **Accountability:** Define and document accountability for security objectives in all job descriptions.
- [ ] **Code of conduct:** Publish and annually acknowledge a Code of Conduct covering security, data handling, and conflicts of interest.
- [ ] **HR practices:** Background checks for all employees with production access. Reference checks for security-sensitive roles.

### CC1.2 — Board Independence

- [ ] Board or equivalent advisory committee reviews security program annually.
- [ ] Document board-level security risk discussions (meeting minutes).
- [ ] Independent security advisor or external auditor relationship established.

### CC1.3 — Organizational Structure

- [ ] Security policies approved by leadership and reviewed annually.
- [ ] Security committee or equivalent established with cross-functional representation.
- [ ] Incident response escalation path to C-level defined and documented.

---

## 3. CC2 — Communication & Information

*Relevant information is identified, captured, and communicated internally and externally.*

### CC2.1 — Information Quality

- [ ] Information relevant to the security program is identified from authoritative sources (NIST, CIS, AICPA).
- [ ] Risk register maintained and reviewed quarterly.
- [ ] Security metrics dashboard reviewed monthly by leadership.

### CC2.2 — Internal Communication

- [ ] Security policies communicated to all employees at onboarding and annually.
- [ ] Security incident reporting procedures communicated to all staff.
- [ ] Change management procedures documented and communicated to engineering.
- [ ] "Security Champions" designated in each engineering team.

### CC2.3 — External Communication

- [ ] Security/trust page published at `headysystems.com/security`.
- [ ] Privacy Policy published, reviewed annually, compliant with GDPR/CCPA.
- [ ] Terms of Service including data processing terms published.
- [ ] Incident notification procedures for customers documented (48h notification commitment).
- [ ] Responsible disclosure / bug bounty program documented.
- [ ] SOC 2 report available under NDA to enterprise customers.
- [ ] Vendor security questionnaire template prepared and maintained.

---

## 4. CC3 — Risk Assessment

*Identify, analyze, and respond to risks from achieving objectives.*

### CC3.1 — Risk Assessment Process

- [ ] Annual formal risk assessment conducted and documented.
- [ ] Risk assessment covers: availability, confidentiality, processing integrity, privacy.
- [ ] AI-specific risks documented: model poisoning, prompt injection, data exfiltration via agents.
- [ ] Risk register maintained in (Notion/Confluence/GRC tool) with owner, severity, likelihood, mitigations.
- [ ] Risk tolerance thresholds defined and approved by leadership.

### CC3.2 — Risk Identification

- [ ] Threat modeling performed for all major features (vector memory, agent execution, MCP).
- [ ] Vulnerability disclosure process and CVE monitoring active.
- [ ] Third-party penetration test conducted annually (or more frequently pre-major release).
- [ ] OWASP Top 10 and LLM Top 10 risks reviewed and addressed.
- [ ] Supply chain risks assessed for all npm/Python packages in production.

### CC3.3 — Change Risk Analysis

- [ ] Security review required for all changes to production infrastructure.
- [ ] Significant changes (new features, architecture changes) require formal risk analysis.
- [ ] Risk analysis documented in GitHub PR for infrastructure changes.

---

## 5. CC4 — Monitoring Activities

*Ongoing and periodic evaluations to determine control effectiveness.*

### CC4.1 — Ongoing Monitoring

- [ ] Automated security monitoring via Google Cloud Security Command Center.
- [ ] Cloudflare security analytics reviewed weekly.
- [ ] Dependency vulnerability scanning (Dependabot, Snyk) active on all repos.
- [ ] SIEM (Security Information and Event Management) configured with relevant alerts.
- [ ] Uptime monitoring with alerting (Pingdom / Better Uptime / Google Cloud Monitoring).
- [ ] Error rate and anomaly detection active in production.

### CC4.2 — Periodic Evaluations

- [ ] Annual internal security audit against this checklist.
- [ ] Quarterly access review (all production accounts, admin privileges).
- [ ] Annual third-party penetration test.
- [ ] Semi-annual review of vendor security posture.
- [ ] Monthly vulnerability scan of production infrastructure.

---

## 6. CC5 — Control Activities

*Policies and procedures that address risk responses.*

### CC5.1 — Control Selection

- [ ] Controls mapped to identified risks in the risk register.
- [ ] Compensating controls documented where primary controls are not feasible.
- [ ] Control ownership assigned (person responsible for each control).

### CC5.2 — Technology Controls

- [ ] Technology general controls documented for all in-scope systems.
- [ ] Cloud provider (Google Cloud, Cloudflare) security controls inherited and documented.
- [ ] **Automated controls:** IaC (Terraform/Pulumi) with security policies enforced in code.

### CC5.3 — Control Deployment

- [ ] Controls deployed consistently across all environments (dev/staging/production).
- [ ] Control exceptions formally documented and approved.
- [ ] Control testing results documented.

---

## 7. CC6 — Logical & Physical Access

*The most detailed and critical section for a SaaS platform.*

### CC6.1 — Access Control Program

- [ ] **Access control policy** written, approved, and published.
- [ ] **Least privilege principle** enforced for all roles.
- [ ] **Need-to-know principle** enforced for sensitive data access.
- [ ] Access provisioning and deprovisioning process documented and tested.

### CC6.2 — User Registration & Authorization

- [ ] Unique user accounts for all personnel (no shared accounts).
- [ ] Access requests formally approved before provisioning.
- [ ] Privileged access (admin, production) requires secondary approval.
- [ ] **Google Cloud IAM:** All production IAM roles documented with business justification.
- [ ] **GitHub:** Branch protection rules on `main` requiring PR review + status checks.
- [ ] **Stripe:** Only authorized billing personnel have Stripe dashboard access.

### CC6.3 — Access Removal

- [ ] Offboarding checklist removes all access within 24 hours of departure.
- [ ] Automated deprovisioning triggered by HR system (or manual checklist).
- [ ] Quarterly access review to catch stale accounts.

### CC6.4 — MFA Enforcement

- [ ] **MFA required** for all production systems:
  - [ ] Google Cloud Console (YubiKey or Google Prompt)
  - [ ] GitHub (TOTP/hardware key)
  - [ ] Cloudflare dashboard
  - [ ] Stripe dashboard
  - [ ] Heady admin panel
- [ ] Phishing-resistant MFA (hardware keys) required for privileged access.

### CC6.5 — Encryption

- [ ] **Data in transit:** TLS 1.2+ enforced everywhere. TLS 1.0/1.1 disabled.
- [ ] **Data at rest:** Google Cloud Storage encrypted with Google-managed keys (minimum). Customer-managed keys (CMEK) available for Enterprise.
- [ ] **Database:** Cloud SQL encrypted at rest. Connection via Cloud SQL Auth Proxy (IAM auth).
- [ ] **Vector data:** Encrypted at rest in vector database. Customer namespace isolation enforced.
- [ ] **Secrets:** All API keys, secrets in Google Secret Manager. No secrets in source code or environment variables in plain text.
- [ ] **Certificate management:** SSL certificates auto-renewed via Cloudflare. Certificate expiry monitoring active.

### CC6.6 — Logical Access to Assets

- [ ] Production database not directly accessible from the internet (VPC-internal only).
- [ ] No direct SSH/RDP to production servers. Cloud Run uses IAP (Identity-Aware Proxy) for admin access.
- [ ] Staging environment isolated from production (separate VPC, separate credentials).
- [ ] Guest/anonymous access restricted to public endpoints only.

### CC6.7 — Ports & Services

- [ ] Network security review: only required ports open (443/HTTPS, no open 22/SSH to internet).
- [ ] Google Cloud Firewall rules documented and reviewed quarterly.
- [ ] Cloudflare WAF rules active (OWASP Core Ruleset enabled).
- [ ] DDoS protection active via Cloudflare Magic Transit / Pro plan.

### CC6.8 — Data Classification

- [ ] Data classification policy: Public / Internal / Confidential / Restricted.
- [ ] Customer vector data classified as Confidential or Restricted.
- [ ] PII (personal data) classified and inventoried (GDPR Article 30 record).
- [ ] Data retention schedule documented.

---

## 8. CC7 — System Operations

*Manages threats and vulnerabilities affecting the system.*

### CC7.1 — Vulnerability Detection

- [ ] Google Cloud Security Command Center active and alerts configured.
- [ ] Container image scanning (Artifact Registry Vulnerability Scanning) enabled.
- [ ] Dependency scanning (Dependabot + Snyk) on all GitHub repos.
- [ ] DAST (Dynamic Application Security Testing) in CI pipeline.
- [ ] SAST (Static Application Security Testing): CodeQL or SonarQube in GitHub Actions.

### CC7.2 — Anomaly Detection

- [ ] Baseline established for normal API traffic patterns.
- [ ] Anomaly detection alerts on: unusual auth patterns, data exfiltration signals, spike in error rates.
- [ ] Google Cloud Armor / Cloudflare rate limiting active.
- [ ] Failed login attempt monitoring and lockout policy.

### CC7.3 — Incident Response

- [ ] **Incident Response Plan (IRP)** written, approved, tested.
- [ ] Severity levels defined (P0–P3) with response time targets.
- [ ] Incident response runbooks for common scenarios (data breach, DDoS, service outage).
- [ ] Incident commander role defined and rotation documented.
- [ ] Post-incident review process (blameless post-mortem template).
- [ ] Customer notification template for security incidents (48h commitment to notify).
- [ ] IRP tested annually via tabletop exercise.

### CC7.4 — Environmental Controls

*Physical: Google Cloud's responsibility (inherited control). Document reliance on GCP shared responsibility model.*

- [ ] Google Cloud SOC 2 report reviewed annually.
- [ ] Cloudflare SOC 2 report reviewed annually.
- [ ] Shared responsibility model documented showing boundary between Heady and GCP.

### CC7.5 — Disaster Recovery

- [ ] RPO (Recovery Point Objective): ≤ 1 hour (database backups every 30 min).
- [ ] RTO (Recovery Time Objective): ≤ 4 hours (Cloud Run multi-region deployment).
- [ ] Database backups: automated daily backups with point-in-time recovery (Cloud SQL PITR).
- [ ] Backup restore tested quarterly.
- [ ] DR runbook published and reviewed semi-annually.
- [ ] Business continuity plan written and approved.

---

## 9. CC8 — Change Management

*Manages changes to prevent unauthorized changes to production.*

### CC8.1 — Change Management Process

- [ ] All code changes go through pull request (PR) review with minimum 1 reviewer.
- [ ] `main` branch protected: no direct pushes; PR required.
- [ ] CI/CD pipeline: automated tests must pass before merge.
- [ ] Security review required for changes affecting: authentication, authorization, data handling, encryption.
- [ ] Infrastructure changes via IaC (Terraform) with PR review and plan review.
- [ ] Change management log maintained (GitHub PR history serves as evidence).

### CC8.2 — Emergency Changes

- [ ] Emergency change procedure documented (allows faster deployment with retrospective review).
- [ ] Emergency changes tagged in deployment log and reviewed within 24h.
- [ ] Break-glass access procedures documented for emergency production access.

---

## 10. CC9 — Risk Mitigation

*Risk mitigation strategies including vendor/business partner management.*

### CC9.1 — Risk Mitigation

- [ ] Insurance: cyber liability insurance policy in place (minimum $2M coverage recommended).
- [ ] Business continuity plan reviewed and tested annually.
- [ ] Key person risk mitigation (documentation, backup coverage for security roles).

### CC9.2 — Vendor/Business Partner Management

See **Section 16: Vendor Management Requirements** for detailed sub-processor list and assessment criteria.

- [ ] All critical vendors assessed for security posture before onboarding.
- [ ] Data Processing Agreements (DPA) executed with all sub-processors handling personal data.
- [ ] Annual vendor review process documented.
- [ ] Vendor breach notification requirements in all DPAs (72h notification from vendor to Heady).

---

## 11. Availability (A-Series)

*Controls ensuring the system is available for operation and use.*

### A1.1 — Capacity Planning

- [ ] Cloud Run autoscaling configured with minimum/maximum instance limits.
- [ ] Load testing performed before major releases (k6 or Apache Bench).
- [ ] Capacity thresholds and scale-out triggers documented.
- [ ] Database connection pooling configured (PgBouncer or Cloud SQL proxy).

### A1.2 — Availability Monitoring

- [ ] External uptime monitoring with 1-minute checks (multiple geographies).
- [ ] Internal health checks on all Cloud Run services (`/health` endpoint).
- [ ] Status page published at `status.headysystems.com` (Statuspage.io or Cachet).
- [ ] Alerting: PagerDuty or equivalent for on-call rotation.
- [ ] Uptime tracked monthly against SLA targets (99.9% / 99.99% for Enterprise).

### A1.3 — Environmental Protections

- [ ] Cloud Run services deployed across minimum 2 GCP regions.
- [ ] Cloudflare CDN provides geographic redundancy for edge layer.
- [ ] Cloud SQL configured with high-availability (regional replication).
- [ ] Redis (Memorystore) with automatic failover enabled.

---

## 12. Processing Integrity (PI-Series)

*Controls ensuring processing is complete, valid, accurate, timely, and authorized.*

### PI1.1 — Processing Completeness

- [ ] AI agent execution tracked end-to-end with correlation IDs.
- [ ] Failed agent runs logged with full error context.
- [ ] Dead letter queues for failed async tasks with retry logic.
- [ ] Usage metering verified against Stripe billing records monthly.

### PI1.2 — Processing Accuracy

- [ ] Input validation on all API endpoints (schema validation with Zod/Joi).
- [ ] Output validation for LLM responses before returning to clients.
- [ ] Vector embedding consistency checks (dimension validation).
- [ ] Billing calculations audited: Stripe usage records reconciled against internal meter.

### PI1.3 — Processing Authorization

- [ ] API authentication required for all non-public endpoints.
- [ ] JWT tokens with short expiry (15 min access, 7-day refresh).
- [ ] Scoped API keys with explicit permission grants.
- [ ] Audit log for all privileged operations (admin actions, data exports, plan changes).

---

## 13. Confidentiality (C-Series)

*Controls protecting information designated as confidential.*

### C1.1 — Confidentiality Identification

- [ ] Data classification policy defines Confidential data types.
- [ ] Customer vector data, agent outputs, and model fine-tuning data classified as Confidential.
- [ ] PII in user accounts classified as Restricted.

### C1.2 — Confidentiality Protection

- [ ] Customer data namespaced by `org_id` — cryptographic isolation at database level.
- [ ] Customer data not used to train Heady models without explicit consent.
- [ ] Employees do not access customer data except for support tickets with customer consent.
- [ ] Data access by employees logged in audit trail.
- [ ] Customer data deleted within 30 days of account deletion (configurable for Enterprise).
- [ ] Confidential data not stored in logs (PII scrubbing in log pipeline).

### C1.3 — Confidential Data Disposal

- [ ] Data retention schedule: production data retained per contract terms.
- [ ] Deletion verified: when customer requests deletion, deletion confirmed within 30 days.
- [ ] Soft delete + hard delete pipeline with verification.
- [ ] GCP storage bucket policies enforce lifecycle rules for log expiry.

---

## 14. Privacy (P-Series)

*Controls over collection, use, retention, disclosure, and disposal of personal information.*

### P1 — Privacy Notice

- [ ] Privacy policy published, GDPR/CCPA-compliant, reviewed annually.
- [ ] Privacy notice provided at point of collection (signup flow).
- [ ] Lawful basis for processing documented for each data category (GDPR Article 6).

### P2 — Choice and Consent

- [ ] Marketing communications are opt-in only.
- [ ] Consent records stored with timestamp and mechanism.
- [ ] Easy opt-out/unsubscribe mechanism on all marketing emails.

### P3 — Data Inventory (GDPR Article 30 Record)

- [ ] Record of Processing Activities (RoPA) maintained and current.

| Data Category | Source | Purpose | Retention | Sub-processors |
|---|---|---|---|---|
| Name, email | Signup | Authentication, communication | Life of account + 30 days | Google (Auth), Postmark |
| Payment info | Checkout | Billing | Per Stripe retention policy | Stripe |
| API usage logs | Runtime | Billing, abuse detection | 90 days | GCP Logging |
| Vector embeddings | API | Core product | Per contract (default: 90 days after deletion) | Pinecone/Qdrant |
| IP addresses | Requests | Security, rate limiting | 30 days | Cloudflare |
| Agent outputs | Runtime | Product delivery, audit | Per customer retention setting | GCP Storage |

### P4 — Use, Retention, Disposal

- [ ] Data used only for documented purposes.
- [ ] Retention schedule enforced automatically (lifecycle policies).
- [ ] Deletion requests (GDPR Art. 17 "Right to Erasure") fulfilled within 30 days.
- [ ] Data portability (GDPR Art. 20): export API available for all customer data.

### P5 — Onward Transfers

- [ ] Standard Contractual Clauses (SCCs) executed for EU data transfers to U.S. sub-processors.
- [ ] Sub-processor list published and updated when sub-processors change.
- [ ] 30-day notice to customers before adding new sub-processors.

---

## 15. Evidence Collection Guide

*What artifacts to collect and retain to satisfy auditors during Type II observation period.*

### Policy & Procedure Evidence

| Evidence | Location | Frequency | Responsible |
|---|---|---|---|
| Security policy document (signed) | GDrive/Notion | Annual acknowledgment | CISO |
| Risk register (current) | GRC tool | Quarterly update | Security team |
| Access review results | Spreadsheet/GRC | Quarterly | Security team |
| Vendor assessment records | GRC tool | Annual per vendor | Procurement |
| Employee security training completion | HR system / LMS | Annual per employee | HR + Security |
| Incident response tabletop results | GDrive | Annual | CISO |

### Technical Evidence (Automated)

| Evidence | System | Retention |
|---|---|---|
| Cloud Run deployment logs | GCP Logging | 1 year |
| Authentication events (login, logout, MFA) | GCP Logging / Auth0 | 1 year |
| Admin action audit log | Internal DB | 7 years (Enterprise) |
| CI/CD deployment history | GitHub Actions | Lifetime |
| Vulnerability scan reports | Snyk / Dependabot | 1 year |
| Pen test reports | File storage | 3 years |
| Backup restore test results | Runbook completion docs | 3 years |
| Uptime metrics | Monitoring system | 13 months |

### Change Management Evidence

| Evidence | Source | Notes |
|---|---|---|
| GitHub PR history (all merges to main) | GitHub | 100% coverage |
| Terraform plan approvals | GitHub Actions | Infrastructure changes |
| Security review sign-offs | GitHub PR labels | Tag: `security-reviewed` |
| Emergency change log | Incident tracking | Tag all P0/P1 emergency changes |

### Auditor Interaction Tips

- Assign a single point of contact (Compliance Lead) for auditor requests.
- Use a GRC platform (Vanta, Drata, Comp AI) to auto-collect evidence — reduces prep time by ~60%.
- Request auditor's Evidence Request List (ERL) 4 weeks before field work begins.
- Conduct a pre-audit internal walkthrough with engineering leads.
- Schedule weekly status calls with auditor during observation period.

---

## 16. Vendor Management Requirements

### Critical Sub-processors

| Vendor | Purpose | Security Assessment | DPA Executed | SOC 2 Report |
|---|---|---|---|---|
| **Google Cloud** | Compute, storage, database | Inherited controls | ✅ | [GCP SOC 2](https://cloud.google.com/security/compliance/soc-2) |
| **Cloudflare** | CDN, WAF, edge compute | Inherited controls | ✅ | [Cloudflare SOC 2](https://www.cloudflare.com/trust-hub/compliance-resources/) |
| **Stripe** | Payment processing | Reviewed annually | ✅ | [Stripe SOC 2](https://stripe.com/docs/security) |
| **Pinecone / Qdrant** | Vector database | Annual questionnaire | ✅ | Review upon contract |
| **Postmark / Sendgrid** | Transactional email | Annual questionnaire | ✅ | Check vendor trust page |
| **GitHub (Microsoft)** | Source code, CI/CD | Inherited controls | ✅ | [GitHub SOC 2](https://github.com/security) |
| **PagerDuty** | Incident alerting | Annual questionnaire | ✅ | Review upon contract |

### Vendor Assessment Criteria

For each critical vendor, document:
- [ ] SOC 2 Type II report obtained and reviewed (or equivalent).
- [ ] Security questionnaire completed (CAIQ or custom).
- [ ] Data Processing Agreement (DPA) executed if processing personal data.
- [ ] Breach notification SLA in DPA: 72 hours to notify Heady.
- [ ] Sub-processor list reviewed for unexpected 4th parties.
- [ ] Concentration risk assessed (e.g., multiple critical vendors on AWS — single-provider risk).

### Vendor Onboarding Checklist

- [ ] Vendor security review completed before any production data shared.
- [ ] DPA or SCCs executed before any EU personal data transferred.
- [ ] Vendor added to sub-processor register.
- [ ] Customer sub-processor list updated (with 30-day advance notice).
- [ ] Annual review calendar entry created.

---

## 17. Employee Security Training Requirements

### Required Training (All Employees)

| Training | Frequency | Completion Tracking | Provider |
|---|---|---|---|
| Security awareness (general) | Annual + onboarding | HR/LMS | KnowBe4, Wizer, or equivalent |
| Phishing simulation | Quarterly | Automated | KnowBe4 |
| GDPR/privacy basics | Annual + onboarding | HR/LMS | Internal or vendor |
| Acceptable use policy acknowledgment | Annual | Digital signature | HR system |
| Incident reporting procedure | Annual + onboarding | Quiz completion | Internal |

### Role-Specific Training (Engineering)

| Training | Role | Frequency | Provider |
|---|---|---|---|
| Secure coding (OWASP Top 10) | All engineers | Annual | SANS, Secure Code Warrior |
| LLM security (OWASP LLM Top 10) | AI engineers | Annual | Internal workshop |
| Cloud security (GCP best practices) | Backend engineers | Annual | Google Cloud training |
| Infrastructure as Code security | DevOps/SRE | Annual | Bridgecrew/Checkov training |
| AI red teaming basics | Security team | Annual | External specialist |

### Role-Specific Training (Management)

| Training | Role | Frequency |
|---|---|---|
| SOC 2 overview and obligations | All managers | Annual |
| Data handling and classification | All managers | Annual |
| Vendor risk management | Procurement/Legal | Annual |

### Training Documentation Requirements

- [ ] Training completion records retained for minimum 3 years.
- [ ] Non-completion escalation process documented (manager notification at 30/60/90 days overdue).
- [ ] New hire training completion required within 30 days of start date.
- [ ] Refresher training triggered by security incidents relevant to role.
- [ ] Training effectiveness measured via simulated phishing click rates (target: <5%).

---

## 18. Timeline & Cost Estimates

### Recommended Phasing

| Phase | Activities | Duration | Cost Estimate |
|---|---|---|---|
| **Phase 0: Prep** | Select GRC platform, gap assessment, assign Compliance Lead | 2–4 weeks | $5,000–$15,000 |
| **Phase 1: SOC 2 Type I** | Implement missing controls, write policies, Type I audit | 6–10 weeks | $15,000–$35,000 |
| **Phase 2: Type II Observation** | 3-month minimum observation period | 3–6 months | (overlap with ops) |
| **Phase 3: Type II Audit & Report** | Field work, auditor review, report issuance | 4–8 weeks | $7,000–$50,000 |
| **Ongoing: Annual maintenance** | Continuous compliance, annual re-audit | Recurring | $10,000–$30,000/yr |

**Total estimated investment (Type II, first year):** $30,000–$80,000 all-in

### Cost Breakdown (SMB Track)

| Line Item | Low | High | Notes |
|---|---|---|---|
| GRC platform (Vanta/Drata/Comp AI) | $6,000 | $20,000 | Annual subscription; reduces manual work by ~60% |
| Gap analysis & policy writing | $3,000 | $10,000 | Can be done internally or via consultant |
| Pen test (annual) | $8,000 | $30,000 | Required by most auditors as evidence |
| Type II audit fee | $7,000 | $50,000 | Boutique auditor → Big 4 range |
| Internal labor (Compliance Lead) | $5,000 | $20,000 | Time allocation estimate |
| **Total** | **$29,000** | **$130,000** | |

### Accelerators

- **AI-powered GRC platforms** (Vanta, Drata, Comp AI) auto-collect evidence from GCP/GitHub/Stripe, reducing Type I prep from 12 weeks to 4 weeks.
- **GCP Inherited Controls:** Google Cloud's own compliance means approximately 60 controls are inherited automatically — dramatically reducing your audit scope.
- **Combining with ISO 27001:** Parallel ISO 27001 certification reduces marginal cost by ~50% due to overlapping control frameworks. Recommended if European enterprise customers are a target.

### ROI Justification

A single enterprise contract won due to SOC 2 certification ($50,000–$500,000+ ACV) fully offsets the entire compliance investment. At the Team plan price point ($99/seat/mo × 50 seats = $59,400/year), even one mid-market customer acquired because of SOC 2 justifies the investment.

Enterprise SaaS deals from Fortune 500 companies routinely require SOC 2 Type II as a procurement gate — without it, Heady cannot be shortlisted regardless of technical merit.

---

## Appendix: Key Policies Required

The following policy documents must be written, approved, and published internally:

| Policy | Priority | Template Source |
|---|---|---|
| Information Security Policy | P0 | SANS Policy Templates (free) |
| Access Control Policy | P0 | SANS |
| Incident Response Plan | P0 | NIST SP 800-61 framework |
| Data Classification Policy | P0 | Internal |
| Acceptable Use Policy | P0 | SANS |
| Change Management Policy | P1 | Internal |
| Vendor Management Policy | P1 | Internal |
| Business Continuity Plan | P1 | NIST SP 800-34 |
| Encryption Policy | P1 | Internal |
| Password/Authentication Policy | P1 | NIST SP 800-63B |
| Data Retention & Disposal Policy | P1 | Internal |
| Privacy Policy (public) | P0 | Legal counsel |

---

*Document maintained by: Compliance Lead, HeadySystems, Inc.*
*Questions: compliance@headysystems.com*
*External auditor relationship managed via Compliance Lead.*
