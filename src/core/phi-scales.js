'use strict';

/**
 * phi-scales.js — Core Phi Scale Engine
 * Heady AI Orchestration Platform
 *
 * Implements phi-harmonic (golden ratio) numeric scaling, decay, partitioning,
 * normalization, and spiral path generation. All classes integrate with the
 * CSL system (semantic-logic.js) and emit structured telemetry via the logger.
 */

const logger = require('../utils/logger');
const csl    = require('./semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHI          = 1.618033988749895;
const PHI_INVERSE  = 0.618033988749895;   // 1 / PHI  (= PHI - 1)
const SQRT_PHI     = Math.sqrt(PHI);       // ≈ 1.272019649514069
const PHI_SQUARED  = PHI * PHI;            // ≈ 2.618033988749895
const PHI_CUBED    = PHI * PHI * PHI;      // ≈ 4.23606797749979
const LOG_PHI      = Math.log(PHI);        // ≈ 0.48121182505960344
const TWO_PI_PHI   = 2 * Math.PI * PHI;   // ≈ 10.166407384630987

/** First 30 Fibonacci numbers (F(0)=0 … F(29)=514229) */
const FIBONACCI_SEQUENCE = (function buildFib() {
  const seq = [0, 1];
  for (let i = 2; i < 30; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return Object.freeze(seq);
}());

// ---------------------------------------------------------------------------
// PhiRange
// ---------------------------------------------------------------------------

/**
 * Represents a numeric range optionally mapped through phi coordinates.
 * When phiNormalized is true the "phi point" (equilibrium) sits at the
 * golden ratio of the span, i.e. baseMin + (baseMax-baseMin)*PHI_INVERSE.
 */
class PhiRange {
  /**
   * @param {number} baseMin
   * @param {number} baseMax
   * @param {boolean} [phiNormalized=false]
   */
  constructor(baseMin, baseMax, phiNormalized = false) {
    if (baseMin >= baseMax) {
      throw new RangeError(`PhiRange: baseMin (${baseMin}) must be less than baseMax (${baseMax})`);
    }
    this.baseMin       = baseMin;
    this.baseMax       = baseMax;
    this.phiNormalized = phiNormalized;
    this.span          = baseMax - baseMin;
    this._phiPoint     = baseMin + this.span * PHI_INVERSE;

    logger.debug('PhiRange created', {
      baseMin, baseMax, phiNormalized, phiPoint: this._phiPoint,
    });
  }

  /**
   * Map a raw value to [0, 1].  In phi-normalized mode the mapping is
   * non-linear: values below the phi-point are compressed into [0, PHI_INVERSE]
   * and values above are stretched into [PHI_INVERSE, 1].
   * @param {number} value
   * @returns {number} normalized in [0, 1]
   */
  normalize(value) {
    const clamped = Math.max(this.baseMin, Math.min(this.baseMax, value));
    if (!this.phiNormalized) {
      return (clamped - this.baseMin) / this.span;
    }
    // Below phi-point: linear across [0, PHI_INVERSE]
    if (clamped <= this._phiPoint) {
      const subSpan = this._phiPoint - this.baseMin;
      return subSpan === 0 ? 0 : ((clamped - this.baseMin) / subSpan) * PHI_INVERSE;
    }
    // Above phi-point: linear across [PHI_INVERSE, 1]
    const superSpan = this.baseMax - this._phiPoint;
    return superSpan === 0
      ? 1
      : PHI_INVERSE + ((clamped - this._phiPoint) / superSpan) * (1 - PHI_INVERSE);
  }

  /**
   * Invert normalize() — map a [0, 1] value back to the raw range.
   * @param {number} normalized
   * @returns {number}
   */
  denormalize(normalized) {
    const n = Math.max(0, Math.min(1, normalized));
    if (!this.phiNormalized) {
      return this.baseMin + n * this.span;
    }
    if (n <= PHI_INVERSE) {
      const subSpan = this._phiPoint - this.baseMin;
      return this.baseMin + (n / PHI_INVERSE) * subSpan;
    }
    const superSpan = this.baseMax - this._phiPoint;
    return this._phiPoint + ((n - PHI_INVERSE) / (1 - PHI_INVERSE)) * superSpan;
  }

  /** @returns {number} the phi equilibrium point in raw units */
  atPhiPoint() {
    return this._phiPoint;
  }

  /**
   * @param {number} value
   * @returns {boolean} true if value is above the phi equilibrium
   */
  abovePhiPoint(value) {
    return value > this._phiPoint;
  }

  /**
   * @param {number} value
   * @returns {boolean} true if value is below the phi equilibrium
   */
  belowPhiPoint(value) {
    return value < this._phiPoint;
  }

  /**
   * Signed distance from the phi equilibrium point (negative = below).
   * @param {number} value
   * @returns {number}
   */
  distanceFromPhi(value) {
    return value - this._phiPoint;
  }

  /**
   * Split the range at the phi point and return both sub-ranges.
   * @returns {{ lower: PhiRange, upper: PhiRange }}
   */
  goldenPartition() {
    return {
      lower: new PhiRange(this.baseMin, this._phiPoint, this.phiNormalized),
      upper: new PhiRange(this._phiPoint, this.baseMax, this.phiNormalized),
    };
  }

  /**
   * @param {number} value
   * @returns {boolean}
   */
  contains(value) {
    return value >= this.baseMin && value <= this.baseMax;
  }
}

// ---------------------------------------------------------------------------
// PhiScale
// ---------------------------------------------------------------------------

/**
 * Core wrapping class for any phi-scaled numeric value.
 * Integrates momentum smoothing, telemetry adjustment, history tracking,
 * and CSL gate hooks.
 */
class PhiScale {
  /**
   * @param {object}   opts
   * @param {string}   [opts.name='unnamed']
   * @param {number}   [opts.baseValue=1]
   * @param {number}   [opts.min=0]
   * @param {number}   [opts.max=PHI_SQUARED]
   * @param {boolean}  [opts.phiNormalized=false]
   * @param {number}   [opts.sensitivity=0.1]
   * @param {number}   [opts.momentumDecay=0.8]
   * @param {Function} [opts.telemetryFeed=null]
   * @param {number}   [opts.maxHistorySize=200]
   * @param {boolean}  [opts.enforceBounds=true]
   * @param {string}   [opts.unit='']
   * @param {string}   [opts.category='']
   * @param {string}   [opts.cslGate=null]
   */
  constructor(opts = {}) {
    this.name          = opts.name          ?? 'unnamed';
    this.baseValue     = opts.baseValue     ?? 1;
    this.min           = opts.min           ?? 0;
    this.max           = opts.max           ?? PHI_SQUARED;
    this.phiNormalized = opts.phiNormalized ?? false;
    this.sensitivity   = opts.sensitivity   ?? 0.1;
    this.momentumDecay = opts.momentumDecay ?? 0.8;
    this.telemetryFeed = opts.telemetryFeed ?? null;
    this.maxHistorySize= opts.maxHistorySize?? 200;
    this.enforceBounds = opts.enforceBounds ?? true;
    this.unit          = opts.unit          ?? '';
    this.category      = opts.category      ?? '';
    this.cslGate       = opts.cslGate       ?? null;

    if (this.baseValue < this.min || this.baseValue > this.max) {
      logger.warn('PhiScale: baseValue outside [min, max], clamping', {
        name: this.name, baseValue: this.baseValue, min: this.min, max: this.max,
      });
      this.baseValue = Math.max(this.min, Math.min(this.max, this.baseValue));
    }

    this.current  = this.baseValue;
    this._momentum = 0;
    this._history  = []; // { ts, value, delta, metrics }

    this._range = new PhiRange(this.min, this.max, this.phiNormalized);

    // CSL gate registration
    if (this.cslGate) {
      try {
        if (csl && typeof csl.registerGate === 'function') {
          csl.registerGate(this.cslGate, { phiScale: this.name });
        }
      } catch (err) {
        logger.warn('PhiScale: CSL gate registration failed', {
          name: this.name, cslGate: this.cslGate, error: err.message,
        });
      }
    }

    logger.debug('PhiScale created', {
      name: this.name, baseValue: this.baseValue, min: this.min, max: this.max,
    });
  }

  /** Current numeric value */
  get value() {
    return this.current;
  }

  /** Integer representation */
  asInt() {
    return Math.round(this.current);
  }

  /** Millisecond representation (always non-negative integer) */
  asMs() {
    return Math.max(0, Math.round(this.current));
  }

  /**
   * Floating-point representation with configurable decimal places.
   * @param {number} [precision=4]
   * @returns {number}
   */
  asFloat(precision = 4) {
    const factor = Math.pow(10, precision);
    return Math.round(this.current * factor) / factor;
  }

  /**
   * Apply a telemetry-driven adjustment with momentum smoothing.
   * The adjustment signal may come from opts.telemetryFeed or be passed directly.
   *
   * Momentum model:
   *   momentum = decay * momentum + (1 - decay) * rawAdjustment
   *   delta    = sensitivity * momentum
   *   current += delta  (clamped to [min, max] if enforceBounds)
   *
   * @param {object} [metrics={}]  arbitrary telemetry payload
   * @returns {number} new current value
   */
  adjust(metrics = {}) {
    let rawAdjustment = 0;

    // If a telemetryFeed function is wired, call it to obtain a scalar signal
    if (typeof this.telemetryFeed === 'function') {
      try {
        rawAdjustment = this.telemetryFeed(metrics, this.current, this) ?? 0;
      } catch (err) {
        logger.error('PhiScale: telemetryFeed threw', {
          name: this.name, error: err.message,
        });
        rawAdjustment = 0;
      }
    } else if (typeof metrics.adjustment === 'number') {
      rawAdjustment = metrics.adjustment;
    } else if (typeof metrics.signal === 'number') {
      rawAdjustment = metrics.signal;
    }

    this._momentum = this.momentumDecay * this._momentum
                   + (1 - this.momentumDecay) * rawAdjustment;

    const delta    = this.sensitivity * this._momentum;
    const proposed = this.current + delta;

    const next = this.enforceBounds
      ? Math.max(this.min, Math.min(this.max, proposed))
      : proposed;

    const entry = { ts: Date.now(), value: next, delta, metrics };
    this._history.push(entry);
    if (this._history.length > this.maxHistorySize) {
      this._history.shift();
    }

    this.current = next;

    logger.debug('PhiScale.adjust', {
      name: this.name, rawAdjustment, momentum: this._momentum,
      delta, prev: this.current - delta, next,
    });

    return this.current;
  }

  /**
   * Normalized position of current value in [0, 1].
   * @returns {number}
   */
  normalized() {
    return this._range.normalize(this.current);
  }

  /**
   * @returns {boolean} true when current normalized value > PHI_INVERSE
   */
  isAbovePhi() {
    return this.normalized() > PHI_INVERSE;
  }

  /**
   * @returns {boolean} true when current normalized value < PHI_INVERSE
   */
  isBelowPhi() {
    return this.normalized() < PHI_INVERSE;
  }

  /**
   * Signed distance of the current normalized value from the phi equilibrium.
   * @returns {number}
   */
  phiDeviation() {
    return this.normalized() - PHI_INVERSE;
  }

  /** Restore current value to baseValue and clear momentum & history. */
  reset() {
    logger.info('PhiScale.reset', { name: this.name, from: this.current, to: this.baseValue });
    this.current   = this.baseValue;
    this._momentum = 0;
    this._history  = [];
  }

  /**
   * Descriptive statistics over recorded history values.
   * @returns {{ mean: number, stddev: number, min: number, max: number, count: number }}
   */
  stats() {
    if (this._history.length === 0) {
      return { mean: this.current, stddev: 0, min: this.current, max: this.current, count: 0 };
    }
    const values = this._history.map(h => h.value);
    const n      = values.length;
    const mean   = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return {
      mean,
      stddev: Math.sqrt(variance),
      min:    Math.min(...values),
      max:    Math.max(...values),
      count:  n,
    };
  }

  /**
   * Trend direction based on recent history (last 10 samples).
   * @returns {'increasing'|'decreasing'|'stable'}
   */
  trend() {
    const window = this._history.slice(-10);
    if (window.length < 2) return 'stable';
    const first = window[0].value;
    const last  = window[window.length - 1].value;
    const span  = this.max - this.min;
    const threshold = span * 0.01; // 1 % of full range
    if (last - first >  threshold) return 'increasing';
    if (first - last >  threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Soft sigmoid gate centred at the phi equilibrium.
   * σ(x) = 1 / (1 + e^(-20 * (x - 0.618)))
   * @returns {number} activation in (0, 1)
   */
  cslActivation() {
    const x = this.normalized();
    const activation = 1 / (1 + Math.exp(-20 * (x - PHI_INVERSE)));

    if (this.cslGate) {
      try {
        if (csl && typeof csl.activateGate === 'function') {
          csl.activateGate(this.cslGate, activation);
        }
      } catch (err) {
        logger.warn('PhiScale.cslActivation: gate call failed', {
          name: this.name, error: err.message,
        });
      }
    }

    logger.debug('PhiScale.cslActivation', { name: this.name, normalized: x, activation });
    return activation;
  }

  /**
   * CSL ternary classification:
   *   +1  above phi equilibrium (≥ PHI_INVERSE + tolerance)
   *    0  at phi equilibrium    (within tolerance)
   *   -1  below phi equilibrium (≤ PHI_INVERSE - tolerance)
   * @param {number} [tolerance=0.05]
   * @returns {1|0|-1}
   */
  cslTernary(tolerance = 0.05) {
    const dev = this.phiDeviation();
    if (dev >  tolerance) return  1;
    if (dev < -tolerance) return -1;
    return 0;
  }

  /**
   * Phi-deviation as a normalized risk signal in [0, 1].
   * Risk is 0 at equilibrium and rises toward 1 as the value moves to either extreme.
   * @returns {number}
   */
  cslRisk() {
    const dev  = Math.abs(this.phiDeviation());  // 0 at phi, up to ~0.618 at extremes
    const risk = Math.min(1, dev / PHI_INVERSE);
    logger.debug('PhiScale.cslRisk', { name: this.name, deviation: dev, risk });
    return risk;
  }

  /**
   * Serialize the current state to a plain JSON-safe object.
   * @returns {object}
   */
  snapshot() {
    return {
      name:          this.name,
      baseValue:     this.baseValue,
      current:       this.current,
      min:           this.min,
      max:           this.max,
      phiNormalized: this.phiNormalized,
      sensitivity:   this.sensitivity,
      momentumDecay: this.momentumDecay,
      enforceBounds: this.enforceBounds,
      unit:          this.unit,
      category:      this.category,
      cslGate:       this.cslGate,
      momentum:      this._momentum,
      history:       this._history.slice(), // shallow copy
      ts:            Date.now(),
    };
  }

  /**
   * Restore state from a previously produced snapshot.
   * @param {object} snap
   */
  restore(snap) {
    if (!snap || typeof snap !== 'object') {
      throw new TypeError('PhiScale.restore: snapshot must be an object');
    }
    this.name          = snap.name          ?? this.name;
    this.baseValue     = snap.baseValue     ?? this.baseValue;
    this.current       = snap.current       ?? this.baseValue;
    this.min           = snap.min           ?? this.min;
    this.max           = snap.max           ?? this.max;
    this.phiNormalized = snap.phiNormalized ?? this.phiNormalized;
    this.sensitivity   = snap.sensitivity   ?? this.sensitivity;
    this.momentumDecay = snap.momentumDecay ?? this.momentumDecay;
    this.enforceBounds = snap.enforceBounds ?? this.enforceBounds;
    this.unit          = snap.unit          ?? this.unit;
    this.category      = snap.category      ?? this.category;
    this.cslGate       = snap.cslGate       ?? this.cslGate;
    this._momentum     = snap.momentum      ?? 0;
    this._history      = Array.isArray(snap.history) ? snap.history.slice() : [];
    this._range        = new PhiRange(this.min, this.max, this.phiNormalized);

    logger.info('PhiScale.restore', { name: this.name, current: this.current });
  }
}

// ---------------------------------------------------------------------------
// PhiBackoff
// ---------------------------------------------------------------------------

/**
 * Phi-exponential retry interval generator.
 * Intervals grow as baseInterval * PHI^attempt, ensuring sub-exponential
 * (relative to standard 2x doubling) yet golden-ratio-tuned backoff.
 */
class PhiBackoff {
  /**
   * @param {number} [baseInterval=1000]   Initial wait in ms
   * @param {number} [maxAttempts=10]
   * @param {number} [jitterFactor=0.15]   ±fraction of interval added as jitter
   */
  constructor(baseInterval = 1000, maxAttempts = 10, jitterFactor = 0.15) {
    this.baseInterval  = baseInterval;
    this.maxAttempts   = maxAttempts;
    this.jitterFactor  = jitterFactor;
    this._attempt      = 0;
    this._elapsed      = 0;
    this._MAX_INTERVAL = 300_000; // 5 minutes hard cap

    logger.debug('PhiBackoff created', { baseInterval, maxAttempts, jitterFactor });
  }

  /**
   * Compute and return the next backoff interval in ms, advancing the attempt counter.
   * @returns {number} interval in ms, or -1 when maxAttempts exhausted
   */
  next() {
    if (this._attempt >= this.maxAttempts) {
      logger.warn('PhiBackoff.next: maxAttempts exhausted', { maxAttempts: this.maxAttempts });
      return -1;
    }
    const raw     = this.baseInterval * Math.pow(PHI, this._attempt);
    const capped  = Math.min(raw, this._MAX_INTERVAL);
    const jitter  = capped * this.jitterFactor * (2 * Math.random() - 1);
    const interval= Math.max(0, Math.round(capped + jitter));

    this._elapsed += interval;
    this._attempt += 1;

    logger.debug('PhiBackoff.next', { attempt: this._attempt, interval });
    return interval;
  }

  /**
   * Return the full deterministic (no jitter) sequence for all attempts.
   * @returns {number[]}
   */
  sequence() {
    const seq = [];
    for (let i = 0; i < this.maxAttempts; i++) {
      const raw    = this.baseInterval * Math.pow(PHI, i);
      seq.push(Math.min(Math.round(raw), this._MAX_INTERVAL));
    }
    return seq;
  }

  /** Reset the attempt counter and elapsed tracker. */
  reset() {
    this._attempt = 0;
    this._elapsed = 0;
    logger.debug('PhiBackoff.reset');
  }

  /** @returns {number} attempts remaining */
  remaining() {
    return Math.max(0, this.maxAttempts - this._attempt);
  }

  /** @returns {number} total ms elapsed across all issued intervals */
  elapsed() {
    return this._elapsed;
  }

  /**
   * Compare phi-backoff sequence against standard 2x doubling for the same settings.
   * @returns {{ phi: number[], standard: number[], ratios: number[] }}
   */
  compare() {
    const phi      = this.sequence();
    const standard = [];
    for (let i = 0; i < this.maxAttempts; i++) {
      standard.push(Math.min(Math.round(this.baseInterval * Math.pow(2, i)), this._MAX_INTERVAL));
    }
    const ratios = phi.map((p, i) => standard[i] > 0 ? +(p / standard[i]).toFixed(4) : null);
    return { phi, standard, ratios };
  }

  toString() {
    const seq = this.sequence();
    return (
      `PhiBackoff(base=${this.baseInterval}ms, attempts=${this.maxAttempts}, ` +
      `jitter=±${(this.jitterFactor * 100).toFixed(0)}%) — sequence: ` +
      seq.map(v => `${v}ms`).join(', ')
    );
  }
}

// ---------------------------------------------------------------------------
// PhiDecay
// ---------------------------------------------------------------------------

/**
 * Golden spiral decay function.
 * Uses polar golden spiral r = PHI^(-θ/90°) to model the decay of a signal
 * over time.  θ is mapped from elapsed time using the half-life parameter.
 */
class PhiDecay {
  /**
   * @param {number} [halfLife=60000]  Time (ms) for signal to decay to ~50 %
   */
  constructor(halfLife = 60_000) {
    if (halfLife <= 0) throw new RangeError('PhiDecay: halfLife must be > 0');
    this.halfLife = halfLife;
    // Derive the theta that yields r = 0.5: PHI^(-θ_half/90) = 0.5
    // => -θ_half/90 * LOG_PHI = ln(0.5) => θ_half = -90 * ln(0.5) / LOG_PHI
    this._thetaHalf = (-90 * Math.log(0.5)) / LOG_PHI;
    logger.debug('PhiDecay created', { halfLife, thetaHalf: this._thetaHalf });
  }

  /**
   * Compute the golden spiral decay factor [0, 1] for the given elapsed time.
   * @param {number} elapsedTime  ms since the signal was emitted
   * @returns {number}
   */
  decay(elapsedTime) {
    if (elapsedTime < 0) return 1;
    const thetaDeg = (elapsedTime / this.halfLife) * this._thetaHalf;
    return Math.pow(PHI, -thetaDeg / 90);
  }

  /**
   * Apply decay to a scalar value.
   * @param {number} value
   * @param {number} elapsedTime ms
   * @returns {number}
   */
  apply(value, elapsedTime) {
    return value * this.decay(elapsedTime);
  }

  /**
   * Calculate the elapsed time required to reach a target fraction.
   * @param {number} targetPercent  0–1 (e.g. 0.1 = 10 %)
   * @returns {number} ms
   */
  timeToDecay(targetPercent) {
    if (targetPercent <= 0 || targetPercent >= 1) {
      throw new RangeError('PhiDecay.timeToDecay: targetPercent must be in (0, 1)');
    }
    // PHI^(-θ/90) = targetPercent => θ = -90 * ln(targetPercent) / LOG_PHI
    const thetaDeg = (-90 * Math.log(targetPercent)) / LOG_PHI;
    return (thetaDeg / this._thetaHalf) * this.halfLife;
  }

  /**
   * Given a decay factor, return the elapsed time that produced it.
   * @param {number} decayFactor (0, 1]
   * @returns {number} ms
   */
  inverse(decayFactor) {
    if (decayFactor <= 0 || decayFactor > 1) {
      throw new RangeError('PhiDecay.inverse: decayFactor must be in (0, 1]');
    }
    // Same derivation as timeToDecay
    return this.timeToDecay(decayFactor);
  }

  /**
   * Compare golden spiral decay with linear and standard (ln2-based) exponential decay.
   * @param {number} elapsedTime ms
   * @returns {{ goldenSpiral: number, linear: number, standardExponential: number }}
   */
  compare(elapsedTime) {
    const t     = Math.max(0, elapsedTime);
    const goldenSpiral      = this.decay(t);
    const linear            = Math.max(0, 1 - t / (2 * this.halfLife));
    const standardExponential = Math.exp(-Math.log(2) * t / this.halfLife);
    return { goldenSpiral, linear, standardExponential };
  }
}

// ---------------------------------------------------------------------------
// PhiPartitioner
// ---------------------------------------------------------------------------

/**
 * Fibonacci-based work chunking.
 * Uses the pre-computed FIBONACCI_SEQUENCE to find phi-harmonic chunk sizes
 * that minimize cognitive and computational overhead.
 */
class PhiPartitioner {
  constructor() {
    // Local mutable copy for indexed lookups (excludes 0 for practical work sizing)
    this._fibs = FIBONACCI_SEQUENCE.slice(1); // [1,1,2,3,5,8,13,21,...]
    logger.debug('PhiPartitioner created', { fibCount: this._fibs.length });
  }

  /**
   * Find the best chunk count for given work and resources.
   * Returns the Fibonacci number closest to Math.ceil(totalWork / availableResources).
   * @param {number} totalWork
   * @param {number} availableResources
   * @returns {number}
   */
  partition(totalWork, availableResources) {
    if (availableResources <= 0) throw new RangeError('PhiPartitioner.partition: resources must be > 0');
    const ideal = Math.ceil(totalWork / availableResources);
    return this.nearestFibonacci(ideal);
  }

  /**
   * Greedy Fibonacci decomposition of totalWork into chunks ≤ maxChunkSize.
   * Each step uses the largest Fibonacci number ≤ remaining, down to 1.
   * @param {number} totalWork
   * @param {number} maxChunkSize
   * @returns {number[]}
   */
  split(totalWork, maxChunkSize) {
    if (totalWork <= 0) return [];
    const eligible = this._fibs.filter(f => f <= maxChunkSize);
    if (eligible.length === 0) {
      // No Fibonacci ≤ maxChunkSize; fall back to 1s
      return Array(totalWork).fill(1);
    }
    const chunks = [];
    let remaining = totalWork;
    while (remaining > 0) {
      // Find largest eligible Fibonacci ≤ remaining
      let chosen = 1;
      for (let i = eligible.length - 1; i >= 0; i--) {
        if (eligible[i] <= remaining) { chosen = eligible[i]; break; }
      }
      chunks.push(chosen);
      remaining -= chosen;
      if (chunks.length > 10_000) {
        logger.warn('PhiPartitioner.split: chunk limit reached, truncating', { totalWork, maxChunkSize });
        break;
      }
    }
    return chunks;
  }

  /**
   * Get the nth Fibonacci number (0-indexed, F(0)=0).
   * @param {number} n
   * @returns {number}
   */
  fibonacci(n) {
    if (n < 0)  throw new RangeError('fibonacci: n must be ≥ 0');
    if (n < FIBONACCI_SEQUENCE.length) return FIBONACCI_SEQUENCE[n];
    // Extend beyond the pre-computed 30 terms
    let a = FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 2];
    let b = FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 1];
    for (let i = FIBONACCI_SEQUENCE.length; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Find the Fibonacci number in the pre-computed sequence closest to n.
   * @param {number} n
   * @returns {number}
   */
  nearestFibonacci(n) {
    if (n <= 0) return 0;
    let best = this._fibs[0];
    let bestDist = Math.abs(n - best);
    for (const f of this._fibs) {
      const dist = Math.abs(n - f);
      if (dist < bestDist) { best = f; bestDist = dist; }
    }
    return best;
  }

  /**
   * @param {number} n
   * @returns {boolean}
   */
  isFibonacci(n) {
    if (n < 0) return false;
    return FIBONACCI_SEQUENCE.includes(n);
  }

  /**
   * Return all Fibonacci numbers in the pre-computed sequence within [min, max].
   * @param {number} min
   * @param {number} max
   * @returns {number[]}
   */
  fibonacciRange(min, max) {
    return FIBONACCI_SEQUENCE.filter(f => f >= min && f <= max);
  }

  /**
   * Split total into two parts at the golden ratio.
   * The larger part = total * PHI_INVERSE^(-1) … actually: larger = total * (1/PHI) + total * (1/PHI²)
   * i.e. larger = total * PHI / (PHI + 1) = total * PHI / PHI² = total / PHI = total * PHI_INVERSE
   * smaller = total - larger
   * @param {number} total
   * @returns {{ larger: number, smaller: number, ratio: number }}
   */
  goldenPartition(total) {
    const larger  = total * PHI_INVERSE;   // larger sub-part (≈61.8 % of total)
    const smaller = total - larger;
    return { larger, smaller, ratio: larger / (smaller || 1) };
  }
}

// ---------------------------------------------------------------------------
// PhiNormalizer (static utility class)
// ---------------------------------------------------------------------------

/**
 * Static methods for converting values between raw and phi coordinate spaces.
 */
class PhiNormalizer {
  /**
   * Map value in [min, max] to phi coordinate space [0, 1] with the equilibrium
   * at PHI_INVERSE.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static normalize(value, min, max) {
    if (max === min) return PHI_INVERSE;
    return (Math.max(min, Math.min(max, value)) - min) / (max - min);
  }

  /**
   * @param {number} phiValue  [0, 1]
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static denormalize(phiValue, min, max) {
    return min + Math.max(0, Math.min(1, phiValue)) * (max - min);
  }

  /**
   * Convert a percentage (0–100) to a phi-space value [0, 1].
   * @param {number} percent
   * @returns {number}
   */
  static fromPercent(percent) {
    return Math.max(0, Math.min(100, percent)) / 100;
  }

  /**
   * Convert a phi-space value [0, 1] to a percentage (0–100).
   * @param {number} phiValue
   * @returns {number}
   */
  static toPercent(phiValue) {
    return Math.max(0, Math.min(1, phiValue)) * 100;
  }

  /**
   * Map a discrete integer (discreteMin..discreteMax) to its position on the
   * golden spiral, giving non-linear spacing tuned by PHI.
   * @param {number} discreteValue
   * @param {number} discreteMin
   * @param {number} discreteMax
   * @returns {number}  phi-space position in [0, 1]
   */
  static mapDiscrete(discreteValue, discreteMin, discreteMax) {
    if (discreteMax === discreteMin) return PHI_INVERSE;
    const linear  = (discreteValue - discreteMin) / (discreteMax - discreteMin);
    // Apply golden spiral warp: each step is scaled by PHI^(linear*2 - 1)
    const warped  = Math.pow(PHI, (linear * 2 - 1) * LOG_PHI) - Math.pow(PHI, -LOG_PHI);
    const scale   = Math.pow(PHI, LOG_PHI) - Math.pow(PHI, -LOG_PHI);
    return scale === 0 ? linear : Math.max(0, Math.min(1, warped / scale));
  }

  /**
   * Map a string category to a phi position.
   * Categories are evenly distributed across the [0, 1] range, with the
   * equilibrium category landing closest to PHI_INVERSE.
   * @param {string}   category
   * @param {string[]} categories  ordered array of all possible categories
   * @returns {number}  phi-space position in [0, 1]
   */
  static mapCategory(category, categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new TypeError('PhiNormalizer.mapCategory: categories must be a non-empty array');
    }
    const idx = categories.indexOf(category);
    if (idx === -1) {
      logger.warn('PhiNormalizer.mapCategory: unknown category, returning PHI_INVERSE', { category });
      return PHI_INVERSE;
    }
    const n = categories.length;
    return n === 1 ? PHI_INVERSE : idx / (n - 1);
  }

  /**
   * Convert a stepped integer value (0..steps-1) to a continuous phi position.
   * Steps are spaced at Fibonacci-weighted intervals.
   * @param {number} value  integer step index
   * @param {number} steps  total number of steps
   * @returns {number}  phi-space position in [0, 1]
   */
  static discreteToContinuous(value, steps) {
    if (steps <= 1) return PHI_INVERSE;
    const normalized = value / (steps - 1);
    // Golden-ratio warp: each successive step is multiplied by PHI_INVERSE
    // cumulative weighting uses partial sums of geometric series with ratio PHI_INVERSE
    const total = (1 - Math.pow(PHI_INVERSE, steps)) / (1 - PHI_INVERSE);
    const cumulative = total === 0
      ? normalized
      : (1 - Math.pow(PHI_INVERSE, value + 1)) / ((1 - PHI_INVERSE) * total);
    return Math.max(0, Math.min(1, cumulative));
  }
}

// ---------------------------------------------------------------------------
// PhiSpiral
// ---------------------------------------------------------------------------

/**
 * Golden spiral path generator.
 * The golden spiral is a special case of the logarithmic spiral where the growth
 * factor per quarter turn is PHI.  In polar form: r = a * PHI^(θ/90°).
 */
class PhiSpiral {
  /**
   * @param {number} [scale=1]      Scaling factor applied to all radii
   * @param {number} [rotations=2]  Number of full rotations for generated point sets
   */
  constructor(scale = 1, rotations = 2) {
    this.scale     = scale;
    this.rotations = rotations;
    logger.debug('PhiSpiral created', { scale, rotations });
  }

  /**
   * Compute Cartesian (x, y) on the golden spiral at angle theta (degrees).
   * @param {number} theta  angle in degrees
   * @returns {{ x: number, y: number, r: number, theta: number }}
   */
  point(theta) {
    const r = this.scale * Math.pow(PHI, theta / 90);
    const rad = (theta * Math.PI) / 180;
    return {
      x:     r * Math.cos(rad),
      y:     r * Math.sin(rad),
      r,
      theta,
    };
  }

  /**
   * Generate an array of evenly spaced points spanning [0°, 360° * rotations].
   * @param {number} [count=36]
   * @returns {Array<{ x: number, y: number, r: number, theta: number }>}
   */
  points(count = 36) {
    if (count < 2) throw new RangeError('PhiSpiral.points: count must be ≥ 2');
    const totalDeg = 360 * this.rotations;
    const step     = totalDeg / (count - 1);
    const pts      = [];
    for (let i = 0; i < count; i++) {
      pts.push(this.point(i * step));
    }
    return pts;
  }

  /**
   * Spherical linear interpolation between two angular positions on the spiral.
   * @param {number} startTheta  degrees
   * @param {number} endTheta    degrees
   * @param {number} t           interpolation factor [0, 1]
   * @returns {{ x: number, y: number, r: number, theta: number }}
   */
  interpolate(startTheta, endTheta, t) {
    const t_   = Math.max(0, Math.min(1, t));
    const theta = startTheta + (endTheta - startTheta) * t_;
    return this.point(theta);
  }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  // Constants
  PHI,
  PHI_INVERSE,
  SQRT_PHI,
  PHI_SQUARED,
  PHI_CUBED,
  LOG_PHI,
  TWO_PI_PHI,
  FIBONACCI_SEQUENCE,

  // Classes
  PhiRange,
  PhiScale,
  PhiBackoff,
  PhiDecay,
  PhiPartitioner,
  PhiNormalizer,
  PhiSpiral,
};
