/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { VectorMemory } = require('../vector-memory');
const { PatternEngine } = require('../patterns/pattern-engine');
const embeddingProvider = require('../embedding-provider');

const PHI = 1.6180339887;

// ─── Token counting constants ─────────────────────────────────────────────────
const AVG_CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_CONTEXT_TOKENS = 8_192;
const PRIORITY_LEVELS = Object.freeze({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 });

/**
 * Estimate token count from a string.
 * @param {string} str
 * @returns {number}
 */
function estimateTokens(str) {
  return Math.ceil((str || '').length / AVG_CHARS_PER_TOKEN);
}

/**
 * Truncate a string to a target token budget.
 * @param {string} str
 * @param {number} maxTokens
 * @returns {string}
 */
function truncateToTokens(str, maxTokens) {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '…[truncated]';
}

/**
 * HeadyBrains — Computational Pre-Processor for the Heady AI Platform.
 *
 * HeadyBrains assembles full, rich context before any task is routed or executed.
 * It gathers memory, patterns, session history, user state, and enriches with
 * embeddings — all in parallel where possible.
 *
 * Key responsibilities:
 *   - assembleContext(task)    → full context object for downstream stages
 *   - preProcess(rawInput)     → normalize, classify intent, extract entities
 *   - enrichContext(context)   → add vector memory results, pattern matches
 *
 * @extends EventEmitter
 */
