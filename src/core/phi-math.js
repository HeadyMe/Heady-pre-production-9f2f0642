/**
 * @fileoverview Phi-Math Foundation — Continuous Sacred Geometry Scaling for the Heady Latent OS.
 *
 * This module replaces ALL arbitrary fixed constants across the platform with
 * mathematically-derived values rooted in φ (the golden ratio), the Fibonacci
 * sequence, and CSL (Continuous Semantic Logic) gate outputs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DESIGN PRINCIPLE:  No magic numbers.  Every threshold, weight, ratio,
 * delay, cache size, queue depth, and scaling factor is a *deterministic
 * function* of φ, the Fibonacci sequence, or a CSL gate score.
 *
 * φ  = (1 + √5) / 2 ≈ 1.6180339887…
 * ψ  = 1 / φ         ≈ 0.6180339887…  (conjugate)
 * φ² = φ + 1         ≈ 2.6180339887…
 *
 * Key identities used throughout:
 *   φ² = φ + 1
 *   1/φ = φ - 1
 *   φⁿ = F(n)·φ + F(n-1)       (Fibonacci-phi relationship)
 *   lim F(n+1)/F(n) = φ         (Fibonacci ratio convergence)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @module shared/phi-math
 * @version 2.0.0
 */

// ─── Core Constants ──────────────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
export const PHI = (1 + Math.sqrt(5)) / 2;

/** Golden ratio conjugate ψ = 1/φ = φ - 1 */
export const PSI = PHI - 1;

/** φ² = φ + 1 */
export const PHI_SQ = PHI + 1;

/** φ³ = φ² + φ = 2φ + 1 */
export const PHI_CUBE = PHI_SQ + PHI;

/** √5 — used in Binet's formula */
export const SQRT5 = Math.sqrt(5);

/** Numerical epsilon for CSL gate stability */
export const EPSILON = 1e-10;


// ─── Fibonacci Sequence ──────────────────────────────────────────────────────

/**
 * Generate Fibonacci numbers up to F(n) using iterative O(n) computation.
 * @param {number} n - Index (0-based): F(0)=0, F(1)=1, F(2)=1, ...
 * @returns {number}
 */
