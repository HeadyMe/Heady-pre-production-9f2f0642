# HeadyGuard

Self-hosted prompt security and content filtering pipeline for the Heady AI platform. Replaces external moderation APIs (OpenAI moderation, etc.) with a zero-latency, zero-egress, fully configurable filter pipeline.

**Service port:** `3106` | **PHI scale factor:** `1.618`

---

## Architecture

```
Request
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│                    HeadyGuard Pipeline                   │
│                                                          │
│  ┌──────────────┐   Rules Pre-check (priority order)    │
│  │  rules.js    │──▶ block / allow / flag / redact       │
│  └──────────────┘                                        │
│          │ (if not hard-block/allow)                     │
│          ▼                                               │
│  ┌───────────────────────────────────────────────────┐   │
│  │              Pipeline Stages (ordered)            │   │
│  │                                                   │   │
│  │  Serial:    injection → pii → rate_limit          │   │
│  │  Parallel:  toxicity ║ topic                      │   │
│  │  Serial:    output_validator                      │   │
│  │                                                   │   │
│  │  Each stage returns: PASS | FLAG | BLOCK          │   │
│  │  Short-circuit on first BLOCK                     │   │
│  └───────────────────────────────────────────────────┘   │
│          │                                               │
│          ▼                                               │
│  ┌──────────────┐   Rules Post-check (stage results)    │
│  │  rules.js    │──▶ category-based rules               │
│  └──────────────┘                                        │
│          │                                               │
│          ▼                                               │
│  Aggregate risk score (PHI-weighted across stages)       │
│  Audit log entry                                         │
└─────────────────────────────────────────────────────────┘
  │
  ▼
Result: { allowed, risk_score, flags, blocked_by, ... }
```

### Sacred Geometry Scaling

Risk scores are aggregated using a PHI (1.618) weighting function. Stages that execute later in the pipeline (after the input has passed earlier checks) receive higher weight — the confidence that a late-stage finding is meaningful increases as earlier guards have already cleared the content. The weight of stage `i` of `n` total stages is:

```
weight_i = 1.0 + (i / n) × (PHI - 1)  →  ranges from 1.0 to 1.618
```

---

## File Structure

```
heady-guard/
├── index.js               # Main pipeline entry point, exports check(), checkBatch(), redact()
├── pipeline.js            # Pipeline engine — stage registration, execution, aggregation
├── rules.js               # Rule engine — JSON/YAML rules, hot-reload
├── routes.js              # Express router — all HTTP endpoints
├── health.js              # Health check handler + self-test
├── server.js              # Standalone Express server (helmet, cors, compression)
├── config.js              # All configuration via environment variables
├── package.json
├── Dockerfile
├── docker-compose.yml
├── filters/
│   ├── injection-detector.js   # Prompt injection detection
│   ├── pii-detector.js         # PII detection + redaction
│   ├── toxicity-scorer.js      # Multi-category toxicity scoring
│   ├── topic-filter.js         # Topic-based filtering
│   ├── rate-limiter.js         # Sliding window rate limiting
│   └── output-validator.js     # LLM output validation
└── __tests__/
    └── heady-guard.test.js     # Full test suite (842 lines)
```

---

## Quick Start

### Standalone server

```bash
npm install
node server.js
# → [HeadyGuard] Listening on 0.0.0.0:3106
```

### Docker

```bash
docker build -t heady-guard .
docker run -p 3106:3106 heady-guard
```

### Docker Compose

```bash
docker compose up
```

### As a library (embedded in another service)

```js
const guard = require('./heady-guard');

await guard.initialize();

const result = await guard.check({
  text:   'User input here',
  userId: 'user-abc-123',
  tokens: 150,
});

if (!result.allowed) {
  // blocked — result.blocked_by, result.block_message, result.risk_score
} else if (result.flags.length > 0) {
  // flagged — result.flags, result.risk_score
}
```

### Express middleware

```js
const { middleware } = require('./heady-guard');

app.use('/api/chat', guard.middleware({
  textField:  'message',
  userIdField: 'userId',
}));
```

---

## HTTP API

### `POST /guard/check`

Check a single input or LLM output.

