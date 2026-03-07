'use strict';

/**
 * HeadyChain Health Check
 * Provides liveness and readiness health status.
 */

const config = require('./config');
const { globalRegistry } = require('./tools');

const startTime = Date.now();

/**
 * Build comprehensive health status.
 */
async function getHealth(chain) {
  const now = Date.now();
  const uptimeMs = now - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  const metrics = chain ? chain.getMetrics() : {};
  const toolCount = globalRegistry.list().length;

  // Memory usage
  const mem = process.memoryUsage();

  return {
    status: 'healthy',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeSec),
    },
    phi: config.PHI,
    metrics: {
      ...metrics,
      tools: toolCount,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      pid: process.pid,
    },
    config: {
      maxParallelNodes: config.MAX_PARALLEL_NODES,
      defaultNodeTimeoutMs: config.DEFAULT_NODE_TIMEOUT_MS,
      defaultWorkflowTimeoutMs: config.DEFAULT_WORKFLOW_TIMEOUT_MS,
      maxWorkflowSteps: config.MAX_WORKFLOW_STEPS,
      checkpointEnabled: config.CHECKPOINT_ENABLED,
      reactMaxIterations: config.REACT_MAX_ITERATIONS,
    },
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Liveness probe — returns 200 if process is alive.
 */
function liveness(req, res) {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
}

/**
 * Readiness probe — returns 200 if service is ready to accept traffic.
 */
function readiness(req, res) {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
}

module.exports = { getHealth, liveness, readiness };
