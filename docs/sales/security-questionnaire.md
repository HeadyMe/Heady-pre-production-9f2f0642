# HeadyOS — Security Questionnaire (SIG Lite / CAIQ Format)

**Vendor**: HeadySystems Inc. (DBA Heady™)  
**Product**: HeadyOS  
**Version**: 1.0  
**Date**: 2026-03  
**Contact**: eric@headyconnection.org  
**φ Reference**: 1.618033988749895

---

> This questionnaire follows the Shared Assessments SIG Lite format and Cloud Security Alliance CAIQ structure. HeadyOS responses reference the implemented security architecture described in `docs/SOC2-COMPLIANCE-MATRIX.md` and `docs/SECURITY-GAP-ANALYSIS.md`.

---

## Section 1: Data Governance & Encryption

### 1.1 Data Classification

**Q: Does your organization have a data classification policy?**  
A: Yes. HeadyOS classifies data into four tiers:
- **CONFIDENTIAL**: User prompts, AI outputs, PII, credentials
- **INTERNAL**: Audit logs, usage metrics, configuration
- **PUBLIC**: Documentation, marketing materials
- **SYSTEM**: Infrastructure metadata, telemetry

**Q: How is customer data (User Data) isolated from other tenants?**  
A: Full tenant isolation via:
- PostgreSQL: Separate schema per tenant (`tenant_{tenantId}`)
- Redis: Namespaced keys (`tenant:{tenantId}:*`)
- Vector memory: pgvector namespace per tenant (`vec:{tenantId}`)
- Storage: GCS path prefix per tenant (`gs://heady-prod/{tenantId}/`)
- Application: All API calls require valid `tenantId` JWT claim

### 1.2 Encryption at Rest

**Q: Is customer data encrypted at rest?**  
A: Yes.
- **Algorithm**: AES-256-GCM (Cloud SQL Managed Encryption)
- **Key management**: Google Cloud KMS (Customer-Managed Encryption Keys available on Enterprise tier)
- **Audit logs**: SHA-256 HMAC-chained, stored encrypted
- **Redis**: Encryption-at-rest via GCP Memorystore
- **Backups**: Encrypted with same AES-256 keys

### 1.3 Encryption in Transit

**Q: Is all data encrypted in transit?**  
A: Yes.
- **External traffic**: TLS 1.3 minimum (TLS 1.2 fallback disabled in production)
- **Service-to-service**: mTLS enforced between all 21 microservices
- **Cipher suites**: ECDHE-RSA-AES256-GCM-SHA384 (preferred), TLS_AES_256_GCM_SHA384 (TLS 1.3)
- **Certificate management**: Google-managed certificates + Let's Encrypt via Cloudflare
- **HSTS**: Enabled with `max-age=fib(12)×fib(11)=12816` seconds (~148 days)

**Q: Is mTLS used for microservice communication?**  
A: Yes. All 21 HeadyOS microservices use mTLS with internal GCP-issued certificates. Certificate rotation occurs every fib(9)=34 days.

---

## Section 2: Access Control

### 2.1 Authentication

**Q: What authentication mechanisms are supported?**  
A:
- **Primary**: JWT (HS256 + RS256) with RBAC capability bitmask
- **Enterprise SSO**: SAML 2.0, OIDC (roadmap: Day 34–89)
- **API keys**: HMAC-signed, scoped per resource, rotatable
- **MFA**: TOTP-based (Google Authenticator, Authy) available on Pro+

**Q: What is your session timeout policy?**  
A: Sessions timeout after `fib(4) × 900 = 3,600` seconds (1 hour) of inactivity. JWT access tokens expire after fib(8)=21 minutes; refresh tokens expire after fib(10)=55 days.

### 2.2 Authorization — RBAC

**Q: How is role-based access control implemented?**  
A: HeadyOS uses a capability bitmask approach encoded in the JWT payload:

