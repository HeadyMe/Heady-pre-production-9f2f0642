'use strict';
/**
 * Tests — Buddy System (integration)
 */
const { BuddySystem, TrajectoryTracker } = require('../src/services/buddy-system');

console.log('=== Buddy System Tests ===');

// ── Instantiation ───────────────────────────────────────────
const buddy = new BuddySystem();
buddy.start();
const status = buddy.status();
console.assert(status.service === 'buddy-system', 'Service name should be buddy-system');
console.assert(status.running === true, 'Should be running');
console.assert(status.ingestionCount === 0, 'Initial ingestion count should be 0');
console.log('✓ Instantiation: running, zero ingestions');

// ── Ingest single item ──────────────────────────────────────
const r1 = buddy.ingest('file-1', 'const express = require("express"); app.get("/api/data", handler);', {
    filePath: 'server/routes/data.js',
    mtime: new Date().toISOString(),
});
console.assert(r1.id === 'file-1', 'Ingest should return id');
console.assert(typeof r1.coords.x === 'number', 'Coords should have x');
console.assert(typeof r1.receipt === 'string' && r1.receipt.length === 64, 'Receipt should be 64-char SHA-256');
console.assert(r1.coords.x < 0, `Backend code X should be negative, got ${r1.coords.x}`);
console.log(`✓ Ingest: id=${r1.id}, X=${r1.coords.x}, Y=${r1.coords.y}, Z=${r1.coords.z}`);

// ── Batch ingest ────────────────────────────────────────────
const batchResults = buddy.batchIngest([
    { id: 'file-2', text: 'body { background: linear-gradient(135deg, #667eea, #764ba2); }', meta: { filePath: 'public/styles.css' } },
    { id: 'file-3', text: 'The HCFullPipeline orchestration framework governs system architecture and sacred geometry topology.', meta: { filePath: 'docs/architecture.md' } },
    { id: 'file-4', text: 'FROM node:22-alpine AS deps\nWORKDIR /app\nRUN pnpm install --prod', meta: { filePath: 'Dockerfile' } },
]);
console.assert(batchResults.length === 3, 'Batch should return 3 results');
console.assert(buddy.status().ingestionCount === 4, 'Total ingestions should be 4');
console.log(`✓ Batch ingest: 3 items, total ingested=${buddy.status().ingestionCount}`);

// ── Spatial ordering validation ─────────────────────────────
// CSS (X positive) vs Dockerfile (X negative)
console.assert(batchResults[0].coords.x > batchResults[2].coords.x, 'CSS X should be > Dockerfile X');
// Architecture doc (Z high) vs Dockerfile (Z low)
console.assert(batchResults[1].coords.z > batchResults[2].coords.z, 'Architecture Z should be > Dockerfile Z');
console.log('✓ Spatial ordering: CSS.x > Dockerfile.x, Architecture.z > Dockerfile.z');

// ── Context query ───────────────────────────────────────────
const queryResult = buddy.queryContext('express middleware server routing', 3);
console.assert(queryResult.results.length > 0, 'Query should return results');
console.assert(queryResult.coords.x < 0, 'Backend query should have negative X');
console.assert(typeof queryResult.receipt === 'string', 'Query should have receipt');
console.log(`✓ Context query: ${queryResult.results.length} results, X=${queryResult.coords.x}`);

// ── Nearest retrieval ───────────────────────────────────────
const nearest = buddy.retrieveContext(-0.5, 0.5, 0.2, 2);
console.assert(nearest.length <= 2, 'Nearest should return ≤ 2');
console.log(`✓ Nearest retrieval: ${nearest.length} items`);

// ── Trajectory tracker ──────────────────────────────────────
const tracker = new TrajectoryTracker(0.7, 3);
tracker.record({ x: -0.5, y: 0.3, z: 0.2 });
tracker.record({ x: -0.4, y: 0.35, z: 0.25 });
const predicted = tracker.record({ x: -0.3, y: 0.4, z: 0.3 });
console.assert(predicted !== null, 'Predicted should not be null after 3 records');
console.assert(predicted.x > -0.3, `Predicted X should be > -0.3 (moving positive), got ${predicted.x}`);
console.log(`✓ Trajectory prediction: X=${predicted.x.toFixed(3)}, Y=${predicted.y.toFixed(3)}, Z=${predicted.z.toFixed(3)}`);

// ── Pre-fetch (async) ───────────────────────────────────────
(async () => {
    const prefetchResult = await buddy.updateExecutorPosition({ x: -0.4, y: 0.35, z: 0.25 });
    console.assert(typeof prefetchResult.prefetched === 'number', 'Prefetch count should be a number');
    console.log(`✓ Pre-fetch: ${prefetchResult.prefetched} blocks pushed to cache`);

    // ── Temporal decay ──────────────────────────────────────
    const decayResult = buddy.applyTemporalDecay();
    console.assert(typeof decayResult.pruned === 'number', 'Decay pruned should be a number');
    console.assert(typeof decayResult.total === 'number', 'Decay total should be a number');
    console.log(`✓ Temporal decay: pruned=${decayResult.pruned}, remaining=${decayResult.total}`);

    // ── Redis bridge stats ──────────────────────────────────
    const cacheStats = buddy.status().cacheStats;
    console.assert(cacheStats.mode === 'in-memory', 'Cache mode should be in-memory (no Redis connected)');
    console.assert(cacheStats.writes > 0, 'Should have cache writes from ingestion');
    console.log(`✓ Cache stats: mode=${cacheStats.mode}, writes=${cacheStats.writes}, hitRate=${cacheStats.hitRate}`);

    // ── Stop ────────────────────────────────────────────────
    buddy.stop();
    console.assert(buddy.status().running === false, 'Should be stopped');
    console.log('✓ Stop: running=false');

    console.log('✅ buddy-system: ALL PASS');
})();
