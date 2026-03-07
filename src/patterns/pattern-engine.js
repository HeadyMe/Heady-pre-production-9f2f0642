/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Pattern Recognition Engine.
 * Detects patterns via four analytical lenses: structural, temporal,
 * behavioral, and semantic. Supports registering canonical patterns
 * and suggesting optimizations.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const PATTERN_TYPES = Object.freeze({
  STRUCTURAL:  'structural',
  TEMPORAL:    'temporal',
  BEHAVIORAL:  'behavioral',
  SEMANTIC:    'semantic',
});

// ─── CanonicalPattern factory ─────────────────────────────────────────────────

/**
 * @typedef {object} CanonicalPattern
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {number} confidence  0-1
 * @property {number} detectedAt  Unix ms
 */

/**
 * Create a CanonicalPattern object.
 * @param {object} def
 * @returns {CanonicalPattern}
 */
function _makeCanonical(def) {
  return {
    id:          def.id || crypto.randomUUID(),
    name:        def.name || 'unnamed',
    type:        def.type || PATTERN_TYPES.STRUCTURAL,
    description: def.description || '',
    confidence:  typeof def.confidence === 'number' ? def.confidence : 0.5,
    detectedAt:  def.detectedAt || Date.now(),
  };
}

// ─── Detection lenses ─────────────────────────────────────────────────────────

/**
 * Structural lens: looks at shape, repetition, nesting depth.
 */
function _detectStructural(data) {
  const findings = [];
  if (Array.isArray(data)) {
    if (data.length > 1) {
      // Check if elements share the same keys (homogeneous array of objects)
      const sample = data[0];
      if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
        const keys = Object.keys(sample).sort().join(',');
        const homogeneous = data.every(
          el => typeof el === 'object' && !Array.isArray(el) && Object.keys(el).sort().join(',') === keys,
        );
        if (homogeneous) findings.push({ name: 'HomogeneousArray', confidence: 0.9, detail: { keys: keys.split(',') } });
      }
      // Check for repeated elements
      const serialised = data.map(el => JSON.stringify(el));
      const unique = new Set(serialised);
      if (unique.size < data.length * 0.5) {
        findings.push({ name: 'HighRepetition', confidence: 0.8, detail: { repetitionRatio: 1 - unique.size / data.length } });
      }
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const depth = _maxDepth(data);
    if (depth >= 4) findings.push({ name: 'DeepNesting', confidence: 0.7, detail: { depth } });
  }
  return findings;
}

function _maxDepth(obj, current = 0) {
  if (typeof obj !== 'object' || obj === null) return current;
  return Math.max(current + 1, ...Object.values(obj).map(v => _maxDepth(v, current + 1)));
}

/**
 * Temporal lens: detects timestamps, sequences, periodicity.
 */
function _detectTemporal(data, context) {
  const findings = [];
  const ctxText = JSON.stringify(context || {});
  // Look for timestamp fields in objects
  const tsKeys = ['timestamp', 'createdAt', 'updatedAt', 'ts', 'time', 'date'];
  if (Array.isArray(data) && data.length > 1) {
    const sample = data[0];
    if (sample && typeof sample === 'object') {
      const foundTsKey = tsKeys.find(k => k in sample);
      if (foundTsKey) {
        const times = data.map(el => +new Date(el[foundTsKey])).filter(Boolean).sort();
        if (times.length > 1) {
          const diffs = times.slice(1).map((t, i) => t - times[i]);
          const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          const variance = diffs.map(d => (d - avg) ** 2).reduce((a, b) => a + b, 0) / diffs.length;
          const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
          if (cv < 0.15) {
            findings.push({ name: 'RegularInterval', confidence: 0.85, detail: { intervalMs: Math.round(avg), cv } });
          } else {
            findings.push({ name: 'TimeSeries', confidence: 0.7, detail: { count: times.length } });
          }
        }
      }
    }
  }
  if (ctxText.toLowerCase().includes('cron') || ctxText.toLowerCase().includes('schedule')) {
    findings.push({ name: 'ScheduledExecution', confidence: 0.75, detail: {} });
  }
  return findings;
}

/**
 * Behavioral lens: detects state machines, retry patterns, error patterns.
 */
function _detectBehavioral(data, context) {
  const findings = [];
  const str = JSON.stringify(data || {});
  // Retry / backoff signals
  if (/retry|attempt|backoff/i.test(str)) {
    findings.push({ name: 'RetryPattern', confidence: 0.8, detail: {} });
  }
  // State transition signals
  if (/state|transition|from.*to|status.*change/i.test(str)) {
    findings.push({ name: 'StateMachine', confidence: 0.7, detail: {} });
  }
  // Error aggregation
  if (Array.isArray(data)) {
    const errorCount = data.filter(el => (el && (el.error || el.err || el.status === 'error'))).length;
    if (errorCount > 0 && errorCount / data.length > 0.1) {
      findings.push({ name: 'ErrorBurst', confidence: 0.85, detail: { errorRatio: errorCount / data.length } });
    }
  }
  return findings;
}

/**
 * Semantic lens: keyword / topic clustering, intent signals.
 */
function _detectSemantic(data, context) {
  const findings = [];
  const text = JSON.stringify(data || {}).toLowerCase();
  const topics = {
    Authentication:  /auth|token|jwt|oauth|session|login/,
    DataIngestion:   /ingest|pipeline|stream|batch|etl/,
    Notification:    /notify|alert|email|webhook|push/,
    Configuration:   /config|setting|env|environment|flag/,
    Analytics:       /metric|analytics|track|event|telemetry/,
  };
  for (const [topic, regex] of Object.entries(topics)) {
    if (regex.test(text)) {
      findings.push({ name: `${topic}Domain`, confidence: 0.65, detail: { topic } });
    }
  }
  // Detect question-intent in context
  if (context && typeof context.intent === 'string' && context.intent.includes('?')) {
    findings.push({ name: 'QueryIntent', confidence: 0.7, detail: {} });
  }
  return findings;
}

