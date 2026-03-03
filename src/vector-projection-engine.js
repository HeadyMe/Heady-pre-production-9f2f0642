/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Vector Space Projection Engine ────────────────────────
 *
 * CORE PRINCIPLE: Everything in Heady operates in 3D vector space.
 * External systems (GitHub, HF Spaces, Cloud Run, Cloudflare) are
 * PROJECTIONS from this space — outbound representations of the
 * system's internal state.
 *
 * Projection Chain:
 *   Vector Space (source of truth)
 *     → GitHub monorepo (first projection — code + config)
 *     → Cloud Run (compute projection)
 *     → HF Spaces (frontend projection)
 *     → Cloudflare Edge (network projection)
 *     → Render (resilience projection)
 *
 * The Projection Engine manages:
 *   1. Secret hydration from vector vault → process.env
 *   2. Projection state tracking (what's projected where)
 *   3. Staleness detection (is a projection out of date?)
 *   4. Autonomous projection triggers
 *   5. Projection health monitoring
 *
 * Each projection target has a 3D coordinate in vector space,
 * deterministically assigned from its name. This means you can
 * QUERY vector space for "where is the HF Spaces projection?"
 * and get its spatial coordinates.
 * ──────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const PHI = 1.6180339887;
const DATA_DIR = path.join(__dirname, '..', 'data');
const PROJECTION_STATE_PATH = path.join(DATA_DIR, 'projection-state.json');

// ── Projection Targets ──────────────────────────────────────────
const PROJECTION_TARGETS = [
    {
        id: 'github',
        name: 'GitHub Monorepo',
        type: 'code-projection',
        url: 'https://github.com/HeadyMe/Heady-pre-production',
        tier: 1, // First projection from vector space
        autonomous: true,
    },
    {
        id: 'cloudrun',
        name: 'Cloud Run Compute',
        type: 'compute-projection',
        url: 'https://manager.headysystems.com',
        healthEndpoint: '/api/health',
        tier: 2,
        autonomous: true,
    },
    {
        id: 'hf-main',
        name: 'HF Space — HeadyAI',
        type: 'frontend-projection',
        url: 'https://huggingface.co/spaces/HeadyMe/heady-ai',
        org: 'HeadyMe',
        repo: 'heady-ai',
        tier: 2,
        autonomous: true,
    },
    {
        id: 'hf-systems',
        name: 'HF Space — HeadySystems',
        type: 'frontend-projection',
        url: 'https://huggingface.co/spaces/HeadySystems/heady-systems',
        org: 'HeadySystems',
        repo: 'heady-systems',
        tier: 2,
        autonomous: true,
    },
    {
        id: 'hf-connection',
        name: 'HF Space — HeadyConnection',
        type: 'frontend-projection',
        url: 'https://huggingface.co/spaces/HeadyConnection/heady-connection',
        org: 'HeadyConnection',
        repo: 'heady-connection',
        tier: 2,
        autonomous: true,
    },
    {
        id: 'cloudflare-edge',
        name: 'Cloudflare Edge Proxy',
        type: 'network-projection',
        url: 'https://api.headysystems.com',
        tier: 2,
        autonomous: true,
    },
    {
        id: 'render',
        name: 'Render Backup',
        type: 'resilience-projection',
        url: 'https://heady-manager.onrender.com',
        tier: 3,
        autonomous: true,
    },
];

// ── Deterministic 3D Positioning for Projections ────────────────
function targetTo3D(targetId) {
    const hash = crypto.createHash('sha256').update(`projection:${targetId}`).digest();
    const x = (hash.readUInt32BE(0) / 0xFFFFFFFF) * 2 - 1;
    const y = (hash.readUInt32BE(4) / 0xFFFFFFFF) * 2 - 1;
    const z = (hash.readUInt32BE(8) / 0xFFFFFFFF) * 2 - 1;
    return { x: +x.toFixed(6), y: +y.toFixed(6), z: +z.toFixed(6) };
}

function assignZone(x, y, z) {
    return (x >= 0 ? 1 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 4 : 0);
}

// ── Projection State ────────────────────────────────────────────
let projectionState = {
    lastGlobalProjection: null,
    targets: {},
};

function loadState() {
    try {
        if (fs.existsSync(PROJECTION_STATE_PATH)) {
            projectionState = JSON.parse(fs.readFileSync(PROJECTION_STATE_PATH, 'utf8'));
        }
    } catch { /* fresh start */ }

    // Ensure all targets are registered
    for (const target of PROJECTION_TARGETS) {
        if (!projectionState.targets[target.id]) {
            const pos = targetTo3D(target.id);
            projectionState.targets[target.id] = {
                ...target,
                _3d: pos,
                _zone: assignZone(pos.x, pos.y, pos.z),
                lastProjected: null,
                lastHealth: null,
                status: 'unknown',
                projectionCount: 0,
            };
        }
    }
}

function saveState() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(PROJECTION_STATE_PATH, JSON.stringify(projectionState, null, 2));
    } catch { /* best effort */ }
}

