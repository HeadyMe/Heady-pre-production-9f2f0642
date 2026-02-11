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
<!-- ║  FILE: docs/Heady-Dev-VM-Specification.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Development VM Specification

## Core Requirements

- **Base OS**: Windows 11 Enterprise or Ubuntu 24.04
- **Network Security**: Cloudflare Zero Trust implementation

## Network Layer

1. **Cloudflared**:
   - Installed as system service
   - Creates outbound-only tunnel to `*.vm.heady.internal`

2. **WARP Client**:
   - Enforces gateway policies
   - Blocks non-dev internet traffic
   - Allows only GitHub + Heady domains

## Agent Layer

- **Heady Agent**: Node.js/Python background service
  - Orchestrates "Soul Check" authentication
  - Manages token exchange with Heady Manager

## Tooling Configuration

- Windsurf IDE configured to use local cloudflared proxy
- Git configured for token-based authentication (no static SSH keys)
