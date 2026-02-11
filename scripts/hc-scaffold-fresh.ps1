<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/hc-scaffold-fresh.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY SYSTEMS - Scaffold Fresh Project                         ║
# ║  Creates a clean Heady project from scratch with modern tooling ║
# ╚══════════════════════════════════════════════════════════════════╝

param(
    [string]$OutputPath = "C:\Users\erich\Heady-Fresh",
    [switch]$SkipNpmInstall,
    [switch]$IncludeAcademy,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ─── Banner ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  HCFullPipeline: Scaffold Fresh Project          ║" -ForegroundColor Magenta
Write-Host "║  Sacred Geometry v3.0.0                          ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Output: $OutputPath" -ForegroundColor Cyan

if (Test-Path $OutputPath) {
    if ($Force) {
        Write-Host "[FORCE] Removing existing $OutputPath..." -ForegroundColor Yellow
        Remove-Item $OutputPath -Recurse -Force
    } else {
        Write-Host "[WARN] $OutputPath already exists." -ForegroundColor Yellow
        $confirm = Read-Host "Overwrite? (y/N)"
        if ($confirm -ne "y") { exit 0 }
        Remove-Item $OutputPath -Recurse -Force
    }
}

# ─── Directory Structure ─────────────────────────────────────────────
Write-Host ""
Write-Host "Creating directory structure..." -ForegroundColor Yellow

$dirs = @(
    ".github/workflows"
    ".github/agents"
    ".windsurf/workflows"
    ".heady"
    ".heady-memory/inventory"
    "backend/python_worker/heady_project"
    "backend/python_worker/mcp"
    "backend/python_worker/types"
    "backend/src/controllers"
    "backend/src/middleware"
    "backend/src/routes"
    "configs"
    "docs"
    "frontend/public/admin"
    "frontend/src/components"
    "HeadyAcademy/Admin"
    "HeadyAcademy/Library"
    "HeadyAcademy/Tools"
    "mcp-servers"
    "packages"
    "public"
    "scripts/ops"
    "src/agents"
    "src/heady_project"
    "workers"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path (Join-Path $OutputPath $dir) -Force | Out-Null
}
Write-Host "  [OK] $(($dirs).Count) directories created" -ForegroundColor Green

# ─── Root Files ───────────────────────────────────────────────────────
Write-Host "Creating root files..." -ForegroundColor Yellow

# .gitignore (CLEAN - no merge conflicts)
@"
# Dependencies
node_modules/
__pycache__/
*.pyc
venv/
.venv/

# Build output
dist/
build/
.next/

# Environment
.env
.env.local
.env.production
.heady_secrets

# Logs
*.log
logs/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Python
.pytest_cache/
*.egg-info/

# Generated
heady-manifest.json
HeadyAcademy/Content_Forge/Visualizations/
pipeline-output/
.heady_cache/
"@ | Set-Content (Join-Path $OutputPath ".gitignore") -Encoding UTF8

# .env.example
@"
# Heady Systems Environment Configuration
# Copy to .env and fill in values

# Server
PORT=3300
NODE_ENV=development

# Database
DATABASE_URL=postgresql://heady:heady_secret@localhost:5432/heady

# Authentication
HEADY_API_KEY=
ADMIN_TOKEN=

# Cloud Targets
HEADY_TARGET=LocalDev
HEADY_VERSION=3.0.0

# AI Nodes
ENABLE_CODEMAP=true
JULES_ENABLED=true
OBSERVER_ENABLED=true
BUILDER_ENABLED=true
ATLAS_ENABLED=true

# Hugging Face
HF_TOKEN=

# Python Worker
PYTHON_WORKER_PATH=backend/python_worker
HEADY_PYTHON_BIN=python

# Cloud Endpoints (for hybrid mode)
CLOUD_HEADYME_URL=https://heady-manager-headyme.onrender.com
CLOUD_HEADYSYSTEMS_URL=https://heady-manager-headysystems.onrender.com
CLOUD_HEADYCONNECTION_URL=https://heady-manager-headyconnection.onrender.com
"@ | Set-Content (Join-Path $OutputPath ".env.example") -Encoding UTF8

# package.json (root)
@"
{
  "name": "heady-systems",
  "version": "3.0.0",
  "description": "Heady Systems - Sacred Geometry :: Organic Systems :: Breathing Interfaces",
  "main": "heady-manager.js",
  "scripts": {
    "start": "node heady-manager.js",
    "dev": "nodemon heady-manager.js",
    "build": "npm run build --prefix frontend",
    "frontend": "npm run dev --prefix frontend",
    "backend": "npm start --prefix backend",
    "test": "jest",
    "lint": "eslint . --fix",
    "pipeline": "node -e \"const {pipeline}=require('./src/hc_pipeline');pipeline.run().then(s=>console.log(JSON.stringify({runId:s.runId,status:s.status},null,2))).catch(e=>console.error(e.message))\"",
    "pipeline:config": "node -e \"const {pipeline}=require('./src/hc_pipeline');console.log(JSON.stringify(pipeline.getConfigSummary(),null,2))\"",
    "sync": "powershell -File ./scripts/Heady-Sync.ps1",
    "brand:check": "node scripts/brand_headers.js --check",
    "brand:fix": "node scripts/brand_headers.js --fix"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^8.2.1",
    "helmet": "^8.1.0",
    "js-yaml": "^4.1.1",
    "node-cron": "^3.0.2"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "eslint": "^9.18.0",
    "jest": "^29.7.0",
    "nodemon": "^3.1.9"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
"@ | Set-Content (Join-Path $OutputPath "package.json") -Encoding UTF8

# render.yaml
@"
services:
  - type: web
    name: heady-manager
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node heady-manager.js
    envVars:
      - key: PORT
        value: "3300"
      - key: NODE_ENV
        value: "production"
      - key: HEADY_TARGET
        value: "`${HEADY_TARGET}"
      - key: HEADY_VERSION
        value: "3.0.0"
      - key: ENABLE_CODEMAP
        value: "true"
      - key: JULES_ENABLED
        value: "true"
      - key: OBSERVER_ENABLED
        value: "true"
      - key: BUILDER_ENABLED
        value: "true"
      - key: ATLAS_ENABLED
        value: "true"
      - key: DATABASE_URL
        fromSecret: DATABASE_URL
      - key: HEADY_API_KEY
        fromSecret: HEADY_API_KEY
      - key: ADMIN_TOKEN
        fromSecret: ADMIN_TOKEN
      - key: HF_TOKEN
        value: "`${HF_TOKEN}"
"@ | Set-Content (Join-Path $OutputPath "render.yaml") -Encoding UTF8

# Dockerfile
@"
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build || true

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3300/api/health || exit 1

CMD ["node", "heady-manager.js"]
"@ | Set-Content (Join-Path $OutputPath "Dockerfile") -Encoding UTF8

# docker-compose.yml
@"
version: '3.8'

services:
  heady-manager:
    build: .
    container_name: heady-manager
    ports:
      - "3300:3300"
    environment:
      - NODE_ENV=production
      - PORT=3300
      - HEADY_TARGET=Docker
      - HEADY_VERSION=3.0.0
    volumes:
      - heady-data:/app/.heady-memory
    networks:
      - heady-net
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3300/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  heady-redis:
    image: redis:7-alpine
    container_name: heady-redis
    ports:
      - "6379:6379"
    volumes:
      - heady-redis:/data
    networks:
      - heady-net
    restart: unless-stopped

  heady-postgres:
    image: postgres:16-alpine
    container_name: heady-postgres
    environment:
      - POSTGRES_DB=heady
      - POSTGRES_USER=heady
      - POSTGRES_PASSWORD=heady_secret
    ports:
      - "5432:5432"
    volumes:
      - heady-postgres:/var/lib/postgresql/data
    networks:
      - heady-net
    restart: unless-stopped

volumes:
  heady-data:
  heady-redis:
  heady-postgres:

networks:
  heady-net:
    driver: bridge
"@ | Set-Content (Join-Path $OutputPath "docker-compose.yml") -Encoding UTF8

# README.md
@"
# Heady Systems

> Sacred Geometry :: Organic Systems :: Breathing Interfaces

## Quick Start

``````bash
npm install
cp .env.example .env
npm run dev
``````

## Architecture

``````
heady-manager.js          # Node.js MCP Server & API Gateway (port 3300)
├── src/                  # Core pipeline engine & agents
├── backend/              # Python worker & MCP servers
├── frontend/             # React UI (Vite + TailwindCSS)
├── HeadyAcademy/         # AI Nodes & Tools
├── configs/              # YAML configuration
├── scripts/              # Automation (Sync, Build, Deploy)
└── workers/              # Edge workers
``````

## API

| Endpoint | Description |
|---|---|
| ``GET /api/health`` | Health check |
| ``GET /api/pulse`` | System pulse with layer info |
| ``GET /api/system/status`` | Full system status |
| ``POST /api/pipeline/run`` | Trigger pipeline run |
| ``GET /api/pipeline/state`` | Current pipeline state |
| ``GET /api/nodes`` | List all AI nodes |
| ``POST /api/system/production`` | Activate production mode |

## Deployment

Deployed via [Render.com](https://render.com) using ``render.yaml``.

## License

Proprietary - Heady Systems
"@ | Set-Content (Join-Path $OutputPath "README.md") -Encoding UTF8

Write-Host "  [OK] Root files created" -ForegroundColor Green

# ─── heady-registry.json (new structure) ──────────────────────────────
$registryContent = @"
{
  "registryVersion": "3.2.0",
  "updatedAt": "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")",
  "description": "HeadyRegistry — Central catalog and control point for the Heady ecosystem",
  "last_deployment": "",

  "components": [
  ],
  "repos": [
    {
      "id": "heady-sys",
      "name": "HeadySystems/Heady",
      "url": "git@github.com:HeadySystems/Heady.git",
      "role": "primary",
      "promotionTargets": [],
      "branchPolicy": {
        "main": "protected-prod",
        "release/*": "frozen"
      }
    },
    {
      "id": "heady-me",
      "name": "HeadyMe/Heady",
      "url": "git@github.com:HeadyMe/Heady.git",
      "role": "personal-cloud",
      "promotionTargets": ["heady-sys", "heady-conn"],
      "branchPolicy": {
        "main": "protected-prod",
        "personal/*": "local-only"
      }
    },
    {
      "id": "heady-conn",
      "name": "HeadyConnection/Heady",
      "url": "https://github.com/HeadySystems/HeadyConnection.git",
      "role": "cross-system-bridge",
      "promotionTargets": ["heady-sys", "heady-me"],
      "branchPolicy": {
        "main": "protected-prod",
        "tenant/*": "env-specific"
      }
    },
    {
      "id": "sandbox",
      "name": "HeadySystems/sandbox",
      "url": "git@github.com:HeadySystems/sandbox.git",
      "role": "experimental",
      "promotionTargets": ["heady-sys", "heady-me", "heady-conn"],
      "branchPolicy": {
        "main": "dev",
        "exp/*": "short-lived"
      }
    }
  ],
  "patterns": [
    {
      "id": "multi-sot-protocol",
      "name": "Multi Source-of-Truth Protocol",
      "type": "operational",
      "description": "Sandbox as change origin, controlled promotion to Systems/Me/Connection sources of truth with registry-driven sync and hard gates.",
      "sourceOfTruth": "docs/ITERATIVE_REBUILD_PROTOCOL.md",
      "status": "active"
    }
  ]
}
"@
Set-Content (Join-Path $OutputPath "heady-registry.json") $registryContent -Encoding UTF8

Write-Host "  [OK] heady-registry.json created" -ForegroundColor Green

# ─── heady-manager.js (clean, modular) ────────────────────────────────
Write-Host "Creating heady-manager.js..." -ForegroundColor Yellow

@'
/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  HEADY MANAGER - Node.js MCP Server & API Gateway               ║
 * ║  Sacred Geometry Architecture v3.0.0                             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const PORT = Number(process.env.PORT || 3300);
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  credentials: true,
}));
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Static Assets ─────────────────────────────────────────────────
const frontendBuildPath = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}
app.use(express.static("public"));

