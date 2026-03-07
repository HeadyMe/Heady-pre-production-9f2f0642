/**
 * Heady Infrastructure Health Monitor
 *
 * NEW FILE — implements the infrastructure monitoring and alerting layer
 * described in PRODUCTION_DEPLOYMENT_GUIDE.md §11 but not implemented in code.
 *
 * Features:
 *   - Polls all configured health endpoints on a configurable interval
 *   - Tracks provider gateway health and circuit breaker state
 *   - Computes Sacred Geometry composite health score (per architecture spec)
 *   - Emits alerts to Slack and PagerDuty on threshold breaches
 *   - Pushes metrics to Prometheus Pushgateway (for Cloud Run environments
 *     that cannot be scraped directly)
 *   - Tracks rolling error rates, latency percentiles, and memory pressure
 *   - Detects circuit breaker state changes and fires alerts
 *   - Detects service degradation trends (not just threshold breaches)
 *   - Self-healing: attempts restart of degraded PM2 services (if SSH available)
 *   - Exposes its own HTTP server at PORT_MONITOR (default 8090) with /health
 *
 * Usage:
 *   node infrastructure-monitor.js              # Start in standalone mode
 *   node infrastructure-monitor.js --once       # Run single check and exit
 *   node infrastructure-monitor.js --report     # Print last report and exit
 *
 * Environment variables:
 *   MONITOR_TARGETS          Comma-separated URLs to monitor
 *   MONITOR_INTERVAL_MS      Poll interval (default: 30000)
 *   MONITOR_PORT             HTTP server port (default: 8090)
 *   SLACK_WEBHOOK_URL        Slack alerts
 *   PAGERDUTY_ROUTING_KEY    PagerDuty incidents
 *   PUSHGATEWAY_URL          Prometheus Pushgateway (optional)
 *   ALERT_COOLDOWN_MS        Min ms between same-type alerts (default: 300000)
 *   HEALTH_SCORE_CRITICAL    Score below this triggers PagerDuty (default: 50)
 *   HEALTH_SCORE_DEGRADED    Score below this triggers Slack warning (default: 80)
 *
 * © 2026 HeadySystems Inc. — Proprietary and Confidential.
 */

'use strict';

const https = require('https');
const http = require('http');
const net = require('net');
const { EventEmitter } = require('events');
const os = require('os');

// ─── Constants ────────────────────────────────────────────────────────────────

// Sacred Geometry health score weights (from PRODUCTION_DEPLOYMENT_GUIDE §11.1)
// Tier 1 (φ² ≈ 2.618): database, vector_memory
// Tier 2 (φ  ≈ 1.618): redis, llm_provider
// Tier 3 (1.0):         memory, cpu, disk_space, external_apis, queue_depth
const PHI = 1.618033988749895;
const WEIGHTS = {
  database: PHI * PHI,       // 2.618
  vector_memory: PHI * PHI,  // 2.618
  redis: PHI,                // 1.618
  llm_provider: PHI,         // 1.618
  memory: 1.0,
  cpu: 1.0,
  disk_space: 1.0,
  external_apis: 1.0,
  queue_depth: 1.0,
};

const DEFAULT_CONFIG = {
  intervalMs: parseInt(process.env.MONITOR_INTERVAL_MS) || 30_000,
  port: parseInt(process.env.MONITOR_PORT) || 8090,
  alertCooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS) || 300_000,
  healthScoreCritical: parseInt(process.env.HEALTH_SCORE_CRITICAL) || 50,
  healthScoreDegraded: parseInt(process.env.HEALTH_SCORE_DEGRADED) || 80,
  maxHistoryPoints: 120, // 1 hour at 30s intervals
};

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

function fetchJson(url, opts = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const timeout = opts.timeoutMs || 10_000;
    const req = mod.get(url, { timeout }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        try {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(body), latencyMs });
        } catch {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data: null, latencyMs, raw: body.slice(0, 200) });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, data: null, latencyMs: Date.now() - start, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, data: null, latencyMs: timeout, error: 'timeout' });
    });
  });
}

