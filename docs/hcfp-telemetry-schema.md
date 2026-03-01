# HCFP Cognitive Telemetry Schema

## Overview

Every AI action in the Heady ecosystem is wrapped in a **Cognitive Telemetry Payload** — a machine-readable JSON schema that causally links intention, inputs, tool selection, and output. Each payload is SHA-256 hashed to create an immutable **Proof-of-Inference** audit trail.

## Schema v1.0.0

```json
{
  "id": "ctel-<timestamp>-<random>",
  "schema_version": "1.0.0",
  "action_type": "CHAT_COMPLETION",
  "timestamp": "2026-02-25T22:45:00.000Z",
  "inputs": {
    "model": "heady-flash",
    "messages": [{ "role": "user", "content": "..." }],
    "temperature": 0.7
  },
  "outputs": {
    "reply": "...",
    "tokens": 34
  },
  "reasoning": {
    "model": "heady-flash",
    "provider": "heady-brain",
    "latency_ms": 1056,
    "tokens_in": 10,
    "tokens_out": 34,
    "arena_nodes": 3,
    "tier": "free",
    "confidence": null
  },
  "context": {
    "service_group": "brain",
    "source_endpoint": "/api/v1/chat/completions",
    "request_id": null
  },
  "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb924..."
}
```

## Action Types

| Type | Description |
|------|-------------|
| `CHAT_COMPLETION` | Standard chat inference |
| `BATTLE_VALIDATE` | Code validation via adversarial testing |
| `BATTLE_ARENA` | Multi-model competition |
| `BATTLE_EVALUATE` | Code quality evaluation |
| `CREATIVE_GENERATE` | Content generation |
| `CREATIVE_REMIX` | Content transformation |
| `SIMS_SIMULATE` | Monte Carlo simulation |
| `MCP_CALL` | Tool dispatch |
| `PIPELINE_EXECUTION` | HCFP task execution |
| `TASK_DECOMPOSITION` | Task breakdown |

## HCFP Task Manifest Schema

```json
{
  "id": "hcfp-<timestamp>-<random>",
  "phase": "execution",
  "priority": "high",
  "source": "manual",
  "created_at": "2026-02-25T22:45:00.000Z",
  "status": "pending",
  "tasks": [{
    "id": "task-<timestamp>-0",
    "name": "Optimize landing page",
    "action": "execute",
    "service_group": "brain",
    "inputs": { "description": "..." },
    "expected_outcome": "...",
    "status": "pending"
  }]
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry/audit` | GET | Read recent audit entries |
| `/api/telemetry/stats` | GET | Aggregate audit stats |
| `/api/hcfp/ingest` | POST | Inject a task manifest |
| `/api/hcfp/manifests` | GET | List all manifests |
| `/api/hcfp/manifest/:id` | GET | Get manifest by ID |

## Audit Trail

All entries are persisted to `data/cognitive-audit.jsonl` (append-only JSONL). The SHA-256 hash is computed on the canonicalized JSON payload, creating a tamper-evident record. Future roadmap includes blockchain anchoring via Ethereum L2.
