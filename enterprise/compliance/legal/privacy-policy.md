# Privacy Policy
**HeadySystems Inc. (DBA Heady™) | headyme.com**

Version: 2.1.0  
Effective Date: 2026-03-01  
Last Updated: 2026-03-07

---

## 1. INTRODUCTION AND SCOPE

HeadySystems Inc. ("Heady", "we", "us", or "our"), operating headyme.com, is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our HeadyOS platform, HeadyMe AI services, APIs, and related services (collectively, "Services").

This Policy applies to:
- Visitors to headyme.com and all Heady-operated domains (headyconnection.com, headyos.com, heady-ai.com, headysystems.com)
- Registered users and account holders
- Enterprise customers and their authorized users
- API developers and SDK users
- Pilot program participants

For enterprise customers, the Data Processing Agreement (DPA) governs processing activities where Heady acts as a data processor. This Policy covers Heady's activities as a data controller.

**Contact:**  
HeadySystems Inc.  
Privacy Officer: privacy@headyme.com  
DPO: dpo@headyme.com  
Address: [HeadySystems Registered Address]

---

## 2. DATA WE COLLECT

### 2.1 Account Data
When you create an account, we collect:
- Full name and display name
- Email address (primary identifier)
- Organization name and role/title
- Authentication credentials (stored as bcrypt hash, never plaintext)
- Profile settings and preferences
- Subscription tier and billing information (payment tokens via Stripe, not raw card data)
- API keys (stored as SHA-256 hash prefixes only)

### 2.2 Usage Data
We automatically collect data about how you use our Services:
- API call logs (endpoint, timestamp, response code, latency)
- Feature usage metrics and session analytics
- Error logs and performance data
- Browser/client metadata (User-Agent, language, timezone)
- IP address and approximate geolocation (country/region)
- Referrer URLs and navigation patterns on headyme.com

**Retention**: Usage logs retained for **fib(11) = 89 days** from collection.

### 2.3 AI Interaction Data
When you use HeadyMe AI and HeadyOS brain services:
- Messages and prompts sent to AI models
- AI-generated responses
- Conversation history and thread context
- Model selection preferences
- Agent configuration settings (names, capabilities, workflows)
- Evaluation scores and feedback signals

**Retention**: AI interaction data retained for **fib(11) = 89 days** from collection (configurable per enterprise tenant).

### 2.4 Vector Memory Data
Our proprietary Heady Vector Memory service stores:
- Semantic embeddings generated from your content
- Memory keys and metadata you assign
- Memory retrieval logs (which keys were accessed and when)
- Namespace and collection configurations

**Retention**: Vector memory retained per tenant configuration (default fib(13) = 233 days).

### 2.5 Session Data
- Session identifiers (JWTs, refresh tokens)
- Active connection state
- WebSocket subscription channels
- Temporary computation state (Heady Cache/Redis)

**Retention**: Session data retained for **fib(9) = 34 days** after session end.

### 2.6 Technical and Device Data
- Device type, operating system, browser version
- Network information (ISP, connection type)
- Cookies and similar tracking technologies (see Section 10)
- OpenTelemetry traces and span data

---

## 3. HOW WE USE YOUR DATA

### 3.1 Service Delivery (Article 6(1)(b) GDPR — Contract)
- Authenticating and managing your account
- Processing API requests through HeadyOS microservices
- Delivering AI inference results (heady-brain, heady-infer)
- Running multi-agent orchestration workflows (heady-conductor)
- Executing MCP tool integrations (heady-mcp)
- Providing vector memory storage and retrieval (heady-vector)

### 3.2 Security and Fraud Prevention (Article 6(1)(f) GDPR — Legitimate Interest)
- Monitoring for unauthorized access and abuse
- SHA-256 chained audit logging for tamper-evident security records
- Rate limiting and DDoS protection
- Input validation and threat detection (8-pattern scanner)
- Output scanning (12-pattern scanner)
- Maintaining integrity of the platform for all users

