/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * IDE Bridge — HeadyAI-IDE Integration Service
 *
 * Bridges the gap between users and the codebase by accepting
 * code modification proposals and routing them through governance.
 * Integrates with decentralized-governance.js for approval workflow
 * and opentelemetry-tracing.js for audit trails.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ═══════════════════════════════════════════════════════════════
// Proposal State Machine
// ═══════════════════════════════════════════════════════════════

const PROPOSAL_STATES = {
    SUBMITTED: 'submitted',
    VALIDATING: 'validating',
    VALIDATED: 'validated',
    VALIDATION_FAILED: 'validation_failed',
    AUTO_CORRECTING: 'auto_correcting',   // Recursive self-correction loop active
    GOVERNANCE_PENDING: 'governance_pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    APPLIED: 'applied',
    ROLLED_BACK: 'rolled_back',
};

// Auto-correction mutation strategies (God Mode self-correction schema)
const AUTO_CORRECTION_STRATEGIES = [
    'REWRITE_FUNCTION',       // Full function rewrite
    'INJECT_OPTIMIZATION',    // Memory/perf optimization injection
    'BYPASS_LEGACY',          // Skip legacy routing constraints
    'ESCALATE_MODEL',         // Route to more powerful AI model
];

const MAX_CORRECTION_ITERATIONS = 10;

const _proposals = new Map();
const _proposalHistory = [];

// ═══════════════════════════════════════════════════════════════
// Core IDE Bridge Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Submit a code modification proposal.
 * This is the primary entry point for HeadyAI-IDE interactions.
 *
 * @param {Object} proposal
 * @param {string} proposal.intent - Natural language description of the change
 * @param {string} proposal.targetFile - File path relative to repo root
 * @param {string} proposal.proposedDiff - The diff or new content
 * @param {string} proposal.submittedBy - User or agent identifier
 * @param {string} proposal.priority - 'low', 'normal', 'high', 'critical'
 * @returns {Object} Submission result with proposalId
 */
function submitProposal(proposal = {}) {
    const { intent, targetFile, proposedDiff, submittedBy, priority } = proposal;

    if (!intent) return { success: false, error: 'intent is required' };
    if (!targetFile) return { success: false, error: 'targetFile is required' };
    if (!proposedDiff) return { success: false, error: 'proposedDiff is required' };

    const proposalId = `prop_${crypto.randomUUID().slice(0, 12)}`;
    const diffHash = crypto.createHash('sha256').update(proposedDiff).digest('hex');

    const record = {
        proposalId,
        intent,
        targetFile,
        proposedDiff,
        diffHash,
        submittedBy: submittedBy || 'anonymous',
        priority: priority || 'normal',
        state: PROPOSAL_STATES.SUBMITTED,
        submittedAt: new Date().toISOString(),
        validationResult: null,
        governanceResult: null,
        appliedAt: null,
        traceId: null,
    };

    _proposals.set(proposalId, record);
    _proposalHistory.push({ proposalId, action: 'submitted', timestamp: record.submittedAt });

    return {
        success: true,
        proposalId,
        diffHash,
        state: record.state,
        nextStep: 'Call /api/ide/evaluate/{proposalId} to validate and route to governance',
    };
}

/**
 * Evaluate a submitted proposal.
 * Runs validation checks and routes to governance if passing.
 *
 * @param {string} proposalId
 * @returns {Object} Evaluation result
 */
