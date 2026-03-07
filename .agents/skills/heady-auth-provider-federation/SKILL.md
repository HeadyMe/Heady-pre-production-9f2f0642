---
name: heady-auth-provider-federation
description: Configure and operate a data-driven federation layer for OAuth and API-key providers with auto-wired routes, frontend buttons, profile extraction, scopes, and callback consistency. Use when the user mentions provider registry, OAuth onboarding, connector generation, auth provider expansion, or multi-provider sign-in.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Auth Provider Federation

## When to Use This Skill

Use this skill when the user wants to:

- add or manage many auth providers
- design a provider registry for OAuth and API-key connectors
- auto-wire provider routes and frontend affordances
- standardize scopes, callbacks, and profile extraction
- support onboarding across many sign-in providers

## Core Pattern

The source pattern is a data-driven provider registry where each provider defines type, names, branding, env keys, authorize and token URLs, scopes, token handling, and user-extraction logic so routes and frontend controls can be generated from configuration rather than hand-coded per provider ([provider-registry.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/auth/provider-registry.js)).

## Instructions

1. Treat providers as configuration, not one-off code.
   Each provider entry should define:
   - type
   - display metadata
   - credential environment variables
   - authorize URL
   - token URL
   - profile URL if needed
   - scopes
   - token behavior
   - user extraction logic

2. Separate provider classes.
   - OAuth redirect flow providers
   - API-key validation providers
   - any future machine-to-machine providers

3. Standardize callbacks and scopes.
   - Keep callback paths uniform where possible.
   - Avoid provider-specific callback sprawl.
   - Define least-privilege scopes by default.

4. Generate routes and UI from the registry.
   - provider buttons
   - authorize links
   - token exchange handlers
   - profile fetch or token decode behavior

5. Normalize user identity output.
   Always emit a consistent user shape such as:
   - email
   - name
   - photo
   - provider
   - provider account id if available

6. Handle provider quirks centrally.
   - PKCE needs
   - tenant-aware URLs
   - content-type differences
   - missing email fallbacks
   - token auth style

7. Secure the federation layer.
   - environment-driven secrets only
   - explicit allowed redirect URIs
   - traceable failures with typed error codes
   - no silent fallback to insecure behavior

8. When expanding providers, verify:
   - callback alignment
   - scope minimality
   - profile extraction correctness
   - frontend affordance parity
   - onboarding compatibility

## Output Pattern

Provide:

- Provider schema
- Standard route model
- UI generation model
- Identity normalization contract
- Security and callback rules
- Expansion checklist

## Example Prompts

- Add five new OAuth providers to our registry cleanly
- Design a unified auth provider registry for app and API-key onboarding
- Normalize callbacks and identity extraction across many providers
