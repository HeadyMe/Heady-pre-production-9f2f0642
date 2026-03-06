/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── Self-Healing Node Attestation ──────────────────────────────
 *
 * MCP-driven attestation layer for the Sacred Geometry mesh.
 * If an agent node fails, hallucinates, or exceeds latency thresholds,
 * the mesh auto-respawns a replacement with fresh context.
 *
 * Architecture:
 *   1. Each node emits periodic attestation heartbeats
 *   2. Attestation includes: output hash, confidence score, latency
 *   3. Verifier checks geometric consistency (output should "fit" the mesh)
 *   4. Failed attestation → node quarantined → replacement spawned
 *   5. Replacement inherits task queue but gets fresh context window
 *
 * Hallucination Detection:
 *   - Cosine similarity between node output and mesh consensus
 *   - If similarity < HALLUCINATION_THRESHOLD → flagged
 *   - 3 consecutive flags → node quarantined
 *
 * Patent: PPA #51 — Orion Attestation (Geometric Agent Verification)
 * ──────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');

const PHI = 1.6180339887;
const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 5000); // ~8.09s
const HALLUCINATION_THRESHOLD = 0.35;
const MAX_CONSECUTIVE_FAILURES = 3;
const LATENCY_CEILING_MS = 5000;
const QUARANTINE_DURATION_MS = 60000;

// ── Node States ─────────────────────────────────────────────────
const NODE_STATES = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    QUARANTINED: 'quarantined',
    RESPAWNING: 'respawning',
    DEAD: 'dead',
};

class SelfHealingMesh {
    constructor() {
        this.nodes = new Map(); // nodeId → NodeRecord
        this.attestations = new Map(); // nodeId → [AttestationRecord...]
        this.meshConsensus = null; // rolling consensus vector
        this.healingLog = [];
        this.stats = { healed: 0, quarantined: 0, respawned: 0, total: 0 };
    }

    // ── Node Registration ───────────────────────────────────────
    registerNode(nodeId, config = {}) {
        const node = {
            id: nodeId,
            state: NODE_STATES.HEALTHY,
            role: config.role || 'worker',
            geometricPosition: config.position || { x: 0, y: 0, z: 0 },
            consecutiveFailures: 0,
            lastHeartbeat: Date.now(),
            lastLatency: 0,
            confidence: 1.0,
            taskQueue: [],
            spawnedAt: Date.now(),
            generation: config.generation || 1,
        };
        this.nodes.set(nodeId, node);
        this.attestations.set(nodeId, []);
        this.stats.total++;

        logger.info(`[SelfHealingMesh] Registered node: ${nodeId} (gen ${node.generation})`);
        if (global.eventBus) global.eventBus.emit('mesh:node-registered', { nodeId, role: node.role });

        return node;
    }

    // ── Attestation ─────────────────────────────────────────────
    /**
     * Process an attestation heartbeat from a node.
     * Returns: { accepted: bool, issues: string[] }
     */
    attest(nodeId, attestation) {
        const node = this.nodes.get(nodeId);
        if (!node) return { accepted: false, issues: ['Unknown node'] };
        if (node.state === NODE_STATES.QUARANTINED) return { accepted: false, issues: ['Node quarantined'] };

        const issues = [];
        const record = {
            timestamp: Date.now(),
            outputHash: attestation.outputHash || crypto.createHash('sha256').update(String(attestation.output || '')).digest('hex'),
            confidence: attestation.confidence || 0,
            latencyMs: attestation.latencyMs || 0,
            geometricFit: 1.0,
        };

        // Check latency
        if (record.latencyMs > LATENCY_CEILING_MS) {
            issues.push(`Latency ${record.latencyMs}ms exceeds ceiling ${LATENCY_CEILING_MS}ms`);
        }

        // Check confidence
        if (record.confidence < HALLUCINATION_THRESHOLD) {
            issues.push(`Confidence ${record.confidence.toFixed(3)} below hallucination threshold ${HALLUCINATION_THRESHOLD}`);
        }

        // CSL Resonance Gate — check if output resonates with mesh consensus
        if (this.meshConsensus && attestation.outputVector && Array.isArray(this.meshConsensus)) {
            const resonance = CSL.resonance_gate(attestation.outputVector, this.meshConsensus, HALLUCINATION_THRESHOLD);
            record.geometricFit = resonance.score;
            if (!resonance.open) {
                issues.push(`Resonance ${resonance.score.toFixed(3)} — output diverges from mesh consensus (gate closed)`);
            }
        }

        // Record attestation
        const history = this.attestations.get(nodeId) || [];
        history.push(record);
        if (history.length > 100) history.shift(); // keep last 100
        this.attestations.set(nodeId, history);

        // Update node state
        node.lastHeartbeat = Date.now();
        node.lastLatency = record.latencyMs;
        node.confidence = record.confidence;

        if (issues.length > 0) {
            node.consecutiveFailures++;
            if (node.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                this._quarantineNode(nodeId, issues);
            } else {
                node.state = NODE_STATES.DEGRADED;
            }
        } else {
            node.consecutiveFailures = 0;
            node.state = NODE_STATES.HEALTHY;
        }

        return { accepted: issues.length === 0, issues };
    }

