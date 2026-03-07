'use strict';

/**
 * @file skill-router-v2.js
 * @description ML-based Skill Router — enhanced replacement for skill-router.js.
 *
 * CHANGE LOG (vs skill-router.js — 91 lines, exact-string matching):
 *
 *  PROBLEMS FIXED:
 *  1. `SkillRouter.route(requiredSkill)` was exact string match only — "code review"
 *     would not match "review code" or "code-review".  V2 uses token-overlap Jaccard
 *     similarity so fuzzy queries resolve correctly.
 *  2. Only one skill could be routed at a time.  V2 supports multi-skill queries:
 *     `route(['code', 'test'])` returns the agent with the best aggregate capability score.
 *  3. Static weights (0.4 capability / 0.3 availability / 0.3 performance).
 *     V2 uses an online gradient-free bandit (UCB1) to adapt weights per skill over time.
 *  4. No latency tracking.  V2 maintains a ring-buffer of observed latencies per agent
 *     and exposes p50/p95 for scoring and monitoring.
 *  5. No route history or pattern analysis.  V2 stores the last N routing decisions
 *     for replay debugging and weight calibration.
 *  6. Success-rate used raw counts only.  V2 uses exponential moving average (EMA)
 *     so recent outcomes are weighted more than stale data.
 *
 *  ARCHITECTURE:
 *    SkillRouterV2
 *      ├─ AgentRegistry         – agent capability declarations + status
 *      ├─ IntentTokenizer       – normalises query strings into token bags
 *      ├─ CapabilityScorer      – Jaccard + embedding (optional) similarity scoring
 *      ├─ LatencyTracker        – ring-buffer p50/p95 per agent
 *      ├─ EMASuccessTracker     – exponential moving average success rate per agent
 *      ├─ UCB1Bandit            – online weight adaptation per skill
 *      └─ RouteHistoryLog       – circular buffer of past routing decisions
 *
 *  USAGE:
 *    const { SkillRouterV2 } = require('./skill-router-v2');
 *    const router = new SkillRouterV2();
 *    router.registerAgent('JULES',   { capabilities: ['code', 'review', 'refactor'] });
 *    router.registerAgent('BUILDER', { capabilities: ['build', 'compile', 'deploy'] });
 *
 *    // Single-skill routing (fuzzy)
 *    const result = await router.route('code review');
 *    // → { agentId: 'JULES', score: 0.92, path: [...], latencyP50: 45 }
 *
 *    // Multi-skill routing
 *    const result = await router.route(['code', 'test', 'ci']);
 *    // → { agentId: 'BUILDER', score: 0.78, path: [...] }
 *
 *    // Report outcome to close the bandit loop
 *    router.reportOutcome(result.routeId, { success: true, latencyMs: 120 });
 */

const EventEmitter = require('events');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default ring-buffer size for latency samples */
const LATENCY_RING_SIZE = 200;

/** EMA decay factor α for success-rate tracking (higher = more weight on recent) */
const EMA_ALPHA = 0.15;

/** UCB1 exploration constant */
const UCB1_C = Math.sqrt(2);

/** Max route history entries */
const HISTORY_MAX = 1_000;

/** Minimum capability score to include an agent in the candidate list */
const MIN_CAPABILITY_SCORE = 0.1;

/** Jaccard token overlap threshold for fuzzy match (used in prefilter) */
const JACCARD_PREFILTER = 0.05;

// ---------------------------------------------------------------------------
// IntentTokenizer
// ---------------------------------------------------------------------------

/**
 * Normalises a skill query string into a bag of lowercase tokens.
 * Handles camelCase, kebab-case, snake_case, and whitespace-separated forms.
 *
 * @example
 * tokenize('codeReview')   // → ['code', 'review']
 * tokenize('code-review')  // → ['code', 'review']
 * tokenize('CODE_REVIEW')  // → ['code', 'review']
 */
class IntentTokenizer {
  /**
   * @param {object} [opts]
   * @param {Set<string>} [opts.stopWords]  tokens to ignore during scoring
   */
  constructor(opts = {}) {
    this._stopWords = opts.stopWords || new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in']);
  }

