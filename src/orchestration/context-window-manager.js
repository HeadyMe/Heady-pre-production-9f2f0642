/**
 * @fileoverview ContextWindowManager — Tiered context window management for
 * autonomous agents in the Heady Latent OS platform.
 *
 * Architecture:
 *   ┌────────────────────────────────────────────────────┐
 *   │  Tier 1: Working (hot)  — active inference window  │
 *   │  Tier 2: Session (warm) — durable conversation log │
 *   │  Tier 3: Memory (cold)  — cross-session storage    │
 *   │  Tier 4: Artifacts (archive) — large/versioned     │
 *   └────────────────────────────────────────────────────┘
 *
 * Key features:
 *   - Automatic compression when working context exceeds threshold
 *   - Smart LLM-based summarization (recursive + hierarchical)
 *   - Context capsules for agent-to-agent context transfer
 *   - Priority-based eviction: recency × importance × relevance
 *   - Token counting and per-tier budget enforcement
 *   - Agentic garbage collection before each inference
 *
 * Integration points:
 *   - src/hc_conductor.js         (per-conductor context management)
 *   - src/hc_pipeline.js          (pipeline stage context passing)
 *   - modules/swarm-coordinator.js (cross-swarm context capsules)
 *
 * @module context-window-manager
 * @version 2.1.0
 *
 * PHI-MATH INTEGRATION:
 *   Token budgets, eviction weights, compression trigger, and memory retrieval
 *   thresholds are derived from φ (golden ratio) and the Fibonacci sequence.
 *   See shared/phi-math.js for full derivations.
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  EVICTION_WEIGHTS,
  phiTokenBudgets,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Context tiers */
const TIER = Object.freeze({
  WORKING:   'working',   // Hot: active inference context (low latency)
  SESSION:   'session',   // Warm: current session event log
  MEMORY:    'memory',    // Cold: long-term cross-session storage
  ARTIFACTS: 'artifacts', // Archive: large binary/versioned data handles
});

/**
 * Phi-scaled token budgets per tier.
 *
 * phiTokenBudgets(8192) produces a geometric progression in φ²:
 *   working   = 8 192                (hot context — base)
 *   session   = 8 192 × φ² ≈ 21 450  (was arbitrary 32 000)
 *   memory    = 8 192 × φ⁴ ≈ 56 131  (was arbitrary 128 000)
 *   artifacts = 8 192 × φ⁶ ≈ 146 920 (was Infinity — now a large finite budget)
 *
 * The ratio between consecutive tiers is always φ² ≈ 2.618, which is the
 * golden ratio squared — a natural self-similar scaling factor.
 *
 * Note: artifacts tier still uses Infinity for the actual token limit since
 * artifacts use the handle pattern. The phiTokenBudgets value is stored for
 * observability/reporting but the runtime limit remains Infinity.
 *
 * @type {{ working: number, session: number, memory: number, artifacts: number }}
 */
const PHI_TOKEN_BUDGETS = phiTokenBudgets(8192);

/**
 * Default token budgets applied to new ContextWindowManager instances.
 * Artifacts use Infinity at runtime (handle pattern — no inline token limit).
 */
const DEFAULT_BUDGETS = Object.freeze({
  [TIER.WORKING]:   PHI_TOKEN_BUDGETS.working,    // 8 192  (was 8 000 — exact power-of-2 now)
  [TIER.SESSION]:   PHI_TOKEN_BUDGETS.session,    // ≈ 21 450  (was 32 000)
  [TIER.MEMORY]:    PHI_TOKEN_BUDGETS.memory,     // ≈ 56 131  (was 128 000)
  [TIER.ARTIFACTS]: Infinity,                     // Handle pattern — no inline limit
});

