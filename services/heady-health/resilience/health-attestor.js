const EventEmitter = require('events');
const CSL = require('../core/semantic-logic');
const { DynamicTimeout } = require('../core/dynamic-constants');
const logger = require('../utils/logger').child({ component: 'health-attestor' });

class HealthAttestor extends EventEmitter {
    constructor(serviceId) {
        super();
        this.serviceId = serviceId;
        this.interval = null;
        this.attestationInterval = 5000;
        this.metrics = {
            latency: [],
            errors: 0,
            requests: 0,
            memoryUsage: 0,
            eventLoopLag: 0
        };
    }

    start() {
        logger.info('Starting health attestor', { serviceId: this.serviceId });
        this.interval = setInterval(() => this.attest(), this.attestationInterval);
        this.attest(); // Initial attestation
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        logger.info('Stopped health attestor', { serviceId: this.serviceId });
    }

    recordLatency(latency) {
        this.metrics.latency.push(latency);
        if (this.metrics.latency.length > 100) this.metrics.latency.shift();
    }

    recordRequest() {
        this.metrics.requests++;
    }

    recordError() {
        this.metrics.errors++;
    }

    async attest() {
        try {
            // Compute health score using CSL risk_gate
            const avgLatency = this.metrics.latency.length > 0
                ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
                : 0;

            const normalizedLatency = avgLatency / (DynamicTimeout.value || 5000);
            const errorRate = this.metrics.requests > 0 
                ? this.metrics.errors / this.metrics.requests 
                : 0;

            // Compute CSL score: lower is better
            const riskScore = CSL.risk_gate(errorRate, 0.05, 0.618, 12);
            const cslScore = 1.0 - riskScore.riskLevel;

            // Ternary classification
            const ternary = CSL.ternary_gate(cslScore, 0.618, 0.3, 15);

            const attestation = {
                serviceId: this.serviceId,
                timestamp: Date.now(),
                cslScore: parseFloat(cslScore.toFixed(4)),
                ternaryState: ternary.state,
                latencyP99: Math.max(...this.metrics.latency, 0),
                errorRate: parseFloat(errorRate.toFixed(4)),
                memoryPercent: this.metrics.memoryUsage,
                eventLoopLag: this.metrics.eventLoopLag,
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            };

            this.emit('attestation', attestation);

            return attestation;
        } catch (err) {
            logger.error('Attestation failed', { 
                serviceId: this.serviceId, 
                error: err.message 
            });
            return null;
        }
    }

    getHealthStatus() {
        const errorRate = this.metrics.requests > 0 
            ? this.metrics.errors / this.metrics.requests 
            : 0;

        if (errorRate > 0.1) return 'critical';
        if (errorRate > 0.05) return 'degraded';
        return 'healthy';
    }
}

module.exports = HealthAttestor;
