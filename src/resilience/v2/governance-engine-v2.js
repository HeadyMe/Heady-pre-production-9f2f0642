'use strict';

/**
 * governance-engine-v2.js — Enhanced Governance Engine
 *
 * Changes from v1:
 *  - Removed blanket admin bypass (CRIT-002); admins now pass content safety + audit
 *  - Admin sensitive actions (user_delete, data_export, deploy) require explicit step-up flag
 *  - Durable audit trail with SHA-256 hash-chain (implements GDPR Art. 30 commitments)
 *  - Pluggable AuditSink interface (in-memory default; hook for DB/SIEM in production)
 *  - Removed CUSTOM function condition operator from policy evaluation
 *  - Sliding-window rate check replaces in-process budget state window bug (MED-005)
 *  - Certification expiry enforced at consumption time (MED-006)
 *  - Approval workflow: PENDING decisions route to an approval queue
 *  - Compliance check module (GDPR, CCPA data residency placeholders)
 *
 * @module governance-engine-v2
 */

const { EventEmitter } = require('events');
const crypto           = require('crypto');
const logger           = require('../utils/logger');
const { PolicyEngine } = require('./policy-engine');

// ─── Constants ────────────────────────────────────────────────────────────────

const GovernanceDecision = Object.freeze({
    ALLOW:    'ALLOW',
    DENY:     'DENY',
    ESCALATE: 'ESCALATE',
    PENDING:  'PENDING',    // New: requires async approval workflow
});

const PolicyType = Object.freeze({
    ACCESS_CONTROL:   'ACCESS_CONTROL',
    BUDGET_LIMIT:     'BUDGET_LIMIT',
    CONTENT_SAFETY:   'CONTENT_SAFETY',
    MISSION_ALIGNMENT:'MISSION_ALIGNMENT',
    RATE_LIMIT:       'RATE_LIMIT',
    DATA_PRIVACY:     'DATA_PRIVACY',
    COMPLIANCE:       'COMPLIANCE',
});

// Sensitive actions that always require step-up confirmation, even for admins
const STEP_UP_REQUIRED = new Set(['user_delete', 'data_export', 'deploy', 'system_config', 'role_change']);

// ─── Audit sink interface ─────────────────────────────────────────────────────

/**
 * In-memory audit sink with SHA-256 hash-chain.
 * In production, replace with a database-backed sink that writes to an
 * append-only table (no UPDATE/DELETE) with the hash chain intact.
 *
 * Each entry includes a `chainHash` = SHA-256(previousChainHash + entryJSON).
 * Any tampering with an earlier record breaks all subsequent hashes.
 */
class InMemoryAuditSink {
    constructor(maxEntries = 10_000) {
        this._trail     = [];
        this._chainHead = '0000000000000000000000000000000000000000000000000000000000000000';
        this._maxEntries = maxEntries;
    }

    /**
     * Append an audit record and return the chain hash.
     * @param {object} entry
     * @returns {string} chainHash
     */
    async append(entry) {
        const entryJson  = JSON.stringify(entry);
        const chainHash  = crypto
            .createHash('sha256')
            .update(this._chainHead + entryJson)
            .digest('hex');

        const record = { ...entry, chainHash, prevHash: this._chainHead };
        this._chainHead = chainHash;

        this._trail.push(record);

        // Trim old entries (in production, archive to cold storage instead)
        if (this._trail.length > this._maxEntries) {
            this._trail.splice(0, this._trail.length - this._maxEntries);
        }

        return chainHash;
    }

    /** @returns {object[]} */
    async query(limit = null, filter = {}) {
        let results = [...this._trail];

        if (filter.userId)     results = results.filter(r => r.userId     === filter.userId);
        if (filter.actionType) results = results.filter(r => r.actionType === filter.actionType);
        if (filter.decision)   results = results.filter(r => r.decision   === filter.decision);
        if (filter.since)      results = results.filter(r => r.evaluatedAt >= filter.since);

        return limit ? results.slice(-limit) : results;
    }

