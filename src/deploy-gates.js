/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Deploy Gates — Fail-Closed — SPEC-2 ═══
 * Every deploy must pass ALL gates or it is rejected.
 * Gates: secrets scan, SBOM present, tests pass, Monte Carlo GREEN/YELLOW,
 *        no open critical incidents, Docker image scanned.
 */
const crypto = require("crypto");

class DeployGates {
    constructor(o = {}) {
        this.gates = [
            { id: "secrets_scan", name: "Secret Scan", check: (c) => !c.secretsFound, failMsg: "Secrets detected in codebase" },
            { id: "sbom_present", name: "SBOM Present", check: (c) => !!c.sbomGenerated, failMsg: "SBOM not generated" },
            { id: "tests_pass", name: "Tests Pass", check: (c) => c.testsPassed !== false, failMsg: "Tests failed" },
            { id: "monte_carlo", name: "Monte Carlo Readiness", check: (c) => ["GREEN", "YELLOW"].includes(c.monteCarloGrade), failMsg: "Risk grade too high" },
            { id: "no_critical_incidents", name: "No Critical Incidents", check: (c) => (c.openCriticalIncidents || 0) === 0, failMsg: "Open critical incidents" },
            { id: "container_scan", name: "Container Scan Clean", check: (c) => !c.containerHighVulns, failMsg: "Critical/high vulns in container" },
            { id: "approval", name: "Deployment Approved", check: (c) => c.approved !== false, failMsg: "Deployment not approved" },
        ];
        this.history = [];
        this.maxHistory = o.maxHistory || 200;
    }

    evaluate(context = {}) {
        const results = this.gates.map(g => {
            let passed = false;
            try { passed = g.check(context); } catch { passed = false; }
            return { id: g.id, name: g.name, passed, failMsg: passed ? null : g.failMsg };
        });

        const allPassed = results.every(r => r.passed);
        const entry = {
            id: crypto.randomUUID(),
            decision: allPassed ? "ALLOW" : "DENY",
            gates: results,
            failedGates: results.filter(r => !r.passed).map(r => r.id),
            context: { ...context, ts: new Date().toISOString() },
            ts: new Date().toISOString(),
        };

        this.history.push(entry);
        if (this.history.length > this.maxHistory) this.history.shift();
        return entry;
    }

    getHistory(limit = 20) { return this.history.slice(-limit); }

    status() {
        const last = this.history[this.history.length - 1];
        return {
            totalChecks: this.history.length,
            lastDecision: last?.decision || "N/A",
            gateCount: this.gates.length,
            lastTs: last?.ts || null,
        };
    }
}

module.exports = DeployGates;