| Role | Bitmask | Capabilities |
|---|---|---|
| Owner | `0xFFFF` | Full platform control, billing, user management |
| Admin | `0xFF00` | User management, agent config, no billing |
| Developer | `0x0F0F` | Agent create/run, MCP tools, vector memory |
| Viewer | `0x0001` | Read-only access to results, dashboards |
| Agent (machine) | `0x0033` | Run tasks, tool invocations only |

Permission checks occur at Layer 1 of the security pipeline (RBAC layer) before any business logic executes.

### 2.3 Privileged Access Management

**Q: How is privileged access managed?**  
A:
- All production access requires Just-In-Time (JIT) elevation via internal admin portal
- Admin actions are logged in the SHA-256 audit chain
- Production database access requires MFA + approval workflow
- No persistent root/admin credentials in production systems
- Break-glass procedures documented and auditable

---

## Section 3: Audit Logging

**Q: Are audit logs comprehensive and tamper-evident?**  
A: Yes. HeadyOS implements a SHA-256 chained audit log system:

```
AuditEntry = {
  eventType:  string,
  timestamp:  ISO8601,
  traceId:    UUID,
  userId:     string,
  tenantId:   string,
  data:       object,
  prevHash:   SHA256(prevEntry),
  hash:       SHA256(this entry + prevHash)
}
```

**Properties**:
- **Completeness**: 100% of API calls, agent invocations, tool calls, and admin actions logged
- **Tamper-evidence**: SHA-256 HMAC chaining — any modification invalidates the chain
- **Retention**: fib(11)=89 days online; fib(9)=34 months cold storage (GCS)
- **Access**: Immutable append-only. No DELETE capability via API
- **Export**: SIEM-compatible JSON (structured logging), OpenTelemetry spans

**Q: What events are captured?**  
A: All security-relevant events including: authentication (success/failure), authorization decisions, rate limit triggers, input validation rejections, agent invocations, MCP tool calls, data access, configuration changes, admin actions, and security incidents.

---

## Section 4: Vulnerability Management

**Q: What is your vulnerability management program?**  
A:
- **SAST**: Semgrep runs on every push (GitHub Actions: `sast-pipeline.yml`)
- **DAST**: OWASP ZAP nightly scan (GitHub Actions: `dast-pipeline.yml`)
- **Container scanning**: Trivy on every Docker build (`container-scan.yml`)
- **Dependency scanning**: OWASP dependency-check daily + GitHub Dependabot
- **Secret scanning**: Gitleaks on every commit (`secret-scanning.yml`)
- **Security gate**: All PRs require passing `security-gate.yml` checks

**Q: What is your patch management SLA?**  
A:
| Severity | Patch SLA |
|---|---|
| Critical (CVSS ≥ 9.0) | fib(3)=2 business days |
| High (CVSS 7.0–8.9) | fib(5)=5 business days |
| Medium (CVSS 4.0–6.9) | fib(7)=13 business days |
| Low (CVSS < 4.0) | fib(8)=21 business days |

---

## Section 5: Incident Response

**Q: Do you have a documented incident response plan?**  
A: Yes. HeadyOS follows a φ-tiered incident classification:

| Severity | Criteria | SLA | Notification |
|---|---|---|---|
| P0 (Critical) | Data breach, complete outage | 1 hour response, 4 hour resolution | Immediate customer notification |
| P1 (High) | Partial outage, security event | fib(5)=5 hour response | fib(3)=2 business hour customer notice |
| P2 (Medium) | Performance degradation | fib(7)=13 hour response | Next business day |
| P3 (Low) | Minor issue | fib(8)=21 hour response | Weekly digest |

**Q: What is your recovery time objective (RTO)?**  
A:
- P0: RTO = 4 hours, RPO = 1 hour
- P1: RTO = fib(11)=89 minutes, RPO = fib(5)=5 minutes
- P2: RTO = fib(7)=13 hours
- Pilot SLA: Recovery < 30 seconds for non-critical service events

