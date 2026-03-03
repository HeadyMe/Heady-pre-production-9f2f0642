---
description: how to operate through heady's vector space, bees, and event system for all work
---

# Heady Vector Space Operations

// turbo-all

**ALL work in this repository MUST flow through Heady's vector space and bee infrastructure.**

## Pre-Step · Antigravity Runtime Enforcement

> **Before ANY vector space operation**, confirm Antigravity runtime is enforcing 3D vector workspace mode. Run `/antigravity-runtime` workflow or manually verify:

```bash
node -e "
const p = require('./configs/services/antigravity-heady-runtime-policy.json');
const ok = p.enforce?.workspaceMode === '3d-vector' && p.enforce?.gateway === 'heady';
console.log(ok ? '✅ Antigravity: 3d-vector mode enforced' : '❌ Antigravity: NOT enforced — run /antigravity-runtime');
if (!ok) process.exit(1);
"
```

**Required config files:**

- `configs/services/antigravity-heady-runtime-policy.json` — enforcement rules
- `configs/services/antigravity-heady-runtime-state.json` — generated state
- `packages/heady-sacred-geometry-sdk/` — φ, octree, spatial embedder

## Core Principles

1. **RAM-first**: All operations happen in vector space first. External stores (GitHub, Cloudflare, HF Spaces) are projections of RAM state.
2. **Bee delegation**: Every domain has a bee. Use bees to do the work, not raw file operations.
3. **Event-driven**: Emit events via `global.eventBus` so the reactor can trigger downstream bees.
4. **Vector memory ingestion**: After every significant operation, write results to `global.__vectorMemory.add()`.
5. **Perception awareness**: The system knows how it appears externally — always consider what users see.

## Before Any Code Change

1. Check which bee owns the domain you're modifying:

   ```bash
   node -e "const bees = require('fs').readdirSync('src/bees').filter(f=>f.endsWith('-bee.js')); bees.forEach(b => { const m=require('./src/bees/'+b); console.log(m.domain, '-', m.description); })"
   ```

2. Verify the component is registered in vector memory:

   ```bash
   node -e "const vm = require('./src/vector-memory'); console.log(Object.keys(vm.store || {}).filter(k => k.includes('YOUR_DOMAIN')))"
   ```

3. Check the auto-success task catalog for related tasks:

   ```bash
   grep -r "YOUR_KEYWORD" src/*.json --include="*.json" -l
   ```

## When Creating New Files

1. **Register in the appropriate bee's `getWork()`** — the bee must know about the new component
2. **Add to vector memory** — `global.__vectorMemory.add('domain:component-name', { ... })`
3. **Emit an event** — `global.eventBus.emit('domain:component:created', { ... })`
4. **Update perception** — if the file affects what users see externally, trigger a perception scan

Example pattern:

```javascript
// In the bee's getWork():
work.push(async () => {
    const component = require('../path/to/new-component');
    
    // Register in vector memory
    if (global.__vectorMemory) {
        global.__vectorMemory.add('domain:component', {
            type: 'new-component',
            capabilities: ['...'],
            registeredAt: new Date().toISOString(),
        });
    }
    
    // Emit event for reactor
    if (global.eventBus) {
        global.eventBus.emit('domain:component:loaded', { ... });
    }
    
    return { bee: domain, action: 'component', loaded: true };
});
```

## When Modifying Existing Code

1. **Check what bee manages this file** — look at the bee's `getWork()` modules list
2. **After editing, verify the bee still loads** — `node -c src/bees/DOMAIN-bee.js`
3. **Write the change to vector memory** — so the system has awareness of the modification
4. **Let the reactor react** — emit the appropriate event

## Deployment Flow

All deployments go through vector space → ProjectionManager → deployment-bee:

1. Code changes are committed (ProjectionManager marks GitHub as stale)
2. `deployment-bee` fires its 5-worker pipeline:
   - Template injection (sync-projection-bee)
   - Git push (project RAM to GitHub)
   - HF Spaces push
   - Cloud Run deploy (gcloud run deploy --source)
   - Post-deploy health verification
3. `deployment:completed` event fires
4. ProjectionManager runs perception scan to verify external state

## Bee Domain Map

| Domain | Bee | Manages |
|--------|-----|---------|
| security | security-bee | Auth, secrets, RBAC, WebAuthn, mTLS |
| orchestration | orchestration-bee | Agent orchestrator, A2A, task decomposition |
| memory | memory-bee | Vector memory, GraphRAG, memory compaction |
| deployment | deployment-bee | Cloud Run, Cloudflare, GitHub, HF Spaces |
| midi | midi-bee | Network MIDI, DAW bridge, Ableton Remote Script |
| telemetry | telemetry-bee | OpenTelemetry, metrics, logging |
| health | health-bee | Health checks, liveness, readiness |
| resilience | resilience-bee | Circuit breakers, backoff, self-healing |
| connectors | connectors-bee | External APIs, providers, integrations |
| engines | engines-bee | Core engines, pipelines, processors |
| ops | ops-bee | DevOps, infra, containers, CI/CD |
| routes | routes-bee | API routes, endpoints, middleware |

## Event Bus Events to Know

| Event | Fires When |
|-------|------------|
| `auto_success:reaction` | Reactor processes a system event |
| `bee:DOMAIN:reacted` | A bee completes its work |
| `deployment:completed` | Deploy to any target finishes |
| `perception:scanned` | External state scanned |
| `projections:stale` | RAM state drifted from external |
| `vector_ops:started` | Vector space ops initialized |
| `bee_swarm:discovered` | All 32 bees loaded |
| `auto_success:tasks_loaded` | Task catalog loaded |
| `midi:ableton-script:validated` | Ableton script checked |

## Template for New Bees

If a new domain is needed:

```javascript
const domain = 'new-domain';
const description = 'What this bee manages';
const priority = 0.5; // 0-1, higher = more important

function getWork(ctx = {}) {
    const work = [];
    
    work.push(async () => {
        // Do the actual work
        // Register in vector memory
        // Emit events
        return { bee: domain, action: 'worker-name', result: '...' };
    });
    
    return work;
}

module.exports = { domain, description, priority, getWork };
```

Then add to `src/bees/registry.js` and it auto-discovers.
