import test from 'node:test';
import assert from 'node:assert/strict';
import { PHI, fib, labelForCslScore, cosineSimilarity, hashToVector3 } from '../index';

test('fib produces Fibonacci scaling values', () => {
  assert.equal(fib(1), 1);
  assert.equal(fib(7), 13);
  assert.equal(fib(11), 89);
});

test('CSL labels map to expected bands', () => {
  assert.equal(labelForCslScore(0.2), 'DORMANT');
  assert.equal(labelForCslScore(0.35), 'LOW');
  assert.equal(labelForCslScore(0.5), 'MODERATE');
  assert.equal(labelForCslScore(0.75), 'HIGH');
  assert.equal(labelForCslScore(0.95), 'CRITICAL');
});

test('cosine similarity aligns identical vectors', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test('hashToVector3 is deterministic', () => {
  assert.deepEqual(hashToVector3('seed'), hashToVector3('seed'));
  assert.ok(PHI > 1);
});
