/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Self-Healing Attestation Mesh ────────────────────────────────────────────
 *
 * Patent Docket: HS-059
 * Title: SELF-HEALING ATTESTATION MESH FOR AUTONOMOUS AI AGENT NETWORKS WITH
 *        GEOMETRIC HALLUCINATION DETECTION
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 * Related:   HS-058 (Continuous Semantic Logic)
 *
 * Satisfies ALL 7 claims of HS-059.
 * Uses CSL gates (HS-058) for resonance scoring.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
    resonance_gate,
    consensus_superposition,
    cosine_similarity,
    soft_gate,
    PHI,
} = require('../core/csl-gates-enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// RTP: HS-059 Claim 5 — golden ratio for heartbeat timing
const PHI_CONST = PHI; // 1.6180339887

// Default configuration aligned with HS-059 detailed description
const DEFAULTS = {
    hallucination_threshold:     0.70,   // below this → flagged
    critical_threshold:          0.40,   // below this → immediate quarantine
    quarantine_streak:           3,      // consecutive flags before quarantine
    suspect_output_count:        5,      // last N outputs marked suspect (Claim 4)
    confidence_median_ratio:     0.50,   // below 50% of median → quarantine
    recovery_streak:             3,      // consecutive good outputs to un-quarantine
    heartbeat_base_ms:           5000,   // base heartbeat interval
    sigmoid_steepness:           20,     // for resonance soft gate
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTESTATION RECORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a signed attestation from an agent's output.
 *
 * // RTP: HS-059 Claim 1(a) — each agent submits output attestations including
 * //                           an embedding vector and a confidence score.
 *
 * @param {string}              agentId      — unique agent identifier
 * @param {string}              version      — agent version string
 * @param {number[]|Float32Array} embedding  — output embedding vector
 * @param {number}              confidence   — confidence ∈ [0, 1]
 * @param {string}              responseText — raw response text for SHA-256 hash
 * @returns {object} attestation record
 */
function buildAttestation(agentId, version, embedding, confidence, responseText = '') {
    // RTP: HS-059 Claim 1(a) — attestation includes identity, version, embedding, confidence
    const timestamp = Date.now();

    // RTP: HS-059 Claim 1    — SHA-256 hash of complete response for integrity
    const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ agentId, version, confidence, timestamp, responseText }))
        .digest('hex');

    return {
        agentId,
        version,
        embedding: Array.from(embedding),   // store as plain array for serialization
        confidence: Math.max(0, Math.min(1, confidence)),
        responseText,
        hash,
        timestamp,
        suspect: false,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI-BASED HEARTBEAT TIMING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute heartbeat interval using golden ratio multiplier.
 *
 * // RTP: HS-059 Claim 5 — heartbeat intervals computed as multiples of φ ≈ 1.618
 * //                        to prevent collision patterns in multi-agent timing.
 *
 * @param {number} baseMs — base interval in milliseconds (default 5000)
 * @returns {number} heartbeat interval in milliseconds
 */
function computeHeartbeatInterval(baseMs = DEFAULTS.heartbeat_base_ms) {
    // RTP: HS-059 Claim 5 — multiply base interval by golden ratio
    return Math.round(PHI_CONST * baseMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTESTATION MESH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AttestationMesh: the core self-healing agent mesh.
 *
 * // RTP: HS-059 Claim 7 — full system with agents, Resonance Gate, consensus engine,
 * //                         quarantine module, and recovery module.
 */
class AttestationMesh {

    /**
     * @param {object} opts — configuration overrides
     */
    constructor(opts = {}) {
        this.config = Object.assign({}, DEFAULTS, opts);

        // Agent registry: agentId → agent state
        this._agents = new Map();

        // RTP: HS-059 Claim 1(b) — mesh consensus vector (normalized sum of healthy outputs)
        this._consensusVector = null;

        // Audit log of all attestations
        this._attestationLog = [];

        // Heartbeat timers
        this._heartbeatTimers = new Map();

        // Event listeners
        this._listeners = [];
    }

    // ── Agent Registration ─────────────────────────────────────────────────

    /**
     * Register an agent with the mesh.
     *
     * // RTP: HS-059 Claim 7(a) — plurality of AI agents configured to submit
     * //                           signed attestations.
     *
     * @param {string} agentId  — unique identifier
     * @param {string} version  — agent version
     * @param {object} meta     — optional metadata
     */
    registerAgent(agentId, version = '1.0.0', meta = {}) {
        // RTP: HS-059 Claim 7(a)
        if (this._agents.has(agentId)) {
            this._agents.get(agentId).version = version;
            return this._agents.get(agentId);
        }

        const agentState = {
            agentId,
            version,
            meta,
            quarantined:         false,
            quarantinedAt:       null,
            flagStreak:          0,         // consecutive low-resonance attestations
            recoveryStreak:      0,         // consecutive good attestations post-quarantine
            recentAttestations:  [],        // sliding window of recent attestations
            suspectOutputs:      [],        // RTP: HS-059 Claim 4 — last N marked suspect
            registeredAt:        Date.now(),
            heartbeatInterval:   computeHeartbeatInterval(this.config.heartbeat_base_ms),
            lastHeartbeat:       null,
        };

        this._agents.set(agentId, agentState);
        this._emit('agent:registered', { agentId, version });
        return agentState;
    }

    // ── Attestation Submission ─────────────────────────────────────────────

    /**
     * Submit an attestation from an agent. Core mesh logic runs here.
     *
     * // RTP: HS-059 Claim 1 — submit attestation with embedding + confidence,
     * //                        check resonance, quarantine if needed, update consensus.
     *
     * @param {string}              agentId
     * @param {string}              version
     * @param {number[]|Float32Array} embedding
     * @param {number}              confidence  — ∈ [0, 1]
     * @param {string}              responseText
     * @returns {object} attestation result
     */
    submitAttestation(agentId, version, embedding, confidence, responseText = '') {
        // RTP: HS-059 Claim 1(a) — agent submits output attestation
        if (!this._agents.has(agentId)) {
            this.registerAgent(agentId, version);
        }

        const agent = this._agents.get(agentId);
        const attestation = buildAttestation(agentId, version, embedding, confidence, responseText);

        // Record in audit log
        this._attestationLog.push(attestation);

        // ── Geometric Hallucination Detection ──────────────────────────────

        let resonanceResult = null;
        let flagged = false;

        if (this._consensusVector && this._consensusVector.length > 0) {
            // RTP: HS-059 Claim 1(c) — apply geometric similarity gate to measure alignment
            // RTP: HS-059 Claim 2    — Resonance Gate computes cosine similarity + sigmoid
            resonanceResult = resonance_gate(
                embedding,
                this._consensusVector,
                this.config.hallucination_threshold,
                this.config.sigmoid_steepness,
            );

            const score = resonanceResult.score;

            // RTP: HS-059 Claim 1(d) — flag attestations below hallucination threshold
            flagged = score < this.config.hallucination_threshold;

            // Immediate quarantine on critical threshold breach
            if (score < this.config.critical_threshold && !agent.quarantined) {
                this._quarantine(agent, attestation, 'critical_threshold');
            }
        }

        // ── Track flag streak ───────────────────────────────────────────────
        if (flagged) {
            agent.flagStreak++;
            attestation.suspect = true;
            // RTP: HS-059 Claim 1(e) — quarantine after configurable consecutive flags
            if (agent.flagStreak >= this.config.quarantine_streak && !agent.quarantined) {
                this._quarantine(agent, attestation, 'streak_threshold');
            }
        } else {
            agent.flagStreak = 0;
        }

        // ── Confidence vs. median check ────────────────────────────────────
        if (!agent.quarantined) {
            const medianConf = this._computeMedianConfidence();
            if (medianConf > 0 && confidence < medianConf * this.config.confidence_median_ratio) {
                this._quarantine(agent, attestation, 'low_confidence');
            }
        }

        // ── Recovery monitoring for quarantined agents ─────────────────────
        if (agent.quarantined && resonanceResult && !flagged) {
            // RTP: HS-059 Claim 3 — auto un-quarantine when outputs realign
            agent.recoveryStreak++;
            if (agent.recoveryStreak >= this.config.recovery_streak) {
                this._unquarantine(agent);
            }
        } else if (agent.quarantined && flagged) {
            agent.recoveryStreak = 0;
        }

        // ── Update agent's recent attestation window ───────────────────────
        agent.recentAttestations.push(attestation);
        if (agent.recentAttestations.length > 20) {
            agent.recentAttestations.shift();
        }

        // ── Consensus Reconstitution ───────────────────────────────────────
        // RTP: HS-059 Claim 1(f) — recompute consensus from remaining healthy agents
        // RTP: HS-059 Claim 6    — fuse output vectors using vector addition + normalize
        this._updateConsensus();

        return {
            agentId,
            attestation,
            resonanceResult,
            flagged,
            quarantined:     agent.quarantined,
            consensusVector: this._consensusVector ? Array.from(this._consensusVector) : null,
        };
    }

    // ── Quarantine Protocol ────────────────────────────────────────────────

    /**
     * Quarantine an agent: remove from consensus, mark recent outputs as suspect.
     *
     * // RTP: HS-059 Claim 4 — mark last N outputs of quarantined agent as suspect.
     * // RTP: HS-059 Claim 7(d) — quarantine module isolates divergent agents.
     *
     * @param {object} agent
     * @param {object} triggerAttestation
     * @param {string} reason
     */
    _quarantine(agent, triggerAttestation, reason) {
        // RTP: HS-059 Claim 4 — mark last N outputs as suspect
        const n = this.config.suspect_output_count;
        const recent = agent.recentAttestations.slice(-n);
        for (const att of recent) {
            att.suspect = true;
        }
        triggerAttestation.suspect = true;
        agent.suspectOutputs = [...recent, triggerAttestation];

        agent.quarantined   = true;
        agent.quarantinedAt = Date.now();
        agent.recoveryStreak = 0;

        this._emit('agent:quarantined', { agentId: agent.agentId, reason });

        // Recompute consensus without this agent
        // RTP: HS-059 Claim 1(f) — recompute from remaining healthy agents
        this._updateConsensus();
    }

    /**
     * Un-quarantine an agent after recovery.
     *
     * // RTP: HS-059 Claim 3 — automatically un-quarantine when outputs re-align.
     * // RTP: HS-059 Claim 7(e) — recovery module automatically restores quarantined agents.
     *
     * @param {object} agent
     */
    _unquarantine(agent) {
        // RTP: HS-059 Claim 3 — auto un-quarantine upon demonstrated re-alignment
        agent.quarantined    = false;
        agent.quarantinedAt  = null;
        agent.recoveryStreak = 0;
        agent.flagStreak     = 0;

        this._emit('agent:recovered', { agentId: agent.agentId });

        // Recompute consensus including this recovered agent
        this._updateConsensus();
    }

    // ── Consensus Reconstitution ───────────────────────────────────────────

    /**
     * Recompute mesh consensus vector using Consensus Superposition of all
     * healthy agents' latest embeddings.
     *
     * // RTP: HS-059 Claim 6  — fuse output vectors from all non-quarantined agents
     * //                         using vector addition followed by normalization.
     * // RTP: HS-059 Claim 7(c) — consensus engine computes and maintains consensus
     * //                           vector using vector superposition.
     */
    _updateConsensus() {
        // RTP: HS-059 Claim 6
        const healthyVectors = [];

        for (const [, agent] of this._agents) {
            if (!agent.quarantined && agent.recentAttestations.length > 0) {
                const latest = agent.recentAttestations[agent.recentAttestations.length - 1];
                if (!latest.suspect && latest.embedding && latest.embedding.length > 0) {
                    healthyVectors.push(latest.embedding);
                }
            }
        }

        if (healthyVectors.length === 0) {
            // Mesh continues operating at reduced capacity — no crash
            this._consensusVector = null;
            return;
        }

        // RTP: HS-059 Claim 6 — consensus superposition (sum + normalize)
        // RTP: HS-059 Claim 7(c) — using vector superposition from HS-058
        this._consensusVector = consensus_superposition(healthyVectors);
        this._emit('consensus:updated', {
            healthyAgentCount: healthyVectors.length,
        });
    }

    // ── Heartbeat Management ───────────────────────────────────────────────

    /**
     * Register a heartbeat callback for an agent.
     *
     * // RTP: HS-059 Claim 5 — heartbeat intervals = φ × baseMs to prevent collisions.
     *
     * @param {string}   agentId
     * @param {Function} callback — called each heartbeat
     */
    startHeartbeat(agentId, callback) {
        // RTP: HS-059 Claim 5
        if (!this._agents.has(agentId)) {
            throw new Error(`startHeartbeat: agent '${agentId}' not registered`);
        }
        const agent = this._agents.get(agentId);

        // RTP: HS-059 Claim 5 — phi-derived interval
        const interval = computeHeartbeatInterval(this.config.heartbeat_base_ms);
        agent.heartbeatInterval = interval;

        const timer = setInterval(() => {
            agent.lastHeartbeat = Date.now();
            this._emit('agent:heartbeat', { agentId, timestamp: agent.lastHeartbeat, intervalMs: interval });
            if (typeof callback === 'function') callback(agentId, agent.lastHeartbeat);
        }, interval);

        this._heartbeatTimers.set(agentId, timer);
        return interval;
    }

    /**
     * Stop heartbeat for an agent.
     * @param {string} agentId
     */
    stopHeartbeat(agentId) {
        if (this._heartbeatTimers.has(agentId)) {
            clearInterval(this._heartbeatTimers.get(agentId));
            this._heartbeatTimers.delete(agentId);
        }
    }

    /**
     * Stop all heartbeats and clean up timers.
     */
    shutdown() {
        for (const [agentId] of this._heartbeatTimers) {
            this.stopHeartbeat(agentId);
        }
    }

    // ── Utility Queries ────────────────────────────────────────────────────

    /**
     * Compute the median confidence across all healthy agents' latest attestations.
     * @returns {number}
     */
    _computeMedianConfidence() {
        const confidences = [];
        for (const [, agent] of this._agents) {
            if (!agent.quarantined && agent.recentAttestations.length > 0) {
                const latest = agent.recentAttestations[agent.recentAttestations.length - 1];
                confidences.push(latest.confidence);
            }
        }
        if (confidences.length === 0) return 0;
        confidences.sort((a, b) => a - b);
        const mid = Math.floor(confidences.length / 2);
        return confidences.length % 2 === 0
            ? (confidences[mid - 1] + confidences[mid]) / 2
            : confidences[mid];
    }

    /**
     * Get the current mesh health status.
     * @returns {object}
     */
    getMeshStatus() {
        const agents = [];
        let healthyCount = 0;
        let quarantinedCount = 0;

        for (const [agentId, agent] of this._agents) {
            const isHealthy = !agent.quarantined;
            if (isHealthy) healthyCount++; else quarantinedCount++;
            agents.push({
                agentId,
                version:         agent.version,
                quarantined:     agent.quarantined,
                quarantinedAt:   agent.quarantinedAt,
                flagStreak:      agent.flagStreak,
                recoveryStreak:  agent.recoveryStreak,
                lastHeartbeat:   agent.lastHeartbeat,
                heartbeatIntervalMs: agent.heartbeatInterval,
                attestationCount: agent.recentAttestations.length,
                suspectOutputCount: agent.suspectOutputs.length,
            });
        }

        return {
            totalAgents:    this._agents.size,
            healthyAgents:  healthyCount,
            quarantinedAgents: quarantinedCount,
            consensusActive: this._consensusVector !== null,
            agents,
            totalAttestations: this._attestationLog.length,
        };
    }

    /**
     * Get suspect outputs for a specific agent.
     *
     * // RTP: HS-059 Claim 4 — marked outputs prevented from use in downstream decisions
     *
     * @param {string} agentId
     * @returns {Array}
     */
    getSuspectOutputs(agentId) {
        // RTP: HS-059 Claim 4
        const agent = this._agents.get(agentId);
        if (!agent) return [];
        return agent.suspectOutputs.filter(a => a.suspect);
    }

    /**
     * Get the current consensus vector.
     * @returns {number[]|null}
     */
    getConsensusVector() {
        return this._consensusVector ? Array.from(this._consensusVector) : null;
    }

    /**
     * Get full attestation audit log.
     * @returns {Array}
     */
    getAuditLog() {
        return [...this._attestationLog];
    }

    /**
     * Measure geometric alignment of a vector against current mesh consensus.
     *
     * // RTP: HS-059 Claim 2 — Resonance Gate measures geometric alignment
     * //                        between attestation and mesh consensus.
     *
     * @param {number[]|Float32Array} vec
     * @param {number} threshold
     * @returns {object|null}
     */
    measureAlignment(vec, threshold) {
        // RTP: HS-059 Claim 2
        if (!this._consensusVector) return null;
        return resonance_gate(
            vec,
            this._consensusVector,
            threshold !== undefined ? threshold : this.config.hallucination_threshold,
            this.config.sigmoid_steepness,
        );
    }

    // ── Event System ───────────────────────────────────────────────────────

    /**
     * Subscribe to mesh events.
     * @param {Function} listener — (event, data) => void
     */
    on(listener) {
        this._listeners.push(listener);
    }

    _emit(event, data) {
        for (const listener of this._listeners) {
            try { listener(event, data); } catch (_) { /* swallow listener errors */ }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI: PHI_CONST,
    DEFAULTS,
    buildAttestation,
    computeHeartbeatInterval,
    AttestationMesh,
};
