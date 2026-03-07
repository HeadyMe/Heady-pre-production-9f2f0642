/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Vector-Native Security Scanner REST Routes ───────────────────────────────
 *
 * Patent Docket: HS-062
 * Express-style route handlers exposing the Vector-Native Security Scanner.
 *
 * Mount in your Express app:
 *   const secRoutes = require('./src/routes/security-routes');
 *   app.use('/api/security', secRoutes.createRouter(express.Router()));
 *
 * Endpoints:
 *   POST   /api/security/patterns              — Register threat pattern (Claim 1a, 6)
 *   DELETE /api/security/patterns/:label       — Remove threat pattern
 *   GET    /api/security/patterns              — List all patterns
 *   POST   /api/security/scan/vector           — Full vector scan (Claims 1, 2, 3)
 *   POST   /api/security/scan/threat           — Threat pattern only scan (Claim 1b)
 *   POST   /api/security/outlier               — Outlier detection (Claim 1c, 3)
 *   POST   /api/security/zones                 — Register zone centroid
 *   POST   /api/security/access                — Record vector access (Claim 1d)
 *   POST   /api/security/baseline/zones        — Capture zone membership baseline (Claim 2)
 *   POST   /api/security/baseline/densities    — Capture density baseline (Claim 4)
 *   POST   /api/security/scan/membership       — Poisoning scan (Claim 2)
 *   POST   /api/security/scan/densities        — Sprawl scan (Claim 4)
 *   POST   /api/security/pre-deploy            — Pre-deploy gate (Claim 5)
 *   GET    /api/security/scan-history          — Scan history
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
    ThreatPatternRegistry,
    OutlierDetector,
    InjectionDetector,
    PoisoningDetector,
    AntiSprawlEngine,
    PreDeployGate,
    VectorNativeSecuritySystem,
} = require('../security/vector-native-scanner');

// Singleton system instance
const securitySystem = new VectorNativeSecuritySystem();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
}

