/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Cognitive Telemetry & Crypto-Audit Trail ═══
 *
 * Schema-Driven Cognitive Telemetry (L3/L4 Standard):
 * Wraps every AI reasoning step in a machine-readable JSON schema,
 * causally linking intention → inputs → tool selection → output.
 *
 * Proof-of-Inference:
 * SHA-256 cryptographic hashing of every AI action payload,
 * creating an immutable, verifiable audit trail.
 *
 * Heady AI Nodes: OBSERVER, SENTINEL
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const AUDIT_LOG = path.join(DATA_DIR, "cognitive-audit.jsonl");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Valid action types for cognitive telemetry
 */
const ACTION_TYPES = {
    CHAT_COMPLETION: "CHAT_COMPLETION",
    BATTLE_VALIDATE: "BATTLE_VALIDATE",
    BATTLE_ARENA: "BATTLE_ARENA",
    BATTLE_EVALUATE: "BATTLE_EVALUATE",
    CREATIVE_GENERATE: "CREATIVE_GENERATE",
    CREATIVE_REMIX: "CREATIVE_REMIX",
    SIMS_SIMULATE: "SIMS_SIMULATE",
    MCP_CALL: "MCP_CALL",
    MODEL_GENERATION: "MODEL_GENERATION",
    TRADE_THESIS: "TRADE_THESIS",
    ARCHITECTURE_UPDATE: "ARCHITECTURE_UPDATE",
    TASK_DECOMPOSITION: "TASK_DECOMPOSITION",
    PIPELINE_EXECUTION: "PIPELINE_EXECUTION",
};

/**
 * Create a Cognitive Telemetry Payload.
 * Every AI action is wrapped in this schema for full auditability.
 *
 * @param {string} actionType - One of ACTION_TYPES
 * @param {object} inputs - The exact inputs to the AI action
 * @param {object} outputs - The exact outputs from the AI action
 * @param {object} metadata - Additional context (model, provider, latency, etc.)
 * @returns {object} The cognitive telemetry payload (unhashed)
 */
function createPayload(actionType, inputs, outputs, metadata = {}) {
    const id = `ctel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id,
        schema_version: "1.0.0",
        action_type: actionType || "CHAT_COMPLETION",
        timestamp: new Date().toISOString(),
        inputs: sanitizeForAudit(inputs),
        outputs: sanitizeForAudit(outputs),
        reasoning: {
            model: metadata.model || "unknown",
            provider: metadata.provider || "heady-brain",
            latency_ms: metadata.latency_ms || null,
            tokens_in: metadata.tokens_in || null,
            tokens_out: metadata.tokens_out || null,
            arena_nodes: metadata.arena_nodes || 1,
            tier: metadata.tier || "free",
            confidence: metadata.confidence || null,
        },
        context: {
            service_group: metadata.service_group || "brain",
            source_endpoint: metadata.source_endpoint || null,
            request_id: metadata.request_id || null,
        },
    };
}

/**
 * Generate SHA-256 cryptographic hash of a telemetry payload.
 * This is the Proof-of-Inference — an immutable fingerprint of the AI's action.
 *
 * @param {object} payload - The cognitive telemetry payload
 * @returns {string} 64-char hex SHA-256 hash
 */
function hashPayload(payload) {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Create a complete audit entry with hash.
 *
 * @param {string} actionType
 * @param {object} inputs
 * @param {object} outputs
 * @param {object} metadata
 * @returns {{ payload: object, sha256_hash: string, audit_stamp: object }}
 */
function createAuditedAction(actionType, inputs, outputs, metadata = {}) {
    const payload = createPayload(actionType, inputs, outputs, metadata);
    const sha256_hash = hashPayload(payload);

    const audit_stamp = {
        heady_timestamp: payload.timestamp,
        action_type: payload.action_type,
        model: payload.reasoning.model,
        confidence_score: payload.reasoning.confidence || "1.00",
        sha256_hash,
    };

    // Persist to audit log (fire and forget)
    persistAuditEntry({ ...payload, sha256_hash });

    return { payload, sha256_hash, audit_stamp };
}

/**
 * Append an audit entry to the cognitive audit JSONL log.
 * Non-blocking — errors are swallowed to never impact the hot path.
 *
 * @param {object} entry
 */
function persistAuditEntry(entry) {
    try {
        const line = JSON.stringify(entry) + "\n";
        fs.appendFile(AUDIT_LOG, line, (err) => {
            if (err) console.error("[CogTel] Audit log write error:", err.message);
        });
    } catch { /* never crash the hot path */ }
}

/**
 * Read recent audit entries from the log.
 *
 * @param {number} limit - Max entries to return (default 50)
 * @returns {object[]} Array of audit entries, newest first
 */
function readAuditLog(limit = 50) {
    try {
        if (!fs.existsSync(AUDIT_LOG)) return [];
        const lines = fs.readFileSync(AUDIT_LOG, "utf8").trim().split("\n").filter(Boolean);
        return lines.slice(-limit).reverse().map(line => {
            try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
    } catch { return []; }
}

/**
 * Get audit log statistics.
 *
 * @returns {object} Stats including total entries, action type breakdown, etc.
 */
function getAuditStats() {
    const entries = readAuditLog(1000);
    const byAction = {};
    const byModel = {};
    let totalLatency = 0;
    let latencyCount = 0;

    for (const e of entries) {
        byAction[e.action_type] = (byAction[e.action_type] || 0) + 1;
        const model = e.reasoning?.model || "unknown";
        byModel[model] = (byModel[model] || 0) + 1;
        if (e.reasoning?.latency_ms) {
            totalLatency += e.reasoning.latency_ms;
            latencyCount++;
        }
    }

    return {
        total_entries: entries.length,
        by_action_type: byAction,
        by_model: byModel,
        avg_latency_ms: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
        oldest: entries[entries.length - 1]?.timestamp || null,
        newest: entries[0]?.timestamp || null,
    };
}

/**
 * Sanitize data for audit storage — truncate large payloads, strip sensitive fields.
 */
function sanitizeForAudit(data) {
    if (!data) return {};
    const str = JSON.stringify(data);
    if (str.length > 10000) {
        return { _truncated: true, _size: str.length, _preview: str.slice(0, 500) };
    }
    // Strip potential secrets
    const sanitized = { ...data };
    for (const key of ["password", "token", "secret", "apiKey", "api_key", "authorization"]) {
        if (sanitized[key]) sanitized[key] = "[REDACTED]";
    }
    return sanitized;
}

module.exports = {
    ACTION_TYPES,
    createPayload,
    hashPayload,
    createAuditedAction,
    persistAuditEntry,
    readAuditLog,
    getAuditStats,
    AUDIT_LOG,
};