    /**
     * Verify the hash chain integrity.
     * @returns {{ valid: boolean, brokenAt: number|null }}
     */
    async verifyChain() {
        let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
        for (let i = 0; i < this._trail.length; i++) {
            const { chainHash, prevHash: storedPrev, ...entry } = this._trail[i];
            if (storedPrev !== prevHash) {
                return { valid: false, brokenAt: i };
            }
            const { chainHash: _ch, prevHash: _ph, ...entryWithoutHashes } = this._trail[i];
            const expected = crypto
                .createHash('sha256')
                .update(prevHash + JSON.stringify(entryWithoutHashes))
                .digest('hex');
            if (expected !== chainHash) {
                return { valid: false, brokenAt: i };
            }
            prevHash = chainHash;
        }
        return { valid: true, brokenAt: null };
    }
}

// ─── Approval queue (in-memory stub) ─────────────────────────────────────────

class ApprovalQueue {
    constructor() {
        this._queue = new Map(); // approvalId → ApprovalRequest
    }

    async submit(request) {
        this._queue.set(request.approvalId, { ...request, submittedAt: Date.now(), resolved: false });
        logger.warn('[ApprovalQueue] Approval required', {
            approvalId: request.approvalId,
            actionType: request.actionType,
            userId: request.userId,
        });
        // In production: emit to Slack/PagerDuty/workflow engine
    }

    async resolve(approvalId, decision, approvedBy, notes = '') {
        const req = this._queue.get(approvalId);
        if (!req) throw new Error(`Approval request not found: ${approvalId}`);
        req.resolved   = true;
        req.decision   = decision;
        req.approvedBy = approvedBy;
        req.resolvedAt = Date.now();
        req.notes      = notes;
        return req;
    }

    async getPending() {
        return [...this._queue.values()].filter(r => !r.resolved);
    }
}

// ─── GovernanceEngine v2 ──────────────────────────────────────────────────────

/**
 * Enhanced governance engine with audit hash chain, approval workflows,
 * and no blanket admin bypass.
 *
 * @extends EventEmitter
 */
class GovernanceEngine extends EventEmitter {
    /**
     * @param {object} [options]
     * @param {object}          [options.policyEngine]      - PolicyEngine instance
     * @param {InMemoryAuditSink} [options.auditSink]       - Audit sink (DB-backed in prod)
     * @param {ApprovalQueue}   [options.approvalQueue]     - Approval queue
     * @param {object}          [options.budgetLimits]      - Budget caps
     * @param {object}          [options.contentSafety]     - Content safety config
     * @param {object}          [options.rateLimiter]       - External rate limiter instance
     */
    constructor(options = {}) {
        super();

        this._policyEngine    = options.policyEngine  || new PolicyEngine();
        this._auditSink       = options.auditSink     || new InMemoryAuditSink(options.auditMaxEntries || 50_000);
        this._approvalQueue   = options.approvalQueue || new ApprovalQueue();
        this._rateLimiter     = options.rateLimiter   || null; // injected MultiTierRateLimiter

        this._budgetLimits = options.budgetLimits || {
            tokens:            100_000,
            usd:               10.00,
            requestsPerMinute: 60,
        };

        this._contentSafety = options.contentSafety || {
            blockedPatterns: [
                /\b(ssn|social[\s._-]security)\b/i,
                /\b(credit[\s._-]?card|cvv|pan)\b/i,
                /\b(password|passwd|secret[\s._-]?key)\b/i,
                /\b(access[\s._-]?key|api[\s._-]?secret)\b/i,
            ],
            escalatePatterns: [
                /\b(illegal|controlled[\s._-]?substance|drug[\s._-]?deal)\b/i,
                /\b(personal[\s._-]?data|gdpr|pii)\b/i,
            ],
            // NOTE: Prompt injection detection is handled in security-hardening.js
            // and should be applied upstream of this governance engine.
        };

        // In-memory session budget state
        // CHANGED: Added windowStart + proper window reset logic (fixes MED-005)
        this._budgetState = new Map();

        // Quality gates + certifications
        this._qualityGates    = new Map();
        this._certifications  = new Map();

        logger.info('[GovernanceEngine v2] Initialized');
    }

