---
name: heady-perplexity
description: Full-spectrum Perplexity Enterprise Max integration — sonar search, deep research, reasoning, embeddings, and custom connector setup for the Heady™ ecosystem.
---

# Heady™ Perplexity Enterprise Max Skill

> **Plan**: Enterprise Max (unlimited Labs, research, and advanced queries)
> **API Base**: `https://api.perplexity.ai`
> **Auth**: Bearer token via `PERPLEXITY_API_KEY`

---

## 1. Available Models

### Search Models

| Model ID | Description | Best For |
|----------|-------------|----------|
| `sonar` | Lightweight, cost-effective search with grounding | Quick factual lookups, simple queries |
| `sonar-pro` | Advanced search with grounding, complex queries & follow-ups | Multi-step research, synthesis |

### Reasoning Models

| Model ID | Description | Best For |
|----------|-------------|----------|
| `sonar-reasoning-pro` | Chain of Thought (CoT) reasoning with web search | Mathematical proofs, logical analysis, code reasoning |

### Research Models

| Model ID | Description | Best For |
|----------|-------------|----------|
| `sonar-deep-research` | Expert-level exhaustive search + comprehensive reports | Patent research, competitive analysis, academic reviews |

### Embedding Models

| Model ID | Params | Description |
|----------|--------|-------------|
| `pplx-embed-v1` | 0.6B / 4B | Dense retrieval embeddings |
| `pplx-embed-context-v1` | 0.6B / 4B | Contextualized embeddings (RAG-optimized) |

---

## 2. MCP Integration (Already Configured)

The `perplexity-ask` MCP server is pre-configured in the IDE. Use the tool directly:

```
mcp_perplexity-ask_perplexity_ask
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | array | ✅ | Array of `{role, content}` message objects |

### Example Call

```json
{
  "messages": [
    {"role": "system", "content": "Be precise and cite sources."},
    {"role": "user", "content": "What are the latest Cloudflare Workers AI models?"}
  ]
}
```

---

## 3. Direct API Reference

### Chat Completions (Sonar API)

```
POST https://api.perplexity.ai/chat/completions
Authorization: Bearer <PERPLEXITY_API_KEY>
Content-Type: application/json
```

#### Request Body

```json
{
  "model": "sonar-pro",
  "messages": [
    {"role": "system", "content": "Be precise and cite sources."},
    {"role": "user", "content": "Your query here"}
  ],
  "max_tokens": 4096,
  "temperature": 0.2,
  "top_p": 0.9,
  "stream": false,
  "search_domain_filter": ["arxiv.org", "github.com"],
  "search_recency_filter": "month",
  "return_related_questions": true,
  "return_images": false,
  "return_citations": true
}
```

#### Key Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `model` | `sonar`, `sonar-pro`, `sonar-reasoning-pro`, `sonar-deep-research` | Model selection |
| `search_domain_filter` | `["domain1.com", "domain2.com"]` | Restrict search to specific domains (max 3) |
| `search_recency_filter` | `"hour"`, `"day"`, `"week"`, `"month"` | Filter results by recency |
| `return_related_questions` | `true/false` | Get follow-up question suggestions |
| `return_images` | `true/false` | Include images in response |
| `return_citations` | `true/false` | Include source URLs |
| `stream` | `true/false` | Enable SSE streaming |
| `temperature` | `0.0–2.0` | Lower = precise, higher = creative |

#### Response Format

```json
{
  "id": "chatcmpl-...",
  "model": "sonar-pro",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Answer with inline citations [1][2]..."
    },
    "finish_reason": "stop"
  }],
  "citations": [
    "https://source1.com/article",
    "https://source2.com/paper"
  ],
  "related_questions": [
    "What are the limitations of...",
    "How does X compare to Y?"
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 200,
    "total_tokens": 250
  }
}
```

### Search API

```
POST https://api.perplexity.ai/search
Authorization: Bearer <PERPLEXITY_API_KEY>
Content-Type: application/json
```

```json
{
  "query": "Cloudflare Workers AI edge inference",
  "search_recency_filter": "week",
  "search_domain_filter": ["developers.cloudflare.com"],
  "return_images": false
}
```

### Embeddings API

```
POST https://api.perplexity.ai/embeddings
Authorization: Bearer <PERPLEXITY_API_KEY>
Content-Type: application/json
```

```json
{
  "model": "pplx-embed-v1",
  "input": ["Text to embed", "Another text"]
}
```

---

## 4. Custom Connector Configuration

### Option A: MCP Server (Currently Active)

Already in `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "perplexity-ask": {
    "command": "npx",
    "args": ["-y", "server-perplexity-ask"],
    "env": {
      "PERPLEXITY_API_KEY": "<your-enterprise-max-key>"
    }
  }
}
```

### Option B: Custom REST Connector (Full API Access)

For direct REST API integration in any workflow (Node.js, Python, curl):

#### Node.js

```javascript
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

