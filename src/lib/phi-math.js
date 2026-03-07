/**
 * Heady Phi-Math Foundation Module
 * ================================
 * Replaces all magic numbers with phi-derived constants.
 * Golden ratio (φ ≈ 1.618), conjugate (ψ ≈ 0.618), Fibonacci sequences.
 * 
 * @module shared/phi-math
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

// ── Core Constants ──────────────────────────────────────────────────────────
const PHI   = (1 + Math.sqrt(5)) / 2;   // φ ≈ 1.6180339887
const PSI   = 1 / PHI;                   // ψ ≈ 0.6180339887
const PHI_SQ = PHI + 1;                  // φ² ≈ 2.6180339887
const PHI_CB = 2 * PHI + 1;             // φ³ ≈ 4.2360679775
const PHI_TEMPERATURE = PSI ** 3;        // ψ³ ≈ 0.2360679775

// ── Fibonacci Sequence (memoized) ───────────────────────────────────────────
const _fibCache = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377,
  610, 987, 1597, 2584, 4181, 6765];

function fib(n) {
  if (n < 0) throw new RangeError('fib(n) requires n >= 0');
  if (_fibCache[n] !== undefined) return _fibCache[n];
  for (let i = _fibCache.length; i <= n; i++) {
    _fibCache[i] = _fibCache[i - 1] + _fibCache[i - 2];
  }
  return _fibCache[n];
}

// ── CSL Threshold Hierarchy ─────────────────────────────────────────────────
// phiThreshold(level, spread=0.5) = 1 - ψ^level × spread
function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
  LOW:      phiThreshold(1),  // ≈ 0.691
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  HIGH:     phiThreshold(3),  // ≈ 0.882
  CRITICAL: phiThreshold(4),  // ≈ 0.927
});

const DEDUP_THRESHOLD = 0.972; // Above CRITICAL — semantic identity

// ── Pressure Levels ─────────────────────────────────────────────────────────
const PRESSURE_LEVELS = Object.freeze({
  NOMINAL_MAX:  PSI ** 2,          // ≈ 0.382
  ELEVATED_MAX: PSI,               // ≈ 0.618
  HIGH_MAX:     1 - PSI ** 3,      // ≈ 0.854
  CRITICAL_MIN: 1 - PSI ** 4,      // ≈ 0.910
});

// ── Alert Thresholds ────────────────────────────────────────────────────────
const ALERT_THRESHOLDS = Object.freeze({
  WARNING:  PSI,                    // ≈ 0.618
  CAUTION:  1 - PSI ** 2,          // ≈ 0.764
  CRITICAL: 1 - PSI ** 3,          // ≈ 0.854
  EXCEEDED: 1 - PSI ** 4,          // ≈ 0.910
  HARD_MAX: 1.0,
});

// ── CSL Gate (smooth sigmoid gating) ────────────────────────────────────────
function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PHI_TEMPERATURE) {
  return value * sigmoid((cosScore - tau) / temp);
}

function cslBlend(weightHigh, weightLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PHI_TEMPERATURE) {
  const gate = sigmoid((cosScore - tau) / temp);
  return weightHigh * gate + weightLow * (1 - gate);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ── Adaptive Temperature ────────────────────────────────────────────────────
function adaptiveTemperature(entropy, maxEntropy) {
  const normalized = Math.min(entropy / maxEntropy, 1);
  return PHI_TEMPERATURE * (1 + normalized * PHI);
}

// ── Phi-Backoff ─────────────────────────────────────────────────────────────
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = 1 + (Math.random() - 0.5) * 2 * (PSI ** 2); // ±38.2%
  return Math.min(delay * jitter, maxMs);
}

// ── Phi-Fusion Weights ──────────────────────────────────────────────────────
function phiFusionWeights(n) {
  if (n < 1) throw new RangeError('phiFusionWeights requires n >= 1');
  const raw = [];
  for (let i = 0; i < n; i++) raw.push(Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

// ── Phi-Resource Allocation ─────────────────────────────────────────────────
function phiResourceWeights(n) {
  return phiFusionWeights(n);
}

function phiMultiSplit(whole, n) {
  const weights = phiFusionWeights(n);
  return weights.map(w => Math.round(whole * w));
}

// ── Token Budgets (phi-geometric progression) ───────────────────────────────
function phiTokenBudgets(base = 8192) {
  return {
    working:   base,
    session:   Math.round(base * PHI_SQ),
    memory:    Math.round(base * Math.pow(PHI, 4)),
    artifacts: Math.round(base * Math.pow(PHI, 6)),
  };
}

// ── Phi Adaptive Interval ───────────────────────────────────────────────────
function phiAdaptiveInterval(baseMs, healthScore) {
  // Healthy → longer intervals (save resources), unhealthy → shorter (monitor closely)
  const factor = healthScore > CSL_THRESHOLDS.MEDIUM ? PHI : PSI;
  return baseMs * factor;
}

// ── Cosine Similarity ───────────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── Priority Score (phi-weighted) ───────────────────────────────────────────
function phiPriorityScore(...factors) {
  const weights = phiFusionWeights(factors.length);
  return factors.reduce((sum, f, i) => sum + f * weights[i], 0);
}

// ── Eviction Weights ────────────────────────────────────────────────────────
const EVICTION_WEIGHTS = Object.freeze({
  importance: 0.486,
  recency:    0.300,
  relevance:  0.214,
});

module.exports = {
  PHI, PSI, PHI_SQ, PHI_CB, PHI_TEMPERATURE,
  fib,
  phiThreshold,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
  cslGate,
  cslBlend,
  sigmoid,
  adaptiveTemperature,
  phiBackoff,
  phiFusionWeights,
  phiResourceWeights,
  phiMultiSplit,
  phiTokenBudgets,
  phiAdaptiveInterval,
  cosineSimilarity,
  phiPriorityScore,
  EVICTION_WEIGHTS,
};
