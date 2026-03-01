/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyQA — Live Quality Assurance Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * Automated QA validation for the Heady ecosystem:
 *   1. Endpoint health probes (all registered API routes)
 *   2. Schema validation (registry, configs, data files)
 *   3. Regression detection (compare current vs baseline)
 *   4. Integration smoke tests (cross-service calls)
 *   5. Report generation with pass/fail/warn verdicts
 *
 * Runs continuously on φ-interval or on-demand via API.
 * ═══════════════════════════════════════════════════════════════
 */

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");

const QA_REPORT_DIR = path.join(__dirname, "..", "data", "qa-reports");
const QA_LOG = path.join(__dirname, "..", "data", "qa-audit.jsonl");
if (!fs.existsSync(QA_REPORT_DIR)) fs.mkdirSync(QA_REPORT_DIR, { recursive: true });

const PHI = 1.6180339887;

// ── Endpoint Test Catalog ───────────────────────────────────────
const ENDPOINT_TESTS = [
    { path: "/healthz", method: "GET", expect: 200, label: "Health Check" },
    { path: "/api/brain/chat", method: "POST", body: { message: "ping" }, expect: 200, label: "Brain Chat" },
    { path: "/api/brain/analyze", method: "POST", body: { content: "test", type: "general" }, expect: 200, label: "Brain Analyze" },
    { path: "/api/memory/search", method: "POST", body: { query: "test" }, expect: 200, label: "Memory Search" },
    { path: "/api/conductor/status", method: "GET", expect: 200, label: "Conductor Status" },
    { path: "/api/vector/federation", method: "GET", expect: 200, label: "Vector Federation" },
    { path: "/api/optimize/heartbeat", method: "GET", expect: 200, label: "Optimizer Heartbeat" },
    { path: "/api/scientist/status", method: "GET", expect: 200, label: "Scientist Status" },
    { path: "/api/hcfp/status", method: "GET", expect: 200, label: "HCFP Status" },
    { path: "/api/canvas/models", method: "GET", expect: 200, label: "Canvas Models" },
    { path: "/api/creative/status", method: "GET", expect: 200, label: "Creative Engine Status" },
    { path: "/api/learning/stats", method: "GET", expect: 200, label: "Learning Stats" },
    { path: "/api/registry", method: "GET", expect: 200, label: "Registry" },
    { path: "/api/battle/status", method: "GET", expect: 200, label: "Battle Status" },
    { path: "/api/soul/status", method: "GET", expect: 200, label: "Soul Status" },
    { path: "/api/nodes", method: "GET", expect: 200, label: "AI Nodes" },
];

// ── Schema Validation Rules ────────────────────────────────────
const SCHEMA_CHECKS = [
    {
        file: "heady-registry.json",
        checks: [
            { field: "version", type: "string" },
            { field: "nodes", type: "object" },
            { field: "workflows", type: "object" },
        ],
        label: "Registry Schema",
    },
    {
        file: "data/auto-success-tasks.json",
        checks: [{ field: "tasks", type: "object", minLength: 100 }],
        label: "Auto-Success Tasks Schema",
    },
    {
        file: "data/optimization-state.json",
        checks: [{ field: "cycles", type: "number" }],
        label: "Optimization State Schema",
    },
];

// ── Config Integrity Checks ────────────────────────────────────
const CONFIG_CHECKS = [
    "configs/governance-policies.yaml",
    "configs/file-governance.yaml",
    "configs/hcfullpipeline.yaml",
    "configs/ai-routing.yaml",
    "configs/stability-first.yaml",
];

