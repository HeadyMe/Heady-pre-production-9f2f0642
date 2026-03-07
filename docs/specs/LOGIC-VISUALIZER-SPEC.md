# Heady™ Logic Visualizer — Sacred Geometry Decision Debugger

> Purpose: Help developers debug and understand Sacred Geometry decision-making
> Priority: IMMEDIATE | Enables: Developer adoption + Pilot transparency

---

## 1. Overview

The Logic Visualizer is a real-time debugging tool that makes Heady's Sacred Geometry orchestration decisions transparent and auditable. It visualizes:

- **Task decomposition** — how work is split across swarm agents
- **CSL gate evaluations** — cosine similarity scoring for routing decisions
- **PHI-scaled timing** — all interval and backoff calculations
- **Swarm consensus** — how agents agree on outcomes
- **Circuit breaker state** — which services are open/closed/half-open
- **Vector memory queries** — 3D spatial retrieval paths

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│  Logic Visualizer (Browser SPA)                  │
│                                                   │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Decision   │  │ Swarm    │  │ Circuit      │  │
│  │ Tree View  │  │ Topology │  │ Breaker Map  │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │               │           │
│  ┌─────▼──────────────▼───────────────▼───────┐  │
│  │         SSE Event Stream Consumer           │  │
│  └─────────────────────┬──────────────────────┘  │
│                         │                         │
└─────────────────────────┼─────────────────────────┘
                          │ SSE
            ┌─────────────▼─────────────┐
            │  Visualizer API Service    │
            │  GET /api/viz/decisions    │
            │  GET /api/viz/topology     │
            │  GET /api/viz/sse          │
            │  GET /api/viz/replay/:id   │
            └─────────────┬─────────────┘
                          │
            ┌─────────────▼─────────────┐
            │  HeadyConductor Events     │
            │  + Projection Service      │
            │  + Pipeline Telemetry      │
            └───────────────────────────┘
```

---

## 3. Core Views

### 3.1 Decision Tree View

Visualizes the task decomposition and routing logic:

```
Task: "Draft grant proposal for STEM education"
├── [CSL: 0.92] Research Phase
│   ├── [CSL: 0.88] heady_research → ATLAS
│   │   └── PHI interval: 8090ms | Status: ✅ Complete (2.3s)
│   └── [CSL: 0.85] heady_memory → recall_grants
│       └── PHI interval: 5000ms | Status: ✅ Complete (0.8s)
├── [CSL: 0.87] Analysis Phase
│   └── [CSL: 0.91] heady_analyze → PYTHIA
│       └── PHI interval: 6180ms | Status: ⏳ Running
├── [CSL: 0.79] Generation Phase
│   └── [CSL: 0.84] heady_coder → JULES
│       └── Waiting on: Analysis Phase
└── [CSL: 0.95] Validation Phase
    ├── HeadyCheck → two-key gate
    └── HeadyAssure → compliance check
```

### 3.2 Swarm Topology View

Interactive 3D visualization of active agents:

- Nodes positioned by Sacred Geometry ring (Inner/Middle/Outer/Governance)
- Edge connections show active data flow
- Color coding: Green (healthy), Yellow (degraded), Red (circuit open)
- Size scaled by current load (Fibonacci proportions)

### 3.3 Circuit Breaker Dashboard

Real-time state of all circuit breakers:

| Service | State | Failure Rate | Last Trip | Recovery In |
|---------|-------|-------------|-----------|-------------|
| LLM Router | CLOSED | 1.2% | Never | — |
| pgvector | CLOSED | 0.0% | Never | — |
| Redis | HALF_OPEN | 4.8% | 2m ago | Probing... |
| External API | OPEN | 12.3% | 30s ago | ~16,180ms |

### 3.4 PHI Timeline View

Horizontal timeline showing all PHI-scaled intervals:

```
t=0          t=809ms      t=1309ms     t=2118ms     t=3427ms
│            │            │            │            │
▼            ▼            ▼            ▼            ▼
[Backoff 1]  [Backoff 2]  [Backoff 3]  [Backoff 4]  [Backoff 5]

φ¹=1.618    φ²=2.618     φ³=4.236     φ⁴=6.854     φ⁵=11.09
```

---

## 4. Implementation

### 4.1 Visualizer API Middleware

File: `src/visualizer/visualizer-api.js`
```javascript
const express = require('express');
const router = express.Router();

const PHI = 1.6180339887;

// In-memory decision log (ring buffer, Fibonacci-sized)
const DECISION_LOG_SIZE = 233; // Fibonacci number
const decisions = [];
const sseClients = new Set();

