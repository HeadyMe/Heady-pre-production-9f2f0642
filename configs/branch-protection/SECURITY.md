# Security Policy

## Overview

This document describes the security policy for the **HeadyMe** organization and all repositories under the [HeadyMe GitHub organization](https://github.com/HeadyMe).

HeadyMe operates AI infrastructure that processes sensitive data across HIPAA, GDPR, and SOC 2 frameworks. We take security vulnerabilities seriously and appreciate responsible disclosure from the security research community.

---

## Supported Versions

We actively maintain and provide security patches for the following versions:

| Repository | Supported Versions | Status |
|---|---|---|
| Heady-pre-production-9f2f0642 | `main` branch (v3.x) | ✅ Active |
| headysystems-production | `main` branch (current) | ✅ Active |
| headymcp-production | `main` branch (current) | ✅ Active |
| headyio-core | `main` branch | ✅ Active |
| headybot-core | `main` branch | ✅ Active |
| headybuddy-core | `main` branch | ✅ Active |
| headyapi-core | `main` branch | ✅ Active |
| headyos-core | `main` branch | ✅ Active |
| headymcp-core | `main` branch | ✅ Active |
| headyconnection-core | `main` branch | ✅ Active |
| headysystems-core | `main` branch | ✅ Active |
| headyme-core | `main` branch | ✅ Active |
| heady-docs | `main` branch | ✅ Active |

**Unsupported versions** (no longer receive security patches):
- Any version prior to v3.0.0 of Heady-pre-production-9f2f0642
- Any non-`main` branch (dev, staging, feature branches)

---

## Reporting a Vulnerability

### Please DO NOT report security vulnerabilities via GitHub Issues, Discussions, or public forums.

Public disclosure of an unpatched vulnerability puts all users at risk. We request that you follow responsible disclosure and give us time to investigate and patch before any public disclosure.

### Reporting Channels

**Primary — GitHub Private Security Advisory (preferred):**

Use GitHub's built-in private vulnerability reporting:
[https://github.com/HeadyMe/Heady-pre-production-9f2f0642/security/advisories/new](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/security/advisories/new)

This creates an encrypted, private thread visible only to repository security contacts and the reporter.

**Secondary — Email:**

Send an encrypted email to: **security@headyme.com**

For maximum confidentiality, encrypt your report using our PGP public key (see below).

**Tertiary — Encrypted contact form:**

[https://headyme.com/security/report](https://headyme.com/security/report) *(end-to-end encrypted)*

### What to Include in Your Report

To help us triage and respond quickly, please include:

1. **Affected component(s)** — repository name, file path, function/endpoint
2. **Vulnerability type** — e.g., injection, authentication bypass, data exposure, SSRF, RCE, privilege escalation
3. **Severity assessment** — your CVSS score estimate (if applicable)
4. **Description** — clear explanation of the vulnerability
5. **Reproduction steps** — step-by-step instructions to reproduce the issue
6. **Proof of concept** — code, screenshots, or video demonstrating the issue (no actual exploitation of real user data)
7. **Impact analysis** — what data or systems could be affected, and how
8. **Suggested fix** — optional, but appreciated

---

## Security Update Process

### Response Timeline

We commit to the following response times:

| Severity | Initial Response | Patch Target | Public Disclosure |
|---|---|---|---|
| Critical (CVSS 9.0–10.0) | 4 hours | 48 hours | After patch + 7 days |
| High (CVSS 7.0–8.9) | 24 hours | 7 days | After patch + 14 days |
| Medium (CVSS 4.0–6.9) | 72 hours | 30 days | After patch + 30 days |
| Low (CVSS 0.1–3.9) | 7 days | 90 days | After patch + 30 days |
| Informational | 14 days | Next release | At reporter's discretion |

*All times are business hours (Mountain Time, UTC-7/UTC-6).*

### What Happens After You Report

1. **Acknowledgment** — You receive confirmation of receipt within the timeline above.
2. **Triage** — Our security team ([@HeadyMe/security-team](https://github.com/orgs/HeadyMe/teams/security-team)) assesses severity and reproduces the issue.
3. **Communication** — We keep you updated on progress. We may ask follow-up questions.
4. **Patch Development** — Fix is developed in a private branch and reviewed by at least 2 security team members.
5. **CVE Assignment** — For qualifying vulnerabilities, we request a CVE through GitHub or MITRE.
6. **Release** — Patch is released across all affected supported versions.
7. **Credit** — With your permission, we add you to our Security Hall of Fame and the security advisory acknowledgments.
8. **Public Disclosure** — Advisory is published after the coordinated disclosure period.

### Security Patch Distribution

Security patches are distributed as:
- Patch releases on the `main` branch
- GitHub Security Advisory with CVE (where applicable)
- Notification to registered API customers (Critical/High only)
- Email to security@headyme.com mailing list subscribers

---

## Responsible Disclosure Policy

### Our Commitment to Researchers

If you responsibly disclose a security vulnerability, HeadyMe commits to:

- **Not pursue legal action** against researchers who discover and report vulnerabilities in good faith, provided they:
  - Do not access, modify, or delete user data beyond what is necessary to demonstrate the vulnerability
  - Do not perform denial-of-service attacks
  - Do not exploit vulnerabilities against live user data or production systems with real user data
  - Report findings promptly to security@headyme.com before any public disclosure
  - Give us reasonable time to patch before public disclosure (see timelines above)
- **Acknowledge your contribution** in security advisories (with your consent)
- **Keep you informed** of the status of your report
- **Work collaboratively** to understand and address the issue

### Safe Harbor

We consider security research conducted in compliance with this policy to constitute "authorized" conduct. We will not take legal action against you or refer you to law enforcement for research conducted in good faith under this policy.

If you have any doubt about whether your research complies with this policy, contact us at security@headyme.com before proceeding.

### Out of Scope

The following are **not** eligible for security reports:

- Vulnerabilities in third-party services we use (report directly to those vendors)
- Vulnerabilities requiring physical access to a device
- Social engineering, phishing, or attacks against HeadyMe employees
- Denial-of-service attacks
- Findings from automated scanners submitted without manual verification or a clear exploitation path
- Rate limiting issues without demonstrated security impact
- Missing security headers on non-sensitive pages (low/informational only)
- Issues already known to us (check existing advisories first)
- Vulnerabilities in unsupported versions

---

## Bug Bounty

HeadyMe currently operates a **private, invite-only bug bounty program**. If you are interested in participating, email security@headyme.com with your background and prior CVEs/research.

---

## PGP Key for Encrypted Reports

Use this PGP public key to encrypt sensitive vulnerability reports sent via email to security@headyme.com.

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: HeadyMe Security Team <security@headyme.com>
Comment: Key ID: heady-security-2026
Comment: Fingerprint: Replace with actual fingerprint after key generation
Comment:
Comment: INSTRUCTIONS FOR KEY MANAGEMENT:
Comment: 1. Generate a 4096-bit RSA or ed25519 key:
Comment:    gpg --full-gen-key
Comment: 2. Export public key:
Comment:    gpg --armor --export security@headyme.com
Comment: 3. Replace this placeholder block with the exported key
Comment: 4. Upload to: https://keys.openpgp.org
Comment: 5. Update fingerprint in SECURITY.md
Comment:
[REPLACE THIS BLOCK WITH ACTUAL PGP PUBLIC KEY]
-----END PGP PUBLIC KEY BLOCK-----
```

**Key Details (update after generation):**
- **Key ID:** `[REPLACE]`
- **Fingerprint:** `[REPLACE]`
- **Key server:** https://keys.openpgp.org/search?q=security%40headyme.com
- **Created:** 2026-03-07
- **Expires:** 2028-03-07
- **Algorithm:** ed25519 + cv25519

> ⚠️ **Key Management Note:** The PGP key must be rotated before expiry. The security team is responsible for rotation. The private key is stored in the organization's hardware security module (HSM) and is never stored in this repository.

---

## Security Contacts

| Role | Contact | Availability |
|---|---|---|
| Security Team Lead | security@headyme.com | 24/7 for Critical |
| GitHub Security Advisory | [Private advisory](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/security/advisories/new) | 24/7 |
| Engineering Lead | Available via GitHub @HeadyMe/security-team | Business hours |

---

## Security Hall of Fame

We thank the following researchers for their responsible disclosure (listed with permission):

*No entries yet — be the first!*

---

## Security Standards and Compliance

HeadyMe's security program is built on the following frameworks:

- **OWASP Top 10** — Web application security
- **OWASP LLM Top 10** — AI/LLM security (prompt injection, insecure output handling, etc.)
- **NIST Cybersecurity Framework** — Organizational security
- **SOC 2 Type II** — Security, Availability, and Confidentiality trust service criteria
- **HIPAA** — Protected Health Information safeguards
- **GDPR** — EU data protection (Art. 25 privacy by design, Art. 30 audit logs, Art. 32 security measures)

---

*Last updated: 2026-03-07*  
*This policy applies to all repositories under the [HeadyMe GitHub organization](https://github.com/HeadyMe).*
