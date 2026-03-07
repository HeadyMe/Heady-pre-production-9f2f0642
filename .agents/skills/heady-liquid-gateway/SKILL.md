---
name: heady-liquid-gateway
description: Use when the user wants dynamic liquid architecture for AI routing, provider racing, MCP-style transport, streaming responses, user-provided model keys, or a unified gateway that adapts by latency, reliability, and task type. Helpful for latent OS routing, multi-provider orchestration, BYOK model access, JSON-RPC or SSE transport planning, and low-latency tool execution.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Liquid Gateway

## When to Use This Skill

Use this skill when the user asks for:

- multi-provider AI routing
- liquid failover or fastest-response routing
- MCP-compatible tool transport
- JSON-RPC or SSE interface design
- bring-your-own-key model access
- low-latency gateway planning for a latent OS

## Instructions

1. Identify the workload classes first:
   - fast interactive requests
   - deep reasoning requests
   - tool-execution requests
   - background or batch requests
2. Map each workload to a routing policy:
   - preferred provider or model
   - fallback provider or model
   - streaming versus non-streaming behavior
   - caching eligibility
3. If the user wants liquid architecture, prefer race-based or health-aware routing over static single-provider assignment.
4. Separate the gateway into these layers:
   - identity and auth
   - provider selection
   - transport and streaming
   - caching
   - observability
   - failure handling
5. If the user wants user-owned compute, define which features use platform-managed keys and which support BYOK.
6. When designing tool interfaces, specify:
   - request schema
   - response schema
   - partial result frames
   - error payloads
   - timeout and retry rules
7. Recommend metrics for the liquid control plane:
   - latency by provider
   - success rate by workload type
   - cache hit rate
   - cost band by route
   - degraded-provider events
8. End with:
   - Liquid Routing Plan
   - Transport Contract
   - BYOK Rules
   - Immediate Next Moves

## Output Pattern

- Objective
- Workload Map
- Routing Rules
- Transport Design
- Key Ownership Model
- Reliability Controls

## Example Prompts

- Design a liquid LLM gateway that races providers and streams results
- Help me add BYOK and fallback logic to my AI platform
- Build an MCP-style transport layer for my latent OS gateway

## Provenance

This skill is based on public Heady language around "Liquid Gateway: Race providers, fastest wins" at [HeadyAPI](https://headyapi.com/), public MCP transport language at [HeadyMCP](https://headymcp.com/), and public sovereign identity and user-supplied model access patterns visible at [HeadyMCP](https://headymcp.com/).
