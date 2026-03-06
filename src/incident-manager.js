/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Incident Workflow — SPEC-5 ═══
 *
 * Severity classification, triage, pause/rollback triggers,
 * and postmortem generation.
 */

const crypto = require("crypto");

class IncidentManager {
    constructor(opts = {}) {
        this.incidents = [];
        this.maxIncidents = opts.maxIncidents || 500;
        this.thresholds = {
            errorRateCritical: opts.errorRateCritical || 0.15,
            errorRateHigh: opts.errorRateHigh || 0.08,
            consecutiveFailures: opts.consecutiveFailures || 3,
            ...opts.thresholds,
        };
    }

    // ─── Create incident ─────────────────────────────────────────
    create(incident) {
        const inc = {
            id: crypto.randomUUID(),
            severity: incident.severity || "medium",
            title: incident.title || "Untitled Incident",
            status: "open",
            source: incident.source || "manual",
            detectedAt: new Date().toISOString(),
            resolvedAt: null,
            actions: [],
            details: incident.details || {},
        };
        this.incidents.push(inc);
        if (this.incidents.length > this.maxIncidents) this.incidents.shift();

        // Auto-trigger emergency actions for critical
        if (inc.severity === "critical") {
            inc.actions.push({
                action: "emergency_pause",
                ts: new Date().toISOString(),
                auto: true,
            });
        }

        return inc;
    }

    // ─── Auto-detect from signals ────────────────────────────────
    evaluateSignals(signals = {}) {
        const created = [];

        if (signals.errorRate > this.thresholds.errorRateCritical) {
            created.push(this.create({
                severity: "critical",
                title: `Error rate critical: ${(signals.errorRate * 100).toFixed(1)}%`,
                source: "auto_detect",
                details: { errorRate: signals.errorRate, threshold: this.thresholds.errorRateCritical },
            }));
        } else if (signals.errorRate > this.thresholds.errorRateHigh) {
            created.push(this.create({
                severity: "high",
                title: `Error rate elevated: ${(signals.errorRate * 100).toFixed(1)}%`,
                source: "auto_detect",
                details: { errorRate: signals.errorRate },
            }));
        }

        if (signals.consecutiveFailures >= this.thresholds.consecutiveFailures) {
            created.push(this.create({
                severity: "high",
                title: `${signals.consecutiveFailures} consecutive failures on ${signals.serviceName || "unknown"}`,
                source: "auto_detect",
                details: { consecutiveFailures: signals.consecutiveFailures },
            }));
        }

        return created;
    }

    // ─── Update incident ─────────────────────────────────────────
    update(id, updates) {
        const inc = this.incidents.find(i => i.id === id);
        if (!inc) return null;

        if (updates.status) inc.status = updates.status;
        if (updates.status === "resolved") inc.resolvedAt = new Date().toISOString();
        if (updates.action) {
            inc.actions.push({
                action: updates.action,
                actor: updates.actor || "system",
                ts: new Date().toISOString(),
                details: updates.actionDetails || {},
            });
        }
        return inc;
    }

    // ─── Generate postmortem ─────────────────────────────────────
    generatePostmortem(id) {
        const inc = this.incidents.find(i => i.id === id);
        if (!inc) return null;

        const duration = inc.resolvedAt
            ? (new Date(inc.resolvedAt) - new Date(inc.detectedAt)) / 1000
            : null;

        return {
            incidentId: inc.id,
            title: inc.title,
            severity: inc.severity,
            detectedAt: inc.detectedAt,
            resolvedAt: inc.resolvedAt,
            durationSeconds: duration,
            timeline: inc.actions,
            rootCause: inc.details.rootCause || "TBD — update after investigation",
            impact: inc.details.impact || "TBD",
            lessonsLearned: inc.details.lessons || [],
            preventionActions: inc.details.prevention || [],
        };
    }

    // ─── Query ───────────────────────────────────────────────────
    getOpen() {
        return this.incidents.filter(i => i.status !== "resolved" && i.status !== "postmortem");
    }

    getAll(limit = 50) {
        return this.incidents.slice(-limit);
    }

    status() {
        const open = this.getOpen();
        return {
            total: this.incidents.length,
            open: open.length,
            critical: open.filter(i => i.severity === "critical").length,
            high: open.filter(i => i.severity === "high").length,
        };
    }
}

module.exports = IncidentManager;
