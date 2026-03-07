/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  FIBONACCI,
  fibonacciShard,
  Vec3,
  AABB,
  OctreeNode,
  PCAProjector,
  SpatialIndex,
  GraphRAG,
  ImportanceScorer,
  ZoneManager,
  STMtoLTM,
  MemoryStore,
} = require('../src/memory/octree-spatial-index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

console.log('\n=== Octree Spatial Index Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });
test('FIBONACCI sequence is correct', () => {
  assert.strictEqual(FIBONACCI[0], 1);
  assert.strictEqual(FIBONACCI[1], 1);
  assert.strictEqual(FIBONACCI[2], 2);
  assert.strictEqual(FIBONACCI[7], 21);
});

// fibonacciShard
test('fibonacciShard returns value in [0, numShards)', () => {
  for (let i = 0; i < 20; i++) {
    const p     = new Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
    const shard = fibonacciShard(p, 8);
    assert.ok(shard >= 0 && shard < 8);
  }
});

// Vec3
test('Vec3 constructor and properties', () => {
  const v = new Vec3(1, 2, 3);
  assert.strictEqual(v.x, 1);
  assert.strictEqual(v.y, 2);
  assert.strictEqual(v.z, 3);
});

test('Vec3 fromArray', () => {
  const v = Vec3.fromArray([4, 5, 6]);
  assert.strictEqual(v.x, 4);
  assert.strictEqual(v.y, 5);
  assert.strictEqual(v.z, 6);
});

test('Vec3 toArray', () => {
  const v = new Vec3(1, 2, 3);
  assert.deepStrictEqual(v.toArray(), [1, 2, 3]);
});

test('Vec3 distanceTo', () => {
  const a = new Vec3(0, 0, 0);
  const b = new Vec3(3, 4, 0);
  assert.ok(Math.abs(a.distanceTo(b) - 5) < 0.001);
});

test('Vec3 add', () => {
  const a = new Vec3(1, 2, 3);
  const b = new Vec3(4, 5, 6);
  const c = a.add(b);
  assert.strictEqual(c.x, 5);
  assert.strictEqual(c.y, 7);
  assert.strictEqual(c.z, 9);
});

test('Vec3 scale', () => {
  const v = new Vec3(1, 2, 3);
  const s = v.scale(3);
  assert.strictEqual(s.x, 3);
  assert.strictEqual(s.y, 6);
  assert.strictEqual(s.z, 9);
});

test('Vec3 midpoint', () => {
  const a = new Vec3(0, 0, 0);
  const b = new Vec3(2, 4, 6);
  const m = a.midpoint(b);
  assert.strictEqual(m.x, 1);
  assert.strictEqual(m.y, 2);
  assert.strictEqual(m.z, 3);
});

test('Vec3 equals', () => {
  const a = new Vec3(1, 2, 3);
  const b = new Vec3(1, 2, 3);
  const c = new Vec3(1, 2, 4);
  assert.ok(a.equals(b));
  assert.ok(!a.equals(c));
});

// AABB
test('AABB contains point inside', () => {
  const box = new AABB(new Vec3(-5, -5, -5), new Vec3(5, 5, 5));
  assert.ok(box.contains(new Vec3(0, 0, 0)));
  assert.ok(box.contains(new Vec3(4, 4, 4)));
});

test('AABB does not contain point outside', () => {
  const box = new AABB(new Vec3(-5, -5, -5), new Vec3(5, 5, 5));
  assert.ok(!box.contains(new Vec3(10, 0, 0)));
});

test('AABB intersectsSphere', () => {
  const box    = new AABB(new Vec3(-5, -5, -5), new Vec3(5, 5, 5));
  const center = new Vec3(7, 0, 0);
  assert.ok(box.intersectsSphere(center, 3));    // sphere touches box
  assert.ok(!box.intersectsSphere(center, 1));  // too far
});

test('AABB split creates 8 children', () => {
  const box      = new AABB(new Vec3(-4, -4, -4), new Vec3(4, 4, 4));
  const children = box.split();
  assert.strictEqual(children.length, 8);
  // All children should be AABB
  assert.ok(children.every(c => c instanceof AABB));
});

test('AABB center is midpoint', () => {
  const box = new AABB(new Vec3(-2, -2, -2), new Vec3(2, 2, 2));
  const c   = box.center;
  assert.ok(c.equals(new Vec3(0, 0, 0)));
});

// OctreeNode
test('OctreeNode inserts point', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds);
  const pt     = { id: 'p1', pos: new Vec3(1, 2, 3), data: {} };
  const ok     = node.insert(pt);
  assert.ok(ok);
  assert.strictEqual(node.pointCount, 1);
});

