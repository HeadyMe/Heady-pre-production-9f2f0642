'use strict';

/**
 * HeadyVector Graph RAG Implementation
 *
 * Entity-relationship graph stored in PostgreSQL (heady_graph_nodes + heady_graph_edges).
 * Node types: document, chunk, entity, concept, custom
 * Edge types: references, contains, related_to, derived_from, mentions, co_occurs, custom
 *
 * Features:
 * - Multi-hop graph traversal (BFS / weighted DFS)
 * - Community detection (Louvain-inspired via modularity)
 * - Path-based context assembly (rich context from graph paths)
 * - Graph + vector hybrid queries (entity-anchored vector search)
 * - Graph visualization data export (nodes/edges JSON for D3/Cytoscape)
 */

const config = require('./config');

// ─── GraphRAG class ───────────────────────────────────────────────────────────

class GraphRAG {
  /**
   * @param {import('pg').Pool} pool
   * @param {import('./indexes').IndexManager} indexManager
   */
  constructor(pool, indexManager) {
    this.pool = pool;
    this.indexManager = indexManager;
  }

  // ── Node operations ───────────────────────────────────────────────────────

  /**
   * Add or update a graph node.
   *
   * @param {object} opts
   * @param {string} opts.label - node label / name
   * @param {string} [opts.nodeType='entity'] - document|chunk|entity|concept|custom
   * @param {string} [opts.content] - text content
   * @param {object} [opts.properties={}] - arbitrary JSONB properties
   * @param {Float32Array|number[]} [opts.vector] - 384-dim embedding
   * @param {Float32Array|number[]} [opts.vector768] - 768-dim embedding
   * @param {string|null} [opts.collectionId] - optional collection scope
   * @param {number} [opts.communityId] - community assignment
   * @returns {Promise<object>}
   */
  async addNode(opts) {
    const {
      label,
      nodeType = 'entity',
      content = null,
      properties = {},
      vector = null,
      vector768 = null,
      collectionId = null,
      communityId = null,
    } = opts;

    if (!label || label.trim().length === 0) {
      throw new Error('Node label is required');
    }

    const vecArray = vector ? `[${Array.from(vector).join(',')}]` : null;
    const vec768Array = vector768 ? `[${Array.from(vector768).join(',')}]` : null;

    const result = await this.pool.query(
      `INSERT INTO heady_graph_nodes
         (label, node_type, content, properties, embedding, embedding_768,
          collection_id, community_id)
       VALUES ($1, $2, $3, $4, $5::vector, $6::vector, $7, $8)
       RETURNING *`,
      [label, nodeType, content, JSON.stringify(properties),
       vecArray, vec768Array, collectionId, communityId]
    );

    return result.rows[0];
  }

