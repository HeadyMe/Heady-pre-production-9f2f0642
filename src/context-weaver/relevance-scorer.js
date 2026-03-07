/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Relevance Scorer — Composite Si Equation ═══
 *
 * Implements the Dynamic Semantic Packing relevance equation:
 *
 *   Si = α · Sim(I⃗, N⃗i) + β · (1 / (1 + D(T, Ni))) + γ · e^(-λt)
 *
 * Where:
 *   Si        = final inclusion score for node i
 *   Sim(I,Ni) = cosine similarity between Intent vector and Node vector
 *   D(T,Ni)   = structural graph distance between Target and Node i
 *   t         = time elapsed since node was last mutated (ms)
 *   α,β,γ     = geometric weights (sum to 1.0)
 *   λ         = temporal decay constant
 */

'use strict';

const logger = require('../utils/logger').child('relevance-scorer');

// ── Default geometric weights ──────────────────────────────────
const DEFAULT_ALPHA = 0.50;  // Semantic Resonance weight
const DEFAULT_BETA = 0.30;  // Graph Proximity weight
const DEFAULT_GAMMA = 0.20;  // Recency weight

// Decay constant: ~7-day half-life in milliseconds
// ln(2) / (7 * 24 * 60 * 60 * 1000) ≈ 1.1457e-9
const DEFAULT_LAMBDA = 1.1457e-9;

/**
 * Cosine similarity between two equal-length vectors.
 * Falls back to 0 if vectors are incompatible.
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Score an array of candidate AST nodes against the Intent + Target
 * using the composite Si equation.
 *
 * @param {number[]} intentEmbedding — the embedded intent vector
 * @param {Object[]} candidateNodes — array of node objects, each with:
 *   - id: UUID
 *   - embedding: number[] (node's vector embedding)
 *   - updatedAt: ISO timestamp or Date (from ast_governance / updated_at)
 *   - ...other metadata
 * @param {Map<string, number>} distanceMap — nodeId → graph distance from target
 * @param {Object} options
 * @param {number} options.alpha — semantic weight (default 0.50)
 * @param {number} options.beta — graph proximity weight (default 0.30)
 * @param {number} options.gamma — recency weight (default 0.20)
 * @param {number} options.lambda — decay constant (default ~7-day half-life)
 * @returns {Object[]} nodes with `composite_score`, `score_breakdown` fields, sorted descending
 */
function scoreNodes(intentEmbedding, candidateNodes, distanceMap, options = {}) {
    const {
        alpha = DEFAULT_ALPHA,
        beta = DEFAULT_BETA,
        gamma = DEFAULT_GAMMA,
        lambda = DEFAULT_LAMBDA,
    } = options;

    const now = Date.now();
    const scored = [];

    for (const node of candidateNodes) {
        // ── α: Semantic Resonance ──────────────────────────────
        const semanticScore = intentEmbedding && node.embedding
            ? cosineSimilarity(intentEmbedding, node.embedding)
            : 0;

        // ── β: Graph Proximity ─────────────────────────────────
        const graphDistance = distanceMap.get(node.id) ?? Infinity;
        const proximityScore = 1.0 / (1.0 + graphDistance);

        // ── γ: Recency ─────────────────────────────────────────
        let recencyScore = 0.5; // default for nodes without timestamps
        if (node.updatedAt) {
            const updatedTime = typeof node.updatedAt === 'string'
                ? new Date(node.updatedAt).getTime()
                : node.updatedAt;
            const elapsed = Math.max(0, now - updatedTime);
            recencyScore = Math.exp(-lambda * elapsed);
        }

        // ── Composite Si ───────────────────────────────────────
        const compositeScore = alpha * semanticScore
            + beta * proximityScore
            + gamma * recencyScore;

        scored.push({
            ...node,
            composite_score: +compositeScore.toFixed(6),
            score_breakdown: {
                semantic: +semanticScore.toFixed(4),
                proximity: +proximityScore.toFixed(4),
                recency: +recencyScore.toFixed(4),
                graphDistance: graphDistance === Infinity ? -1 : graphDistance,
            },
        });
    }

    // Sort by composite score descending
    scored.sort((a, b) => b.composite_score - a.composite_score);

    if (scored.length > 0) {
        logger.info(`Scored ${scored.length} nodes — top Si: ${scored[0].composite_score}, bottom Si: ${scored[scored.length - 1].composite_score}`);
    }

    return scored;
}

/**
 * Score without embeddings — uses only graph proximity and recency.
 * Useful when intent embedding is unavailable.
 */
function scoreByStructure(candidateNodes, distanceMap, options = {}) {
    return scoreNodes(null, candidateNodes, distanceMap, {
        ...options,
        alpha: 0,       // No semantic component
        beta: 0.65,     // Heavily weight graph proximity
        gamma: 0.35,    // Moderate recency weight
    });
}

module.exports = {
    scoreNodes,
    scoreByStructure,
    cosineSimilarity,
    DEFAULT_ALPHA,
    DEFAULT_BETA,
    DEFAULT_GAMMA,
    DEFAULT_LAMBDA,
};