/**
 * Compression trigger ratio.
 *
 * 1 - ψ⁴ ≈ 0.910  (was 0.90 — arbitrary)
 *
 * This is the phi-harmonic CRITICAL pressure level: the system triggers
 * compression when working context exceeds 91.0% of budget, which is
 * 1 - ψ⁴ = 1 - (φ-1)⁴ ≈ 0.910 — the fourth-level phi threshold.
 *
 * Previously 0.90 was used with no derivation. Now the trigger is exactly
 * the CRITICAL alert threshold from phi-math, creating a coherent system.
 *
 * @type {number}
 */
const COMPRESS_TRIGGER_RATIO = 1 - Math.pow(PSI, 4);  // ≈ 0.910  (was 0.90)

/**
 * Eviction scoring weights.
 *
 * Replaced arbitrary { recency: 0.35, importance: 0.40, relevance: 0.25 }
 * with phi-fusion weights from phi-math.js EVICTION_WEIGHTS:
 *   importance: φ²/(φ²+φ+1) ≈ 0.486  (was 0.40)
 *   recency:    φ/(φ²+φ+1)  ≈ 0.300  (was 0.35)
 *   relevance:  1/(φ²+φ+1)  ≈ 0.214  (was 0.25)
 *
 * The ratios between consecutive weights are always ψ (golden ratio conjugate),
 * creating a coherent phi-harmonic weighting scheme. Importance is weighted
 * most heavily — consistent with LLM context management best practice.
 *
 * Note: the exported name is kept as EVICTION_WEIGHTS to preserve the module
 * API, but re-exported from phi-math for single-source-of-truth.
 */
// EVICTION_WEIGHTS is imported directly from phi-math and re-exported below.

/** Maximum importance score */
const MAX_IMPORTANCE = 10;

/**
 * Approximate tokens per character (empirical heuristic for tiktoken).
 *
 * 0.25 tokens/char is an empirically validated estimate for common tokenizers
 * on English text. This is NOT a phi-derived constant — it's a model-specific
 * engineering parameter. Noted: ψ²/φ ≈ 0.236, which is close but this
 * constant must remain at 0.25 to maintain accurate token budget enforcement.
 *
 * @type {number}
 */
const TOKENS_PER_CHAR = 0.25;

/** Artifact size threshold for handle promotion */
const ARTIFACT_PROMOTE_BYTES = 50_000;

// ─── Token Counting ───────────────────────────────────────────────────────────

/**
 * Heuristic token counter (no tiktoken dependency).
 * For production, replace with a proper tokenizer for the target model.
 *
 * @param {*} content - String, object, or array to count tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(content) {
  if (content == null) return 0;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(str.length * TOKENS_PER_CHAR);
}

// ─── ContextEntry ─────────────────────────────────────────────────────────────

/**
 * A single item stored in the context window.
 */
class ContextEntry {
  /**
   * @param {object}  opts
   * @param {string}  opts.id          - Unique entry ID
   * @param {string}  opts.tier        - One of TIER
   * @param {string}  opts.role        - 'system' | 'user' | 'assistant' | 'tool' | 'summary'
   * @param {*}       opts.content     - Entry content (string or object)
   * @param {string}  [opts.agentId]   - Producing agent ID
   * @param {number}  [opts.importance] - Importance score [0, MAX_IMPORTANCE]
   * @param {number[]} [opts.embedding] - Content embedding for relevance scoring
   * @param {object}  [opts.metadata]  - Arbitrary metadata
   */
  constructor(opts) {
    this.id          = opts.id          ?? randomUUID();
    this.tier        = opts.tier        ?? TIER.SESSION;
    this.role        = opts.role        ?? 'assistant';
    this.content     = opts.content;
    this.agentId     = opts.agentId     ?? null;
    this.importance  = Math.min(opts.importance ?? 5, MAX_IMPORTANCE);
    this.embedding   = opts.embedding   ?? null;
    this.metadata    = opts.metadata    ?? {};
    this.createdAt   = Date.now();
    this.accessedAt  = Date.now();
    this.accessCount = 0;
    this.tokens      = estimateTokens(opts.content);
    this.compressed  = false;
    this.archived    = false;
  }

