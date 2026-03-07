'use strict';

/**
 * HeadyEmbed Health Module
 *
 * Provides structured health check data:
 *   - Model loaded status
 *   - Cache stats (size, hit rate)
 *   - Memory usage
 *   - Avg latency over last 100 requests
 *   - Uptime
 */

'use strict';

const os = require('os');

/**
 * Build a health check response object from a HeadyEmbed instance.
 *
 * @param {import('./index').HeadyEmbed} embedService
 * @returns {object} Health report
 */
function buildHealthReport(embedService) {
  const metrics = embedService.getMetrics();
  const health = embedService.getHealth();
  const mem = process.memoryUsage();
  const sysMem = {
    totalMb: (os.totalmem() / 1024 / 1024).toFixed(1),
    freeMb: (os.freemem() / 1024 / 1024).toFixed(1),
    usedPercent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1),
  };

  const cacheStats = metrics.cache;
  const latency = metrics.latency;

  // Determine overall status
  let status = 'healthy';
  const issues = [];

  if (!health.ready) {
    status = 'unavailable';
    issues.push('Service not initialized');
  }
  if (!health.model.loaded) {
    status = 'degraded';
    issues.push('Default model not loaded');
  }
  if (latency.p95 > 5000) {
    // p95 > 5s is concerning
    status = status === 'healthy' ? 'degraded' : status;
    issues.push(`High p95 latency: ${latency.p95}ms`);
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: {
      ms: health.uptime,
      human: formatUptime(health.uptime),
    },
    model: {
      id: health.model.id,
      loaded: health.model.loaded,
      loadTimeMs: metrics.modelLoadTimeMs,
    },
    cache: {
      size: cacheStats.size,
      maxSize: cacheStats.maxSize,
      utilizationPercent: cacheStats.maxSize > 0
        ? ((cacheStats.size / cacheStats.maxSize) * 100).toFixed(1)
        : '0.0',
      hitRate: (cacheStats.hitRate * 100).toFixed(2) + '%',
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      evictions: cacheStats.evictions,
      estimatedMemoryMb: cacheStats.estimatedMemoryMb,
    },
    latency: {
      avgMs: latency.avg,
      p50Ms: latency.p50,
      p95Ms: latency.p95,
      p99Ms: latency.p99,
      minMs: latency.min,
      maxMs: latency.max,
      samples: latency.samples,
    },
    memory: {
      process: {
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1),
        rssMb: (mem.rss / 1024 / 1024).toFixed(1),
        externalMb: (mem.external / 1024 / 1024).toFixed(1),
      },
      system: sysMem,
    },
    throughput: {
      totalEmbeddings: metrics.totalEmbeddings,
      errors: metrics.errors,
      errorRate: metrics.totalEmbeddings > 0
        ? ((metrics.errors / metrics.totalEmbeddings) * 100).toFixed(3) + '%'
        : '0.000%',
    },
    batch: {
      queueSize: metrics.batch.queueSize,
      activeBatches: metrics.batch.activeBatches,
      totalBatches: metrics.batch.totalBatches,
      dedupSavings: metrics.batch.dedupSavings,
      retries: metrics.batch.retries,
    },
    issues,
    version: getVersion(),
  };
}

/**
 * Build a minimal liveness probe response (fast, no heavy computation).
 */
function buildLivenessProbe(embedService) {
  return {
    alive: true,
    ready: embedService._ready,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a readiness probe response — is the service ready to serve traffic?
 */
function buildReadinessProbe(embedService) {
  const ready = embedService._ready && embedService._modelManager.isLoaded(embedService._config.model);
  return {
    ready,
    model: embedService._config.model,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function getVersion() {
  try {
    // Try to read version from package.json up the tree
    const pkg = require('../../../package.json');
    return pkg.version || '0.0.0';
  } catch (_) {
    return '0.0.0';
  }
}

module.exports = {
  buildHealthReport,
  buildLivenessProbe,
  buildReadinessProbe,
};
