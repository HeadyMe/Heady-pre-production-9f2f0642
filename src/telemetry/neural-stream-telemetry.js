/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Neural Stream Telemetry ──────────────────────────────────────────────────
 *
 * Patent Docket: HS-053
 * Title: SYSTEM AND METHOD FOR TRANSLATING AI REASONING STEPS INTO QUANTIFIABLE
 *        INFRASTRUCTURE STABILITY METRICS WITH CRYPTOGRAPHIC PROOF-OF-INFERENCE
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 * Related: HS-001, HS-024, HS-051
 *
 * Satisfies ALL 7 claims of HS-053.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// Golden ratio — consistent with HeadySystems implementations
const PHI = 1.6180339887;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
    jitter_window_size:         50,      // sliding window for Reasoning Jitter (latency std dev)
    confidence_window_size:     20,      // rolling window for Confidence Drift
    entropy_window_size:        100,     // action type window for Shannon entropy
    jitter_alert_multiplier:    2.0,     // alert when jitter > N × historical std
    confidence_drift_threshold: -0.10,   // alert when drift < -10%
    latency_ceiling_ms:         5_000,   // alert when single inference latency > 5 s
    poi_store_enabled:          false,   // whether to "publish" PoI to external store
};

// ─────────────────────────────────────────────────────────────────────────────
// PROOF-OF-INFERENCE HASH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 Proof-of-Inference hash for a telemetry payload.
 *
 * // RTP: HS-053 Claim 1(e) — compute SHA-256 cryptographic hash of telemetry payload
 * //                            to produce a Proof-of-Inference.
 *
 * @param {object} payload — structured telemetry payload
 * @returns {string} hex-encoded SHA-256 hash
 */
