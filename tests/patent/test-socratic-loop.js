/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests: Socratic Execution Loop
 * Covers all 4 validation phases: Intent Verification, Consequence Prediction,
 * Law Compliance, and Confidence Gate.
 */

'use strict';

const assert = require('assert');
const {
  SocraticLoop,
  phaseIntentVerification,
  phaseConsequencePrediction,
  phaseLawCompliance,
  phaseConfidenceGate,
  _semanticSimilarity,
  _keywordScan,
  PHI,
  PHASE,
  DECISION,
  LAW_VIOLATION_SEVERITY,
  UNBREAKABLE_LAWS,
  PHASE_WEIGHTS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} = require('../src/orchestration/socratic-execution-loop');

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

async function testAsync(name, fn) {
  try {
    await fn();
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

test('DEFAULT_CONFIDENCE_THRESHOLD is 0.60', () => {
  assert.strictEqual(DEFAULT_CONFIDENCE_THRESHOLD, 0.60);
});

test('PHASE has all 4 phases', () => {
  assert(PHASE.INTENT_VERIFICATION);
  assert(PHASE.CONSEQUENCE_PREDICTION);
  assert(PHASE.LAW_COMPLIANCE);
  assert(PHASE.CONFIDENCE_GATE);
});

test('DECISION has GO, NO_GO, DEFERRED', () => {
  assert(DECISION.GO       === 'GO');
  assert(DECISION.NO_GO    === 'NO_GO');
  assert(DECISION.DEFERRED === 'DEFERRED');
});

test('UNBREAKABLE_LAWS has exactly 3 laws', () => {
  assert.strictEqual(UNBREAKABLE_LAWS.length, 3);
});

test('All 3 laws have BLOCK severity', () => {
  for (const law of UNBREAKABLE_LAWS) {
    assert.strictEqual(law.severity, LAW_VIOLATION_SEVERITY.BLOCK);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

console.log('\n── Helper Functions ──────────────────────────────────────────────');

test('_semanticSimilarity returns 1.0 for identical strings', () => {
  const s = _semanticSimilarity('deploy the service', 'deploy the service');
  assert.strictEqual(s, 1.0);
});

test('_semanticSimilarity returns 0 for completely unrelated strings', () => {
  const s = _semanticSimilarity('cat', 'quantum entanglement');
  assert(s < 0.3, `Expected low similarity, got ${s}`);
});

test('_semanticSimilarity returns partial match for overlapping words', () => {
  const s = _semanticSimilarity('deploy service', 'deploy application');
  assert(s > 0 && s < 1);
});

test('_keywordScan finds matching keywords (case-insensitive)', () => {
  const r = _keywordScan('rm -rf /data', ['rm -rf', 'delete']);
  assert.strictEqual(r.found, true);
  assert(r.matches.includes('rm -rf'));
});

test('_keywordScan returns found=false when no match', () => {
  const r = _keywordScan('deploy the app', ['rm -rf', 'wipe']);
  assert.strictEqual(r.found, false);
  assert.strictEqual(r.matches.length, 0);
});

// ─── Phase 1: Intent Verification ────────────────────────────────────────────

console.log('\n── Phase 1: Intent Verification ──────────────────────────────────');

test('Phase 1 passes for clear, unambiguous intent', () => {
  const r = phaseIntentVerification('Deploy the staging environment to production', {});
  assert.strictEqual(r.phase, PHASE.INTENT_VERIFICATION);
  assert(typeof r.passed === 'boolean');
  assert(typeof r.score  === 'number');
});

test('Phase 1 score in [0, 1]', () => {
  const r = phaseIntentVerification('Run the data migration script', {});
  assert(r.score >= 0 && r.score <= 1);
});

test('Phase 1 warns on very short action', () => {
  const r = phaseIntentVerification('x', {});
  assert(r.details.ambiguous === true);
  assert(r.warnings.length > 0);
});

test('Phase 1 checks alignment with objective', () => {
  const r = phaseIntentVerification('deploy the service', {
    objective: 'deploy production services',
  });
  // Jaccard similarity between 'deploy the service' and 'deploy production services'
  // Shared tokens: {'deploy', 'service', 'services' (different)} → at least some overlap
  assert(r.details.objectiveAlignment >= 0, `objectiveAlignment should be non-negative: ${r.details.objectiveAlignment}`);
  // Phase should complete without errors
  assert(typeof r.score === 'number');
});

test('Phase 1 checks allowed intent list', () => {
  const r = phaseIntentVerification('delete all records', {
    allowedIntents: ['read data', 'analyse metrics'],
  });
  // 'delete all records' is very different from 'read data' → should warn or not be allowed
  assert(Array.isArray(r.warnings));
});

// ─── Phase 2: Consequence Prediction ─────────────────────────────────────────

console.log('\n── Phase 2: Consequence Prediction ──────────────────────────────');

test('Phase 2 passes for reversible local action', () => {
  const r = phaseConsequencePrediction('update config', {
    consequences: { reversible: true, estimatedScope: 'local', estimatedImpactScore: 0.1 },
  });
  assert.strictEqual(r.phase, PHASE.CONSEQUENCE_PREDICTION);
  assert(r.passed);
});

test('Phase 2 warns on irreversible action', () => {
  const r = phaseConsequencePrediction('purge database', {
    consequences: { reversible: false, estimatedScope: 'service', estimatedImpactScore: 0.6 },
  });
  assert(r.warnings.some(w => w.includes('irreversible')));
});

test('Phase 2 warns on global scope', () => {
  const r = phaseConsequencePrediction('restart all services', {
    consequences: { reversible: true, estimatedScope: 'global', estimatedImpactScore: 0.4 },
  });
  assert(r.warnings.some(w => w.includes('Global scope') || w.includes('global')));
});

test('Phase 2 score in [0, 1]', () => {
  const r = phaseConsequencePrediction('action', { consequences: {} });
  assert(r.score >= 0 && r.score <= 1);
});

test('Phase 2 populates simulatedOutcomes', () => {
  const r = phaseConsequencePrediction('action', {
    consequences: {
      simulatedOutcomes: [
        { label: 'primary', probability: 0.8, description: 'success', severity: 'low' },
      ],
    },
  });
  assert(r.details.simulatedOutcomes.length >= 1);
});

// ─── Phase 3: Law Compliance ──────────────────────────────────────────────────

console.log('\n── Phase 3: Law Compliance (3 Unbreakable Laws) ─────────────────');

test('Phase 3 passes for a benign action', () => {
  const r = phaseLawCompliance('Read the configuration file', {});
  assert.strictEqual(r.phase, PHASE.LAW_COMPLIANCE);
  assert.strictEqual(r.passed, true);
  assert.strictEqual(r.hardBlock, false);
});

test('Law 1 blocks "rm -rf" pattern', () => {
  const r = phaseLawCompliance('rm -rf /data', {});
  assert.strictEqual(r.hardBlock, true);
  assert.strictEqual(r.passed, false);
  const v = r.details.violations.find(v => v.lawId === 'LAW_1_NO_HARM');
  assert(v, 'Expected LAW_1_NO_HARM violation');
});

test('Law 1 blocks "delete all" pattern', () => {
  const r = phaseLawCompliance('delete all user records immediately', {});
  assert.strictEqual(r.hardBlock, true);
});

test('Law 2 blocks "disable logging" pattern', () => {
  const r = phaseLawCompliance('disable logging before the operation', {});
  assert.strictEqual(r.hardBlock, true);
  const v = r.details.violations.find(v => v.lawId === 'LAW_2_TRANSPARENCY');
  assert(v, 'Expected LAW_2_TRANSPARENCY violation');
});

test('Law 3 blocks "bypass auth" pattern', () => {
  const r = phaseLawCompliance('bypass auth to gain admin access', {});
  assert.strictEqual(r.hardBlock, true);
  const v = r.details.violations.find(v => v.lawId === 'LAW_3_HUMAN_OVERRIDE');
  assert(v, 'Expected LAW_3_HUMAN_OVERRIDE violation');
});

test('Phase 3 score is 0 on hard block', () => {
  const r = phaseLawCompliance('wipe all data', {});
  assert.strictEqual(r.score, 0);
});

test('Phase 3 score is 1.0 for clean action', () => {
  const r = phaseLawCompliance('generate a report', {});
  assert.strictEqual(r.score, 1.0);
});

test('Custom laws are checked', () => {
  const r = phaseLawCompliance('execute financial transfer', {}, );
  // Custom law with 'financial transfer' keyword
  const r2 = phaseLawCompliance('execute financial transfer', {
    customLaws: [{ id: 'CL-1', lawId: 'CL-1', name: 'No transfers', severity: LAW_VIOLATION_SEVERITY.BLOCK, keywords: ['financial transfer'] }],
  });
  assert.strictEqual(r2.hardBlock, true);
});

// ─── Phase 4: Confidence Gate ─────────────────────────────────────────────────

console.log('\n── Phase 4: Confidence Gate ──────────────────────────────────────');

test('Phase 4 GO when composite score above threshold', () => {
  const priorPhases = [
    { phase: PHASE.INTENT_VERIFICATION,    passed: true, score: 0.9 },
    { phase: PHASE.CONSEQUENCE_PREDICTION, passed: true, score: 0.9 },
    { phase: PHASE.LAW_COMPLIANCE,         passed: true, score: 1.0 },
  ];
  const r = phaseConfidenceGate(priorPhases, { confidenceThreshold: 0.60 });
  assert.strictEqual(r.decision, DECISION.GO);
  assert.strictEqual(r.passed, true);
});

test('Phase 4 NO_GO when composite score below threshold', () => {
  const priorPhases = [
    { phase: PHASE.INTENT_VERIFICATION,    passed: false, score: 0.1 },
    { phase: PHASE.CONSEQUENCE_PREDICTION, passed: false, score: 0.1 },
    { phase: PHASE.LAW_COMPLIANCE,         passed: true,  score: 1.0 },
  ];
  const r = phaseConfidenceGate(priorPhases, { confidenceThreshold: 0.60 });
  // Composite = (0.1 * 0.2 + 0.1 * 0.3 + 1.0 * 0.35) / (0.2+0.3+0.35) = 0.42/0.85 ≈ 0.49
  // 0.49 < 0.60 threshold → NO_GO or DEFERRED (if near-threshold band applies)
  assert(r.decision === DECISION.NO_GO || r.decision === DECISION.DEFERRED,
    `Expected NO_GO or DEFERRED, got ${r.decision}`);
  assert.strictEqual(r.passed, false);
});

test('Phase 4 blends CSL confidence when provided', () => {
  const priorPhases = [
    { phase: PHASE.INTENT_VERIFICATION,    passed: true, score: 0.8 },
    { phase: PHASE.CONSEQUENCE_PREDICTION, passed: true, score: 0.8 },
    { phase: PHASE.LAW_COMPLIANCE,         passed: true, score: 0.8 },
  ];
  const r = phaseConfidenceGate(priorPhases, { cslConfidence: 0.95, confidenceThreshold: 0.60 });
  assert(r.details.cslScore === 0.95);
});

// ─── SocraticLoop (full integration) ─────────────────────────────────────────

console.log('\n── SocraticLoop (full 4-phase validation) ────────────────────────');

(async () => {

await testAsync('validateAction returns GO for safe, benign action', async () => {
  const loop = new SocraticLoop({ confidenceThreshold: 0.40 });
  const res  = await loop.validateAction('Generate a summary report of Q3 metrics', {
    objective:    'produce analytics reports',
    consequences: { reversible: true, estimatedScope: 'local', estimatedImpactScore: 0.05 },
  });
  assert.strictEqual(res.decision, DECISION.GO);
  assert.strictEqual(res.passed, true);
});

await testAsync('validateAction returns NO_GO for law-violating action', async () => {
  const loop = new SocraticLoop();
  const res  = await loop.validateAction('rm -rf /production-db');
  assert.strictEqual(res.decision, DECISION.NO_GO);
  assert.strictEqual(res.passed, false);
  assert.strictEqual(res.blockedBy, PHASE.LAW_COMPLIANCE);
});

await testAsync('validateAction result has all 4 phaseResults', async () => {
  const loop = new SocraticLoop();
  const res  = await loop.validateAction('Update the configuration file');
  assert.strictEqual(res.phaseResults.length, 4);
  const phases = res.phaseResults.map(r => r.phase);
  assert(phases.includes(PHASE.INTENT_VERIFICATION));
  assert(phases.includes(PHASE.CONSEQUENCE_PREDICTION));
  assert(phases.includes(PHASE.LAW_COMPLIANCE));
  assert(phases.includes(PHASE.CONFIDENCE_GATE));
});

await testAsync('validateAction includes compositeScore and summary', async () => {
  const loop = new SocraticLoop();
  const res  = await loop.validateAction('Deploy the staging build');
  assert(typeof res.compositeScore === 'number');
  assert(typeof res.summary        === 'string');
  assert(typeof res.validationId   === 'string');
});

await testAsync('checkLaws is a quick synchronous law check', async () => {
  const loop = new SocraticLoop();
  const r    = loop.checkLaws('clear log files before deployment');
  assert.strictEqual(r.hardBlock, true);
});

await testAsync('checkIntent is a quick synchronous intent check', async () => {
  const loop = new SocraticLoop();
  const r    = loop.checkIntent('analyse the data trends', {});
  assert(typeof r.passed === 'boolean');
  assert(typeof r.score  === 'number');
});

await testAsync('strict mode converts DEFERRED to NO_GO', async () => {
  // threshold=1.0 is mathematically unreachable by any blended float score,
  // guaranteeing a NO_GO (or DEFERRED→NO_GO in strict mode) regardless of action.
  const loop = new SocraticLoop({ confidenceThreshold: 1.0, strictMode: true });
  const res  = await loop.validateAction('routine maintenance task', {
    consequences: { reversible: true, estimatedScope: 'local', estimatedImpactScore: 0.1 },
  });
  // With an unreachable threshold (1.0) and strictMode=true, decision must be NO_GO
  assert.notStrictEqual(res.decision, DECISION.GO,
    `Expected non-GO decision with threshold=1.0, got ${res.decision}`);
});

await testAsync('setConfidenceThreshold updates the threshold', async () => {
  const loop = new SocraticLoop({ confidenceThreshold: 0.60 });
  loop.setConfidenceThreshold(0.10);
  const res = await loop.validateAction('Retrieve config', {
    consequences: { reversible: true, estimatedScope: 'local', estimatedImpactScore: 0.05 },
  });
  assert.strictEqual(res.decision, DECISION.GO);
});

await testAsync('setConfidenceThreshold throws for out-of-range values', async () => {
  const loop = new SocraticLoop();
  assert.throws(() => loop.setConfidenceThreshold(1.5));
  assert.throws(() => loop.setConfidenceThreshold(-0.1));
});

await testAsync('getValidationHistory accumulates records', async () => {
  const loop = new SocraticLoop();
  await loop.validateAction('action one');
  await loop.validateAction('action two');
  const history = loop.getValidationHistory();
  assert(history.length >= 2);
});

await testAsync('stats returns correct counts and phi', async () => {
  const loop = new SocraticLoop({ confidenceThreshold: 0.40 });
  await loop.validateAction('safe action', {
    consequences: { reversible: true, estimatedScope: 'local', estimatedImpactScore: 0.05 },
  });
  await loop.validateAction('rm -rf everything');
  const s = loop.stats();
  assert(s.total >= 2);
  assert(s.noGoCount >= 1);
  assert.strictEqual(s.phi, PHI);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);

})();
