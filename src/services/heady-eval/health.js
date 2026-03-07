'use strict';

/**
 * HeadyEval Health & Metrics
 *
 * GET /health  — liveness + readiness check
 * GET /metrics — service metrics (runs, scorers, judge stats)
 */

const os = require('os');
const config = require('./config');

const SERVICE_START_TIME = Date.now();

/**
 * Health check handler
 */
async function check(req, res, evalInstance) {
  const checks = {};
  let overallHealthy = true;

  // Check HeadyInfer reachability (lightweight)
  checks.heady_infer = await pingService(config.headyInferUrl + '/health');
  if (!checks.heady_infer.healthy) overallHealthy = false;

  // HeadyEmbed (non-fatal)
  checks.heady_embed = await pingService(config.headyEmbedUrl + '/health', { required: false });

  // HeadyGuard (non-fatal)
  checks.heady_guard = await pingService(config.headyGuardUrl + '/health', { required: false });

  // Memory check
  const memUsage = process.memoryUsage();
  const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPct = heapUsedMb / heapTotalMb;
  checks.memory = {
    healthy: heapPct < 0.9,
    heapUsedMb,
    heapTotalMb,
    heapPercent: `${Math.round(heapPct * 100)}%`,
  };
  if (!checks.memory.healthy) overallHealthy = false;

  const statusCode = overallHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: overallHealthy ? 'healthy' : 'degraded',
    service: config.serviceName,
    version: config.serviceVersion,
    uptime: Math.round((Date.now() - SERVICE_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    checks,
    runs: evalInstance
      ? {
          total: evalInstance.listRuns().length,
          running: evalInstance.listRuns().filter((r) => r.status === 'running').length,
        }
      : null,
  });
}

/**
 * Metrics handler
 */
async function metrics(req, res, evalInstance) {
  const memUsage = process.memoryUsage();
  const runs = evalInstance ? evalInstance.listRuns() : [];

  const runStats = {
    total: runs.length,
    pending: runs.filter((r) => r.status === 'pending').length,
    running: runs.filter((r) => r.status === 'running').length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
  };

  const judgeStats = evalInstance ? evalInstance.getJudgeStats() : {};

  res.json({
    service: config.serviceName,
    version: config.serviceVersion,
    uptime: Math.round((Date.now() - SERVICE_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    node: {
      version: process.version,
      pid: process.pid,
      platform: process.platform,
      arch: process.arch,
    },
    system: {
      loadAvg: os.loadavg(),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      cpus: os.cpus().length,
    },
    process: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      externalMb: Math.round(memUsage.external / 1024 / 1024),
    },
    runs: runStats,
    judge: judgeStats,
    config: {
      concurrency: config.concurrency,
      judgeModel: config.judgeModel,
      defaultScorers: config.defaultScorers,
      port: config.port,
      phi: config.phi,
    },
  });
}

/**
 * Ping a downstream service and return health status.
 */
async function pingService(url, { required = true, timeoutMs = 3000 } = {}) {
  const start = Date.now();
  try {
    const http = require('http');
    const https = require('https');
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const result = await new Promise((resolve, reject) => {
      const req = transport.get(url, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
    });

    return {
      healthy: result.status >= 200 && result.status < 300,
      status: result.status,
      latencyMs: Date.now() - start,
      required,
    };
  } catch (err) {
    return {
      healthy: false,
      error: err.message,
      latencyMs: Date.now() - start,
      required,
    };
  }
}

module.exports = { check, metrics, pingService };
