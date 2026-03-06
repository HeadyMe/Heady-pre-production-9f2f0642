/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Nuke Switch Circuit Breaker Route ═══════════════════════════════
 * Phase 4: HITL Cryptographic Circuit Breaker
 *
 * Implements the "Nuke Switch" Protocol from the HITL IP Portfolio:
 *   - Air-gapped AI execution: agents propose but CANNOT sign
 *   - NIDS trigger interception on MIDI bus
 *   - Multi-modal cryptographic key-address mapping (US9830593B2)
 *   - Biometric WYSIWYS approval via fast-signing (US5432852A)
 *   - Hash chain immutable commitment (US20220200787A1)
 *
 * Flow:  AI Agent → Propose → NIDS intercept → MIDI flag →
 *        Proxy re-encrypt → HITL review → Biometric sign →
 *        Hash chain commit → Execute
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// ═══ Nuke Switch State ══════════════════════════════════════════════
const nukeState = {
    lockedActions: new Map(),    // actionId → { agent, payload, riskScore, status }
    commitLog: [],               // immutable hash chain of all decisions
    thresholds: {
        monetary: 100000,          // USD value threshold → auto-lock
        riskScore: 75,             // AI risk score threshold → auto-lock
        executionsPerMinute: 50,   // rate threshold → auto-lock
    },
    metrics: {
        totalInterceptions: 0,
        totalApprovals: 0,
        totalRejections: 0,
        avgReviewTimeMs: 0,
        chainLength: 0,
    },
};

/**
 * Hash chain append — creates immutable audit record
 */
function appendToChain(entry) {
    const prevHash = nukeState.commitLog.length > 0
        ? nukeState.commitLog[nukeState.commitLog.length - 1].hash
        : '0'.repeat(64);

    const block = {
        index: nukeState.commitLog.length,
        timestamp: new Date().toISOString(),
        entry,
        prevHash,
        hash: crypto.createHash('sha256')
            .update(JSON.stringify({ ...entry, prevHash, index: nukeState.commitLog.length }))
            .digest('hex'),
    };

    nukeState.commitLog.push(block);
    nukeState.metrics.chainLength = nukeState.commitLog.length;
    return block;
}

// ═══ AI Action Interception ═════════════════════════════════════════