function evaluateProposal(proposalId) {
    const record = _proposals.get(proposalId);
    if (!record) return { success: false, error: `Proposal '${proposalId}' not found` };

    if (record.state !== PROPOSAL_STATES.SUBMITTED) {
        return { success: false, error: `Proposal is in state '${record.state}', expected 'submitted'` };
    }

    record.state = PROPOSAL_STATES.VALIDATING;

    // ── Validation checks ──────────────────────────────────────
    const checks = [];

    // Check 1: File path is within allowed boundaries
    const normalizedPath = path.normalize(record.targetFile);
    const isPathSafe = !normalizedPath.includes('..') &&
        !normalizedPath.startsWith('/') &&
        !normalizedPath.includes('node_modules') &&
        !normalizedPath.includes('.git/');
    checks.push({ name: 'path_safety', passed: isPathSafe, detail: isPathSafe ? 'OK' : 'Path traversal or forbidden directory' });

    // Check 2: Diff is not empty and has reasonable size
    const diffSize = Buffer.byteLength(record.proposedDiff, 'utf8');
    const isSizeOk = diffSize > 0 && diffSize < 500000; // 500KB max
    checks.push({ name: 'diff_size', passed: isSizeOk, detail: `${diffSize} bytes` });

    // Check 3: No obvious credential patterns
    const credentialPatterns = [
        /AKIA[0-9A-Z]{16}/,        // AWS keys
        /-----BEGIN.*KEY-----/,     // Private keys
        /password\s*=\s*['"][^'"]+['"]/i,
    ];
    const hasCredentials = credentialPatterns.some(p => p.test(record.proposedDiff));
    checks.push({ name: 'credential_scan', passed: !hasCredentials, detail: hasCredentials ? 'POTENTIAL CREDENTIALS DETECTED' : 'Clean' });

    // Check 4: No console.log in production code (unless SDK CLI)
    const hasConsoleLog = /console\.log/.test(record.proposedDiff) && !record.targetFile.includes('quickstart');
    checks.push({ name: 'logging_standard', passed: !hasConsoleLog, detail: hasConsoleLog ? 'Use structured-logger instead of console.log' : 'OK' });

    // Aggregate result
    const allPassed = checks.every(c => c.passed);

    record.validationResult = {
        passed: allPassed,
        checks,
        evaluatedAt: new Date().toISOString(),
    };

    if (allPassed) {
        record.state = PROPOSAL_STATES.VALIDATED;

        // Create a governance-compatible proposal
        record.governanceResult = {
            status: 'pending_vote',
            proposalType: 'code-modification',
            targetComponent: record.targetFile,
            diffHash: record.diffHash,
            createdAt: new Date().toISOString(),
        };
        record.state = PROPOSAL_STATES.GOVERNANCE_PENDING;
    } else {
        // Auto-correction: attempt recursive self-correction before final failure
        const correctionResult = _autoCorrect(proposalId, checks.filter(c => !c.passed));
        if (correctionResult.corrected) {
            record.state = PROPOSAL_STATES.VALIDATED;
            record.governanceResult = {
                status: 'pending_vote',
                proposalType: 'code-modification',
                targetComponent: record.targetFile,
                diffHash: record.diffHash,
                createdAt: new Date().toISOString(),
                autoCorrected: true,
                correctionIterations: correctionResult.iterations,
                correctionStrategy: correctionResult.strategy,
            };
            record.state = PROPOSAL_STATES.GOVERNANCE_PENDING;
        } else {
            record.state = PROPOSAL_STATES.VALIDATION_FAILED;
        }
    }

    _proposalHistory.push({
        proposalId,
        action: allPassed ? 'validated' : 'validation_failed',
        timestamp: new Date().toISOString(),
    });

    return {
        success: true,
        proposalId,
        state: record.state,
        validationResult: record.validationResult,
        governanceResult: record.governanceResult,
    };
}

/**
 * Approve a proposal (governance decision).
 */
function approveProposal(proposalId) {
    const record = _proposals.get(proposalId);
    if (!record) return { success: false, error: `Proposal '${proposalId}' not found` };

    if (record.state !== PROPOSAL_STATES.GOVERNANCE_PENDING) {
        return { success: false, error: `Proposal is in state '${record.state}', expected 'governance_pending'` };
    }

    record.state = PROPOSAL_STATES.APPROVED;
    record.governanceResult.status = 'approved';
    record.governanceResult.approvedAt = new Date().toISOString();

    // Generate trace ID for audit trail
    record.traceId = crypto.createHash('sha256')
        .update(`${proposalId}:${record.diffHash}:${Date.now()}`)
        .digest('hex')
        .slice(0, 32);

    _proposalHistory.push({ proposalId, action: 'approved', timestamp: new Date().toISOString() });

    return {
        success: true,
        proposalId,
        state: record.state,
        traceId: record.traceId,
        nextStep: 'Proposal approved. Apply with /api/ide/apply/{proposalId}',
    };
}

/**
 * Reject a proposal.
 */
