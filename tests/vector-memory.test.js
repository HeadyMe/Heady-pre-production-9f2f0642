/*
 * © 2026 Heady Systems LLC.
 * Tests for src/vector-memory.js
 */

const vm = require('../src/vector-memory');

describe('Vector Memory — 3D Coordinate System', () => {
    test('to3D projects embedding to 3 dimensions', () => {
        // Create a mock 384-dim embedding
        const embedding = new Array(384).fill(0).map((_, i) => Math.sin(i));
        const coords = vm.to3D(embedding);
        expect(coords).toBeDefined();
        expect(coords.length).toBe(3);
        coords.forEach(c => expect(typeof c).toBe('number'));
    });

    test('assignZone maps 3D coords to octant zone (0-7)', () => {
        expect(vm.assignZone(1, 1, 1)).toBe(7);   // all positive => zone 7
        expect(vm.assignZone(-1, -1, -1)).toBe(0); // all negative => zone 0
        const zone = vm.assignZone(0.5, -0.3, 0.8);
        expect(zone).toBeGreaterThanOrEqual(0);
        expect(zone).toBeLessThanOrEqual(7);
    });

    test('dist3D computes Euclidean distance', () => {
        const d = vm.dist3D([0, 0, 0], [3, 4, 0]);
        expect(d).toBeCloseTo(5, 5);
    });

    test('getAdjacentZones returns array of adjacent zones', () => {
        const adj = vm.getAdjacentZones(0);
        expect(Array.isArray(adj)).toBe(true);
        expect(adj.length).toBeGreaterThan(0);
        adj.forEach(z => {
            expect(z).toBeGreaterThanOrEqual(0);
            expect(z).toBeLessThanOrEqual(7);
        });
    });
});

describe('Vector Memory — Embedding', () => {
    test('localHashEmbed produces deterministic output', () => {
        const a = vm.localHashEmbed('hello world', 384);
        const b = vm.localHashEmbed('hello world', 384);
        expect(a).toEqual(b);
        expect(a.length).toBe(384);
    });

    test('localHashEmbed produces different embeddings for different text', () => {
        const a = vm.localHashEmbed('hello', 384);
        const b = vm.localHashEmbed('goodbye', 384);
        expect(a).not.toEqual(b);
    });
});

describe('Vector Memory — Cosine Similarity', () => {
    test('identical vectors have similarity 1', () => {
        const v = [1, 2, 3, 4];
        expect(vm.cosineSim(v, v)).toBeCloseTo(1, 5);
    });

    test('orthogonal vectors have similarity 0', () => {
        expect(vm.cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    test('opposite vectors have similarity -1', () => {
        expect(vm.cosineSim([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });
});

describe('Vector Memory — Coordinate Projections', () => {
    test('toSpherical converts to spherical coordinates', () => {
        const result = vm.toSpherical({ x: 1, y: 0, z: 0 });
        expect(result).toBeDefined();
        expect(typeof result.r).toBe('number');
        expect(result.r).toBeCloseTo(1, 5);
    });

    test('toIsometric converts to isometric projection', () => {
        const result = vm.toIsometric({ x: 1, y: 1, z: 1 });
        expect(result).toBeDefined();
        expect(typeof result.x).toBe('number');
        expect(typeof result.y).toBe('number');
    });
});

describe('Vector Memory — Ingest & Query', () => {
    test('ingestMemory accepts content and returns a record', async () => {
        const result = await vm.ingestMemory({
            content: 'Test memory for unit testing',
            metadata: { source: 'test', tags: ['unit-test'] },
        });
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
    });

    test('queryMemory returns results array', async () => {
        const results = await vm.queryMemory('test memory', 5);
        expect(Array.isArray(results)).toBe(true);
    });
});
