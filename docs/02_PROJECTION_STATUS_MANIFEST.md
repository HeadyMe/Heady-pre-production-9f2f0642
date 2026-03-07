# Projection status manifest

## Current public repo map

| Repo | Current role | Observed state | Recommendation |
|---|---|---|---|
| [Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642) | Source-of-truth monorepo | Real implementation center | Keep as canonical operating core |
| [heady-docs](https://github.com/HeadyMe/heady-docs) | Documentation hub | Real docs repo with strategic and patent material | Keep as canonical ingestion/docs hub |
| [headyme-core](https://github.com/HeadyMe/headyme-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headysystems-core](https://github.com/HeadyMe/headysystems-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headymcp-core](https://github.com/HeadyMe/headymcp-core) | Projected site/app shell | Thin Express stub despite larger product claims | Convert to explicit projection target or fold into unified sites repo |
| [headyapi-core](https://github.com/HeadyMe/headyapi-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headybot-core](https://github.com/HeadyMe/headybot-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headybuddy-core](https://github.com/HeadyMe/headybuddy-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headyconnection-core](https://github.com/HeadyMe/headyconnection-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headyio-core](https://github.com/HeadyMe/headyio-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headyos-core](https://github.com/HeadyMe/headyos-core) | Projected site/app shell | Thin Express stub | Convert to explicit projection target or fold into unified sites repo |
| [headymcp-production](https://github.com/HeadyMe/headymcp-production) | Production target repo | Near-empty | Either automate population and status metadata or remove public ambiguity |
| [headysystems-production](https://github.com/HeadyMe/headysystems-production) | Production target repo | Near-empty | Either automate population and status metadata or remove public ambiguity |

## Suggested future manifest fields

Every projection target should expose the following machine-readable metadata in repo root:

```json
{
  "projection": true,
  "source_repo": "HeadyMe/Heady-pre-production-9f2f0642",
  "source_path": "<canonical monorepo module path>",
  "projection_type": "site-shell|service-shell|full-service|docs|production-target",
  "last_projection_commit": "<sha>",
  "last_projection_at": "<iso timestamp>",
  "last_verified_at": "<iso timestamp>",
  "live_url": "<https url>",
  "deploy_mode": "cloud-run|cloudflare|static|none",
  "health_url": "<https url>",
  "status": "healthy|drifted|stale|disabled"
}
```

## Recommended simplification

The current 9 satellite `-core` repos behave much more like one templated projection family than nine independent codebases, so consolidating them into a single `heady-sites` or `heady-surfaces` repo would reduce CI, security, and maintenance surface area while preserving domain differentiation through config files and deploy metadata ([headyme-core](https://github.com/HeadyMe/headyme-core), [headymcp-core](https://github.com/HeadyMe/headymcp-core), [headysystems-core](https://github.com/HeadyMe/headysystems-core)).
