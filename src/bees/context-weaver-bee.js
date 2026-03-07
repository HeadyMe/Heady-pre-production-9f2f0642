/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ ContextWeaverBee — Dynamic Semantic Packing Engine ═══
 *
 * Upgraded from naive flat vector retrieval to a Graph + Vector hybrid
 * with composite Si relevance scoring and model-aware token budget
 * allocation. This is the brain's short-term memory: it assembles
 * exactly what the LLM needs to think about a problem—nothing more,
 * nothing less.
 *
 * Pipeline:
 *   1. Build dependency graph from target node(s) — D(T, Ni)
 *   2. Retrieve candidate nodes via pgvector + graph expansion
 *   3. Score all candidates with composite Si equation:
 *      Si = α·Sim(I⃗,N⃗i) + β·(1/(1+D(T,Ni))) + γ·e^(-λt)
 *   4. Greedy-pack into model-specific token budget
 *   5. Return enriched context window with pack efficiency metrics
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger').child('context-weaver');

// ── Engine modules ─────────────────────────────────────────────
const { buildGraph, buildLocalGraph } = require('../context-weaver/dependency-graph');
const { scoreNodes, scoreByStructure } = require('../context-weaver/relevance-scorer');
const { allocate, preview, countTokens, resolveModelLimit } = require('../context-weaver/token-budget-allocator');

// ── Cache & telemetry ──────────────────────────────────────────
const _contextCache = new Map();
const _assemblyLog = [];
let _totalAssemblies = 0;

/**
 * Assemble an optimally packed context window using Dynamic Semantic Packing.
 *
 * @param {Object} query
 * @param {string}   query.intent      — what the LLM is trying to do
 * @param {string[]} query.seedPaths   — starting node_paths to expand from
 * @param {number[]} query.embedding   — intent's semantic embedding
 * @param {number}   query.maxNodes    — max candidate nodes to consider (default 100)
 * @param {number}   query.maxTokens   — override token budget (default: auto from model)
 * @param {string}   query.model       — LLM model routing (default: 'default')
 * @param {Object} options
 * @param {Object}   options.dbClient       — Neon DB client
 * @param {Object}   options.vectorMemory   — in-memory vector store
 * @param {string}   options.projectRoot    — project root for filesystem fallback
 * @returns {Object} assembled context window with Si scores and pack metrics
 */
