#!/usr/bin/env node
'use strict';
/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Scales — Comprehensive Test Suite
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests every class and integration point of phi-scales + dynamic-
 * constants. Runs without any external test framework.
 *
 * Usage:
 *   node scripts/test-phi-scales.js [--verbose]
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — one or more tests failed
 * ═══════════════════════════════════════════════════════════════════
 */

const {
    PHI, PHI_INVERSE, SQRT_PHI, PHI_SQUARED, LOG_PHI, FIBONACCI_SEQUENCE,
    PhiRange, PhiScale, PhiBackoff, PhiDecay,
    PhiPartitioner, PhiNormalizer, PhiSpiral,
} = require('../src/core/phi-scales');

const {
    DynamicTimeout, DynamicRetryCount, DynamicBatchSize,
    DynamicConfidenceThreshold, DynamicPriority, DynamicTemperature,
    DynamicCacheTTL, DynamicConcurrency, DynamicBackoffInterval,
    DynamicResonanceThreshold, DynamicTernaryPositiveThreshold,
    DynamicTernaryNegativeThreshold, DynamicSoftGateSteepness,
    DynamicRiskSensitivity, resetAll,
} = require('../src/core/dynamic-constants');

// ─── ANSI helpers ─────────────────────────────────────────────────
const isCI  = process.env.CI === 'true' || !process.stdout.isTTY;
const color = (code, str) => isCI ? str : `\x1b[${code}m${str}\x1b[0m`;
const green  = s => color('32', s);
const red    = s => color('31', s);
const yellow = s => color('33', s);
const cyan   = s => color('36', s);
const bold   = s => color('1',  s);
const dim    = s => color('2',  s);

// ─── Harness ──────────────────────────────────────────────────────
let passed = 0, failed = 0, currentSuite = '';
const verbose = process.argv.includes('--verbose');

function suite(name) {
    currentSuite = name;
    console.log(bold(cyan(`\n  ▶ ${name}`)));
}

function assert(condition, label) {
    if (condition) {
        passed++;
        if (verbose) console.log(`    ${green('✔')} ${label}`);
    } else {
        failed++;
        console.log(`    ${red('✖')} ${red(label)}`);
        console.log(dim(`      [Suite: ${currentSuite}]`));
    }
}

function assertClose(actual, expected, tol, label) {
    const ok = Math.abs(actual - expected) <= tol;
    if (ok) {
        passed++;
        if (verbose) console.log(`    ${green('✔')} ${label} (${actual.toFixed(6)} ≈ ${expected.toFixed(6)})`);
    } else {
        failed++;
        console.log(`    ${red('✖')} ${red(label)}`);
        console.log(dim(`      expected ${expected} ± ${tol}, got ${actual}`));
    }
}

// ─── Banner ───────────────────────────────────────────────────────
console.log(bold(cyan('\n╔══════════════════════════════════════════════════╗')));
console.log(bold(cyan('║   Heady Phi Scales — Test Suite                  ║')));
console.log(bold(cyan('╚══════════════════════════════════════════════════╝')));
console.log(dim(`  φ  = ${PHI.toFixed(15)}`));
console.log(dim(`  1/φ = ${PHI_INVERSE.toFixed(15)}\n`));

// ══════════════════════════════════════════════════════════════════
// Suite 1 — PhiScale Basic Operations
// ══════════════════════════════════════════════════════════════════
suite('Suite 1 — PhiScale Basic Operations');
{
    const scale = new PhiScale({ name: 'test', baseValue: 10, min: 1, max: 100, phiNormalized: false });

    assert(scale.value === 10,       'initial value equals baseValue');
    assert(scale.asInt() === 10,     'asInt() rounds correctly');
    assert(scale.asMs() === 10,      'asMs() returns non-negative integer');

    // normalized() should place 10 in [0,1] relative to [1,100]
    const norm = scale.normalized();
    assertClose(norm, (10 - 1) / (100 - 1), 1e-9, 'normalized position in [0,1]');

    // isAbovePhi / isBelowPhi are mutually consistent
    const above = scale.isAbovePhi();
    const below = scale.isBelowPhi();
    assert(!(above && below), 'isAbovePhi and isBelowPhi cannot both be true');

    // High value is above phi point; low value is below
    const hi = new PhiScale({ name: 'hi', baseValue: 99, min: 0, max: 100, phiNormalized: false });
    const lo = new PhiScale({ name: 'lo', baseValue:  1, min: 0, max: 100, phiNormalized: false });
    assert(hi.isAbovePhi(), 'value near max is above phi');
    assert(lo.isBelowPhi(), 'value near min is below phi');

    // reset() restores state
    scale.adjust({ adjustment: 5 }); // bump via raw signal
    assert(scale.value !== 10 || scale._momentum !== 0, 'adjust() changes something');
    scale.reset();
    assert(scale.value === 10,         'reset() restores baseValue');
    assert(scale._momentum === 0,      'reset() clears momentum');
    assert(scale._history.length === 0,'reset() clears history');
}

