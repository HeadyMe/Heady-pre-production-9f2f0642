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

## Migration Procedure
1. Inventory all assets with `scripts/localhost-to-domain.js inventory`
2. Apply replacements using mapping table
3. Validate with `scripts/validate-localhost.sh`

## Enforcement
- CI blocks builds containing localhost/private IPs
- Quarterly naming audits
- Documentation guardians review all naming changes
