/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Attestation Mesh REST Routes ─────────────────────────────────────────────
 *
 * Patent Docket: HS-059
 * Express-style route handlers exposing the Self-Healing Attestation Mesh.
 *
 * Mount in your Express app:
 *   const meshRoutes = require('./src/routes/mesh-routes');
 *   app.use('/api/mesh', meshRoutes.createRouter(express.Router()));
 *
 * Endpoints:
 *   POST   /api/mesh/agents               — Register agent
 *   DELETE /api/mesh/agents/:agentId      — Remove agent (deregister)
 *   POST   /api/mesh/attest               — Submit attestation
 *   GET    /api/mesh/status               — Mesh health status
 *   GET    /api/mesh/consensus            — Current consensus vector
 *   GET    /api/mesh/agents/:agentId/suspects — Suspect outputs for agent
 *   POST   /api/mesh/align                — Measure vector alignment
 *   GET    /api/mesh/audit-log            — Full audit log
 *   POST   /api/mesh/heartbeat/:agentId/start — Start heartbeat
 *   POST   /api/mesh/heartbeat/:agentId/stop  — Stop heartbeat
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { AttestationMesh, computeHeartbeatInterval } = require('../mesh/self-healing-attestation-mesh');

// Singleton mesh instance shared across all requests
const mesh = new AttestationMesh();

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
 * POST /api/mesh/agents
 * Register an agent with the mesh.
 *
 * // RTP: HS-059 Claim 7(a)
 *
 * Body: { agentId: string, version?: string, meta?: object }
 */
