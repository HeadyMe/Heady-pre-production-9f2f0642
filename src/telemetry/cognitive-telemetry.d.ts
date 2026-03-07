export namespace ACTION_TYPES {
    let CHAT_COMPLETION: string;
    let BATTLE_VALIDATE: string;
    let BATTLE_ARENA: string;
    let BATTLE_EVALUATE: string;
    let CREATIVE_GENERATE: string;
    let CREATIVE_REMIX: string;
    let SIMS_SIMULATE: string;
    let MCP_CALL: string;
    let MODEL_GENERATION: string;
    let TRADE_THESIS: string;
    let ARCHITECTURE_UPDATE: string;
    let TASK_DECOMPOSITION: string;
    let PIPELINE_EXECUTION: string;
}
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
export function createPayload(actionType: string, inputs: object, outputs: object, metadata?: object): object;
/**
 * Generate SHA-256 cryptographic hash of a telemetry payload.
 * This is the Proof-of-Inference — an immutable fingerprint of the AI's action.
 *
 * @param {object} payload - The cognitive telemetry payload
 * @returns {string} 64-char hex SHA-256 hash
 */
export function hashPayload(payload: object): string;
/**
 * Create a complete audit entry with hash.
 *
 * @param {string} actionType
 * @param {object} inputs
 * @param {object} outputs
 * @param {object} metadata
 * @returns {{ payload: object, sha256_hash: string, audit_stamp: object }}
 */
export function createAuditedAction(actionType: string, inputs: object, outputs: object, metadata?: object): {
    payload: object;
    sha256_hash: string;
    audit_stamp: object;
};
/**
 * Append an audit entry to the cognitive audit JSONL log.
 * Non-blocking — errors are swallowed to never impact the hot path.
 *
 * @param {object} entry
 */
export function persistAuditEntry(entry: object): void;
/**
 * Read recent audit entries from the log.
 *
 * @param {number} limit - Max entries to return (default 50)
 * @returns {object[]} Array of audit entries, newest first
 */
export function readAuditLog(limit?: number): object[];
/**
 * Get audit log statistics.
 *
 * @returns {object} Stats including total entries, action type breakdown, etc.
 */
export function getAuditStats(): object;
export const AUDIT_LOG: string;
//# sourceMappingURL=cognitive-telemetry.d.ts.map