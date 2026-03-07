/**
 * @file arena-mode.js
 * @description Battle Arena for LLM model evaluation.
 *
 * Features:
 * - Pit multiple LLM providers against each other on identical tasks
 * - Elo rating system (K-factor: PHI-scaled by match count)
 * - Task-specific leaderboards
 * - Statistical significance testing (Wilson score, t-test approximation)
 * - Automated benchmark suites (built-in + custom)
 * - Head-to-head and round-robin modes
 *
 * Zero external dependencies — events, crypto (Node built-ins).
 * Sacred Geometry: PHI Elo K-factors, Fibonacci benchmark batch sizes.
 *
 * @module HeadyServices/ArenaMode
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// Elo constants
const ELO_BASE      = 1500;
const K_INITIAL     = Math.round(PHI * 20);  // 32.36 → 32 for new models
const K_ESTABLISHED = Math.round(PHI * 10);  // 16.18 → 16 for established models
const K_CUTOFF      = 21;   // matches before switching to established K

// ─── Elo Calculator ───────────────────────────────────────────────────────────
export class EloSystem {
  /**
   * Expected score for player A against B.
   * E_A = 1 / (1 + 10^((R_B - R_A)/400))
   */
  expected(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Compute new ratings after a match.
   * @param {number} ratingA
   * @param {number} ratingB
   * @param {number} scoreA   1=A wins, 0=B wins, 0.5=draw
   * @param {number} matchesA Total matches played by A
   * @param {number} matchesB Total matches played by B
   * @returns {{ newA, newB, deltaA, deltaB }}
   */
  update(ratingA, ratingB, scoreA, matchesA = 100, matchesB = 100) {
    const eA   = this.expected(ratingA, ratingB);
    const eB   = 1 - eA;
    const scoreB = 1 - scoreA;

    const kA   = matchesA < K_CUTOFF ? K_INITIAL : K_ESTABLISHED;
    const kB   = matchesB < K_CUTOFF ? K_INITIAL : K_ESTABLISHED;

    const deltaA = kA * (scoreA - eA);
    const deltaB = kB * (scoreB - eB);

    return {
      newA:   Math.round(ratingA + deltaA),
      newB:   Math.round(ratingB + deltaB),
      deltaA: Math.round(deltaA * 10) / 10,
      deltaB: Math.round(deltaB * 10) / 10,
    };
  }
}

// ─── Model Stats ─────────────────────────────────────────────────────────────
export class ModelStats {
  constructor(name, provider) {
    this.name     = name;
    this.provider = provider;
    this.rating   = ELO_BASE;
    this.matches  = 0;
    this.wins     = 0;
    this.losses   = 0;
    this.draws    = 0;
    this.totalScore    = 0;
    this.scoresByTask  = new Map();   // taskType → { wins, losses, draws }
    this.latencyMsAvg  = 0;
    this.latencyMsSamples = [];
    this.costUsdTotal  = 0;
    this.tokenEfficiency = 0;  // score per token
  }

  get winRate()  { return this.matches > 0 ? this.wins / this.matches : 0; }
  get avgScore() { return this.matches > 0 ? this.totalScore / this.matches : 0; }

  recordMatch(score, latencyMs, costUsd, taskType) {
    this.matches++;
    this.totalScore  += score;
    this.costUsdTotal += costUsd;

    if (score > 0.5)      this.wins++;
    else if (score < 0.5) this.losses++;
    else                  this.draws++;

    this.latencyMsSamples.push(latencyMs);
    if (this.latencyMsSamples.length > 34) this.latencyMsSamples.shift();
    this.latencyMsAvg = this.latencyMsSamples.reduce((a, b) => a + b, 0) / this.latencyMsSamples.length;

    if (taskType) {
      const ts = this.scoresByTask.get(taskType) ?? { wins: 0, losses: 0, draws: 0 };
      if (score > 0.5) ts.wins++;
      else if (score < 0.5) ts.losses++;
      else ts.draws++;
      this.scoresByTask.set(taskType, ts);
    }
  }

  toJSON() {
    return {
      name:          this.name,
      provider:      this.provider,
      rating:        this.rating,
      matches:       this.matches,
      wins:          this.wins,
      losses:        this.losses,
      draws:         this.draws,
      winRate:       Math.round(this.winRate * 1000) / 10,  // percentage
      avgScore:      Math.round(this.avgScore * 1000) / 1000,
      latencyMsAvg:  Math.round(this.latencyMsAvg),
      costUsdTotal:  Math.round(this.costUsdTotal * 10000) / 10000,
      taskBreakdown: Object.fromEntries(this.scoresByTask),
    };
  }
}

