/**
 * @file self-awareness.js
 * @description Heady System Self-Monitoring — HeadyAutobiographer.
 *
 * Features:
 * - Continuous embedding of system state as 384-dimensional vectors
 * - Drift detection: cosine similarity < 0.75 triggers alert
 * - Coherence scoring: measures how "on-brand" current state is
 * - Self-optimization recommendations based on historical patterns
 * - Narrative logging: HeadyAutobiographer writes temporal event stories
 *
 * Sacred Geometry: 384-D embeddings, PHI-based similarity thresholds.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Orchestration/SelfAwareness
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/** Drift alert threshold — cosine similarity below this triggers a drift event */
const DRIFT_THRESHOLD = 0.75;

/** Coherence score below this is considered degraded */
const COHERENCE_DEGRADED = 1 / PHI;   // ≈ 0.618

/** Coherence score below this is critical */
const COHERENCE_CRITICAL = 1 / (PHI * PHI); // ≈ 0.382

// ─── Embedding Utilities ──────────────────────────────────────────────────────

/**
 * Generate a deterministic 384-dimensional "embedding" of a system state object.
 *
 * In production, this would call an embedding model (e.g., all-MiniLM-L6-v2).
 * Here we use a deterministic hash-based approximation that:
 * - Produces consistent results for the same input
 * - Responds to changes in the input
 * - Spans [-1, 1] per dimension
 *
 * @param {*} state - any serializable state object
 * @returns {Float32Array} 384-dimensional unit vector
 */
export function embedState(state) {
  const text = typeof state === 'string' ? state : JSON.stringify(state);
  // Use SHA-512 (64 bytes = 512 bits) seeded by input text
  // Expand to 384 dims by repeating with different seeds
  const dims = 384;
  const result = new Float32Array(dims);

  // Generate pseudo-random floats from hash of (text + seed)
  let dimIdx = 0;
  for (let seed = 0; dimIdx < dims; seed++) {
    const hash = createHash('sha512')
      .update(`${seed}:${text}`)
      .digest();
    // Each byte → float in [-1, 1]
    for (let b = 0; b < hash.length && dimIdx < dims; b++, dimIdx++) {
      result[dimIdx] = (hash[b] / 127.5) - 1.0;
    }
  }

  // L2 normalize to unit sphere
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += result[i] * result[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) result[i] /= norm;

  return result;
}

/**
 * Cosine similarity between two Float32Arrays of the same length.
 * Returns a value in [-1, 1]; 1.0 = identical, 0 = orthogonal, -1 = opposite.
 *
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Dimension mismatch');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── State Snapshot ───────────────────────────────────────────────────────────

/**
 * @typedef {object} StateSnapshot
 * @property {string} id
 * @property {number} ts
 * @property {*} state - raw state object
 * @property {Float32Array} embedding - 384-D vector
 * @property {number} coherenceScore
 * @property {string} nodeId
 */

// ─── HeadyAutobiographer ──────────────────────────────────────────────────────

/**
 * Writes temporal narrative logs of system events.
 * Each entry is a human-readable "story beat" about the system's state.
 */
export class HeadyAutobiographer {
  /**
   * @param {object} [options]
   * @param {string} [options.logPath] - file path for narrative log
   * @param {number} [options.maxEntries=FIBONACCI[11]] - max in-memory entries (144)
   */
  constructor(options = {}) {
    this._logPath    = options.logPath ?? null;
    this._maxEntries = options.maxEntries ?? FIBONACCI[11]; // 144
    /** @type {Array<{ ts: number, chapter: number, beat: string, state: string }>} */
    this._entries    = [];
    this._chapter    = 1;
    this._startTs    = Date.now();
  }

  /**
   * Write a narrative beat (event story entry)
   * @param {string} beat - narrative description
   * @param {object} [context] - optional structured context
   * @param {'INFO'|'WARN'|'DRIFT'|'MILESTONE'} [level='INFO']
   */
  write(beat, context = {}, level = 'INFO') {
    const entry = {
      ts:      Date.now(),
      chapter: this._chapter,
      level,
      beat,
      context,
      uptime:  Math.floor((Date.now() - this._startTs) / 1000),
    };

    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) {
      // Increment chapter, trim old entries
      this._chapter++;
      this._entries = this._entries.slice(-Math.floor(this._maxEntries * (1 / PHI)));
    }

