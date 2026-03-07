/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const http   = require('http');
const https  = require('https');
const logger = require('../utils/logger').child('health-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/**
 * PHI-scaled probe timeout (ms).
 * PHI * 1000 ≈ 1618ms — generous enough to avoid false positives.
 */
const PROBE_TIMEOUT_MS = Math.round(PHI * 1000);

/**
 * Circuit-breaker: after this many consecutive failures the service is
 * considered "open" (no further probes until it recovers).
 */
const CIRCUIT_OPEN_THRESHOLD = Math.round(PHI * PHI); // ≈ 2 (phi²)

/**
 * Anomaly: a component whose health score drops below this threshold is flagged.
 * PHI-scaled: 1 / PHI² ≈ 0.382
 */
const ANOMALY_THRESHOLD = 1 / (PHI * PHI);

// ---------------------------------------------------------------------------
// Service registry
// ---------------------------------------------------------------------------

/**
 * Return the registered services list.
 * Prefers global.serviceRegistry; falls back to a hard-coded default set
 * covering the core HeadyAI components.
 */
function getServices() {
  if (global.serviceRegistry && typeof global.serviceRegistry.list === 'function') {
    return global.serviceRegistry.list();
  }
  if (global.serviceRegistry && Array.isArray(global.serviceRegistry)) {
    return global.serviceRegistry;
  }
  // Default built-in services
  return [
    { name: 'api-gateway',      url: 'http://localhost:3000/health', critical: true  },
    { name: 'vector-store',     url: 'http://localhost:3001/health', critical: true  },
    { name: 'swarm-coordinator',url: 'http://localhost:3002/health', critical: true  },
    { name: 'task-runner',      url: 'http://localhost:3003/health', critical: false },
    { name: 'telemetry-sink',   url: 'http://localhost:3004/health', critical: false },
  ];
}

// ---------------------------------------------------------------------------
// Circuit-breaker state  (in-process per service name)
// ---------------------------------------------------------------------------
const _circuitBreakers = new Map(); // name -> { failures, open, openSince }

function getCircuit(name) {
  if (!_circuitBreakers.has(name)) {
    _circuitBreakers.set(name, { failures: 0, open: false, openSince: null });
  }
  return _circuitBreakers.get(name);
}

function recordSuccess(name) {
  const cb = getCircuit(name);
  cb.failures  = 0;
  cb.open      = false;
  cb.openSince = null;
}

function recordFailure(name) {
  const cb = getCircuit(name);
  cb.failures++;
  if (cb.failures >= CIRCUIT_OPEN_THRESHOLD && !cb.open) {
    cb.open      = true;
    cb.openSince = Date.now();
    logger.warn('Circuit breaker opened', { service: name, failures: cb.failures });
  }
}

// ---------------------------------------------------------------------------
// HTTP probe helper
// ---------------------------------------------------------------------------

/**
 * HTTP/HTTPS GET probe with timeout.
 * Resolves with { ok, statusCode, latencyMs } or rejects on error/timeout.
 */
function probe(url) {
  return new Promise((resolve) => {
    const start   = Date.now();
    const lib     = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      resolve({ ok: false, statusCode: null, latencyMs: Date.now() - start, error: 'timeout' });
    }, PROBE_TIMEOUT_MS);

    const req = lib.get(url, (res) => {
      clearTimeout(timeout);
      res.resume(); // drain body
      const latencyMs = Date.now() - start;
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode, latencyMs });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, statusCode: null, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

/**
 * Worker: probe-services
 * Health-checks every registered service with circuit-breaker protection.
 */
function makeProbeServicesWorker() {
  return async function probeServices() {
    const tag      = 'probe-services';
    logger.debug(`[${tag}] starting`);

    const services = getServices();
    const results  = {};

    await Promise.all(services.map(async (svc) => {
      const cb = getCircuit(svc.name);

      if (cb.open) {
        // Circuit is open — skip probe, return cached failure
        results[svc.name] = {
          status:    'circuit-open',
          ok:        false,
          critical:  svc.critical ?? false,
          openSince: cb.openSince,
          failures:  cb.failures,
        };
        return;
      }

      const probeResult = await probe(svc.url);

      if (probeResult.ok) {
        recordSuccess(svc.name);
        results[svc.name] = {
          status:    'healthy',
          ok:        true,
          statusCode: probeResult.statusCode,
          latencyMs:  probeResult.latencyMs,
          critical:   svc.critical ?? false,
        };
      } else {
        recordFailure(svc.name);
        results[svc.name] = {
          status:    'unhealthy',
          ok:        false,
          statusCode: probeResult.statusCode,
          latencyMs:  probeResult.latencyMs,
          error:      probeResult.error,
          critical:   svc.critical ?? false,
          failures:   getCircuit(svc.name).failures,
        };
        logger.warn(`[${tag}] service unhealthy`, { service: svc.name, ...probeResult });
      }
    }));

    const result = {
      worker:     tag,
      capturedAt: Date.now(),
      services:   results,
      healthy:    Object.values(results).filter(r => r.ok).length,
      unhealthy:  Object.values(results).filter(r => !r.ok).length,
      total:      services.length,
    };

    logger.info(`[${tag}] completed`, {
      healthy:  result.healthy,
      unhealthy: result.unhealthy,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:health', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: aggregate-health
 * Computes a weighted overall system health score using CSL superposition.
 * Critical services carry higher weight (PHI × base weight).
 */
function makeAggregateHealthWorker() {
  return async function aggregateHealth() {
    const tag = 'aggregate-health';
    logger.debug(`[${tag}] starting`);

    const services = getServices();
    const weights  = [];

    for (const svc of services) {
      const cb    = getCircuit(svc.name);
      const alive = !cb.open && cb.failures === 0;
      const w     = svc.critical ? PHI : 1;
      weights.push({ value: alive ? 1 : 0, weight: w });
    }

    const totalWeight  = weights.reduce((s, w) => s + w.weight, 0);
    const normWeights  = weights.map(w => ({ ...w, weight: w.weight / (totalWeight || 1) }));
    const overallScore = CSL.weighted_superposition(normWeights);

    // Use CSL route_gate to classify system status
    const systemStatus = CSL.route_gate(overallScore, [
      { threshold: 1.0,   label: 'nominal'   },
      { threshold: 1/PHI, label: 'degraded'  },
      { threshold: 0,     label: 'critical'  },
    ]);

    const result = {
      worker:       tag,
      capturedAt:   Date.now(),
      overallScore,
      systemStatus: systemStatus || 'critical',
      serviceCount: services.length,
      circuitBreakerSummary: {
        open:   [..._circuitBreakers.values()].filter(c => c.open).length,
        closed: [..._circuitBreakers.values()].filter(c => !c.open).length,
      },
    };

    logger.info(`[${tag}] completed`, {
      overallScore: overallScore.toFixed(4),
      systemStatus: result.systemStatus,
    });

    if (global.eventBus) {
      global.eventBus.emit('health:score', { score: overallScore, status: result.systemStatus });
      global.eventBus.emit('projection:health', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: detect-anomalies
 * Flags services whose health scores fall below the PHI-scaled anomaly
 * threshold, and emits alert events for critical failures.
 */
function makeDetectAnomaliesWorker() {
  // Rolling health history (last N readings per service)
  const WINDOW = Math.round(PHI * PHI * PHI * 10); // ≈ 42
  const _history = new Map(); // name -> number[]

  return async function detectAnomalies() {
    const tag = 'detect-anomalies';
    logger.debug(`[${tag}] starting`);

    const services  = getServices();
    const anomalies = [];

    for (const svc of services) {
      const cb    = getCircuit(svc.name);
      const score = cb.open ? 0 : cb.failures === 0 ? 1 : Math.max(0, 1 - cb.failures / CIRCUIT_OPEN_THRESHOLD);

      // Maintain rolling window
      if (!_history.has(svc.name)) _history.set(svc.name, []);
      const hist = _history.get(svc.name);
      hist.push(score);
      if (hist.length > WINDOW) hist.shift();

      // Compute rolling average
      const avg = hist.reduce((s, v) => s + v, 0) / hist.length;

      // CSL soft_gate: anomaly if avg is well below threshold
      const anomalySignal = CSL.soft_gate(ANOMALY_THRESHOLD - avg, ANOMALY_THRESHOLD * 0.1);
      const isAnomaly     = avg < ANOMALY_THRESHOLD;

      if (isAnomaly) {
        const anomaly = {
          service:     svc.name,
          avgScore:    avg,
          threshold:   ANOMALY_THRESHOLD,
          signal:      anomalySignal,
          critical:    svc.critical ?? false,
          failures:    cb.failures,
          circuitOpen: cb.open,
        };
        anomalies.push(anomaly);
        logger.warn(`[${tag}] anomaly detected`, anomaly);

        if (global.eventBus) {
          global.eventBus.emit('health:anomaly', anomaly);
          if (svc.critical) {
            global.eventBus.emit('health:critical-anomaly', anomaly);
          }
        }
      }
    }

    const result = {
      worker:       tag,
      capturedAt:   Date.now(),
      anomalies,
      anomalyCount: anomalies.length,
      threshold:    ANOMALY_THRESHOLD,
      windowSize:   WINDOW,
    };

    logger.info(`[${tag}] completed`, { anomalyCount: result.anomalyCount });

    if (global.eventBus) {
      global.eventBus.emit('projection:health', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'health-projection';
const description = 'Projects service health across all components: HTTP probes with circuit-breaker, aggregate scoring, and PHI-threshold anomaly detection.';
const priority    = 1.0; // highest — critical

function getWork() {
  return [
    makeProbeServicesWorker(),
    makeAggregateHealthWorker(),
    makeDetectAnomaliesWorker(),
  ];
}

module.exports = { domain, description, priority, getWork };