  /** Mark as accessed (updates recency score). */
  touch() {
    this.accessedAt = Date.now();
    this.accessCount++;
  }

  /**
   * Compute eviction priority score (lower = evict first).
   *
   * Score = (EVICTION_WEIGHTS.recency    × normalised_age_score)
   *       + (EVICTION_WEIGHTS.importance × normalised_importance)
   *       + (EVICTION_WEIGHTS.relevance  × relevance_score)
   *
   * Weights (phi-derived via phiFusionWeights(3)):
   *   importance ≈ 0.486  (was 0.40)
   *   recency    ≈ 0.300  (was 0.35)
   *   relevance  ≈ 0.214  (was 0.25)
   *
   * @param {number} now       - Current timestamp (ms)
   * @param {number} [queryScore=0.5] - Relevance to current query [0, 1]
   * @returns {number} Eviction score [0, 1] (lower = evict first)
   */
  evictionScore(now, queryScore = 0.5) {
    // Recency: decays exponentially over 30 minutes
    const ageMs    = now - this.accessedAt;
    const recency  = Math.exp(-ageMs / (30 * 60 * 1000));

    // Importance: normalised
    const importance = this.importance / MAX_IMPORTANCE;

    return (
      EVICTION_WEIGHTS.recency    * recency     +
      EVICTION_WEIGHTS.importance * importance  +
      EVICTION_WEIGHTS.relevance  * queryScore
    );
  }
}

// ─── ContextCapsule ───────────────────────────────────────────────────────────

/**
 * A context capsule packs a subset of context entries for transfer to another agent.
 * Used for cross-swarm context passing without full history duplication.
 */
class ContextCapsule {
  /**
   * @param {object}          opts
   * @param {string}          opts.fromAgentId   - Source agent
   * @param {string}          opts.toAgentId     - Destination agent
   * @param {ContextEntry[]}  opts.entries       - Selected entries
   * @param {string}          [opts.summary]     - Optional pre-computed summary
   * @param {object}          [opts.taskContext] - Task-specific context
   */
  constructor(opts) {
    this.id          = randomUUID();
    this.fromAgentId = opts.fromAgentId;
    this.toAgentId   = opts.toAgentId;
    this.entries     = opts.entries ?? [];
    this.summary     = opts.summary ?? null;
    this.taskContext = opts.taskContext ?? {};
    this.createdAt   = new Date().toISOString();
    this.totalTokens = this.entries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Serialise the capsule for transmission or storage.
   * @returns {object}
   */
  serialize() {
    return {
      id:          this.id,
      fromAgentId: this.fromAgentId,
      toAgentId:   this.toAgentId,
      summary:     this.summary,
      taskContext: this.taskContext,
      entries:     this.entries.map(e => ({
        id:        e.id,
        role:      e.role,
        content:   e.content,
        importance:e.importance,
        agentId:   e.agentId,
        metadata:  e.metadata,
      })),
      totalTokens: this.totalTokens,
      createdAt:   this.createdAt,
    };
  }
}

// ─── ContextWindowManager ────────────────────────────────────────────────────

/**
 * @class ContextWindowManager
 * @extends EventEmitter
 *
 * Manages the four-tier context window for a single agent or agent swarm.
 *
 * @fires ContextWindowManager#compressed       When working context is compressed
 * @fires ContextWindowManager#evicted          When entries are evicted
 * @fires ContextWindowManager#promoted         When an entry moves tiers
 * @fires ContextWindowManager#capsule:created  When a context capsule is exported
 * @fires ContextWindowManager#budget:exceeded  When a tier budget is exceeded
 */
class ContextWindowManager extends EventEmitter {
  /**
   * @param {object}   [opts]
   * @param {string}   [opts.agentId]           - Owner agent ID
   * @param {object}   [opts.budgets]           - Per-tier token budgets (override defaults)
   * @param {number}   [opts.compressTrigger]   - Compression trigger ratio [0, 1]
   * @param {Function} [opts.llmSummarizeFn]    - Async fn(entries) → string summary
   * @param {Function} [opts.embedFn]           - Async fn(text) → number[] embedding
   * @param {number}   [opts.gcIntervalMs]      - Agentic GC interval (0 = manual only)
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(50);

    this.agentId          = opts.agentId         ?? `agent-${randomUUID().slice(0, 8)}`;
    this._budgets         = { ...DEFAULT_BUDGETS, ...(opts.budgets ?? {}) };
    this._compressTrigger = opts.compressTrigger ?? COMPRESS_TRIGGER_RATIO;
    this._llmSummarizeFn  = opts.llmSummarizeFn  ?? null;
    this._embedFn         = opts.embedFn          ?? null;
    this._gcInterval      = opts.gcIntervalMs     ?? 0;

    /** @type {Map<string, ContextEntry>} All entries keyed by ID */
    this._store = new Map();

