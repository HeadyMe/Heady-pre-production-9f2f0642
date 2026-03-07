---
name: heady-mcp-streaming-interface
description: Use when the user wants to design, document, or improve a tool interface built around MCP patterns, JSON-RPC requests, streaming responses, SSE transport, or IDE-to-tool connectivity. Helpful for external tool integration, agent tool contracts, streaming transport design, and MCP-compatible service planning.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady MCP Streaming Interface

## When to Use This Skill

Use this skill when the user asks for:

- MCP-compatible tool design
- JSON-RPC request and response planning
- SSE or streaming transport decisions
- IDE-to-tool integration patterns
- tool contracts for agent systems

## Instructions

1. Identify the tool surface:
   - IDE
   - chat agent
   - browser assistant
   - backend service
2. Define the contract layers:
   - transport
   - request schema
   - response schema
   - streaming behavior
   - auth and trust model
3. If the system needs live feedback, prefer streaming semantics and define partial-result behavior clearly.
4. Separate these concerns:
   - discovery
   - execution
   - status updates
   - error reporting
5. Document the minimum viable interface first, then add optional capabilities.
6. Include examples of request payloads, result frames, and failure payloads.
7. Recommend verification checks for latency, resumability, and client compatibility.
8. End with:
   - Interface Contract
   - Streaming Rules
   - Compatibility Risks

## Output Pattern

- Objective
- Actors
- Transport Design
- Tool Schema
- Error Model
- Validation Plan

## Example Prompts

- Design an MCP-style tool contract for my IDE assistant
- Help me expose this service over JSON-RPC with streaming updates
- Build a transport plan for real-time agent tools

## Provenance

This skill is grounded in the public [headymcp.com](https://headymcp.com/) materials describing an MCP server with "JSON-RPC + SSE native transport" and an edge-native tool layer, along with the public HeadySystems ecosystem overview at [headysystems.com](https://headysystems.com/).