// ─── Utility ────────────────────────────────────────────────────────
function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

// ─── Health & Pulse ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get("/api/pulse", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    status: "active",
    endpoints: ["/api/health", "/api/registry", "/api/nodes", "/api/pipeline/*"],
  });
});

// ─── Registry ───────────────────────────────────────────────────────
const REGISTRY_PATH = path.join(__dirname, ".heady", "registry.json");

function loadRegistry() {
  return readJsonSafe(REGISTRY_PATH) || { nodes: {}, tools: {}, workflows: {}, services: {}, skills: {}, metadata: {} };
}

function saveRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/registry", (req, res) => {
  const registryPath = path.join(__dirname, "heady-registry.json");
  const registry = readJsonSafe(registryPath);
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json(registry);
});

// ─── Node Management ────────────────────────────────────────────────
app.get("/api/nodes", (req, res) => {
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({ id, ...n }));
  res.json({ total: nodes.length, active: nodes.filter(n => n.status === "active").length, nodes, ts: new Date().toISOString() });
});

app.get("/api/nodes/:nodeId", (req, res) => {
  const reg = loadRegistry();
  const node = reg.nodes[req.params.nodeId.toUpperCase()];
  if (!node) return res.status(404).json({ error: `Node '${req.params.nodeId}' not found` });
  res.json({ id: req.params.nodeId.toUpperCase(), ...node });
});