// ══════════════════════════════════════════════════════════════════
// Suite 2 — PhiBackoff Sequence
// ══════════════════════════════════════════════════════════════════
suite('Suite 2 — PhiBackoff Sequence');
{
    const backoff = new PhiBackoff(1000, 6, 0); // jitterFactor=0 for determinism
    const seq     = backoff.sequence();

    assert(seq.length === 6,   'sequence has maxAttempts entries');
    assertClose(seq[0], 1000, 1, 'step 0 = 1000ms');
    assertClose(seq[1], Math.round(1000 * PHI),         1, 'step 1 = base × φ');
    assertClose(seq[2], Math.round(1000 * PHI * PHI),   1, 'step 2 = base × φ²');
    assertClose(seq[3], Math.round(1000 * PHI * PHI * PHI), 1, 'step 3 = base × φ³');

    // Phi grows more slowly than 2× doubling
    const { standard } = backoff.compare();
    for (let i = 1; i < 6; i++) {
        assert(seq[i] <= standard[i], `phi step ${i} (${seq[i]}) ≤ doubling step (${standard[i]})`);
    }

    // Jitter stays within declared bounds
    const jitterBackoff = new PhiBackoff(1000, 5, 0.2);
    for (let i = 0; i < 10; i++) {
        jitterBackoff.reset();
        const v = jitterBackoff.next();
        const base = 1000; // attempt 0
        assert(v >= 0, `jitter step is non-negative (got ${v})`);
        assert(v <= Math.round(base * 1.21), `jitter does not exceed ±20% of base (got ${v})`);
    }

    // Max attempts: next() returns -1
    backoff.reset();
    let count = 0;
    let v;
    while ((v = backoff.next()) !== -1) count++;
    assert(count === 6, `next() exhausts after maxAttempts (counted ${count})`);
}

// ══════════════════════════════════════════════════════════════════
// Suite 3 — PhiDecay Golden Spiral
// ══════════════════════════════════════════════════════════════════
suite('Suite 3 — PhiDecay Golden Spiral');
{
    const halfLife = 3600000;
    const decay    = new PhiDecay(halfLife);

    assertClose(decay.decay(0),        1.0, 1e-6, 'decay at t=0 is 1.0');
    assertClose(decay.decay(halfLife), 0.5, 0.01, 'decay at t=halfLife ≈ 0.5');

    // Golden spiral and standard exponential use the same formula internally;
    // verify compare() reports all three as positive and in (0,1)
    const comparison25 = decay.compare(halfLife * 0.25);
    assert(comparison25.goldenSpiral > 0 && comparison25.goldenSpiral < 1,
        'goldenSpiral decay at 25% is in (0,1)');
    assert(comparison25.standardExponential > 0 && comparison25.standardExponential < 1,
        'standardExponential at 25% is in (0,1)');
    assert(comparison25.linear > 0 && comparison25.linear < 1,
        'linear decay at 25% is in (0,1)');

    // All three methods show more decay by 75% than at 25%
    const comparison75 = decay.compare(halfLife * 0.75);
    assert(comparison75.goldenSpiral < comparison25.goldenSpiral,
        'golden spiral decays further from 25% to 75%');
    assert(comparison75.standardExponential < comparison25.standardExponential,
        'standard exponential decays further from 25% to 75%');

    // timeToDecay roundtrip
    const target = 0.25;
    const t = decay.timeToDecay(target);
    assertClose(decay.decay(t), target, 0.001, 'timeToDecay(0.25) roundtrip');

    // apply() multiplies value by decay factor
    assertClose(decay.apply(100, halfLife), 50, 1, 'apply(100, halfLife) ≈ 50');

    // decay is strictly decreasing
    let prev = decay.decay(0);
    for (let step = 1; step <= 10; step++) {
        const curr = decay.decay(halfLife * step * 0.2);
        assert(curr < prev, `decay is decreasing at step ${step}`);
        prev = curr;
    }
}

