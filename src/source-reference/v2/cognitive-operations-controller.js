/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const crypto = require("crypto");
const { TERMINAL_STATES } = require("../memory-receipts");

const QUERY_CLASS = {
    urgent: { maxDepth: 1, targetP95Ms: 250 },
    standard: { maxDepth: 2, targetP95Ms: 600 },
    diagnostic: { maxDepth: 4, targetP95Ms: 1200 },
};

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

class CognitiveOperationsController {
    constructor(optsOrReceipts, opts = {}) {
        // Support both positional: new COC(receiptsInstance) and named: new COC({ receipts })
        let receipts;
        if (optsOrReceipts && typeof optsOrReceipts.recordAttempt === 'function') {
            receipts = optsOrReceipts;
        } else if (optsOrReceipts && optsOrReceipts.receipts) {
            receipts = optsOrReceipts.receipts;
            opts = optsOrReceipts;
        } else {
            receipts = optsOrReceipts;
        }
        if (!receipts) throw new Error("receipts instance required");
        this.receipts = receipts;
        this.maxRuns = opts.maxRuns || 2000;
        this.runs = new Map();
        this.runOrder = [];
        this.metrics = {
            beforeExecutionChecks: 0,
            anomalyEscalations: 0,
            completedRuns: 0,
            failedClosedRuns: 0,
            escalatedRuns: 0,
            recoveredTimeoutRuns: 0,
            unknownTerminalAttempts: 0,
            repeatBreaks: 0,
        };
    }

    beginRun(input = {}) {
        const taskId = String(input.taskId || "").trim();
        if (!taskId) throw new Error("taskId required");

        const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const queryClass = this._normalizeQueryClass(input.queryClass);
        const retrievalPolicy = this._computeRetrievalPolicy({ queryClass, criticality: input.criticality || 0.5 });

        const run = {
            runId,
            taskId,
            queryClass,
            retrievalPolicy,
            createdAt: Date.now(),
            lastHeartbeatAt: Date.now(),
            checkpoints: [],
            anomalies: [],
            status: "running",
            terminalState: null,
        };

        this._saveRun(run);
        this.metrics.beforeExecutionChecks += 1;

        return {
            runId,
            taskId,
            queryClass,
            retrievalPolicy,
            workingMemoryDependencies: this._findOpenDependencies(taskId),
            repeatRisk: this._repeatRisk(taskId),
        };
    }

    checkpoint(runId, payload = {}) {
        const run = this._requireRun(runId);
        const stage = String(payload.stage || "unknown").slice(0, 120);
        const heartbeatTs = Date.now();
        run.lastHeartbeatAt = heartbeatTs;
        run.checkpoints.push({
            stage,
            ts: heartbeatTs,
            meta: payload.meta || {},
        });
        if (run.checkpoints.length > 200) run.checkpoints.shift();

        return {
            ok: true,
            runId,
            stage,
            checkpointCount: run.checkpoints.length,
            heartbeatAgeMs: Date.now() - run.lastHeartbeatAt,
        };
    }

    recordAttempt(runId, attempt = {}) {
        const run = this._requireRun(runId);
        const result = this.receipts.recordAttempt({
            taskId: run.taskId,
            inputHash: attempt.inputHash,
            constraintsHash: attempt.constraintsHash,
            outputHash: attempt.outputHash,
            verdict: attempt.verdict,
            errorClass: attempt.errorClass,
            metadata: { runId, ...(attempt.metadata || {}) },
        });

        if (result.repeat.detected) this.metrics.repeatBreaks += 1;

        return {
            ok: true,
            runId,
            taskId: run.taskId,
            repeat: result.repeat,
            attempt: result.attempt,
        };
    }

    anomaly(runId, anomaly = {}) {
        const run = this._requireRun(runId);
        run.anomalies.push({
            id: `anomaly-${Date.now()}`,
            source: String(anomaly.source || "unknown").slice(0, 120),
            reason: String(anomaly.reason || "unspecified").slice(0, 300),
            ts: Date.now(),
            strategy: anomaly.strategy || "halt-extract-equivalence-rootcause-rule",
        });
        if (run.anomalies.length > 100) run.anomalies.shift();
        this.metrics.anomalyEscalations += 1;

        return {
            ok: true,
            runId,
            anomalyCount: run.anomalies.length,
            protocol: "5-phase-deterministic-optimization",
        };
    }

