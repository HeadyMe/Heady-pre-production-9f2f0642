/**
 * @fileoverview Ternary Logic Engine
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Implements ternary logic for uncertainty representation in CSL systems.
 * Cosine similarity's native range [-1, +1] maps perfectly to the ternary
 * truth domain: FALSE (-1), UNKNOWN (0), TRUE (+1).
 *
 * Supported Logic Systems:
 *   - Kleene K3 (Strong Logic of Indeterminacy): min/max/negation
 *   - Łukasiewicz Ł3: bounded sum operations, implication-aware
 *   - Gödel G3: min/max with strong negation
 *   - Product Logic: multiplication-based t-norms
 *   - CSL Continuous: direct cosine-based operations without discretization
 *
 * The CSL system naturally implements continuous ternary logic because:
 *   cos(θ) → +1  ≡ TRUE  (perfectly aligned vectors)
 *   cos(θ) → 0   ≡ UNKNOWN (orthogonal vectors — no relationship)
 *   cos(θ) → -1  ≡ FALSE (antipodal vectors — contradiction)
 *
 * References:
 *   - Łukasiewicz (1920): Three-valued logic for future contingents
 *   - Kleene (1952): Strong logic of indeterminacy
 *   - Wikipedia: Three-valued logic — truth tables
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *   - Open Logic Project: Three-valued Logics PDF
 *
 * @module ternary-logic
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL/ternary techniques
 */

'use strict';

const { CSL_THRESHOLDS, PHI_TEMPERATURE } = require('../../shared/phi-math.js');
const { CSLEngine, norm, normalize, dot, clamp, EPSILON } = require('../engine/csl-engine');

// ─── Ternary Value Constants ──────────────────────────────────────────────────

/**
 * Ternary truth value constants.
 *
 * Mapped to the cosine similarity range [-1, +1]:
 *   TRUE    = +1.0  → perfectly aligned vectors
 *   UNKNOWN =  0.0  → orthogonal vectors (no information)
 *   FALSE   = -1.0  → antipodal vectors (contradiction)
 */
const TERNARY = {
  TRUE:    1.0,
  UNKNOWN: 0.0,
  FALSE:  -1.0,
};

/** Threshold above which a value is classified as TRUE.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — phi-harmonic noise floor for truth activation. */
const TRUE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Threshold below which a value is classified as FALSE.
 * -CSL_THRESHOLDS.MINIMUM ≈ -0.500 — symmetric phi-harmonic false floor. */
const FALSE_THRESHOLD = -CSL_THRESHOLDS.MINIMUM; // ≈ -0.500 (CSL noise floor negated)

/** The width of the UNKNOWN zone: (-CSL_THRESHOLDS.MINIMUM, +CSL_THRESHOLDS.MINIMUM).
 * Symmetric around 0 using the phi-harmonic noise floor threshold. */
const UNKNOWN_ZONE = TRUE_THRESHOLD; // symmetric (CSL_THRESHOLDS.MINIMUM ≈ 0.500)

// ─── Discretization Helpers ───────────────────────────────────────────────────

/**
 * Map a continuous cosine value to a discrete ternary symbol.
 *
 * @param {number} x - Continuous value ∈ [-1, +1]
 * @param {number} [trueThreshold=0.5]
 * @param {number} [falseThreshold=-0.5]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
function toTernarySymbol(x, trueThreshold = TRUE_THRESHOLD, falseThreshold = FALSE_THRESHOLD) {
  if (x >= trueThreshold) return 'TRUE';
  if (x <= falseThreshold) return 'FALSE';
  return 'UNKNOWN';
}

/**
 * Map a ternary symbol to its continuous representation.
 *
 * @param {'TRUE'|'UNKNOWN'|'FALSE'} symbol
 * @returns {number} ∈ {+1, 0, -1}
 */
function fromTernarySymbol(symbol) {
  switch (symbol) {
    case 'TRUE':    return TERNARY.TRUE;
    case 'UNKNOWN': return TERNARY.UNKNOWN;
    case 'FALSE':   return TERNARY.FALSE;
    default: throw new Error(`Unknown ternary symbol: ${symbol}`);
  }
}

