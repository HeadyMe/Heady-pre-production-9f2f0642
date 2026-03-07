/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Dependency Graph — AST Node Relationship Mapper ═══
 *
 * Builds a directed dependency graph from ast_edges and computes
 * structural distance D(T, Ni) from any target node to all reachable
 * nodes via BFS traversal.
 *
 * Two strategies:
 *   1. pgvector ast_edges (full Zero-Repo mode)
 *   2. Filesystem require()/import parsing (hybrid fallback)
 */

'use strict';

const logger = require('../utils/logger').child('dependency-graph');

const MAX_TRAVERSAL_DEPTH = 5;
const EDGE_TYPES = ['imports', 'calls', 'extends', 'wires', 'depends'];

/**
 * Build adjacency list from ast_edges for a target node and its neighborhood.
 *
 * @param {string} targetNodePath — e.g. "src/services/vault-boot.js::bootVault"
 * @param {Object} dbClient — Neon DB client with .query()
 * @param {Object} options
 * @param {number} options.maxDepth — max BFS hops (default 5)
 * @param {string[]} options.edgeTypes — relationship types to follow
 * @returns {Object} { adjacency, distances, nodeMap, stats }
 */
async function buildGraph(targetNodePath, dbClient, options = {}) {
    const {
        maxDepth = MAX_TRAVERSAL_DEPTH,
        edgeTypes = EDGE_TYPES,
    } = options;

    const start = Date.now();

    if (!dbClient) {
        logger.warn('No DB client — dependency graph unavailable');
        return _emptyGraph(targetNodePath);
    }

    try {
        // 1. Resolve target node ID
        const targetResult = await dbClient.query(
            `SELECT id, node_path, node_name, module_name, dependencies
             FROM ast_nodes WHERE node_path = $1 AND status = 'active' LIMIT 1`,
            [targetNodePath]
        );

        if (!targetResult.rows || targetResult.rows.length === 0) {
            logger.warn(`Target node not found: ${targetNodePath}`);
            return _emptyGraph(targetNodePath);
        }

        const targetNode = targetResult.rows[0];
        const targetId = targetNode.id;

        // 2. Fetch all edges within maxDepth hops via recursive CTE
        const edgePlaceholders = edgeTypes.map((_, i) => `$${i + 2}`).join(', ');
        const edgeResult = await dbClient.query(`
            WITH RECURSIVE reachable AS (
                -- Base: edges from target node
                SELECT e.source_id, e.target_id, e.edge_type, e.weight, 1 AS depth
                FROM ast_edges e
                WHERE (e.source_id = $1 OR e.target_id = $1)
                  AND e.edge_type IN (${edgePlaceholders})

                UNION ALL

                -- Recursive: follow edges up to maxDepth
                SELECT e.source_id, e.target_id, e.edge_type, e.weight, r.depth + 1
                FROM ast_edges e
                JOIN reachable r ON (e.source_id = r.target_id OR e.source_id = r.source_id)
                WHERE r.depth < $${edgeTypes.length + 2}
                  AND e.edge_type IN (${edgePlaceholders})
            )
            SELECT DISTINCT source_id, target_id, edge_type, weight, MIN(depth) AS depth
            FROM reachable
            GROUP BY source_id, target_id, edge_type, weight
        `, [targetId, ...edgeTypes, maxDepth, ...edgeTypes]);

        // 3. Build adjacency list
        const adjacency = new Map(); // nodeId → [{ target, type, weight }]
        const allNodeIds = new Set([targetId]);

        for (const row of (edgeResult.rows || [])) {
            const src = row.source_id;
            const tgt = row.target_id;
            allNodeIds.add(src);
            allNodeIds.add(tgt);

            if (!adjacency.has(src)) adjacency.set(src, []);
            adjacency.get(src).push({
                target: tgt,
                type: row.edge_type,
                weight: parseFloat(row.weight) || 1.0,
            });

            // Bidirectional for distance computation
            if (!adjacency.has(tgt)) adjacency.set(tgt, []);
            adjacency.get(tgt).push({
                target: src,
                type: row.edge_type,
                weight: parseFloat(row.weight) || 1.0,
            });
        }

        // 4. BFS from target to compute distances
        const distances = computeDistances(targetId, adjacency, maxDepth);

        // 5. Fetch node metadata for all discovered nodes
        const nodeMap = new Map();
        if (allNodeIds.size > 0) {
            const nodeIds = Array.from(allNodeIds);
            const placeholders = nodeIds.map((_, i) => `$${i + 1}`).join(', ');
            const nodesResult = await dbClient.query(`
                SELECT id, node_path, node_name, node_type, module_name,
                       byte_size, line_count, updated_at
                FROM ast_nodes
                WHERE id IN (${placeholders})
            `, nodeIds);

            for (const row of (nodesResult.rows || [])) {
                nodeMap.set(row.id, {
                    id: row.id,
                    path: row.node_path,
                    name: row.node_name,
                    type: row.node_type,
                    module: row.module_name,
                    byteSize: row.byte_size,
                    lineCount: row.line_count,
                    updatedAt: row.updated_at,
                });
            }
        }

        const stats = {
            targetNodePath,
            targetNodeId: targetId,
            totalEdges: edgeResult.rows?.length || 0,
            totalNodes: allNodeIds.size,
            maxDistance: Math.max(0, ...Array.from(distances.values())),
            buildTimeMs: Date.now() - start,
        };

        logger.info(`Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges, max depth ${stats.maxDistance} (${stats.buildTimeMs}ms)`);

        return { adjacency, distances, nodeMap, stats };

    } catch (err) {
        logger.error(`Graph build failed: ${err.message}`);
        return _emptyGraph(targetNodePath);
    }
}

