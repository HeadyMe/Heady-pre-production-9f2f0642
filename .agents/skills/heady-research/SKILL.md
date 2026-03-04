---
name: heady-research
description: Deep web research with citations using HeadyResearch (Perplexity Sonar Pro) — use when the user needs sourced answers, literature review, or real-time web intelligence.
---

# Heady Research Skill

Use this skill whenever a task requires **web research, sourced answers, academic review, or real-time news intelligence**. HeadyResearch is powered by Perplexity Sonar Pro and returns rich answers with URL citations.

## Primary Tool

```
mcp_Heady_heady_perplexity_research
```

### Parameters

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `query` | string | **required** | The research question — be specific and detailed |
| `mode` | enum | `deep` | `quick` (fast answer), `deep` (thorough), `academic` (scholarly), `news` (current events) |
| `timeframe` | enum | `all` | `day`, `week`, `month`, `year`, `all` — filter recency |
| `maxSources` | int | 10 | Max citation URLs to return |

## When to Use Each Mode

| Mode | Best For | Example |
|------|----------|---------|
| `quick` | Simple factual lookups | "What is the latest Node.js LTS version?" |
| `deep` | Thorough investigation with multiple angles | "Compare WebSocket vs SSE for real-time AI streaming" |
| `academic` | Research papers, formal analysis | "Recent advances in liquid neural networks 2024-2025" |
| `news` | Breaking news, current events | "Latest AI regulation developments this week" |

## Chaining Patterns

### Research → Memory Persistence

After completing research, persist the findings to Heady's 3D vector memory so they're available in future sessions:

```
1. mcp_Heady_heady_perplexity_research(query, mode="deep")
2. mcp_Heady_heady_memory(query="store: {summary of findings}")
```

### Research → Analysis → Action

For research that feeds into code decisions:

```
1. mcp_Heady_heady_perplexity_research(query, mode="academic")
2. mcp_Heady_heady_analyze(content="{research results}", type="architecture")
3. Apply findings to implementation
```

### Multi-Angle Research

For complex topics, run multiple queries with different modes:

```
1. mcp_Heady_heady_perplexity_research(query="topic overview", mode="deep")
2. mcp_Heady_heady_perplexity_research(query="topic academic papers", mode="academic")
3. mcp_Heady_heady_perplexity_research(query="topic latest news", mode="news")
4. Synthesize all three into a comprehensive brief
```

## Tips

- **Be specific in queries** — "How does Cloudflare Workers AI handle streaming responses with the llama-3.1-8b model?" beats "Cloudflare AI"
- **Use timeframe filtering** for fast-moving fields — set `timeframe: "month"` for AI/ML topics
- **Always cite sources** — HeadyResearch returns URLs, include them in your response
- **Pair with `heady_memory`** to build a persistent knowledge base over time
