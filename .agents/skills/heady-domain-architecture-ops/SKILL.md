---
name: heady-domain-architecture-ops
description: Design and operate canonical domain architecture, subdomain routing, OAuth callback normalization, redirect policy, and domain hygiene across the Heady ecosystem. Use when the user mentions domain mapping, Cloudflare routing, canonical domains, callback URLs, redirects, or eliminating wrong hostnames from user-facing surfaces.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Domain Architecture Ops

## When to Use This Skill

Use this skill when the user needs:

- domain hierarchy planning
- subdomain-to-service routing
- canonical brand/domain mapping
- OAuth callback standardization
- legacy redirect cleanup
- user-facing hostname hygiene

## Core Pattern

The source pattern defines brand-level domains, production and development mappings, API subdomains, standardized OAuth callbacks, redirect rules, CDN domains, email domains, and domain policies in a single canonical configuration ([domain-architecture.yaml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/_domains/domain-architecture.yaml)).

## Instructions

1. Start from canonical brands and surfaces.
   - identify the primary brand domains
   - identify programs or subsidiaries
   - identify commercial, nonprofit, app, admin, API, CDN, and monitoring surfaces

2. Build a routing table with explicit intent.
   For each domain or subdomain capture:
   - domain
   - type
   - purpose
   - backend target
   - auth method if applicable
   - SSL requirement

3. Normalize user-facing hostname policy.
   - Pick one canonical public hostname per surface.
   - Redirect www and legacy aliases.
   - Prevent internal hosts or temporary endpoints from leaking into docs, examples, screenshots, and error messages.

4. Standardize OAuth callbacks.
   - Keep callback paths consistent across environments.
   - Maintain a single registry for production and development callback URLs.
   - Ensure provider configs reference the registry, not ad hoc strings.

5. Separate production, staging, and development clearly.
   - Avoid ambiguous mixed-use domains.
   - Mark which domains are redirect-only.
   - Keep staging and dev on explicit subdomains.

6. Define security policy at the domain layer.
   - HTTPS everywhere
   - security headers
   - mTLS or stronger controls for service-to-service paths where needed

7. Keep email and CDN domains in the same architecture map.
   - This avoids fragmented operational ownership.

8. When auditing an existing setup, look for:
   - duplicate intent across domains
   - public exposure of internal hosts
   - missing redirect rules
   - inconsistent callback URLs
   - mismatch between brand architecture and actual routes

## Output Pattern

Provide:

- Brand map
- Domain routing table
- Callback registry
- Redirect plan
- Security policy
- Hygiene issues and fixes

## Example Prompts

- Rationalize all Heady domains into one canonical architecture
- Audit our callback URLs and redirect rules
- Eliminate internal hostnames from public-facing surfaces
