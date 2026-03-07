# HeadySystems Bug Bounty Program

**Program Name:** HeadySystems Responsible Disclosure & Bug Bounty  
**Program Version:** 3.2.2  
**Operator:** HeadySystems Inc. (DBA Heady™)  
**Contact:** security@headysystems.com  
**PGP Key:** Available at https://headysystems.com/.well-known/security.txt  
**Last Updated:** 2026-03-07  
**Status:** OPEN — Accepting Reports  

All reward amounts use Fibonacci numbers derived from φ=1.618033988749895.

---

## 1. Program Overview

HeadySystems welcomes security researchers who identify vulnerabilities in our platform. We believe in responsible disclosure and reward researchers who help us improve security for our users. This program covers all public-facing components of HeadySystems v3.2.2.

---

## 2. Scope

### 2.1 In-Scope Targets

| Target | Type | Priority |
|---|---|---|
| headyme.com | Web application | P1 |
| headyconnection.com | Web application | P1 |
| headyconnection.org | Web application | P1 |
| headyos.com | Web application | P1 |
| headyex.com | Web application | P1 |
| headyfinance.com | Web application | P1 |
| headysystems.com | Web application | P2 |
| heady-ai.com | Web application | P2 |
| api.headyme.com | REST API | P1 |
| wss://headyme.com/ws | WebSocket | P1 |
| MCP Gateway (/api/mcp) | AI tool gateway | P1 |
| Authentication (/auth) | Auth flow | P1 |
| Mobile/browser SDKs | Client libraries | P2 |

### 2.2 Out-of-Scope

The following are **NOT** eligible for rewards:

- Vulnerabilities in third-party services (Cloudflare, Google Cloud infrastructure, GitHub)
- Issues requiring physical access to HeadySystems hardware
- Social engineering attacks on HeadySystems employees
- Denial of Service (DoS/DDoS) attacks — do not test
- Automated scanning without rate limiting (will trigger WAF block)
- Vulnerabilities in out-of-date browser/OS versions with no recent patch
- Missing "security best practice" headers without demonstrated impact
- Clickjacking on pages with no sensitive actions
- Missing rate limiting on non-sensitive endpoints
- Self-XSS (requires user to execute their own attack)
- CSV injection without demonstrated impact
- Login/logout CSRF with no demonstrated impact
- Email enumeration without demonstrated exploitation path
- Vulnerabilities requiring root/jailbreak on victim device

---

## 3. Reward Schedule (Fibonacci-Based)

All rewards in USD. Fibonacci numbers reflect HeadySystems' φ-ratio design philosophy.

| Severity | CVSS Score | Reward | Fibonacci Ref |
|---|---|---|---|
| **CRITICAL** | 9.0 – 10.0 | **$fib(16)=987** | fib(16) |
| **HIGH** | 7.0 – 8.9 | **$fib(14)=377** | fib(14) |
| **MEDIUM** | 4.0 – 6.9 | **$fib(12)=144** | fib(12) |
| **LOW** | 0.1 – 3.9 | **$fib(10)=55** | fib(10) |
| **INFO/Enhancement** | 0.0 | Recognition + Hall of Fame | — |

### 3.1 Bonus Rewards

| Achievement | Bonus |
|---|---|
| Novel attack vector on MCP tool injection | +$fib(13)=233 |
| Full chain exploit (multiple vulns combined) | +$fib(13)=233 |
| Vulnerability in PQC implementation (ML-KEM-768, ML-DSA) | +$fib(14)=377 |
| Bypass of zero-trust MCP sandbox | +$fib(14)=377 |
| Cross-tenant vector memory data leakage | +$fib(14)=377 |
| Agent prompt injection with data exfiltration | +$fib(14)=377 |
| Audit chain integrity bypass (SHA-256 chain break) | +$fib(15)=610 |
| First critical report of the quarter | +$fib(11)=89 |

### 3.2 Reduced/No Reward Conditions

Rewards may be reduced or denied for:
- Duplicate reports (first reporter receives full reward; duplicates receive $fib(5)=5)
- Reports that were already known internally
- Vulnerabilities that were disclosed publicly before reporting to HeadySystems
- Findings with minimal security impact beyond theoretical
- Reports without proof-of-concept or reproduction steps
- Violations of rules of engagement

---

## 4. Eligibility & Rules of Engagement

### 4.1 Who May Participate

Any individual security researcher not currently employed by or contracting with HeadySystems. HeadySystems employees and contractors are ineligible.

### 4.2 Testing Rules

**You MAY:**
- Test against your own accounts and test data
- Use automated scanning tools with rate limiting (≤ fib(10)=55 req/s)
- Conduct research during any hours (system monitored 24/7)
- Keep a local copy of proof-of-concept evidence
- Request additional test accounts from security@headysystems.com

**You MUST NOT:**
- Access, modify, or delete real user data
- Perform DoS or DDoS attacks
- Spam or social engineer HeadySystems users or employees
- Conduct physical attacks or break into facilities
- Exploit vulnerabilities beyond what is necessary to prove existence
- Share, sell, or publish vulnerability details before 90-day coordinated disclosure window
- Violate any applicable law in your jurisdiction
- Test production systems in a way that may impact availability

### 4.3 Account Provisioning

Request test accounts at: security@headysystems.com with subject "Bug Bounty — Test Account Request"