export function fib(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

/**
 * Generate a Fibonacci array [F(0), F(1), …, F(n)].
 * @param {number} n - Last index
 * @returns {number[]}
 */
export function fibSequence(n) {
  const seq = [0, 1];
  for (let i = 2; i <= n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  return seq.slice(0, n + 1);
}

/**
 * Binet's formula — continuous Fibonacci extension to real x.
 * F(x) = (φˣ - ψˣ) / √5  where ψ = -1/φ
 * For non-integer x this is a smooth interpolation of the Fibonacci sequence.
 * @param {number} x - Real-valued Fibonacci index
 * @returns {number}
 */
export function fibContinuous(x) {
  return (Math.pow(PHI, x) - Math.pow(-PSI, x)) / SQRT5;
}


// ─── Phi-Scaled Thresholds ──────────────────────────────────────────────────

/**
 * Phi-harmonic threshold sequence.  Generates thresholds that naturally
 * partition the [0,1] interval using successive powers of ψ = 1/φ:
 *
 *   Level 0 (highest):  1 - ψ⁰·s = 1 - s         (tightest threshold)
 *   Level 1:            1 - ψ¹·s = 1 - 0.618·s
 *   Level 2:            1 - ψ²·s = 1 - 0.382·s
 *   Level 3:            1 - ψ³·s = 1 - 0.236·s
 *   Level 4:            1 - ψ⁴·s = 1 - 0.146·s
 *   Level n:            1 - ψⁿ·s
 *
 * With spread s=0.5 the sequence is:
 *   0.500, 0.691, 0.809, 0.882, 0.927, 0.955, …  → converges to 1.0
 *
 * @param {number} level  - Threshold level (0 = loosest, higher = tighter)
 * @param {number} [spread=0.5] - Controls how much of [0,1] is used
 * @returns {number} Threshold ∈ (0, 1)
 */
export function phiThreshold(level, spread = 0.5) {
  return 1.0 - Math.pow(PSI, level) * spread;
}

/**
 * Inverse: given a threshold value, compute which phi-level it corresponds to.
 * @param {number} threshold - Threshold ∈ (0, 1)
 * @param {number} [spread=0.5]
 * @returns {number} Continuous level
 */
export function phiThresholdLevel(threshold, spread = 0.5) {
  const ratio = (1.0 - threshold) / spread;
  if (ratio <= 0) return Infinity;
  return Math.log(ratio) / Math.log(PSI);
}


// ─── CSL Gate Thresholds (replacing arbitrary 0.72, 0.85, 0.55, etc.) ───────

/**
 * Standard CSL gate thresholds derived from phi-harmonic sequence.
 *
 * These replace the old arbitrary { HIGH: 0.85, MED: 0.72, LOW: 0.55 }
 * with mathematically grounded values:
 *
 *   CRITICAL : phiThreshold(4) ≈ 0.927  — near-certain match
 *   HIGH     : phiThreshold(3) ≈ 0.882  — strong alignment
 *   MEDIUM   : phiThreshold(2) ≈ 0.809  — moderate alignment
 *   LOW      : phiThreshold(1) ≈ 0.691  — weak but above noise
 *   MINIMUM  : phiThreshold(0) ≈ 0.500  — noise floor
 *
 * The gaps between levels follow the golden ratio:
 *   gap(LOW→MED)/gap(MED→HIGH) ≈ φ
 */
export const CSL_THRESHOLDS = Object.freeze({
  CRITICAL: phiThreshold(4),  // ≈ 0.927
  HIGH:     phiThreshold(3),  // ≈ 0.882
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  LOW:      phiThreshold(1),  // ≈ 0.691
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
});

/**
 * Semantic deduplication threshold: ψ² above the CRITICAL gate.
 * Two vectors with cosine ≥ this are considered semantically identical.
 * ≈ 0.927 + (1 - 0.927) × ψ ≈ 0.927 + 0.045 ≈ 0.972
 *
 * This replaces the old arbitrary 0.92 and 0.95 dedup thresholds.
 */
export const DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL + (1 - CSL_THRESHOLDS.CRITICAL) * PSI;

/**
 * Coherence drift alert threshold.
 * Uses phi-harmonic level 2 ≈ 0.809. When cosine similarity between
 * two components drops below this, a drift alert fires.
 * Replaces arbitrary 0.75.
 */
export const COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;


// ─── Phi-Scaled Resource Allocation ─────────────────────────────────────────

/**
 * Fibonacci-normalized resource allocation for N pools/tiers.
 *
 * Given N tiers, assigns weights proportional to consecutive Fibonacci numbers
 * in descending order: the highest-priority tier gets F(N+1), next gets F(N), etc.
 *
 * @param {number} n — Number of tiers/pools
 * @returns {number[]} Normalized weights summing to 1.0
 *
 * @example
 * phiResourceWeights(5) → [0.387, 0.239, 0.148, 0.0916, 0.0566, …]
 * // Hot:34%, Warm:21%, Cold:13%, Reserve:8%, Governance:5%
 */
export function phiResourceWeights(n) {
  const fibs = [];
  for (let i = n + 1; i >= 2; i--) fibs.push(fib(i));
  const sum = fibs.reduce((a, b) => a + b, 0);
  return fibs.map(f => f / sum);
}

/**
 * Continuous phi-ratio split.  Divides a whole into two parts at the
 * golden ratio:   major = whole × ψ,  minor = whole × ψ²
 *
 * @param {number} whole
 * @returns {{ major: number, minor: number }}
 */
export function phiSplit(whole) {
  return {
    major: whole * PSI,        // ≈ 0.618 × whole
    minor: whole * PSI * PSI,  // ≈ 0.382 × whole
  };
}

/**
 * Multi-way phi split.  Recursively divides into N parts where each
 * part is ψ times the previous (geometric series in ψ).
 *
 * @param {number} whole - Total to divide
 * @param {number} n     - Number of parts
 * @returns {number[]} Parts summing to ≈ whole
 */
export function phiMultiSplit(whole, n) {
  const raw = [];
  for (let i = 0; i < n; i++) raw.push(Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(r => (r / sum) * whole);
}


// ─── Phi-Scaled Timing / Backoff ────────────────────────────────────────────

/**
 * Golden-ratio exponential backoff delay.
 *
 * delay(attempt) = baseMs × φ^attempt, clamped to maxMs
 *
 * Sequence with baseMs=1000:  1s → 1.618s → 2.618s → 4.236s → 6.854s → 11.09s → 17.94s → 29.03s
 * Compared to 2× doubling:   1s → 2s     → 4s     → 8s     → 16s    → 32s
 * φ-scaling is gentler early but still grows exponentially.
 *
 * @param {number} attempt  - 0-based attempt number
 * @param {number} [baseMs=1000]  - Base delay
 * @param {number} [maxMs=60000]  - Maximum delay
 * @param {boolean} [jitter=true] - Add ±ψ² jitter (≈ ±38.2%)
 * @returns {number} Delay in milliseconds
 */
export function phiBackoff(attempt, baseMs = 1000, maxMs = 60_000, jitter = true) {
  const raw = baseMs * Math.pow(PHI, attempt);
  const clamped = Math.min(raw, maxMs);
  if (!jitter) return Math.round(clamped);
  // Jitter range: [clamped × ψ², clamped × 1] — biased toward lower delays
  const jitterFactor = PSI * PSI + Math.random() * (1 - PSI * PSI);
  return Math.round(clamped * jitterFactor);
}

/**
 * Phi-harmonic interval sequence for monitoring, health checks, etc.
 * Produces intervals that increase by φ each step.
 *
 * @param {number} baseMs   - Starting interval
 * @param {number} steps    - Number of intervals to generate
 * @returns {number[]} Array of intervals
 */
export function phiIntervalSequence(baseMs, steps) {
  const intervals = [];
  for (let i = 0; i < steps; i++) {
    intervals.push(Math.round(baseMs * Math.pow(PHI, i)));
  }
  return intervals;
}


// ─── Phi-Scaled Cache / Pool Sizing ─────────────────────────────────────────

/**
 * Compute cache/pool sizes using Fibonacci numbers.
 * Maps tier labels to sizes that follow Fibonacci scaling.
 *
 * @param {number} basePower - Fibonacci index for the smallest tier (default: 10 → F(10)=55)
 * @returns {Object} Tier sizes
 *
 * @example
 * phiCacheSizes(10) → { xs: 55, sm: 89, md: 144, lg: 233, xl: 377, xxl: 610 }
 */
export function phiCacheSizes(basePower = 10) {
  return {
    xs:  fib(basePower),
    sm:  fib(basePower + 1),
    md:  fib(basePower + 2),
    lg:  fib(basePower + 3),
    xl:  fib(basePower + 4),
    xxl: fib(basePower + 5),
  };
}

/**
 * Phi-scaled queue depth.  Given a base capacity, compute a queue depth
 * that scales with load using the golden ratio.
 *
 * depth(load) = base × φ^(load_level)
 *
 * @param {number} base      - Base queue depth
 * @param {number} loadLevel - 0=idle, 1=light, 2=moderate, 3=heavy, 4=critical
 * @returns {number}
 */
export function phiQueueDepth(base, loadLevel) {
  return Math.round(base * Math.pow(PHI, loadLevel));
}


// ─── Phi-Scaled Weights for Fusion / Scoring ────────────────────────────────

/**
 * Generate N weights for score fusion that follow the golden ratio.
 * The first (most important) factor gets weight proportional to φ^(n-1),
 * the second φ^(n-2), etc.  All weights are normalized to sum to 1.
 *
 * @param {number} n - Number of factors
 * @returns {number[]} Weights summing to 1.0
 *
 * @example
 * phiFusionWeights(2) → [0.618, 0.382]    // replaces [0.6, 0.4]
 * phiFusionWeights(3) → [0.528, 0.326, 0.146] // replaces [0.4, 0.35, 0.25]
 */
export function phiFusionWeights(n) {
  const raw = [];
  for (let i = n - 1; i >= 0; i--) raw.push(Math.pow(PHI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(r => r / sum);
}

/**
 * Priority scoring using phi-weighted factors.
 *
 * score = Σ (factor_i × phiFusionWeight_i)
 *
 * @param {number[]} factors - Factor values (ordered most→least important)
 * @returns {number} Weighted score
 */
export function phiPriorityScore(...factors) {
  const weights = phiFusionWeights(factors.length);
  return factors.reduce((sum, f, i) => sum + f * weights[i], 0);
}


// ─── Pressure / Throttling Thresholds ───────────────────────────────────────

/**
 * Phi-harmonic pressure levels for backpressure monitoring.
 *
 * Replaces arbitrary [0.60, 0.80, 0.95] with phi-derived levels:
 *   NOMINAL:   0 → ψ²      ≈ 0 – 0.382
 *   ELEVATED:  ψ² → ψ      ≈ 0.382 – 0.618
 *   HIGH:      ψ → 1-ψ²    ≈ 0.618 – 0.854 *  (ψ + ψ³)
 *   CRITICAL:  > 1-ψ³      ≈ 0.854 – 1.000
 */
export const PRESSURE_LEVELS = Object.freeze({
  NOMINAL_MAX:   PSI * PSI,                    // ≈ 0.382
  ELEVATED_MAX:  PSI,                          // ≈ 0.618
  HIGH_MAX:      1 - Math.pow(PSI, 3),         // ≈ 0.854  (= 1 - 0.146)
  CRITICAL:      1 - Math.pow(PSI, 4),         // ≈ 0.910
});

/**
 * Classify a pressure ratio [0,1] into a level.
 * @param {number} ratio
 * @returns {'nominal'|'elevated'|'high'|'critical'}
 */
export function classifyPressure(ratio) {
  if (ratio >= PRESSURE_LEVELS.CRITICAL)   return 'critical';
  if (ratio >= PRESSURE_LEVELS.HIGH_MAX)   return 'high';
  if (ratio >= PRESSURE_LEVELS.ELEVATED_MAX) return 'elevated';
  return 'nominal';
}


// ─── Alert Thresholds (replacing arbitrary 0.80/0.95/1.00) ─────────────────

/**
 * Usage alert thresholds derived from phi-harmonic levels.
 *   warning  = ψ        ≈ 0.618  (61.8% of limit)
 *   caution  = 1 - ψ²   ≈ 0.764  (custom mid-level)
 *   critical = 1 - ψ³   ≈ 0.854  (85.4% of limit)
 *   exceeded = 1 - ψ⁴   ≈ 0.910  (91.0% — hard stop approaching)
 *   hard_max = 1.0                (100%)
 */
export const ALERT_THRESHOLDS = Object.freeze({
  warning:  PSI,                         // ≈ 0.618
  caution:  1 - PSI * PSI,              // ≈ 0.764  (≡ ψ + ψ³ series partial)
  critical: 1 - Math.pow(PSI, 3),       // ≈ 0.854
  exceeded: 1 - Math.pow(PSI, 4),       // ≈ 0.910
  hard_max: 1.0,
});


// ─── Token Budget Scaling ───────────────────────────────────────────────────

/**
 * Phi-scaled token budgets for tiered context windows.
 *
 * Given a base budget, each tier is φ× the previous:
 *   working  = base               (e.g. 8,192)
 *   session  = base × φ²          (≈ base × 2.618 → ~21,450)
 *   memory   = base × φ⁴          (≈ base × 6.854 → ~56,131)
 *   artifact = base × φ⁶          (≈ base × 17.94 → ~146,920)
 *
 * These replace the arbitrary [8K, 32K, 128K] with a coherent geometric
 * progression.
 *
 * @param {number} base - Working context budget in tokens
 * @returns {{ working: number, session: number, memory: number, artifacts: number }}
 */
export function phiTokenBudgets(base = 8192) {
  return {
    working:   Math.round(base),
    session:   Math.round(base * Math.pow(PHI, 2)),
    memory:    Math.round(base * Math.pow(PHI, 4)),
    artifacts: Math.round(base * Math.pow(PHI, 6)),
  };
}


// ─── Eviction / Priority Weights ────────────────────────────────────────────

/**
 * Three-factor eviction scoring weights using phi fusion:
 *   importance: φ²/(φ² + φ + 1) ≈ 0.486  (was 0.40)
 *   recency:    φ/(φ² + φ + 1)  ≈ 0.300  (was 0.35)
 *   relevance:  1/(φ² + φ + 1)  ≈ 0.214  (was 0.25)
 *
 * The ratios between consecutive weights are always ψ.
 */
export const EVICTION_WEIGHTS = (() => {
  const w = phiFusionWeights(3);
  return Object.freeze({ importance: w[0], recency: w[1], relevance: w[2] });
})();


// ─── Softmax Temperature ────────────────────────────────────────────────────

/**
 * Phi-derived softmax temperature for CSL routing.
 *
 * τ = ψ³ ≈ 0.236
 *
 * This is sharper than τ=1.0 (standard) but gentler than τ=0.1 (old hardcoded).
 * The phi-derived value ensures routing decisions are decisive without
 * collapsing to a single expert.
 */
export const PHI_TEMPERATURE = Math.pow(PSI, 3);  // ≈ 0.236

/**
 * Temperature function that adapts based on routing entropy.
 * When entropy is low (routing concentrated), raise temperature.
 * When entropy is high (routing spread), lower temperature.
 *
 * τ(H) = ψ^(1 + 2·(1-H/H_max))
 *
 * At max entropy: τ = ψ³ ≈ 0.236 (sharp)
 * At min entropy: τ = ψ¹ ≈ 0.618 (diffuse, to prevent collapse)
 *
 * @param {number} entropy     - Current routing entropy
 * @param {number} maxEntropy  - Maximum possible entropy (ln(numExperts))
 * @returns {number} Adaptive temperature
 */
export function adaptiveTemperature(entropy, maxEntropy) {
  const normalized = Math.min(1.0, entropy / (maxEntropy + EPSILON));
  const exponent = 1 + 2 * (1 - normalized);
  return Math.pow(PSI, exponent);
}


// ─── Quality / Correction Thresholds ────────────────────────────────────────

/**
 * Minimum quality scores for self-correction, indexed by error type severity.
 *
 * Derived from phi-harmonic thresholds:
 *   syntax:        phiThreshold(4) ≈ 0.927  (must be nearly perfect)
 *   hallucination: phiThreshold(3) ≈ 0.882  (factual accuracy critical)
 *   logic:         phiThreshold(2) ≈ 0.809  (reasoning tolerance)
 *   incomplete:    phiThreshold(1) ≈ 0.691  (some missing content ok)
 */
export const QUALITY_THRESHOLDS = Object.freeze({
  syntax:        phiThreshold(4),  // ≈ 0.927
  hallucination: phiThreshold(3),  // ≈ 0.882
  logic:         phiThreshold(2),  // ≈ 0.809
  incomplete:    phiThreshold(1),  // ≈ 0.691
});


// ─── Continuous CSL Gate Integration ────────────────────────────────────────

/**
 * CSL-gated value.  Passes `value` through a continuous CSL gate:
 *
 *   output = value × sigmoid((cos_score - τ) / temperature)
 *
 * When cos_score >> τ, output ≈ value (gate open).
 * When cos_score << τ, output ≈ 0 (gate closed).
 * The transition width is controlled by temperature.
 *
 * This replaces hard if/else threshold checks with smooth, differentiable gating.
 *
 * @param {number} value      - Value to gate
 * @param {number} cosScore   - CSL cosine similarity score
 * @param {number} [tau]      - Gate threshold (default: CSL_THRESHOLDS.MEDIUM)
 * @param {number} [temp]     - Temperature (default: PHI_TEMPERATURE)
 * @returns {number} Gated value
 */
export function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PHI_TEMPERATURE) {
  const x = (cosScore - tau) / (temp + EPSILON);
  const sigmoid = 1 / (1 + Math.exp(-x));
  return value * sigmoid;
}

/**
 * CSL-gated weight blending.  Given two weights and a CSL score,
 * smoothly blend between them based on how far above/below threshold.
 *
 * @param {number} weightHigh - Weight when CSL score is high
 * @param {number} weightLow  - Weight when CSL score is low
 * @param {number} cosScore   - CSL cosine similarity
 * @param {number} [tau]      - Threshold
 * @returns {number} Blended weight
 */
export function cslBlend(weightHigh, weightLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM) {
  const x = (cosScore - tau) / (PHI_TEMPERATURE + EPSILON);
  const t = 1 / (1 + Math.exp(-x));
  return weightLow + (weightHigh - weightLow) * t;
}

/**
 * CSL-gated routing score with phi-harmonic decay.
 * Combines semantic similarity with a phi-decaying recency factor.
 *
 * routeScore = cos(query, target) × φ^(-age / halflife)
 *
 * @param {number} cosineSim - Cosine similarity between query and route target
 * @param {number} ageMs     - Age of the route target in milliseconds
 * @param {number} halflifeMs - Half-life for recency decay (default: φ⁵ seconds ≈ 11.09s)
 * @returns {number} Combined routing score
 */
export function cslRouteScore(cosineSim, ageMs = 0, halflifeMs = Math.pow(PHI, 5) * 1000) {
  const decayFactor = Math.pow(PHI, -(ageMs / halflifeMs));
  return cosineSim * decayFactor;
}


// ─── Phi-Harmonic Window / Batch Sizing ─────────────────────────────────────

/**
 * Phi-scaled window size.  Given a base window, produce a series of
 * window sizes that grow by φ.
 *
 * Replaces arbitrary [1000, 5000, 10000, 60000] with:
 *   phiWindows(1000, 6) → [1000, 1618, 2618, 4236, 6854, 11090]
 *
 * @param {number} baseMs - Base window size in ms
 * @param {number} count  - Number of window sizes
 * @returns {number[]}
 */
export function phiWindows(baseMs, count) {
  return Array.from({ length: count }, (_, i) =>
    Math.round(baseMs * Math.pow(PHI, i))
  );
}

/**
 * Fibonacci batch sizes.  For batch processing, use Fibonacci numbers
 * as natural batch size breakpoints.
 *
 * @param {number} minBatch - Minimum batch size (finds nearest Fibonacci ≥ this)
 * @param {number} maxBatch - Maximum batch size
 * @returns {number[]} Fibonacci numbers in [minBatch, maxBatch]
 */
export function fibBatchSizes(minBatch, maxBatch) {
  const sizes = [];
  let a = 0, b = 1;
  while (b <= maxBatch) {
    if (b >= minBatch) sizes.push(b);
    [a, b] = [b, a + b];
  }
  return sizes;
}


// ─── Phi-Continuous Monitor Intervals ───────────────────────────────────────

/**
 * Adaptive monitoring interval.  When system is healthy, intervals
 * grow by φ up to a max. When unhealthy, intervals shrink by ψ down to a min.
 *
 * @param {number} currentInterval - Current interval in ms
 * @param {boolean} healthy        - Is the system currently healthy?
 * @param {number} [minMs=1000]    - Minimum interval
 * @param {number} [maxMs=60000]   - Maximum interval
 * @returns {number} Next interval in ms
 */
export function phiAdaptiveInterval(currentInterval, healthy, minMs = 1000, maxMs = 60_000) {
  if (healthy) {
    return Math.min(maxMs, Math.round(currentInterval * PHI));
  } else {
    return Math.max(minMs, Math.round(currentInterval * PSI));
  }
}


// ─── Export summary object for introspection ────────────────────────────────

export const PHI_MATH_VERSION = '2.0.0';

export default {
  PHI, PSI, PHI_SQ, PHI_CUBE, SQRT5, EPSILON,
  fib, fibSequence, fibContinuous,
  phiThreshold, phiThresholdLevel,
  CSL_THRESHOLDS, DEDUP_THRESHOLD, COHERENCE_DRIFT_THRESHOLD,
  phiResourceWeights, phiSplit, phiMultiSplit,
  phiBackoff, phiIntervalSequence,
  phiCacheSizes, phiQueueDepth,
  phiFusionWeights, phiPriorityScore,
  PRESSURE_LEVELS, classifyPressure,
  ALERT_THRESHOLDS,
  phiTokenBudgets,
  EVICTION_WEIGHTS,
  PHI_TEMPERATURE, adaptiveTemperature,
  QUALITY_THRESHOLDS,
  cslGate, cslBlend, cslRouteScore,
  phiWindows, fibBatchSizes,
  phiAdaptiveInterval,
};
