# Public Repo Exposure Action List

## Observed public surfaces
- HeadyMe public org: https://github.com/HeadyMe
- HeadySystems public org: https://github.com/HeadySystems
- Public archived repo example: https://github.com/HeadySystems/Heady

## Immediate actions
1. Inventory every public repo and archive under HeadyMe, HeadySystems, and related orgs.
2. Flag anything containing operational architecture, environment variable inventories, domain matrices, internal routing details, security claims, or deployment internals.
3. Decide per repo whether to privatize, sanitize, or replace with a public-safe documentation version.
4. Capture ownership and a review cadence so public surfaces are rechecked before launches.

## High-priority evidence links
- Public API/service inventory in docs repo: https://github.com/HeadyMe/heady-docs/blob/main/api/api-keys-reference.md
- Public API/service inventory in pre-production repo: https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/docs/api-keys-reference.md
- Deploy workflow with public endpoints and permissive behavior: https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/deploy.yml