We will provide:
- fib(3)=2 standard test accounts
- 1 account with elevated permissions (on request with justification)
- Sandbox environment access for MCP/AI testing

---

## 5. Reporting Process

### 5.1 How to Report

1. **Email:** security@headysystems.com
2. **Subject:** `[BUG BOUNTY] Brief description — Severity level`
3. **Encrypt report** with our PGP key for HIGH/CRITICAL findings (key at security.txt)
4. **Include in report:**
   - Clear title and one-sentence summary
   - Affected endpoint/component/domain
   - CVSS v3.1 score (base vector string)
   - Step-by-step reproduction instructions
   - Proof of concept (screenshots, HTTP dumps, code)
   - Potential impact assessment
   - Suggested remediation (optional but appreciated)
   - Your desired payout method (wire/Wise/cryptocurrency)

### 5.2 Report Template

```
Subject: [BUG BOUNTY] [Brief title] — [CRITICAL/HIGH/MEDIUM/LOW]

== SUMMARY ==
One sentence description.

== AFFECTED COMPONENT ==
Domain: headyme.com
Endpoint: /api/brain/chat
Type: [SQLi / XSS / IDOR / Auth bypass / etc.]

== CVSS v3.1 ==
Base Score: X.X
Vector: AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

== REPRODUCTION STEPS ==
1. [Step 1]
2. [Step 2]
3. [Step 3 — observed vulnerability]

== PROOF OF CONCEPT ==
[Screenshots / HTTP request dumps / code]

== IMPACT ==
[What an attacker could achieve]

== SUGGESTED REMEDIATION ==
[Optional]
```

---

## 6. Response SLAs

HeadySystems commits to the following response timelines (φ-Fibonacci):

| Action | Timeline |
|---|---|
| Initial acknowledgment | fib(6)=8 business hours |
| Initial assessment (triage) | fib(5)=5 business days |
| Severity confirmation | fib(7)=13 business days |
| Status updates | Every fib(7)=13 business days |
| CRITICAL patch timeline | fib(3)=2 business days |
| HIGH patch timeline | fib(5)=5 business days |
| MEDIUM patch timeline | fib(7)=13 business days |
| LOW patch timeline | fib(9)=34 business days |
| Reward payment | fib(8)=21 business days after triage |

---

## 7. Safe Harbor

HeadySystems provides safe harbor to researchers who:
- Follow all rules of engagement in this program
- Act in good faith to avoid privacy violations and service disruption
- Report vulnerabilities promptly without exploiting them beyond proof-of-concept
- Do not share findings publicly until the coordinated disclosure window closes

**HeadySystems will:**
- Not pursue legal action against researchers who comply with this policy
- Work with researchers to understand and address issues
- Provide credit in security advisories (with researcher consent)
- Not require researchers to sign NDAs as a condition of receiving reward

**Coordinated disclosure window:**
- Standard: fib(9)=34 days from report acknowledgment
- Extension available: fib(8)=21 additional days by mutual agreement
- After 90 days (fib(11)=89 + fib(6)=8 ≈ 97 days): researcher may publish regardless of fix status

---

## 8. Hall of Fame

HeadySystems maintains a public Hall of Fame at https://headysystems.com/security/hall-of-fame

Researchers who find valid security issues are listed with their name/handle (with consent) and the severity/type of finding.

Top contributors receive:
- Annual recognition
- HeadySystems swag
- Letter of recognition for professional use

---

## 9. Payout Methods

| Method | Available |
|---|---|
| Wire transfer (USD) | Yes |
| Wise / TransferWise | Yes |
| Bitcoin (BTC) | Yes |
| Ethereum (ETH) | Yes |
| PayPal | Yes (for amounts < $fib(13)=233) |

Tax forms may be required for US residents per IRS requirements. International researchers may need to provide W-8BEN.

---

## 10. Priority Vulnerability Categories

We are especially interested in:

1. **MCP Tool Injection** — Injecting malicious tool calls through the MCP gateway
2. **Agent Prompt Injection** — Hijacking bee agent actions via crafted inputs
3. **Vector Memory Poisoning** — Corrupting the vector store to influence AI responses
4. **Cross-Tenant Data Leakage** — Accessing vector memory or sessions across tenant boundaries
5. **WebSocket Hijacking** — Session takeover via WebSocket
6. **CSL Gate Manipulation** — Manipulating the Consciousness Level scoring system
7. **PQC Implementation Flaws** — Weaknesses in ML-KEM-768 or ML-DSA implementation
8. **Audit Chain Bypass** — Breaking the SHA-256 audit log chain integrity
9. **JWT Capability Bitmask Escalation** — Gaining higher RBAC permissions
10. **Rate Limiter Bypass** — Bypassing the 4-layer rate limiting system

---

## 11. Contact

**Security Team:** security@headysystems.com  
**CEO (critical issues):** eric@headyconnection.org  
**Website:** https://headysystems.com/security  
**Security.txt:** https://headysystems.com/.well-known/security.txt  

---

*Bug Bounty Program v3.2.2 | φ=1.618033988749895*  
*Reward Schedule: CRITICAL=$987, HIGH=$377, MEDIUM=$144, LOW=$55 (Fibonacci sequence)*  
*See also: `SECURITY.md`, `security/vulnerability/vulnerability-management.md`*