class HeadyBrains extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {object} [options.vectorMemory]       - VectorMemory instance
   * @param {object} [options.patternEngine]      - PatternEngine instance
   * @param {number} [options.maxContextTokens]   - Context window token budget
   * @param {number} [options.memoryResultLimit]  - Max memory results to include
   * @param {number} [options.patternResultLimit] - Max pattern results to include
   */
  constructor(options = {}) {
    super();

    this._vectorMemory  = options.vectorMemory  || new VectorMemory();
    this._patternEngine = options.patternEngine || new PatternEngine();
    this._maxContextTokens   = options.maxContextTokens   || DEFAULT_MAX_CONTEXT_TOKENS;
    this._memoryResultLimit  = options.memoryResultLimit  || 10;
    this._patternResultLimit = options.patternResultLimit || 5;

    logger.info('[HeadyBrains] Initialized', {
      maxContextTokens: this._maxContextTokens,
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Assemble full context for a task.
   * Runs all gathering operations in parallel where possible.
   *
   * @param {object} task
   * @param {string} task.id
   * @param {string} task.type
   * @param {object} task.payload
   * @returns {Promise<AssembledContext>}
   */
  async assembleContext(task) {
    const startAt = Date.now();
    logger.debug('[HeadyBrains] Assembling context', { taskId: task.id });

    // Parallel context gathering
    const [
      memoryResults,
      patternMatches,
      recentHistory,
      userState,
      embedResult,
    ] = await Promise.allSettled([
      this._gatherMemory(task),
      this._gatherPatterns(task),
      this._gatherRecentHistory(task),
      this._gatherUserState(task),
      this._generateEmbedding(task),
    ]);

    const ctx = {
      taskId: task.id,
      taskType: task.type,
      assembledAt: Date.now(),
      assembleDuration: Date.now() - startAt,
      memory: memoryResults.status === 'fulfilled' ? memoryResults.value : [],
      patterns: patternMatches.status === 'fulfilled' ? patternMatches.value : [],
      recentHistory: recentHistory.status === 'fulfilled' ? recentHistory.value : [],
      userState: userState.status === 'fulfilled' ? userState.value : {},
      embedding: embedResult.status === 'fulfilled' ? embedResult.value : null,
      tokenBudgetUsed: 0,
      tokenBudgetTotal: this._maxContextTokens,
      sources: {
        memory:     memoryResults.status,
        patterns:   patternMatches.status,
        history:    recentHistory.status,
        userState:  userState.status,
        embedding:  embedResult.status,
      },
    };

    // Compute token usage
    ctx.tokenBudgetUsed = this._countContextTokens(ctx);

    logger.debug('[HeadyBrains] Context assembled', {
      taskId: task.id,
      duration: ctx.assembleDuration,
      tokenBudgetUsed: ctx.tokenBudgetUsed,
      memorySources: ctx.memory.length,
      patterns: ctx.patterns.length,
    });

    this.emit('context:assembled', { taskId: task.id, tokenBudgetUsed: ctx.tokenBudgetUsed });
    return ctx;
  }

  /**
   * Pre-process raw input: normalize, classify intent, extract entities.
   *
   * @param {*} rawInput - Raw string or object from user/system
   * @returns {Promise<PreProcessResult>}
   */
  async preProcess(rawInput) {
    const inputStr = typeof rawInput === 'string'
      ? rawInput
      : JSON.stringify(rawInput);

    const normalized = this._normalize(inputStr);
    const intent     = this._classifyIntent(normalized);
    const entities   = this._extractEntities(normalized);
    const embedding  = await this._generateEmbeddingFromText(normalized);

    const result = {
      original: rawInput,
      normalized,
      intent,
      entities,
      embedding,
      tokenCount: estimateTokens(normalized),
      processedAt: Date.now(),
    };

    logger.debug('[HeadyBrains] Pre-processed input', {
      intent: intent.label,
      confidence: intent.confidence,
      entityCount: entities.length,
      tokens: result.tokenCount,
    });

    return result;
  }

  /**
   * Enrich an assembled context with vector memory similarity results
   * and pattern engine matches.
   *
   * @param {AssembledContext} context
   * @returns {Promise<EnrichedContext>}
   */
  async enrichContext(context) {
    const [
      vectorResults,
      patternResults,
    ] = await Promise.allSettled([
      this._vectorSearch(context),
      this._patternSearch(context),
    ]);

    const enriched = {
      ...context,
      vectorMatches: vectorResults.status === 'fulfilled' ? vectorResults.value : [],
      patternMatches: patternResults.status === 'fulfilled' ? patternResults.value : [],
      enrichedAt: Date.now(),
    };

    // Re-compute token budget after enrichment
    enriched.tokenBudgetUsed = this._countContextTokens(enriched);

    // If over budget, prune by priority
    if (enriched.tokenBudgetUsed > this._maxContextTokens) {
      this._pruneContext(enriched);
    }

    logger.debug('[HeadyBrains] Context enriched', {
      taskId: context.taskId,
      vectorMatches: enriched.vectorMatches.length,
      patternMatches: enriched.patternMatches.length,
      tokenBudgetUsed: enriched.tokenBudgetUsed,
    });

    return enriched;
  }

  // ─── Context Gathering Helpers ───────────────────────────────────────────────

  /**
   * Gather relevant memories from vector store.
   */
  async _gatherMemory(task) {
    const query = `${task.type} ${JSON.stringify(task.payload).slice(0, 200)}`;
    const results = await this._vectorMemory.search({
      query,
      limit: this._memoryResultLimit,
      filter: { taskType: task.type },
    }).catch(() => []);
    return results;
  }

  /**
   * Gather matching patterns from pattern engine.
   */
  async _gatherPatterns(task) {
    const results = await this._patternEngine.match({
      taskType: task.type,
      payload: task.payload,
      limit: this._patternResultLimit,
    }).catch(() => []);
    return results;
  }

  /**
   * Gather recent task history for context continuity.
   */
  async _gatherRecentHistory(task) {
    const sessionId = task.payload?.sessionId;
    if (!sessionId) return [];

    const history = await this._vectorMemory.getRecent({
      sessionId,
      limit: 5,
    }).catch(() => []);

    return history;
  }

  /**
   * Gather user state (preferences, profile, session data).
   */
  async _gatherUserState(task) {
    const userId = task.payload?.userId;
    if (!userId) return {};

    const state = await this._vectorMemory.get(`user_state:${userId}`).catch(() => null);
    return state || {};
  }

  /**
   * Generate task embedding for semantic operations.
   */
  async _generateEmbedding(task) {
    const text = `${task.type}: ${JSON.stringify(task.payload).slice(0, 500)}`;
    return this._generateEmbeddingFromText(text);
  }

  async _generateEmbeddingFromText(text) {
    return embeddingProvider.embed(text).catch(() => null);
  }

  // ─── Vector + Pattern Search ────────────────────────────────────────────────

  async _vectorSearch(context) {
    if (!context.embedding) return [];
    return this._vectorMemory.searchByVector({
      vector: context.embedding,
      limit: this._memoryResultLimit,
    }).catch(() => []);
  }

  async _patternSearch(context) {
    return this._patternEngine.matchByContext({
      taskType: context.taskType,
      embedding: context.embedding,
      history: context.recentHistory,
    }).catch(() => []);
  }

  // ─── Pre-Processing Helpers ──────────────────────────────────────────────────

  /**
   * Normalize raw input string.
   */
  _normalize(input) {
    return input
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, ''); // Strip control characters
  }

  /**
   * Rule-based intent classification.
   */
  _classifyIntent(text) {
    const lower = text.toLowerCase();

    const rules = [
      { label: 'query',      pattern: /^(what|who|where|when|why|how|is|are|can|does)\b/i, confidence: 0.85 },
      { label: 'command',    pattern: /^(create|make|build|generate|write|add|update|delete|remove)\b/i, confidence: 0.90 },
      { label: 'search',     pattern: /^(find|search|look|show|list|get)\b/i, confidence: 0.88 },
      { label: 'analyze',    pattern: /^(analyze|analyse|review|check|evaluate|assess|compare)\b/i, confidence: 0.87 },
      { label: 'converse',   pattern: /^(hi|hello|hey|thanks|thank you|ok|yes|no|sure|alright)\b/i, confidence: 0.95 },
      { label: 'navigate',   pattern: /^(go to|navigate|open|show me|take me to)\b/i, confidence: 0.92 },
    ];

    for (const rule of rules) {
      if (rule.pattern.test(lower)) {
        return { label: rule.label, confidence: rule.confidence };
      }
    }

    // Fallback heuristic: task-like
    return { label: 'task', confidence: 0.5 };
  }

  /**
   * Extract named entities and key-value pairs from text.
   */
  _extractEntities(text) {
    const entities = [];

    // Extract quoted strings as entities
    const quoted = text.matchAll(/"([^"]+)"|'([^']+)'/g);
    for (const match of quoted) {
      entities.push({ type: 'quoted_string', value: match[1] || match[2] });
    }

    // Extract numbers
    const numbers = text.matchAll(/\b(\d+(?:\.\d+)?)\b/g);
    for (const match of numbers) {
      entities.push({ type: 'number', value: parseFloat(match[1]) });
    }

    // Extract URLs
    const urls = text.matchAll(/https?:\/\/[^\s]+/g);
    for (const match of urls) {
      entities.push({ type: 'url', value: match[0] });
    }

    // Extract email addresses
    const emails = text.matchAll(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi);
    for (const match of emails) {
      entities.push({ type: 'email', value: match[0] });
    }

    return entities;
  }

  // ─── Context Window Management ───────────────────────────────────────────────

  /**
   * Count total tokens in an assembled context.
   */
  _countContextTokens(ctx) {
    let total = 0;

    const add = (obj) => {
      if (!obj) return;
      total += estimateTokens(typeof obj === 'string' ? obj : JSON.stringify(obj));
    };

    add(ctx.memory);
    add(ctx.patterns);
    add(ctx.recentHistory);
    add(ctx.userState);
    add(ctx.vectorMatches);
    add(ctx.patternMatches);

    return total;
  }

  /**
   * Priority-based context truncation when over token budget.
   * Drops lower-priority items first.
   *
   * Priority order (preserved longest):
   *   CRITICAL: userState, recentHistory
   *   HIGH:     patterns, vectorMatches
   *   MEDIUM:   memory, patternMatches
   *   LOW:      everything else
   */
  _pruneContext(ctx) {
    const pruneOrder = [
      { key: 'patternMatches', priority: PRIORITY_LEVELS.LOW },
      { key: 'memory',         priority: PRIORITY_LEVELS.MEDIUM },
      { key: 'vectorMatches',  priority: PRIORITY_LEVELS.HIGH },
      { key: 'patterns',       priority: PRIORITY_LEVELS.HIGH },
    ];

    for (const { key } of pruneOrder) {
      if (ctx.tokenBudgetUsed <= this._maxContextTokens) break;
      if (!Array.isArray(ctx[key]) || ctx[key].length === 0) continue;

      // Remove last half of the array
      const half = Math.ceil(ctx[key].length / 2);
      ctx[key] = ctx[key].slice(0, half);

      ctx.tokenBudgetUsed = this._countContextTokens(ctx);
      logger.debug('[HeadyBrains] Pruned context field', {
        key, remaining: ctx[key].length, newTokens: ctx.tokenBudgetUsed,
      });
    }

    if (ctx.tokenBudgetUsed > this._maxContextTokens) {
      logger.warn('[HeadyBrains] Context still over budget after pruning', {
        used: ctx.tokenBudgetUsed, max: this._maxContextTokens,
      });
    }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { HeadyBrains, PHI, estimateTokens, truncateToTokens };
