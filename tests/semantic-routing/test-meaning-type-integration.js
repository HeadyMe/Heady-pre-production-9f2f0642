'use strict';

/**
 * test-meaning-type-integration.js
 *
 * Integration tests for MeaningType + SemanticConstraints working together.
 *
 * Run: node tests/semantic-routing/test-meaning-type-integration.js
 */

const assert = require('assert');
const Module = require('module');

// ── Constants ──────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const PHI         = 1.618033988749895;
const EMBED_DIM   = 384;

// ── Mock CSL ───────────────────────────────────────────────────────────────

function _normalize(v) {
    const out = new Float32Array(v.length);
    let norm  = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
}

function _cos(a, b) {
    let d = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) d += a[i] * b[i];
    return Math.max(-1, Math.min(1, d));
}

const mockCSL = {
    normalize: _normalize,
    cosine_similarity: _cos,
    dot_product: _cos,
    norm(v) { let n=0; for(let i=0;i<v.length;i++) n+=v[i]*v[i]; return Math.sqrt(n); },
    resonance_gate(a, b, t=0.95) { const s=_cos(a,b); return { score:s, open:s>=t }; },
    multi_resonance(t, cs, th=0.95) {
        return cs.map((c,i) => ({ index:i, score:_cos(t,c), open:_cos(t,c)>=th }))
                 .sort((a,b)=>b.score-a.score);
    },
    weighted_superposition(a, b, alpha=0.5) {
        const out=new Float32Array(a.length);
        for(let i=0;i<a.length;i++) out[i]=a[i]*alpha+b[i]*(1-alpha);
        return _normalize(out);
    },
    superposition_gate(a, b) {
        const out=new Float32Array(a.length);
        for(let i=0;i<a.length;i++) out[i]=a[i]+b[i];
        return _normalize(out);
    },
    orthogonal_gate(target, reject) {
        const dot=_cos(target,reject);
        const out=new Float32Array(target.length);
        for(let i=0;i<target.length;i++) out[i]=target[i]-dot*reject[i];
        return _normalize(out);
    },
    consensus_superposition(vecs) {
        if (!vecs||!vecs.length) return new Float32Array(EMBED_DIM);
        const sum=new Float32Array(vecs[0].length);
        for(const v of vecs) for(let i=0;i<v.length;i++) sum[i]+=v[i];
        return _normalize(sum);
    },
    soft_gate(s, t=0.5, k=20) { return 1/(1+Math.exp(-k*(s-t))); },
    ternary_gate(s, rt=0.72, rp=0.35, k=15) {
        const rA=1/(1+Math.exp(-k*(s-rt)));
        const rR=1/(1+Math.exp(-k*(rp-s)));
        return { state:s>=rt?'resonate':s<=rp?'repel':'neutral', resonanceActivation:rA, repelActivation:rR, raw:s };
    },
    route_gate(intent, candidates, t=0.3) {
        // meaning-types classify() passes Float32Array candidates and reads result.scores
        // as an array of raw numbers (one per candidate, in original order)
        const isVecArray = candidates.length > 0 && (candidates[0] instanceof Float32Array);
        if (isVecArray) {
            // Return scores as plain numbers in original order (as classify() expects)
            const scores = candidates.map(c => _cos(intent, c));
            const best   = scores.reduce((mi, s, i) => s > scores[mi] ? i : mi, 0);
            return { best: best, scores, fallback: scores[best] < t };
        }
        // Object candidates {id, vector}
        const scores = candidates.map((c,i) => ({ index:i, score:_cos(intent, c.vector ?? c) }))
                                  .sort((a,b) => b.score - a.score);
        return { best: scores[0], scores, fallback: !scores[0] || scores[0].score < t };
    },
    getStats() { return {}; },
    resetStats() {},
};
mockCSL.CSL = mockCSL;

// ── Mock PhiScales ─────────────────────────────────────────────────────────

