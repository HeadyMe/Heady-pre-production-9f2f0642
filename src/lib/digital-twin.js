/**
 * E14: Digital Twin Simulation Environment
 * Simulates production traffic patterns for pre-deploy validation
 * @module src/lib/digital-twin
 */
'use strict';

class DigitalTwin {
    constructor(opts = {}) {
        this.name = opts.name || 'heady-twin';
        this.scenarios = [];
        this._results = [];
    }

    addScenario(name, config) {
        this.scenarios.push({
            name,
            rps: config.rps || 10,
            duration: config.duration || 60000,
            endpoints: config.endpoints || ['/health/live'],
            headers: config.headers || {},
            expectedLatency: config.expectedLatency || 5000,
            expectedErrorRate: config.expectedErrorRate || 0.01,
        });
        return this;
    }

    async simulate(baseUrl) {
        const results = [];
        for (const scenario of this.scenarios) {
            const result = await this._runScenario(scenario, baseUrl);
            results.push(result);
        }
        this._results = results;
        return { twin: this.name, results, timestamp: new Date().toISOString() };
    }

    async _runScenario(scenario, baseUrl) {
        const { name, rps, duration, endpoints, expectedLatency, expectedErrorRate } = scenario;
        const totalRequests = Math.ceil(rps * (duration / 1000));
        const delayMs = 1000 / rps;
        let successes = 0, failures = 0, totalLatency = 0;

        for (let i = 0; i < Math.min(totalRequests, 100); i++) { // Cap for simulation
            const endpoint = endpoints[i % endpoints.length];
            const start = Date.now();
            try {
                const resp = await fetch(`${baseUrl}${endpoint}`, {
                    signal: AbortSignal.timeout(expectedLatency * 2),
                    headers: scenario.headers,
                });
                const latency = Date.now() - start;
                totalLatency += latency;
                if (resp.ok) successes++; else failures++;
            } catch {
                failures++;
                totalLatency += Date.now() - start;
            }
            if (delayMs > 10) await new Promise(r => setTimeout(r, delayMs));
        }

        const total = successes + failures;
        const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0;
        const errorRate = total > 0 ? failures / total : 0;

        return {
            scenario: name,
            total, successes, failures,
            avgLatency, errorRate,
            passLatency: avgLatency <= expectedLatency,
            passErrorRate: errorRate <= expectedErrorRate,
            pass: avgLatency <= expectedLatency && errorRate <= expectedErrorRate,
        };
    }

    getSummary() {
        return {
            twin: this.name,
            scenarios: this._results.length,
            allPass: this._results.every(r => r.pass),
            results: this._results,
        };
    }
}

module.exports = DigitalTwin;
