'use strict';

/**
 * DeepResearchEngine — Multi-provider deep research with consensus synthesis.
 * Queries multiple LLM/search providers, cross-references results, and
 * synthesizes a high-confidence research report.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const RESEARCH_DEPTH = {
  SHALLOW: 'shallow',   // 1 provider, 1 pass
  STANDARD: 'standard', // 2 providers, basic synthesis
  DEEP: 'deep',         // 3+ providers, cross-reference + consensus
  EXHAUSTIVE: 'exhaustive', // All providers, multi-pass synthesis
};

const DEFAULT_PROVIDERS_BY_DEPTH = {
  shallow:    ['perplexity-sonar'],
  standard:   ['perplexity-sonar', 'claude-3-5-sonnet'],
  deep:       ['perplexity-sonar', 'claude-3-5-sonnet', 'gpt-4o'],
  exhaustive: ['perplexity-sonar', 'claude-3-5-sonnet', 'gpt-4o', 'claude-3-opus'],
};

class DeepResearchEngine extends EventEmitter {
  /**
   * @param {object} gateway — object with generate(prompt, opts) method (e.g., LLMRouter)
   */
  constructor(gateway, opts = {}) {
    super();
    this.gateway = gateway;
    this._cache = new Map();      // queryHash → CachedResult
    this._cacheTTL = opts.cacheTTL || 30 * 60 * 1000; // 30 min
    this._maxCacheSize = opts.maxCacheSize || 500;
    this._stats = { queries: 0, cacheHits: 0, errors: 0, totalTokens: 0, avgLatencyMs: 0 };
    this._history = [];
    this._maxHistory = opts.maxHistory || 200;
  }

  // ─── Core research ─────────────────────────────────────────────────────────

  /**
   * Conduct deep research on a query.
   * @param {string} query
   * @param {object} opts
   * @param {string} [opts.depth] — 'shallow' | 'standard' | 'deep' | 'exhaustive'
   * @param {string[]} [opts.providers] — override provider list
   * @param {boolean} [opts.useCache]
   * @param {string} [opts.outputFormat] — 'text' | 'json' | 'markdown'
   * @param {object} [opts.context] — additional context to inject
   * @returns {Promise<ResearchResult>}
   */
  async research(query, opts = {}) {
    const depth = opts.depth || RESEARCH_DEPTH.STANDARD;
    const providers = opts.providers || DEFAULT_PROVIDERS_BY_DEPTH[depth] || DEFAULT_PROVIDERS_BY_DEPTH.standard;
    const useCache = opts.useCache !== false;
    const outputFormat = opts.outputFormat || 'markdown';

    // Cache check
    if (useCache) {
      const cached = this._getCached(query, depth);
      if (cached) {
        this._stats.cacheHits++;
        return cached;
      }
    }

    const startMs = Date.now();
    this._stats.queries++;
    this.emit('research-started', { query: query.slice(0, 100), depth, providers });

    const researchId = 'res_' + crypto.randomBytes(8).toString('hex');

    // Step 1: Parallel first-pass research from all providers
    const firstPassResults = await this._firstPass(query, providers, opts);

    // Step 2: Cross-reference and identify disagreements
    const analysis = this._analyzeResults(firstPassResults);

    // Step 3: Synthesis
    let synthesis;
    if (providers.length === 1 || depth === RESEARCH_DEPTH.SHALLOW) {
      synthesis = firstPassResults[0]?.text || '';
    } else {
      synthesis = await this._synthesize(query, firstPassResults, analysis, { outputFormat, context: opts.context });
    }

    // Step 4: Confidence scoring
    const confidence = this._scoreConfidence(analysis, firstPassResults);

    const latencyMs = Date.now() - startMs;
    this._stats.avgLatencyMs = Math.round((this._stats.avgLatencyMs * (this._stats.queries - 1) + latencyMs) / this._stats.queries);

    const result = {
      id: researchId,
      query,
      depth,
      providers: providers.slice(),
      synthesis,
      providerResults: firstPassResults.map(r => ({
        provider: r.provider,
        text: r.text,
        citations: r.citations || [],
        tokens: r.tokens,
        error: r.error || null,
      })),
      analysis,
      confidence,
      latencyMs,
      completedAt: new Date().toISOString(),
    };

    // Cache result
    if (useCache) this._setCached(query, depth, result);

    // Store in history
    this._history.push({ id: researchId, query: query.slice(0, 100), depth, confidence, latencyMs, ts: result.completedAt });
    if (this._history.length > this._maxHistory) this._history.shift();

    this.emit('research-complete', { id: researchId, confidence, latencyMs });
    return result;
  }

  // ─── First pass ────────────────────────────────────────────────────────────

  async _firstPass(query, providers, opts = {}) {
    const systemPrompt = opts.systemPrompt || `You are a thorough research assistant. For the given query, provide:
1. A comprehensive, accurate answer
2. Key facts and data points
3. Any important caveats or uncertainties
4. Sources where applicable`;

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const result = await this.gateway.generate(query, {
            taskType: 'research',
            systemPrompt,
            maxTokens: opts.maxTokens || 2048,
            temperature: opts.temperature || 0.3,
            _forceProvider: provider,
          });
          const totalTokens = (result.tokens?.input || 0) + (result.tokens?.output || 0);
          this._stats.totalTokens += totalTokens;
          return { provider, text: result.text, citations: result.citations || [], tokens: totalTokens };
        } catch (err) {
          this._stats.errors++;
          return { provider, text: '', error: err.message, tokens: 0 };
        }
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r.text || r.error);
  }

  // ─── Analysis ──────────────────────────────────────────────────────────────

  _analyzeResults(results) {
    const successful = results.filter(r => !r.error && r.text);
    if (successful.length === 0) return { consensus: false, agreements: [], disagreements: [], coverage: 0 };

    // Find common themes (simple keyword overlap)
    const wordSets = successful.map(r => new Set(r.text.toLowerCase().split(/\W+/).filter(w => w.length > 4)));
    const allWords = new Set([...wordSets].flatMap(s => [...s]));
    const commonWords = [...allWords].filter(word => wordSets.filter(s => s.has(word)).length >= Math.ceil(successful.length * 0.6));

    const agreements = commonWords.slice(0, 20);
    const coverage = successful.length / Math.max(results.length, 1);

    return {
      consensus: agreements.length > 5,
      agreements,
      disagreements: [], // Would require deeper NLU to detect
      coverage,
      successfulProviders: successful.map(r => r.provider),
      failedProviders: results.filter(r => r.error).map(r => r.provider),
    };
  }

  // ─── Synthesis ─────────────────────────────────────────────────────────────

  async _synthesize(query, results, analysis, opts = {}) {
    const successful = results.filter(r => !r.error && r.text);
    if (successful.length === 0) return '';
    if (successful.length === 1) return successful[0].text;

    const format = opts.outputFormat || 'markdown';
    const context = opts.context ? `\n\nAdditional context: ${JSON.stringify(opts.context)}` : '';

    const inputTexts = successful.map((r, i) => `--- Source ${i + 1} (${r.provider}) ---\n${r.text}`).join('\n\n');

    const synthPrompt = `You are synthesizing research from multiple sources.

Query: "${query}"

Sources:
${inputTexts}${context}

Create a comprehensive, accurate synthesis that:
1. Combines the best information from all sources
2. Resolves any contradictions (noting them explicitly)
3. Presents findings in ${format} format
4. Includes confidence indicators for uncertain claims

Synthesis:`;

    try {
      const result = await this.gateway.generate(synthPrompt, {
        taskType: 'research',
        maxTokens: opts.maxTokens || 3000,
        temperature: 0.2,
        systemPrompt: 'You are a precise research synthesizer. Be accurate, comprehensive, and note uncertainty.',
      });
      return result.text;
    } catch (err) {
      // Fallback: return the best single result
      return successful[0].text;
    }
  }

  // ─── Confidence scoring ────────────────────────────────────────────────────

  _scoreConfidence(analysis, results) {
    let score = 0.5; // base
    score += analysis.coverage * 0.2;
    if (analysis.consensus) score += 0.2;
    score -= analysis.failedProviders?.length * 0.05;
    score = Math.max(0, Math.min(1, score));
    return {
      score: parseFloat(score.toFixed(2)),
      level: score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low',
      factors: {
        consensus: analysis.consensus,
        coverage: analysis.coverage,
        successfulProviders: analysis.successfulProviders?.length || 0,
      },
    };
  }

  // ─── Cache ─────────────────────────────────────────────────────────────────

  _cacheKey(query, depth) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(`${query}:${depth}`).digest('hex');
  }

  _getCached(query, depth) {
    const key = this._cacheKey(query, depth);
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this._cacheTTL) { this._cache.delete(key); return null; }
    return entry.result;
  }

  _setCached(query, depth, result) {
    if (this._cache.size >= this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(this._cacheKey(query, depth), { result, ts: Date.now() });
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  getStats() {
    return {
      ...this._stats,
      cacheSize: this._cache.size,
      historySize: this._history.length,
    };
  }

  getHistory(limit = 50) {
    return this._history.slice(-limit).reverse();
  }
}

let _instance = null;
function getDeepResearchEngine(gateway, opts) {
  if (!_instance) {
    if (!gateway) {
      const { getLLMRouter } = require('./services/llm-router');
      gateway = getLLMRouter();
    }
    _instance = new DeepResearchEngine(gateway, opts);
  }
  return _instance;
}

module.exports = { DeepResearchEngine, getDeepResearchEngine, RESEARCH_DEPTH };
