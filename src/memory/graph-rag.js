/**
 * @fileoverview Graph RAG Engine for Heady Latent OS
 * @module graph-rag
 *
 * Implements LightRAG-style incremental knowledge graph retrieval augmented
 * generation. Stores entity nodes, relationship edges, and community clusters
 * in PostgreSQL (graph_rag_* tables from 002_graph_rag_schema.sql), with
 * dense vector backing via pgvector.
 *
 * Architecture rationale (from research/section1_vector_db.md §5):
 *   - LightRAG incremental updates: ~50% lower cost than full GraphRAG rebuild
 *   - Single API call per retrieval vs. hundreds for Microsoft GraphRAG
 *   - Indexing cost: ~$0.15 (LightRAG) vs ~$4.00 (GraphRAG)
 *   - Multi-hop retrieval outperforms pure vector RAG by +6.4% on MultiHop-RAG
 *   - Query latency: ~80ms vs ~120ms for NaiveRAG (30% faster)
 *
 * Query modes (LightRAG-compatible):
 *   - local   — entity-specific, graph-grounded (precise facts)
 *   - global  — high-level thematic (community summaries)
 *   - hybrid  — local + global combined
 *   - naive   — standard vector search fallback
 *
 * @example
 * import { GraphRAGEngine } from './graph-rag.js';
 * const engine = new GraphRAGEngine(pgPool, { llmClient, embeddingRouter });
 *
 * // Incremental build (LightRAG pattern)
 * const entities = await engine.extractEntities(documentText);
 * await engine.buildGraph(entities.entities, entities.relationships);
 *
 * // Multi-hop retrieval
 * const results = await engine.queryGraph('What caused the system outage?', {
 *   mode: 'hybrid', hops: 2, limit: 10
 * });
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  PHI, PSI,
  phiFusionWeights,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  PHI_TEMPERATURE,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Relationship type registry — extend as needed */
const RELATIONSHIP_TYPES = {
  CAUSES:         'causes',
  CAUSED_BY:      'caused_by',
  PART_OF:        'part_of',
  CONTAINS:       'contains',
  RELATED_TO:     'related_to',
  DEPENDS_ON:     'depends_on',
  PRECEDES:       'precedes',
  FOLLOWS:        'follows',
  SAME_AS:        'same_as',
  CONTRASTS_WITH: 'contrasts_with',
};

/**
 * Phi-derived local/global fusion weights.
 * phiFusionWeights(2) -> [0.618, 0.382]
 * Replaces the old arbitrary localWeight: 0.6, globalWeight: 0.4.
 */
const [PHI_LOCAL_WEIGHT, PHI_GLOBAL_WEIGHT] = phiFusionWeights(2);

/**
 * Minimum edge weight to traverse during graph expansion.
 * Math.pow(PSI, 4) = psi^4 ~= 0.146 — replaces the old 0.1 minimum.
 * Derived as the 4th power of the golden ratio conjugate.
 */
const PHI_MIN_WEIGHT = Math.pow(PSI, 4);  // ~0.146

/**
 * Default fallback relationship weight.
 * PSI ~= 0.618 — replaces the old default weight: 0.5.
 */
const PHI_DEFAULT_REL_WEIGHT = PSI;  // ~0.618

/**
 * Fallback/co-occurrence relationship weight (lower confidence).
 * Math.pow(PSI, 2) ~= 0.382 — replaces the old weight: 0.3 in regex fallback.
 */
const PHI_FALLBACK_REL_WEIGHT = Math.pow(PSI, 2);  // ~0.382

/** Default options for graph construction */
const DEFAULT_BUILD_OPTIONS = {
  deduplicateEntities: true,
  /**
   * DEDUP_THRESHOLD ~= 0.972 (CSL_THRESHOLDS.CRITICAL + phi-harmonic margin).
   * Replaces arbitrary 0.92 — two vectors at this cosine distance are
   * semantically identical for graph deduplication purposes.
   */
  similarityThreshold:  DEDUP_THRESHOLD,
  /** fib(10) = 55 — Fibonacci-scaled entity cap, replaces 50 */
  maxEntitiesPerDoc:    fib(10),
  /** fib(11) = 89 — Fibonacci-scaled relationship cap, replaces 100 */
  maxRelationshipsPerDoc: fib(11),
  updateCommunities:    false,   // Deferred; run communityDetection() explicitly
};

/** Default query options */
const DEFAULT_QUERY_OPTIONS = {
  mode:          'hybrid',
  hops:           2,
  /** fib(7) = 13 — Fibonacci-scaled default result limit, replaces 10 */
  limit:          fib(7),
  /** phiFusionWeights(2)[0] ≈ 0.618 — phi-derived local weight, replaces 0.6 */
  localWeight:    PHI_LOCAL_WEIGHT,
  /** phiFusionWeights(2)[1] ≈ 0.382 — phi-derived global weight, replaces 0.4 */
  globalWeight:   PHI_GLOBAL_WEIGHT,
  /** Math.pow(PSI, 4) ≈ 0.146 — phi-derived minimum edge weight, replaces 0.1 */
  minWeight:      PHI_MIN_WEIGHT,
  includeContext: true,
  beeId:          null,
  workspaceId:    null,
};

