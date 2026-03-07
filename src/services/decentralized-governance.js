/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Decentralized Governance Module — Strategic Priority
 *
 * Implements proposal/voting/execution for autonomous system changes.
 * Agents propose changes, quorum votes approve/reject, approved proposals execute.
 */

const { getLogger } = require('./structured-logger');
const logger = getLogger('governance');
const crypto = require('crypto');

const PROPOSAL_STATES = {
    DRAFT: 'draft',
    VOTING: 'voting',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXECUTED: 'executed',
    EXPIRED: 'expired',
};

class DecentralizedGovernance {
    constructor({ quorumPercent = 51, votingPeriodMs = 300000, maxProposals = 1000 } = {}) {
        this.quorumPercent = quorumPercent;
        this.votingPeriodMs = votingPeriodMs;
        this.maxProposals = maxProposals;
        this.proposals = new Map();
        this.members = new Map(); // memberId → { role, votingPower, joinedAt }
        this.executors = new Map(); // proposalType → executor function
        this.auditLog = [];
        this._expiryTimer = setInterval(() => this._checkExpiry(), 60000);
    }

    // ── Member Management ───────────────────────────────────
    addMember(memberId, { role = 'voter', votingPower = 1 } = {}) {
        this.members.set(memberId, {
            role, votingPower, joinedAt: new Date().toISOString(), proposalCount: 0, voteCount: 0,
        });
        this._audit('member.added', { memberId, role, votingPower });
    }

    removeMember(memberId) {
        this.members.delete(memberId);
        this._audit('member.removed', { memberId });
    }

    // ── Proposal Lifecycle ──────────────────────────────────
    createProposal(authorId, { title, description, type, payload, requiredQuorum } = {}) {
        if (!this.members.has(authorId)) throw new Error(`Unknown member: ${authorId}`);

        const id = crypto.randomUUID();
        const proposal = {
            id,
            authorId,
            title,
            description,
            type: type || 'general',
            payload: payload || {},
            state: PROPOSAL_STATES.DRAFT,
            votes: new Map(),
            requiredQuorum: requiredQuorum || this.quorumPercent,
            createdAt: new Date().toISOString(),
            votingStartedAt: null,
            resolvedAt: null,
        };

        this.proposals.set(id, proposal);
        this.members.get(authorId).proposalCount++;
        this._audit('proposal.created', { proposalId: id, title, authorId });
        return proposal;
    }

    startVoting(proposalId) {
        const proposal = this._getProposal(proposalId);
        if (proposal.state !== PROPOSAL_STATES.DRAFT) throw new Error('Proposal not in draft state');
        proposal.state = PROPOSAL_STATES.VOTING;
        proposal.votingStartedAt = new Date().toISOString();
        this._audit('voting.started', { proposalId });
        return proposal;
    }

    castVote(proposalId, memberId, { approve, reason } = {}) {
        const proposal = this._getProposal(proposalId);
        if (proposal.state !== PROPOSAL_STATES.VOTING) throw new Error('Proposal not in voting state');
        if (!this.members.has(memberId)) throw new Error(`Unknown member: ${memberId}`);
        if (proposal.votes.has(memberId)) throw new Error('Already voted');

        const member = this.members.get(memberId);
        proposal.votes.set(memberId, {
            approve, reason, votingPower: member.votingPower, timestamp: new Date().toISOString(),
        });
        member.voteCount++;
        this._audit('vote.cast', { proposalId, memberId, approve });

        // Check if quorum reached
        this._checkQuorum(proposalId);
        return proposal;
    }

    async executeProposal(proposalId) {
        const proposal = this._getProposal(proposalId);
        if (proposal.state !== PROPOSAL_STATES.APPROVED) throw new Error('Proposal not approved');

        const executor = this.executors.get(proposal.type);
        if (executor) {
            try {
                const result = await executor(proposal.payload, proposal);
                proposal.state = PROPOSAL_STATES.EXECUTED;
                proposal.resolvedAt = new Date().toISOString();
                this._audit('proposal.executed', { proposalId, result });
                return { success: true, result };
            } catch (err) {
                this._audit('proposal.execution_failed', { proposalId, error: err.message });
                return { success: false, error: err.message };
            }
        }

        proposal.state = PROPOSAL_STATES.EXECUTED;
        proposal.resolvedAt = new Date().toISOString();
        return { success: true, result: 'No executor registered — marked as executed' };
    }

