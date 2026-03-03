# 🐝 HeadyBuddy v3457890 — Cross-Device Install Package

**Cloud-connected thin client** — your device authorizes root access, cloud HeadyBees execute all operations. Zero local CPU/RAM drain.

---

## 📦 Quick Install

### Linux Mini-Computer

```bash
chmod +x installers/install-linux.sh && ./installers/install-linux.sh
```

**Creates:** `~/.heady/` with desktop entry + systemd service  
**Launch:** `heady-buddy` command or desktop icon

### Windows Laptop

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installers\Install-Heady.ps1
```

**Creates:** `%LOCALAPPDATA%\HeadyBuddy` with desktop + Start Menu shortcuts  
**Launch:** Double-click HeadyBuddy on Desktop

### OnePlus Open (Android)

```bash
chmod +x installers/setup-android.sh && ./installers/setup-android.sh
```

**Method 1 (recommended):** PWA install via Chrome  
**Method 2:** ADB sideload for direct filesystem access  
**Supports:** Foldable front screen + open layout + flex mode

---

## 🏗 Architecture

```
┌──────────────────┐         ┌──────────────────────────┐
│   Your Device    │  WebSocket  │  HeadySystems Cloud  │
│  (thin client)   │◄──────────►│                          │
│                  │            │  35 HeadyBees            │
│  • UI shell      │  authorize  │  • device-provisioner    │
│  • Auth tokens   │──────────►│  • ops / deployment      │
│  • Mod toggles   │            │  • security / memory     │
│  • 0% CPU        │  ◄──results │  • vector-ops / etc.     │
└──────────────────┘            └──────────────────────────┘
```

**How root ops work:**

1. You authorize root access in HeadyBuddy UI
2. Device issues a `HEADY-FS-*` auth token
3. Cloud bees receive the token + operation request
4. Cloud bees execute the operation (file read/write/modify)
5. Results stream back to your device via WebSocket

---

## 🧩 Bundled Mods (8 total)

| Mod | Type | Auto-Enabled |
| --- | --- | --- |
| Sacred Geometry Theme | theme | ✅ |
| Deep Filesystem Explorer | tool | ✅ |
| 3D Vector Memory Visualizer | tool | ✅ |
| HeadyBee Swarm Monitor | dashboard | ✅ |
| Cross-Device Sync | integration | ✅ |
| MIDI Controller Bridge | integration | manual |
| Code Injection Engine | tool | manual |
| ADB Bridge (Android) | integration | manual |

---

## 🐝 HeadyBee Swarm Integration

The `device-provisioner-bee` (`src/bees/device-provisioner-bee.js`) handles:

1. **detect-platform** — identifies device type, arch, memory
2. **fs-authorize** — generates `HEADY-FS-*` auth tokens
3. **install-core** — deploys HeadyBuddy + SDK + runtime
4. **install-mods** — discovers and installs platform mods
5. **verify** — health check across all components

All tasks blast via HeadySwarm parallelism on cloud infrastructure.

---

**© 2026 HeadySystems Inc. · v3457890 · Cloud-Orchestrated**