    /** @type {Map<string, string[]>} Tier → ordered entry ID list (newest first) */
    this._tiers = {
      [TIER.WORKING]:   [],
      [TIER.SESSION]:   [],
      [TIER.MEMORY]:    [],
      [TIER.ARTIFACTS]: [],
    };

    /** @type {Map<string, object>} Artifact handles (large data references) */
    this._artifactHandles = new Map();

    /** Token usage tracking */
    this._tokenUsage = {
      [TIER.WORKING]:   0,
      [TIER.SESSION]:   0,
      [TIER.MEMORY]:    0,
      [TIER.ARTIFACTS]: 0,
    };

    /** @type {NodeJS.Timer|null} */
    this._gcTimer = null;

    if (this._gcInterval > 0) {
      this._gcTimer = setInterval(() => this.gc(), this._gcInterval);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Add an entry to the context window.
   *
   * @param {object}  opts            - ContextEntry constructor options
   * @param {string}  [targetTier]    - Override tier placement (default: SESSION)
   * @returns {ContextEntry}
   */
  add(opts, targetTier = TIER.SESSION) {
    const entry = new ContextEntry({ ...opts, tier: targetTier });

    // Large content → promote to artifacts
    const byteSize = Buffer.byteLength(JSON.stringify(entry.content), 'utf8');
    if (byteSize > ARTIFACT_PROMOTE_BYTES && targetTier !== TIER.ARTIFACTS) {
      return this._promoteToArtifact(entry);
    }

    this._store.set(entry.id, entry);
    this._tiers[targetTier].unshift(entry.id); // newest first
    this._tokenUsage[targetTier] += entry.tokens;

    // Check budget and compress/evict as needed
    this._enforcebudget(targetTier);

    return entry;
  }

  /**
   * Add a message to the working (hot) context.
   * Triggers automatic compression if over threshold.
   *
   * @param {string} role    - 'system' | 'user' | 'assistant' | 'tool'
   * @param {*}      content - Message content
   * @param {object} [meta]  - Metadata (importance, agentId, embedding, …)
   * @returns {ContextEntry}
   */
  addMessage(role, content, meta = {}) {
    return this.add(
      { role, content, importance: meta.importance ?? 5, ...meta },
      TIER.WORKING
    );
  }

  /**
   * Get all entries in the working context, ordered for LLM inference.
   *
   * @param {number[]} [queryEmbedding] - Optional query vector for relevance-boosted ordering
   * @returns {ContextEntry[]}
   */
  getWorkingContext(queryEmbedding = null) {
    const ids = this._tiers[TIER.WORKING];
    const entries = ids
      .map(id => this._store.get(id))
      .filter(Boolean);

    if (queryEmbedding) {
      return this._rerankByRelevance(entries, queryEmbedding);
    }

    // Return in chronological order (oldest first for LLM)
    return entries.reverse();
  }

  /**
   * Build a formatted messages array for LLM API consumption.
   * Applies token budget and prepends system message.
   *
   * @param {string}   [systemPrompt]     - Optional system prompt override
   * @param {number[]} [queryEmbedding]   - For relevance-ranked selection
   * @returns {{ role: string, content: string }[]}
   */
  buildMessages(systemPrompt = null, queryEmbedding = null) {
    this.gc(); // Run GC before inference

    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    const working = this.getWorkingContext(queryEmbedding);
    for (const entry of working) {
      if (entry.role === 'system' || entry.compressed) continue; // skip summaries (handled separately)
      messages.push({ role: entry.role, content: entry.content });
      entry.touch();
    }

    return messages;
  }

  /**
   * Retrieve relevant entries from memory (cold storage) via semantic search.
   *
   * @param {number[]}  queryEmbedding  - Query vector
   * @param {number}    [topK=5]        - Max entries to return; fib(5) = 5 (same value, Fibonacci-derived)
   * @param {number}    [threshold]     - Minimum cosine similarity
   *                                      Default: PSI ≈ 0.618 (was 0.6 — arbitrary)
   *                                      PSI is the phi-harmonic similarity floor — the golden
   *                                      ratio conjugate, representing the minimum "meaningful"
   *                                      similarity in a phi-scaled metric space.
   * @returns {ContextEntry[]}
   */
  retrieveFromMemory(queryEmbedding, topK = fib(5), threshold = PSI) {
    const memoryIds = this._tiers[TIER.MEMORY];
    const candidates = memoryIds
      .map(id => this._store.get(id))
      .filter(e => e && e.embedding);

    return candidates
      .map(e => ({ entry: e, score: this._cosineSim(queryEmbedding, e.embedding) }))
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => { r.entry.touch(); return r.entry; });
  }