### 3.3 Legal Compliance (Article 6(1)(c) GDPR — Legal Obligation)
- Responding to lawful government requests
- Maintaining financial and tax records
- Complying with GDPR, CCPA, and other applicable laws
- Honoring data subject rights requests

### 3.4 Analytics and Product Improvement (Article 6(1)(a) GDPR — Consent)
- Aggregated usage analytics to improve Services
- A/B testing of features
- Performance benchmarking and capacity planning

*You may withdraw consent for analytics at any time in Account Settings > Privacy.*

### 3.5 Communications (Article 6(1)(b) or (a) GDPR)
- Transactional emails (account, billing, security alerts) — Contract basis
- Product updates and newsletters — Consent basis

---

## 4. LEGAL BASIS FOR PROCESSING (GDPR)

| Processing Activity | Legal Basis | Article |
|---------------------|-------------|---------|
| Account creation and management | Contract performance | Art. 6(1)(b) |
| AI inference and brain services | Contract performance | Art. 6(1)(b) |
| Vector memory operations | Contract performance | Art. 6(1)(b) |
| Agent orchestration | Contract performance | Art. 6(1)(b) |
| Security monitoring and audit logging | Legitimate interests | Art. 6(1)(f) |
| Tax and financial record-keeping | Legal obligation | Art. 6(1)(c) |
| Analytics and service improvement | Consent | Art. 6(1)(a) |
| Marketing communications | Consent | Art. 6(1)(a) |
| DSAR processing | Legal obligation | Art. 6(1)(c) |

For legitimate interest processing, we conduct and document Legitimate Interests Assessments (LIAs), available upon request.

---

## 5. DATA SHARING AND DISCLOSURE

### 5.1 Service Providers (Sub-Processors)
We share data with vetted sub-processors who assist in delivering our Services:

| Provider | Purpose | Location |
|----------|---------|---------|
| Google Cloud Platform | Compute, storage, database | US/EU |
| Cloudflare | CDN, DDoS protection, Zero Trust | US/EU |
| Redis Ltd. | In-memory caching | US |
| Neon Inc. | PostgreSQL/pgvector database | US |
| Sentry | Error monitoring | US |
| Stripe | Payment processing | US |
| SendGrid | Transactional email | US |

All sub-processors are bound by data processing agreements providing equivalent protections.

### 5.2 AI Model Providers
If your account is configured to use third-party AI models (OpenAI, Anthropic, etc.), your prompts and context may be transmitted to those providers. We use their API services under separate agreements that limit training on your data. See your account's AI provider settings.

### 5.3 Enterprise Customer Sharing
Enterprise customers may configure integrations (Slack, Jira, GitHub, etc.). Data shared through integrations is governed by your configuration and the third-party's privacy policy.

### 5.4 Legal Disclosures
We may disclose data when:
- Required by court order, subpoena, or applicable law
- Necessary to protect Heady's legal rights
- Required to prevent imminent harm or illegal activity
- Directed by supervisory authorities with jurisdiction

We publish a Transparency Report at headyme.com/legal/transparency.

### 5.5 Business Transfers
In the event of a merger, acquisition, or asset sale, Personal Data may transfer to the acquiring entity, subject to the same privacy protections. We will notify you at least fib(7)=13 days before any such transfer.

### 5.6 No Sale of Personal Data
**We do not sell your Personal Data to third parties.** See Section 11 (California/CCPA) for your Do Not Sell rights.

---

## 6. INTERNATIONAL DATA TRANSFERS

HeadySystems Inc. is headquartered in the United States. If you are located in the EEA, UK, or Switzerland, your data is transferred to the US under:
- **Standard Contractual Clauses** (EU Commission Decision 2021/914, Module 1 Controller-to-Controller for users)
- **UK IDTA** or UK SCCs Addendum for UK residents

Additional safeguards:
- Encryption in transit (TLS 1.3) and at rest (AES-256)
- Contractual limitations on government access
- Transfer Impact Assessments maintained for all third-country transfers

For a copy of our SCCs or TIAs, contact dpo@headyme.com.

---