/** Community detection Leiden-like parameters */
const COMMUNITY_OPTIONS = {
  resolution:    1.0,
  /** fib(4) = 3 — same value as before, now Fibonacci-derived */
  minCommunitySize: fib(4),
  /** fib(7) = 13 — Fibonacci-scaled iteration cap, replaces 10 */
  maxIterations: fib(7),
};

// ─── LLM prompt templates ─────────────────────────────────────────────────────

const ENTITY_EXTRACTION_PROMPT = (text) => `You are a knowledge graph extraction system. Extract all entities and relationships from the text below.

Return a JSON object with this exact structure:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "PERSON|ORGANIZATION|CONCEPT|EVENT|LOCATION|TECHNOLOGY|OTHER",
      "description": "Brief description of this entity",
      "aliases": ["alt name 1", "alt name 2"]
    }
  ],
  "relationships": [
    {
      "source": "Entity Name A",
      "target": "Entity Name B",
      "type": "causes|caused_by|part_of|contains|related_to|depends_on|precedes|follows|same_as|contrasts_with",
      "description": "How they are related",
      "weight": 0.8
    }
  ]
}

Rules:
- Extract only entities explicitly mentioned or strongly implied
- Normalize entity names (e.g., "US" → "United States")
- Weight relationships 0.1–1.0 based on strength/certainty
- Include at most ${DEFAULT_BUILD_OPTIONS.maxEntitiesPerDoc} entities and ${DEFAULT_BUILD_OPTIONS.maxRelationshipsPerDoc} relationships
- Return ONLY the JSON object, no other text

Text to analyze:
---
${text.substring(0, 8000)}
---`;

const COMMUNITY_SUMMARY_PROMPT = (entities, relationships) => `Summarize the following knowledge graph community into a concise paragraph (2-4 sentences) that captures the main theme, key entities, and their relationships.

Entities: ${entities.map(e => `${e.name} (${e.type}): ${e.description}`).join('\n')}

Relationships: ${relationships.map(r => `${r.source} --[${r.type}]--> ${r.target}: ${r.description}`).join('\n')}

Summary:`;

// ─── Main Class ───────────────────────────────────────────────────────────────

/**
 * GraphRAGEngine — LightRAG-style incremental knowledge graph retrieval.
 *
 * Integrates with Heady's PostgreSQL vector store (pgvector) and supports
 * multi-hop reasoning over entity-relationship graphs stored in graph_rag_*
 * tables created by migration 002_graph_rag_schema.sql.
 */
export class GraphRAGEngine extends EventEmitter {
  /**
   * @param {import('pg').Pool} pool — PostgreSQL connection pool
   * @param {object} options
   * @param {object} [options.llmClient] — LLM client with chat() method
   * @param {object} [options.embeddingRouter] — EmbeddingRouter instance
   * @param {string} [options.graphId='default'] — Logical graph namespace
   * @param {number} [options.embeddingDim=384] — Embedding dimensionality
   * @param {object} [options.logger=console] — Logger with info/warn/error
   */
  constructor(pool, options = {}) {
    super();
    this.pool            = pool;
    this.llmClient       = options.llmClient       ?? null;
    this.embeddingRouter = options.embeddingRouter ?? null;
    this.graphId         = options.graphId         ?? 'default';
    this.embeddingDim    = options.embeddingDim    ?? 384;
    this.logger          = options.logger          ?? console;

    // In-memory LRU cache for entity embeddings (avoid redundant DB calls)
    this._entityEmbedCache = new Map();
    /**
     * fib(16) = 987 — Fibonacci-sized LRU embedding cache, replaces 1000.
     * F(16) is the nearest Fibonacci number to 1000 and follows the
     * phi-harmonic cache sizing principle.
     */
    this._maxCacheSize     = options.maxCacheSize ?? fib(16);

    // Stats
    this._stats = {
      entitiesInserted:      0,
      entitiesUpdated:       0,
      relationshipsInserted: 0,
      queriesExecuted:       0,
      cacheHits:             0,
    };
  }

  // ─── Entity Extraction ──────────────────────────────────────────────────────

