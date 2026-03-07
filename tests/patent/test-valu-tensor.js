/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  Tensor,
  VectorArithmetic,
  MatrixOps,
  VALUCore,
  TensorRegistry,
  MathService,
  BatchProcessor,
} = require('../src/compute/valu-tensor-core');

let passed = 0;
let failed = 0;

const _queue = [];

function test(name, fn) {
  _queue.push(async () => {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
  });
}

function asyncTest(name, fn) { test(name, fn); }

const EPS = 1e-4;
function approx(a, b) { return Math.abs(a - b) < EPS; }

console.log('\n=== VALU Tensor Core Tests ===\n');

test('PHI is correct', () => { assert.strictEqual(PHI, 1.6180339887); });

// Tensor creation
test('Tensor zeros creates zero-filled tensor', () => {
  const t = Tensor.zeros([3, 4]);
  assert.deepStrictEqual(t.shape, [3, 4]);
  assert.strictEqual(t.size, 12);
  assert.ok(t.data.every(v => v === 0));
});

test('Tensor ones creates one-filled tensor', () => {
  const t = Tensor.ones([2, 3]);
  assert.ok(t.data.every(v => v === 1));
});

test('Tensor eye creates identity matrix', () => {
  const t = Tensor.eye(3);
  assert.strictEqual(t.get(0, 0), 1);
  assert.strictEqual(t.get(1, 1), 1);
  assert.strictEqual(t.get(2, 2), 1);
  assert.strictEqual(t.get(0, 1), 0);
  assert.strictEqual(t.get(1, 0), 0);
});

test('Tensor.from nested array', () => {
  const t = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  assert.deepStrictEqual(t.shape, [2, 3]);
  assert.strictEqual(t.get(0, 0), 1);
  assert.strictEqual(t.get(1, 2), 6);
});

test('Tensor.arange', () => {
  const t = Tensor.arange(0, 5, 1);
  assert.deepStrictEqual(t.shape, [5]);
  assert.strictEqual(t.data[0], 0);
  assert.strictEqual(t.data[4], 4);
});

test('Tensor.rand creates values in [0,1)', () => {
  const t = Tensor.rand([10, 10]);
  assert.ok(t.data.every(v => v >= 0 && v < 1));
});

test('Tensor.randn creates finite values', () => {
  const t = Tensor.randn([5, 5]);
  assert.ok(t.data.every(v => isFinite(v)));
});

test('Tensor get/set', () => {
  const t = Tensor.zeros([3, 3]);
  t.set(7, 1, 2);
  assert.strictEqual(t.get(1, 2), 7);
});

test('Tensor reshape', () => {
  const t = Tensor.arange(0, 6, 1).reshape([2, 3]);
  assert.deepStrictEqual(t.shape, [2, 3]);
  assert.strictEqual(t.get(1, 2), 5);
});

