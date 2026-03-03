---
description: Antigravity runtime enforcement — ensures 3D vector workspace, Sacred Geometry SDK, and config integrity
---

# 🌐 Antigravity Runtime Workflow

// turbo-all

> **Always-active enforcement.** This workflow validates Antigravity runtime config integrity, 3D vector workspace mode, and Sacred Geometry SDK availability before any agent operation.

---

## Step 0 · Verify Antigravity Config Files Exist

Confirm all required config and service files are present:

```bash
for f in \
  configs/services/antigravity-heady-runtime-policy.json \
  configs/services/antigravity-heady-runtime-state.json \
  src/services/antigravity-heady-runtime.js \
  scripts/autonomous/antigravity-heady-sync.js \
  packages/heady-sacred-geometry-sdk/index.js \
  packages/heady-sacred-geometry-sdk/lib/principles.js \
  packages/heady-sacred-geometry-sdk/lib/spatial-embedder.js \
  packages/heady-sacred-geometry-sdk/lib/octree-manager.js \
  packages/heady-sacred-geometry-sdk/lib/template-engine.js \
  packages/heady-sacred-geometry-sdk/lib/capacity-planner.js; do
  if [ -f "$f" ]; then echo "✅ $f"; else echo "❌ MISSING: $f"; fi
done
```

---

## Step 1 · Validate Antigravity Runtime Policy

Ensure the policy enforces 3D vector workspace mode and has all required fields:

```bash
node -e "
const policy = require('./configs/services/antigravity-heady-runtime-policy.json');
const checks = [
  ['version', policy.version >= 1],
  ['gateway=heady', policy.enforce?.gateway === 'heady'],
  ['workspaceMode=3d-vector', policy.enforce?.workspaceMode === '3d-vector'],
  ['autonomousMode', !!policy.enforce?.autonomousMode],
  ['ownerAliases', (policy.ownerAliases || []).length >= 1],
  ['defaultSwarmTasks', (policy.defaultSwarmTasks || []).length >= 3],
  ['healthEndpoint', !!policy.healthEndpoint],
];
let pass = 0;
for (const [name, ok] of checks) {
  console.log(ok ? '✅' : '❌', name);
  if (ok) pass++;
}
console.log('Policy: ' + pass + '/' + checks.length + ' checks passed');
if (pass < checks.length) process.exit(1);
"
```

---

## Step 2 · Verify Sacred Geometry SDK Loads

Confirm all SDK modules load and produce correct mathematical constants:

```bash
node -e "
const sg = require('./packages/heady-sacred-geometry-sdk');
const checks = [
  ['PHI', Math.abs(sg.PHI - 1.618033988749895) < 1e-10],
  ['PHI_INV', Math.abs(sg.PHI_INV - 0.618033988749895) < 1e-10],
  ['BASE=13', sg.BASE === 13],
  ['FIB[6]=13', sg.FIB[6] === 13],
  ['SpatialEmbedder', typeof sg.SpatialEmbedder === 'function'],
  ['OctreeManager', typeof sg.OctreeManager === 'function'],
  ['TemplateEngine', typeof sg.TemplateEngine === 'function'],
  ['CapacityPlanner', typeof sg.CapacityPlanner === 'function'],
  ['phiScale', typeof sg.phiScale === 'function'],
  ['goldenSplit', typeof sg.goldenSplit === 'function'],
  ['designTokens', JSON.stringify(sg.designTokens(8)) === JSON.stringify({xxs:3,xs:5,sm:8,md:13,lg:21,xl:34,xxl:55})],
];
let pass = 0;
for (const [name, ok] of checks) {
  console.log(ok ? '✅' : '❌', name);
  if (ok) pass++;
}
console.log('SDK: ' + pass + '/' + checks.length + ' checks passed');
if (pass < checks.length) process.exit(1);
"
```

---

## Step 3 · Refresh Antigravity Runtime State

Run the sync script to regenerate the runtime state from current config:

```bash
node scripts/autonomous/antigravity-heady-sync.js
```

---

## Step 4 · Validate Runtime State Output

Confirm the generated state file is consistent with the policy:

```bash
node -e "
const state = require('./configs/services/antigravity-heady-runtime-state.json');
const checks = [
  ['workspaceMode=3d-vector', state.workspaceMode === '3d-vector'],
  ['gateway=heady', state.enforcedGateway === 'heady'],
  ['autonomousMode', !!state.autonomousMode],
  ['health.status=healthy', state.health?.status === 'healthy'],
  ['topTemplates', (state.topTemplates || []).length >= 1],
  ['samplePlan.enforced', state.samplePlan?.enforced === true],
  ['vectorWorkspace.enabled', state.samplePlan?.vectorWorkspace?.enabled === true],
  ['vectorWorkspace.dimensions=3', state.samplePlan?.vectorWorkspace?.dimensions === 3],
  ['optimizationReportHash', typeof state.optimizationReportHash === 'string' && state.optimizationReportHash.length === 64],
];
let pass = 0;
for (const [name, ok] of checks) {
  console.log(ok ? '✅' : '❌', name);
  if (ok) pass++;
}
console.log('State: ' + pass + '/' + checks.length + ' checks passed');
if (pass < checks.length) process.exit(1);
"
```

---

## Step 5 · Verify Boot Integration

Confirm the antigravity runtime is wired into heady-manager.js boot sequence:

```bash
node -e "
const fs = require('fs');
const mgr = fs.readFileSync('heady-manager.js', 'utf8');
const checks = [
  ['requires antigravity-heady-runtime', mgr.includes('antigravity-heady-runtime')],
  ['/api/antigravity/health endpoint', mgr.includes('/api/antigravity/health')],
  ['/api/antigravity/enforce endpoint', mgr.includes('/api/antigravity/enforce')],
  ['/api/antigravity/policy endpoint', mgr.includes('/api/antigravity/policy')],
  ['antigravity:enforced event', mgr.includes('antigravity:enforced')],
];
let pass = 0;
for (const [name, ok] of checks) {
  console.log(ok ? '✅' : '❌', name);
  if (ok) pass++;
}
console.log('Boot: ' + pass + '/' + checks.length + ' checks passed');
"
```

---

## When to Run This Workflow

- **Before every commit** — validate config integrity
- **After modifying** any file in `configs/services/antigravity-*` or `src/services/antigravity-*`
- **After SDK changes** — confirm `packages/heady-sacred-geometry-sdk/` still loads
- **During `/health-check`** — include antigravity health in system status
- **During `/foundational-pillars`** — Pillar 4 (3D Vector Memory) depends on antigravity enforcement

---

## Config File Reference

| File | Purpose | Used By |
|------|---------|---------|
| `configs/services/antigravity-heady-runtime-policy.json` | Enforcement rules (gateway, mode, aliases) | `antigravity-heady-runtime.js`, `heady-manager.js` boot |
| `configs/services/antigravity-heady-runtime-state.json` | Generated state snapshot | `antigravity-heady-sync.js` output |
| `packages/heady-sacred-geometry-sdk/` | Distributable SDK (φ, octree, spatial) | All Sacred Geometry operations |
| `src/services/antigravity-heady-runtime.js` | Runtime enforcement service | `heady-manager.js` boot, API endpoints |
| `scripts/autonomous/antigravity-heady-sync.js` | State regeneration script | CI, pre-commit, manual refresh |
