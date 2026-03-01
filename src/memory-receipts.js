/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Memory Receipts — SPEC-3 ═══
 *
 * Every knowledge vault operation emits a receipt:
 * stored vs dropped, reason codes, references to artifacts.
 */

const crypto = require("crypto");

const TERMINAL_STATES = new Set([
    "completed",
    "failed_closed",
    "escalated",
    "timed_out_recovered",
]);

const TASK_ID_MAX_LEN = 128;
const HASH_MAX_LEN = 256;
const ALLOWED_VERDICTS = new Set(["success", "failed", "error", "retry", "unknown"]);

function normalizeHash(value) {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, HASH_MAX_LEN) || null;
}

function normalizeTaskId(taskId) {
    const normalized = String(taskId || "").trim();
    if (!normalized) throw new Error("taskId required");
    return normalized.slice(0, TASK_ID_MAX_LEN);
}

function normalizeVerdict(verdict) {
    const normalized = String(verdict || "unknown").trim().toLowerCase();
    return ALLOWED_VERDICTS.has(normalized) ? normalized : "unknown";
}

class MemoryReceipts {
    constructor(opts = {}) {
        this.receipts = [];
        this.maxReceipts = opts.maxReceipts || 5000;
        this.stats = { ingested: 0, embedded: 0, stored: 0, dropped: 0 };
        this.attempts = [];
        this.maxAttempts = opts.maxAttempts || 10000;
        this.taskStates = new Map();
        this.repeatFingerprintCounts = new Map();
        this.repeatThreshold = opts.repeatThreshold || 3;
        this.repeatWindowMs = opts.repeatWindowMs || 15 * 60 * 1000;
        this.maxRepeatFingerprints = opts.maxRepeatFingerprints || 5000;
    }

    // ─── Emit a receipt ──────────────────────────────────────────
    emit(receipt) {
        const r = {
            id: crypto.randomUUID(),
            operation: receipt.operation || "UNKNOWN",  // INGEST | EMBED | STORE | DROP
            source: receipt.source || "unknown",
            sourceId: receipt.sourceId || null,
            documentId: receipt.documentId || null,
            stored: receipt.stored !== false,
            reason: receipt.reason || null,
            contentHash: receipt.contentHash || null,
            details: receipt.details || {},
            ts: new Date().toISOString(),
        };

        this.receipts.push(r);
        if (this.receipts.length > this.maxReceipts) this.receipts.shift();

        // Update stats
        if (r.operation === "INGEST") this.stats.ingested++;
        if (r.operation === "EMBED") this.stats.embedded++;
        if (r.stored) this.stats.stored++;
        if (!r.stored) this.stats.dropped++;

        return r;
    }

    // ─── Convenience methods ─────────────────────────────────────
    ingest(source, sourceId, opts = {}) {
        return this.emit({ operation: "INGEST", source, sourceId, stored: true, ...opts });
    }

    embed(documentId, provider, model, opts = {}) {
        return this.emit({
            operation: "EMBED",
            documentId,
            stored: true,
            details: { provider, model, ...opts.details },
            ...opts,
        });
    }

    store(source, sourceId, documentId, opts = {}) {
        return this.emit({ operation: "STORE", source, sourceId, documentId, stored: true, ...opts });
    }

    drop(source, sourceId, reason, opts = {}) {
        return this.emit({ operation: "DROP", source, sourceId, stored: false, reason, ...opts });
    }

    // ─── Query ───────────────────────────────────────────────────
    getReceipts(filter = {}, limit = 50) {
        let results = this.receipts;
        if (filter.operation) results = results.filter(r => r.operation === filter.operation);
        if (filter.source) results = results.filter(r => r.source === filter.source);
        if (filter.stored !== undefined) results = results.filter(r => r.stored === filter.stored);
        return results.slice(-limit);
    }

    getStats() {
        return {
            ...this.stats,
            total: this.receipts.length,
            storedRate: this.stats.stored / Math.max(1, this.stats.stored + this.stats.dropped),
            attempts: this.attempts.length,
            activeTasks: Array.from(this.taskStates.values()).filter(t => !t.closed).length,
            repeatFingerprints: this.repeatFingerprintCounts.size,
        };
    }

