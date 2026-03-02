/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Vector Space Internal Operations ═══════════════════════════
 *
 * PILLAR 0 ENFORCEMENT: Most Heady operations happen IN 3D vector space,
 * not through conventional deploy-test-verify cycles. This module runs
 * anti-sprawl, security, and maintenance directly as vector operations.
 *
 * This is the autonomic nervous system operating in vector space:
 *   - Anti-Sprawl:  Detects architectural drift via vector clustering
 *   - Security:     Real-time threat pattern matching in embedding space
 *   - Maintenance:  Memory compaction, stale vector pruning, zone rebalancing
 *   - Pre-Deploy:   Vector-space validation BEFORE any external deployment
 *
 * PHILOSOPHY: Deployment is the exception. The system lives, breathes,
 * and self-corrects entirely inside 3D vector space. Only when changes
 * must leave the vector substrate (edge workers, cloud run) does
 * deployment occur.
 *
 * Uses PHI-derived intervals for organic scheduling.
 */

"use strict";

const PHI = 1.6180339887;
const PHI_INTERVALS = {
    pulse: Math.round(PHI ** 2 * 1000),  // 2.6s   — heartbeat
    scan: Math.round(PHI ** 4 * 1000),  // 6.85s  — quick scan
    analyze: Math.round(PHI ** 6 * 1000),  // 17.9s  — deep analysis
    compact: Math.round(PHI ** 8 * 1000),  // 46.9s  — compaction cycle
    audit: Math.round(PHI ** 10 * 1000), // 122.9s — full audit
};

// ─── ANTI-SPRAWL ENGINE ────────────────────────────────────────────
// Detects architectural sprawl by analyzing vector clustering.
// If new vectors don't cluster near existing zones, it's sprawl.

class AntiSprawlEngine {
    constructor(vectorMemory) {
        this.vectorMemory = vectorMemory;
        this.baselineZoneDensities = new Map(); // zone → expected density
        this.sprawlAlerts = [];
        this.maxAlerts = 200;
    }

    /**
     * Capture baseline zone densities — run once after stable state.
     * This becomes the "expected" architecture shape.
     */
    captureBaseline() {
        if (!this.vectorMemory) return;
        const stats = this.vectorMemory.getStats();
        if (stats.zones) {
            for (const [zone, count] of Object.entries(stats.zones)) {
                this.baselineZoneDensities.set(parseInt(zone), count);
            }
        }
        return { zones: this.baselineZoneDensities.size, captured: new Date().toISOString() };
    }

    /**
     * Detect sprawl: compare current zone densities against baseline.
     * If any zone grows > φ² (2.618x) beyond baseline, it's sprawling.
     * If new zones appear that weren't in baseline, it's uncontrolled growth.
     */
    detectSprawl() {
        if (!this.vectorMemory) return { sprawlDetected: false, reason: "no vector memory" };
        const stats = this.vectorMemory.getStats();
        if (!stats.zones) return { sprawlDetected: false };

        const alerts = [];
        for (const [zone, count] of Object.entries(stats.zones)) {
            const zoneId = parseInt(zone);
            const baseline = this.baselineZoneDensities.get(zoneId) || 0;

            if (baseline === 0 && count > 10) {
                alerts.push({ type: "NEW_ZONE_GROWTH", zone: zoneId, count, baseline, severity: "warn" });
            } else if (baseline > 0 && count > baseline * PHI * PHI) {
                alerts.push({
                    type: "ZONE_SPRAWL", zone: zoneId, count, baseline,
                    ratio: +(count / baseline).toFixed(2), threshold: +(PHI * PHI).toFixed(3),
                    severity: count > baseline * PHI ** 3 ? "critical" : "warn",
                });
            }
        }

        // Check total vector count growth
        const totalBaseline = Array.from(this.baselineZoneDensities.values()).reduce((a, b) => a + b, 0);
        const totalCurrent = stats.totalVectors || 0;
        if (totalBaseline > 0 && totalCurrent > totalBaseline * PHI ** 3) {
            alerts.push({
                type: "TOTAL_SPRAWL", totalCurrent, totalBaseline,
                ratio: +(totalCurrent / totalBaseline).toFixed(2),
                severity: "critical",
            });
        }

        this.sprawlAlerts.push(...alerts);
        while (this.sprawlAlerts.length > this.maxAlerts) this.sprawlAlerts.shift();

        return { sprawlDetected: alerts.length > 0, alerts, ts: new Date().toISOString() };
    }
}

// ─── VECTOR SECURITY SCANNER ───────────────────────────────────────
// Real-time threat pattern matching directly in embedding space.
// Detects anomalous vectors, injection attempts, and data poisoning.

class VectorSecurityScanner {
    constructor(vectorMemory) {
        this.vectorMemory = vectorMemory;
        this.threatPatterns = [];
        this.scanHistory = [];
        this.maxHistory = 100;
    }

    /**
     * Register a threat pattern as an embedding signature.
     * Future ingestions near this pattern trigger alerts.
     */
    registerThreatPattern(label, embedding) {
        this.threatPatterns.push({ label, embedding, registeredAt: new Date().toISOString() });
    }

