/**
 * CSL Verification Suite v2.0
 * Tests all 7 operations of the Heady Continuous Semantic Logic engine.
 */

const CSL = require('../src/core/semantic-logic');

const DIM = 1536;
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0, failed = 0;

function assert(label, condition) {
    if (condition) { console.log(`  ${PASS} ${label}`); passed++; }
    else { console.log(`  ${FAIL} ${label}`); failed++; }
}

function randomVec(dim = DIM) {
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
    return CSL.normalize(v);
}

console.log('\n═══ Heady CSL Verification Suite v2.0 ═══\n');

// ── GATE 1: Resonance ──────────────────────────────────
console.log('Gate 1: Resonance (Semantic AND/IF)');
const a = randomVec();
const b = Float32Array.from(a); // identical
const c = randomVec();

const r1 = CSL.resonance_gate(a, b, 0.95);
assert('Identical vectors → score ≈ 1.0', r1.score > 0.99);
assert('Identical vectors → gate OPEN', r1.open === true);

const r2 = CSL.resonance_gate(a, c, 0.95);
assert('Random vectors → score ≈ 0', Math.abs(r2.score) < 0.15);
assert('Random vectors → gate CLOSED', r2.open === false);

// ── GATE 1b: Multi-Resonance ───────────────────────────
console.log('\nGate 1b: Multi-Resonance (N-way scoring)');
const candidates = [b, c, randomVec(), randomVec()];
const mr = CSL.multi_resonance(a, candidates, 0.95);
assert('Multi-resonance returns sorted array', mr[0].score >= mr[1].score);
assert('Best match is the identical vector', mr[0].score > 0.99);
assert('Returns correct count', mr.length === 4);

// ── GATE 2: Superposition ──────────────────────────────
console.log('\nGate 2: Superposition (Semantic OR/MERGE)');
const s1 = CSL.superposition_gate(a, c);
const norm = CSL.norm(s1);
assert('Superposition result is normalized', Math.abs(norm - 1.0) < 0.001);
assert('Hybrid differs from both inputs', CSL.cosine_similarity(s1, a) < 0.99);
assert('Hybrid has correct dimensions', s1.length === DIM);

// ── GATE 2b: Weighted Superposition ────────────────────
console.log('\nGate 2b: Weighted Superposition (biased fusion)');
const ws_full_a = CSL.weighted_superposition(a, c, 1.0);
assert('α=1.0 → result ≈ vec_a', CSL.cosine_similarity(ws_full_a, a) > 0.99);
const ws_full_c = CSL.weighted_superposition(a, c, 0.0);
assert('α=0.0 → result ≈ vec_b', CSL.cosine_similarity(ws_full_c, c) > 0.99);

// ── GATE 2c: Consensus Superposition ───────────────────
console.log('\nGate 2c: Consensus Superposition (N-way fusion)');
const consensus = CSL.consensus_superposition([a, b, a]);
assert('Consensus of same vectors ≈ original', CSL.cosine_similarity(consensus, a) > 0.99);
const mixed = CSL.consensus_superposition([randomVec(), randomVec(), randomVec()]);
assert('Consensus is normalized', Math.abs(CSL.norm(mixed) - 1.0) < 0.001);

// ── GATE 3: Orthogonal ─────────────────────────────────
console.log('\nGate 3: Orthogonal (Semantic NOT/REJECT)');
const o1 = CSL.orthogonal_gate(a, c);
const dotAfter = Math.abs(CSL.dot_product(o1, c));
assert('Orthogonal gate strips reject vector', dotAfter < 0.01);
assert('Result is normalized', Math.abs(CSL.norm(o1) - 1.0) < 0.01);

// ── GATE 3b: Batch Orthogonal ──────────────────────────
console.log('\nGate 3b: Batch Orthogonal (multi-strip)');
const rejects = [randomVec(), randomVec()];
const bo = CSL.batch_orthogonal(a, rejects);
assert('Batch orthogonal is normalized', Math.abs(CSL.norm(bo) - 1.0) < 0.01);

// ── SOFT GATE ──────────────────────────────────────────
console.log('\nSoft Gate (sigmoid activation)');
const sg1 = CSL.soft_gate(0.9, 0.5, 20);
assert('Score 0.9 at threshold 0.5 → activation ≈ 1.0', sg1 > 0.99);
const sg2 = CSL.soft_gate(0.1, 0.5, 20);
assert('Score 0.1 at threshold 0.5 → activation ≈ 0.0', sg2 < 0.01);
const sg3 = CSL.soft_gate(0.5, 0.5, 20);
assert('Score AT threshold → activation ≈ 0.5', Math.abs(sg3 - 0.5) < 0.01);

// ── STATS ──────────────────────────────────────────────
console.log('\nGate Statistics');
const stats = CSL.getStats();
assert('Stats track resonance calls', stats.resonance > 0);
assert('Stats track superposition calls', stats.superposition > 0);
assert('Stats track orthogonal calls', stats.orthogonal > 0);
assert('Stats track soft gate calls', stats.softGate > 0);
assert('Total calls counted', stats.totalCalls > 0);

// ── SUMMARY ────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`  Gate calls: ${stats.totalCalls}`);
console.log(`  Avg resonance score: ${stats.avgResonanceScore}`);
console.log(`═══════════════════════════════════════════\n`);

process.exit(failed > 0 ? 1 : 0);
