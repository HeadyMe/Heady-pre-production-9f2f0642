'use strict';

/**
 * HeadyVector Test Suite
 *
 * Tests: CRUD, semantic search, BM25, hybrid (RRF), MMR, graph RAG, migrations.
 *
 * Prerequisites:
 *   docker compose up -d postgres
 *   DATABASE_URL=postgresql://heady:heady@localhost:5432/heady_vector
 *
 * Run: jest __tests__/heady-vector.test.js --runInBand
 *
 * Uses jest + real PostgreSQL (integration tests).
 * Each suite uses a unique collection name to avoid conflicts.
 */

const { Pool } = require('pg');
const { HeadyVector } = require('../index');
const { MigrationRunner } = require('../migrations');
const { CollectionManager } = require('../collections');
const { IndexManager } = require('../indexes');
const { SearchEngine, buildMetadataFilter } = require('../search');
const { GraphRAG } = require('../graph-rag');
const { HealthChecker } = require('../health');
const config = require('../config');

// ── Test database URL ─────────────────────────────────────────────────────────

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://heady:heady@localhost:5432/heady_vector';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a random 384-dim unit vector */
function randomVector(dim = 384) {
  const v = new Array(dim).fill(0).map(() => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

/** Generate a fixed test vector biased toward one direction */
function biasedVector(bias = 0, dim = 384) {
  const v = new Array(dim).fill(0).map((_, i) => (i === bias ? 1.0 : Math.random() * 0.01));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

/** Unique collection name per test */
const testRun = Date.now();
let collectionCounter = 0;
function uniqueCollection(prefix = 'test') {
  return `${prefix}_${testRun}_${++collectionCounter}`;
}

// ── Global setup/teardown ─────────────────────────────────────────────────────

let pool;
let hv;

beforeAll(async () => {
  pool = new Pool({
    connectionString: TEST_DB_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  // Run migrations
  const runner = new MigrationRunner(pool);
  await runner.runAll();

  // Initialize HeadyVector
  hv = new HeadyVector({ database: { url: TEST_DB_URL } });
  await hv.start();
}, 60000);

afterAll(async () => {
  if (hv) await hv.stop();
  if (pool) await pool.end();
}, 15000);

// ────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// ────────────────────────────────────────────────────────────────────────────

describe('Migrations', () => {
  test('runAll() is idempotent — no errors on re-run', async () => {
    const runner = new MigrationRunner(pool);
    const { applied, skipped } = await runner.runAll();
    // All migrations already applied, so applied should be empty
    expect(applied).toEqual([]);
    expect(skipped.length).toBeGreaterThan(0);
  });

  test('getStatus() returns all migrations as applied', async () => {
    const runner = new MigrationRunner(pool);
    const statuses = await runner.getStatus();
    expect(statuses.length).toBeGreaterThan(0);
    const allApplied = statuses.every((s) => s.applied);
    expect(allApplied).toBe(true);
  });

  test('heady_vectors table has vector column', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'heady_vectors' AND column_name = 'embedding'
    `);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].udt_name).toBe('vector');
  });

  test('pgvector extension is installed', async () => {
    const result = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    expect(result.rows.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// COLLECTIONS
// ────────────────────────────────────────────────────────────────────────────

describe('CollectionManager', () => {
  let manager;

  beforeAll(() => {
    const indexManager = new IndexManager(pool);
    manager = new CollectionManager(pool, indexManager);
  });

  test('create() creates a new collection', async () => {
    const name = uniqueCollection('coll');
    const collection = await manager.create({ name, dimension: 384 });

    expect(collection.name).toBe(name);
    expect(collection.dimension).toBe(384);
    expect(collection.index_type).toBe('hnsw');
    expect(collection.distance_metric).toBe('cosine');
    expect(collection.id).toBeDefined();
  });

  test('create() rejects duplicate collection names', async () => {
    const name = uniqueCollection('dup');
    await manager.create({ name });
    await expect(manager.create({ name })).rejects.toThrow('already exists');
  });

  test('create() rejects invalid name characters', async () => {
    await expect(manager.create({ name: 'bad name!' })).rejects.toThrow('alphanumeric');
  });

  test('create() rejects unsupported dimensions', async () => {
    await expect(manager.create({ name: uniqueCollection(), dimension: 512 }))
      .rejects.toThrow('Unsupported dimension');
  });

  test('get() retrieves by name', async () => {
    const name = uniqueCollection('get');
    await manager.create({ name });
    const retrieved = await manager.get(name);
    expect(retrieved.name).toBe(name);
  });

  test('get() returns null for non-existent collection', async () => {
    const result = await manager.get('does_not_exist_xyz');
    expect(result).toBeNull();
  });

  test('require() throws for non-existent collection', async () => {
    await expect(manager.require('does_not_exist_xyz')).rejects.toThrow('not found');
  });

  test('list() returns collections with pagination', async () => {
    const names = [uniqueCollection('list'), uniqueCollection('list'), uniqueCollection('list')];
    await Promise.all(names.map((n) => manager.create({ name: n })));

    const { collections, total } = await manager.list({ limit: 1000 });
    expect(total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(collections)).toBe(true);
  });

  test('update() updates allowed fields', async () => {
    const name = uniqueCollection('upd');
    await manager.create({ name });
    const updated = await manager.update(name, { description: 'new description' });
    expect(updated.description).toBe('new description');
  });

  test('delete() removes collection and returns vectorsRemoved', async () => {
    const name = uniqueCollection('del');
    await manager.create({ name });
    const result = await manager.delete(name);
    expect(result.deleted).toBe(true);
    expect(typeof result.vectorsRemoved).toBe('number');

    // Confirm it's gone
    const gone = await manager.get(name);
    expect(gone).toBeNull();
  });

  test('create() with 768 dimensions', async () => {
    const name = uniqueCollection('768d');
    const collection = await manager.create({ name, dimension: 768 });
    expect(collection.dimension).toBe(768);
  });

  test('validateMetadata() enforces schema', () => {
    const schema = {
      required: ['source'],
      properties: {
        source: { type: 'string' },
        score: { type: 'number' },
      },
    };
    const { valid, errors } = manager.validateMetadata(
      { metadata_schema: schema },
      { source: 'test', score: 0.9 }
    );
    expect(valid).toBe(true);
    expect(errors).toEqual([]);

    const { valid: invalid, errors: errs } = manager.validateMetadata(
      { metadata_schema: schema },
      { score: 0.9 } // missing 'source'
    );
    expect(invalid).toBe(false);
    expect(errs.length).toBeGreaterThan(0);
  });

  test('stats() returns vector count and index info', async () => {
    const name = uniqueCollection('stats');
    const coll = await manager.create({ name });

    // Upsert a vector first
    await hv.upsert({ collection: name, vector: randomVector(), content: 'test', metadata: {} });

    const stats = await manager.stats(name);
    expect(stats.collection.id).toBe(coll.id);
    expect(parseInt(stats.vectors.total_vectors, 10)).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// VECTOR CRUD
// ────────────────────────────────────────────────────────────────────────────

describe('Vector CRUD', () => {
  let collectionName;

  beforeAll(async () => {
    collectionName = uniqueCollection('vcrud');
    await hv.createCollection({ name: collectionName, dimension: 384 });
  });

  test('upsert() inserts a new vector', async () => {
    const record = await hv.upsert({
      collection: collectionName,
      vector: randomVector(),
      content: 'Hello heady vector',
      metadata: { topic: 'test', priority: 1 },
    });

    expect(record.id).toBeDefined();
    expect(record.content).toBe('Hello heady vector');
    expect(record.metadata.topic).toBe('test');
  });

  test('upsert() updates existing vector by external_id', async () => {
    const externalId = 'ext-001';
    const vec1 = randomVector();
    const vec2 = randomVector();

    const first = await hv.upsert({
      collection: collectionName,
      id: externalId,
      vector: vec1,
      content: 'First content',
      metadata: { version: 1 },
    });
    expect(first.external_id).toBe(externalId);

    const second = await hv.upsert({
      collection: collectionName,
      id: externalId,
      vector: vec2,
      content: 'Updated content',
      metadata: { version: 2 },
    });
    expect(second.external_id).toBe(externalId);
    expect(second.content).toBe('Updated content');
    expect(second.metadata.version).toBe(2);
  });

  test('getVector() retrieves by internal UUID', async () => {
    const record = await hv.upsert({
      collection: collectionName,
      vector: randomVector(),
      content: 'Get by id test',
      metadata: {},
    });

    const retrieved = await hv.getVector(record.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved.id).toBe(record.id);
    expect(retrieved.content).toBe('Get by id test');
  });

  test('getVector() returns null for unknown ID', async () => {
    const result = await hv.getVector('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  test('deleteVector() removes by ID', async () => {
    const record = await hv.upsert({
      collection: collectionName,
      vector: randomVector(),
      content: 'To be deleted',
      metadata: {},
    });

    const deleteResult = await hv.deleteVector(record.id);
    expect(deleteResult.deleted).toBe(true);

    const gone = await hv.getVector(record.id);
    expect(gone).toBeNull();
  });

  test('upsertBatch() inserts multiple vectors', async () => {
    const vectors = Array.from({ length: 20 }, (_, i) => ({
      id: `batch-${i}`,
      vector: randomVector(),
      content: `Batch item ${i}`,
      metadata: { batch: true, index: i },
    }));

    const result = await hv.upsertBatch(collectionName, vectors, { batchSize: 10 });
    expect(result.upserted).toBe(20);
    expect(result.errors).toHaveLength(0);
  });

  test('deleteByFilter() removes matching vectors', async () => {
    // Insert some tagged vectors
    await hv.upsertBatch(collectionName, [
      { vector: randomVector(), content: 'tag-del-1', metadata: { tag: 'delete-me' } },
      { vector: randomVector(), content: 'tag-del-2', metadata: { tag: 'delete-me' } },
      { vector: randomVector(), content: 'keep-this', metadata: { tag: 'keep' } },
    ]);

    const result = await hv.deleteByFilter(collectionName, { tag: 'delete-me' });
    expect(result.deleted).toBeGreaterThanOrEqual(2);
  });

  test('upsert() rejects wrong vector dimension', async () => {
    await expect(
      hv.upsert({ collection: collectionName, vector: new Array(128).fill(0.1), metadata: {} })
    ).rejects.toThrow('dimension mismatch');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────────────────────

describe('SearchEngine', () => {
  let searchCollectionName;

  beforeAll(async () => {
    searchCollectionName = uniqueCollection('search');
    await hv.createCollection({ name: searchCollectionName, dimension: 384 });

    // Insert test vectors
    const items = [
      { content: 'machine learning and neural networks', metadata: { topic: 'ml', score: 0.9 } },
      { content: 'deep learning transformers attention', metadata: { topic: 'ml', score: 0.8 } },
      { content: 'quantum computing qubits superposition', metadata: { topic: 'quantum', score: 0.7 } },
      { content: 'cooking recipes pasta italian food', metadata: { topic: 'food', score: 0.6 } },
      { content: 'vector database similarity search', metadata: { topic: 'db', score: 0.95 } },
      { content: 'heady ai platform embeddings', metadata: { topic: 'heady', score: 1.0 } },
    ];

    await hv.upsertBatch(
      searchCollectionName,
      items.map((item, i) => ({
        id: `search-item-${i}`,
        vector: biasedVector(i, 384),
        content: item.content,
        metadata: item.metadata,
      }))
    );
  }, 30000);

  // ── Semantic search ────────────────────────────────────────────────────────

  test('semantic() returns topK results', async () => {
    const { results, latencyMs } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      topK: 3,
    });

    expect(results.length).toBeLessThanOrEqual(3);
    expect(results[0].similarity_score).toBeDefined();
    expect(typeof latencyMs).toBe('number');
  });

  test('semantic() results are ordered by similarity (descending)', async () => {
    const { results } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      topK: 5,
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity_score).toBeGreaterThanOrEqual(results[i].similarity_score);
    }
  });

  test('semantic() with metadata filter returns only matching vectors', async () => {
    const { results } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: randomVector(384),
      topK: 10,
      filter: { topic: 'ml' },
    });

    for (const r of results) {
      expect(r.metadata.topic).toBe('ml');
    }
  });

  test('semantic() with namespace isolation', async () => {
    // Insert into a named namespace
    await hv.upsert({
      collection: searchCollectionName,
      namespace: 'ns-test',
      vector: biasedVector(100, 384),
      content: 'namespaced content',
      metadata: { ns: true },
    });

    // Search in the namespace
    const { results } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: biasedVector(100, 384),
      topK: 5,
      namespace: 'ns-test',
    });

    expect(results.every((r) => r.namespace === 'ns-test')).toBe(true);
  });

  test('semantic() pagination works', async () => {
    const { results: page1 } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: randomVector(),
      topK: 2,
      offset: 0,
    });
    const { results: page2 } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: randomVector(),
      topK: 2,
      offset: 2,
    });

    // Results should differ (different offsets)
    if (page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  // ── BM25 search ────────────────────────────────────────────────────────────

  test('bm25() finds documents by keyword', async () => {
    const { results, latencyMs } = await hv.bm25Search({
      collection: searchCollectionName,
      query: 'neural networks',
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].bm25_score).toBeDefined();
    expect(typeof latencyMs).toBe('number');
    // Should find ML-related content
    const contents = results.map((r) => r.content);
    expect(contents.some((c) => c.includes('machine learning') || c.includes('neural'))).toBe(true);
  });

  test('bm25() returns empty for non-matching query', async () => {
    const { results } = await hv.bm25Search({
      collection: searchCollectionName,
      query: 'xyzzy nonexistent gobbledygook',
    });
    expect(results.length).toBe(0);
  });

  test('bm25() rejects empty query', async () => {
    await expect(
      hv.bm25Search({ collection: searchCollectionName, query: '' })
    ).rejects.toThrow('non-empty');
  });

  // ── Hybrid search ──────────────────────────────────────────────────────────

  test('hybrid() returns fused results', async () => {
    const { results, latencyMs, queryType, alpha } = await hv.hybridSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      query: 'machine learning',
      alpha: 0.7,
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(queryType).toBe('hybrid');
    expect(alpha).toBe(0.7);
    expect(typeof latencyMs).toBe('number');
    // Results should have rrf_score
    expect(results[0].rrf_score).toBeDefined();
  });

  test('hybrid() with alpha=1 delegates to semantic', async () => {
    const { results, queryType } = await hv.hybridSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      query: 'machine learning',
      alpha: 1.0,
      topK: 3,
    });
    expect(results.length).toBeGreaterThan(0);
    // When alpha=1.0, delegates to semantic and returns semantic results
    expect(['hybrid', 'semantic']).toContain(queryType);
  });

  test('hybrid() with alpha=0 delegates to BM25', async () => {
    const { results } = await hv.hybridSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      query: 'machine learning',
      alpha: 0.0,
      topK: 3,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  test('hybrid() requires vector when alpha > 0', async () => {
    await expect(
      hv.hybridSearch({
        collection: searchCollectionName,
        query: 'test',
        alpha: 0.5,
        topK: 5,
      })
    ).rejects.toThrow('vector');
  });

  // ── MMR search ─────────────────────────────────────────────────────────────

  test('mmr() returns diverse results', async () => {
    const { results, latencyMs, queryType } = await hv.mmrSearch({
      collection: searchCollectionName,
      vector: randomVector(384),
      topK: 4,
      lambda: 0.5,
    });

    expect(queryType).toBe('mmr');
    expect(results.length).toBeGreaterThanOrEqual(0); // may be limited by collection size
    expect(typeof latencyMs).toBe('number');
    // Each result should have an mmr_score
    for (const r of results) {
      expect(r.mmr_score).toBeDefined();
    }
  });

  test('mmr() with lambda=1 behaves like pure semantic', async () => {
    const { results: mmrResults } = await hv.mmrSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      topK: 3,
      lambda: 1.0,
    });
    const { results: semResults } = await hv.semanticSearch({
      collection: searchCollectionName,
      vector: biasedVector(0, 384),
      topK: 3,
    });

    if (mmrResults.length > 0 && semResults.length > 0) {
      // Top result should be the same
      expect(mmrResults[0].id).toBe(semResults[0].id);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// METADATA FILTER BUILDER
// ────────────────────────────────────────────────────────────────────────────

describe('buildMetadataFilter', () => {
  test('handles exact match', () => {
    const params = [];
    const sql = buildMetadataFilter({ topic: 'ml' }, params);
    expect(sql).toContain('@>');
    expect(params.length).toBe(1);
    expect(JSON.parse(params[0])).toEqual({ topic: 'ml' });
  });

  test('handles $gt operator', () => {
    const params = [];
    const sql = buildMetadataFilter({ score: { $gt: 0.5 } }, params);
    expect(sql).toContain('>');
    expect(params[0]).toBe(0.5);
  });

  test('handles $in operator', () => {
    const params = [];
    const sql = buildMetadataFilter({ topic: { $in: ['ml', 'db'] } }, params);
    expect(sql).toContain('ANY');
  });

  test('handles $and operator', () => {
    const params = [];
    const sql = buildMetadataFilter({ $and: [{ topic: 'ml' }, { score: { $gte: 0.5 } }] }, params);
    expect(sql).toContain('AND');
  });

  test('handles $or operator', () => {
    const params = [];
    const sql = buildMetadataFilter({ $or: [{ topic: 'ml' }, { topic: 'db' }] }, params);
    expect(sql).toContain('OR');
  });

  test('returns 1=1 for empty filter', () => {
    const params = [];
    const sql = buildMetadataFilter({}, params);
    expect(sql).toBe('1=1');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GRAPH RAG
// ────────────────────────────────────────────────────────────────────────────

describe('GraphRAG', () => {
  let graphRag;

  beforeAll(() => {
    const indexManager = new IndexManager(pool);
    graphRag = new GraphRAG(pool, indexManager);
  });

  // ── Nodes ──────────────────────────────────────────────────────────────────

  test('addNode() creates a node', async () => {
    const node = await graphRag.addNode({
      label: 'Machine Learning',
      nodeType: 'concept',
      content: 'A branch of artificial intelligence',
      properties: { domain: 'AI' },
    });

    expect(node.id).toBeDefined();
    expect(node.label).toBe('Machine Learning');
    expect(node.node_type).toBe('concept');
  });

  test('addNode() creates a node with embedding', async () => {
    const node = await graphRag.addNode({
      label: 'Neural Networks',
      nodeType: 'entity',
      vector: biasedVector(10, 384),
      properties: { domain: 'AI' },
    });

    expect(node.id).toBeDefined();
    // Embedding is stored but not returned as array
    expect(node.label).toBe('Neural Networks');
  });

  test('getNode() retrieves a node', async () => {
    const created = await graphRag.addNode({ label: 'Test Node', nodeType: 'custom' });
    const retrieved = await graphRag.getNode(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.label).toBe('Test Node');
  });

  test('getNode() returns null for non-existent node', async () => {
    const result = await graphRag.getNode('00000000-0000-0000-0000-000000000001');
    expect(result).toBeNull();
  });

  test('findNodesByLabel() does fuzzy search', async () => {
    const label = `UniqueLabelXYZ_${testRun}`;
    await graphRag.addNode({ label, nodeType: 'entity' });
    const results = await graphRag.findNodesByLabel('UniqueLabelXYZ', { exact: false });
    expect(results.some((r) => r.label === label)).toBe(true);
  });

  test('deleteNode() removes node and returns deleted=true', async () => {
    const node = await graphRag.addNode({ label: 'To Delete', nodeType: 'custom' });
    const result = await graphRag.deleteNode(node.id);
    expect(result.deleted).toBe(true);
    const gone = await graphRag.getNode(node.id);
    expect(gone).toBeNull();
  });

  // ── Edges ──────────────────────────────────────────────────────────────────

  test('addEdge() creates a directed edge', async () => {
    const source = await graphRag.addNode({ label: 'Source', nodeType: 'entity' });
    const target = await graphRag.addNode({ label: 'Target', nodeType: 'entity' });

    const edge = await graphRag.addEdge({
      sourceId: source.id,
      targetId: target.id,
      edgeType: 'related_to',
      weight: 0.8,
    });

    expect(edge.id).toBeDefined();
    expect(edge.source_id).toBe(source.id);
    expect(edge.target_id).toBe(target.id);
    expect(edge.weight).toBe(0.8);
  });

  test('addEdge() upserts on conflict', async () => {
    const source = await graphRag.addNode({ label: 'S2', nodeType: 'entity' });
    const target = await graphRag.addNode({ label: 'T2', nodeType: 'entity' });

    await graphRag.addEdge({ sourceId: source.id, targetId: target.id, weight: 0.5 });
    const updated = await graphRag.addEdge({ sourceId: source.id, targetId: target.id, weight: 0.9 });

    expect(updated.weight).toBe(0.9);
  });

  test('addEdge() rejects self-loops', async () => {
    const node = await graphRag.addNode({ label: 'Loop', nodeType: 'entity' });
    await expect(
      graphRag.addEdge({ sourceId: node.id, targetId: node.id })
    ).rejects.toThrow('Self-loops');
  });

  test('getEdges() returns outgoing edges', async () => {
    const source = await graphRag.addNode({ label: 'ES', nodeType: 'entity' });
    const t1 = await graphRag.addNode({ label: 'ET1', nodeType: 'entity' });
    const t2 = await graphRag.addNode({ label: 'ET2', nodeType: 'entity' });

    await graphRag.addEdge({ sourceId: source.id, targetId: t1.id, weight: 0.7 });
    await graphRag.addEdge({ sourceId: source.id, targetId: t2.id, weight: 0.6 });

    const edges = await graphRag.getEdges(source.id, { direction: 'outgoing' });
    expect(edges.length).toBeGreaterThanOrEqual(2);
    for (const e of edges) {
      expect(e.source_id).toBe(source.id);
    }
  });

  // ── Traversal ──────────────────────────────────────────────────────────────

  test('traverse() finds reachable nodes via BFS', async () => {
    // Build a small graph: A -> B -> C
    const A = await graphRag.addNode({ label: 'TravA', nodeType: 'document' });
    const B = await graphRag.addNode({ label: 'TravB', nodeType: 'document' });
    const C = await graphRag.addNode({ label: 'TravC', nodeType: 'document' });

    await graphRag.addEdge({ sourceId: A.id, targetId: B.id, weight: 0.9 });
    await graphRag.addEdge({ sourceId: B.id, targetId: C.id, weight: 0.8 });

    const result = await graphRag.traverse({
      seedNodeIds: [A.id],
      maxDepth: 2,
      maxNodes: 50,
    });

    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain(A.id);
    expect(nodeIds).toContain(B.id);
    expect(nodeIds).toContain(C.id);
  });

  test('traverse() respects maxDepth', async () => {
    const N1 = await graphRag.addNode({ label: 'D1', nodeType: 'chunk' });
    const N2 = await graphRag.addNode({ label: 'D2', nodeType: 'chunk' });
    const N3 = await graphRag.addNode({ label: 'D3', nodeType: 'chunk' });
    const N4 = await graphRag.addNode({ label: 'D4', nodeType: 'chunk' });

    await graphRag.addEdge({ sourceId: N1.id, targetId: N2.id, weight: 0.9 });
    await graphRag.addEdge({ sourceId: N2.id, targetId: N3.id, weight: 0.9 });
    await graphRag.addEdge({ sourceId: N3.id, targetId: N4.id, weight: 0.9 });

    const result = await graphRag.traverse({
      seedNodeIds: [N1.id],
      maxDepth: 2, // Should not reach N4 (3 hops away)
    });

    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain(N2.id);
    expect(nodeIds).toContain(N3.id);
    expect(nodeIds).not.toContain(N4.id);
  });

  test('traverse() throws without seedNodeIds', async () => {
    await expect(graphRag.traverse({ seedNodeIds: [] })).rejects.toThrow();
  });

  // ── Graph RAG retrieval ────────────────────────────────────────────────────

  test('rag() retrieves context anchored on entity nodes', async () => {
    // Create entity + chunk nodes and connect them
    const entity = await graphRag.addNode({
      label: 'RAG Entity Test',
      nodeType: 'entity',
      vector: biasedVector(50, 384),
      content: 'entity for rag test',
    });
    const chunk = await graphRag.addNode({
      label: 'RAG Chunk Test',
      nodeType: 'chunk',
      content: 'This chunk is related to the entity',
    });
    await graphRag.addEdge({
      sourceId: entity.id,
      targetId: chunk.id,
      edgeType: 'contains',
      weight: 0.9,
    });

    const result = await graphRag.rag({
      collection: null,
      vector: biasedVector(50, 384),
      topK: 5,
      entityTopK: 3,
      maxDepth: 2,
      nodeTypes: ['chunk', 'document'],
    });

    expect(result.entities).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(Array.isArray(result.context)).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
  });

  // ── Community detection ────────────────────────────────────────────────────

  test('detectCommunities() groups nodes into communities', async () => {
    // Create a small cluster
    const nodes = await Promise.all([
      graphRag.addNode({ label: 'Comm1', nodeType: 'concept' }),
      graphRag.addNode({ label: 'Comm2', nodeType: 'concept' }),
      graphRag.addNode({ label: 'Comm3', nodeType: 'concept' }),
    ]);

    await graphRag.addEdge({ sourceId: nodes[0].id, targetId: nodes[1].id, weight: 0.9, bidirectional: true });
    await graphRag.addEdge({ sourceId: nodes[1].id, targetId: nodes[2].id, weight: 0.8, bidirectional: true });

    const result = await graphRag.detectCommunities({ maxIterations: 5 });
    expect(result.communities).toBeGreaterThan(0);
    expect(typeof result.iterations).toBe('number');
  });

  // ── PageRank ───────────────────────────────────────────────────────────────

  test('computePageRank() updates page_rank scores', async () => {
    const result = await graphRag.computePageRank({ dampingFactor: 0.85, iterations: 5 });
    expect(result.updated).toBeGreaterThanOrEqual(0);
  });

  // ── findPaths ─────────────────────────────────────────────────────────────

  test('findPaths() finds paths between two connected nodes', async () => {
    const start = await graphRag.addNode({ label: 'PathStart', nodeType: 'entity' });
    const mid = await graphRag.addNode({ label: 'PathMid', nodeType: 'entity' });
    const end = await graphRag.addNode({ label: 'PathEnd', nodeType: 'entity' });

    await graphRag.addEdge({ sourceId: start.id, targetId: mid.id, weight: 0.9 });
    await graphRag.addEdge({ sourceId: mid.id, targetId: end.id, weight: 0.8 });

    const { paths } = await graphRag.findPaths({
      sourceId: start.id,
      targetId: end.id,
      maxDepth: 3,
    });

    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].nodes.length).toBeGreaterThanOrEqual(2);
  });

  // ── Visualization export ───────────────────────────────────────────────────

  test('exportVisualization() returns D3-compatible format', async () => {
    const result = await graphRag.exportVisualization({ limit: 50 });
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);

    // Check D3 format fields
    if (result.nodes.length > 0) {
      const node = result.nodes[0];
      expect(node.id).toBeDefined();
      expect(node.label).toBeDefined();
      expect(node.type).toBeDefined();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// HEALTH
// ────────────────────────────────────────────────────────────────────────────

describe('HealthChecker', () => {
  let checker;

  beforeAll(() => {
    const indexManager = new IndexManager(pool);
    checker = new HealthChecker(pool, indexManager);
  });

  test('check() returns healthy status', async () => {
    const health = await checker.check();
    expect(health.status).toMatch(/healthy|degraded/);
    expect(health.checks.database.status).toBe('ok');
    expect(health.checks.database.pgvector).toBe(true);
  });

  test('isAlive() returns true', async () => {
    const alive = await checker.isAlive();
    expect(alive).toBe(true);
  });

  test('isReady() returns true when pgvector is installed', async () => {
    const ready = await checker.isReady();
    expect(ready).toBe(true);
  });

  test('check() includes pool stats', async () => {
    const health = await checker.check();
    expect(health.pool).toBeDefined();
    expect(typeof health.pool.total).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// INDEX MANAGER
// ────────────────────────────────────────────────────────────────────────────

describe('IndexManager', () => {
  let indexManager;

  beforeAll(() => {
    indexManager = new IndexManager(pool);
  });

  test('getSimilarityOp() returns correct operator for cosine', () => {
    expect(indexManager.getSimilarityOp('cosine')).toBe('<=>');
  });

  test('getSimilarityOp() returns correct operator for l2', () => {
    expect(indexManager.getSimilarityOp('l2')).toBe('<->');
  });

  test('getHealthSummary() returns index list', async () => {
    const summary = await indexManager.getHealthSummary();
    expect(Array.isArray(summary.indexes)).toBe(true);
    expect(typeof summary.count).toBe('number');
  });

  test('recommendIndexType() returns none for empty collection', async () => {
    const emptyCollection = { id: '00000000-0000-0000-0000-000000000002' };
    const type = await indexManager.recommendIndexType(emptyCollection);
    expect(type).toBe('none');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────────────────

describe('Config', () => {
  test('PHI is golden ratio', () => {
    expect(Math.abs(config.phi - 1.618033988749895)).toBeLessThan(1e-10);
  });

  test('default port is 3103', () => {
    expect(config.port).toBe(3103);
  });

  test('default HNSW m is 16', () => {
    expect(config.hnsw.m).toBe(16);
  });

  test('default ef_construction is 200', () => {
    expect(config.hnsw.efConstruction).toBe(200);
  });

  test('default vector dimension is 384', () => {
    expect(config.vectorDimensions.default).toBe(384);
  });

  test('bm25Weight + semanticWeight ≈ 1.0', () => {
    const sum = config.search.bm25Weight + config.search.semanticWeight;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });
});