// ─── TernaryLogicEngine Class ─────────────────────────────────────────────────

/**
 * TernaryLogicEngine — Continuous and discrete ternary logic operations.
 *
 * Provides all Kleene K3, Łukasiewicz Ł3, and CSL-continuous operations.
 * Works with both scalar values (from cosine similarity) and vector pairs
 * (computing similarity first).
 *
 * Integration with CSL gates:
 *   - CSLEngine.AND(a, b) → feed result to ternary operations
 *   - TernaryLogicEngine applies ternary operations to cosine values
 *   - Final values can be discretized to {TRUE, UNKNOWN, FALSE}
 *
 * @class
 * @example
 * const ternary = new TernaryLogicEngine({ mode: 'kleene' });
 * const engine = new CSLEngine({ dim: 384 });
 * const cosAB = engine.AND(vectorA, vectorB);  // ∈ [-1,+1]
 * const cosCD = engine.AND(vectorC, vectorD);  // ∈ [-1,+1]
 *
 * const andResult  = ternary.AND(cosAB, cosCD);  // Kleene K3 AND
 * const implResult = ternary.IMPLY(cosAB, cosCD); // Łukasiewicz implication
 * const symbol     = ternary.discretize(andResult); // → 'TRUE'|'UNKNOWN'|'FALSE'
 */
class TernaryLogicEngine {
  /**
   * @param {Object} [options]
   * @param {'kleene'|'lukasiewicz'|'godel'|'product'|'csl'} [options.mode='kleene']
   *   Logic system to use for binary operations
   * @param {number} [options.trueThreshold=0.5] - Threshold for TRUE discretization
   * @param {number} [options.falseThreshold=-0.5] - Threshold for FALSE discretization
   * @param {boolean} [options.normalizeOutput=false] - Clamp outputs to [-1,+1]
   */
  constructor(options = {}) {
    this.mode = options.mode || 'kleene';
    this.trueThreshold = options.trueThreshold !== undefined ? options.trueThreshold : TRUE_THRESHOLD;
    this.falseThreshold = options.falseThreshold !== undefined ? options.falseThreshold : FALSE_THRESHOLD;
    this.normalizeOutput = options.normalizeOutput !== false;

    this._csl = new CSLEngine();

    // Validate mode
    const validModes = ['kleene', 'lukasiewicz', 'godel', 'product', 'csl'];
    if (!validModes.includes(this.mode)) {
      throw new Error(`Unknown ternary mode: ${this.mode}. Use one of: ${validModes.join(', ')}`);
    }
  }

  // ─── Core Ternary Operations ───────────────────────────────────────────────