function isVector(v) {
    return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number' && isFinite(x));
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/security/patterns
 * Register a new threat pattern embedding vector.
 *
 * // RTP: HS-062 Claim 1(a) and Claim 6
 *
 * Body: { label: string, embedding: number[] }
 */
function postRegisterPattern(req, res) {
    // RTP: HS-062 Claim 1(a) and Claim 6
    const { label, embedding } = req.body;
    if (!label || typeof label !== 'string') return sendError(res, 400, 'label required');
    if (!isVector(embedding))                return sendError(res, 400, 'embedding must be a non-empty numeric array');
    try {
        const record = securitySystem.threatRegistry.registerPattern(label, embedding);
        res.status(201).json({ ok: true, data: record });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * DELETE /api/security/patterns/:label
 * Remove a threat pattern.
 */
function deletePattern(req, res) {
    const { label } = req.params;
    securitySystem.threatRegistry.removePattern(decodeURIComponent(label));
    res.json({ ok: true, data: { removed: label } });
}

/**
 * GET /api/security/patterns
 * List all registered threat patterns.
 *
 * // RTP: HS-062 Claim 1(a)
 */
function listPatterns(req, res) {
    // RTP: HS-062 Claim 1(a)
    const patterns = securitySystem.threatRegistry.listPatterns();
    res.json({ ok: true, data: { patterns, count: patterns.length } });
}

/**
 * POST /api/security/scan/vector
 * Run full geometric security scan on an incoming vector.
 *
 * // RTP: HS-062 Claim 1 (all parts), Claim 2, Claim 3
 *
 * Body: { vectorId: string, embedding: number[], zone?: string }
 */
function postScanVector(req, res) {
    // RTP: HS-062 Claim 1, 2, 3
    const { vectorId, embedding, zone = 'default' } = req.body;
    if (!vectorId)            return sendError(res, 400, 'vectorId required');
    if (!isVector(embedding)) return sendError(res, 400, 'embedding must be a non-empty numeric array');
    try {
        const result = securitySystem.scanVector(vectorId, embedding, zone);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/scan/threat
 * Scan vector against threat registry only.
 *
 * // RTP: HS-062 Claim 1(b)
 *
 * Body: { embedding: number[], threshold?: number }
 */
function postScanThreat(req, res) {
    // RTP: HS-062 Claim 1(b)
    const { embedding, threshold = 0.85 } = req.body;
    if (!isVector(embedding)) return sendError(res, 400, 'embedding required');
    try {
        const result = securitySystem.threatRegistry.scan(embedding, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/zones
 * Register a zone centroid for outlier detection.
 *
 * // RTP: HS-062 Claim 1(c) and Claim 3
 *
 * Body: { zoneName: string, centroid: number[] }
 */
function postRegisterZone(req, res) {
    // RTP: HS-062 Claim 1(c) and Claim 3
    const { zoneName, centroid } = req.body;
    if (!zoneName)            return sendError(res, 400, 'zoneName required');
    if (!isVector(centroid))  return sendError(res, 400, 'centroid must be a non-empty numeric array');
    securitySystem.outlierDetector.registerZone(zoneName, centroid);
    res.json({ ok: true, data: { zoneName, registered: true, totalZones: securitySystem.outlierDetector.zoneCount } });
}

/**
 * POST /api/security/outlier
 * Check if a vector is geometrically isolated (potential injection).
 *
 * // RTP: HS-062 Claim 1(c) and Claim 3
 *
 * Body: { embedding: number[] }
 */
function postOutlierScan(req, res) {
    // RTP: HS-062 Claim 1(c) and Claim 3
    const { embedding } = req.body;
    if (!isVector(embedding)) return sendError(res, 400, 'embedding required');
    try {
        const result = securitySystem.outlierDetector.scan(embedding);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/access
 * Record a vector access event for injection frequency tracking.
 *
 * // RTP: HS-062 Claim 1(d)
 *
 * Body: { vectorId: string, embedding?: number[] }
 */
function postRecordAccess(req, res) {
    // RTP: HS-062 Claim 1(d)
    const { vectorId, embedding } = req.body;
    if (!vectorId) return sendError(res, 400, 'vectorId required');
    securitySystem.injectionDetector.recordAccess(vectorId, embedding || null);
    res.json({ ok: true, data: { vectorId, recorded: true } });
}

/**
 * POST /api/security/baseline/zones
 * Capture zone membership baseline for poisoning detection.
 *
 * // RTP: HS-062 Claim 2
 *
 * Body: { memberships: Array<{ id: string, zone: string }> }
 */
function postCaptureZoneBaseline(req, res) {
    // RTP: HS-062 Claim 2
    const { memberships } = req.body;
    if (!Array.isArray(memberships)) return sendError(res, 400, 'memberships must be an array');
    securitySystem.poisoningDetector.captureBaseline(memberships);
    res.json({ ok: true, data: { captured: true, count: memberships.length } });
}

/**
 * POST /api/security/scan/membership
 * Scan current zone memberships against baseline for poisoning.
 *
 * // RTP: HS-062 Claim 2
 *
 * Body: { memberships: Array<{ id: string, zone: string }> }
 */
function postPoisoningScan(req, res) {
    // RTP: HS-062 Claim 2
    const { memberships } = req.body;
    if (!Array.isArray(memberships)) return sendError(res, 400, 'memberships must be an array');
    try {
        const result = securitySystem.poisoningDetector.scan(memberships);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/baseline/densities
 * Capture zone density baseline for anti-sprawl.
 *
 * // RTP: HS-062 Claim 4
 *
 * Body: { densities: { [zoneName: string]: number } }
 */
function postCaptureDensityBaseline(req, res) {
    // RTP: HS-062 Claim 4
    const { densities } = req.body;
    if (!densities || typeof densities !== 'object') return sendError(res, 400, 'densities object required');
    securitySystem.antiSprawlEngine.captureBaseline(densities);
    res.json({ ok: true, data: { captured: true, zones: Object.keys(densities).length } });
}

/**
 * POST /api/security/scan/densities
 * Check current zone densities against baseline for sprawl.
 *
 * // RTP: HS-062 Claim 4
 *
 * Body: { densities: { [zoneName: string]: number } }
 */
function postSprawlScan(req, res) {
    // RTP: HS-062 Claim 4
    const { densities } = req.body;
    if (!densities || typeof densities !== 'object') return sendError(res, 400, 'densities object required');
    try {
        const result = securitySystem.antiSprawlEngine.scan(densities);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/pre-deploy
 * Execute the pre-deployment security gate.
 *
 * // RTP: HS-062 Claim 5
 *
 * Body: {
 *   zoneDensities?: object,
 *   recentVectors?: Array<{ id, embedding, zone }>,
 *   currentMemberships?: Array<{ id, zone }>,
 *   memoryHealth?: object
 * }
 */
function postPreDeploy(req, res) {
    // RTP: HS-062 Claim 5
    try {
        const result = securitySystem.preDeployGate.run(req.body || {});
        const statusCode = result.allowed ? 200 : 422;
        res.status(statusCode).json({ ok: result.allowed, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/security/scan-history
 * Return scan history.
 */
function getScanHistory(req, res) {
    const limit  = parseInt(req.query.limit,  10) || 50;
    const history = securitySystem.getScanHistory();
    res.json({ ok: true, data: {
        entries: history.slice(-limit),
        total:   history.length,
    }});
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

function createRouter(router) {
    router.post(  '/patterns',              postRegisterPattern);
    router.delete('/patterns/:label',       deletePattern);
    router.get(   '/patterns',              listPatterns);
    router.post(  '/zones',                 postRegisterZone);
    router.post(  '/access',                postRecordAccess);
    router.post(  '/scan/vector',           postScanVector);
    router.post(  '/scan/threat',           postScanThreat);
    router.post(  '/outlier',               postOutlierScan);
    router.post(  '/baseline/zones',        postCaptureZoneBaseline);
    router.post(  '/baseline/densities',    postCaptureDensityBaseline);
    router.post(  '/scan/membership',       postPoisoningScan);
    router.post(  '/scan/densities',        postSprawlScan);
    router.post(  '/pre-deploy',            postPreDeploy);
    router.get(   '/scan-history',          getScanHistory);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    securitySystem,
    handlers: {
        postRegisterPattern,
        deletePattern,
        listPatterns,
        postRegisterZone,
        postRecordAccess,
        postScanVector,
        postScanThreat,
        postOutlierScan,
        postCaptureZoneBaseline,
        postCaptureDensityBaseline,
        postPoisoningScan,
        postSprawlScan,
        postPreDeploy,
        getScanHistory,
    },
};