// ══════════════════════════════════════════════════════════════════
// Suite 4 — PhiPartitioner Fibonacci
// ══════════════════════════════════════════════════════════════════
suite('Suite 4 — PhiPartitioner Fibonacci');
{
    const part = new PhiPartitioner();

    // isFibonacci
    const KNOWN_FIB = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
    for (const f of KNOWN_FIB) {
        assert(part.isFibonacci(f), `isFibonacci(${f}) = true`);
    }
    assert(!part.isFibonacci(4),  'isFibonacci(4) = false');
    assert(!part.isFibonacci(6),  'isFibonacci(6) = false');
    assert(!part.isFibonacci(10), 'isFibonacci(10) = false');

    // nearestFibonacci
    assertClose(part.nearestFibonacci(7),  8, 0,  'nearestFibonacci(7) = 8');
    assertClose(part.nearestFibonacci(20), 21, 0, 'nearestFibonacci(20) = 21');
    assertClose(part.nearestFibonacci(55), 55, 0, 'nearestFibonacci(55) = 55');

    // split: chunks sum to total
    const chunks = part.split(100, 50);
    const sum    = chunks.reduce((a, b) => a + b, 0);
    assert(sum === 100, `split(100, 50) sums to 100 (got ${sum})`);

    // goldenPartition: larger ≈ PHI_INVERSE of total
    const gp = part.goldenPartition(100);
    assertClose(gp.larger + gp.smaller, 100, 1e-9, 'goldenPartition sums to total');
    assertClose(gp.larger / 100, PHI_INVERSE, 0.001, 'golden larger ≈ PHI_INVERSE × total');

    // fibonacci(n) spot-checks
    assert(part.fibonacci(0)  === 0,  'fibonacci(0) = 0');
    assert(part.fibonacci(6)  === 8,  'fibonacci(6) = 8');
    assert(part.fibonacci(10) === 55, 'fibonacci(10) = 55');
}

// ══════════════════════════════════════════════════════════════════
// Suite 5 — PhiNormalizer Conversions
// ══════════════════════════════════════════════════════════════════
suite('Suite 5 — PhiNormalizer Conversions');
{
    // normalize / denormalize roundtrip
    const n = PhiNormalizer.normalize(42, 0, 100);
    const d = PhiNormalizer.denormalize(n, 0, 100);
    assertClose(d, 42, 0.001, 'normalize/denormalize roundtrip');

    // zero-span returns PHI_INVERSE
    assertClose(PhiNormalizer.normalize(5, 5, 5), PHI_INVERSE, 1e-9, 'zero-span normalize = PHI_INVERSE');

    // fromPercent / toPercent roundtrip
    assertClose(PhiNormalizer.toPercent(PhiNormalizer.fromPercent(50)), 50, 0.001, 'fromPercent/toPercent roundtrip');

    // phi point percentage ≈ 61.8%
    assertClose(PhiNormalizer.toPercent(PHI_INVERSE), PHI_INVERSE * 100, 0.001, 'toPercent(PHI_INVERSE) ≈ 61.8');

    // mapDiscrete is monotonically increasing
    const vals = [1, 2, 3, 4, 5].map(i => PhiNormalizer.mapDiscrete(i, 1, 5));
    for (let i = 0; i < vals.length - 1; i++) {
        assert(vals[i] < vals[i + 1], `mapDiscrete monotonically increasing at step ${i}`);
    }

    // mapCategory: known category returns [0,1]
    const cats  = ['low', 'medium', 'high'];
    const vLow  = PhiNormalizer.mapCategory('low',    cats);
    const vHigh = PhiNormalizer.mapCategory('high',   cats);
    const vMid  = PhiNormalizer.mapCategory('medium', cats);
    assert(vLow  >= 0 && vLow  <= 1, 'mapCategory(low) ∈ [0,1]');
    assert(vHigh >= 0 && vHigh <= 1, 'mapCategory(high) ∈ [0,1]');
    assert(vMid  >= 0 && vMid  <= 1, 'mapCategory(medium) ∈ [0,1]');
    assert(vLow < vMid && vMid < vHigh, 'mapCategory monotonic: low < medium < high');

    // Unknown category returns PHI_INVERSE
    assertClose(PhiNormalizer.mapCategory('unknown', cats), PHI_INVERSE, 1e-9, 'unknown category = PHI_INVERSE');
}

