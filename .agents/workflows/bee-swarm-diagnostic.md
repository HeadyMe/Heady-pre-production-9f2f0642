---
description: Bee swarm diagnostic — blast all bees and report health across all domains
---

# 🐝 Bee Swarm Diagnostic Workflow

> Run to verify the entire bee swarm is healthy and blastable.

## Steps

1. **Discover all bees**

   ```js
   const registry = require('./src/bees/registry');
   const count = registry.discover();
   console.log(`Discovered ${count} bees`);
   ```

2. **Blast all domains** — Run `getAllWork()` and execute every work function

   ```js
   const allWork = registry.getAllWork({});
   for (const task of allWork) {
     console.log(`Blasting ${task.name}: ${task.work.length} work units`);
     const results = await Promise.allSettled(task.work.map(fn => fn()));
     const pass = results.filter(r => r.status === 'fulfilled').length;
     console.log(`  → ${pass}/${results.length} passed`);
   }
   ```

3. **Check for missing domains** — Compare discovered domains against expected list:
   `agents, auto-success, brain, config, connectors, creative, deployment, documentation, engines, governance, health, intelligence, lifecycle, mcp, memory, middleware, midi, ops, orchestration, pipeline, providers, resilience, routes, security, services, telemetry, templates, trading, vector-templates`

4. **Report** — Generate swarm health table with pass/fail per domain
