# Crypto-Audit Trail Architecture

## Proof-of-Inference

Every AI action in HeadyOS generates a cryptographic proof that the action occurred with specific inputs and outputs. This creates a legally verifiable, tamper-evident audit trail.

### How It Works

1. **Action occurs** — Chat completion, battle validation, pipeline task, etc.
2. **Payload created** — Inputs, outputs, model, latency, and context wrapped in JSON schema
3. **SHA-256 hash** — Computed on canonicalized (sorted-key) JSON payload
4. **Audit stamp** — Hash appended to response (`heady.audit_hash` field)
5. **Persisted** — Entry appended to `data/cognitive-audit.jsonl` (append-only)

### Hash Computation

```javascript
const canonical = JSON.stringify(payload, Object.keys(payload).sort());
const hash = crypto.createHash("sha256").update(canonical).digest("hex");
```

Sorting keys ensures deterministic hashing — the same payload always produces the same hash regardless of property order.

### Security Properties

- **Immutability** — JSONL is append-only
- **Tamper detection** — Any modification changes the SHA-256 hash
- **Non-repudiation** — Every AI decision is recorded with full context
- **Sensitive data redaction** — Passwords, tokens, API keys are stripped before hashing

### Future Roadmap

| Phase | Feature |
|-------|---------|
| **Current** | SHA-256 hashing + JSONL persistence |
| **Next** | Merkle tree aggregation (hourly root hashes) |
| **Future** | Blockchain anchoring (Ethereum L2 / Polygon) |
| **Enterprise** | zk-SNARK proofs for privacy-preserving audits |

### Files

- `src/telemetry/cognitive-telemetry.js` — Core module
- `data/cognitive-audit.jsonl` — Audit log
- `data/hcfp-pipeline.jsonl` — Pipeline execution log
