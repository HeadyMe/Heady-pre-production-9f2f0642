---
name: heady-gateway-routing
description: Use when the user wants to route AI work across multiple providers, choose between models based on workload, optimize caching, track request volume, or build a unified AI gateway with performance-aware fallback logic. Helpful for multi-model orchestration, provider selection, AI request routing, cache hit optimization, and gateway operations.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Gateway Routing

## When to Use This Skill

Use this skill when the user asks for:

- multi-provider AI routing
- model or provider selection logic
- gateway and cache optimization
- fallback policies between AI providers
- request routing based on cost, speed, or reliability

## Instructions

1. Identify the user goal:
   - lowest latency
   - best answer quality
   - lowest cost
   - highest resilience
   - balanced routing
2. Inventory the providers, models, and routing constraints the user already has.
3. Define a routing policy with these layers:
   - primary provider/model
   - fallback provider/model
   - cache policy
   - timeout thresholds
   - retry and circuit-breaker behavior
4. If the user has no existing policy, propose one with clear defaults for fast, balanced, and premium modes.
5. For each route, explain:
   - why the model is selected
   - when traffic should fail over
   - what should be cached
   - what metrics should be watched
6. Recommend an observability block that tracks:
   - request count
   - cache hits
   - provider health
   - latency percentiles
   - failure rate
7. If implementation is requested, produce a concrete config, pseudocode, or middleware example.
8. End with:
   - Recommended Routing Policy
   - Failure Modes
   - Immediate Next Moves

## Output Pattern

Use short sections:

- Objective
- Current Providers
- Routing Policy
- Cache Policy
- Health Rules
- Recommended Config

## Example Prompts

- Route my AI traffic across OpenAI, Anthropic, and Gemini with sensible fallbacks
- Help me design a cache-aware LLM gateway
- Pick the best provider by task type and fail over automatically

## Provenance

This skill is grounded in the public HeadyMe dashboard signals showing "Gateway Requests," "Cache Hits," and "Active Providers" on [headyme.com](https://headyme.com/), plus the public description of [headymcp-core](https://github.com/HeadyMe/headymcp-core) as the central MCP server for AI orchestration.
