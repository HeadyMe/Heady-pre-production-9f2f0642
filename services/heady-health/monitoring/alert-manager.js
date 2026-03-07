const EventEmitter = require('events');
const CSL = require('../core/semantic-logic');
const { PhiBackoff } = require('../core/phi-scales');
const logger = require('../utils/logger').child({ component: 'alert-manager' });

class AlertManager extends EventEmitter {
    constructor(rules = []) {
        super();
        this.rules = rules;
        this.alertStates = new Map();
        this.cooldowns = new Map();
    }

    async evaluate(metrics) {
        const alerts = [];
        for (const rule of this.rules) {
            const result = await this.evaluateRule(rule, metrics);
            if (result.firing) {
                alerts.push(result);
                this.emit('alert', result);
            }
        }
        return alerts;
    }

    async evaluateRule(rule, metrics) {
        const { name, condition, threshold, severity } = rule;
        const value = this.getMetricValue(metrics, condition.metric);
        const isFiring = this.checkCondition(value, condition.operator, threshold);

        // Use CSL risk_gate for severity scoring
        const riskScore = CSL.risk_gate(value, threshold, 0.8, 12);

        return {
            name,
            firing: isFiring,
            value,
            threshold,
            severity: riskScore.riskLevel,
            signal: riskScore.signal,
            timestamp: Date.now()
        };
    }

    getMetricValue(metrics, path) {
        const parts = path.split('.');
        let value = metrics;
        for (const part of parts) {
            value = value[part];
            if (value === undefined) return 0;
        }
        return value;
    }

    checkCondition(value, operator, threshold) {
        switch (operator) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '==': return value === threshold;
            default: return false;
        }
    }
}

module.exports = AlertManager;