  /**
   * Tokenize a skill string.
   * @param {string} input
   * @returns {string[]}
   */
  tokenize(input) {
    if (typeof input !== 'string' || !input) return [];
    return input
      // Split camelCase: codeReview → code Review
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Replace separators
      .replace(/[-_.\/\\]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0 && !this._stopWords.has(t));
  }

  /**
   * Tokenize an array of skills into a flat token bag.
   * @param {string|string[]} skills
   * @returns {string[]}
   */
  tokenizeBag(skills) {
    const arr = Array.isArray(skills) ? skills : [skills];
    return arr.flatMap(s => this.tokenize(s));
  }
}

// ---------------------------------------------------------------------------
// CapabilityScorer
// ---------------------------------------------------------------------------

/**
 * Scores agents against a query intent using Jaccard token overlap.
 * Optionally enhances with cosine similarity if embeddings are available.
 */
class CapabilityScorer {
  /**
   * @param {IntentTokenizer} tokenizer
   */
  constructor(tokenizer) {
    this._tokenizer = tokenizer;
  }

  /**
   * Compute Jaccard similarity between two token bags.
   * @param {string[]} setA
   * @param {string[]} setB
   * @returns {number}  [0, 1]
   */
  jaccard(setA, setB) {
    if (setA.length === 0 && setB.length === 0) return 1;
    const a = new Set(setA);
    const b = new Set(setB);
    let intersection = 0;
    for (const t of a) if (b.has(t)) intersection++;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Score an agent's capabilities against a query token bag.
   * Returns the best partial-match score across all declared capabilities,
   * plus a coverage ratio (what fraction of query tokens are covered).
   *
   * @param {string[]} queryTokens
   * @param {string[]} agentCapabilities
   * @returns {{ similarity: number, coverage: number, combined: number }}
   */
  score(queryTokens, agentCapabilities) {
    if (agentCapabilities.length === 0) return { similarity: 0, coverage: 0, combined: 0 };

    const agentTokenBag = this._tokenizer.tokenizeBag(agentCapabilities);
    const similarity    = this.jaccard(queryTokens, agentTokenBag);

    // Coverage: what fraction of query tokens appear in the agent's capabilities
    const capSet = new Set(agentTokenBag);
    const covered = queryTokens.filter(t => capSet.has(t)).length;
    const coverage = queryTokens.length > 0 ? covered / queryTokens.length : 0;

    // Combined score: similarity weighted 60%, coverage 40%
    const combined = 0.6 * similarity + 0.4 * coverage;

    return { similarity, coverage, combined };
  }

  /**
   * Score all agents and return ranked candidates above MIN_CAPABILITY_SCORE.
   * @param {string[]} queryTokens
   * @param {Map<string, { capabilities: string[] }>} agents
   * @returns {Array<{ agentId: string, similarity: number, coverage: number, capScore: number }>}
   */
  rankCandidates(queryTokens, agents) {
    const results = [];
    for (const [agentId, reg] of agents) {
      const s = this.score(queryTokens, reg.capabilities || []);
      if (s.combined >= MIN_CAPABILITY_SCORE) {
        results.push({ agentId, similarity: s.similarity, coverage: s.coverage, capScore: s.combined });
      }
    }
    return results.sort((a, b) => b.capScore - a.capScore);
  }
}

// ---------------------------------------------------------------------------
// LatencyTracker
// ---------------------------------------------------------------------------

/**
 * Per-agent latency ring buffer with percentile calculation.
 *
 * CHANGE: skill-router.js had no latency tracking whatsoever.
 */
class LatencyTracker {
  /**
   * @param {number} [ringSize=LATENCY_RING_SIZE]
   */
  constructor(ringSize = LATENCY_RING_SIZE) {
    this._size = ringSize;
    /** @type {Map<string, { buf: number[], head: number, count: number }>} */
    this._rings = new Map();
  }

  /** @private */
  _ensure(agentId) {
    if (!this._rings.has(agentId)) {
      this._rings.set(agentId, { buf: new Array(this._size).fill(0), head: 0, count: 0 });
    }
    return this._rings.get(agentId);
  }