test('Tensor reshape throws on size mismatch', () => {
  let threw = false;
  try { Tensor.arange(0, 6, 1).reshape([3, 3]); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('Tensor clone is independent', () => {
  const a = Tensor.ones([3]);
  const b = a.clone();
  b.data[0] = 99;
  assert.strictEqual(a.data[0], 1); // original unchanged
});

test('Tensor toArray returns correct values', () => {
  const t = Tensor.from([1, 2, 3]);
  assert.deepStrictEqual(Array.from(t.toArray()), [1, 2, 3]);
});

test('Tensor toString', () => {
  const t = Tensor.zeros([2, 3]);
  assert.ok(t.toString().includes('Tensor'));
});

// VectorArithmetic
test('VectorArithmetic add', () => {
  const a = Tensor.from([1, 2, 3]);
  const b = Tensor.from([4, 5, 6]);
  const c = VectorArithmetic.add(a, b);
  assert.deepStrictEqual(Array.from(c.data), [5, 7, 9]);
});

test('VectorArithmetic subtract', () => {
  const a = Tensor.from([5, 7, 9]);
  const b = Tensor.from([1, 2, 3]);
  const c = VectorArithmetic.subtract(a, b);
  assert.deepStrictEqual(Array.from(c.data), [4, 5, 6]);
});

test('VectorArithmetic hadamard', () => {
  const a = Tensor.from([2, 3, 4]);
  const b = Tensor.from([5, 6, 7]);
  const c = VectorArithmetic.hadamard(a, b);
  assert.deepStrictEqual(Array.from(c.data), [10, 18, 28]);
});

test('VectorArithmetic outer product', () => {
  const a = Tensor.from([1, 2]);
  const b = Tensor.from([3, 4, 5]);
  const c = VectorArithmetic.outer(a, b);
  assert.deepStrictEqual(c.shape, [2, 3]);
  assert.strictEqual(c.get(0, 0), 3);
  assert.strictEqual(c.get(1, 2), 10);
});

test('VectorArithmetic cross product', () => {
  const a = Tensor.from([1, 0, 0]);
  const b = Tensor.from([0, 1, 0]);
  const c = VectorArithmetic.cross(a, b);
  assert.deepStrictEqual(Array.from(c.data).map(v => Math.round(v)), [0, 0, 1]);
});

test('VectorArithmetic dot product 1D', () => {
  const a = Tensor.from([1, 2, 3]);
  const b = Tensor.from([4, 5, 6]);
  const d = VectorArithmetic.dot(a, b);
  assert.strictEqual(d, 32); // 4+10+18
});

test('VectorArithmetic norm', () => {
  const a = Tensor.from([3, 4]);
  assert.ok(approx(VectorArithmetic.norm(a), 5));
});

test('VectorArithmetic normalize', () => {
  const a    = Tensor.from([3, 4]);
  const norm = VectorArithmetic.normalize(a);
  assert.ok(approx(VectorArithmetic.norm(norm), 1));
});

test('VectorArithmetic normalize throws on zero vector', () => {
  let threw = false;
  try { VectorArithmetic.normalize(Tensor.zeros([3])); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('VectorArithmetic cosineSimilarity', () => {
  const a = Tensor.from([1, 0, 0]);
  const b = Tensor.from([1, 0, 0]);
  assert.ok(approx(VectorArithmetic.cosineSimilarity(a, b), 1));
});

test('VectorArithmetic scalar broadcast add', () => {
  const a = Tensor.from([1]);
  const b = Tensor.from([1, 2, 3]);
  const c = VectorArithmetic.add(a, b);
  assert.deepStrictEqual(Array.from(c.data), [2, 3, 4]);
});

// MatrixOps
test('MatrixOps multiply', () => {
  const a = Tensor.from([[1, 2], [3, 4]]);
  const b = Tensor.from([[5, 6], [7, 8]]);
  const c = MatrixOps.multiply(a, b);
  assert.strictEqual(c.get(0, 0), 19);
  assert.strictEqual(c.get(0, 1), 22);
  assert.strictEqual(c.get(1, 0), 43);
  assert.strictEqual(c.get(1, 1), 50);
});

test('MatrixOps transpose', () => {
  const a = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  const b = MatrixOps.transpose(a);
  assert.deepStrictEqual(b.shape, [3, 2]);
  assert.strictEqual(b.get(0, 0), 1);
  assert.strictEqual(b.get(2, 0), 3);
  assert.strictEqual(b.get(1, 1), 5);
});

test('MatrixOps determinant 2x2', () => {
  const a = Tensor.from([[3, 8], [4, 6]]);
  const d = MatrixOps.determinant(a);
  assert.ok(approx(d, -14));
});

test('MatrixOps determinant 3x3', () => {
  const a = Tensor.from([[1, 2, 3], [4, 5, 6], [7, 8, 10]]);
  const d = MatrixOps.determinant(a);
  assert.ok(approx(d, -3));
});

test('MatrixOps inverse', () => {
  const a   = Tensor.from([[2, 1], [5, 3]]);
  const inv = MatrixOps.inverse(a);
  const I   = MatrixOps.multiply(a, inv);
  assert.ok(approx(I.get(0, 0), 1));
  assert.ok(approx(I.get(0, 1), 0));
  assert.ok(approx(I.get(1, 0), 0));
  assert.ok(approx(I.get(1, 1), 1));
});

test('MatrixOps inverse throws on singular matrix', () => {
  const a = Tensor.from([[1, 2], [2, 4]]); // determinant = 0
  let threw = false;
  try { MatrixOps.inverse(a); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('MatrixOps eigenDecompositionStub returns values', () => {
  const a = Tensor.from([[4, 1], [2, 3]]);
  const { values, vectors } = MatrixOps.eigenDecompositionStub(a);
  assert.ok(values.length > 0);
  assert.ok(vectors.length > 0);
  assert.ok(values[0] > 0); // dominant eigenvalue should be positive
});

// VALUCore
test('VALUCore sum total', () => {
  const t = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  assert.strictEqual(VALUCore.sum(t), 21);
});

test('VALUCore sum axis=0', () => {
  const t = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  const s = VALUCore.sum(t, 0);
  assert.deepStrictEqual(Array.from(s.data), [5, 7, 9]);
});

test('VALUCore sum axis=1', () => {
  const t = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  const s = VALUCore.sum(t, 1);
  assert.deepStrictEqual(Array.from(s.data), [6, 15]);
});

test('VALUCore mean', () => {
  const t = Tensor.from([[2, 4], [6, 8]]);
  assert.strictEqual(VALUCore.mean(t), 5);
});

test('VALUCore max', () => {
  const t = Tensor.from([1, 5, 3, 2, 4]);
  assert.strictEqual(VALUCore.max(t), 5);
});

test('VALUCore min', () => {
  const t = Tensor.from([3, 1, 4, 1, 5, 9]);
  assert.strictEqual(VALUCore.min(t), 1);
});

test('VALUCore softmax sums to 1 per row', () => {
  const t   = Tensor.from([[1, 2, 3], [4, 5, 6]]);
  const sm  = VALUCore.softmax(t);
  const row0 = sm.data[0] + sm.data[1] + sm.data[2];
  const row1 = sm.data[3] + sm.data[4] + sm.data[5];
  assert.ok(approx(row0, 1));
  assert.ok(approx(row1, 1));
});

test('VALUCore relu clamps negatives to 0', () => {
  const t = Tensor.from([-1, -2, 3, 4, -5]);
  const r = VALUCore.relu(t);
  assert.deepStrictEqual(Array.from(r.data), [0, 0, 3, 4, 0]);
});

test('VALUCore map applies function to all elements', () => {
  const t = Tensor.from([1, 2, 3]);
  const r = VALUCore.map(t, x => x * 2);
  assert.deepStrictEqual(Array.from(r.data), [2, 4, 6]);
});

// TensorRegistry
test('TensorRegistry register and get', () => {
  const registry = new TensorRegistry();
  const t = Tensor.from([1, 2, 3]);
  registry.register('myTensor', t);
  const retrieved = registry.get('myTensor');
  assert.ok(retrieved instanceof Tensor);
  assert.deepStrictEqual(Array.from(retrieved.data), [1, 2, 3]);
});

test('TensorRegistry get throws for missing tensor', () => {
  const registry = new TensorRegistry();
  let threw = false;
  try { registry.get('nonexistent'); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('TensorRegistry delete removes tensor', () => {
  const registry = new TensorRegistry();
  registry.register('t', Tensor.from([1]));
  registry.delete('t');
  assert.ok(!registry.has('t'));
});

test('TensorRegistry list returns all registered', () => {
  const registry = new TensorRegistry();
  registry.register('a', Tensor.from([1]));
  registry.register('b', Tensor.from([2, 3]));
  const list = registry.list();
  assert.strictEqual(list.length, 2);
});

// MathService
test('MathService execute zeros', () => {
  const svc    = new MathService();
  const result = svc.execute('zeros', { shape: [3, 3] });
  assert.ok(result instanceof Tensor);
  assert.deepStrictEqual(result.shape, [3, 3]);
});

test('MathService execute add', () => {
  const svc = new MathService();
  const a   = Tensor.from([1, 2, 3]);
  const b   = Tensor.from([4, 5, 6]);
  const c   = svc.execute('add', { a, b });
  assert.deepStrictEqual(Array.from(c.data), [5, 7, 9]);
});

test('MathService execute matmul', () => {
  const svc = new MathService();
  const a   = Tensor.from([[1, 2], [3, 4]]);
  const b   = Tensor.from([[5, 6], [7, 8]]);
  const c   = svc.execute('matmul', { a, b });
  assert.strictEqual(c.get(0, 0), 19);
});

test('MathService handleRequest returns ok result', () => {
  const svc    = new MathService();
  const result = svc.handleRequest({ op: 'zeros', args: { shape: [2, 2] } });
  assert.ok(result.ok);
  assert.ok(result.result.shape);
});

test('MathService handleRequest returns error for unknown op', () => {
  const svc    = new MathService();
  const result = svc.handleRequest({ op: 'unknown_op', args: {} });
  assert.ok(!result.ok);
  assert.ok(result.error);
});

test('MathService handleRequest stores tensor in registry', () => {
  const svc    = new MathService();
  svc.handleRequest({ op: 'zeros', args: { shape: [3, 3] }, store: 'myZeros' });
  const registry = svc.getRegistry();
  assert.ok(registry.has('myZeros'));
});

test('MathService getCallLog records calls', () => {
  const svc = new MathService();
  svc.execute('zeros', { shape: [1, 1] });
  svc.execute('ones', { shape: [2, 2] });
  const log = svc.getCallLog();
  assert.ok(log.length >= 2);
  assert.ok(log.some(l => l.op === 'zeros'));
  assert.ok(log.some(l => l.op === 'ones'));
});

// BatchProcessor
asyncTest('BatchProcessor processBatch handles multiple ops', async () => {
  const bp = new BatchProcessor({ concurrency: 4 });
  const ops = [
    { op: 'zeros', args: { shape: [2, 2] } },
    { op: 'ones',  args: { shape: [3, 3] } },
    { op: 'eye',   args: { n: 4 } },
  ];
  const results = await bp.processBatch(ops);
  assert.strictEqual(results.length, 3);
  assert.ok(results.every(r => r.ok));
});

asyncTest('BatchProcessor handles errors gracefully in batch', async () => {
  const bp = new BatchProcessor();
  const ops = [
    { op: 'zeros', args: { shape: [2, 2] } },
    { op: 'bad_op', args: {} },
    { op: 'ones', args: { shape: [1, 1] } },
  ];
  const results = await bp.processBatch(ops);
  assert.ok(results[0].ok);
  assert.ok(!results[1].ok);
  assert.ok(results[2].ok);
});

(async () => {
  for (const t of _queue) await t();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