function postRegisterAgent(req, res) {
    // RTP: HS-059 Claim 7(a)
    const { agentId, version = '1.0.0', meta = {} } = req.body;
    if (!agentId || typeof agentId !== 'string')
        return sendError(res, 400, 'agentId is required and must be a string');
    try {
        const agent = mesh.registerAgent(agentId, version, meta);
        res.status(201).json({ ok: true, data: {
            agentId: agent.agentId,
            version: agent.version,
            heartbeatIntervalMs: agent.heartbeatInterval,
        }});
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/mesh/attest
 * Submit an attestation from an agent.
 *
 * // RTP: HS-059 Claim 1, 2, 3, 4, 6
 *
 * Body: {
 *   agentId: string,
 *   version?: string,
 *   embedding: number[],
 *   confidence: number,
 *   responseText?: string
 * }
 */
function postAttest(req, res) {
    // RTP: HS-059 Claims 1, 2, 3, 4, 6
    const {
        agentId,
        version      = '1.0.0',
        embedding,
        confidence,
        responseText = '',
    } = req.body;

    if (!agentId)             return sendError(res, 400, 'agentId required');
    if (!isVector(embedding)) return sendError(res, 400, 'embedding must be a non-empty numeric array');
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1)
        return sendError(res, 400, 'confidence must be a number in [0, 1]');

    try {
        const result = mesh.submitAttestation(agentId, version, embedding, confidence, responseText);
        res.json({ ok: true, data: {
            agentId:         result.agentId,
            flagged:         result.flagged,
            quarantined:     result.quarantined,
            resonanceResult: result.resonanceResult,
            hash:            result.attestation.hash,
            timestamp:       result.attestation.timestamp,
        }});
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/mesh/status
 * Return full mesh health status.
 *
 * // RTP: HS-059 Claim 7
 */
function getMeshStatus(req, res) {
    // RTP: HS-059 Claim 7
    try {
        res.json({ ok: true, data: mesh.getMeshStatus() });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/mesh/consensus
 * Return the current consensus vector.
 *
 * // RTP: HS-059 Claim 6
 */
function getConsensus(req, res) {
    // RTP: HS-059 Claim 6
    const cv = mesh.getConsensusVector();
    res.json({ ok: true, data: { consensusVector: cv, active: cv !== null } });
}

/**
 * GET /api/mesh/agents/:agentId/suspects
 * Return suspect outputs for a specific agent.
 *
 * // RTP: HS-059 Claim 4
 */
function getAgentSuspects(req, res) {
    // RTP: HS-059 Claim 4
    const { agentId } = req.params;
    const suspects = mesh.getSuspectOutputs(agentId);
    res.json({ ok: true, data: { agentId, suspects, count: suspects.length } });
}

/**
 * POST /api/mesh/align
 * Measure geometric alignment of a vector against mesh consensus.
 *
 * // RTP: HS-059 Claim 2
 *
 * Body: { vector: number[], threshold?: number }
 */
function postMeasureAlignment(req, res) {
    // RTP: HS-059 Claim 2
    const { vector, threshold } = req.body;
    if (!isVector(vector)) return sendError(res, 400, 'vector must be a non-empty numeric array');
    try {
        const result = mesh.measureAlignment(vector, threshold);
        if (!result) {
            return res.json({ ok: true, data: { aligned: null, reason: 'no_consensus' } });
        }
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/mesh/audit-log
 * Return the full attestation audit log.
 *
 * // RTP: HS-059 Claim 1 (implicit — all attestations recorded)
 */
function getAuditLog(req, res) {
    const limit  = parseInt(req.query.limit,  10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    const log    = mesh.getAuditLog();
    const page   = log.slice(offset, offset + limit);
    res.json({ ok: true, data: {
        entries: page,
        total:   log.length,
        offset,
        limit,
    }});
}

/**
 * POST /api/mesh/heartbeat/:agentId/start
 * Start phi-based heartbeat for an agent.
 *
 * // RTP: HS-059 Claim 5
 */
function postStartHeartbeat(req, res) {
    // RTP: HS-059 Claim 5
    const { agentId } = req.params;
    try {
        const intervalMs = mesh.startHeartbeat(agentId, () => {});
        res.json({ ok: true, data: { agentId, intervalMs } });
    } catch (err) {
        sendError(res, 400, err.message);
    }
}

/**
 * POST /api/mesh/heartbeat/:agentId/stop
 * Stop heartbeat for an agent.
 *
 * // RTP: HS-059 Claim 5
 */
function postStopHeartbeat(req, res) {
    // RTP: HS-059 Claim 5
    const { agentId } = req.params;
    mesh.stopHeartbeat(agentId);
    res.json({ ok: true, data: { agentId, stopped: true } });
}

/**
 * GET /api/mesh/heartbeat-interval
 * Compute phi-based heartbeat interval.
 *
 * // RTP: HS-059 Claim 5
 *
 * Query: ?baseMs=5000
 */
function getHeartbeatInterval(req, res) {
    // RTP: HS-059 Claim 5
    const baseMs = parseInt(req.query.baseMs, 10) || 5000;
    const interval = computeHeartbeatInterval(baseMs);
    res.json({ ok: true, data: { baseMs, intervalMs: interval, phi: 1.6180339887 } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all mesh routes on an Express Router.
 * @param {object} router — Express Router instance
 * @returns {object}
 */
function createRouter(router) {
    router.post(  '/agents',                        postRegisterAgent);
    router.post(  '/attest',                        postAttest);
    router.get(   '/status',                        getMeshStatus);
    router.get(   '/consensus',                     getConsensus);
    router.get(   '/agents/:agentId/suspects',      getAgentSuspects);
    router.post(  '/align',                         postMeasureAlignment);
    router.get(   '/audit-log',                     getAuditLog);
    router.post(  '/heartbeat/:agentId/start',      postStartHeartbeat);
    router.post(  '/heartbeat/:agentId/stop',       postStopHeartbeat);
    router.get(   '/heartbeat-interval',            getHeartbeatInterval);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    mesh,  // expose shared instance for testing
    handlers: {
        postRegisterAgent,
        postAttest,
        getMeshStatus,
        getConsensus,
        getAgentSuspects,
        postMeasureAlignment,
        getAuditLog,
        postStartHeartbeat,
        postStopHeartbeat,
        getHeartbeatInterval,
    },
};
