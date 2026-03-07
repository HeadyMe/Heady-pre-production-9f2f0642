/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Continuous Learning Layer — stores experiences as vector embeddings,
 * recalls relevant experiences via semantic search, adapts internal weights based
 * on feedback, and generates structured insights from accumulated learning.
 *
 * Integration:
 *  - vector-memory: all experiences are stored as 384-dim embeddings
 *  - embedding-provider: converts text/data to vectors
 *  - pattern-engine: insight generation leverages pattern detection
 *
 * @module src/continuous-learning
 */

const crypto = require('crypto');
const { createLogger } = require('./utils/logger');
const { VectorMemory } = require('./vector-memory');
const { createEmbeddingProvider } = require('./embedding-provider');
const { defaultEngine: patternEngine } = require('./patterns/pattern-engine');
const { centroid } = require('./vector-space-ops');

const logger = createLogger('continuous-learning');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Namespace used within VectorMemory for experiences. */
const EXPERIENCE_NS = 'experiences';

/** Namespace used for generated insights. */
const INSIGHT_NS = 'insights';

/** Max number of feedback records to retain per experience. */
const MAX_FEEDBACK_PER_EXPERIENCE = 20;

/** Max experiences in active memory (soft cap before oldest pruned). */
const MAX_EXPERIENCES = 50_000;

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Experience
 * @property {string} id - Unique experience ID
 * @property {string} content - Serialised content (text, JSON-string, etc.)
 * @property {number[]} vector - 384-dim embedding
 * @property {Object} metadata - Arbitrary metadata (source, tags, context, etc.)
 * @property {number} weight - Learning weight (higher = more influential) [0, 2]
 * @property {number[]} feedbackHistory - Historical feedback scores
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} Feedback
 * @property {string} experienceId
 * @property {number} score - Feedback score [-1, 1] (negative = harmful, positive = helpful)
 * @property {string} [signal] - What triggered this feedback
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Insight
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} type - 'cluster' | 'trend' | 'anomaly' | 'pattern'
 * @property {number} confidence
 * @property {string[]} supportingExperienceIds
 * @property {Object} data - Type-specific data
 * @property {number} generatedAt
 */

/**
 * @typedef {Object} RecallResult
 * @property {string} id
 * @property {string} content
 * @property {number} similarity
 * @property {number} weight
 * @property {Object} metadata
 * @property {number} createdAt
 */

// ---------------------------------------------------------------------------
// ContinuousLearning
// ---------------------------------------------------------------------------

/**
 * Continuous learning system backed by vector memory.
 *
 * @example
 * const cl = new ContinuousLearning();
 * await cl.learn({ content: 'User requested feature X', tags: ['product'] });
 * const memories = await cl.recall('feature requests', 5);
 * await cl.adapt({ experienceId: memories[0].id, score: 0.8 });
 * const insights = cl.getInsights();
 */
class ContinuousLearning {
  /**
   * @param {Object} [options={}]
   * @param {VectorMemory} [options.memory] - Injected VectorMemory instance
   * @param {Object} [options.embeddingProviderOptions]
   * @param {number} [options.defaultRecallLimit=10]
   * @param {number} [options.maxExperiences=50000]
   */
  constructor(options = {}) {
    const {
      memory = null,
      embeddingProviderOptions = {},
      defaultRecallLimit = 10,
      maxExperiences = MAX_EXPERIENCES,
    } = options;

    this._memory = memory || new VectorMemory({
      defaultNamespace: EXPERIENCE_NS,
      maxEntries: maxExperiences,
    });

    this._embeddingProvider = createEmbeddingProvider(embeddingProviderOptions);
    this._defaultRecallLimit = defaultRecallLimit;
    this._maxExperiences = maxExperiences;

    /**
     * In-memory experience index (fast lookup by ID without full vector scan).
     * @type {Map<string, Experience>}
     */
    this._index = new Map();

    /**
     * Feedback log.
     * @type {Feedback[]}
     */
    this._feedbackLog = [];

    /**
     * Cached insights (regenerated on demand).
     * @type {Insight[]}
     */
    this._insights = [];

    /** Flag: insight cache is stale. */
    this._insightsDirty = true;

    /** Total experiences learned. */
    this._learnCount = 0;

    logger.info('ContinuousLearning initialised', { maxExperiences, defaultRecallLimit });
  }

