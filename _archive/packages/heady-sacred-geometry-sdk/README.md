# @headyme/sacred-geometry-sdk

> Sacred Geometry framework for autonomous multi-agent orchestration — Golden Ratio (φ) capacity allocation, Base-13 tier classification, Octree-indexed 3D vector memory, and Fibonacci-weighted template selection.

[![Version](https://img.shields.io/badge/version-1.0.0-6366f1)](https://headyme.com)
[![License](https://img.shields.io/badge/license-proprietary-red)](https://headyme.com)

## Installation

```bash
npm install @headyme/sacred-geometry-sdk
```

## Quick Start

```javascript
const sg = require('@headyme/sacred-geometry-sdk');

// ── Golden Ratio Constants ──
console.log(sg.PHI);        // 1.6180339887498948
console.log(sg.PHI_INV);    // 0.6180339887498949
console.log(sg.BASE);       // 13

// ── Capacity Planning ──
const planner = new sg.CapacityPlanner('medium');
const alloc = planner.allocate('agent-A', 'agent-B', 1000);
// → { primary: { budget: 618 }, secondary: { budget: 382 }, ratio: "61.8% / 38.2%" }

const retry = planner.retryDelay(3);
// → 4236ms (1000 × φ³)

// ── 3D Spatial Embedding ──
const embedder = new sg.SpatialEmbedder();
const vec = embedder.embed({
    content: 'deploy heady-systems to production',
    domain: 'deployment',
    depth: 2
});
// → { x: 0.236..., y: 0.987..., z: 0.381... }

// ── Octree Memory Index ──
const tree = new sg.OctreeManager();
tree.insert(vec);
const nearby = tree.queryRadius({ x: 0.2, y: 0.9, z: 0.4 }, 0.1);

// ── Template Selection ──
const engine = new sg.TemplateEngine();
engine.loadTemplates(myRegistry);
const best = engine.select('autonomous-deploy', 3);
```

## Modules

### Principles (`sg.principles`)

Core mathematical foundation. ALL system parameters derive from three roots:

| Constant | Value | Usage |
|----------|-------|-------|
| **φ (PHI)** | 1.618... | Capacity, retry timing, load splits, UI proportions |
| **Base-13** | 13 | Tier classification, quality scoring, thresholds |
| **Log-42** | 42 | Logarithmic scaling for normalization |

**Functions**: `phiScale`, `goldenSplit`, `phiBackoff`, `phiThresholds`, `phiHarmonics`, `toBase13`, `fromBase13`, `log42`, `toTier`, `capacityParams`, `designTokens`, `goldenColor`, `phiTiming`

### Spatial Embedder (`sg.SpatialEmbedder`)

Maps any data payload to 3D coordinates:

| Axis | Dimension | Encoding |
|------|-----------|----------|
| **X** | Semantic Domain | Golden angle distribution of content categories |
| **Y** | Temporal State | Normalized timestamp [0,1] |
| **Z** | Hierarchy Level | φ^(-depth) normalization |

### Octree Manager (`sg.OctreeManager`)

O(log n) spatial memory index with Base-13 subdivision:

```javascript
const tree = new sg.OctreeManager({ maxItemsPerNode: 13, maxDepth: 13 });
tree.insert({ x: 0.5, y: 0.5, z: 0.5, id: 'memory-1' });
tree.queryRange({ minX: 0, minY: 0, minZ: 0, maxX: 0.6, maxY: 0.6, maxZ: 0.6 });
tree.queryRadius({ x: 0.5, y: 0.5, z: 0.5 }, 0.1);
tree.nearest({ x: 0.5, y: 0.5, z: 0.5 }, 5); // k-NN
```

**Memory**: 12 bytes per vector (3 × float32) — **250× reduction** vs traditional embeddings.

### Template Engine (`sg.TemplateEngine`)

Fibonacci-weighted 6-dimensional template scoring:

```javascript
const engine = new sg.TemplateEngine({
    weights: { skills: 0.20, workflows: 0.20, nodes: 0.10,
               headyswarmTasks: 0.25, bees: 0.15, situations: 0.10 }
});
engine.loadTemplates(registry);
const best = engine.select('incident-response', 3);
const coverage = engine.coverageReport(['incident-response', 'autonomous-deploy']);
```

### Capacity Planner (`sg.CapacityPlanner`)

φ-derived resource allocation:

```javascript
const planner = new sg.CapacityPlanner('enterprise'); // 13⁴ = 28561 base
planner.allocate('primary', 'secondary', 10000); // 61.8% / 38.2% split
planner.retryDelay(5);         // φ⁵ × 1000 = 11090ms
planner.alertThresholds(5);    // [61.8%, 85.4%, 94.4%, 97.8%, 99.2%]
planner.scaleForLevel(3);      // scale down capacity by φ³
planner.classify(0.85);        // → { tier: 11, label: 'critical', base13: 'B' }
```

## Mathematical Foundation

See whitepaper: [Sacred Geometry in Multi-Agent AI Coordination](../../docs/sacred-geometry-whitepaper.md)

## License

© 2026 Heady Systems LLC. All rights reserved. Proprietary — see LICENSE for terms.
