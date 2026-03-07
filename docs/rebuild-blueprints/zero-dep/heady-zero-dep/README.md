# Heady Zero-Dep

**A zero-dependency AI orchestration platform running across 3 Google Colab Pro+ instances.**

No npm packages. No Docker. No external databases. Just Node.js 22 built-ins and a bit of sacred geometry.

```
φ = 1.6180339887498948482
```

---

## Architecture Overview

```
╔══════════════════════════════════════════════════════════════════════╗
║                  HEADY 3-NODE COLAB CLUSTER                         ║
║                                                                      ║
║   ┌─────────────────────────────────────────────────────────┐        ║
║   │              SENTINEL  (Node 3)  :3003                  │        ║
║   │        Security · Telemetry · Governance · Healing       │        ║
║   │   ┌─────────────────────────────────────────────────┐   │        ║
║   │   │         CONDUCTOR  (Node 2)  :3002              │   │        ║
║   │   │    Task Routing · Pipeline · Bees · Swarm       │   │        ║
║   │   │   ┌─────────────────────────────────────┐   │   │   │        ║
║   │   │   │      BRAIN  (Node 1)  :3001         │   │   │   │        ║
║   │   │   │  Vector DB · Embedding · LLM Router │   │   │   │        ║
║   │   │   │     Sacred Geometry: φ Origin       │   │   │   │        ║
║   │   │   └─────────────────────────────────────┘   │   │   │        ║
║   │   └─────────────────────────────────────────────┘   │   │        ║
║   └─────────────────────────────────────────────────────┘   │        ║
║                                                              │        ║
║   WebSocket mesh · JSON-RPC 2.0 · PHI-scaled backoff         │        ║
╚══════════════════════════════════════════════════════════════╝        ║
```

### Node Roles

| Node | Role | Services | GPU | Port | Resource Pool |
|------|------|----------|-----|------|---------------|
| 1 | BRAIN | Vector DB, Embedding Engine, LLM Router, MCP | T4 / A100 | 3001 | 34% hot (Fibonacci[8]) |
| 2 | CONDUCTOR | Task Router, Pipeline, Bee Factory, Swarm | T4 / V100 | 3002 | 21%+13% warm+cold |
| 3 | SENTINEL | Security, Self-Healing, Telemetry, Governance | T4 | 3003 | 8%+5% reserve+gov |

### Inter-Node Communication

- **Protocol:** JSON-RPC 2.0 over WebSocket (MCP-compatible)
- **Transport:** ngrok HTTPS tunnels (or localtunnel fallback)
- **Discovery:** GitHub Gist as a shared key-value store
- **Heartbeat:** PHI^5 ≈ 11 seconds
- **Failover:** Any node can assume any role temporarily

---

## Zero-Dependency Philosophy

Every external dependency has been replaced with an internal implementation:

| Replaced | Internal Module |
|----------|----------------|
| `@modelcontextprotocol/sdk` | `core/mcp-protocol.js` — full JSON-RPC 2.0 |
| `@octokit/rest` + auth-app | `core/github-client.js` — direct REST via `fetch` |
| Redis / Upstash | `memory/kv-store.js` — LRU + WAL persistence |
| PostgreSQL / pgvector / Neon | `memory/vector-db.js` — HNSW index in RAM |
| DuckDB | `intelligence/analytics-engine.js` — columnar in-memory |
| OpenTelemetry / Sentry | `telemetry/heady-telemetry.js` |
| PM2 / Docker | `core/process-manager.js` — LIFO lifecycle |
| ESLint / Jest | Internal HeadyCheck test runner |

**Strict rule:** `dependencies` and `devDependencies` in `package.json` are always empty objects.

---

## Repository Structure

