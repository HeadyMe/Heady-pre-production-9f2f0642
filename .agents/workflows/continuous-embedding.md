---
description: Continuous embedding — auto-embeds all project data, user interactions, system state, and environmental data into 3D vector memory
---

# Continuous Embedding Workflow

// turbo-all

> **RAM-first**: Vector memory is the source of truth. Files are projections. The initial deep embed has been completed (2,419 vectors). The continuous embedder service runs permanently — no file scanning, events only.

## Continuous Embedder Service

`src/services/continuous-embedder.js` runs as part of heady-manager. It has two directions:

### Inbound (events → vector memory, φ⁵ ≈ 11s)

| Event | What Gets Embedded | Memory Type |
| --- | --- | --- |
| `buddy:message` | User conversations | Episodic |
| `telemetry:ingested` | System metrics | Episodic |
| `deployment:completed` | Deploy events | Procedural |
| `error:classified` | Incidents | Episodic |
| `config:updated` | Config changes | Procedural |
| `bee:reacted` | Swarm work results | Procedural |
| `health:checked` | Health snapshots | Episodic |
| `code:changed` | Code modifications | Procedural |
| _(timer)_ | OS/CPU/RAM env | Episodic |

### Outbound (vector memory → file projections, φ⁷ ≈ 29s)

When vector state changes, projections are marked **stale** and re-synced:

| Projection | Target | Synced When |
| --- | --- | --- |
| `src` | `src/` | Code changes ingested |
| `configs` | `configs/` | Config changes ingested |
| `data` | `data/` | Vector shards persist |
| `agents` | `.agents/` | Workflow/skill changes |
| `docs` | `docs/` | Knowledge updates |

### API Endpoints

- `GET /api/embedder/status` — stats + mode
- `GET /api/embedder/projections` — projection sync state
- `POST /api/embedder/ingest` — manual ingest
- `POST /api/embedder/project` — force projection sync
- `POST /api/embedder/flush` — flush pending queue
