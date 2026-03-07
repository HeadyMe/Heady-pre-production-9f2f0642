/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests: Shadow Memory Persistence (HS-052)
 * Covers all 6 patent claims.
 */

'use strict';

const assert = require('assert');
const {
  VectorDatabase,
  ExhaleModule,
  InhaleModule,
  ProjectionManager,
  FibonacciShardManager,
  ShadowMemorySystem,
  _generateEmbedding,
  _cosineSimilarity,
  _embeddingDelta,
  _sha256,
  PHI,
  STORAGE_TIERS,
  SYNC_STATUS,
  PROJECTION_TYPES,
  FIBONACCI_TIER_CAPACITIES_GB,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_K_NEAREST,
} = require('../src/memory/shadow-memory-persistence');

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

// ─── Constants & Helpers ──────────────────────────────────────────────────────

console.log('\n── Constants & Helpers ──────────────────────────────────────────');

test('PHI equals 1.6180339887', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

test('FIBONACCI_TIER_CAPACITIES_GB has 5 entries [1,1,2,3,5]', () => {
  assert.deepStrictEqual(FIBONACCI_TIER_CAPACITIES_GB, [1, 1, 2, 3, 5]);
});

test('_sha256 returns a 64-char hex string', () => {
  const hash = _sha256('test-value');
  assert.strictEqual(typeof hash, 'string');
  assert.strictEqual(hash.length, 64);
});

test('_sha256 is deterministic for same input', () => {
  const h1 = _sha256({ a: 1, b: 2 });
  const h2 = _sha256({ a: 1, b: 2 });
  assert.strictEqual(h1, h2);
});

test('_generateEmbedding returns Float32Array of correct length', () => {
  const emb = _generateEmbedding('hello world');
  assert(emb instanceof Float32Array);
  assert.strictEqual(emb.length, DEFAULT_EMBEDDING_DIM);
});

test('_generateEmbedding returns unit vector (L2 norm ≈ 1)', () => {
  const emb  = _generateEmbedding('normalisation test');
  let norm   = 0;
  for (const v of emb) norm += v * v;
  const mag = Math.sqrt(norm);
  assert(Math.abs(mag - 1.0) < 0.001, `Expected norm ≈ 1, got ${mag}`);
});

test('_cosineSimilarity returns 1.0 for identical vectors', () => {
  const emb  = _generateEmbedding('same input');
  const sim  = _cosineSimilarity(emb, emb);
  assert(Math.abs(sim - 1.0) < 0.001, `Expected ~1.0, got ${sim}`);
});

test('_cosineSimilarity returns value in [-1, 1]', () => {
  const a = _generateEmbedding('cats');
  const b = _generateEmbedding('quantum physics');
  const s = _cosineSimilarity(a, b);
  assert(s >= -1 && s <= 1, `Out of range: ${s}`);
});

test('_embeddingDelta is 0 for identical embeddings', () => {
  const emb = _generateEmbedding('delta test');
  assert.strictEqual(_embeddingDelta(emb, emb), 0);
});

// ─── Claim 1: VectorDatabase ──────────────────────────────────────────────────

console.log('\n── Claim 1: VectorDatabase (canonical state as embeddings) ──────');

test('VectorDatabase.upsert stores an entry', () => {
  const db  = new VectorDatabase();
  const emb = _generateEmbedding('state-A');
  const id  = db.upsert('state-A', emb, { value: 42 });
  assert.strictEqual(id, 'state-A');
  assert.strictEqual(db.size(), 1);
});

test('VectorDatabase.get retrieves by id and updates access count', () => {
  const db  = new VectorDatabase();
  const emb = _generateEmbedding('state-B');
  db.upsert('state-B', emb, { data: 'hello' });
  const entry = db.get('state-B');
  assert(entry, 'Expected entry');
  assert.strictEqual(entry.id, 'state-B');
  assert.strictEqual(entry.accessCount, 1);
});

test('VectorDatabase.get returns null for unknown id', () => {
  const db = new VectorDatabase();
  assert.strictEqual(db.get('unknown'), null);
});

test('VectorDatabase.knn returns K results ordered by similarity', () => {
  const db = new VectorDatabase();
  const query = _generateEmbedding('machine learning');
  for (let i = 0; i < 10; i++) {
    const emb = _generateEmbedding(`document ${i}`);
    db.upsert(`doc-${i}`, emb, { i });
  }
  const results = db.knn(query, 3);
  assert.strictEqual(results.length, 3);
  // Verify descending similarity order
  for (let i = 1; i < results.length; i++) {
    assert(results[i - 1].similarity >= results[i].similarity);
  }
});

test('VectorDatabase.delete removes an entry', () => {
  const db  = new VectorDatabase();
  const emb = _generateEmbedding('to-delete');
  db.upsert('to-delete', emb, {});
  assert.strictEqual(db.size(), 1);
  db.delete('to-delete');
  assert.strictEqual(db.size(), 0);
});

test('VectorDatabase.stats reports correct tier counts', () => {
  const db  = new VectorDatabase();
  const emb = _generateEmbedding('stats-test');
  db.upsert('s1', emb, {}, STORAGE_TIERS.HOT);
  db.upsert('s2', emb, {}, STORAGE_TIERS.WARM);
  db.upsert('s3', emb, {}, STORAGE_TIERS.HOT);
  const stats = db.stats();
  assert.strictEqual(stats.byTier[STORAGE_TIERS.HOT], 2);
  assert.strictEqual(stats.byTier[STORAGE_TIERS.WARM], 1);
});

// ─── Claim 1 + 2: ExhaleModule ────────────────────────────────────────────────

console.log('\n── Claims 1+2: ExhaleModule (state projection) ──────────────────');

test('ExhaleModule.exhale persists to vectorDB', () => {
  const db   = new VectorDatabase();
  const pm   = new ProjectionManager(db);
  const mod  = new ExhaleModule(db, pm);
  const res  = mod.exhale('node-1:state', { counter: 0 }, { force: true });
  assert.strictEqual(res.id, 'node-1:state');
  assert(res.projected, 'Expected projected=true');
  assert.strictEqual(db.size(), 1);
});

test('ExhaleModule.exhale returns hash', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const mod = new ExhaleModule(db, pm);
  const res = mod.exhale('hashed-state', { x: 1 }, { force: true });
  assert(typeof res.hash === 'string' && res.hash.length === 64);
});

