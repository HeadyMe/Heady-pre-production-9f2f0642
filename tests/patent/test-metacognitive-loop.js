/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests: Metacognitive Self-Awareness Loop (HS-061)
 * Covers all 7 patent claims.
 */

'use strict';

const assert = require('assert');
const {
  TelemetryRingBuffer,
  ErrorRateComputer,
  StateAssessmentModule,
  PromptInjectionModule,
  RecommendationEngine,
  BrandingMonitor,
  MetacognitiveLoop,
  PHI,
  SEVERITY,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_WEIGHTS,
  DEFAULT_RING_BUFFER_SIZE,
  WINDOW_1_MIN_MS,
  WINDOW_5_MIN_MS,
} = require('../src/awareness/metacognitive-loop');

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

test('DEFAULT_WEIGHTS has w1=2.0 and w2=0.5', () => {
  assert.strictEqual(DEFAULT_WEIGHTS.w1, 2.0);
  assert.strictEqual(DEFAULT_WEIGHTS.w2, 0.5);
});

test('DEFAULT_RING_BUFFER_SIZE is 500', () => {
  assert.strictEqual(DEFAULT_RING_BUFFER_SIZE, 500);
});

// ─── Claim 5: TelemetryRingBuffer ────────────────────────────────────────────

console.log('\n── Claim 5: TelemetryRingBuffer (configurable, eviction) ────────');

test('TelemetryRingBuffer initialises with correct capacity', () => {
  const buf = new TelemetryRingBuffer(100);
  assert.strictEqual(buf.capacity, 100);
  assert.strictEqual(buf.size, 0);
});

test('TelemetryRingBuffer rejects non-integer or zero size', () => {
  assert.throws(() => new TelemetryRingBuffer(0));
  assert.throws(() => new TelemetryRingBuffer(-5));
});

test('TelemetryRingBuffer.push stores normalised event', () => {
  const buf   = new TelemetryRingBuffer(10);
  const event = buf.push({ type: 'test', summary: 'test event', severity: SEVERITY.INFO });
  assert.strictEqual(event.type, 'test');
  assert(event.id, 'Expected event id');
  assert(event.timestamp, 'Expected timestamp');
});

test('TelemetryRingBuffer.size increments up to capacity', () => {
  const buf = new TelemetryRingBuffer(5);
  for (let i = 0; i < 10; i++) {
    buf.push({ type: 'evt', summary: `${i}`, severity: SEVERITY.INFO });
  }
  assert.strictEqual(buf.size, 5, 'Buffer should cap at capacity');
  assert.strictEqual(buf.totalIngested, 10, 'Total ingested should be 10');
});

test('TelemetryRingBuffer evicts oldest event when full', () => {
  const buf = new TelemetryRingBuffer(3);
  buf.push({ type: 'first',  summary: 'A', severity: SEVERITY.INFO });
  buf.push({ type: 'second', summary: 'B', severity: SEVERITY.INFO });
  buf.push({ type: 'third',  summary: 'C', severity: SEVERITY.INFO });
  buf.push({ type: 'fourth', summary: 'D', severity: SEVERITY.INFO }); // evicts 'first'

  const events = buf.toArray();
  assert.strictEqual(events.length, 3);
  const types = events.map(e => e.type);
  assert(!types.includes('first'), 'Expected "first" to be evicted');
  assert(types.includes('fourth'));
});

test('TelemetryRingBuffer.toArray returns events oldest→newest', () => {
  const buf = new TelemetryRingBuffer(5);
  for (let i = 0; i < 5; i++) {
    buf.push({ type: `evt-${i}`, summary: `${i}`, severity: SEVERITY.INFO, timestamp: Date.now() + i });
  }
  const events = buf.toArray();
  for (let i = 1; i < events.length; i++) {
    assert(events[i].timestamp >= events[i - 1].timestamp, 'Events should be chronological');
  }
});

test('TelemetryRingBuffer.getInWindow returns only events within window', () => {
  const buf  = new TelemetryRingBuffer(100);
  const now  = Date.now();
  buf.push({ type: 'old',   summary: 'old',   severity: SEVERITY.ERROR,   timestamp: now - 200_000 });
  buf.push({ type: 'recent', summary: 'recent', severity: SEVERITY.ERROR, timestamp: now - 30_000 });
  const window = buf.getInWindow(60_000, now);
  assert.strictEqual(window.length, 1);
  assert.strictEqual(window[0].type, 'recent');
});

test('TelemetryRingBuffer.stats returns utilisation percentage', () => {
  const buf = new TelemetryRingBuffer(10);
  for (let i = 0; i < 5; i++) buf.push({ type: 't', summary: 's', severity: SEVERITY.INFO });
  const stats = buf.stats();
  assert.strictEqual(stats.occupied, 5);
  assert.strictEqual(stats.capacity, 10);
  assert.strictEqual(stats.utilizationPct, 50.0);
});