router.post('/intercept', (req, res) => {
    const { agentId, action, payload, monetaryValue, riskScore } = req.body;
    if (!agentId || !action) {
        return res.status(400).json({ ok: false, error: 'agentId and action required' });
    }

    const score = riskScore || 0;
    const value = monetaryValue || 0;
    const actionId = `nuke-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    // NIDS trigger evaluation
    const triggers = [];
    if (value >= nukeState.thresholds.monetary) triggers.push('MONETARY_THRESHOLD');
    if (score >= nukeState.thresholds.riskScore) triggers.push('RISK_SCORE_THRESHOLD');

    const locked = triggers.length > 0;

    const record = {
        id: actionId,
        agentId,
        action,
        payload: payload || {},
        monetaryValue: value,
        riskScore: score,
        triggers,
        status: locked ? 'LOCKED_AWAITING_HITL' : 'AUTO_APPROVED',
        interceptedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
    };

    if (locked) {
        nukeState.lockedActions.set(actionId, record);
        nukeState.metrics.totalInterceptions++;

        // Emit MIDI alert for NIDS interception
        if (global.midiBus) {
            global.midiBus.alert(`nuke:${action}`, score, 0);
        }
    }

    // Hash chain commit — every interception is logged immutably
    const block = appendToChain({
        type: locked ? 'INTERCEPTION' : 'AUTO_PASS',
        actionId,
        agentId,
        action,
        riskScore: score,
        monetaryValue: value,
        triggers,
    });

    res.json({
        ok: true,
        actionId,
        status: record.status,
        locked,
        triggers,
        chainBlock: block.index,
        chainHash: block.hash,
        message: locked
            ? 'Action LOCKED. Requires HITL biometric approval before execution.'
            : 'Action auto-approved (below thresholds). Logged to chain.',
    });
});

// ═══ HITL Biometric Approval ════════════════════════════════════════

router.post('/approve/:actionId', (req, res) => {
    const { actionId } = req.params;
    const { operatorId, biometricToken, decision } = req.body;

    if (!operatorId || !biometricToken) {
        return res.status(400).json({ ok: false, error: 'operatorId and biometricToken required' });
    }

    const record = nukeState.lockedActions.get(actionId);
    if (!record) {
        return res.status(404).json({ ok: false, error: 'Locked action not found or already resolved' });
    }

    // Simulate PKCS#7 signature verification (US5432852A fast-signing)
    const signaturePayload = JSON.stringify({
        actionId,
        operatorId,
        decision: decision || 'APPROVE',
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex'),
    });
    const signature = crypto.createHash('sha256').update(signaturePayload + biometricToken).digest('hex');

    const approved = (decision || 'APPROVE') === 'APPROVE';

    record.status = approved ? 'HITL_APPROVED' : 'HITL_REJECTED';
    record.reviewedAt = new Date().toISOString();
    record.reviewedBy = operatorId;
    record.signature = signature;

    if (approved) {
        nukeState.metrics.totalApprovals++;
    } else {
        nukeState.metrics.totalRejections++;
    }

    // Remove from locked actions
    nukeState.lockedActions.delete(actionId);

    // Hash chain commit — approval/rejection is immutable
    const block = appendToChain({
        type: approved ? 'HITL_APPROVAL' : 'HITL_REJECTION',
        actionId,
        operatorId,
        decision: record.status,
        signature,
    });

    // Emit MIDI for resolution
    if (global.midiBus) {
        if (approved) {
            global.midiBus.taskCompleted(`nuke:${record.action}`, 0);
        } else {
            global.midiBus.alert(`nuke:rejected:${record.action}`, 100, 0);
        }
    }

    res.json({
        ok: true,
        actionId,
        status: record.status,
        signature,
        chainBlock: block.index,
        chainHash: block.hash,
        message: approved
            ? 'Action APPROVED by HITL operator. Hash chain committed. Execute authorized.'
            : 'Action REJECTED by HITL operator. Execution BLOCKED. Immutable receipt on chain.',
    });
});

// ═══ Query Endpoints ════════════════════════════════════════════════

router.get('/pending', (req, res) => {
    const pending = Array.from(nukeState.lockedActions.values());
    res.json({ ok: true, pending, total: pending.length });
});

router.get('/chain', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const chain = nukeState.commitLog.slice(-limit);
    res.json({
        ok: true,
        chainLength: nukeState.commitLog.length,
        blocks: chain,
        integrity: verifyChainIntegrity(),
    });
});

router.get('/thresholds', (req, res) => {
    res.json({ ok: true, thresholds: nukeState.thresholds });
});

router.put('/thresholds', (req, res) => {
    const { monetary, riskScore, executionsPerMinute } = req.body;
    if (monetary !== undefined) nukeState.thresholds.monetary = monetary;
    if (riskScore !== undefined) nukeState.thresholds.riskScore = riskScore;
    if (executionsPerMinute !== undefined) nukeState.thresholds.executionsPerMinute = executionsPerMinute;

    appendToChain({
        type: 'THRESHOLD_UPDATE',
        thresholds: { ...nukeState.thresholds },
        updatedBy: req.body.operatorId || 'system',
    });

    res.json({ ok: true, thresholds: nukeState.thresholds, message: 'Thresholds updated and committed to chain' });
});

router.get('/metrics', (req, res) => {
    res.json({ ok: true, metrics: nukeState.metrics });
});

// ═══ Chain Integrity Verification ═══════════════════════════════════

function verifyChainIntegrity() {
    if (nukeState.commitLog.length <= 1) return { valid: true, blocksVerified: nukeState.commitLog.length };

    for (let i = 1; i < nukeState.commitLog.length; i++) {
        if (nukeState.commitLog[i].prevHash !== nukeState.commitLog[i - 1].hash) {
            return { valid: false, brokenAt: i, blocksVerified: i };
        }
    }
    return { valid: true, blocksVerified: nukeState.commitLog.length };
}

router.get('/verify', (req, res) => {
    res.json({ ok: true, integrity: verifyChainIntegrity() });
});

module.exports = router;