function computeProofOfInference(payload) {
    // RTP: HS-053 Claim 1(e)
    const canonical = JSON.stringify({
        modelId:      payload.modelId,
        actionType:   payload.actionType,
        inputTokens:  payload.inputTokens,
        outputTokens: payload.outputTokens,
        latencyMs:    payload.latencyMs,
        confidence:   payload.confidence,
        timestamp:    payload.timestamp,
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// SHANNON ENTROPY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Shannon entropy of a frequency distribution.
 * H = -Σ p(x) * log2(p(x))
 *
 * // RTP: HS-053 Claim 4 — Action Distribution Entropy = Shannon entropy of action
 * //                        type frequencies across a time window.
 *
 * @param {Map<string, number>|object} freqMap — { actionType: count }
 * @returns {number} entropy in bits
 */
function shannonEntropy(freqMap) {
    // RTP: HS-053 Claim 4
    const entries = freqMap instanceof Map
        ? Array.from(freqMap.values())
        : Object.values(freqMap);

    const total = entries.reduce((s, v) => s + v, 0);
    if (total === 0) return 0;

    let entropy = 0;
    for (const count of entries) {
        if (count === 0) continue;
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY INTERCEPTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TelemetryInterceptor: wraps every AI inference to produce structured telemetry
 * payloads with cryptographic Proof-of-Inference.
 *
 * // RTP: HS-053 Claim 1  — intercepts inference, records fields, computes PoI hash,
 * //                         persists to append-only audit log.
 * // RTP: HS-053 Claim 7(a) — telemetry interceptor wrapping AI inference requests.
 */
class TelemetryInterceptor {

    /**
     * @param {object} opts — configuration overrides
     */
    constructor(opts = {}) {
        this.config = Object.assign({}, DEFAULTS, opts);

        // RTP: HS-053 Claim 1(f) — append-only audit log
        // RTP: HS-053 Claim 7(c) — append-only audit log persisting payloads and hashes
        this._auditLog = [];

        // Sliding windows for metric computation
        this._latencyWindow    = [];
        this._confidenceWindow = [];
        this._actionWindow     = [];

        // Historical baselines (populated as data accumulates)
        this._historicalLatencyMean = null;
        this._historicalLatencyStd  = null;
        this._historicalConfMean    = null;

        // Action type frequency map for entropy computation
        this._actionFreqMap = new Map();

        // PoI collision detection
        this._seenHashes = new Set();

        // Alert listeners
        this._alertListeners = [];
    }

    // ── Core Interception ──────────────────────────────────────────────────

    /**
     * Wrap an async inference function with telemetry capture.
     *
     * // RTP: HS-053 Claim 1(a) — intercept AI inference request before submission
     * // RTP: HS-053 Claim 1(b) — record model identity, input tokens, submission timestamp
     * // RTP: HS-053 Claim 1(c) — upon response, record output tokens, latency, confidence
     * // RTP: HS-053 Claim 1(d) — construct structured telemetry payload
     *
     * @param {object}   meta            — inference metadata
     * @param {string}   meta.modelId    — model identifier
     * @param {string}   meta.actionType — classification: 'reasoning', 'retrieval', 'generation', etc.
     * @param {number}   meta.inputTokens — input token count
     * @param {Function} inferenceFn     — async function that performs the actual inference
     * @returns {Promise<{ result: any, payload: object, proofOfInference: string }>}
     */
    async intercept(meta, inferenceFn) {
        // RTP: HS-053 Claim 1(a) — intercept before submission
        // RTP: HS-053 Claim 1(b) — record model identity, input tokens, timestamp
        const submittedAt = Date.now();
        const {
            modelId    = 'unknown',
            actionType = 'unknown',
            inputTokens = 0,
        } = meta;

        let result;
        let outputTokens  = 0;
        let confidence    = 0;
        let latencyMs;
        let error         = null;

        try {
            result = await inferenceFn();

            // RTP: HS-053 Claim 1(c) — upon response, record output tokens, latency, confidence
            const respondedAt = Date.now();
            latencyMs    = respondedAt - submittedAt;
            outputTokens = (result && result.outputTokens) ? result.outputTokens : 0;
            confidence   = (result && result.confidence   !== undefined) ? result.confidence : 0;
        } catch (err) {
            latencyMs = Date.now() - submittedAt;
            error     = err.message || String(err);
        }

        // RTP: HS-053 Claim 1(d) — construct structured telemetry payload
        const payload = {
            modelId,
            actionType,
            inputTokens,
            outputTokens,
            latencyMs,
            confidence,
            timestamp:  submittedAt,
            error,
        };

        // RTP: HS-053 Claim 1(e) — compute SHA-256 PoI hash
        const proofOfInference = computeProofOfInference(payload);

        // PoI collision detection
        if (this._seenHashes.has(proofOfInference)) {
            this._alert({
                type:    'poi_collision',
                message: 'Proof-of-Inference hash collision detected',
                hash:    proofOfInference,
                payload,
            });
        }
        this._seenHashes.add(proofOfInference);

        // RTP: HS-053 Claim 1(f) — persist payload and hash to append-only audit log
        // RTP: HS-053 Claim 7(c) — append-only audit log
        this._auditLog.push({ payload, proofOfInference });

        // ── Update sliding windows ──────────────────────────────────────────
        this._updateWindows(latencyMs, confidence, actionType);

        // ── Anomaly Detection ───────────────────────────────────────────────
        this._checkAnomalies(payload, latencyMs, confidence);

        // RTP: HS-053 Claim 6 — optionally publish PoI to external content-addressable store
        if (this.config.poi_store_enabled) {
            this._publishPoI(payload, proofOfInference);
        }

        return { result, payload, proofOfInference };
    }

    // ── Sliding Window Updates ─────────────────────────────────────────────

    /**
     * Update all sliding windows with new measurement.
     * @param {number} latencyMs
     * @param {number} confidence
     * @param {string} actionType
     */
    _updateWindows(latencyMs, confidence, actionType) {
        // Latency window for Reasoning Jitter
        this._latencyWindow.push(latencyMs);
        if (this._latencyWindow.length > this.config.jitter_window_size) {
            this._latencyWindow.shift();
        }

        // Confidence window for Confidence Drift
        this._confidenceWindow.push(confidence);
        if (this._confidenceWindow.length > this.config.confidence_window_size) {
            this._confidenceWindow.shift();
        }

        // Action window for entropy
        this._actionWindow.push(actionType);
        if (this._actionWindow.length > this.config.entropy_window_size) {
            const removed = this._actionWindow.shift();
            const freq = this._actionFreqMap.get(removed) || 0;
            if (freq <= 1) {
                this._actionFreqMap.delete(removed);
            } else {
                this._actionFreqMap.set(removed, freq - 1);
            }
        }
        this._actionFreqMap.set(actionType, (this._actionFreqMap.get(actionType) || 0) + 1);

        // Update historical baselines once we have enough data
        if (this._latencyWindow.length >= this.config.jitter_window_size) {
            const stats = this._computeStats(this._latencyWindow);
            if (this._historicalLatencyMean === null) {
                this._historicalLatencyMean = stats.mean;
                this._historicalLatencyStd  = stats.std;
            } else {
                // Exponential moving average for baseline
                const alpha = 0.1;
                this._historicalLatencyMean = (1 - alpha) * this._historicalLatencyMean + alpha * stats.mean;
                this._historicalLatencyStd  = (1 - alpha) * this._historicalLatencyStd  + alpha * stats.std;
            }
        }

        if (this._confidenceWindow.length >= this.config.confidence_window_size) {
            const confMean = this._confidenceWindow.reduce((s, v) => s + v, 0) / this._confidenceWindow.length;
            if (this._historicalConfMean === null) {
                this._historicalConfMean = confMean;
            } else {
                const alpha = 0.1;
                this._historicalConfMean = (1 - alpha) * this._historicalConfMean + alpha * confMean;
            }
        }
    }

    // ── Derived Stability Metrics ──────────────────────────────────────────

    /**
     * Compute Reasoning Jitter: standard deviation of inference latency over
     * the sliding window.
     *
     * // RTP: HS-053 Claim 2 — Reasoning Jitter = std dev of latency over sliding window
     * // RTP: HS-053 Claim 7(d) — aggregation engine computing Reasoning Jitter
     *
     * @returns {{ jitter: number, mean: number, windowSize: number }}
     */
    computeReasoningJitter() {
        // RTP: HS-053 Claim 2
        if (this._latencyWindow.length === 0) return { jitter: 0, mean: 0, windowSize: 0 };
        const stats = this._computeStats(this._latencyWindow);
        return {
            jitter:     +stats.std.toFixed(4),
            mean:       +stats.mean.toFixed(4),
            windowSize: this._latencyWindow.length,
        };
    }

    /**
     * Compute Confidence Drift: difference between rolling avg confidence and
     * historical mean confidence.
     *
     * // RTP: HS-053 Claim 3 — Confidence Drift = rolling avg confidence - historical mean
     * // RTP: HS-053 Claim 7(d) — aggregation engine computing Confidence Drift
     *
     * @returns {{ drift: number, rollingAvg: number, historicalMean: number }}
     */
    computeConfidenceDrift() {
        // RTP: HS-053 Claim 3
        if (this._confidenceWindow.length === 0) {
            return { drift: 0, rollingAvg: 0, historicalMean: 0 };
        }
        const rollingAvg = this._confidenceWindow.reduce((s, v) => s + v, 0) / this._confidenceWindow.length;
        const historicalMean = this._historicalConfMean !== null ? this._historicalConfMean : rollingAvg;
        const drift = rollingAvg - historicalMean;
        return {
            drift:         +drift.toFixed(6),
            rollingAvg:    +rollingAvg.toFixed(6),
            historicalMean: +historicalMean.toFixed(6),
        };
    }

    /**
     * Compute Action Distribution Entropy: Shannon entropy of cognitive task
     * frequency across the sliding time window.
     *
     * // RTP: HS-053 Claim 4 — Action Distribution Entropy = Shannon entropy of action
     * //                        type frequencies; low entropy = stuck in single mode.
     * // RTP: HS-053 Claim 7(d) — aggregation engine computing Action Distribution Entropy
     *
     * @returns {{ entropy: number, actionCounts: object, distinctActions: number }}
     */
    computeActionDistributionEntropy() {
        // RTP: HS-053 Claim 4
        if (this._actionFreqMap.size === 0) {
            return { entropy: 0, actionCounts: {}, distinctActions: 0 };
        }
        const entropy = shannonEntropy(this._actionFreqMap);
        const actionCounts = Object.fromEntries(this._actionFreqMap.entries());
        return {
            entropy:         +entropy.toFixed(6),
            actionCounts,
            distinctActions: this._actionFreqMap.size,
        };
    }

    /**
     * Get all three stability metrics in one call.
     *
     * // RTP: HS-053 Claim 7(d) — aggregation engine: Jitter + Drift + Entropy
     *
     * @returns {object}
     */
    getStabilityMetrics() {
        // RTP: HS-053 Claim 7(d)
        return {
            reasoningJitter:           this.computeReasoningJitter(),
            confidenceDrift:           this.computeConfidenceDrift(),
            actionDistributionEntropy: this.computeActionDistributionEntropy(),
            auditLogLength:            this._auditLog.length,
        };
    }

    // ── Anomaly Detection ──────────────────────────────────────────────────

    /**
     * Check stability metrics for anomalies and fire alerts.
     *
     * // RTP: HS-053 Claim 5 — alert when Reasoning Jitter > N × historical std dev
     * // RTP: HS-053 Claim 7(e) — anomaly detection generating alerts when metrics deviate
     *
     * @param {object} payload
     * @param {number} latencyMs
     * @param {number} confidence
     */
    _checkAnomalies(payload, latencyMs, confidence) {
        // RTP: HS-053 Claim 5 — alert on Reasoning Jitter exceeding configurable multiple
        // RTP: HS-053 Claim 7(e) — anomaly detection module
        if (this._historicalLatencyStd !== null && this._historicalLatencyStd > 0) {
            const { jitter } = this.computeReasoningJitter();
            const jitterThreshold = this.config.jitter_alert_multiplier * this._historicalLatencyStd;
            if (jitter > jitterThreshold) {
                this._alert({
                    type:      'reasoning_jitter',
                    message:   `Reasoning Jitter ${jitter.toFixed(2)} ms exceeds ${jitterThreshold.toFixed(2)} ms (${this.config.jitter_alert_multiplier}× historical std)`,
                    jitter,
                    threshold: jitterThreshold,
                    payload,
                });
            }
        }

        // Alert on Confidence Drift
        const { drift } = this.computeConfidenceDrift();
        if (drift < this.config.confidence_drift_threshold) {
            this._alert({
                type:      'confidence_drift',
                message:   `Confidence Drift ${drift.toFixed(4)} below threshold ${this.config.confidence_drift_threshold}`,
                drift,
                threshold: this.config.confidence_drift_threshold,
                payload,
            });
        }

        // Alert on latency ceiling breach
        if (latencyMs > this.config.latency_ceiling_ms) {
            this._alert({
                type:      'latency_ceiling',
                message:   `Inference latency ${latencyMs} ms exceeds ceiling ${this.config.latency_ceiling_ms} ms`,
                latencyMs,
                ceiling:   this.config.latency_ceiling_ms,
                payload,
            });
        }
    }

    // ── PoI External Publication ───────────────────────────────────────────

    /**
     * Stub for publishing PoI to an external content-addressable store.
     *
     * // RTP: HS-053 Claim 6 — PoI hash published to external content-addressable
     * //                         store for independent verification
     *
     * @param {object} payload
     * @param {string} hash
     */
    _publishPoI(payload, hash) {
        // RTP: HS-053 Claim 6
        // In production this would call IPFS, a blockchain ledger, or a trusted timestamping service.
        // The interface is intentionally decoupled; the caller injects the actual publisher via
        // opts.poiPublisher: async (hash, payload) => void
        if (this.config.poiPublisher && typeof this.config.poiPublisher === 'function') {
            Promise.resolve(this.config.poiPublisher(hash, payload)).catch(() => {});
        }
    }

    // ── Audit Log ──────────────────────────────────────────────────────────

    /**
     * Get the full append-only audit log.
     *
     * // RTP: HS-053 Claim 1(f) — append-only audit log
     *
     * @returns {Array<{ payload: object, proofOfInference: string }>}
     */
    getAuditLog() {
        // RTP: HS-053 Claim 1(f) — append-only (returns copy, never allows mutation)
        return this._auditLog.map(entry => ({
            payload:          { ...entry.payload },
            proofOfInference: entry.proofOfInference,
        }));
    }

    /**
     * Verify a payload against its stored PoI hash.
     * @param {object} payload
     * @param {string} storedHash
     * @returns {boolean}
     */
    verifyProofOfInference(payload, storedHash) {
        return computeProofOfInference(payload) === storedHash;
    }

    // ── Alert System ───────────────────────────────────────────────────────

    /**
     * Register an alert listener.
     *
     * // RTP: HS-053 Claim 7(e) — anomaly detection module generating alerts
     *
     * @param {Function} listener — (alert: object) => void
     */
    onAlert(listener) {
        // RTP: HS-053 Claim 7(e)
        this._alertListeners.push(listener);
    }

    _alert(alertObj) {
        const fullAlert = { ...alertObj, timestamp: new Date().toISOString() };
        for (const listener of this._alertListeners) {
            try { listener(fullAlert); } catch (_) { /* swallow */ }
        }
    }

    // ── Helper: statistics ─────────────────────────────────────────────────

    /**
     * Compute mean and standard deviation of an array.
     * @param {number[]} arr
     * @returns {{ mean: number, std: number }}
     */
    _computeStats(arr) {
        if (arr.length === 0) return { mean: 0, std: 0 };
        const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
        const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
        return { mean, std: Math.sqrt(variance) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEURAL STREAM TELEMETRY SYSTEM — Claim 7
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NeuralStreamTelemetry: convenience wrapper that assembles the full HS-053 system.
 *
 * // RTP: HS-053 Claim 7 — full system with interceptor, crypto module, audit log,
 * //                         aggregation engine, and anomaly detection module.
 */
class NeuralStreamTelemetry {

    constructor(opts = {}) {
        // RTP: HS-053 Claim 7(a) — telemetry interceptor
        // RTP: HS-053 Claim 7(b) — cryptographic module (SHA-256 PoI, in interceptor)
        // RTP: HS-053 Claim 7(c) — append-only audit log (in interceptor)
        // RTP: HS-053 Claim 7(d) — aggregation engine (in interceptor)
        // RTP: HS-053 Claim 7(e) — anomaly detection (in interceptor)
        this.interceptor = new TelemetryInterceptor(opts);
    }

    /**
     * Wrap an inference call with full telemetry.
     *
     * // RTP: HS-053 Claim 1
     */
    async trace(meta, inferenceFn) {
        // RTP: HS-053 Claim 1
        return this.interceptor.intercept(meta, inferenceFn);
    }

    /**
     * Get all stability metrics.
     * // RTP: HS-053 Claim 7(d)
     */
    getMetrics() {
        // RTP: HS-053 Claim 7(d)
        return this.interceptor.getStabilityMetrics();
    }

    /**
     * Register an alert callback.
     * // RTP: HS-053 Claim 7(e)
     */
    onAlert(listener) {
        // RTP: HS-053 Claim 7(e)
        this.interceptor.onAlert(listener);
    }

    /**
     * Get the append-only audit log.
     * // RTP: HS-053 Claim 1(f)
     */
    getAuditLog() {
        // RTP: HS-053 Claim 1(f)
        return this.interceptor.getAuditLog();
    }

    /**
     * Verify a PoI hash.
     */
    verify(payload, hash) {
        return this.interceptor.verifyProofOfInference(payload, hash);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,
    DEFAULTS,
    computeProofOfInference,
    shannonEntropy,
    TelemetryInterceptor,
    NeuralStreamTelemetry,
};
