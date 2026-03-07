/**
 * @file index.js
 * @description Intelligence layer: unified export + createIntelligenceLayer() factory.
 *
 * Provides a single cohesive intelligence system for the Heady cluster,
 * integrating Monte Carlo simulation, columnar analytics, and pattern detection.
 *
 * Sacred Geometry: PHI ratios throughout.
 * Zero external dependencies.
 *
 * @module HeadyIntelligence
 */

import { EventEmitter } from 'events';
import { randomBytes }  from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// ─── Re-exports ───────────────────────────────────────────────────────────────
export {
  MonteCarloEngine,
  DecisionTree,
  StrategyOptimizer,
  mcSummarize, mcMean, mcStddev, mcPercentile, mcCI,
  createRng,
} from './monte-carlo.js';

export {
  AnalyticsEngine,
} from './analytics-engine.js';

export {
  PatternEngine,
  detectAnomaliesZScore,
  detectAnomaliesIQR,
  detectChangepointsCUSUM,
  linearTrend,
  movingAverage,
  exponentialMovingAverage,
  phiEMA,
  pearsonCorrelation,
  spearmanCorrelation,
  crossCorrelation,
  detectPeriodicity,
  classifyPattern,
} from './pattern-engine.js';

// ─── Module imports for factory ───────────────────────────────────────────────
import { MonteCarloEngine as _MC }    from './monte-carlo.js';
import { AnalyticsEngine  as _AE }    from './analytics-engine.js';
import { PatternEngine    as _PE }    from './pattern-engine.js';

// ─── IntelligenceLayer class ──────────────────────────────────────────────────

/**
 * Unified intelligence context for a Heady cluster node.
 *
 * Wires together:
 * - Monte Carlo engine: simulation and strategy optimization
 * - Analytics engine: SQL-like in-memory columnar queries
 * - Pattern engine: time-series anomaly detection and trend analysis
 *
 * @example
 *   const intel = createIntelligenceLayer();
 *
 *   // Insert metrics into analytics
 *   intel.analytics.createTable('metrics', ['ts', 'service', 'latency', 'errors']);
 *   intel.analytics.insert('metrics', { ts: Date.now(), service: 'brain', latency: 42, errors: 0 });
 *
 *   // Ingest telemetry into pattern engine
 *   intel.patterns.ingest('brain.latency', 42);
 *
 *   // Run simulation
 *   const result = await intel.monteCarlo.simulate(
 *     (p, rng) => rng.normal(p.mean, p.std),
 *     { mean: 100, std: 15 }
 *   );
 */
export class IntelligenceLayer extends EventEmitter {
  /**
   * @param {object} opts
   * @param {_MC} opts.monteCarlo
   * @param {_AE} opts.analytics
   * @param {_PE} opts.patterns
   * @param {string} [opts.nodeId]
   */
  constructor({ monteCarlo, analytics, patterns, nodeId }) {
    super();
    this.monteCarlo = monteCarlo;
    this.analytics  = analytics;
    this.patterns   = patterns;
    this.nodeId     = nodeId ?? `intel-${randomBytes(4).toString('hex')}`;
    this._booted    = Date.now();

    // Forward events
    monteCarlo.on('complete', evt => this.emit('simulation:complete', evt));
    monteCarlo.on('progress', evt => this.emit('simulation:progress', evt));
    analytics.on('query',     evt => this.emit('analytics:query',     evt));
    patterns.on('anomaly',    evt => this.emit('pattern:anomaly',     evt));
    patterns.on('analysis',   evt => this.emit('pattern:analysis',    evt));
  }

  // ── Convenience: record a telemetry point ──────────────────────────────────

  /**
   * Record a telemetry data point: inserts into analytics + ingests into patterns.
   *
   * @param {string} service      Service or component name
   * @param {string} metric       Metric name (e.g. 'latency', 'errors')
   * @param {number} value        Numeric value
   * @param {object} [tags]       Additional dimension tags
   */
  record(service, metric, value, tags = {}) {
    const ts = Date.now();
    const seriesId = `${service}.${metric}`;

