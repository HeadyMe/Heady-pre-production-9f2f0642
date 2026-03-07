# Heady Platform — Threat Model

**Version:** 1.0  
**Date:** 2026-03-07  
**Framework:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)  
**Scope:** heady-manager Cloud Run service, Cloudflare edge workers, multi-provider AI inference pipeline, governance/auth layer  

---

## 1. System Overview

The Heady platform is an agentic AI orchestration system with the following trust boundaries:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Internet / Untrusted Zone                                                  │
│                                                                              │
│   Browsers / API Clients / Third-party Apps                                 │
│           │                                                                  │
│           ▼                                                                  │
│   ┌──────────────────────────────────────────────────────────────┐          │
│   │  TRUST BOUNDARY 1: Cloudflare Edge                           │          │
│   │  - worker-api-gateway.js  (rate limiting, WAF, DDoS)         │          │
│   │  - worker-auth-service.js (JWT pre-validation, key rotation) │          │
│   └──────────────────────────────────────────────────────────────┘          │
│           │  (authenticated + sanitized requests only)                       │
│           ▼                                                                  │
│   ┌──────────────────────────────────────────────────────────────┐          │
│   │  TRUST BOUNDARY 2: Cloud Run (heady-manager)                 │          │
│   │  - GovernanceEngine  - AuthManager  - PolicyEngine           │          │
│   │  - SagaOrchestrator  - CircuitBreaker  - ConnectionPool      │          │
│   │  - Inference Gateway (multi-provider AI calls)               │          │
│   └──────────────────────────────────────────────────────────────┘          │
│           │                    │                    │                        │
│           ▼                    ▼                    ▼                        │
│   ┌──────────────┐   ┌────────────────┐   ┌─────────────────────┐          │
│   │ TRUST         │   │ TRUST          │   │ TRUST               │          │
│   │ BOUNDARY 3:   │   │ BOUNDARY 4:    │   │ BOUNDARY 5:         │          │
│   │ Database      │   │ AI Providers   │   │ HeadyKV / Redis     │          │
│   │ (pgvector,    │   │ (OpenAI, Groq, │   │ (session / token    │          │
│   │  RLS enabled) │   │  Gemini, etc.) │   │  store)             │          │
│   └──────────────┘   └────────────────┘   └─────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Assets and Crown Jewels

| Asset | Classification | Impact if Compromised |
|-------|---------------|----------------------|
| JWT signing secret (`JWT_SECRET`) | CRITICAL | Full authentication bypass; forge any role |
| Refresh tokens in HeadyKV | CRITICAL | Persistent session hijacking (30-day window) |
| API keys (hashed in KV) | HIGH | Service impersonation; cost abuse |
| pgvector embeddings (per-tenant) | HIGH | Cross-tenant data leakage; PII exposure |
| AI provider API keys (GROQ, GOOGLE, OPENAI, ANTHROPIC) | HIGH | Cost theft; data exfiltration via API |
| Governance audit trail | HIGH | Repudiation; regulatory non-compliance (GDPR Art. 30) |
| Policy definitions | MEDIUM | Business logic bypass; privilege escalation |
| System prompts / Heady principles | MEDIUM | Intellectual property theft; jailbreak facilitation |
| Health route system metadata | LOW | Fingerprinting; reconnaissance for attacks |

---

## 3. Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|-----------|
| External attacker (opportunistic) | Financial gain, notoriety | Script kiddie to moderate skill; exploit scanners |
| External attacker (targeted) | IP theft, API cost abuse, competitive intelligence | High skill; tailored attacks |
| Malicious tenant | Cross-tenant data access, cost shifting | Moderate; deep knowledge of API surface |
| Compromised AI provider response | Prompt injection, data exfiltration | Indirect; relies on LLM output trust |
| Insider threat (developer) | Sabotage, data theft | Highest; source access; key access |
| Supply chain attacker | Persistent access via dependency | Moderate to high; long-term |

---

## 4. STRIDE Threat Catalog

