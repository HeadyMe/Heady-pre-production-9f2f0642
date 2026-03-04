---
name: heady-multi-model
description: Heady™ cross-provider AI routing — access Claude, GPT-4o, Gemini, Groq, and HeadyBuddy through a unified interface with model-selection guidance.
---

# Heady Multi-Model Routing Skill

Use this skill when you need to **leverage specific AI models** for their strengths, **compare outputs** across providers, or **route to the optimal model** for a given task. All models are accessed through Heady's branded namespace with 100% Heady routing.

## Tools Overview

| Tool | Model | Strength | Speed |
|------|-------|----------|-------|
| `mcp_Heady_heady_claude` | HeadyJules (Opus 4.6) | Deep reasoning, long context, complex analysis | Medium |
| `mcp_Heady_heady_openai` | HeadyCompute (GPT-4o) | General intelligence, function calling | Medium |
| `mcp_Heady_heady_gemini` | HeadyPythia (Gemini Pro) | Multimodal, images, large context windows | Medium |
| `mcp_Heady_heady_groq` | HeadyFast | Ultra-fast inference, latency-critical tasks | **Fastest** |
| `mcp_Heady_heady_buddy` | HeadyBuddy | Persistent memory, personal assistant, multi-provider | Medium |
| `mcp_Heady_heady_chat` | HeadyBrain | Default brain, general-purpose | Medium |

## Tool Details

### HeadyJules (Claude) — `mcp_Heady_heady_claude`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `message` | string | **required** | Prompt for Claude |
| `action` | enum | `chat` | `chat`, `think` (extended thinking), `analyze` |
| `system` | string | optional | System prompt |
| `thinkingBudget` | int | 32768 | Token budget for thinking mode |

**Use `think` action** for problems requiring deep step-by-step reasoning.

### HeadyCompute (GPT-4o) — `mcp_Heady_heady_openai`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `message` | string | **required** | Prompt |
| `action` | enum | `chat` | `chat`, `complete` |
| `model` | string | `gpt-4o` | Model override |

### HeadyPythia (Gemini) — `mcp_Heady_heady_gemini`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `prompt` | string | **required** | Prompt for Gemini |
| `action` | enum | `generate` | `generate`, `analyze` |
| `model` | string | `headypythia-3.1-pro-preview` | Model override |

**Best for multimodal tasks** — image analysis, video understanding, very large contexts.

### HeadyFast (Groq) — `mcp_Heady_heady_groq`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `message` | string | **required** | Prompt |
| `action` | enum | `chat` | `chat`, `complete` |
| `stream` | bool | false | Stream response |

**Use when speed matters more than depth** — quick lookups, simple transforms, batch processing.

### HeadyBuddy — `mcp_Heady_heady_buddy`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `message` | string | **required** | Message for HeadyBuddy |
| `action` | enum | `chat` | `chat`, `memory`, `skills`, `tasks`, `providers` |
| `provider` | enum | `auto` | `headypythia`, `headyjules`, `headylocal`, `auto` |

**HeadyBuddy remembers** — use it for ongoing conversations, preference tracking, and personal tasks.

## Model Selection Guide

```
Complex reasoning, nuanced analysis     → heady_claude (action: think)
General-purpose, function calling       → heady_openai
Image/video analysis, huge contexts     → heady_gemini
Speed-critical, batch processing        → heady_groq
Personal assistant with memory          → heady_buddy
Default catch-all                       → heady_chat
```

## Chaining Patterns

### Multi-Model Consensus

For critical decisions, get perspectives from multiple models:

```
1. mcp_Heady_heady_claude(message="analyze X", action="think")
2. mcp_Heady_heady_openai(message="analyze X")
3. mcp_Heady_heady_gemini(prompt="analyze X")
4. Synthesize — if all three agree, high confidence. If they diverge, investigate further.
```

### Speed → Depth Escalation

Start fast, escalate if needed:

```
1. mcp_Heady_heady_groq(message="quick answer to Y")     # Fast first pass
2. If answer is inadequate → mcp_Heady_heady_claude(message="deep analysis of Y", action="think")
```

## Tips

- **HeadyJules `think` mode** is the most powerful reasoning — use it for architecture decisions, debugging complex issues
- **HeadyFast (Groq)** is ~10x faster than other models — use for throughput tasks
- **HeadyBuddy** is the only model with persistent cross-session memory — use for ongoing work
- **All models route through Heady** — 100% branded namespace, no direct cloud API calls
