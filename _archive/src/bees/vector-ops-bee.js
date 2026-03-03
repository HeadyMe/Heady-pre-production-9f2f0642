/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Vector Ops Bee — Injection-Ready Template ═══════════════════
 *
 * This bee handles ALL vector space internal operations AND deployment
 * when necessary. It's the bridge between the vector substrate and
 * the external world.
 *
 * Work units cover:
 *   1. Vector health monitoring
 *   2. Anti-sprawl zone analysis
 *   3. Security scanning in embedding space
 *   4. Memory compaction & maintenance
 *   5. Pre-deploy validation gate
 *   6. Deployment execution (ONLY if pre-deploy clears)
 *   7. Post-deploy verification
 *
 * Pillar 0: Operations happen IN vector space first.
 * Deployment is the exception, triggered only when changes
 * must leave the vector substrate.
 */

"use strict";

const domain = "vector-ops";
const description = "Vector space internal operations + deployment gate — anti-sprawl, security, maintenance, deploy";
const priority = 1.0; // Highest priority — vector integrity is foundational

// ─── Endpoints ──────────────────────────────────────────────────────
const MANAGER_URL = process.env.HEADY_MANAGER_URL || "https://manager.headysystems.com";

const HEADY_DOMAINS = [
    "headyme.com", "headybuddy.org", "headysystems.com",
    "headyconnection.org", "headymcp.com", "headyio.com",
    "headybot.com", "headyos.com", "headyapi.com",
];

// ─── Safe fetch helper ──────────────────────────────────────────────
async function safeFetch(url, opts = {}) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
        return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// ─── Work Unit Generators ───────────────────────────────────────────
function getWork(ctx = {}) {
    const work = [];

    // 1. Vector Health Check
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/health`);
        return {
            bee: domain, action: "health-check",
            healthy: res.data?.healthy ?? false,
            totalVectors: res.data?.totalVectors ?? 0,
            zones: res.data?.zones ?? {},
            status: res.ok ? "ok" : "error",
        };
    });

    // 2. Anti-Sprawl Zone Analysis
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/sprawl-check`, { method: "POST" });
        return {
            bee: domain, action: "sprawl-check",
            sprawlDetected: res.data?.sprawlDetected ?? false,
            alerts: res.data?.alerts?.length ?? 0,
            details: res.data?.alerts?.slice(0, 3) ?? [],
        };
    });

    // 3. Security Scan — Embedding Space Threats
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/security-scan`, { method: "POST" });
        return {
            bee: domain, action: "security-scan",
            healthy: res.data?.healthy ?? false,
            threats: res.data?.threats?.length ?? 0,
            details: res.data?.threats?.slice(0, 3) ?? [],
        };
    });

    // 4. Memory Compaction & Maintenance
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/compact`, { method: "POST" });
        return {
            bee: domain, action: "compact",
            compacted: res.data?.compacted ?? 0,
            pruned: res.data?.pruned ?? 0,
            zonesRebalanced: res.data?.zonesRebalanced ?? 0,
        };
    });

    // 5. Full Status Check (autonomic loop health)
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/status`);
        return {
            bee: domain, action: "ops-status",
            started: res.data?.started ?? false,
            cycles: res.data?.cycles ?? 0,
            sprawlAlerts: res.data?.antiSprawl?.recentAlerts?.length ?? 0,
            securityThreats: res.data?.security?.recentScans?.[0]?.threats?.length ?? 0,
        };
    });

    // 6. Pre-Deploy Validation Gate
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector-ops/pre-deploy`);
        const clear = res.data?.clear ?? false;
        const blockers = res.data?.blockers?.length ?? 0;
        const warnings = res.data?.warnings?.length ?? 0;
        return {
            bee: domain, action: "pre-deploy-gate",
            deploymentAllowed: clear,
            blockers, warnings,
            message: clear
                ? "Vector space clear — deployment allowed if needed"
                : `BLOCKED: ${blockers} blocker(s), ${warnings} warning(s)`,
        };
    });

    // 7. Vector Memory Stats (graph + zone + shard integrity)
    work.push(async () => {
        const res = await safeFetch(`${MANAGER_URL}/api/vector/memory/stats`);
        return {
            bee: domain, action: "memory-stats",
            totalVectors: res.data?.totalVectors ?? 0,
            shards: res.data?.shards ?? 0,
            graphEdges: res.data?.graphEdgeCount ?? 0,
            zones: res.data?.zones ?? {},
            ingestRate: res.data?.ingestCount ?? 0,
            queryRate: res.data?.queryCount ?? 0,
        };
    });

    // 8. Post-deploy domain verification (only runs if ctx.postDeploy)
    if (ctx.postDeploy || ctx.verifyDomains) {
        for (const d of HEADY_DOMAINS) {
            work.push(async () => {
                const res = await safeFetch(`https://${d}`);
                return {
                    bee: domain, action: `verify-${d}`,
                    domain: d, reachable: res.ok,
                    status: res.status ?? "unreachable",
                };
            });
        }
    }

    return work;
}

module.exports = {
    domain,
    description,
    priority,
    getWork,
};
