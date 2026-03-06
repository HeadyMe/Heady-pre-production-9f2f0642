/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ HologramBee — On-Demand AST-to-Edge Compiler ═══
 *
 * Replaces traditional CI/CD pipelines entirely.
 * When an un-cached domain is requested or ASTMutatorBee updates a node:
 *   1. Pulls raw JSON AST from pgvector (Neon Postgres)
 *   2. Compiles to executable JS in-memory (no file I/O)
 *   3. Pushes compiled output to edge cache (Cloudflare KV / R2)
 *   4. Streams to requesting client
 *   5. Container memory is ephemeral — code only exists while compiling
 *
 * The time from "AI mutates AST" to "feature live on web" = milliseconds.
 *
 * Backup strategy: Remote-only (GCS Coldline / Cloudflare R2).
 * No local files unless explicitly projected on demand.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger').child('hologram-bee');

// ── Compilation cache (RAM-only, ephemeral) ────────────────────
const _compilationCache = new Map();    // nodeId → { output, hash, compiledAt }
const _compileLog = [];
let _totalCompilations = 0;
let _totalCacheHits = 0;

/**
 * Compile an AST node on-demand.
 * Pulls AST JSON, transforms to executable JS, caches in RAM.
 *
 * @param {Object} astNode — node from ast_nodes table
 * @returns {Object} { output, hash, fromCache, compileTimeMs }
 */
function compileNode(astNode) {
    const start = Date.now();
    const cacheKey = `${astNode.id}:${astNode.source_hash}`;

    // Check RAM cache first
    if (_compilationCache.has(cacheKey)) {
        _totalCacheHits++;
        const cached = _compilationCache.get(cacheKey);
        return {
            output: cached.output,
            hash: cached.hash,
            fromCache: true,
            compileTimeMs: 0,
            nodeId: astNode.id,
            nodePath: astNode.node_path,
        };
    }

    try {
        // Transform AST JSON back to executable JavaScript
        const output = transformAST(astNode.ast_json, {
            nodeType: astNode.node_type,
            nodeName: astNode.node_name,
            moduleName: astNode.module_name,
            language: astNode.language || 'javascript',
            dependencies: astNode.dependencies || [],
            exports: astNode.exports || [],
        });

        const hash = crypto.createHash('sha256').update(output).digest('hex');
        const compileTimeMs = Date.now() - start;

        // Cache in RAM (ephemeral — dies with the process)
        _compilationCache.set(cacheKey, {
            output,
            hash,
            compiledAt: new Date().toISOString(),
            byteSize: Buffer.byteLength(output, 'utf8'),
        });

        _totalCompilations++;
        _compileLog.push({
            nodeId: astNode.id,
            nodePath: astNode.node_path,
            hash: hash.slice(0, 12),
            compileTimeMs,
            timestamp: new Date().toISOString(),
        });

        // Keep log bounded
        if (_compileLog.length > 500) _compileLog.splice(0, 250);

        return {
            output,
            hash,
            fromCache: false,
            compileTimeMs,
            nodeId: astNode.id,
            nodePath: astNode.node_path,
        };
    } catch (err) {
        logger.error(`Compile failed for ${astNode.node_path}: ${err.message}`);
        return { output: null, error: err.message, nodeId: astNode.id };
    }
}

/**
 * Compile multiple AST nodes and bundle into a single module.
 * Used by UICompilerBee to assemble a full page from scattered nodes.
 */
function compileBundle(astNodes, options = {}) {
    const start = Date.now();
    const chunks = [];

    for (const node of astNodes) {
        const result = compileNode(node);
        if (result.output) {
            chunks.push({
                path: node.node_path,
                type: node.node_type,
                output: result.output,
                hash: result.hash,
            });
        }
    }

    // Bundle: concatenate with module boundaries
    const bundleHeader = `/* HologramBee Bundle — ${chunks.length} nodes — ${new Date().toISOString()} */\n`;
    const bundleBody = chunks.map(c =>
        `\n/* ── ${c.path} (${c.type}) ── */\n${c.output}`
    ).join('\n');

    const bundle = bundleHeader + bundleBody;
    const bundleHash = crypto.createHash('sha256').update(bundle).digest('hex');

    return {
        bundle,
        hash: bundleHash,
        nodeCount: chunks.length,
        totalBytes: Buffer.byteLength(bundle, 'utf8'),
        compileTimeMs: Date.now() - start,
        nodes: chunks.map(c => ({ path: c.path, type: c.type, hash: c.hash.slice(0, 12) })),
    };
}

/**
 * Push compiled output to remote edge cache.
 * Backups are REMOTE-ONLY — no local storage unless explicitly requested.
 */