test('OctreeNode rejects point outside bounds', () => {
  const bounds = new AABB(new Vec3(-5, -5, -5), new Vec3(5, 5, 5));
  const node   = new OctreeNode(bounds);
  const pt     = { id: 'p1', pos: new Vec3(10, 10, 10), data: {} };
  const ok     = node.insert(pt);
  assert.ok(!ok);
});

test('OctreeNode subdivides when capacity exceeded', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds, 0, 12, 2); // capacity=2
  for (let i = 0; i < 5; i++) {
    node.insert({ id: `p${i}`, pos: new Vec3(i - 2, i - 2, i - 2), data: {} });
  }
  assert.ok(!node.isLeaf); // should have subdivided
});

test('OctreeNode queryRadius finds nearby points', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds);
  node.insert({ id: 'near', pos: new Vec3(1, 0, 0), data: {} });
  node.insert({ id: 'far',  pos: new Vec3(9, 9, 9), data: {} });
  const results = node.queryRadius(new Vec3(0, 0, 0), 2);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, 'near');
});

test('OctreeNode kNearest finds closest points', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds);
  for (let i = 1; i <= 5; i++) {
    node.insert({ id: `p${i}`, pos: new Vec3(i, 0, 0), data: {} });
  }
  const nearest = node.kNearest(new Vec3(0, 0, 0), 2);
  assert.strictEqual(nearest.length, 2);
  // p1 and p2 should be closest
  const ids = nearest.map(n => n.id);
  assert.ok(ids.includes('p1'));
});

test('OctreeNode remove deletes point', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds);
  node.insert({ id: 'del', pos: new Vec3(1, 1, 1), data: {} });
  node.remove('del');
  const all = node.all();
  assert.ok(!all.some(p => p.id === 'del'));
});

test('OctreeNode all() returns all points', () => {
  const bounds = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
  const node   = new OctreeNode(bounds);
  for (let i = 0; i < 5; i++) {
    node.insert({ id: `p${i}`, pos: new Vec3(i - 2, i - 2, i - 2), data: {} });
  }
  assert.strictEqual(node.all().length, 5);
});

// PCAProjector
test('PCAProjector projects high-D to 3D', () => {
  const proj   = new PCAProjector(384);
  const vector = Array.from({ length: 384 }, () => Math.random());
  const result = proj.project(vector);
  assert.ok(result instanceof Vec3);
  assert.ok(isFinite(result.x));
  assert.ok(isFinite(result.y));
  assert.ok(isFinite(result.z));
});

test('PCAProjector is deterministic for same input', () => {
  const proj = new PCAProjector(10, 42);
  const v    = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r1   = proj.project(v);
  const r2   = proj.project(v);
  assert.ok(r1.equals(r2));
});

// SpatialIndex
test('SpatialIndex insert and get', () => {
  const idx = new SpatialIndex();
  const pt  = idx.insert('v1', [1, 2, 3], { label: 'test' });
  assert.ok(pt);
  const retrieved = idx.get('v1');
  assert.ok(retrieved);
  assert.strictEqual(retrieved.id, 'v1');
});

test('SpatialIndex has() and size()', () => {
  const idx = new SpatialIndex();
  idx.insert('a', [1, 0, 0], {});
  idx.insert('b', [0, 1, 0], {});
  assert.ok(idx.has('a'));
  assert.ok(!idx.has('z'));
  assert.strictEqual(idx.size(), 2);
});

test('SpatialIndex remove', () => {
  const idx = new SpatialIndex();
  idx.insert('del', [1, 1, 1], {});
  idx.remove('del');
  assert.ok(!idx.has('del'));
  assert.strictEqual(idx.size(), 0);
});

test('SpatialIndex queryRadius', () => {
  const idx = new SpatialIndex();
  idx.insert('near', [0.5, 0, 0], {});
  idx.insert('far',  [8, 8, 8], {});
  const results = idx.queryRadius([0, 0, 0], 1);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, 'near');
});

