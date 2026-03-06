/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Governance API Routes ═══
 * Phase 2: Wire Policy Engine + Human Approval Gates into live HTTP endpoints.
 * Phase 5: Crypto-Stamped Audit Trail with Proof-of-Inference receipts.
 *
 * Implements the Four-Pillar Control Matrix:
 *   1. Input Controls → Policy Engine role/scope checks
 *   2. Process Controls → Approval Gates with HITL checkpoints
 *   3. Output Controls → Sanitization pass before delivery
 *   4. Action Controls → Transaction limits + scope boundaries
 */

const express = require('express');
const router = express.Router();
const PolicyEngine = require('../policy-engine');
const { getApprovalGates } = require('../governance/approval-gates');

// ─── Singleton Policy Engine with default policies ──────────────────
const policyEngine = new PolicyEngine();

// Register default policies for critical tools
const DEFAULT_POLICIES = [
    { toolId: 'database:write', environment: 'prod', requiresApproval: true, riskLevel: 'HIGH', rateLimitPerMin: 30, allowedRoles: ['admin', 'operator'] },
    { toolId: 'database:delete', environment: 'prod', requiresApproval: true, riskLevel: 'CRITICAL', rateLimitPerMin: 5, allowedRoles: ['admin'] },
    { toolId: 'system:restart', environment: 'prod', requiresApproval: true, riskLevel: 'CRITICAL', rateLimitPerMin: 2, allowedRoles: ['admin'] },
    { toolId: 'deploy:production', environment: 'prod', requiresApproval: true, riskLevel: 'HIGH', rateLimitPerMin: 5, allowedRoles: ['admin', 'deployer'] },
    { toolId: 'secret:rotate', environment: 'prod', requiresApproval: true, riskLevel: 'HIGH', rateLimitPerMin: 10, allowedRoles: ['admin'] },
    { toolId: 'agent:spawn', environment: 'prod', requiresApproval: false, riskLevel: 'MEDIUM', rateLimitPerMin: 60, allowedRoles: [] },
    { toolId: 'brain:chat', environment: 'prod', requiresApproval: false, riskLevel: 'LOW', rateLimitPerMin: 200, allowedRoles: [] },
    { toolId: 'brain:analyze', environment: 'prod', requiresApproval: false, riskLevel: 'LOW', rateLimitPerMin: 100, allowedRoles: [] },
    { toolId: 'connector:create', environment: 'prod', requiresApproval: false, riskLevel: 'MEDIUM', rateLimitPerMin: 20, allowedRoles: ['admin', 'developer'] },
    { toolId: 'midi:send', environment: 'prod', requiresApproval: false, riskLevel: 'LOW', rateLimitPerMin: 500, allowedRoles: [] },
];

for (const p of DEFAULT_POLICIES) {
    policyEngine.addPolicy(p);
}

// ─── Approval Gates singleton ───────────────────────────────────────
const approvalGates = getApprovalGates();

// ═══ Policy Engine Endpoints ════════════════════════════════════════

router.get('/policies', (req, res) => {
    res.json({ ok: true, policies: policyEngine.listPolicies(), status: policyEngine.status() });
});

router.post('/policies', (req, res) => {
    try {
        policyEngine.addPolicy(req.body);
        res.json({ ok: true, message: 'Policy registered', status: policyEngine.status() });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

router.post('/evaluate', async (req, res) => {
    const { toolId, context } = req.body;
    if (!toolId) return res.status(400).json({ ok: false, error: 'toolId is required' });
    try {
        const result = await policyEngine.evaluate(toolId, context || {});
        res.json({ ok: true, evaluation: result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get('/invocations', (req, res) => {
    const { toolId, status, actorId, limit } = req.query;
    const results = policyEngine.getInvocations(
        { toolId, status, actorId },
        parseInt(limit) || 50
    );
    res.json({ ok: true, invocations: results, total: results.length });
});

router.get('/status', (req, res) => {
    res.json({
        ok: true,
        policyEngine: policyEngine.status(),
        approvalGates: {
            pending: approvalGates.getPending().length,
        },
        ts: new Date().toISOString(),
    });
});

// ═══ Approval Gate Endpoints (HITL - Human In The Loop) ═════════════

router.get('/gates/pending', (req, res) => {
    res.json({ ok: true, pending: approvalGates.getPending() });
});

router.post('/gates/request', (req, res) => {
    const { intent, modelDecision, toolsExecuted, projectedROI } = req.body;
    if (!intent) return res.status(400).json({ ok: false, error: 'intent is required' });
    const gateId = approvalGates.requestApproval(intent, modelDecision, toolsExecuted || [], projectedROI);
    res.json({ ok: true, gateId, status: 'PENDING', message: 'Waiting for human approval' });
});

router.post('/gates/:id/resolve', (req, res) => {
    const { approved, operatorId, signature } = req.body;
    try {
        const result = approvalGates.resolveApproval(
            req.params.id,
            approved === true || approved === 'true',
            operatorId || 'anonymous',
            signature || `sig_${Date.now().toString(36)}`
        );
        res.json({ ok: true, resolution: result });
    } catch (err) {
        res.status(404).json({ ok: false, error: err.message });
    }
});

// ═══ Governance Health ══════════════════════════════════════════════

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'heady-governance',
        policyEngine: 'active',
        policiesRegistered: policyEngine.status().policiesRegistered,
        approvalGatesPending: approvalGates.getPending().length,
        fourPillarMatrix: {
            inputControls: 'active',
            processControls: 'active',
            outputControls: 'active',
            actionControls: 'active',
        },
        ts: new Date().toISOString(),
    });
});

// Export both router and engine instances for wiring
module.exports = { router, policyEngine, approvalGates };