  /**
   * Ternary AND — Conjunction of two truth values.
   *
   * Implementations by system:
   *
   * Kleene K3 (Gödel t-norm):
   *   K3-AND(a, b) = min(a, b)
   *   Truth table: T∧T=T, T∧U=U, T∧F=F, U∧U=U, U∧F=F, F∧F=F
   *
   * Łukasiewicz (bounded sum):
   *   Ł3-AND(a, b) = max(-1, a + b - 1)   [mapped to [-1,+1] from [0,1]]
   *   Reduces to K3-AND on {-1, 0, +1}
   *
   * Gödel: same as Kleene (min)
   *
   * Product (multiplication):
   *   Prod-AND(a, b) = a · b
   *   Note: maps [-1,+1]² → [-1,+1] only if both inputs non-negative
   *
   * CSL (continuous):
   *   CSL-AND(a, b) = a · b   [product of cosine similarities]
   *   Equivalent to angular product — measures joint alignment
   *
   * Reference: Fagin et al. (2024) PNAS; Wikipedia Three-valued logic
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @param {number} b - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  AND(a, b) {
    const result = this._applyAND(a, b);
    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  _applyAND(a, b) {
    switch (this.mode) {
      case 'kleene':
      case 'godel':
        return Math.min(a, b);

      case 'lukasiewicz':
        // Bounded difference: max(-1, a + b - 1)
        return Math.max(-1.0, a + b - 1.0);

      case 'product':
      case 'csl':
        // Product t-norm
        return a * b;

      default:
        return Math.min(a, b);
    }
  }

  /**
   * Ternary OR — Disjunction of two truth values.
   *
   * Kleene K3 (Gödel t-conorm):
   *   K3-OR(a, b) = max(a, b)
   *   Truth table: T∨T=T, T∨U=T, T∨F=T, U∨U=U, U∨F=U, F∨F=F
   *
   * Łukasiewicz (bounded sum):
   *   Ł3-OR(a, b) = min(1, a + b + 1)   [mapped to [-1,+1]]
   *
   * Product:
   *   Prod-OR(a, b) = a + b - a·b   [probabilistic sum]
   *
   * CSL:
   *   CSL-OR(a, b) = max(a, b)   [Gödel conorm for geometric values]
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @param {number} b - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  OR(a, b) {
    const result = this._applyOR(a, b);
    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  _applyOR(a, b) {
    switch (this.mode) {
      case 'kleene':
      case 'godel':
      case 'csl':
        return Math.max(a, b);

      case 'lukasiewicz':
        // Bounded sum: min(1, a + b + 1)
        return Math.min(1.0, a + b + 1.0);

      case 'product':
        // Probabilistic sum: a + b - a·b (for values in [0,1])
        // Adapted to [-1,+1]: use scaled version
        return a + b - a * b;

      default:
        return Math.max(a, b);
    }
  }

  /**
   * Ternary NOT — Negation of a truth value.
   *
   * All systems: NOT(a) = -a   [sign flip on cosine scale]
   *   NOT(+1) = -1 (TRUE → FALSE)
   *   NOT( 0) =  0 (UNKNOWN → UNKNOWN)
   *   NOT(-1) = +1 (FALSE → TRUE)
   *
   * This is the Kleene/Łukasiewicz involution ¬a = 1 - a mapped to [-1,+1]:
   *   [0,1] version: ¬a = 1 - a
   *   [-1,+1] version: ¬a = -a    (equivalent under scaling)
   *
   * Note: Gödel logic has strong negation:
   *   G-NOT(a) = -1 if a = +1, else +1
   *   This is NOT implemented by default (strong ≠ weak negation)
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  NOT(a) {
    if (this.mode === 'godel') {
      // Strong Gödel negation: ¬T = F, ¬U = T, ¬F = T
      // (only T is negated to F; everything else becomes T)
      return a >= this.trueThreshold ? -1.0 : 1.0;
    }
    // Standard involution: soft NOT
    return -a;
  }

  /**
   * Ternary IMPLY — Material implication.
   *
   * Kleene K3:
   *   K3-IMPLY(a, b) = max(-a, b) = OR(NOT(a), b)
   *   = max(1-a, b) in [0,1] = max(-a, b) in [-1,+1]
   *   Truth table: T→T=T, T→U=U, T→F=F, U→T=T, U→U=U, U→F=U, F→T=T, F→U=T, F→F=T
   *
   * Łukasiewicz:
   *   Ł3-IMPLY(a, b) = min(1, 1 - a + b) in [0,1]
   *                  = min(1, -a + b + 1)   → clamp to [-1,+1]
   *   Key distinction: U→U = T (unknown implies unknown = true)
   *
   * CSL:
   *   CSL-IMPLY(a, b) = 1 - a + b (unclamped, geometric analog)
   *
   * @param {number} a - Antecedent truth value ∈ [-1, +1]
   * @param {number} b - Consequent truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  IMPLY(a, b) {
    let result;

    switch (this.mode) {
      case 'kleene':
      case 'godel':
        // K3 implication = OR(NOT(a), b)
        result = Math.max(-a, b);
        break;

      case 'lukasiewicz':
        // Ł3: min(1, 1 - a + b) → mapped: min(+1, -a + b + 1) - 1... use:
        // Standard Łukasiewicz: →(a,b) = min(1, 1-a+b) in [0,1]
        // In [-1,+1]: →(a,b) = min(1, (1-a+b+1)/2 * 2 - 1) ... simpler:
        // Transform: a_01 = (a+1)/2, b_01 = (b+1)/2
        // Ł-impl_01 = min(1, 1 - a_01 + b_01)
        // Back to [-1,+1]: result = 2*Ł-impl_01 - 1
        {
          const a01 = (a + 1.0) / 2.0;
          const b01 = (b + 1.0) / 2.0;
          const impl01 = Math.min(1.0, 1.0 - a01 + b01);
          result = 2.0 * impl01 - 1.0;
        }
        break;

      case 'product':
      case 'csl':
        // Product implication: b/a for a ≠ 0, clamped to [0,1] → [-1,+1]
        if (Math.abs(a) < EPSILON) {
          result = 1.0; // vacuous truth: false implies anything
        } else {
          result = clamp(b / Math.abs(a), -1.0, 1.0);
        }
        break;

      default:
        result = Math.max(-a, b);
    }

    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  /**
   * Ternary BICONDITIONAL — Equivalence of two truth values.
   *
   * Formula: BICONDITIONAL(a, b) = AND(IMPLY(a,b), IMPLY(b,a))
   *
   * @param {number} a
   * @param {number} b
   * @returns {number} ∈ [-1, +1]
   */
  BICONDITIONAL(a, b) {
    return this.AND(this.IMPLY(a, b), this.IMPLY(b, a));
  }

