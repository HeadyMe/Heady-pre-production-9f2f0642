---
name: heady-security-audit
description: Comprehensive security auditing — vulnerability scanning, risk assessment, mitigation planning, and pattern analysis via HeadyRisks, HeadyAnalyze, and HeadyPatterns.
---

# Heady Security Audit Skill

Use this skill whenever you need to **scan for vulnerabilities, assess risks, generate mitigation plans, or analyze code for security patterns**. Combines three tools for defense-in-depth coverage.

## Tools Overview

| Tool | Purpose | Scope |
|------|---------|-------|
| `mcp_Heady_heady_risks` | Risk assessment, vulnerability scanning, mitigation | Code, infra, dependencies, all |
| `mcp_Heady_heady_analyze` | Focused security analysis of specific code/text | Targeted analysis |
| `mcp_Heady_heady_patterns` | Design pattern detection for security architecture | Architectural patterns |

## Tool Details

### HeadyRisks — `mcp_Heady_heady_risks`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `content` | string | **required** | Code or infrastructure to assess |
| `action` | enum | `assess` | `assess`, `mitigate`, `scan` |
| `scope` | enum | `all` | `code`, `infrastructure`, `dependencies`, `all` |

- **`scan`** — finds vulnerabilities
- **`assess`** — evaluates risk level and impact
- **`mitigate`** — generates remediation plans

### HeadyAnalyze (Security Mode) — `mcp_Heady_heady_analyze`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `content` | string | **required** | Content to analyze |
| `type` | enum | `general` | Set to `security` for security focus |
| `focus` | string | optional | Specific aspect (e.g., "injection", "auth bypass") |
| `language` | string | optional | Programming language |

### HeadyPatterns — `mcp_Heady_heady_patterns`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `code` | string | **required** | Code to analyze |
| `action` | enum | `analyze` | `analyze`, `library`, `suggest` |
| `language` | string | optional | Programming language |

## Security Audit Workflow

### Full Security Audit

```
1. mcp_Heady_heady_risks(content="{codebase}", action="scan", scope="all")
2. mcp_Heady_heady_analyze(content="{critical paths}", type="security", focus="injection, auth bypass")
3. mcp_Heady_heady_patterns(code="{auth/security modules}", action="analyze")
4. mcp_Heady_heady_risks(content="{findings}", action="mitigate")
```

### Targeted Vulnerability Scan

For specific code:

```
1. mcp_Heady_heady_risks(content="{code}", action="scan", scope="code")
2. mcp_Heady_heady_analyze(content="{code}", type="security", focus="specific concern")
```

### Dependency Audit

```
1. mcp_Heady_heady_risks(content="{package.json or requirements}", action="scan", scope="dependencies")
2. mcp_Heady_heady_risks(content="{findings}", action="assess")
3. mcp_Heady_heady_risks(content="{critical vulns}", action="mitigate")
```

### Infrastructure Security Review

```
1. mcp_Heady_heady_risks(content="{infra config}", action="scan", scope="infrastructure")
2. mcp_Heady_heady_analyze(content="{config}", type="security", focus="misconfigurations, exposed ports")
```

### Pre-Deploy Security Gate

Run before any deployment:

```
1. mcp_Heady_heady_risks(content="{changes}", action="scan", scope="all")
2. If critical risks found → STOP deployment, run mitigate
3. If clean → proceed with deploy
```

## Security Focus Areas

Use these as `focus` values for targeted analysis:

| Focus | What It Catches |
|-------|-----------------|
| `injection` | SQL injection, XSS, command injection |
| `auth bypass` | Authentication and authorization flaws |
| `data exposure` | Sensitive data leaks, PII handling |
| `crypto` | Weak encryption, key management issues |
| `config` | Security misconfigurations |
| `dependencies` | Known CVEs in third-party packages |
| `api security` | Rate limiting, input validation, CORS |

## Tips

- **Run scans with `scope: "all"` first** — get the big picture before drilling down
- **Use `mitigate` action** to get actionable remediation steps, not just findings
- **Pair with `heady_patterns`** to understand if the codebase follows secure design patterns
- **Make security audits part of every deploy** — use as a gate before shipping
- **Specific `focus` values** dramatically improve analysis quality vs generic scans
