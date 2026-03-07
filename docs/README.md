# HeadySystems Modular Monorepo

> **Unified AI orchestration platform** with 30+ microservices, semantic reasoning, and post-quantum cryptography.

## 🏗️ Architecture Overview

HeadySystems uses a **modular monolith** architecture combining the best of monorepos and microservices:

- **Monorepo benefits**: Atomic commits, unified versioning, shared tooling, simplified refactoring
- **Microservices isolation**: Independent deployment, fault isolation, technology flexibility
- **Build tool**: Turborepo for incremental builds and remote caching
- **Package manager**: pnpm with workspaces for efficient dependency management

### 📦 Project Structure

```
HeadySystems/
├── apps/                    # User-facing applications
│   ├── heady-web/           # Next.js dashboard (Cloudflare Pages)
│   └── heady-buddy/         # Personal assistant frontend
│
├── services/                # Backend microservices
│   ├── heady-brain/         # Cognitive core (chat, analysis, embeddings)
│   ├── heady-conductor/     # Task orchestration & agent coordination
│   ├── heady-mcp/           # Model Context Protocol gateway
│   ├── heady-coder/         # Code generation orchestrator
│   ├── heady-lens/          # Vision/GPU image processing
│   ├── heady-soul/          # Optimization & goal alignment
│   ├── heady-vinci/         # Pattern learning & prediction
│   └── heady-manager/       # API gateway & service registry
│
├── packages/                # Shared libraries
│   ├── core/                # Base utilities, logger, errors
│   ├── types/               # TypeScript type definitions
│   ├── config/              # Configuration schemas
│   ├── redis/               # Optimized Redis connection pool
│   ├── mcp/                 # MCP protocol implementation
│   └── semantic-logic/      # Continuous fuzzy logic gates
│
└── infrastructure/          # Deployment configs
    ├── cloudflare/          # Workers, Pages, Tunnels
    ├── google-cloud/        # Cloud Run, Vertex AI
    └── render/              # Container deployments
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 8+ (install: `npm install -g pnpm`)
- **Redis** 6+ (local or cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/HeadyMe/Heady-8f71ffc8.git
cd Heady-8f71ffc8

# Install dependencies (all packages)
pnpm install

# Build all packages
pnpm build

# Run all services in dev mode
pnpm dev
```

### Running Individual Services

```bash
# Run only HeadyBrain
pnpm --filter @headysystems/heady-brain dev

# Run HeadyConductor with dependencies
pnpm --filter @headysystems/heady-conductor... dev

# Test specific service
pnpm --filter @headysystems/heady-brain test
```

## 📊 Service Catalogue

| Service | Category | Port | Description |
|---------|----------|------|-------------|
| **HeadyBrain** | Cognitive Core | 3001 | Chat, analysis, embeddings, semantic search |
| **HeadyConductor** | Infrastructure | 3002 | Task orchestration, agent coordination |
| **HeadyMCP** | MCP | 3003 | Model Context Protocol gateway |
| **HeadySoul** | Cognitive Core | 3004 | Optimization & goal alignment |
| **HeadyVinci** | Cognitive Core | 3005 | Pattern learning & prediction |
| **HeadyCoder** | Software Factory | 3006 | Code generation orchestrator |
| **HeadyLens** | User-Facing | 3007 | Vision/GPU image processing |
| **HeadyManager** | Infrastructure | 3000 | API gateway & service registry |

## 🔧 Development Workflow

### Adding a New Service

```bash
# Use Turborepo generator
pnpm turbo gen

# Select "service" template
# Enter service name (e.g., "heady-foo")
```

### Adding a New Package

```bash
# Create package directory
mkdir -p packages/my-package/src

# Create package.json
cat > packages/my-package/package.json <<EOF
{
  "name": "@headysystems/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@headysystems/core": "workspace:*"
  }
}
EOF

# Create tsconfig.json
cat > packages/my-package/tsconfig.json <<EOF
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../core" }
  ]
}
EOF
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test -- --watch
```

### Deployment

```bash
# Deploy all services (via GitHub Actions)
git push origin main

# Manual deploy specific service
pnpm --filter @headysystems/heady-brain deploy
```

## 🛠️ Technology Stack

### Core Technologies
- **Runtime**: Node.js 20 (LTS)
- **Language**: TypeScript 5.3+
- **Build Tool**: Turborepo 1.12+
- **Package Manager**: pnpm 8.15+
- **Web Framework**: Express.js 4.18
- **Task Queue**: Bull (Redis-backed)

### Infrastructure
- **Cloud**: Cloudflare (Workers, Pages, Tunnels), Google Cloud (Cloud Run, Vertex AI), Render.com
- **Database**: Redis (connection pooling), PostgreSQL (planned)
- **Secrets**: 1Password Connect
- **CI/CD**: GitHub Actions
- **Monitoring**: Grafana + Prometheus

### AI/ML
- **LLM Providers**: OpenAI (GPT-4), Anthropic (Claude 3), Google (Gemini Pro), Groq
- **Local Models**: Ollama (Llama 2, Mistral)
- **Embeddings**: OpenAI Ada-002, local models
- **Vector DB**: HeadyVector (custom)

## 📈 Performance Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Orchestration reliability | ~75% | >80% | 🟡 In progress |
| Redis p99 latency | 143ms | <50ms | 🔴 Needs work |
| MCP handoff p99 | 143ms | <50ms | 🔴 Needs work |
| Test coverage (core logic) | ~60% | 100% | 🟡 In progress |

## 📚 Further Reading

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API_REFERENCE.md)
- [Contributing Guide](docs/CONTRIBUTING.md)

## 📝 License

UNLICENSED - Proprietary to HeadySystems Inc.

## 👤 Author

**Eric Haywood**
- Email: eric@headysystems.com
- GitHub: [@HeadyMe](https://github.com/HeadyMe)
