#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Production Smoke Test ═══
 *
 * Verifies all production endpoints are alive and responding correctly.
 * Used by CI/CD pipelines and the Health Sentinel cron job.
 *
 * Usage:
 *   node scripts/ci/smoke-test.js            # run full smoke test
 *   node scripts/ci/smoke-test.js --dry-run  # validate config without hitting URLs
 *
 * Exit codes:
 *   0 = all endpoints healthy
 *   1 = one or more endpoints failed
 */

const https = require("https");
const http = require("http");

// ── Configuration ───────────────────────────────────────────────
const ENDPOINTS = [
    {
        name: "Heady Manager API",
        url: "https://manager.headysystems.com/api/pulse",
        expectedStatus: [200],
        timeoutMs: 15000,
        critical: true,
        validateBody: (body) => {
            try {
                const data = JSON.parse(body);
                return data && typeof data === "object";
            } catch {
                return false;
            }
        },
    },
    {
        name: "Heady Manager Health",
        url: "https://manager.headysystems.com/api/health",
        expectedStatus: [200, 404],
        timeoutMs: 10000,
        critical: false,
    },
    {
        name: "HeadyMe.com",
        url: "https://headyme.com",
        expectedStatus: [200, 301, 302],
        timeoutMs: 15000,
        critical: false,
    },
    {
        name: "1ime1.com",
        url: "https://1ime1.com",
        expectedStatus: [200, 301, 302],
        timeoutMs: 15000,
        critical: false,
    },
    // Edge proxy — re-enable after Cloudflare Worker is deployed
    // {
    //     name: "Cloudflare Edge Proxy",
    //     url: "https://heady-edge-proxy.headysystems.workers.dev",
    //     expectedStatus: [200, 301, 302, 403],
    //     timeoutMs: 10000,
    //     critical: false,
    // },
];

const MAX_SLA_MS = 10000; // warn if response > 10s
const DRY_RUN = process.argv.includes("--dry-run");

// ── HTTP Checker ────────────────────────────────────────────────
function checkEndpoint(endpoint) {
    return new Promise((resolve) => {
        if (DRY_RUN) {
            resolve({
                name: endpoint.name,
                url: endpoint.url,
                status: "dry-run",
                ok: true,
                durationMs: 0,
                critical: endpoint.critical,
            });
            return;
        }

        const startTime = Date.now();
        const urlObj = new URL(endpoint.url);
        const client = urlObj.protocol === "https:" ? https : http;

        const req = client.get(
            endpoint.url,
            {
                timeout: endpoint.timeoutMs,
                headers: {
                    "User-Agent": "HeadySmokeTest/1.0",
                    Accept: "application/json, text/html",
                },
            },
            (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    const durationMs = Date.now() - startTime;
                    const statusOk = endpoint.expectedStatus.includes(res.statusCode);
                    const bodyOk = endpoint.validateBody
                        ? endpoint.validateBody(body)
                        : true;
                    const slaOk = durationMs <= MAX_SLA_MS;

                    resolve({
                        name: endpoint.name,
                        url: endpoint.url,
                        status: res.statusCode,
                        ok: statusOk && bodyOk,
                        slaOk,
                        durationMs,
                        critical: endpoint.critical,
                        bodyValid: bodyOk,
                        error: !statusOk
                            ? `Expected ${endpoint.expectedStatus.join("|")}, got ${res.statusCode}`
                            : !bodyOk
                                ? "Body validation failed"
                                : null,
                    });
                });
            }
        );

        req.on("timeout", () => {
            req.destroy();
            resolve({
                name: endpoint.name,
                url: endpoint.url,
                status: "TIMEOUT",
                ok: false,
                slaOk: false,
                durationMs: endpoint.timeoutMs,
                critical: endpoint.critical,
                error: `Timed out after ${endpoint.timeoutMs}ms`,
            });
        });

        req.on("error", (err) => {
            resolve({
                name: endpoint.name,
                url: endpoint.url,
                status: "ERROR",
                ok: false,
                slaOk: false,
                durationMs: Date.now() - startTime,
                critical: endpoint.critical,
                error: err.message,
            });
        });
    });
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("  🔥 Heady Production Smoke Test");
    console.log(`  📅 ${new Date().toISOString()}`);
    console.log(`  🔧 Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
    console.log("═══════════════════════════════════════════════════\n");

    const results = await Promise.all(ENDPOINTS.map(checkEndpoint));

    let hasFailure = false;
    let hasCriticalFailure = false;

    for (const r of results) {
        const icon = r.ok ? "✅" : "❌";
        const slaIcon = r.slaOk === false ? " ⚠️ SLA" : "";
        const badge = r.critical ? "[CRITICAL]" : "[standard]";

        console.log(
            `  ${icon} ${badge} ${r.name}: ${r.status} (${r.durationMs}ms)${slaIcon}`
        );
        if (r.error) {
            console.log(`     └── ${r.error}`);
        }

        if (!r.ok) {
            hasFailure = true;
            if (r.critical) hasCriticalFailure = true;
        }
    }

    console.log("\n───────────────────────────────────────────────────");
    const passed = results.filter((r) => r.ok).length;
    const total = results.length;
    console.log(`  Result: ${passed}/${total} endpoints healthy`);

    // Write machine-readable output
    const report = {
        timestamp: new Date().toISOString(),
        dryRun: DRY_RUN,
        passed,
        total,
        hasCriticalFailure,
        results: results.map((r) => ({
            name: r.name,
            url: r.url,
            status: r.status,
            ok: r.ok,
            critical: r.critical,
            durationMs: r.durationMs,
            error: r.error || null,
        })),
    };

    // Output JSON for CI artifact consumption
    console.log("\n📊 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    if (hasCriticalFailure) {
        console.log("\n🚨 CRITICAL FAILURE — blocking deploy.");
        process.exit(1);
    } else if (hasFailure) {
        console.log("\n⚠️ Non-critical failures detected — deploy allowed.");
        process.exit(0);
    } else {
        console.log("\n✅ All endpoints healthy.");
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Smoke test crashed:", err.message);
    process.exit(1);
});