test('SpatialIndex kNearest', () => {
  const idx = new SpatialIndex();
  for (let i = 1; i <= 6; i++) idx.insert(`v${i}`, [i, 0, 0], {});
  const nearest = idx.kNearest([0, 0, 0], 3);
  assert.strictEqual(nearest.length, 3);
  const ids = nearest.map(n => n.id);
  assert.ok(ids.includes('v1'));
  assert.ok(ids.includes('v2'));
});

test('SpatialIndex handles high-D vector via PCA', () => {
  const idx = new SpatialIndex();
  const vec = Array.from({ length: 64 }, (_, i) => Math.sin(i / 10));
  const pt  = idx.insert('hd1', vec, { text: 'embedding test' });
  assert.ok(pt);
  assert.ok(idx.getProjector() instanceof PCAProjector);
});

// GraphRAG
test('GraphRAG addNode and neighbors', () => {
  const g = new GraphRAG();
  g.addNode('a', { text: 'node a' });
  g.addNode('b', { text: 'node b' });
  g.addEdge('a', 'b', 'related', 1.0);
  const neighbors = g.neighbors('a');
  assert.strictEqual(neighbors.length, 1);
  assert.strictEqual(neighbors[0].to, 'b');
});

test('GraphRAG traverse BFS', () => {
  const g = new GraphRAG();
  g.addNode('root', {});
  g.addNode('child1', {});
  g.addNode('child2', {});
  g.addNode('grandchild', {});
  g.addEdge('root', 'child1', 'rel');
  g.addEdge('root', 'child2', 'rel');
  g.addEdge('child1', 'grandchild', 'rel');

  const nodes = g.traverse('root', 2);
  assert.strictEqual(nodes.length, 4);
});

test('GraphRAG traverse limited depth', () => {
  const g = new GraphRAG();
  g.addNode('a', {}); g.addNode('b', {}); g.addNode('c', {});
  g.addEdge('a', 'b', 'rel');
  g.addEdge('b', 'c', 'rel');
  const nodes = g.traverse('a', 1);
  assert.strictEqual(nodes.length, 2); // a and b, not c
});

