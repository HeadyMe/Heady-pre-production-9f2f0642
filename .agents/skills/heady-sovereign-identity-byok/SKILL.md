---
name: heady-sovereign-identity-byok
description: Use when the user wants to design an assistant or platform that supports user-controlled identity, bring-your-own-key model access, multiple auth providers, or user-owned compute choices. Helpful for BYOK design, account architecture, trust boundaries, privacy-sensitive workflows, and user-controlled AI access layers.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Sovereign Identity BYOK

## When to Use This Skill

Use this skill when the user asks for:

- bring-your-own-key AI access
- user-controlled compute choices
- multi-provider sign-in design
- identity and trust boundaries for AI systems
- privacy-aware account architecture

## Instructions

1. Identify which resources are platform-managed and which are user-provided.
2. Separate three concerns clearly:
   - identity
   - billing or key ownership
   - tool authorization
3. Define supported auth paths:
   - platform login
   - OAuth providers
   - API-key connection
4. Specify how the system should behave when user-provided keys are missing, invalid, or rate-limited.
5. Keep secrets out of logs, prompts, and client-visible layers.
6. Document which features require platform keys versus user keys.
7. Add clear user controls for switching providers and revoking access.
8. End with:
   - Identity Model
   - Key Ownership Rules
   - Failure Handling
   - User Controls

## Output Pattern

- Objective
- Trust Boundaries
- Auth Paths
- Key Handling Rules
- UX Recommendations

## Example Prompts

- Design a BYOK layer for my AI platform
- Let users connect their own model providers safely
- Separate account identity from compute ownership in my assistant

## Provenance

This skill is grounded in the public HeadyMCP materials describing "Sovereign Identity" and user-supplied API key options on [headymcp.com](https://headymcp.com/), alongside the broader Heady ecosystem's multi-provider model access patterns.