app.post("/api/nodes/:nodeId/activate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "active";
  reg.nodes[id].last_invoked = new Date().toISOString();
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "active" });
});

app.post("/api/nodes/:nodeId/deactivate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "available";
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "available" });
});

// ─── System Status & Production Activation ──────────────────────────
app.get("/api/system/status", (req, res) => {
  const reg = loadRegistry();
  const nodeList = Object.entries(reg.nodes || {});
  const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

  res.json({
    system: "Heady Systems",
    version: "3.0.0",
    environment: (reg.metadata || {}).environment || "development",
    production_ready: activeNodes === nodeList.length && nodeList.length > 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    capabilities: {
      nodes: { total: nodeList.length, active: activeNodes },
      tools: { total: Object.keys(reg.tools || {}).length },
      workflows: { total: Object.keys(reg.workflows || {}).length },
      services: { total: Object.keys(reg.services || {}).length },
    },
    sacred_geometry: { architecture: "active", organic_systems: activeNodes === nodeList.length },
    ts: new Date().toISOString(),
  });
});

app.post("/api/system/production", (req, res) => {
  const reg = loadRegistry();
  const ts = new Date().toISOString();
  const report = { nodes: [], tools: [], workflows: [], services: [] };

  for (const [name, node] of Object.entries(reg.nodes || {})) {
    node.status = "active"; node.last_invoked = ts; report.nodes.push(name);
  }
  for (const [name, tool] of Object.entries(reg.tools || {})) {
    tool.status = "active"; report.tools.push(name);
  }
  for (const [name, wf] of Object.entries(reg.workflows || {})) {
    wf.status = "active"; report.workflows.push(name);
  }
  for (const [name, svc] of Object.entries(reg.services || {})) {
    svc.status = name === "heady-manager" ? "healthy" : "active"; report.services.push(name);
  }
  for (const [, sk] of Object.entries(reg.skills || {})) { sk.status = "active"; }

  reg.metadata = { ...reg.metadata, last_updated: ts, version: "3.0.0-production", environment: "production", all_nodes_active: true, production_activated_at: ts };
  saveRegistry(reg);

  res.json({
    success: true,
    environment: "production",
    activated: { nodes: report.nodes.length, tools: report.tools.length, workflows: report.workflows.length, services: report.services.length },
    sacred_geometry: "FULLY_ACTIVATED",
    ts,
  });
});