async function pushToEdge(compiledOutput, target) {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    const result = { target, pushed: false };

    // Cloudflare KV (primary edge cache)
    if (target === 'cloudflare-kv' && cfToken && cfAccountId) {
        try {
            const resp = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces`,
                { headers: { 'Authorization': `Bearer ${cfToken}` } }
            );
            const data = await resp.json();
            const ns = data?.result?.find(n => n.title === 'heady-ast-cache');

            if (ns) {
                await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces/${ns.id}/values/ast:${compiledOutput.hash}`,
                    {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/javascript' },
                        body: compiledOutput.output || compiledOutput.bundle,
                    }
                );
                result.pushed = true;
                result.namespaceId = ns.id;
            }
        } catch (err) {
            result.error = err.message;
        }
    }

    // Cloudflare R2 (remote backup — not local)
    if (target === 'cloudflare-r2' && cfToken && cfAccountId) {
        try {
            const bucketName = 'heady-ast-backup';
            const key = `ast/${compiledOutput.hash}.js`;
            await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/r2/buckets/${bucketName}/objects/${key}`,
                {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/javascript' },
                    body: compiledOutput.output || compiledOutput.bundle,
                }
            );
            result.pushed = true;
            result.key = key;
        } catch (err) {
            result.error = err.message;
        }
    }

    // GCS Coldline (deep time backup — remote only)
    if (target === 'gcs-coldline') {
        // Placeholder — requires GCS service account
        result.pushed = false;
        result.reason = 'GCS Coldline backup awaiting service account configuration';
    }

    return result;
}

/**
 * Transform AST JSON back to executable source code.
 * This is the core compiler — turns pure potential into materialized reality.
 */
function transformAST(astJson, options = {}) {
    const { nodeType, nodeName, language, dependencies = [], exports: nodeExports = [] } = options;

    // If the AST has a raw source attached, use it directly
    if (astJson._rawSource) {
        return astJson._rawSource;
    }

    // If it's already a compiled string stored in JSON
    if (typeof astJson === 'string') {
        return astJson;
    }

    // Build source from structured AST
    const lines = [];

    // Header
    lines.push(`/* Materialized by HologramBee — ${new Date().toISOString()} */`);

    // Dependencies
    if (dependencies.length > 0) {
        for (const dep of dependencies) {
            if (typeof dep === 'string') {
                const modName = dep.split('::')[0].split('/').pop().replace('.js', '');
                lines.push(`const ${modName} = require('${dep.split('::')[0]}');`);
            } else if (dep.module && dep.binding) {
                lines.push(`const { ${dep.binding} } = require('${dep.module}');`);
            }
        }
        lines.push('');
    }

    // Body — reconstruct from AST structure
    if (astJson.type === 'FunctionDeclaration' || nodeType === 'function') {
        const params = (astJson.params || []).map(p => p.name || p).join(', ');
        const isAsync = astJson.async ? 'async ' : '';
        lines.push(`${isAsync}function ${nodeName || astJson.id?.name || 'anonymous'}(${params}) {`);
        if (astJson.body?._source) {
            lines.push(astJson.body._source);
        } else if (astJson.body?.statements) {
            for (const stmt of astJson.body.statements) {
                lines.push(`    ${stmt._source || JSON.stringify(stmt)}`);
            }
        } else {
            lines.push(`    // AST body: ${JSON.stringify(astJson.body || {}).slice(0, 200)}`);
        }
        lines.push('}');
    } else if (astJson.type === 'ClassDeclaration' || nodeType === 'class') {
        lines.push(`class ${nodeName || astJson.id?.name || 'Anonymous'} {`);
        for (const method of (astJson.methods || astJson.body?.body || [])) {
            const mName = method.key?.name || method.name || 'method';
            lines.push(`    ${method.kind === 'constructor' ? 'constructor' : mName}() {`);
            lines.push(`        ${method.body?._source || '// materialized'}`);
            lines.push('    }');
        }
        lines.push('}');
    } else if (nodeType === 'module') {
        // Whole module — output the body directly
        if (astJson.body && Array.isArray(astJson.body)) {
            for (const node of astJson.body) {
                lines.push(node._source || JSON.stringify(node));
            }
        } else if (astJson._fullSource) {
            lines.push(astJson._fullSource);
        } else {
            lines.push(`module.exports = ${JSON.stringify(astJson, null, 2)};`);
        }
    } else {
        // Generic — serialize the AST JSON as a module export
        lines.push(`module.exports = ${JSON.stringify(astJson, null, 2)};`);
    }

    // Exports
    if (nodeExports.length > 0 && nodeType !== 'module') {
        lines.push('');
        lines.push(`module.exports = { ${nodeExports.join(', ')} };`);
    }

    return lines.join('\n');
}

/**
 * Get compilation stats.
 */
function getStats() {
    return {
        totalCompilations: _totalCompilations,
        totalCacheHits: _totalCacheHits,
        cacheSize: _compilationCache.size,
        cacheHitRate: _totalCompilations > 0
            ? ((_totalCacheHits / (_totalCompilations + _totalCacheHits)) * 100).toFixed(1) + '%'
            : '0%',
        recentCompilations: _compileLog.slice(-20),
    };
}

/**
 * Clear the ephemeral compilation cache.
 */
function clearCache() {
    const size = _compilationCache.size;
    _compilationCache.clear();
    return { cleared: size };
}

/**
 * Express routes.
 */
function hologramBeeRoutes(app) {
    app.get('/api/hologram/stats', (_req, res) => {
        res.json({ ok: true, bee: 'HologramBee', ...getStats() });
    });

    app.post('/api/hologram/compile', (req, res) => {
        const { astNode } = req.body;
        if (!astNode) return res.status(400).json({ error: 'astNode required' });
        const result = compileNode(astNode);
        res.json(result);
    });

    app.post('/api/hologram/bundle', (req, res) => {
        const { astNodes } = req.body;
        if (!astNodes || !Array.isArray(astNodes)) return res.status(400).json({ error: 'astNodes array required' });
        const result = compileBundle(astNodes);
        res.json(result);
    });

    app.post('/api/hologram/push', async (req, res) => {
        const { compiled, target } = req.body;
        if (!compiled || !target) return res.status(400).json({ error: 'compiled and target required' });
        const result = await pushToEdge(compiled, target);
        res.json(result);
    });

    app.delete('/api/hologram/cache', (_req, res) => {
        res.json({ ok: true, ...clearCache() });
    });

    logger.info('HologramBee routes registered at /api/hologram/*');
}

module.exports = {
    compileNode,
    compileBundle,
    pushToEdge,
    transformAST,
    getStats,
    clearCache,
    hologramBeeRoutes,
};
