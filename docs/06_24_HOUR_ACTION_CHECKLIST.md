# 24-hour action checklist

## Immediate containment

- Rotate the committed Cloudflare credential and remove it from tracked scripts in the main monorepo ([scripts/dns-check.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-check.js), [scripts/dns-update.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-update.js)).
- Rotate the committed MCP integration token and remove it from tracked editor and UI defaults, because auth material is still visible in the repo clone ([.vscode/mcp.json](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.vscode/mcp.json), [src/ui/heady-antigravity-app/src/HeadyAntigravityUI.jsx](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/ui/heady-antigravity-app/src/HeadyAntigravityUI.jsx)).
- Freeze nonessential deploy changes until rollback logic is corrected, because the current canary rollback targets `--to-latest` instead of the last known good revision ([.github/workflows/ci.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/ci.yml)).

## Same-day fixes

- Patch `_requireAdminMutation` to fail closed in production when admin auth is not configured ([src/heady-conductor.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/heady-conductor.js)).
- Replace the liquid-deploy matrix with real source boundaries or disable projection to affected repos until the mappings are valid ([.github/workflows/liquid-deploy.yml](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.github/workflows/liquid-deploy.yml)).
- Decide and enforce one package manager in docs and CI, because `README.md` and `CONTRIBUTING.md` currently contradict each other ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md), [CONTRIBUTING.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/CONTRIBUTING.md)).

## Verification

- Re-run secret scanning after removals, because the current codebase still contains committed credential material and infrastructure endpoints in multiple places ([scripts/dns-check.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/scripts/dns-check.js), [.vscode/mcp.json](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/.vscode/mcp.json)).
- Confirm all public projection repos either deploy meaningfully or state clearly that they are projection shells, because several current workflows and READMEs imply stronger readiness than the code proves ([headyme-core](https://github.com/HeadyMe/headyme-core), [headymcp-core](https://github.com/HeadyMe/headymcp-core), [headysystems-core](https://github.com/HeadyMe/headysystems-core)).