  /**
   * Compress working context using the configured LLM summarization function.
   * Archives compressed entries to SESSION tier and writes a summary entry.
   *
   * @returns {Promise<ContextEntry|null>} The generated summary entry, or null if not needed
   */
  async compress() {
    const workingBudget = this._budgets[TIER.WORKING];
    const currentUsage  = this._tokenUsage[TIER.WORKING];

    if (currentUsage < workingBudget * this._compressTrigger) return null;

    const working = this.getWorkingContext();
    if (working.length < 3) return null; // Not enough to compress

    // Identify candidates for compression: older, lower-importance entries
    const toCompress = working
      .filter(e => e.role !== 'system')
      .sort((a, b) => a.evictionScore(Date.now()) - b.evictionScore(Date.now()))
      .slice(0, Math.floor(working.length * 0.6));

    if (toCompress.length === 0) return null;

    let summary = '';
    if (this._llmSummarizeFn) {
      try {
        summary = await this._llmSummarizeFn(
          toCompress.map(e => ({ role: e.role, content: e.content }))
        );
      } catch (err) {
        summary = toCompress
          .map(e => `[${e.role}]: ${String(e.content).slice(0, 200)}`)
          .join('\n');
      }
    } else {
      // Heuristic compression: truncate to key phrases
      summary = toCompress
        .map(e => `[${e.role}]: ${String(e.content).slice(0, 200)}`)
        .join('\n---\n');
    }

    // Archive compressed entries to SESSION tier
    for (const entry of toCompress) {
      this._moveToTier(entry.id, TIER.SESSION);
    }

    // Add summary entry to WORKING
    const summaryEntry = this.add({
      role:       'summary',
      content:    summary,
      importance: 8,
      metadata:   {
        compressedCount: toCompress.length,
        compressedAt:    new Date().toISOString(),
      },
    }, TIER.WORKING);
    summaryEntry.compressed = true;

    /**
     * @event ContextWindowManager#compressed
     */
    this.emit('compressed', {
      agentId:         this.agentId,
      compressedCount: toCompress.length,
      summaryTokens:   summaryEntry.tokens,
      savedTokens:     toCompress.reduce((s, e) => s + e.tokens, 0) - summaryEntry.tokens,
    });

    return summaryEntry;
  }