  /**
   * Get a node by ID.
   * @param {string} nodeId
   * @returns {Promise<object|null>}
   */
  async getNode(nodeId) {
    const result = await this.pool.query(
      'SELECT * FROM heady_graph_nodes WHERE id = $1',
      [nodeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find nodes by label (exact or fuzzy).
   * @param {string} label
   * @param {object} [opts]
   * @param {boolean} [opts.exact=false]
   * @param {string} [opts.nodeType]
   * @param {string} [opts.collectionId]
   * @param {number} [opts.limit=20]
   * @returns {Promise<object[]>}
   */
  async findNodesByLabel(label, opts = {}) {
    const { exact = false, nodeType, collectionId, limit = 20 } = opts;
    const params = [];
    const conditions = [];

    if (exact) {
      params.push(label);
      conditions.push(`label = $${params.length}`);
    } else {
      params.push(`%${label}%`);
      conditions.push(`label ILIKE $${params.length}`);
    }

    if (nodeType) {
      params.push(nodeType);
      conditions.push(`node_type = $${params.length}`);
    }

    if (collectionId) {
      params.push(collectionId);
      conditions.push(`collection_id = $${params.length}`);
    }

    params.push(limit);
    const result = await this.pool.query(
      `SELECT * FROM heady_graph_nodes
       WHERE ${conditions.join(' AND ')}
       ORDER BY page_rank DESC, label
       LIMIT $${params.length}`,
      params
    );
    return result.rows;
  }

  /**
   * Delete a node and all its edges.
   * @param {string} nodeId
   * @returns {Promise<{deleted: boolean}>}
   */
  async deleteNode(nodeId) {
    const result = await this.pool.query(
      'DELETE FROM heady_graph_nodes WHERE id = $1 RETURNING id',
      [nodeId]
    );
    return { deleted: result.rows.length > 0 };
  }

  // ── Edge operations ───────────────────────────────────────────────────────

  /**
   * Add a directed edge between two nodes.
   *
   * @param {object} opts
   * @param {string} opts.sourceId - source node UUID
   * @param {string} opts.targetId - target node UUID
   * @param {string} [opts.edgeType='related_to']
   * @param {string} [opts.label]
   * @param {number} [opts.weight=1.0] - 0-1
   * @param {object} [opts.properties={}]
   * @param {boolean} [opts.bidirectional=false]
   * @returns {Promise<object>}
   */
  async addEdge(opts) {
    const {
      sourceId,
      targetId,
      edgeType = 'related_to',
      label = null,
      weight = 1.0,
      properties = {},
      bidirectional = false,
    } = opts;

    if (!sourceId || !targetId) {
      throw new Error('Edge requires sourceId and targetId');
    }
    if (sourceId === targetId) {
      throw new Error('Self-loops are not supported');
    }

    const result = await this.pool.query(
      `INSERT INTO heady_graph_edges
         (source_id, target_id, edge_type, label, weight, properties, bidirectional)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source_id, target_id, edge_type)
       DO UPDATE SET
         label         = EXCLUDED.label,
         weight        = EXCLUDED.weight,
         properties    = EXCLUDED.properties,
         bidirectional = EXCLUDED.bidirectional
       RETURNING *`,
      [sourceId, targetId, edgeType, label, weight, JSON.stringify(properties), bidirectional]
    );

    return result.rows[0];
  }

  /**
   * Get all edges from a node.
   * @param {string} nodeId
   * @param {object} [opts]
   * @param {string} [opts.direction='outgoing'] - 'outgoing'|'incoming'|'both'
   * @param {string[]} [opts.edgeTypes]
   * @param {number} [opts.minWeight=0]
   * @returns {Promise<object[]>}
   */
  async getEdges(nodeId, opts = {}) {
    const { direction = 'outgoing', edgeTypes, minWeight = 0 } = opts;
    const params = [nodeId, minWeight];
    const conditions = [`weight >= $2`];

    let directionClause;
    if (direction === 'outgoing') {
      directionClause = 'source_id = $1';
    } else if (direction === 'incoming') {
      directionClause = 'target_id = $1';
    } else {
      directionClause = '(source_id = $1 OR (target_id = $1 AND bidirectional = TRUE))';
    }
    conditions.push(directionClause);

    if (edgeTypes && edgeTypes.length > 0) {
      params.push(edgeTypes);
      conditions.push(`edge_type = ANY($${params.length})`);
    }

    const result = await this.pool.query(
      `SELECT e.*,
              sn.label AS source_label, sn.node_type AS source_type,
              tn.label AS target_label, tn.node_type AS target_type
       FROM heady_graph_edges e
       JOIN heady_graph_nodes sn ON sn.id = e.source_id
       JOIN heady_graph_nodes tn ON tn.id = e.target_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.weight DESC`,
      params
    );
    return result.rows;
  }

  // ── Graph traversal ───────────────────────────────────────────────────────

  /**
   * BFS traversal from a set of seed nodes up to maxDepth hops.
   * Returns all reachable nodes + paths.
   *
   * Uses PostgreSQL recursive CTE for efficient graph traversal.
   *
   * @param {object} opts
   * @param {string[]} opts.seedNodeIds - starting node UUIDs
   * @param {number} [opts.maxDepth=3]
   * @param {number} [opts.maxNodes=100]
   * @param {string[]} [opts.edgeTypes] - filter to specific edge types
   * @param {number} [opts.minWeight=0.1]
   * @param {string} [opts.direction='outgoing'] - 'outgoing'|'both'
   * @returns {Promise<{nodes: object[], edges: object[], paths: string[][]}>}
   */
  async traverse(opts) {
    const {
      seedNodeIds,
      maxDepth = config.graph.maxDepth,
      maxNodes = config.graph.maxNodes,
      edgeTypes,
      minWeight = config.graph.minEdgeWeight,
      direction = 'outgoing',
    } = opts;

    if (!seedNodeIds || seedNodeIds.length === 0) {
      throw new Error('traverse() requires at least one seedNodeId');
    }

    const edgeFilter =
      edgeTypes && edgeTypes.length > 0
        ? `AND e.edge_type = ANY(ARRAY[${edgeTypes.map((t) => `'${t}'`).join(',')}]::text[])`
        : '';

    const directionFilter =
      direction === 'both'
        ? `(e.source_id = traversal.node_id OR (e.target_id = traversal.node_id AND e.bidirectional))`
        : `e.source_id = traversal.node_id`;

    const nextNodeExpr =
      direction === 'both'
        ? `CASE WHEN e.source_id = traversal.node_id THEN e.target_id ELSE e.source_id END`
        : `e.target_id`;

    const seedArray = `ARRAY[${seedNodeIds.map((id) => `'${id}'::uuid`).join(',')}]`;

    const sql = `
      WITH RECURSIVE traversal AS (
        -- Base case: seed nodes at depth 0
        SELECT
          n.id AS node_id,
          0 AS depth,
          ARRAY[n.id::text] AS path,
          1.0::float AS cumulative_weight
        FROM heady_graph_nodes n
        WHERE n.id = ANY(${seedArray})

        UNION ALL

        -- Recursive step
        SELECT
          ${nextNodeExpr} AS node_id,
          traversal.depth + 1,
          traversal.path || (${nextNodeExpr})::text,
          traversal.cumulative_weight * e.weight
        FROM heady_graph_edges e
        JOIN traversal ON ${directionFilter}
        WHERE traversal.depth < $1
          AND e.weight >= $2
          AND NOT (${nextNodeExpr})::text = ANY(traversal.path) -- prevent cycles
          ${edgeFilter}
      ),
      ranked_traversal AS (
        SELECT
          node_id,
          MIN(depth) AS min_depth,
          MAX(cumulative_weight) AS max_weight,
          array_agg(DISTINCT path ORDER BY path) AS paths
        FROM traversal
        GROUP BY node_id
        ORDER BY min_depth ASC, max_weight DESC
        LIMIT $3
      )
      SELECT
        n.*,
        rt.min_depth AS depth,
        rt.max_weight AS relevance_weight,
        rt.paths
      FROM ranked_traversal rt
      JOIN heady_graph_nodes n ON n.id = rt.node_id
      ORDER BY rt.min_depth ASC, rt.max_weight DESC
    `;

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query(sql, [maxDepth, minWeight, maxNodes]),
      this._getSubgraphEdges(seedNodeIds, maxDepth, minWeight, edgeTypes, direction),
    ]);

    return {
      nodes: nodeResult.rows,
      edges: edgeResult,
      seedNodeIds,
      maxDepth,
      totalNodes: nodeResult.rows.length,
    };
  }

  /**
   * Fetch edges relevant to a traversal (used internally).
   */
  async _getSubgraphEdges(seedNodeIds, maxDepth, minWeight, edgeTypes, direction) {
    const params = [minWeight, maxDepth];
    const edgeFilter =
      edgeTypes && edgeTypes.length > 0
        ? `AND e.edge_type = ANY($${params.push(edgeTypes)}::text[])`
        : '';

    const seedArray = `ARRAY[${seedNodeIds.map((id) => `'${id}'::uuid`).join(',')}]`;

    const sql = `
      WITH RECURSIVE reachable AS (
        SELECT id AS node_id, 0 AS depth
        FROM heady_graph_nodes
        WHERE id = ANY(${seedArray})

        UNION ALL

        SELECT e.target_id, r.depth + 1
        FROM heady_graph_edges e
        JOIN reachable r ON r.node_id = e.source_id
        WHERE r.depth < $2 AND e.weight >= $1
        ${edgeFilter}
      )
      SELECT DISTINCT e.*,
             sn.label AS source_label,
             tn.label AS target_label
      FROM heady_graph_edges e
      JOIN heady_graph_nodes sn ON sn.id = e.source_id
      JOIN heady_graph_nodes tn ON tn.id = e.target_id
      WHERE e.source_id IN (SELECT node_id FROM reachable)
        AND e.target_id IN (SELECT node_id FROM reachable)
        AND e.weight >= $1
      ORDER BY e.weight DESC
    `;

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  // ── Graph RAG retrieval ───────────────────────────────────────────────────

  /**
   * Graph RAG: entity-anchored vector retrieval.
   *
   * Steps:
   * 1. Find entity/concept nodes semantically similar to the query
   * 2. Traverse their neighborhood (multi-hop)
   * 3. Collect all chunk/document nodes in the subgraph
   * 4. Return assembled context sorted by relevance
   *
   * @param {object} opts
   * @param {string} opts.collection - collection name or ID
   * @param {Float32Array|number[]} opts.vector - query embedding
   * @param {string} [opts.query] - text query (for BM25 entity matching)
   * @param {number} [opts.topK=10]
   * @param {number} [opts.entityTopK=5] - how many anchor entities to find
   * @param {number} [opts.maxDepth=2]
   * @param {string[]} [opts.nodeTypes=['document','chunk']] - types to include in context
   * @param {string[]} [opts.edgeTypes] - edge type filter for traversal
   * @param {boolean} [opts.includePaths=true] - include graph path info in results
   * @returns {Promise<{context: object[], entities: object[], graph: object, latencyMs: number}>}
   */
  async rag(opts) {
    const {
      collection: collectionName,
      vector,
      query,
      topK = config.search.defaultTopK,
      entityTopK = 5,
      maxDepth = 2,
      nodeTypes = ['document', 'chunk'],
      edgeTypes,
      includePaths = true,
    } = opts;

    const start = Date.now();

    // Step 1: Find anchor entity nodes via semantic search on graph nodes
    const anchorNodes = await this._findAnchorNodes({
      vector,
      query,
      collectionName,
      entityTopK,
      nodeTypes: ['entity', 'concept'],
    });

    if (anchorNodes.length === 0) {
      // Fallback: direct vector search
      return {
        context: [],
        entities: [],
        graph: { nodes: [], edges: [] },
        latencyMs: Date.now() - start,
        fallback: true,
      };
    }

    const seedNodeIds = anchorNodes.map((n) => n.id);

    // Step 2: Traverse from anchor nodes
    const graph = await this.traverse({
      seedNodeIds,
      maxDepth,
      maxNodes: config.graph.maxNodes,
      edgeTypes,
      direction: 'both',
    });

    // Step 3: Filter graph nodes to desired types
    const contextNodes = graph.nodes.filter((n) => nodeTypes.includes(n.node_type));

    // Step 4: Score and rank context nodes
    const ranked = await this._scoreContextNodes(contextNodes, vector, query);
    const topContext = ranked.slice(0, topK);

    // Step 5: Assemble context with path information
    const context = includePaths
      ? topContext.map((node) => ({
          ...node,
          graph_paths: graph.nodes.find((n) => n.id === node.id)?.paths || [],
        }))
      : topContext;

    return {
      context,
      entities: anchorNodes,
      graph: includePaths ? graph : { nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
      latencyMs: Date.now() - start,
      queryType: 'graph-rag',
    };
  }

  /**
   * Find anchor entity/concept nodes using semantic similarity.
   * Searches heady_graph_nodes directly by vector distance.
   * @private
   */
  async _findAnchorNodes({ vector, query, collectionName, entityTopK, nodeTypes }) {
    const nodeTypeFilter = nodeTypes && nodeTypes.length > 0
      ? `AND node_type = ANY(ARRAY[${nodeTypes.map((t) => `'${t}'`).join(',')}]::text[])`
      : '';

    const params = [];

    if (vector) {
      const vecLiteral = `[${Array.from(vector).join(',')}]`;
      params.push(vecLiteral);
      params.push(entityTopK);

      const sql = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similarity_score
        FROM heady_graph_nodes
        WHERE embedding IS NOT NULL
          ${nodeTypeFilter}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;
      const result = await this.pool.query(sql, params);
      return result.rows;
    }

    if (query) {
      const sql = `
        SELECT *, ts_rank(content_tsv, plainto_tsquery('english', $1)) AS similarity_score
        FROM heady_graph_nodes
        WHERE content_tsv @@ plainto_tsquery('english', $1)
          ${nodeTypeFilter}
        ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $1)) DESC
        LIMIT $2
      `;
      const result = await this.pool.query(sql, [query, entityTopK]);
      return result.rows;
    }

    return [];
  }

  /**
   * Score and rank context nodes by relevance.
   * Uses vector similarity if embeddings present, else falls back to page_rank.
   * @private
   */
  async _scoreContextNodes(nodes, vector, query) {
    if (nodes.length === 0) return [];

    if (vector) {
      const vecArray = Array.from(vector);
      const parseVec = (v) => {
        if (!v) return null;
        const inner = String(v).replace(/^\[|\]$/g, '');
        return inner.split(',').map(Number);
      };
      const cosineSim = (a, b) => {
        if (!a || !b || a.length !== b.length) return 0;
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          na += a[i] * a[i];
          nb += b[i] * b[i];
        }
        const d = Math.sqrt(na) * Math.sqrt(nb);
        return d === 0 ? 0 : dot / d;
      };

      return nodes
        .map((n) => ({
          ...n,
          context_score: cosineSim(vecArray, parseVec(n.embedding)),
        }))
        .sort((a, b) => b.context_score - a.context_score);
    }

    // Sort by page_rank
    return [...nodes].sort((a, b) => (b.page_rank || 0) - (a.page_rank || 0));
  }

  // ── Community detection ───────────────────────────────────────────────────

  /**
   * Simplified community detection using weighted connectivity.
   * Groups nodes by their edge density into communities.
   * Updates community_id on all nodes in the collection.
   *
   * Uses a greedy label propagation approach (Louvain-inspired).
   *
   * @param {object} [opts]
   * @param {string} [opts.collectionId]
   * @param {number} [opts.maxIterations=10]
   * @returns {Promise<{communities: number, iterations: number}>}
   */
  async detectCommunities(opts = {}) {
    const { collectionId, maxIterations = 10 } = opts;

    const collectionFilter = collectionId ? `WHERE n.collection_id = $1` : '';
    const params = collectionId ? [collectionId] : [];

    // Fetch all nodes
    const nodesResult = await this.pool.query(
      `SELECT id, community_id, page_rank FROM heady_graph_nodes ${collectionFilter}`,
      params
    );

    if (nodesResult.rows.length === 0) return { communities: 0, iterations: 0 };

    // Initialize: each node in its own community
    const communityMap = new Map(nodesResult.rows.map((n, i) => [n.id, i]));

    // Fetch edges
    const edgeFilter = collectionId
      ? `WHERE sn.collection_id = $1`
      : '';
    const edgesResult = await this.pool.query(
      `SELECT e.source_id, e.target_id, e.weight
       FROM heady_graph_edges e
       JOIN heady_graph_nodes sn ON sn.id = e.source_id
       ${edgeFilter}
       ORDER BY e.weight DESC`,
      params
    );

    const edges = edgesResult.rows;
    let iterations = 0;

    // Label propagation
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = 0;
      const nodeIds = [...communityMap.keys()];

      // Shuffle for randomness
      for (let i = nodeIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nodeIds[i], nodeIds[j]] = [nodeIds[j], nodeIds[i]];
      }

      for (const nodeId of nodeIds) {
        // Count community votes from neighbors
        const communityVotes = new Map();
        for (const edge of edges) {
          let neighborId = null;
          if (edge.source_id === nodeId) neighborId = edge.target_id;
          else if (edge.target_id === nodeId) neighborId = edge.source_id;
          if (!neighborId) continue;

          const neighborCommunity = communityMap.get(neighborId);
          if (neighborCommunity === undefined) continue;
          const current = communityVotes.get(neighborCommunity) || 0;
          communityVotes.set(neighborCommunity, current + edge.weight);
        }

        if (communityVotes.size > 0) {
          // Choose community with max votes
          let maxVotes = 0;
          let bestCommunity = communityMap.get(nodeId);
          for (const [comm, votes] of communityVotes) {
            if (votes > maxVotes) {
              maxVotes = votes;
              bestCommunity = comm;
            }
          }

          if (bestCommunity !== communityMap.get(nodeId)) {
            communityMap.set(nodeId, bestCommunity);
            changed++;
          }
        }
      }

      iterations++;
      if (changed === 0) break; // Converged
    }

    // Re-number communities sequentially
    const uniqueCommunities = [...new Set(communityMap.values())];
    const communityIndex = new Map(uniqueCommunities.map((c, i) => [c, i]));

    // Bulk update nodes
    if (communityMap.size > 0) {
      const caseStatements = [...communityMap.entries()]
        .map(([id, comm]) => `WHEN id = '${id}'::uuid THEN ${communityIndex.get(comm)}`)
        .join('\n');

      await this.pool.query(
        `UPDATE heady_graph_nodes SET community_id = CASE ${caseStatements} END
         WHERE id IN (${[...communityMap.keys()].map((id) => `'${id}'::uuid`).join(',')})`
      );
    }

    // Update community summary table
    const communityGroups = new Map();
    for (const [nodeId, comm] of communityMap) {
      const normalized = communityIndex.get(comm);
      if (!communityGroups.has(normalized)) communityGroups.set(normalized, []);
      communityGroups.get(normalized).push(nodeId);
    }

    for (const [commId, nodeIds] of communityGroups) {
      await this.pool.query(
        `INSERT INTO heady_graph_communities (id, collection_id, node_count)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET node_count = EXCLUDED.node_count`,
        [commId, collectionId || null, nodeIds.length]
      );
    }

    return {
      communities: uniqueCommunities.length,
      iterations,
      nodeCount: communityMap.size,
    };
  }

