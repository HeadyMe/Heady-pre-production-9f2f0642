/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Projection Governance — Deterministic Receipts — Roadmap Track B
 * ═══════════════════════════════════════════════════════════════
 *
 * Emits deterministic, immutable receipts for every projection
 * action: project, prune, sync, heal. Each receipt is
 * content-hashed and chained to the previous receipt for
 * tamper-evident audit trails.
 *
 * Fulfills:
 *   Track B – Projection Governance Plane:
 *     - Source-of-truth governance
 *     - Projection hygiene rules
 *     - Staleness & transport targets
 *     - Runtime introspection endpoints for state replay/auditing
 */

const crypto = require('crypto');

// ── Receipt Chain ───────────────────────────────────────────────
const _receiptChain = [];
let _lastHash = '0000000000000000';  // Genesis

const GOVERNANCE_RULES = {
    maxStalenessMs: 60000,          // 60s default staleness budget
    transportTargets: ['cloud-run', 'cloudflare-edge', 'huggingface-spaces', 'github-monorepo'],
    requiredScans: ['trufflehog', 'npm-audit', 'codeql-sast'],
    autoHeal: true,
    enforceChain: true,
};

/**
 * Emit a deterministic receipt for a projection action.
 *
 * @param {'projected'|'pruned'|'synced'|'healed'|'validated'|'drifted'} action
 * @param {Object} payload - Action-specific data
 * @returns {Object} The receipt with chain hash
 */
function emitReceipt(action, payload = {}) {
    const receipt = {
        id: crypto.randomUUID(),
        sequence: _receiptChain.length,
        action,
        payload: {
            ...payload,
            // Sanitize — never log secrets
            ...(payload.env && { env: '[REDACTED]' }),
        },
        previousHash: _lastHash,
        timestamp: new Date().toISOString(),
    };

    // Content hash (deterministic)
    receipt.hash = crypto.createHash('sha256')
        .update(JSON.stringify(receipt))
        .digest('hex')
        .slice(0, 16);

    _lastHash = receipt.hash;
    _receiptChain.push(receipt);

    // Bound the chain in memory
    if (_receiptChain.length > 5000) {
        _receiptChain.splice(0, _receiptChain.length - 5000);
    }

    return receipt;
}

/**
 * Validate projection staleness against the governance budget.
 */
function validateStaleness(target, lastSyncTimestamp) {
    const staleMs = Date.now() - new Date(lastSyncTimestamp).getTime();
    const budget = target.stalenessBudgetMs || GOVERNANCE_RULES.maxStalenessMs;
    const withinBudget = staleMs <= budget;

    const receipt = emitReceipt('validated', {
        target: target.type || target,
        staleMs,
        budgetMs: budget,
        withinBudget,
    });

    return { withinBudget, staleMs, budget, receipt };
}

/**
 * Record a projection action with full payload.
 */
function recordProjection(action, targets, metadata = {}) {
    return emitReceipt(action, {
        targets: Array.isArray(targets) ? targets : [targets],
        filesAffected: metadata.filesAffected || 0,
        bytesTransferred: metadata.bytesTransferred || 0,
        durationMs: metadata.durationMs || 0,
        triggeredBy: metadata.triggeredBy || 'system',
    });
}

/**
 * Check chain integrity — verify hash linkage.
 */
function verifyChain() {
    let valid = true;
    let brokenAt = -1;

    for (let i = 1; i < _receiptChain.length; i++) {
        if (_receiptChain[i].previousHash !== _receiptChain[i - 1].hash) {
            valid = false;
            brokenAt = i;
            break;
        }
    }

    return { valid, chainLength: _receiptChain.length, brokenAt };
}

/**
 * Get governance dashboard data.
 */
function getGovernanceDashboard() {
    const last50 = _receiptChain.slice(-50);
    const actionCounts = {};
    last50.forEach(r => {
        actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
    });

    return {
        chainLength: _receiptChain.length,
        chainValid: verifyChain().valid,
        lastReceipt: _receiptChain[_receiptChain.length - 1] || null,
        actionCounts,
        rules: GOVERNANCE_RULES,
    };
}

/**
 * Replay the receipt chain for a specific time range.
 */
function replayChain(sinceTimestamp, untilTimestamp) {
    return _receiptChain.filter(r => {
        const t = new Date(r.timestamp).getTime();
        const since = sinceTimestamp ? new Date(sinceTimestamp).getTime() : 0;
        const until = untilTimestamp ? new Date(untilTimestamp).getTime() : Date.now();
        return t >= since && t <= until;
    });
}

/**
 * Express API routes for projection governance.
 */
function governanceRoutes(app) {
    app.get('/api/governance/dashboard', (req, res) => {
        res.json(getGovernanceDashboard());
    });

    app.get('/api/governance/receipts', (req, res) => {
        const limit = parseInt(req.query.limit || '50', 10);
        const receipts = _receiptChain.slice(-limit);
        res.json({ count: receipts.length, receipts });
    });

    app.get('/api/governance/receipt/:id', (req, res) => {
        const receipt = _receiptChain.find(r => r.id === req.params.id);
        if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
        res.json(receipt);
    });

    app.get('/api/governance/verify-chain', (req, res) => {
        res.json(verifyChain());
    });

    app.post('/api/governance/replay', (req, res) => {
        const { since, until } = req.body;
        const replayed = replayChain(since, until);
        res.json({ count: replayed.length, receipts: replayed });
    });

    app.get('/api/governance/rules', (req, res) => {
        res.json(GOVERNANCE_RULES);
    });

    app.post('/api/governance/validate-staleness', (req, res) => {
        const { target, lastSyncTimestamp } = req.body;
        if (!target || !lastSyncTimestamp) {
            return res.status(400).json({ error: 'target and lastSyncTimestamp required' });
        }
        res.json(validateStaleness(target, lastSyncTimestamp));
    });
}

module.exports = {
    emitReceipt,
    validateStaleness,
    recordProjection,
    verifyChain,
    getGovernanceDashboard,
    replayChain,
    governanceRoutes,
    GOVERNANCE_RULES,
};
