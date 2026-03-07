# Heady File-by-File Remediation Plan

Generated: 2026-03-07

## Immediate sequence
1. Remove public operational inventory pages and rotate affected credentials or tokens if any production or live secrets could have been inferred from current usage patterns.
2. Make deploy failures truly blocking and review whether any public Cloud Run surfaces should remain unauthenticated.
3. Reduce auth and onboarding response payloads to minimum necessary data.
4. Normalize canonical domains and align them with cookies, CORS, email, and public legal links.
5. Review archived public repos for residual operational detail.

## Target files

| Repo path | Issue | Why it matters | Recommended change | Source URL |
|---|---|---|---|---|
| heady-docs/api/api-keys-reference.md | Public service and environment variable inventory | Raises attacker reconnaissance value and exposes sensitive operational architecture | Delete from public repo, move to a private internal runbook, rotate affected credentials, and replace with a minimal public integration guide | https://github.com/HeadyMe/heady-docs/blob/main/api/api-keys-reference.md |
| Heady-pre-production-9f2f0642/docs/api-keys-reference.md | Duplicate public service and environment variable inventory | Duplicates high-risk exposure and increases persistence if one copy is missed | Remove public copy, preserve only internally, and confirm branch/tag history treatment | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/api-keys-reference.md |
| Heady-pre-production-9f2f0642/.github/workflows/deploy.yml | Non-blocking deploy and permissive exposure patterns | Weakens release governance and can allow unhealthy deployments to appear successful | Remove non-essential continue-on-error behavior, fail on broken smoke tests, review manual approvals, and reassess allow-unauthenticated usage | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/deploy.yml |
| Heady-pre-production-9f2f0642/src/auth/auth-routes.js | Registration/login responses appear overbroad | Can disclose more tokens or account-linked artifacts than necessary | Return minimum required fields, avoid returning API keys in standard auth flows, and document token issuance/rotation paths | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/auth/auth-routes.js |
| Heady-pre-production-9f2f0642/src/api/payment-gateway.js | Billing flow and secret handling require tighter production review | Payment and subscription paths increase legal, security, and vendor-governance exposure | Confirm production-only secret handling, webhook validation, logging minimization, and public contract alignment | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/api/payment-gateway.js |
| Heady-pre-production-9f2f0642/configs/_domains/service-domains.yaml | Malformed or inconsistent hostnames | Can break routing assumptions and undermine policy, cookie, and origin integrity | Normalize domain registry, verify canonical hosts, and run config validation before deploy | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/_domains/service-domains.yaml |
| Heady-pre-production-9f2f0642/.env.example | Broad service inventory and sensitive capability references | Helpful internally, but should be reviewed so public examples stay least-revealing | Keep public examples minimal, move internal-only flags to private docs, and separate demo vs production configuration guidance | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.env.example |
| Heady-pre-production-9f2f0642/SECURITY.md | Public security page must match actual operations | Incorrect or stale claims can create trust and legal risk | Confirm addresses, response windows, scope claims, and architecture statements before relying on them publicly | https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/SECURITY.md |
| Public archived repos under HeadySystems | Historical implementation detail remains visible | Older repos may preserve stale secrets patterns, internal assumptions, or deprecated architecture details | Inventory every public archive, remove or privatize where possible, and sanitize docs/config where retention is necessary | https://github.com/HeadySystems/Heady |

## Evidence basis
- HeadyMe public org review: https://github.com/HeadyMe
- HeadySystems public org review: https://github.com/HeadySystems