**Request:**
```json
{
  "text":   "User input text",
  "output": "LLM response text",
  "userId": "user-123",
  "tokens": 150,
  "source": "input",
  "options": {
    "piiMode":        "detect",
    "blockThreshold": 80,
    "flagThreshold":  50
  }
}
```

**Response (allowed):** `200 OK`
```json
{
  "requestId":       "uuid",
  "allowed":         true,
  "risk_score":      12,
  "flags":           [],
  "blocked_by":      null,
  "processing_time": 4,
  "stage_results":   { "injection": { "action": "PASS", "riskScore": 0 } },
  "redactedText":    null,
  "rules_matched":   [],
  "timestamp":       "2026-03-07T11:46:00.000Z"
}
```

**Response (blocked):** `400 Bad Request`
```json
{
  "allowed":        false,
  "risk_score":     97,
  "blocked_by":     "injection",
  "block_message":  "Blocked by stage: injection",
  "flags":          ["ignore_instructions", "dan_jailbreak"]
}
```

---

### `POST /guard/check/batch`

Check up to 100 items in parallel.

```json
{
  "items": [
    { "text": "first input",  "userId": "u1" },
    { "text": "second input", "userId": "u2" }
  ]
}
```

Response: `200` (none blocked) or `207` (some blocked):
```json
{
  "count":   2,
  "blocked": 0,
  "results": [...]
}
```

---

### `POST /guard/redact`

Redact PII from text without running the full pipeline.

```json
{ "text": "Contact john@example.com or call 555-867-5309", "strategy": "placeholder" }
```

Response:
```json
{
  "redactedText": "Contact [EMAIL_1] or call [PHONE_US_1]",
  "detections":   2,
  "types_found":  ["EMAIL", "PHONE_US"]
}
```

Strategies: `placeholder` (default) | `mask` | `hash`

---

### `GET /guard/rules`

Returns all active rules.

---

### `PUT /guard/rules`

Hot-reload rules. Pass `rules` array to replace the entire ruleset, or `rule` object to add/update a single rule.

```json
{ "rules": [...], "mergeDefaults": true }
```

---

### `DELETE /guard/rules/:id`

Remove a rule by ID.

---

### `GET /guard/stats`

Pipeline statistics since last startup.

```json
{
  "total":      1234,
  "allowed":    1100,
  "blocked":    80,
  "flagged":    54,
  "block_rate": "0.0648",
  "uptime_ms":  3600000
}
```

---

### `GET /guard/audit`

Paginated audit log. Query params: `limit` (default 100, max 1000), `offset`, `userId`.

---

### `GET /health`

Health check with self-test, stage check, memory check.

```json
{
  "status":  "healthy",
  "service": "heady-guard",
  "version": "1.0.0",
  "uptime":  "3600s",
  "phi":     1.618,
  "checks":  {
    "pipeline": { "ok": true, "processing_time": 3 },
    "stages":   { "ok": true, "registered": ["injection", "pii", ...] },
    "memory":   { "ok": true, "heap_pct": "42.3%" }
  }
}
```

---

## Filters

### injection-detector

Detects prompt injection attacks:

| Category | Examples |
|---|---|
| Override | "ignore previous instructions", "disregard prior context", `[SYSTEM OVERRIDE]` |
| Persona | "act as DAN", "you are now jailbroken", `[jailbreak mode]` |
| Hierarchy | ChatML tags (`<\|im_start\|>`), LLaMA INST tags, `###Instruction:`, "print your system prompt" |
| Encoding | Unicode escapes (`\u0069...`), hex escapes (`\x69...`), base64 blobs, zero-width chars |
| Delimiter | `</system>`, `{"role":"system",...}`, code fence injection |

Each detection has a `confidence` (0–1) and `label`. Multiple findings increase confidence via diminishing-returns combination.

---

### pii-detector