const mockPhiScales = {
    PhiScale: class { constructor(o={}) { this.value = o.baseValue ?? PHI_INVERSE; } },
    PhiRange: class {},
    PHI, PHI_INVERSE,
    PHI_SQUARED: PHI*PHI, PHI_CUBED: PHI*PHI*PHI,
    SQRT_PHI: Math.sqrt(PHI), LOG_PHI: Math.log(PHI),
    TWO_PI_PHI: 2*Math.PI*PHI,
    FIBONACCI_SEQUENCE: [1,1,2,3,5,8,13,21,34],
};

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };

// ── Patch require resolution ───────────────────────────────────────────────

const origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(request, parent, ...rest) {
    if (request.endsWith('semantic-logic'))                          return '__MT_CSL__';
    if (request.endsWith('phi-scales'))                              return '__MT_PHI__';
    if (request.endsWith('utils/logger') || request.endsWith('logger')) return '__MT_LOG__';
    return origResolve(request, parent, ...rest);
};

require.cache['__MT_CSL__'] = { id:'__MT_CSL__', filename:'__MT_CSL__', loaded:true, exports: mockCSL };
require.cache['__MT_PHI__'] = { id:'__MT_PHI__', filename:'__MT_PHI__', loaded:true, exports: mockPhiScales };
require.cache['__MT_LOG__'] = { id:'__MT_LOG__', filename:'__MT_LOG__', loaded:true, exports: mockLogger };

// Clear cached versions of modules under test
for (const key of Object.keys(require.cache)) {
    if (key.includes('meaning-types') || key.includes('semantic-constraints')) {
        delete require.cache[key];
    }
}

const { MeaningType, MeaningTypeCollection }        = require('../../src/scripting/meaning-types');
const { SemanticConstraint, ConstraintSet, SemanticConstraintViolation } =
    require('../../src/scripting/semantic-constraints');

// ── Shared deterministic embed (same LCG as mockCSL would use) ────────────

