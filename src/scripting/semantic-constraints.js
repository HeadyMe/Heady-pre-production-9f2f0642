'use strict';

/**
 * semantic-constraints.js
 *
 * SemanticConstraint — defines guardrails as continuous semantic boundaries.
 * Unlike hard boolean assertions, constraints produce similarity scores and
 * support three enforcement modes: hard (throws), soft (warns), advisory (logs).
 *
 * Constraints carry "semantic inertia" — they decay-average their history
 * and self-adjust strictness based on accumulated confidence.
 *
 * ConstraintSet — a named collection of SemanticConstraints for bulk checks.
 * SemanticConstraintViolation — custom Error subclass carrying constraint details.
 */

const CSL    = require('../core/semantic-logic');
const { PhiScale, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger = require('../utils/logger');

// Default embedding dimension
const DEFAULT_DIM = 384;

// ---------------------------------------------------------------------------
// SemanticConstraintViolation
// ---------------------------------------------------------------------------

class SemanticConstraintViolation extends Error {
  /**
   * @param {string} constraintDescription
   * @param {number} similarity    Actual similarity score
   * @param {number} minSimilarity Required minimum
   * @param {object} [context={}]  Additional debug context
   */
  constructor(constraintDescription, similarity, minSimilarity, context = {}) {
    const msg = (
      `SemanticConstraintViolation: constraint not satisfied.\n` +
      `  Constraint : "${constraintDescription}"\n` +
      `  Similarity : ${similarity.toFixed(4)}\n` +
      `  Required   : ≥ ${minSimilarity.toFixed(4)}\n` +
      `  Gap        : ${(minSimilarity - similarity).toFixed(4)}`
    );
    super(msg);
    this.name                 = 'SemanticConstraintViolation';
    this.constraintDescription = constraintDescription;
    this.similarity           = similarity;
    this.minSimilarity        = minSimilarity;
    this.context              = context;

    // Preserve V8 stack trace when available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SemanticConstraintViolation);
    }
  }
}

// ---------------------------------------------------------------------------
// SemanticConstraint
// ---------------------------------------------------------------------------

class SemanticConstraint {
  /**
   * @param {string} description  Natural language constraint description
   * @param {object} [options={}]
   * @param {number}   [options.minSimilarity=0.85]  Required cosine similarity
   * @param {string}   [options.enforcement='soft']   'hard'|'soft'|'advisory'
   * @param {Function} [options.embedFn]              External embed fn
   * @param {number}   [options.historySize=20]       Max retained check results
   * @param {number}   [options.inertiaWindow=5]      Checks before inertia kicks in
   */
  constructor(description, options = {}) {
    this.description  = description;
    this.minSimilarity = options.minSimilarity  != null ? options.minSimilarity : 0.85;
    this.enforcement  = options.enforcement     || 'soft';
    this._embedFn     = options.embedFn         || null;
    this._historySize = options.historySize      || 20;
    this._inertiaWindow = options.inertiaWindow  || 5;

    // Pre-embed the constraint description
    this._constraintVector = this._embed(description);

    // Semantic inertia state
    /** @type {Array<{ passed: boolean, similarity: number, ts: number }>} */
    this._history = [];

    /**
     * Running phi-decayed average of recent similarity scores.
     * Starts at 0.5 (neutral — no evidence either way).
     * @type {number}
     */
    this.accumulatedConfidence = 0.5;

    logger.debug(
      `[SemanticConstraint] Created: "${description.slice(0, 60)}" ` +
      `enforcement=${this.enforcement} minSimilarity=${this.minSimilarity}`
    );
  }

  // ── Static factory (one-shot) ─────────────────────────────────────────────

  /**
   * One-shot constraint check — the primary public entry point.
   *
   * @param {string}             constraintDescription
   * @param {Float32Array|string} contextVector  384-dim vector or raw text
   * @param {object}             [options={}]
   * @param {number}   [options.minSimilarity=0.85]
   * @param {string}   [options.enforcement='soft']
   * @param {Function} [options.embedFn]
   * @returns {{ passed: boolean, similarity: number, confidence?: number, message?: string }}
   * @throws {SemanticConstraintViolation}  When enforcement='hard' and check fails
   */
  static require(constraintDescription, contextVector, options = {}) {
    const constraint = new SemanticConstraint(constraintDescription, options);
    return constraint.check(contextVector);
  }

