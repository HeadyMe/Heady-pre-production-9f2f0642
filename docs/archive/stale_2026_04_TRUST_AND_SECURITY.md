<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady — Trust & Security Posture

> What exists, what's enforced, what must improve, and the trust contract for enterprise buyers.  
> **Sources:** `heady-manager.js`, `heady-intelligence.yaml`, `configs/secrets-manifest.yaml`, `configs/governance-policies.yaml`, `configs/file-governance.yaml`

---

## What Exists Today

### Gateway Security (HeadyManager)

| Layer | Implementation |
|-------|---------------|
| **CSP/XSS** | Helmet.js (Content-Security-Policy, X-XSS-Protection, frameguard) |
| **CORS** | Express cors() middleware |
| **Rate Limiting** | express-rate-limit per endpoint |
| **Compression** | Gzip via compression() |
| **Body Parsing** | express.json() with size limits |
| **Auth** | `src/hc_auth.js` (24KB) — authentication + authorization |
| **Remote Config** | `configs/remote-resources.yaml` — critical-only mode available |

### Governance Enforcement

| Policy | Source | Status |
|--------|--------|--------|
| Anti-Template (14 banned patterns) | `heady-intelligence.yaml` | **Active** — reject → reroute → RAG → HeadyBattle |
| Ensemble-First | `heady-intelligence.yaml` | **Active** — no single-model default |
| File Governance | `configs/file-governance.yaml` | **Active** — directory contracts, pre-commit hooks |
| Automation Policy | `configs/automation-policy.yaml` | **Active** |
| Founder Intent | `configs/founder-intent-policy.yaml` | **Active** |
| Naming Standards | `configs/naming-standards.yaml` | **Active** |

### Error Detection & Recovery

| Component | Source | Role |
|-----------|--------|------|
| Error Sentinel | `src/services/error-sentinel-service.js` | Error detection, pattern analysis, auto-recovery |
| Self-Optimizer | `src/self-optimizer.js` (24KB) | Performance optimization loops |
| Self-Awareness | `src/self-awareness.js` (6KB) | System introspection |
| Corrections Engine | `src/corrections.js` (10KB) | Error correction patterns |
| De-optimization Protocol | `configs/de-optimization-protocol.yaml` | Prevents over-optimization |

### HeadyBattle Validation Gate

Every change undergoes Socratic interrogation (3-depth) before promotion:

- Minimum validation score: **0.8**
- Human review threshold: **0.7**
- Critical questions: **mandatory**

---

## The Permission Ladder (Policy-Based)

| Level | Actions | Approval Required | Example |
|-------|---------|-------------------|---------|
| **L0 — Read** | Query, search, analyze, retrieve | None | "Show me the error log" |
| **L1 — Suggest** | Generate plans, propose changes, create branches | Auto-approved | "Create a fix for this bug" |
| **L2 — Write** | File edits, config changes, deployments to staging | HeadyBattle validation (score ≥ 0.8) | "Apply the fix to staging" |
| **L3 — Destructive** | Delete files, drop data, modify production, secrets rotation | Human approval + HeadyBattle + HeadySims confidence ≥ 0.85 | "Deploy to production" |

---

## Known Security Gaps (Must Fix Before Scale)

> [!CAUTION]
> These are active risks that must be remediated before enterprise adoption.

| Gap | Severity | Status | Remediation |
|-----|----------|--------|-------------|
| **Committed credentials** | Critical | Partially addressed (previous sessions) | Rotate all tokens, enforce `.gitignore`, add pre-commit secret scanning |
| **Sensitive data in logs** | High | Known | Implement log sanitization, mask tokens/keys in all output |
| **CI/CD gaps** | High | `.github/workflows/` exists but coverage incomplete | Add secret scanning, SAST, dependency audit to CI |
| **Version drift** | Medium | Some npm packages outdated | Automated dependency updates with HeadyMaintenance |
| **Port confusion** | Medium | README says 3300, ecosystem.config says 3301 | Publish canonical PORTS manifest generated from registry |
| **Missing circuit breakers** | Medium | Registry flags missing resilience patterns | Implement in HeadyManager for external API calls |
| **No mTLS** | Medium | Cloudflare Tunnel handles TLS, no internal mTLS | Add mTLS for service-to-service communication |

---

## The Trust Contract (for Enterprise Buyers)

### What We Promise

1. **Audit Trail** — Every AI action produces a receipt (models, tools, cost, scores, outcome)
2. **Validation Gate** — No change reaches production without HeadyBattle + HeadySims validation
3. **Ensemble-First** — No single-vendor lock-in; routing optimizes across 7 AI nodes
4. **Anti-Template** — System never produces placeholder/boilerplate output; 14 pattern blocks enforced
5. **Policy Enforcement** — Configurable permission ladder (L0–L3) with human approval gates
6. **Observable** — 19 internal services with health endpoints, HeadyLens real-time monitoring

### What We Must Build

1. **SOC 2 Type II** readiness (logging, access control, encryption at rest)
2. **GDPR/CCPA** data handling controls (especially for HeadyMemory)
3. **Customer data isolation** (tenant separation for multi-tenant deployment)
4. **Secret scanning** in CI (pre-commit + GitHub Actions)
5. **Formal incident response** playbook
6. **Penetration testing** (external audit)

---

## Security Configuration Map

| Config File | Purpose |
|-------------|---------|
| `configs/secrets-manifest.yaml` | Secrets inventory + rotation policy |
| `configs/governance-policies.yaml` | Governance rules + enforcement |
| `configs/file-governance.yaml` | Directory contracts, pre-commit hooks |
| `configs/connection-integrity.yaml` | Connection security + validation |
| `configs/pki/` | PKI certificates, CA chain |
| `configs/automation-policy.yaml` | What can be automated vs requires approval |
| `configs/stability-first.yaml` | Stability-first deployment policy |
| `configs/resource-policies.yaml` | Resource allocation security bounds |