async function assembleContext(query, options = {}) {
    const start = Date.now();
    const {
        intent = '',
        seedPaths = [],
        embedding = null,
        maxNodes = 100,
        maxTokens = null,
        model = 'default',
    } = query;

    const contextId = crypto.randomUUID();
    let source = 'unknown';
    let graphStats = null;

    try {
        // ═══════════════════════════════════════════════════════
        // PHASE 1: Build Dependency Graph
        // ═══════════════════════════════════════════════════════
        let distanceMap = new Map();
        let nodeMap = new Map();

        if (seedPaths.length > 0 && options.dbClient) {
            const graph = await buildGraph(seedPaths[0], options.dbClient, { maxDepth: 5 });
            distanceMap = graph.distances;
            nodeMap = graph.nodeMap;
            graphStats = graph.stats;
            source = 'pgvector-graph';
        } else if (seedPaths.length > 0 && options.projectRoot) {
            const graph = buildLocalGraph(seedPaths[0], options.projectRoot);
            distanceMap = graph.distances;
            nodeMap = graph.nodeMap;
            graphStats = graph.stats;
            source = 'filesystem-graph';
        }

        // ═══════════════════════════════════════════════════════
        // PHASE 2: Retrieve Candidate Nodes
        // ═══════════════════════════════════════════════════════
        const candidates = [];

        // Strategy A: pgvector semantic similarity
        if (embedding && options.dbClient) {
            source = graphStats ? 'pgvector-graph+semantic' : 'pgvector-semantic';
            const result = await options.dbClient.query(`
                SELECT id, node_path, node_type, node_name, module_name,
                       ast_json, source_hash, dependencies, exports, tags,
                       byte_size, line_count, swarm_category, embedding,
                       updated_at,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM ast_nodes
                WHERE status = 'active'
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            `, [`[${embedding.join(',')}]`, maxNodes]);

            for (const row of result.rows || []) {
                candidates.push(_rowToCandidate(row));
            }
        }

        // Strategy B: Seed path exact match + JSONB dependency expansion
        if (seedPaths.length > 0 && options.dbClient) {
            source = candidates.length > 0 ? 'pgvector-hybrid' : (source || 'pgvector-graph');
            const result = await options.dbClient.query(`
                SELECT id, node_path, node_type, node_name, module_name,
                       ast_json, source_hash, dependencies, exports, tags,
                       byte_size, line_count, swarm_category, embedding,
                       updated_at
                FROM ast_nodes
                WHERE status = 'active'
                  AND (node_path = ANY($1) OR module_name = ANY($2))
                LIMIT $3
            `, [seedPaths, seedPaths.map(p => p.split('::')[0].split('/').pop().replace('.js', '')), maxNodes]);

            for (const row of result.rows || []) {
                if (!candidates.find(c => c.id === row.id)) {
                    candidates.push(_rowToCandidate(row));
                }
            }
        }

        // Strategy C: In-memory vector search (hybrid mode)
        if (candidates.length === 0 && options.vectorMemory) {
            source = 'vector-memory-local';
            const results = await options.vectorMemory.search(intent || seedPaths.join(' '), maxNodes);
            for (const r of (results || [])) {
                candidates.push({
                    id: r.id || crypto.randomUUID(),
                    path: r.metadata?.path || r.id,
                    filepath: r.metadata?.path || r.id,
                    type: r.metadata?.type || 'unknown',
                    name: r.metadata?.name || r.id,
                    module: r.metadata?.module,
                    embedding: r.embedding || null,
                    ast: r.metadata?.ast || { _rawSource: r.content || r.text || '' },
                    code: r.content || r.text || '',
                    dependencies: r.metadata?.dependencies || [],
                    exports: r.metadata?.exports || [],
                    byteSize: r.metadata?.byteSize || 0,
                    lineCount: r.metadata?.lineCount || 0,
                    category: r.metadata?.category || 'general',
                    updatedAt: r.metadata?.ts ? new Date(r.metadata.ts).toISOString() : null,
                });
            }
        }

        // Strategy D: Filesystem fallback
        if (candidates.length === 0 && seedPaths.length > 0) {
            source = 'filesystem-fallback';
            const fs = require('fs');
            const path = require('path');
            const ROOT = options.projectRoot || path.resolve(__dirname, '..', '..');

            for (const p of seedPaths) {
                const filePath = path.resolve(ROOT, p.split('::')[0]);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    candidates.push({
                        id: crypto.randomUUID(),
                        path: p,
                        filepath: p,
                        type: 'module',
                        name: path.basename(filePath, '.js'),
                        module: path.basename(filePath, '.js'),
                        embedding: null,
                        ast: { _rawSource: content },
                        code: content,
                        dependencies: [],
                        exports: [],
                        byteSize: Buffer.byteLength(content),
                        lineCount: content.split('\n').length,
                        category: 'filesystem',
                        updatedAt: fs.statSync(filePath).mtime.toISOString(),
                    });
                }
            }
        }

        // ═══════════════════════════════════════════════════════
        // PHASE 3: Score with Composite Si Equation
        // ═══════════════════════════════════════════════════════
        let scoredNodes;
        if (embedding) {
            scoredNodes = scoreNodes(embedding, candidates, distanceMap);
        } else {
            scoredNodes = scoreByStructure(candidates, distanceMap);
        }

        // ═══════════════════════════════════════════════════════
        // PHASE 4: Pack into Token Budget
        // ═══════════════════════════════════════════════════════
        const modelRouting = model || 'default';
        const targetNode = scoredNodes.length > 0
            ? scoredNodes[0]
            : { path: seedPaths[0] || 'unknown', code: '', name: 'target', ast: {} };

        // Remove target from context nodes (it's already in the TARGET section)
        const contextNodes = scoredNodes.length > 1 ? scoredNodes.slice(1) : [];

        const { payload, metrics: packMetrics } = allocate(
            intent,
            targetNode,
            contextNodes,
            modelRouting,
            { reservedOutput: maxTokens ? Math.min(4000, maxTokens * 0.1) : 4000 },
        );

        // ═══════════════════════════════════════════════════════
        // PHASE 5: Assemble Context Window
        // ═══════════════════════════════════════════════════════
        const contextWindow = {
            contextId,
            intent,
            source,
            modelRouting,
            // Si-scored nodes (full metadata)
            nodes: scoredNodes.map(n => ({
                id: n.id,
                path: n.path,
                type: n.type,
                name: n.name,
                module: n.module,
                composite_score: n.composite_score,
                score_breakdown: n.score_breakdown,
                ast: n.ast,
                dependencies: n.dependencies,
                exports: n.exports,
                byteSize: n.byteSize,
                lineCount: n.lineCount,
                category: n.category,
            })),
            // Pack efficiency metrics
            packMetrics,
            graphStats,
            // Assembled payload (ready for LLM dispatch)
            payload,
            // Summary stats
            nodeCount: scoredNodes.length,
            totalCandidates: candidates.length,
            siScoreRange: scoredNodes.length > 0
                ? {
                    max: scoredNodes[0].composite_score,
                    min: scoredNodes[scoredNodes.length - 1].composite_score,
                }
                : null,
            assembledAt: new Date().toISOString(),
            assemblyTimeMs: Date.now() - start,
        };

        // ── Cache (ephemeral, 5 min TTL) ───────────────────────
        _contextCache.set(contextId, {
            ...contextWindow,
            expiresAt: Date.now() + 300000,
        });

        // Clean expired
        for (const [id, ctx] of _contextCache.entries()) {
            if (ctx.expiresAt && ctx.expiresAt < Date.now()) {
                _contextCache.delete(id);
            }
        }

        _totalAssemblies++;
        _assemblyLog.push({
            contextId,
            intent: intent.slice(0, 100),
            source,
            model: modelRouting,
            nodeCount: scoredNodes.length,
            packEfficiency: packMetrics.packEfficiency,
            topSi: scoredNodes[0]?.composite_score || 0,
            timeMs: contextWindow.assemblyTimeMs,
            timestamp: contextWindow.assembledAt,
        });
        if (_assemblyLog.length > 200) _assemblyLog.splice(0, 100);

        return contextWindow;

    } catch (err) {
        logger.error(`Assembly failed: ${err.message}`);
        return {
            contextId,
            error: err.message,
            intent,
            source,
            nodeCount: 0,
            assemblyTimeMs: Date.now() - start,
        };
    }
}