test('ExhaleModule.exhale skips projection below delta threshold', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const mod = new ExhaleModule(db, pm, { deltaThreshold: 1.0 }); // very high threshold
  mod.exhale('stable-state', { a: 1 }, { force: true });  // first exhale always passes (Infinity delta)
  const res = mod.exhale('stable-state', { a: 1 });        // nearly identical → skip
  assert.strictEqual(res.projected, false);
});

test('ExhaleModule.drainOnDestruction preserves all pending state', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const mod = new ExhaleModule(db, pm);
  const pending = [
    { stateId: 'k1', stateObject: { v: 1 } },
    { stateId: 'k2', stateObject: { v: 2 } },
    { stateId: 'k3', stateObject: { v: 3 } },
  ];
  const drain = mod.drainOnDestruction('node-dying', pending);
  assert.strictEqual(drain.preserved, 3);
  assert.strictEqual(db.size(), 3);
});

// ─── Claim 5: InhaleModule ────────────────────────────────────────────────────

console.log('\n── Claim 5: InhaleModule (cosine similarity reconstitution) ─────');

test('InhaleModule.inhale returns K context entries', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const ex  = new ExhaleModule(db, pm);
  // Populate DB
  for (let i = 0; i < 20; i++) {
    ex.exhale(`item-${i}`, { topic: `item ${i}`, value: i }, { force: true });
  }
  const mod = new InhaleModule(db);
  const res = mod.inhale('new-node', 'process data items', { k: 5 });
  assert.strictEqual(res.context.length, 5);
  assert.strictEqual(res.nodeId, 'new-node');
});

test('InhaleModule context entries have similarity scores', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const ex  = new ExhaleModule(db, pm);
  ex.exhale('test-state', { msg: 'hello' }, { force: true });
  const mod = new InhaleModule(db);
  const res = mod.inhale('node-x', 'hello world', { k: 1 });
  assert(typeof res.context[0].similarity === 'number');
  assert(res.context[0].similarity >= -1 && res.context[0].similarity <= 1);
});

test('InhaleModule.inhaleByEmbedding works with direct embedding', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const ex  = new ExhaleModule(db, pm);
  ex.exhale('direct-state', { x: 100 }, { force: true });
  const mod = new InhaleModule(db);
  const emb = _generateEmbedding('direct query');
  const res = mod.inhaleByEmbedding('node-direct', emb, 1);
  assert(Array.isArray(res.context));
  assert.strictEqual(res.context.length, 1);
});

// ─── Claim 3: ProjectionManager ───────────────────────────────────────────────

console.log('\n── Claim 3: ProjectionManager (canonical invariant) ─────────────');

test('ProjectionManager.registerTarget adds a target', () => {
  const db = new VectorDatabase();
  const pm = new ProjectionManager(db);
  const t  = pm.registerTarget('git-target', PROJECTION_TYPES.GIT, { url: 'https://github.com/heady/repo' });
  assert.strictEqual(t.id, 'git-target');
  assert.strictEqual(t.status, SYNC_STATUS.UNKNOWN);
});

test('ProjectionManager.registerTarget rejects unknown type', () => {
  const db = new VectorDatabase();
  const pm = new ProjectionManager(db);
  assert.throws(() => pm.registerTarget('bad', 'unknown-type'));
});

test('ProjectionManager.projectToAll returns results for all targets', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  pm.registerTarget('kv-1', PROJECTION_TYPES.KV);
  pm.registerTarget('git-1', PROJECTION_TYPES.GIT);
  const results = pm.projectToAll('some-state', { a: 1 }, _sha256({ a: 1 }));
  assert.strictEqual(results.length, 2);
});

