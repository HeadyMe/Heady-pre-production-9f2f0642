
// ╔══════════════════════════════════════════════════════════════════╗
// ║  FILE: heady-lens.js - Heady Systems Metrics & Observability     ║
// ╚══════════════════════════════════════════════════════════════════╝

const EventEmitter = require('events');

class HeadyLens extends EventEmitter {
  constructor(options = {}) {
    super();
    this.namespace = options.namespace || 'heady';
    this.metrics = new Map();
    this.timers = new Map();
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
  }

  recordMetric(metric, value, tags = {}) {
    if (!this.enabled) return;
    const key = `${this.namespace}.${metric}`;
    const entry = {
      metric: key,
      value,
      tags,
      timestamp: Date.now()
    };
    if (!this.metrics.has(key)) this.metrics.set(key, []);
    const history = this.metrics.get(key);
    history.push(entry);
    if (history.length > 1000) history.shift();
    if (this.verbose) console.log(`[HeadyLens] ${key}: ${value}`);
    this.emit('metric', entry);
  }

  increment(metric, amount = 1, tags = {}) {
    const key = `${this.namespace}.${metric}`;
    const current = this.getLatest(metric) || 0;
    this.recordMetric(metric, current + amount, tags);
  }

  startTimer(label) {
    this.timers.set(label, Date.now());
  }

  endTimer(label, tags = {}) {
    const start = this.timers.get(label);
    if (!start) return 0;
    const duration = Date.now() - start;
    this.timers.delete(label);
    this.recordMetric(`timer.${label}`, duration, tags);
    return duration;
  }

  getLatest(metric) {
    const key = `${this.namespace}.${metric}`;
    const history = this.metrics.get(key);
    if (!history || history.length === 0) return null;
    return history[history.length - 1].value;
  }

  getHistory(metric, limit = 100) {
    const key = `${this.namespace}.${metric}`;
    const history = this.metrics.get(key) || [];
    return history.slice(-limit);
  }

  getStats(metric) {
    const history = this.getHistory(metric);
    if (history.length === 0) return null;
    const values = history.map(h => h.value);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1]
    };
  }

  getAllMetrics() {
    const result = {};
    for (const [key, history] of this.metrics) {
      if (history.length > 0) {
        result[key] = history[history.length - 1].value;
      }
    }
    return result;
  }

  reset() {
    this.metrics.clear();
    this.timers.clear();
  }
}

const defaultLens = new HeadyLens({ namespace: 'heady', verbose: false });

module.exports = defaultLens;
module.exports.HeadyLens = HeadyLens;
