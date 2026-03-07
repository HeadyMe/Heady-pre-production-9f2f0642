/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests: Monte Carlo Engine
 * Covers: runSimulation, distributions, confidence intervals, pipeline hooks,
 *         quickReadiness, scenario analysis, risk scoring.
 */

'use strict';

const assert = require('assert');
const {
  MonteCarloEngine,
  mulberry32,
  sampleUniform,
  sampleNormal,
  sampleTriangular,
  sample,
  wilsonInterval,
  descriptiveStats,
  scoreToGrade,
  PHI,
  RISK_GRADE,
  DISTRIBUTION,
  OUTCOME_THRESHOLDS,
} = require('../src/intelligence/monte-carlo-engine');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

console.log('\n── Constants ─────────────────────────────────────────────────────');

test('PHI equals 1.6180339887', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

test('RISK_GRADE has GREEN, YELLOW, ORANGE, RED', () => {
  assert(RISK_GRADE.GREEN  === 'GREEN');
  assert(RISK_GRADE.YELLOW === 'YELLOW');
  assert(RISK_GRADE.ORANGE === 'ORANGE');
  assert(RISK_GRADE.RED    === 'RED');
});

test('OUTCOME_THRESHOLDS.SUCCESS_MAX is 0.30', () => {
  assert.strictEqual(OUTCOME_THRESHOLDS.SUCCESS_MAX, 0.30);
});

// ─── Mulberry32 PRNG ──────────────────────────────────────────────────────────

console.log('\n── Mulberry32 PRNG ───────────────────────────────────────────────');

test('mulberry32 returns values in [0, 1)', () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = rand();
    assert(v >= 0 && v < 1, `Out of range: ${v}`);
  }
});

test('mulberry32 is deterministic with same seed', () => {
  const rand1 = mulberry32(123);
  const rand2 = mulberry32(123);
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(rand1(), rand2());
  }
});

test('mulberry32 produces different sequences for different seeds', () => {
  const rand1 = mulberry32(1);
  const rand2 = mulberry32(2);
  let same = true;
  for (let i = 0; i < 10; i++) {
    if (rand1() !== rand2()) { same = false; break; }
  }
  assert(!same, 'Expected different sequences for different seeds');
});

// ─── Distribution Samplers ────────────────────────────────────────────────────

console.log('\n── Distribution Samplers ─────────────────────────────────────────');

test('sampleUniform returns values in [min, max]', () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const v = sampleUniform(rand, 5, 10);
    assert(v >= 5 && v <= 10, `Out of range: ${v}`);
  }
});

test('sampleNormal produces values centred around mean', () => {
  const rand   = mulberry32(9);
  const values = [];
  for (let i = 0; i < 10_000; i++) values.push(sampleNormal(rand, 50, 10));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  assert(Math.abs(avg - 50) < 1, `Expected mean ≈ 50, got ${avg.toFixed(2)}`);
});

test('sampleTriangular returns values in [min, max]', () => {
  const rand = mulberry32(11);
  for (let i = 0; i < 1000; i++) {
    const v = sampleTriangular(rand, 0, 0.5, 1);
    assert(v >= 0 && v <= 1, `Out of range: ${v}`);
  }
});

test('sample dispatches to correct distribution', () => {
  const rand = mulberry32(13);
  const u = sample(rand, DISTRIBUTION.UNIFORM,    { min: 0, max: 1 });
  const n = sample(rand, DISTRIBUTION.NORMAL,     { mean: 0, stddev: 1 });
  const t = sample(rand, DISTRIBUTION.TRIANGULAR, { min: 0, mode: 0.5, max: 1 });
  assert(typeof u === 'number');
  assert(typeof n === 'number');
  assert(typeof t === 'number');
});

// ─── Statistical Helpers ──────────────────────────────────────────────────────

console.log('\n── Statistical Helpers ───────────────────────────────────────────');

test('scoreToGrade maps ranges correctly', () => {
  assert.strictEqual(scoreToGrade(100), RISK_GRADE.GREEN);
  assert.strictEqual(scoreToGrade(80),  RISK_GRADE.GREEN);
  assert.strictEqual(scoreToGrade(79),  RISK_GRADE.YELLOW);
  assert.strictEqual(scoreToGrade(60),  RISK_GRADE.YELLOW);
  assert.strictEqual(scoreToGrade(59),  RISK_GRADE.ORANGE);
  assert.strictEqual(scoreToGrade(40),  RISK_GRADE.ORANGE);
  assert.strictEqual(scoreToGrade(39),  RISK_GRADE.RED);
  assert.strictEqual(scoreToGrade(0),   RISK_GRADE.RED);
});

