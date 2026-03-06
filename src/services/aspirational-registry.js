/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Aspirational Task Registry — Unified Mission Manifest ═══
 *
 * Consolidates ALL 13 task definition files and 4 roadmap documents
 * into a single runtime service. No more scattered JSON/JS files —
 * every aspirational task, roadmap item, and strategic priority is
 * embedded in this registry for swarm assignment and tracking.
 *
 * Sources integrated:
 *   1. optimal-master-task-matrix.json    (Security, HeadyScientist, HeadyVinci, HeadyMaid, QA)
 *   2. headyos-tasks.json                (23 HeadyOS tasks)
 *   3. trading-tasks.js                  (25 Apex risk + TRM tasks)
 *   4. nonprofit-tasks.json              (46 nonprofit tasks)
 *   5. auto-flow-tasks.json              (auto-flow pipeline tasks)
 *   6. auto-flow-200-tasks.json          (200-task auto-flow batch)
 *   7. buddy-tasks.json                  (HeadyBuddy conversational tasks)
 *   8. long814-tasks.json                (long-horizon 814 tasks)
 *   9. architecture-tasks.js             (architectural refactoring tasks)
 *  10. config-buildout-tasks.js          (config consolidation tasks)
 *  11. decomposition-tasks.js            (monolith decomposition tasks)
 *  12. orchestration-protocol-tasks.json (orchestration patterns)
 *  13. phase5-hardening-tasks.json       (phase 5 security hardening)
 *
 * Roadmaps integrated:
 *   - heady-improvement-roadmap-2026.md
 *   - heady-platform-onboarding-roadmap.md
 *   - heady-platform-transition-roadmap.md
 *   - tool-to-platform-roadmap.md
 *
 * Swarm assignment: Each task is mapped to the swarm responsible
 * for executing it based on category → swarm affinity.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger').child('aspirational-registry');

const ROOT = path.resolve(__dirname, '..');

// ── Category → Swarm mapping ──────────────────────────────────
const CATEGORY_SWARM_MAP = {
    // Core OS / Infrastructure
    'infrastructure': 'Core OS',
    'maintenance': 'Core OS',

    // Engineering / Forge
    'engineering': 'The Forge',
    'architecture': 'The Forge',
    'config': 'The Forge',
    'decomposition': 'The Forge',
    'optimization': 'The Forge',

    // Finance / Quant
    'trading': 'The Quant',
    'finance': 'The Quant',

    // Creative / Studio
    'creative': 'The Studio',

    // Observability / Oracle
    'observability': 'The Oracle',
    'monitoring': 'The Oracle',

    // Integration / Emissary
    'integration': 'The Emissary',
    'hive-integration': 'The Emissary',

    // Security / Sentinel
    'security': 'The Sentinel',

    // Compliance / Arbiter
    'governance': 'The Arbiter',
    'compliance': 'The Arbiter',

    // ML / Foundry
    'ml-training': 'The Foundry',

    // Marketing / Growth Matrix
    'marketing': 'The Growth Matrix',

    // Web3 / Nexus
    'web3': 'The Nexus',

    // Simulation / Dreamer
    'simulation': 'The Dreamer',

    // IoT / Fabricator
    'iot': 'The Fabricator',

    // Enterprise / Diplomat
    'enterprise': 'The Diplomat',

    // Bio-sync / Persona
    'bio-sync': 'The Persona',

    // Deep Intel / advanced
    'deep-intel': 'The Forge',

    // Research
    'research': 'The Emissary',

    // Learning
    'learning': 'The Foundry',

    // Uncategorized
    'uncategorized': 'Core OS',
};

// ── State ──────────────────────────────────────────────────────
let _registry = [];
let _booted = false;
let _sourceFiles = [];

/**
 * Safely load a JSON or JS task file.
 */
function loadTaskFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        // Clear require cache to get fresh data
        delete require.cache[require.resolve(filePath)];
        const data = require(filePath);

        if (data.optimal_master_task_matrix) {
            // Master matrix format — flatten all categories
            const tasks = [];
            for (const [category, items] of Object.entries(data.optimal_master_task_matrix)) {
                for (const item of items) {
                    tasks.push({
                        ...item,
                        cat: item.cat || category.toLowerCase(),
                        _sourceCategory: category,
                    });
                }
            }
            return tasks;
        }

        if (Array.isArray(data)) return data;
        if (typeof data === 'object') return Object.values(data).flat();
        return null;
    } catch (err) {
        logger.warn(`Failed to load ${path.basename(filePath)}: ${err.message}`);
        return null;
    }
}