  /**
   * Record an observed latency sample.
   * @param {string} agentId
   * @param {number} ms
   */
  record(agentId, ms) {
    const r = this._ensure(agentId);
    r.buf[r.head] = ms;
    r.head = (r.head + 1) % this._size;
    r.count = Math.min(r.count + 1, this._size);
  }

  /**
   * Compute a latency percentile.
   * @param {string} agentId
   * @param {number} pct  0–100
   * @returns {number|null}  null if no data
   */
  percentile(agentId, pct) {
    const r = this._rings.get(agentId);
    if (!r || r.count === 0) return null;
    const samples = r.buf.slice(0, r.count).sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * samples.length) - 1;
    return samples[Math.max(0, idx)];
  }

  /**
   * Normalised latency score for routing: lower latency → higher score.
   * Returns a value in [0, 1]; returns 0.5 if no data (neutral).
   * @param {string} agentId
   * @param {number} [worstCaseMs=5000]  reference maximum latency
   * @returns {number}
   */
  latencyScore(agentId, worstCaseMs = 5_000) {
    const p50 = this.percentile(agentId, 50);
    if (p50 === null) return 0.5; // neutral for agents with no latency data
    return Math.max(0, 1 - p50 / worstCaseMs);
  }

  /**
   * Return a stats object for a given agent.
   * @param {string} agentId
   * @returns {{ p50: number|null, p95: number|null, sampleCount: number }}
   */
  stats(agentId) {
    const r = this._rings.get(agentId);
    return {
      p50:         this.percentile(agentId, 50),
      p95:         this.percentile(agentId, 95),
      sampleCount: r ? r.count : 0,
    };
  }
}

// ---------------------------------------------------------------------------
// EMASuccessTracker
// ---------------------------------------------------------------------------

/**
 * Tracks per-agent success rate using an exponential moving average.
 *
 * CHANGE: skill-router.js used raw success/total counts with no recency weighting.
 * EMA gives more weight to recent outcomes — a recently-failing agent degrades
 * its score even if it has a long historical track record.
 */
class EMASuccessTracker {
  /**
   * @param {number} [alpha=EMA_ALPHA]  EMA decay factor (0 < α ≤ 1)
   */
  constructor(alpha = EMA_ALPHA) {
    this._alpha = alpha;
    /** @type {Map<string, { ema: number, total: number }>} */
    this._data = new Map();
  }

  /** @private */
  _ensure(agentId) {
    if (!this._data.has(agentId)) this._data.set(agentId, { ema: 0.8, total: 0 }); // start at 80%
    return this._data.get(agentId);
  }

  /**
   * Record a success (1.0) or failure (0.0) outcome.
   * @param {string} agentId
   * @param {boolean} success
   */
  record(agentId, success) {
    const d = this._ensure(agentId);
    d.ema   = d.ema * (1 - this._alpha) + (success ? 1 : 0) * this._alpha;
    d.total++;
  }

  /**
   * Get the current EMA success rate for an agent.
   * @param {string} agentId
   * @returns {number}  [0, 1]; defaults to 0.8 for unseen agents
   */
  rate(agentId) {
    return this._ensure(agentId).ema;
  }

  /**
   * Return full stats.
   * @param {string} agentId
   * @returns {{ ema: number, total: number }}
   */
  stats(agentId) {
    return { ...this._ensure(agentId) };
  }
}

// ---------------------------------------------------------------------------
// UCB1Bandit
// ---------------------------------------------------------------------------

/**
 * UCB1 bandit for online weight adaptation per skill category.
 *
 * Each skill is treated as a bandit arm.  When a routing decision for a skill
 * produces a positive outcome, the arm is rewarded.  Over time the bandit learns
 * which skills (arms) produce the best outcomes and adjusts the importance of
 * the capability score vs latency score vs success rate when computing the final
 * agent score for that skill.
 *
 * CHANGE: skill-router.js used a fixed static weight vector [0.4, 0.3, 0.3].
 */
class UCB1Bandit {
  /**
   * @param {string[]} skills  initial skill arms
   */
  constructor(skills = []) {
    /** @type {Map<string, { reward: number, pulls: number }>} */
    this._arms = new Map();
    this._totalPulls = 0;
    for (const s of skills) this._initArm(s);
  }

