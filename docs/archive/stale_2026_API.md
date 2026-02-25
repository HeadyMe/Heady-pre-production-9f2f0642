<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady AI Platform — API Reference

> Last updated: February 2026  
> Base URL: `https://api.headysystems.com`

## Authentication

All API requests require a valid `Authorization` header:

```
Authorization: Bearer <HEADY_BRAIN_KEY>
```

Enterprise and Pro tier users receive API keys via the HeadyOS Admin UI or the Stripe billing portal.

---

## Conductor API

The HeadyConductor is the federated liquid routing hub for all Heady services.

### `GET /api/conductor/health`

Returns system health and active routing layers.

**Response:**

```json
{
  "ok": true,
  "uptime": 86400000,
  "totalRoutes": 15420,
  "layers": {
    "taskRouter": true,
    "vectorZone": true,
    "brainRouter": false,
    "patternEngine": true
  },
  "supervisors": 3
}
```

### `GET /api/conductor/status`

Returns full routing telemetry including group hit counters and recent route decisions.

### `GET /api/conductor/route-map`

Returns the complete service group topology — which actions route to which groups, with weights and hit counts.

### `POST /api/conductor/analyze-route`

Test a hypothetical route without executing it.

**Request:**

```json
{
  "action": "chat",
  "payload": { "message": "test query" }
}
```

**Response:**

```json
{
  "ok": true,
  "decision": {
    "routeId": "route-1-m3k8f",
    "action": "chat",
    "serviceGroup": "reasoning",
    "vectorZone": { "zoneId": "z-general", "coordinate": [0, 0, 0] },
    "pattern": { "strategy": "stream-first", "cache": false, "priority": "high" },
    "weight": 1.0,
    "latency": 2
  }
}
```

---

## Brain API

HeadyBrain is the multi-model intelligence layer that routes requests through the Liquid Gateway.

### `POST /api/brain/chat`

Send a message to HeadyBrain. The Liquid Gateway auto-selects the optimal intelligence engine.

**Request:**

```json
{
  "message": "Explain quantum key encapsulation",
  "context": []
}
```

### `POST /api/brain/analyze`

Analyze code, text, or data using specialized HeadyBrain reasoning.

**Request:**

```json
{
  "content": "function foo() { return bar; }",
  "type": "code",
  "language": "javascript"
}
```

### `POST /api/brain/embed`

Generate vector embeddings for text using the HeadyBrain embedding service.

**Request:**

```json
{
  "text": "Heady AI is an autonomous multi-agent platform",
  "model": "nomic-embed-text"
}
```

### `POST /api/brain/search`

Search the HeadyBrain knowledge vault using hybrid lexical + vector search.

**Request:**

```json
{
  "query": "PQC handshake protocol",
  "topK": 5
}
```

---

## Billing API

Stripe-backed subscription management.

### `POST /api/billing/checkout`

Create a Stripe Checkout session for Pro or Enterprise plans.

**Request:**

```json
{
  "plan": "pro",
  "userId": "firebase-uid-123"
}
```

### `POST /api/billing/webhook`

Stripe webhook endpoint for subscription lifecycle events. Signature-verified via `STRIPE_WEBHOOK_SECRET`.

---

## Service Groups

The Conductor organizes all AI capabilities into logical service groups:

| Group | Actions | Weight |
|-------|---------|--------|
| `reasoning` | chat, complete, analyze, refactor | 1.0 |
| `coding` | code, refactor_logic, pr_review | 0.95 |
| `intelligence` | meta, logic, brain | 0.9 |
| `sims` | simulate, predict, monte_carlo | 0.85 |
| `embedding` | embed, store | 0.8 |
| `swarm` | forage, hive, swarm_nudge | 0.8 |
| `search` | search, query | 0.75 |
| `battle` | validate, arena | 0.7 |
| `creative` | generate, remix | 0.6 |
| `vision` | scan, detect, ocr | 0.5 |
| `governance` | audit, policy, compliance | 0.4 |
| `ops` | health, deploy, status | 0.3 |

---

## Rate Limits

| Tier | Requests/min | Penalty |
|------|-------------|---------|
| Free | 30 | 10min cooldown |
| Pro | 120 | 1hr ban on abuse |
| Enterprise | Unlimited | Custom SLA |

Rate limiting is enforced via Redis sliding-window counters. Internal mesh traffic (`10.x.x.x`) is exempt.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (missing required fields) |
| `401` | Unauthorized (invalid or missing API key) |
| `403` | Forbidden (subscription tier insufficient) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
