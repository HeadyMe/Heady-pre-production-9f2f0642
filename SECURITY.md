# Security Policy — Heady™ Platform

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.1.x   | ✅ Current |
| 3.0.x   | ⚠️ Security fixes only |
| < 3.0   | ❌ Unsupported |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

To report a vulnerability:

1. **Email:** [eric@headyconnection.org](mailto:eric@headyconnection.org)
2. **Subject:** `[SECURITY] Brief description`
3. **Include:** Steps to reproduce, impact assessment, and any suggested fix

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgment | 48 hours |
| Initial assessment | 5 business days |
| Fix or mitigation | 30 days (critical: 7 days) |

## Security Practices

- **Secrets:** GCP Secret Manager (production), GitHub Secrets (CI), `.env` (local only)
- **Scanning:** TruffleHog + CodeQL + npm audit run on every PR and push to `main`
- **Container:** Node.js 22 Alpine, non-root user (`heady:1001`)
- **Dependencies:** Automated updates via Dependabot
- **Transport:** All endpoints served over TLS via Cloud Run + Cloudflare

## Scope

This policy covers:

- The monorepo (`Heady-pre-production-9f2f0642`)
- Production repository (`heady-production`)
- All `*-core` service repositories
- The Cloud Run deployment at `heady-manager-*.run.app`
- Cloudflare Pages sites (9 domains)

© 2026 HeadySystems Inc.
