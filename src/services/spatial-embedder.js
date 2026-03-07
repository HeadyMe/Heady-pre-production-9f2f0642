'use strict';
/**
 * Spatial Embedder Service
 * ════════════════════════════════════════════════════════════
 * Converts raw text / code into 3D spatial coordinates (X, Y, Z)
 * without relying on external embedding APIs.
 *
 * Axes:
 *   X — Semantic domain: deep-infra (-1) ↔ UI presentation (+1)
 *   Y — Temporal state:  foundational (0) ↔ realtime (1)
 *   Z — Structural hierarchy: literal code (0) ↔ abstract architecture (1)
 *
 * Deterministic receipts via SHA-256 for every mapping.
 * ════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('../core/heady-yaml');

// ── Config ──────────────────────────────────────────────────
const CONFIG_PATH = path.resolve(__dirname, '../../configs/services/buddy-system-config.yaml');
let _config = null;

function getConfig() {
    if (!_config) {
        try {
            _config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
        } catch {
            _config = {
                axes: {
                    x: { range: [-1, 1] },
                    y: { range: [0, 1] },
                    z: { range: [0, 1] },
                },
            };
        }
    }
    return _config;
}

// ── Deterministic Receipt ───────────────────────────────────
function stableStringify(obj) {
    if (obj === null || obj === undefined) return String(obj);
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function deterministicReceipt(data) {
    return crypto.createHash('sha256').update(stableStringify(data)).digest('hex');
}

// ── Domain Keywords (X-axis classification) ─────────────────
const DOMAIN_KEYWORDS = {
    deepInfra: {
        score: -1.0,
        terms: ['dockerfile', 'ci/cd', 'github-actions', 'deploy', 'terraform', 'helm', 'k8s', 'kubernetes', 'nginx', 'cloudflare', 'render.yaml', 'migration', 'pnpm-lock', 'package-lock'],
    },
    backend: {
        score: -0.5,
        terms: ['express', 'router', 'middleware', 'endpoint', 'api/', 'server', 'heady-manager', 'database', 'postgresql', 'redis', 'queue', 'worker', 'cron', 'socket'],
    },
    shared: {
        score: 0.0,
        terms: ['auth', 'logger', 'config', 'util', 'helper', 'common', 'constants', 'types', 'schema', 'validator', 'crypto'],
    },
    frontend: {
        score: 0.5,
        terms: ['react', 'component', 'hook', 'useState', 'useEffect', 'vite', 'jsx', 'tsx', 'client', 'browser', 'dom', 'route', 'navigation'],
    },
    ui: {
        score: 1.0,
        terms: ['css', 'style', 'theme', 'icon', 'svg', 'font', 'animation', 'landing', 'layout', 'responsive', 'glassmorphism', 'gradient'],
    },
};

// ── Abstraction Keywords (Z-axis classification) ────────────
const ABSTRACTION_KEYWORDS = {
    literal: {
        score: 0.0,
        terms: ['error', 'throw', 'catch', 'return', 'if (', 'for (', 'while', 'switch', 'case', 'const ', 'let ', 'var ', '= require(', 'import '],
    },
    modular: {
        score: 0.5,
        terms: ['function', 'class', 'module.exports', 'export default', 'async function', 'prototype', 'constructor', 'interface', 'registerRoutes', 'app.get', 'app.post'],
    },
    architectural: {
        score: 1.0,
        terms: ['architecture', 'pipeline', 'orchestrat', 'topology', 'framework', 'sacred geometry', 'hcfullpipeline', 'system design', 'roadmap', 'blueprint', 'strategy', 'governance'],
    },
};

// ── Scoring Functions ───────────────────────────────────────

/**
 * Score text against a keyword dictionary.
 * Returns weighted average of matched categories.
 */
