/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Swarm Matrix Service — 18-Swarm Civilization Runtime ═══
 *
 * Loads HeadySwarmMatrix.json (the Master Matrix) and provides:
 *   - Runtime bee/swarm lookup for Colab Overmind
 *   - Status tracking (ACTIVE / STANDBY / SLEEPER)
 *   - Swarm ignition triggers
 *   - Full matrix projection for external liquid nodes
 *
 * This is the single service that knows the entire bee civilization.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').child('swarm-matrix');

const MATRIX_PATH = path.resolve(__dirname, '..', '..', 'configs', 'HeadySwarmMatrix.json');

// ── Runtime state ──────────────────────────────────────────────
let _matrix = null;
let _runtimeState = new Map();  // beeClass → runtime overrides
let _bootTimestamp = null;

/**
 * Boot the swarm matrix — load and validate the Master Matrix.
 */
function boot() {
    try {
        const raw = fs.readFileSync(MATRIX_PATH, 'utf8');
        _matrix = JSON.parse(raw);
        _bootTimestamp = new Date().toISOString();

        // Initialize runtime state for each bee
        for (const swarm of _matrix.swarm_registry) {
            for (const bee of swarm.bees) {
                _runtimeState.set(bee.class, {
                    swarm: swarm.swarm_name,
                    swarmId: swarm.swarm_id,
                    category: swarm.category,
                    role: bee.role,
                    registeredStatus: bee.status,
                    currentStatus: bee.status,
                    lastActive: null,
                    taskCount: 0,
                });
            }
        }

        const stats = getStats();
        logger.info(`Swarm Matrix booted: ${stats.totalSwarms} swarms, ${stats.totalBees} bees (${stats.active} active, ${stats.standby} standby, ${stats.sleeper} sleeper)`);

        return { ok: true, ...stats };
    } catch (err) {
        logger.error(`Boot failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Get the full matrix (for Colab Overmind injection).
 */
function getMatrix() {
    if (!_matrix) boot();
    return _matrix;
}

/**
 * Get matrix statistics.
 */
function getStats() {
    if (!_matrix) return { totalSwarms: 0, totalBees: 0 };

    const allBees = _matrix.swarm_registry.flatMap(s => s.bees);
    return {
        totalSwarms: _matrix.swarm_registry.length,
        totalBees: allBees.length,
        active: allBees.filter(b => b.status === 'ACTIVE').length,
        standby: allBees.filter(b => b.status === 'STANDBY').length,
        sleeper: allBees.filter(b => b.status === 'SLEEPER').length,
        categories: _matrix.swarm_registry.map(s => s.category),
    };
}

/**
 * Look up a specific bee by class name.
 */
function getBee(className) {
    if (!_matrix) boot();
    for (const swarm of _matrix.swarm_registry) {
        for (const bee of swarm.bees) {
            if (bee.class === className) {
                return {
                    ...bee,
                    swarm: swarm.swarm_name,
                    swarmId: swarm.swarm_id,
                    category: swarm.category,
                    runtime: _runtimeState.get(bee.class) || null,
                };
            }
        }
    }
    return null;
}

/**
 * Get all bees in a specific swarm.
 */
function getSwarm(swarmName) {
    if (!_matrix) boot();
    const swarm = _matrix.swarm_registry.find(s =>
        s.swarm_name === swarmName || s.swarm_name === `The ${swarmName}`
    );
    if (!swarm) return null;
    return {
        ...swarm,
        bees: swarm.bees.map(b => ({
            ...b,
            runtime: _runtimeState.get(b.class) || null,
        })),
    };
}

/**
 * Activate a standby/sleeper bee.
 */
function activateBee(className) {
    const state = _runtimeState.get(className);
    if (!state) return { ok: false, error: `Bee ${className} not found` };
    state.currentStatus = 'ACTIVE';
    state.lastActive = new Date().toISOString();
    return { ok: true, bee: className, status: 'ACTIVE' };
}

/**
 * Record a task completion for a bee.
 */
function recordBeeTask(className) {
    const state = _runtimeState.get(className);
    if (!state) return;
    state.taskCount++;
    state.lastActive = new Date().toISOString();
}

/**
 * Get bees by category.
 */
function getBeesByCategory(category) {
    if (!_matrix) boot();
    const swarms = _matrix.swarm_registry.filter(s => s.category === category);
    return swarms.flatMap(s => s.bees.map(b => ({
        ...b,
        swarm: s.swarm_name,
        category: s.category,
        runtime: _runtimeState.get(b.class) || null,
    })));
}

/**
 * Express API routes.
 */
function swarmMatrixRoutes(app) {
    // Full matrix (for Colab Overmind injection)
    app.get('/api/swarm-matrix', (_req, res) => {
        res.json(getMatrix());
    });

    // Matrix stats
    app.get('/api/swarm-matrix/stats', (_req, res) => {
        res.json({ ok: true, ...getStats(), bootTimestamp: _bootTimestamp });
    });

    // Look up a specific bee
    app.get('/api/swarm-matrix/bee/:className', (req, res) => {
        const bee = getBee(req.params.className);
        if (!bee) return res.status(404).json({ error: `Bee ${req.params.className} not found` });
        res.json(bee);
    });

    // Get a specific swarm
    app.get('/api/swarm-matrix/swarm/:name', (req, res) => {
        const swarm = getSwarm(req.params.name);
        if (!swarm) return res.status(404).json({ error: `Swarm ${req.params.name} not found` });
        res.json(swarm);
    });

    // Get bees by category
    app.get('/api/swarm-matrix/category/:category', (req, res) => {
        const bees = getBeesByCategory(req.params.category);
        res.json({ category: req.params.category, count: bees.length, bees });
    });

    // Activate a bee
    app.post('/api/swarm-matrix/activate/:className', (req, res) => {
        res.json(activateBee(req.params.className));
    });

    // List all categories
    app.get('/api/swarm-matrix/categories', (_req, res) => {
        if (!_matrix) boot();
        const cats = _matrix.swarm_registry.map(s => ({
            category: s.category,
            swarm: s.swarm_name,
            beeCount: s.bees.length,
            activeBees: s.bees.filter(b => b.status === 'ACTIVE').length,
        }));
        res.json({ total: cats.length, categories: cats });
    });

    logger.info('Swarm Matrix routes registered at /api/swarm-matrix/*');
}

module.exports = {
    boot,
    getMatrix,
    getStats,
    getBee,
    getSwarm,
    activateBee,
    recordBeeTask,
    getBeesByCategory,
    swarmMatrixRoutes,
};
