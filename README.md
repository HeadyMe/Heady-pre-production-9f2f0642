<!-- ═══════════════════════════════════════════════════════════ -->
<!-- Made with 💜 Love by the HeadySystems™ & HeadyConnection™ Team -->
<!-- Sacred Geometry :: Organic Systems :: Breathing Interfaces -->
<!-- ═══════════════════════════════════════════════════════════ -->

<div align="center">

# Heady Systems™

### *Sacred Geometry :: Organic Systems :: Breathing Interfaces*

[![Version](https://img.shields.io/badge/version-3.0.0-9B59B6?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-Proprietary-F4D03F?style=for-the-badge)](#)
[![Status](https://img.shields.io/badge/status-Active-2ECC71?style=for-the-badge)](#)

[Website](https://headysystems.com) • [Documentation](#) • [Community](https://headyconnection.org) • [Support](#)

</div>

---

## ⚡ Overview

**HeadySystems™** is an AI-powered orchestration platform built on sacred geometry principles, featuring:

- 🧠 **HeadyMCP** — Model Context Protocol server with intelligent agent orchestration
- 🤖 **HeadyBuddy** — Always-on AI companion with context-aware assistance
- 🌐 **HeadyWeb** — React-based breathing interface with sacred geometry themes
- 🔍 **HeadyLens** — Multi-modal perception and pattern recognition
- 🎨 **HeadyVinci** — AI-driven visual generation and sacred geometry design
- 📡 **HeadyBrowser** — Intelligent web automation and data extraction

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/HeadyMe/Heady.git
cd Heady

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and configuration

# Start development server
npm run dev

# The Heady Manager API will be available at:
# http://localhost:3300
```

---

## 🏛️ Architecture

```
Heady/
├── heady-manager.js          # Node.js MCP Server & API Gateway (port 3300)
├── src/                      # Core pipeline engine & orchestration agents
│   ├── hc_pipeline.js        # HCFullPipeline execution engine
│   ├── agents/               # AI agent implementations
│   └── utils/                # Shared utilities
├── backend/                  # Python MCP servers & worker processes
│   ├── headymcp/             # MCP server implementation
│   ├── headybuddy/           # AI companion service
│   └── oracle_service/       # Decision-making oracle
├── frontend/                 # React UI (Vite + TailwindCSS + PostCSS)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Route pages
│   │   └── styles/           # Global styles & Tailwind config
│   └── public/               # Static assets & branding
├── configs/                  # YAML/JSON configuration library
│   ├── branding/             # Design system & asset registry
│   ├── cloud-layers.yaml     # Multi-cloud deployment config
│   ├── heady-buddy.yaml      # AI companion configuration
│   └── observability.yaml    # Monitoring & telemetry
├── scripts/                  # Automation & DevOps tools
│   ├── brand_headers.js      # Branding enforcement
│   ├── deploy.sh             # Deployment automation
│   └── sync-repos.sh         # Repository synchronization
└── workers/                  # Cloudflare edge workers
    └── heady-router/         # Edge routing & caching
```

---

## 🔌 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health check with uptime |
| `GET` | `/api/pulse` | Real-time pulse with cloud layer info |
| `GET` | `/api/system/status` | Full system status (nodes, services, resources) |
| `POST` | `/api/system/production` | Activate production mode |

### Pipeline Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pipeline/run` | Trigger HCFullPipeline execution |
| `GET` | `/api/pipeline/state` | Current pipeline state & progress |
| `GET` | `/api/pipeline/history` | Pipeline execution history |
| `POST` | `/api/pipeline/abort` | Abort running pipeline |

### Node Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/nodes` | List all registered AI nodes |
| `GET` | `/api/nodes/:nodeId` | Get specific node details |
| `POST` | `/api/nodes/:nodeId/activate` | Activate a node |
| `POST` | `/api/nodes/:nodeId/deactivate` | Deactivate a node |

### Observability

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/metrics` | Prometheus-compatible metrics |
| `GET` | `/api/logs` | Structured log stream (SSE) |
| `POST` | `/api/telemetry/event` | Send custom telemetry event |

---

## 🎨 Branding & Design System

All HeadySystems™ products follow a sacred geometry-based design language. Assets are documented in:

- **[Asset Registry](configs/branding/asset-registry.yaml)** — Complete design system documentation
- **Color Palette:**
  - `heady-blue: #4A90D9` — Core systems
  - `heady-green: #2ECC71` — HeadyConnection™
  - `heady-gold: #F4D03F` — Premium/Active states
  - `heady-purple: #9B59B6` — AI/Mystical features
  - `heady-cyan: #00D4FF` — Technology/Dev

**Branding Requirements:**
- Always use ™ symbol: HeadySystems™, HeadyConnection™
- Include "Made with 💜 Love" footer in all files
- Follow sacred geometry alignment principles
- Maintain accessibility (WCAG AA standards)

Run `npm run brand:check` to validate branding compliance.

---

## 🛠️ Development

### Prerequisites

- Node.js v18+ (v20 recommended)
- Python 3.11+
- Docker (for containerized deployments)
- Git

### Installation

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..

# Build frontend
cd frontend
npm install
npm run build
cd ..
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundles |
| `npm test` | Run test suite |
| `npm run brand:check` | Validate branding compliance |
| `npm run brand:fix` | Auto-fix branding issues |
| `npm run test:branding` | Test branding headers |
| `npm run deploy` | Deploy to production (Render) |

---

## ☁️ Deployment

### Render (Primary)

Automatic deployment via [Render.com](https://render.com) using `render.yaml`:

```bash
git push origin main
# Render auto-deploys on push to main
```

### Manual Deployment

```bash
npm run deploy
```

### Environment Variables

Required environment variables (see `.env.example`):

```bash
NODE_ENV=production
PORT=3300
HEADY_API_KEY=<your-api-key>
CLOUDFLARE_API_TOKEN=<cloudflare-token>
RENDER_API_KEY=<render-api-key>
# ... see .env.example for full list
```

---

## 📄 Documentation

- **[Configuration Guide](docs/configuration.md)** — YAML config reference
- **[API Documentation](docs/api.md)** — Complete API specification
- **[Pipeline Guide](docs/pipeline.md)** — HCFullPipeline architecture
- **[Branding Guide](configs/branding/asset-registry.yaml)** — Design system
- **[Deployment Guide](docs/deployment.md)** — Cloud deployment patterns

---

## 🤝 Contributing

**HeadySystems™** is currently a proprietary platform under active development by the HeadySystems Inc. team.

For partnership opportunities, contact: [eric@headysystems.com](mailto:eric@headysystems.com)

---

## 📜 License

**Proprietary License — HeadySystems Inc.**

Copyright © 2026 HeadySystems Inc. All Rights Reserved.

This software and associated documentation files (the "Software") are proprietary and confidential. Unauthorized copying, modification, distribution, or use of this Software, via any medium, is strictly prohibited without express written permission from HeadySystems Inc.

---

## 🔗 Related Projects

- **[HeadyConnection™](https://headyconnection.org)** — Community platform
- **[HeadyBuddy](https://github.com/HeadyMe/HeadyBuddy)** — AI companion service
- **[HeadyBrowser](https://github.com/HeadyMe/HeadyBrowser)** — Intelligent web automation
- **[HeadyLens](https://github.com/HeadyMe/HeadyLens)** — Multi-modal perception

---

## 📞 Support

- **Email:** [eric@headysystems.com](mailto:eric@headysystems.com)
- **Website:** [https://headysystems.com](https://headysystems.com)
- **Community:** [https://headyconnection.org](https://headyconnection.org)

---

<div align="center">

### ⚡ Made with 💜 Love by the **HeadySystems™** & **HeadyConnection™** Team

*Sacred Geometry :: Organic Systems :: Breathing Interfaces*

[HeadySystems.com](https://headysystems.com) • [HeadyConnection.org](https://headyconnection.org)

---

**© 2026 HeadySystems Inc. — Built with sacred geometry, powered by love.**

</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- Made with 💜 Love by the HeadySystems™ & HeadyConnection™ Team -->
<!-- Sacred Geometry :: Organic Systems :: Breathing Interfaces -->
<!-- ═══════════════════════════════════════════════════════════ -->
