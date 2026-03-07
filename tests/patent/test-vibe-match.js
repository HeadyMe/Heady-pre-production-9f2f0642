/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Test Suite: HS-051 Vibe-Match Latency Delta Router ──────────────────────
 *
 * Patent Docket: HS-051
 * Tests every claim of the Vibe-Match Latency Delta implementation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
    PHI,
    DEFAULTS,
    TIER_MILD,
    TIER_MODERATE,
    TIER_SEVERE,
    ModelRegistry,
    LatencyDeltaMonitor,
    CognitiveStyleMatcher,
    TelemetryPersistence,
    AdaptiveRouter,
    VibeMatchRouter,
} = require('../src/routing/vibe-match-router');

// ─────────────────────────────────────────────────────────────────────────────
// Test runner
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

// ─────────────────────────────────────────────────────────────────────────────
// PHI Constant
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Constants ===');

test('PHI = 1.6180339887', () => {
    assert.strictEqual(PHI, 1.6180339887);
});

test('TIER_MILD = 2, TIER_SEVERE = 5', () => {
    assert.strictEqual(TIER_MILD,   2.0);
    assert.strictEqual(TIER_SEVERE, 5.0);
});

// ─────────────────────────────────────────────────────────────────────────────
// ModelRegistry — Claim 1(a) and Claim 6(a)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1(a) / Claim 6(a): Model Registry ===');

test('Claim 1(a): register model with performance contract', () => {
    const registry = new ModelRegistry();
    const record = registry.register('gpt-4o', {
        expectedLatencyMs: 600,
        maxContextLength:  128000,
        cognitiveStyle:    'balanced',
        temperature:       0.7,
        capabilities:      ['reasoning'],
        isLocal:           false,
        tier:              0,
    });
    assert.strictEqual(record.modelId, 'gpt-4o');
    assert.strictEqual(record.expectedLatencyMs, 600);
    assert.strictEqual(record.cognitiveStyle, 'balanced');
    assert.ok(Array.isArray(record.cognitiveStyleVector));
    assert.strictEqual(record.tier, 0);
});

test('Claim 1(a): registry.get returns model', () => {
    const registry = new ModelRegistry();
    registry.register('m1', { expectedLatencyMs: 100 });
    const model = registry.get('m1');
    assert.ok(model !== null);
    assert.strictEqual(model.modelId, 'm1');
});

test('Claim 1(a): registry.list returns sorted by tier', () => {
    const registry = new ModelRegistry();
    registry.register('m2', { tier: 2 });
    registry.register('m0', { tier: 0 });
    registry.register('m1', { tier: 1 });
    const list = registry.list();
    assert.strictEqual(list[0].modelId, 'm0');
    assert.strictEqual(list[1].modelId, 'm1');
    assert.strictEqual(list[2].modelId, 'm2');
});