**Q: How are customers notified of incidents?**  
A: Via dedicated Slack channel (#founder-[orgname] for pilot customers), email, and status page (status.headyme.com). Notification within fib(3)=2 hours of confirmed P0/P1.

---

## Section 6: Business Continuity

**Q: What are your backup and recovery procedures?**  
A:
- **Database backups**: Automated daily (Cloud SQL), point-in-time recovery with fib(9)=34-day window
- **Multi-zone**: All Cloud SQL and Redis instances deploy across fib(3)=2+ GCP zones
- **Failover**: Automatic failover with < fib(5)=5 second detection, < fib(8)=21 second promotion
- **Data replication**: Synchronous replication (Cloud SQL HA)
- **Annual DR test**: Documented test with RTO/RPO validation

**Q: What is your disaster recovery strategy?**  
A: Active-passive DR with GCP US-Central1 (primary) + US-East1 (DR). Recovery procedures documented in internal runbook. Last DR test: Q1 2026.

---

## Section 7: Compliance & Certifications

**Q: What compliance certifications does HeadyOS hold or pursue?**  
A:

| Standard | Status |
|---|---|
| SOC 2 Type II | In progress — audit initiated Q1 2026 |
| GDPR | Compliant — DPA available on request |
| CCPA | Compliant — Data Processing Agreement available |
| HIPAA | Not currently covered (roadmap) |
| ISO 27001 | Roadmap — planned post-SOC2 |
| PCI DSS | Not applicable (no payment card data processed) |

**GDPR specifics**:
- Data Processing Agreement available on request
- Data residency: US by default; EU data residency available on Enterprise
- Data subject rights: Access, deletion, portability within fib(5)=5 business days
- DPA terms: Controller (customer) + Processor (HeadyOS) arrangement
- Subprocessor disclosure: headyme.com/subprocessors

**CCPA specifics**:
- Service provider under CCPA; does not sell or share personal information
- Opt-out of AI model training honored per individual request
- Annual privacy report available

---

## Section 8: Penetration Testing

**Q: Does HeadyOS undergo regular penetration testing?**  
A:
- **Frequency**: Annual third-party penetration test (OWASP methodology)
- **Last test**: Q4 2025 (external red team)
- **Scope**: Web application, API, container security, network perimeter
- **Critical/High findings**: Remediated within SLA (see Section 4)
- **Report sharing**: Executive summary available under NDA for Enterprise customers

**Q: Do you allow customer-sponsored penetration testing?**  
A: Yes, for Enterprise customers. Requires fib(8)=21-day notice, signed rules of engagement, and scope agreement. Contact eric@headyconnection.org.

---

## Section 9: Subprocessor Management

**Q: Who are your key subprocessors?**  
A:

| Subprocessor | Purpose | Data Processed | Region |
|---|---|---|---|
| Google Cloud Platform | Infrastructure (compute, storage, DB) | All customer data | US-Central1 |
| OpenAI | LLM inference (GPT-4o, etc.) | Prompt + context (no PII by default) | US |
| Cloudflare | CDN, DDoS protection, edge workers | HTTP headers, IP addresses | Global |
| Neon | Serverless Postgres (analytics) | Aggregated metrics | US-East |
| Sentry | Error tracking + APM | Anonymized stack traces | US |

**Q: How are subprocessors managed?**  
A:
- Security review before onboarding any new subprocessor
- DPAs in place with all data-processing subprocessors
- Quarterly subprocessor list update published at headyme.com/subprocessors
- Customer notification of material subprocessor changes within fib(7)=13 business days

---

## Section 10: Data Handling Summary

| Aspect | Implementation |
|---|---|
| Data ownership | All User Data owned by customer. HeadyOS has no claim. |
| Training use | User Data is NOT used to train models without explicit written consent |
| Retention | Data retained fib(11)=89 days pilot + fib(5)=5 days post-deletion request |
| Deletion | Full deletion within fib(5)=5 business days of written request |
| Portability | JSON export available via API at any time during access |
| Anonymization | Usage metrics anonymized before internal analysis |
| Breach notification | Within 72 hours of discovery (GDPR) / as required by applicable law |

---

*HeadySystems Inc. | eric@headyconnection.org | headyme.com | SOC2 audit in progress | 51+ USPTO provisional patents*
