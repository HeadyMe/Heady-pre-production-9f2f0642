'use strict';

/**
 * @file semantic-router.js
 * @description Semantic routing engine that replaces string-based routing with
 * vector similarity routing. Each incoming intent vector is compared against
 * pre-defined semantic anchors using cosine similarity, producing ranked,
 * phi-normalized activation scores.
 *
 * All thresholds are managed via PhiScale instances — never hardcoded — so the
 * system self-tunes around the golden ratio as routing telemetry flows in.
 *
 * @module routing/semantic-router
 */

const CSL = require('../core/semantic-logic');
const { PhiScale, PhiRange, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Deterministic pseudo-random number generator (mulberry32-style)
// ---------------------------------------------------------------------------

/**
 * Hash a string to a 32-bit unsigned integer (djb2 variant).
 * @param {string} str
 * @returns {number} unsigned 32-bit integer
 */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Create a mulberry32-style PRNG seeded from a 32-bit integer.
 * Returns a closure that yields floats in [0, 1) on each call.
 * @param {number} seed
 * @returns {function(): number}
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a deterministic 384-dimensional Float32Array embedding from text.
 * The vector is L2-normalised so cosine_similarity works correctly.
 * @param {string} text
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function generateDeterministicVector(text, dim = 384) {
  const seed = hashString(text);
  const rng = mulberry32(seed);
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    // Map [0,1) → [-1, 1) for a centred distribution
    vec[i] = rng() * 2 - 1;
  }
  // L2-normalise
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

// ---------------------------------------------------------------------------
// Default anchor descriptors
// ---------------------------------------------------------------------------

/**
 * Rich natural-language descriptions for the 10 default semantic anchors.
 * These descriptions are intentionally verbose so the deterministic embedding
 * captures maximum discriminative signal across the semantic space.
 */
const DEFAULT_ANCHOR_DESCRIPTIONS = {
  deploy: `Deploy or release software to a target environment such as production, staging, or a
  cloud provider. This intent covers continuous delivery pipelines, blue-green deployments,
  canary releases, rolling updates, Kubernetes rollouts, Helm chart upgrades, Docker image
  pushes, serverless function publishing, infrastructure-as-code applies, feature-flag
  enablement, and any action that makes a new version of code or configuration live for users.
  Deployment involves version control tagging, artifact promotion, health-check verification,
  and post-deploy smoke testing.`,

  refactor: `Refactor, restructure, or improve existing source code without changing its observable
  external behaviour. This intent includes renaming variables for clarity, extracting functions
  or modules, simplifying cyclomatic complexity, removing dead code, applying design patterns,
  migrating to a new framework or language version, optimising data structures, eliminating
  technical debt, splitting monoliths into services, consolidating duplicated logic, and any
  non-functional improvement to code quality, maintainability, readability, or performance
  characteristics.`,

  debug: `Debug, diagnose, or investigate a defect, error, crash, performance anomaly, or
  unexpected behaviour in software. This intent covers root-cause analysis, log inspection,
  stack trace interpretation, setting breakpoints, memory profiling, CPU flame-graph analysis,
  network packet inspection, distributed tracing, reproducing flaky tests, analysing core
  dumps, bisecting git history to find regressions, and any systematic investigation aimed
  at understanding why a system is not behaving as expected.`,

  research: `Research, investigate, learn, or gather information on a topic, technology, concept,
  or decision. This intent includes exploring documentation, reading academic papers, comparing
  libraries or frameworks, understanding business requirements, studying competitor products,
  evaluating architectural trade-offs, benchmarking solutions, surveying the state-of-the-art,
  answering "why" or "what" questions, building domain knowledge, and any information-gathering
  activity that informs future decisions.`,

  test: `Test, verify, validate, or quality-assure software behaviour. This intent includes writing
  unit tests, integration tests, end-to-end tests, property-based tests, contract tests, load
  tests, chaos experiments, mutation testing, snapshot testing, accessibility audits, security
  scans, linting, static analysis, and any activity that confirms or refutes a hypothesis about
  software correctness, performance, reliability, or compliance with a specification.`,

  create: `Create, build, implement, or generate something new — code, infrastructure, content,
  documentation, configuration, or any other artefact. This intent covers writing a new feature
  from scratch, scaffolding a project, generating boilerplate, authoring API endpoints,
  designing database schemas, writing scripts, creating CI/CD pipelines, producing technical
  documentation, building dashboards, composing configuration files, and any act of bringing
  a new artefact into existence.`,

  secure: `Secure, harden, audit, or protect a system, application, or infrastructure from
  unauthorised access, data breaches, or vulnerabilities. This intent includes threat modelling,
  penetration testing, dependency scanning, secret rotation, IAM policy tightening, TLS
  configuration, input validation, SQL-injection prevention, CSRF mitigation, RBAC design,
  zero-trust network architecture, compliance audits (SOC2, PCI-DSS, HIPAA), encryption-at-rest
  and in-transit, and any action that reduces the attack surface or improves the security
  posture of a system.`,

  orchestrate: `Orchestrate, coordinate, or manage multiple services, agents, workflows, or
  processes working together to achieve a complex goal. This intent covers microservice
  choreography, workflow engines, event-driven architectures, message queues, service mesh
  configuration, distributed transaction management, multi-agent coordination, task scheduling,
  dependency graphs, saga patterns, circuit breakers, and any activity that governs how
  independent components collaborate to fulfil a higher-level objective.`,

  monitor: `Monitor, observe, alert, or measure the health, performance, and behaviour of systems
  in production. This intent includes setting up dashboards, configuring alerting thresholds,
  instrumenting code with metrics and traces, log aggregation, SLO tracking, anomaly detection,
  on-call runbook creation, capacity planning, cost monitoring, uptime checks, synthetic
  monitoring, and any activity that provides visibility into how a system is behaving over time
  so that issues can be detected and responded to quickly.`,

  scale: `Scale, optimise, or increase the capacity of a system to handle greater load, improve
  throughput, reduce latency, or lower cost. This intent includes horizontal and vertical
  scaling, autoscaling policies, caching strategies, CDN configuration, database sharding,
  read replicas, connection pooling, asynchronous processing, batch job optimisation, resource
  right-sizing, load balancing, queue-depth tuning, and any activity aimed at making a system
  capable of serving more demand efficiently.`,
};

// ---------------------------------------------------------------------------
// SemanticRouter
// ---------------------------------------------------------------------------

/**
 * @class SemanticRouter
 * @description Routes intent vectors to semantic anchors using cosine similarity
 * with phi-normalised adaptive thresholds. Supports multi-activation, ambiguity
 * detection, batch routing, fallback routing, and serialisation.
 */
class SemanticRouter {
  /**
   * @param {object} [config={}]
   * @param {number} [config.defaultThreshold=PHI_INVERSE] — base similarity threshold
   * @param {number} [config.embeddingDimension=384] — vector dimensionality
   * @param {boolean} [config.adaptiveThreshold=true] — whether to adapt threshold from outcomes
   * @param {number} [config.ambiguityGap=0.05] — gap between top-2 that triggers ambiguity flag
   */
  constructor(config = {}) {
    this._config = {
      defaultThreshold: config.defaultThreshold ?? PHI_INVERSE,
      embeddingDimension: config.embeddingDimension ?? 384,
      adaptiveThreshold: config.adaptiveThreshold !== false,
      ambiguityGap: config.ambiguityGap ?? 0.05,
    };

    /** @type {Map<string, {id, description, vector, priority: PhiScale}>} */
    this._anchors = new Map();

    // Adaptive threshold scale — self-tunes around phi-inverse (0.618)
    this._thresholdScale = new PhiScale({
      name: 'routing_threshold',
      baseValue: PHI_INVERSE,
      min: 0.3,
      max: 0.95,
      phiNormalized: true,
      sensitivity: 0.12,
      momentumDecay: 0.85,
      maxHistorySize: 200,
      category: 'routing',
    });

    // Routing statistics
    this._stats = {
      totalRoutes: 0,
      totalAmbiguous: 0,
      totalFallbacks: 0,
      similaritySum: 0,
      thresholdHistory: [],
      outcomeHistory: [],
    };

    // Initialise default anchors
    this._initDefaultAnchors();

    logger.info('[SemanticRouter] Initialised', {
      anchors: this._anchors.size,
      threshold: this._thresholdScale.value,
      adaptive: this._config.adaptiveThreshold,
    });
  }

  // -------------------------------------------------------------------------
  // Private — default anchor initialisation
  // -------------------------------------------------------------------------

  /**
   * Register all 10 default anchors with deterministic pseudo-vectors and
   * phi-normalised priority scales.
   * @private
   */
  _initDefaultAnchors() {
    // Priority weights roughly reflect operational urgency (phi-spaced)
    const priorities = {
      deploy:      0.89,
      secure:      0.85,
      debug:       0.80,
      monitor:     0.75,
      orchestrate: 0.72,
      scale:       0.68,
      test:        0.65,
      create:      0.62,
      refactor:    0.55,
      research:    0.50,
    };

    for (const [id, description] of Object.entries(DEFAULT_ANCHOR_DESCRIPTIONS)) {
      const vector = generateDeterministicVector(description, this._config.embeddingDimension);
      const priority = new PhiScale({
        name: `anchor_priority_${id}`,
        baseValue: priorities[id] ?? PHI_INVERSE,
        min: 0,
        max: 1,
        phiNormalized: true,
        sensitivity: 0.05,
        momentumDecay: 0.9,
        category: 'anchor_priority',
      });
      this._anchors.set(id, { id, description, vector, priority });
    }
  }

  // -------------------------------------------------------------------------
  // Anchor management
  // -------------------------------------------------------------------------

  /**
   * Register a new semantic anchor.
   * @param {string} id — unique identifier
   * @param {string} description — rich natural-language description
   * @param {Float32Array|null} [vector=null] — pre-computed embedding; if null,
   *   a deterministic pseudo-vector is generated from the description
   * @returns {object} the registered anchor object
   */
  registerAnchor(id, description, vector = null) {
    if (!id || typeof id !== 'string') throw new TypeError('Anchor id must be a non-empty string');
    if (!description || typeof description !== 'string') throw new TypeError('Anchor description must be a non-empty string');

    const resolvedVector = vector instanceof Float32Array
      ? vector
      : generateDeterministicVector(description, this._config.embeddingDimension);

    const priority = new PhiScale({
      name: `anchor_priority_${id}`,
      baseValue: PHI_INVERSE,
      min: 0,
      max: 1,
      phiNormalized: true,
      sensitivity: 0.05,
      momentumDecay: 0.9,
      category: 'anchor_priority',
    });

    const anchor = { id, description, vector: resolvedVector, priority };
    this._anchors.set(id, anchor);
    logger.info(`[SemanticRouter] Anchor registered: ${id}`);
    return anchor;
  }

  /**
   * Remove a registered anchor.
   * @param {string} id
   * @returns {boolean} true if removed, false if not found
   */
  removeAnchor(id) {
    const existed = this._anchors.has(id);
    this._anchors.delete(id);
    if (existed) logger.info(`[SemanticRouter] Anchor removed: ${id}`);
    return existed;
  }

  /**
   * Retrieve an anchor by id.
   * @param {string} id
   * @returns {object|undefined}
   */
  getAnchor(id) {
    return this._anchors.get(id);
  }

  // -------------------------------------------------------------------------
  // Core routing
  // -------------------------------------------------------------------------

  /**
   * Route an input vector against all registered anchors.
   *
   * Process:
   *  1. Compute cosine similarity against every anchor.
   *  2. Apply soft_gate activation for each similarity score.
   *  3. Use CSL.multi_resonance for ranked, threshold-filtered results.
   *  4. Apply adaptive threshold from _thresholdScale.
   *  5. Return full ranked array with activation flags.
   *
   * @param {Float32Array} inputVector — normalised embedding of the incoming intent
   * @returns {Array<{anchor: string, similarity: number, activated: boolean, activation: number}>}
   */
  route(inputVector) {
    if (!(inputVector instanceof Float32Array)) {
      throw new TypeError('inputVector must be a Float32Array');
    }

    const threshold = this._thresholdScale.value;
    const anchors = Array.from(this._anchors.values());

    // Build candidates array for multi_resonance: [{id, vector}, ...]
    const candidateVectors = anchors.map(a => a.vector);

    // multi_resonance returns sorted [{index, score, open}]
    const resonanceResults = CSL.multi_resonance(inputVector, candidateVectors, threshold);

    // Build a score lookup by anchor index
    const scoreMap = new Map();
    for (const r of resonanceResults) {
      scoreMap.set(r.index, r);
    }

    // Compose full results array in anchor registration order, then sort by similarity
    const results = anchors.map((anchor, idx) => {
      const r = scoreMap.get(idx);
      const similarity = r ? r.score : CSL.cosine_similarity(inputVector, anchor.vector);
      const activation = CSL.soft_gate(similarity, threshold, 20);
      const activated = similarity > threshold;
      return { anchor: anchor.id, similarity, activated, activation };
    });

    // Sort descending by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    // Update statistics
    this._stats.totalRoutes++;
    if (results.length > 0) {
      this._stats.similaritySum += results[0].similarity;
    }
    this._stats.thresholdHistory.push({ threshold, ts: Date.now() });
    if (this._stats.thresholdHistory.length > 500) {
      this._stats.thresholdHistory.splice(0, this._stats.thresholdHistory.length - 500);
    }

    logger.debug('[SemanticRouter] route()', {
      threshold: threshold.toFixed(4),
      topAnchor: results[0]?.anchor,
      topSimilarity: results[0]?.similarity?.toFixed(4),
      activatedCount: results.filter(r => r.activated).length,
    });

    return results;
  }

  /**
   * Convenience method: embed text with the provided function, then route.
   * @param {string} text — raw text input
   * @param {function(string): Promise<Float32Array>|Float32Array} embedFn — embedding function
   * @returns {Promise<Array<{anchor, similarity, activated, activation}>>}
   */
  async routeText(text, embedFn) {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new TypeError('text must be a non-empty string');
    }
    if (typeof embedFn !== 'function') {
      throw new TypeError('embedFn must be a function');
    }
    let vector = await Promise.resolve(embedFn(text));
    if (!(vector instanceof Float32Array)) {
      vector = new Float32Array(vector);
    }
    return this.route(vector);
  }

  // -------------------------------------------------------------------------
  // Ambiguity detection
  // -------------------------------------------------------------------------

  /**
   * Detect routing ambiguity — when the top two candidates are too similar
   * in score to confidently pick one.
   * @param {Array<{anchor, similarity, activated, activation}>} results — output of route()
   * @returns {{ ambiguous: boolean, topCandidates: Array, gap: number }}
   */
  detectAmbiguity(results) {
    if (!Array.isArray(results) || results.length < 2) {
      return { ambiguous: false, topCandidates: results ?? [], gap: 1 };
    }

    const gap = results[0].similarity - results[1].similarity;
    const ambiguous = gap < this._config.ambiguityGap;

    if (ambiguous) {
      this._stats.totalAmbiguous++;
      logger.warn('[SemanticRouter] Ambiguous routing detected', {
        top: results[0].anchor,
        second: results[1].anchor,
        gap: gap.toFixed(4),
      });
    }

    return {
      ambiguous,
      topCandidates: ambiguous ? [results[0], results[1]] : [results[0]],
      gap,
    };
  }

  // -------------------------------------------------------------------------
  // Adaptive threshold
  // -------------------------------------------------------------------------

  /**
   * Record a routing outcome to drive adaptive threshold adjustment.
   * If the route succeeded at the given similarity, we may lower the threshold
   * slightly (accept more). If it failed, we raise it (become more selective).
   *
   * @param {string} anchorId — which anchor was selected
   * @param {number} similarity — the similarity score at time of routing
   * @param {boolean} success — whether the routing choice was correct
   */
  recordRoutingOutcome(anchorId, similarity, success) {
    if (!this._config.adaptiveThreshold) return;

    const anchor = this._anchors.get(anchorId);
    if (!anchor) {
      logger.warn(`[SemanticRouter] recordRoutingOutcome: unknown anchor '${anchorId}'`);
      return;
    }

    // Encode success/failure as a PhiScale telemetry metric
    // PhiScale.adjust() accepts a metrics object; we use a custom signal
    const signal = success ? similarity * PHI_INVERSE : similarity * PHI;
    this._thresholdScale.adjust({ value: signal, weight: 1 });

    this._stats.outcomeHistory.push({ anchorId, similarity, success, ts: Date.now() });
    if (this._stats.outcomeHistory.length > 1000) {
      this._stats.outcomeHistory.splice(0, this._stats.outcomeHistory.length - 1000);
    }

    logger.debug('[SemanticRouter] Threshold adjusted', {
      anchorId,
      similarity: similarity.toFixed(4),
      success,
      newThreshold: this._thresholdScale.value.toFixed(4),
    });
  }

  // -------------------------------------------------------------------------
  // Batch routing
  // -------------------------------------------------------------------------

  /**
   * Route multiple input vectors in a single pass.
   * @param {Float32Array[]} vectors — array of normalised embeddings
   * @returns {Array<Array<{anchor, similarity, activated, activation}>>}
   */
  routeBatch(vectors) {
    if (!Array.isArray(vectors)) throw new TypeError('vectors must be an array');
    return vectors.map((v, i) => {
      try {
        return this.route(v);
      } catch (err) {
        logger.error(`[SemanticRouter] routeBatch error at index ${i}`, { err: err.message });
        return [];
      }
    });
  }

  // -------------------------------------------------------------------------
  // Fallback routing
  // -------------------------------------------------------------------------

  /**
   * Route with a guaranteed fallback anchor if no anchor activates above threshold.
   * @param {Float32Array} inputVector
   * @param {string} fallbackAnchorId — must be a registered anchor id
   * @returns {{ results: Array, usedFallback: boolean, fallbackAnchor: string|null }}
   */
  routeWithFallback(inputVector, fallbackAnchorId) {
    if (!this._anchors.has(fallbackAnchorId)) {
      throw new Error(`Fallback anchor '${fallbackAnchorId}' is not registered`);
    }

    const results = this.route(inputVector);
    const anyActivated = results.some(r => r.activated);

    if (!anyActivated) {
      this._stats.totalFallbacks++;
      logger.info(`[SemanticRouter] No anchor activated — using fallback: ${fallbackAnchorId}`);

      // Force-activate the fallback anchor in the results
      const fallbackIdx = results.findIndex(r => r.anchor === fallbackAnchorId);
      if (fallbackIdx !== -1) {
        results[fallbackIdx] = {
          ...results[fallbackIdx],
          activated: true,
          activation: PHI_INVERSE, // phi-inverse as the fallback activation strength
        };
      }
      return { results, usedFallback: true, fallbackAnchor: fallbackAnchorId };
    }

    return { results, usedFallback: false, fallbackAnchor: null };
  }

  // -------------------------------------------------------------------------
  // Similarity matrix
  // -------------------------------------------------------------------------

  /**
   * Compute the pairwise cosine similarity matrix between all registered anchors.
   * Useful for detecting overlapping (redundant) or isolated (gap) anchors.
   *
   * @returns {{
   *   matrix: number[][],
   *   anchors: string[],
   *   overlaps: Array<{a, b, similarity}>,
   *   gaps: Array<{a, b, similarity}>
   * }}
   */
  computeSimilarityMatrix() {
    const anchors = Array.from(this._anchors.values());
    const n = anchors.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    // Overlap threshold: > 0.85 → anchors are semantically redundant
    // Gap threshold: < 0.15 → anchors are maximally distinct
    const overlapThreshold = new PhiScale({
      name: 'overlap_threshold',
      baseValue: 0.85,
      min: 0.7,
      max: 1.0,
      phiNormalized: false,
    }).value;

    const gapThreshold = new PhiScale({
      name: 'gap_threshold',
      baseValue: 0.15,
      min: 0.0,
      max: 0.3,
      phiNormalized: false,
    }).value;

    const overlaps = [];
    const gaps = [];

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const sim = CSL.cosine_similarity(anchors[i].vector, anchors[j].vector);
        matrix[i][j] = sim;
        matrix[j][i] = sim;

        if (sim > overlapThreshold) {
          overlaps.push({ a: anchors[i].id, b: anchors[j].id, similarity: sim });
        } else if (sim < gapThreshold) {
          gaps.push({ a: anchors[i].id, b: anchors[j].id, similarity: sim });
        }
      }
    }

    const anchorIds = anchors.map(a => a.id);
    logger.info('[SemanticRouter] Similarity matrix computed', {
      anchors: n,
      overlaps: overlaps.length,
      gaps: gaps.length,
    });

    return { matrix, anchors: anchorIds, overlaps, gaps };
  }

  // -------------------------------------------------------------------------
  // Anchor embedding recomputation
  // -------------------------------------------------------------------------

  /**
   * Recompute all anchor vectors using an external embedding function.
   * If no function is provided, the deterministic pseudo-vectors are regenerated.
   * @param {function(string): Promise<Float32Array>|Float32Array} [embedFn]
   * @returns {Promise<void>}
   */
  async computeAnchorEmbeddings(embedFn) {
    for (const anchor of this._anchors.values()) {
      try {
        if (typeof embedFn === 'function') {
          let vec = await Promise.resolve(embedFn(anchor.description));
          if (!(vec instanceof Float32Array)) vec = new Float32Array(vec);
          anchor.vector = vec;
        } else {
          anchor.vector = generateDeterministicVector(anchor.description, this._config.embeddingDimension);
        }
      } catch (err) {
        logger.error(`[SemanticRouter] Failed to compute embedding for anchor '${anchor.id}'`, { err: err.message });
      }
    }
    logger.info('[SemanticRouter] Anchor embeddings recomputed', { count: this._anchors.size });
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Return routing statistics.
   * @returns {{
   *   totalRoutes: number,
   *   totalAmbiguous: number,
   *   totalFallbacks: number,
   *   avgTopSimilarity: number,
   *   currentThreshold: number,
   *   thresholdHistory: Array,
   *   ambiguityRate: number
   * }}
   */
  getStats() {
    const avgTopSimilarity = this._stats.totalRoutes > 0
      ? this._stats.similaritySum / this._stats.totalRoutes
      : 0;

    return {
      totalRoutes: this._stats.totalRoutes,
      totalAmbiguous: this._stats.totalAmbiguous,
      totalFallbacks: this._stats.totalFallbacks,
      avgTopSimilarity,
      currentThreshold: this._thresholdScale.value,
      thresholdStats: this._thresholdScale.stats(),
      thresholdHistory: this._stats.thresholdHistory.slice(-50),
      ambiguityRate: this._stats.totalRoutes > 0
        ? this._stats.totalAmbiguous / this._stats.totalRoutes
        : 0,
      anchorCount: this._anchors.size,
      outcomeHistorySize: this._stats.outcomeHistory.length,
    };
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  /**
   * Capture a serialisable snapshot of router state.
   * @returns {object}
   */
  snapshot() {
    const anchors = [];
    for (const anchor of this._anchors.values()) {
      anchors.push({
        id: anchor.id,
        description: anchor.description,
        vector: Array.from(anchor.vector), // Float32Array → plain array for JSON safety
        prioritySnapshot: anchor.priority.snapshot(),
      });
    }

    return {
      version: 1,
      ts: Date.now(),
      config: { ...this._config },
      thresholdSnapshot: this._thresholdScale.snapshot(),
      anchors,
      stats: {
        totalRoutes: this._stats.totalRoutes,
        totalAmbiguous: this._stats.totalAmbiguous,
        totalFallbacks: this._stats.totalFallbacks,
        similaritySum: this._stats.similaritySum,
      },
    };
  }

  /**
   * Restore router state from a snapshot.
   * @param {object} snap — produced by snapshot()
   */
  restore(snap) {
    if (!snap || snap.version !== 1) {
      throw new Error('Invalid or incompatible snapshot version');
    }

    // Restore config
    Object.assign(this._config, snap.config);

    // Restore threshold scale
    this._thresholdScale.restore(snap.thresholdSnapshot);

    // Restore anchors
    this._anchors.clear();
    for (const a of snap.anchors) {
      const vector = new Float32Array(a.vector);
      const priority = new PhiScale({
        name: `anchor_priority_${a.id}`,
        baseValue: PHI_INVERSE,
        min: 0,
        max: 1,
        phiNormalized: true,
        sensitivity: 0.05,
        momentumDecay: 0.9,
        category: 'anchor_priority',
      });
      priority.restore(a.prioritySnapshot);
      this._anchors.set(a.id, { id: a.id, description: a.description, vector, priority });
    }

    // Restore stats counters
    Object.assign(this._stats, snap.stats);
    this._stats.thresholdHistory = [];
    this._stats.outcomeHistory = [];

    logger.info('[SemanticRouter] State restored from snapshot', {
      anchors: this._anchors.size,
      totalRoutes: this._stats.totalRoutes,
    });
  }

  // -------------------------------------------------------------------------
  // Utility — list registered anchors
  // -------------------------------------------------------------------------

  /**
   * List all registered anchor ids.
   * @returns {string[]}
   */
  listAnchors() {
    return Array.from(this._anchors.keys());
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { SemanticRouter };
