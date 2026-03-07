import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicEmbedding, cosineSimilarity, coordinatesFromEmbedding } from '../packages/shared/src/embedding.mjs';

test('embedding is deterministic and 384-dimensional', () => {
  const first = deterministicEmbedding('heady');
  const second = deterministicEmbedding('heady');
  assert.equal(first.length, 384);
  assert.deepEqual(first, second);
});

test('coordinates are derived for 3d positioning', () => {
  const vector = deterministicEmbedding('3d memory');
  const point = coordinatesFromEmbedding(vector);
  assert.equal(typeof point.x, 'number');
  assert.equal(typeof point.y, 'number');
  assert.equal(typeof point.z, 'number');
});

test('cosine similarity ranks identical text higher', () => {
  const a = deterministicEmbedding('same text');
  const b = deterministicEmbedding('same text');
  const c = deterministicEmbedding('different text');
  assert.ok(cosineSimilarity(a, b) > cosineSimilarity(a, c));
});