    if (this._logPath) {
      try {
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this._logPath, line, 'utf8');
      } catch (_) {}
    }
  }

  /**
   * Write a DRIFT narrative event
   * @param {number} similarity
   * @param {*} currentState
   * @param {*} baselineState
   */
  writeDrift(similarity, currentState, baselineState) {
    this.write(
      `DRIFT DETECTED: cosine similarity ${similarity.toFixed(4)} < ${DRIFT_THRESHOLD}. ` +
      `The system has strayed from its baseline. ` +
      `Chapter ${this._chapter}: a new pattern emerges.`,
      { similarity, driftThreshold: DRIFT_THRESHOLD },
      'DRIFT'
    );
  }

  /**
   * Write a MILESTONE narrative event
   * @param {string} milestone
   * @param {object} [data]
   */
  writeMilestone(milestone, data = {}) {
    this.write(
      `MILESTONE: ${milestone}. The system reaches a new equilibrium point at Chapter ${this._chapter}.`,
      data,
      'MILESTONE'
    );
  }

  /**
   * Get recent narrative entries
   * @param {number} [n=FIBONACCI[5]] most recent n entries (default 8)
   * @returns {object[]}
   */
  getRecent(n = FIBONACCI[5]) {
    return this._entries.slice(-n);
  }

  /**
   * Get all entries for current chapter
   * @returns {object[]}
   */
  getCurrentChapter() {
    return this._entries.filter((e) => e.chapter === this._chapter);
  }

  /** @returns {number} current chapter number */
  get chapter() { return this._chapter; }

  /** @returns {number} total entries */
  get entryCount() { return this._entries.length; }
}

// ─── Coherence Scorer ─────────────────────────────────────────────────────────

/**
 * Scores system coherence by comparing current state embedding against
 * a reference "golden" baseline embedding.
 *
 * Coherence score = (cosine_similarity + 1) / 2 → [0, 1]
 * where 1.0 = fully coherent (identical to baseline)
 */
export class CoherenceScorer {
  /**
   * @param {object} [options]
   * @param {number} [options.windowSize=FIBONACCI[6]] - comparison window (13 snapshots)
   * @param {Float32Array} [options.baseline] - explicit baseline embedding
   */
  constructor(options = {}) {
    this._windowSize = options.windowSize ?? FIBONACCI[6]; // 13
    this._baseline   = options.baseline ?? null;
    /** @type {Float32Array[]} recent embeddings */
    this._history    = [];
  }

  /**
   * Set the baseline embedding
   * @param {Float32Array} embedding
   */
  setBaseline(embedding) { this._baseline = embedding; }

  /**
   * Record a new state embedding
   * @param {Float32Array} embedding
   */
  record(embedding) {
    this._history.push(embedding);
    if (this._history.length > this._windowSize * FIBONACCI[4]) {
      this._history = this._history.slice(-this._windowSize);
    }
    // Auto-set baseline from first snapshot
    if (!this._baseline) this._baseline = embedding;
  }

  /**
   * Compute coherence score for a given embedding vs baseline.
   * @param {Float32Array} embedding
   * @returns {number} coherence in [0, 1]
   */
  score(embedding) {
    if (!this._baseline) return 1.0;
    const sim = cosineSimilarity(embedding, this._baseline);
    return (sim + 1) / 2; // rescale [-1,1] → [0,1]
  }

  /**
   * Compute trend: is coherence improving or degrading?
   * Returns positive (improving) or negative (degrading).
   * @returns {number} trend in [-1, 1]
   */
  trend() {
    if (this._history.length < 2 || !this._baseline) return 0;
    const recentScores = this._history.slice(-FIBONACCI[4]).map((e) => this.score(e));
    if (recentScores.length < 2) return 0;
    const first = recentScores[0];
    const last  = recentScores[recentScores.length - 1];
    return Math.max(-1, Math.min(1, (last - first) / (Math.abs(first) + 0.001)));
  }
}

// ─── SelfAwareness ────────────────────────────────────────────────────────────

