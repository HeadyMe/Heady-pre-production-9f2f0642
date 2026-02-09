<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/HEADY_NAMING_STANDARDS.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HEADY Naming Standards Protocol

## Strictly Banned Patterns
- `localhost`, `127.0.0.1`, other loopback addresses
- Private IP ranges (10.x, 192.168.x, 172.16-31.x)
- Windows paths (`C:\...`) in cross-platform docs
- Environment-specific references without placeholders

## Replacement Standards
| Original Pattern | Replacement | Context |
|------------------|-------------|---------|
| `http://localhost:3000` | `https://app.headysystems.com` | Production docs |
| `http://localhost:3300` | `http://manager.dev.local.heady.internal:3300` | Internal dev |
| `C:\Users\...` | `<HEADY_PROJECT_ROOT>` | Cross-platform docs |
| Raw IP addresses | Canonical domains | All contexts |

## Enforcement Mechanisms
1. **Pre-commit hooks**: Run validation scripts before commits
2. **CI/CD checks**: Fail builds on policy violations
3. **Automated migration**: Nightly scans and fixes
4. **Documentation audits**: Quarterly reviews

## Governance
- Violations treated as critical defects
- Block deployment on any policy failure
- Founder approval required for exceptions