// Middleware: intercept conductor decisions
function captureDecision(decision) {
  decisions.push({
    id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...decision,
  });
  if (decisions.length > DECISION_LOG_SIZE) {
    decisions.shift();
  }
  // Broadcast to SSE clients
  broadcastSSE({ type: 'decision', data: decision });
}

// SSE endpoint
router.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ phi: PHI })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(event) {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const client of sseClients) {
    client.write(frame);
  }
}

// Decision history
router.get('/decisions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 34, DECISION_LOG_SIZE);
  res.json({
    decisions: decisions.slice(-limit),
    total: decisions.length,
    phi: PHI,
  });
});

// Replay a specific decision chain
router.get('/replay/:taskId', (req, res) => {
  const taskDecisions = decisions.filter(d => d.taskId === req.params.taskId);
  res.json({
    taskId: req.params.taskId,
    chain: taskDecisions,
    duration: taskDecisions.length > 1
      ? taskDecisions[taskDecisions.length - 1].timestamp - taskDecisions[0].timestamp
      : 0,
  });
});

// Current topology
router.get('/topology', (req, res) => {
  // Pull from conductor's active agent registry
  res.json({
    rings: {
      central: ['HeadySoul'],
      inner: ['HeadyConductor', 'HeadyVinci', 'HeadyBrains'],
      middle: ['JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS', 'PYTHIA'],
      outer: ['BRIDGE', 'MUSE', 'SENTINEL', 'NOVA', 'JANITOR', 'SOPHIA', 'CIPHER', 'LENS'],
      governance: ['HeadyCheck', 'HeadyAssure', 'HeadyAware', 'HeadyPatterns', 'HeadyMC', 'HeadyRisk'],
    },
    phi: PHI,
  });
});

module.exports = { router, captureDecision };
```

### 4.2 Decision Capture Hook

File: `src/visualizer/conductor-hook.js`
```javascript
const { captureDecision } = require('./visualizer-api');

/**
 * Wraps HeadyConductor to capture all routing decisions
 * Drop-in integration — add to conductor initialization
 */
function instrumentConductor(conductor) {
  const originalRoute = conductor.routeTask.bind(conductor);
  
  conductor.routeTask = async function(task, context) {
    const start = Date.now();
    const decision = {
      taskId: task.id,
      phase: 'routing',
      input: {
        taskType: task.type,
        priority: task.priority,
        capabilities: task.requiredCapabilities,
      },
    };

    try {
      const result = await originalRoute(task, context);
      
      decision.output = {
        assignedAgent: result.agent,
        cslScore: result.cslScore,
        alternativesConsidered: result.alternatives?.length || 0,
        routingTime: Date.now() - start,
      };
      decision.status = 'success';
      
      captureDecision(decision);
      return result;
    } catch (err) {
      decision.status = 'error';
      decision.error = err.message;
      captureDecision(decision);
      throw err;
    }
  };

  return conductor;
}