function rejectProposal(proposalId, reason) {
    const record = _proposals.get(proposalId);
    if (!record) return { success: false, error: `Proposal '${proposalId}' not found` };

    record.state = PROPOSAL_STATES.REJECTED;
    record.governanceResult = record.governanceResult || {};
    record.governanceResult.status = 'rejected';
    record.governanceResult.reason = reason || 'No reason provided';
    record.governanceResult.rejectedAt = new Date().toISOString();

    _proposalHistory.push({ proposalId, action: 'rejected', timestamp: new Date().toISOString() });

    return { success: true, proposalId, state: record.state, reason };
}

/**
 * Apply an approved proposal — writes the diff to the filesystem.
 * Creates a backup of the original file before writing.
 *
 * @param {string} proposalId
 * @returns {Object} Application result with backup path
 */
function applyProposal(proposalId) {
    const record = _proposals.get(proposalId);
    if (!record) return { success: false, error: `Proposal '${proposalId}' not found` };

    if (record.state !== PROPOSAL_STATES.APPROVED) {
        return { success: false, error: `Proposal must be approved first (current: '${record.state}')` };
    }

    const targetPath = path.resolve(PROJECT_ROOT, record.targetFile);

    // Safety: ensure target is within project root
    if (!targetPath.startsWith(PROJECT_ROOT)) {
        return { success: false, error: 'Target file resolves outside project root' };
    }

    let backupPath = null;
    let originalContent = null;

    try {
        // Backup existing file if it exists
        if (fs.existsSync(targetPath)) {
            originalContent = fs.readFileSync(targetPath, 'utf-8');
            backupPath = `${targetPath}.bak.${Date.now()}`;
            fs.writeFileSync(backupPath, originalContent, 'utf-8');
        }

        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Write the proposed content
        fs.writeFileSync(targetPath, record.proposedDiff, 'utf-8');

        record.state = PROPOSAL_STATES.APPLIED;
        record.appliedAt = new Date().toISOString();
        record.backupPath = backupPath;

        _proposalHistory.push({
            proposalId,
            action: 'applied',
            targetFile: record.targetFile,
            backupPath,
            timestamp: record.appliedAt,
        });

        return {
            success: true,
            proposalId,
            state: record.state,
            appliedAt: record.appliedAt,
            targetFile: record.targetFile,
            backupPath,
            traceId: record.traceId,
            bytesWritten: Buffer.byteLength(record.proposedDiff, 'utf-8'),
        };
    } catch (err) {
        // Rollback: restore original if we backed it up
        if (backupPath && originalContent !== null) {
            try { fs.writeFileSync(targetPath, originalContent, 'utf-8'); } catch { /* best effort */ }
        }

        return {
            success: false,
            error: `Failed to apply: ${err.message}`,
            proposalId,
            state: record.state,
        };
    }
}

/**
 * Rollback a previously applied proposal using its backup.
 *
 * @param {string} proposalId
 * @returns {Object} Rollback result
 */
function rollbackProposal(proposalId) {
    const record = _proposals.get(proposalId);
    if (!record) return { success: false, error: `Proposal '${proposalId}' not found` };
    if (record.state !== PROPOSAL_STATES.APPLIED) {
        return { success: false, error: `Proposal is in state '${record.state}', expected 'applied'` };
    }
    if (!record.backupPath) {
        return { success: false, error: 'No backup exists for this proposal (was a new file)' };
    }

    try {
        const targetPath = path.resolve(PROJECT_ROOT, record.targetFile);
        const backup = fs.readFileSync(record.backupPath, 'utf-8');
        fs.writeFileSync(targetPath, backup, 'utf-8');

        record.state = PROPOSAL_STATES.ROLLED_BACK;
        record.rolledBackAt = new Date().toISOString();

        _proposalHistory.push({ proposalId, action: 'rolled_back', timestamp: record.rolledBackAt });

        return { success: true, proposalId, state: record.state, rolledBackAt: record.rolledBackAt };
    } catch (err) {
        return { success: false, error: `Rollback failed: ${err.message}` };
    }
}

/**
 * Get proposal status by ID.
 */
