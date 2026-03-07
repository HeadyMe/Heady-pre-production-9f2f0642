/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

/**
 * CSL — Continuous Semantic Logic Gates
 * ══════════════════════════════════════
 *
 * Soft activation functions for intelligent bee dispatch, swarm candidate
 * scoring, and priority classification. Used throughout the Heady projection
 * system for non-binary, gradient-based decision making.
 *
 * Gates:
 *   ternary_gate     → Classify: +1 (high) / 0 (neutral) / -1 (low)
 *   soft_gate        → Continuous sigmoid activation
 *   route_gate       → Score candidates against intent vector
 *   resonance_gate   → Cosine-similarity resonance check
 *   multi_resonance  → Multi-candidate resonance ranking
 *   weighted_superposition → Blend two vectors by weight
 *   normalize        → L2-normalize a vector
 *   batch_orthogonal → Remove directional influence from a vector
 *   getStats         → Return gate invocation counters
 */

const PHI = 1.6180339887;

// ─── Stats ──────────────────────────────────────────────────────────────────
const _stats = {
    ternaryGateCalls: 0,
    softGateCalls: 0,
    routeGateCalls: 0,
    resonanceGateCalls: 0,
    normalizeCalls: 0,
    superpositionCalls: 0,
    orthogonalCalls: 0,
};

function getStats() {
    return { ...._stats };
}

// ─── Vector Utilities ───────────────────────────────────────────────────────

function dot(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) sum += a[i] * b[i];
    return sum;
}

function magnitude(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
    const d = dot(a, b);
    const ma = magnitude(a);
    const mb = magnitude(b);
    if (ma === 0 || mb === 0) return 0;
    return d / (ma * mb);
}

/**
 * L2-normalize a vector.
 * @param {Float32Array|number[]} v
 * @returns {Float32Array}
 */
function normalize(v) {
    _stats.normalizeCalls++;
    const mag = magnitude(v);
    if (mag === 0) return new Float32Array(v.length);
    const out = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / mag;
    return out;
}

/**
 * Weighted superposition of two vectors.
 * result = normalize(w * a + (1-w) * b)
 */
function weighted_superposition(a, b, weight = 0.5) {
    _stats.superpositionCalls++;
    const dim = Math.min(a.length, b.length);
    const out = new Float32Array(dim);
    const w = Math.max(0, Math.min(1, weight));
    for (let i = 0; i < dim; i++) {
        out[i] = w * a[i] + (1 - w) * b[i];
    }
    return normalize(out);
}

/**
 * Remove directional influence of exclude vectors from the input vector.
 */
function batch_orthogonal(vec, excludeVecs) {
    _stats.orthogonalCalls++;
    let result = Float32Array.from(vec);
    for (const excl of excludeVecs) {
        const d = dot(result, excl);
        const m2 = dot(excl, excl);
        if (m2 === 0) continue;
        const scale = d / m2;
        for (let i = 0; i < result.length; i++) {
            result[i] -= scale * excl[i];
        }
    }
    return normalize(result);
}

// ─── Gates ──────────────────────────────────────────────────────────────────

/**
 * Ternary gate: classify a value into three states.
 * @param {number} value — Input value (0-1 typically)
 * @param {number} highThresh — Above this → state +1 (core / critical)
 * @param {number} lowThresh  — Below this → state -1 (low / reject)
 * @returns {{ state: number, resonanceActivation: number }}
 */
function ternary_gate(value, highThresh = 0.7, lowThresh = 0.3) {
    _stats.ternaryGateCalls++;
    let state;
    if (value >= highThresh) state = 1;
    else if (value <= lowThresh) state = -1;
    else state = 0;

    // Smooth activation using sigmoid centered at midpoint
    const mid = (highThresh + lowThresh) / 2;
    const steepness = PHI * 10;
    const resonanceActivation = 1 / (1 + Math.exp(-steepness * (value - mid)));

    return { state, resonanceActivation };
}

/**
 * Soft gate: continuous sigmoid activation.
 * @param {number} value — Input
 * @param {number} center — Sigmoid center
 * @param {number} steepness — Slope steepness (default PHI * 10)
 * @returns {number} Activation in [0, 1]
 */
function soft_gate(value, center = 0.5, steepness = PHI * 10) {
    _stats.softGateCalls++;
    return 1 / (1 + Math.exp(-steepness * (value - center)));
}

/**
 * Route gate: score candidates against an intent vector.
 * @param {Float32Array} intentVec — Query intent vector
 * @param {{ id: string, vector: Float32Array }[]} candidates — Candidate entries
 * @param {number} threshold — Minimum cosine similarity to accept
 * @returns {{ scores: { id: string, score: number, activation: number }[], fallback: boolean }}
 */
function route_gate(intentVec, candidates, threshold = 0.3) {
    _stats.routeGateCalls++;
    const scores = [];

    for (const c of candidates) {
        const score = cosineSimilarity(intentVec, c.vector);
        const activation = soft_gate(score, threshold);
        scores.push({ id: c.id, score, activation });
    }

    scores.sort((a, b) => b.score - a.score);

    const fallback = scores.length === 0 || scores[0].score < threshold;
    return { scores, fallback };
}

/**
 * Resonance gate: check if two vectors are semantically similar.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @param {number} threshold
 * @returns {{ resonance: number, resonant: boolean }}
 */
function resonance_gate(a, b, threshold = 0.75) {
    _stats.resonanceGateCalls++;
    const resonance = cosineSimilarity(a, b);
    return { resonance, resonant: resonance >= threshold };
}

/**
 * Multi-resonance: rank multiple targets against a query.
 */
function multi_resonance(queryVec, targets, threshold = 0.3) {
    return targets
        .map(t => ({
            id: t.id,
            resonance: cosineSimilarity(queryVec, t.vector),
        }))
        .filter(t => t.resonance >= threshold)
        .sort((a, b) => b.resonance - a.resonance);
}

module.exports = {
    // Vector ops
    normalize,
    weighted_superposition,
    batch_orthogonal,
    cosineSimilarity,

    // Gates
    ternary_gate,
    soft_gate,
    route_gate,
    resonance_gate,
    multi_resonance,

    // Stats
    getStats,

    // Constants
    PHI,
};