  /**
   * Łukasiewicz bounded AND (explicit, mode-independent).
   *
   * Formula: max(-1, a + b - 1)   [from standard Ł-t-norm: max(0, a+b-1)]
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  lukasiewiczAND(a, b) {
    return clamp(Math.max(-1.0, a + b - 1.0), -1.0, 1.0);
  }

  /**
   * Łukasiewicz bounded OR (explicit, mode-independent).
   *
   * Formula: min(+1, a + b + 1)   [from standard Ł-t-conorm: min(1, a+b)]
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  lukasiewiczOR(a, b) {
    return clamp(Math.min(1.0, a + b + 1.0), -1.0, 1.0);
  }

  /**
   * Kleene strong AND (explicit, mode-independent).
   *
   * Formula: min(a, b)
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  kleeneAND(a, b) {
    return Math.min(a, b);
  }

  /**
   * Kleene strong OR (explicit, mode-independent).
   *
   * Formula: max(a, b)
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  kleeneOR(a, b) {
    return Math.max(a, b);
  }

  // ─── Confidence Intervals ─────────────────────────────────────────────────

  /**
   * Compute a confidence interval for an UNKNOWN truth value.
   *
   * When a cosine similarity falls in the UNKNOWN zone (-0.5, +0.5),
   * the confidence interval estimates how strongly it leans toward TRUE or FALSE.
   *
   * Returns a [lower, upper] interval based on the magnitude and a noise model.
   * The interval represents the range of possible true values given measurement
   * uncertainty estimated by the noise parameter.
   *
   * @param {number} x - Cosine value ∈ [-1, +1]
   * @param {number} [noiseEstimate=0.1] - Estimated measurement noise std
   * @returns {{
   *   lower: number,   // lower bound of CI
   *   upper: number,   // upper bound of CI
   *   symbol: string,  // 'TRUE'|'UNKNOWN'|'FALSE'
   *   confidence: number, // confidence ∈ [0,1] (0.5 = maximum uncertainty)
   * }}
   */
  confidenceInterval(x, noiseEstimate = 0.1) {
    const lower = clamp(x - 1.96 * noiseEstimate, -1.0, 1.0);
    const upper = clamp(x + 1.96 * noiseEstimate, -1.0, 1.0);
    const symbol = toTernarySymbol(x, this.trueThreshold, this.falseThreshold);

    // Confidence: 0 = maximum uncertainty (x=0), 1 = certain (x=±1)
    const confidence = Math.abs(x);

    return { lower, upper, symbol, confidence };
  }

  // ─── Vector-Level Ternary Operations ─────────────────────────────────────

  /**
   * Compute ternary AND from two vector pairs.
   *
   * Computes cos(a, b) and cos(c, d) first, then applies ternary AND.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @param {Float32Array|Float64Array|number[]} c
   * @param {Float32Array|Float64Array|number[]} d
   * @returns {{ score: number, symbol: string, confidence: number }}
   */
  vectorAND(a, b, c, d) {
    const cosAB = this._csl.AND(a, b);
    const cosCD = this._csl.AND(c, d);
    const score = this.AND(cosAB, cosCD);
    return {
      score,
      symbol: this.discretize(score),
      confidence: Math.abs(score),
      inputs: { cosAB, cosCD },
    };
  }