function getProposalStatus(proposalId) {
    const record = _proposals.get(proposalId);
    if (!record) return null;

    return {
        proposalId: record.proposalId,
        intent: record.intent,
        targetFile: record.targetFile,
        diffHash: record.diffHash,
        submittedBy: record.submittedBy,
        priority: record.priority,
        state: record.state,
        submittedAt: record.submittedAt,
        validationResult: record.validationResult,
        governanceResult: record.governanceResult,
        traceId: record.traceId,
        appliedAt: record.appliedAt,
    };
}

/**
 * List all proposals with optional filtering.
 */
function listProposals(options = {}) {
    let proposals = Array.from(_proposals.values());
    if (options.state) proposals = proposals.filter(p => p.state === options.state);
    if (options.submittedBy) proposals = proposals.filter(p => p.submittedBy === options.submittedBy);

    return proposals.map(p => ({
        proposalId: p.proposalId,
        intent: p.intent,
        targetFile: p.targetFile,
        state: p.state,
        priority: p.priority,
        submittedAt: p.submittedAt,
    }));
}

// ═══════════════════════════════════════════════════════════════
// Auto-Correction Loop (God Mode Self-Correction)
// ═══════════════════════════════════════════════════════════════

/**
 * Recursive self-correction loop.
 * When a proposal fails validation, this attempts to fix the issues
 * by selecting mutation strategies and rewriting the diff.
 *
 * @param {string} proposalId
 * @param {Array} failedChecks - Array of failed validation checks
 * @returns {Object} { corrected, iterations, strategy, diffHistory }
 */
function _autoCorrect(proposalId, failedChecks) {
    const record = _proposals.get(proposalId);
    if (!record) return { corrected: false, reason: 'Proposal not found' };

    record.state = PROPOSAL_STATES.AUTO_CORRECTING;
    const correctionLog = record._correctionLog || [];
    record._correctionLog = correctionLog;

    for (let iteration = 1; iteration <= MAX_CORRECTION_ITERATIONS; iteration++) {
        // Select strategy based on the failure type
        const strategy = _selectCorrectionStrategy(failedChecks, iteration);

        correctionLog.push({
            iteration,
            strategy,
            failedChecks: failedChecks.map(c => c.name),
            timestamp: new Date().toISOString(),
        });

        // Apply the mutation strategy to the diff
        const mutatedDiff = _applyMutationStrategy(record.proposedDiff, strategy, failedChecks);

        if (mutatedDiff !== record.proposedDiff) {
            record.proposedDiff = mutatedDiff;
            record.diffHash = crypto.createHash('sha256').update(mutatedDiff).digest('hex');

            // Re-validate the mutated diff
            const recheck = _quickValidate(mutatedDiff, record.targetFile);
            if (recheck.allPassed) {
                _proposalHistory.push({
                    proposalId,
                    action: 'auto_corrected',
                    iterations: iteration,
                    strategy,
                    timestamp: new Date().toISOString(),
                });
                return { corrected: true, iterations: iteration, strategy, diffHistory: correctionLog };
            }
            // Update failed checks for next iteration
            failedChecks = recheck.checks.filter(c => !c.passed);
        }
    }

    _proposalHistory.push({
        proposalId,
        action: 'auto_correction_exhausted',
        iterations: MAX_CORRECTION_ITERATIONS,
        timestamp: new Date().toISOString(),
    });

    return { corrected: false, iterations: MAX_CORRECTION_ITERATIONS, diffHistory: correctionLog };
}

/**
 * Select the best mutation strategy based on the failure type.
 */
function _selectCorrectionStrategy(failedChecks, iteration) {
    const failureTypes = failedChecks.map(c => c.name);

    if (failureTypes.includes('credential_scan')) return 'REWRITE_FUNCTION';
    if (failureTypes.includes('logging_standard')) return 'INJECT_OPTIMIZATION';
    if (failureTypes.includes('path_safety')) return 'BYPASS_LEGACY';
    if (iteration > 5) return 'ESCALATE_MODEL'; // Escalate after 5 failed attempts
    return AUTO_CORRECTION_STRATEGIES[iteration % AUTO_CORRECTION_STRATEGIES.length];
}

/**
 * Apply a mutation strategy to the proposed diff.
 * Returns the mutated diff string.
 */
