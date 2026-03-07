'use strict';

/**
 * test-semantic-bee-dispatcher.js
 *
 * Tests for SemanticBeeDispatcher using mock CSL + PhiScale modules.
 * The LCG hash embedder produces near-random 384-dim vectors, so
 * tests inject a controlled CSL mock that returns meaningful similarity
 * scores for dispatch scenarios.
 *
 * Run: node tests/semantic-routing/test-semantic-bee-dispatcher.js
 */

const assert = require('assert');
const Module = require('module');

// ── Constants ──────────────────────────────────────────────────────────────

const PHI         = 1.618033988749895;
const PHI_INVERSE = 0.618033988749895;
const EMBED_DIM   = 384;
const OBSERVER_FLOOR = 0.30;  // matches the real module constant

// ── Mock embed (same LCG as the real module) ──────────────────────────────

function _embed(text, dim = EMBED_DIM) {
    const vec = new Float32Array(dim);
    let seed  = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    let s = seed || 1;
    for (let i = 0; i < dim; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        vec[i] = (s / 0xffffffff) * 2 - 1;
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < dim; i++) vec[i] /= norm;
    return vec;
}

function _cos(a, b) {
    let d = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) d += a[i] * b[i];
    return Math.max(-1, Math.min(1, d));
}

function _normalize(v) {
    const out  = new Float32Array(v.length);
    let norm   = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
}

// ── Controlled dispatch mode ───────────────────────────────────────────────
// We need to control multi_resonance so we can inject scores > OBSERVER_FLOOR.
// The flag below, when true, makes multi_resonance return scores that ensure
// at least the first candidate passes OBSERVER_FLOOR.
let _forcedScores = null;  // null = use real cos; array of numbers = override

const mockCSL = {
    normalize: _normalize,
    cosine_similarity: _cos,
    dot_product: _cos,
    norm(v) { let n=0; for(let i=0;i<v.length;i++) n+=v[i]*v[i]; return Math.sqrt(n); },
    resonance_gate(a, b, t=0.95) { const s=_cos(a,b); return { score:s, open:s>=t }; },
    multi_resonance(target, candidates, threshold = 0.95) {
        const scores = candidates.map((c, i) => {
            const score = _forcedScores ? (_forcedScores[i] ?? _cos(target, c)) : _cos(target, c);
            return { index: i, score, open: score >= threshold };
        });
        return scores.sort((a, b) => b.score - a.score);
    },
    consensus_superposition(vecs) {
        if (!vecs || !vecs.length) return new Float32Array(EMBED_DIM);
        const sum = new Float32Array(vecs[0].length);
        for (const v of vecs) for (let i = 0; i < v.length; i++) sum[i] += v[i];
        return _normalize(sum);
    },
    weighted_superposition(a, b, alpha=0.5) {
        const out = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = a[i]*alpha + b[i]*(1-alpha);
        return _normalize(out);
    },
    soft_gate(s, t=0.5, k=20) { return 1/(1+Math.exp(-k*(s-t))); },
    getStats() { return {}; },
    resetStats() {},
};
mockCSL.CSL = mockCSL;

// ── Mock PhiScales ─────────────────────────────────────────────────────────

class MockPhiScale {
    constructor(o={}) {
        this._val = o.baseValue ?? PHI_INVERSE;
        this._min = o.min ?? 0;
        this._max = o.max ?? 1;
    }
    get value() { return this._val; }
    adjust(m) {
        if (m && typeof m.serviceHealthRatio === 'number') {
            const nudge  = (m.serviceHealthRatio - 0.5) * 0.01;
            this._val = Math.max(this._min, Math.min(this._max, this._val + nudge));
        }
    }
}

const mockPhiScales = {
    PhiScale: MockPhiScale,
    PhiRange:  class {},
    PHI, PHI_INVERSE,
    PHI_SQUARED:  PHI*PHI,
    SQRT_PHI:     Math.sqrt(PHI),
    LOG_PHI:      Math.log(PHI),
    TWO_PI_PHI:   2*Math.PI*PHI,
    FIBONACCI_SEQUENCE: [1,1,2,3,5,8,13,21,34],
};

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };

// ── Inject mocks into require cache ───────────────────────────────────────

require.cache[require.resolve('../../src/core/semantic-logic')] = {
    id: 'mock-csl', filename: 'mock-csl', loaded: true, exports: mockCSL,
};
require.cache[require.resolve('../../src/core/phi-scales')] = {
    id: 'mock-phi', filename: 'mock-phi', loaded: true, exports: mockPhiScales,
};
require.cache[require.resolve('../../src/utils/logger')] = {
    id: 'mock-log', filename: 'mock-log', loaded: true, exports: mockLogger,
};

delete require.cache[require.resolve('../../src/bees/semantic-bee-dispatcher')];
const { SemanticBeeDispatcher } = require('../../src/bees/semantic-bee-dispatcher');

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        if (process.env.VERBOSE) console.error(err.stack);
        failed++;
    }
}

// ── Helper: create dispatcher with forced-score dispatch ──────────────────

function makeDispatcherWithScores(scores, threshold = 0.01) {
    _forcedScores = scores;
    const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: threshold });
    return d;
}

function resetForcedScores() { _forcedScores = null; }

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-semantic-bee-dispatcher]');

    // ── test_constructor ───────────────────────────────────────────────────
    await runTest('test_constructor', () => {
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.7, maxActiveBees: 10 });
        assert.strictEqual(d.phiEquilibriumThreshold, 0.7, 'phiEquilibriumThreshold stored');
        assert.strictEqual(d.maxActiveBees,           10,  'maxActiveBees stored');
        assert.strictEqual(d.embeddingDimension,      384, 'default embeddingDimension=384');
        assert.ok(d._bees instanceof Map, '_bees is Map');
        assert.strictEqual(d._stats.totalDispatches, 0, 'totalDispatches=0 initially');
    });

    // ── test_register_bee ──────────────────────────────────────────────────
    await runTest('test_register_bee', () => {
        const d = new SemanticBeeDispatcher();
        d.registerBee('bee-alpha', [
            { description: 'Deploy containerised applications to Kubernetes', weight: 1.0 },
            { description: 'Manage Helm releases and rollbacks', weight: 0.8 },
        ]);
        assert.ok(d._bees.has('bee-alpha'), 'bee-alpha in registry');
        const bee = d._bees.get('bee-alpha');
        assert.strictEqual(bee.beeId, 'bee-alpha',        'beeId stored');
        assert.strictEqual(bee.capabilities.length, 2,    'both capabilities stored');
        assert.ok(bee.composite instanceof Float32Array,  'composite is Float32Array');
        assert.strictEqual(bee.composite.length, 384,     'composite is 384-dim');
        assert.strictEqual(d._stats.totalBeesRegistered, 1, 'totalBeesRegistered=1');
    });

    // ── test_register_bee_empty_capabilities_throws ────────────────────────
    await runTest('test_register_bee_empty_capabilities_throws', () => {
        const d = new SemanticBeeDispatcher();
        assert.throws(
            () => d.registerBee('bee-empty', []),
            (err) => err.message.includes('non-empty array'),
            'empty capabilities throws'
        );
    });

    // ── test_dispatch_basic ────────────────────────────────────────────────
    await runTest('test_dispatch_basic', () => {
        // Force scores above OBSERVER_FLOOR (0.30) for both bees
        // First bee gets score > threshold, second gets score > OBSERVER_FLOOR
        _forcedScores = [0.75, 0.35];
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.50 });
        d.registerBee('deploy-bee',  [{ description: 'Deploy applications to cloud', weight: 1 }]);
        d.registerBee('review-bee',  [{ description: 'Review code quality', weight: 1 }]);

        const result = d.dispatch({ input: 'Deploy the new release to production' });
        _forcedScores = null;

        assert.ok(Array.isArray(result.dispatched),   'dispatched is array');
        assert.ok(Array.isArray(result.undispatched), 'undispatched is array');
        assert.ok(result.dispatched.length > 0, `at least one bee dispatched, got ${result.dispatched.length}`);

        const primary = result.dispatched.find(b => b.role === 'primary');
        assert.ok(primary, 'a primary bee exists');
        assert.ok(typeof primary.relevance === 'number', 'primary has numeric relevance');
        assert.ok(primary.relevance >= 0 && primary.relevance <= 1, `relevance in [0,1]: ${primary.relevance}`);

        assert.strictEqual(d._stats.totalDispatches, 1, 'totalDispatches=1');
    });

    // ── test_dispatch_multi_activation ────────────────────────────────────
    await runTest('test_dispatch_multi_activation', () => {
        // All bees get score > threshold so all activate with different roles
        _forcedScores = [0.82, 0.70, 0.65];
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.60 });
        d.registerBee('code-bee',     [{ description: 'Write and implement code', weight: 1 }]);
        d.registerBee('security-bee', [{ description: 'Security audits and vulnerability scans', weight: 1 }]);
        d.registerBee('docs-bee',     [{ description: 'Write technical documentation', weight: 1 }]);

        const result = d.dispatch({ input: 'Implement secure code with documentation' });
        _forcedScores = null;

        assert.ok(result.dispatched.length >= 3, `all 3 bees dispatched, got ${result.dispatched.length}`);

        const roles = result.dispatched.map(b => b.role);
        assert.ok(roles.includes('primary'),   'has primary role');
        assert.ok(roles.includes('secondary'), 'has secondary role');

        for (const entry of result.dispatched) {
            assert.ok(typeof entry.relevance === 'number', `${entry.beeId} relevance is number`);
            assert.ok(['primary', 'secondary', 'observer'].includes(entry.role), `${entry.beeId} has valid role`);
        }

        // Primary should be highest relevance
        const primary = result.dispatched.find(b => b.role === 'primary');
        for (const other of result.dispatched.filter(b => b.role !== 'primary')) {
            assert.ok(primary.relevance >= other.relevance - 1e-9,
                `primary (${primary.relevance}) >= ${other.role} (${other.relevance})`);
        }
    });

    // ── test_dispatch_collaborative ───────────────────────────────────────
    await runTest('test_dispatch_collaborative', () => {
        _forcedScores = [0.80, 0.70];
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.60 });
        d.registerBee('infra-bee', [{ description: 'Infrastructure provisioning', weight: 1 }]);
        d.registerBee('db-bee',    [{ description: 'Database migrations', weight: 1 }]);

        const result = d.dispatchCollaborative({
            input:   'Set up cloud infrastructure with database migrations',
            context: { environment: 'production' },
        });
        _forcedScores = null;

        assert.ok(result.hasOwnProperty('team'),          'has team');
        assert.ok(result.hasOwnProperty('teamCoherence'), 'has teamCoherence');
        assert.ok(typeof result.teamCoherence === 'number', 'teamCoherence is number');
        assert.ok(result.teamCoherence >= 0 && result.teamCoherence <= 1,
            `teamCoherence in [0,1]: ${result.teamCoherence}`);
        // Both bees above threshold → team of 2
        assert.ok(result.team.length >= 1, `team has at least 1 member: ${result.team.length}`);
        for (const member of result.team) {
            assert.ok(member.hasOwnProperty('beeId'),        `${member.beeId} has beeId`);
            assert.ok(member.hasOwnProperty('weight'),       `${member.beeId} has weight`);
            assert.ok(member.hasOwnProperty('capabilities'), `${member.beeId} has capabilities`);
        }
    });

    // ── test_detect_dead_bees ─────────────────────────────────────────────
    await runTest('test_detect_dead_bees', () => {
        // History is ONLY tracked when a bee receives a dispatch role.
        // A bee gets role='observer' when score >= OBSERVER_FLOOR (0.30).
        // A bee with no role (score < 0.30) is never tracked → not classified.
        // So use:
        //   relevant-bee:   score=0.70 → primary (above threshold=0.50) → active
        //   irrelevant-bee: score=0.35 → observer (0.30 ≤ 0.35 < 0.50) → history tracked
        //     → highestRecentMatch=0.35 < threshold=0.50 AND avgRelevance=0.35 >= 0.30 → zombie
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.50 });
        d.registerBee('relevant-bee',   [{ description: 'Write code', weight: 1 }]);
        d.registerBee('irrelevant-bee', [{ description: 'Yoga exercises and wellness', weight: 1 }]);

        // Simulate 25 dispatches with controlled relevance scores
        // relevant-bee: 0.70 (above threshold=0.50 → primary → active)
        // irrelevant-bee: 0.35 (observer range: 0.30 <= 0.35 < 0.50 → observer → zombie)
        for (let i = 0; i < 25; i++) {
            _forcedScores = [0.70, 0.35];
            d.dispatch({ input: `Write code for endpoint ${i}` });
            _forcedScores = null;
        }

        const detection = d.detectDeadBees();
        assert.ok(detection.hasOwnProperty('deadBees'),   'has deadBees');
        assert.ok(detection.hasOwnProperty('activeBees'), 'has activeBees');
        assert.ok(detection.hasOwnProperty('zombieBees'), 'has zombieBees');
        assert.ok(Array.isArray(detection.deadBees),      'deadBees is array');

        // Both bees have history → both are classified (one active, one zombie)
        const totalClassified = detection.deadBees.length + detection.activeBees.length + detection.zombieBees.length;
        assert.strictEqual(totalClassified, 2, `all 2 bees classified (got ${totalClassified})`);

        // relevant-bee should be active (relevance=0.70 > threshold=0.50)
        assert.ok(detection.activeBees.includes('relevant-bee'),
            'relevant-bee is in activeBees');
        // irrelevant-bee: score=0.35 < threshold=0.50 but >= OBSERVER_FLOOR=0.30 → zombie
        const zombieIds = detection.zombieBees.map(b => b.beeId);
        assert.ok(zombieIds.includes('irrelevant-bee') || detection.deadBees.map(b=>b.beeId).includes('irrelevant-bee'),
            `irrelevant-bee is classified as zombie or dead (zombies: [${zombieIds}])`);
    });

    // ── test_recycle_bee ──────────────────────────────────────────────────
    await runTest('test_recycle_bee', () => {
        const d = new SemanticBeeDispatcher();
        d.registerBee('temp-bee', [
            { description: 'Handle legacy SOAP integrations', weight: 1 },
        ]);
        assert.ok(d._bees.has('temp-bee'), 'temp-bee registered');

        const result = d.recycleBee('temp-bee');
        assert.ok(result.removed,                       'removed=true');
        assert.ok(Array.isArray(result.capabilityGap),  'capabilityGap is array');
        assert.ok(result.capabilityGap.length > 0,      'capabilityGap has entries');
        assert.ok(!d._bees.has('temp-bee'),             'bee removed from registry');
        assert.strictEqual(d._stats.totalBeesRecycled, 1, 'totalBeesRecycled=1');

        const r2 = d.recycleBee('ghost-bee');
        assert.strictEqual(r2.removed, false, 'removed=false for unknown bee');
    });

    // ── test_rebalance_overlapping ────────────────────────────────────────
    await runTest('test_rebalance_overlapping', () => {
        // Use real cosine similarity for rebalancing (it operates on static vectors)
        // Two bees with near-identical descriptions → same seed → same vector → sim=1.0
        const d = new SemanticBeeDispatcher();
        d.registerBee('bee-a', [{ description: 'Write JavaScript code for Node.js', weight: 1 }]);
        d.registerBee('bee-b', [{ description: 'Write JavaScript code for Node.js', weight: 1 }]); // identical
        d.registerBee('bee-c', [{ description: 'Security vulnerability scanning', weight: 1 }]);

        const result = d.rebalanceCapabilities();
        assert.ok(result.hasOwnProperty('overlaps'),        'has overlaps');
        assert.ok(result.hasOwnProperty('gaps'),            'has gaps');
        assert.ok(result.hasOwnProperty('recommendations'), 'has recommendations');
        assert.ok(Array.isArray(result.overlaps),           'overlaps is array');
        // bee-a and bee-b have identical descriptions → identical vectors → sim=1.0 → overlap detected
        assert.ok(result.overlaps.length >= 1, `bee-a and bee-b should overlap (identical descriptions)`);
        const overlap = result.overlaps.find(o => (o.beeA==='bee-a'&&o.beeB==='bee-b')||(o.beeA==='bee-b'&&o.beeB==='bee-a'));
        assert.ok(overlap, 'overlap between bee-a and bee-b detected');
        assert.ok(overlap.similarity >= 0.9, `similarity ${overlap.similarity} >= 0.9`);
    });

    // ── test_rebalance_gaps ───────────────────────────────────────────────
    await runTest('test_rebalance_gaps', () => {
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.99 });
        d.registerBee('code-bee',  [{ description: 'Write and review code', weight: 1 }]);
        // Register and recycle a niche bee — creates a gap in coverage
        d.registerBee('niche-bee', [{ description: 'Quantum circuit simulation', weight: 1 }]);
        d.recycleBee('niche-bee');

        const result = d.rebalanceCapabilities();
        assert.ok(result.hasOwnProperty('gaps'), 'has gaps');
        assert.ok(Array.isArray(result.gaps),    'gaps is array');
        if (result.gaps.length > 0) {
            assert.ok(result.gaps[0].hasOwnProperty('description'), 'gap has description');
        }
    });

    // ── test_dispatch_no_match ────────────────────────────────────────────
    await runTest('test_dispatch_no_match', () => {
        const d = new SemanticBeeDispatcher();
        const result = d.dispatch({ input: 'Some task' });
        assert.deepStrictEqual(result.dispatched,   [], 'no bees → empty dispatched');
        assert.deepStrictEqual(result.undispatched, [], 'no bees → empty undispatched');
    });

    // ── test_stats ────────────────────────────────────────────────────────
    await runTest('test_stats', () => {
        _forcedScores = [0.65];
        const d = new SemanticBeeDispatcher({ phiEquilibriumThreshold: 0.50 });
        d.registerBee('stat-bee', [{ description: 'Handle analytics', weight: 1 }]);

        d.dispatch({ input: 'Generate analytics report' });
        d.dispatch({ input: 'Process statistical data' });
        _forcedScores = null;

        const stats = d.getStats();
        assert.ok(stats.hasOwnProperty('totalDispatches'),     'has totalDispatches');
        assert.ok(stats.hasOwnProperty('totalBeesRegistered'), 'has totalBeesRegistered');
        assert.ok(stats.hasOwnProperty('totalBeesRecycled'),   'has totalBeesRecycled');
        assert.ok(stats.hasOwnProperty('averageRelevance'),    'has averageRelevance');
        assert.ok(stats.hasOwnProperty('activeBeeCount'),      'has activeBeeCount');
        assert.ok(stats.hasOwnProperty('bees'),                'has bees');
        assert.strictEqual(stats.totalDispatches,     2, 'totalDispatches=2');
        assert.strictEqual(stats.totalBeesRegistered, 1, 'totalBeesRegistered=1');
        assert.strictEqual(stats.activeBeeCount,      1, 'activeBeeCount=1');
        assert.ok(Array.isArray(stats.bees), 'stats.bees is array');
        assert.strictEqual(stats.bees.length, 1, 'stats.bees has 1 entry');
        assert.ok(stats.bees[0].hasOwnProperty('beeId'),          'bee stat has beeId');
        assert.ok(stats.bees[0].hasOwnProperty('dispatchCount'),  'bee stat has dispatchCount');
    });

    // ── test_maxActiveBees_limit ──────────────────────────────────────────
    await runTest('test_maxActiveBees_limit', () => {
        const d = new SemanticBeeDispatcher({ maxActiveBees: 2 });
        d.registerBee('bee-1', [{ description: 'Handle task type one', weight: 1 }]);
        d.registerBee('bee-2', [{ description: 'Handle task type two', weight: 1 }]);
        assert.throws(
            () => d.registerBee('bee-3', [{ description: 'Handle task type three', weight: 1 }]),
            (err) => err.message.includes('maxActiveBees'),
            'exceeding maxActiveBees throws'
        );
    });
}

runTests().then(() => {
    console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
});