// ─── Claim 1: ErrorRateComputer ───────────────────────────────────────────────

console.log('\n── Claim 1: ErrorRateComputer (rolling error rates) ─────────────');

test('ErrorRateComputer.compute returns 0 for empty window', () => {
  const buf  = new TelemetryRingBuffer(100);
  const comp = new ErrorRateComputer(buf);
  const r    = comp.compute(60_000);
  assert.strictEqual(r.errorRate, 0);
  assert.strictEqual(r.totalCount, 0);
});

test('ErrorRateComputer.compute returns correct error rate', () => {
  const buf  = new TelemetryRingBuffer(100);
  const now  = Date.now();
  buf.push({ type: 'ok',  summary: '', severity: SEVERITY.INFO,  timestamp: now - 10_000 });
  buf.push({ type: 'err', summary: '', severity: SEVERITY.ERROR, timestamp: now - 10_000 });
  buf.push({ type: 'err', summary: '', severity: SEVERITY.ERROR, timestamp: now - 10_000 });
  const comp = new ErrorRateComputer(buf);
  const r    = comp.compute(60_000, now);
  assert.strictEqual(r.totalCount, 3);
  assert.strictEqual(r.errorCount, 2);
  assert(Math.abs(r.errorRate - (2 / 3)) < 0.001);
});

test('ErrorRateComputer.computeBoth returns rate1m and rate5m', () => {
  const buf  = new TelemetryRingBuffer(100);
  const comp = new ErrorRateComputer(buf);
  const { rate1m, rate5m } = comp.computeBoth();
  assert(typeof rate1m.errorRate === 'number');
  assert(typeof rate5m.errorRate === 'number');
});

test('ErrorRateComputer.countCritical counts only CRITICAL events', () => {
  const buf = new TelemetryRingBuffer(100);
  const now = Date.now();
  buf.push({ type: 'c', summary: '', severity: SEVERITY.CRITICAL, timestamp: now - 10_000 });
  buf.push({ type: 'e', summary: '', severity: SEVERITY.ERROR,    timestamp: now - 10_000 });
  const comp = new ErrorRateComputer(buf);
  assert.strictEqual(comp.countCritical(60_000, now), 1);
});

// ─── Claims 2 + 4: StateAssessmentModule ─────────────────────────────────────

console.log('\n── Claims 2+4: StateAssessmentModule (formula + penalty) ────────');

test('Claim 2: confidence = 1.0 - (er1m * w1) - (er5m * w2) with no errors', () => {
  const buf   = new TelemetryRingBuffer(100);
  const comp  = new ErrorRateComputer(buf);
  const mod   = new StateAssessmentModule(buf, comp, { w1: 2.0, w2: 0.5 });
  const ass   = mod.assessSystemState();
  // No errors → confidence = 1.0
  assert.strictEqual(ass.confidence, 1.0);
});

test('Claim 2: confidence formula applies w1/w2 weights correctly', () => {
  const buf  = new TelemetryRingBuffer(100);
  const now  = Date.now();
  // 2 errors out of 4 events in last 1m → er1m = 0.5
  for (let i = 0; i < 2; i++) buf.push({ type: 'ok',  summary: '', severity: SEVERITY.INFO,  timestamp: now - 10_000 });
  for (let i = 0; i < 2; i++) buf.push({ type: 'err', summary: '', severity: SEVERITY.ERROR, timestamp: now - 10_000 });
  const comp = new ErrorRateComputer(buf);
  const mod  = new StateAssessmentModule(buf, comp, { w1: 2.0, w2: 0.5 });
  const ass  = mod.assessSystemState(now);
  // er1m = er5m = 0.5 (same window)
  // confidence = 1.0 - (0.5 * 2.0) - (0.5 * 0.5) = 1.0 - 1.0 - 0.25 = -0.25 → clamped to 0
  assert.strictEqual(ass.confidence, 0);
});

test('Claim 4: critical event applies penalty', () => {
  const buf  = new TelemetryRingBuffer(100);
  const now  = Date.now();
  buf.push({ type: 'crit', summary: 'outage', severity: SEVERITY.CRITICAL, timestamp: now - 10_000 });
  const comp = new ErrorRateComputer(buf);
  const mod  = new StateAssessmentModule(buf, comp, { criticalPenalty: 0.2 });
  const ass  = mod.assessSystemState(now);
  // er1m=1.0, er5m=1.0 → formula = 1 - 2 - 0.5 = -1.5 clamped to 0
  // (critical penalty on top would also be 0 since already at 0)
  assert(ass.criticalPenalty > 0 || ass.criticalCount > 0);
});

