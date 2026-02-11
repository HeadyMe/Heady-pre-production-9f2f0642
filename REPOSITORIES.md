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
<!-- ║  FILE: REPOSITORIES.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Ecosystem Repositories

## Primary Repositories

### HeadySystems/Heady
- **Purpose**: Main mono-repo containing the core Heady system
- **Contents**: Source code, configuration, documentation, and deployment scripts
- **Usage**: Development, testing, and deployment of the entire Heady ecosystem

### HeadyMe/Heady
- **Purpose**: Personal cloud instance for individual users
- **Contents**: Personalized configuration and data
- **Usage**: Hosting personal Heady services and data

### HeadyConnection/Heady
- **Purpose**: Bridge cloud instance for connecting multiple Heady instances
- **Contents**: Connection management and synchronization services
- **Usage**: Facilitating communication between different Heady deployments

### HeadySystems/sandbox
- **Purpose**: Experimental features and testing ground
- **Contents**: Prototypes, experimental code, and test cases
- **Usage**: Safe environment for testing new features before integration

## Remote Names and URLs

| Repository | Remote URL |
|------------|------------|
| HeadySystems/Heady | `git@github.com:HeadySystems/Heady.git` |
| HeadyMe/Heady | `git@github.com:HeadyMe/Heady.git` |
| HeadyConnection/Heady | `https://github.com/HeadySystems/HeadyConnection.git` |
| HeadySystems/sandbox | `git@github.com:HeadySystems/sandbox.git` |

## Synchronization
Use the `-Sync.ps1` script to push changes to all remotes:```powershell
.\scripts\-Sync.ps1
```