  /**
   * Compute ternary OR from two vector pairs.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @param {Float32Array|Float64Array|number[]} c
   * @param {Float32Array|Float64Array|number[]} d
   * @returns {{ score: number, symbol: string, confidence: number }}
   */
  vectorOR(a, b, c, d) {
    const cosAB = this._csl.AND(a, b);
    const cosCD = this._csl.AND(c, d);
    const score = this.OR(cosAB, cosCD);
    return {
      score,
      symbol: this.discretize(score),
      confidence: Math.abs(score),
      inputs: { cosAB, cosCD },
    };
  }

  /**
   * Evaluate a ternary formula with multiple premises.
   *
   * Computes pairwise cosine similarities for all premise pairs, then applies
   * the specified reduction operation across all values.
   *
   * @param {Array<{ a: Float64Array, b: Float64Array }>} premises - Vector pairs
   * @param {'AND'|'OR'} [reduction='AND'] - How to combine premises
   * @returns {{ score: number, symbol: string, premiseScores: number[] }}
   */
  evaluateFormula(premises, reduction = 'AND') {
    const scores = premises.map(({ a, b }) => this._csl.AND(a, b));

    let combined = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (reduction === 'AND') {
        combined = this.AND(combined, scores[i]);
      } else {
        combined = this.OR(combined, scores[i]);
      }
    }

