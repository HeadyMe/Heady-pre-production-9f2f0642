# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.1.x   | ✅ Active support   |
| 3.0.x   | ⚠️ Critical fixes only |
| < 3.0   | ❌ No longer supported |

## Reporting a Vulnerability

**DO NOT open a public issue for security vulnerabilities.**

### Responsible Disclosure

1. **Email**: <security@headyconnection.org>
2. **Subject**: `[SECURITY] Brief description`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested remediation (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment | Within 24 hours |
| Initial assessment | Within 72 hours |
| Fix development | Within 7 days (critical), 30 days (high) |
| Public disclosure | After fix is deployed |

### Scope

The following are in scope:

- `heady-manager` Cloud Run service
- API endpoints at `*.headyme.com`, `*.headyconnection.org`, `*.headysystems.com`
- MCP gateway authentication
- OAuth 2.1 flows
- pgvector data isolation (multi-tenant RLS)
- Cloudflare edge workers

### Out of Scope

- Third-party services (OpenAI, Anthropic, Google APIs)
- Social engineering attacks
- Denial of service (volumetric)
- Issues in dependencies without a working exploit

## Security Measures

- **Authentication**: OAuth 2.1 + JWT with short-lived tokens
- **Authorization**: RBAC with tenant-scoped permissions
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Audit**: Immutable SHA-256 hash-chain audit log (GDPR Art. 30)
- **Prompt Security**: 5-layer prompt injection defense
- **Rate Limiting**: Token bucket per-tenant rate limiting
- **Key Management**: Automated rotation with dual-key validation

## Bug Bounty

We do not currently operate a formal bug bounty program, but we acknowledge and credit responsible disclosures.

---

**Security Contact**: <security@headyconnection.org>  
**Maintainer**: <eric@headyconnection.org>
