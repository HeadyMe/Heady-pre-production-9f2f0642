# Heady Cognitive Production Runbook

## Objective

Operationalize the Heady + HeadyMe cognitive memory plan in live cloud with deterministic controls.

## Runtime Control Endpoints

- `GET /api/conductor/health`
- `GET /api/conductor/swarm-health`
- `GET /api/conductor/cognitive-status`
- `POST /api/conductor/cognitive-phase/:phase/evaluate`
- `GET /api/knowledge/health`

## Go/No-Go Phase Gates

- Phase A: structured traces + explicit terminal states
- Phase B: TTL queues + heartbeat + zero silent drops
- Phase C: episodic graph + procedural reuse
- Phase D: zone cache + p95 retrieval <= 1000ms
- Phase E: repeat detector gate + loop break <= 3
- Phase F: chaos recovery + rollback playbooks + budget-aware routing

## Live Status Criteria

System is considered live-ready only when all are true:

1. Cloud control URL uses `https://`
2. Conductor swarm pulse heartbeat age <= 30s
3. Service health ratio >= 0.9

## Operations Checklist

1. Verify deterministic terminal-state receipts are emitted for all task closures.
2. Confirm repeat-detection is active and strategy-shift events are logged.
3. Ensure all knowledge write endpoints are admin-auth protected.
4. Monitor p95 retrieval latency and prefetch hit-rate in cognitive status.
5. Validate swarm allocation remains within bounded caps under load.

## Deliverables Map

- Architecture graph + lifecycle map + hidden-error map: managed via conductor + cognitive status outputs.
- Memory reference model: enforced by `MemoryReceipts` terminal states and policy routes.
- 3D vector + graph retrieval protocol: governed by zone-first routing and memory health checks.
- Buddy policy pack: enforced by deterministic lifecycle APIs and conductor phase gates.
- Production runbook: this document.
- Migration checklist: phase gate endpoints and criteria above.