test('GraphRAG addEdge throws for missing nodes', () => {
  const g = new GraphRAG();
  let threw = false;
  try { g.addEdge('x', 'y', 'rel'); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('GraphRAG removeNode cleans up', () => {
  const g = new GraphRAG();
  g.addNode('a', {}); g.addNode('b', {});
  g.addEdge('a', 'b');
  g.removeNode('a');
  assert.strictEqual(g.nodeCount(), 1);
});

test('GraphRAG retrieveContext returns neighborhood', () => {
  const g = new GraphRAG();
  g.addNode('q', {}); g.addNode('n1', {}); g.addNode('n2', {});
  g.addEdge('q', 'n1', 'rel');
  g.addEdge('q', 'n2', 'rel');
  const ctx = g.retrieveContext(['q'], 1);
  assert.ok(ctx.length >= 3);
});

test('GraphRAG edgeCount', () => {
  const g = new GraphRAG();
  g.addNode('a', {}); g.addNode('b', {}); g.addNode('c', {});
  g.addEdge('a', 'b');
  g.addEdge('b', 'c');
  assert.strictEqual(g.edgeCount(), 2);
});

// ImportanceScorer
test('ImportanceScorer high frequency = higher score', () => {
  const scorer = new ImportanceScorer();
  const m1 = { frequency: 1, lastAccessed: Date.now(), relevanceScore: 0.5 };
  const m2 = { frequency: 100, lastAccessed: Date.now(), relevanceScore: 0.5 };
  assert.ok(scorer.score(m2) > scorer.score(m1));
});

test('ImportanceScorer old memory scores lower', () => {
  const scorer = new ImportanceScorer({ decayRate: 1 / 1000 });
  const fresh = { frequency: 5, lastAccessed: Date.now(), relevanceScore: 0.5 };
  const old   = { frequency: 5, lastAccessed: Date.now() - 100000, relevanceScore: 0.5 };
  assert.ok(scorer.score(fresh) > scorer.score(old));
});

test('ImportanceScorer rank sorts by importance', () => {
  const scorer   = new ImportanceScorer();
  const memories = [
    { id: 'low',  frequency: 1,   lastAccessed: Date.now() - 50000, relevanceScore: 0.3 },
    { id: 'high', frequency: 100, lastAccessed: Date.now(),          relevanceScore: 0.9 },
    { id: 'mid',  frequency: 10,  lastAccessed: Date.now() - 5000,  relevanceScore: 0.6 },
  ];
  const ranked = scorer.rank(memories);
  assert.strictEqual(ranked[0].id, 'high');
});

// ZoneManager
test('ZoneManager has 8 zones', () => {
  const zm = new ZoneManager();
  assert.strictEqual(zm.getAllZones().length, 8);
});

test('ZoneManager getZone returns nearest zone', () => {
  const zm   = new ZoneManager(10);
  const zone = zm.getZone(new Vec3(-3, -3, -3));
  assert.ok(zone.name);
  assert.ok(zone.id >= 0 && zone.id < 8);
});

test('ZoneManager getZoneById', () => {
  const zm   = new ZoneManager();
  const zone = zm.getZoneById(0);
  assert.ok(zone);
  assert.strictEqual(zone.id, 0);
});

// STMtoLTM
test('STMtoLTM addToSTM and getMemory', () => {
  const stmLtm = new STMtoLTM();
  stmLtm.addToSTM('m1', { text: 'hello', relevanceScore: 0.8 });
  const m = stmLtm.getMemory('m1');
  assert.ok(m);
  assert.strictEqual(m.text, 'hello');
});

test('STMtoLTM touch increments frequency', () => {
  const stmLtm = new STMtoLTM();
  stmLtm.addToSTM('m2', { relevanceScore: 0.5 });
  stmLtm.touch('m2');
  stmLtm.touch('m2');
  const m = stmLtm.getMemory('m2');
  assert.ok(m.frequency >= 2);
});

test('STMtoLTM consolidate promotes high-importance memories', () => {
  const stmLtm = new STMtoLTM({ threshold: 0.1 });
  // High importance: high frequency, recent, high relevance
  stmLtm.addToSTM('important', { relevanceScore: 0.9 });
  for (let i = 0; i < 20; i++) stmLtm.touch('important');
  const result = stmLtm.consolidate();
  assert.ok(result.promoted >= 1 || result.ltm >= 1 || stmLtm.getLTM().has('important'));
});

test('STMtoLTM getStats', () => {
  const stmLtm = new STMtoLTM();
  stmLtm.addToSTM('x', { relevanceScore: 0.5 });
  const stats = stmLtm.getStats();
  assert.ok(typeof stats.stm === 'number');
  assert.ok(typeof stats.ltm === 'number');
});

// MemoryStore
test('MemoryStore store and retrieve', () => {
  const ms    = new MemoryStore();
  const entry = ms.store('mem1', [1, 0, 0], { text: 'test memory' });
  assert.ok(entry.zone);
  assert.ok(entry.pos);
  const { neighbors } = ms.retrieve([1, 0, 0], 5, 2);
  assert.ok(neighbors.length >= 1);
});

test('MemoryStore link creates graph edge', () => {
  const ms = new MemoryStore();
  ms.store('a', [1, 0, 0], {});
  ms.store('b', [0, 1, 0], {});
  ms.link('a', 'b', 'related', 0.8);
  const neighbors = ms.getGraphRAG().neighbors('a');
  assert.strictEqual(neighbors.length, 1);
});

test('MemoryStore remove deletes from all structures', () => {
  const ms = new MemoryStore();
  ms.store('del', [0, 0, 0], {});
  ms.remove('del');
  assert.ok(!ms.getSpatialIndex().has('del'));
});

test('MemoryStore getStats', () => {
  const ms = new MemoryStore();
  ms.store('s1', [1, 1, 1], {});
  const stats = ms.getStats();
  assert.ok(typeof stats.spatial === 'number');
  assert.ok(typeof stats.graphNodes === 'number');
});

test('MemoryStore high-D vectors via PCA', () => {
  const ms  = new MemoryStore({ inputDim: 32 });
  const vec = Array.from({ length: 32 }, () => Math.random());
  const entry = ms.store('hd', vec, { text: 'high-d test' });
  assert.ok(entry.pos.length === 3);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