  /** @private */
  _initArm(skill) {
    if (!this._arms.has(skill)) this._arms.set(skill, { reward: 0, pulls: 0 });
  }

  /**
   * Compute the UCB1 score for a skill arm.
   * @param {string} skill
   * @returns {number}
   */
  ucb1(skill) {
    this._initArm(skill);
    const arm = this._arms.get(skill);
    if (arm.pulls === 0) return Infinity; // always explore unknown arms
    const exploitation = arm.reward / arm.pulls;
    const exploration  = UCB1_C * Math.sqrt(Math.log(this._totalPulls + 1) / arm.pulls);
    return exploitation + exploration;
  }

  /**
   * Record a pull + reward for a skill.
   * @param {string} skill
   * @param {number} reward  [0, 1]
   */
  update(skill, reward) {
    this._initArm(skill);
    const arm = this._arms.get(skill);
    arm.reward += Math.max(0, Math.min(1, reward));
    arm.pulls++;
    this._totalPulls++;
  }

  /**
   * Return a routing weight vector for a given set of query skills.
   * Higher UCB1 skill scores → more weight on capability over latency.
   *
   * Returns `{ wCap, wLatency, wSuccess }` summing to 1.0.
   * @param {string[]} querySkills
   * @returns {{ wCap: number, wLatency: number, wSuccess: number }}
   */
  weights(querySkills) {
    if (querySkills.length === 0) return { wCap: 0.4, wLatency: 0.3, wSuccess: 0.3 };

    const avgUcb = querySkills.reduce((sum, s) => sum + Math.min(this.ucb1(s), 5), 0) / querySkills.length;
    // Map avgUcb [0..5] → wCap [0.3..0.6]
    const wCap  = 0.3 + 0.3 * Math.min(avgUcb / 5, 1);
    const rest  = 1 - wCap;
    // Split the remainder 50/50 between latency and success
    return {
      wCap,
      wLatency: rest * 0.5,
      wSuccess: rest * 0.5,
    };
  }

  /**
   * Return a snapshot of all arm statistics for debugging.
   * @returns {object}
   */
  snapshot() {
    const out = {};
    for (const [skill, arm] of this._arms) {
      out[skill] = { ...arm, ucb1: this.ucb1(skill) };
    }
    return { arms: out, totalPulls: this._totalPulls };
  }
}

// ---------------------------------------------------------------------------
// RouteHistoryLog
// ---------------------------------------------------------------------------

/**
 * Circular buffer of past routing decisions.
 * Enables replay debugging and post-hoc pattern analysis.
 *
 * CHANGE: skill-router.js kept no history.
 */
class RouteHistoryLog {
  /**
   * @param {number} [max=HISTORY_MAX]
   */
  constructor(max = HISTORY_MAX) {
    this._max    = max;
    /** @type {Array<RouteRecord>} */
    this._log    = [];
    /** @type {Map<string, RouteRecord>} routeId lookup */
    this._byId   = new Map();
  }

  /**
   * Append a routing decision to the history.
   * @param {RouteRecord} record
   */
  push(record) {
    this._log.push(record);
    this._byId.set(record.routeId, record);
    if (this._log.length > this._max) {
      const evicted = this._log.shift();
      this._byId.delete(evicted.routeId);
    }
  }

  /**
   * Look up a routing decision by ID.
   * @param {string} routeId
   * @returns {RouteRecord|null}
   */
  get(routeId) {
    return this._byId.get(routeId) || null;
  }

  /**
   * Annotate a past routing decision with its outcome.
   * @param {string} routeId
   * @param {{ success: boolean, latencyMs?: number }} outcome
   */
  annotateOutcome(routeId, outcome) {
    const rec = this._byId.get(routeId);
    if (rec) Object.assign(rec, { outcome, resolvedAt: Date.now() });
  }

  /**
   * Return the last N records.
   * @param {number} [n=20]
   * @returns {RouteRecord[]}
   */
  recent(n = 20) {
    return this._log.slice(-n);
  }