// ─── Benchmark Task ───────────────────────────────────────────────────────────
/**
 * @typedef {object} BenchmarkTask
 * @property {string}   id
 * @property {string}   type          Task type for leaderboard bucketing
 * @property {Array}    messages      Chat messages to send
 * @property {string}   [system]
 * @property {Function} judge         async (responseA, responseB) => { winner, reason }
 *                                    winner: 'A' | 'B' | 'draw'
 */

// Built-in benchmark suites
const BUILT_IN_BENCHMARKS = [
  {
    id:   'reasoning-001',
    type: 'reasoning',
    messages: [{ role: 'user', content: 'What is 17 * 18? Show your work step by step.' }],
    judge: async (a, b) => {
      const expected = '306';
      const aCorrect = a.content.includes(expected);
      const bCorrect = b.content.includes(expected);
      if (aCorrect && !bCorrect)  return { winner: 'A', reason: 'correct answer' };
      if (!aCorrect && bCorrect)  return { winner: 'B', reason: 'correct answer' };
      if (aCorrect && bCorrect)   return { winner: 'draw', reason: 'both correct' };
      return { winner: 'draw', reason: 'both incorrect' };
    },
  },
  {
    id:   'code-001',
    type: 'code',
    messages: [{ role: 'user', content: 'Write a JavaScript function to flatten a nested array.' }],
    judge: async (a, b) => {
      const hasCode = (r) => r.content.includes('function') || r.content.includes('=>');
      const aHas = hasCode(a);
      const bHas = hasCode(b);
      if (aHas && !bHas)  return { winner: 'A', reason: 'provided code' };
      if (!aHas && bHas)  return { winner: 'B', reason: 'provided code' };
      // Prefer shorter (more concise) code if both have it
      if (aHas && bHas) {
        return a.content.length < b.content.length
          ? { winner: 'A', reason: 'more concise' }
          : { winner: 'B', reason: 'more concise' };
      }
      return { winner: 'draw', reason: 'neither provided code' };
    },
  },
  {
    id:   'creative-001',
    type: 'creative',
    messages: [{ role: 'user', content: 'Write a haiku about artificial intelligence.' }],
    judge: async (a, b) => {
      // Prefer longer creative response (more effort)
      if (a.content.length > b.content.length * PHI_INV) return { winner: 'A', reason: 'richer response' };
      if (b.content.length > a.content.length * PHI_INV) return { winner: 'B', reason: 'richer response' };
      return { winner: 'draw', reason: 'comparable length' };
    },
  },
];

// ─── Match Record ─────────────────────────────────────────────────────────────
class MatchRecord {
  constructor({ taskId, taskType, modelA, modelB }) {
    this.id       = randomUUID();
    this.ts       = new Date().toISOString();
    this.taskId   = taskId;
    this.taskType = taskType;
    this.modelA   = modelA;
    this.modelB   = modelB;
    this.winner   = null;   // 'A' | 'B' | 'draw'
    this.reason   = '';
    this.ratingDelta = { A: 0, B: 0 };
    this.latency  = { A: 0, B: 0 };
    this.cost     = { A: 0, B: 0 };
    this.error    = null;
    this.completed = false;
  }

  toJSON() {
    return {
      id: this.id, ts: this.ts, taskId: this.taskId, taskType: this.taskType,
      modelA: this.modelA, modelB: this.modelB, winner: this.winner,
      reason: this.reason, ratingDelta: this.ratingDelta,
      latency: this.latency, cost: this.cost, completed: this.completed,
    };
  }
}

// ─── Statistical Tests ────────────────────────────────────────────────────────
/**
 * Wilson score interval (95% confidence) for a binary outcome.
 * @param {number} wins
 * @param {number} n
 * @returns {{ lower, upper, center }}
 */
export function wilsonScore(wins, n) {
  if (n === 0) return { lower: 0, upper: 1, center: 0 };
  const z  = 1.96;  // 95% confidence
  const p  = wins / n;
  const denom = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denom;
  const delta  = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom;
  return {
    lower:  Math.max(0, center - delta),
    upper:  Math.min(1, center + delta),
    center,
  };
}

/**
 * Approximate p-value for win rate difference (one-sample z-test vs 0.5).
 * H0: model win rate = 0.5 (random)
 */