// ── Health Probes ───────────────────────────────────────────────
async function probeProjection(targetId) {
    const target = projectionState.targets[targetId];
    if (!target) return { ok: false, error: 'unknown target' };

    const url = target.healthEndpoint
        ? `${target.url}${target.healthEndpoint}`
        : target.url;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const status = res.status;
        target.lastHealth = { ts: Date.now(), status, ok: status >= 200 && status < 400 };
        target.status = target.lastHealth.ok ? 'healthy' : 'degraded';
        saveState();
        return target.lastHealth;
    } catch (e) {
        target.lastHealth = { ts: Date.now(), ok: false, error: e.message };
        target.status = 'unreachable';
        saveState();
        return target.lastHealth;
    }
}

async function probeAll() {
    const results = {};
    for (const target of PROJECTION_TARGETS) {
        results[target.id] = await probeProjection(target.id);
    }
    return results;
}

// ── Staleness Detection ─────────────────────────────────────────
function isStale(targetId, maxAgeMs = 24 * 60 * 60 * 1000) {
    const target = projectionState.targets[targetId];
    if (!target || !target.lastProjected) return true;
    return (Date.now() - target.lastProjected) > maxAgeMs;
}

function getStaleProjections(maxAgeMs = 24 * 60 * 60 * 1000) {
    return PROJECTION_TARGETS
        .filter(t => isStale(t.id, maxAgeMs))
        .map(t => ({
            id: t.id,
            name: t.name,
            lastProjected: projectionState.targets[t.id]?.lastProjected,
            age: projectionState.targets[t.id]?.lastProjected
                ? Date.now() - projectionState.targets[t.id].lastProjected
                : null,
        }));
}

// ── Mark Projection Complete ────────────────────────────────────
function markProjected(targetId, commitHash = null) {
    const target = projectionState.targets[targetId];
    if (!target) return false;
    target.lastProjected = Date.now();
    target.lastCommit = commitHash;
    target.projectionCount = (target.projectionCount || 0) + 1;
    target.status = 'projected';
    projectionState.lastGlobalProjection = Date.now();
    saveState();
    return true;
}

// ── Stats & Visualization ───────────────────────────────────────
function getProjectionMap() {
    loadState();
    const map = {
        architecture: '3d-vector-projection-engine',
        principle: 'Everything is a projection from 3D vector space',
        totalTargets: PROJECTION_TARGETS.length,
        lastGlobalProjection: projectionState.lastGlobalProjection,
        tiers: {
            1: 'Vector Space → Code (GitHub)',
            2: 'Code → Compute/Frontend/Network (Cloud Run, HF, Edge)',
            3: 'Code → Resilience (Render backup)',
        },
        targets: {},
    };

    for (const target of PROJECTION_TARGETS) {
        const state = projectionState.targets[target.id] || {};
        map.targets[target.id] = {
            name: target.name,
            type: target.type,
            url: target.url,
            tier: target.tier,
            _3d: state._3d,
            _zone: state._zone,
            status: state.status || 'unknown',
            lastProjected: state.lastProjected,
            projectionCount: state.projectionCount || 0,
            stale: isStale(target.id),
            autonomous: target.autonomous,
        };
    }

    return map;
}

// ── API Route Registration ──────────────────────────────────────
function registerRoutes(app) {
    app.get('/api/projections', (req, res) => {
        res.json(getProjectionMap());
    });

    app.get('/api/projections/stale', (req, res) => {
        const maxAge = parseInt(req.query.maxAge) || 24 * 60 * 60 * 1000;
        res.json({ ok: true, stale: getStaleProjections(maxAge) });
    });

    app.post('/api/projections/probe', async (req, res) => {
        const { target } = req.body;
        if (target) {
            const result = await probeProjection(target);
            return res.json({ ok: true, target, result });
        }
        const results = await probeAll();
        res.json({ ok: true, results });
    });

    app.post('/api/projections/mark', (req, res) => {
        const { target, commitHash } = req.body;
        if (!target) return res.status(400).json({ error: 'target required' });
        markProjected(target, commitHash);
        res.json({ ok: true, target, marked: true });
    });
}

// ── Init ────────────────────────────────────────────────────────
function init() {
    loadState();
    logger.logSystem(`  🌐 ProjectionEngine: ${PROJECTION_TARGETS.length} targets across ${new Set(PROJECTION_TARGETS.map(t => t.tier)).size} tiers`);
    const stale = getStaleProjections();
    if (stale.length > 0) {
        logger.logSystem(`  🌐 ProjectionEngine: ${stale.length} stale projections detected`);
    }
}

module.exports = {
    init,
    getProjectionMap,
    probeProjection,
    probeAll,
    isStale,
    getStaleProjections,
    markProjected,
    registerRoutes,
    PROJECTION_TARGETS,
};