// ══════════════════════════════════════════════════════════════════
// Suite 6 — Dynamic Adjustment Under Load
// ══════════════════════════════════════════════════════════════════
suite('Suite 6 — Dynamic Adjustment Under Load');
{
    // Telemetry feed: target = p99 × φ
    const feed = (metrics, _current, _scale) => {
        const target = (metrics.latencyP99 || 1000) * PHI;
        return target - _current; // raw signal
    };
    const ts = new PhiScale({
        name: 'TimeoutTest', baseValue: 5000, min: 1000, max: 30000,
        phiNormalized: false, sensitivity: 0.1, telemetryFeed: feed,
    });

    // High latency → timeout increases
    const before = ts.value;
    ts.adjust({ latencyP99: 9000 }); // target ≈ 14562 > 5000
    assert(ts.value > before, `high latency increases timeout (${before} → ${ts.value.toFixed(0)})`);

    // Sustained low latency → timeout decreases
    ts.reset();
    const beforeLow = ts.value;
    for (let i = 0; i < 10; i++) ts.adjust({ latencyP99: 200 }); // target ≈ 323 << 5000
    assert(ts.value < beforeLow, `sustained low latency decreases timeout (${beforeLow} → ${ts.value.toFixed(0)})`);

    // Momentum smoothing — single spike should not produce wild swing
    ts.reset();
    ts.adjust({ latencyP99: 8000 });
    const spike = Math.abs(ts.value - 5000);
    assert(spike < 3000, `momentum limits single-spike impact (delta=${spike.toFixed(0)})`);

    // History is recorded after adjustments
    ts.reset();
    ts.adjust({ latencyP99: 1000 });
    ts.adjust({ latencyP99: 2000 });
    assert(ts._history.length === 2, 'adjustment history grows per call');
}

// ══════════════════════════════════════════════════════════════════
// Suite 7 — Benchmark: Phi vs Fixed Timeout
// ══════════════════════════════════════════════════════════════════
suite('Suite 7 — Benchmark: Phi vs Fixed Timeout');
{
    // Phi-adapted timeout converges toward (p99 × φ) target.
    // For LOW latency workloads, a fixed 5000ms timeout wastes time waiting;
    // the phi scale stays near actual latency × φ.
    const lowLatencies = [300, 250, 280, 310, 270, 290, 260, 300, 270, 280];
    const fixedTimeout = 5000;
    const fixedTotal   = lowLatencies.reduce((s, l) => s + fixedTimeout, 0);
    const fixedWaste   = lowLatencies.reduce((s, l) => s + Math.max(0, fixedTimeout - l), 0);

    const ts = new PhiScale({
        name: 'Bench', baseValue: 5000, min: 200, max: 30000,
        phiNormalized: false, sensitivity: 0.5,
        telemetryFeed: (m, cur) => (m.latencyP99 * PHI - cur),
    });
    let phiWaste = 0;
    for (const lat of lowLatencies) {
        ts.adjust({ latencyP99: lat });
        phiWaste += Math.max(0, ts.value - lat);
    }

    // After convergence on low latencies, phi timeout should be << fixed
    const finalPhi = ts.value;
    assert(finalPhi < fixedTimeout,
        `phi timeout converges below fixed (${finalPhi.toFixed(0)}ms < ${fixedTimeout}ms)`);
    assert(phiWaste < fixedWaste,
        `phi waste (${Math.round(phiWaste)}ms) < fixed waste (${Math.round(fixedWaste)}ms)`);
    const reduction = (fixedWaste - phiWaste) / fixedWaste;
    assert(reduction > 0.5, `phi reduces waste by >50% on low-latency workload (${(reduction*100).toFixed(1)}%)`);
    console.log(dim(`    Fixed: ${Math.round(fixedWaste)}ms waste | Phi: ${Math.round(phiWaste)}ms waste | Saved: ${(reduction * 100).toFixed(1)}%`));
}