/**
 * Convert a pgvector row to a candidate node object.
 */
function _rowToCandidate(row) {
    return {
        id: row.id,
        path: row.node_path,
        filepath: row.node_path,
        type: row.node_type,
        name: row.node_name,
        module: row.module_name,
        embedding: row.embedding ? _parseEmbedding(row.embedding) : null,
        ast: row.ast_json,
        code: row.ast_json?._rawSource || '',
        dependencies: row.dependencies,
        exports: row.exports,
        byteSize: row.byte_size,
        lineCount: row.line_count,
        category: row.swarm_category,
        updatedAt: row.updated_at,
        similarity: row.similarity ? parseFloat(row.similarity) : null,
    };
}

/**
 * Parse embedding from pgvector text format "[0.1,0.2,...]" to float array.
 */
function _parseEmbedding(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            // pgvector format: [0.1,0.2,...] (already valid JSON)
            return raw.replace(/[\[\]]/g, '').split(',').map(Number);
        }
    }
    return null;
}

/**
 * Retrieve a cached context by ID (for LLM re-use within TTL).
 */
function getContext(contextId) {
    const ctx = _contextCache.get(contextId);
    if (!ctx) return null;
    if (ctx.expiresAt && ctx.expiresAt < Date.now()) {
        _contextCache.delete(contextId);
        return null;
    }
    return ctx;
}

/**
 * Get assembly stats.
 */
function getStats() {
    return {
        engine: 'ContextWeaver-DSP-v2',
        totalAssemblies: _totalAssemblies,
        activeContexts: _contextCache.size,
        recentAssemblies: _assemblyLog.slice(-20),
    };
}

/**
 * Express routes for the ContextWeaver Engine.
 */
function contextWeaverRoutes(app) {
    // Legacy stats endpoint
    app.get('/api/context-weaver/stats', (_req, res) => {
        res.json({ ok: true, bee: 'ContextWeaverBee', ...getStats() });
    });

    // ── DSP v2: Assemble packed context ────────────────────────
    app.post('/api/context-weaver/assemble', async (req, res) => {
        const context = await assembleContext(req.body.query || req.body, {
            vectorMemory: global.__vectorMemory,
            projectRoot: req.body.projectRoot,
        });
        res.json(context);
    });

    // ── Pack: Full LLM-ready payload ───────────────────────────
    app.post('/api/context-weaver/pack', async (req, res) => {
        const { intent, seedPaths, embedding, model, maxNodes } = req.body;
        const context = await assembleContext(
            { intent, seedPaths, embedding, model, maxNodes },
            { vectorMemory: global.__vectorMemory, projectRoot: req.body.projectRoot },
        );
        // Return just the pack payload + metrics (no raw nodes)
        res.json({
            ok: true,
            contextId: context.contextId,
            payload: context.payload,
            metrics: context.packMetrics,
            siScoreRange: context.siScoreRange,
            nodeCount: context.nodeCount,
            source: context.source,
            model: context.modelRouting,
            assemblyTimeMs: context.assemblyTimeMs,
        });
    });

    // ── Score preview (dry run) ────────────────────────────────
    app.post('/api/context-weaver/score', async (req, res) => {
        const context = await assembleContext(req.body.query || req.body, {
            vectorMemory: global.__vectorMemory,
        });
        // Return Si scores without the payload
        res.json({
            ok: true,
            contextId: context.contextId,
            nodes: (context.nodes || []).map(n => ({
                path: n.path,
                name: n.name,
                composite_score: n.composite_score,
                score_breakdown: n.score_breakdown,
            })),
            siScoreRange: context.siScoreRange,
            nodeCount: context.nodeCount,
        });
    });

    // ── Graph inspection ───────────────────────────────────────
    app.get('/api/context-weaver/graph/:nodePath(*)', async (req, res) => {
        try {
            const graph = buildLocalGraph(
                req.params.nodePath,
                req.query.projectRoot || process.cwd(),
            );
            res.json({ ok: true, ...graph.stats, distances: Object.fromEntries(graph.distances) });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── Context retrieval ──────────────────────────────────────
    app.get('/api/context-weaver/context/:id', (req, res) => {
        const ctx = getContext(req.params.id);
        if (!ctx) return res.status(404).json({ error: 'Context expired or not found' });
        res.json(ctx);
    });

    logger.info('ContextWeaverBee DSP v2 routes registered at /api/context-weaver/*');
}

module.exports = {
    assembleContext,
    getContext,
    getStats,
    contextWeaverRoutes,
};
