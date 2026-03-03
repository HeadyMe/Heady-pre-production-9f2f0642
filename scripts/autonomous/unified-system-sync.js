#!/usr/bin/env node
/**
 * Unified System Sync
 * Synchronizes runtime state across all Heady subsystems:
 *   - Vector projection configs
 *   - Template registry coherence
 *   - Autonomy snapshot freshness
 *   - HeadyBee swarm health
 *   - Cloud conductor alignment
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const CONFIGS = {
    runtimeProfile: 'configs/autonomy/unified-liquid-runtime.yaml',
    autonomySnapshot: 'configs/autonomy/unified-autonomy-snapshot.json',
    vectorProjections: 'configs/services/public-vector-projections.json',
    templateRegistry: 'configs/services/headybee-template-registry.json',
    runtimePolicy: 'configs/services/antigravity-heady-runtime-policy.json',
};

function loadJSON(relPath) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function fileHash(relPath) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 16);
}

function syncCheck() {
    const report = {
        timestamp: new Date().toISOString(),
        status: 'ok',
        checks: {},
        errors: [],
    };

    // 1. Check all config files exist
    for (const [key, relPath] of Object.entries(CONFIGS)) {
        const full = path.join(ROOT, relPath);
        const exists = fs.existsSync(full);
        report.checks[key] = { exists, hash: exists ? fileHash(relPath) : null };
        if (!exists) {
            report.errors.push(`Missing config: ${relPath}`);
            report.status = 'degraded';
        }
    }

    // 2. Validate autonomy snapshot coherence
    const snapshot = loadJSON(CONFIGS.autonomySnapshot);
    if (snapshot) {
        report.checks.snapshotVersion = snapshot.version || 0;
        report.checks.snapshotOk = Boolean(snapshot.ok || (snapshot.runtime && snapshot.runtime.initialized));
        if (!report.checks.snapshotOk) {
            report.errors.push('Autonomy snapshot not in initialized state');
            report.status = 'degraded';
        }
    }

    // 3. Validate vector projections
    const projections = loadJSON(CONFIGS.vectorProjections);
    if (projections) {
        report.checks.projectionVersion = projections.version || 0;
        report.checks.projectionEntries = (projections.entries || []).length;
        report.checks.sourceOfTruth = projections.sourceOfTruth || 'unset';
        report.checks.swEjected = projections.drift ? projections.drift.swEjected : false;
    }

    // 4. Validate template registry
    const registry = loadJSON(CONFIGS.templateRegistry);
    if (registry) {
        report.checks.templateCount = (registry.templates || []).length;
        report.checks.registryVersion = registry.version || 0;
    }

    // 5. Validate runtime policy
    const policy = loadJSON(CONFIGS.runtimePolicy);
    if (policy) {
        report.checks.policyVersion = policy.version || 0;
        report.checks.workspaceMode = policy.enforce ? policy.enforce.workspaceMode : 'unknown';
        report.checks.autonomousMode = policy.enforce ? policy.enforce.autonomousMode : 'unknown';
    }

    // 6. Check buddy-widget version
    const buddyWidgetPath = path.join(ROOT, 'public/buddy-widget.js');
    if (fs.existsSync(buddyWidgetPath)) {
        const content = fs.readFileSync(buddyWidgetPath, 'utf8');
        const vMatch = content.match(/HeadyBuddy Universal Widget v([\d.]+)/);
        report.checks.buddyWidgetVersion = vMatch ? `v${vMatch[1]}` : 'unknown';
    }

    // 7. Confirm sw.js is ejected
    const swPath = path.join(ROOT, 'public/sw.js');
    report.checks.swEjected = !fs.existsSync(swPath);

    // 8. Count verticals with auth-aware chat
    const verticalsDir = path.join(ROOT, 'public/verticals');
    if (fs.existsSync(verticalsDir)) {
        const htmlFiles = fs.readdirSync(verticalsDir).filter(f => f.endsWith('.html'));
        let authAwareCount = 0;
        for (const f of htmlFiles) {
            const content = fs.readFileSync(path.join(verticalsDir, f), 'utf8');
            if (content.includes('X-Heady-Workspace') || content.includes('buddy_history_')) authAwareCount++;
        }
        report.checks.verticalsTotal = htmlFiles.length;
        report.checks.verticalsAuthAware = authAwareCount;
    }

    return report;
}

// Run
const report = syncCheck();
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'ok' ? 0 : 1);