  /**
   * Compute PageRank scores for all nodes (simplified power iteration).
   * @param {object} [opts]
   * @param {string} [opts.collectionId]
   * @param {number} [opts.dampingFactor=0.85]
   * @param {number} [opts.iterations=20]
   * @returns {Promise<{updated: number}>}
   */
  async computePageRank(opts = {}) {
    const { collectionId, dampingFactor = 0.85, iterations = 20 } = opts;

    const collectionFilter = collectionId ? `WHERE collection_id = $1` : '';
    const params = collectionId ? [collectionId] : [];

    const nodesResult = await this.pool.query(
      `SELECT id FROM heady_graph_nodes ${collectionFilter}`,
      params
    );

    if (nodesResult.rows.length === 0) return { updated: 0 };

    const N = nodesResult.rows.length;
    const nodeIds = nodesResult.rows.map((r) => r.id);
    const nodeIndex = new Map(nodeIds.map((id, i) => [id, i]));

    // Fetch adjacency
    const edgesResult = await this.pool.query(
      `SELECT e.source_id, e.target_id, e.weight
       FROM heady_graph_edges e
       JOIN heady_graph_nodes sn ON sn.id = e.source_id
       ${collectionFilter}`,
      params
    );

    // Build out-degree map
    const outDegree = new Array(N).fill(0);
    const adjList = new Array(N).fill(null).map(() => []);

    for (const edge of edgesResult.rows) {
      const si = nodeIndex.get(edge.source_id);
      const ti = nodeIndex.get(edge.target_id);
      if (si !== undefined && ti !== undefined) {
        adjList[ti].push({ from: si, weight: edge.weight });
        outDegree[si] += edge.weight;
      }
    }

    // Power iteration
    let ranks = new Array(N).fill(1 / N);
    for (let iter = 0; iter < iterations; iter++) {
      const newRanks = new Array(N).fill((1 - dampingFactor) / N);
      for (let i = 0; i < N; i++) {
        for (const { from, weight } of adjList[i]) {
          if (outDegree[from] > 0) {
            newRanks[i] += dampingFactor * ranks[from] * (weight / outDegree[from]);
          }
        }
      }
      ranks = newRanks;
    }

    // Bulk update page_rank
    if (nodeIds.length > 0) {
      const caseStatements = nodeIds
        .map((id, i) => `WHEN id = '${id}'::uuid THEN ${ranks[i]}`)
        .join('\n');

      await this.pool.query(
        `UPDATE heady_graph_nodes SET page_rank = CASE ${caseStatements} END
         WHERE id IN (${nodeIds.map((id) => `'${id}'::uuid`).join(',')})`
      );
    }

    return { updated: N };
  }

