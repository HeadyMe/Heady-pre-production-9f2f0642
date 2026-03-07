# HeadyWeb Universal Shell v3.1.0

> **© 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.**

HeadyWeb is the universal Webpack Module Federation shell for the Heady autonomous multi-agent AI platform. It dynamically loads 7 micro-frontend UIs at runtime, each corresponding to a different HeadyStack domain.

---

## Architecture

```
HeadyWeb Universal Shell (Host)
├── src/shell/                    # Host entry & Module Federation bootstrap
│   ├── index.html                # Shell HTML container
│   ├── index.js                  # Shell boot sequence + REMOTE_REGISTRY
│   └── load-dynamic-remote.js   # Runtime MF loader
├── src/services/                 # Shared services
│   ├── ui-registry.js            # Domain → UI ID mapping
│   └── domain-router.js          # Hostname resolution
├── src/vector-federation.js      # Federated vector memory
├── remotes/                      # Seven micro-frontends
│   ├── antigravity/              # 3D vector space visualizer
│   ├── landing/                  # Marketing landing page
│   ├── heady-ide/                # Code editor / IDE
│   ├── swarm-dashboard/          # Agent swarm monitor
│   ├── governance-panel/         # Policy & governance
│   ├── projection-monitor/       # Deployment projections
│   └── vector-explorer/          # Vector memory explorer
├── scripts/                      # Build & dev scripts
├── configs/                      # Registry & config files
├── webpack.config.js             # Unified Webpack 5 config
├── turbo.json                    # Turborepo pipeline
└── docker-compose.yml            # Container orchestration
```

## Remote Registry

| Remote              | URL                                         | Scope             | Module |
|---------------------|---------------------------------------------|-------------------|--------|
| antigravity         | `/remotes/antigravity/remoteEntry.js`       | antigravity       | ./App  |
| landing             | `/remotes/landing/remoteEntry.js`           | headyLanding      | ./App  |
| heady-ide           | `/remotes/heady-ide/remoteEntry.js`         | headyIDE          | ./App  |
| swarm-dashboard     | `/remotes/swarm-dashboard/remoteEntry.js`   | swarmDashboard    | ./App  |
| governance-panel    | `/remotes/governance/remoteEntry.js`        | governancePanel   | ./App  |
| projection-monitor  | `/remotes/projections/remoteEntry.js`       | projectionMonitor | ./App  |
| vector-explorer     | `/remotes/vectors/remoteEntry.js`           | vectorExplorer    | ./App  |

---

## Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- Docker (optional, for containerized builds)

---

## Installation

```bash
npm install
```

---

## Development

Start the shell dev server (port 3000):

```bash
npm run dev
# or
bash scripts/dev-server.sh
```

---

## Building

### Build everything (shell + all 7 remotes)

```bash
npm run build:all
```

### Build shell only

```bash
npm run build:shell
```

### Build all remotes

```bash
npm run build:remotes
```

### Build a single remote

```bash
webpack --config webpack.config.js --env remote --env appName=antigravity
```

---

## Docker

```bash
# Build and start
docker-compose up --build

# Production build
docker build -t heady-web:latest .
docker run -p 80:80 heady-web:latest
```

---

## Environment Variables

| Variable                          | Default                              | Description                         |
|-----------------------------------|--------------------------------------|-------------------------------------|
| `NODE_ENV`                        | `production`                         | Build mode                          |
| `HEADY_VERSION`                   | `3.1.0`                              | Platform version string             |
| `HEADY_REGISTRY_URL`              | `/api/domains/current`               | Domain resolution endpoint          |
| `HEADY_REMOTE_ANTIGRAVITY_URL`    | `/remotes/antigravity/remoteEntry.js`| Override remote URL at runtime      |
| `HEADY_REMOTE_LANDING_URL`        | `/remotes/landing/remoteEntry.js`    | Override remote URL at runtime      |

---

## Module Federation Pattern

Each micro-frontend remote exposes two modules:

- `./App` — The root application component (creates and returns a DOM element)
- `./mount` — The lifecycle mount/unmount function

### Mount API

```js
import { mount } from 'remoteScope/mount';

// Mount the remote into a container
const { unmount } = mount(containerElement, {
  theme: 'dark',
  domain: 'headyme.com',
  userId: 'abc123',
});

// Later: clean up
unmount();
```

---

## Micro-Frontend Summary

| Remote              | Theme                    | Three.js | Description                         |
|---------------------|--------------------------|----------|-------------------------------------|
| `antigravity`       | Emerald/green            | ✓        | 3D vector space & sacred geometry   |
| `landing`           | Dark blue/cyan           | ✗        | Marketing landing page              |
| `heady-ide`         | Dark/blue VS Code-style  | ✗        | Code editor & AI buddy              |
| `swarm-dashboard`   | Amber/gold               | ✗        | Real-time agent swarm monitor       |
| `governance-panel`  | Purple                   | ✗        | Policy rules & audit log            |
| `projection-monitor`| Cyan                     | ✗        | Deployment target health            |
| `vector-explorer`   | Teal/green               | ✓        | Semantic vector memory explorer     |

---

## Repository

**GitHub:** [github.com/HeadyMe/Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)

---

*Built with Webpack 5 Module Federation · Three.js · HeadySystems Inc.*