test('ProjectionManager.assertCanonicalInvariant reports synced state', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  pm.registerTarget('kv', PROJECTION_TYPES.KV);
  pm.projectToAll('test', { v: 1 }, _sha256({ v: 1 }));
  const report = pm.assertCanonicalInvariant();
  assert.strictEqual(report.canonical, 'vector_database');
  assert.strictEqual(report.invariantHeld, true);
});

test('ProjectionManager.markStale changes target status', () => {
  const db = new VectorDatabase();
  const pm = new ProjectionManager(db);
  pm.registerTarget('cloud', PROJECTION_TYPES.CLOUD);
  pm.markStale('cloud');
  const targets = pm.listTargets();
  const cloud   = targets.find(t => t.id === 'cloud');
  assert.strictEqual(cloud.status, SYNC_STATUS.STALE);
});

test('ProjectionManager.deregisterTarget removes target', () => {
  const db = new VectorDatabase();
  const pm = new ProjectionManager(db);
  pm.registerTarget('to-remove', PROJECTION_TYPES.LOCAL);
  assert.strictEqual(pm.listTargets().length, 1);
  pm.deregisterTarget('to-remove');
  assert.strictEqual(pm.listTargets().length, 0);
});

// ─── Claim 4: FibonacciShardManager ──────────────────────────────────────────

console.log('\n── Claim 4: FibonacciShardManager (Fibonacci sharding) ──────────');

test('FibonacciShardManager.phiRatioReport includes PHI constant', () => {
  const db  = new VectorDatabase();
  const sm  = new FibonacciShardManager(db);
  const rep = sm.phiRatioReport();
  assert.strictEqual(rep.phi, PHI);
  assert.deepStrictEqual(rep.capacitiesGB, FIBONACCI_TIER_CAPACITIES_GB);
});

test('FibonacciShardManager.computeIdealTier promotes hot entries', () => {
  const db   = new VectorDatabase();
  const sm   = new FibonacciShardManager(db, { promotionThreshold: 5 });
  const entry = {
    tier:         STORAGE_TIERS.WARM,
    accessCount:  20,
    lastAccessed: Date.now(),
  };
  const ideal = sm.computeIdealTier(entry);
  assert.strictEqual(ideal, STORAGE_TIERS.HOT);
});

test('FibonacciShardManager.computeIdealTier demotes idle entries to archive', () => {
  const db   = new VectorDatabase();
  const sm   = new FibonacciShardManager(db, { demotionThreshold: 1 }); // 1 second
  const entry = {
    tier:         STORAGE_TIERS.HOT,
    accessCount:  0,
    lastAccessed: Date.now() - 100_000, // idle for 100 seconds
  };
  const ideal = sm.computeIdealTier(entry);
  assert.strictEqual(ideal, STORAGE_TIERS.ARCHIVE);
});

test('FibonacciShardManager.rebalance returns promotion/demotion counts', () => {
  const db  = new VectorDatabase();
  const pm  = new ProjectionManager(db);
  const ex  = new ExhaleModule(db, pm);
  const sm  = new FibonacciShardManager(db, { promotionThreshold: 5, demotionThreshold: 1 });

  // Insert entries with different tiers
  for (let i = 0; i < 5; i++) {
    ex.exhale(`entry-${i}`, { i }, { force: true, tier: STORAGE_TIERS.WARM });
  }

  // Force some access counts
  const all = db.entries();
  for (const e of all) e.accessCount = 10; // will trigger promotion to hot

  const res = sm.rebalance();
  assert(typeof res.promoted === 'number');
  assert(typeof res.demoted  === 'number');
  assert(typeof res.unchanged === 'number');
});

test('FibonacciShardManager.shardSummary includes PHI', () => {
  const db  = new VectorDatabase();
  const sm  = new FibonacciShardManager(db);
  const s   = sm.shardSummary();
  assert.strictEqual(s.phi, PHI);
});

// ─── Claim 6: ShadowMemorySystem (full system) ───────────────────────────────

console.log('\n── Claim 6: ShadowMemorySystem (full system) ────────────────────');

test('ShadowMemorySystem constructs all subsystems', () => {
  const sys = new ShadowMemorySystem();
  assert(sys.vectorDB instanceof VectorDatabase);
  assert(sys.exhaleModule instanceof ExhaleModule);
  assert(sys.inhaleModule instanceof InhaleModule);
  assert(sys.projectionManager instanceof ProjectionManager);
  assert(sys.shardManager instanceof FibonacciShardManager);
});

test('ShadowMemorySystem.exhale/inhale round-trip preserves state', () => {
  const sys = new ShadowMemorySystem();
  sys.exhale('round-trip-key', { message: 'hello shadow memory' }, { force: true });
  const res = sys.inhale('hello shadow memory', { k: 1 });
  assert(res.context.length >= 1);
  const topEntry = res.context[0];
  assert.deepStrictEqual(topEntry.payload, { message: 'hello shadow memory' });
});

test('ShadowMemorySystem.status returns phi and stats', () => {
  const sys    = new ShadowMemorySystem();
  const status = sys.status();
  assert.strictEqual(status.phi, PHI);
  assert(status.vectorDB);
  assert(status.projections);
  assert(status.shards);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
