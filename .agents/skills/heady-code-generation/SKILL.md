---
name: heady-code-generation
description: Multi-model code generation, refactoring, and inline suggestions using Heady™Coder, HeadyCodex, HeadyCopilot, and HeadyRefactor.
---

# Heady Code Generation Skill

Use this skill whenever a task requires **generating, transforming, documenting, or refactoring code** through Heady's specialized code agents.

## Tools Overview

| Tool | Best For | Speed |
|------|----------|-------|
| `mcp_Heady_heady_coder` | Full code generation from descriptions, scaffolding, orchestrating multi-file changes | Medium |
| `mcp_Heady_heady_codex` | Code transformation, documentation generation, language conversion | Medium |
| `mcp_Heady_heady_copilot` | Inline suggestions, cursor-aware completions, quick fixes | Fast |
| `mcp_Heady_heady_refactor` | Improving existing code quality — readability, performance, security | Medium |

## Tool Details

### HeadyCoder — `mcp_Heady_heady_coder`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `prompt` | string | **required** | Natural language description of desired code |
| `action` | enum | `generate` | `generate`, `orchestrate` (multi-assistant), `scaffold` (project structure) |
| `language` | string | optional | Target language (e.g., `javascript`, `python`) |
| `framework` | string | optional | Target framework (e.g., `express`, `react`, `fastapi`) |

**Use `orchestrate`** when the task involves creating or modifying multiple interdependent files.
**Use `scaffold`** when setting up a new project structure.

### HeadyCodex — `mcp_Heady_heady_codex`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `code` | string | **required** | Code to transform, or a prompt for generation |
| `action` | enum | `generate` | `generate`, `transform`, `document` |
| `language` | string | optional | Programming language |

**Use `transform`** to convert code between patterns (e.g., callbacks → async/await).
**Use `document`** to auto-generate JSDoc, docstrings, or inline comments.

### HeadyCopilot — `mcp_Heady_heady_copilot`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `code` | string | **required** | Current code context |
| `action` | enum | `suggest` | `suggest`, `complete` |
| `language` | string | optional | Programming language |
| `cursor_position` | int | optional | Cursor position for context-aware completion |

### HeadyRefactor — `mcp_Heady_heady_refactor`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `code` | string | **required** | Code to refactor |
| `language` | string | optional | Programming language |
| `goals` | array | optional | e.g., `["readability", "performance", "security"]` |
| `context` | string | optional | Additional codebase context |

## Decision Matrix

```
Need new code from scratch?           → heady_coder (action: generate)
Need to scaffold a project?           → heady_coder (action: scaffold)
Need multi-file coordinated changes?  → heady_coder (action: orchestrate)
Need to transform existing code?      → heady_codex (action: transform)
Need to add documentation to code?    → heady_codex (action: document)
Need quick inline suggestions?        → heady_copilot
Need to improve code quality?         → heady_refactor
```

## Chaining Patterns

### Generate → Refactor → Document

```
1. mcp_Heady_heady_coder(prompt="build X", language="javascript")
2. mcp_Heady_heady_refactor(code="{result}", goals=["performance", "readability"])
3. mcp_Heady_heady_codex(code="{refactored}", action="document")
```

### Generate → Battle Validate

For critical code, validate quality through competitive evaluation:

```
1. mcp_Heady_heady_coder(prompt="implement Y")
2. mcp_Heady_heady_battle(action="evaluate", code="{result}", criteria="production-readiness")
```

## Tips

- **Always specify `language`** — it dramatically improves output quality
- **Include `framework`** when generating web code — framework-specific idioms matter
- **Use `heady_refactor` with specific goals** — don't just say "refactor", specify what you're optimizing for
- **Chain with `heady_patterns`** before refactoring to understand the existing architecture