test('wilsonInterval returns bounds in [0, 1]', () => {
  const { lower, upper } = wilsonInterval(0.1, 1000);
  assert(lower >= 0 && lower <= 1);
  assert(upper >= 0 && upper <= 1);
  assert(upper > lower);
});

test('wilsonInterval handles zero sample size', () => {
  const r = wilsonInterval(0, 0);
  assert.strictEqual(r.lower, 0);
  assert.strictEqual(r.upper, 1);
});

test('descriptiveStats computes correct mean and min/max', () => {
  const stats = descriptiveStats([1, 2, 3, 4, 5]);
  assert.strictEqual(stats.mean, 3.0);
  assert.strictEqual(stats.min,  1.0);
  assert.strictEqual(stats.max,  5.0);
});

test('descriptiveStats handles empty array', () => {
  const stats = descriptiveStats([]);
  assert.strictEqual(stats.mean, 0);
});

// ─── runSimulation ────────────────────────────────────────────────────────────

console.log('\n── runSimulation ─────────────────────────────────────────────────');

test('runSimulation returns required fields', () => {
  const eng = new MonteCarloEngine();
  const res = eng.runSimulation({ name: 'test', seed: 42 }, 100);
  assert(res.scenario === 'test');
  assert(typeof res.confidence   === 'number');
  assert(typeof res.failureRate  === 'number');
  assert(typeof res.successRate  === 'number');
  assert(typeof res.partialRate  === 'number');
  assert(res.outcomes);
  assert(res.confidenceBounds);
  assert(res.impactDistribution);
});

test('runSimulation outcomes sum to iterations', () => {
  const eng = new MonteCarloEngine();
  const res = eng.runSimulation({ seed: 1 }, 1000);
  const sum = res.outcomes.success + res.outcomes.partial + res.outcomes.failure;
  assert.strictEqual(sum, 1000);
});

test('runSimulation is deterministic with same seed', () => {
  const eng = new MonteCarloEngine();
  const r1  = eng.runSimulation({ name: 'det', seed: 777 }, 500);
  const r2  = eng.runSimulation({ name: 'det', seed: 777 }, 500);
  assert.strictEqual(r1.confidence,   r2.confidence);
  assert.strictEqual(r1.failureRate,  r2.failureRate);
});

test('runSimulation with high-probability risk factors reduces confidence', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.runSimulation({
    seed: 42,
    riskFactors: [
      { name: 'outage',   probability: 0.9, impact: 0.8 },
      { name: 'breach',   probability: 0.8, impact: 0.9 },
    ],
  }, 1000);
  assert(r.confidence < 50, `Expected low confidence, got ${r.confidence}`);
});

test('runSimulation with low-probability risks yields high confidence', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.runSimulation({
    seed: 99,
    riskFactors: [
      { name: 'minor', probability: 0.01, impact: 0.05 },
    ],
  }, 1000);
  assert(r.confidence > 80, `Expected high confidence, got ${r.confidence}`);
});

test('mitigation reduces effective impact', () => {
  const eng = new MonteCarloEngine();
  const without = eng.runSimulation({
    seed: 42,
    riskFactors: [{ name: 'risk', probability: 0.8, impact: 0.9 }],
  }, 1000);
  const withMit = eng.runSimulation({
    seed: 42,
    riskFactors: [{ name: 'risk', probability: 0.8, impact: 0.9, mitigation: 'firewall', mitigationReduction: 0.8 }],
  }, 1000);
  assert(withMit.confidence >= without.confidence, 'Mitigation should improve confidence');
});

test('runSimulation riskGrade is consistent with confidence', () => {
  const eng = new MonteCarloEngine();
  const res = eng.runSimulation({ seed: 42 }, 1000);
  assert.strictEqual(res.riskGrade, scoreToGrade(res.confidence));
});

test('runSimulation includes topMitigations list', () => {
  const eng = new MonteCarloEngine();
  const res = eng.runSimulation({
    seed: 42,
    riskFactors: [
      { name: 'r1', probability: 0.5, impact: 0.5, mitigation: 'patch' },
    ],
  }, 500);
  assert(Array.isArray(res.topMitigations));
});