function scoreByKeywords(text, keywordMap) {
    const lower = text.toLowerCase();
    let totalWeight = 0;
    let totalScore = 0;

    for (const [, spec] of Object.entries(keywordMap)) {
        let matches = 0;
        for (const term of spec.terms) {
            const idx = lower.indexOf(term.toLowerCase());
            if (idx !== -1) matches++;
        }
        if (matches > 0) {
            totalWeight += matches;
            totalScore += spec.score * matches;
        }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Score temporal state from file metadata + content signals.
 * @param {object} meta - { mtime, birthtime, isRealtime }
 * @param {string} text
 * @returns {number} 0..1
 */
function scoreTemporalState(text, meta = {}) {
    let score = 0.5; // default: stable

    // File age signals
    if (meta.mtime) {
        const ageMs = Date.now() - new Date(meta.mtime).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays < 1) score = 0.95;
        else if (ageDays < 7) score = 0.8;
        else if (ageDays < 30) score = 0.6;
        else if (ageDays < 180) score = 0.4;
        else score = 0.15;
    }

    // Content signals override
    const lower = text.toLowerCase();
    if (lower.includes('deprecated') || lower.includes('legacy') || lower.includes('archived')) {
        score = Math.min(score, 0.1);
    }
    if (lower.includes('todo') || lower.includes('fixme') || lower.includes('wip')) {
        score = Math.max(score, 0.85);
    }
    if (meta.isRealtime) score = 1.0;

    return Math.max(0, Math.min(1, score));
}

/**
 * Score structural hierarchy (abstraction level).
 */
function scoreAbstraction(text) {
    return (scoreByKeywords(text, ABSTRACTION_KEYWORDS) + 1) / 2; // normalize to 0..1
    // Note: ABSTRACTION_KEYWORDS scores are 0..1 already, so we just use raw
}

/**
 * Compute 3D spatial coordinates for a text payload.
 * @param {string} text - raw content
 * @param {object} [meta] - optional { filePath, mtime, birthtime, isRealtime }
 * @returns {{ x: number, y: number, z: number, receipt: string }}
 */
function embed(text, meta = {}) {
    const x = clamp(scoreByKeywords(text, DOMAIN_KEYWORDS), -1, 1);
    const y = clamp(scoreTemporalState(text, meta), 0, 1);
    const z = clamp(scoreByKeywords(text, ABSTRACTION_KEYWORDS), 0, 1);

    // Apply file-path heuristics for X-axis refinement
    let xRefined = x;
    if (meta.filePath) {
        const fp = meta.filePath.toLowerCase();
        if (fp.includes('dockerfile') || fp.includes('.github/') || fp.includes('deploy')) xRefined = clamp(x - 0.3, -1, 1);
        if (fp.includes('src/services/') || fp.includes('server/')) xRefined = clamp(x - 0.15, -1, 1);
        if (fp.includes('src/components/') || fp.includes('client/')) xRefined = clamp(x + 0.15, -1, 1);
        if (fp.includes('.css') || fp.includes('public/') || fp.includes('assets/')) xRefined = clamp(x + 0.3, -1, 1);
        if (fp.includes('configs/') || fp.includes('config/')) xRefined = clamp(x, -0.2, 0.2);
        if (fp.includes('docs/') || fp.includes('.md')) xRefined = clamp(x + 0.1, -1, 1);
    }

    const coords = {
        x: round4(xRefined),
        y: round4(y),
        z: round4(z),
    };

    const receipt = deterministicReceipt({ text: text.slice(0, 500), coords, filePath: meta.filePath || '' });

    return { ...coords, receipt };
}

/**
 * Batch embed multiple payloads.
 * @param {Array<{ text: string, meta?: object }>} items
 * @returns {Array<{ x, y, z, receipt }>}
 */
function batchEmbed(items) {
    return items.map(item => embed(item.text, item.meta || {}));
}

// ── Utilities ───────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round4(v) { return Math.round(v * 10000) / 10000; }

// ── Express Route Registration ──────────────────────────────
function registerRoutes(app) {
    const prefix = '/api/spatial-embedder';

    app.get(`${prefix}/health`, (_req, res) => {
        res.json({ status: 'ok', service: 'spatial-embedder', axes: ['x:semantic-domain', 'y:temporal-state', 'z:structural-hierarchy'] });
    });

    app.post(`${prefix}/embed`, (req, res) => {
        try {
            const { text, meta } = req.body || {};
            if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text (string) required' });
            const result = embed(text, meta || {});
            res.json({ ok: true, coordinates: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/batch`, (req, res) => {
        try {
            const { items } = req.body || {};
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items (array) required' });
            const results = batchEmbed(items);
            res.json({ ok: true, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = {
    embed,
    batchEmbed,
    scoreByKeywords,
    scoreTemporalState,
    scoreAbstraction,
    deterministicReceipt,
    getConfig,
    registerRoutes,
    DOMAIN_KEYWORDS,
    ABSTRACTION_KEYWORDS,
};