    registerExecutor(proposalType, fn) {
        this.executors.set(proposalType, fn);
    }

    // ── Internal ────────────────────────────────────────────
    _getProposal(id) {
        const proposal = this.proposals.get(id);
        if (!proposal) throw new Error(`Proposal not found: ${id}`);
        return proposal;
    }

    _checkQuorum(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.state !== PROPOSAL_STATES.VOTING) return;

        const totalVotingPower = [...this.members.values()].reduce((a, m) => a + m.votingPower, 0);
        let approveWeight = 0;
        let rejectWeight = 0;
        for (const vote of proposal.votes.values()) {
            if (vote.approve) approveWeight += vote.votingPower;
            else rejectWeight += vote.votingPower;
        }

        const participation = ((approveWeight + rejectWeight) / totalVotingPower) * 100;
        if (participation >= proposal.requiredQuorum) {
            if (approveWeight > rejectWeight) {
                proposal.state = PROPOSAL_STATES.APPROVED;
                proposal.resolvedAt = new Date().toISOString();
                this._audit('proposal.approved', { proposalId, approveWeight, rejectWeight });
            } else {
                proposal.state = PROPOSAL_STATES.REJECTED;
                proposal.resolvedAt = new Date().toISOString();
                this._audit('proposal.rejected', { proposalId, approveWeight, rejectWeight });
            }
        }
    }

    _checkExpiry() {
        const now = Date.now();
        for (const [id, proposal] of this.proposals) {
            if (proposal.state === PROPOSAL_STATES.VOTING) {
                const elapsed = now - new Date(proposal.votingStartedAt).getTime();
                if (elapsed > this.votingPeriodMs) {
                    proposal.state = PROPOSAL_STATES.EXPIRED;
                    proposal.resolvedAt = new Date().toISOString();
                    this._audit('proposal.expired', { proposalId: id });
                }
            }
        }
    }

    _audit(action, data) {
        const entry = { action, ...data, timestamp: new Date().toISOString() };
        this.auditLog.push(entry);
        if (this.auditLog.length > 5000) this.auditLog.shift();
        logger.info(`governance.${action}`, data);
    }

    getHealth() {
        const proposalsByState = {};
        for (const p of this.proposals.values()) {
            proposalsByState[p.state] = (proposalsByState[p.state] || 0) + 1;
        }
        return {
            members: this.members.size,
            totalProposals: this.proposals.size,
            proposalsByState,
            registeredExecutors: this.executors.size,
            auditLogSize: this.auditLog.length,
        };
    }

    shutdown() {
        clearInterval(this._expiryTimer);
    }
}

// ── Route Registration ───────────────────────────────────────
function registerGovernanceRoutes(app) {
    const governance = new DecentralizedGovernance();

    // Register system agents as initial members
    ['heady-core', 'heady-ops', 'heady-security', 'heady-architect'].forEach(agent => {
        governance.addMember(agent, { role: 'agent', votingPower: 1 });
    });
    governance.addMember('admin', { role: 'admin', votingPower: 3 });

    app.get('/api/governance/health', (req, res) => res.json(governance.getHealth()));

    app.post('/api/governance/proposals', (req, res) => {
        try {
            const proposal = governance.createProposal(req.body.authorId || 'admin', req.body);
            res.json(proposal);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/api/governance/proposals/:id/vote', (req, res) => {
        try {
            const result = governance.castVote(req.params.id, req.body.memberId, req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/api/governance/proposals/:id/start-voting', (req, res) => {
        try {
            res.json(governance.startVoting(req.params.id));
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/api/governance/proposals/:id/execute', async (req, res) => {
        try {
            const result = await governance.executeProposal(req.params.id);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.get('/api/governance/audit', (req, res) => {
        const limit = parseInt(req.query.limit || '100', 10);
        res.json({ log: governance.auditLog.slice(-limit) });
    });

    logger.info('Governance routes registered');
    return governance;
}

module.exports = { DecentralizedGovernance, PROPOSAL_STATES, registerGovernanceRoutes };