function _applyMutationStrategy(diff, strategy, failedChecks) {
    let mutated = diff;

    switch (strategy) {
        case 'REWRITE_FUNCTION':
            // Strip credential patterns
            mutated = mutated.replace(/AKIA[0-9A-Z]{16}/g, 'REDACTED_KEY');
            mutated = mutated.replace(/-----BEGIN.*KEY-----[\s\S]*?-----END.*KEY-----/g, '/* KEY_REDACTED */');
            mutated = mutated.replace(/password\s*=\s*['"][^'"]+['"]/gi, 'password = process.env.SECRET');
            break;

        case 'INJECT_OPTIMIZATION':
            // Replace console.log with structured logger
            mutated = mutated.replace(/console\.log\(/g, "logger.info(");
            mutated = mutated.replace(/console\.error\(/g, "logger.error(");
            mutated = mutated.replace(/console\.warn\(/g, "logger.warn(");
            break;

        case 'BYPASS_LEGACY':
            // Normalize path traversals
            mutated = mutated.replace(/\.\.\/\.\.\//g, './');
            break;

        case 'ESCALATE_MODEL':
            // Mark for escalation — in production this would route to a more powerful model
            // For now, apply all previous strategies combined
            mutated = _applyMutationStrategy(mutated, 'REWRITE_FUNCTION', failedChecks);
            mutated = _applyMutationStrategy(mutated, 'INJECT_OPTIMIZATION', failedChecks);
            break;
    }

    return mutated;
}

/**
 * Quick re-validation of a mutated diff.
 */
function _quickValidate(diff, targetFile) {
    const checks = [];
    const normalizedPath = path.normalize(targetFile);

    checks.push({
        name: 'path_safety',
        passed: !normalizedPath.includes('..') && !normalizedPath.startsWith('/') &&
            !normalizedPath.includes('node_modules') && !normalizedPath.includes('.git/'),
    });

    const diffSize = Buffer.byteLength(diff, 'utf8');
    checks.push({ name: 'diff_size', passed: diffSize > 0 && diffSize < 500000 });

    const credentialPatterns = [/AKIA[0-9A-Z]{16}/, /-----BEGIN.*KEY-----/, /password\s*=\s*['"][^'"]+['"]/i];
    checks.push({ name: 'credential_scan', passed: !credentialPatterns.some(p => p.test(diff)) });

    const hasConsoleLog = /console\.log/.test(diff) && !targetFile.includes('quickstart');
    checks.push({ name: 'logging_standard', passed: !hasConsoleLog });

    return { allPassed: checks.every(c => c.passed), checks };
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function ideBridgeRoutes(app) {
    app.post('/api/ide/propose', (req, res) => {
        const result = submitProposal(req.body);
        if (!result.success) return res.status(400).json(result);
        res.status(201).json(result);
    });

    app.post('/api/ide/evaluate/:proposalId', (req, res) => {
        const result = evaluateProposal(req.params.proposalId);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.post('/api/ide/approve/:proposalId', (req, res) => {
        const result = approveProposal(req.params.proposalId);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.post('/api/ide/reject/:proposalId', (req, res) => {
        const { reason } = req.body;
        const result = rejectProposal(req.params.proposalId, reason);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.post('/api/ide/apply/:proposalId', (req, res) => {
        const result = applyProposal(req.params.proposalId);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.post('/api/ide/rollback/:proposalId', (req, res) => {
        const result = rollbackProposal(req.params.proposalId);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.get('/api/ide/status/:proposalId', (req, res) => {
        const status = getProposalStatus(req.params.proposalId);
        if (!status) return res.status(404).json({ error: 'Proposal not found' });
        res.json(status);
    });

    app.get('/api/ide/proposals', (req, res) => {
        const { state, submittedBy } = req.query;
        res.json(listProposals({ state, submittedBy }));
    });

    app.get('/api/ide/history', (_req, res) => {
        res.json(_proposalHistory.slice(-100).reverse());
    });
}

module.exports = {
    submitProposal,
    evaluateProposal,
    approveProposal,
    rejectProposal,
    applyProposal,
    rollbackProposal,
    getProposalStatus,
    listProposals,
    ideBridgeRoutes,
    PROPOSAL_STATES,
    AUTO_CORRECTION_STRATEGIES,
};