    // Ingest into pattern engine
    this.patterns.ingest(seriesId, value, { timestamp: ts });

    // Insert into analytics (lazy table creation)
    const tableName = `telemetry_${metric.replace(/[^a-z0-9]/gi, '_')}`;
    try {
      this.analytics.table(tableName);
    } catch {
      this.analytics.createTable(tableName, ['ts', 'service', 'value', ...Object.keys(tags)]);
    }
    this.analytics.insert(tableName, { ts, service, value, ...tags });

    return this;
  }

  // ── Convenience: analyze a service metric ─────────────────────────────────

  /**
   * Analyze a service metric's pattern.
   * @param {string} service
   * @param {string} metric
   * @returns {object} Pattern analysis result
   */
  analyzeMetric(service, metric) {
    return this.patterns.analyze(`${service}.${metric}`);
  }

  // ── Convenience: quick query ──────────────────────────────────────────────

  /**
   * Query a telemetry table.
   * @param {string} metric
   * @returns {QueryBuilder}
   */
  query(metric) {
    const tableName = `telemetry_${metric.replace(/[^a-z0-9]/gi, '_')}`;
    return this.analytics.from(tableName);
  }

  // ── Convenience: simulate decision ────────────────────────────────────────

  /**
   * Run a Monte Carlo simulation to evaluate a decision.
   * @param {Function|string} simFn
   * @param {object}          params
   * @param {object}          [mcOpts]   Override Monte Carlo engine opts
   * @returns {Promise<SimulationResult>}
   */
  async simulate(simFn, params = {}, mcOpts = {}) {
    if (Object.keys(mcOpts).length > 0) {
      // Temporary engine with overrides
      const engine = new _MC({ ...this.monteCarlo, ...mcOpts });
      return engine.simulate(simFn, params);
    }
    return this.monteCarlo.simulate(simFn, params);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  /**
   * Intelligence layer health snapshot.
   */
  health() {
    return {
      nodeId:     this.nodeId,
      uptimeMs:   Date.now() - this._booted,
      analytics:  this.analytics.stats(),
      patterns:   this.patterns.status(),
      monteCarlo: {
        runs:      this.monteCarlo.runs,
        workers:   this.monteCarlo.workers,
        inProcess: this.monteCarlo.inProcess,
      },
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a fully-wired intelligence layer.
 *
 * @param {object} [opts]
 * @param {string}   [opts.nodeId]            Node identifier
 * @param {object}   [opts.monteCarlo]        MonteCarloEngine options
 * @param {object}   [opts.analytics]         AnalyticsEngine options
 * @param {object}   [opts.patterns]          PatternEngine options
 * @returns {IntelligenceLayer}
 */
export function createIntelligenceLayer(opts = {}) {
  const monteCarlo = new _MC({
    runs:      opts.monteCarlo?.runs      ?? Math.round(1000 * PHI),
    workers:   opts.monteCarlo?.workers   ?? 4,
    inProcess: opts.monteCarlo?.inProcess ?? false,
    ...opts.monteCarlo,
  });

  const analytics = new _AE({
    queryCacheSize: opts.analytics?.queryCacheSize ?? Math.round(89 * PHI),
    queryEvents:    opts.analytics?.queryEvents    ?? false,
    ...opts.analytics,
  });

  const patterns = new _PE({
    anomalyWindow:    opts.patterns?.anomalyWindow    ?? 21,
    anomalyThreshold: opts.patterns?.anomalyThreshold ?? 3.0,
    autoEmit:         opts.patterns?.autoEmit         ?? true,
    ...opts.patterns,
  });

  return new IntelligenceLayer({
    monteCarlo,
    analytics,
    patterns,
    nodeId: opts.nodeId,
  });
}

export default createIntelligenceLayer;