/**
 * Boot the registry — load all task files and unify.
 */
function boot() {
    if (_booted) return;

    const taskFiles = [
        'optimal-master-task-matrix.json',
        'headyos-tasks.json',
        'trading-tasks.js',
        'nonprofit-tasks.json',
        'auto-flow-tasks.json',
        'auto-flow-200-tasks.json',
        'buddy-tasks.json',
        'long814-tasks.json',
        'architecture-tasks.js',
        'config-buildout-tasks.js',
        'decomposition-tasks.js',
        'orchestration-protocol-tasks.json',
        'phase5-hardening-tasks.json',
    ];

    const seenIds = new Set();

    for (const file of taskFiles) {
        const filePath = path.resolve(ROOT, file);
        const tasks = loadTaskFile(filePath);
        if (!tasks) continue;

        let addedCount = 0;
        for (const task of tasks) {
            const id = task.id || `auto-${crypto.randomUUID().slice(0, 8)}`;

            // Deduplicate
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const category = (task.cat || 'uncategorized').toLowerCase();
            const swarm = CATEGORY_SWARM_MAP[category] || 'Core OS';

            _registry.push({
                id,
                name: task.name || task.task || id,
                description: task.desc || task.task || '',
                category,
                pool: task.pool || 'warm',
                weight: task.w || task.weight || task.priority_num || 3,
                state: task.state || 'QUEUED',
                priority: task.priority || 'MEDIUM',
                source: task.source || file,
                sourceFile: file,
                swarm,
                templateRef: task.template_ref || null,
                createdAt: new Date().toISOString(),
            });
            addedCount++;
        }

        _sourceFiles.push({ file, loaded: addedCount, total: tasks.length });
    }

    // Add roadmap strategic items as tasks
    const roadmapItems = [
        { id: 'ROAD-001', name: 'VSA State Machine (torchhd GPU)', cat: 'architecture', priority: 'HIGH', pool: 'warm', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-002', name: 'BFG Repo Cleaner — Git history scrub', cat: 'security', priority: 'CRITICAL', pool: 'hot', w: 10, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-003', name: 'GitHub Advanced Security secret scanning', cat: 'security', priority: 'HIGH', pool: 'hot', w: 9, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-004', name: 'Semgrep SAST in pull requests', cat: 'security', priority: 'HIGH', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-005', name: 'Saga/Workflow Compensation pattern', cat: 'architecture', priority: 'HIGH', pool: 'warm', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-006', name: 'Circuit Breaker (Netflix Hystrix)', cat: 'infrastructure', priority: 'MEDIUM', pool: 'warm', w: 6, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-007', name: 'Bulkhead Isolation', cat: 'infrastructure', priority: 'MEDIUM', pool: 'warm', w: 6, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-008', name: 'Event Sourcing pattern', cat: 'architecture', priority: 'MEDIUM', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-009', name: 'CQRS implementation', cat: 'architecture', priority: 'MEDIUM', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-010', name: 'Redis connection pooling', cat: 'infrastructure', priority: 'HIGH', pool: 'hot', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-011', name: 'Geometric Visualizer UI for investors', cat: 'creative', priority: 'HIGH', pool: 'hot', w: 9, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-012', name: 'Self-Healing Nodes Beta', cat: 'infrastructure', priority: 'HIGH', pool: 'hot', w: 9, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-013', name: 'Sacred Geometry v2.5 Dynamic Weighting', cat: 'creative', priority: 'MEDIUM', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-014', name: 'heady doctor CLI diagnostic tool', cat: 'maintenance', priority: 'HIGH', pool: 'hot', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-015', name: 'Orion Attestation Patent', cat: 'governance', priority: 'HIGH', pool: 'warm', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-016', name: 'Decentralized Governance module', cat: 'governance', priority: 'MEDIUM', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-017', name: 'Global Node Network — 142 countries', cat: 'enterprise', priority: 'LOW', pool: 'cold', w: 5, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-018', name: 'SDK quickstart packages', cat: 'integration', priority: 'HIGH', pool: 'warm', w: 8, source: 'heady-improvement-roadmap-2026.md' },
        { id: 'ROAD-019', name: 'Autonomous Projection Operations (scheduled diffs)', cat: 'infrastructure', priority: 'MEDIUM', pool: 'warm', w: 7, source: 'heady-improvement-roadmap-2026.md' },
    ];

    for (const item of roadmapItems) {
        if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            const category = (item.cat || 'uncategorized').toLowerCase();
            _registry.push({
                ...item,
                category,
                swarm: CATEGORY_SWARM_MAP[category] || 'Core OS',
                state: 'ROADMAP',
                sourceFile: 'roadmap-2026',
                createdAt: new Date().toISOString(),
            });
        }
    }

    _booted = true;
    logger.info(`Aspirational Registry booted: ${_registry.length} tasks from ${_sourceFiles.length + 1} sources`);
}

