/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unified Structured Logger — P4 Observability Assessment Item
 *
 * Replaces all unstructured console.log/warn/error with structured JSON output.
 * Supports log levels, service tags, trace IDs, and metrics emission.
 */

const crypto = require('crypto');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const LEVEL_NAMES = Object.keys(LOG_LEVELS);

class StructuredLogger {
    constructor(service = 'heady', options = {}) {
        this.service = service;
        this.minLevel = LOG_LEVELS[options.level || 'info'] || 1;
        this.metrics = {
            totalLogs: 0,
            byLevel: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
            byService: {},
        };
        this.circuitBreakerState = {};
        this.cacheHitCounters = {};
    }

    _emit(level, message, meta = {}) {
        const levelNum = LOG_LEVELS[level] ?? 1;
        if (levelNum < this.minLevel) return null;

        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            traceId: meta.traceId || crypto.randomUUID(),
            message,
            ...meta,
        };

        // Update metrics
        this.metrics.totalLogs++;
        this.metrics.byLevel[level] = (this.metrics.byLevel[level] || 0) + 1;
        this.metrics.byService[this.service] = (this.metrics.byService[this.service] || 0) + 1;

        // Emit structured JSON
        const output = JSON.stringify(entry);
        if (levelNum >= LOG_LEVELS.error) {
            process.stderr.write(output + '\n');
        } else {
            process.stdout.write(output + '\n');
        }

        return entry;
    }

    debug(msg, meta) { return this._emit('debug', msg, meta); }
    info(msg, meta) { return this._emit('info', msg, meta); }
    warn(msg, meta) { return this._emit('warn', msg, meta); }
    error(msg, meta) { return this._emit('error', msg, meta); }
    fatal(msg, meta) { return this._emit('fatal', msg, meta); }

    // ── Traffic Metrics (P1) ─────────────────────────────────────
    recordAcceptedTraffic(endpoint, deviceId) {
        this.info('traffic.accepted', { endpoint, deviceId, metric: 'accepted' });
    }

    recordRejectedTraffic(endpoint, deviceId, reason) {
        this.warn('traffic.rejected', { endpoint, deviceId, reason, metric: 'rejected' });
    }

    recordStaleDisconnect(deviceId, lastSeenMs) {
        this.info('device.stale_disconnect', { deviceId, lastSeenMs, metric: 'stale_disconnect' });
    }

    // ── Circuit Breaker Telemetry (P4) ───────────────────────────
    recordCircuitBreaker(service, state, errorRate) {
        this.circuitBreakerState[service] = { state, errorRate, updatedAt: Date.now() };
        this.info('circuit_breaker.state_change', {
            targetService: service,
            state,
            errorRate,
            metric: 'circuit_breaker',
        });
    }

    // ── Cache Hit Telemetry (P4) ─────────────────────────────────
    recordCacheHit(cacheKey, isHit) {
        if (!this.cacheHitCounters[cacheKey]) {
            this.cacheHitCounters[cacheKey] = { hits: 0, misses: 0 };
        }
        if (isHit) {
            this.cacheHitCounters[cacheKey].hits++;
        } else {
            this.cacheHitCounters[cacheKey].misses++;
        }
        this.debug('cache.access', {
            cacheKey,
            isHit,
            hitRate: this.cacheHitCounters[cacheKey].hits /
                (this.cacheHitCounters[cacheKey].hits + this.cacheHitCounters[cacheKey].misses),
            metric: 'cache_hit',
        });
    }

    // ── Topology Metrics (P4) ────────────────────────────────────
    recordEdgeLatency(edgeId, latencyMs) {
        this.info('edge.latency', { edgeId, latencyMs, metric: 'edge_latency' });
    }

    recordSwarmSaturation(swarmId, saturationPercent) {
        this.info('swarm.saturation', { swarmId, saturationPercent, metric: 'swarm_saturation' });
    }

    recordProjectionQueueDepth(queueName, depth) {
        this.info('projection.queue_depth', { queueName, depth, metric: 'queue_depth' });
    }

    // ── Health ────────────────────────────────────────────────────
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreakers: this.circuitBreakerState,
            cacheCounters: this.cacheHitCounters,
        };
    }

    getHealth() {
        return {
            service: this.service,
            status: 'healthy',
            metrics: this.getMetrics(),
            uptime: process.uptime(),
        };
    }
}

// ── Singleton instances for each service ─────────────────────────
const loggers = {};
function getLogger(service = 'heady', options = {}) {
    if (!loggers[service]) {
        loggers[service] = new StructuredLogger(service, options);
    }
    return loggers[service];
}

module.exports = { StructuredLogger, getLogger };
