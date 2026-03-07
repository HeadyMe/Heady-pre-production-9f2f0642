/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══════════════════════════════════════════════════════════════════
 * BuddyCore V2 — Enhanced Companion with Full Memory & Learning Loop
 * ═══════════════════════════════════════════════════════════════════
 *
 * CHANGES FROM V1 (buddy-core.js):
 *   [FIXED]  Watchdog restart now persists episodic memory to vector store
 *            BEFORE clearing volatile state — no more knowledge loss on restart
 *   [NEW]    EpisodicMemoryManager — sliding context window with vector-backed
 *            long-term storage. Survives watchdog restarts.
 *   [NEW]    EmotionalStateEngine — valence/arousal model, persisted across restarts
 *            Buddy's affect degrades gracefully under load, not just error counts
 *   [NEW]    ContextWindowManager — token-budget-aware context injection
 *            Prevents LLM context overflow from metacognition strings
 *   [NEW]    LearningLoopBridge — reads `learned_knowledge` entries from vector
 *            memory and injects them into relevant decisions (closes the loop
 *            between continuous-learning.js and BuddyCore decisions)
 *   [FIXED]  DeterministicErrorInterceptor Phase 3 now works because
 *            VectorMemoryV2 exposes queryMemory()
 *   [IMPROVED] Quality gate in LearningLoop uses semantic scoring, not just length
 *   [IMPROVED] Metacognition confidence uses exponential decay on old errors
 *   [IMPROVED] Decision log persisted to vector memory on every N decisions
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// ─── Constants ───────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const BUDDY_VERSION = '2.0.0';
const AUDIT_DIR = path.join(__dirname, '..', '..', 'data');
const BUDDY_STATE_PATH = path.join(AUDIT_DIR, 'buddy-state-v2.json');
const BUDDY_AUDIT_PATH = path.join(AUDIT_DIR, 'buddy-audit-v2.jsonl');
const MAX_DECISION_LOG = 200;
const DECISION_PERSIST_EVERY_N = 20; // Persist decisions to vector memory every 20
const MAX_CONTEXT_TOKENS = 800;      // Token budget for metacognition injection
const VALENCE_DECAY_RATE = 0.02;     // Per-decision valence recovery rate
const AROUSAL_SPIKE_PER_ERROR = 0.15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeOp(label, fn) {
  try { return fn(); } catch (err) {
    // Non-fatal — just log
    try { process.stderr.write(`[BuddyCore:safeOp:${label}] ${err.message}\n`); } catch { }
    return null;
  }
}

function clampMidiValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(127, Math.round(n))) : fallback;
}

function clampMidiChannel(channel) {
  const n = Number(channel);
  return Number.isFinite(n) ? Math.max(0, Math.min(15, Math.floor(n))) : 0;
}

// ─── Buddy Identity ───────────────────────────────────────────────────────────

