/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const { TERMINAL_STATES } = require("../memory-receipts");

const PHASES = Object.freeze(["A", "B", "C", "D", "E", "F"]);

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

class CognitiveRuntimeGovernor {
    constructor() {
        this.started = Date.now();
        this.ingressCount = 0;
        this.executionCount = 0;
        this.completionCount = 0;
        this.terminalStateViolations = 0;
        this.repeatInterceptions = 0;
        this.prefetchHits = 0;
        this.prefetchMisses = 0;
        this.p95RetrievalMs = 0;
        this.phaseStatus = new Map(PHASES.map(p => [p, { ready: false, reason: "not_evaluated" }]));
    }

    recordIngress(task = {}) {
        this.ingressCount += 1;
        return {
            taskId: String(task.taskId || `task-${Date.now()}`),
            intent: String(task.action || "unknown"),
            urgency: task.urgency || "normal",
            risk: task.risk || "standard",
            memoryScope: task.memoryScope || "global",
            ts: new Date().toISOString(),
        };
    }

    recordPrefetch(prefetch = {}) {
        const hits = Number(prefetch.hits) || 0;
        const misses = Number(prefetch.misses) || 0;
        const retrievalMs = Number(prefetch.retrievalMs) || 0;

        this.prefetchHits += Math.max(0, hits);
        this.prefetchMisses += Math.max(0, misses);
        this.p95RetrievalMs = clamp(Math.round((this.p95RetrievalMs * 0.9) + (retrievalMs * 0.1)), 0, 60_000);
    }

    recordExecution(event = {}) {
        this.executionCount += 1;
        if (event.repeatIntercepted) this.repeatInterceptions += 1;
    }

    recordCompletion(result = {}) {
        if (!TERMINAL_STATES.has(result.terminalState)) {
            this.terminalStateViolations += 1;
            return { ok: false, error: "invalid_terminal_state" };
        }

        this.completionCount += 1;
        return { ok: true, terminalState: result.terminalState };
    }

    evaluateMigrationPhase(phase, evidence = {}) {
        const p = String(phase || "").toUpperCase();
        if (!PHASES.includes(p)) return { ok: false, error: "invalid_phase" };

        let ready = false;
        let reason = "criteria_not_met";

        if (p === "A") {
            ready = !!evidence.structuredTraces && !!evidence.explicitTerminalStates;
            reason = ready ? "baseline_instrumentation_ready" : "missing_structured_traces_or_terminal_states";
        } else if (p === "B") {
            ready = !!evidence.ttlQueues && !!evidence.heartbeatEnforced && !!evidence.noSilentDrops;
            reason = ready ? "short_term_memory_hardened" : "working_memory_hardening_incomplete";
        } else if (p === "C") {
            ready = !!evidence.episodicGraph && !!evidence.proceduralReuse;
            reason = ready ? "long_term_layering_ready" : "episodic_or_procedural_layering_incomplete";
        } else if (p === "D") {
            ready = !!evidence.zoneCache && (Number(evidence.p95RetrievalMs) || 0) <= 1000;
            reason = ready ? "3d_retrieval_slo_met" : "retrieval_slo_or_zone_cache_not_ready";
        } else if (p === "E") {
            ready = !!evidence.repeatDetectorGate && (Number(evidence.loopBreakIterations) || 99) <= 3;
            reason = ready ? "buddy_policy_hardened" : "repeat_detector_gate_not_ready";
        } else if (p === "F") {
            ready = !!evidence.chaosRecovery && !!evidence.rollbackPlaybooks && !!evidence.budgetAwareRouting;
            reason = ready ? "production_validation_ready" : "chaos_or_finops_or_rollback_not_ready";
        }

        this.phaseStatus.set(p, { ready, reason, evaluatedAt: new Date().toISOString() });
        return { ok: true, phase: p, ready, reason };
    }

    getStatus() {
        const totalPrefetch = this.prefetchHits + this.prefetchMisses;
        return {
            ok: true,
            uptimeMs: Date.now() - this.started,
            metrics: {
                ingressCount: this.ingressCount,
                executionCount: this.executionCount,
                completionCount: this.completionCount,
                terminalStateViolations: this.terminalStateViolations,
                repeatInterceptions: this.repeatInterceptions,
                firstPassPrefetchHitRate: totalPrefetch > 0 ? this.prefetchHits / totalPrefetch : 0,
                p95RetrievalMs: this.p95RetrievalMs,
            },
            phases: Object.fromEntries(this.phaseStatus.entries()),
            ts: new Date().toISOString(),
        };
    }
}

let _governor = null;
function getCognitiveRuntimeGovernor() {
    if (!_governor) _governor = new CognitiveRuntimeGovernor();
    return _governor;
}

module.exports = {
    CognitiveRuntimeGovernor,
    getCognitiveRuntimeGovernor,
};