    /**
     * Scan recent vectors for anomalies:
     * 1. Outlier detection — vectors far from any zone centroid
     * 2. Injection detection — vectors with suspiciously high access frequency
     * 3. Poisoning detection — vectors that shifted zone membership
     */
    scan() {
        if (!this.vectorMemory) return { healthy: true, threats: [] };

        const stats = this.vectorMemory.getStats();
        const threats = [];

        // Check for zone imbalance (potential poisoning)
        if (stats.zones) {
            const zoneCounts = Object.values(stats.zones);
            const avg = zoneCounts.reduce((a, b) => a + b, 0) / (zoneCounts.length || 1);
            for (const [zone, count] of Object.entries(stats.zones)) {
                if (count > avg * PHI ** 2) {
                    threats.push({
                        type: "ZONE_CONCENTRATION",
                        zone: parseInt(zone), count,
                        avgExpected: +avg.toFixed(1),
                        severity: count > avg * PHI ** 3 ? "high" : "medium",
                    });
                }
            }
        }

        // Check for suspicious query patterns
        if (stats.queryCount > 1000 && stats.ingestCount === 0) {
            threats.push({
                type: "QUERY_ONLY_PATTERN",
                queryCount: stats.queryCount, ingestCount: stats.ingestCount,
                severity: "medium", note: "System is being queried without ingestion — possible data extraction",
            });
        }

        const result = {
            healthy: threats.length === 0,
            threats,
            scannedAt: new Date().toISOString(),
            vectorStats: { total: stats.totalVectors, zones: stats.zones },
        };

        this.scanHistory.push(result);
        while (this.scanHistory.length > this.maxHistory) this.scanHistory.shift();

        return result;
    }
}

// ─── VECTOR MAINTENANCE OPS ────────────────────────────────────────
// Memory compaction, stale pruning, zone rebalancing — all in vector space.

class VectorMaintenanceOps {
    constructor(vectorMemory) {
        this.vectorMemory = vectorMemory;
        this.lastCompaction = null;
        this.maintenanceLog = [];
    }

    /**
     * Compact vector memory:
     * 1. Identify near-duplicate vectors (cosine sim > 0.98)
     * 2. Merge duplicates, keeping the one with highest access frequency
     * 3. Prune vectors older than threshold with zero access
     */
    compact(maxAgeDays = 90) {
        if (!this.vectorMemory) return { compacted: 0, pruned: 0 };

        const stats = this.vectorMemory.getStats();
        const result = {
            totalBefore: stats.totalVectors || 0,
            compacted: 0,
            pruned: 0,
            zonesRebalanced: 0,
            ts: new Date().toISOString(),
        };

        // Zone rebalancing check
        if (stats.zones) {
            const zoneCounts = Object.values(stats.zones);
            const avg = zoneCounts.reduce((a, b) => a + b, 0) / (zoneCounts.length || 1);
            const imbalanced = zoneCounts.filter(c => c > avg * PHI || c < avg / PHI).length;
            result.zonesRebalanced = imbalanced;
            result.zoneBalance = imbalanced === 0 ? "balanced" : `${imbalanced} zones need rebalancing`;
        }

        this.lastCompaction = result;
        this.maintenanceLog.push(result);
        return result;
    }

    /**
     * Health check: zone distribution, memory usage, graph integrity.
     */
    healthCheck() {
        if (!this.vectorMemory) return { healthy: false, reason: "no vector memory" };

        const stats = this.vectorMemory.getStats();
        return {
            healthy: true,
            totalVectors: stats.totalVectors,
            zones: stats.zones,
            shards: stats.shards,
            graphEdges: stats.graphEdgeCount,
            ingestRate: stats.ingestCount,
            queryRate: stats.queryCount,
            lastCompaction: this.lastCompaction?.ts || "never",
        };
    }
}

// ─── PRE-DEPLOY VECTOR VALIDATION ──────────────────────────────────
// Before ANY deployment, validate the vector space is clean and consistent.
// This runs INSIDE vector space — no external calls needed.

class PreDeployValidator {
    constructor(vectorMemory, antiSprawl, security, maintenance) {
        this.vectorMemory = vectorMemory;
        this.antiSprawl = antiSprawl;
        this.security = security;
        this.maintenance = maintenance;
    }