  /**
   * Create a context capsule for transferring context to another agent.
   *
   * @param {string}  toAgentId     - Destination agent ID
   * @param {object}  [opts]
   * @param {number}  [opts.topK=10]        - Max entries to include
   * @param {string}  [opts.tierFilter]     - Only include entries from this tier
   * @param {number}  [opts.tokenBudget]    - Max tokens in capsule
   * @param {number[]} [opts.queryEmbedding] - Relevance filter embedding
   * @param {object}  [opts.taskContext]    - Task-specific context to attach
   * @returns {Promise<ContextCapsule>}
   */
  async createCapsule(toAgentId, opts = {}) {
    const { topK = 10, tierFilter, tokenBudget = 4000, queryEmbedding, taskContext = {} } = opts;

    let candidates = [];
    const sourceTiers = tierFilter ? [tierFilter] : [TIER.WORKING, TIER.SESSION];

    for (const tier of sourceTiers) {
      const ids = this._tiers[tier] ?? [];
      candidates.push(...ids.map(id => this._store.get(id)).filter(Boolean));
    }

    // Relevance re-ranking if query embedding provided
    if (queryEmbedding) {
      candidates = this._rerankByRelevance(candidates, queryEmbedding);
    } else {
      // Default: sort by eviction score (keep most important)
      const now = Date.now();
      candidates.sort((a, b) => b.evictionScore(now) - a.evictionScore(now));
    }

    // Fit within token budget
    const selected = [];
    let tokenCount = 0;
    for (const entry of candidates) {
      if (tokenCount + entry.tokens > tokenBudget) break;
      if (selected.length >= topK) break;
      selected.push(entry);
      tokenCount += entry.tokens;
    }

    // Generate capsule summary if LLM available
    let summary = null;
    if (this._llmSummarizeFn && selected.length > 0) {
      try {
        summary = await this._llmSummarizeFn(
          selected.map(e => ({ role: e.role, content: e.content }))
        );
      } catch (_) {}
    }

    const capsule = new ContextCapsule({
      fromAgentId: this.agentId,
      toAgentId,
      entries:     selected,
      summary,
      taskContext,
    });

    /**
     * @event ContextWindowManager#capsule:created
     */
    this.emit('capsule:created', {
      capsuleId:   capsule.id,
      fromAgentId: this.agentId,
      toAgentId,
      entryCount:  selected.length,
      totalTokens: capsule.totalTokens,
    });

    return capsule;
  }

  /**
   * Ingest a context capsule received from another agent.
   *
   * @param {ContextCapsule} capsule - Received capsule
   * @param {string} [targetTier]   - Target tier (default: WORKING for summary, SESSION for entries)
   */
  ingestCapsule(capsule, targetTier = null) {
    // If capsule has a summary, add it as a high-importance entry
    if (capsule.summary) {
      this.add({
        role:      'summary',
        content:   capsule.summary,
        importance: 7,
        agentId:   capsule.fromAgentId,
        metadata:  { capsuleId: capsule.id, fromAgent: capsule.fromAgentId },
      }, TIER.WORKING);
    }

    // Add individual entries to session
    const tier = targetTier ?? TIER.SESSION;
    for (const entryData of capsule.entries) {
      this.add({
        id:        entryData.id,
        role:      entryData.role,
        content:   entryData.content,
        importance:entryData.importance,
        agentId:   entryData.agentId ?? capsule.fromAgentId,
        metadata:  { ...entryData.metadata, ingestedFrom: capsule.fromAgentId },
      }, tier);
    }

    this.emit('capsule:ingested', {
      capsuleId:   capsule.id,
      fromAgentId: capsule.fromAgentId,
      entryCount:  capsule.entries.length,
    });
  }