### 4.1 Spoofing

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| S-001 | JWT forgery via weak/leaked secret | Authentication | **CRITICAL** | Complete auth bypass | Enforce 256-bit entropy JWT_SECRET; no fallback; HMAC-SHA256 signing |
| S-002 | Refresh token theft + replay | Session management | HIGH | Persistent session hijack | Token rotation; reuse detection; fingerprint binding |
| S-003 | API key brute force | Service auth | HIGH | API cost theft; data access | HMAC-SHA256 + pepper hashing; rate limit auth endpoints; key prefix validation |
| S-004 | OAuth2 state CSRF forgery | OAuth flow | MEDIUM | Account linking hijack | State stored in KV with 10min TTL; validated before token exchange |
| S-005 | AI provider impersonation via DNS/BGP hijack | Inference gateway | LOW | Data exfiltration to attacker | Certificate pinning on AI provider endpoints; TLS 1.3 |

### 4.2 Tampering

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| T-001 | Policy definition injection via admin API | PolicyEngine | HIGH | Business logic bypass; privilege escalation | Validate policy definitions at load; remove CUSTOM fn operator; signed policy bundles |
| T-002 | Audit trail modification | GovernanceEngine audit trail | MEDIUM | Repudiation; regulatory violation | SHA-256 hash chain; append-only store; off-process archival |
| T-003 | JWT payload tampering | Access control | CRITICAL | Role escalation | Algorithm validation in HeadyJWT; reject `alg: none`; reject unexpected algorithms |
| T-004 | Config file path traversal (RuleZGatekeeper) | Schema validation | MEDIUM | Arbitrary file read; schema bypass | jailPath() validation; normalize all file paths |
| T-005 | Saga context mutation (compensation phase) | Distributed transactions | MEDIUM | Data corruption on rollback | Deep-copy context before compensation; idempotency keys |
| T-006 | Prototype pollution via JSON body | Node.js runtime | MEDIUM | RCE / logic bypass | safeJsonParser() middleware; reject `__proto__` keys |

### 4.3 Repudiation

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| R-001 | Admin denies performing privileged action | Audit trail | MEDIUM | Non-compliance; incident investigation failure | All admin actions write to durable hash-chained audit log (no admin bypass) |
| R-002 | In-process audit trail lost on crash | Governance audit | HIGH | GDPR Art. 30 violation | Flush audit to external store (PostgreSQL, BigQuery) in real time |
| R-003 | AI inference output deniability | AI response logging | MEDIUM | Hallucination / harmful output disputes | Log all inference inputs/outputs with provenance; redact PII before storage |

### 4.4 Information Disclosure

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| I-001 | JWT secret in environment leak | Credentials | HIGH | Full auth bypass | Secret manager (GCP Secret Manager); never log env vars; rotate on any suspicion |
| I-002 | Health route system info exposure | Process internals | HIGH | Reconnaissance (version, PID, memory) | Auth guard on /health/full; expose only aggregated status to untrusted callers |
| I-003 | Prompt injection → system prompt extraction | AI system prompts | HIGH | IP theft; jailbreak facilitation | 5-layer prompt injection guard; never include secrets in system prompts |
| I-004 | Cross-tenant pgvector data leakage | RLS / data isolation | HIGH | PII exposure; regulatory violation | Enforce RLS on all queries; tenant_id in every query; audit cross-tenant access patterns |
| I-005 | AI provider API key logging | Credentials | MEDIUM | API cost theft; unauthorized model access | Never log API keys; use KMS for storage; rotate quarterly |
| I-006 | Error message information leakage | API responses | MEDIUM | Stack traces, internal paths, DB schema | Return generic error messages in production; structured internal logging only |
| I-007 | Token in URL query parameter | Session tokens | LOW | Token logged in server/proxy access logs | Enforce Authorization header only; reject tokens in URL params |