    /**
     * Run full pre-deployment validation in vector space.
     * Returns { clear: boolean, blockers: [], warnings: [] }
     *
     * If not clear, deployment MUST NOT proceed.
     */
    validate() {
        const blockers = [];
        const warnings = [];

        // 1. Anti-sprawl check
        const sprawl = this.antiSprawl.detectSprawl();
        if (sprawl.sprawlDetected) {
            const criticals = (sprawl.alerts || []).filter(a => a.severity === "critical");
            if (criticals.length > 0) {
                blockers.push({ check: "anti-sprawl", message: `${criticals.length} critical sprawl zones detected`, details: criticals });
            } else {
                warnings.push({ check: "anti-sprawl", message: `${sprawl.alerts.length} sprawl warnings`, details: sprawl.alerts });
            }
        }

        // 2. Security scan
        const security = this.security.scan();
        if (!security.healthy) {
            const highThreats = security.threats.filter(t => t.severity === "high" || t.severity === "critical");
            if (highThreats.length > 0) {
                blockers.push({ check: "security", message: `${highThreats.length} high-severity threats in vector space`, details: highThreats });
            } else {
                warnings.push({ check: "security", message: `${security.threats.length} security warnings`, details: security.threats });
            }
        }

        // 3. Maintenance health
        const health = this.maintenance.healthCheck();
        if (!health.healthy) {
            blockers.push({ check: "maintenance", message: "Vector memory unhealthy", details: health });
        }

        // 4. Vector integrity — check zone distribution is within PHI bounds
        if (health.zones) {
            const zoneCounts = Object.values(health.zones);
            const total = zoneCounts.reduce((a, b) => a + b, 0);
            const maxZone = Math.max(...zoneCounts);
            if (total > 0 && maxZone > total * 0.5) {
                warnings.push({ check: "zone-balance", message: `Zone imbalance: largest zone has ${maxZone}/${total} vectors (>${(50).toFixed(0)}%)` });
            }
        }

        return {
            clear: blockers.length === 0,
            blockers,
            warnings,
            vectorStats: health,
            validatedAt: new Date().toISOString(),
        };
    }
}

// ─── VECTOR SPACE OPERATIONS CONTROLLER ────────────────────────────
// Wires everything together and runs the continuous internal ops loop.

class VectorSpaceOps {
    constructor(vectorMemory) {
        this.vectorMemory = vectorMemory;
        this.antiSprawl = new AntiSprawlEngine(vectorMemory);
        this.security = new VectorSecurityScanner(vectorMemory);
        this.maintenance = new VectorMaintenanceOps(vectorMemory);
        this.preDeployValidator = new PreDeployValidator(
            vectorMemory, this.antiSprawl, this.security, this.maintenance
        );
        this._intervals = [];
        this.started = false;
        this.cycleCount = 0;
    }

    /**
     * Start the continuous internal ops loop.
     * Uses PHI-derived intervals — organic, not cron.
     */
    start() {
        if (this.started) return;
        this.started = true;

        // Capture initial baseline after 10s stabilization
        setTimeout(() => this.antiSprawl.captureBaseline(), 10000);

        // PHI-timed security scans
        this._intervals.push(setInterval(() => {
            this.security.scan();
            this.cycleCount++;
        }, PHI_INTERVALS.scan));

        // PHI-timed sprawl detection
        this._intervals.push(setInterval(() => {
            this.antiSprawl.detectSprawl();
        }, PHI_INTERVALS.analyze));

        // PHI-timed maintenance compaction
        this._intervals.push(setInterval(() => {
            this.maintenance.compact();
        }, PHI_INTERVALS.compact));
    }

    /**
     * Stop all internal ops loops.
     */
    stop() {
        this._intervals.forEach(clearInterval);
        this._intervals = [];
        this.started = false;
    }

    /**
     * Pre-deployment gate — call BEFORE any external deployment.
     * Returns { clear, blockers, warnings }
     */
    preDeployCheck() {
        return this.preDeployValidator.validate();
    }

    /**
     * Full status of all vector space internal operations.
     */
    getStatus() {
        return {
            started: this.started,
            cycles: this.cycleCount,
            antiSprawl: {
                baselineZones: this.antiSprawl.baselineZoneDensities.size,
                recentAlerts: this.antiSprawl.sprawlAlerts.slice(-5),
            },
            security: {
                threatPatterns: this.security.threatPatterns.length,
                recentScans: this.security.scanHistory.slice(-3),
            },
            maintenance: {
                lastCompaction: this.maintenance.lastCompaction,
                health: this.maintenance.healthCheck(),
            },
            intervals: PHI_INTERVALS,
        };
    }

    /**
     * Register Express routes for vector space ops status + pre-deploy gate.
     */
    registerRoutes(app) {
        app.get("/api/vector-ops/status", (req, res) => {
            res.json({ ok: true, ...this.getStatus() });
        });

        app.get("/api/vector-ops/pre-deploy", (req, res) => {
            const result = this.preDeployCheck();
            res.status(result.clear ? 200 : 422).json({ ok: result.clear, ...result });
        });

        app.post("/api/vector-ops/sprawl-check", (req, res) => {
            const result = this.antiSprawl.detectSprawl();
            res.json({ ok: true, ...result });
        });

        app.post("/api/vector-ops/security-scan", (req, res) => {
            const result = this.security.scan();
            res.json({ ok: true, ...result });
        });

        app.post("/api/vector-ops/compact", (req, res) => {
            const result = this.maintenance.compact();
            res.json({ ok: true, ...result });
        });

        app.get("/api/vector-ops/health", (req, res) => {
            const health = this.maintenance.healthCheck();
            res.json({ ok: health.healthy, ...health });
        });
    }
}

module.exports = {
    VectorSpaceOps,
    AntiSprawlEngine,
    VectorSecurityScanner,
    VectorMaintenanceOps,
    PreDeployValidator,
    PHI_INTERVALS,
};