## 7. DATA RETENTION

| Data Category | Retention Period | Fibonacci Basis |
|---------------|-----------------|----------------|
| Session tokens | 34 days post-session | fib(9)=34 |
| Usage and API logs | 89 days | fib(11)=89 |
| AI interaction history | 89 days (configurable) | fib(11)=89 |
| Account data | Duration of account + 233 days | fib(13)=233 |
| Vector memory | 233 days (tenant-configurable) | fib(13)=233 |
| Audit trail (security events) | 233 days | fib(13)=233 |
| Financial records | 610 days (IRS/SOX compliance) | fib(15)=610 |
| Backup data | 89 days rolling | fib(11)=89 |
| Legal hold data | Duration of hold + 89 days | fib(11)=89 |

Upon account deletion, we initiate a soft-delete (removing from production systems immediately) followed by hard-delete from all systems within fib(9)=34 days, and backup purge within fib(11)=89 days.

---

## 8. YOUR DATA RIGHTS (GDPR)

### 8.1 Right of Access (Article 15)
You may request a copy of all Personal Data we hold about you. We provide a machine-readable export (JSON) via the DSAR portal at headyme.com/privacy/dsar or by emailing privacy@headyme.com.

**Response time:** Within 30 calendar days (extendable by 60 days for complex requests with notice).

### 8.2 Right to Rectification (Article 16)
You may correct inaccurate Personal Data via Account Settings or by contacting privacy@headyme.com.

### 8.3 Right to Erasure / "Right to be Forgotten" (Article 17)
You may request deletion of your Personal Data. Exceptions apply where retention is required by law (e.g., financial records) or for security/legal claims.

### 8.4 Right to Data Portability (Article 20)
You may receive your data in structured, commonly used, machine-readable format (JSON or CSV) and transmit it to another service. Available via headyme.com/privacy/export.

### 8.5 Right to Restriction (Article 18)
You may request restriction of processing in certain circumstances (e.g., while accuracy is contested).

### 8.6 Right to Object (Article 21)
You may object to processing based on legitimate interests or for direct marketing at any time.

### 8.7 Rights Related to Automated Decision-Making (Article 22)
HeadyOS uses automated processing (AI inference, agent orchestration) to deliver Services. Where this constitutes automated decision-making with legal or significant effects on individuals, you have the right to:
- Request human review
- Express your viewpoint
- Challenge the decision

### 8.8 Exercising Your Rights
Submit requests via:
- **Portal**: headyme.com/privacy/dsar
- **Email**: privacy@headyme.com
- **API**: `POST /api/v1/dsar` (authenticated)

We will verify your identity before processing requests. We respond within 30 days.

### 8.9 Supervisory Authority Complaints
EEA residents may lodge complaints with their local supervisory authority. UK residents may contact the ICO (ico.org.uk). Irish residents may contact the DPC (dataprotection.ie).

---

## 9. SECURITY

We implement industry-leading security measures including:

- **Encryption**: AES-256-GCM at rest, TLS 1.3 in transit
- **Access Control**: Zero-Trust, RBAC with JWT capability bitmask, MFA required for admin
- **Audit Logging**: SHA-256 chained tamper-evident logs
- **Threat Detection**: 8-pattern input validation, 12-pattern output scanning
- **Vulnerability Management**: CI/CD SAST/DAST pipelines, dependency scanning, secret scanning
- **Penetration Testing**: Annual third-party assessment
- **SOC 2 Type II**: In progress (see `compliance/soc2/`)

**Incident Reporting**: Report security vulnerabilities to security@headyme.com. We have a responsible disclosure policy at headyme.com/security.

---

## 10. COOKIE POLICY

### 10.1 Cookies We Use

| Cookie Name | Type | Purpose | Duration |
|-------------|------|---------|----------|
| `heady_session` | Strictly Necessary | Authentication session | Session |
| `heady_csrf` | Strictly Necessary | CSRF protection | Session |
| `heady_prefs` | Functional | User preferences (theme, language) | fib(11)=89 days |
| `heady_analytics` | Analytics (consent) | Usage analytics | fib(11)=89 days |
| `heady_consent` | Strictly Necessary | Consent record | fib(15)=610 days |
| `_cfuvid` | Third-Party (Cloudflare) | DDoS protection | Session |

