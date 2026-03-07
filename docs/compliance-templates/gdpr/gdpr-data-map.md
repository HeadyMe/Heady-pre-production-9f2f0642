# GDPR Article 30 — Record of Processing Activities
## HeadyMe Platform — Data Processing Register

**Controller:** HeadyMe Systems, Inc.  
**DPO Contact:** [DPO_NAME], [DPO_EMAIL]  
**Last Updated:** [DATE]  
**Version:** 1.0  
**Regulation Reference:** GDPR Art. 30 (Records of processing activities)

> This register constitutes HeadyMe's required Article 30 documentation. It must be made available to supervisory authorities on request and updated whenever processing activities change materially.

---

## PART A — Controller Information

| Field | Value |
|-------|-------|
| Organisation Name | HeadyMe Systems, Inc. |
| Address | [ADDRESS] |
| Country | [COUNTRY] |
| Representative in EU/EEA (if applicable) | [REP_NAME, ADDRESS] |
| Data Protection Officer | [DPO_NAME, EMAIL] |
| Joint Controller (if any) | N/A |
| Date of Last Review | [DATE] |

---

## PART B — Processing Activity Register

---

### Activity 001: User Account Management

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | User Account Registration and Management |
| **Business Owner** | Engineering / Product |
| **Processing Purpose** | Account creation, authentication, profile management, service delivery |
| **Legal Basis** | Art. 6(1)(b) — performance of a contract |
| **Special Category Data?** | No |
| **Data Subjects** | End users (individuals who create Heady accounts) |
| **Data Categories** | Name, email address, username, password hash, profile image URL, timezone, language preference, account creation date, last login date |
| **Data Sources** | User input (registration form), OAuth providers (Google, GitHub, SAML IdP) |
| **Recipients** | Internal systems; authentication providers (SAML/OIDC IdPs) |
| **Third Country Transfers?** | None (or: Standard Contractual Clauses with [COUNTRY] recipients) |
| **Retention Period** | Account lifetime + 3 years after deletion request |
| **Technical Measures** | Passwords: bcrypt/argon2; Data at rest: AES-256; Data in transit: TLS 1.3; Role-based access via `auth-rbac.js` |
| **Organisational Measures** | Access restricted to engineering, support under need-to-know; annual training |
| **Implementation Reference** | `src/middleware/auth-rbac.js`, `src/auth/` |

---

### Activity 002: AI Processing and Conversation History

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | AI Agent Conversation Processing |
| **Business Owner** | AI / Product |
| **Processing Purpose** | Providing AI assistant services, personalisation, model improvement (where consented) |
| **Legal Basis** | Art. 6(1)(b) — performance of contract; Art. 6(1)(a) — consent (for model training use) |
| **Special Category Data?** | Potentially yes — users may voluntarily share health, political, religious information in conversations |
| **Special Category Legal Basis** | Art. 9(2)(a) — explicit consent |
| **Data Subjects** | Registered users, enterprise tenant end-users |
| **Data Categories** | Conversation content and messages, AI agent responses, user preferences/settings, document content uploaded by user, function call logs, session metadata |
| **Data Sources** | User input via Heady API endpoints |
| **Recipients** | LLM API providers (OpenAI, Anthropic, Google, Groq, HuggingFace, Cloudflare) — under data processing agreements |
| **Third Country Transfers?** | Yes — US-based LLM providers. Basis: EU Standard Contractual Clauses (SCCs) |
| **Retention Period** | Conversation history: per user settings (default 90 days, configurable 0–730 days); Model training data: consent-gated |
| **Technical Measures** | End-to-end encryption option; vector memory isolated per tenantId; conversation deletion via `gdpr-data-subject-rights.js` |
| **Organisational Measures** | LLM provider DPAs maintained; no conversation data used for third-party model training without consent |
| **DPIA Required?** | Yes — see `gdpr-dpia-template.md` (AI processing of potentially sensitive conversations) |
| **Implementation Reference** | `src/memory/`, `src/agents/`, `headybuddy-core/`, LLM provider DPAs |

---