// ─── PatternEngine ────────────────────────────────────────────────────────────

class PatternEngine {
  constructor() {
    /** @type {Map<string, CanonicalPattern>} */
    this._registry = new Map();
    /** @type {Array<{ detectedAt: number, patterns: CanonicalPattern[], context: object }>} */
    this._history = [];

    logger.info({ component: 'PatternEngine' }, 'PatternEngine initialised');
  }

  // ─── Detection ──────────────────────────────────────────────────────────────

  /**
   * Detect patterns in `data` via all four lenses.
   * Also cross-references registered canonical patterns.
   *
   * @param {*} data     the data to analyse
   * @param {object} [context={}]  optional context hints (intent, source, tags, etc.)
   * @returns {{ patterns: CanonicalPattern[], lenses: object }}
   */
  detect(data, context = {}) {
    const lensResults = {
      structural: _detectStructural(data),
      temporal:   _detectTemporal(data, context),
      behavioral: _detectBehavioral(data, context),
      semantic:   _detectSemantic(data, context),
    };

    const patterns = [];

    for (const [lensName, findings] of Object.entries(lensResults)) {
      for (const finding of findings) {
        const canonical = _makeCanonical({
          name:        finding.name,
          type:        lensName,
          description: JSON.stringify(finding.detail || {}),
          confidence:  finding.confidence,
        });
        patterns.push(canonical);
      }
    }

    // Cross-reference registered canonical patterns
    const registeredMatches = this._matchRegistered(data, context);
    for (const match of registeredMatches) {
      patterns.push({ ...match, detectedAt: Date.now() });
    }

    const entry = { detectedAt: Date.now(), patterns, context };
    this._history.push(entry);

    logger.debug({ patternCount: patterns.length }, 'PatternEngine: detect complete');
    return { patterns, lenses: lensResults };
  }

  /**
   * @private
   */
  _matchRegistered(data, context) {
    const matches = [];
    const str = JSON.stringify(data || '').toLowerCase();
    for (const [, pattern] of this._registry.entries()) {
      // Naive keyword match on description
      const keywords = pattern.description.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      if (keywords.length > 0 && keywords.some(kw => str.includes(kw))) {
        matches.push({ ...pattern, confidence: Math.min(1, pattern.confidence * 0.9) });
      }
    }
    return matches;
  }

  // ─── Registry ───────────────────────────────────────────────────────────────

  /**
   * Register a known pattern definition.
   * @param {string} patternId
   * @param {object} definition  canonical pattern fields
   * @returns {CanonicalPattern}
   */
  register(patternId, definition) {
    const canonical = _makeCanonical({ id: patternId, ...definition });
    this._registry.set(patternId, canonical);
    logger.info({ patternId }, 'PatternEngine: pattern registered');
    return canonical;
  }

  /**
   * Retrieve a registered pattern by ID.
   * @param {string} patternId
   * @returns {CanonicalPattern|undefined}
   */
  getRegistered(patternId) {
    return this._registry.get(patternId);
  }

  /**
   * List all registered patterns.
   * @returns {CanonicalPattern[]}
   */
  listRegistered() {
    return Array.from(this._registry.values());
  }

  // ─── Optimization ───────────────────────────────────────────────────────────

  /**
   * Suggest optimizations for a detected pattern.
   * @param {CanonicalPattern} pattern
   * @returns {string[]}  optimization suggestions
   */
  optimize(pattern) {
    const suggestions = [];
    const name = (pattern.name || '').toLowerCase();
    const type = (pattern.type || '').toLowerCase();

    if (name.includes('repetition') || name.includes('highrepetition')) {
      suggestions.push('Consider deduplication or caching to reduce redundant data.');
      suggestions.push('Evaluate whether a Set or Map can replace the Array for O(1) lookups.');
    }
    if (name.includes('deepnesting')) {
      suggestions.push('Flatten data structures where possible to improve readability and performance.');
      suggestions.push('Consider normalising nested objects into a relational schema.');
    }
    if (name.includes('retry') || name.includes('backoff')) {
      suggestions.push('Implement exponential backoff with jitter to avoid thundering-herd issues.');
      suggestions.push('Add circuit breaker to prevent cascading failures during retry storms.');
    }
    if (name.includes('errorburst')) {
      suggestions.push('Aggregate and deduplicate errors before alerting to reduce noise.');
      suggestions.push('Investigate root cause — error bursts often indicate upstream dependency failures.');
    }
    if (name.includes('regularinterval') || name.includes('timeseries')) {
      suggestions.push('Consider windowed aggregation instead of processing each event individually.');
    }
    if (type === PATTERN_TYPES.SEMANTIC) {
      suggestions.push('Enrich with vector embeddings for semantic clustering and drift detection.');
    }
    if (suggestions.length === 0) {
      suggestions.push('No specific optimizations identified for this pattern type.');
    }

    logger.debug({ patternName: pattern.name, suggestionCount: suggestions.length }, 'PatternEngine: optimize');
    return suggestions;
  }

  // ─── History ────────────────────────────────────────────────────────────────

  /**
   * Return recent detection history.
   * @param {number} [limit=20]
   * @returns {Array<{ detectedAt: number, patterns: CanonicalPattern[], context: object }>}
   */
  getHistory(limit = 20) {
    return this._history.slice(-limit);
  }
}

module.exports = {
  PatternEngine,
  PATTERN_TYPES,
};