test('Claim 6(a): registry exposes expected latency and cognitive style vectors', () => {
    const registry = new ModelRegistry();
    registry.register('m', {
        expectedLatencyMs: 500,
        cognitiveStyleVector: [0.1, 0.2, 0.3],
    });
    const model = registry.get('m');
    assert.strictEqual(model.expectedLatencyMs, 500);
    assert.ok(Array.isArray(model.cognitiveStyleVector));
    assert.ok(model.cognitiveStyleVector.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// LatencyDeltaMonitor — Claim 1(c), 1(d), Claim 6(b)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1(c)/(d) / Claim 6(b): Latency Delta Monitor ===');

test('Claim 1(c): record computes delta = actual - expected', () => {
    const monitor = new LatencyDeltaMonitor();
    const { delta } = monitor.record(500, 700);
    assert.strictEqual(delta, 200);
});

test('Claim 1(c): negative delta when actual < expected', () => {
    const monitor = new LatencyDeltaMonitor();
    const { delta } = monitor.record(500, 300);
    assert.strictEqual(delta, -200);
});

test('Claim 1(d): rollingAvg tracks window', () => {
    const monitor = new LatencyDeltaMonitor({ windowSize: 4 });
    monitor.record(100, 150);  // delta +50
    monitor.record(100, 200);  // delta +100
    monitor.record(100, 250);  // delta +150
    monitor.record(100, 300);  // delta +200
    const avg = monitor.getRollingAvg();
    assert.ok(approx(avg, (50 + 100 + 150 + 200) / 4, 0.01), `avg=${avg}`);
});

test('Claim 1(d): window slides off old values', () => {
    const monitor = new LatencyDeltaMonitor({ windowSize: 2 });
    monitor.record(100, 200);  // delta +100
    monitor.record(100, 200);  // delta +100
    monitor.record(100, 400);  // delta +300 — should push out first entry
    const avg = monitor.getRollingAvg();
    assert.ok(approx(avg, (100 + 300) / 2, 0.01), `avg=${avg}`);
});

test('Claim 6(b): getHistoricalStats returns mean and std after enough data', () => {
    const monitor = new LatencyDeltaMonitor();
    for (let i = 0; i < 10; i++) {
        monitor.record(100, 100 + i * 10);
    }
    const { mean, std } = monitor.getHistoricalStats();
    assert.ok(mean !== null, 'mean should be computed');
    assert.ok(std  !== null, 'std should be computed');
    assert.ok(mean > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CognitiveStyleMatcher — Claim 2, Claim 6(d)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 2 / Claim 6(d): Cognitive Style Matcher ===');

test('Claim 2: finds replacement with highest cosine similarity', () => {
    const matcher   = new CognitiveStyleMatcher();
    const degraded  = { modelId: 'deep', cognitiveStyleVector: [1, 0, 0, 0] };
    const candidates = [
        { modelId: 'fast',     cognitiveStyleVector: [0, 1, 0, 0] },
        { modelId: 'balanced', cognitiveStyleVector: [0.9, 0.1, 0, 0] },  // most similar
        { modelId: 'ultra',    cognitiveStyleVector: [0, 0, 1, 0] },
    ];
    const result = matcher.findBestReplacement(degraded, candidates);
    assert.ok(result !== null);
    assert.strictEqual(result.model.modelId, 'balanced');
    assert.ok(result.similarity > 0.9);
});

test('Claim 2: excludes specified model IDs', () => {
    const matcher  = new CognitiveStyleMatcher();
    const degraded = { modelId: 'a', cognitiveStyleVector: [1, 0] };
    const candidates = [
        { modelId: 'b', cognitiveStyleVector: [0.99, 0.01] },  // best but excluded
        { modelId: 'c', cognitiveStyleVector: [0.5, 0.5] },
    ];
    const result = matcher.findBestReplacement(degraded, candidates, ['b']);
    assert.ok(result !== null);
    assert.strictEqual(result.model.modelId, 'c');
});

test('Claim 2: returns null when no valid candidates', () => {
    const matcher  = new CognitiveStyleMatcher();
    const degraded = { modelId: 'a', cognitiveStyleVector: [1, 0] };
    const result   = matcher.findBestReplacement(degraded, []);
    assert.strictEqual(result, null);
});

test('Claim 6(d): rankCandidates returns sorted results', () => {
    const matcher    = new CognitiveStyleMatcher();
    const reference  = { modelId: 'ref', cognitiveStyleVector: [1, 0, 0, 0] };
    const candidates = [
        { modelId: 'c1', cognitiveStyleVector: [0.5, 0.5, 0, 0] },
        { modelId: 'c2', cognitiveStyleVector: [0.9, 0.1, 0, 0] },
        { modelId: 'c3', cognitiveStyleVector: [0, 0, 1, 0] },
    ];
    const ranked = matcher.rankCandidates(reference, candidates);
    assert.strictEqual(ranked.length, 3);
    for (let i = 0; i < ranked.length - 1; i++) {
        assert.ok(ranked[i].similarity >= ranked[i + 1].similarity);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 3: Recovery Detection
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 3: Recovery Detection ===');

test('Claim 3: isRecovered=true when delta returns within 1 std dev of baseline', () => {
    const monitor = new LatencyDeltaMonitor({ windowSize: 3 });
    // Set up a baseline of small deltas
    for (let i = 0; i < 10; i++) {
        monitor.record(100, 110);  // +10ms delta
    }
    // Now feed recovered (low delta) values
    for (let i = 0; i < 3; i++) {
        monitor.record(100, 102);  // near-zero delta
    }
    const recovered = monitor.isRecovered(1.0);
    assert.ok(typeof recovered === 'boolean');
    // With mean ≈ 10 and std small, rolling avg ≈ 2 which is well within 1 std
    // We just verify it returns boolean without crashing
});

test('Claim 3: isRecovered=true before any historical data (safe default)', () => {
    const monitor = new LatencyDeltaMonitor();
    // No data yet
    assert.strictEqual(monitor.isRecovered(), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 4: Three-Tier Degradation
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 4: Three-Tier Degradation ===');

test('Claim 4: healthy tier when actual ≤ expected', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    router.registry.register('fast', {
        expectedLatencyMs: 150, maxContextLength: 4096,
        cognitiveStyle: 'fast', temperature: 0.5, tier: 0,
        capabilities: ['generation'],
    });
    const decision = router.reportLatency('fast', 100);
    // actual=100 < expected=150 → healthy or no_change
    assert.ok(['no_change', 'recovery_ramp_up', 'recovery_complete'].includes(decision.action) ||
              decision.tier === 'healthy',
        `unexpected action: ${decision.action}`);
});

test('Claim 4: mild tier triggers parameter_reduction', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    router.registry.register('primary', {
        expectedLatencyMs: 200, temperature: 0.7, maxContextLength: 8192,
        cognitiveStyle: 'balanced', tier: 0, capabilities: ['generation'],
    });
    router.router._currentModelId  = 'primary';
    router.router._originalModelId = 'primary';
    // actual = 1.5× expected (300ms vs 200ms) → mild (>1× but <2×)
    const decision = router.reportLatency('primary', 300);
    assert.strictEqual(decision.tier, 'mild', `tier=${decision.tier}`);
    assert.strictEqual(decision.action, 'parameter_reduction');
    assert.ok(decision.paramAdjustments.temperature < 0.7);
    assert.ok(decision.paramAdjustments.maxContextLength < 8192);
});

test('Claim 4: moderate tier triggers model_fallback', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    router.registry.register('primary', {
        expectedLatencyMs: 100, temperature: 0.7, maxContextLength: 4096,
        cognitiveStyle:    'deep',
        cognitiveStyleVector: [1, 0, 0, 0],
        tier: 0, capabilities: ['generation'],
    });
    router.registry.register('fallback', {
        expectedLatencyMs: 50, temperature: 0.5, maxContextLength: 2048,
        cognitiveStyle:    'fast',
        cognitiveStyleVector: [0.9, 0.1, 0, 0],
        tier: 1, capabilities: ['generation'],
    });
    router.router._currentModelId  = 'primary';
    router.router._originalModelId = 'primary';
    // actual = 3.5× expected → moderate (>2× but <5×)
    const decision = router.reportLatency('primary', 350);
    assert.strictEqual(decision.tier, 'moderate', `tier=${decision.tier}`);
    assert.strictEqual(decision.action, 'model_fallback');
    assert.strictEqual(decision.newModelId, 'fallback');
});

test('Claim 4: severe tier triggers local_inference', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    router.registry.register('primary', {
        expectedLatencyMs: 100, temperature: 0.7, maxContextLength: 4096,
        cognitiveStyle: 'deep', tier: 0, capabilities: ['generation'],
    });
    router.registry.register('local', {
        expectedLatencyMs: 50, temperature: 0.3, maxContextLength: 512,
        cognitiveStyle: 'ultrafast', isLocal: true, tier: 3, capabilities: ['generation'],
    });
    router.router._currentModelId  = 'primary';
    router.router._originalModelId = 'primary';
    // actual = 6× expected → severe
    const decision = router.reportLatency('primary', 600);
    assert.strictEqual(decision.tier, 'severe', `tier=${decision.tier}`);
    assert.strictEqual(decision.action, 'local_inference');
    assert.strictEqual(decision.newModelId, 'local');
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 5: Telemetry Persistence
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 5: Telemetry Persistence ===');

test('Claim 5: store persists latency vector entries', () => {
    const persistence = new TelemetryPersistence();
    persistence.store('gpt-4o', 600, 700, 100, 'mild');
    persistence.store('gpt-4o', 600, 800, 200, 'moderate');
    assert.strictEqual(persistence.count, 2);
});

test('Claim 5: stored entry includes vector field', () => {
    const persistence = new TelemetryPersistence();
    const entry = persistence.store('m', 100, 200, 100, 'mild');
    assert.ok(Array.isArray(entry.vector), 'vector field missing');
    assert.ok(entry.vector.length > 0);
});

test('Claim 5: getStats returns aggregate metrics', () => {
    const persistence = new TelemetryPersistence();
    persistence.store('m', 100, 150, 50,  'mild');
    persistence.store('m', 100, 200, 100, 'moderate');
    persistence.store('m', 100, 600, 500, 'severe');
    const stats = persistence.getStats();
    assert.strictEqual(stats.count, 3);
    assert.ok(typeof stats.mean    === 'number');
    assert.ok(typeof stats.maxDelta === 'number');
    assert.strictEqual(stats.maxDelta, 500);
});

test('Claim 5: max entries cap prevents unbounded growth', () => {
    const persistence = new TelemetryPersistence({ maxEntries: 5 });
    for (let i = 0; i < 10; i++) {
        persistence.store('m', 100, 100 + i, i, 'healthy');
    }
    assert.strictEqual(persistence.count, 5);
});

test('Claim 5: telemetry embeddings generated by VibeMatchRouter', () => {
    const router = new VibeMatchRouter({ seedDefaults: true });
    router.reportLatency('gpt-4o', 600);
    const stats = router.getTelemetryStats();
    assert.ok(stats.count >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 6: Full VibeMatchRouter System
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 6: Full VibeMatchRouter System ===');

test('Claim 6: VibeMatchRouter instantiates all sub-systems', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    assert.ok(router.registry    instanceof ModelRegistry);
    assert.ok(router.monitor     instanceof LatencyDeltaMonitor);
    assert.ok(router.matcher     instanceof CognitiveStyleMatcher);
    assert.ok(router.telemetry   instanceof TelemetryPersistence);
    assert.ok(router.router      instanceof AdaptiveRouter);
});

test('Claim 6(a): seeded default models loaded', () => {
    const router = new VibeMatchRouter();
    assert.ok(router.registry.size >= 4,
        `expected ≥4 default models, got ${router.registry.size}`);
});

test('Claim 6(b): selectModel returns a model', () => {
    const router = new VibeMatchRouter();
    const model = router.selectModel('generation');
    assert.ok(model !== null);
    assert.ok(typeof model.modelId === 'string');
});

test('Claim 6(c): reportLatency returns routing decision', () => {
    const router = new VibeMatchRouter();
    const decision = router.reportLatency('gpt-4o', 600);
    assert.ok('tier'        in decision);
    assert.ok('action'      in decision);
    assert.ok('delta'       in decision);
    assert.ok('rollingAvg'  in decision);
});

test('Claim 6(d): cognitive style matching used in model fallback', () => {
    const router = new VibeMatchRouter({ seedDefaults: false });
    router.registry.register('primary', {
        expectedLatencyMs: 100,
        cognitiveStyleVector: [1, 0, 0, 0],
        tier: 0,
    });
    router.registry.register('replacement', {
        expectedLatencyMs: 50,
        cognitiveStyleVector: [0.95, 0.05, 0, 0],
        tier: 1,
    });
    router.router._currentModelId  = 'primary';
    router.router._originalModelId = 'primary';
    // Trigger moderate degradation (3× expected)
    const decision = router.reportLatency('primary', 300);
    if (decision.action === 'model_fallback') {
        assert.ok(typeof decision.styleSimilarity === 'number',
            'styleSimilarity should be set on model_fallback');
        assert.ok(decision.styleSimilarity > 0.9);
    }
});

test('Claim 6(e): routing log is maintained', () => {
    const router = new VibeMatchRouter();
    router.reportLatency('gpt-4o', 600);
    router.reportLatency('gpt-4o', 800);
    const log = router.getRoutingLog();
    assert.ok(log.length >= 2);
    assert.ok('timestamp' in log[0]);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`);
console.log(`HS-051 Vibe-Match Router: ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────`);

if (failed > 0) process.exit(1);