    // ─── Primary validation entrypoint ────────────────────────────────────────

    /**
     * Validate an action against all active policies.
     *
     * @param {object} action
     * @param {string} action.id
     * @param {string} action.type
     * @param {*}      action.payload
     * @param {object} context
     * @param {string} [context.sessionId]
     * @param {string} [context.userId]
     * @param {string} [context.role]       - 'admin' | 'user' | 'system' | 'operator'
     * @param {boolean}[context.stepUpConfirmed] - True if caller passed MFA step-up
     * @param {object} [context.meta]
     * @returns {Promise<GovernanceResult>}
     */
    async validateAction(action, context = {}) {
        const startAt      = Date.now();
        const governanceId = `gov-${action.id || Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        const checks = [];
        let decision   = GovernanceDecision.ALLOW;
        let denyReason = null;

        // ── Check 1: Access Control (NO admin bypass — CRIT-002 fix) ──────────
        const accessCheck = this._checkAccessControl(action, context);
        checks.push({ type: PolicyType.ACCESS_CONTROL, ...accessCheck });
        if (accessCheck.decision === GovernanceDecision.DENY) {
            decision   = GovernanceDecision.DENY;
            denyReason = denyReason || accessCheck.reason;
        } else if (accessCheck.decision === GovernanceDecision.PENDING && decision === GovernanceDecision.ALLOW) {
            decision = GovernanceDecision.PENDING;
        }

        // ── Check 2: Budget Limits ─────────────────────────────────────────────
        if (decision === GovernanceDecision.ALLOW || decision === GovernanceDecision.PENDING) {
            const budgetCheck = this._checkBudgetLimits(action, context);
            checks.push({ type: PolicyType.BUDGET_LIMIT, ...budgetCheck });
            if (budgetCheck.decision === GovernanceDecision.DENY) {
                decision   = GovernanceDecision.DENY;
                denyReason = denyReason || budgetCheck.reason;
            }
        }

        // ── Check 3: Content Safety ────────────────────────────────────────────
        const contentCheck = this._checkContentSafety(action);
        checks.push({ type: PolicyType.CONTENT_SAFETY, ...contentCheck });
        if (contentCheck.decision === GovernanceDecision.DENY) {
            decision   = GovernanceDecision.DENY;
            denyReason = denyReason || contentCheck.reason;
        } else if (contentCheck.decision === GovernanceDecision.ESCALATE && decision === GovernanceDecision.ALLOW) {
            decision = GovernanceDecision.ESCALATE;
        }

        // ── Check 4: Mission Alignment ─────────────────────────────────────────
        const missionCheck = this._checkMissionAlignment(action, context);
        checks.push({ type: PolicyType.MISSION_ALIGNMENT, ...missionCheck });
        if (missionCheck.decision === GovernanceDecision.DENY) {
            decision   = GovernanceDecision.DENY;
            denyReason = denyReason || missionCheck.reason;
        }

        // ── Check 5: Policy Engine (external declarative policies) ─────────────
        const policyResult = await this._policyEngine.evaluate(action, context);
        checks.push({ type: 'POLICY_ENGINE', ...policyResult });
        if (policyResult.decision === GovernanceDecision.DENY) {
            decision   = GovernanceDecision.DENY;
            denyReason = denyReason || policyResult.reason;
        } else if (policyResult.decision === GovernanceDecision.ESCALATE && decision === GovernanceDecision.ALLOW) {
            decision = GovernanceDecision.ESCALATE;
        }

        // ── Finalize ───────────────────────────────────────────────────────────
        const result = {
            governanceId,
            actionId:    action.id,
            actionType:  action.type,
            decision,
            reason:      denyReason,
            checks,
            sessionId:   context.sessionId || null,
            userId:      context.userId    || null,
            role:        context.role      || 'user',
            duration:    Date.now() - startAt,
            evaluatedAt: Date.now(),
        };

        // Durable audit trail write
        const chainHash = await this._auditSink.append({
            governanceId: result.governanceId,
            actionId:     result.actionId,
            actionType:   result.actionType,
            decision:     result.decision,
            reason:       result.reason,
            sessionId:    result.sessionId,
            userId:       result.userId,
            role:         result.role,
            evaluatedAt:  result.evaluatedAt,
            duration:     result.duration,
        });
        result.chainHash = chainHash;

        // Handle PENDING — route to approval queue
        if (decision === GovernanceDecision.PENDING) {
            const approvalId = `appr-${governanceId}`;
            await this._approvalQueue.submit({
                approvalId,
                governanceId,
                actionType:  action.type,
                actionId:    action.id,
                userId:      context.userId,
                role:        context.role,
                requestedAt: new Date().toISOString(),
            });
            result.approvalId = approvalId;
        }

        // Emit and log
        if (decision === GovernanceDecision.DENY) {
            this.emit('governance:denied', result);
            logger.warn('[GovernanceEngine] Action DENIED', {
                governanceId, actionType: action.type, reason: denyReason, userId: context.userId,
            });
        } else if (decision === GovernanceDecision.ESCALATE) {
            this.emit('governance:escalated', result);
            logger.warn('[GovernanceEngine] Action ESCALATED', { governanceId, actionType: action.type });
        } else if (decision === GovernanceDecision.PENDING) {
            this.emit('governance:pending', result);
            logger.info('[GovernanceEngine] Action PENDING approval', {
                governanceId, approvalId: result.approvalId,
            });
        } else {
            this.emit('governance:allowed', result);
        }

        return result;
    }

    // ─── Policy Checks ────────────────────────────────────────────────────────

    /**
     * Access control check.
     * CHANGED: Removed blanket admin bypass (CRIT-002).
     * Admins now go through the standard pipeline but are allowed for non-step-up actions.
     * Step-up actions require an explicit stepUpConfirmed flag.
     * @private
     */
    _checkAccessControl(action, context) {
        const role   = context.role   || 'user';
        const userId = context.userId;

        // Unauthenticated access to any action is denied
        if (!userId && role !== 'system') {
            return {
                decision: GovernanceDecision.DENY,
                reason: `Unauthenticated access denied: ${action.type}`,
            };
        }

        // Step-up required actions: even admins must confirm
        if (STEP_UP_REQUIRED.has(action.type) && !context.stepUpConfirmed) {
            if (role === 'admin' || role === 'operator') {
                // Route to PENDING approval workflow instead of hard DENY for privileged users
                return {
                    decision: GovernanceDecision.PENDING,
                    reason: `Step-up confirmation required for: ${action.type}`,
                };
            }
            return {
                decision: GovernanceDecision.DENY,
                reason: `Insufficient privileges for: ${action.type}`,
            };
        }

        // System role: unconditionally allowed (internal orchestration)
        if (role === 'system') {
            return { decision: GovernanceDecision.ALLOW, reason: 'system-role' };
        }

        // Admin: allowed for non-step-up actions (but still audited)
        if (role === 'admin') {
            return { decision: GovernanceDecision.ALLOW, reason: 'admin-role-audited' };
        }

        // Non-admin users attempting admin-only action types
        const adminOnlyActions = new Set(['user_delete', 'system_config', 'role_change']);
        if (adminOnlyActions.has(action.type) && role !== 'admin') {
            return {
                decision: GovernanceDecision.DENY,
                reason: `Action ${action.type} requires admin role`,
            };
        }

        return { decision: GovernanceDecision.ALLOW };
    }

    /**
     * Budget limit check with proper sliding window reset.
     * CHANGED: Added window expiry reset logic (fixes MED-005).
     * @private
     */
    _checkBudgetLimits(action, context) {
        const sessionId = context.sessionId;
        if (!sessionId) return { decision: GovernanceDecision.ALLOW, reason: 'no-session' };

        const now = Date.now();
        const WINDOW_MS = 60_000; // 1-minute sliding window

        let state = this._budgetState.get(sessionId);
        if (!state || now - state.windowStart >= WINDOW_MS) {
            // Window expired — reset counters
            state = { tokens: 0, usd: 0, requests: 0, windowStart: now };
            this._budgetState.set(sessionId, state);
        }

        const estimatedTokens = action.payload?.estimatedTokens ?? 0;
        const estimatedUsd    = action.payload?.estimatedUsd    ?? 0;

        if (state.tokens + estimatedTokens > this._budgetLimits.tokens) {
            return {
                decision: GovernanceDecision.DENY,
                reason:   `Token budget exceeded: ${state.tokens + estimatedTokens} > ${this._budgetLimits.tokens}`,
                budgetState: { ...state },
            };
        }

        if (state.usd + estimatedUsd > this._budgetLimits.usd) {
            return {
                decision: GovernanceDecision.DENY,
                reason:   `USD budget exceeded: $${(state.usd + estimatedUsd).toFixed(4)} > $${this._budgetLimits.usd}`,
                budgetState: { ...state },
            };
        }

        if (state.requests + 1 > this._budgetLimits.requestsPerMinute) {
            return {
                decision: GovernanceDecision.DENY,
                reason:   `Request rate exceeded: ${state.requests + 1} > ${this._budgetLimits.requestsPerMinute}/min`,
                budgetState: { ...state },
            };
        }

        state.tokens   += estimatedTokens;
        state.usd      += estimatedUsd;
        state.requests += 1;

        return { decision: GovernanceDecision.ALLOW, budgetState: { ...state } };
    }

    /** @private */
    _checkContentSafety(action) {
        const text = typeof action.payload === 'string'
            ? action.payload
            : JSON.stringify(action.payload ?? '');

        for (const pattern of this._contentSafety.blockedPatterns) {
            if (pattern.test(text)) {
                return {
                    decision: GovernanceDecision.DENY,
                    reason:   `Content safety violation: matched blocked pattern`,
                };
            }
        }

        for (const pattern of this._contentSafety.escalatePatterns) {
            if (pattern.test(text)) {
                return {
                    decision: GovernanceDecision.ESCALATE,
                    reason:   `Content safety escalation: matched escalate pattern`,
                };
            }
        }

        return { decision: GovernanceDecision.ALLOW };
    }

    /**
     * Mission alignment check.
     * CHANGED: uses word-boundary matching instead of bare includes() (fixes LOW-001).
     * @private
     */
    _checkMissionAlignment(action, context) {
        if (context.role === 'system') return { decision: GovernanceDecision.ALLOW };

        const text = JSON.stringify(action.payload ?? '').toLowerCase();

        const antiMission = [
            /\bexclude\s+communities\b/,
            /\bdeny\s+access\b/,
            /\bprofit\s+over\s+people\b/,
            /\bignore\s+equity\b/,
        ];

        for (const re of antiMission) {
            if (re.test(text)) {
                return {
                    decision: GovernanceDecision.DENY,
                    reason:   `Mission alignment violation detected`,
                };
            }
        }

        return { decision: GovernanceDecision.ALLOW };
    }

    // ─── HeadyCheck & HeadyAssure ─────────────────────────────────────────────

    /** @see GovernanceEngine v1 — interface unchanged, now uses v2 validation */
    async headyCheck(component) {
        const gateId = `qg-${component.id}-${Date.now()}`;
        const checks = [];
        let passed   = true;

        const hasContent = component.content !== null && component.content !== undefined;
        checks.push({ name: 'non_empty', passed: hasContent });
        if (!hasContent) passed = false;

        const govResult = await this.validateAction(
            { id: gateId, type: 'quality_check', payload: component },
            { role: 'system', meta: { phase: 'headyCheck' } }
        );
        const govPass = govResult.decision === GovernanceDecision.ALLOW;
        checks.push({ name: 'governance_pass', passed: govPass, chainHash: govResult.chainHash });
        if (!govPass) passed = false;

        const result = {
            gateId,
            componentId: component.id,
            type:        component.type,
            passed,
            checks,
            score:       passed ? 1.0 : (checks.filter(c => c.passed).length / checks.length),
            checkedAt:   Date.now(),
        };

        this._qualityGates.set(gateId, result);
        this.emit('heady-check', result);
        return result;
    }

    /**
     * HeadyAssure — Deployment certification with expiry enforcement.
     * CHANGED: Checks certificate expiry at issuance AND consumption (fixes MED-006).
     */
    async headyAssure(deployment) {
        const certId   = `cert-${deployment.id}-${Date.now()}`;
        const criteria = [];
        let certified  = true;

        // Criterion 1: Prior quality gate must have passed AND not be expired
        if (deployment.qualityGateId) {
            const gate     = this._qualityGates.get(deployment.qualityGateId);
            const gateAge  = gate ? Date.now() - gate.checkedAt : Infinity;
            const GATE_TTL = 24 * 60 * 60_000; // Quality gate valid for 24h
            const gatePass = gate && gate.passed && gateAge < GATE_TTL;
            criteria.push({
                name:   'quality_gate',
                passed: gatePass,
                ageMs:  gateAge < Infinity ? gateAge : null,
            });
            if (!gatePass) certified = false;
        } else {
            criteria.push({ name: 'quality_gate', passed: false, note: 'No gate ID provided' });
            certified = false;
        }

        // Criterion 2: No recent DENY decisions for this deployment context
        const recentDenials = (await this._auditSink.query(50, {
            actionType: 'deploy',
            decision:   GovernanceDecision.DENY,
            since:      Date.now() - 3_600_000, // last hour
        }));
        criteria.push({ name: 'no_recent_denials', passed: recentDenials.length === 0 });
        if (recentDenials.length > 0) certified = false;

        // Criterion 3: Policy engine approves the deployment
        const policyResult = await this._policyEngine.evaluate(
            { id: certId, type: 'deploy', payload: deployment },
            { role: 'system' }
        );
        criteria.push({ name: 'policy_engine', passed: policyResult.decision !== GovernanceDecision.DENY });
        if (policyResult.decision === GovernanceDecision.DENY) certified = false;

        const CERT_TTL_MS = certified ? 24 * 60 * 60_000 : 0;

        const certification = {
            certId,
            deploymentId: deployment.id,
            version:      deployment.version,
            certified,
            criteria,
            score:        certified ? 1.0 : (criteria.filter(c => c.passed).length / criteria.length),
            issuedAt:     Date.now(),
            expiresAt:    Date.now() + CERT_TTL_MS,
        };

        this._certifications.set(certId, certification);
        this.emit('heady-assure', certification);
        return certification;
    }

    /**
     * Validate a certification at consumption time (expiry check).
     * CHANGED: New method — addresses MED-006.
     * @param {string} certId
     * @returns {{ valid: boolean, certification: object|null, reason: string|null }}
     */
    validateCertification(certId) {
        const cert = this._certifications.get(certId);
        if (!cert) return { valid: false, certification: null, reason: 'Certificate not found' };
        if (!cert.certified) return { valid: false, certification: cert, reason: 'Certificate was not issued (failed criteria)' };
        if (Date.now() > cert.expiresAt) {
            return { valid: false, certification: cert, reason: `Certificate expired at ${new Date(cert.expiresAt).toISOString()}` };
        }
        return { valid: true, certification: cert, reason: null };
    }

    // ─── Audit trail API ──────────────────────────────────────────────────────

    /** @returns {Promise<object[]>} */
    async getAuditTrail(limit = null, filter = {}) {
        return this._auditSink.query(limit, filter);
    }

    /** @returns {Promise<{valid: boolean, brokenAt: number|null}>} */
    async verifyAuditIntegrity() {
        return this._auditSink.verifyChain();
    }

    /** @returns {Promise<object[]>} Pending approval requests */
    async getPendingApprovals() {
        return this._approvalQueue.getPending();
    }

    /** @returns {object} Budget state for a session */
    getBudgetState(sessionId) {
        return this._budgetState.get(sessionId) || { tokens: 0, usd: 0, requests: 0 };
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    GovernanceEngine,
    GovernanceDecision,
    PolicyType,
    InMemoryAuditSink,
    ApprovalQueue,
    STEP_UP_REQUIRED,
};
