---
description: Code projection — embed instructions/specs into vector memory, system projects ALL optimal files outward
---

# Code Projection Workflow

// turbo-all

> **RAM-first file generation.** You don't write files directly. You embed INSTRUCTIONS and SPECIFICATIONS into 3D vector memory, then the system PROJECTS all optimal files outward — code, configs, workflows, tests, docs, schemas, everything.

## Core Principle

```
┌─────────────────────────────────────────────────────┐
│               3D VECTOR MEMORY                      │
│                                                     │
│  Instructions ──→ Specifications ──→ Patterns       │
│        │                │               │           │
│        ▼                ▼               ▼           │
│   Patent Specs    API Contracts    Bee Shapes        │
│   Service Reqs    Data Schemas     UI Rules          │
│   Domain Logic    Event Maps       Test Specs        │
│   Config Rules    Workflow Defs    Doc Templates     │
└──────────────────────┬──────────────────────────────┘
                       │ PROJECTION (all file types)
                       ▼
       ┌───────────────────────────────────┐
       │  src/       → .js modules         │
       │  configs/   → .yaml, .json        │
       │  .agents/   → workflows, skills   │
       │  tests/     → test suites         │
       │  docs/      → markdown, specs     │
       │  packages/  → SDK, libraries      │
       │  scripts/   → automation tools    │
       │  data/      → vector shards       │
       └───────────────────────────────────┘
```

## How to Use This Workflow

### Step 1 · Embed Instructions (NOT code)

When a new system capability is needed, embed the SPECIFICATION into vector memory — not the implementation.

```javascript
// Example: embedding a patent concept specification
await vm.smartIngest({
  content: `
    Patent: HeadyPhi — Golden Ratio Orchestration (PPA-34)
    Domain: sacred-geometry
    Requirements:
      - All timing intervals derived from φ (1.618...)
      - Fibonacci sequence for batch sizes and retry counts
      - Sacred Geometry SDK provides phiScale(), goldenSplit(), designTokens()
      - Must wire into heady-manager boot as a bee
    API Contract:
      - GET /api/phi/constants → phi values
      - POST /api/phi/scale → scale a value by phi^n
    Bee Pattern:
      - domain: 'sacred-geometry'
      - 3 workers: constants, scaling, validation
    Test Requirements:
      - Verify PHI = 1.618033988749895
      - Verify phiScale(8, 3) = 8 * φ³
  `,
  metadata: {
    type: 'procedural',
    domain: 'sacred-geometry',
    category: 'specification',
    projectionTarget: 'src/',
    patent: 'PPA-34',
  }
}, 0.92);
```

### Step 2 · Query Vector Memory for Specifications

Before generating ANY code, query vector memory to gather all relevant specs:

```javascript
// Gather all specifications for a domain
const specs = await vm.queryMemory({
  query: 'specification for sacred-geometry domain',
  topK: 10,
  metadata: { category: 'specification' },
});
```

### Step 3 · Project Optimal Files

Use the specifications to generate the optimal implementation. The projected files are DERIVED STATE — they can be regenerated from vector memory at any time.

```bash
# The continuous-embedder's projection cycle handles this automatically.
# Manual projection can be triggered via:
curl -X POST localhost:3006/api/embedder/project
```

### Step 4 · Emit Projection Event

After projecting, emit an event so the system tracks what was generated:

```javascript
global.eventBus.emit('code:projected', {
  source: 'vector-memory',
  target: 'src/sacred-geometry-bee.js',
  fromSpecs: specs.map(s => s.id),
  projectedAt: new Date().toISOString(),
});
```

## Antigravity Directive

> [!IMPORTANT]
> **For Antigravity agents**: When asked to implement a new system capability:
>
> 1. **FIRST** embed the specification/instructions into vector memory
> 2. **THEN** query existing specs + patterns in vector memory
> 3. **THEN** project the optimal implementation to file system
> 4. **NEVER** write code without checking what's already in vector memory
> 5. **ALWAYS** emit `code:projected` events after writing files
>
> Files are projections. Vector memory is truth. If a .js file is lost, it can be re-projected from specifications in vector memory.

## Patent Concept Projection

All 50 patent concepts should exist in vector memory as specifications. When the system needs a patent-backing module:

1. Query `metadata.category: 'specification'` + `metadata.patent: 'PPA-{n}'`
2. Retrieve the spec (requirements, API contract, bee pattern, test specs)
3. Project the optimal .js file to `src/`
4. The patent-bee monitors coverage and flags gaps

## When to Re-Project

- After vector memory consolidation changes specifications
- When a patent concept's spec is updated
- When `code:changed` events indicate drift from spec
- Manual: `POST /api/embedder/project`