    finalize(runId, data = {}) {
        const run = this._requireRun(runId);
        const terminalState = String(data.terminalState || "").trim();
        if (!TERMINAL_STATES.has(terminalState)) {
            this.metrics.unknownTerminalAttempts += 1;
            throw new Error(`invalid terminal state: ${terminalState}`);
        }

        const receipt = this.receipts.closeTask(
            run.taskId,
            terminalState,
            data.reason || "completed by orchestration",
            {
                runId,
                checkpointCount: run.checkpoints.length,
                anomalyCount: run.anomalies.length,
                evidence: data.evidence || {},
            }
        );

        run.status = "closed";
        run.terminalState = terminalState;
        run.closedAt = Date.now();

        if (terminalState === "completed") this.metrics.completedRuns += 1;
        if (terminalState === "failed_closed") this.metrics.failedClosedRuns += 1;
        if (terminalState === "escalated") this.metrics.escalatedRuns += 1;
        if (terminalState === "timed_out_recovered") this.metrics.recoveredTimeoutRuns += 1;

        return { ok: true, runId, receipt, terminalState };
    }

    getHealth() {
        const activeRuns = Array.from(this.runs.values()).filter(r => r.status === "running");
        const staleRuns = activeRuns.filter(r => (Date.now() - r.lastHeartbeatAt) > 30_000).length;
        return {
            status: staleRuns > 0 ? "degraded" : "healthy",
            runStats: {
                total: this.runs.size,
                active: activeRuns.length,
                stale: staleRuns,
            },
            metrics: { ...this.metrics },
            receipts: this.receipts.getStats(),
            retrievalPolicy: QUERY_CLASS,
            ts: new Date().toISOString(),
        };
    }

    // ─── Method aliases for route handlers ─────────────────
    finalizeRun(runId, data) { return this.finalize(runId, data); }
    recordAnomaly(runId, data) { return this.anomaly(runId, data); }
    getStatus() { return this.getHealth(); }
    computeRetrievalPolicy(input) { return this._computeRetrievalPolicy(input); }

    _findOpenDependencies(taskId) {
        const openTasks = this.receipts.listOpenTasks(200);
        return openTasks.filter(t => t.taskId !== taskId).slice(0, 20);
    }

    _repeatRisk(taskId) {
        const attempts = this.receipts.getAttempts(300).filter(a => a.taskId === taskId);
        const failures = attempts.filter(a => a.verdict === "failed" || a.verdict === "error");
        return {
            attempts: attempts.length,
            failures: failures.length,
            risk: failures.length >= 3 ? "high" : failures.length >= 1 ? "medium" : "low",
        };
    }

    _normalizeQueryClass(queryClass) {
        return QUERY_CLASS[queryClass] ? queryClass : "standard";
    }

    _computeRetrievalPolicy(input) {
        const selected = QUERY_CLASS[input.queryClass] || QUERY_CLASS.standard;
        const criticality = clamp(Number(input.criticality) || 0.5, 0, 1);
        const adjustedDepth = clamp(selected.maxDepth + Math.round(criticality * 2) - 1, 1, 5);
        return {
            class: input.queryClass,
            zoneFirst: true,
            maxGraphDepth: adjustedDepth,
            targetP95Ms: selected.targetP95Ms,
            rankFormula: "semantic_similarity * confidence + freshness + causal_proximity",
        };
    }

    _saveRun(run) {
        this.runs.set(run.runId, run);
        this.runOrder.push(run.runId);
        if (this.runOrder.length > this.maxRuns) {
            const oldestId = this.runOrder.shift();
            if (oldestId) this.runs.delete(oldestId);
        }
    }

    _requireRun(runId) {
        const run = this.runs.get(runId);
        if (!run) throw new Error("run not found");
        return run;
    }
}

module.exports = {
    CognitiveOperationsController,
};
