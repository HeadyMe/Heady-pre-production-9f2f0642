#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Eradication Protocol — The Pruner ═══
 *
 * Runs BEFORE any projection cycle to ruthlessly eliminate technical debt:
 *   1. Wipe ephemeral workspace (local staging area)
 *   2. Prune deprecated vectors from pgvector memory
 *   3. Invalidate stale Cloudflare edge cache entries
 *   4. Emit 'projections:eradication-complete' event
 *
 * Usage:
 *   node scripts/eradication-protocol.js              # Full eradication
 *   node scripts/eradication-protocol.js --dry-run    # Report only, no deletes
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');
const WORKSPACE_DIR = process.env.HEADY_WORKSPACE_DIR || path.join(__dirname, '..', '.heady-workspace');
const DATA_DIR = path.join(__dirname, '..', 'data');

// ── Phase 1: Ephemeral Workspace Wipe ──────────────────────────
function obliterateWorkspace() {
    console.log('\n🧹 [Phase 1] Ephemeral Workspace Wipe');

    if (!fs.existsSync(WORKSPACE_DIR)) {
        console.log(`   ✓ Workspace ${WORKSPACE_DIR} does not exist — clean state`);
        return { wiped: false, reason: 'not-found' };
    }

    const files = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(full);
        }
    }
    walk(WORKSPACE_DIR);

    console.log(`   Found ${files.length} ephemeral files`);

    if (DRY_RUN) {
        files.slice(0, 10).forEach(f => console.log(`     [DRY] Would delete: ${path.relative(WORKSPACE_DIR, f)}`));
        if (files.length > 10) console.log(`     ... and ${files.length - 10} more`);
        return { wiped: false, fileCount: files.length, dryRun: true };
    }

    fs.rmSync(WORKSPACE_DIR, { recursive: true, force: true });
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    console.log(`   ✓ Workspace obliterated (${files.length} files removed)`);
    return { wiped: true, fileCount: files.length };
}

// ── Phase 2: Latent Memory Pruning ─────────────────────────────
async function pruneLatentMemory() {
    console.log('\n🧠 [Phase 2] Latent Memory Pruning');

    const dbUrl = process.env.HEADY_POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log('   ⚠ No DATABASE_URL — skipping pgvector pruning');
        return { pruned: 0, reason: 'no-database' };
    }

    try {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

        // Count deprecated nodes
        const countResult = await pool.query(
            "SELECT COUNT(*) as cnt FROM heady_latent_memory WHERE status = 'DEPRECATED'"
        );
        const deprecatedCount = parseInt(countResult.rows[0]?.cnt || 0);
        console.log(`   Found ${deprecatedCount} deprecated logic vectors`);

        if (DRY_RUN) {
            console.log(`   [DRY] Would delete ${deprecatedCount} deprecated vectors`);
            await pool.end();
            return { pruned: 0, wouldPrune: deprecatedCount, dryRun: true };
        }

        if (deprecatedCount > 0) {
            const deleteResult = await pool.query(
                "DELETE FROM heady_latent_memory WHERE status = 'DEPRECATED' RETURNING node_id"
            );
            console.log(`   ✓ ${deleteResult.rowCount} stale logic vectors eliminated`);
            await pool.end();
            return { pruned: deleteResult.rowCount };
        }

        await pool.end();
        return { pruned: 0, reason: 'none-deprecated' };
    } catch (err) {
        console.log(`   ⚠ pgvector pruning failed: ${err.message}`);
        return { pruned: 0, error: err.message };
    }
}

// ── Phase 3: Stale Data File Cleanup ───────────────────────────
function pruneStaleDataFiles() {
    console.log('\n📁 [Phase 3] Stale Data File Cleanup');

    const stalePatterns = [
        'projection-state.json',
        'race-audit.jsonl',
        'vector-shards/*.stale',
    ];

    const staleFiles = [];
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    if (fs.existsSync(DATA_DIR)) {
        for (const entry of fs.readdirSync(DATA_DIR, { withFileTypes: true })) {
            if (entry.isFile()) {
                const fullPath = path.join(DATA_DIR, entry.name);
                const stat = fs.statSync(fullPath);
                const age = now - stat.mtimeMs;

                if (age > maxAgeMs && entry.name.endsWith('.stale')) {
                    staleFiles.push({ path: fullPath, ageMs: age });
                }
            }
        }
    }

    console.log(`   Found ${staleFiles.length} stale data files (>7 days, .stale)`);

    if (DRY_RUN) {
        staleFiles.forEach(f => console.log(`     [DRY] Would delete: ${path.basename(f.path)}`));
        return { deleted: 0, wouldDelete: staleFiles.length, dryRun: true };
    }

    for (const f of staleFiles) {
        fs.unlinkSync(f.path);
    }
    if (staleFiles.length > 0) {
        console.log(`   ✓ ${staleFiles.length} stale files eliminated`);
    }
    return { deleted: staleFiles.length };
}

// ── Phase 4: Edge Cache Invalidation ───────────────────────────
async function invalidateEdgeCache() {
    console.log('\n🌐 [Phase 4] Edge Cache Invalidation');

    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    const cfZone = process.env.CLOUDFLARE_ZONE_ID;

    if (!cfToken || !cfZone) {
        console.log('   ⚠ No Cloudflare credentials — skipping cache invalidation');
        return { invalidated: false, reason: 'no-credentials' };
    }

    if (DRY_RUN) {
        console.log(`   [DRY] Would purge all cache for zone ${cfZone}`);
        return { invalidated: false, dryRun: true };
    }

    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZone}/purge_cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ purge_everything: true }),
        });
        const data = await response.json();
        console.log(`   ✓ Cache purge: ${data.success ? 'SUCCESS' : 'FAILED'}`);
        return { invalidated: data.success };
    } catch (err) {
        console.log(`   ⚠ Cache invalidation failed: ${err.message}`);
        return { invalidated: false, error: err.message };
    }
}

// ── Main Execution ─────────────────────────────────────────────
async function executeEradicationProtocol() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  HEADY™ ERADICATION PROTOCOL' + (DRY_RUN ? ' [DRY RUN]' : ''));
    console.log('  Sterilizing system for fresh projection...');
    console.log('═══════════════════════════════════════════════════');

    const results = {};
    results.workspace = obliterateWorkspace();
    results.memory = await pruneLatentMemory();
    results.dataFiles = pruneStaleDataFiles();
    results.edgeCache = await invalidateEdgeCache();
    results.ts = new Date().toISOString();
    results.dryRun = DRY_RUN;

    console.log('\n═══════════════════════════════════════════════════');
    if (DRY_RUN) {
        console.log('  SYSTEM SCAN COMPLETE [DRY RUN — no changes made]');
    } else {
        console.log('  SYSTEM STERILIZED. READY FOR FRESH PROJECTION.');

        // Emit event for downstream consumers
        try {
            if (global.eventBus) {
                global.eventBus.emit('projections:eradication-complete', results);
            }
        } catch { }
    }
    console.log('═══════════════════════════════════════════════════\n');

    return results;
}

// Run directly if invoked as script
if (require.main === module) {
    executeEradicationProtocol()
        .then(r => { if (DRY_RUN) process.exit(0); else process.exit(0); })
        .catch(err => { console.error('Eradication failed:', err); process.exit(1); });
}

module.exports = { executeEradicationProtocol };