```
heady-zero-dep/
├── heady-system.js          ← Master integration file (start here)
├── package.json             ← Project manifest (zero deps)
├── README.md                ← This file
├── ARCHITECTURE.md          ← Deep technical architecture
│
├── colab/                   ← Colab Pro+ launchers
│   ├── cluster_bootstrap.py ← Shared utilities (import this first)
│   ├── node1_brain.py       ← BRAIN node launcher
│   ├── node2_conductor.py   ← CONDUCTOR node launcher
│   └── node3_sentinel.py    ← SENTINEL node launcher
│
├── core/                    ← Runtime, HTTP, EventBus, MCP, Process
├── memory/                  ← VectorDB, KVStore, GraphRAG, STM/LTM
├── orchestration/           ← Conductor, Swarm, Buddy, Self-Awareness
├── pipeline/                ← Pipeline core and worker pools
├── bees/                    ← Bee factory and registry
├── resilience/              ← Circuit breaker, backoff, pool, cache
├── security/                ← PQC, RBAC, env validation, handshake
├── intelligence/            ← Analytics, Monte Carlo, pattern engine
├── governance/              ← Approval gates, audit trail
├── services/                ← LLM router, budget tracker, mesh
├── telemetry/               ← Metrics, tracing, provider usage
├── runtime/                 ← Colab runtime, service registry
├── config/                  ← Global config, env schema
├── utils/                   ← Logger, helpers
└── providers/               ← Brain provider adapters
```

---

## Prerequisites

