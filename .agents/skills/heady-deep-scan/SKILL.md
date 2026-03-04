---
name: heady-deep-scan
description: Project-wide context mapping via Heady™DeepScan — maps an entire workspace into 3D vector memory for deep understanding before any major work.
---

# Heady Deep Scan Skill

Use this skill **before starting any major work on a project** to give the Heady ecosystem full awareness of the codebase. HeadyDeepScan performs a massive single-pass project map and pulls persistent 3D vector memory to establish global context.

## Primary Tool

```
mcp_Heady_heady_deep_scan
```

### Parameters

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `directory` | string | optional | Target workspace directory to map |

## When to Use Deep Scan

| Scenario | Priority |
|----------|----------|
| Starting work on a new or unfamiliar project | **Must scan** |
| Beginning a complex multi-file refactor | **Must scan** |
| Debugging a hard-to-trace issue | **Should scan** |
| Setting up context for a `heady_auto_flow` pipeline | **Should scan** |
| Quick single-file change | Skip — overkill |

## Usage Pattern

### Full Context Establishment

```
1. mcp_Heady_heady_deep_scan(directory="/path/to/project")
2. mcp_Heady_heady_memory(query="project architecture overview")  # Verify context loaded
3. Proceed with implementation work
```

### Deep Scan → Analysis Pipeline

For thorough project understanding:

```
1. mcp_Heady_heady_deep_scan(directory="/path/to/project")
2. mcp_Heady_heady_analyze(content="overall architecture", type="architecture")
3. mcp_Heady_heady_risks(content="project security posture", action="scan", scope="all")
```

### Deep Scan → Auto-Flow

Combine deep context with automated pipeline:

```
1. mcp_Heady_heady_deep_scan(directory="/path/to/project")
2. mcp_Heady_heady_auto_flow(task="implement feature X", context="deep-scanned project")
```

## What Deep Scan Does

1. **Maps all files** in the target directory recursively
2. **Extracts structure** — functions, classes, modules, dependencies
3. **Generates embeddings** for each component
4. **Stores in 3D vector memory** — available via `heady_memory` queries afterwards
5. **Builds relationship graph** — understands how components connect

## Tips

- **Scan once per session** — the results persist in vector memory, no need to re-scan unless files changed significantly
- **Specify the project root** — not a subdirectory, so the full context is captured
- **Follow up with `heady_memory`** queries — this confirms the scan loaded properly and lets you explore what was captured
- **Deep scan is the foundation** for `heady_auto_flow` — scan first, then auto-flow