// ─── Pipeline Placeholder (wire up src/hc_pipeline.js when ready) ───
app.get("/api/pipeline/config", (req, res) => {
  res.json({ status: "idle", message: "Pipeline engine not yet initialized. Wire up src/hc_pipeline.js." });
});

app.post("/api/pipeline/run", (req, res) => {
  res.json({ status: "idle", message: "Pipeline engine not yet initialized." });
});

app.get("/api/pipeline/state", (req, res) => {
  res.json({ status: "idle", message: "No pipeline run in progress." });
});

// ─── Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("HeadyManager Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    ts: new Date().toISOString(),
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: "Not found" });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ∞ Heady Manager v3.0.0 listening on port ${PORT}`);
  console.log(`  ∞ Health: http://localhost:${PORT}/api/health`);
  console.log(`  ∞ Environment: ${process.env.NODE_ENV || "development"}\n`);
});
'@ | Set-Content (Join-Path $OutputPath "heady-manager.js") -Encoding UTF8

Write-Host "  [OK] heady-manager.js created" -ForegroundColor Green

# ─── Frontend (Vite + React + TailwindCSS) ────────────────────────────
Write-Host "Creating frontend..." -ForegroundColor Yellow

# frontend/package.json
@"
{
  "name": "heady-ui",
  "version": "3.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.474.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "vite": "^6.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
"@ | Set-Content (Join-Path $OutputPath "frontend/package.json") -Encoding UTF8

# frontend/vite.config.ts
@"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      "/api": "http://localhost:3300",
    },
  },
  build: {
    outDir: "dist",
  },
});
"@ | Set-Content (Join-Path $OutputPath "frontend/vite.config.ts") -Encoding UTF8

# frontend/index.html
@"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Heady Systems</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"@ | Set-Content (Join-Path $OutputPath "frontend/index.html") -Encoding UTF8

