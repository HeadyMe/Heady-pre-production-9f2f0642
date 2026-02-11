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
<!-- ║  FILE: ACTIVE_LAYER_POLICY.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Active Layer & Targeting Policy

Goal: Default all clients to HeadyClouds, keep local strictly opt‑in, and enforce consistent names/URLs across repos and tools.


## 1. Canonical environment names

We use these exact IDs everywhere (code, docs, CI, MCP, scripts):

- `local` – Local dev (<http://localhost:3300/api>)
- `cloud-me` – Personal cloud (HeadyMe)
- `cloud-sys` – Main product cloud (HeadySystems)
- `cloud-conn` – Bridge cloud (HeadyConnection)
- `hybrid` – Local+cloud sync (localhost:3300 with cloud sync)

No other IDs are allowed. If new clouds are added, they must follow `cloud-<name>`.


## 2. Canonical API base URLs

All HTTP clients must use these base URLs only:

| Layer       | API base URL                                       |
|-------------|----------------------------------------------------|
| `local`     | <http://localhost:3300/api>                        |
| `cloud-me`  | <https://heady-manager-headyme.onrender.com/api>    |
| `cloud-sys` | <https://heady-manager-headysystems.onrender.com/api> |
| `cloud-conn`| <https://heady-manager-headyconnection.onrender.com/api> |

Frontends and tools must derive all endpoints from `API_BASE_URL`, not hard-code full URLs.


## 3. Default behavior: always cloud

System default active layer is `cloud-sys`.

On any machine that runs Heady scripts:

```powershell
.\-layer.ps1 switch cloud-sys
```

Effects:
- Writes `scripts\heady-active-layer` to `cloud-sys`
- Sets `HEADY_ACTIVE_LAYER=cloud-sys` and `HEADY_ACTIVE_ENDPOINT=https://heady-manager-headysystems.onrender.com/api`
- Updates the cascade proxy to route all hooks to `cloud-sys`

Local is only used when explicitly requested:

```powershell
.\-layer.ps1 switch local
```


## 4. Frontend and client configuration

Every client must have a single source of truth for the API base URL:
- Web/Vite: `VITE_API_BASE_URL=${HEADY_ACTIVE_ENDPOINT}`
- Browser extensions: Config reads `HEADY_ACTIVE_ENDPOINT`
- IDE plugins: Use same env/config file
- MCP clients: Commands hit cloud endpoints by default

**Rule:** No "localhost" defaults in any production/shared config.


## 5. Repo and remote naming

Enforced repo names/remotes:

| Repo                     | Remote URL                                  |
|--------------------------|---------------------------------------------|
| HeadySystems/Heady       | <git@github.com:HeadySystems/Heady.git>     |
| HeadyMe/Heady            | <git@github.com:HeadyMe/Heady.git>          |
| HeadyConnection/Heady    | <https://github.com/HeadySystems/HeadyConnection.git> |
| HeadySystems/sandbox     | <git@github.com:HeadySystems/sandbox.git>   |

Use `.\-Sync.ps1` or `npm run sync` to push to all remotes.


## 6. Allowed hostnames and banned patterns

Documentation/configs must:
- Use only approved host patterns (`app.headysystems.com` or `heady-manager-*.onrender.com`)
- Never expose raw IPs/localhost in user-facing docs
- Use environment variables in examples

Lint/check scripts must treat raw IPs/inconsistent hostnames as errors.


## 7. When local is allowed

Local (localhost:3300) permitted only for:
- Debugging cloud incidents
- Offline work (explicit "run local" directive)
- Performance benchmarks/experiments

In these cases, devs must:
1. Run `.\-layer.ps1 switch local`
2. Clearly mark local-only configs
3. Never commit local configs to shared main
