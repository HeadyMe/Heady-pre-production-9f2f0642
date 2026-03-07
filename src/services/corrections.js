/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

// ─── Pattern Categories ───────────────────────────────────────────────────────

const PATTERN_CATEGORIES = Object.freeze({
  INEFFICIENCY:     'inefficiency',
  ERROR_PRONE:      'error_prone',
  SUBOPTIMAL:       'suboptimal',
  DRIFT:            'drift',
  REDUNDANCY:       'redundancy',
  TIMING:           'timing',
  RESOURCE_WASTE:   'resource_waste',
  COMMUNICATION:    'communication',
});

const CORRECTION_STRATEGIES = Object.freeze({
  SUBSTITUTE:  'substitute',   // Replace behavior with better alternative
  AUGMENT:     'augment',      // Add something missing
  REDUCE:      'reduce',       // Remove excess or redundancy
  REORDER:     'reorder',      // Change sequence
  AUTOMATE:    'automate',     // Automate manual steps
  CACHE:       'cache',        // Add caching to repeated work
  PARALLELIZE: 'parallelize',  // Run things in parallel
});

// ─── Suggestion Templates ─────────────────────────────────────────────────────

const SUGGESTION_CATALOG = {
  inefficiency: [
    { text: 'Consider batching similar operations to reduce overhead', strategy: CORRECTION_STRATEGIES.AUGMENT },
    { text: 'This pattern shows sequential processing where parallelism is possible', strategy: CORRECTION_STRATEGIES.PARALLELIZE },
    { text: 'Caching this result could reduce repeated computation', strategy: CORRECTION_STRATEGIES.CACHE },
  ],
  error_prone: [
    { text: 'Add input validation before processing to catch errors early', strategy: CORRECTION_STRATEGIES.AUGMENT },
    { text: 'Consider wrapping in try-catch with structured error handling', strategy: CORRECTION_STRATEGIES.AUGMENT },
    { text: 'This operation benefits from a retry mechanism with backoff', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
  ],
  suboptimal: [
    { text: 'There is a more direct path to this outcome', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
    { text: 'This approach works but a higher-quality method exists', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
    { text: 'Consider the vector memory approach for this type of lookup', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
  ],
  drift: [
    { text: 'Behavior has shifted from baseline — reanchoring recommended', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
    { text: 'Pattern indicates gradual drift from defined objectives', strategy: CORRECTION_STRATEGIES.REORDER },
  ],
  redundancy: [
    { text: 'This operation is performed multiple times — deduplicate', strategy: CORRECTION_STRATEGIES.REDUCE },
    { text: 'Identical requests detected — consolidate into one call', strategy: CORRECTION_STRATEGIES.REDUCE },
  ],
  timing: [
    { text: 'This would perform better during off-peak hours', strategy: CORRECTION_STRATEGIES.REORDER },
    { text: 'Pre-warming this resource before peak usage improves response time', strategy: CORRECTION_STRATEGIES.AUGMENT },
  ],
  resource_waste: [
    { text: 'Resources allocated but underutilized — consider downsizing', strategy: CORRECTION_STRATEGIES.REDUCE },
    { text: 'This pattern holds connections open longer than needed', strategy: CORRECTION_STRATEGIES.REDUCE },
  ],
  communication: [
    { text: 'This message chain can be compressed into a single structured call', strategy: CORRECTION_STRATEGIES.REDUCE },
    { text: 'Consider async messaging here to avoid blocking', strategy: CORRECTION_STRATEGIES.SUBSTITUTE },
  ],
};

// ─── Corrections ──────────────────────────────────────────────────────────────

/**
 * HeadyCorrections
 *
 * Behavioral analysis and subtle improvement engine.
 * Observes patterns, suggests improvements, and tracks behavioral evolution
 * over time — discreetly integrated into the platform.
 */
class Corrections extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.patternWindow]   - Events to track per pattern (default 50)
   * @param {number}  [opts.patternThreshold] - Occurrences before suggesting (default 3)
   * @param {object}  [opts.logger]
   */
  constructor({ patternWindow = 50, patternThreshold = 3, logger } = {}) {
    super();
    this._patterns = new Map();
    this._corrections = new Map();
    this._patternWindow = patternWindow;
    this._patternThreshold = patternThreshold;
    this._log = logger || this._defaultLogger();

    this._stats = {
      analysisCount: 0,
      suggestionsGenerated: 0,
      patternsTracked: 0,
      correctionsApplied: 0,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _defaultLogger() {
    return {
      info:  () => {},
      warn:  (...a) => console.error('[Corrections:WARN]',  ...a),
      error: (...a) => console.error('[Corrections:ERROR]', ...a),
    };
  }

  _generateId() {
    return `correction_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  }

  _detectCategory(behavior, context) {
    const text = (behavior + JSON.stringify(context || {})).toLowerCase();

    if (/repeat|duplicate|again|already|multiple times/.test(text)) return PATTERN_CATEGORIES.REDUNDANCY;
    if (/slow|timeout|wait|delay|latency/.test(text)) return PATTERN_CATEGORIES.INEFFICIENCY;
    if (/error|fail|exception|crash|broke/.test(text)) return PATTERN_CATEGORIES.ERROR_PRONE;
    if (/waste|idle|unused|underutil/.test(text)) return PATTERN_CATEGORIES.RESOURCE_WASTE;
    if (/drift|deviation|change|shifted/.test(text)) return PATTERN_CATEGORIES.DRIFT;
    if (/suboptimal|not great|could be better|workaround/.test(text)) return PATTERN_CATEGORIES.SUBOPTIMAL;
    if (/schedule|time|peak|off-hours/.test(text)) return PATTERN_CATEGORIES.TIMING;
    if (/message|api call|request|communicate/.test(text)) return PATTERN_CATEGORIES.COMMUNICATION;

    return PATTERN_CATEGORIES.SUBOPTIMAL; // Default category
  }

  _calculateSeverity(category, occurrences) {
    const baseScores = {
      [PATTERN_CATEGORIES.ERROR_PRONE]:    0.8,
      [PATTERN_CATEGORIES.DRIFT]:          0.7,
      [PATTERN_CATEGORIES.INEFFICIENCY]:   0.5,
      [PATTERN_CATEGORIES.RESOURCE_WASTE]: 0.5,
      [PATTERN_CATEGORIES.REDUNDANCY]:     0.4,
      [PATTERN_CATEGORIES.SUBOPTIMAL]:     0.3,
      [PATTERN_CATEGORIES.TIMING]:         0.3,
      [PATTERN_CATEGORIES.COMMUNICATION]:  0.2,
    };

    const base = baseScores[category] || 0.3;
    const frequencyMultiplier = Math.min(occurrences / 10, 1.5);
    return Math.min(base * frequencyMultiplier, 1.0);
  }

  _selectSuggestions(category, limit = 2) {
    const catalog = SUGGESTION_CATALOG[category] || SUGGESTION_CATALOG.suboptimal;
    // Non-destructive shuffle — return top N
    return catalog
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Analyze a behavior pattern and return insights.
   *
   * @param {string} behavior   - Behavior description to analyze
   * @param {object} [context]  - Context metadata (service, userId, frequency, etc.)
   * @returns {Promise<object>} Analysis result
   */
  async analyze(behavior, context = {}) {
    if (!behavior) throw new Error('Behavior description is required');

    this._stats.analysisCount++;

    const category = context.category || this._detectCategory(behavior, context);
    const occurrences = context.frequency || 1;
    const severity = this._calculateSeverity(category, occurrences);

    const analysis = {
      id: this._generateId(),
      behavior,
      category,
      severity,
      severityLabel: severity >= 0.7 ? 'high' : severity >= 0.4 ? 'medium' : 'low',
      timestamp: new Date().toISOString(),
      context,
      insights: [],
    };

    // Generate insights based on category
    if (category === PATTERN_CATEGORIES.INEFFICIENCY) {
      analysis.insights.push(`Inefficiency detected. Estimated performance impact: ${(severity * 100).toFixed(0)}%`);
    } else if (category === PATTERN_CATEGORIES.ERROR_PRONE) {
      analysis.insights.push(`Error-prone pattern. Risk score: ${severity.toFixed(2)}`);
    } else if (category === PATTERN_CATEGORIES.DRIFT) {
      analysis.insights.push(`Semantic drift from baseline detected at magnitude ${severity.toFixed(2)}`);
    } else {
      analysis.insights.push(`Behavioral pattern '${category}' identified with severity ${severity.toFixed(2)}`);
    }

    // Track pattern automatically
    await this.track({ behavior, category, severity, context });

    this.emit('analysis', analysis);
    return analysis;
  }

  /**
   * Generate improvement suggestions for a behavior.
   *
   * @param {string} behavior - Behavior to improve
   * @param {object} [opts]
   * @param {string} [opts.category] - Pre-classified category (skips detection)
   * @param {number} [opts.limit=3]  - Max suggestions to return
   * @returns {Promise<Array<{ text: string, strategy: string, priority: string }>>}
   */
  async suggest(behavior, { category, limit = 3 } = {}) {
    if (!behavior) throw new Error('Behavior is required');

    const detectedCategory = category || this._detectCategory(behavior, {});
    const rawSuggestions = this._selectSuggestions(detectedCategory, limit);

    this._stats.suggestionsGenerated += rawSuggestions.length;

    const suggestions = rawSuggestions.map((s, i) => ({
      id: `${this._generateId()}_s${i}`,
      text: s.text,
      strategy: s.strategy,
      category: detectedCategory,
      priority: i === 0 ? 'primary' : 'secondary',
      subtlety: 'discreet',   // Heady corrections are always subtle
      timestamp: new Date().toISOString(),
    }));

    this.emit('suggestions', { behavior, suggestions });
    return suggestions;
  }

  /**
   * Track a behavioral pattern over time.
   * Accumulates occurrences and fires 'pattern_threshold' event when
   * a pattern crosses the configured threshold.
   *
   * @param {object} pattern
   * @param {string} pattern.behavior   - Behavior description (used as key)
   * @param {string} [pattern.category]
   * @param {number} [pattern.severity]
   * @param {object} [pattern.context]
   * @returns {Promise<object>} Updated pattern record
   */
  async track(pattern) {
    if (!pattern || !pattern.behavior) throw new Error('Pattern must have a behavior');

    const key = pattern.behavior.toLowerCase().trim().substring(0, 128);
    const category = pattern.category || this._detectCategory(pattern.behavior, pattern.context || {});

    if (!this._patterns.has(key)) {
      this._patterns.set(key, {
        behavior: pattern.behavior,
        category,
        occurrences: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: null,
        history: [],
        corrections: [],
      });
      this._stats.patternsTracked++;
    }

    const record = this._patterns.get(key);
    record.occurrences++;
    record.lastSeen = new Date().toISOString();
    record.category = category;

    // Maintain sliding window of history
    record.history.push({
      timestamp: new Date().toISOString(),
      severity: pattern.severity || 0,
      context: pattern.context || {},
    });
    if (record.history.length > this._patternWindow) {
      record.history.shift();
    }

    // Fire threshold event
    if (record.occurrences === this._patternThreshold) {
      this._log.warn(`Pattern threshold reached: '${key}' (${record.occurrences} occurrences)`);
      this.emit('pattern_threshold', { key, record });
    }

    return record;
  }

  /**
   * Get all tracked patterns, optionally filtered by category or threshold.
   *
   * @param {object} [filters]
   * @param {string}  [filters.category]
   * @param {number}  [filters.minOccurrences]
   * @param {'severity'|'occurrences'|'lastSeen'} [filters.sortBy]
   * @returns {object[]}
   */
  getPatterns(filters = {}) {
    let patterns = Array.from(this._patterns.values());

    if (filters.category) {
      patterns = patterns.filter((p) => p.category === filters.category);
    }

    if (filters.minOccurrences) {
      patterns = patterns.filter((p) => p.occurrences >= filters.minOccurrences);
    }

    const sortBy = filters.sortBy || 'occurrences';
    if (sortBy === 'occurrences') {
      patterns.sort((a, b) => b.occurrences - a.occurrences);
    } else if (sortBy === 'lastSeen') {
      patterns.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    }

    return patterns;
  }

  /**
   * Record that a correction was applied.
   *
   * @param {string} patternKey  - Behavior key
   * @param {string} correctionId
   * @param {object} [result]
   */
  recordCorrectionApplied(patternKey, correctionId, result = {}) {
    const record = this._patterns.get(patternKey.toLowerCase().trim().substring(0, 128));
    if (record) {
      record.corrections.push({
        correctionId,
        appliedAt: new Date().toISOString(),
        result,
      });
    }
    this._stats.correctionsApplied++;
    this.emit('correction_applied', { patternKey, correctionId, result });
  }

  /**
   * Return stats about the corrections engine.
   * @returns {object}
   */
  getStats() {
    return {
      ...this._stats,
      patternsInMemory: this._patterns.size,
      patternThreshold: this._patternThreshold,
      patternWindow: this._patternWindow,
    };
  }

  /**
   * Clear tracked patterns (does not affect corrections log).
   */
  clearPatterns() {
    this._patterns.clear();
    this._log.warn('Pattern tracking data cleared');
  }

  /**
   * Expose all pattern categories.
   */
  static get PATTERN_CATEGORIES() {
    return PATTERN_CATEGORIES;
  }

  /**
   * Expose all correction strategies.
   */
  static get CORRECTION_STRATEGIES() {
    return CORRECTION_STRATEGIES;
  }
}

module.exports = Corrections;