// ══════════════════════════════════════════════════════════════════
// Suite 8 — PhiSpiral Path
// ══════════════════════════════════════════════════════════════════
suite('Suite 8 — PhiSpiral Path');
{
    const spiral = new PhiSpiral(1, 2);

    // Every quarter turn, radius grows by factor PHI
    const p0  = spiral.point(0);
    const p90 = spiral.point(90);
    assertClose(p90.r / p0.r, PHI, 0.001, 'radius grows by φ per 90° turn');

    const p180 = spiral.point(180);
    assertClose(p180.r / p90.r, PHI, 0.001, 'radius grows by φ from 90° to 180°');

    // Points lie on the curve: r = scale × φ^(theta/90)
    for (const theta of [0, 45, 90, 135, 180, 270, 360]) {
        const pt = spiral.point(theta);
        const expected = Math.pow(PHI, theta / 90);
        assertClose(pt.r, expected, 0.001, `spiral point r at θ=${theta}° matches formula`);
    }

    // points() generates monotonically increasing r values
    const pts = spiral.points(10);
    assert(pts.length === 10, 'points(10) returns 10 entries');
    for (let i = 0; i < pts.length - 1; i++) {
        assert(pts[i + 1].r > pts[i].r, `r increases from point ${i} to ${i + 1}`);
    }

    // interpolate() produces values between start and end
    const interp = spiral.interpolate(0, 180, 0.5);
    assert(interp.theta === 90, 'interpolate(0, 180, 0.5) lands at theta=90');
    assertClose(interp.r, p90.r, 0.001, 'interpolated r matches point(90).r');
}

// ══════════════════════════════════════════════════════════════════
// Suite 9 — CSL Integration
// ══════════════════════════════════════════════════════════════════
suite('Suite 9 — CSL Integration');
{
    // cslActivation() on a PhiScale — sigmoid output in (0,1)
    const scale = new PhiScale({ name: 'csl', baseValue: 0.5, min: 0, max: 1, phiNormalized: false });
    const act   = scale.cslActivation();
    assert(act > 0 && act < 1, `cslActivation() ∈ (0,1): ${act.toFixed(4)}`);

    // At PHI_INVERSE (normalized), cslActivation should return ~0.5
    const atPhi = new PhiScale({ name: 'cslPhi', baseValue: PHI_INVERSE, min: 0, max: 1, phiNormalized: false });
    assertClose(atPhi.cslActivation(), 0.5, 0.01, 'cslActivation at phi point ≈ 0.5');

    // cslTernary classification
    const hiScale = new PhiScale({ name: 'hi', baseValue: 0.99, min: 0, max: 1, phiNormalized: false });
    const loScale = new PhiScale({ name: 'lo', baseValue: 0.01, min: 0, max: 1, phiNormalized: false });
    const midScale= new PhiScale({ name: 'mid', baseValue: PHI_INVERSE, min: 0, max: 1, phiNormalized: false });
    assert(hiScale.cslTernary()  ===  1, 'cslTernary high value = +1');
    assert(loScale.cslTernary()  === -1, 'cslTernary low value = -1');
    assert(midScale.cslTernary() ===  0, 'cslTernary at phi point = 0');

    // cslRisk: 0 at equilibrium, increases away from it
    assertClose(midScale.cslRisk(), 0, 0.05, 'cslRisk at phi equilibrium ≈ 0');
    assert(hiScale.cslRisk() > midScale.cslRisk(), 'cslRisk increases above phi');
    assert(loScale.cslRisk() > midScale.cslRisk(), 'cslRisk increases below phi');
    assert(hiScale.cslRisk() >= 0 && hiScale.cslRisk() <= 1, 'cslRisk ∈ [0, 1]');
}