### 4.5 Denial of Service

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| D-001 | Rate limit bypass via horizontal scaling | Inference gateway | HIGH | AI API cost exhaustion; service degradation | Distributed rate limiting via Redis/Cloudflare KV sliding window |
| D-002 | Cascading circuit breaker failure (thundering herd) | Service resilience | MEDIUM | Total service outage | BreakerRegistry cascade detection; bulkhead isolation; HALF_OPEN single-probe guard |
| D-003 | Saga compensation loop (hanging compensation) | Distributed transactions | MEDIUM | Resource lock; data inconsistency | Per-step compensation timeout; max retry with backoff; dead-letter queue |
| D-004 | Connection pool exhaustion | ConnectionPool | MEDIUM | Service unavailability | Pool queue limits; timeout; circuit breaker integration |
| D-005 | Large payload DoS (JSON body bomb) | Express server | MEDIUM | Memory exhaustion; crash | Request body size limits (express.json({ limit: '1mb' })); request sanitizer |
| D-006 | ReDoS via malicious regex input in PolicyEngine | Policy evaluation | LOW | Event loop stall | Use atomic regexes; timeout policy evaluation; avoid user-supplied regex values |
| D-007 | Approval queue flood (PENDING decisions) | GovernanceEngine | LOW | Queue saturation; delayed approvals | Rate limit PENDING actions per user; auto-expire stale approvals |

### 4.6 Elevation of Privilege

| ID | Threat | Target | Likelihood | Impact | Mitigation |
|----|--------|--------|------------|--------|------------|
| E-001 | Admin token forgery (CRIT-001 + CRIT-002) | Governance bypass | **CRITICAL** | Full platform control | Fix JWT_SECRET fallback; remove admin governance bypass; step-up for sensitive actions |
| E-002 | Role upgrade via JWT payload injection | RBAC | HIGH | Privilege escalation to admin | Validate role against known set at token creation AND verification |
| E-003 | CUSTOM policy fn code injection | PolicyEngine | HIGH | Node.js RCE | Remove CUSTOM condition operator; sandbox custom logic |
| E-004 | OAuth2 code exchange without redirect_uri validation | OAuth flow | MEDIUM | Token theft via open redirect | Validate redirect_uri against allowlist before exchange |
| E-005 | Session fixation attack | Session management | MEDIUM | Session takeover | Regenerate sessionId on privilege change (login, role update) |
| E-006 | Insufficient step-up check bypass | Sensitive operations | MEDIUM | Unauthorized admin action | stepUpConfirmed flag must be validated server-side; never from client input |

---

## 5. Attack Trees

### 5.1 Full Platform Takeover (Most Critical Path)

```
[Attacker gains admin-level platform control]
│
├── [Forge admin JWT]
│   ├── [Obtain JWT_SECRET] ← CRIT-001 (fallback to known default)
│   │   ├── Source code access (public repo or insider)
│   │   ├── Environment variable leak (logging, metadata API)
│   │   └── KV store exfiltration
│   └── [Exploit algorithm confusion (alg:none)] ← T-003
│
├── [Steal admin session token]
│   ├── XSS → cookie/localStorage theft (no SameSite/HttpOnly)
│   ├── MITM (TLS downgrade) 
│   └── Refresh token reuse after rotation
│
└── [Bypass governance after getting token] ← CRIT-002
    └── Admin bypass removed in v2 — now requires step-up
```

### 5.2 AI Inference Cost Abuse

```
[Attacker exhausts AI API credits]
│
├── [Bypass rate limiting]
│   ├── In-process rate limit × N instances = effective N× limit ← HIGH-004
│   └── Rotating IPs (no per-user distributed limit)
│
├── [Forge high-cost inference requests]
│   └── Provide large estimatedTokens=0 (underreported cost in payload)
│
└── [Obtain valid API key]
    ├── Brute force (no lockout on API key validation)
    └── Credential exposure scan failure
```

---

## 6. Data Flow Security Analysis

### 6.1 Authentication Flow

```
Client → [Bearer <JWT>] → requireRole middleware
           │
           ├─ [CRIT-001 risk] Missing secret → forgeable token
           ├─ [HIGH-006 risk] No strict Bearer enforcement → WAF bypass
           ├─ Revocation check (RevocationList) ← NEW in auth-hardening.js
           ├─ Fingerprint check (IP + UA) ← NEW in auth-hardening.js
           └─ Role hierarchy check → req.user
```

### 6.2 Governance Flow

