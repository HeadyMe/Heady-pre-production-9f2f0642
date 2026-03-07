/**
 * @file monte-carlo.js
 * @description Monte Carlo simulation engine with parallel worker_threads execution.
 *
 * Features:
 * - Configurable simulation parameters
 * - Parallel simulation runs via worker_threads
 * - Statistical analysis: mean, median, stddev, percentiles, confidence intervals
 * - Decision tree evaluation
 * - Strategy optimization (multi-armed bandit style)
 * - PHI-based sample sizing
 *
 * Sacred Geometry: PHI ratios for sample sizing, parallelism, convergence.
 * Zero external dependencies (worker_threads, crypto, events, os).
 *
 * @module HeadyIntelligence/MonteCarlo
 */

import { EventEmitter }            from 'events';
import { Worker, isMainThread,
         parentPort, workerData }  from 'worker_threads';
import { randomBytes }             from 'crypto';
import { cpus }                    from 'os';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBO     = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

/** Compute PHI-scaled sample size from a base. */
function phiSamples(base) {
  return Math.round(base * PHI);
}

// ─── Worker entry point ───────────────────────────────────────────────────────
// When this module is loaded as a worker, execute the simulation and post back.
if (!isMainThread) {
  _workerMain();
}

function _workerMain() {
  const { simFnSource, params, seeds, runCount } = workerData;

  // Reconstruct the simulation function from serialized source
  // eslint-disable-next-line no-new-func
  const simFn = new Function('params', 'rng', simFnSource);

  const results = [];
  for (let i = 0; i < runCount; i++) {
    const rng = _seededRng(seeds[i] ?? (seeds[0] ^ i));
    try {
      const outcome = simFn(params, rng);
      results.push({ ok: true, value: outcome });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  parentPort.postMessage({ results });
}

// ─── Seeded PRNG (xoshiro128++) ────────────────────────────────────────────────
function _seededRng(seed) {
  // 128-bit state from 32-bit seed via splitmix32
  let s0 = seed >>> 0;
  let s1 = (seed ^ 0xdeadbeef) >>> 0;
  let s2 = (seed ^ 0xcafebabe) >>> 0;
  let s3 = (seed ^ 0x12345678) >>> 0;

  // splitmix32 warmup
  for (let i = 0; i < 20; i++) {
    s0 = (s0 + 0x9e3779b9) >>> 0;
    let z = s0;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = z ^ (z >>> 16);
    s1 ^= z;
    s2 ^= (z << 7) | (z >>> 25);
    s3 ^= (z << 9) | (z >>> 23);
  }

  return {
    /** Returns float in [0, 1) */
    next() {
      const result = (((s0 + s3) >>> 0) >>> 0);
      const t = (s1 << 9) >>> 0;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;
      return (result >>> 0) / 0x100000000;
    },
    /** Returns int in [min, max) */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min));
    },
    /** Normal distribution via Box-Muller */
    normal(mean = 0, std = 1) {
      const u1 = Math.max(1e-15, this.next());
      const u2 = this.next();
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + std * z;
    },
    /** Exponential distribution */
    exponential(lambda = 1) {
      return -Math.log(Math.max(1e-15, this.next())) / lambda;
    },
    /** Uniform in [min, max] */
    uniform(min = 0, max = 1) {
      return min + this.next() * (max - min);
    },
    /** Bernoulli trial */
    bernoulli(p) {
      return this.next() < p ? 1 : 0;
    },
    /** Choice from array */
    choice(arr) {
      return arr[this.int(0, arr.length)];
    },
  };
}

// ─── Statistics helpers ────────────────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr, m) {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  return arr.reduce((s, v) => s + (v - mu) ** 2, 0) / (arr.length - 1);
}

function stddev(arr, m) {
  return Math.sqrt(variance(arr, m));
}

function median(arr) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(arr, p) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Compute 95% and 99% confidence intervals (t-distribution approximation).
 * For large n (>30), uses z-score approximation.
 */
function confidenceInterval(arr, level = 0.95) {
  const n  = arr.length;
  const mu = mean(arr);
  const se = stddev(arr, mu) / Math.sqrt(n);
  // z-scores (95% → 1.96, 99% → 2.576)
  const z  = level >= 0.99 ? 2.576 : 1.96;
  return { mean: mu, lower: mu - z * se, upper: mu + z * se, level, n };
}

/**
 * Full statistical summary for an array of numbers.
 */
function summarize(values) {
  if (values.length === 0) return { count: 0 };
  const mu  = mean(values);
  const sd  = stddev(values, mu);
  return {
    count:  values.length,
    mean:   mu,
    median: median(values),
    stddev: sd,
    min:    Math.min(...values),
    max:    Math.max(...values),
    p5:     percentile(values, 5),
    p25:    percentile(values, 25),
    p75:    percentile(values, 75),
    p95:    percentile(values, 95),
    p99:    percentile(values, 99),
    ci95:   confidenceInterval(values, 0.95),
    ci99:   confidenceInterval(values, 0.99),
  };
}

// ─── Decision Tree ─────────────────────────────────────────────────────────────

