---
name: heady-memory-ops
description: Persistent 3D vector memory operations — search, store, embed, and learn via HeadyMemory, HeadyEmbed, HeadySoul, and HeadyVinci.
---

# Heady Memory Operations Skill

Use this skill whenever a task requires **persisting knowledge, retrieving past context, generating embeddings, or leveraging Heady's continuous learning layer**. Memory is the backbone of the Heady ecosystem — it's how the system remembers facts, workflows, and preferences across sessions.

## Tools Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mcp_Heady_heady_memory` | Search persistent 3D vector memory for stored facts and context | Before starting any work — check if relevant knowledge exists |
| `mcp_Heady_heady_embed` | Generate vector embeddings for text | When you need semantic similarity or preparing text for vector storage |
| `mcp_Heady_heady_soul` | Intelligence and learning layer — analyze, optimize, learn | After completing significant work to improve future performance |
| `mcp_Heady_heady_vinci` | Pattern recognition and prediction | When you need to predict outcomes or recognize trends |

## Tool Details

### HeadyMemory — `mcp_Heady_heady_memory`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `query` | string | **required** | What to search for in memory |
| `limit` | int | 5 | Max results to return |
| `minScore` | float | 0.6 | Minimum semantic relevance score (0-1) |

**Critical**: Always search memory **before** starting research or analysis. The answer may already exist.

### HeadyEmbed — `mcp_Heady_heady_embed`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `text` | string | **required** | Text to generate embeddings for |
| `model` | string | `nomic-embed-text` | Embedding model |

### HeadySoul — `mcp_Heady_heady_soul`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `content` | string | **required** | Content to analyze or optimize |
| `action` | enum | `analyze` | `analyze`, `optimize`, `learn` |

**Use `learn`** after completing tasks to feed the learning layer with new patterns.

### HeadyVinci — `mcp_Heady_heady_vinci`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `data` | string | **required** | Data for learning/prediction |
| `action` | enum | `predict` | `learn`, `predict`, `recognize` |
| `context` | string | optional | Additional context |

## Standard Workflow

### Pre-Task Memory Check

Before every significant task:

```
1. mcp_Heady_heady_memory(query="relevant topic keywords", limit=5, minScore=0.6)
2. Review results — if relevant knowledge exists, build on it
3. If nothing found, proceed with fresh work
```

### Post-Task Memory Persistence

After completing significant work:

```
1. Summarize what was accomplished
2. mcp_Heady_heady_soul(content="{summary}", action="learn")
```

### Semantic Search Pattern

When you need to find related concepts rather than exact matches:

```
1. mcp_Heady_heady_embed(text="query text")
2. mcp_Heady_heady_memory(query="query text", minScore=0.5)  # Lower threshold for broader results
```

### Pattern Recognition

When analyzing trends or making predictions:

```
1. mcp_Heady_heady_memory(query="historical data on topic")
2. mcp_Heady_heady_vinci(data="{memory results}", action="recognize")
3. mcp_Heady_heady_vinci(data="{patterns}", action="predict", context="current situation")
```

## Tips

- **Memory is 3D vector space** — queries are semantic, not keyword-based. "How does auth work" will find results about "authentication flow" and "login system"
- **Lower `minScore` for exploration** — 0.4-0.5 gives broader results, useful when you're not sure what exists
- **Use `heady_soul` with `learn` action** after every major accomplishment — this is how the system evolves
- **`heady_vinci` needs data** — feed it structured data for meaningful predictions, not vague prompts