export function significanceTest(wins, n) {
  if (n < 5) return { significant: false, p: 1, z: 0 };
  const p   = wins / n;
  const se  = Math.sqrt(0.25 / n);  // std error under H0
  const z   = (p - 0.5) / se;
  // Approximate two-tailed p-value using normal CDF approximation
  const absZ = Math.abs(z);
  const p_value = 2 * (1 - normalCDF(absZ));
  return { significant: p_value < 0.05, p: Math.round(p_value * 10000) / 10000, z: Math.round(z * 100) / 100 };
}

function normalCDF(z) {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf  = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  return 1 - pdf * poly;
}

// ─── ArenaMode ────────────────────────────────────────────────────────────────
export class ArenaMode extends EventEmitter {
  /**
   * @param {object} opts
   * @param {Map}     opts.providers          providerName → BaseProvider instance
   * @param {object[]} [opts.benchmarks]      Custom benchmark tasks (appended to built-ins)
   * @param {boolean}  [opts.runBuiltIns]     Include built-in benchmarks (default true)
   * @param {number}   [opts.maxConcurrent]   Max parallel matches (default 3)
   */
  constructor(opts = {}) {
    super();
    this._providers    = opts.providers ?? new Map();
    this._elo          = new EloSystem();
    this._models       = new Map();    // 'provider:model' → ModelStats
    this._matches      = [];           // MatchRecord[]
    this._benchmarks   = [
      ...(opts.runBuiltIns !== false ? BUILT_IN_BENCHMARKS : []),
      ...(opts.benchmarks ?? []),
    ];
    this._maxConcurrent = opts.maxConcurrent ?? 3;
    this._running       = false;
  }

  // ─── Model registration ───────────────────────────────────────────────

  registerModel(name, provider, initialRating = ELO_BASE) {
    const key = `${provider}:${name}`;
    if (!this._models.has(key)) {
      const stats  = new ModelStats(name, provider);
      stats.rating = initialRating;
      this._models.set(key, stats);
    }
    return this._models.get(key);
  }

  _getStats(providerName, model) {
    const key = `${providerName}:${model}`;
    if (!this._models.has(key)) this.registerModel(model, providerName);
    return this._models.get(key);
  }

  // ─── Match execution ──────────────────────────────────────────────────

  /**
   * Run a single head-to-head match on a task.
   * @param {object}  task          BenchmarkTask
   * @param {string}  providerA
   * @param {string}  providerB
   * @param {object}  [callOpts]    options passed to generate()
   * @returns {Promise<MatchRecord>}
   */
  async runMatch(task, providerA, providerB, callOpts = {}) {
    const pA  = this._providers.get(providerA);
    const pB  = this._providers.get(providerB);
    if (!pA)  throw new Error(`Unknown provider: ${providerA}`);
    if (!pB)  throw new Error(`Unknown provider: ${providerB}`);

    const modelA  = callOpts.modelA ?? pA._model ?? 'default';
    const modelB  = callOpts.modelB ?? pB._model ?? 'default';
    const record  = new MatchRecord({
      taskId: task.id, taskType: task.type ?? 'default', modelA: `${providerA}:${modelA}`, modelB: `${providerB}:${modelB}`,
    });

    this._matches.push(record);
    if (this._matches.length > 610) this._matches.shift();  // Fibonacci cap

    this.emit('matchStart', { matchId: record.id, providerA, providerB, taskId: task.id });

    try {
      // Call both providers concurrently
      const [resA, resB] = await Promise.allSettled([
        this._callTimed(pA, task, { ...callOpts, model: modelA }),
        this._callTimed(pB, task, { ...callOpts, model: modelB }),
      ]);

      const a = resA.status === 'fulfilled' ? resA.value : { content: '', latencyMs: 0, cost: 0, error: resA.reason };
      const b = resB.status === 'fulfilled' ? resB.value : { content: '', latencyMs: 0, cost: 0, error: resB.reason };

      record.latency = { A: a.latencyMs, B: b.latencyMs };
      record.cost    = { A: a.cost, B: b.cost };

      // Judge
      let judged;
      if (a.error && !b.error)     judged = { winner: 'B', reason: `A errored: ${a.error.message}` };
      else if (!a.error && b.error) judged = { winner: 'A', reason: `B errored: ${b.error.message}` };
      else if (a.error && b.error)  judged = { winner: 'draw', reason: 'Both errored' };
      else                          judged = await task.judge(a, b);

      record.winner = judged.winner;
      record.reason = judged.reason ?? '';
      record.completed = true;

      // Score
      const scoreA = judged.winner === 'A' ? 1 : judged.winner === 'draw' ? 0.5 : 0;
      const statsA = this._getStats(providerA, modelA);
      const statsB = this._getStats(providerB, modelB);

      const { newA, newB, deltaA, deltaB } = this._elo.update(
        statsA.rating, statsB.rating, scoreA, statsA.matches, statsB.matches
      );

      statsA.rating = newA;
      statsB.rating = newB;
      statsA.recordMatch(scoreA, a.latencyMs, a.cost, task.type);
      statsB.recordMatch(1 - scoreA, b.latencyMs, b.cost, task.type);

      record.ratingDelta = { A: deltaA, B: deltaB };

      this.emit('matchComplete', { matchId: record.id, winner: record.winner, reason: record.reason, ratingDelta: record.ratingDelta });
    } catch (err) {
      record.error    = err.message;
      record.completed = false;
      this.emit('matchError', { matchId: record.id, error: err.message });
    }

    return record;
  }