function generateBuddyId() {
  const seed = `buddy-v2-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24),
    fingerprint: crypto.createHash('sha256').update(seed + '-fp').digest('hex').slice(0, 12),
    createdAt: new Date().toISOString(),
    version: BUDDY_VERSION,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EMOTIONAL STATE ENGINE — Valence/Arousal model
// NEW in V2: Buddy has an affect model that persists across restarts.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Two-dimensional emotional state model:
 *   - Valence:  -1.0 (negative) to 1.0 (positive)
 *   - Arousal:  0.0 (calm) to 1.0 (activated)
 *
 * These influence the confidence modifier injected into LLM prompts.
 * The model degrades under errors (valence drops) and spikes under load
 * (arousal rises), giving the LLM a richer self-description.
 */
class EmotionalStateEngine {
  constructor(opts = {}) {
    this.valence = opts.initialValence ?? 0.7;   // Start moderately positive
    this.arousal = opts.initialArousal ?? 0.3;   // Start relatively calm
    this._decisionsSinceLastUpdate = 0;
    this._history = [];
    this.MAX_HISTORY = 100;
  }

  /**
   * Update emotional state based on a decision outcome.
   * @param {'success'|'error'|'collision'|'timeout'} outcome
   * @param {number} [latencyMs]
   */
  update(outcome, latencyMs = 0) {
    this._decisionsSinceLastUpdate++;
    const old = { valence: this.valence, arousal: this.arousal };

    switch (outcome) {
      case 'success':
        // Success: valence recovers toward 1.0, arousal settles toward 0.3
        this.valence = Math.min(1.0, this.valence + VALENCE_DECAY_RATE);
        this.arousal = Math.max(0.1, this.arousal - 0.05);
        break;
      case 'error':
        this.valence = Math.max(-1.0, this.valence - 0.08);
        this.arousal = Math.min(1.0, this.arousal + AROUSAL_SPIKE_PER_ERROR);
        break;
      case 'collision':
        // Collision is frustrating but not as bad as error
        this.valence = Math.max(-1.0, this.valence - 0.03);
        this.arousal = Math.min(1.0, this.arousal + 0.05);
        break;
      case 'timeout':
        this.valence = Math.max(-1.0, this.valence - 0.05);
        this.arousal = Math.min(1.0, this.arousal + 0.1);
        break;
    }

    // Natural regression toward baseline (valence 0.5, arousal 0.3)
    if (this._decisionsSinceLastUpdate % 5 === 0) {
      this.valence += (0.5 - this.valence) * 0.01;
      this.arousal += (0.3 - this.arousal) * 0.01;
    }

    const snapshot = {
      ts: Date.now(),
      outcome,
      latencyMs,
      valence: +this.valence.toFixed(3),
      arousal: +this.arousal.toFixed(3),
      delta: { valence: +(this.valence - old.valence).toFixed(3), arousal: +(this.arousal - old.arousal).toFixed(3) },
    };
    this._history.push(snapshot);
    if (this._history.length > this.MAX_HISTORY) this._history.shift();
  }

  /** Compute a composite confidence modifier from emotional state. */
  getConfidenceModifier() {
    // Valence: [0, 1] → [-0.2, +0.1] modifier
    const valenceMod = (this.valence - 0.5) * 0.2;
    // Arousal: [0, 1] → [-0.15, 0] modifier (high arousal hurts confidence)
    const arousalMod = -Math.max(0, this.arousal - 0.5) * 0.3;
    return valenceMod + arousalMod;
  }

  /** Text description of current emotional state for LLM injection. */
  describeState() {
    const v = this.valence, a = this.arousal;
    let desc = '';
    if (v > 0.7 && a < 0.4) desc = 'calm and confident';
    else if (v > 0.5 && a > 0.6) desc = 'energized and focused';
    else if (v < 0.3 && a > 0.7) desc = 'stressed and stretched thin';
    else if (v < 0.2) desc = 'experiencing difficulty';
    else if (a > 0.8) desc = 'under high load';
    else desc = 'operating normally';
    return `System affective state: ${desc} (valence=${v.toFixed(2)}, arousal=${a.toFixed(2)})`;
  }

  /** Serialize state for persistence. */
  toJSON() {
    return { valence: this.valence, arousal: this.arousal };
  }

  /** Restore from serialized state. */
  fromJSON(data) {
    if (data?.valence !== undefined) this.valence = data.valence;
    if (data?.arousal !== undefined) this.arousal = data.arousal;
  }

  getStats() {
    return {
      valence: +this.valence.toFixed(3),
      arousal: +this.arousal.toFixed(3),
      confidenceModifier: +this.getConfidenceModifier().toFixed(3),
      description: this.describeState(),
      recentHistory: this._history.slice(-10),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// EPISODIC MEMORY MANAGER — Long-term memory that survives restarts
// NEW in V2: Decisions and context are persisted to vector memory
// ═══════════════════════════════════════════════════════════════════════

class EpisodicMemoryManager {
  /**
   * @param {object} vectorMemory - VectorMemoryV2 instance
   */
  constructor(vectorMemory = null) {
    this._vm = vectorMemory;
    this._episodeBuffer = []; // In-memory staging buffer
    this.MAX_BUFFER = 50;
    this.EPISODE_NS = 'buddy-episodes';
  }

  setVectorMemory(vm) { this._vm = vm; }

  /**
   * Record a decision episode.
   * Stages in buffer; flushes to vector memory every DECISION_PERSIST_EVERY_N.
   *
   * @param {object} episode
   */
  async record(episode) {
    const entry = {
      ...episode,
      ts: Date.now(),
      id: `ep-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    };
    this._episodeBuffer.push(entry);

    if (this._episodeBuffer.length >= DECISION_PERSIST_EVERY_N) {
      await this._flush();
    }
  }

  /**
   * Flush staged episodes to vector memory.
   * Called on restart (before clearing state) and periodically.
   *
   * CHANGE FROM V1: This prevents knowledge loss on watchdog restart.
   */
  async _flush() {
    if (!this._vm || this._episodeBuffer.length === 0) return;

    const batch = [...this._episodeBuffer];
    this._episodeBuffer = [];

    for (const ep of batch) {
      try {
        const content = `Decision: ${ep.action} | Result: ${ep.result} | ` +
          `Confidence: ${ep.confidence?.toFixed(2) || 'N/A'} | ` +
          `Latency: ${ep.latencyMs || 0}ms | Route: ${ep.route || 'direct'}`;
        await this._vm.ingestMemory({
          content,
          metadata: { type: 'decision_episode', ...ep },
          namespace: this.EPISODE_NS,
        });
      } catch { /* non-fatal */ }
    }
  }

  /**
   * Recall recent relevant episodes for a given action.
   * @param {string} action
   * @param {number} [limit=5]
   * @returns {Promise<object[]>}
   */
  async recall(action, limit = 5) {
    if (!this._vm) return [];
    try {
      return await this._vm.queryMemory(
        `Decision for action: ${action}`,
        limit,
        { type: 'decision_episode' },
        this.EPISODE_NS
      );
    } catch { return []; }
  }

  /** Pre-restart: flush all buffered episodes to vector memory. */
  async flushBeforeRestart() {
    await this._flush();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXT WINDOW MANAGER — Token-budget-aware context injection
// NEW in V2: Prevents LLM context overflow from metacognition strings.
// ═══════════════════════════════════════════════════════════════════════

class ContextWindowManager {
  /**
   * @param {object} opts
   * @param {number} [opts.maxTokens=800]  - Token budget for injected context
   * @param {number} [opts.avgCharsPerToken=4] - Heuristic for character → token estimation
   */
  constructor(opts = {}) {
    this.maxTokens = opts.maxTokens ?? MAX_CONTEXT_TOKENS;
    this.avgCharsPerToken = opts.avgCharsPerToken ?? 4;
  }

  /** Estimate token count from a string. */
  estimateTokens(text) {
    return Math.ceil((text || '').length / this.avgCharsPerToken);
  }

  /**
   * Build a context injection string that fits within the token budget.
   * Prioritizes emotional state > error summary > recent decisions.
   *
   * CHANGE FROM V1: V1 prepended the full contextStr unconditionally.
   * This version truncates and prioritizes to stay within budget.
   *
   * @param {object} components - { emotionalState, errorSummary, recentErrors, confidence }
   * @param {object} [task] - Current task for tailoring context
   * @returns {string} Context string within token budget
   */
  buildContext(components, task = {}) {
    const parts = [];
    let budget = this.maxTokens;

    // 1. Confidence line (always included if under budget)
    const confidenceLine = `[Buddy Self-Assessment: confidence=${(components.confidence * 100).toFixed(1)}%]`;
    if (this.estimateTokens(confidenceLine) < budget) {
      parts.push(confidenceLine);
      budget -= this.estimateTokens(confidenceLine);
    }

    // 2. Emotional state (brief)
    if (components.emotionalState) {
      const eLine = components.emotionalState;
      if (this.estimateTokens(eLine) < budget) {
        parts.push(eLine);
        budget -= this.estimateTokens(eLine);
      }
    }

    // 3. Active errors (critical info — truncated)
    if (components.recentErrors?.length > 0 && budget > 50) {
      const errLine = `Active errors: ${components.recentErrors.slice(0, 3).map(e => `${e.context}(${e.count})`).join(', ')}`;
      const truncated = errLine.slice(0, Math.floor(budget * this.avgCharsPerToken));
      parts.push(truncated);
      budget -= this.estimateTokens(truncated);
    }

    return parts.length > 0 ? parts.join('\n') + '\n' : '';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LEARNING LOOP BRIDGE — Reads learned knowledge back into decisions
// NEW in V2: Closes the loop between continuous-learning.js and BuddyCore
// ═══════════════════════════════════════════════════════════════════════

class LearningLoopBridge {
  constructor(vectorMemory = null) {
    this._vm = vectorMemory;
    this._cache = new Map(); // query → cached results, TTL 5 min
    this.CACHE_TTL_MS = 5 * 60 * 1000;
  }

  setVectorMemory(vm) { this._vm = vm; }

  /**
   * Retrieve relevant learned knowledge for a given task action.
   * Results are cached for CACHE_TTL_MS to avoid repeated queries.
   *
   * @param {string} action - Task action string
   * @param {number} [limit=3]
   * @returns {Promise<string>} - Formatted knowledge snippet for injection
   */
  async getRelevantKnowledge(action, limit = 3) {
    if (!this._vm) return '';

    const cacheKey = `${action}:${limit}`;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return cached.result;
    }

    try {
      const results = await this._vm.queryMemory(
        action,
        limit,
        { type: 'learned_knowledge' }
      );

      if (results.length === 0) {
        this._cache.set(cacheKey, { result: '', ts: Date.now() });
        return '';
      }

      const formatted = '[Relevant Learned Knowledge]\n' +
        results.map((r, i) => `${i + 1}. ${(r.content || '').slice(0, 300)}`).join('\n') +
        '\n[End Knowledge]\n';

      this._cache.set(cacheKey, { result: formatted, ts: Date.now() });
      return formatted;
    } catch {
      return '';
    }
  }

  /** Invalidate the cache. */
  invalidate() { this._cache.clear(); }
}

// ═══════════════════════════════════════════════════════════════════════
// METACOGNITION ENGINE V2 — Upgraded with emotional state + episodic memory
// ═══════════════════════════════════════════════════════════════════════

class MetacognitionEngineV2 {
  constructor(emotionalState) {
    /** @type {EmotionalStateEngine} */
    this._emotion = emotionalState;
    this.decisionLog = [];
    this.MAX_LOG = MAX_DECISION_LOG;
    this._errorCounts = new Map(); // error context → { count, lastSeen, weight }
  }

  /**
   * Record an error with exponential decay weighting.
   * Recent errors matter more than old ones.
   *
   * CHANGE FROM V1: V1 used raw counts; V2 uses time-decayed weights.
   * @param {string} context
   */
  trackError(context) {
    const now = Date.now();
    const entry = this._errorCounts.get(context) || { count: 0, lastSeen: now, weight: 0 };
    const ageSec = (now - entry.lastSeen) / 1000;
    // Decay old weight over time (half-life ~60 seconds)
    const decayedWeight = entry.weight * Math.exp(-ageSec / 60);
    entry.count++;
    entry.weight = decayedWeight + 1.0; // Add 1 unit of "weight" for new error
    entry.lastSeen = now;
    this._errorCounts.set(context, entry);
  }

  /**
   * Assess current confidence with emotional state factored in.
   *
   * CHANGE FROM V1: Incorporates EmotionalStateEngine modifier.
   */
  assessConfidence() {
    let totalWeight = 0;
    const topErrors = [];
    for (const [context, entry] of this._errorCounts) {
      totalWeight += entry.weight;
      topErrors.push({ context, count: entry.count, weight: +entry.weight.toFixed(2) });
    }
    topErrors.sort((a, b) => b.weight - a.weight);

    // Base confidence degrades with weighted error sum
    let confidence = 1.0 - Math.min(0.5, totalWeight * 0.05);
    // Apply emotional state modifier
    confidence = Math.max(0.05, Math.min(1.0, confidence + this._emotion.getConfidenceModifier()));

    const contextStr = this._buildContextStr(confidence, topErrors);

    return {
      confidence,
      totalErrors: [...this._errorCounts.values()].reduce((s, e) => s + e.count, 0),
      totalContexts: this._errorCounts.size,
      topErrors: topErrors.slice(0, 5),
      contextStr,
      emotionalState: this._emotion.describeState(),
    };
  }

  /** @private */
  _buildContextStr(confidence, topErrors) {
    let s = `[Buddy Metacognition V2]\n`;
    s += `Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    s += `${this._emotion.describeState()}\n`;
    if (topErrors.length > 0) {
      s += `Active issues: ${topErrors.slice(0, 3).map(e => e.context).join(', ')}\n`;
    }
    s += `[End Metacognition]\n`;
    return s;
  }

  logDecision(decision) {
    this.decisionLog.push({ ...decision, ts: new Date().toISOString() });
    if (this.decisionLog.length > this.MAX_LOG) {
      this.decisionLog = this.decisionLog.slice(-Math.round(this.MAX_LOG * 0.75));
    }
  }

  getRecentDecisions(limit = 20) { return this.decisionLog.slice(-limit); }
}

// ═══════════════════════════════════════════════════════════════════════
// DETERMINISTIC ERROR INTERCEPTOR V2
// CHANGE FROM V1: Phase 3 now works because VectorMemoryV2 has queryMemory()
// ═══════════════════════════════════════════════════════════════════════

class DeterministicErrorInterceptorV2 {
  constructor() {
    this.interceptLog = [];
    this.MAX_LOG = 500;
    this.learnedRules = [];
    this._vectorMemory = null;
    this._loadLearnedRules();
  }

  setVectorMemory(vm) { this._vectorMemory = vm; }

  _phase1_halt(error, context = {}) {
    return {
      id: `INT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      phase: 1,
      error: { message: error.message || String(error), stack: error.stack?.split('\n').slice(0, 8) || [], name: error.name || 'UnknownError', code: error.code || null },
      context: { source: context.source || 'unknown', stage: context.stage || null, runId: context.runId || null, agentId: context.agentId || null },
      ts: new Date().toISOString(),
      halted: true,
    };
  }

  _phase2_extractState(interception) {
    const mem = process.memoryUsage();
    interception.stateSnapshot = {
      phase: 2,
      system: { nodeVersion: process.version, uptime: process.uptime(), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1), pid: process.pid },
      environment: { NODE_ENV: process.env.NODE_ENV || 'development', hasRedis: !!process.env.REDIS_URL },
      ts: new Date().toISOString(),
    };
    return interception;
  }

  async _phase3_semanticAnalysis(interception) {
    interception.phase3 = { phase: 3, matchFound: false, matchedRule: null, confidence: 0 };

    if (this._vectorMemory) {
      try {
        // FIXED FROM V1: Now calls queryMemory() which exists on VectorMemoryV2
        const query = `error: ${interception.error.message} source: ${interception.context.source}`;
        const results = await this._vectorMemory.queryMemory(query, 3, { type: 'error_resolution' });
        if (results.length > 0 && results[0].score > 0.75) {
          interception.phase3.matchFound = true;
          interception.phase3.matchedResolution = results[0];
          interception.phase3.confidence = results[0].score;
        }
      } catch { /* best-effort */ }
    }

    const errorKey = `${interception.error.name}:${interception.context.source}`;
    const matchedRule = this.learnedRules.find(r => r.errorKey === errorKey);
    if (matchedRule) {
      interception.phase3.matchFound = true;
      interception.phase3.matchedRule = matchedRule;
      interception.phase3.confidence = 1.0;
    }
    return interception;
  }

  _phase4_rootCause(interception) {
    const msg = interception.error.message.toLowerCase();
    const constraintMap = [
      [/(timeout|timed out)/i, 'TIMEOUT_EXCEEDED'],
      [/(econnrefused|enotfound|network)/i, 'CONNECTION_FAILED'],
      [/(unauthorized|forbidden|401|403)/i, 'AUTH_VIOLATION'],
      [/(not found|cannot find|enoent)/i, 'RESOURCE_MISSING'],
      [/(budget|rate limit|quota|429)/i, 'BUDGET_EXCEEDED'],
      [/(validation|invalid|schema)/i, 'VALIDATION_FAILED'],
      [/(oom|out of memory|heap)/i, 'MEMORY_EXHAUSTED'],
    ];
    const constraint = constraintMap.find(([rx]) => rx.test(msg))?.[1] || 'LOGIC_DIVERGENCE';
    const stack = interception.error.stack || [];
    const callerLine = (Array.isArray(stack) ? stack[1] : stack?.split('\n')[1]) || '';
    const moduleMatch = callerLine.match(/at\s+(?:(\S+)\s+)?\(?([^:)]+):(\d+)/);
    interception.rootCause = {
      phase: 4,
      errorClass: interception.error.name,
      errorKey: `${interception.error.name}:${interception.context.source}`,
      failedModule: moduleMatch ? path.basename(moduleMatch[2]) : 'unknown',
      failedFunction: moduleMatch?.[1] || 'anonymous',
      constraintViolation: constraint,
    };
    return interception;
  }

  async _phase5_synthesizeRule(interception, resolution = null) {
    const rule = {
      id: `LR-AUTO-${Date.now()}`,
      errorKey: interception.rootCause.errorKey,
      constraintViolation: interception.rootCause.constraintViolation,
      failedModule: interception.rootCause.failedModule,
      errorMessage: interception.error.message,
      resolution: resolution || 'Auto-detected; monitoring for recurrence',
      synthesizedAt: new Date().toISOString(),
      occurrences: 1,
    };

    const existing = this.learnedRules.find(r => r.errorKey === rule.errorKey);
    if (existing) { existing.occurrences++; existing.lastSeen = rule.synthesizedAt; }
    else { this.learnedRules.push(rule); }

    if (this._vectorMemory) {
      try {
        await this._vectorMemory.ingestMemory({
          content: `Error resolution: ${rule.errorMessage} → ${rule.resolution}. Constraint: ${rule.constraintViolation}. Module: ${rule.failedModule}.`,
          metadata: { type: 'error_resolution', ruleId: rule.id, errorKey: rule.errorKey, constraintViolation: rule.constraintViolation },
        });
      } catch { /* non-fatal */ }
    }

    this._persistLearnedRules();
    interception.synthesizedRule = existing || rule;
    interception.phase = 5;
    interception.completed = true;
    return interception;
  }

  async intercept(error, context = {}, resolution = null) {
    let i = this._phase1_halt(error, context);
    i = this._phase2_extractState(i);
    i = await this._phase3_semanticAnalysis(i);
    i = this._phase4_rootCause(i);
    i = await this._phase5_synthesizeRule(i, resolution);
    this.interceptLog.push({ id: i.id, errorKey: i.rootCause.errorKey, constraintViolation: i.rootCause.constraintViolation, matchFound: i.phase3.matchFound, ts: i.ts });
    if (this.interceptLog.length > this.MAX_LOG) this.interceptLog = this.interceptLog.slice(-Math.round(this.MAX_LOG * 0.75));
    return i;
  }

  checkPreemptive(errorKey) { return this.learnedRules.find(r => r.errorKey === errorKey) || null; }

  getStats() {
    return { totalInterceptions: this.interceptLog.length, learnedRules: this.learnedRules.length, recentInterceptions: this.interceptLog.slice(-10) };
  }

  _loadLearnedRules() {
    safeOp('load-rules', () => {
      const rulesPath = path.join(__dirname, '..', '..', 'data', 'buddy-learned-rules-v2.json');
      if (fs.existsSync(rulesPath)) this.learnedRules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    });
  }

  _persistLearnedRules() {
    safeOp('persist-rules', () => {
      const rulesPath = path.join(__dirname, '..', '..', 'data', 'buddy-learned-rules-v2.json');
      fs.writeFileSync(rulesPath, JSON.stringify(this.learnedRules, null, 2));
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TASK LOCK MANAGER (unchanged from V1, moved here for completeness)
// ═══════════════════════════════════════════════════════════════════════

class TaskLockManager {
  constructor() {
    this._locks = new Map();
    this._redisClient = null;
    this.stats = { acquired: 0, released: 0, collisions: 0, expired: 0 };
  }

  setRedisClient(client) { this._redisClient = client; }

  async acquire(agentId, taskId, ttlMs = 30000) {
    const key = `task:status:${taskId}`;
    const val = JSON.stringify({ agentId, status: 'IN_PROGRESS', lockedAt: Date.now(), expiresAt: Date.now() + ttlMs });
    if (this._redisClient) {
      try {
        const result = await this._redisClient.set(key, val, 'NX', 'PX', ttlMs);
        if (result === 'OK') { this.stats.acquired++; return true; }
        this.stats.collisions++; return false;
      } catch { /* fall through */ }
    }
    const existing = this._locks.get(key);
    if (existing && existing.expiresAt > Date.now()) { this.stats.collisions++; return false; }
    this._locks.set(key, { agentId, expiresAt: Date.now() + ttlMs });
    this.stats.acquired++;
    setTimeout(() => { if (this._locks.get(key)?.agentId === agentId) { this._locks.delete(key); this.stats.expired++; } }, ttlMs);
    return true;
  }

  async release(agentId, taskId) {
    const key = `task:status:${taskId}`;
    if (this._redisClient) {
      try {
        const cur = await this._redisClient.get(key);
        if (cur && JSON.parse(cur).agentId === agentId) { await this._redisClient.del(key); this.stats.released++; return true; }
        return false;
      } catch { /* fall through */ }
    }
    const existing = this._locks.get(key);
    if (existing?.agentId === agentId) { this._locks.delete(key); this.stats.released++; return true; }
    return false;
  }

  getActiveLocks() {
    const now = Date.now();
    return [...this._locks.entries()].filter(([, v]) => v.expiresAt > now).map(([k, v]) => ({ key: k, ...v, remainingMs: v.expiresAt - now }));
  }

  getStats() { return { ...this.stats, activeLocks: this._locks.size }; }
}

// ═══════════════════════════════════════════════════════════════════════
// MCP TOOL REGISTRY (same as V1 with cleaner error handling)
// ═══════════════════════════════════════════════════════════════════════

class MCPToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerBuiltinTools();
  }

  _registerBuiltinTools() {
    this.register('memory_search', {
      description: 'Search vector memory for semantically relevant context',
      category: 'memory',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 5 }, filter: { type: 'object' } } },
      handler: async (input) => {
        try {
          const vm = require('../vector-memory'); // or VectorMemoryV2 singleton
          const results = vm.queryMemory ? await vm.queryMemory(input.query, input.limit || 5, input.filter) : [];
          return { ok: true, results, count: results.length };
        } catch (err) { return { ok: false, error: err.message }; }
      },
    });
    this.register('system_health', {
      description: 'Get system health',
      category: 'ops',
      inputSchema: {},
      handler: async () => ({ ok: true, uptime: process.uptime(), memory: process.memoryUsage(), ts: new Date().toISOString() }),
    });
  }

  register(name, tool) {
    this.tools.set(name, { name, description: tool.description, category: tool.category || 'general', inputSchema: tool.inputSchema || {}, handler: tool.handler, registeredAt: new Date().toISOString() });
  }

  async invoke(name, input = {}) {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown MCP tool: ${name}` };
    try { return await tool.handler(input); }
    catch (err) { return { ok: false, error: err.message }; }
  }

  listTools() { return [...this.tools.values()].map(({ name, description, category, inputSchema }) => ({ name, description, category, inputSchema })); }
}

// ═══════════════════════════════════════════════════════════════════════
// BUDDY CORE V2 — The Sovereign Orchestrator
// ═══════════════════════════════════════════════════════════════════════

class BuddyCoreV2 extends EventEmitter {
  /**
   * @param {object} opts
   */
  constructor(opts = {}) {
    super();

    // Cryptographic identity
    this.identity = generateBuddyId();
    this.version = BUDDY_VERSION;

    // NEW: Emotional state engine
    this.emotionalState = new EmotionalStateEngine();

    // Metacognition with emotional integration
    this.metacognition = new MetacognitionEngineV2(this.emotionalState);

    // NEW: Episodic memory
    this.episodicMemory = new EpisodicMemoryManager();

    // NEW: Context window manager
    this.contextWindow = new ContextWindowManager();

    // NEW: Learning loop bridge
    this.learningBridge = new LearningLoopBridge();

    // Core subsystems
    this.taskLocks = new TaskLockManager();
    this.mcpTools = new MCPToolRegistry();
    this.errorInterceptor = new DeterministicErrorInterceptorV2();

    // Wiring placeholders
    this._conductor = null;
    this._pipeline = null;
    this._realtimeEngine = null;

    // State
    this.started = Date.now();
    this.decisionCount = 0;
    this.status = 'initializing';

    // Persist state periodically
    this._persistInterval = setInterval(() => this._persistState(), 60_000).unref();

    // Ensure data dir
    safeOp('init-dir', () => { if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true }); });

    // Restore emotional state from disk
    this._loadState();

    this.status = 'active';
  }

  // ─── Wiring ────────────────────────────────────────────────────────────────

  setConductor(conductor) { this._conductor = conductor; }
  setPipeline(pipeline) { this._pipeline = pipeline; }
  setRealtimeEngine(engine) { this._realtimeEngine = engine; }

  /**
   * Wire vector memory — connects all subsystems that need it.
   * CHANGE FROM V1: Now wires episodicMemory and learningBridge as well.
   */
  setVectorMemory(vm) {
    this.errorInterceptor.setVectorMemory(vm);
    this.episodicMemory.setVectorMemory(vm);
    this.learningBridge.setVectorMemory(vm);
  }

  setRedis(redisClient) { this.taskLocks.setRedisClient(redisClient); }

  // ─── Core Decision Engine ──────────────────────────────────────────────────

  /**
   * Make a decision with full metacognitive awareness.
   *
   * CHANGE FROM V1:
   *   - Now updates emotional state on every outcome
   *   - Records episode to EpisodicMemoryManager
   *   - Injects learned knowledge into high-stakes decisions
   *   - Uses ContextWindowManager to avoid token overflow
   *
   * @param {object} task - { action, payload, agentId, priority }
   * @returns {Promise<object>}
   */
  async decide(task) {
    if (!task?.action) return { ok: false, error: 'task.action is required', buddyId: this.identity.id };

    const start = Date.now();
    this.decisionCount++;

    const meta = this.metacognition.assessConfidence();

    // Emit low-confidence event for external monitoring
    if (meta.confidence < 0.5) {
      this.emit('low-confidence', { task, confidence: meta.confidence });
    }

    const agentId = task.agentId || this.identity.id;
    const taskId = task.taskId || `${task.action}-${Date.now()}`;
    const lockAcquired = await this.taskLocks.acquire(agentId, taskId);

    if (!lockAcquired) {
      this.emotionalState.update('collision');
      const collision = { ok: false, error: 'Task collision', taskId, agentId };
      await this.episodicMemory.record({ action: task.action, result: 'collision', taskId });
      this._audit('collision', collision);
      return collision;
    }

    try {
      // Route through conductor if available
      let routeDecision = null;
      if (this._conductor) {
        routeDecision = await this._conductor.route(task, task.requestIp || '');
      }

      // NEW: Inject relevant learned knowledge for high-stakes decisions
      let knowledgeContext = '';
      if (meta.confidence < 0.9 || task.priority === 'critical') {
        knowledgeContext = await this.learningBridge.getRelevantKnowledge(task.action);
      }

      // NEW: Token-budget-aware context injection
      const contextStr = this.contextWindow.buildContext({
        confidence: meta.confidence,
        emotionalState: this.emotionalState.describeState(),
        recentErrors: meta.topErrors,
      }, task);

      // Inject into payload (within token budget)
      if (contextStr && task.payload) {
        const injection = knowledgeContext + contextStr;
        if (task.payload.message) task.payload.message = injection + task.payload.message;
        else if (task.payload.content) task.payload.content = injection + task.payload.content;
      }

      // Realtime orchestration
      let liveResult = null;
      if ((task.live || task.realtime) && this._realtimeEngine) {
        liveResult = await this.orchestrateLive({ ...task });
      }

      const decision = {
        ok: true,
        buddyId: this.identity.id,
        decisionNumber: this.decisionCount,
        task: task.action,
        route: routeDecision,
        live: liveResult,
        metacognition: { confidence: meta.confidence, emotionalState: this.emotionalState.getStats() },
        latencyMs: Date.now() - start,
        ts: new Date().toISOString(),
      };

      // Update emotional state — success
      this.emotionalState.update('success', decision.latencyMs);

      this.metacognition.logDecision({
        action: task.action, result: 'routed', taskId, confidence: meta.confidence,
        route: routeDecision?.serviceGroup, latencyMs: decision.latencyMs,
      });

      // Record episode
      await this.episodicMemory.record({
        action: task.action, result: 'routed', taskId, confidence: meta.confidence, latencyMs: decision.latencyMs,
      });

      this._audit('decision', decision);
      this.emit('decision', decision);
      return decision;

    } catch (err) {
      this.emotionalState.update('error');
      this.metacognition.logDecision({ action: task.action, result: 'error', error: err.message });
      await this.episodicMemory.record({ action: task.action, result: 'error', error: err.message });
      await this.errorInterceptor.intercept(err, { source: 'buddy:decide', agentId, stage: task.action });
      return { ok: false, error: err.message, buddyId: this.identity.id };

    } finally {
      await this.taskLocks.release(agentId, taskId);
    }
  }

  async orchestrateLive(task = {}) {
    if (!this._realtimeEngine) return { ok: false, error: 'Realtime engine not wired' };
    const payload = {
      source: task.source || 'buddy-live',
      eventType: task.action || 'live-orchestration',
      channel: clampMidiChannel(task.channel ?? 0),
      data1: clampMidiValue(task.data1 ?? task.note ?? 64, 64),
      data2: clampMidiValue(task.data2 ?? task.velocity ?? 127, 127),
      metadata: { ...(task.metadata || {}), orchestrator: 'buddy-core-v2' },
    };
    const ingested = await Promise.resolve(this._realtimeEngine.ingestExternalEvent?.(payload, { highPriority: true }) ?? { ok: false });
    const flushed = await Promise.resolve(this._realtimeEngine.flush?.() ?? { ok: false });
    return { ok: !!(ingested?.ok && flushed?.ok), ingested, flushed, ts: new Date().toISOString() };
  }

  // ─── MCP Interface ────────────────────────────────────────────────────────

  async handleMCPCall(toolName, input) { return this.mcpTools.invoke(toolName, input); }
  listMCPTools() { return this.mcpTools.listTools(); }
  registerMCPTool(name, tool) { this.mcpTools.register(name, tool); }

  // ─── Status ───────────────────────────────────────────────────────────────

  getStatus() {
    const meta = this.metacognition.assessConfidence();
    return {
      ok: true,
      identity: this.identity,
      version: this.version,
      uptime: Date.now() - this.started,
      decisionCount: this.decisionCount,
      metacognition: { confidence: meta.confidence, totalErrors: meta.totalErrors },
      emotionalState: this.emotionalState.getStats(),
      taskLocks: this.taskLocks.getStats(),
      errorInterceptor: this.errorInterceptor.getStats(),
      mcpToolCount: this.mcpTools.tools.size,
      conductorWired: !!this._conductor,
      pipelineWired: !!this._pipeline,
      realtimeWired: !!this._realtimeEngine,
    };
  }

  // ─── Express Routes ───────────────────────────────────────────────────────

  registerRoutes(app) {
    app.get('/api/buddy/status', (req, res) => res.json(this.getStatus()));
    app.get('/api/buddy/health', (req, res) => {
      const meta = this.metacognition.assessConfidence();
      res.json({ ok: meta.confidence > 0.3, confidence: meta.confidence, uptime: Date.now() - this.started, decisions: this.decisionCount });
    });
    app.get('/api/buddy/identity', (req, res) => res.json({ ok: true, identity: this.identity }));
    app.post('/api/buddy/decide', async (req, res) => {
      try { res.json(await this.decide(req.body)); }
      catch (err) { res.status(500).json({ ok: false, error: err.message }); }
    });
    app.get('/api/buddy/emotional-state', (req, res) => res.json({ ok: true, ...this.emotionalState.getStats() }));
    app.get('/api/buddy/locks', (req, res) => res.json({ ok: true, active: this.taskLocks.getActiveLocks(), stats: this.taskLocks.getStats() }));
    app.get('/api/buddy/mcp-tools', (req, res) => res.json({ ok: true, tools: this.mcpTools.listTools() }));
    app.post('/api/buddy/mcp-invoke', async (req, res) => {
      const { tool, input } = req.body;
      if (!tool) return res.status(400).json({ error: 'tool name required' });
      res.json(await this.handleMCPCall(tool, input || {}));
    });
    app.get('/api/buddy/metacognition', (req, res) => {
      const meta = this.metacognition.assessConfidence();
      res.json({ ok: true, ...meta, recentDecisions: this.metacognition.getRecentDecisions(20) });
    });
    app.get('/api/buddy/interceptor', (req, res) => res.json({ ok: true, ...this.errorInterceptor.getStats() }));
    app.get('/api/buddy/learned-rules', (req, res) => res.json({ ok: true, rules: this.errorInterceptor.learnedRules }));
    app.post('/api/buddy/live/orchestrate', async (req, res) => {
      try {
        const result = await this.orchestrateLive(req.body || {});
        if (!result.ok) return res.status(503).json(result);
        res.json(result);
      } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
    });
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /** Persist emotional state and identity to disk. */
  _persistState() {
    safeOp('persist-state', () => {
      const state = { identity: this.identity, emotionalState: this.emotionalState.toJSON(), decisionCount: this.decisionCount, ts: new Date().toISOString() };
      fs.writeFileSync(BUDDY_STATE_PATH, JSON.stringify(state, null, 2));
    });
  }

  /** Restore emotional state from disk. */
  _loadState() {
    safeOp('load-state', () => {
      if (fs.existsSync(BUDDY_STATE_PATH)) {
        const state = JSON.parse(fs.readFileSync(BUDDY_STATE_PATH, 'utf-8'));
        if (state.emotionalState) this.emotionalState.fromJSON(state.emotionalState);
      }
    });
  }

  _audit(type, data) {
    safeOp('audit', () => {
      const entry = JSON.stringify({ type, ...data, ts: data.ts || new Date().toISOString() });
      fs.appendFileSync(BUDDY_AUDIT_PATH, entry + '\n');
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _buddy = null;
function getBuddy(opts = {}) {
  if (!_buddy) _buddy = new BuddyCoreV2(opts);
  return _buddy;
}

module.exports = {
  BuddyCoreV2,
  BuddyCore: BuddyCoreV2, // alias for drop-in replacement
  getBuddy,
  EmotionalStateEngine,
  EpisodicMemoryManager,
  ContextWindowManager,
  LearningLoopBridge,
  MetacognitionEngineV2,
  DeterministicErrorInterceptorV2,
  TaskLockManager,
  MCPToolRegistry,
};