/**
 * A simple decision tree node.
 *
 * @typedef {object} DecisionNode
 * @property {string}    id
 * @property {string}    type          'decision' | 'chance' | 'terminal'
 * @property {number}    [value]       Terminal payoff
 * @property {object[]}  [branches]    For chance/decision nodes
 * @property {number}    [prob]        Probability (for chance branches)
 * @property {Function}  [condition]   (ctx) => bool (for decision branches)
 */

export class DecisionTree {
  /**
   * @param {DecisionNode} root
   */
  constructor(root) {
    this.root = root;
  }

  /**
   * Evaluate the expected value of the tree.
   * @param {object} [ctx]  Context passed to condition functions
   * @returns {number} Expected value (EMV)
   */
  expectedValue(ctx = {}) {
    return _evalNode(this.root, ctx);
  }

  /**
   * Run Monte Carlo simulation through the tree.
   * @param {number} runs
   * @param {object} [ctx]
   * @returns {SimulationResult}
   */
  simulate(runs = 1000, ctx = {}) {
    const rng = _seededRng(Date.now() & 0xffffffff);
    const outcomes = [];
    for (let i = 0; i < runs; i++) {
      outcomes.push(_simulateNode(this.root, ctx, rng));
    }
    return {
      runs,
      summary: summarize(outcomes),
      outcomes,
    };
  }
}

function _evalNode(node, ctx) {
  if (node.type === 'terminal') return node.value ?? 0;

  if (node.type === 'chance') {
    return node.branches.reduce((sum, branch) => {
      return sum + (branch.prob ?? 0) * _evalNode(branch, ctx);
    }, 0);
  }

  if (node.type === 'decision') {
    // Pick the branch with highest expected value whose condition is met
    const valid = node.branches.filter(b => !b.condition || b.condition(ctx));
    if (valid.length === 0) return 0;
    return Math.max(...valid.map(b => _evalNode(b, ctx)));
  }

  return 0;
}

function _simulateNode(node, ctx, rng) {
  if (node.type === 'terminal') return node.value ?? 0;

  if (node.type === 'chance') {
    const r = rng.next();
    let cumulative = 0;
    for (const branch of node.branches) {
      cumulative += branch.prob ?? 0;
      if (r < cumulative) return _simulateNode(branch, ctx, rng);
    }
    return _simulateNode(node.branches[node.branches.length - 1], ctx, rng);
  }

  if (node.type === 'decision') {
    const valid = node.branches.filter(b => !b.condition || b.condition(ctx));
    if (valid.length === 0) return 0;
    // In simulation mode pick best by EV
    const best = valid.reduce((a, b) =>
      _evalNode(a, ctx) >= _evalNode(b, ctx) ? a : b);
    return _simulateNode(best, ctx, rng);
  }

  return 0;
}

// ─── Strategy Optimizer (multi-arm bandit / UCB1) ─────────────────────────────

export class StrategyOptimizer extends EventEmitter {
  /**
   * @param {string[]} strategies  Strategy names
   * @param {object}   [opts]
   * @param {number}   [opts.explorationC]  UCB1 exploration constant (default: √2)
   * @param {number}   [opts.windowSize]    Rolling window for reward tracking
   */
  constructor(strategies, opts = {}) {
    super();
    this._strategies  = strategies;
    this._c           = opts.explorationC ?? Math.sqrt(2);
    this._windowSize  = opts.windowSize   ?? Math.round(100 * PHI);

    this._counts  = new Map(strategies.map(s => [s, 0]));
    this._rewards = new Map(strategies.map(s => [s, []]));
    this._total   = 0;
  }

  /**
   * Select the best strategy using UCB1.
   * @returns {string} strategy name
   */
  select() {
    // Explore unvisited strategies first
    for (const s of this._strategies) {
      if (this._counts.get(s) === 0) return s;
    }

    this._total++;
    let best = null, bestScore = -Infinity;
    for (const s of this._strategies) {
      const n  = this._counts.get(s);
      const mu = mean(this._rewards.get(s));
      const ucb = mu + this._c * Math.sqrt(Math.log(this._total) / n);
      if (ucb > bestScore) { bestScore = ucb; best = s; }
    }
    return best;
  }

  /**
   * Record a reward for a strategy.
   * @param {string} strategy
   * @param {number} reward
   */
  reward(strategy, reward) {
    this._counts.set(strategy, (this._counts.get(strategy) ?? 0) + 1);
    const window = this._rewards.get(strategy);
    window.push(reward);
    if (window.length > this._windowSize) window.shift();
    this.emit('reward', { strategy, reward, mean: mean(window) });
  }

  /**
   * Current strategy rankings.
   */
  rankings() {
    return this._strategies
      .map(s => ({
        strategy: s,
        count:    this._counts.get(s),
        mean:     mean(this._rewards.get(s)),
        stddev:   stddev(this._rewards.get(s)),
      }))
      .sort((a, b) => b.mean - a.mean);
  }
}

// ─── Monte Carlo Engine ────────────────────────────────────────────────────────