test('runSimulation includes normal distribution support', () => {
  const eng = new MonteCarloEngine();
  const res = eng.runSimulation({
    seed: 42,
    riskFactors: [{
      name: 'normal-risk',
      probability: 0.5,
      impact: 0.3,
      distribution: DISTRIBUTION.NORMAL,
      distributionParams: { mean: 0.3, stddev: 0.1 },
    }],
  }, 500);
  assert(typeof res.confidence === 'number');
});

// ─── quickReadiness ───────────────────────────────────────────────────────────

console.log('\n── quickReadiness ────────────────────────────────────────────────');

test('quickReadiness returns GREEN for healthy signals', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.quickReadiness({
    errorRate: 0, lastDeploySuccess: true, cpuPressure: 0,
    memoryPressure: 0, serviceHealthRatio: 1, openIncidents: 0,
  });
  assert.strictEqual(r.grade, RISK_GRADE.GREEN);
  assert(r.score >= 80);
});

test('quickReadiness returns RED for degraded signals', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.quickReadiness({
    errorRate: 0.4, lastDeploySuccess: false, cpuPressure: 0.9,
    memoryPressure: 0.9, serviceHealthRatio: 0.2, openIncidents: 5,
  });
  assert(r.score < 60, `Expected low score, got ${r.score}`);
});

test('quickReadiness breakdown sums approximate to score', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.quickReadiness({});
  assert(r.breakdown);
  assert(typeof r.breakdown.errorScore  === 'number');
  assert(typeof r.breakdown.deployScore === 'number');
});

// ─── Scenario Analysis ────────────────────────────────────────────────────────

console.log('\n── Scenario Analysis ─────────────────────────────────────────────');

test('analyseScenarios returns comparison with best and worst', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.analyseScenarios([
    { name: 'optimistic', params: { seed: 1, riskFactors: [] }, iterations: 200 },
    { name: 'pessimistic', params: { seed: 2, riskFactors: [{ probability: 0.9, impact: 0.9 }] }, iterations: 200 },
  ]);
  assert(r.comparison.best);
  assert(r.comparison.worst);
  assert(typeof r.comparison.average === 'number');
});

// ─── Pipeline Hooks ───────────────────────────────────────────────────────────

console.log('\n── Pipeline Stage Integration ────────────────────────────────────');

test('registerPipelineHook is called after simulation for matching stage', () => {
  const eng   = new MonteCarloEngine();
  let hookCalled = false;
  eng.registerPipelineHook('risk-stage', (result) => { hookCalled = true; });
  eng.runSimulation({ name: 'with-hook', seed: 1, pipelineStage: 'risk-stage' }, 100);
  assert(hookCalled, 'Expected pipeline hook to be called');
});

test('clearPipelineHooks removes hooks for stage', () => {
  const eng = new MonteCarloEngine();
  let count = 0;
  eng.registerPipelineHook('stage-x', () => { count++; });
  eng.clearPipelineHooks('stage-x');
  eng.runSimulation({ pipelineStage: 'stage-x', seed: 1 }, 100);
  assert.strictEqual(count, 0, 'Hook should not be called after clearing');
});

// ─── Risk Scoring Utility ─────────────────────────────────────────────────────

console.log('\n── scoreRisk ─────────────────────────────────────────────────────');

test('scoreRisk returns 100 for no risk factors', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.scoreRisk([]);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.grade, RISK_GRADE.GREEN);
});

test('scoreRisk returns lower score for high-probability impacts', () => {
  const eng = new MonteCarloEngine();
  const r   = eng.scoreRisk([
    { probability: 0.9, impact: 0.9 },
  ]);
  assert(r.score < 30, `Expected low score, got ${r.score}`);
});

// ─── History & Status ─────────────────────────────────────────────────────────

console.log('\n── History & Status ──────────────────────────────────────────────');

test('getHistory returns recent simulations', () => {
  const eng = new MonteCarloEngine();
  eng.runSimulation({ name: 'h1', seed: 1 }, 100);
  eng.runSimulation({ name: 'h2', seed: 2 }, 100);
  const hist = eng.getHistory(5);
  assert(hist.length === 2);
  assert(hist[0].scenario === 'h1');
});

test('clearHistory empties the history', () => {
  const eng = new MonteCarloEngine();
  eng.runSimulation({ seed: 1 }, 100);
  eng.clearHistory();
  assert.strictEqual(eng.getHistory().length, 0);
});

test('status returns totalRuns and phi', () => {
  const eng = new MonteCarloEngine();
  eng.runSimulation({ seed: 1 }, 100);
  const s = eng.status();
  assert.strictEqual(s.totalRuns, 1);
  assert.strictEqual(s.phi, PHI);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