  // ── Instance check ───────────────────────────────────────────────────────

  /**
   * Check this constraint against a context vector.
   *
   * @param {Float32Array|string} contextVector
   * @returns {{ passed: boolean, similarity: number, confidence?: number, message?: string }}
   * @throws {SemanticConstraintViolation}  When enforcement='hard' and check fails
   */
  check(contextVector) {
    const vec        = this._resolveVector(contextVector);
    const similarity = CSL.cosine_similarity(this._constraintVector, vec);

    // Determine effective threshold after inertia adjustment
    const effectiveMin = this._effectiveMinSimilarity();

    const passed    = similarity >= effectiveMin;
    const confidence = CSL.soft_gate(similarity, effectiveMin, 20);

    // Record in history and update accumulated confidence
    this._recordHistory(passed, similarity);

    if (passed) {
      logger.debug(
        `[SemanticConstraint] PASS "${this.description.slice(0, 50)}" ` +
        `sim=${similarity.toFixed(4)} eff_min=${effectiveMin.toFixed(4)}`
      );
      return { passed: true, similarity, confidence };
    }

    // Failed — handle by enforcement mode
    const message = (
      `Constraint not satisfied: "${this.description}" ` +
      `(similarity ${similarity.toFixed(4)} < required ${effectiveMin.toFixed(4)})`
    );

    if (this.enforcement === 'hard') {
      throw new SemanticConstraintViolation(
        this.description, similarity, effectiveMin,
        { accumulatedConfidence: this.accumulatedConfidence }
      );
    }

    if (this.enforcement === 'soft') {
      logger.warn(`[SemanticConstraint] SOFT FAIL — ${message}`);
      return { passed: false, similarity, confidence, message };
    }

    // advisory
    logger.info(`[SemanticConstraint] ADVISORY — ${message}`);
    return { passed: false, similarity, confidence };
  }

  // ── Composition operators ────────────────────────────────────────────────

  /**
   * AND — geometric mean of similarities; ALL constraints must pass.
   *
   * @param {SemanticConstraint[]} constraints
   * @param {Float32Array|string}  contextVector
   * @returns {{ passed: boolean, similarity: number, results: object[] }}
   */
  static and(constraints, contextVector) {
    _assertConstraintArray(constraints, 'and');
    const results = constraints.map(c => ({
      constraint: c,
      result:     c.check(contextVector),
    }));

    // Geometric mean of similarity scores
    const logSum  = results.reduce((acc, r) => acc + Math.log(Math.max(r.result.similarity, 1e-9)), 0);
    const geoMean = Math.exp(logSum / results.length);
    const passed  = results.every(r => r.result.passed);

    logger.debug(`[SemanticConstraint] AND(${constraints.length}): passed=${passed} geoMean=${geoMean.toFixed(4)}`);

    return {
      passed,
      similarity: geoMean,
      results:    results.map(r => ({ description: r.constraint.description, ...r.result })),
    };
  }

  /**
   * OR — max of similarities; AT LEAST ONE constraint must pass.
   *
   * @param {SemanticConstraint[]} constraints
   * @param {Float32Array|string}  contextVector
   * @returns {{ passed: boolean, similarity: number, results: object[] }}
   */
  static or(constraints, contextVector) {
    _assertConstraintArray(constraints, 'or');
    const results = constraints.map(c => ({
      constraint: c,
      result:     c.check(contextVector),
    }));

    const maxSim = Math.max(...results.map(r => r.result.similarity));
    const passed = results.some(r => r.result.passed);

    logger.debug(`[SemanticConstraint] OR(${constraints.length}): passed=${passed} maxSim=${maxSim.toFixed(4)}`);

    return {
      passed,
      similarity: maxSim,
      results:    results.map(r => ({ description: r.constraint.description, ...r.result })),
    };
  }