```
Action Request → GovernanceEngine.validateAction()
                  │
                  ├─ Access Control (no admin bypass) ← FIXED
                  ├─ Step-up check for sensitive actions ← NEW
                  ├─ Budget Limits (windowed correctly) ← FIXED
                  ├─ Content Safety (expanded patterns) ← IMPROVED
                  ├─ Mission Alignment (regex, not includes) ← FIXED
                  ├─ Policy Engine (no CUSTOM fn) ← FIXED
                  └─ Durable hash-chained audit write ← NEW
```

### 6.3 AI Inference Flow (Risk Surface)

```
User Input → [Prompt Injection Guard L1-L5] → PolicyEngine
                                                │
                                                ▼
                                     InferenceGateway.complete()
                                                │
                                    ┌───────────┴───────────┐
                                    │                       │
                              [CircuitBreaker]         [ConnectionPool]
                                    │
                              [Groq/Gemini/Claude/OpenAI]
                                    │
                              Response → [Output validation]
                                              │
                                         [Audit log]
```

---

## 7. Residual Risks and Accepted Trade-offs

| Risk | Acceptance Rationale | Review Date |
|------|---------------------|-------------|
| Fingerprint mismatch on mobile users (IP changes) | Fingerprint is warn-only by default; mobile UX preserved | Q3 2026 |
| In-memory RevocationList lost on restart | Sessions self-expire via JWT TTL (1h max); acceptable for current scale | Q2 2026 |
| OAuth2 stub not production-ready | Not yet in active use; must complete before enabling third-party SSO | Q2 2026 |
| pgvector RLS not audited in this scan | Separate DB security review required | Q2 2026 |
| Supply chain (transitive dependencies) | Dependabot + lockfile pinning; SBOM generation outstanding | Q2 2026 |

---

## 8. Compliance Mapping

| Control | Framework | Implementation |
|---------|-----------|---------------|
| Immutable audit log | GDPR Art. 30 | SHA-256 hash-chain in InMemoryAuditSink (needs DB sink for durability) |
| Data residency | GDPR Art. 44-49 | pgvector + Cloud Run in selected GCP region; AI providers US/EU |
| Access control | SOC 2 CC6 | RBAC via AuthManager + GovernanceEngine |
| Vulnerability disclosure | ISO 27001 A.12.6.1 | SECURITY.md responsible disclosure program |
| Encryption in transit | PCI DSS 4.2 | TLS 1.3 enforced via HSTS |
| Encryption at rest | PCI DSS 3.4 | AES-256 at rest (GCP default) |
| Secrets management | NIST SP 800-57 | GCP Secret Manager for production; rotation automation needed |
| Session timeout | NIST SP 800-63B | 8h session TTL; 30-day refresh (review: reduce to 7 days) |

---

## 9. Priority Remediation Roadmap

| Priority | Finding | Owner | Target |
|----------|---------|-------|--------|
| P0 — This Week | CRIT-001: JWT_SECRET fallback removed | Auth lead | 2026-03-14 |
| P0 — This Week | CRIT-002: Admin governance bypass removed | Platform lead | 2026-03-14 |
| P1 — This Sprint | HIGH-004: Distributed rate limiting (Redis) | Infra | 2026-03-28 |
| P1 — This Sprint | HIGH-005: Implement edge worker stubs | Edge team | 2026-03-28 |
| P1 — This Sprint | CRIT-003: Saga compensation timeouts + DLQ | Backend | 2026-03-28 |
| P2 — Next Sprint | HIGH-001/002: Circuit breaker sliding window + probe guard | Platform | 2026-04-11 |
| P2 — Next Sprint | MED-004: Durable audit trail (PostgreSQL sink) | Data/Infra | 2026-04-11 |
| P2 — Next Sprint | HIGH-009: Prompt injection classifier integration | AI Safety | 2026-04-11 |
| P3 — Q2 | OAuth2 OIDC implementation (replace stubs) | Auth team | 2026-06-30 |
| P3 — Q2 | SBOM generation + supply chain audit | Security | 2026-06-30 |
| P3 — Q2 | pgvector RLS penetration test | External audit | 2026-06-30 |

---

*This threat model should be reviewed and updated quarterly or after any significant architecture change.*  
*Contact: security@headyconnection.org*
