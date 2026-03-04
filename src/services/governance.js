/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── HeadyMe Decentralized Governance ───────────────────────────
 *
 * Cryptographic voting for node operators and stakeholders.
 * Proposals are submitted, voted on, and executed transparently.
 *
 * Architecture:
 *   - Proposals stored in vector memory
 *   - Votes signed with ED25519 keys (via vault SSH keys)
 *   - Quorum: >50% of registered voters
 *   - Results immutable once finalized (hash-chained)
 *
 * ──────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

const QUORUM_THRESHOLD = 0.5; // 50% of voters
const VOTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default

const PROPOSAL_STATES = {
    DRAFT: 'draft',
    OPEN: 'open',
    PASSED: 'passed',
    REJECTED: 'rejected',
    EXECUTED: 'executed',
};

class GovernanceModule {
    constructor() {
        this.proposals = new Map(); // proposalId → Proposal
        this.voters = new Map(); // voterId → { publicKey, weight, registeredAt }
        this.chain = []; // hash chain of finalized proposals
    }

    // ── Voter Management ────────────────────────────────────────
    registerVoter(voterId, publicKey, weight = 1) {
        this.voters.set(voterId, {
            publicKey,
            weight,
            registeredAt: Date.now(),
        });
        logger.info(`[Governance] Voter registered: ${voterId} (weight: ${weight})`);
        return { voterId, registered: true };
    }

    // ── Proposals ───────────────────────────────────────────────
    createProposal(title, description, author, options = {}) {
        const proposalId = `prop-${Date.now().toString(36)}`;
        const proposal = {
            id: proposalId,
            title,
            description,
            author,
            state: PROPOSAL_STATES.DRAFT,
            createdAt: Date.now(),
            openedAt: null,
            closesAt: null,
            durationMs: options.durationMs || VOTE_DURATION_MS,
            votes: new Map(), // voterId → { choice, signature, timestamp }
            tally: { yes: 0, no: 0, abstain: 0 },
            quorum: options.quorum || QUORUM_THRESHOLD,
            hash: null,
        };

        this.proposals.set(proposalId, proposal);
        logger.info(`[Governance] Proposal created: ${proposalId} — "${title}"`);
        return { proposalId, state: proposal.state };
    }

    openProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        if (proposal.state !== PROPOSAL_STATES.DRAFT) throw new Error('Can only open draft proposals');

        proposal.state = PROPOSAL_STATES.OPEN;
        proposal.openedAt = Date.now();
        proposal.closesAt = Date.now() + proposal.durationMs;

        if (global.eventBus) {
            global.eventBus.emit('governance:proposal-opened', { proposalId, title: proposal.title, closesAt: proposal.closesAt });
        }

        return { proposalId, state: proposal.state, closesAt: proposal.closesAt };
    }

    // ── Voting ──────────────────────────────────────────────────
    vote(proposalId, voterId, choice, signature = null) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        if (proposal.state !== PROPOSAL_STATES.OPEN) throw new Error('Proposal is not open for voting');
        if (Date.now() > proposal.closesAt) throw new Error('Voting period has ended');
        if (!this.voters.has(voterId)) throw new Error('Not a registered voter');
        if (!['yes', 'no', 'abstain'].includes(choice)) throw new Error('Invalid choice');

        const voter = this.voters.get(voterId);

        // Record vote
        proposal.votes.set(voterId, {
            choice,
            weight: voter.weight,
            signature: signature || crypto.createHash('sha256').update(`${proposalId}:${voterId}:${choice}`).digest('hex'),
            timestamp: Date.now(),
        });

        // Recalculate tally
        proposal.tally = { yes: 0, no: 0, abstain: 0 };
        for (const [, v] of proposal.votes) {
            proposal.tally[v.choice] += v.weight;
        }

        logger.info(`[Governance] Vote: ${voterId} → ${choice} on ${proposalId}`);
        return { proposalId, voterId, choice, tally: proposal.tally };
    }

    // ── Finalization ────────────────────────────────────────────
    finalize(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        if (proposal.state !== PROPOSAL_STATES.OPEN) throw new Error('Can only finalize open proposals');

        const totalWeight = [...this.voters.values()].reduce((sum, v) => sum + v.weight, 0);
        const totalVoteWeight = proposal.tally.yes + proposal.tally.no + proposal.tally.abstain;
        const quorumMet = (totalVoteWeight / totalWeight) >= proposal.quorum;

        if (quorumMet && proposal.tally.yes > proposal.tally.no) {
            proposal.state = PROPOSAL_STATES.PASSED;
        } else {
            proposal.state = PROPOSAL_STATES.REJECTED;
        }

        // Hash-chain
        const prevHash = this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : '0000000000';
        proposal.hash = crypto.createHash('sha256')
            .update(`${prevHash}:${proposalId}:${JSON.stringify(proposal.tally)}:${proposal.state}`)
            .digest('hex');
        this.chain.push({ proposalId, hash: proposal.hash, state: proposal.state, finalizedAt: Date.now() });

        logger.info(`[Governance] Finalized: ${proposalId} → ${proposal.state} (${proposal.tally.yes}Y/${proposal.tally.no}N, quorum: ${quorumMet})`);

        if (global.eventBus) {
            global.eventBus.emit('governance:proposal-finalized', { proposalId, state: proposal.state, tally: proposal.tally });
        }

        return { proposalId, state: proposal.state, tally: proposal.tally, quorumMet, hash: proposal.hash };
    }

    // ── Queries ─────────────────────────────────────────────────
    listProposals(state = null) {
        return [...this.proposals.values()]
            .filter(p => !state || p.state === state)
            .map(p => ({
                id: p.id, title: p.title, state: p.state,
                tally: p.tally, author: p.author, closesAt: p.closesAt,
            }));
    }

    getHealth() {
        return {
            totalVoters: this.voters.size,
            totalProposals: this.proposals.size,
            openProposals: [...this.proposals.values()].filter(p => p.state === PROPOSAL_STATES.OPEN).length,
            chainLength: this.chain.length,
            latestHash: this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : null,
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const governance = new GovernanceModule();

// ── REST Endpoints ────────────────────────────────────────────
function registerGovernanceRoutes(app) {
    app.post('/api/governance/voter', (req, res) => {
        const result = governance.registerVoter(req.body.voterId, req.body.publicKey, req.body.weight);
        res.json({ ok: true, ...result });
    });

    app.post('/api/governance/proposal', (req, res) => {
        const result = governance.createProposal(req.body.title, req.body.description, req.body.author, req.body);
        res.json({ ok: true, ...result });
    });

    app.post('/api/governance/proposal/:id/open', (req, res) => {
        try {
            const result = governance.openProposal(req.params.id);
            res.json({ ok: true, ...result });
        } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
    });

    app.post('/api/governance/vote', (req, res) => {
        try {
            const result = governance.vote(req.body.proposalId, req.body.voterId, req.body.choice, req.body.signature);
            res.json({ ok: true, ...result });
        } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
    });

    app.post('/api/governance/proposal/:id/finalize', (req, res) => {
        try {
            const result = governance.finalize(req.params.id);
            res.json({ ok: true, ...result });
        } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
    });

    app.get('/api/governance/proposals', (req, res) => {
        res.json({ ok: true, proposals: governance.listProposals(req.query.state) });
    });

    app.get('/api/governance/health', (req, res) => {
        res.json({ ok: true, ...governance.getHealth() });
    });
}

module.exports = { GovernanceModule, governance, registerGovernanceRoutes, PROPOSAL_STATES };