  // ── Core learning ─────────────────────────────────────────────────────────

  /**
   * Stores an experience with its embedding in vector memory.
   *
   * @param {Object} experience
   * @param {string} experience.content - Textual content to embed
   * @param {Object} [experience.metadata={}] - Additional metadata
   * @param {string} [experience.id] - Optional explicit ID
   * @param {number} [experience.weight=1.0] - Initial learning weight [0, 2]
   * @returns {Promise<Experience>}
   */
  async learn(experience) {
    if (!experience || typeof experience.content !== 'string' || experience.content.length === 0) {
      throw new TypeError('experience.content must be a non-empty string');
    }

    const id = experience.id || `exp-${crypto.randomUUID()}`;
    const weight = Math.max(0, Math.min(2, experience.weight !== undefined ? experience.weight : 1.0));
    const now = Date.now();

    const { vector, provider } = await this._embeddingProvider.generateEmbedding(experience.content);

    /** @type {Experience} */
    const entry = {
      id,
      content: experience.content,
      vector,
      metadata: {
        ...(experience.metadata || {}),
        embeddingProvider: provider,
      },
      weight,
      feedbackHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    // Store vector in VectorMemory for semantic search
    this._memory.store(id, vector, {
      id,
      content: entry.content.slice(0, 200), // truncated preview
      weight: entry.weight,
      tags: entry.metadata.tags || [],
      createdAt: now,
    }, EXPERIENCE_NS);

    // Maintain index for fast lookup
    this._index.set(id, entry);
    if (this._index.size > this._maxExperiences) {
      this._pruneOldest();
    }

    this._learnCount++;
    this._insightsDirty = true;

    logger.debug('Experience learned', { id, provider, weight, contentLength: experience.content.length });
    return entry;
  }

  /**
   * Retrieves the most relevant experiences for a query.
   *
   * @param {string} query - Query text to embed and search
   * @param {number} [limit] - Max results (default: defaultRecallLimit)
   * @param {Object} [options={}]
   * @param {number} [options.minScore=0.4] - Minimum similarity score
   * @param {string[]} [options.tags] - Filter by metadata tags
   * @returns {Promise<RecallResult[]>}
   */
  async recall(query, limit, options = {}) {
    if (typeof query !== 'string' || query.length === 0) {
      throw new TypeError('query must be a non-empty string');
    }

    const maxResults = limit || this._defaultRecallLimit;
    const minScore = options.minScore !== undefined ? options.minScore : 0.4;
    const tags = options.tags || null;

    const { vector } = await this._embeddingProvider.generateEmbedding(query);
    const searchResults = this._memory.search(vector, maxResults * 3, minScore, EXPERIENCE_NS);

    const results = [];
    for (const result of searchResults) {
      const entry = this._index.get(result.key);
      if (!entry) continue;

      // Tag filtering
      if (tags && tags.length > 0) {
        const entryTags = entry.metadata.tags || [];
        if (!tags.some((t) => entryTags.includes(t))) continue;
      }

      results.push({
        id: entry.id,
        content: entry.content,
        similarity: result.score,
        weight: entry.weight,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      });

      if (results.length >= maxResults) break;
    }

    logger.debug('Recall complete', { query: query.slice(0, 50), results: results.length });
    return results;
  }

  // ── Adaptation ────────────────────────────────────────────────────────────

  /**
   * Adjusts the weight of an experience based on feedback.
   * Positive feedback increases weight (max 2.0), negative decreases (min 0.0).
   *
   * @param {Object} feedback
   * @param {string} feedback.experienceId
   * @param {number} feedback.score - Feedback signal [-1, 1]
   * @param {string} [feedback.signal] - Description of feedback signal
   * @returns {Promise<{ experienceId: string, newWeight: number, delta: number }>}
   */
  async adapt(feedback) {
    if (!feedback || typeof feedback.experienceId !== 'string') {
      throw new TypeError('feedback.experienceId is required');
    }
    if (typeof feedback.score !== 'number' || feedback.score < -1 || feedback.score > 1) {
      throw new TypeError('feedback.score must be a number in [-1, 1]');
    }

    const entry = this._index.get(feedback.experienceId);
    if (!entry) {
      logger.warn('adapt called on unknown experience', { id: feedback.experienceId });
      return null;
    }

    const prevWeight = entry.weight;

    // Exponential moving average update: weight = weight + α * (score_signal - weight)
    // α = 0.1 (slow adaptation to prevent oscillation)
    const targetWeight = 1.0 + feedback.score; // score -1→0, 0→1, +1→2
    const alpha = 0.1;
    entry.weight = Math.max(0, Math.min(2, prevWeight + alpha * (targetWeight - prevWeight)));
    entry.updatedAt = Date.now();

    // Track feedback history (capped)
    entry.feedbackHistory.push(feedback.score);
    if (entry.feedbackHistory.length > MAX_FEEDBACK_PER_EXPERIENCE) {
      entry.feedbackHistory.shift();
    }

    // Update the stored metadata weight
    this._memory.update(entry.id, entry.vector, { weight: entry.weight }, EXPERIENCE_NS);

    // Log feedback
    /** @type {Feedback} */
    const record = {
      experienceId: feedback.experienceId,
      score: feedback.score,
      signal: feedback.signal || null,
      timestamp: Date.now(),
    };
    this._feedbackLog.push(record);
    if (this._feedbackLog.length > 10_000) this._feedbackLog.shift();

    this._insightsDirty = true;

    logger.debug('Experience weight adapted', {
      id: feedback.experienceId,
      prevWeight,
      newWeight: entry.weight,
      score: feedback.score,
    });

    return {
      experienceId: feedback.experienceId,
      newWeight: entry.weight,
      delta: entry.weight - prevWeight,
    };
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  /**
   * Generates structured insights from accumulated learning data.
   * Results are cached; call with force=true to regenerate.
   *
   * @param {boolean} [force=false] - Force regeneration even if cache is fresh
   * @returns {Insight[]}
   */
  getInsights(force = false) {
    if (!force && !this._insightsDirty && this._insights.length > 0) {
      return this._insights;
    }

    const insights = [];
    const experiences = [...this._index.values()];

    if (experiences.length === 0) {
      this._insights = [];
      this._insightsDirty = false;
      return [];
    }

    // ── Insight 1: Volume trend ─────────────────────────────────────────────
    insights.push(this._insightVolumeTrend(experiences));

    // ── Insight 2: Weight distribution ─────────────────────────────────────
    const weightInsight = this._insightWeightDistribution(experiences);
    if (weightInsight) insights.push(weightInsight);

    // ── Insight 3: Feedback effectiveness ──────────────────────────────────
    if (this._feedbackLog.length >= 5) {
      insights.push(this._insightFeedbackEffectiveness());
    }

    // ── Insight 4: Semantic cluster health ─────────────────────────────────
    if (experiences.length >= 5) {
      const clusterInsight = this._insightSemanticClusters(experiences);
      if (clusterInsight) insights.push(clusterInsight);
    }

    // ── Insight 5: Tag distribution (if tags present) ──────────────────────
    const tagInsight = this._insightTagDistribution(experiences);
    if (tagInsight) insights.push(tagInsight);

    // Run pattern engine on aggregated experience data for additional patterns
    try {
      const aggData = {
        values: experiences.map((e) => e.weight),
        actions: experiences.slice(0, 100).map((e) => e.metadata.tags?.[0] || 'general'),
      };
      const patterns = patternEngine.detect(aggData, {
        sourceId: 'continuous-learning-insights',
        minConfidence: 0.5,
        includeOptimizations: false,
      });
      for (const p of patterns) {
        insights.push({
          id: `insight-pattern-${p.id}`,
          title: `Pattern: ${p.name}`,
          description: p.description,
          type: 'pattern',
          confidence: p.confidence,
          supportingExperienceIds: [],
          data: { pattern: p },
          generatedAt: Date.now(),
        });
      }
    } catch (err) {
      logger.warn('Pattern detection in getInsights failed', { err });
    }

    this._insights = insights.filter(Boolean);
    this._insightsDirty = false;

    logger.info('Insights generated', { count: this._insights.length, experiences: experiences.length });
    return this._insights;
  }

  // ── Insight generators ────────────────────────────────────────────────────

  /**
   * @private
   */
  _insightVolumeTrend(experiences) {
    const now = Date.now();
    const recent24h = experiences.filter((e) => now - e.createdAt < 86_400_000).length;
    const recent7d = experiences.filter((e) => now - e.createdAt < 7 * 86_400_000).length;
    const rate24h = recent24h;
    const rate7dAvg = recent7d / 7;

    const trending = rate24h > rate7dAvg * 1.5;

    return {
      id: `insight-volume-${Date.now()}`,
      title: trending ? 'Learning Rate Spike' : 'Learning Rate',
      description: `${recent24h} experience(s) in last 24h vs ${rate7dAvg.toFixed(1)}/day avg over 7 days. Total: ${experiences.length}.`,
      type: 'trend',
      confidence: experiences.length > 10 ? 0.85 : 0.5,
      supportingExperienceIds: [],
      data: { total: experiences.length, recent24h, recent7d, rate24h, rate7dAvg, trending },
      generatedAt: Date.now(),
    };
  }

  /**
   * @private
   */
  _insightWeightDistribution(experiences) {
    if (experiences.length === 0) return null;
    const weights = experiences.map((e) => e.weight);
    const avg = weights.reduce((s, w) => s + w, 0) / weights.length;
    const highWeight = weights.filter((w) => w > 1.5).length;
    const lowWeight = weights.filter((w) => w < 0.5).length;

    if (highWeight + lowWeight === 0) return null;

    return {
      id: `insight-weights-${Date.now()}`,
      title: 'Experience Weight Distribution',
      description: `${highWeight} high-value experiences (w>1.5), ${lowWeight} low-value (w<0.5). Average weight: ${avg.toFixed(3)}.`,
      type: 'cluster',
      confidence: 0.75,
      supportingExperienceIds: experiences
        .filter((e) => e.weight > 1.5)
        .slice(0, 5)
        .map((e) => e.id),
      data: { avgWeight: avg, highWeight, lowWeight, total: experiences.length },
      generatedAt: Date.now(),
    };
  }

  /**
   * @private
   */
  _insightFeedbackEffectiveness() {
    const recentFeedback = this._feedbackLog.slice(-100);
    const positive = recentFeedback.filter((f) => f.score > 0).length;
    const negative = recentFeedback.filter((f) => f.score < 0).length;
    const avgScore = recentFeedback.reduce((s, f) => s + f.score, 0) / recentFeedback.length;

    return {
      id: `insight-feedback-${Date.now()}`,
      title: 'Feedback Effectiveness',
      description: `Last ${recentFeedback.length} feedback signals: ${positive} positive, ${negative} negative. Avg score: ${avgScore.toFixed(3)}.`,
      type: 'trend',
      confidence: Math.min(1, recentFeedback.length / 50),
      supportingExperienceIds: [],
      data: { positive, negative, avgScore, sampleSize: recentFeedback.length },
      generatedAt: Date.now(),
    };
  }

  /**
   * @private
   */
  _insightSemanticClusters(experiences) {
    // Use up to 100 most recently updated experiences
    const sample = experiences
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100);

    const vectors = sample.map((e) => e.vector).filter((v) => v && v.length === 384);
    if (vectors.length < 3) return null;

    try {
      const center = centroid(vectors);
      const similarities = vectors.map((v) => {
        const { cosineSimilarity: cs } = require('./vector-space-ops');
        return cs(center, v);
      });
      const avgSim = similarities.reduce((s, v) => s + v, 0) / similarities.length;
      const cohesive = avgSim > 0.7;

      return {
        id: `insight-clusters-${Date.now()}`,
        title: cohesive ? 'Cohesive Knowledge Base' : 'Diverse Knowledge Base',
        description: `${vectors.length}-experience sample has avg centroid similarity ${avgSim.toFixed(3)}. ${
          cohesive ? 'Knowledge is focused/cohesive.' : 'Knowledge is broad/diverse.'
        }`,
        type: 'cluster',
        confidence: 0.7,
        supportingExperienceIds: sample.slice(0, 5).map((e) => e.id),
        data: { sampleSize: vectors.length, avgCentroidSimilarity: avgSim, cohesive },
        generatedAt: Date.now(),
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * @private
   */
  _insightTagDistribution(experiences) {
    const tagCounts = {};
    for (const e of experiences) {
      const tags = e.metadata.tags || [];
      for (const t of tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    const total = Object.values(tagCounts).reduce((s, c) => s + c, 0);
    if (total === 0) return null;

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count, fraction: count / experiences.length }));

    return {
      id: `insight-tags-${Date.now()}`,
      title: 'Top Learning Topics',
      description: `Top tags: ${topTags.map((t) => `${t.tag}(${t.count})`).join(', ')}`,
      type: 'cluster',
      confidence: 0.8,
      supportingExperienceIds: [],
      data: { topTags, totalTaggedExperiences: total, totalExperiences: experiences.length },
      generatedAt: Date.now(),
    };
  }

  // ── Lifecycle & stats ─────────────────────────────────────────────────────

  /**
   * Returns learning system statistics.
   *
   * @returns {Object}
   */
  stats() {
    const experiences = [...this._index.values()];
    const weights = experiences.map((e) => e.weight);
    const avgWeight = weights.length
      ? weights.reduce((s, w) => s + w, 0) / weights.length
      : 0;

    return {
      totalExperiences: this._index.size,
      totalLearned: this._learnCount,
      totalFeedback: this._feedbackLog.length,
      avgExperienceWeight: Math.round(avgWeight * 1000) / 1000,
      memoryStats: this._memory.stats(),
      embeddingProviderStats: this._embeddingProvider.stats(),
      insightCount: this._insights.length,
    };
  }

  /**
   * Removes the oldest experience from the index.
   * @private
   */
  _pruneOldest() {
    let oldest = null;
    for (const entry of this._index.values()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
      }
    }
    if (oldest) {
      this._index.delete(oldest.id);
      this._memory.delete(oldest.id, EXPERIENCE_NS);
      logger.warn('Max experiences reached; pruned oldest', { id: oldest.id });
    }
  }

  /**
   * Clears all learning data.
   * @returns {void}
   */
  reset() {
    this._index.clear();
    this._memory.clearNamespace(EXPERIENCE_NS);
    this._feedbackLog = [];
    this._insights = [];
    this._insightsDirty = true;
    logger.info('ContinuousLearning reset');
  }
}

// ---------------------------------------------------------------------------
// Factory & singleton
// ---------------------------------------------------------------------------

/**
 * Creates a new ContinuousLearning instance.
 * @param {Object} [options={}]
 * @returns {ContinuousLearning}
 */
function createContinuousLearning(options = {}) {
  return new ContinuousLearning(options);
}

/** Shared default continuous learning instance. */
const defaultLearner = new ContinuousLearning();

module.exports = {
  ContinuousLearning,
  createContinuousLearning,
  defaultLearner,
  EXPERIENCE_NS,
  INSIGHT_NS,
};
