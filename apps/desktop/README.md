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
<!-- ║  FILE: apps/desktop/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HeadyWeb Desktop

**Sacred Geometry AI Browser for Windows & Linux** — a Tauri v2 desktop browser with built-in AI sidebar, ad blocking, and HeadyBuddy integration.

## Tech Stack

- **Tauri v2** — Rust backend + system WebView (WebView2 on Windows, WebKitGTK on Linux)
- **React + Tailwind** — Frontend UI (shared design tokens with HeadyBuddy)
- **Rust** — Ad blocking, API proxy, system integration

## Prerequisites

- **Rust** (via rustup): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** 18+
- **Windows**: WebView2 Runtime (pre-installed on Windows 10/11)
- **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Quick Start

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
# Output:
#   Windows: src-tauri/target/release/bundle/msi/ and /nsis/
#   Linux: src-tauri/target/release/bundle/appimage/ and /deb/
```

## Features (MVP)

- Multi-tab browsing with system WebView
- Address bar with URL/search
- AI sidebar (HeadyBuddy chat)
- Basic ad/tracker blocking (domain-level)
- Sacred Geometry dark theme
- System tray integration

---

*Built by HeadySystems. Sacred Geometry Architecture.*