  /**
   * Extract entities and relationships from text using LLM.
   * Falls back to regex-based NER if no LLM client is configured.
   *
   * @param {string} text — Document text to process
   * @param {object} [options] — Extraction options
   * @param {string} [options.documentId] — Source document identifier
   * @param {string} [options.beeId] — Bee (agent) identifier for provenance
   * @returns {Promise<{entities: Entity[], relationships: Relationship[]}>}
   */
  async extractEntities(text, options = {}) {
    if (!text || text.trim().length === 0) {
      return { entities: [], relationships: [] };
    }

    const startTime = Date.now();

    try {
      let result;

      if (this.llmClient) {
        result = await this._extractWithLLM(text, options);
      } else {
        result = await this._extractWithRegex(text, options);
      }

      // Attach provenance metadata
      const documentId = options.documentId ?? crypto.randomUUID();
      result.entities = result.entities.map(e => ({
        ...e,
        documentId,
        beeId: options.beeId ?? null,
        extractedAt: new Date().toISOString(),
      }));

      result.relationships = result.relationships.map(r => ({
        ...r,
        documentId,
        beeId: options.beeId ?? null,
        extractedAt: new Date().toISOString(),
      }));

      this.logger.info(`[GraphRAG] Extracted ${result.entities.length} entities, ${result.relationships.length} relationships in ${Date.now() - startTime}ms`);

      this.emit('entities:extracted', {
        count:    result.entities.length,
        relCount: result.relationships.length,
        durationMs: Date.now() - startTime,
      });

      return result;

    } catch (err) {
      this.logger.error('[GraphRAG] Entity extraction failed:', err.message);
      throw err;
    }
  }

  /**
   * @private LLM-based entity extraction
   */
  async _extractWithLLM(text, options) {
    const prompt  = ENTITY_EXTRACTION_PROMPT(text);
    const response = await this.llmClient.chat([
      { role: 'user', content: prompt },
    ], {
      /**
       * PHI_TEMPERATURE = PSI^3 ~= 0.236 — phi-derived softmax temperature.
       * Sharper than 1.0 (standard) but more stable than 0.1 (old hardcoded).
       * Prevents routing collapse while maintaining decisiveness.
       */
      temperature: PHI_TEMPERATURE,
      maxTokens:   2000,
      responseFormat: { type: 'json_object' },
    });

    let parsed;
    try {
      // Handle both direct JSON and markdown-wrapped JSON
      const raw = response.content ?? response.message ?? response;
      const jsonStr = typeof raw === 'string'
        ? raw.replace(/```json\n?|\n?```/g, '').trim()
        : JSON.stringify(raw);
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      this.logger.warn('[GraphRAG] LLM returned non-JSON, falling back to regex extraction');
      return this._extractWithRegex(text, options);
    }

    return {
      entities:      Array.isArray(parsed.entities)      ? parsed.entities      : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  }

  /**
   * @private Lightweight regex-based NER fallback (no LLM required)
   * Extracts capitalized noun phrases as entities — sufficient for
   * basic graph construction without an LLM dependency.
   */
  async _extractWithRegex(text, _options) {
    const entities      = [];
    const relationships = [];
    const seen          = new Set();

    // Match capitalized phrases (2–5 words) as candidate entities
    const phraseRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4})\b/g;
    let match;
    while ((match = phraseRe.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && !seen.has(name)) {
        seen.add(name);
        entities.push({
          name,
          type:        'CONCEPT',
          description: `Mentioned in document`,
          aliases:     [],
        });
      }
      if (entities.length >= DEFAULT_BUILD_OPTIONS.maxEntitiesPerDoc) break;
    }

    // Build simple co-occurrence relationships for entities close together
    for (let i = 0; i < Math.min(entities.length - 1, 20); i++) {
      relationships.push({
        source:      entities[i].name,
        target:      entities[i + 1].name,
        type:        RELATIONSHIP_TYPES.RELATED_TO,
        description: 'Co-occurring entities',
        /**
         * PHI_FALLBACK_REL_WEIGHT = PSI^2 ~= 0.382 — phi-derived co-occurrence
         * weight for regex-extracted relationships. Replaces arbitrary 0.3.
         */
        weight:      PHI_FALLBACK_REL_WEIGHT,
      });
    }