| Type | Pattern | Severity |
|---|---|---|
| EMAIL | RFC-5321 regex | high |
| PHONE_US | +1 variants, formatted | medium |
| PHONE_INTL | E.164 `+XX...` | medium |
| SSN | 3-2-4 with Luhn-like validation | critical |
| CREDIT_CARD | Visa/MC/Amex/Discover + Luhn check | critical |
| IP_V4 | Public IPv4 (skips RFC-1918) | medium |
| IP_V6 | Standard hex groups | low |
| DATE_OF_BIRTH | "DOB: 01/01/1990" etc. | high |
| US_ADDRESS | Street + state + ZIP | high |
| PASSPORT_US | 1 letter + 8 digits | critical |
| API_KEY | sk-xxx, Bearer tokens, high-entropy hex | critical |
| PERSON_NAME | Heuristic two-word Title Case | low |

**Redaction strategies:**
- `placeholder`: `[EMAIL_1]`, `[SSN_1]`, `[PHONE_US_2]`
- `mask`: `*****`
- `hash`: `[sha:a1b2c3d4]`

---

### toxicity-scorer

| Category | Block Threshold | Examples |
|---|---|---|
| hate | 0.70 | slurs, genocide calls, dehumanization |
| violence | 0.75 | direct threats, weapon instructions, mass violence |
| sexual | 0.80 | explicit content, CSAM (always block at 1.0) |
| selfHarm | 0.65 | suicide method queries, self-harm instructions |
| harassment | 0.70 | doxxing, swatting, sustained harassment |

Context awareness: medical / academic / legal / fiction context applies a multiplier (0.5–0.7) to reduce false positives. CSAM always scores 1.0 regardless of context.

---

### topic-filter

Built-in domain bundles:

| Bundle | Default Action | Detects |
|---|---|---|
| FINANCIAL_ADVICE | flag | investment advice, pump-and-dump, insider trading |
| MEDICAL_ADVICE | flag | dosage advice, self-diagnosis, false cures |
| LEGAL_ADVICE | flag | specific legal outcome guarantees |
| WEAPONS_ILLEGAL | block | weapon manufacturing, illegal acquisition, darknet |
| HACKING | flag | hacking instructions, phishing, malware deployment |
| PRIVACY_VIOLATION | flag | covert tracking, unauthorized account access |
| DISINFORMATION | flag | fake news creation, deepfake fraud, impersonation |

Custom allowed/denied topics can be injected per-request.

---

### rate-limiter

Sliding window counters (in-process; swap `_getCounters` for Redis adapter in multi-instance):

| Limit | Default | Env Var |
|---|---|---|
| Requests / minute | 60 | `HEADY_GUARD_RATE_RPM` |
| Requests / hour | 1000 | `HEADY_GUARD_RATE_RPH` |
| Tokens / minute | 50,000 | `HEADY_GUARD_RATE_TPM` |
| Tokens / hour | 500,000 | `HEADY_GUARD_RATE_TPH` |
| Burst window | 5,000 ms | `HEADY_GUARD_RATE_BURST_WINDOW_MS` |
| Burst limit | 10 req | `HEADY_GUARD_RATE_BURST_LIMIT` |

---

### output-validator

Validates LLM responses before returning to the user:

- **Refusal detection** — AI refusals are always PASS (no false positives)
- **Hallucinated PII** — detects fabricated passwords, SSNs, credit cards, addresses, API keys in responses
- **JSON schema** — validates structured outputs against a provided schema (supports `type`, `required`, `properties`, `enum`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `items`)
- **Quality checks** — empty responses, excessive length, repetition loops

---

## Rule Engine

Rules are evaluated in priority order (lower = higher priority). Supports hot-reload without restart.

### Rule format

```json
{
  "id": "my-rule",
  "name": "Block competitor mentions",
  "enabled": true,
  "priority": 50,
  "conditionOp": "OR",
  "conditions": [
    { "type": "contains", "value": "competitor-name" },
    { "type": "regex", "pattern": "\\bcompetitor\\b", "flags": "i" }
  ],
  "action": { "type": "block", "message": "Competitor content blocked." }
}
```

### Condition types

| Type | Fields | Description |
|---|---|---|
| `contains` | `value`, `caseSensitive?` | Substring match |
| `regex` | `pattern`, `flags?` | Regex match |
| `length` | `op` (gt/lt/gte/lte/eq), `value` | Text length check |
| `category` | `category`, `threshold?` | Stage result category score |
| `userId` | `op` (eq/in/not_in), `value` | User ID match |
| `source` | `value` (input/output) | Check source type |