async function perplexitySearch(query, options = {}) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'sonar-pro',
      messages: [
        { role: 'system', content: options.system || 'Be precise and cite all sources.' },
        { role: 'user', content: query },
      ],
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.2,
      search_recency_filter: options.recency || undefined,
      search_domain_filter: options.domains || undefined,
      return_citations: true,
      return_related_questions: true,
    }),
  });
  return response.json();
}

// Usage
const result = await perplexitySearch(
  'Latest provisional patent filing requirements USPTO 2026',
  { model: 'sonar-deep-research', recency: 'month' }
);
```

#### Python

```python
import requests

API_KEY = "pplx-..."
BASE_URL = "https://api.perplexity.ai"

def perplexity_search(query, model="sonar-pro", recency=None, domains=None):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Be precise and cite sources."},
            {"role": "user", "content": query}
        ],
        "return_citations": True,
        "return_related_questions": True,
    }
    if recency: payload["search_recency_filter"] = recency
    if domains: payload["search_domain_filter"] = domains
    
    response = requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=payload)
    return response.json()

# Deep Research
result = perplexity_search(
    "Comprehensive analysis of MCP protocol implementations 2025-2026",
    model="sonar-deep-research",
    recency="month"
)
```

#### cURL

```bash
curl -X POST https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonar-deep-research",
    "messages": [
      {"role": "system", "content": "Be thorough and cite all sources."},
      {"role": "user", "content": "Your research query"}
    ],
    "return_citations": true,
    "search_recency_filter": "month"
  }'
```

---

## 5. Enterprise Max Features

| Feature | Details |
|---------|---------|
| **Unlimited Research** | No cap on deep research queries |
| **Model Council** | Multi-model synthesis (cross-check answers) |
| **Comet Browser Agent** | Autonomous web interaction (10,000 credits/month) |
| **Structured Outputs** | Dashboards, spreadsheets, apps from research |
| **SOC 2 Type II** | Enterprise security compliance |
| **Data Privacy** | No training on your data |
| **Custom Spaces** | Curated research collections |
| **File Uploads** | Up to 10,000 files per user repo |
| **Priority Support** | Dedicated enterprise support channel |

---

## 6. Model Selection Guide

| Scenario | Model | Why |
|----------|-------|-----|
| Quick fact check | `sonar` | Fast, cheap, grounded |
| Multi-step research | `sonar-pro` | Handles follow-ups, complex queries |
| Code reasoning / math | `sonar-reasoning-pro` | Chain of Thought for precision |
| Patent research / analysis | `sonar-deep-research` | Exhaustive search, report-grade |
| Embedding for RAG | `pplx-embed-context-v1` | Optimized for retrieval |
| Simple semantic search | `pplx-embed-v1` | Dense vector, fast |

---

## 7. Rate Limits (Enterprise Max)

| Tier | Requests/min | Tokens/min |
|------|-------------|------------|
| Enterprise Max | 500+ | Unlimited |
| Deep Research | Unlimited/day | N/A |
| Embeddings | 1000+ | N/A |

---

## 8. Integration with Heady™ Ecosystem

### Research → Vector Memory Pipeline

```
1. perplexity_search(query, model="sonar-deep-research")
2. Extract citations + key findings
3. Embed findings via pplx-embed-context-v1
4. Store in Heady pgvector database
5. Available for future RAG retrieval
```

### Multi-Agent Research Pattern

```
1. HeadyResearch (sonar-deep-research) → raw findings
2. HeadyAnalyze → pattern extraction
3. HeadyPatterns → risk/opportunity analysis
4. HeadyMemory → persistent knowledge storage
```

### Heady MCP Server Integration

The Heady MCP server (`heady.headyme.com/sse`) wraps Perplexity as `heady_perplexity_research` tool. For direct access, use the `perplexity-ask` MCP server or REST API.