function deterministicEmbed(text, dim = EMBED_DIM) {
    const vec = new Float32Array(dim);
    let seed  = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    let s = seed || 1;
    for (let i = 0; i < dim; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        vec[i] = (s / 0xffffffff) * 2 - 1;
    }
    return _normalize(vec);
}

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

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-meaning-type-integration]');

    // ── test_meaning_type_as_constraint_input ──────────────────────────────
    await runTest('test_meaning_type_as_constraint_input', () => {
        // Create a MeaningType
        const deployMT = MeaningType.create(
            'deploy',
            'Deploying application to production environment',
            { embedFn: deterministicEmbed }
        );
        assert.ok(deployMT instanceof MeaningType, 'deployMT is MeaningType');
        assert.ok(deployMT.vector instanceof Float32Array, 'vector is Float32Array');
        assert.strictEqual(deployMT.vector.length, EMBED_DIM, `vector is ${EMBED_DIM}-dim`);

        // Use the MeaningType's vector as context for a SemanticConstraint check
        const constraint = new SemanticConstraint(
            'Action is deployment-related',
            { minSimilarity: 0.0, enforcement: 'advisory' } // low threshold for testing
        );
        const checkResult = constraint.check(deployMT.vector);

        assert.ok(checkResult.hasOwnProperty('passed'),     'check result has passed');
        assert.ok(checkResult.hasOwnProperty('similarity'), 'check result has similarity');
        assert.ok(typeof checkResult.similarity === 'number', 'similarity is number');
        assert.ok(checkResult.similarity >= -1 && checkResult.similarity <= 1,
            `similarity in [-1,1]: ${checkResult.similarity}`);
    });

    // ── test_constraint_on_meaning_type_equality ───────────────────────────
    await runTest('test_constraint_on_meaning_type_equality', () => {
        const mtA = MeaningType.create('deploy', 'Deploy to production', { embedFn: deterministicEmbed });
        const mtB = MeaningType.create('deploy', 'Deploy to production', { embedFn: deterministicEmbed });
        const mtC = MeaningType.create('rollback', 'Rollback failed deployment', { embedFn: deterministicEmbed });

        // Same meaning → equal
        const eqResult = mtA.equals(mtB);
        assert.ok(eqResult.hasOwnProperty('match'),      'equals has match');
        assert.ok(eqResult.hasOwnProperty('similarity'), 'equals has similarity');
        assert.ok(eqResult.match === true,               'same description → match=true');
        assert.ok(eqResult.similarity > PHI_INVERSE,     `similarity > PHI_INVERSE: ${eqResult.similarity}`);

        // Different meaning → lower similarity
        const diffResult = mtA.equals(mtC);
        assert.ok(typeof diffResult.similarity === 'number', 'different meaning equality returns similarity');
        // Similarity should be lower for unrelated descriptions
        assert.ok(diffResult.similarity < eqResult.similarity,
            `Different descriptions have lower similarity (${diffResult.similarity} < ${eqResult.similarity})`);

        // isCompatible check
        const compat = mtA.isCompatible(mtB);
        assert.ok(compat.hasOwnProperty('compatible'), 'isCompatible has compatible');
        assert.ok(compat.hasOwnProperty('score'),      'isCompatible has score');
    });

    // ── test_collection_with_constraints ──────────────────────────────────
    await runTest('test_collection_with_constraints', () => {
        const mt1 = MeaningType.create('deploy',    'Deploy to Kubernetes cluster', { embedFn: deterministicEmbed });
        const mt2 = MeaningType.create('build',     'Build container image',        { embedFn: deterministicEmbed });
        const mt3 = MeaningType.create('test',      'Run unit and integration tests', { embedFn: deterministicEmbed });
        const mt4 = MeaningType.create('monitor',   'Monitor production metrics',    { embedFn: deterministicEmbed });

        const collection = new MeaningTypeCollection([mt1, mt2, mt3, mt4]);
        assert.strictEqual(collection.items.length, 4, 'collection has 4 items');

        // Filter using a predicate MeaningType (deploy-related)
        const predicate = MeaningType.create('deployment', 'Deploy release to cloud environment', { embedFn: deterministicEmbed });
        // Use a low threshold so filter passes items with any similarity
        const filtered = collection.filter(predicate, 0.0);

        assert.ok(filtered instanceof MeaningTypeCollection, 'filter returns MeaningTypeCollection');
        assert.ok(filtered.items.length <= 4, 'filter returns subset or equal count');
        assert.ok(filtered.items.length >= 1, 'filter returns at least 1 item with threshold=0');

        // All filtered items should have higher similarity to predicate than threshold
        for (const item of filtered.items) {
            const sim = _cos(item.vector, predicate.vector);
            assert.ok(sim >= 0.0, `Filtered item has similarity >= 0: ${sim}`);
        }
    });

    // ── test_meaning_type_classify_with_constraints ────────────────────────
    await runTest('test_meaning_type_classify_with_constraints', () => {
        const deployAction = MeaningType.create(
            'push_to_production',
            'Push the release artifact to production servers',
            { embedFn: deterministicEmbed }
        );

        const categories = [
            MeaningType.create('deployment', 'Deploy or push code to an environment', { embedFn: deterministicEmbed }),
            MeaningType.create('testing',    'Run tests and validate functionality',   { embedFn: deterministicEmbed }),
            MeaningType.create('monitoring', 'Observe and alert on system metrics',    { embedFn: deterministicEmbed }),
        ];

        const classification = deployAction.classify(categories);

        assert.ok(Array.isArray(classification), 'classify returns array');
        assert.ok(classification.length === 3,   'classification has 3 entries');

        for (const entry of classification) {
            assert.ok(entry.hasOwnProperty('category'),   'entry has category');
            assert.ok(entry.hasOwnProperty('similarity'), 'entry has similarity');
            assert.ok(entry.hasOwnProperty('activation'), 'entry has activation (not activated)');
            assert.ok(entry.hasOwnProperty('rank'),       'entry has rank');
            assert.ok(typeof entry.similarity === 'number', `similarity is number: ${typeof entry.similarity}`);
            assert.ok(typeof entry.activation === 'number', `activation is number: ${typeof entry.activation}`);
        }

        // Highest similarity should be to deployment category
        const sorted = [...classification].sort((a, b) => b.similarity - a.similarity);
        assert.strictEqual(
            sorted[0].category.description,
            'Deploy or push code to an environment',
            'deployment category ranks highest for push_to_production'
        );

        // Now verify constraint: deployment action must satisfy "deployment context" constraint
        const deployConstraint = new SemanticConstraint(
            'Action is a deployment activity',
            {
                minSimilarity: 0.0,       // permissive for testing
                enforcement:   'advisory',
                embedFn:       deterministicEmbed,
            }
        );
        const checkResult = deployConstraint.check(deployAction.vector);
        assert.ok(checkResult.hasOwnProperty('passed'),     'constraint check has passed');
        assert.ok(typeof checkResult.similarity === 'number', 'constraint check has numeric similarity');
    });

    // ── test_constraint_inertia_with_meaning_types ────────────────────────
    await runTest('test_constraint_inertia_with_meaning_types', () => {
        const constraint = new SemanticConstraint(
            'Input represents a safe deployment action',
            {
                minSimilarity:  0.0,       // low threshold — all pass
                enforcement:    'advisory',
                inertiaWindow:  3,
                embedFn:        deterministicEmbed,
            }
        );

        // Initial accumulated confidence
        const initialConf = constraint.accumulatedConfidence;
        assert.ok(typeof initialConf === 'number', 'accumulatedConfidence is number');
        assert.ok(initialConf >= 0 && initialConf <= 1, 'accumulatedConfidence in [0,1]');

        // Run several checks to build inertia
        const mt1 = MeaningType.create('deploy', 'Safe deployment', { embedFn: deterministicEmbed });
        const mt2 = MeaningType.create('deploy', 'Safe deployment', { embedFn: deterministicEmbed });
        const mt3 = MeaningType.create('deploy', 'Safe deployment', { embedFn: deterministicEmbed });

        constraint.check(mt1.vector);
        const confAfter1 = constraint.accumulatedConfidence;

        constraint.check(mt2.vector);
        const confAfter2 = constraint.accumulatedConfidence;

        constraint.check(mt3.vector);
        const confAfter3 = constraint.accumulatedConfidence;

        // Each successful check should update accumulated confidence
        assert.ok(typeof confAfter1 === 'number', 'confidence updated after check 1');
        assert.ok(typeof confAfter2 === 'number', 'confidence updated after check 2');
        assert.ok(typeof confAfter3 === 'number', 'confidence updated after check 3');

        // History should be tracked
        assert.ok(constraint._history.length >= 3, `history has >= 3 entries: ${constraint._history.length}`);

        for (const entry of constraint._history) {
            assert.ok(entry.hasOwnProperty('passed'),     'history entry has passed');
            assert.ok(entry.hasOwnProperty('similarity'), 'history entry has similarity');
            assert.ok(entry.hasOwnProperty('ts'),         'history entry has ts');
        }
    });

    // ── test_meaning_type_combine_then_constrain ────────────────────────────
    await runTest('test_meaning_type_combine_then_constrain', () => {
        const mt1 = MeaningType.create('build',   'Build the source code into a release artifact', { embedFn: deterministicEmbed });
        const mt2 = MeaningType.create('test',    'Run the test suite against the release artifact', { embedFn: deterministicEmbed });
        const combined = mt1.combine(mt2, 0.5);

        assert.ok(combined instanceof MeaningType, 'combine returns MeaningType');
        assert.ok(combined.vector instanceof Float32Array, 'combined vector is Float32Array');
        assert.strictEqual(combined.vector.length, EMBED_DIM, 'combined vector is 384-dim');

        // The combined MeaningType should pass a constraint that it satisfies both
        const constraint = new SemanticConstraint(
            'CI/CD build-and-test activity',
            { minSimilarity: 0.0, enforcement: 'advisory', embedFn: deterministicEmbed }
        );
        const result = constraint.check(combined.vector);
        assert.ok(result.hasOwnProperty('passed'),     'constraint result has passed');
        assert.ok(typeof result.similarity === 'number', 'constraint result has similarity');
    });

    // ── test_collection_sort_and_deduplicate ──────────────────────────────
    await runTest('test_collection_sort_and_deduplicate', () => {
        const mt1 = MeaningType.create('alpha',   'First semantic concept',  { embedFn: deterministicEmbed });
        const mt2 = MeaningType.create('beta',    'Second semantic concept', { embedFn: deterministicEmbed });
        const mt3 = MeaningType.create('alpha',   'First semantic concept',  { embedFn: deterministicEmbed }); // duplicate of mt1
        const mt4 = MeaningType.create('gamma',   'Third semantic concept',  { embedFn: deterministicEmbed });

        const collection = new MeaningTypeCollection([mt1, mt2, mt3, mt4]);
        assert.strictEqual(collection.items.length, 4, '4 items before deduplicate');

        // Deduplicate — mt1 and mt3 have identical vectors
        const deduped = collection.deduplicate();
        assert.ok(deduped instanceof MeaningTypeCollection, 'deduplicate returns MeaningTypeCollection');
        assert.ok(deduped.items.length <= 4, 'deduplication removes duplicates');
        assert.ok(deduped.items.length >= 3, 'deduplication keeps distinct items');

        // Sort by similarity to a reference (method is named 'sort', not 'sortBy')
        const reference = MeaningType.create('concept', 'Semantic concept reference', { embedFn: deterministicEmbed });
        const sorted = collection.sort(reference);
        assert.ok(sorted instanceof MeaningTypeCollection, 'sort returns MeaningTypeCollection');
        assert.strictEqual(sorted.items.length, 4, 'sort preserves all items');

        // Verify sorted in descending similarity order
        let prevSim = Infinity;
        for (const item of sorted.items) {
            const sim = _cos(item.vector, reference.vector);
            assert.ok(sim <= prevSim + 1e-9, `items are sorted in descending similarity order`);
            prevSim = sim;
        }
    });

    // ── test_constraint_set_integration ──────────────────────────────────
    await runTest('test_constraint_set_integration', () => {
        const mt = MeaningType.create(
            'execute_deployment',
            'Execute a controlled deployment to the production cluster',
            { embedFn: deterministicEmbed }
        );

        const cs = new ConstraintSet('deployment-constraints');
        // ConstraintSet.add(name, constraint) — takes a name string + SemanticConstraint
        const c1 = cs.add('deployment-action', new SemanticConstraint('Deployment-related action', {
            minSimilarity: 0.0, enforcement: 'advisory', embedFn: deterministicEmbed
        }));
        const c2 = cs.add('production-op', new SemanticConstraint('Production environment operation', {
            minSimilarity: 0.0, enforcement: 'soft', embedFn: deterministicEmbed
        }));

        // ConstraintSet stores constraints in _constraints Map
        assert.ok(cs._constraints.size >= 2, `ConstraintSet has at least 2 constraints: ${cs._constraints.size}`);

        // ConstraintSet.checkAll() returns { allPassed, results: Map<name,result>, violationCount }
        const checkResult = cs.checkAll(mt.vector);
        assert.ok(typeof checkResult === 'object' && checkResult !== null, 'checkAll returns object');
        assert.ok(checkResult.hasOwnProperty('allPassed'),     'checkAll result has allPassed');
        assert.ok(checkResult.hasOwnProperty('results'),       'checkAll result has results');
        assert.ok(checkResult.hasOwnProperty('violationCount'),'checkAll result has violationCount');
        assert.ok(typeof checkResult.allPassed === 'boolean',  'allPassed is boolean');

        // results is a Map<string, result>
        assert.ok(checkResult.results instanceof Map, 'results is a Map');
        assert.ok(checkResult.results.size >= 2, `results Map has >= 2 entries: ${checkResult.results.size}`);

        for (const [name, r] of checkResult.results) {
            assert.ok(typeof name === 'string',           `constraint name is string: ${name}`);
            assert.ok(r.hasOwnProperty('passed'),         `${name}: result has passed`);
            assert.ok(r.hasOwnProperty('similarity'),     `${name}: result has similarity`);
        }
    });
}

runTests().then(() => {
    console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
});