### Action types

| Type | Effect |
|---|---|
| `block` | Immediately reject; stop processing |
| `flag` | Add label to flags; add score |
| `redact` | Add redaction marker to flags |
| `rate_limit` | `level: 'warn'` adds flag; `level: 'block'` blocks |
| `allow` | Hard allow; skip remaining rules AND pipeline |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HEADY_GUARD_PORT` | `3106` | Service port |
| `HEADY_GUARD_HOST` | `0.0.0.0` | Bind address |
| `HEADY_GUARD_STAGES` | `injection,pii,toxicity,topic,rate_limit` | Enabled stages (comma-separated) |
| `HEADY_GUARD_BLOCK_THRESHOLD` | `80` | Risk score → BLOCK |
| `HEADY_GUARD_FLAG_THRESHOLD` | `50` | Risk score → FLAG |
| `HEADY_GUARD_PII_MODE` | `detect` | `detect` or `redact` |
| `HEADY_GUARD_PII_REDACTION_STRATEGY` | `placeholder` | `placeholder`, `mask`, or `hash` |
| `HEADY_GUARD_AUDIT_LOG` | _(none)_ | NDJSON audit log file path |
| `HEADY_GUARD_AUDIT_MEMORY_LIMIT` | `10000` | Max in-memory audit entries |
| `HEADY_GUARD_RULES_PATH` | _(none)_ | Path to custom rules JSON/YAML |
| `HEADY_GUARD_RULES_HOT_RELOAD` | `true` | Check rules file every 30s |
| `HEADY_GUARD_STAGE_TIMEOUT_MS` | `500` | Per-stage timeout |
| `HEADY_GUARD_PIPELINE_TIMEOUT_MS` | `2000` | Total pipeline timeout |
| `HEADY_GUARD_RATE_RPM` | `60` | Requests per minute |
| `HEADY_GUARD_RATE_RPH` | `1000` | Requests per hour |
| `HEADY_GUARD_RATE_TPM` | `50000` | Tokens per minute |
| `HEADY_GUARD_RATE_TPH` | `500000` | Tokens per hour |
| `HEADY_GUARD_RATE_BURST_WINDOW_MS` | `5000` | Burst detection window |
| `HEADY_GUARD_RATE_BURST_LIMIT` | `10` | Max requests in burst window |
| `HEADY_GUARD_LOG_LEVEL` | `info` | Log verbosity |

---

## Testing

```bash
npm test
# runs Jest — all 80+ assertions across 8 describe blocks
```

Coverage targets:
- Injection detector: override, persona, hierarchy, encoding, delimiter, safe inputs
- PII detector: all types, Luhn validation, all 3 redaction strategies
- Toxicity scorer: all 5 categories, context multipliers, CSAM hard-block
- Topic filter: all 6 bundles, custom allowed/denied
- Rate limiter: RPM, burst, token limits, reset
- Output validator: refusals, hallucinated PII, JSON schema, clean output
- Pipeline: serial, parallel, short-circuit, score aggregation
- Rules engine: all condition types, all action types, OR/AND logic, hot-reload

---

## Performance

Typical latency at p95 (single-stage):

| Stage | p50 | p95 |
|---|---|---|
| injection-detector | < 1 ms | < 2 ms |
| pii-detector | < 1 ms | < 3 ms |
| toxicity-scorer | < 1 ms | < 2 ms |
| topic-filter | < 1 ms | < 2 ms |
| rate-limiter | < 0.1 ms | < 0.5 ms |
| Full pipeline (all stages) | 3–8 ms | < 20 ms |

Fast path (very short or trivially safe inputs): skips toxicity + topic → typically < 1 ms end-to-end.

---

## Cloud Run Deployment

```bash
# Build & push
gcloud builds submit --tag gcr.io/PROJECT_ID/heady-guard

# Deploy
gcloud run deploy heady-guard \
  --image gcr.io/PROJECT_ID/heady-guard \
  --port 3106 \
  --set-env-vars NODE_ENV=production,HEADY_GUARD_BLOCK_THRESHOLD=80 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

---

## License

MIT — Heady Platform, 2026.