### 10.2 Managing Cookies
- **Browser settings**: Block or delete cookies via your browser
- **Consent dashboard**: headyme.com/privacy/cookies
- **GPC signal**: We honor Global Privacy Control (GPC) browser signals

### 10.3 No Third-Party Advertising Cookies
We do not use third-party advertising or tracking cookies.

---

## 11. CALIFORNIA PRIVACY RIGHTS (CCPA/CPRA)

This section applies to California residents under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA).

### 11.1 Categories of Personal Information Collected (Cal. Civ. Code § 1798.100)

| CCPA Category | Examples | Business Purpose |
|---------------|---------|-----------------|
| Identifiers | Name, email, IP, account ID | Service delivery, security |
| Personal information (Cal. Civ. Code § 1798.80(e)) | Name, financial info | Billing, account management |
| Internet or network activity | Browsing, API logs | Security, analytics |
| Geolocation data | IP-based country/region | Compliance, content delivery |
| Inferences | AI interaction patterns, feature preferences | Service personalization |
| Sensitive Personal Information | Account credentials (hashed), precise location (if enabled) | Authentication, location features |

### 11.2 Sources of Personal Information
- Directly from you (account registration, API use)
- Automatically (usage logs, cookies)
- From enterprise customers (user provisioning)
- From integrated third-party services (with your authorization)

### 11.3 California Consumer Rights

**Right to Know** (§ 1798.110): Request disclosure of personal information collected, sources, purposes, and third-party sharing. Submit at headyme.com/privacy/dsar.

**Right to Delete** (§ 1798.105): Request deletion of personal information, subject to exceptions. Submit at headyme.com/privacy/dsar.

**Right to Correct** (§ 1798.106): Request correction of inaccurate personal information.

**Right to Opt-Out of Sale/Sharing** (§ 1798.120): We do not sell personal information. If this changes, you will be notified. Use the "Do Not Sell or Share My Personal Information" link at headyme.com/privacy/do-not-sell.

**Right to Limit Use of Sensitive Personal Information** (§ 1798.121): You may limit our use of sensitive personal information to what is necessary to perform Services.

**Right to Non-Discrimination** (§ 1798.125): Exercising CCPA rights will not result in discriminatory treatment or denial of Services.

### 11.4 Response Timeframe
We respond to California consumer requests within **45 calendar days** (extendable by 45 days with notice).

### 11.5 Authorized Agents
California residents may designate an authorized agent to submit requests. We verify agent authorization before processing.

### 11.6 Annual Data Collection Disclosure
Heady has not sold California residents' personal information in the preceding 12 months.

### 11.7 Contact for California Requests
Email: ccpa@headyme.com  
Portal: headyme.com/privacy/ccpa  
Toll-free: [1-800-XXX-XXXX]

---

## 12. CHILDREN'S PRIVACY

Our Services are not directed to persons under 18 years of age. We do not knowingly collect Personal Data from minors. If you believe we have collected data from a minor, contact privacy@headyme.com immediately.

---

## 13. CHANGES TO THIS POLICY

We may update this Privacy Policy to reflect changes in law, technology, or our practices. For material changes, we will:
- Post the updated policy at headyme.com/legal/privacy
- Email registered users at least fib(7)=13 days before the change takes effect
- Obtain fresh consent where legally required

---

## 14. CONTACT US

**Privacy Officer**: privacy@headyme.com  
**Data Protection Officer**: dpo@headyme.com  
**Security**: security@headyme.com  
**CCPA Requests**: ccpa@headyme.com  

**HeadySystems Inc. (DBA Heady™)**  
Founder/CEO: Eric Headington (eric@headyconnection.org)  
Website: https://headyme.com

---

*Document ID: HSI-PP-2026-002 | Version 2.1.0*