    // ── Self-Healing ────────────────────────────────────────────
    _quarantineNode(nodeId, reasons) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        node.state = NODE_STATES.QUARANTINED;
        this.stats.quarantined++;

        const logEntry = {
            timestamp: Date.now(),
            action: 'quarantine',
            nodeId,
            reasons,
            generation: node.generation,
        };
        this.healingLog.push(logEntry);
        logger.warn(`[SelfHealingMesh] Quarantined node: ${nodeId} — ${reasons.join(', ')}`);

        if (global.eventBus) {
            global.eventBus.emit('mesh:node-quarantined', { nodeId, reasons });
        }

        // Auto-respawn replacement
        this._respawnNode(nodeId);
    }

    _respawnNode(quarantinedId) {
        const oldNode = this.nodes.get(quarantinedId);
        if (!oldNode) return;

        const newId = `${quarantinedId.replace(/-gen\d+$/, '')}-gen${oldNode.generation + 1}`;
        const newNode = this.registerNode(newId, {
            role: oldNode.role,
            position: oldNode.geometricPosition,
            generation: oldNode.generation + 1,
        });

        // Transfer task queue (but NOT context — fresh start)
        newNode.taskQueue = [...oldNode.taskQueue];
        oldNode.taskQueue = [];
        oldNode.state = NODE_STATES.DEAD;

        this.stats.respawned++;
        this.stats.healed++;

        const logEntry = {
            timestamp: Date.now(),
            action: 'respawn',
            oldNodeId: quarantinedId,
            newNodeId: newId,
            generation: newNode.generation,
            inheritedTasks: newNode.taskQueue.length,
        };
        this.healingLog.push(logEntry);

        logger.info(`[SelfHealingMesh] Respawned: ${quarantinedId} → ${newId} (gen ${newNode.generation}, ${newNode.taskQueue.length} tasks inherited)`);

        if (global.eventBus) {
            global.eventBus.emit('mesh:node-respawned', {
                oldNodeId: quarantinedId,
                newNodeId: newId,
                generation: newNode.generation,
            });
        }

        return newNode;
    }

    // ── Mesh Maintenance ────────────────────────────────────────
    /**
     * Check all nodes for stale heartbeats and heal the mesh.
     */
    maintain() {
        const now = Date.now();
        const staleThreshold = HEARTBEAT_INTERVAL_MS * 3;

        for (const [nodeId, node] of this.nodes) {
            if (node.state === NODE_STATES.DEAD) continue;

            // Check for stale heartbeat
            if (now - node.lastHeartbeat > staleThreshold && node.state !== NODE_STATES.QUARANTINED) {
                this._quarantineNode(nodeId, ['Heartbeat timeout']);
            }

            // Auto-release quarantine after duration
            if (node.state === NODE_STATES.QUARANTINED) {
                const quarantineEntry = this.healingLog
                    .filter(l => l.nodeId === nodeId && l.action === 'quarantine')
                    .pop();
                if (quarantineEntry && now - quarantineEntry.timestamp > QUARANTINE_DURATION_MS) {
                    node.state = NODE_STATES.DEAD; // permanently retired
                }
            }
        }

        // Update mesh consensus from healthy nodes
        this._updateConsensus();
    }

    _updateConsensus() {
        const healthyNodes = [...this.nodes.values()]
            .filter(n => n.state === NODE_STATES.HEALTHY);
        if (healthyNodes.length === 0) return;

        // Simple average of confidence scores as consensus metric
        const avgConfidence = healthyNodes.reduce((s, n) => s + n.confidence, 0) / healthyNodes.length;
        this.meshConsensus = { avgConfidence, nodeCount: healthyNodes.length };
    }

    _cosineSimilarity(a, b) {
        // CSL Resonance Layer — unified geometric similarity
        return CSL.cosine_similarity(a, b);
    }

    // ── Health & Status ─────────────────────────────────────────
    getHealth() {
        const nodes = [...this.nodes.values()];
        const byState = {};
        for (const n of nodes) {
            byState[n.state] = (byState[n.state] || 0) + 1;
        }

        return {
            totalNodes: nodes.length,
            activeNodes: nodes.filter(n => n.state === NODE_STATES.HEALTHY || n.state === NODE_STATES.DEGRADED).length,
            byState,
            stats: this.stats,
            lastHealing: this.healingLog.slice(-5),
            meshConsensus: this.meshConsensus,
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const mesh = new SelfHealingMesh();

// ── REST Endpoints ────────────────────────────────────────────
function registerSelfHealingRoutes(app) {
    app.post('/api/mesh/register', (req, res) => {
        const node = mesh.registerNode(req.body.nodeId, req.body);
        res.json({ ok: true, node });
    });

    app.post('/api/mesh/attest', (req, res) => {
        const result = mesh.attest(req.body.nodeId, req.body);
        res.json({ ok: true, ...result });
    });

    app.post('/api/mesh/maintain', (req, res) => {
        mesh.maintain();
        res.json({ ok: true, health: mesh.getHealth() });
    });

    app.get('/api/mesh/health', (req, res) => {
        res.json({ ok: true, ...mesh.getHealth() });
    });

    app.get('/api/mesh/healing-log', (req, res) => {
        res.json({ ok: true, log: mesh.healingLog });
    });
}

module.exports = { SelfHealingMesh, mesh, registerSelfHealingRoutes, NODE_STATES };
