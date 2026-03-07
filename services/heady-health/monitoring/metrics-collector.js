/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Metrics Collector
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Polls all service health endpoints and aggregates metrics using
 * phi-exponential backoff for unreachable services.
 * ═══════════════════════════════════════════════════════════════════
 */

const http = require('http');
const { EventEmitter } = require('events');
const { PhiBackoff } = require('../core/phi-scales');
const logger = require('../utils/logger').child({ component: 'metrics-collector' });

/**
 * Circular buffer for time-series data
 */
class CircularBuffer {
    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.buffer = [];
        this.index = 0;
    }

    push(value) {
        if (this.buffer.length < this.capacity) {
            this.buffer.push(value);
        } else {
            this.buffer[this.index] = value;
        }
        this.index = (this.index + 1) % this.capacity;
    }

    getAll() {
        return [...this.buffer];
    }

    getLast(n) {
        if (n >= this.buffer.length) return this.getAll();
        const start = (this.index - n + this.capacity) % this.capacity;
        if (start < this.index) {
            return this.buffer.slice(start, this.index);
        } else {
            return [...this.buffer.slice(start), ...this.buffer.slice(0, this.index)];
        }
    }

    clear() {
        this.buffer = [];
        this.index = 0;
    }
}

/**
 * Metrics Collector
 */
class MetricsCollector extends EventEmitter {
    constructor(services) {
        super();
        this.services = services;
        this.serviceStates = new Map();
        this.buffers = new Map();
        this.interval = null;
        this.pollInterval = 5000; // 5 seconds

        // Initialize buffers for each metric
        this.buffers.set('latency-p50', new CircularBuffer(1000));
        this.buffers.set('latency-p95', new CircularBuffer(1000));
        this.buffers.set('latency-p99', new CircularBuffer(1000));
        this.buffers.set('throughput', new CircularBuffer(1000));
        this.buffers.set('errorRate', new CircularBuffer(1000));
        this.buffers.set('cpu', new CircularBuffer(1000));
        this.buffers.set('memory', new CircularBuffer(1000));

        // Initialize service states
        for (const service of services) {
            this.serviceStates.set(service.name, {
                status: 'unknown',
                lastCheck: 0,
                consecutiveFailures: 0,
                backoff: new PhiBackoff(this.pollInterval, 10),
                latencyHistory: new CircularBuffer(60)
            });
        }
    }

    /**
     * Start collecting metrics
     */
    async start() {
        logger.info('Starting metrics collector', { 
            services: this.services.length,
            interval: this.pollInterval 
        });

        // Initial collection
        await this.collectAll();

        // Start interval
        this.interval = setInterval(() => this.collectAll(), this.pollInterval);
    }

    /**
     * Stop collecting metrics
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        logger.info('Stopped metrics collector');
    }

    /**
     * Collect metrics from all services
     */
    async collectAll() {
        const results = {
            timestamp: Date.now(),
            services: {},
            goldenSignals: {},
            swarms: [],
            providers: [],
            phiScales: {},
            mcpRouting: {}
        };

        // Collect from each service
        for (const service of this.services) {
            try {
                const metrics = await this.collectService(service.name, service.url);
                results.services[service.name] = metrics;
            } catch (err) {
                logger.warn('Failed to collect from service', { 
                    service: service.name,
                    error: err.message 
                });

                const state = this.serviceStates.get(service.name);
                state.consecutiveFailures++;

                results.services[service.name] = {
                    status: 'unreachable',
                    error: err.message,
                    consecutiveFailures: state.consecutiveFailures
                };
            }
        }

        // Compute golden signals
        results.goldenSignals = this.computeGoldenSignals(results.services);

        // Store in buffers
        this.storeMetrics(results.goldenSignals);

        // Emit event
        this.emit('metrics', results);

        return results;
    }

    /**
     * Collect metrics from a single service
     */
    async collectService(name, url) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, 5000);

            http.get(url, (res) => {
                let data = '';

                res.on('data', chunk => data += chunk);

                res.on('end', () => {
                    clearTimeout(timeout);
                    const latency = Date.now() - startTime;

                    try {
                        const parsed = JSON.parse(data);
                        const state = this.serviceStates.get(name);

                        // Update state
                        state.status = 'healthy';
                        state.lastCheck = Date.now();
                        state.consecutiveFailures = 0;
                        state.latencyHistory.push(latency);

                        resolve({
                            status: parsed.status || 'healthy',
                            latency,
                            uptime: parsed.uptime || 0,
                            circuitBreaker: parsed.circuitBreaker || 'CLOSED',
                            latencyHistory: state.latencyHistory.getLast(60),
                            ...parsed
                        });
                    } catch (err) {
                        reject(new Error(`Invalid JSON: ${err.message}`));
                    }
                });
            }).on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * Compute golden signals from service metrics
     */
    computeGoldenSignals(services) {
        const latencies = [];
        let totalRequests = 0;
        let totalErrors = 0;
        let totalCpu = 0;
        let totalMemory = 0;
        let serviceCount = 0;

        for (const [name, service] of Object.entries(services)) {
            if (service.status === 'unreachable') continue;

            serviceCount++;

            if (service.latency) latencies.push(service.latency);
            if (service.requests) totalRequests += service.requests;
            if (service.errors) totalErrors += service.errors;
            if (service.cpu) totalCpu += service.cpu;
            if (service.memory) totalMemory += service.memory;
        }

        // Compute percentiles
        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
        const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

        return {
            latency: { p50, p95, p99 },
            throughput: totalRequests / (this.pollInterval / 1000),
            errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
            cpu: serviceCount > 0 ? totalCpu / serviceCount : 0,
            memory: serviceCount > 0 ? totalMemory / serviceCount : 0
        };
    }

    /**
     * Store metrics in circular buffers
     */
    storeMetrics(signals) {
        if (signals.latency) {
            this.buffers.get('latency-p50').push(signals.latency.p50);
            this.buffers.get('latency-p95').push(signals.latency.p95);
            this.buffers.get('latency-p99').push(signals.latency.p99);
        }

        if (signals.throughput !== undefined) {
            this.buffers.get('throughput').push(signals.throughput);
        }

        if (signals.errorRate !== undefined) {
            this.buffers.get('errorRate').push(signals.errorRate);
        }

        if (signals.cpu !== undefined) {
            this.buffers.get('cpu').push(signals.cpu);
        }

        if (signals.memory !== undefined) {
            this.buffers.get('memory').push(signals.memory);
        }
    }

    /**
     * Get golden signals
     */
    getGoldenSignals() {
        const latencyP50 = this.buffers.get('latency-p50').getLast(1)[0] || 0;
        const latencyP95 = this.buffers.get('latency-p95').getLast(1)[0] || 0;
        const latencyP99 = this.buffers.get('latency-p99').getLast(1)[0] || 0;

        return {
            latency: { p50: latencyP50, p95: latencyP95, p99: latencyP99 },
            throughput: this.buffers.get('throughput').getLast(1)[0] || 0,
            errorRate: this.buffers.get('errorRate').getLast(1)[0] || 0,
            cpu: this.buffers.get('cpu').getLast(1)[0] || 0,
            memory: this.buffers.get('memory').getLast(1)[0] || 0
        };
    }

    /**
     * Get time series data for a metric
     */
    getTimeSeries(metric, window = 60) {
        const buffer = this.buffers.get(metric);
        if (!buffer) {
            throw new Error(`Unknown metric: ${metric}`);
        }

        return buffer.getLast(window);
    }
}

module.exports = MetricsCollector;