// ── Query Methods ──────────────────────────────────────────────

function getAllTasks() { return _registry; }

function getBySwarm(swarmName) {
    return _registry.filter(t => t.swarm === swarmName);
}

function getByCategory(cat) {
    return _registry.filter(t => t.category === cat.toLowerCase());
}

function getByPool(pool) {
    return _registry.filter(t => t.pool === pool);
}

function getByPriority(priority) {
    return _registry.filter(t => (t.priority || '').toUpperCase() === priority.toUpperCase());
}

function getById(id) {
    return _registry.find(t => t.id === id);
}

function search(query) {
    const q = query.toLowerCase();
    return _registry.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.id || '').toLowerCase().includes(q)
    );
}

function getStats() {
    const categories = {};
    const swarms = {};
    const pools = { hot: 0, warm: 0, cold: 0 };
    const priorities = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const t of _registry) {
        categories[t.category] = (categories[t.category] || 0) + 1;
        swarms[t.swarm] = (swarms[t.swarm] || 0) + 1;
        if (pools[t.pool] !== undefined) pools[t.pool]++;
        const p = (t.priority || 'MEDIUM').toUpperCase();
        if (priorities[p] !== undefined) priorities[p]++;
    }

    return {
        totalTasks: _registry.length,
        sourceFiles: _sourceFiles.length + 1, // +1 for roadmap
        categories,
        swarmDistribution: swarms,
        pools,
        priorities,
    };
}

// ── Express Routes ─────────────────────────────────────────────

function aspirationalRoutes(app) {
    app.get('/api/aspirational/stats', (_req, res) => {
        res.json({ ok: true, ...getStats() });
    });

    app.get('/api/aspirational/tasks', (req, res) => {
        const { swarm, category, pool, priority, q } = req.query;
        let results = _registry;
        if (swarm) results = results.filter(t => t.swarm === swarm);
        if (category) results = results.filter(t => t.category === category);
        if (pool) results = results.filter(t => t.pool === pool);
        if (priority) results = results.filter(t => (t.priority || '').toUpperCase() === priority.toUpperCase());
        if (q) results = results.filter(t =>
            (t.name || '').toLowerCase().includes(q.toLowerCase()) ||
            (t.description || '').toLowerCase().includes(q.toLowerCase())
        );
        res.json({ ok: true, count: results.length, tasks: results });
    });

    app.get('/api/aspirational/task/:id', (req, res) => {
        const task = getById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    });

    app.get('/api/aspirational/swarm/:name', (req, res) => {
        const tasks = getBySwarm(req.params.name);
        res.json({ ok: true, swarm: req.params.name, count: tasks.length, tasks });
    });

    // Export full registry for Colab Overmind injection
    app.get('/api/aspirational/matrix', (_req, res) => {
        res.json({
            ok: true,
            version: '3.0.0-OMEGA',
            generated: new Date().toISOString(),
            ...getStats(),
            registry: _registry,
        });
    });

    logger.info('Aspirational Task Registry routes at /api/aspirational/*');
}

module.exports = {
    boot,
    getAllTasks,
    getBySwarm,
    getByCategory,
    getByPool,
    getByPriority,
    getById,
    search,
    getStats,
    aspirationalRoutes,
};