/**
 * BFS from a source node to compute shortest distances to all reachable nodes.
 *
 * @param {string} sourceId — starting node UUID
 * @param {Map} adjacency — adjacency list (nodeId → edges[])
 * @param {number} maxDepth — maximum traversal depth
 * @returns {Map<string, number>} nodeId → shortest distance
 */
function computeDistances(sourceId, adjacency, maxDepth = MAX_TRAVERSAL_DEPTH) {
    const distances = new Map();
    distances.set(sourceId, 0);

    const queue = [{ id: sourceId, depth: 0 }];

    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (depth >= maxDepth) continue;

        const edges = adjacency.get(id) || [];
        for (const edge of edges) {
            if (!distances.has(edge.target)) {
                distances.set(edge.target, depth + 1);
                queue.push({ id: edge.target, depth: depth + 1 });
            }
        }
    }

    return distances;
}

/**
 * Fallback: build a local dependency graph by parsing require()/import from files.
 *
 * @param {string} targetPath — filepath relative to project root
 * @param {string} projectRoot — absolute path to project root
 * @returns {Object} { adjacency, distances, nodeMap, stats }
 */
function buildLocalGraph(targetPath, projectRoot) {
    const fs = require('fs');
    const path = require('path');
    const start = Date.now();

    const adjacency = new Map();
    const nodeMap = new Map();
    const visited = new Set();

    function resolve(importPath, fromDir) {
        if (importPath.startsWith('.')) {
            let resolved = path.resolve(fromDir, importPath);
            if (!path.extname(resolved)) resolved += '.js';
            return resolved;
        }
        return null; // Skip node_modules
    }

    function parseFile(filePath, depth = 0) {
        if (depth > MAX_TRAVERSAL_DEPTH || visited.has(filePath)) return;
        visited.add(filePath);

        try {
            if (!fs.existsSync(filePath)) return;
            const content = fs.readFileSync(filePath, 'utf8');
            const nodeId = path.relative(projectRoot, filePath);

            nodeMap.set(nodeId, {
                id: nodeId,
                path: nodeId,
                name: path.basename(filePath, '.js'),
                type: 'module',
                module: path.basename(filePath, '.js'),
                byteSize: Buffer.byteLength(content),
                lineCount: content.split('\n').length,
                updatedAt: fs.statSync(filePath).mtime.toISOString(),
            });

            if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);

            // Parse require() and import statements
            const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
            const importRegex = /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g;

            const fromDir = path.dirname(filePath);
            let match;

            while ((match = requireRegex.exec(content)) !== null) {
                const resolved = resolve(match[1], fromDir);
                if (resolved && fs.existsSync(resolved)) {
                    const depId = path.relative(projectRoot, resolved);
                    adjacency.get(nodeId).push({ target: depId, type: 'imports', weight: 1.0 });
                    parseFile(resolved, depth + 1);
                }
            }
            while ((match = importRegex.exec(content)) !== null) {
                const resolved = resolve(match[1], fromDir);
                if (resolved && fs.existsSync(resolved)) {
                    const depId = path.relative(projectRoot, resolved);
                    adjacency.get(nodeId).push({ target: depId, type: 'imports', weight: 1.0 });
                    parseFile(resolved, depth + 1);
                }
            }
        } catch { /* skip unreadable files */ }
    }

    const absTarget = path.resolve(projectRoot, targetPath);
    parseFile(absTarget);

    const targetNodeId = path.relative(projectRoot, absTarget);
    const distances = computeDistances(targetNodeId, adjacency);

    return {
        adjacency,
        distances,
        nodeMap,
        stats: {
            targetNodePath: targetPath,
            targetNodeId: targetNodeId,
            totalEdges: Array.from(adjacency.values()).reduce((s, e) => s + e.length, 0),
            totalNodes: nodeMap.size,
            maxDistance: Math.max(0, ...Array.from(distances.values()).filter(v => v !== Infinity)),
            buildTimeMs: Date.now() - start,
            source: 'filesystem-fallback',
        },
    };
}

function _emptyGraph(targetNodePath) {
    return {
        adjacency: new Map(),
        distances: new Map(),
        nodeMap: new Map(),
        stats: {
            targetNodePath,
            targetNodeId: null,
            totalEdges: 0,
            totalNodes: 0,
            maxDistance: 0,
            buildTimeMs: 0,
        },
    };
}

module.exports = {
    buildGraph,
    buildLocalGraph,
    computeDistances,
    MAX_TRAVERSAL_DEPTH,
    EDGE_TYPES,
};
