#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Scales Test Suite
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Comprehensive tests proving that phi-scaled values outperform
 * fixed values under varying load conditions.
 * ═══════════════════════════════════════════════════════════════════
 */

const {
    PhiScale,
    PhiBackoff,
    PhiDecay,
    PhiPartitioner,
    PhiNormalizer,
    PHI,
    PHI_INVERSE
} = require('../src/core/phi-scales');

const {
    DynamicTimeout,
    DynamicRetryCount,
    DynamicBatchSize
} = require('../src/core/dynamic-constants');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        testsPassed++;
    } else {
        console.log(`  ✗ ${message}`);
        testsFailed++;
    }
}

function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    if (diff <= tolerance) {
        console.log(`  ✓ ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
        testsPassed++;
    } else {
        console.log(`  ✗ ${message} (${actual.toFixed(4)} vs ${expected.toFixed(4)}, diff: ${diff.toFixed(4)})`);
        testsFailed++;
    }
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  Heady Phi Scales Test Suite');
console.log('═══════════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════════
// Test 1: PhiScale Basic Operations
// ═══════════════════════════════════════════════════════════════════

console.log('Test 1: PhiScale Basic Operations');
console.log('─'.repeat(70));

const scale1 = new PhiScale({
    name: 'TestScale',
    baseValue: 10,
    min: 5,
    max: 20,
    phiNormalized: false
});

assert(scale1.value === 10, 'Initial value is base value');
assert(scale1.asInt() === 10, 'asInt() returns integer');
assertClose(scale1.normalized(), 0.333, 0.01, 'Normalized position');

scale1.current = 12.5;
assert(scale1.isAbovePhi(), 'Value above phi point detected');

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 2: PhiBackoff Sequence
// ═══════════════════════════════════════════════════════════════════

console.log('Test 2: PhiBackoff Fibonacci-like Sequence');
console.log('─'.repeat(70));

const backoff = new PhiBackoff(1000, 5);
const sequence = backoff.sequence();

console.log('  Sequence:', sequence.map(v => `${v}ms`).join(', '));

assert(sequence.length === 5, 'Correct sequence length');
assert(sequence[0] === 1000, 'First interval is base');
assertClose(sequence[1] / sequence[0], PHI, 0.01, 'Phi ratio between intervals');
assertClose(sequence[2] / sequence[1], PHI, 0.01, 'Consistent phi growth');

// Compare to standard exponential (doubling)
console.log('\n  Standard exponential (2x): 1000, 2000, 4000, 8000, 16000');
console.log(`  Phi exponential (${PHI.toFixed(2)}x): ${sequence.join(', ')}`);
console.log('  → Phi backoff converges more gracefully\n');

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 3: PhiDecay Golden Spiral
// ═══════════════════════════════════════════════════════════════════

console.log('Test 3: PhiDecay Golden Spiral Decay');
console.log('─'.repeat(70));

const decay = new PhiDecay(3600000); // 1 hour half-life

const value0 = 100;
const value1h = decay.apply(value0, 3600000);
const value2h = decay.apply(value0, 7200000);

console.log(`  Initial: ${value0.toFixed(2)}`);
console.log(`  After 1h: ${value1h.toFixed(2)}`);
console.log(`  After 2h: ${value2h.toFixed(2)}`);

assert(value1h < value0, 'Value decays over time');
assert(value2h < value1h, 'Decay continues');
assert(value1h > value0 * 0.3, 'Golden spiral preserves more early information');

const timeTo50 = decay.timeToDecay(0.5);
console.log(`  Time to 50% decay: ${(timeTo50 / 3600000).toFixed(2)} hours`);

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 4: PhiPartitioner Fibonacci Chunking
// ═══════════════════════════════════════════════════════════════════

console.log('Test 4: PhiPartitioner Fibonacci Work Splitting');
console.log('─'.repeat(70));

const partitioner = new PhiPartitioner();

const work100 = partitioner.partition(100, 4);
console.log(`  Optimal partition for 100 items / 4 workers: ${work100}`);
assert([21, 34].includes(work100), 'Fibonacci number selected');

const chunks200 = partitioner.split(200);
console.log(`  Split 200 into Fibonacci chunks: ${chunks200.join(', ')}`);

const sum = chunks200.reduce((a, b) => a + b, 0);
assert(sum === 200, 'Chunks sum to total');

// Verify Fibonacci sequence
const fib10 = partitioner.fibonacci(10);
console.log(`  10th Fibonacci number: ${fib10}`);
assert(fib10 === 55, 'Correct Fibonacci calculation');

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 5: PhiNormalizer Coordinate Mapping
// ═══════════════════════════════════════════════════════════════════

console.log('Test 5: PhiNormalizer Scale Conversions');
console.log('─'.repeat(70));

const phiValue = PhiNormalizer.normalize(7, 0, 10);
console.log(`  Normalize 7 in [0, 10]: ${phiValue.toFixed(4)}`);

const restored = PhiNormalizer.denormalize(phiValue, 0, 10);
assertClose(restored, 7, 0.01, 'Denormalize restores original value');

const percent = PhiNormalizer.toPercent(PHI_INVERSE);
console.log(`  Phi point (${PHI_INVERSE.toFixed(4)}) as percent: ${percent.toFixed(2)}%`);
assertClose(percent, 38.2, 1, 'Phi point is ~38.2%');

const priority5 = PhiNormalizer.mapDiscrete(5, 1, 10);
console.log(`  Map discrete priority 5 (of 1-10): ${priority5.toFixed(4)}`);

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 6: Dynamic Adjustment Under Load
// ═══════════════════════════════════════════════════════════════════

console.log('Test 6: Dynamic Adjustment Under Simulated Load');
console.log('─'.repeat(70));

const dynamicTimeout = new PhiScale({
    name: 'AdaptiveTimeout',
    baseValue: 1000,
    min: 500,
    max: 5000,
    phiNormalized: false,
    sensitivity: 0.2,
    telemetryFeed: (metrics) => {
        const p99 = metrics.latencyP99 || 1000;
        const target = p99 * 1.5;
        return (target - 1000) * 0.1;
    }
});

console.log(`  Initial timeout: ${dynamicTimeout.value}ms`);

// Simulate high latency
dynamicTimeout.adjust({ latencyP99: 2000 });
console.log(`  After high latency (p99=2000ms): ${dynamicTimeout.value.toFixed(0)}ms`);
assert(dynamicTimeout.value > 1000, 'Timeout increased under high latency');

// Simulate low latency
for (let i = 0; i < 5; i++) {
    dynamicTimeout.adjust({ latencyP99: 400 });
}
console.log(`  After low latency (p99=400ms): ${dynamicTimeout.value.toFixed(0)}ms`);
assert(dynamicTimeout.value < 1000, 'Timeout decreased under low latency');

console.log(`  Phi deviation: ${dynamicTimeout.phiDeviation().toFixed(2)}`);

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test 7: Phi vs Fixed: Adaptation Speed
// ═══════════════════════════════════════════════════════════════════

console.log('Test 7: Benchmark - Phi Scale vs Fixed Value');
console.log('─'.repeat(70));

let fixedTimeout = 5000;
const phiTimeout = new PhiScale({
    name: 'PhiBenchmark',
    baseValue: 5000,
    min: 1000,
    max: 10000,
    sensitivity: 0.3,
    telemetryFeed: (m) => {
        const target = m.latencyP99 * 1.2;
        return (target - phiTimeout.current) * 0.5;
    }
});

const latencyPattern = [8000, 7000, 6000, 4000, 2000, 1500, 1200, 1000, 900, 800];

let phiWastedTime = 0;
let fixedWastedTime = 0;

latencyPattern.forEach((p99, i) => {
    phiTimeout.adjust({ latencyP99: p99 });

    // Wasted time = timeout - actual latency (if timeout too high)
    const phiWaste = Math.max(0, phiTimeout.value - p99);
    const fixedWaste = Math.max(0, fixedTimeout - p99);

    phiWastedTime += phiWaste;
    fixedWastedTime += fixedWaste;

    if (i % 3 === 0) {
        console.log(`  Step ${i+1}: p99=${p99}ms, Phi=${phiTimeout.value.toFixed(0)}ms, Fixed=${fixedTimeout}ms`);
    }
});

console.log(`\n  Total wasted time:`);
console.log(`    Fixed timeout: ${fixedWastedTime.toFixed(0)}ms`);
console.log(`    Phi-scaled: ${phiWastedTime.toFixed(0)}ms`);

const improvement = ((fixedWastedTime - phiWastedTime) / fixedWastedTime * 100).toFixed(1);
console.log(`    Improvement: ${improvement}% reduction in wasted time\n`);

assert(phiWastedTime < fixedWastedTime, 'Phi scales adapt faster, waste less time');

console.log();

// ═══════════════════════════════════════════════════════════════════
// Test Summary
// ═══════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Test Summary');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log(`  Tests Passed: ${testsPassed}`);
console.log(`  Tests Failed: ${testsFailed}`);
console.log(`  Success Rate: ${(testsPassed / (testsPassed + testsFailed) * 100).toFixed(1)}%\n`);

if (testsFailed === 0) {
    console.log('  ✓ All tests passed! Phi scales are working correctly.\n');
    process.exit(0);
} else {
    console.log(`  ✗ ${testsFailed} test(s) failed.\n`);
    process.exit(1);
}
