import assert from 'node:assert/strict';
import { deterministicEmbedding, cosineSimilarity } from '@heady/shared/src/embedding.mjs';

const a = deterministicEmbedding('heady memory test');
const b = deterministicEmbedding('heady memory test');
const c = deterministicEmbedding('completely different sentence');

assert.equal(a.length, 384);
assert.equal(b.length, 384);
assert.ok(cosineSimilarity(a, b) > cosineSimilarity(a, c));
console.log('smoke check passed');