    // ─── Trial ledger ────────────────────────────────────────────
    recordAttempt(attempt = {}) {
        const normalized = {
            id: crypto.randomUUID(),
            taskId: normalizeTaskId(attempt.taskId || "unknown-task"),
            inputHash: normalizeHash(attempt.inputHash),
            constraintsHash: normalizeHash(attempt.constraintsHash),
            outputHash: normalizeHash(attempt.outputHash),
            verdict: normalizeVerdict(attempt.verdict),
            errorClass: normalizeHash(attempt.errorClass),
            metadata: attempt.metadata || {},
            ts: new Date().toISOString(),
        };

        this.attempts.push(normalized);
        if (this.attempts.length > this.maxAttempts) this.attempts.shift();

        const existingState = this.taskStates.get(normalized.taskId) || {
            taskId: normalized.taskId,
            attempts: 0,
            firstAttemptAt: normalized.ts,
            lastAttemptAt: normalized.ts,
            closed: false,
            terminalState: null,
            terminalReason: null,
            terminalEvidence: null,
        };

        existingState.attempts += 1;
        existingState.lastAttemptAt = normalized.ts;
        this.taskStates.set(normalized.taskId, existingState);

        const repeat = this._trackRepeatFailure(normalized);

        return {
            attempt: normalized,
            repeat,
            taskState: { ...existingState },
        };
    }

    closeTask(taskId, terminalState, reason, evidence = {}) {
        const normalizedTaskId = normalizeTaskId(taskId);
        if (!TERMINAL_STATES.has(terminalState)) {
            throw new Error(`invalid terminal state: ${terminalState}`);
        }

        const state = this.taskStates.get(normalizedTaskId) || {
            taskId: normalizedTaskId,
            attempts: 0,
            firstAttemptAt: new Date().toISOString(),
            lastAttemptAt: null,
            closed: false,
        };

        if (state.closed) {
            return {
                taskId: normalizedTaskId,
                closed: true,
                terminalState: state.terminalState,
                reason: state.terminalReason,
                evidence: state.terminalEvidence,
                closedAt: state.closedAt,
                idempotent: true,
            };
        }

        state.closed = true;
        state.closedAt = new Date().toISOString();
        state.terminalState = terminalState;
        state.terminalReason = reason || "unspecified";
        state.terminalEvidence = evidence;

        this.taskStates.set(normalizedTaskId, state);

        return {
            taskId: normalizedTaskId,
            closed: true,
            terminalState,
            reason: state.terminalReason,
            evidence: state.terminalEvidence,
            closedAt: state.closedAt,
        };
    }

    getTaskState(taskId) {
        if (!taskId) return null;
        const normalizedTaskId = String(taskId).trim().slice(0, TASK_ID_MAX_LEN);
        if (!normalizedTaskId) return null;
        const state = this.taskStates.get(normalizedTaskId);
        return state ? { ...state } : null;
    }

    listOpenTasks(limit = 100) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Number(limit))) : 100;
        return Array.from(this.taskStates.values())
            .filter(state => !state.closed)
            .slice(0, safeLimit)
            .map(state => ({ ...state }));
    }

    getAttempts(limit = 100) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Number(limit))) : 100;
        return this.attempts.slice(-safeLimit).map(a => ({ ...a }));
    }

    getOperationalStatus() {
        const stats = this.getStats();
        return {
            status: "healthy",
            terminalStates: Array.from(TERMINAL_STATES),
            allowedVerdicts: Array.from(ALLOWED_VERDICTS),
            capacity: {
                maxReceipts: this.maxReceipts,
                maxAttempts: this.maxAttempts,
                maxRepeatFingerprints: this.maxRepeatFingerprints,
            },
            stats,
            ts: new Date().toISOString(),
        };
    }

    _trackRepeatFailure(attempt) {
        if (attempt.verdict !== "failed" && attempt.verdict !== "error") {
            return { detected: false, count: 0, fingerprint: null };
        }

        const fingerprint = [
            attempt.taskId,
            attempt.inputHash || "no-input",
            attempt.constraintsHash || "no-constraints",
            attempt.errorClass || "no-error-class",
        ].join("::");

        const now = Date.now();
        const bucket = this.repeatFingerprintCounts.get(fingerprint) || [];
        const filtered = bucket.filter(ts => now - ts < this.repeatWindowMs);
        filtered.push(now);
        this.repeatFingerprintCounts.set(fingerprint, filtered);

        if (this.repeatFingerprintCounts.size > this.maxRepeatFingerprints) {
            const oldestKey = this.repeatFingerprintCounts.keys().next().value;
            if (oldestKey) this.repeatFingerprintCounts.delete(oldestKey);
        }

        return {
            detected: filtered.length >= this.repeatThreshold,
            count: filtered.length,
            threshold: this.repeatThreshold,
            fingerprint,
        };
    }
}

module.exports = MemoryReceipts;
module.exports.TERMINAL_STATES = TERMINAL_STATES;