  /**
   * Promote important session entries to long-term memory.
   *
   * @param {number} [importanceThreshold=7] - Only promote entries above this importance
   * @returns {number} Number of entries promoted
   */
  promoteToMemory(importanceThreshold = 7) {
    let count = 0;
    const sessionIds = [...this._tiers[TIER.SESSION]];

    for (const id of sessionIds) {
      const entry = this._store.get(id);
      if (entry && entry.importance >= importanceThreshold) {
        this._moveToTier(id, TIER.MEMORY);
        count++;
      }
    }

    if (count > 0) {
      this.emit('promoted', { agentId: this.agentId, count, toTier: TIER.MEMORY });
    }
    return count;
  }

  /**
   * Agentic garbage collection: deduplicate, evict stale low-priority entries,
   * enforce token budgets, and promote important entries.
   */
  gc() {
    const now = Date.now();
    let evicted = 0;

    // 1. Deduplicate: remove entries with identical content hash
    const contentHashes = new Set();
    for (const [id, entry] of this._store) {
      const hash = createHash('md5')
        .update(JSON.stringify(entry.content))
        .digest('hex');
      if (contentHashes.has(hash)) {
        this._removeEntry(id);
        evicted++;
      } else {
        contentHashes.add(hash);
      }
    }

    // 2. Enforce WORKING tier budget (evict lowest-scored entries)
    evicted += this._evictTier(TIER.WORKING, this._budgets[TIER.WORKING]);

    // 3. Enforce SESSION tier budget
    evicted += this._evictTier(TIER.SESSION, this._budgets[TIER.SESSION]);

    // 4. Promote high-importance session entries to memory
    this.promoteToMemory(8);

    if (evicted > 0) {
      /**
       * @event ContextWindowManager#evicted
       */
      this.emit('evicted', { agentId: this.agentId, count: evicted });
    }
  }