/**
 * Heady system self-monitoring.
 *
 * Continuously observes system state, computes embeddings, detects drift,
 * scores coherence, and writes a narrative log.
 *
 * @extends EventEmitter
 *
 * @example
 * const sa = new SelfAwareness({ nodeId: 'brain', logPath: '/tmp/heady-narrative.log' });
 * sa.on('drift.detected', ({ similarity }) => console.log('Drift!', similarity));
 * sa.on('recommendation', ({ suggestions }) => console.log(suggestions));
 * sa.start(() => ({ phase: 'active', queueSize: conductor.status.queueSize }));
 */
export class SelfAwareness extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string} [options.nodeId='self'] - this node's identifier
   * @param {number} [options.snapshotInterval=FIBONACCI[6]*1000] - snapshot frequency ms (13s)
   * @param {number} [options.analysisInterval=FIBONACCI[8]*1000] - analysis frequency ms (34s)
   * @param {string} [options.logPath] - narrative log file path
   * @param {number} [options.driftThreshold=DRIFT_THRESHOLD] - cosine similarity threshold
   * @param {number} [options.historySize=FIBONACCI[9]] - max historical snapshots (34)
   * @param {boolean} [options.autoRebaseline=true] - auto-update baseline on milestone
   */
  constructor(options = {}) {
    super();
    this._nodeId           = options.nodeId ?? 'self';
    this._snapshotMs       = options.snapshotInterval ?? FIBONACCI[6] * 1000; // 13s
    this._analysisMs       = options.analysisInterval ?? FIBONACCI[8] * 1000; // 34s
    this._driftThreshold   = options.driftThreshold ?? DRIFT_THRESHOLD;
    this._historySize      = options.historySize ?? FIBONACCI[9];             // 34
    this._autoRebaseline   = options.autoRebaseline !== false;

    /** @type {HeadyAutobiographer} */
    this._autobiographer = new HeadyAutobiographer({ logPath: options.logPath });

    /** @type {CoherenceScorer} */
    this._coherence = new CoherenceScorer({ windowSize: FIBONACCI[6] });

    /** @type {StateSnapshot[]} */
    this._history = [];

    /** Baseline snapshot (set on first run or via setBaseline()) */
    this._baseline = null;

    /** @type {Function|null} getState() callback */
    this._getState = null;

    this._snapshotTimer  = null;
    this._analysisTimer  = null;
    this._started        = false;

    // Optimization history: { ts, issue, recommendation, applied }
    /** @type {object[]} */
    this._recommendations = [];
  }

  // ─── State Provider ───────────────────────────────────────────────────────

  /**
   * Register the state provider function.
   * Called periodically to get a snapshot of the current system state.
   * @param {function(): *} fn - returns current state (any serializable object)
   */
  setStateProvider(fn) { this._getState = fn; }

  // ─── Baseline ─────────────────────────────────────────────────────────────

  /**
   * Manually set or reset the baseline embedding.
   * @param {*} [state] - state to use as baseline; defaults to current state
   */
  async setBaseline(state) {
    const s = state ?? (this._getState ? this._getState() : {});
    const embedding = embedState(s);
    this._baseline = { id: randomUUID(), ts: Date.now(), state: s, embedding };
    this._coherence.setBaseline(embedding);
    this._autobiographer.writeMilestone('Baseline established', { nodeId: this._nodeId });
    this.emit('baseline.set', { nodeId: this._nodeId, ts: this._baseline.ts });
  }

  // ─── Snapshot ─────────────────────────────────────────────────────────────

  /**
   * Take a state snapshot, embed it, and check for drift.
   * @returns {StateSnapshot}
   */
  async takeSnapshot() {
    const state = this._getState ? this._getState() : this._buildDefaultState();
    const embedding = embedState(state);

    // Coherence score
    this._coherence.record(embedding);
    const coherenceScore = this._coherence.score(embedding);

    const snapshot = {
      id:            randomUUID(),
      ts:            Date.now(),
      state,
      embedding,
      coherenceScore,
      nodeId:        this._nodeId,
    };

    // Add to history (evict oldest beyond window)
    this._history.push(snapshot);
    if (this._history.length > this._historySize) {
      this._history = this._history.slice(-this._historySize);
    }

    // Emit snapshot
    this.emit('snapshot.taken', {
      snapshotId: snapshot.id,
      coherenceScore,
      nodeId: this._nodeId,
    });

    // Drift check against baseline
    if (this._baseline) {
      const similarity = cosineSimilarity(embedding, this._baseline.embedding);
      if (similarity < this._driftThreshold) {
        this._autobiographer.writeDrift(similarity, state, this._baseline.state);
        this.emit('drift.detected', {
          similarity,
          threshold: this._driftThreshold,
          snapshotId: snapshot.id,
          coherenceScore,
          nodeId: this._nodeId,
        });
      }
    } else {
      // First snapshot: set as baseline
      await this.setBaseline(state);
    }

    // Coherence alerts
    if (coherenceScore < COHERENCE_CRITICAL) {
      this._autobiographer.write(
        `CRITICAL: Coherence score ${coherenceScore.toFixed(3)} < ${COHERENCE_CRITICAL.toFixed(3)}. ` +
        `System state has severely diverged from baseline.`,
        { coherenceScore },
        'WARN'
      );
      this.emit('coherence.critical', { coherenceScore, snapshotId: snapshot.id });
    } else if (coherenceScore < COHERENCE_DEGRADED) {
      this.emit('coherence.degraded', { coherenceScore, snapshotId: snapshot.id });
    }

    return snapshot;
  }

  /**
   * Build a default system state object if no state provider is registered
   * @private
   * @returns {object}
   */
  _buildDefaultState() {
    const mem = process.memoryUsage();
    return {
      nodeId:  this._nodeId,
      uptime:  process.uptime(),
      memory:  {
        heapUsed:   mem.heapUsed,
        heapTotal:  mem.heapTotal,
        external:   mem.external,
        rss:        mem.rss,
      },
      phiLoad: mem.heapUsed / mem.heapTotal,
      ts:      Date.now(),
    };
  }

  // ─── Analysis & Recommendations ───────────────────────────────────────────

  /**
   * Analyze historical snapshots and generate self-optimization recommendations.
   * @returns {object[]} list of recommendations
   */
  analyzeAndRecommend() {
    const suggestions = [];

    if (this._history.length < FIBONACCI[3]) return suggestions;

    // 1. Coherence trend
    const trend = this._coherence.trend();
    if (trend < -0.5) {
      suggestions.push({
        id:       randomUUID(),
        ts:       Date.now(),
        type:     'COHERENCE_DEGRADING',
        severity: 'HIGH',
        message:  `Coherence is declining (trend: ${trend.toFixed(3)}). Consider resetting to a known-good state or scaling down activity.`,
        action:   'rebaseline_or_reduce_load',
      });
    } else if (trend > 0.5 && this._autoRebaseline) {
      // System improving — auto-advance baseline
      const latest = this._history[this._history.length - 1];
      this._baseline = { ...latest };
      this._coherence.setBaseline(latest.embedding);
      this._autobiographer.writeMilestone('Auto-advanced baseline (coherence improving)', { trend });
    }

    // 2. Memory pressure
    const latestState = this._history[this._history.length - 1]?.state;
    if (latestState?.phiLoad > 1 / PHI) { // heap > 61.8%
      suggestions.push({
        id:       randomUUID(),
        ts:       Date.now(),
        type:     'MEMORY_PRESSURE',
        severity: latestState.phiLoad > 0.9 ? 'CRITICAL' : 'MEDIUM',
        message:  `PHI load (heap ratio) is ${(latestState.phiLoad * 100).toFixed(1)}%. Recommend GC or cache eviction.`,
        action:   'trigger_gc_or_evict',
        phiLoad:  latestState.phiLoad,
      });
    }

    // 3. Uptime milestone
    const uptime = process.uptime();
    const phiFibMilestones = FIBONACCI.map((f) => f * 3600); // fib hours in seconds
    for (const milestone of phiFibMilestones) {
      if (Math.abs(uptime - milestone) < this._snapshotMs / 1000) {
        this._autobiographer.writeMilestone(
          `Uptime milestone: ${(milestone / 3600).toFixed(0)}h (FIBONACCI[${FIBONACCI.indexOf(milestone / 3600)}])`,
          { uptime }
        );
        break;
      }
    }

    // Store recommendations
    this._recommendations.push(...suggestions);
    // Cap recommendations history (LRU)
    if (this._recommendations.length > FIBONACCI[8]) {
      this._recommendations = this._recommendations.slice(-FIBONACCI[8]);
    }

    if (suggestions.length > 0) {
      this.emit('recommendation', { suggestions, nodeId: this._nodeId });
    }

    return suggestions;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start continuous self-monitoring.
   * @param {function(): *} [getState] - state provider function
   */
  start(getState) {
    if (this._started) return;
    this._started = true;
    if (getState) this._getState = getState;

    this._autobiographer.write(
      `SelfAwareness started on node "${this._nodeId}". ` +
      `The system begins observing itself, watching for drift and coherence changes.`,
      { nodeId: this._nodeId },
      'INFO'
    );

    // Snapshot loop
    this._snapshotTimer = setInterval(async () => {
      await this.takeSnapshot().catch((err) => this.emit('error', err));
    }, this._snapshotMs);
    if (this._snapshotTimer.unref) this._snapshotTimer.unref();

    // Analysis loop
    this._analysisTimer = setInterval(() => {
      this.analyzeAndRecommend();
    }, this._analysisMs);
    if (this._analysisTimer.unref) this._analysisTimer.unref();

    // Take immediate first snapshot to set baseline
    this.takeSnapshot().catch((err) => this.emit('error', err));

    this.emit('selfaware.started', { nodeId: this._nodeId });
  }

  /**
   * Stop self-monitoring
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;

    clearInterval(this._snapshotTimer);
    clearInterval(this._analysisTimer);
    this._snapshotTimer = null;
    this._analysisTimer = null;

    this._autobiographer.write(
      `SelfAwareness shutting down on node "${this._nodeId}". ` +
      `Total ${this._history.length} snapshots recorded across ${this._autobiographer.chapter} chapters.`,
      { nodeId: this._nodeId, snapshots: this._history.length },
      'INFO'
    );

    this.emit('selfaware.stopped', { nodeId: this._nodeId });
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} self-awareness status */
  get status() {
    const latest = this._history[this._history.length - 1];
    return {
      nodeId:          this._nodeId,
      started:         this._started,
      snapshotCount:   this._history.length,
      coherenceScore:  latest?.coherenceScore ?? null,
      coherenceTrend:  this._coherence.trend(),
      baselineAge:     this._baseline ? Date.now() - this._baseline.ts : null,
      chapter:         this._autobiographer.chapter,
      narrativeEntries:this._autobiographer.entryCount,
      recommendations: this._recommendations.length,
      driftThreshold:  this._driftThreshold,
      phi:             PHI,
    };
  }

  /**
   * Get recent narrative entries
   * @param {number} [n=FIBONACCI[4]]
   * @returns {object[]}
   */
  getNarrative(n = FIBONACCI[4]) {
    return this._autobiographer.getRecent(n);
  }

  /**
   * Get recent recommendations
   * @param {number} [n=FIBONACCI[3]]
   * @returns {object[]}
   */
  getRecommendations(n = FIBONACCI[3]) {
    return this._recommendations.slice(-n);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {SelfAwareness|null} */
let _globalSA = null;

/**
 * Get (or create) the global SelfAwareness singleton
 * @param {object} [options]
 * @returns {SelfAwareness}
 */
export function getGlobalSelfAwareness(options = {}) {
  if (!_globalSA) {
    _globalSA = new SelfAwareness(options);
  }
  return _globalSA;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  PHI,
  FIBONACCI,
  DRIFT_THRESHOLD,
  COHERENCE_DEGRADED,
  COHERENCE_CRITICAL,
};

export default {
  SelfAwareness,
  HeadyAutobiographer,
  CoherenceScorer,
  embedState,
  cosineSimilarity,
  getGlobalSelfAwareness,
  DRIFT_THRESHOLD,
  COHERENCE_DEGRADED,
  COHERENCE_CRITICAL,
  PHI,
  FIBONACCI,
};