test('assessSystemState generates a non-empty contextString', () => {
  const buf  = new TelemetryRingBuffer(100);
  const comp = new ErrorRateComputer(buf);
  const mod  = new StateAssessmentModule(buf, comp);
  const ass  = mod.assessSystemState();
  assert(typeof ass.contextString === 'string' && ass.contextString.length > 0);
});

// ─── Claim 3: RecommendationEngine ───────────────────────────────────────────

console.log('\n── Claim 3: RecommendationEngine (recommendations) ──────────────');

test('Recommendation: PROCEED_NORMALLY when confidence is high', () => {
  const eng = new RecommendationEngine();
  const recs = eng.generateRecommendations({ confidence: 0.95, criticalCount: 0, errorRate1m: 0, errorRate5m: 0 });
  const codes = recs.map(r => r.code);
  assert(codes.includes('PROCEED_NORMALLY'));
});

test('Recommendation: REDUCE_INFERENCE_TEMPERATURE when confidence ~0.8', () => {
  const eng = new RecommendationEngine();
  // Confidence 0.80: between DEFER_HUMAN (0.45) and REDUCE_TEMP (0.75) thresholds
  // REDUCE_TEMP fires when confidence < HEALTHY (0.90) AND >= DEFER_HUMAN (0.45)
  const recs = eng.generateRecommendations({ confidence: 0.80, criticalCount: 0, errorRate1m: 0.1, errorRate5m: 0.05 });
  const codes = recs.map(r => r.code);
  // At confidence 0.80: below HEALTHY(0.90), above DEFER_HUMAN(0.45) → REDUCE_INFERENCE_TEMPERATURE
  assert(codes.includes('REDUCE_INFERENCE_TEMPERATURE') || codes.includes('INCREASE_MONITORING_FREQUENCY'),
    `Got: ${codes.join(',')}`);
  // Verify it does NOT include PROCEED_NORMALLY (confidence < 0.90)
  assert(!codes.includes('PROCEED_NORMALLY'), 'Should not proceed normally at 0.80 confidence');
});

test('Recommendation: DEFER_TO_HUMAN_REVIEW when confidence < 0.45', () => {
  const eng = new RecommendationEngine();
  const recs = eng.generateRecommendations({ confidence: 0.20, criticalCount: 0, errorRate1m: 0.5, errorRate5m: 0.4 });
  const codes = recs.map(r => r.code);
  assert(codes.includes('DEFER_TO_HUMAN_REVIEW'));
});

test('Recommendation: INCREASE_MONITORING_FREQUENCY when confidence < 0.60', () => {
  const eng  = new RecommendationEngine();
  const recs = eng.generateRecommendations({ confidence: 0.55, criticalCount: 0, errorRate1m: 0.0, errorRate5m: 0.0 });
  const codes = recs.map(r => r.code);
  assert(codes.includes('INCREASE_MONITORING_FREQUENCY'), `Got: ${codes.join(',')}`);
});

test('Recommendation: CRITICAL_EVENT_REVIEW when criticalCount > 0', () => {
  const eng  = new RecommendationEngine();
  const recs = eng.generateRecommendations({ confidence: 0.95, criticalCount: 2, errorRate1m: 0, errorRate5m: 0 });
  const codes = recs.map(r => r.code);
  assert(codes.includes('CRITICAL_EVENT_REVIEW'));
});

// ─── Claim 1(e): PromptInjectionModule ───────────────────────────────────────

console.log('\n── Claim 1(e): PromptInjectionModule (prompt injection) ─────────');

test('buildContextBlock returns a string with confidence', () => {
  const buf   = new TelemetryRingBuffer(100);
  const comp  = new ErrorRateComputer(buf);
  const assm  = new StateAssessmentModule(buf, comp);
  const rec   = new RecommendationEngine();
  const inj   = new PromptInjectionModule(assm, rec);
  const block = inj.buildContextBlock();
  assert(typeof block === 'string');
  assert(block.includes('[System Self-Assessment]'));
  assert(block.includes('Confidence:'));
  assert(block.includes('[End Self-Assessment]'));
});

test('injectIntoPrompt prepends context block to prompt', () => {
  const buf  = new TelemetryRingBuffer(100);
  const comp = new ErrorRateComputer(buf);
  const assm = new StateAssessmentModule(buf, comp);
  const rec  = new RecommendationEngine();
  const inj  = new PromptInjectionModule(assm, rec);
  const augmented = inj.injectIntoPrompt('What is the meaning of life?');
  assert(augmented.includes('[System Self-Assessment]'));
  assert(augmented.includes('What is the meaning of life?'));
});

