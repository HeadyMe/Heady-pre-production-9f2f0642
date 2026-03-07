/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Test Suite: HS-058 Continuous Semantic Logic Gates ──────────────────────
 *
 * Patent Docket: HS-058
 * Tests every claim of the CSL gates implementation.
 * Uses no external dependencies — pure Node.js assert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
    PHI,
    dot_product,
    norm,
    normalize,
    cosine_similarity,
    soft_gate,
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,
    getStats,
    resetStats,
    CSLSystem,
    defaultCSL,
} = require('../src/core/csl-gates-enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// Simple test runner
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

function approx(a, b, tol = 1e-4) {
    return Math.abs(a - b) <= tol;
}

// Helper: make a unit vector of a specific dimension pointing in direction i
function unitVec(dim, i) {
    const v = new Float32Array(dim);
    v[i] = 1.0;
    return v;
}

// Helper: make a random 128-dim vector
function randVec128() {
    const v = new Float32Array(128);
    for (let i = 0; i < 128; i++) v[i] = Math.random() * 2 - 1;
    return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATH PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Vector Math Primitives ===');

test('dot_product: [1,0]·[1,0] = 1', () => {
    assert.strictEqual(dot_product([1, 0], [1, 0]), 1);
});

test('dot_product: [1,0]·[0,1] = 0', () => {
    assert.strictEqual(dot_product([1, 0], [0, 1]), 0);
});

test('norm: [3,4] = 5', () => {
    assert.ok(approx(norm([3, 4]), 5));
});

test('normalize: result is unit vector', () => {
    const v = normalize([3, 4]);
    assert.ok(approx(norm(v), 1.0));
});

test('cosine_similarity: identical vectors = 1', () => {
    const v = [1, 2, 3, 4];
    assert.ok(approx(cosine_similarity(v, v), 1.0));
});

test('cosine_similarity: orthogonal vectors = 0', () => {
    assert.ok(approx(cosine_similarity([1, 0], [0, 1]), 0.0));
});

test('cosine_similarity: opposite vectors = -1', () => {
    assert.ok(approx(cosine_similarity([1, 0], [-1, 0]), -1.0));
});

test('cosine_similarity: empty vectors return 0', () => {
    assert.strictEqual(cosine_similarity([], []), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 1: Resonance Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1: Resonance Gate ===');

test('Claim 1: returns structured result with score and activation', () => {
    const a = randVec128();
    const b = randVec128();
    const result = resonance_gate(a, b);
    assert.ok('score'      in result, 'missing score');
    assert.ok('activation' in result, 'missing activation');
    assert.ok('open'       in result, 'missing open');
});

test('Claim 1(a): accepts N=128 dimensional vectors', () => {
    const a = randVec128();
    const b = randVec128();
    assert.doesNotThrow(() => resonance_gate(a, b));
});

test('Claim 1(b): score is cosine similarity in [-1, 1]', () => {
    const a = randVec128();
    const b = randVec128();
    const { score } = resonance_gate(a, b);
    assert.ok(score >= -1 && score <= 1, `score ${score} out of range`);
});

test('Claim 1(c): activation is sigmoid output in [0, 1]', () => {
    const a = randVec128();
    const b = randVec128();
    const { activation } = resonance_gate(a, b);
    assert.ok(activation >= 0 && activation <= 1, `activation ${activation} out of range`);
});

test('Claim 1(d): identical vectors → score ≈ 1, open = true', () => {
    const v = randVec128();
    const { score, open } = resonance_gate(v, v, 0.5);
    assert.ok(approx(score, 1.0, 1e-4));
    assert.strictEqual(open, true);
});

test('Claim 1: throws on missing vector', () => {
    assert.throws(() => resonance_gate(null, [1, 0]));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 2: Superposition Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 2: Superposition Gate ===');

test('Claim 2: result is a unit vector', () => {
    const a = randVec128();
    const b = randVec128();
    const result = superposition_gate(a, b);
    assert.ok(approx(norm(result), 1.0), `norm ${norm(result)} ≠ 1`);
});

test('Claim 2(b): fusing a vector with itself gives the same direction', () => {
    const v = normalize([1, 2, 3, 4]);
    const result = superposition_gate(v, v);
    // normalize(v + v) = normalize(2v) = v
    for (let i = 0; i < v.length; i++) {
        assert.ok(approx(result[i], v[i], 1e-5), `component ${i} mismatch`);
    }
});

test('Claim 2(d): returns a new hybrid semantic concept (Float32Array)', () => {
    const a = randVec128();
    const b = randVec128();
    const result = superposition_gate(a, b);
    assert.ok(result instanceof Float32Array);
    assert.strictEqual(result.length, 128);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 3: Orthogonal Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 3: Orthogonal Gate ===');

test('Claim 3: result is unit vector', () => {
    const t = randVec128();
    const r = randVec128();
    const result = orthogonal_gate(t, r);
    assert.ok(approx(norm(result), 1.0), `norm ${norm(result)} ≠ 1`);
});

test('Claim 3(b): rejection vector is removed (dot product ≈ 0)', () => {
    const target = new Float32Array([1, 1, 0, 0]);
    const reject = new Float32Array([1, 0, 0, 0]);
    const result = orthogonal_gate(target, reject);
    const dotWithReject = dot_product(result, reject);
    assert.ok(Math.abs(dotWithReject) < 1e-5, `dot with reject = ${dotWithReject}`);
});

test('Claim 3(c): result normalized to unit vector', () => {
    const t = randVec128();
    const r = randVec128();
    const result = orthogonal_gate(t, r);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 4: Multi-Resonance
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 4: Multi-Resonance ===');

test('Claim 4: returns sorted array of results', () => {
    const target = randVec128();
    const candidates = [randVec128(), randVec128(), randVec128()];
    const results = multi_resonance(target, candidates);
    assert.strictEqual(results.length, 3);
    // Should be sorted descending by score
    for (let i = 0; i < results.length - 1; i++) {
        assert.ok(results[i].score >= results[i + 1].score,
            `results not sorted at ${i}: ${results[i].score} < ${results[i + 1].score}`);
    }
});

test('Claim 4: includes index, score, activation, open fields', () => {
    const target = randVec128();
    const candidates = [randVec128()];
    const [r] = multi_resonance(target, candidates);
    assert.ok('index'      in r);
    assert.ok('score'      in r);
    assert.ok('activation' in r);
    assert.ok('open'       in r);
});

test('Claim 4: identical target in candidates gets score ≈ 1', () => {
    const v = randVec128();
    const candidates = [randVec128(), v, randVec128()];
    const results = multi_resonance(v, candidates);
    // The identical vector should be at the top after sorting
    assert.ok(approx(results[0].score, 1.0, 1e-4));
});

test('Claim 4: empty candidates returns empty array', () => {
    const results = multi_resonance(randVec128(), []);
    assert.deepStrictEqual(results, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 5: Weighted Superposition
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 5: Weighted Superposition ===');

test('Claim 5: alpha=1.0 returns direction of vec_a', () => {
    const a = normalize([1, 2, 3, 4]);
    const b = normalize([5, 6, 7, 8]);
    const result = weighted_superposition(a, b, 1.0);
    // normalize(1.0*a + 0.0*b) = a
    for (let i = 0; i < a.length; i++) {
        assert.ok(approx(result[i], a[i], 1e-5));
    }
});

test('Claim 5: alpha=0.0 returns direction of vec_b', () => {
    const a = normalize([1, 2, 3, 4]);
    const b = normalize([5, 6, 7, 8]);
    const result = weighted_superposition(a, b, 0.0);
    for (let i = 0; i < b.length; i++) {
        assert.ok(approx(result[i], b[i], 1e-5));
    }
});

test('Claim 5: result is always unit vector', () => {
    const a = randVec128();
    const b = randVec128();
    const result = weighted_superposition(a, b, 0.3);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 5: alpha out of range throws', () => {
    assert.throws(() => weighted_superposition([1], [1], 1.5));
    assert.throws(() => weighted_superposition([1], [1], -0.1));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 6: Consensus Superposition
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 6: Consensus Superposition ===');

test('Claim 6: returns unit vector for N vectors', () => {
    const vectors = [randVec128(), randVec128(), randVec128(), randVec128()];
    const result  = consensus_superposition(vectors);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 6: fusing a single vector returns same direction', () => {
    const v = normalize([1, 2, 3, 4]);
    const result = consensus_superposition([v]);
    for (let i = 0; i < v.length; i++) {
        assert.ok(approx(result[i], v[i], 1e-5));
    }
});

test('Claim 6: empty input returns empty Float32Array', () => {
    const result = consensus_superposition([]);
    assert.strictEqual(result.length, 0);
});

test('Claim 6: fusing 5 random 128-dim vectors produces unit vector', () => {
    const vectors = Array.from({ length: 5 }, () => randVec128());
    const result  = consensus_superposition(vectors);
    assert.ok(approx(norm(result), 1.0, 1e-5));
    assert.strictEqual(result.length, 128);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 7: Batch Orthogonal
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 7: Batch Orthogonal ===');

test('Claim 7: result is unit vector', () => {
    const t = randVec128();
    const rejects = [randVec128(), randVec128()];
    const result = batch_orthogonal(t, rejects);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 7: removes influence of both rejection vectors', () => {
    const target  = new Float32Array([1, 1, 1, 0]);
    const r1      = new Float32Array([1, 0, 0, 0]);
    const r2      = new Float32Array([0, 1, 0, 0]);
    const result  = batch_orthogonal(target, [r1, r2]);
    // After removing x and y components, only z component should remain
    assert.ok(Math.abs(dot_product(result, r1)) < 1e-5);
    assert.ok(Math.abs(dot_product(result, r2)) < 1e-5);
});

test('Claim 7: single rejection matches orthogonal_gate', () => {
    const t = randVec128();
    const r = randVec128();
    const single = orthogonal_gate(t, r);
    const batch  = batch_orthogonal(t, [r]);
    for (let i = 0; i < single.length; i++) {
        assert.ok(approx(single[i], batch[i], 1e-5));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 8: Configurable Sigmoid Steepness and Threshold
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 8: Configurable Sigmoid ===');

test('Claim 8: high steepness produces sharp transition (Δactivation > low steepness)', () => {
    const score = 0.6;
    const threshold = 0.5;
    const highSteepness = soft_gate(score, threshold, 100);
    const lowSteepness  = soft_gate(score, threshold, 1);
    assert.ok(highSteepness > lowSteepness,
        `high=${highSteepness} should be > low=${lowSteepness}`);
});

test('Claim 8: score at threshold returns 0.5 regardless of steepness', () => {
    assert.ok(approx(soft_gate(0.5, 0.5, 1),   0.5, 1e-6));
    assert.ok(approx(soft_gate(0.5, 0.5, 20),  0.5, 1e-6));
    assert.ok(approx(soft_gate(0.5, 0.5, 100), 0.5, 1e-6));
});

test('Claim 8: activation always in [0, 1]', () => {
    for (const score of [-1, -0.5, 0, 0.5, 1]) {
        const act = soft_gate(score, 0.5, 20);
        assert.ok(act >= 0 && act <= 1, `activation ${act} out of range`);
    }
});

test('Claim 8: resonance_gate accepts threshold and steepness params', () => {
    const a = randVec128();
    const b = randVec128();
    const r = resonance_gate(a, b, 0.3, 50);
    assert.ok('activation' in r);
    assert.strictEqual(r.threshold, 0.3);
    assert.strictEqual(r.steepness, 50);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 9: Statistics Module
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 9: Statistics Module ===');

test('Claim 9(d): getStats returns invocation counts', () => {
    resetStats();
    resonance_gate(randVec128(), randVec128());
    resonance_gate(randVec128(), randVec128());
    superposition_gate(randVec128(), randVec128());
    orthogonal_gate(randVec128(), randVec128());
    const stats = getStats();
    assert.ok(stats.resonance   >= 2, `resonance=${stats.resonance}`);
    assert.ok(stats.superposition >= 1);
    assert.ok(stats.orthogonal  >= 1);
    assert.ok(stats.totalCalls  >= 4);
});

test('Claim 9(d): getStats returns avgResonanceScore', () => {
    resetStats();
    const v = randVec128();
    resonance_gate(v, v);  // score ≈ 1
    const stats = getStats();
    assert.ok(stats.avgResonanceScore > 0.99, `avgResonanceScore=${stats.avgResonanceScore}`);
});

test('Claim 9(d): resetStats clears all counters', () => {
    resonance_gate(randVec128(), randVec128());
    resetStats();
    const stats = getStats();
    assert.strictEqual(stats.resonance,   0);
    assert.strictEqual(stats.totalCalls,  0);
    assert.strictEqual(stats.avgResonanceScore, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 9: CSLSystem (OOP API)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 9: CSLSystem Class ===');

test('Claim 9: CSLSystem has all gate methods', () => {
    const csl = new CSLSystem();
    assert.strictEqual(typeof csl.resonance,            'function');
    assert.strictEqual(typeof csl.multiResonance,       'function');
    assert.strictEqual(typeof csl.superposition,        'function');
    assert.strictEqual(typeof csl.weightedSuperposition,'function');
    assert.strictEqual(typeof csl.consensusSuperposition,'function');
    assert.strictEqual(typeof csl.orthogonal,           'function');
    assert.strictEqual(typeof csl.batchOrthogonal,      'function');
    assert.strictEqual(typeof csl.softGate,             'function');
    assert.strictEqual(typeof csl.getStats,             'function');
});

test('Claim 9: CSLSystem.resonance works end-to-end', () => {
    const csl = new CSLSystem({ threshold: 0.5, steepness: 20 });
    const v = randVec128();
    const r = csl.resonance(v, v);
    assert.ok(approx(r.score, 1.0, 1e-4));
    assert.strictEqual(r.open, true);
});

test('Claim 9: defaultCSL instance is exported', () => {
    assert.ok(defaultCSL instanceof CSLSystem);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 10: Replacement Integration Points
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 10: Replacement Integration Points ===');

test('Claim 10: vectorMemoryDensityGate returns isDuplicate + score', () => {
    const csl = new CSLSystem();
    const v = randVec128();
    const result = csl.vectorMemoryDensityGate(v, v, 0.92);
    assert.ok('isDuplicate' in result);
    assert.ok('score'       in result);
    assert.ok('activation'  in result);
    assert.strictEqual(result.isDuplicate, true);  // identical = duplicate
});

test('Claim 10: hybridSearchScore returns sorted scored docs', () => {
    const csl = new CSLSystem();
    const query = randVec128();
    const docs  = [randVec128(), randVec128(), randVec128()];
    const results = csl.hybridSearchScore(query, docs);
    assert.strictEqual(results.length, 3);
    for (let i = 0; i < results.length - 1; i++) {
        assert.ok(results[i].score >= results[i + 1].score);
    }
});

test('Claim 10: hallucinationDetectionGate works with identical vectors', () => {
    const csl = new CSLSystem();
    const v = randVec128();
    const result = csl.hallucinationDetectionGate(v, v, 0.7);
    assert.ok('hallucinated' in result);
    assert.strictEqual(result.hallucinated, false);  // identical = not hallucinated
});

// ─────────────────────────────────────────────────────────────────────────────
// PHI CONSTANT
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== PHI Constant ===');

test('PHI = 1.6180339887', () => {
    assert.strictEqual(PHI, 1.6180339887);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`);
console.log(`HS-058 CSL Gates: ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────`);

if (failed > 0) process.exit(1);