module.exports = { instrumentConductor };
```

### 4.3 Frontend Dashboard Component

File: `src/visualizer/dashboard.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady™ Logic Visualizer</title>
  <style>
    :root {
      --phi: 1.618;
      --bg: #0a0a0f;
      --surface: #1a1a2e;
      --accent: #e6b800;
      --text: #e0e0e0;
      --success: #00c853;
      --warning: #ff9100;
      --error: #ff1744;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'JetBrains Mono', monospace; 
      background: var(--bg); 
      color: var(--text);
      min-height: 100vh;
    }
    .header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--surface);
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header h1 { font-size: 18px; color: var(--accent); }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 16px;
    }
    .panel {
      background: var(--surface);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #2a2a4a;
    }
    .panel h2 { 
      font-size: 13px; 
      color: var(--accent); 
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .decision-tree { font-size: 12px; line-height: 1.8; }
    .decision-tree .node { padding-left: 20px; border-left: 1px solid #333; }
    .csl-score { color: var(--accent); font-weight: bold; }
    .status-ok { color: var(--success); }
    .status-warn { color: var(--warning); }
    .status-err { color: var(--error); }
    #decision-log { 
      max-height: 400px; 
      overflow-y: auto; 
      font-size: 11px;
      font-family: monospace;
    }
    #decision-log .entry {
      padding: 4px 8px;
      border-bottom: 1px solid #1a1a2e;
    }
    .circuit-table { width: 100%; font-size: 12px; }
    .circuit-table th { text-align: left; color: var(--accent); padding: 4px; }
    .circuit-table td { padding: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="status-dot" id="connection-status"></div>
    <h1>Heady™ Logic Visualizer</h1>
    <span id="event-count" style="margin-left:auto; font-size:12px; opacity:0.6">Events: 0</span>
  </div>
  
  <div class="grid">
    <div class="panel">
      <h2>Decision Tree (Live)</h2>
      <div id="decision-tree" class="decision-tree">Waiting for decisions...</div>
    </div>
    
    <div class="panel">
      <h2>Circuit Breakers</h2>
      <table class="circuit-table" id="circuit-table">
        <tr><th>Service</th><th>State</th><th>Fail Rate</th><th>Recovery</th></tr>
      </table>
    </div>
    
    <div class="panel" style="grid-column: span 2">
      <h2>Decision Log (φ-scaled Ring Buffer)</h2>
      <div id="decision-log"></div>
    </div>
  </div>

  <script>
    const PHI = 1.6180339887;
    let eventCount = 0;
    let reconnectDelay = 500;
    
    function connectSSE() {
      const es = new EventSource('/api/viz/sse');
      
      es.addEventListener('connected', () => {
        document.getElementById('connection-status').style.background = '#00c853';
        reconnectDelay = 500;
      });
      
      es.addEventListener('decision', (e) => {
        const data = JSON.parse(e.data);
        eventCount++;
        document.getElementById('event-count').textContent = `Events: ${eventCount}`;
        appendDecisionLog(data);
        updateDecisionTree(data);
      });
      
      es.addEventListener('circuit', (e) => {
        const data = JSON.parse(e.data);
        updateCircuitTable(data);
      });
      
      es.onerror = () => {
        document.getElementById('connection-status').style.background = '#ff1744';
        es.close();
        // PHI-backoff reconnect
        reconnectDelay = Math.min(reconnectDelay * PHI, 30000);
        setTimeout(connectSSE, reconnectDelay);
      };
    }
    
    function appendDecisionLog(data) {
      const log = document.getElementById('decision-log');
      const entry = document.createElement('div');
      entry.className = 'entry';
      const statusClass = data.status === 'success' ? 'status-ok' : 'status-err';
      entry.innerHTML = `
        <span style="opacity:0.5">${new Date(data.timestamp).toLocaleTimeString()}</span>
        <span class="${statusClass}">[${data.status}]</span>
        <span>${data.phase}</span>
        ${data.output?.cslScore ? `<span class="csl-score">CSL: ${data.output.cslScore.toFixed(3)}</span>` : ''}
        ${data.output?.assignedAgent ? `→ ${data.output.assignedAgent}` : ''}
        ${data.output?.routingTime ? `(${data.output.routingTime}ms)` : ''}
      `;
      log.prepend(entry);
      // Keep Fibonacci-sized buffer
      while (log.children.length > 233) log.removeChild(log.lastChild);
    }
    
    function updateDecisionTree(data) {
      // Simplified tree update
      const tree = document.getElementById('decision-tree');
      if (data.output) {
        tree.innerHTML = `
          <div>Task: ${data.taskId || 'unknown'}</div>
          <div class="node">
            <span class="csl-score">[CSL: ${(data.output.cslScore || 0).toFixed(3)}]</span>
            ${data.phase} → ${data.output.assignedAgent || '?'}
            <span class="${data.status === 'success' ? 'status-ok' : 'status-err'}">
              ${data.status === 'success' ? '✅' : '❌'} ${data.output.routingTime || 0}ms
            </span>
          </div>
        `;
      }
    }
    
    function updateCircuitTable(data) {
      const table = document.getElementById('circuit-table');
      // Update or add row
      let row = document.getElementById(`cb-${data.service}`);
      if (!row) {
        row = table.insertRow();
        row.id = `cb-${data.service}`;
      }
      const stateClass = data.state === 'CLOSED' ? 'status-ok' : 
                          data.state === 'HALF_OPEN' ? 'status-warn' : 'status-err';
      row.innerHTML = `
        <td>${data.service}</td>
        <td class="${stateClass}">${data.state}</td>
        <td>${(data.failureRate * 100).toFixed(1)}%</td>
        <td>${data.recoveryIn ? data.recoveryIn + 'ms' : '—'}</td>
      `;
    }
    
    connectSSE();
  </script>
</body>
</html>
```

---

## 5. Integration Steps

1. Add `src/visualizer/` directory to pre-production monorepo
2. Import `instrumentConductor` in HeadyConductor initialization
3. Mount visualizer router: `app.use('/api/viz', vizRouter)`
4. Serve dashboard on port 3851 or as sub-path of existing dashboard
5. Add `VIZ_ENABLED=true` env var toggle for production safety

---

## 6. Future Extensions

- 3D WebGL topology using Three.js (Sacred Geometry node positions)
- Decision replay with time scrubbing
- CSL gate parameter tuning UI
- Export decision chains as JSON for audit
- Integration with HeadyPatterns for pattern violation alerts