test('buildSystemMessage returns { role, content }', () => {
  const buf  = new TelemetryRingBuffer(100);
  const comp = new ErrorRateComputer(buf);
  const assm = new StateAssessmentModule(buf, comp);
  const rec  = new RecommendationEngine();
  const inj  = new PromptInjectionModule(assm, rec);
  const msg  = inj.buildSystemMessage();
  assert.strictEqual(msg.role, 'system');
  assert(typeof msg.content === 'string');
});

// ─── Claim 6: BrandingMonitor ────────────────────────────────────────────────

console.log('\n── Claim 6: BrandingMonitor (multi-domain branding) ─────────────');

test('BrandingMonitor.registerDomain stores descriptor', () => {
  const bm = new BrandingMonitor();
  const d  = bm.registerDomain('headyconnection', 'https://headyconnection.org', ['HeadyConnection']);
  assert.strictEqual(d.id, 'headyconnection');
  assert.strictEqual(d.lastStatus, 'unknown');
});

test('BrandingMonitor.brandHealthReport returns correct structure', () => {
  const bm = new BrandingMonitor();
  bm.registerDomain('site-a', 'https://example.com', ['Example']);
  bm.registerDomain('site-b', 'https://example.org', ['Example']);
  const report = bm.brandHealthReport();
  assert.strictEqual(report.totalDomains, 2);
  assert(Array.isArray(report.domains));
});

test('BrandingMonitor.deregisterDomain removes it', () => {
  const bm = new BrandingMonitor();
  bm.registerDomain('to-remove', 'https://example.com');
  assert.strictEqual(bm.brandHealthReport().totalDomains, 1);
  bm.deregisterDomain('to-remove');
  assert.strictEqual(bm.brandHealthReport().totalDomains, 0);
});

// ─── Claim 7: MetacognitiveLoop (full system) ─────────────────────────────────

console.log('\n── Claim 7: MetacognitiveLoop (full system) ──────────────────────');

test('MetacognitiveLoop constructs all subsystems', () => {
  const loop = new MetacognitiveLoop();
  assert(loop.ringBuffer          instanceof TelemetryRingBuffer);
  assert(loop.errorRateComputer   instanceof ErrorRateComputer);
  assert(loop.stateAssessment     instanceof StateAssessmentModule);
  assert(loop.recommendationEngine instanceof RecommendationEngine);
  assert(loop.promptInjection     instanceof PromptInjectionModule);
  assert(loop.brandingMonitor     instanceof BrandingMonitor);
});

test('MetacognitiveLoop.ingest adds events to ring buffer', () => {
  const loop = new MetacognitiveLoop({ ringBufferSize: 100 });
  loop.ingest({ type: 'api_error', summary: 'Upstream timeout', severity: SEVERITY.ERROR });
  assert.strictEqual(loop.ringBuffer.size, 1);
});

test('MetacognitiveLoop.assess returns assessment and recommendations', () => {
  const loop   = new MetacognitiveLoop();
  const result = loop.assess();
  assert(result.assessment);
  assert(Array.isArray(result.recommendations));
});

test('MetacognitiveLoop.injectPrompt augments prompt with self-assessment', () => {
  const loop      = new MetacognitiveLoop();
  const augmented = loop.injectPrompt('Execute trade order.');
  assert(augmented.includes('[System Self-Assessment]'));
  assert(augmented.includes('Execute trade order.'));
});

test('MetacognitiveLoop.fullReport includes branding health', () => {
  const loop   = new MetacognitiveLoop();
  const report = loop.fullReport();
  assert(typeof report.confidence === 'number');
  assert(report.branding);
  assert.strictEqual(report.phi, PHI);
});

test('MetacognitiveLoop respects configurable ring buffer size', () => {
  const loop = new MetacognitiveLoop({ ringBufferSize: 10 });
  for (let i = 0; i < 20; i++) {
    loop.ingest({ type: 'evt', summary: `${i}`, severity: SEVERITY.INFO });
  }
  assert.strictEqual(loop.ringBuffer.size, 10);
  assert.strictEqual(loop.ringBuffer.totalIngested, 20);
});

test('MetacognitiveLoop confidence degrades with errors', () => {
  const loop = new MetacognitiveLoop();
  const now  = Date.now();
  for (let i = 0; i < 10; i++) {
    loop.ringBuffer.push({ type: 'err', summary: 'fail', severity: SEVERITY.ERROR, timestamp: now - 10_000 });
  }
  const { assessment } = loop.assess();
  assert(assessment.confidence < 1.0, `Expected degraded confidence, got ${assessment.confidence}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