    return {
      score: combined,
      symbol: this.discretize(combined),
      premiseScores: scores,
      confidence: Math.abs(combined),
    };
  }

  // ─── Kleene K3 Truth Tables ────────────────────────────────────────────────

  /**
   * Get the full Kleene K3 truth table for AND and OR.
   *
   * Values: F=-1, U=0, T=+1
   *
   * @returns {Object} Truth tables
   */
  getKleeneTruthTable() {
    const vals = [
      { sym: 'F', val: -1.0 },
      { sym: 'U', val: 0.0 },
      { sym: 'T', val: 1.0 },
    ];

    const andTable = {};
    const orTable = {};
    const implTable = {};
    const notTable = {};

    for (const { sym: symA, val: a } of vals) {
      notTable[symA] = toTernarySymbol(-a, 0.5, -0.5);
      andTable[symA] = {};
      orTable[symA] = {};
      implTable[symA] = {};

      for (const { sym: symB, val: b } of vals) {
        const prevMode = this.mode;
        this.mode = 'kleene';

        andTable[symA][symB] = toTernarySymbol(this.AND(a, b), 0.5, -0.5);
        orTable[symA][symB]  = toTernarySymbol(this.OR(a, b), 0.5, -0.5);
        implTable[symA][symB] = toTernarySymbol(this.IMPLY(a, b), 0.5, -0.5);

        this.mode = prevMode;
      }
    }

    return { andTable, orTable, implTable, notTable };
  }

  /**
   * Get the Łukasiewicz Ł3 truth table.
   *
   * Key difference from K3: U→U = T (not U)
   *
   * @returns {Object} Truth tables
   */
  getLukasiewiczTruthTable() {
    const vals = [
      { sym: 'F', val: -1.0 },
      { sym: 'U', val: 0.0 },
      { sym: 'T', val: 1.0 },
    ];

    const andTable = {};
    const orTable = {};
    const implTable = {};

    for (const { sym: symA, val: a } of vals) {
      andTable[symA] = {};
      orTable[symA] = {};
      implTable[symA] = {};

      for (const { sym: symB, val: b } of vals) {
        const prevMode = this.mode;
        this.mode = 'lukasiewicz';

        andTable[symA][symB] = toTernarySymbol(this.AND(a, b), 0.5, -0.5);
        orTable[symA][symB] = toTernarySymbol(this.OR(a, b), 0.5, -0.5);
        implTable[symA][symB] = toTernarySymbol(this.IMPLY(a, b), 0.5, -0.5);

        this.mode = prevMode;
      }
    }

    return { andTable, orTable, implTable };
  }

  // ─── Discretization ───────────────────────────────────────────────────────

  /**
   * Discretize a continuous value to a ternary symbol.
   *
   * @param {number} x - Continuous value ∈ [-1, +1]
   * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
   */
  discretize(x) {
    return toTernarySymbol(x, this.trueThreshold, this.falseThreshold);
  }

  /**
   * Discretize an array of continuous values.
   *
   * @param {number[]|Float64Array} values
   * @returns {string[]} Array of 'TRUE'|'UNKNOWN'|'FALSE'
   */
  discretizeAll(values) {
    return Array.from(values, x => this.discretize(x));
  }

  /**
   * Determine if a truth value is definitely TRUE, FALSE, or uncertain.
   *
   * Returns 'definite_true', 'definite_false', or 'uncertain'.
   *
   * @param {number} x
   * @returns {string}
   */
  certainty(x) {
    if (x >= this.trueThreshold) return 'definite_true';
    if (x <= this.falseThreshold) return 'definite_false';
    return 'uncertain';
  }

  // ─── Gate Integration ─────────────────────────────────────────────────────

  /**
   * Apply a ternary gate to a CSL GATE output.
   *
   * Given a CSL gate activation score and a second condition, combine them
   * using the ternary AND rule.
   *
   * @param {number} gateScore - CSL GATE cos score ∈ [-1, +1]
   * @param {number} conditionScore - Second condition cos score ∈ [-1, +1]
   * @returns {{ passed: boolean, score: number, symbol: string }}
   */
  ternaryGate(gateScore, conditionScore) {
    const combined = this.AND(gateScore, conditionScore);
    const symbol = this.discretize(combined);

    return {
      passed: symbol === 'TRUE',
      score: combined,
      symbol,
    };
  }

  /**
   * Compute a ternary-aware softmax over truth values.
   *
   * Maps the ternary values to probabilities:
   *   p_TRUE    = softmax(scores)[TRUE zone indices]
   *   p_UNKNOWN = softmax(scores)[UNKNOWN zone indices]
   *   p_FALSE   = softmax(scores)[FALSE zone indices]
   *
   * @param {number[]|Float64Array} scores - Array of cosine scores
   * @param {number} [temperature=1.0]
   * @returns {{ pTrue: number, pUnknown: number, pFalse: number }}
   */
  ternarySoftmax(scores, temperature = PHI_TEMPERATURE) {
    // Compute standard softmax
    const maxScore = Math.max(...scores);
    const exps = scores.map(x => Math.exp((x - maxScore) / temperature));
    const sumExp = exps.reduce((s, x) => s + x, 0);
    const probs = exps.map(x => x / sumExp);

    // Aggregate by ternary zone
    let pTrue = 0, pUnknown = 0, pFalse = 0;
    for (let i = 0; i < scores.length; i++) {
      const sym = this.discretize(scores[i]);
      if (sym === 'TRUE') pTrue += probs[i];
      else if (sym === 'FALSE') pFalse += probs[i];
      else pUnknown += probs[i];
    }

    return { pTrue, pUnknown, pFalse };
  }
}

// ─── Standalone Truth Table Utilities ────────────────────────────────────────

/**
 * Print a formatted truth table to string.
 *
 * @param {string} opName - Operation name
 * @param {Object} table - { symA: { symB: result } } or { symA: result }
 * @returns {string} Formatted table string
 */
function formatTruthTable(opName, table) {
  if (typeof Object.values(table)[0] === 'string') {
    // Unary table
    let out = `\n${opName}:\n`;
    for (const [a, result] of Object.entries(table)) {
      out += `  ${a} → ${result}\n`;
    }
    return out;
  }

  // Binary table
  const vals = Object.keys(table);
  let out = `\n${opName}:\n`;
  out += `  \\ B: ${vals.join('  ')}\nA:\n`;

  for (const a of vals) {
    out += `  ${a}:   ${vals.map(b => table[a][b]).join('   ')}\n`;
  }

  return out;
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  TernaryLogicEngine,
  TERNARY,
  TRUE_THRESHOLD,
  FALSE_THRESHOLD,
  UNKNOWN_ZONE,
  toTernarySymbol,
  fromTernarySymbol,
  formatTruthTable,
  phiInterpolateTruth,
};
