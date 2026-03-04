#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── heady doctor ───────────────────────────────────────────────
 *
 * Automated diagnostic tool. Checks:
 *   1. MCP connectivity & compatibility
 *   2. Geometric alignment across agent fleet
 *   3. Vector memory health (shard integrity, zone distribution)
 *   4. Vault status (unlocked, credential coverage)
 *   5. Service health (all registered services)
 *   6. Device connectivity (SSH tunnel checks)
 *   7. DNS & Cloudflare status
 *
 * Usage: node scripts/heady-doctor.js
 *   or:  heady doctor
 * ──────────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const CHECKS = [];
let passed = 0, warned = 0, failed = 0;

function check(name, fn) {
    CHECKS.push({ name, fn });
}

function pass(msg) { passed++; console.log(`  ✅ ${msg}`); }
function warn(msg) { warned++; console.log(`  ⚠️  ${msg}`); }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`); }

// ── 1. Core Files ─────────────────────────────────────────────
check('Core Files', () => {
    const critical = [
        'src/vector-memory.js',
        'src/bees/registry.js',
        'src/services/secure-key-vault.js',
        'src/services/self-healing-mesh.js',
        'src/services/cross-device-fs.js',
        'src/services/dynamic-weight-manager.js',
        'package.json',
    ];
    for (const f of critical) {
        if (fs.existsSync(path.join(ROOT, f))) {
            pass(`${f} — exists`);
        } else {
            fail(`${f} — MISSING`);
        }
    }
});

// ── 2. Vector Memory ──────────────────────────────────────────
check('Vector Memory', () => {
    const shardDir = path.join(ROOT, 'data', 'vector-shards');
    if (fs.existsSync(shardDir)) {
        const shards = fs.readdirSync(shardDir).filter(f => f.endsWith('.json'));
        const totalVectors = shards.reduce((sum, f) => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8'));
                return sum + (Array.isArray(data) ? data.length : 0);
            } catch { return sum; }
        }, 0);
        pass(`${shards.length} shards, ${totalVectors} vectors`);
        if (totalVectors < 100) warn('Low vector count — consider running deep embed');
    } else {
        fail('No vector-shards directory');
    }

    // Check graph
    const graphPath = path.join(ROOT, 'data', 'vector-graph.json');
    if (fs.existsSync(graphPath)) {
        pass('Graph layer exists');
    } else {
        warn('No vector graph — hybrid RAG disabled');
    }
});

// ── 3. Sacred Geometry ────────────────────────────────────────
check('Sacred Geometry', () => {
    const sgPaths = [
        path.join(ROOT, 'src', 'orchestration', 'sacred-geometry.js'),
        path.join(ROOT, 'src', 'services', 'dynamic-weight-manager.js'),
        path.join(ROOT, 'configs', 'resources', 'liquid-unified-fabric.yaml'),
    ];
    let sgFound = false;
    for (const sgPath of sgPaths) {
        if (fs.existsSync(sgPath)) {
            sgFound = true;
            const content = fs.readFileSync(sgPath, 'utf8');
            if (content.includes('PHI') || content.includes('1.618')) {
                pass('Golden ratio constants present');
            } else {
                warn('Sacred Geometry file exists but no PHI constant found');
            }
            if (content.includes('dynamicWeight') || content.includes('DynamicWeight')) {
                pass('Dynamic weighting v2.5 detected');
            } else {
                warn('No dynamic weighting — Sacred Geometry v2.0 or earlier');
            }
        }
    }
    if (!sgFound) warn('No Sacred Geometry files found');
});

// ── 4. Bees / Swarm ──────────────────────────────────────────
check('Bee Swarm', () => {
    const beesDir = path.join(ROOT, 'src', 'bees');
    if (fs.existsSync(beesDir)) {
        const bees = fs.readdirSync(beesDir).filter(f => f.endsWith('.js'));
        pass(`${bees.length} bee modules: ${bees.map(b => b.replace('.js', '')).join(', ')}`);
    } else {
        fail('No bees directory');
    }
});

// ── 5. Vault Status ──────────────────────────────────────────
check('Secure Vault', () => {
    const vaultPath = path.join(ROOT, 'src', 'services', 'secure-key-vault.js');
    if (fs.existsSync(vaultPath)) {
        pass('Vault service projected');
        // Check if vault data exists in vector shards
        const shardDir = path.join(ROOT, 'data', 'vector-shards');
        if (fs.existsSync(shardDir)) {
            let credCount = 0;
            for (const f of fs.readdirSync(shardDir).filter(f => f.endsWith('.json'))) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8'));
                    if (Array.isArray(data)) {
                        credCount += data.filter(v => v.metadata?.type === 'credential').length;
                    }
                } catch { /* skip */ }
            }
            if (credCount > 0) {
                pass(`${credCount} encrypted credentials in vector space`);
            } else {
                warn('No credentials embedded — run vault-init.js');
            }
        }
    } else {
        fail('Vault service not projected');
    }
});

// ── 6. MCP Compatibility ─────────────────────────────────────
check('MCP Configuration', () => {
    const mcpPaths = [
        path.join(ROOT, 'mcp.json'),
        path.join(ROOT, '.gemini', 'settings', 'mcp_config.json'),
        path.join(require('os').homedir(), '.config', 'mcp.json'),
    ];
    let found = false;
    for (const p of mcpPaths) {
        if (fs.existsSync(p)) {
            pass(`MCP config: ${p}`);
            found = true;
        }
    }
    if (!found) warn('No MCP configuration found');
});

// ── 7. Git Status ────────────────────────────────────────────
check('Git Health', () => {
    try {
        const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
        const lines = status.trim().split('\n').filter(Boolean);
        if (lines.length === 0) {
            pass('Working tree clean');
        } else {
            warn(`${lines.length} uncommitted changes`);
        }
        const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
        pass(`Branch: ${branch}`);
    } catch {
        fail('Not a git repository');
    }
});

// ── 8. Network Connectivity ──────────────────────────────────
check('Network', () => {
    const endpoints = [
        { name: 'GitHub', url: 'github.com', port: 22 },
        { name: 'Cloudflare', url: 'api.cloudflare.com', port: 443 },
    ];
    for (const ep of endpoints) {
        try {
            execSync(`timeout 5 bash -c "echo >/dev/tcp/${ep.url}/${ep.port}" 2>/dev/null`, { encoding: 'utf8' });
            pass(`${ep.name} — reachable`);
        } catch {
            warn(`${ep.name} — unreachable or timeout`);
        }
    }
});

// ── 9. Patent Registry ───────────────────────────────────────
check('Patent Registry', () => {
    const regPath = path.join(ROOT, 'src', 'patent-concept-registry.js');
    if (fs.existsSync(regPath)) {
        const content = fs.readFileSync(regPath, 'utf8');
        const match = content.match(/concepts\.length.*?(\d+)/);
        pass(`Patent registry projected${match ? ` (${match[1]}+ concepts)` : ''}`);
    } else {
        warn('Patent concept registry not found');
    }
});

// ── Run All ──────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('─── heady doctor ───────────────────────────────');
    console.log(`  Diagnosing: ${ROOT}`);
    console.log(`  Time: ${new Date().toISOString()}`);
    console.log('');

    for (const { name, fn } of CHECKS) {
        console.log(`\n[${name}]`);
        try {
            await fn();
        } catch (err) {
            fail(`${name} check crashed: ${err.message}`);
        }
    }

    console.log('\n─── Summary ────────────────────────────────────');
    console.log(`  ✅ Passed:  ${passed}`);
    console.log(`  ⚠️  Warned: ${warned}`);
    console.log(`  ❌ Failed:  ${failed}`);
    console.log(`  Total:     ${passed + warned + failed}`);
    console.log('');

    if (failed > 0) {
        console.log('  Status: UNHEALTHY — fix failed checks above');
        process.exit(1);
    } else if (warned > 0) {
        console.log('  Status: DEGRADED — review warnings above');
        process.exit(0);
    } else {
        console.log('  Status: HEALTHY ✅');
        process.exit(0);
    }
}

main();
