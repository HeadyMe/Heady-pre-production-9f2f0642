/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ ContextWeaverBee — Zero-File Memory Assembler ═══
 *
 * Since there are no files in Zero-Repo Architecture, the AI cannot
 * "read a file" to understand context. Instead, ContextWeaverBee:
 *   1. Queries pgvector for the N most relevant AST nodes
 *   2. Ranks by semantic similarity + dependency graph proximity
 *   3. Stitches them into a temporary virtual context window
 *   4. Feeds the assembled context to the LLM for mutation/analysis
 *   5. Context is ephemeral — dissolves after use
 *
 * This is the brain's short-term memory: it assembles what it needs
 * to think about a problem, then forgets the arrangement.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger').child('context-weaver');

// ── Context assembly cache (ephemeral) ─────────────────────────
const _contextCache = new Map();
const _assemblyLog = [];
let _totalAssemblies = 0;

/**
 * Assemble a context window from scattered AST nodes.
 *
 * In full Zero-Repo mode, this queries pgvector.
 * In Phase 1 (hybrid), it can also read from the local codebase.
 *
 * @param {Object} query
 * @param {string} query.intent — what the LLM is trying to do
 * @param {string[]} query.seedPaths — starting node_paths to expand from
 * @param {number[]} query.embedding — optional semantic embedding to search by
 * @param {number} query.maxNodes — max nodes to pull (default 50)
 * @param {number} query.maxTokens — approx token budget (default 32000)
 * @param {Object} options
 * @param {Object} options.dbClient — Neon DB client (optional)
 * @param {Object} options.vectorMemory — in-memory vector store (optional)
 * @returns {Object} assembled context window
 */
