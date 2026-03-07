---
name: heady-ide-control-plane
description: Use when the user wants an IDE, coding assistant, or workspace to act as a control plane for a latent OS, routing approved tools, models, memory, and services through a governed developer environment. Helpful for editor routing, enterprise AI setup, coding-agent governance, MCP connectivity, and secure workspace policy.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady IDE Control Plane

## When to Use This Skill

Use this skill when the user asks for:

- IDE AI routing and governance
- developer workspace setup for a latent OS
- MCP or internal gateway integration in coding tools
- approved model and tool policy for editors
- enterprise coding-assistant hardening

## Instructions

1. Identify the workspace surfaces:
   - IDE or editor
   - terminal
   - code agent
   - memory layer
   - tool endpoints
2. Define which services are approved for:
   - code generation
   - search and research
   - tool execution
   - deployment actions
   - memory retrieval
3. Produce a control-plane policy that covers:
   - default routes
   - blocked routes
   - fallback behavior
   - auth handling
   - audit expectations
4. Recommend concrete configuration locations and validation checks.
5. If the user wants stronger governance, separate:
   - development-safe capabilities
   - privileged capabilities
   - human-confirmed actions
6. Add workspace checks:
   - approved services only
   - no insecure secret storage
   - safe failure behavior
   - reproducible onboarding
7. If relevant, recommend team docs and repo policy so the setup is reusable.
8. End with:
   - Workspace Control Plan
   - Required Config Changes
   - Validation Checklist

## Output Pattern

- Objective
- Workspace Surfaces
- Routing Policy
- Security Rules
- Validation Steps

## Example Prompts

- Turn my IDE into a governed control plane for my latent OS
- Route coding assistants through approved services only
- Design a secure MCP-aware editor setup for my team

## Provenance

This skill is based on public Heady patterns around configuring editor environments to use approved Heady services, reflected in public HeadySystems repository themes at [GitHub](https://github.com/HeadySystems) and related issue themes around workspace routing in [HeadySystems/Heady-pre-production](https://github.com/HeadySystems/Heady-pre-production/issues/43).