/**
 * Main Monte Carlo simulation engine.
 *
 * Runs simulations in parallel worker threads for CPU-intensive workloads,
 * or in-process for lightweight simulations.
 *
 * @example
 *   const mc = new MonteCarloEngine({ runs: 10000, workers: 4 });
 *   const result = await mc.simulate(
 *     (params, rng) => {
 *       // your simulation logic returning a numeric outcome
 *       return rng.normal(params.mean, params.std);
 *     },
 *     { mean: 100, std: 15 }
 *   );
 *   console.log(result.summary.mean, result.summary.ci95);
 */
export class MonteCarloEngine extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.runs]        Total simulation runs (default: PHI-scaled 1000)
   * @param {number}  [opts.workers]     Worker thread count (default: CPU count, max 8)
   * @param {boolean} [opts.inProcess]   Force in-process (no worker threads)
   * @param {number}  [opts.seed]        Base random seed
   * @param {number}  [opts.timeout]     Worker timeout ms (default: 30000)
   */
  constructor(opts = {}) {
    super();
    this.runs      = opts.runs      ?? phiSamples(1000);
    this.workers   = opts.workers   ?? Math.min(cpus().length, 8);
    this.inProcess = opts.inProcess ?? false;
    this.seed      = opts.seed      ?? (parseInt(randomBytes(4).toString('hex'), 16));
    this.timeout   = opts.timeout   ?? 30_000;
  }

  /**
   * Run a simulation function N times and return statistical results.
   *
   * @param {Function|string} simFn
   *   Either a function `(params, rng) => number` or its source string.
   *   NOTE: Worker threads require source string form.
   * @param {object} [params]    Parameters passed to each simulation run
   * @returns {Promise<SimulationResult>}
   */
  async simulate(simFn, params = {}) {
    const runs   = this.runs;
    const source = typeof simFn === 'function'
      ? `return (${simFn.toString()})(params, rng);`
      : simFn;

    // Generate per-run seeds (deterministic from base seed)
    const seeds = Array.from({ length: runs }, (_, i) =>
      (this.seed + Math.round(i * PHI * 1000)) >>> 0
    );

    let values;

    if (this.inProcess || runs <= 100) {
      // In-process path (small runs or forced)
      values = this._runInProcess(source, params, seeds, runs);
    } else {
      // Parallel worker path
      values = await this._runParallel(source, params, seeds, runs);
    }

    const okValues = values.filter(v => v.ok).map(v => v.value);
    const failed   = values.filter(v => !v.ok).length;

    const result = {
      runs,
      successful: okValues.length,
      failed,
      summary:    summarize(okValues),
      rawValues:  okValues,
    };

    this.emit('complete', result);
    return result;
  }

  /** In-process simulation (single-threaded). */
  _runInProcess(source, params, seeds, runs) {
    // eslint-disable-next-line no-new-func
    const simFn = new Function('params', 'rng', source);
    return Array.from({ length: runs }, (_, i) => {
      const rng = _seededRng(seeds[i]);
      try {
        return { ok: true, value: simFn(params, rng) };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });
  }

  /** Parallel simulation across worker threads. */
  _runParallel(source, params, seeds, totalRuns) {
    return new Promise((resolve, reject) => {
      const workerCount = Math.min(this.workers, totalRuns);
      const chunkSize   = Math.ceil(totalRuns / workerCount);
      const allResults  = [];
      let   completed   = 0;
      let   timedOut    = false;

      const timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Monte Carlo simulation timed out after ${this.timeout}ms`));
      }, this.timeout);

      for (let w = 0; w < workerCount; w++) {
        const start    = w * chunkSize;
        const end      = Math.min(start + chunkSize, totalRuns);
        const runCount = end - start;
        const chunk    = seeds.slice(start, end);

        const worker = new Worker(new URL(import.meta.url), {
          workerData: { simFnSource: source, params, seeds: chunk, runCount },
        });

        worker.on('message', ({ results }) => {
          if (timedOut) return;
          allResults.push(...results);
          completed++;
          this.emit('progress', { completed, total: workerCount, runs: allResults.length });
          if (completed === workerCount) {
            clearTimeout(timer);
            resolve(allResults);
          }
        });

        worker.on('error', err => {
          if (!timedOut) { clearTimeout(timer); reject(err); }
        });
      }
    });
  }

  /**
   * Run multiple scenarios and compare their statistical summaries.
   *
   * @param {Array<{name: string, simFn: Function|string, params: object}>} scenarios
   * @returns {Promise<{scenarios: object[], best: string}>}
   */
  async compareScenarios(scenarios) {
    const results = await Promise.all(
      scenarios.map(async s => ({
        name:   s.name,
        result: await this.simulate(s.simFn, s.params),
      }))
    );

    // Rank by mean outcome
    results.sort((a, b) => b.result.summary.mean - a.result.summary.mean);

    return {
      scenarios: results.map(r => ({
        name:    r.name,
        summary: r.result.summary,
      })),
      best: results[0]?.name ?? null,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export {
  summarize    as mcSummarize,
  mean         as mcMean,
  stddev       as mcStddev,
  percentile   as mcPercentile,
  confidenceInterval as mcCI,
  _seededRng   as createRng,
};

export default MonteCarloEngine;