### Activity 003: Vector Memory and Knowledge Base

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Vector Embedding Storage (Long-term Memory) |
| **Business Owner** | Engineering / AI |
| **Processing Purpose** | Enabling AI recall of user context and long-term memory across sessions |
| **Legal Basis** | Art. 6(1)(b) — contract performance; Art. 6(1)(a) — consent for extended retention |
| **Special Category Data?** | Potentially — vectorised representations of conversations |
| **Data Subjects** | Registered users |
| **Data Categories** | Vector embeddings of conversation snippets, document chunks, user knowledge base entries, associated metadata (timestamps, source references, tenantId) |
| **Data Sources** | Generated from Activity 002 conversations; user uploads |
| **Recipients** | PostgreSQL/Neon (pgvector) — under data processing agreement |
| **Third Country Transfers?** | Per Neon.tech DPA (US-based, SCCs) |
| **Retention Period** | Until user deletion request or account closure + 30 days |
| **Technical Measures** | Tenant-isolated storage; deletion implemented in `gdpr-data-subject-rights.js` → eraseVectorMemory(); pgvector row-level security |
| **DPIA Required?** | Yes (part of AI processing DPIA) |
| **Implementation Reference** | `src/memory/`, `heady-neon` module |

---

### Activity 004: Analytics and Platform Monitoring

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Platform Usage Analytics |
| **Business Owner** | Product / Engineering |
| **Processing Purpose** | Product improvement, performance monitoring, error detection |
| **Legal Basis** | Art. 6(1)(f) — legitimate interests (platform stability and improvement) |
| **Legitimate Interest Assessment** | [LINK_TO_LIA] |
| **Special Category Data?** | No |
| **Data Subjects** | All platform users |
| **Data Categories** | IP address (anonymised after 24h), page/feature usage events, error logs, session duration, user agent string, request IDs |
| **Data Sources** | Application instrumentation via telemetry.js |
| **Recipients** | Internal systems; [ANALYTICS_PROVIDER] under DPA |
| **Third Country Transfers?** | [SPECIFY] |
| **Retention Period** | Raw events: 30 days; Aggregated: 2 years; Error logs: 90 days |
| **Technical Measures** | IP anonymisation via `gdpr-privacy-middleware.js` → anonymizeIP(); no cross-site tracking; cookie consent enforced |
| **Organisational Measures** | No sale of analytics data; access restricted to product/engineering |
| **Implementation Reference** | `src/telemetry/`, `src/lib/telemetry.js`, `gdpr-privacy-middleware.js` |

---

