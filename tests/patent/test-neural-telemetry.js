/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Test Suite: HS-053 Neural Stream Telemetry ───────────────────────────────
 *
 * Patent Docket: HS-053
 * Tests every claim of the neural stream telemetry implementation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
    PHI,
    DEFAULTS,
    computeProofOfInference,
    shannonEntropy,
    TelemetryInterceptor,
    NeuralStreamTelemetry,
} = require('../src/telemetry/neural-stream-telemetry');

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

async function testAsync(name, fn) {
    try {
        await fn();
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

// Fake inference function generator
function makeFakeInference(outputTokens = 100, confidence = 0.85, delayMs = 0) {
    return async () => {
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
        return { outputTokens, confidence };
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeProofOfInference
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Proof-of-Inference Utility ===');

test('computeProofOfInference: returns 64-char hex SHA-256', () => {
    const payload = {
        modelId: 'gpt-4o',
        actionType: 'reasoning',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        confidence: 0.9,
        timestamp: Date.now(),
    };
    const hash = computeProofOfInference(payload);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64, `expected 64, got ${hash.length}`);
    assert.ok(/^[0-9a-f]+$/.test(hash), 'not valid hex');
});

test('computeProofOfInference: same payload → same hash', () => {
    const ts = 1234567890;
    const payload = {
        modelId: 'gpt-4o',
        actionType: 'reasoning',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        confidence: 0.9,
        timestamp: ts,
    };
    assert.strictEqual(
        computeProofOfInference(payload),
        computeProofOfInference(payload),
    );
});

test('computeProofOfInference: different payloads → different hashes', () => {
    const p1 = { modelId: 'a', actionType: 'r', inputTokens: 1, outputTokens: 1, latencyMs: 1, confidence: 0.1, timestamp: 1 };
    const p2 = { modelId: 'b', actionType: 'r', inputTokens: 1, outputTokens: 1, latencyMs: 1, confidence: 0.1, timestamp: 1 };
    assert.notStrictEqual(computeProofOfInference(p1), computeProofOfInference(p2));
});

// ─────────────────────────────────────────────────────────────────────────────
// shannonEntropy
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Shannon Entropy Utility ===');

test('shannonEntropy: uniform distribution has max entropy', () => {
    const uniform = new Map([['a', 1], ['b', 1], ['c', 1], ['d', 1]]);
    const entropy = shannonEntropy(uniform);
    // log2(4) = 2
    assert.ok(approx(entropy, 2.0, 0.01), `entropy=${entropy}`);
});

test('shannonEntropy: single action type → entropy = 0', () => {
    const single = new Map([['reasoning', 100]]);
    assert.ok(approx(shannonEntropy(single), 0.0));
});

test('shannonEntropy: empty map → entropy = 0', () => {
    assert.strictEqual(shannonEntropy(new Map()), 0);
});

test('shannonEntropy: accepts plain object', () => {
    const obj = { a: 1, b: 1 };
    const entropy = shannonEntropy(obj);
    assert.ok(approx(entropy, 1.0, 0.01));
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 1: Telemetry Interception + PoI + Audit Log
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1: Telemetry Interception ===');

(async () => {
    await testAsync('Claim 1(a)/(b)/(c)/(d): intercept records structured payload', async () => {
        const interceptor = new TelemetryInterceptor();
        const { payload } = await interceptor.intercept(
            { modelId: 'gpt-4o', actionType: 'reasoning', inputTokens: 50 },
            makeFakeInference(100, 0.9),
        );
        assert.strictEqual(payload.modelId,     'gpt-4o');
        assert.strictEqual(payload.actionType,  'reasoning');
        assert.strictEqual(payload.inputTokens, 50);
        assert.strictEqual(payload.outputTokens, 100);
        assert.ok(typeof payload.latencyMs  === 'number', 'latencyMs missing');
        assert.ok(typeof payload.confidence === 'number', 'confidence missing');
        assert.ok(typeof payload.timestamp  === 'number', 'timestamp missing');
    });

    await testAsync('Claim 1(e): returns SHA-256 proofOfInference hash', async () => {
        const interceptor = new TelemetryInterceptor();
        const { proofOfInference } = await interceptor.intercept(
            { modelId: 'm', actionType: 'gen', inputTokens: 10 },
            makeFakeInference(50, 0.8),
        );
        assert.strictEqual(typeof proofOfInference, 'string');
        assert.strictEqual(proofOfInference.length, 64);
    });

    await testAsync('Claim 1(f): audit log persists entries (append-only)', async () => {
        const interceptor = new TelemetryInterceptor();
        await interceptor.intercept({ modelId: 'm', actionType: 'r', inputTokens: 1 }, makeFakeInference());
        await interceptor.intercept({ modelId: 'm', actionType: 'r', inputTokens: 1 }, makeFakeInference());
        const log = interceptor.getAuditLog();
        assert.strictEqual(log.length, 2);
        assert.ok('payload'          in log[0]);
        assert.ok('proofOfInference' in log[0]);
    });

    await testAsync('Claim 1: audit log entries are immutable copies', async () => {
        const interceptor = new TelemetryInterceptor();
        await interceptor.intercept({ modelId: 'm', actionType: 'r', inputTokens: 1 }, makeFakeInference());
        const log = interceptor.getAuditLog();
        // Mutating returned copy should not affect internal log
        log[0].payload.modelId = 'MUTATED';
        const log2 = interceptor.getAuditLog();
        assert.strictEqual(log2[0].payload.modelId, 'm');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 2: Reasoning Jitter
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 2: Reasoning Jitter ===');

    await testAsync('Claim 2: computeReasoningJitter returns numeric std dev', async () => {
        const interceptor = new TelemetryInterceptor();
        // Intercept several times to build window
        for (let i = 0; i < 5; i++) {
            await interceptor.intercept(
                { modelId: 'm', actionType: 'r', inputTokens: 1 },
                makeFakeInference(),
            );
        }
        const { jitter, mean, windowSize } = interceptor.computeReasoningJitter();
        assert.ok(typeof jitter     === 'number');
        assert.ok(typeof mean       === 'number');
        assert.ok(windowSize >= 5, `windowSize=${windowSize}`);
    });

    await testAsync('Claim 2: jitter = 0 when all latencies are identical', async () => {
        const interceptor = new TelemetryInterceptor();
        // Manually inject identical latency readings
        for (let i = 0; i < 10; i++) {
            interceptor._latencyWindow.push(100);
        }
        const { jitter } = interceptor.computeReasoningJitter();
        assert.ok(approx(jitter, 0, 0.001), `expected 0, got ${jitter}`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 3: Confidence Drift
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 3: Confidence Drift ===');

    await testAsync('Claim 3: computeConfidenceDrift returns drift, rollingAvg, historicalMean', async () => {
        const interceptor = new TelemetryInterceptor();
        for (let i = 0; i < 5; i++) {
            await interceptor.intercept(
                { modelId: 'm', actionType: 'r', inputTokens: 1 },
                makeFakeInference(100, 0.9),
            );
        }
        const { drift, rollingAvg, historicalMean } = interceptor.computeConfidenceDrift();
        assert.ok(typeof drift         === 'number');
        assert.ok(typeof rollingAvg    === 'number');
        assert.ok(typeof historicalMean === 'number');
    });

    await testAsync('Claim 3: drift ≈ 0 when rolling avg = historical mean', async () => {
        const interceptor = new TelemetryInterceptor();
        const conf = 0.85;
        // Fill confidence window
        for (let i = 0; i < DEFAULTS.confidence_window_size + 5; i++) {
            interceptor._confidenceWindow.push(conf);
        }
        interceptor._historicalConfMean = conf;
        const { drift } = interceptor.computeConfidenceDrift();
        assert.ok(approx(drift, 0, 0.01), `expected drift≈0, got ${drift}`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 4: Action Distribution Entropy
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 4: Action Distribution Entropy ===');

    await testAsync('Claim 4: entropy of uniform action distribution is high', async () => {
        const interceptor = new TelemetryInterceptor();
        const actionTypes = ['reasoning', 'retrieval', 'generation', 'analysis'];
        for (let rep = 0; rep < 5; rep++) {
            for (const at of actionTypes) {
                await interceptor.intercept(
                    { modelId: 'm', actionType: at, inputTokens: 1 },
                    makeFakeInference(),
                );
            }
        }
        const { entropy, distinctActions } = interceptor.computeActionDistributionEntropy();
        assert.ok(entropy > 1.0, `expected high entropy, got ${entropy}`);
        assert.ok(distinctActions >= 4);
    });

    await testAsync('Claim 4: entropy = 0 for single action type', async () => {
        const interceptor = new TelemetryInterceptor();
        for (let i = 0; i < 10; i++) {
            await interceptor.intercept(
                { modelId: 'm', actionType: 'reasoning', inputTokens: 1 },
                makeFakeInference(),
            );
        }
        const { entropy, distinctActions } = interceptor.computeActionDistributionEntropy();
        assert.ok(approx(entropy, 0, 0.01), `expected 0, got ${entropy}`);
        assert.strictEqual(distinctActions, 1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 5: Anomaly Alerts (Reasoning Jitter)
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 5: Anomaly Detection Alerts ===');

    await testAsync('Claim 5: alert fires when latency exceeds ceiling', async () => {
        const alerts = [];
        // Set ceiling to 0ms so any inference triggers it
        const interceptor = new TelemetryInterceptor({ latency_ceiling_ms: 0 });
        interceptor.onAlert(a => alerts.push(a));

        // Manually inject a high-latency entry to trigger the check directly
        interceptor._latencyWindow.push(999);
        interceptor._confidenceWindow.push(0.5);
        interceptor._actionFreqMap.set('r', 1);
        interceptor._checkAnomalies({ modelId: 'm', actionType: 'r' }, 999, 0.5);

        const latencyAlerts = alerts.filter(a => a.type === 'latency_ceiling');
        assert.ok(latencyAlerts.length >= 1, 'expected latency_ceiling alert');
    });

    await testAsync('Claim 5: alert fires on jitter exceeding historical std', async () => {
        const alerts = [];
        const interceptor = new TelemetryInterceptor({
            jitter_window_size:      5,
            jitter_alert_multiplier: 0.0001,  // essentially any jitter triggers alert
        });
        interceptor.onAlert(a => alerts.push(a));

        // Manually set historical baselines
        interceptor._historicalLatencyMean = 100;
        interceptor._historicalLatencyStd  = 5;

        // Add varied latencies to create jitter
        for (const ms of [80, 120, 200, 50, 300]) {
            interceptor._latencyWindow.push(ms);
        }
        // Manually trigger check
        interceptor._checkAnomalies({ modelId: 'm', actionType: 'r' }, 200, 0.5);

        const jitterAlerts = alerts.filter(a => a.type === 'reasoning_jitter');
        assert.ok(jitterAlerts.length >= 1, 'expected reasoning_jitter alert');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 6: PoI External Publication
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 6: PoI External Publication ===');

    await testAsync('Claim 6: custom poiPublisher is called when poi_store_enabled', async () => {
        const published = [];
        const interceptor = new TelemetryInterceptor({
            poi_store_enabled: true,
            poiPublisher: async (hash, payload) => { published.push({ hash, payload }); },
        });
        await interceptor.intercept(
            { modelId: 'm', actionType: 'r', inputTokens: 1 },
            makeFakeInference(),
        );
        // Allow async publisher to fire
        await new Promise(r => setTimeout(r, 10));
        assert.ok(published.length >= 1, 'expected publisher to be called');
        assert.ok(published[0].hash.length === 64);
    });

    await testAsync('Claim 6: verifyProofOfInference confirms hash integrity', async () => {
        const interceptor = new TelemetryInterceptor();
        const { payload, proofOfInference } = await interceptor.intercept(
            { modelId: 'm', actionType: 'r', inputTokens: 1 },
            makeFakeInference(),
        );
        assert.strictEqual(interceptor.verifyProofOfInference(payload, proofOfInference), true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Claim 7: Full System
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n=== Claim 7: NeuralStreamTelemetry Full System ===');

    await testAsync('Claim 7: NeuralStreamTelemetry assembles all sub-systems', async () => {
        const nst = new NeuralStreamTelemetry();
        assert.ok(nst.interceptor instanceof TelemetryInterceptor);
        assert.strictEqual(typeof nst.trace,      'function');
        assert.strictEqual(typeof nst.getMetrics, 'function');
        assert.strictEqual(typeof nst.onAlert,    'function');
        assert.strictEqual(typeof nst.getAuditLog,'function');
        assert.strictEqual(typeof nst.verify,     'function');
    });

    await testAsync('Claim 7: trace works end-to-end', async () => {
        const nst = new NeuralStreamTelemetry();
        const { payload, proofOfInference } = await nst.trace(
            { modelId: 'gpt-4o', actionType: 'reasoning', inputTokens: 200 },
            makeFakeInference(150, 0.92),
        );
        assert.strictEqual(payload.modelId, 'gpt-4o');
        assert.strictEqual(payload.outputTokens, 150);
        assert.ok(approx(payload.confidence, 0.92));
        assert.strictEqual(proofOfInference.length, 64);
    });

    await testAsync('Claim 7(d): getMetrics returns all three stability metrics', async () => {
        const nst = new NeuralStreamTelemetry();
        for (let i = 0; i < 5; i++) {
            await nst.trace(
                { modelId: 'm', actionType: 'generation', inputTokens: 10 },
                makeFakeInference(50, 0.8),
            );
        }
        const metrics = nst.getMetrics();
        assert.ok('reasoningJitter'           in metrics);
        assert.ok('confidenceDrift'           in metrics);
        assert.ok('actionDistributionEntropy' in metrics);
        assert.ok('auditLogLength'            in metrics);
        assert.ok(metrics.auditLogLength >= 5);
    });

    await testAsync('Claim 7(e): onAlert callback fires from NeuralStreamTelemetry', async () => {
        const alerts = [];
        const nst = new NeuralStreamTelemetry({ latency_ceiling_ms: 0 });
        nst.onAlert(a => alerts.push(a));
        // Directly trigger anomaly check with a ceiling-exceeding latency
        nst.interceptor._checkAnomalies({ modelId: 'm', actionType: 'r' }, 9999, 0.5);
        assert.ok(alerts.length >= 1, 'expected at least one alert');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    console.log(`\n─────────────────────────────────────────`);
    console.log(`HS-053 Neural Telemetry: ${passed} passed, ${failed} failed`);
    console.log(`─────────────────────────────────────────`);

    if (failed > 0) process.exit(1);
})();