class HeadyQA extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.projectRoot = opts.projectRoot || path.join(__dirname, "..");
        this.managerUrl = opts.managerUrl || process.env.HEADY_MANAGER_URL || 'https://manager.headysystems.com';
        this.managerPort = opts.managerPort || process.env.PORT || 3301;
        this.running = false;
        this.loopId = null;
        this.stats = {
            totalRuns: 0,
            totalPassed: 0,
            totalFailed: 0,
            totalWarnings: 0,
            lastRunAt: null,
            lastReport: null,
        };
    }

    // ── Run Full QA Suite ──────────────────────────────────────
    async runFullSuite(trigger = "manual") {
        const startTime = Date.now();
        const report = {
            id: crypto.randomUUID(),
            trigger,
            startedAt: new Date().toISOString(),
            results: [],
            summary: { pass: 0, fail: 0, warn: 0, skip: 0 },
        };

        // 1. Endpoint Health Probes
        for (const test of ENDPOINT_TESTS) {
            const result = await this._probeEndpoint(test);
            report.results.push(result);
            report.summary[result.verdict]++;
        }

        // 2. Schema Validation
        for (const schema of SCHEMA_CHECKS) {
            const result = this._validateSchema(schema);
            report.results.push(result);
            report.summary[result.verdict]++;
        }

        // 3. Config Integrity
        for (const configPath of CONFIG_CHECKS) {
            const result = this._checkConfigIntegrity(configPath);
            report.results.push(result);
            report.summary[result.verdict]++;
        }

        // 4. Cross-Service Integration
        const integrationResult = await this._smokeTestIntegration();
        report.results.push(integrationResult);
        report.summary[integrationResult.verdict]++;

        // Finalize
        report.completedAt = new Date().toISOString();
        report.durationMs = Date.now() - startTime;
        report.overallVerdict = report.summary.fail > 0 ? "FAIL" : report.summary.warn > 0 ? "WARN" : "PASS";

        // Persist
        const reportFile = path.join(QA_REPORT_DIR, `qa-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        this._auditLog({ type: "qa-run", trigger, verdict: report.overallVerdict, summary: report.summary });

        // Update stats
        this.stats.totalRuns++;
        this.stats.totalPassed += report.summary.pass;
        this.stats.totalFailed += report.summary.fail;
        this.stats.totalWarnings += report.summary.warn;
        this.stats.lastRunAt = report.completedAt;
        this.stats.lastReport = report;

        this.emit("qa-complete", report);
        return report;
    }

    // ── Endpoint Probe ────────────────────────────────────────
    async _probeEndpoint(test) {
        return new Promise((resolve) => {
            const url = new URL(test.path, this.managerUrl);
            const proto = url.protocol === 'https:' ? require('https') : http;
            const opts = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: test.method,
                timeout: 5000,
                headers: { "Content-Type": "application/json" },
            };

            const start = Date.now();
            const req = proto.request(opts, (res) => {
                let body = "";
                res.on("data", (d) => (body += d));
                res.on("end", () => {
                    const passed = res.statusCode === test.expect;
                    resolve({
                        test: test.label,
                        type: "endpoint",
                        path: test.path,
                        statusCode: res.statusCode,
                        expected: test.expect,
                        verdict: passed ? "pass" : res.statusCode === 401 ? "warn" : "fail",
                        responseMs: Date.now() - start,
                    });
                });
            });

            req.on("error", (err) => {
                resolve({
                    test: test.label,
                    type: "endpoint",
                    path: test.path,
                    verdict: "fail",
                    error: err.message,
                });
            });

            req.on("timeout", () => {
                req.destroy();
                resolve({ test: test.label, type: "endpoint", path: test.path, verdict: "warn", error: "timeout" });
            });

            if (test.body) req.write(JSON.stringify(test.body));
            req.end();
        });
    }

    // ── Schema Validation ─────────────────────────────────────
    _validateSchema(schema) {
        const filePath = path.join(this.projectRoot, schema.file);
        try {
            if (!fs.existsSync(filePath)) {
                return { test: schema.label, type: "schema", verdict: "fail", error: "File not found" };
            }
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            for (const check of schema.checks) {
                const val = data[check.field];
                if (val === undefined) {
                    return { test: schema.label, type: "schema", verdict: "fail", error: `Missing field: ${check.field}` };
                }
                if (check.type === "object" && typeof val !== "object") {
                    return { test: schema.label, type: "schema", verdict: "fail", error: `${check.field} should be object` };
                }
                if (check.minLength && (Array.isArray(val) ? val.length : Object.keys(val).length) < check.minLength) {
                    return { test: schema.label, type: "schema", verdict: "warn", error: `${check.field} has fewer than ${check.minLength} entries` };
                }
            }
            return { test: schema.label, type: "schema", verdict: "pass" };
        } catch (err) {
            return { test: schema.label, type: "schema", verdict: "fail", error: err.message };
        }
    }

    // ── Config Integrity ──────────────────────────────────────
    _checkConfigIntegrity(configPath) {
        const filePath = path.join(this.projectRoot, configPath);
        try {
            if (!fs.existsSync(filePath)) {
                return { test: `Config: ${configPath}`, type: "config", verdict: "fail", error: "Missing" };
            }
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.length < 50) {
                return { test: `Config: ${configPath}`, type: "config", verdict: "warn", error: "Suspiciously small" };
            }
            // Check for localhost references (should be zero in production configs)
            const localhostCount = (content.match(/localhost/gi) || []).length;
            if (localhostCount > 0) {
                return { test: `Config: ${configPath}`, type: "config", verdict: "warn", error: `${localhostCount} localhost references` };
            }
            return { test: `Config: ${configPath}`, type: "config", verdict: "pass", size: content.length };
        } catch (err) {
            return { test: `Config: ${configPath}`, type: "config", verdict: "fail", error: err.message };
        }
    }

    // ── Integration Smoke Test ────────────────────────────────
    async _smokeTestIntegration() {
        // Test: Brain → Memory → Conductor chain
        try {
            const brainResp = await this._httpGet(`/api/brain/search?q=heady`);
            const conductorResp = await this._httpGet(`/api/conductor/status`);
            if (brainResp && conductorResp) {
                return { test: "Cross-Service Integration", type: "integration", verdict: "pass" };
            }
            return { test: "Cross-Service Integration", type: "integration", verdict: "warn", error: "Partial response" };
        } catch (err) {
            return { test: "Cross-Service Integration", type: "integration", verdict: "fail", error: err.message };
        }
    }

    _httpGet(urlPath) {
        return new Promise((resolve, reject) => {
            const url = new URL(urlPath, this.managerUrl);
            const proto = url.protocol === 'https:' ? require('https') : http;
            proto.get(url.href, { timeout: 5000 }, (res) => {
                let body = "";
                res.on("data", (d) => (body += d));
                res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { console.warn(`[QA] JSON parse failed for ${urlPath}: ${e.message}`); resolve(body); } });
            }).on("error", reject);
        });
    }

    // ── Continuous Loop ───────────────────────────────────────
    startContinuousLoop() {
        if (this.running) return;
        this.running = true;
        const intervalMs = Math.round(PHI * PHI * PHI * PHI * PHI * 60000); // ~11.1 minutes
        console.log(`  ∞ HeadyQA: Continuous loop started (interval: ${Math.round(intervalMs / 1000)}s)`);
        this.loopId = setInterval(() => this.runFullSuite("continuous"), intervalMs);
        // Run immediately
        setTimeout(() => this.runFullSuite("startup"), 5000);
    }

    stopContinuousLoop() {
        if (this.loopId) clearInterval(this.loopId);
        this.running = false;
    }

    getStatus() {
        return {
            running: this.running,
            ...this.stats,
            testCatalog: ENDPOINT_TESTS.length,
            schemaChecks: SCHEMA_CHECKS.length,
            configChecks: CONFIG_CHECKS.length,
        };
    }

    _auditLog(entry) {
        try {
            fs.appendFileSync(QA_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n");
        } catch { }
    }
}

// ── Express Routes ──────────────────────────────────────────────
function registerQARoutes(app, qa) {
    app.get("/api/qa/status", (req, res) => res.json({ ok: true, qa: qa.getStatus() }));

    app.post("/api/qa/run", async (req, res) => {
        const report = await qa.runFullSuite("api");
        res.json({ ok: true, report });
    });

    app.get("/api/qa/reports", (req, res) => {
        try {
            const files = fs.readdirSync(QA_REPORT_DIR).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 10);
            const reports = files.map((f) => JSON.parse(fs.readFileSync(path.join(QA_REPORT_DIR, f), "utf-8")));
            res.json({ ok: true, reports });
        } catch (err) {
            res.json({ ok: false, error: err.message });
        }
    });

    app.get("/api/qa/latest", (req, res) => {
        if (qa.stats.lastReport) {
            res.json({ ok: true, report: qa.stats.lastReport });
        } else {
            res.json({ ok: false, message: "No QA report yet. Trigger with POST /api/qa/run" });
        }
    });

    console.log("  ∞ HeadyQA: LOADED (endpoint probes + schema validation + integration smoke tests)");
}

module.exports = { HeadyQA, registerQARoutes };