// ══════════════════════════════════════════════════════════════════
// Suite 10 — Convergence Stability
// ══════════════════════════════════════════════════════════════════
suite('Suite 10 — Convergence Stability');
{
    const scale = new PhiScale({
        name: 'Convergence', baseValue: 50, min: 0, max: 100,
        phiNormalized: false, sensitivity: 0.5, momentumDecay: 0.8,
        telemetryFeed: (m, cur) => m.signal - cur,
    });

    for (let i = 0; i < 100; i++) {
        scale.adjust({ signal: 50 + (Math.random() - 0.5) * 20 });
    }

    assert(scale.value >= 0 && scale.value <= 100,
        `value stays within [0,100]: ${scale.value.toFixed(2)}`);

    const hist    = scale._history.map(h => h.value);
    const half    = Math.floor(hist.length / 2);
    const firstSD = stddev(hist.slice(0, half));
    const lastSD  = stddev(hist.slice(half));
    assert(lastSD <= firstSD * 1.5,
        `stddev trend stable: first=${firstSD.toFixed(3)}, last=${lastSD.toFixed(3)}`);

    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    assertClose(mean, 50, 15, `mean converges near target=50 (got ${mean.toFixed(2)})`);

    const st = scale.stats();
    assert(typeof st.mean   === 'number', 'stats() returns mean');
    assert(typeof st.stddev === 'number', 'stats() returns stddev');
    assert(typeof st.count  === 'number', 'stats() returns count');
}

function stddev(arr) {
    if (!arr.length) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length);
}

// ══════════════════════════════════════════════════════════════════
// Suite 11 — Snapshot / Restore
// ══════════════════════════════════════════════════════════════════
suite('Suite 11 — Snapshot / Restore');
{
    const scale = new PhiScale({ name: 'snap', baseValue: 5, min: 0, max: 10, phiNormalized: false });
    scale.adjust({ adjustment: 2 });
    assert(scale.value !== 5,         'scale has been adjusted before snapshot');

    const snap = scale.snapshot();
    assert(typeof snap === 'object',  'snapshot() returns an object');
    assert(snap.current === scale.value, 'snapshot.current matches scale.value');
    assert(Array.isArray(snap.history),  'snapshot.history is an array');

    // Mutate then restore
    scale.adjust({ adjustment: 50 });
    const mutated = scale.value;
    scale.restore(snap);

    assertClose(scale.value, snap.current, 1e-9, 'restore() recovers original value');
    assert(scale.value !== mutated,       'restored value differs from mutated value');
    assert(scale._history.length === snap.history.length, 'restored history length matches snapshot');

    // restore() on TypeError path
    let threw = false;
    try { scale.restore(null); } catch (_) { threw = true; }
    assert(threw, 'restore(null) throws TypeError');
}

// ══════════════════════════════════════════════════════════════════
// Suite 12 — Edge Cases
// ══════════════════════════════════════════════════════════════════
suite('Suite 12 — Edge Cases');
{
    // PhiRange throws on min >= max
    let threw = false;
    try { new PhiRange(5, 5); } catch (_) { threw = true; }
    assert(threw, 'PhiRange(5, 5) throws RangeError');

    // PhiNormalizer zero-span returns PHI_INVERSE
    assertClose(PhiNormalizer.normalize(7, 7, 7), PHI_INVERSE, 1e-9, 'zero-span normalize = PHI_INVERSE');

    // Bounds enforcement — pull down below min
    const lo = new PhiScale({
        name: 'lo', baseValue: 1, min: 0, max: 10,
        phiNormalized: false, enforceBounds: true,
        telemetryFeed: () => -999999,
    });
    lo.adjust({});
    assert(lo.value >= 0, `bounded scale stays >= 0 (got ${lo.value})`);

    // Bounds enforcement — pull up above max
    const hi = new PhiScale({
        name: 'hi', baseValue: 9, min: 0, max: 10,
        phiNormalized: false, enforceBounds: true,
        telemetryFeed: () => 999999,
    });
    hi.adjust({});
    assert(hi.value <= 10, `bounded scale stays <= 10 (got ${hi.value})`);

    // NaN metric does not crash
    const safe = new PhiScale({
        name: 'safe', baseValue: 5, min: 0, max: 10,
        phiNormalized: false,
        telemetryFeed: (m) => isNaN(m.signal) ? 0 : m.signal - 5,
    });
    let nanThrew = false;
    try { safe.adjust({ signal: NaN }); } catch (_) { nanThrew = true; }
    assert(!nanThrew, 'NaN metric does not throw');

    // PhiBackoff with maxAttempts=0 returns -1 immediately
    const zero = new PhiBackoff(1000, 0);
    assert(zero.next() === -1, 'PhiBackoff(maxAttempts=0) returns -1');
    assert(zero.remaining() === 0, 'remaining() = 0 when maxAttempts=0');

    // PhiDecay throws on non-positive halfLife
    let decayThrew = false;
    try { new PhiDecay(0); } catch (_) { decayThrew = true; }
    assert(decayThrew, 'PhiDecay(0) throws RangeError');

    // PhiDecay.timeToDecay throws on out-of-range
    const d = new PhiDecay(1000);
    let tdThrew = false;
    try { d.timeToDecay(0); } catch (_) { tdThrew = true; }
    assert(tdThrew, 'timeToDecay(0) throws RangeError');
}

