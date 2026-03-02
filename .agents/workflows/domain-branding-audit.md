---
description: Domain branding audit — validate sacred geometry, theming, and brand compliance across all sites
---

# 🎨 Domain Branding Audit Workflow

> Validates that all 9 Heady domains maintain brand consistency.

## Steps

1. **Fetch each domain** and extract:
   - Page title (must contain site name)
   - Sacred geometry canvas element
   - Accent color matches `site-registry.json`
   - Auth gate present and themed
   - Navigation contains all 9 domains
   - No `TODO`, `FIXME`, `localhost`, or placeholder content

2. **Compare against site-registry.json** — Each site's name, tagline, accent color must match

3. **Screenshot comparison** (if browser available) — Visual diff against baseline

4. **Generate branding scorecard** — Per-domain pass/fail on each check

5. **Auto-fix** — If a site's data diverges from registry, update `site-registry.json` accordingly