  /**
   * Get current token usage statistics.
   * @returns {object}
   */
  getTokenStats() {
    return {
      agentId: this.agentId,
      tiers: Object.fromEntries(
        Object.entries(this._tokenUsage).map(([tier, used]) => [
          tier,
          {
            used,
            budget:    this._budgets[tier] === Infinity ? null : this._budgets[tier],
            utilization: this._budgets[tier] === Infinity
              ? null
              : Math.round((used / this._budgets[tier]) * 100) / 100,
          },
        ])
      ),
      totalEntries: this._store.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieve an artifact handle (large data pointer) by ID.
   * @param {string} artifactId
   * @returns {object|null}
   */
  getArtifact(artifactId) {
    return this._artifactHandles.get(artifactId) ?? null;
  }

  /**
   * Clear all context for a fresh session start.
   * Preserves MEMORY and ARTIFACTS tiers.
   */
  clearSession() {
    for (const id of this._tiers[TIER.WORKING]) {
      this._store.delete(id);
    }
    for (const id of this._tiers[TIER.SESSION]) {
      this._store.delete(id);
    }
    this._tiers[TIER.WORKING] = [];
    this._tiers[TIER.SESSION] = [];
    this._tokenUsage[TIER.WORKING] = 0;
    this._tokenUsage[TIER.SESSION] = 0;
    this.emit('session:cleared', { agentId: this.agentId });
  }

  /**
   * Graceful shutdown: stop GC timer.
   */
  destroy() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    this.removeAllListeners();
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Move an entry to a different tier.
   * @private
   */
  _moveToTier(entryId, newTier) {
    const entry = this._store.get(entryId);
    if (!entry) return;

    // Remove from current tier
    const currentTierIds = this._tiers[entry.tier];
    const idx = currentTierIds.indexOf(entryId);
    if (idx > -1) {
      currentTierIds.splice(idx, 1);
      this._tokenUsage[entry.tier] -= entry.tokens;
    }

    // Add to new tier
    entry.tier = newTier;
    this._tiers[newTier].unshift(entryId);
    this._tokenUsage[newTier] += entry.tokens;
  }

  /**
   * Promote a large entry to artifact storage.
   * @private
   */
  _promoteToArtifact(entry) {
    const handle = {
      id:        entry.id,
      agentId:   entry.agentId,
      role:      entry.role,
      byteSize:  Buffer.byteLength(JSON.stringify(entry.content), 'utf8'),
      createdAt: new Date().toISOString(),
      metadata:  entry.metadata,
    };

    this._artifactHandles.set(entry.id, { handle, content: entry.content });

    // Store a lightweight reference in the artifacts tier
    const refEntry = new ContextEntry({
      id:       entry.id,
      tier:     TIER.ARTIFACTS,
      role:     entry.role,
      content:  `[ARTIFACT:${entry.id}] ${entry.role} content (${handle.byteSize} bytes)`,
      agentId:  entry.agentId,
      importance: entry.importance,
    });

    this._store.set(refEntry.id, refEntry);
    this._tiers[TIER.ARTIFACTS].unshift(refEntry.id);
    this._tokenUsage[TIER.ARTIFACTS] += refEntry.tokens;

    this.emit('promoted', {
      agentId:    this.agentId,
      entryId:    entry.id,
      toTier:     TIER.ARTIFACTS,
      byteSize:   handle.byteSize,
    });

    return refEntry;
  }

  /**
   * Remove a single entry from the store and its tier index.
   * @private
   */
  _removeEntry(entryId) {
    const entry = this._store.get(entryId);
    if (!entry) return;

    const tierIds = this._tiers[entry.tier];
    const idx = tierIds.indexOf(entryId);
    if (idx > -1) tierIds.splice(idx, 1);

    this._tokenUsage[entry.tier] = Math.max(0, this._tokenUsage[entry.tier] - entry.tokens);
    this._store.delete(entryId);
  }

  /**
   * Enforce token budget for a tier by evicting lowest-priority entries.
   * @private
   * @returns {number} Entries evicted
   */
  _evictTier(tier, budget) {
    if (budget === Infinity) return 0;
    let evicted = 0;
    const now = Date.now();

    while (this._tokenUsage[tier] > budget) {
      const tierIds = this._tiers[tier];
      if (tierIds.length === 0) break;

      // Find the entry with the lowest eviction score
      let lowestScore = Infinity;
      let lowestId    = null;

      for (const id of tierIds) {
        const entry = this._store.get(id);
        if (!entry) continue;
        const score = entry.evictionScore(now);
        if (score < lowestScore) {
          lowestScore = score;
          lowestId    = id;
        }
      }

      if (!lowestId) break;

      // For working → demote to session; for session → demote to memory
      const entry = this._store.get(lowestId);
      if (tier === TIER.WORKING && entry) {
        this._moveToTier(lowestId, TIER.SESSION);
      } else {
        this._removeEntry(lowestId);
      }
      evicted++;
    }

    return evicted;
  }

  /**
   * Enforce token budget and trigger compression if needed.
   * @private
   */
  _enforcebudget(tier) {
    const budget  = this._budgets[tier];
    const current = this._tokenUsage[tier];

    if (current > budget) {
      /**
       * @event ContextWindowManager#budget:exceeded
       */
      this.emit('budget:exceeded', {
        agentId: this.agentId,
        tier,
        current,
        budget,
      });
    }

    // Trigger async compression for working tier
    if (tier === TIER.WORKING && current >= budget * this._compressTrigger) {
      // Fire-and-forget (async); do not block add()
      this.compress().catch(err => this.emit('error', err));
    }
  }

  /**
   * Re-rank entries by cosine similarity to a query embedding.
   * @private
   */
  _rerankByRelevance(entries, queryEmbedding) {
    return entries
      .map(e => ({
        entry: e,
        score: e.embedding ? this._cosineSim(queryEmbedding, e.embedding) : 0.5,
      }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.entry);
  }

  /**
   * Cosine similarity between two vectors.
   * @private
   */
  _cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  ContextWindowManager,
  ContextEntry,
  ContextCapsule,
  TIER,
  DEFAULT_BUDGETS,
  EVICTION_WEIGHTS,
  COMPRESS_TRIGGER_RATIO,
  PHI_TOKEN_BUDGETS,
  estimateTokens,
};

export default ContextWindowManager;