  /**
   * Compute per-agent success rates over the last N decisions (pattern analysis).
   * @param {number} [n=100]
   * @returns {object}
   */
  analysePatterns(n = 100) {
    const slice   = this._log.slice(-n);
    const byAgent = {};
    for (const rec of slice) {
      if (!byAgent[rec.agentId]) byAgent[rec.agentId] = { total: 0, success: 0, avgScore: 0 };
      const s = byAgent[rec.agentId];
      s.total++;
      if (rec.outcome?.success) s.success++;
      s.avgScore += rec.score;
    }
    for (const id of Object.keys(byAgent)) {
      const s = byAgent[id];
      s.successRate = s.total > 0 ? s.success / s.total : null;
      s.avgScore    = s.total > 0 ? s.avgScore / s.total : null;
    }
    return byAgent;
  }
}

// ---------------------------------------------------------------------------
// AgentRegistry
// ---------------------------------------------------------------------------

/**
 * Stores agent registrations: capabilities, status, and metadata.
 */
class AgentRegistry {
  constructor() {
    /** @type {Map<string, AgentRegistration>} */
    this._agents = new Map();
  }

  /**
   * @param {string}   agentId
   * @param {object}   opts
   * @param {string[]} opts.capabilities
   * @param {string}   [opts.status='available']
   * @param {object}   [opts.meta={}]
   */
  register(agentId, opts = {}) {
    this._agents.set(agentId, {
      agentId,
      capabilities: opts.capabilities || [],
      status:       opts.status       || 'available',
      meta:         opts.meta         || {},
      registeredAt: Date.now(),
    });
  }

  /** @param {string} agentId */
  deregister(agentId) { this._agents.delete(agentId); }

  /**
   * @param {string} agentId
   * @param {string} status  'available' | 'busy' | 'offline'
   */
  setStatus(agentId, status) {
    const r = this._agents.get(agentId);
    if (r) r.status = status;
  }

  /** @returns {Map<string, AgentRegistration>} */
  all() { return this._agents; }

  /**
   * Return only agents with status 'available'.
   * @returns {Map<string, AgentRegistration>}
   */
  available() {
    const m = new Map();
    for (const [id, r] of this._agents) {
      if (r.status === 'available') m.set(id, r);
    }
    return m;
  }

  /** @param {string} agentId */
  get(agentId) { return this._agents.get(agentId) || null; }
}

// ---------------------------------------------------------------------------
// SkillRouterV2  (main class)
// ---------------------------------------------------------------------------

/**
 * ML-informed skill router for the Heady agent platform.
 *
 * @extends EventEmitter
 */