# frontend/postcss.config.js
@"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@ | Set-Content (Join-Path $OutputPath "frontend/postcss.config.js") -Encoding UTF8

# frontend/tailwind.config.js
@"
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        heady: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      animation: {
        "breathe": "breathe 4s ease-in-out infinite",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
};
"@ | Set-Content (Join-Path $OutputPath "frontend/tailwind.config.js") -Encoding UTF8

# frontend/src/main.jsx
@"
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"@ | Set-Content (Join-Path $OutputPath "frontend/src/main.jsx") -Encoding UTF8

# frontend/src/index.css
@"
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-950 text-gray-100 antialiased;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
}
"@ | Set-Content (Join-Path $OutputPath "frontend/src/index.css") -Encoding UTF8

# frontend/src/App.jsx
@"
import { useState, useEffect } from "react";
import { Activity, Cpu, Zap, Globe, Server } from "lucide-react";

export default function App() {
  const [health, setHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetch("/api/system/status").then(r => r.json()).then(setSystemStatus).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <header className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-breathe" />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Heady Systems
          </h1>
        </div>
        <p className="text-gray-500 text-sm">
          Sacred Geometry :: Organic Systems :: Breathing Interfaces
        </p>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Health Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-green-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold">Health</h2>
          </div>
          {health ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>Status: <span className="text-green-400">OK</span></p>
              <p>Version: {health.version}</p>
              <p>Uptime: {Math.floor(health.uptime)}s</p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Loading...</p>
          )}
        </div>

        {/* System Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-cyan-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">System</h2>
          </div>
          {systemStatus ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>Environment: <span className="text-cyan-400">{systemStatus.environment}</span></p>
              <p>Nodes: {systemStatus.capabilities?.nodes?.active || 0}/{systemStatus.capabilities?.nodes?.total || 0}</p>
              <p>Production Ready: {systemStatus.production_ready ? "Yes" : "No"}</p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Loading...</p>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-purple-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Actions</h2>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => fetch("/api/system/production", { method: "POST" }).then(r => r.json()).then(d => { alert("Production activated!"); location.reload(); })}
              className="w-full px-4 py-2 bg-purple-900/50 border border-purple-700/50 rounded-xl text-sm text-purple-300 hover:bg-purple-800/50 transition-colors"
            >
              Activate Production
            </button>
            <button
              onClick={() => fetch("/api/pipeline/run", { method: "POST" }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
              Run Pipeline
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
"@ | Set-Content (Join-Path $OutputPath "frontend/src/App.jsx") -Encoding UTF8

Write-Host "  [OK] Frontend (Vite + React + TailwindCSS) created" -ForegroundColor Green

# ─── Backend ──────────────────────────────────────────────────────────
Write-Host "Creating backend..." -ForegroundColor Yellow

@"
{
  "name": "heady-backend",
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
}
"@ | Set-Content (Join-Path $OutputPath "backend/package.json") -Encoding UTF8

# backend/python_worker/requirements.txt
@"
transformers>=4.38.0
torch>=2.1.0
pyyaml>=6.0
requests>=2.31.0
"@ | Set-Content (Join-Path $OutputPath "backend/python_worker/requirements.txt") -Encoding UTF8

Write-Host "  [OK] Backend created" -ForegroundColor Green

# ─── GitHub Config ────────────────────────────────────────────────────
Write-Host "Creating GitHub config..." -ForegroundColor Yellow

# .github/workflows/ci.yml
@"
name: Heady CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --passWithNoTests
      - run: npm run build
"@ | Set-Content (Join-Path $OutputPath ".github/workflows/ci.yml") -Encoding UTF8

# .github/copilot-instructions.md
@"
# Heady Systems - AI Assistant Instructions

You are working on the Heady Systems project, a Sacred Geometry architecture that combines organic systems with breathing interfaces.

## Tech Stack
- **Manager:** Node.js (Express) on port 3300
- **Worker:** Python (backend/python_worker)
- **Frontend:** React (Vite + TailwindCSS)
- **Deployment:** Render.com
- **AI Nodes:** JULES, OBSERVER, BUILDER, ATLAS, PYTHIA

## Key Files
- `heady-manager.js` - Main server entry point
- `src/hc_pipeline.js` - Pipeline engine
- `frontend/` - Vite React app
- `configs/` - YAML configuration
- `.heady/registry.json` - Node/tool registry

## Conventions
- Sacred Geometry branding headers on all files
- Organic, rounded, breathing UI aesthetics
- All API routes under `/api/`
"@ | Set-Content (Join-Path $OutputPath ".github/copilot-instructions.md") -Encoding UTF8

Write-Host "  [OK] GitHub config created" -ForegroundColor Green

# ─── Scripts ──────────────────────────────────────────────────────────
Write-Host "Creating scripts..." -ForegroundColor Yellow

# scripts/Heady-Sync.ps1
@'
# Heady Sync - Push to all configured remotes
param([switch]$FetchOnly)

$ErrorActionPreference = "Stop"
$remotes = @("origin", "heady-me", "heady-sys", "heady-conn", "sandbox")

Write-Host "`n  Heady Sync v3.0.0`n" -ForegroundColor Cyan

# Fetch all
foreach ($remote in $remotes) {
    try {
        git fetch $remote 2>&1 | Out-Null
        Write-Host "  [FETCH] $remote" -ForegroundColor Green
    } catch {
        Write-Host "  [SKIP]  $remote (not configured)" -ForegroundColor Yellow
    }
}

if ($FetchOnly) { exit 0 }

# Push to all
$branch = git branch --show-current
foreach ($remote in $remotes) {
    try {
        git push $remote $branch 2>&1 | Out-Null
        Write-Host "  [PUSH]  $remote/$branch" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL]  $remote/$branch" -ForegroundColor Red
    }
}

Write-Host "`n  Sync complete.`n" -ForegroundColor Cyan
'@ | Set-Content (Join-Path $OutputPath "scripts/Heady-Sync.ps1") -Encoding UTF8

Write-Host "  [OK] Scripts created" -ForegroundColor Green

# ─── public/index.html (fallback) ────────────────────────────────────
@"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Heady Systems</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h1>Heady Systems</h1>
<p style="color:#666">Sacred Geometry :: Organic Systems :: Breathing Interfaces</p>
<p><a href="/api/health" style="color:#4ade80">API Health</a></p>
</div>
</body>
</html>
"@ | Set-Content (Join-Path $OutputPath "public/index.html") -Encoding UTF8

# ─── Configs ──────────────────────────────────────────────────────────
Write-Host "Creating configs..." -ForegroundColor Yellow

@"
# Heady Pipeline Configuration
pipeline:
  version: "3.0.0"
  stages:
    - id: health-check
      name: Health Check
      timeout: 10000
    - id: code-analysis
      name: Code Analysis
      timeout: 30000
      depends_on: [health-check]
    - id: build
      name: Build
      timeout: 60000
      depends_on: [code-analysis]
    - id: deploy
      name: Deploy
      timeout: 120000
      depends_on: [build]

circuit_breakers:
  default:
    failure_threshold: 3
    reset_timeout: 30000
"@ | Set-Content (Join-Path $OutputPath "configs/pipeline.yaml") -Encoding UTF8

Write-Host "  [OK] Configs created" -ForegroundColor Green

# ─── Windsurf workflows ──────────────────────────────────────────────
Copy-Item (Join-Path $PSScriptRoot "..\\.windsurf\\workflows\\hc-full-pipeline.md") (Join-Path $OutputPath ".windsurf/workflows/hc-full-pipeline.md") -ErrorAction SilentlyContinue

# ─── NPM Install ─────────────────────────────────────────────────────
if (-not $SkipNpmInstall) {
    Write-Host ""
    Write-Host "Running npm install..." -ForegroundColor Yellow
    Push-Location $OutputPath
    npm install 2>&1 | Out-Null
    Write-Host "  [OK] Root dependencies installed" -ForegroundColor Green

    Push-Location (Join-Path $OutputPath "frontend")
    npm install 2>&1 | Out-Null
    Write-Host "  [OK] Frontend dependencies installed" -ForegroundColor Green
    Pop-Location

    Pop-Location
}

# ─── Summary ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  SCAFFOLD COMPLETE                               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Path: $OutputPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. cd $OutputPath" -ForegroundColor White
Write-Host "    2. cp .env.example .env" -ForegroundColor White
Write-Host "    3. npm run dev          # Start manager" -ForegroundColor White
Write-Host "    4. npm run frontend     # Start frontend dev" -ForegroundColor White
Write-Host ""
Write-Host "  To wire up the full pipeline, copy and refactor:" -ForegroundColor Yellow
Write-Host "    - src/hc_pipeline.js from pre-production" -ForegroundColor White
Write-Host "    - src/agents/ from pre-production" -ForegroundColor White
Write-Host "    - HeadyAcademy/ content from pre-production" -ForegroundColor White
Write-Host ""
