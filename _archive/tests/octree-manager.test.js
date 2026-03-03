'use strict';
/**
 * Tests — Octree Manager
 */
const { OctreeManager } = require('../src/services/octree-manager');

console.log('=== Octree Manager Tests ===');

// ── Basic insert + size ─────────────────────────────────────
const tree = new OctreeManager({ max_depth: 6, max_items_per_leaf: 4, bounds: { min: [-1, 0, 0], max: [1, 1, 1] } });

tree.insert('a', -0.5, 0.3, 0.2, { label: 'backend-service' });
tree.insert('b', 0.5, 0.7, 0.8, { label: 'frontend-component' });
tree.insert('c', 0.0, 0.5, 0.5, { label: 'shared-config' });
tree.insert('d', -0.8, 0.1, 0.1, { label: 'dockerfile' });
tree.insert('e', 0.9, 0.9, 0.9, { label: 'landing-page-css' });
console.assert(tree.size() === 5, `Size should be 5, got ${tree.size()}`);
console.log('✓ Insert 5 items, size=5');

// ── Range query ─────────────────────────────────────────────
const backendItems = tree.rangeQuery(-1, 0, 0, 0, 0.5, 0.5);
console.assert(backendItems.length >= 2, `Backend range should have ≥2 items, got ${backendItems.length}`);
console.log(`✓ Range query (backend quadrant): ${backendItems.length} items`);

// ── Radius query ────────────────────────────────────────────
const nearOrigin = tree.radiusQuery(0, 0.5, 0.5, 0.3);
const hasSharedConfig = nearOrigin.some(i => i.id === 'c');
console.assert(hasSharedConfig, 'Radius query near origin should include shared-config');
console.log(`✓ Radius query (r=0.3 near center): ${nearOrigin.length} items, includes shared-config`);

// ── Nearest-k ───────────────────────────────────────────────
const nearest = tree.nearest(-0.5, 0.3, 0.2, 2);
console.assert(nearest[0].id === 'a', `Nearest to (-0.5,0.3,0.2) should be 'a', got '${nearest[0].id}'`);
console.assert(nearest.length === 2, 'Should return exactly 2 nearest');
console.log(`✓ Nearest-2 to (-0.5,0.3,0.2): [${nearest.map(n => n.id).join(', ')}]`);

// ── Remove ──────────────────────────────────────────────────
tree.remove('d');
console.assert(tree.size() === 4, `Size after remove should be 4, got ${tree.size()}`);
console.assert(!tree.has('d'), 'Should not have item d after removal');
console.log('✓ Remove: size=4, d removed');

// ── Duplicate-id re-insert ──────────────────────────────────
tree.insert('a', -0.4, 0.4, 0.3, { label: 'updated-backend' });
console.assert(tree.size() === 4, `Size after re-insert should be 4 (replaced), got ${tree.size()}`);
const updated = tree.get('a');
console.assert(updated.payload.label === 'updated-backend', 'Payload should be updated');
console.log('✓ Re-insert: replaced, size unchanged');

// ── Stats ───────────────────────────────────────────────────
const stats = tree.stats();
console.assert(stats.totalItems === 4, 'Stats totalItems should be 4');
console.assert(stats.maxDepth === 6, 'Stats maxDepth should be 6');
console.log(`✓ Stats: items=${stats.totalItems}, maxDepth=${stats.maxDepth}`);

// ── Clear ───────────────────────────────────────────────────
tree.clear();
console.assert(tree.size() === 0, 'Size after clear should be 0');
console.log('✓ Clear: size=0');

// ── Subdivision stress test ─────────────────────────────────
const bigTree = new OctreeManager({ max_depth: 5, max_items_per_leaf: 4, bounds: { min: [-1, 0, 0], max: [1, 1, 1] } });
for (let i = 0; i < 100; i++) {
    bigTree.insert(`item-${i}`, Math.random() * 2 - 1, Math.random(), Math.random(), { i });
}
console.assert(bigTree.size() === 100, `Stress test size should be 100, got ${bigTree.size()}`);
const radiusResults = bigTree.radiusQuery(0, 0.5, 0.5, 0.3);
console.assert(radiusResults.length > 0, 'Stress test radius query should return items');
console.log(`✓ Stress test: 100 items inserted, radius query returned ${radiusResults.length}`);

console.log('✅ octree-manager: ALL PASS');
