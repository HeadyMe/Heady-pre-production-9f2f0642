---
name: heady-installable-package-release-ops
description: Package, verify, and publish installable Heady surfaces such as HeadyBuddy, HeadyAI-IDE, and HeadyWeb across static hosting and distribution channels. Use when the user mentions installable packages, release bundles, static deployment, distribution packs, or production build verification.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Installable Package Release Ops

## When to Use This Skill

Use this skill when the user needs:

- release packaging for Heady apps
- deployment of static build artifacts
- verification of bundle contents and hosting readiness
- a distribution plan for multiple app surfaces
- repeatable publishing across static hosting providers

## Core Pattern

The source pattern treats HeadyBuddy, HeadyAI-IDE, and HeadyWeb as installable production build packages with static assets, source maps, HTML entry points, and multiple hosting options such as Cloudflare Pages and web-server copy deployment ([INSTALLABLE_PACKAGES README](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/INSTALLABLE_PACKAGES/README.md)).

## Instructions

1. Define the release surface.
   - package name
   - public URL path
   - entry point
   - static asset path
   - target hosting channel

2. Verify build completeness.
   - HTML entry point present
   - minified JS and CSS present
   - source maps included only if desired
   - asset references resolve correctly

3. Keep the release contract explicit.
   - build size
   - hosting path
   - runtime assumptions
   - expected routes
   - rollback artifact

4. Support multiple distribution modes.
   - local test deployment
   - static host upload
   - CDN-backed hosting
   - packaged archive for transfer

5. Verify before publish.
   - entry page renders
   - asset files load
   - route prefixes match deployment path
   - no broken relative links

6. Produce a release manifest.
   - package
   - version
   - size
   - checksum if needed
   - publish destination
   - verification status

7. Watch for common failures.
   - wrong base path
   - missing asset copy
   - stale source maps
   - publishing the wrong surface to the wrong route

## Output Pattern

Provide:

- Release matrix
- Verification checklist
- Publish commands or steps
- Rollback plan
- Post-publish smoke tests

## Example Prompts

- Package and publish HeadyBuddy, HeadyWeb, and HeadyAI-IDE
- Audit our static release bundles before deployment
- Create a release manifest and smoke test plan for our installable packages
