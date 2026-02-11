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
<!-- ║  FILE: docs/HEADY_NAMING_AND_MIGRATION_PROTOCOL.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HEADY NAMING & MIGRATION PROTOCOL

## Core Principles
1. All user-facing references must use canonical domains (app.headysystems.com)
2. Eliminate environment-specific paths (C:\) in cross-platform docs
3. Enforce consistent casing: kebab-case URLs, snake_case env vars

## Domain Standards
All services must use branded domains:
- HeadySystems: `*.headysystems.com`
- HeadyConnection: `*.headyconnection.org`
- HeadyBuddy: `*.headybuddy.org`
- Internal: `*.heady.internal`

Third-party domains are strictly prohibited:
- `*.onrender.com`
- `*.vercel.app`
- `*.netlify.app`
- `*.herokuapp.com`
- `*.firebaseapp.com`

## Strictly Banned Patterns
- Third-party domains: .onrender.com, .vercel.app, .netlify.app
- Windows drive paths: C:\, F:\, etc.
- Raw IP addresses
- .onrender.com
- Drive letters (e.g. C:, F:)

## Migration Procedure
1. Inventory all assets with `scripts/localhost-to-domain.js inventory`
2. Apply replacements using the [mapping table](#replacement-mapping-table) via `scripts/localhost-to-domain.js migrate`
3. Validate with `scripts/validate-localhost.sh`

## Replacement Mapping Table

| Original Pattern                          | Replacement                                 | Context               |
| :---------------------------------------- | :------------------------------------------ | :-------------------- |
| `C:\Users\eric\...`                       | `HEADY_PROJECT_ROOT`                        | Dev-only docs         |
| `F:\...`                                  | `HEADY_DATA_ROOT`                           | Dev-only docs         |
| `heady-manager-headysystems.onrender.com` | `https://api.app.headysystems.com`          | Public/prod docs      |
| `heady-manager-headyme.onrender.com`      | `https://api.app.headysystems.com/me`       | User personal area    |
| `heady-manager-headyconnection.onrender.com` | `https://api.app.headyconnection.org`     | Cross-system bridge   |

## Enforcement Rules
Violations are critical defects that block deployment. Founder-level approval required for exceptions.

## Enforcement
- CI blocks builds containing localhost/private IPs
- Quarterly naming audits
- Documentation guardians review all naming changes

## Enhanced Enforcement

- Extend CI checks to block builds containing .onrender.com, .vercel.app, etc. and Windows drive paths
- Update pre-commit hooks to include the new banned patterns
- Treat any violation as a critical defect that blocks deployment