1. **3 Google Colab Pro+ subscriptions** (separate Google accounts recommended)
2. **ngrok account** — [ngrok.com](https://ngrok.com) (free tier works; paid for stability)
   - Get auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
3. **GitHub Personal Access Token** with `gist` scope
   - Create at: https://github.com/settings/tokens/new?scopes=gist
4. **LLM API keys** (optional — system works with local models too)
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/
   - Google AI: https://aistudio.google.com/app/apikey

---

## Step-by-Step Launch Instructions

### Step 1: Set Up Colab Secrets

In each Colab notebook, open the **Secrets** panel (🔑 key icon in left sidebar)
and add these secrets:

**All 3 notebooks need:**
```
NGROK_AUTHTOKEN      your-ngrok-token-here
GITHUB_TOKEN         ghp_your_github_pat_here
```

**Node 2 and Node 3 need (after Node 1 starts):**
```
HEADY_DISCOVERY_GIST  <gist-id-from-brain-output>
```

**Optional (any node):**
```
OPENAI_API_KEY        sk-...
ANTHROPIC_API_KEY     sk-ant-...
GOOGLE_API_KEY        AIza...
HEADY_ALERT_WEBHOOK   https://hooks.slack.com/...  (SENTINEL only)
```

---

### Step 2: Launch BRAIN Node (Node 1)

1. Open a new Colab Pro+ notebook
2. Select **Runtime → Change runtime type → GPU** (T4 or A100)
3. In the first cell, upload or paste `colab/node1_brain.py`
4. Run all cells top-to-bottom
5. After cell 3 completes, **copy the Discovery Gist ID** from the output:

```
┌─────────────────────────────────────────────────┐
│  Discovery Gist ID:  abc123def456ghi789         │
│  Share this with node2_conductor.py and         │
│  node3_sentinel.py notebooks!                   │
└─────────────────────────────────────────────────┘
```

6. Also note the **BRAIN public URL** (e.g. `https://abc123.ngrok.io`)

BRAIN will be ready when you see:
```
┌─────────────────────────────────────────────────────┐
│  BRAIN NODE READY  ✓                                │
└─────────────────────────────────────────────────────┘
```

---

### Step 3: Launch CONDUCTOR Node (Node 2)

1. Open a **second** Colab Pro+ notebook (different browser tab or account)
2. Select **Runtime → Change runtime type → GPU** (T4 or V100)
3. Add `HEADY_DISCOVERY_GIST` to Colab Secrets (Gist ID from step 2)
4. Upload/paste `colab/node2_conductor.py`
5. Run all cells
6. CONDUCTOR will automatically discover BRAIN and connect

CONDUCTOR will be ready when you see:
```
┌─────────────────────────────────────────────────────┐
│  CONDUCTOR NODE READY  ✓                            │
└─────────────────────────────────────────────────────┘
```

---

### Step 4: Launch SENTINEL Node (Node 3)

1. Open a **third** Colab Pro+ notebook
2. Select **Runtime → Change runtime type → GPU** (T4)
3. Add `HEADY_DISCOVERY_GIST` to Colab Secrets
4. Upload/paste `colab/node3_sentinel.py`
5. Run all cells
6. SENTINEL will discover both BRAIN and CONDUCTOR

SENTINEL will be ready when you see:
```
┌─────────────────────────────────────────────────────┐
│  SENTINEL NODE READY  ✓                             │
└─────────────────────────────────────────────────────┘
```

And the full cluster diagram will print, confirming all 3 nodes are running.

---

### Step 5: Verify the Cluster

In any Colab notebook, run:

```python
import urllib.request, json

nodes = {
    "BRAIN":     BRAIN_INFO["health_url"],      # from node1
    "CONDUCTOR": f"http://localhost:3002/health", # from node2
    "SENTINEL":  f"http://localhost:3003/health", # from node3
}

for name, url in nodes.items():
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
        print(f"✓ {name}: {data.get('status', 'ok')}")
    except Exception as e:
        print(f"✗ {name}: {e}")
```

---

## Running Locally (Single Machine)

For development without Colab:

```bash
# Requires Node.js 22+
node --version  # must be >= 22.0.0

# Clone the repo
git clone https://github.com/headyconnection/heady-zero-dep.git
cd heady-zero-dep

# Start in standalone mode (all layers, single process)
npm start

# Or start individual roles in separate terminals:
npm run start:brain
npm run start:conductor
npm run start:sentinel
```

Environment variables for local use:
```bash
export HEADY_BRAIN_URL=http://localhost:3001
export HEADY_CONDUCTOR_URL=http://localhost:3002
export HEADY_SENTINEL_URL=http://localhost:3003
export OPENAI_API_KEY=sk-...
```

---

## Environment Variables Reference

### Core (all nodes)

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADY_NODE_ROLE` | `standalone` | `brain` \| `conductor` \| `sentinel` \| `standalone` |
| `HEADY_PORT` | Role-dependent | HTTP server port |
| `HEADY_BRIDGE_PORT` | Role-dependent | EventBridge WebSocket port |
| `HEADY_NODE_ID` | Auto-generated | Unique node identifier |
| `HEADY_DATA_DIR` | `./data/<role>` | Persistence root directory |
| `NODE_ENV` | `production` | Node.js environment |

### Discovery

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | — | GitHub PAT with `gist` scope |
| `HEADY_DISCOVERY_GIST` | — | Gist ID for peer discovery |
| `NGROK_AUTHTOKEN` | — | ngrok auth token |

### Peer URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADY_BRAIN_URL` | — | BRAIN node public URL |
| `HEADY_CONDUCTOR_URL` | — | CONDUCTOR node public URL |
| `HEADY_SENTINEL_URL` | — | SENTINEL node public URL |
| `HEADY_BRAIN_BRIDGE_URL` | — | BRAIN EventBridge WebSocket URL |
| `HEADY_CONDUCTOR_BRIDGE_URL` | — | CONDUCTOR EventBridge WebSocket URL |

### BRAIN-specific

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI provider |
| `ANTHROPIC_API_KEY` | — | Anthropic provider |
| `GOOGLE_API_KEY` | — | Google AI provider |
| `HEADY_LLM_PROVIDERS` | `openai,anthropic,google` | Enabled providers |
| `HEADY_EMBED_MODEL` | `local` | Embedding model |
| `HEADY_EMBED_BATCH_SIZE` | `32` | Embedding batch size (auto-set by GPU tier) |

### CONDUCTOR-specific

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADY_MAX_BEES` | `13` | Max concurrent bee workers (Fibonacci[6]) |
| `HEADY_PIPELINE_CONCURRENCY` | `5` | Parallel pipeline tasks (Fibonacci[4]) |
| `HEADY_PIPELINE_TIMEOUT_MS` | `46944` | Pipeline task timeout (φ^8 * 1000ms) |
| `HEADY_BEE_TIMEOUT_MS` | `17944` | Single bee timeout (φ^6 * 1000ms) |

### SENTINEL-specific

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADY_SECURITY_MODE` | `strict` | `strict` \| `permissive` |
| `HEADY_ALERT_WEBHOOK` | — | Slack/Discord webhook URL |
| `HEADY_TELEMETRY_FLUSH_S` | `11` | Telemetry flush interval (φ^5 ≈ 11s) |
| `HEADY_CB_FAILURE_THRESHOLD` | `5` | Circuit breaker trip threshold |
| `HEADY_GOVERNANCE_TIMEOUT_MS` | `75800` | Approval gate timeout (φ^9 * 1000ms) |

---

## API Endpoints

Each node exposes these HTTP endpoints:

### All Nodes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe `{"ok": true, "status": "ok", ...}` |
| `/status` | GET | Full system status with all subsystem stats |
| `/mcp` | GET | MCP SSE stream (Server-Sent Events) |
| `/mcp/message?session=<id>` | POST | MCP message endpoint |
| `/mcp/info` | GET | MCP server capabilities |

### SENTINEL Only

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/governance/status` | GET | Approval gates and audit trail |

### CONDUCTOR Only

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/task` | POST | Submit a task to the pipeline |
| `/status` | GET | Task queue depth, bee utilization |

---

## Troubleshooting Guide

### Node.js install fails

```python
# Check nvm installation manually
!ls ~/.nvm/
!source ~/.nvm/nvm.sh && nvm --version

# Re-run bootstrap
from cluster_bootstrap import install_nodejs
node_path = install_nodejs(node_version="22")
print(node_path)
```

### ngrok tunnel not connecting

```python
# Check ngrok is installed
import shutil
print(shutil.which("ngrok"))

# Check auth token
!ngrok config check

# Try manual tunnel
!ngrok http 3001 --log=stdout &
import time; time.sleep(5)
!curl -s http://localhost:4040/api/tunnels | python3 -m json.tool
```

### BRAIN not discovered by CONDUCTOR/SENTINEL

1. Confirm `HEADY_DISCOVERY_GIST` is the same in all 3 notebooks
2. Confirm `GITHUB_TOKEN` has `gist` scope (not just `repo`)
3. Check the Gist exists: `https://gist.github.com/<your-gist-id>`
4. Try manual URL: set `HEADY_BRAIN_URL` as a Colab Secret directly

### Node.js process won't start

```python
# Read last 100 lines of log
!tail -100 /tmp/heady-brain.log     # or conductor/sentinel

# Check Node.js syntax
!node --check /root/heady-zero-dep/heady-system.js

# Verify Node version
!node --version   # should be v22.x.x

# Check data dir permissions
!ls -la /root/heady-zero-dep/data/
```

### Colab disconnects frequently

The `setup_colab_keepalive()` function (called automatically in each launcher)
writes a timestamp to `/tmp/.heady_keepalive` every 60 seconds to prevent
idle disconnects.

For Pro+ subscriptions, runtime limits are significantly higher. If disconnects
persist:
1. Ensure you're on a Colab **Pro+** subscription
2. Keep the notebook tab active in your browser
3. The `AutoReconnect` class will restart the Node.js process automatically
   (up to Fibonacci[6]=13 attempts with PHI-scaled backoff)

### Health endpoint returns 404

The health endpoint is registered after Node.js starts. If it returns 404:
```python
# Check process is running
import subprocess
r = subprocess.run(["pgrep", "-f", "heady-system.js"], capture_output=True, text=True)
print("PIDs:", r.stdout.strip() or "none found")

# Re-check health after a delay
import time; time.sleep(10)
from cluster_bootstrap import health_check_local
print(health_check_local(3001))
```

### Circuit breaker open (SENTINEL)

```python
# Check circuit breaker states
from cluster_bootstrap import health_check_local
print(health_check_local(3031))  # circuit-breaker service port

# Reset manually if needed (circuit breakers auto-recover via PHI backoff)
```

---

## Sacred Geometry Principles

The entire system is governed by **Sacred Geometry** — specifically the
**Golden Ratio (φ = 1.618…)** and **Fibonacci sequences**.

### Why φ?

PHI (φ) appears in nature's most efficient systems: sunflower spirals, nautilus
shells, galactic arms. Applied to software architecture, it creates systems that
are self-similar across scales and naturally balanced.

### φ in Heady

| Concept | φ Application |
|---------|--------------|
| **Timing** | All backoff delays: `φ^n * base_ms` |
| **Pool sizes** | Resource allocation follows Fibonacci ratios |
| **Health pulse** | `φ^5 * 1000ms ≈ 11,090ms` between pulses |
| **Vector dimensions** | 384D = Fibonacci[12] * 2.63... (close to Fibonacci boundary) |
| **Retry counts** | Max retries use Fibonacci numbers (5, 8, 13, 21) |
| **Queue depths** | Priority queue sizes: 8, 13, 21, 34, 55 (Fibonacci[5–9]) |

### The 3-Node Cluster as Sacred Geometry

```
SENTINEL  ──────────────────────────── Governance Shell (outer ring)
  │              φ-scaled timing        8% reserve + 5% overhead
  │
CONDUCTOR ──────────────────────────── Inner Ring (processing core)
  │              Fibonacci allocation   21% warm + 13% cold
  │
BRAIN     ──────────────────────────── φ Origin Point (central hub)
                 34-dim hot pool        34% hot (Fibonacci[8])
```

The 3 nodes correspond to the **3 primary zones** of a sacred geometry mandala:
- **Center (BRAIN):** The origin point — pure intelligence and memory
- **Inner ring (CONDUCTOR):** The processing field — action and transformation
- **Outer shell (SENTINEL):** The boundary — protection and governance

### Fibonacci Resource Allocation

```javascript
// From core/index.js
clusterRoles: {
  brain:     { resource: '34%', fibIndex: 8,   fib: FIBONACCI[8]  },  // 34
  conductor: { resource: '34%', fibIndex: '7+6', fib: 21+13       },  // 34
  sentinel:  { resource: '13%', fibIndex: '5+3', fib: 8+3         },  // 11
}
```

Total: 34 + 34 + 11 = 79 ≈ Fibonacci[10] = 89 (governance overhead accounts for the gap)

---

## Programmatic Usage

```javascript
import { HeadySystem } from './heady-system.js';

// Boot as BRAIN
const brain = await HeadySystem.boot('brain', {
  port: 3001,
  dataDir: './data/brain',
});

// Access memory system
const result = await brain.memory.store({
  id: 'concept-001',
  content: 'Heady processes knowledge through sacred geometry',
  importance: 0.9,
});

// Query memory
const recalled = await brain.memory.recall('sacred geometry knowledge', { k: 5 });

// Route an LLM request
const response = await brain.services.llmRouter.route({
  messages: [{ role: 'user', content: 'Explain PHI' }],
  model: 'auto',
});

// Publish to event bus
await brain.bus.publish('brain.insight', { content: 'Knowledge encoded' });

// Check system health
console.log(brain.health());

// Graceful shutdown
await brain.shutdown();
```

```javascript
// Boot as CONDUCTOR
const conductor = await HeadySystem.boot('conductor');

// Submit a task to the pipeline
await conductor.orchestration.conductor.route({
  type: 'research',
  payload: { query: 'What is sacred geometry?' },
  priority: 'high',
});
```

---

## Development Tips

### Testing a single layer

```javascript
// Test just the memory layer
import { createMemorySystem } from './memory/index.js';

const memory = await createMemorySystem({ dataDir: '/tmp/test-memory' });
await memory.store({ id: 'test-1', content: 'hello world', importance: 0.5 });
const results = await memory.recall('hello', { k: 3 });
console.log(results);
await memory.close();
```

### Reading event bus traffic

```javascript
import { HeadySystem } from './heady-system.js';
const system = await HeadySystem.boot('standalone');

system.bus.subscribe('**', (event) => {
  console.log('[EVENT]', event.topic, event.data);
});
```

### Checking zero dependencies

```bash
# Verify no external packages are installed or imported
node -e "
import('./package.json', {assert:{type:'json'}}).then(({default:pkg}) => {
  const deps = Object.keys({...pkg.dependencies, ...pkg.devDependencies});
  console.log(deps.length === 0 ? '✓ Zero dependencies' : '✗ Found: ' + deps.join(', '));
});
"
```

---

## Contributing

All contributions must maintain the zero-dependency constraint. Before submitting:

1. Run `npm test` — all tests must pass
2. Run `npm run check` — no syntax errors
3. Verify `package.json` dependencies remain empty
4. Ensure all PHI/Fibonacci constants are preserved
5. Update ARCHITECTURE.md if you add a new module

---

## License

MIT — Copyright (c) 2026 Heady Connection