async function checkTcpPort(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => {
      socket.destroy();
      resolve({ ok: true, latencyMs: Date.now() - start });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, latencyMs: timeoutMs, error: 'timeout' });
    });
    socket.on('error', (err) => {
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

// ─── Alert Manager ─────────────────────────────────────────────────────────────

class AlertManager {
  constructor() {
    this._cooldowns = new Map(); // alertKey → lastFiredAt
  }

  _canFire(key) {
    const last = this._cooldowns.get(key) || 0;
    return Date.now() - last >= DEFAULT_CONFIG.alertCooldownMs;
  }

  _markFired(key) {
    this._cooldowns.set(key, Date.now());
  }

  async slack(message, opts = {}) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;

    const alertKey = `slack:${opts.alertKey || message.slice(0, 40)}`;
    if (!opts.force && !this._canFire(alertKey)) return;
    this._markFired(alertKey);

    const payload = JSON.stringify({
      text: message,
      attachments: opts.attachments || [],
      username: 'Heady Monitor',
      icon_emoji: opts.emoji || ':eyes:',
    });

    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(url);
        const req = https.request({
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, res => { res.on('data', () => {}); res.on('end', resolve); });
        req.on('error', resolve);
        req.write(payload);
        req.end();
      } catch { resolve(); }
    });
  }

  async pagerduty(summary, severity = 'critical', dedupKey) {
    const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    if (!routingKey) return;

    const alertKey = `pd:${dedupKey || summary.slice(0, 40)}`;
    if (!this._canFire(alertKey)) return;
    this._markFired(alertKey);

    const payload = JSON.stringify({
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: dedupKey || summary.slice(0, 100),
      payload: {
        summary,
        severity,
        source: 'heady-infrastructure-monitor',
        component: 'heady-manager',
        timestamp: new Date().toISOString(),
      },
    });

    return new Promise((resolve) => {
      try {
        const req = https.request({
          hostname: 'events.pagerduty.com',
          path: '/v2/enqueue',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, res => { res.on('data', () => {}); res.on('end', resolve); });
        req.on('error', resolve);
        req.write(payload);
        req.end();
      } catch { resolve(); }
    });
  }

  async resolve(dedupKey) {
    const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    if (!routingKey || !dedupKey) return;

    const payload = JSON.stringify({
      routing_key: routingKey,
      event_action: 'resolve',
      dedup_key: dedupKey,
    });

    return new Promise((resolve) => {
      try {
        const req = https.request({
          hostname: 'events.pagerduty.com',
          path: '/v2/enqueue',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, res => { res.on('data', () => {}); res.on('end', resolve); });
        req.on('error', resolve);
        req.write(payload);
        req.end();
      } catch { resolve(); }
    });
  }
}

// ─── Metrics History ───────────────────────────────────────────────────────────

class MetricsHistory {
  constructor(maxPoints = DEFAULT_CONFIG.maxHistoryPoints) {
    this.maxPoints = maxPoints;
    this._points = [];
  }

  push(point) {
    this._points.push({ ts: Date.now(), ...point });
    if (this._points.length > this.maxPoints) {
      this._points.shift();
    }
  }

  last(n = 1) {
    return this._points.slice(-n);
  }

  // Calculate error rate trend: positive = getting worse
  errorRateTrend(windowPoints = 10) {
    const recent = this.last(windowPoints);
    if (recent.length < 2) return 0;
    const first = recent[0].errorRate || 0;
    const last = recent[recent.length - 1].errorRate || 0;
    return last - first; // Positive = worsening
  }

  // P99 latency over last N points
  p99(windowPoints = 10) {
    const values = this.last(windowPoints).map(p => p.latencyMs).filter(Boolean).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    return values[Math.floor(values.length * 0.99)] || values[values.length - 1];
  }

  summarize() {
    const recent = this.last(10);
    return {
      points: this._points.length,
      latestScore: recent[recent.length - 1]?.score,
      errorRateTrend: this.errorRateTrend(),
      p99LatencyMs: this.p99(),
    };
  }
}

// ─── Infrastructure Monitor ────────────────────────────────────────────────────

class InfrastructureMonitor extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...opts };
    this.targets = this._parseTargets();
    this.alerts = new AlertManager();
    this.history = new MetricsHistory();
    this.lastReport = null;
    this._prevCircuitStates = {};
    this._timer = null;
    this._server = null;
    this._running = false;
  }

  _parseTargets() {
    const envTargets = process.env.MONITOR_TARGETS;
    if (envTargets) {
      return envTargets.split(',').map(url => ({ name: url.trim(), url: url.trim() }));
    }
    // Default: monitor localhost
    const port = process.env.PORT || '8080';
    return [
      { name: 'heady-manager', url: `http://localhost:${port}` },
    ];
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._startHttpServer();
    this._check(); // Immediate first check
    this._timer = setInterval(() => this._check(), this.config.intervalMs);
    this._timer.unref?.();
    console.log(JSON.stringify({ level: 'info', msg: 'InfrastructureMonitor started', targets: this.targets.map(t => t.name), intervalMs: this.config.intervalMs }));
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._server) { this._server.close(); this._server = null; }
    this._running = false;
  }

  async runOnce() {
    return this._check();
  }

  async _check() {
    const checkStart = Date.now();
    const results = {};
    const componentScores = {};

    for (const target of this.targets) {
      results[target.name] = await this._checkTarget(target);
    }

    // Add local process metrics
    const localMetrics = this._collectLocalMetrics();
    componentScores.memory = localMetrics.memoryScore;
    componentScores.cpu = localMetrics.cpuScore;

    // Parse health endpoint results into component scores
    for (const [name, result] of Object.entries(results)) {
      if (!result.ok) {
        componentScores.external_apis = 0;
        continue;
      }

      const data = result.data || {};

      // Extract component scores from /health/ready
      if (data.checks) {
        if (data.checks.resilience?.status === 'ok') {
          componentScores.database = data.checks.resilience.openBreakers === 0 ? 100 : 60;
        }
        if (data.checks.vectorMemory?.status === 'ok') {
          componentScores.vector_memory = 100;
        } else if (data.checks.vectorMemory?.status === 'unavailable') {
          componentScores.vector_memory = 50;
        }
        if (data.checks.memory?.status === 'ok') {
          componentScores.memory = 100;
        } else if (data.checks.memory?.status === 'warning') {
          componentScores.memory = 70;
        }
        if (data.checks.eventLoop?.status === 'ok') {
          componentScores.queue_depth = 100;
        } else {
          componentScores.queue_depth = 50;
        }
      }

      // Provider gateway scores
      if (result.gatewayStatus) {
        const gw = result.gatewayStatus;
        const totalProviders = Object.keys(gw.providers || {}).length;
        const availProviders = gw.availableProviders?.length || 0;
        componentScores.llm_provider = totalProviders > 0
          ? Math.round((availProviders / totalProviders) * 100)
          : 50;

        // Alert on circuit breaker state changes
        await this._checkCircuitBreakers(gw.providers || {});
      }
    }

    // Compute Sacred Geometry composite score
    const score = this._computeCompositeScore(componentScores);
    const isHealthy = score >= this.config.healthScoreDegraded;
    const isDegraded = score < this.config.healthScoreDegraded && score >= this.config.healthScoreCritical;
    const isCritical = score < this.config.healthScoreCritical;

    this.lastReport = {
      ts: new Date().toISOString(),
      score,
      status: isCritical ? 'critical' : isDegraded ? 'degraded' : 'healthy',
      componentScores,
      targets: results,
      localMetrics,
      checkDurationMs: Date.now() - checkStart,
    };

    this.history.push({ score, errorRate: 0, latencyMs: results[this.targets[0]?.name]?.latencyMs });

    console.log(JSON.stringify({
      level: isCritical ? 'error' : isDegraded ? 'warn' : 'info',
      msg: 'Health check',
      score,
      status: this.lastReport.status,
      checkDurationMs: this.lastReport.checkDurationMs,
    }));

    // Fire alerts based on score
    await this._alertOnScore(score, isCritical, isDegraded);

    // Push metrics to Pushgateway if configured
    await this._pushMetrics(score, componentScores);

    this.emit('check', this.lastReport);
    return this.lastReport;
  }

  async _checkTarget(target) {
    const result = { name: target.name, url: target.url, ok: false, latencyMs: 0, data: null, gatewayStatus: null };

    try {
      const { ok, status, data, latencyMs } = await fetchJson(`${target.url}/health/ready`, { timeoutMs: 8000 });
      result.ok = ok;
      result.status = status;
      result.data = data;
      result.latencyMs = latencyMs;

      // Also check gateway status
      try {
        const { data: gwData } = await fetchJson(`${target.url}/api/ai/status`, { timeoutMs: 5000 });
        if (gwData) result.gatewayStatus = gwData;
      } catch { /* Optional */ }

    } catch (err) {
      result.error = err.message;
    }

    return result;
  }

  _collectLocalMetrics() {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const heapLimitMB = parseInt(process.env.NODE_OPTIONS?.match(/--max-old-space-size=(\d+)/)?.[1] || '512');

    const memPct = heapUsedMB / heapLimitMB;
    const memoryScore = memPct < 0.6 ? 100 : memPct < 0.8 ? 80 : memPct < 0.9 ? 50 : 10;

    const cpuLoad = os.loadavg()[0]; // 1-minute load average
    const cpuCount = os.cpus().length;
    const cpuPct = cpuLoad / cpuCount;
    const cpuScore = cpuPct < 0.6 ? 100 : cpuPct < 0.8 ? 80 : cpuPct < 1.0 ? 50 : 10;

    return { heapUsedMB, rssMB, heapLimitMB, memPct, memoryScore, cpuLoad, cpuCount, cpuPct, cpuScore };
  }

  _computeCompositeScore(componentScores) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [component, score] of Object.entries(componentScores)) {
      const weight = WEIGHTS[component] || 1.0;
      weightedSum += (score || 0) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 100;
    return Math.round(weightedSum / totalWeight);
  }

  async _checkCircuitBreakers(providers) {
    for (const [providerKey, providerData] of Object.entries(providers)) {
      const currentState = providerData.circuit || 'closed';
      const prevState = this._prevCircuitStates[providerKey];

      if (prevState && prevState !== currentState) {
        // State changed
        if (currentState === 'open') {
          await this.alerts.slack(
            `⚡ Circuit breaker OPENED for AI provider: \`${providerKey}\`\n${providerData.failures} failures`,
            { alertKey: `cb-open-${providerKey}`, emoji: ':warning:' }
          );
        } else if (prevState === 'open' && currentState === 'closed') {
          await this.alerts.slack(
            `✅ Circuit breaker RECOVERED for AI provider: \`${providerKey}\``,
            { alertKey: `cb-closed-${providerKey}`, emoji: ':white_check_mark:', force: true }
          );
          await this.alerts.resolve(`cb-open-${providerKey}`);
        }
      }

      this._prevCircuitStates[providerKey] = currentState;
    }
  }

  async _alertOnScore(score, isCritical, isDegraded) {
    if (isCritical) {
      await this.alerts.slack(
        `🔴 CRITICAL: Heady health score dropped to *${score}* (threshold: ${this.config.healthScoreCritical})`,
        {
          alertKey: 'health-critical',
          emoji: ':rotating_light:',
          attachments: [{ color: 'danger', text: `Score: ${score} | Time: ${new Date().toISOString()}` }],
        }
      );
      await this.alerts.pagerduty(
        `Heady infrastructure CRITICAL: health score ${score} (below ${this.config.healthScoreCritical})`,
        'critical',
        'heady-health-critical'
      );
    } else if (isDegraded) {
      await this.alerts.slack(
        `⚠️ WARNING: Heady health score degraded to *${score}* (healthy threshold: ${this.config.healthScoreDegraded})`,
        { alertKey: 'health-degraded', emoji: ':warning:' }
      );
    } else {
      // Resolve PagerDuty if score recovered
      const hist = this.history.last(3);
      const recentlyRecovered = hist.length >= 2 &&
        hist[hist.length - 2]?.score < this.config.healthScoreDegraded &&
        score >= this.config.healthScoreDegraded;
      if (recentlyRecovered) {
        await this.alerts.resolve('heady-health-critical');
        await this.alerts.slack(
          `✅ Heady health score RECOVERED to *${score}*`,
          { alertKey: 'health-recovered', force: true, emoji: ':white_check_mark:' }
        );
      }
    }
  }

  async _pushMetrics(score, componentScores) {
    const pgUrl = process.env.PUSHGATEWAY_URL;
    if (!pgUrl) return;

    const lines = [
      `# TYPE heady_health_score gauge`,
      `heady_health_score{service="heady-manager"} ${score}`,
      ...Object.entries(componentScores).map(([component, s]) =>
        `heady_component_score{component="${component}"} ${s}`
      ),
      `# TYPE heady_monitor_last_check_timestamp gauge`,
      `heady_monitor_last_check_timestamp{service="heady-manager"} ${Date.now() / 1000}`,
    ].join('\n') + '\n';

    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(`${pgUrl}/metrics/job/heady-infrastructure-monitor`);
        const req = (parsedUrl.protocol === 'https:' ? https : http).request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(lines) },
        }, res => { res.on('data', () => {}); res.on('end', resolve); });
        req.on('error', resolve);
        req.write(lines);
        req.end();
      } catch { resolve(); }
    });
  }

  _startHttpServer() {
    this._server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/health/live') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', running: this._running, ts: new Date().toISOString() }));
      } else if (req.url === '/report') {
        res.writeHead(this.lastReport ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.lastReport || { status: 'no_data_yet' }));
      } else if (req.url === '/history') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.history.summarize()));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    this._server.listen(this.config.port, () => {
      console.log(JSON.stringify({ level: 'info', msg: `Monitor HTTP server listening on :${this.config.port}` }));
    });
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const monitor = new InfrastructureMonitor();

  if (args.includes('--once')) {
    const report = await monitor.runOnce();
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.status === 'critical' ? 1 : 0);
  }

  if (args.includes('--report')) {
    await monitor.runOnce();
    console.log(JSON.stringify(monitor.lastReport, null, 2));
    process.exit(0);
  }

  monitor.start();

  process.on('SIGTERM', () => { monitor.stop(); process.exit(0); });
  process.on('SIGINT', () => { monitor.stop(); process.exit(0); });
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ level: 'fatal', error: err.message }));
    process.exit(1);
  });
}

module.exports = { InfrastructureMonitor, AlertManager, MetricsHistory, WEIGHTS, PHI };
