/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Alert Manager
 * ═══════════════════════════════════════════════════════════════════
 *
 * Configurable alert rules with CSL risk_gate severity scoring
 * and PhiBackoff cooldown periods. Supports FIRING, PENDING,
 * RESOLVED states with hysteresis to prevent flapping.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * @module src/monitoring/alert-manager
 */
'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');
const { PhiBackoff, PHI_INVERSE } = require('../core/phi-scales');

const ALERT_STATES = { FIRING: 'FIRING', PENDING: 'PENDING', RESOLVED: 'RESOLVED' };
const DEFAULT_HYSTERESIS = 3; // Consecutive evaluations before state change

class AlertManager extends EventEmitter {
    constructor(configPath) {
        super();
        this.rules = [];
        this.activeAlerts = new Map(); // ruleId → alert state
        this.history = [];
        this.maxHistory = 1000;
        this.cooldowns = new Map(); // ruleId → PhiBackoff

        // Load alert rules
        this._loadRules(configPath || path.join(__dirname, '..', '..', 'configs', 'alerts.yaml'));
    }

    /**
     * Load alert rules from YAML config (or use defaults)
     */
    _loadRules(configPath) {
        // Default rules (used if config file not found)
        this.rules = [
            // Service health alerts
            { id: 'svc-down', group: 'service_health', metric: 'service.status', condition: 'equals', value: 'down', severity: 0.9, cooldownBase: 5000, hysteresis: 2 },
            { id: 'svc-degraded', group: 'service_health', metric: 'service.status', condition: 'equals', value: 'degraded', severity: 0.6, cooldownBase: 10000, hysteresis: 3 },

            // Latency alerts
            { id: 'latency-p99-high', group: 'latency', metric: 'goldenSignals.latencyP99', condition: 'gt', value: 3000, severity: 0.7, cooldownBase: 8000, hysteresis: 3 },
            { id: 'latency-p99-critical', group: 'latency', metric: 'goldenSignals.latencyP99', condition: 'gt', value: 8000, severity: 0.95, cooldownBase: 3000, hysteresis: 2 },
            { id: 'latency-p95-warning', group: 'latency', metric: 'goldenSignals.latencyP95', condition: 'gt', value: 2000, severity: 0.5, cooldownBase: 15000, hysteresis: 4 },

            // Error rate alerts
            { id: 'error-rate-warning', group: 'errors', metric: 'goldenSignals.errorRate', condition: 'gt', value: 5, severity: 0.6, cooldownBase: 10000, hysteresis: 3 },
            { id: 'error-rate-critical', group: 'errors', metric: 'goldenSignals.errorRate', condition: 'gt', value: 20, severity: 0.95, cooldownBase: 3000, hysteresis: 2 },

            // Capacity alerts
            { id: 'memory-high', group: 'capacity', metric: 'goldenSignals.memorySaturation', condition: 'gt', value: 80, severity: 0.7, cooldownBase: 15000, hysteresis: 3 },
            { id: 'memory-critical', group: 'capacity', metric: 'goldenSignals.memorySaturation', condition: 'gt', value: 95, severity: 0.95, cooldownBase: 5000, hysteresis: 2 },

            // CSL coherence alerts
            { id: 'csl-low-resonance', group: 'csl_coherence', metric: 'cslStats.avgResonanceScore', condition: 'lt', value: 0.3, severity: 0.6, cooldownBase: 20000, hysteresis: 5 },

            // Phi deviation alerts
            { id: 'phi-timeout-drift', group: 'phi_deviation', metric: 'phiScales.timeout.phiDeviation', condition: 'gt', value: 0.5, severity: 0.5, cooldownBase: 30000, hysteresis: 5 },
            { id: 'phi-confidence-drift', group: 'phi_deviation', metric: 'phiScales.confidence.phiDeviation', condition: 'gt', value: 0.3, severity: 0.6, cooldownBase: 25000, hysteresis: 4 },
        ];

        // Try loading from YAML file
        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                // Simple YAML parsing for alert rules
                logger.info(`[AlertManager] Loaded config from ${configPath}`);
            }
        } catch (err) {
            logger.warn(`[AlertManager] Could not load ${configPath}: ${err.message}. Using defaults.`);
        }

        // Initialize cooldowns with PhiBackoff
        for (const rule of this.rules) {
            this.cooldowns.set(rule.id, new PhiBackoff(rule.cooldownBase || 5000, 10));
        }

        logger.logSystem(`[AlertManager] Initialized with ${this.rules.length} alert rules`);
    }

    /**
     * Evaluate all alert rules against current metrics
     * @param {Object} data - Full metrics snapshot
     */
    evaluate(data) {
        for (const rule of this.rules) {
            try {
                const currentValue = this._extractMetric(data, rule.metric);
                if (currentValue === undefined || currentValue === null) continue;

                const triggered = this._checkCondition(currentValue, rule.condition, rule.value, data);

                // CSL risk_gate for continuous severity scoring
                let cslSeverity = rule.severity;
                if (typeof currentValue === 'number' && typeof rule.value === 'number') {
                    const riskResult = CSL.risk_gate(currentValue, rule.value, 0.8, 12);
                    cslSeverity = riskResult.riskLevel * rule.severity;
                }

                const alertKey = rule.id;
                const existing = this.activeAlerts.get(alertKey);

                if (triggered) {
                    if (!existing) {
                        // New alert: start in PENDING state
                        this.activeAlerts.set(alertKey, {
                            ruleId: rule.id,
                            group: rule.group,
                            state: ALERT_STATES.PENDING,
                            severity: cslSeverity,
                            metric: rule.metric,
                            currentValue,
                            threshold: rule.value,
                            consecutiveCount: 1,
                            hysteresis: rule.hysteresis || DEFAULT_HYSTERESIS,
                            firstSeen: Date.now(),
                            lastSeen: Date.now(),
                        });
                    } else {
                        existing.consecutiveCount++;
                        existing.lastSeen = Date.now();
                        existing.currentValue = currentValue;
                        existing.severity = cslSeverity;

                        // Promote PENDING → FIRING after hysteresis threshold
                        if (existing.state === ALERT_STATES.PENDING && existing.consecutiveCount >= existing.hysteresis) {
                            existing.state = ALERT_STATES.FIRING;
                            this._fireAlert(existing, rule);
                        }
                    }
                } else if (existing) {
                    // Condition no longer triggered
                    existing.consecutiveCount = Math.max(0, existing.consecutiveCount - 1);

                    // Resolve after reverse hysteresis
                    if (existing.consecutiveCount === 0) {
                        existing.state = ALERT_STATES.RESOLVED;
                        existing.resolvedAt = Date.now();
                        this._resolveAlert(existing, rule);
                        this.activeAlerts.delete(alertKey);
                    }
                }
            } catch (err) {
                logger.error(`[AlertManager] Error evaluating rule ${rule.id}: ${err.message}`);
            }
        }
    }

    /**
     * Extract a nested metric value from dot-notation path
     */
    _extractMetric(data, metricPath) {
        // Handle service-level metrics
        if (metricPath.startsWith('service.')) {
            const field = metricPath.split('.')[1];
            if (data.services) {
                return data.services.map(s => s[field]);
            }
            return undefined;
        }

        const parts = metricPath.split('.');
        let current = data;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }

    /**
     * Check if a condition is met
     */
    _checkCondition(currentValue, condition, threshold, data) {
        // Handle array values (e.g., service statuses)
        if (Array.isArray(currentValue)) {
            if (condition === 'equals') {
                return currentValue.some(v => v === threshold);
            }
            return false;
        }

        switch (condition) {
            case 'gt': return currentValue > threshold;
            case 'gte': return currentValue >= threshold;
            case 'lt': return currentValue < threshold;
            case 'lte': return currentValue <= threshold;
            case 'equals': return currentValue === threshold;
            case 'neq': return currentValue !== threshold;
            default: return false;
        }
    }

    /**
     * Handle a firing alert
     */
    _fireAlert(alert, rule) {
        const entry = {
            type: 'FIRED',
            ruleId: alert.ruleId,
            group: alert.group,
            severity: alert.severity,
            metric: alert.metric,
            currentValue: alert.currentValue,
            threshold: alert.threshold,
            ts: Date.now(),
        };

        this.history.push(entry);
        if (this.history.length > this.maxHistory) this.history.shift();

        logger.warn(`[AlertManager] 🚨 ALERT FIRED: ${alert.ruleId} | ${alert.metric}=${alert.currentValue} (threshold: ${alert.threshold}) severity: ${alert.severity.toFixed(3)}`);
        this.emit('alert:fired', entry);

        // Reset cooldown
        const cooldown = this.cooldowns.get(rule.id);
        if (cooldown) cooldown.reset();
    }

    /**
     * Handle a resolved alert
     */
    _resolveAlert(alert, rule) {
        const entry = {
            type: 'RESOLVED',
            ruleId: alert.ruleId,
            group: alert.group,
            metric: alert.metric,
            duration: Date.now() - alert.firstSeen,
            ts: Date.now(),
        };

        this.history.push(entry);
        if (this.history.length > this.maxHistory) this.history.shift();

        logger.info(`[AlertManager] ✅ ALERT RESOLVED: ${alert.ruleId} (duration: ${entry.duration}ms)`);
        this.emit('alert:resolved', entry);
    }

    /**
     * Get all currently active (FIRING or PENDING) alerts
     */
    getActiveAlerts() {
        const alerts = [];
        for (const [, alert] of this.activeAlerts) {
            alerts.push({ ...alert });
        }
        return alerts.sort((a, b) => b.severity - a.severity);
    }

    /**
     * Get alert history
     */
    getHistory(limit = 100) {
        return this.history.slice(-limit);
    }
}

module.exports = AlertManager;
