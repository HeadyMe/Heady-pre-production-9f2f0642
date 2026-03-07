/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Neural Stream Telemetry REST Routes ──────────────────────────────────────
 *
 * Patent Docket: HS-053
 * Express-style route handlers exposing the Neural Stream Telemetry system.
 *
 * Mount in your Express app:
 *   const telRoutes = require('./src/routes/telemetry-routes');
 *   app.use('/api/telemetry', telRoutes.createRouter(express.Router()));
 *
 * Endpoints:
 *   POST  /api/telemetry/record            — Record a completed inference (Claim 1)
 *   POST  /api/telemetry/verify            — Verify a PoI hash (Claim 1e)
 *   GET   /api/telemetry/metrics           — Stability metrics (Claims 2, 3, 4, 7d)
 *   GET   /api/telemetry/jitter            — Reasoning Jitter only (Claim 2)
 *   GET   /api/telemetry/confidence-drift  — Confidence Drift only (Claim 3)
 *   GET   /api/telemetry/entropy           — Action Distribution Entropy (Claim 4)
 *   GET   /api/telemetry/audit-log         — Append-only audit log (Claim 1f)
 *   POST  /api/telemetry/publish-poi       — Publish PoI externally (Claim 6)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { NeuralStreamTelemetry, computeProofOfInference } = require('../telemetry/neural-stream-telemetry');

// Singleton telemetry instance
const telemetry = new NeuralStreamTelemetry({
    jitter_window_size:         50,
    confidence_window_size:     20,
    entropy_window_size:        100,
    jitter_alert_multiplier:    2.0,
    confidence_drift_threshold: -0.10,
    latency_ceiling_ms:         5_000,
});

// Alert log for route exposure
const alertLog = [];
telemetry.onAlert(alert => {
    alertLog.push(alert);
    if (alertLog.length > 500) alertLog.shift();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/telemetry/record
 * Record a completed inference with telemetry.
 * Accepts pre-measured data (no live inference call needed at the REST layer).
 *
 * // RTP: HS-053 Claim 1 — intercept, record, compute PoI, persist to audit log
 *
 * Body: {
 *   modelId: string,
 *   actionType: string,
 *   inputTokens: number,
 *   outputTokens: number,
 *   latencyMs: number,
 *   confidence: number,
 *   responseText?: string
 * }
 */
async function postRecord(req, res) {
    // RTP: HS-053 Claim 1
    const {
        modelId     = 'unknown',
        actionType  = 'unknown',
        inputTokens = 0,
        outputTokens,
        latencyMs,
        confidence  = 0,
        responseText = '',
    } = req.body;

    if (typeof latencyMs   !== 'number') return sendError(res, 400, 'latencyMs must be a number');
    if (typeof outputTokens !== 'number') return sendError(res, 400, 'outputTokens must be a number');

    try {
        // Wrap in a mock "inference" that instantly resolves the pre-measured values
        const { payload, proofOfInference } = await telemetry.trace(
            { modelId, actionType, inputTokens },
            async () => ({ outputTokens, confidence }),
        );

        res.json({ ok: true, data: {
            payload,
            proofOfInference,
            auditLogLength: telemetry.getAuditLog().length,
        }});
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/telemetry/verify
 * Verify a PoI hash against a payload.
 *
 * // RTP: HS-053 Claim 1(e) and Claim 6
 *
 * Body: { payload: object, proofOfInference: string }
 */
function postVerifyPoI(req, res) {
    // RTP: HS-053 Claim 1(e) and Claim 6
    const { payload, proofOfInference } = req.body;
    if (!payload)            return sendError(res, 400, 'payload required');
    if (!proofOfInference)   return sendError(res, 400, 'proofOfInference required');
    try {
        const valid = telemetry.verify(payload, proofOfInference);
        res.json({ ok: true, data: { valid, proofOfInference } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/metrics
 * Return all three stability metrics in one response.
 *
 * // RTP: HS-053 Claim 7(d) — aggregation engine
 */
function getMetrics(req, res) {
    // RTP: HS-053 Claim 7(d)
    try {
        res.json({ ok: true, data: telemetry.getMetrics() });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/jitter
 * Return Reasoning Jitter (latency std dev) only.
 *
 * // RTP: HS-053 Claim 2
 */
function getJitter(req, res) {
    // RTP: HS-053 Claim 2
    try {
        res.json({ ok: true, data: telemetry.interceptor.computeReasoningJitter() });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/confidence-drift
 * Return Confidence Drift only.
 *
 * // RTP: HS-053 Claim 3
 */
function getConfidenceDrift(req, res) {
    // RTP: HS-053 Claim 3
    try {
        res.json({ ok: true, data: telemetry.interceptor.computeConfidenceDrift() });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/entropy
 * Return Action Distribution Entropy (Shannon entropy of action types).
 *
 * // RTP: HS-053 Claim 4
 */
function getEntropy(req, res) {
    // RTP: HS-053 Claim 4
    try {
        res.json({ ok: true, data: telemetry.interceptor.computeActionDistributionEntropy() });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/audit-log
 * Return the append-only audit log (paginated).
 *
 * // RTP: HS-053 Claim 1(f)
 *
 * Query: ?limit=50&offset=0
 */
function getAuditLog(req, res) {
    // RTP: HS-053 Claim 1(f)
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    try {
        const log  = telemetry.getAuditLog();
        const page = log.slice(offset, offset + limit);
        res.json({ ok: true, data: {
            entries: page,
            total:   log.length,
            offset,
            limit,
        }});
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/telemetry/publish-poi
 * Compute and return a PoI hash for external publication.
 *
 * // RTP: HS-053 Claim 6 — publish to external content-addressable store
 *
 * Body: { payload: object }
 */
function postPublishPoI(req, res) {
    // RTP: HS-053 Claim 6
    const { payload } = req.body;
    if (!payload) return sendError(res, 400, 'payload required');
    try {
        const hash = computeProofOfInference(payload);
        res.json({ ok: true, data: {
            proofOfInference: hash,
            publishedAt:      new Date().toISOString(),
            note:             'Publish this hash to your content-addressable store for independent verification.',
        }});
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/telemetry/alerts
 * Return recent anomaly alerts.
 *
 * // RTP: HS-053 Claim 5 and Claim 7(e)
 *
 * Query: ?limit=20
 */
function getAlerts(req, res) {
    // RTP: HS-053 Claim 5 and Claim 7(e)
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
    res.json({ ok: true, data: {
        alerts: alertLog.slice(-limit),
        total:  alertLog.length,
    }});
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

function createRouter(router) {
    router.post('/record',            postRecord);
    router.post('/verify',            postVerifyPoI);
    router.get( '/metrics',           getMetrics);
    router.get( '/jitter',            getJitter);
    router.get( '/confidence-drift',  getConfidenceDrift);
    router.get( '/entropy',           getEntropy);
    router.get( '/audit-log',         getAuditLog);
    router.post('/publish-poi',       postPublishPoI);
    router.get( '/alerts',            getAlerts);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    telemetry,
    handlers: {
        postRecord,
        postVerifyPoI,
        getMetrics,
        getJitter,
        getConfidenceDrift,
        getEntropy,
        getAuditLog,
        postPublishPoI,
        getAlerts,
    },
};
