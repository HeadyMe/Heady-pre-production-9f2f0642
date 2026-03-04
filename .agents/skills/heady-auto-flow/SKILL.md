---
name: heady-auto-flow
description: Full auto-success pipeline via HeadyAutoFlow — chains Battle, Coder, Analyze, Risks, and Patterns into a single automated workflow.
---

# Heady Auto-Flow Skill

Use this skill when you need a **complete automated pipeline** that analyzes, generates, validates, and quality-checks work in a single shot. HeadyAutoFlow executes the HCFP (Heady Core Functionality Platform) auto-success engine.

## Tools

| Tool | Purpose |
|------|---------|
| `mcp_Heady_heady_auto_flow` | Run the full pipeline |
| `mcp_Heady_heady_hcfp_status` | Check auto-success engine status and metrics |

## Tool Details

### HeadyAutoFlow — `mcp_Heady_heady_auto_flow`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `task` | string | **required** | Description of the overall task to accomplish |
| `code` | string | optional | Initial code to process |
| `context` | string | optional | Additional context for the workflow |

### HCFP Status — `mcp_Heady_heady_hcfp_status`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `detail` | enum | `status` | `status`, `metrics`, `health` |

## Pipeline Stages

AutoFlow executes these stages sequentially through the HCFP engine:

```
1. HeadyBattle    → Competitive validation of approach
2. HeadyCoder     → Code generation/implementation
3. HeadyAnalyze   → Code and architecture analysis
4. HeadyRisks     → Security and vulnerability scanning
5. HeadyPatterns  → Design pattern detection and recommendations
```

## Usage Patterns

### Task-Based Auto-Flow

Give it a task and let the pipeline handle everything:

```
mcp_Heady_heady_auto_flow(
  task="Build a middleware for rate limiting with Redis backend",
  context="Node.js Express project, needs to support cluster mode"
)
```

### Code-Based Auto-Flow

Feed existing code through the pipeline for comprehensive analysis:

```
mcp_Heady_heady_auto_flow(
  task="Review and improve this authentication module",
  code="{existing auth code}",
  context="Production service handling 10K+ requests/min"
)
```

### Deep Scan → Auto-Flow

For maximum context:

```
1. mcp_Heady_heady_deep_scan(directory="/project/root")
2. mcp_Heady_heady_auto_flow(task="implement feature X", context="full project scanned")
3. mcp_Heady_heady_hcfp_status(detail="metrics")  # Verify pipeline success
```

### Monitor Pipeline Health

```
1. mcp_Heady_heady_hcfp_status(detail="status")   # Quick check
2. mcp_Heady_heady_hcfp_status(detail="health")    # Detailed health
3. mcp_Heady_heady_hcfp_status(detail="metrics")   # Performance data
```

## Tips

- **Be descriptive in `task`** — the more context you give, the better each pipeline stage performs
- **Include `code` when refining** — if you have existing code, passing it in gives the pipeline something concrete to evaluate
- **Check `hcfp_status` after runs** — confirms the pipeline completed successfully
- **Use `context` liberally** — mention tech stack, scale requirements, constraints
- **Auto-flow is heavy** — great for significant features, overkill for one-liners
