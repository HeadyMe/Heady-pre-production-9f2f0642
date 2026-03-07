/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const os = require('os');
const logger = require('../../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_TYPES = Object.freeze({
  COUNTER:   'counter',
  GAUGE:     'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY:   'summary',
});

// Default histogram buckets (ms / seconds depending on metric)
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// How long to keep raw histogram observations (ms)
const OBSERVATION_TTL = 10 * 60 * 1000; // 10 min

// Built-in metric names
const BUILT_IN = {
  REQUEST_TOTAL:      'heady_requests_total',
  REQUEST_DURATION:   'heady_request_duration_seconds',
  ERROR_TOTAL:        'heady_errors_total',
  MEMORY_BYTES:       'heady_process_memory_bytes',
  HEAP_BYTES:         'heady_process_heap_bytes',
  ACTIVE_CONNECTIONS: 'heady_active_connections',
  EVENT_LOOP_LAG:     'heady_event_loop_lag_seconds',
};

// ─── TelemetryCollector ───────────────────────────────────────────────────────

class TelemetryCollector {
  /**
   * @param {object} opts
   * @param {boolean} [opts.collectBuiltIns=true]  - Start collecting built-in metrics
   * @param {number}  [opts.builtInIntervalMs=5000] - Collection interval for built-ins
   * @param {number}  [opts.maxSeriesPerMetric=10000]
   */
  constructor(opts = {}) {
    this._collectBuiltIns  = opts.collectBuiltIns !== false;
    this._builtInIntervalMs = opts.builtInIntervalMs ?? 5_000;
    this._maxSeries = opts.maxSeriesPerMetric ?? 10_000;

    /** @type {Map<string, MetricFamily>} name → MetricFamily */
    this._families = new Map();

    this._builtInTimer = null;

    if (this._collectBuiltIns) {
      this._initBuiltIns();
      this._startBuiltInCollection();
    }

    logger.info('[TelemetryCollector] initialized');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record a metric observation.
   * @param {object} metric
   * @param {string}  metric.name    - Metric name (snake_case)
   * @param {string}  metric.type    - 'counter'|'gauge'|'histogram'|'summary'
   * @param {number}  metric.value   - Numeric value
   * @param {object}  [metric.labels]  - Key/value label set
   * @param {string}  [metric.help]    - Description (used on first registration)
   * @param {number}  [metric.timestamp] - Unix ms (defaults to now)
   */
  record(metric) {
    const { name, type, value, labels = {}, help, timestamp } = metric;

    if (!name) throw new Error('metric.name is required');
    if (typeof value !== 'number') throw new Error(`metric.value must be a number (got ${typeof value})`);

    const validTypes = Object.values(METRIC_TYPES);
    const metricType = type || METRIC_TYPES.GAUGE;
    if (!validTypes.includes(metricType)) {
      throw new Error(`Invalid metric type: ${type}. Must be one of ${validTypes.join(', ')}`);
    }

    const family = this._getOrCreate(name, metricType, help);
    const labelKey = _labelKey(labels);
    const ts = timestamp || Date.now();

    switch (metricType) {
      case METRIC_TYPES.COUNTER:
        this._recordCounter(family, labelKey, labels, value, ts);
        break;
      case METRIC_TYPES.GAUGE:
        this._recordGauge(family, labelKey, labels, value, ts);
        break;
      case METRIC_TYPES.HISTOGRAM:
        this._recordHistogram(family, labelKey, labels, value, ts);
        break;
      case METRIC_TYPES.SUMMARY:
        this._recordSummary(family, labelKey, labels, value, ts);
        break;
    }
  }

  /**
   * Increment a counter by 1 (or custom amount).
   */
  inc(name, labels = {}, amount = 1) {
    this.record({ name, type: METRIC_TYPES.COUNTER, value: amount, labels });
  }

  /**
   * Set a gauge value.
   */
  set(name, value, labels = {}) {
    this.record({ name, type: METRIC_TYPES.GAUGE, value, labels });
  }

  /**
   * Observe a histogram value (e.g., latency in seconds).
   */
  observe(name, value, labels = {}) {
    this.record({ name, type: METRIC_TYPES.HISTOGRAM, value, labels });
  }

  /**
   * Query metrics with optional filter.
   * @param {object} filter
   * @param {string}  [filter.name]     - Exact name match
   * @param {string}  [filter.type]     - Filter by type
   * @param {object}  [filter.labels]   - Label subset match
   * @param {number}  [filter.since]    - Only observations after this Unix ms
   * @returns {object[]}
   */
  getMetrics(filter = {}) {
    const results = [];

    for (const [name, family] of this._families) {
      if (filter.name && name !== filter.name) continue;
      if (filter.type && family.type !== filter.type) continue;

      for (const [labelKey, series] of family.series) {
        if (filter.labels && !_matchLabels(series.labels, filter.labels)) continue;

        const snapshot = this._snapshotSeries(family, series, filter.since);
        results.push({ name, type: family.type, help: family.help, labels: series.labels, ...snapshot });
      }
    }

    return results;
  }

  /**
   * Prometheus text-format exposition.
   * @returns {string}
   */
  toPrometheusText() {
    const lines = [];

    for (const [name, family] of this._families) {
      if (family.help) lines.push(`# HELP ${name} ${family.help}`);
      lines.push(`# TYPE ${name} ${family.type}`);

      for (const [, series] of family.series) {
        const labelStr = _promLabelStr(series.labels);

        switch (family.type) {
          case METRIC_TYPES.COUNTER:
            lines.push(`${name}${labelStr} ${series.value}`);
            break;

          case METRIC_TYPES.GAUGE:
            lines.push(`${name}${labelStr} ${series.value}`);
            break;

          case METRIC_TYPES.HISTOGRAM: {
            const counts = series.bucketCounts || {};
            for (const le of series.buckets) {
              const bLabel = _promLabelStr({ ...series.labels, le: le === Infinity ? '+Inf' : String(le) });
              lines.push(`${name}_bucket${bLabel} ${counts[le] || 0}`);
            }
            lines.push(`${name}_sum${labelStr} ${series.sum || 0}`);
            lines.push(`${name}_count${labelStr} ${series.count || 0}`);
            break;
          }

          case METRIC_TYPES.SUMMARY: {
            for (const [q, v] of Object.entries(series.quantiles || {})) {
              const qLabel = _promLabelStr({ ...series.labels, quantile: q });
              lines.push(`${name}${qLabel} ${v}`);
            }
            lines.push(`${name}_sum${labelStr} ${series.sum || 0}`);
            lines.push(`${name}_count${labelStr} ${series.count || 0}`);
            break;
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Stop background collection.
   */
  stop() {
    if (this._builtInTimer) {
      clearInterval(this._builtInTimer);
      this._builtInTimer = null;
    }
    logger.info('[TelemetryCollector] stopped');
  }

  // ─── Built-in metrics ────────────────────────────────────────────────────────

  _initBuiltIns() {
    this._getOrCreate(BUILT_IN.REQUEST_TOTAL, METRIC_TYPES.COUNTER, 'Total HTTP requests');
    this._getOrCreate(BUILT_IN.REQUEST_DURATION, METRIC_TYPES.HISTOGRAM, 'HTTP request duration in seconds');
    this._getOrCreate(BUILT_IN.ERROR_TOTAL, METRIC_TYPES.COUNTER, 'Total errors');
    this._getOrCreate(BUILT_IN.MEMORY_BYTES, METRIC_TYPES.GAUGE, 'Process RSS memory bytes');
    this._getOrCreate(BUILT_IN.HEAP_BYTES, METRIC_TYPES.GAUGE, 'Process heap used bytes');
    this._getOrCreate(BUILT_IN.ACTIVE_CONNECTIONS, METRIC_TYPES.GAUGE, 'Active connections');
    this._getOrCreate(BUILT_IN.EVENT_LOOP_LAG, METRIC_TYPES.GAUGE, 'Event loop lag in seconds');
  }

  _startBuiltInCollection() {
    this._collectMemory();
    this._builtInTimer = setInterval(() => {
      this._collectMemory();
      this._collectEventLoopLag();
    }, this._builtInIntervalMs);
    this._builtInTimer.unref?.(); // don't block process exit
  }

  _collectMemory() {
    const mem = process.memoryUsage();
    this.set(BUILT_IN.MEMORY_BYTES, mem.rss);
    this.set(BUILT_IN.HEAP_BYTES, mem.heapUsed);
  }

  _collectEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e9;
      this.set(BUILT_IN.EVENT_LOOP_LAG, lag);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _getOrCreate(name, type, help) {
    if (!this._families.has(name)) {
      this._families.set(name, {
        name,
        type,
        help: help || '',
        series: new Map(),
      });
    }
    return this._families.get(name);
  }

  _getOrCreateSeries(family, labelKey, labels, extraDefaults = {}) {
    if (!family.series.has(labelKey)) {
      if (family.series.size >= this._maxSeries) {
        logger.warn('[TelemetryCollector] max series reached', { metric: family.name });
        // Evict oldest series
        const oldest = family.series.keys().next().value;
        family.series.delete(oldest);
      }
      family.series.set(labelKey, {
        labels: { ...labels },
        ...extraDefaults,
      });
    }
    return family.series.get(labelKey);
  }

  _recordCounter(family, labelKey, labels, value, _ts) {
    const series = this._getOrCreateSeries(family, labelKey, labels, { value: 0 });
    series.value += value;
    series.updatedAt = Date.now();
  }

  _recordGauge(family, labelKey, labels, value, _ts) {
    const series = this._getOrCreateSeries(family, labelKey, labels, { value: 0 });
    series.value = value;
    series.updatedAt = Date.now();
  }

  _recordHistogram(family, labelKey, labels, value, _ts) {
    const buckets = family.buckets || DEFAULT_BUCKETS;
    if (!family.buckets) family.buckets = buckets;

    const series = this._getOrCreateSeries(family, labelKey, labels, {
      buckets: [...buckets, Infinity],
      bucketCounts: Object.fromEntries([...buckets, Infinity].map(b => [b, 0])),
      sum: 0,
      count: 0,
      observations: [],
    });

    for (const le of series.buckets) {
      if (value <= le) series.bucketCounts[le]++;
    }
    series.sum += value;
    series.count++;
    series.updatedAt = Date.now();

    // Keep raw observations for quantile calculation, pruned by TTL
    const now = Date.now();
    series.observations.push({ v: value, ts: now });
    if (series.observations.length > 10000) {
      series.observations = series.observations.filter(o => now - o.ts < OBSERVATION_TTL);
    }
  }

  _recordSummary(family, labelKey, labels, value, _ts) {
    const series = this._getOrCreateSeries(family, labelKey, labels, {
      observations: [],
      sum: 0,
      count: 0,
      quantiles: {},
    });

    const now = Date.now();
    series.observations.push({ v: value, ts: now });
    series.sum += value;
    series.count++;
    series.updatedAt = now;

    // Prune old observations
    series.observations = series.observations.filter(o => now - o.ts < OBSERVATION_TTL);

    // Recalculate quantiles
    if (series.observations.length > 0) {
      const sorted = series.observations.map(o => o.v).sort((a, b) => a - b);
      series.quantiles = {
        '0.5':  _quantile(sorted, 0.5),
        '0.9':  _quantile(sorted, 0.9),
        '0.95': _quantile(sorted, 0.95),
        '0.99': _quantile(sorted, 0.99),
      };
    }
  }

  _snapshotSeries(family, series, since) {
    const base = { value: series.value, updatedAt: series.updatedAt };

    if (family.type === METRIC_TYPES.HISTOGRAM || family.type === METRIC_TYPES.SUMMARY) {
      base.sum   = series.sum;
      base.count = series.count;
    }

    if (family.type === METRIC_TYPES.HISTOGRAM) {
      base.buckets = series.bucketCounts;
    }

    if (family.type === METRIC_TYPES.SUMMARY) {
      base.quantiles = series.quantiles;
    }

    return base;
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function _labelKey(labels) {
  return Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
}

function _promLabelStr(labels) {
  if (!labels || Object.keys(labels).length === 0) return '';
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
  return `{${parts}}`;
}

function _matchLabels(seriesLabels, filterLabels) {
  return Object.entries(filterLabels).every(([k, v]) => seriesLabels[k] === v);
}

function _quantile(sorted, q) {
  const idx = Math.max(0, Math.ceil(sorted.length * q) - 1);
  return sorted[idx];
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { TelemetryCollector, METRIC_TYPES, BUILT_IN, DEFAULT_BUCKETS };
