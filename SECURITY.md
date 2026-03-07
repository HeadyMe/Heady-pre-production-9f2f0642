# Security Policy — HeadySystems™

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | ✅ Active  |
| 2.x     | ⚠️ Critical fixes only |
| < 2.0   | ❌ End of life |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

### Responsible Disclosure Process

1. **Email**: <security@headysystems.com>
2. **PGP Key**: Available at <https://headysystems.com/.well-known/pgp-key.txt>
3. **Response Time**: We will acknowledge within **24 hours** and provide a fix timeline within **72 hours**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if applicable)

### Scope

In scope:

- Authentication/authorization bypasses
- API key or credential exposure
- Injection vulnerabilities (SQL, NoSQL, command, XSS)
- Insecure deserialization
- SSRF, MCP protocol vulnerabilities
- Sacred Geometry kernel logic exploits
- Privilege escalation in multi-tenant isolation

## Security Measures

### Credential Management

- All secrets via environment variables (never committed)
- API keys rotated on schedule via `scripts/credential-rotation/`
- `.env.hybrid` purged from git history
- Pre-commit hooks prevent accidental credential commits

### Infrastructure

- CIS benchmark compliance via `scripts/infrastructure-audit.sh`
- OAuth 2.0 + PKCE for all authentication flows
- CSP headers + CORS restricted to known origins
- TLS 1.3 enforced, Redis ACL-based authentication
- Chaos engineering resilience drills via `scripts/chaos-engine.py`

### Code Security

- ESLint `no-eval` / `no-implied-eval` / `no-new-func` enforced
- `npm audit` on every CI run + SAST scanning
- Post-quantum cryptography (Kyber + Dilithium) available

### Monitoring

- OTel real-time security event logging
- API key usage anomaly detection
- Automatic lockout after 5 failed auth attempts

## Compliance

- SOC 2 Type I preparation in progress
- GDPR data handling documented
- Multi-tenant data isolation at database, Redis, and vector store levels

---

*HeadySystems™ & HeadyConnection™*