  /**
   * NOT — inverts the constraint: 1 − similarity.
   * Passes when the context is DISSIMILAR from the constraint.
   *
   * @param {SemanticConstraint}  constraint
   * @param {Float32Array|string} contextVector
   * @returns {{ passed: boolean, similarity: number, invertedSimilarity: number }}
   */
  static not(constraint, contextVector) {
    if (!(constraint instanceof SemanticConstraint)) {
      throw new TypeError('SemanticConstraint.not: first argument must be a SemanticConstraint');
    }
    const vec        = constraint._resolveVector(contextVector);
    const similarity = CSL.cosine_similarity(constraint._constraintVector, vec);
    const inverted   = 1 - similarity; // semantic NOT
    const passed     = inverted >= constraint._effectiveMinSimilarity();

    logger.debug(
      `[SemanticConstraint] NOT "${constraint.description.slice(0, 50)}" ` +
      `sim=${similarity.toFixed(4)} inverted=${inverted.toFixed(4)} passed=${passed}`
    );

    return { passed, similarity: inverted, invertedSimilarity: similarity };
  }

  // ── Semantic inertia ─────────────────────────────────────────────────────

  /**
   * Return the effective minSimilarity after inertia adjustment.
   *
   * Rules:
   *  - If we have fewer than inertiaWindow checks, use nominal minSimilarity.
   *  - If accumulatedConfidence is high (> 0.9), relax threshold by up to 5%.
   *  - If accumulatedConfidence is low  (< 0.4), tighten threshold by up to 5%.
   *
   * @returns {number}
   * @private
   */
  _effectiveMinSimilarity() {
    if (this._history.length < this._inertiaWindow) {
      return this.minSimilarity;
    }

    const conf      = this.accumulatedConfidence;
    const MAX_RELAX = 0.05;

    if (conf > 0.9) {
      // High confidence history — relax slightly
      const relax = MAX_RELAX * ((conf - 0.9) / 0.1);
      return Math.max(0, this.minSimilarity - relax);
    }

    if (conf < 0.4) {
      // Low confidence history — tighten slightly
      const tighten = MAX_RELAX * ((0.4 - conf) / 0.4);
      return Math.min(1, this.minSimilarity + tighten);
    }

    return this.minSimilarity;
  }

  /**
   * Record a check result and update the phi-decayed accumulated confidence.
   * @private
   */
  _recordHistory(passed, similarity) {
    this._history.push({ passed, similarity, ts: Date.now() });

    // Trim to max history size
    if (this._history.length > this._historySize) {
      this._history.shift();
    }

    // Phi-weighted exponential moving average (PHI_INVERSE ≈ 0.618 as decay weight)
    const alpha = PHI_INVERSE;
    this.accumulatedConfidence =
      alpha * similarity + (1 - alpha) * this.accumulatedConfidence;
  }

  // ── Embedding helpers ────────────────────────────────────────────────────

  /**
   * Resolve a context argument to a Float32Array.
   * @param {Float32Array|string} contextVector
   * @returns {Float32Array}
   * @private
   */
  _resolveVector(contextVector) {
    if (contextVector instanceof Float32Array) return contextVector;
    if (typeof contextVector === 'string')     return this._embed(contextVector);
    if (Array.isArray(contextVector))           return new Float32Array(contextVector);
    throw new TypeError('SemanticConstraint: contextVector must be Float32Array, string, or number[]');
  }

  /**
   * Embed a text string using external embedFn or deterministic hash embedding.
   * @param {string} text
   * @returns {Float32Array}
   * @private
   */
  _embed(text) {
    if (typeof this._embedFn === 'function') {
      const raw = this._embedFn(text);
      return raw instanceof Float32Array ? raw : new Float32Array(raw);
    }
    return SemanticConstraint._generateEmbedding(text);
  }

  /**
   * Deterministic hash-based 384-dim pseudo-embedding.
   * Identical algorithm to MeaningType._generateEmbedding.
   *
   * @param {string} text
   * @param {number} [dim=384]
   * @returns {Float32Array}
   * @private
   */
  static _generateEmbedding(text, dim = DEFAULT_DIM) {
    const vec = new Float32Array(dim);

    // FNV-1a seed
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed  = (seed * 16777619) >>> 0;
    }

