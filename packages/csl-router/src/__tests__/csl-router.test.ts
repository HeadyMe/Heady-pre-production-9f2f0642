import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates, weightedAverageScore } from '../index';

test('weighted average produces accepted moderate or better scores', () => {
  const evaluation = weightedAverageScore([
    { name: 'latency', value: 0.8 },
    { name: 'capability', value: 0.9 },
    { name: 'cost', value: 0.7 },
  ]);
  assert.equal(evaluation.accepted, true);
  assert.ok(evaluation.score > 0.7);
});

test('rankCandidates orders entries by composite score', () => {
  const ranked = rankCandidates([
    { candidate: 'slow', factors: [{ name: 'capability', value: 0.9 }, { name: 'latency', value: 0.2 }] },
    { candidate: 'balanced', factors: [{ name: 'capability', value: 0.85 }, { name: 'latency', value: 0.8 }] },
  ]);
  assert.equal(ranked[0]?.candidate, 'balanced');
});