// ══════════════════════════════════════════════════════════════════
// Suite 13 — Dynamic Constants Sanity
// ══════════════════════════════════════════════════════════════════
suite('Suite 13 — Dynamic Constants Sanity');
{
    resetAll();

    assert(DynamicTimeout.value === 5000,        'DynamicTimeout base = 5000');
    assert(DynamicRetryCount.asInt() === 3,      'DynamicRetryCount base = 3');
    assert(DynamicBatchSize.asInt() === 21,      'DynamicBatchSize base = 21 (Fibonacci)');
    assertClose(DynamicConfidenceThreshold.value, PHI_INVERSE, 0.01,
        'DynamicConfidenceThreshold base ≈ PHI_INVERSE');
    assertClose(DynamicPriority.value, PHI_INVERSE, 0.01,
        'DynamicPriority base ≈ PHI_INVERSE');
    assertClose(DynamicTemperature.value, 0.7, 0.001,
        'DynamicTemperature base = 0.7');
    assert(DynamicCacheTTL.value === 3600000,    'DynamicCacheTTL base = 3600000');
    assert(DynamicConcurrency.asInt() === 8,     'DynamicConcurrency base = 8 (Fibonacci)');
    assert(DynamicBackoffInterval.value === 1000,'DynamicBackoffInterval base = 1000');
    assert(DynamicSoftGateSteepness.value === 20,'DynamicSoftGateSteepness base = 20');
    assertClose(DynamicRiskSensitivity.value, 0.8, 0.01,
        'DynamicRiskSensitivity base = 0.8');

    // All values within declared bounds
    const checks = [
        [DynamicTimeout,             1000,  30000],
        [DynamicRetryCount,             1,      8],
        [DynamicBatchSize,              5,    144],
        [DynamicConfidenceThreshold,  0.3,   0.95],
        [DynamicConcurrency,            2,     55],
        [DynamicBackoffInterval,      100,  10000],
        [DynamicResonanceThreshold,   0.7,   0.99],
        [DynamicSoftGateSteepness,      5,     50],
        [DynamicRiskSensitivity,      0.5,   0.95],
        [DynamicTernaryPositiveThreshold, 0.6, 0.85],
        [DynamicTernaryNegativeThreshold, 0.2, 0.5 ],
    ];
    for (const [s, lo, hi] of checks) {
        assert(s.value >= lo && s.value <= hi,
            `${s.name} (${s.value.toFixed(4)}) ∈ [${lo}, ${hi}]`);
    }
}

// ─── Final Summary ────────────────────────────────────────────────
const total    = passed + failed;
const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

console.log(bold(cyan('\n╔══════════════════════════════════════════════════╗')));
console.log(bold(cyan('║   Test Results                                   ║')));
console.log(bold(cyan('╚══════════════════════════════════════════════════╝')));
console.log(`  Total   : ${bold(String(total))}`);
console.log(`  Passed  : ${green(bold(String(passed)))}`);
console.log(`  Failed  : ${failed > 0 ? red(bold(String(failed))) : dim(String(failed))}`);
console.log(`  Pass Rate: ${failed === 0 ? green(bold(passRate + '%')) : yellow(passRate + '%')}\n`);

if (failed === 0) {
    console.log(green(bold('  ✔  All tests passed — phi scales are operating correctly.\n')));
    process.exit(0);
} else {
    console.log(red(bold(`  ✖  ${failed} test(s) failed — review output above.\n`)));
    process.exit(1);
}