  async _callTimed(provider, task, opts) {
    const t0 = Date.now();
    const result = await provider.generate(task.messages, {
      ...opts,
      ...(task.system ? { system: task.system } : {}),
    });
    const latencyMs = Date.now() - t0;
    const cost      = 0;  // Could integrate budget tracker here
    return { ...result, latencyMs, cost };
  }

  // ─── Round robin ──────────────────────────────────────────────────────

  /**
   * Run a round-robin tournament: every model vs every other model on every task.
   * @param {string[]} providerNames  subset of providers to include
   * @param {BenchmarkTask[]} [tasks] override default benchmarks
   * @returns {Promise<MatchRecord[]>}
   */
  async runTournament(providerNames, tasks) {
    const benchmarks = tasks ?? this._benchmarks;
    const pairs      = [];

    // Generate all pairs
    for (let i = 0; i < providerNames.length; i++) {
      for (let j = i + 1; j < providerNames.length; j++) {
        for (const task of benchmarks) {
          pairs.push({ a: providerNames[i], b: providerNames[j], task });
        }
      }
    }

    this._running = true;
    this.emit('tournamentStart', { pairs: pairs.length, providers: providerNames });

    const allMatches = [];

    // Process in batches of maxConcurrent
    for (let i = 0; i < pairs.length; i += this._maxConcurrent) {
      if (!this._running) break;
      const batch = pairs.slice(i, i + this._maxConcurrent);
      const results = await Promise.allSettled(
        batch.map(p => this.runMatch(p.task, p.a, p.b))
      );
      allMatches.push(...results.filter(r => r.status === 'fulfilled').map(r => r.value));
    }

    this._running = false;
    this.emit('tournamentComplete', {
      totalMatches: allMatches.length,
      leaderboard:  this.leaderboard(),
    });

    return allMatches;
  }

  stop() { this._running = false; }

  // ─── Leaderboards ─────────────────────────────────────────────────────

  /**
   * Global Elo leaderboard.
   */
  leaderboard() {
    return [...this._models.values()]
      .map(m => ({
        ...m.toJSON(),
        significance: significanceTest(m.wins, m.matches),
        wilson:       wilsonScore(m.wins, m.matches),
      }))
      .sort((a, b) => b.rating - a.rating);
  }

  /**
   * Task-specific leaderboard.
   * @param {string} taskType
   */
  leaderboardByTask(taskType) {
    return [...this._models.values()]
      .filter(m => m.scoresByTask.has(taskType))
      .map(m => {
        const ts = m.scoresByTask.get(taskType);
        return {
          model:    m.name,
          provider: m.provider,
          rating:   m.rating,
          ...ts,
          winRate:  (ts.wins + ts.losses + ts.draws) > 0
            ? ts.wins / (ts.wins + ts.losses + ts.draws)
            : 0,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  }

  /** Recent matches (last n) */
  recentMatches(n = 21) {
    return this._matches.slice(-n).map(m => m.toJSON());
  }

  addBenchmark(task) {
    this._benchmarks.push(task);
    return this;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _arena = null;

export function getArena(opts = {}) {
  if (!_arena) _arena = new ArenaMode(opts);
  return _arena;
}

export { EloSystem as Elo };
export default ArenaMode;