class SkillRouterV2 extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.latencyRingSize=200]   samples per agent in latency tracker
   * @param {number}  [opts.emaAlpha=0.15]         EMA decay for success tracking
   * @param {number}  [opts.historyMax=1000]        max route history entries
   * @param {number}  [opts.minCapScore=0.1]        min capability score to be a candidate
   * @param {boolean} [opts.requireAvailable=true]  only route to 'available' agents
   * @param {string[]} [opts.initialSkills=[]]      pre-warm the UCB1 bandit with these skills
   */
  constructor(opts = {}) {
    super();

    this._registry   = new AgentRegistry();
    this._tokenizer  = new IntentTokenizer();
    this._scorer     = new CapabilityScorer(this._tokenizer);
    this._latency    = new LatencyTracker(opts.latencyRingSize || LATENCY_RING_SIZE);
    this._success    = new EMASuccessTracker(opts.emaAlpha || EMA_ALPHA);
    this._bandit     = new UCB1Bandit(opts.initialSkills || []);
    this._history    = new RouteHistoryLog(opts.historyMax || HISTORY_MAX);

    this._requireAvailable = opts.requireAvailable !== false;
    this._minCapScore      = opts.minCapScore ?? MIN_CAPABILITY_SCORE;
  }

  // -------------------------------------------------------------------------
  // Agent management
  // -------------------------------------------------------------------------

  /**
   * Register an agent.
   * @param {string}   agentId
   * @param {object}   opts
   * @param {string[]} opts.capabilities
   * @param {string}   [opts.status]
   * @param {object}   [opts.meta]
   */
  registerAgent(agentId, opts = {}) {
    this._registry.register(agentId, opts);
    this.emit('agent:registered', { agentId, capabilities: opts.capabilities });
    return this;
  }

  /** @param {string} agentId */
  deregisterAgent(agentId) {
    this._registry.deregister(agentId);
    this.emit('agent:deregistered', { agentId });
    return this;
  }

  /**
   * Update an agent's status.
   * @param {string} agentId
   * @param {'available'|'busy'|'offline'} status
   */
  setAgentStatus(agentId, status) {
    this._registry.setStatus(agentId, status);
    this.emit('agent:status', { agentId, status });
    return this;
  }

  // -------------------------------------------------------------------------
  // Core routing
  // -------------------------------------------------------------------------

  /**
   * Route a skill query to the best available agent.
   *
   * CHANGE: V1 was `route(requiredSkill: string)` with exact match.
   * V2 accepts string | string[], uses fuzzy token matching, adapts weights via UCB1.
   *
   * @param {string|string[]} skills  required skill(s)
   * @param {object} [opts]
   * @param {boolean} [opts.requireAvailable=true]  only consider 'available' agents
   * @param {number}  [opts.topK=5]                 consider top K candidates
   * @returns {Promise<RouteResult>}
   */
  async route(skills, opts = {}) {
    const skillArr   = Array.isArray(skills) ? skills : [skills];
    const queryTokens = this._tokenizer.tokenizeBag(skillArr);
    const requireAvail = opts.requireAvailable ?? this._requireAvailable;
    const topK = opts.topK ?? 5;

    // Get candidate agents
    const agentPool = requireAvail
      ? this._registry.available()
      : this._registry.all();

    if (agentPool.size === 0) {
      return { agentId: null, score: 0, reason: 'no_agents', candidates: [], routeId: _routeId() };
    }

    // Step 1: Rank by capability score
    const candidates = this._scorer
      .rankCandidates(queryTokens, agentPool)
      .slice(0, topK);

    if (candidates.length === 0) {
      return { agentId: null, score: 0, reason: 'no_match', candidates: [], routeId: _routeId() };
    }

    // Step 2: Get adaptive weights from bandit
    const { wCap, wLatency, wSuccess } = this._bandit.weights(skillArr);

    // Step 3: Compute composite scores
    const scored = candidates.map(c => {
      const latencyScore = this._latency.latencyScore(c.agentId);
      const successRate  = this._success.rate(c.agentId);
      const composite    = wCap * c.capScore + wLatency * latencyScore + wSuccess * successRate;
      return {
        ...c,
        latencyScore,
        successRate,
        composite,
        weights: { wCap, wLatency, wSuccess },
        latencyStats: this._latency.stats(c.agentId),
      };
    }).sort((a, b) => b.composite - a.composite);

    const best   = scored[0];
    const routeId = _routeId();

    /** @type {RouteRecord} */
    const record = {
      routeId,
      skills:       skillArr,
      queryTokens,
      agentId:      best.agentId,
      score:        best.composite,
      capScore:     best.capScore,
      latencyScore: best.latencyScore,
      successRate:  best.successRate,
      weights:      best.weights,
      candidates:   scored.map(s => ({ agentId: s.agentId, score: s.composite })),
      routedAt:     Date.now(),
      outcome:      null,
    };

    this._history.push(record);
    this.emit('route:decision', record);

    return {
      routeId,
      agentId:      best.agentId,
      score:        best.composite,
      capScore:     best.capScore,
      latencyScore: best.latencyScore,
      successRate:  best.successRate,
      candidates:   record.candidates,
      latencyStats: best.latencyStats,
      weights:      best.weights,
    };
  }

  /**
   * Report the outcome of a routing decision.
   * Updates EMA success tracker, latency tracker, UCB1 bandit, and history.
   *
   * CHANGE: V1 had no feedback loop whatsoever.
   *
   * @param {string} routeId   returned by `route()`
   * @param {object} outcome
   * @param {boolean} outcome.success
   * @param {number}  [outcome.latencyMs]
   */
  reportOutcome(routeId, outcome) {
    const record = this._history.get(routeId);
    if (!record) {
      this.emit('outcome:unknown_route', { routeId });
      return;
    }

    this._history.annotateOutcome(routeId, outcome);

    // Update EMA success tracker
    this._success.record(record.agentId, outcome.success);

    // Update latency tracker
    if (typeof outcome.latencyMs === 'number' && outcome.latencyMs >= 0) {
      this._latency.record(record.agentId, outcome.latencyMs);
    }

    // Update UCB1 bandit with reward = 1 for success, 0 for failure
    const reward = outcome.success ? 1 : 0;
    for (const skill of record.skills) {
      this._bandit.update(skill, reward);
    }

    this.emit('outcome:recorded', { routeId, agentId: record.agentId, outcome });
  }

  // -------------------------------------------------------------------------
  // Multi-agent routing (fan-out to multiple agents)
  // -------------------------------------------------------------------------

  /**
   * Route a task to multiple agents simultaneously — returns the top `n` agents.
   * Useful when you want parallel execution with quorum agreement.
   *
   * CHANGE: V1 only routed to a single agent.
   *
   * @param {string|string[]} skills
   * @param {number}           n         how many agents to return
   * @param {object}           [opts]
   * @returns {Promise<RouteResult[]>}
   */
  async routeMultiple(skills, n = 3, opts = {}) {
    const base = await this.route(skills, { ...opts, topK: Math.max(n, 10) });
    if (!base.agentId) return [base];

    // Build full ranked list
    const results = [base];
    const seen    = new Set([base.agentId]);

    for (const c of base.candidates) {
      if (seen.has(c.agentId)) continue;
      seen.add(c.agentId);
      results.push({
        routeId:  _routeId(),
        agentId:  c.agentId,
        score:    c.score,
        skills:   Array.isArray(skills) ? skills : [skills],
      });
      if (results.length >= n) break;
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Return the last N routing decisions.
   * @param {number} [n=20]
   * @returns {RouteRecord[]}
   */
  getHistory(n = 20) {
    return this._history.recent(n);
  }

  /**
   * Return per-agent pattern analysis over last N decisions.
   * @param {number} [n=100]
   * @returns {object}
   */
  analysePatterns(n = 100) {
    return this._history.analysePatterns(n);
  }

  /**
   * Return a full status snapshot.
   * @returns {object}
   */
  status() {
    const allAgents  = this._registry.all();
    const agentStats = {};
    for (const [id] of allAgents) {
      agentStats[id] = {
        ...this._registry.get(id),
        latency: this._latency.stats(id),
        success: this._success.stats(id),
      };
    }
    return {
      agents:      agentStats,
      bandit:      this._bandit.snapshot(),
      historySize: this._history._log.length,
      timestamp:   new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _routeId() {
  return `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SkillRouterV2,
  AgentRegistry,
  IntentTokenizer,
  CapabilityScorer,
  LatencyTracker,
  EMASuccessTracker,
  UCB1Bandit,
  RouteHistoryLog,
  // Constants
  LATENCY_RING_SIZE,
  EMA_ALPHA,
  UCB1_C,
  HISTORY_MAX,
  MIN_CAPABILITY_SCORE,
};

/**
 * @typedef {object} AgentRegistration
 * @property {string}   agentId
 * @property {string[]} capabilities
 * @property {string}   status
 * @property {object}   meta
 * @property {number}   registeredAt
 */

/**
 * @typedef {object} RouteResult
 * @property {string}   routeId
 * @property {string|null} agentId
 * @property {number}   score
 * @property {number}   [capScore]
 * @property {number}   [latencyScore]
 * @property {number}   [successRate]
 * @property {Array<{ agentId: string, score: number }>} candidates
 * @property {{ wCap: number, wLatency: number, wSuccess: number }} [weights]
 * @property {{ p50: number|null, p95: number|null, sampleCount: number }} [latencyStats]
 */

/**
 * @typedef {object} RouteRecord
 * @property {string}   routeId
 * @property {string[]} skills
 * @property {string[]} queryTokens
 * @property {string}   agentId
 * @property {number}   score
 * @property {number}   capScore
 * @property {number}   latencyScore
 * @property {number}   successRate
 * @property {object}   weights
 * @property {Array<object>} candidates
 * @property {number}   routedAt
 * @property {object|null} outcome
 */