async function assembleContext(query, options = {}) {
    const start = Date.now();
    const {
        intent = '',
        seedPaths = [],
        embedding = null,
        maxNodes = 50,
        maxTokens = 32000,
    } = query;

    const contextId = crypto.randomUUID();
    const nodes = [];
    let source = 'unknown';

    try {
        // Strategy 1: Query pgvector by semantic similarity
        if (embedding && options.dbClient) {
            source = 'pgvector-semantic';
            const result = await options.dbClient.query(`
                SELECT id, node_path, node_type, node_name, module_name,
                       ast_json, source_hash, dependencies, exports, tags,
                       byte_size, line_count, swarm_category,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM ast_nodes
                WHERE status = 'active'
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            `, [`[${embedding.join(',')}]`, maxNodes]);

            for (const row of result.rows || []) {
                nodes.push({
                    id: row.id,
                    path: row.node_path,
                    type: row.node_type,
                    name: row.node_name,
                    module: row.module_name,
                    similarity: parseFloat(row.similarity).toFixed(4),
                    ast: row.ast_json,
                    dependencies: row.dependencies,
                    exports: row.exports,
                    byteSize: row.byte_size,
                    lineCount: row.line_count,
                    category: row.swarm_category,
                });
            }
        }

        // Strategy 2: Query by seed paths (exact match + graph expansion)
        if (seedPaths.length > 0 && options.dbClient) {
            source = nodes.length > 0 ? 'pgvector-hybrid' : 'pgvector-graph';
            const placeholders = seedPaths.map((_, i) => `$${i + 1}`).join(', ');
            const result = await options.dbClient.query(`
                SELECT id, node_path, node_type, node_name, module_name,
                       ast_json, source_hash, dependencies, exports, tags,
                       byte_size, line_count, swarm_category
                FROM ast_nodes
                WHERE status = 'active'
                  AND (node_path = ANY($1) OR module_name = ANY($2))
                LIMIT $3
            `, [seedPaths, seedPaths.map(p => p.split('::')[0].split('/').pop().replace('.js', '')), maxNodes]);

            for (const row of result.rows || []) {
                if (!nodes.find(n => n.id === row.id)) {
                    nodes.push({
                        id: row.id,
                        path: row.node_path,
                        type: row.node_type,
                        name: row.node_name,
                        module: row.module_name,
                        similarity: 'exact-match',
                        ast: row.ast_json,
                        dependencies: row.dependencies,
                        exports: row.exports,
                        byteSize: row.byte_size,
                        lineCount: row.line_count,
                        category: row.swarm_category,
                    });
                }
            }
        }

        // Strategy 3: In-memory vector search (Phase 1 hybrid mode)
        if (nodes.length === 0 && options.vectorMemory) {
            source = 'vector-memory-local';
            const results = await options.vectorMemory.search(intent || seedPaths.join(' '), maxNodes);
            for (const r of (results || [])) {
                nodes.push({
                    id: r.id || crypto.randomUUID(),
                    path: r.metadata?.path || r.id,
                    type: r.metadata?.type || 'unknown',
                    name: r.metadata?.name || r.id,
                    module: r.metadata?.module,
                    similarity: r.score?.toFixed(4) || '0',
                    ast: r.metadata?.ast || { _rawSource: r.content || r.text || '' },
                    dependencies: r.metadata?.dependencies || [],
                    exports: r.metadata?.exports || [],
                    byteSize: r.metadata?.byteSize || 0,
                    lineCount: r.metadata?.lineCount || 0,
                    category: r.metadata?.category || 'general',
                });
            }
        }

        // Strategy 4: Fallback — direct filesystem scan (Phase 1 only)
        if (nodes.length === 0 && seedPaths.length > 0) {
            source = 'filesystem-fallback';
            const fs = require('fs');
            const path = require('path');
            const ROOT = path.resolve(__dirname, '..', '..');

            for (const p of seedPaths) {
                const filePath = path.resolve(ROOT, p.split('::')[0]);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    nodes.push({
                        id: crypto.randomUUID(),
                        path: p,
                        type: 'module',
                        name: path.basename(filePath, '.js'),
                        module: path.basename(filePath, '.js'),
                        similarity: 'filesystem',
                        ast: { _rawSource: content },
                        dependencies: [],
                        exports: [],
                        byteSize: Buffer.byteLength(content),
                        lineCount: content.split('\n').length,
                        category: 'filesystem',
                    });
                }
            }
        }

        // Trim to token budget (rough estimate: 4 chars ≈ 1 token)
        let totalChars = 0;
        const charBudget = maxTokens * 4;
        const trimmedNodes = [];

        for (const node of nodes) {
            const nodeChars = JSON.stringify(node.ast).length;
            if (totalChars + nodeChars > charBudget) break;
            totalChars += nodeChars;
            trimmedNodes.push(node);
        }

        // Assemble the context window
        const contextWindow = {
            contextId,
            intent,
            source,
            nodeCount: trimmedNodes.length,
            totalNodes: nodes.length,
            trimmedToTokenBudget: trimmedNodes.length < nodes.length,
            approxTokens: Math.round(totalChars / 4),
            nodes: trimmedNodes,
            assembledAt: new Date().toISOString(),
            assemblyTimeMs: Date.now() - start,
        };

        // Cache ephemerally
        _contextCache.set(contextId, {
            ...contextWindow,
            expiresAt: Date.now() + 300000, // 5 min TTL
        });

        // Clean expired contexts
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
            nodeCount: trimmedNodes.length,
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
        totalAssemblies: _totalAssemblies,
        activeContexts: _contextCache.size,
        recentAssemblies: _assemblyLog.slice(-20),
    };
}

/**
 * Express routes.
 */
function contextWeaverRoutes(app) {
    app.get('/api/context-weaver/stats', (_req, res) => {
        res.json({ ok: true, bee: 'ContextWeaverBee', ...getStats() });
    });

    app.post('/api/context-weaver/assemble', async (req, res) => {
        const context = await assembleContext(req.body.query || req.body, {
            vectorMemory: global.__vectorMemory,
        });
        res.json(context);
    });

    app.get('/api/context-weaver/context/:id', (req, res) => {
        const ctx = getContext(req.params.id);
        if (!ctx) return res.status(404).json({ error: 'Context expired or not found' });
        res.json(ctx);
    });

    logger.info('ContextWeaverBee routes registered at /api/context-weaver/*');
}

module.exports = {
    assembleContext,
    getContext,
    getStats,
    contextWeaverRoutes,
};
