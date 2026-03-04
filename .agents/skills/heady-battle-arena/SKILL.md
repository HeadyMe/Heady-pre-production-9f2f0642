---
name: heady-battle-arena
description: Competitive AI evaluation using Heady™Battle Arena Mode — pit AI nodes against each other to find the best solution for any task.
---

# Heady Battle Arena Skill

Use this skill when you need to **validate code quality, compare AI-generated solutions, or find the best approach** through competitive evaluation. HeadyBattle pits multiple AI nodes against each other and ranks results.

## Primary Tool

```
mcp_Heady_heady_battle
```

### Parameters

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `action` | enum | **required** | `session`, `evaluate`, `arena`, `leaderboard`, `compare` |
| `task` | string | optional | Task description for arena mode |
| `code` | string | optional | Code to evaluate |
| `criteria` | string | optional | Evaluation criteria |
| `nodes` | array | optional | Specific AI nodes to compete (default: all 7) |
| `branches` | array | optional | Branch names to compare |

## Actions Reference

| Action | Purpose | When to Use |
|--------|---------|-------------|
| `arena` | Full multi-node competition | When you need the best possible solution from competing AI models |
| `evaluate` | Single-code quality assessment | When you want a quality score for existing code |
| `compare` | Side-by-side branch/solution comparison | When comparing two approaches |
| `session` | Start a new battle session | For multi-round evaluations |
| `leaderboard` | View overall ranking of AI nodes | To understand which models perform best for what |

## Usage Patterns

### Arena Mode — Best Solution Discovery

```
mcp_Heady_heady_battle(
  action="arena",
  task="Implement a rate limiter with sliding window algorithm in Node.js",
  criteria="performance, correctness, edge case handling"
)
```

All 7 AI nodes compete; the winner is the top-ranked solution.

### Code Quality Evaluation

```
mcp_Heady_heady_battle(
  action="evaluate",
  code="{your code}",
  criteria="production-readiness, security, error handling"
)
```

### Compare Two Approaches

```
mcp_Heady_heady_battle(
  action="compare",
  branches=["approach-a", "approach-b"],
  criteria="maintainability, performance"
)
```

## Chaining Patterns

### Generate → Battle → Ship

For critical code paths, generate then validate via arena before shipping:

```
1. mcp_Heady_heady_coder(prompt="implement feature X")
2. mcp_Heady_heady_battle(action="evaluate", code="{result}", criteria="production-readiness")
3. If score is high → ship. If not → iterate.
```

### Arena → Analyze → Implement

Get the best solution, analyze it deeply, then implement:

```
1. mcp_Heady_heady_battle(action="arena", task="solve problem Y")
2. mcp_Heady_heady_analyze(content="{winning solution}", type="architecture")
3. Implement the winning approach with architectural insights
```

## Tips

- **`arena` mode is powerful but heavy** — use it for critical decisions, not trivial code
- **Be specific with `criteria`** — "is this good?" is weak; "security, O(n) complexity, error recovery" is strong
- **Default 7 nodes compete** — you can narrow with `nodes` parameter for faster results
- **Use `leaderboard`** periodically to understand which models excel at which domains