### Activity 005: Enterprise Customer Tenant Administration

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Enterprise Tenant User Management |
| **Business Owner** | Enterprise Sales / Engineering |
| **Processing Purpose** | Providing multi-tenant SaaS services to enterprise customers; billing; support |
| **Legal Basis** | Art. 6(1)(b) — contract with enterprise customer (HeadyMe is processor for customer's data subjects) |
| **Processor Note** | For enterprise tenants, HeadyMe acts as Data Processor; enterprise customer is Controller. This register documents HeadyMe's controller activities only. Processor activities are governed by DPA Schedule to customer contract. |
| **Data Subjects** | Enterprise customer employees/end-users |
| **Data Categories** | Name, work email, role/department, SSO identity (SAML), tenant assignment, API key usage logs, feature flag settings |
| **Data Sources** | Customer SAML/OIDC identity providers; customer-initiated provisioning |
| **Recipients** | Enterprise customer (controller); internal billing/support |
| **Third Country Transfers?** | Per customer contract / DPA |
| **Retention Period** | Contract term + 1 year; then purged per customer instruction |
| **Technical Measures** | Tenant isolation enforced at DB and application layer; RBAC via `auth-rbac.js` |
| **Implementation Reference** | `src/middleware/auth-rbac.js`, `src/auth/`, billing systems |

---

### Activity 006: Marketing Communications

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Marketing Email and Communications |
| **Business Owner** | Marketing |
| **Processing Purpose** | Newsletter distribution, product announcements, event invitations |
| **Legal Basis** | Art. 6(1)(a) — consent (opt-in required); Art. 6(1)(f) — legitimate interest for existing customer communications |
| **Data Subjects** | Subscribed individuals, existing customers |
| **Data Categories** | Email address, first name, consent timestamp, subscription preferences, open/click events |
| **Data Sources** | User sign-up forms, existing customer emails |
| **Recipients** | [EMAIL_PROVIDER] under DPA |
| **Third Country Transfers?** | [SPECIFY] — SCCs where applicable |
| **Retention Period** | Until unsubscribe + 30 days; consent records: 5 years |
| **Technical Measures** | Double opt-in; one-click unsubscribe; consent managed via `gdpr-privacy-middleware.js` |
| **Implementation Reference** | Marketing platform; `gdpr-data-subject-rights.js` → handleOptOut() |

---

### Activity 007: Security Logging and Incident Response

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Security Event Logging and Incident Response |
| **Business Owner** | Security / Engineering |
| **Processing Purpose** | Platform security, fraud prevention, incident detection and response |
| **Legal Basis** | Art. 6(1)(c) — legal obligation (security requirements); Art. 6(1)(f) — legitimate interests |
| **Data Subjects** | All users (including potential attackers) |
| **Data Categories** | IP addresses, request timestamps, authentication events, security alerts, audit log entries |
| **Data Sources** | Application security events via `src/middleware/audit-log.js`, `src/bees/security-bee.js` |
| **Recipients** | Internal security team; law enforcement if required by law |
| **Third Country Transfers?** | None by default |
| **Retention Period** | Security logs: 1 year; Audit logs: 6 years (HIPAA requirement where applicable) |
| **Technical Measures** | Immutable hash-chain logs; access restricted to security team |
| **Implementation Reference** | `src/middleware/audit-log.js`, `src/bees/security-bee.js` |

---

### Activity 008: Billing and Payment Processing

| Attribute | Detail |
|-----------|--------|
| **Processing Activity Name** | Subscription Billing |
| **Business Owner** | Finance |
| **Processing Purpose** | Processing subscription payments, invoicing, financial record keeping |
| **Legal Basis** | Art. 6(1)(b) — contract; Art. 6(1)(c) — legal obligation (tax/accounting) |
| **Data Subjects** | Paying customers |
| **Data Categories** | Billing name, billing address, payment method token (no full card numbers stored), invoice history, subscription tier |
| **Data Sources** | User-provided billing information |
| **Recipients** | [PAYMENT_PROCESSOR] — controller of payment card data; internal finance |
| **Third Country Transfers?** | Per payment processor DPA |
| **Retention Period** | 7 years (legal/tax retention requirement) |
| **Technical Measures** | PCI-DSS compliant payment processor; no raw card data stored |
| **Implementation Reference** | Billing system; `src/services/billing.js` |

---

## PART C — Sub-Processor Register

| Sub-Processor | Service | Data Category | Country | Legal Transfer Basis | DPA Executed | Review Date |
|---------------|---------|---------------|---------|---------------------|--------------|-------------|
| OpenAI | LLM inference | Conversation content | US | SCCs | [DATE] | [DATE] |
| Anthropic | LLM inference | Conversation content | US | SCCs | [DATE] | [DATE] |
| Google (Gemini) | LLM inference | Conversation content | US | SCCs / Adequacy | [DATE] | [DATE] |
| Groq | LLM inference | Conversation content | US | SCCs | [DATE] | [DATE] |
| Neon (PostgreSQL) | Database | All personal data | US | SCCs | [DATE] | [DATE] |
| Redis/Upstash | Cache/KV | Session data | US/EU | SCCs | [DATE] | [DATE] |
| Cloudflare | CDN / Workers AI | Request metadata, AI | US | SCCs | [DATE] | [DATE] |
| [EMAIL_PROVIDER] | Email delivery | Email addresses | [COUNTRY] | [BASIS] | [DATE] | [DATE] |
| [ANALYTICS_PROVIDER] | Analytics | Usage events (anonymised) | [COUNTRY] | [BASIS] | [DATE] | [DATE] |
| GitHub | Source control | No personal data | US | N/A | N/A | N/A |

---

## PART D — Data Subject Rights Register

| Right | Implementation | SLA | Owner |
|-------|---------------|-----|-------|
| Access (Art. 15) | `gdpr-data-subject-rights.js` → handleAccessRequest() | 30 days | Engineering + Legal |
| Erasure (Art. 17) | `gdpr-data-subject-rights.js` → handleErasureRequest() | 30 days | Engineering |
| Rectification (Art. 16) | `gdpr-data-subject-rights.js` → handleRectificationRequest() | 30 days | Engineering |
| Portability (Art. 20) | `gdpr-data-subject-rights.js` → handlePortabilityRequest() | 30 days | Engineering |
| Object (Art. 21) | `gdpr-data-subject-rights.js` → handleObjectionRequest() | Immediate opt-out | Engineering |
| Restrict Processing (Art. 18) | Manual + technical controls | 30 days | Legal + Engineering |
| Withdraw Consent | `gdpr-privacy-middleware.js` consent controls | Immediate | Engineering |
| Lodge Complaint | Refer to supervisory authority | N/A | Legal |

**DSR Intake:** [DSR_PORTAL_URL] or email [PRIVACY_EMAIL]  
**Response SLA:** 30 calendar days (extendable 2× for complex requests)

---

*This document is maintained by HeadyMe's Data Protection Officer. Last review: [DATE]. Approved by: [NAME, TITLE].*
