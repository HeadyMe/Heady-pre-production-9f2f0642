<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Security & Trust Posture

Heady's competitive wedge is TRUST. Security controls = product features.

## Threat Model (Agentic Systems)

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Prompt injection → unsafe tool args | Code execution, data exposure | Schema validation, sandboxing |
| Tool chaining privilege escalation | Unauthorized access | Scoped permissions, approval gates |
| Secret leakage via logs/config | Credential compromise | Gitignore, secret scanning, rotation |
| Audit trail tampering | Loss of integrity | Immutable audit writes, signed receipts |
| Supply chain drift | Unreviewed AI output to prod | Consensus validation, policy gates |

## P0 Fixes (Must Complete)

1. Purge committed secrets from git history + rotate all credentials
2. Remove operational logs from public repos (deploy logs, audit jsonl, pid files)
3. Enable secret scanning (pre-commit + CI)
4. Add dependency scanning + SBOM export

## Validator-before-Dispatch (Universal Policy Gate)

Every action must pass:

- ✅ Identity & auth valid
- ✅ Tool allowlist match
- ✅ Argument sanitization
- ✅ Scoped permissions / least privilege
- ✅ Approval if risk threshold exceeded
- ✅ Immutable audit receipt written

## MCP Hardening Checklist

- [ ] Default deny tools; explicit allowlists per environment
- [ ] Typed tool schemas; validate all arguments
- [ ] Sandboxed execution for filesystem and git
- [ ] Rate limit + anomaly detection
- [ ] "Dry-run" mode for destructive actions
- [ ] Signed receipts for every action

## Trust KPIs

- % tool calls blocked by policy
- % actions requiring approval
- Rollback rate of AI-assisted changes
- Mean fix-loop time after AI suggestions
- Audit completeness: % actions with receipts