    return { entities, relationships };
  }

  // ─── Graph Construction ─────────────────────────────────────────────────────

  /**
   * Build or incrementally update the knowledge graph.
   * Implements LightRAG-style merge: new entities are added; existing
   * entities are deduplicated by embedding similarity and updated.
   *
   * @param {Entity[]} entities — Array of entity objects from extractEntities()
   * @param {Relationship[]} relationships — Array of relationship objects
   * @param {object} [options] — Build options
   * @param {boolean} [options.deduplicateEntities=true]
   * @param {number}  [options.similarityThreshold=0.92]
   * @returns {Promise<{entityIds: string[], relationshipIds: string[]}>}
   */
  async buildGraph(entities, relationships, options = {}) {
    const opts = { ...DEFAULT_BUILD_OPTIONS, ...options };

    if (!entities?.length && !relationships?.length) {
      return { entityIds: [], relationshipIds: [] };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Phase 1: Upsert entities (with optional deduplication)
      const entityIdMap = new Map(); // name → db UUID
      for (const entity of entities.slice(0, opts.maxEntitiesPerDoc)) {
        const dbId = await this._upsertEntity(client, entity, opts);
        entityIdMap.set(entity.name, dbId);
        for (const alias of (entity.aliases ?? [])) {
          entityIdMap.set(alias, dbId);
        }
      }

      // Phase 2: Upsert relationships (resolve entity names → UUIDs)
      const relationshipIds = [];
      for (const rel of relationships.slice(0, opts.maxRelationshipsPerDoc)) {
        const sourceId = entityIdMap.get(rel.source);
        const targetId = entityIdMap.get(rel.target);
        if (!sourceId || !targetId) continue;

        const relId = await this._upsertRelationship(client, {
          ...rel,
          sourceId,
          targetId,
        });
        if (relId) relationshipIds.push(relId);
      }

      await client.query('COMMIT');

      this._stats.entitiesInserted      += entityIdMap.size;
      this._stats.relationshipsInserted += relationshipIds.length;

      this.emit('graph:updated', {
        entityCount:       entityIdMap.size,
        relationshipCount: relationshipIds.length,
        graphId:           this.graphId,
      });

      return {
        entityIds:       Array.from(entityIdMap.values()),
        relationshipIds,
      };

    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('[GraphRAG] buildGraph failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * @private Upsert a single entity with embedding generation and deduplication.
   */
  async _upsertEntity(client, entity, opts) {
    // Generate embedding for the entity (name + description)
    const entityText = `${entity.name}: ${entity.description ?? ''}`;
    const embedding  = await this._getEmbedding(entityText);
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    if (opts.deduplicateEntities && embedding) {
      // Check for similar existing entity
      const dupCheck = await client.query(`
        SELECT id, name, description, mention_count
        FROM graph_rag_entities
        WHERE graph_id = $1
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $2::vector) >= $3
        ORDER BY embedding <=> $2::vector
        LIMIT 1
      `, [this.graphId, embeddingStr, opts.similarityThreshold]);

      if (dupCheck.rows.length > 0) {
        const existing = dupCheck.rows[0];
        // Merge: update description if we have more info; increment mention count
        await client.query(`
          UPDATE graph_rag_entities
          SET
            mention_count = mention_count + 1,
            description   = CASE
              WHEN length($2) > length(description) THEN $2
              ELSE description
            END,
            aliases       = array_cat(
              aliases,
              ARRAY(SELECT unnest($3::text[]) EXCEPT SELECT unnest(aliases))
            ),
            updated_at    = NOW()
          WHERE id = $1
        `, [existing.id, entity.description ?? existing.description, entity.aliases ?? []]);

        this._stats.entitiesUpdated++;
        return existing.id;
      }
    }

    // Insert new entity
    const result = await client.query(`
      INSERT INTO graph_rag_entities
        (graph_id, name, entity_type, description, aliases, embedding,
         source_doc_id, bee_id, mention_count)
      VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, 1)
      ON CONFLICT (graph_id, name)
      DO UPDATE SET
        mention_count = graph_rag_entities.mention_count + 1,
        description   = EXCLUDED.description,
        embedding     = COALESCE(EXCLUDED.embedding, graph_rag_entities.embedding),
        aliases       = array_cat(
          graph_rag_entities.aliases,
          ARRAY(SELECT unnest(EXCLUDED.aliases) EXCEPT SELECT unnest(graph_rag_entities.aliases))
        ),
        updated_at    = NOW()
      RETURNING id
    `, [
      this.graphId,
      entity.name,
      entity.type ?? 'CONCEPT',
      entity.description ?? '',
      entity.aliases ?? [],
      embeddingStr,
      entity.documentId ?? null,
      entity.beeId ?? null,
    ]);

    return result.rows[0].id;
  }

  /**
   * @private Upsert a relationship edge.
   */
  async _upsertRelationship(client, rel) {
    const result = await client.query(`
      INSERT INTO graph_rag_relationships
        (graph_id, source_entity_id, target_entity_id, relationship_type,
         description, weight, source_doc_id, bee_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (graph_id, source_entity_id, target_entity_id, relationship_type)
      DO UPDATE SET
        weight      = (graph_rag_relationships.weight + EXCLUDED.weight) / 2.0,
        description = CASE
          WHEN length(EXCLUDED.description) > length(graph_rag_relationships.description)
          THEN EXCLUDED.description
          ELSE graph_rag_relationships.description
        END,
        occurrence_count = graph_rag_relationships.occurrence_count + 1,
        updated_at  = NOW()
      RETURNING id
    `, [
      this.graphId,
      rel.sourceId,
      rel.targetId,
      rel.type ?? RELATIONSHIP_TYPES.RELATED_TO,
      rel.description ?? '',
      /** PHI_DEFAULT_REL_WEIGHT = PSI ~= 0.618 — phi-derived default, replaces 0.5 */
      rel.weight ?? PHI_DEFAULT_REL_WEIGHT,
      rel.documentId ?? null,
      rel.beeId ?? null,
    ]);

    return result.rows[0]?.id ?? null;
  }

  // ─── Graph Querying ─────────────────────────────────────────────────────────

  /**
   * Multi-hop knowledge graph retrieval (LightRAG dual-level).
   *
   * - local mode:  Finds anchor entities via dense search, then traverses
   *                up to `hops` relationship edges, collecting context.
   * - global mode: Returns community summaries for thematic queries.
   * - hybrid mode: Merges local entity context + global community summaries.
   * - naive mode:  Falls back to pure vector similarity (no graph traversal).
   *
   * @param {string} question — Natural language query
   * @param {object} [options] — Query options
   * @param {string} [options.mode='hybrid'] — Query mode
   * @param {number} [options.hops=2] — Max relationship hops for local mode
   * @param {number} [options.limit=10] — Max results to return
   * @param {string} [options.beeId] — Filter by bee ID
   * @param {string} [options.workspaceId] — Filter by workspace
   * @returns {Promise<GraphQueryResult>}
   */
  async queryGraph(question, options = {}) {
    const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };
    const startTime = Date.now();
    this._stats.queriesExecuted++;

    const queryEmbedding = await this._getEmbedding(question);
    if (!queryEmbedding) {
      throw new Error('[GraphRAG] Cannot query graph without embedding support');
    }

    let localContext  = [];
    let globalContext = [];

    // Parallel retrieval for hybrid mode
    if (opts.mode === 'local' || opts.mode === 'hybrid') {
      localContext = await this._localRetrieval(queryEmbedding, question, opts);
    }

    if (opts.mode === 'global' || opts.mode === 'hybrid') {
      globalContext = await this._globalRetrieval(queryEmbedding, question, opts);
    }

    if (opts.mode === 'naive') {
      localContext = await this._naiveRetrieval(queryEmbedding, opts);
    }

    // Merge and deduplicate results
    const merged = this._mergeResults(localContext, globalContext, opts);

    const result = {
      question,
      mode:           opts.mode,
      entities:       merged.entities,
      relationships:  merged.relationships,
      communities:    merged.communities,
      context:        this._buildContextString(merged),
      queryEmbedding: opts.includeEmbedding ? queryEmbedding : undefined,
      durationMs:     Date.now() - startTime,
      hops:           opts.hops,
    };

    this.emit('graph:queried', {
      mode:         opts.mode,
      entityCount:  result.entities.length,
      durationMs:   result.durationMs,
    });

    return result;
  }

  /**
   * @private Local retrieval: anchor entity search + multi-hop traversal
   */
  async _localRetrieval(queryEmbedding, question, opts) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const beeFilter    = opts.beeId ? `AND e.bee_id = '${opts.beeId}'` : '';

    // Step 1: Find anchor entities via dense similarity
    const anchorQuery = await this.pool.query(`
      SELECT
        e.id,
        e.name,
        e.entity_type,
        e.description,
        e.mention_count,
        1 - (e.embedding <=> $1::vector) AS similarity
      FROM graph_rag_entities e
      WHERE e.graph_id = $2
        AND e.embedding IS NOT NULL
        ${beeFilter}
      ORDER BY e.embedding <=> $1::vector
      LIMIT $3
    `, [embeddingStr, this.graphId, Math.ceil(opts.limit * PHI)]);

    if (anchorQuery.rows.length === 0) return { entities: [], relationships: [] };

    const anchorIds = anchorQuery.rows.map(r => r.id);

    // Step 2: Multi-hop BFS traversal
    const visitedEntityIds = new Set(anchorIds);
    let   frontier         = [...anchorIds];
    const allRelationships = [];

    for (let hop = 0; hop < opts.hops && frontier.length > 0; hop++) {
      const placeholders = frontier.map((_, i) => `$${i + 3}`).join(',');
      const relQuery = await this.pool.query(`
        SELECT
          r.id,
          r.source_entity_id,
          r.target_entity_id,
          r.relationship_type,
          r.description,
          r.weight,
          r.occurrence_count,
          se.name AS source_name,
          te.name AS target_name,
          se.description AS source_desc,
          te.description AS target_desc
        FROM graph_rag_relationships r
        JOIN graph_rag_entities se ON r.source_entity_id = se.id
        JOIN graph_rag_entities te ON r.target_entity_id = te.id
        WHERE r.graph_id = $1
          AND r.weight >= $2
          AND (r.source_entity_id = ANY(ARRAY[${placeholders}]::uuid[])
               OR r.target_entity_id = ANY(ARRAY[${placeholders}]::uuid[]))
        ORDER BY r.weight DESC
        LIMIT 200
      `, [this.graphId, opts.minWeight, ...frontier, ...frontier]);

      allRelationships.push(...relQuery.rows);

      // Discover new entities for next hop
      const nextFrontier = [];
      for (const rel of relQuery.rows) {
        for (const id of [rel.source_entity_id, rel.target_entity_id]) {
          if (!visitedEntityIds.has(id)) {
            visitedEntityIds.add(id);
            nextFrontier.push(id);
          }
        }
      }
      frontier = nextFrontier;
    }

    // Fetch full entity details for all visited nodes
    const allEntityIds = Array.from(visitedEntityIds);
    const entityQuery  = await this.pool.query(`
      SELECT id, name, entity_type, description, mention_count
      FROM graph_rag_entities
      WHERE id = ANY($1::uuid[])
    `, [allEntityIds]);

    return {
      entities:      entityQuery.rows,
      relationships: this._deduplicateRelationships(allRelationships),
    };
  }

  /**
   * @private Global retrieval: community summary–based thematic search
   */
  async _globalRetrieval(queryEmbedding, question, opts) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const communityQuery = await this.pool.query(`
      SELECT
        c.id,
        c.community_level,
        c.summary,
        c.entity_count,
        c.relationship_count,
        1 - (c.summary_embedding <=> $1::vector) AS similarity
      FROM graph_rag_communities c
      WHERE c.graph_id = $2
        AND c.summary_embedding IS NOT NULL
      ORDER BY c.summary_embedding <=> $1::vector
      LIMIT $3
    `, [embeddingStr, this.graphId, opts.limit]);

    return {
      entities:      [],
      relationships: [],
      communities:   communityQuery.rows,
    };
  }

  /**
   * @private Naive retrieval: pure vector similarity (no graph traversal)
   */
  async _naiveRetrieval(queryEmbedding, opts) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const result = await this.pool.query(`
      SELECT
        id, name, entity_type, description, mention_count,
        1 - (embedding <=> $1::vector) AS similarity
      FROM graph_rag_entities
      WHERE graph_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, [embeddingStr, this.graphId, opts.limit]);

    return { entities: result.rows, relationships: [], communities: [] };
  }

  /**
   * @private Merge local + global results; weight and deduplicate.
   */
  _mergeResults(local, global, opts) {
    const entityMap      = new Map();
    const relationshipMap = new Map();

    // Add local entities (weighted by localWeight)
    for (const entity of (local.entities ?? [])) {
      if (!entityMap.has(entity.id)) {
        entityMap.set(entity.id, { ...entity, score: (entity.similarity ?? 1) * opts.localWeight });
      }
    }

    // Add global entities (if any)
    for (const entity of (global.entities ?? [])) {
      if (entityMap.has(entity.id)) {
        entityMap.get(entity.id).score += (entity.similarity ?? 1) * opts.globalWeight;
      } else {
        entityMap.set(entity.id, { ...entity, score: (entity.similarity ?? 1) * opts.globalWeight });
      }
    }

    // Deduplicate relationships
    for (const rel of (local.relationships ?? [])) {
      relationshipMap.set(rel.id, rel);
    }

    const sortedEntities = Array.from(entityMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit);

    return {
      entities:      sortedEntities,
      relationships: Array.from(relationshipMap.values()),
      communities:   global.communities ?? [],
    };
  }

  /**
   * @private Build human-readable context string from merged results.
   */
  _buildContextString(merged) {
    const parts = [];

    if (merged.entities.length > 0) {
      parts.push('## Relevant Entities\n' +
        merged.entities
          .slice(0, 15)
          .map(e => `- **${e.name}** (${e.entity_type}): ${e.description}`)
          .join('\n')
      );
    }

    if (merged.relationships.length > 0) {
      parts.push('\n## Key Relationships\n' +
        merged.relationships
          .slice(0, 20)
          .map(r => `- ${r.source_name} --[${r.relationship_type}]--> ${r.target_name}: ${r.description}`)
          .join('\n')
      );
    }

    if (merged.communities.length > 0) {
      parts.push('\n## Community Summaries\n' +
        merged.communities
          .slice(0, 3)
          .map(c => `### Theme (relevance: ${(c.similarity ?? 0).toFixed(2)})\n${c.summary}`)
          .join('\n\n')
      );
    }

    return parts.join('\n');
  }

  // ─── Community Detection ────────────────────────────────────────────────────

  /**
   * Run community detection over the current graph state.
   * Uses a Leiden-inspired greedy modularity algorithm implemented in SQL.
   * Updates graph_rag_communities table with cluster assignments and summaries.
   *
   * Performance note: This is expensive for large graphs (>100K entities).
   * Schedule during off-peak hours (see pgvector-optimized.yaml maintenance windows).
   *
   * @param {object} [options]
   * @param {number} [options.minCommunitySize=3]
   * @param {boolean} [options.generateSummaries=true] — Use LLM to summarize
   * @returns {Promise<{communitiesCreated: number, entitiesAssigned: number}>}
   */
  async communityDetection(options = {}) {
    const opts = { ...COMMUNITY_OPTIONS, ...options };
    const startTime = Date.now();

    this.logger.info('[GraphRAG] Starting community detection...');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Get all entities and their relationships as adjacency data
      const graphData = await client.query(`
        SELECT
          r.source_entity_id,
          r.target_entity_id,
          r.weight
        FROM graph_rag_relationships r
        WHERE r.graph_id = $1 AND r.weight >= 0.2
      `, [this.graphId]);

      if (graphData.rows.length === 0) {
        await client.query('COMMIT');
        return { communitiesCreated: 0, entitiesAssigned: 0 };
      }

      // Step 2: Build adjacency map in memory for modularity computation
      const communities = this._runGreedyModularity(graphData.rows, opts);

      // Step 3: Persist communities
      let communitiesCreated = 0;
      let entitiesAssigned   = 0;

      // Clear existing communities for this graph
      await client.query(`
        DELETE FROM graph_rag_communities WHERE graph_id = $1
      `, [this.graphId]);

      await client.query(`
        UPDATE graph_rag_entities SET community_id = NULL WHERE graph_id = $1
      `, [this.graphId]);

      for (const [communityIdx, entityIds] of communities.entries()) {
        if (entityIds.length < opts.minCommunitySize) continue;

        // Fetch entity details for summary generation
        const entitiesResult = await client.query(`
          SELECT id, name, entity_type, description FROM graph_rag_entities
          WHERE id = ANY($1::uuid[]) AND graph_id = $2
        `, [entityIds, this.graphId]);

        const communityEntities = entitiesResult.rows;

        // Generate summary if LLM available
        let summary = `Community of ${communityEntities.length} entities: ` +
          communityEntities.slice(0, 5).map(e => e.name).join(', ');

        if (this.llmClient && options.generateSummaries !== false) {
          const relQuery = await client.query(`
            SELECT r.relationship_type, r.description, se.name AS source_name, te.name AS target_name
            FROM graph_rag_relationships r
            JOIN graph_rag_entities se ON r.source_entity_id = se.id
            JOIN graph_rag_entities te ON r.target_entity_id = te.id
            WHERE r.graph_id = $1
              AND r.source_entity_id = ANY($2::uuid[])
              AND r.target_entity_id = ANY($2::uuid[])
            LIMIT 20
          `, [this.graphId, entityIds]);

          try {
            const prompt   = COMMUNITY_SUMMARY_PROMPT(communityEntities, relQuery.rows);
            const response = await this.llmClient.chat([{ role: 'user', content: prompt }], {
              temperature: 0.3,
              maxTokens:   200,
            });
            summary = response.content ?? summary;
          } catch (llmErr) {
            this.logger.warn('[GraphRAG] LLM summary generation failed:', llmErr.message);
          }
        }

        // Embed the summary
        const summaryEmbedding = await this._getEmbedding(summary);
        const summaryEmbStr    = summaryEmbedding ? `[${summaryEmbedding.join(',')}]` : null;

        // Insert community record
        const communityResult = await client.query(`
          INSERT INTO graph_rag_communities
            (graph_id, community_level, entity_ids, entity_count,
             relationship_count, summary, summary_embedding)
          VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
          RETURNING id
        `, [
          this.graphId,
          0,                              // level (0 = base communities)
          entityIds,
          communityEntities.length,
          0,                              // relationship_count updated below
          summary,
          summaryEmbStr,
        ]);

        const communityId = communityResult.rows[0].id;

        // Update entity community assignments
        await client.query(`
          UPDATE graph_rag_entities
          SET community_id = $1, updated_at = NOW()
          WHERE id = ANY($2::uuid[]) AND graph_id = $3
        `, [communityId, entityIds, this.graphId]);

        communitiesCreated++;
        entitiesAssigned += communityEntities.length;
      }

      await client.query('COMMIT');

      this.logger.info(`[GraphRAG] Community detection complete: ${communitiesCreated} communities, ${entitiesAssigned} entities assigned in ${Date.now() - startTime}ms`);

      this.emit('communities:detected', { communitiesCreated, entitiesAssigned });
      return { communitiesCreated, entitiesAssigned };

    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('[GraphRAG] Community detection failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * @private Greedy modularity clustering (Louvain-inspired, pure JS).
   * Input: array of {source_entity_id, target_entity_id, weight} edges.
   * Returns: array of arrays of entity IDs (one per community).
   */
  _runGreedyModularity(edges, opts) {
    // Build adjacency set
    const adj      = new Map();
    const allNodes = new Set();

    for (const edge of edges) {
      const { source_entity_id: s, target_entity_id: t, weight: w } = edge;
      allNodes.add(s);
      allNodes.add(t);
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s).push({ neighbor: t, weight: w });
      adj.get(t).push({ neighbor: s, weight: w });
    }

    // Initialize: each node in its own community
    const community = new Map();
    for (const node of allNodes) community.set(node, node);

    // Greedy phase: merge nodes with their highest-weight neighbor's community
    // (simplified single-pass Louvain — good enough for <100K nodes)
    let changed = true;
    let iteration = 0;
    while (changed && iteration < opts.maxIterations) {
      changed = false;
      iteration++;
      for (const node of allNodes) {
        const neighbors = adj.get(node) ?? [];
        if (neighbors.length === 0) continue;

        // Find best community among neighbors (by total edge weight)
        const communityWeights = new Map();
        for (const { neighbor, weight } of neighbors) {
          const c = community.get(neighbor);
          communityWeights.set(c, (communityWeights.get(c) ?? 0) + weight);
        }

        const currentCommunity = community.get(node);
        let   bestCommunity    = currentCommunity;
        let   bestWeight       = communityWeights.get(currentCommunity) ?? 0;

        for (const [c, w] of communityWeights) {
          if (w > bestWeight) {
            bestWeight    = w;
            bestCommunity = c;
          }
        }

        if (bestCommunity !== currentCommunity) {
          community.set(node, bestCommunity);
          changed = true;
        }
      }
    }

    // Group nodes by community
    const groups = new Map();
    for (const [node, c] of community) {
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(node);
    }

    return Array.from(groups.values());
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * @private Get embedding vector, using cache.
   */
  async _getEmbedding(text) {
    if (!this.embeddingRouter) return null;

    const cacheKey = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    if (this._entityEmbedCache.has(cacheKey)) {
      this._stats.cacheHits++;
      return this._entityEmbedCache.get(cacheKey);
    }

    try {
      const embedding = await this.embeddingRouter.embed(text);
      // LRU eviction: drop oldest entry when at capacity
      if (this._entityEmbedCache.size >= this._maxCacheSize) {
        const firstKey = this._entityEmbedCache.keys().next().value;
        this._entityEmbedCache.delete(firstKey);
      }
      this._entityEmbedCache.set(cacheKey, embedding);
      return embedding;
    } catch (err) {
      this.logger.warn('[GraphRAG] Embedding failed:', err.message);
      return null;
    }
  }

  /**
   * @private Deduplicate relationships by ID.
   */
  _deduplicateRelationships(relationships) {
    const seen = new Set();
    return relationships.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  /**
   * Delete all graph data for this graphId.
   * @returns {Promise<void>}
   */
  async clearGraph() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM graph_rag_communities  WHERE graph_id = $1', [this.graphId]);
      await client.query('DELETE FROM graph_rag_relationships WHERE graph_id = $1', [this.graphId]);
      await client.query('DELETE FROM graph_rag_entities     WHERE graph_id = $1', [this.graphId]);
      await client.query('COMMIT');
      this._entityEmbedCache.clear();
      this.logger.info(`[GraphRAG] Cleared graph '${this.graphId}'`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get graph statistics.
   * @returns {Promise<GraphStats>}
   */
  async getStats() {
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM graph_rag_entities     WHERE graph_id = $1) AS entity_count,
        (SELECT COUNT(*) FROM graph_rag_relationships WHERE graph_id = $1) AS relationship_count,
        (SELECT COUNT(*) FROM graph_rag_communities   WHERE graph_id = $1) AS community_count
    `, [this.graphId]);

    return {
      ...result.rows[0],
      runtimeStats: { ...this._stats },
      graphId:      this.graphId,
    };
  }
}

// ─── Type Definitions (JSDoc) ─────────────────────────────────────────────────

/**
 * @typedef {object} Entity
 * @property {string} name
 * @property {string} type — PERSON|ORGANIZATION|CONCEPT|EVENT|LOCATION|TECHNOLOGY|OTHER
 * @property {string} description
 * @property {string[]} aliases
 * @property {string} [documentId]
 * @property {string} [beeId]
 */

/**
 * @typedef {object} Relationship
 * @property {string} source — Source entity name
 * @property {string} target — Target entity name
 * @property {string} type
 * @property {string} description
 * @property {number} weight — 0.0–1.0
 */

/**
 * @typedef {object} GraphQueryResult
 * @property {string} question
 * @property {string} mode
 * @property {Entity[]} entities
 * @property {Relationship[]} relationships
 * @property {object[]} communities
 * @property {string} context — Formatted context for LLM prompt
 * @property {number} durationMs
 */

/**
 * @typedef {object} GraphStats
 * @property {string} entity_count
 * @property {string} relationship_count
 * @property {string} community_count
 * @property {object} runtimeStats
 * @property {string} graphId
 */