    // LCG fill
    let state = seed;
    for (let i = 0; i < dim; i++) {
      state  = ((state * 1664525) + 1013904223) >>> 0;
      const signed = (state >>> 0) - 2147483648;
      vec[i] = signed / 2147483648;
    }

    // Character-position perturbations
    for (let i = 0; i < text.length && i < dim; i++) {
      const ci  = text.charCodeAt(i);
      const idx = (ci * 7 + i * 31) % dim;
      vec[idx] += (ci / 128) - 1;
    }

    return CSL.normalize(vec);
  }
}

// ---------------------------------------------------------------------------
// ConstraintSet
// ---------------------------------------------------------------------------

class ConstraintSet {
  /**
   * @param {string} [name='ConstraintSet']
   */
  constructor(name = 'ConstraintSet') {
    this.name = name;
    /** @type {Map<string, SemanticConstraint>} */
    this._constraints = new Map();
  }

  /**
   * Add a named constraint.
   *
   * @param {string}             name
   * @param {SemanticConstraint} constraint
   * @returns {ConstraintSet} self (fluent)
   */
  add(name, constraint) {
    if (!(constraint instanceof SemanticConstraint)) {
      throw new TypeError(`ConstraintSet.add: '${name}' must be a SemanticConstraint`);
    }
    this._constraints.set(name, constraint);
    logger.debug(`[ConstraintSet] "${this.name}" added constraint: "${name}"`);
    return this;
  }

  /**
   * Remove a constraint by name.
   * @param {string} name
   * @returns {boolean}
   */
  remove(name) {
    return this._constraints.delete(name);
  }

  /**
   * Check all constraints against a context vector.
   *
   * @param {Float32Array|string} contextVector
   * @returns {{ allPassed: boolean, results: Map<string, object>, violationCount: number }}
   */
  checkAll(contextVector) {
    const results      = new Map();
    let   allPassed    = true;
    let   violations   = 0;

    for (const [name, constraint] of this._constraints) {
      let result;
      try {
        result = constraint.check(contextVector);
      } catch (err) {
        if (err instanceof SemanticConstraintViolation) {
          result   = { passed: false, similarity: err.similarity, error: err };
        } else {
          throw err;
        }
      }

      results.set(name, result);

      if (!result.passed) {
        allPassed = false;
        violations++;
      }
    }

    logger.info(
      `[ConstraintSet] "${this.name}" checkAll: allPassed=${allPassed} ` +
      `violations=${violations}/${this._constraints.size}`
    );

    return { allPassed, results, violationCount: violations };
  }

  /**
   * Return an array of constraint names that most recently failed.
   * (Uses last recorded history entry per constraint.)
   *
   * @returns {Array<{ name: string, similarity: number, description: string }>}
   */
  getViolations() {
    const violations = [];

    for (const [name, constraint] of this._constraints) {
      const last = constraint._history[constraint._history.length - 1];
      if (last && !last.passed) {
        violations.push({
          name,
          similarity: last.similarity,
          description: constraint.description,
          accumulatedConfidence: constraint.accumulatedConfidence,
        });
      }
    }

    return violations;
  }

  /**
   * Number of registered constraints. @type {number}
   */
  get size() { return this._constraints.size; }

  /**
   * @returns {string}
   */
  toString() {
    return `ConstraintSet("${this.name}", ${this._constraints.size} constraints)`;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Assert that value is a non-empty array of SemanticConstraint instances.
 * @param {*}      value
 * @param {string} context
 * @private
 */
function _assertConstraintArray(value, context) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`SemanticConstraint.${context}: requires a non-empty array`);
  }
  value.forEach((c, i) => {
    if (!(c instanceof SemanticConstraint)) {
      throw new TypeError(`SemanticConstraint.${context}[${i}]: must be a SemanticConstraint`);
    }
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { SemanticConstraint, ConstraintSet, SemanticConstraintViolation };