  // ── Visualization ─────────────────────────────────────────────────────────

  /**
   * Export graph data for visualization (D3.js / Cytoscape.js format).
   * @param {object} [opts]
   * @param {string} [opts.collectionId]
   * @param {number} [opts.limit=500] - max nodes to export
   * @param {string[]} [opts.nodeTypes]
   * @param {number} [opts.minEdgeWeight=0.1]
   * @returns {Promise<{nodes: object[], edges: object[]}>}
   */
  async exportVisualization(opts = {}) {
    const {
      collectionId,
      limit = 500,
      nodeTypes,
      minEdgeWeight = 0.1,
    } = opts;

    const params = [];
    const conditions = [];

    if (collectionId) {
      params.push(collectionId);
      conditions.push(`n.collection_id = $${params.length}`);
    }

    if (nodeTypes && nodeTypes.length > 0) {
      params.push(nodeTypes);
      conditions.push(`n.node_type = ANY($${params.length}::text[])`);
    }

    params.push(limit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [nodesResult, edgesResult] = await Promise.all([
      this.pool.query(
        `SELECT
           id, label, node_type, content,
           properties, community_id, page_rank, created_at
         FROM heady_graph_nodes n
         ${whereClause}
         ORDER BY page_rank DESC
         LIMIT $${params.length}`,
        params
      ),
      this.pool.query(
        `SELECT
           e.id, e.source_id, e.target_id, e.edge_type,
           e.label, e.weight, e.bidirectional
         FROM heady_graph_edges e
         JOIN heady_graph_nodes sn ON sn.id = e.source_id
         JOIN heady_graph_nodes tn ON tn.id = e.target_id
         WHERE e.weight >= $1
         ${collectionId ? `AND sn.collection_id = '${collectionId}'` : ''}
         ORDER BY e.weight DESC`,
        [minEdgeWeight]
      ),
    ]);

    // D3-compatible format
    const nodeIds = new Set(nodesResult.rows.map((n) => n.id));
    const filteredEdges = edgesResult.rows.filter(
      (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)
    );

    return {
      nodes: nodesResult.rows.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.node_type,
        content: n.content,
        properties: n.properties,
        community: n.community_id,
        pageRank: n.page_rank,
        createdAt: n.created_at,
        // D3/Cytoscape extras
        group: n.community_id,
        value: n.page_rank || 1,
      })),
      edges: filteredEdges.map((e) => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: e.edge_type,
        label: e.label,
        weight: e.weight,
        bidirectional: e.bidirectional,
      })),
      meta: {
        nodeCount: nodesResult.rows.length,
        edgeCount: filteredEdges.rows,
        collectionId,
      },
    };
  }

  /**
   * Path-based context assembly: find all paths between two nodes.
   * Uses recursive CTE with path tracking.
   *
   * @param {object} opts
   * @param {string} opts.sourceId
   * @param {string} opts.targetId
   * @param {number} [opts.maxDepth=5]
   * @param {number} [opts.maxPaths=10]
   * @returns {Promise<{paths: Array<{nodes: object[], edges: object[], weight: number}>}>}
   */
  async findPaths(opts) {
    const { sourceId, targetId, maxDepth = 5, maxPaths = 10 } = opts;

    const sql = `
      WITH RECURSIVE path_search AS (
        -- Start from source
        SELECT
          $1::uuid AS current_node,
          ARRAY[$1::text] AS path,
          ARRAY[]::text[] AS edge_ids,
          0 AS depth,
          1.0::float AS weight
        WHERE $1::uuid != $2::uuid

        UNION ALL

        SELECT
          e.target_id,
          ps.path || e.target_id::text,
          ps.edge_ids || e.id::text,
          ps.depth + 1,
          ps.weight * e.weight
        FROM heady_graph_edges e
        JOIN path_search ps ON ps.current_node = e.source_id
        WHERE ps.depth < $3
          AND NOT e.target_id::text = ANY(ps.path) -- no cycles
      )
      SELECT path, edge_ids, depth, weight
      FROM path_search
      WHERE current_node = $2::uuid
      ORDER BY weight DESC, depth ASC
      LIMIT $4
    `;

    const result = await this.pool.query(sql, [sourceId, targetId, maxDepth, maxPaths]);

    const paths = await Promise.all(
      result.rows.map(async (row) => {
        const nodeIds = row.path;
        const edgeIds = row.edge_ids;

        const [nodes, edges] = await Promise.all([
          this.pool.query(
            `SELECT * FROM heady_graph_nodes WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::text[], id::text)`,
            [nodeIds]
          ),
          edgeIds.length > 0
            ? this.pool.query(
                `SELECT * FROM heady_graph_edges WHERE id = ANY($1::uuid[])`,
                [edgeIds]
              )
            : Promise.resolve({ rows: [] }),
        ]);

        return {
          nodes: nodes.rows,
          edges: edges.rows,
          depth: row.depth,
          weight: row.weight,
          pathIds: nodeIds,
        };
      })
    );

    return { paths, sourceId, targetId };
  }
}

module.exports = { GraphRAG };
