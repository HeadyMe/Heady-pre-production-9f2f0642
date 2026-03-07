/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Vector-Native Security Scanner ──────────────────────────────────────────
 *
 * Patent Docket: HS-062
 * Application Number: 63/998,767  |  Filing Date: March 6, 2026
 * Title: VECTOR-NATIVE THREAT DETECTION SYSTEM USING GEOMETRIC ANOMALY ANALYSIS
 *        IN HIGH-DIMENSIONAL EMBEDDING SPACES
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 * Related: HS-058 (Continuous Semantic Logic), HS-059 (Attestation Mesh)
 *
 * Satisfies ALL 7 claims of HS-062.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { cosine_similarity, norm, PHI } = require('../core/csl-gates-enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// RTP: HS-062 Claim 3 — φ² ≈ 2.618 standard deviations for outlier threshold
const PHI_SQUARED = PHI * PHI;   // ≈ 2.618

// RTP: HS-062 (description) — φ³ for injection access frequency threshold
const PHI_CUBED   = PHI * PHI * PHI; // ≈ 4.236

// Default configuration values
const DEFAULTS = {
    threat_similarity_threshold:   0.85,  // Claim 1(b) — cosine similarity to threat patterns
    outlier_std_multiplier:        PHI_SQUARED,  // Claim 3 — φ² standard deviations
    injection_freq_multiplier:     PHI_CUBED,    // description §III — φ³ × mean access freq
    sprawl_growth_threshold:       PHI_SQUARED,  // Claim 4 — φ² × baseline density
    access_window_ms:              60_000,        // 1-minute access frequency window
};

// ─────────────────────────────────────────────────────────────────────────────
// I. THREAT PATTERN REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ThreatPatternRegistry: maintains known threat signatures as embedding vectors.
 *
 * // RTP: HS-062 Claim 1(a) — maintain registry of known threat patterns, each
 * //                           stored as an embedding vector.
 * // RTP: HS-062 Claim 6    — new threat signatures registered as embedding vectors,
 * //                           enabling detection of novel attacks by geometric proximity.
 * // RTP: HS-062 Claim 7(a) — threat pattern registry storing known threat signatures.
 */
class ThreatPatternRegistry {

    constructor() {
        // RTP: HS-062 Claim 1(a)
        this._patterns = new Map();   // label → { label, embedding, registered }
    }

    /**
     * Register a threat pattern as an embedding vector.
     *
     * // RTP: HS-062 Claim 6 — register new threat signatures as embedding vectors
     *
     * @param {string}              label     — human-readable threat description
     * @param {number[]|Float32Array} embedding — vector representation
     * @returns {object} registered pattern record
     */
    registerPattern(label, embedding) {
        // RTP: HS-062 Claim 6
        const record = {
            label,
            embedding: Array.from(embedding),
            registered: new Date().toISOString(),
        };
        this._patterns.set(label, record);
        return record;
    }

    /**
     * Remove a threat pattern.
     * @param {string} label
     */
    removePattern(label) {
        this._patterns.delete(label);
    }

    /**
     * Scan an incoming vector against all registered threat patterns.
     *
     * // RTP: HS-062 Claim 1(b) — compute cosine similarity against all patterns;
     * //                           flag vectors exceeding configurable threshold.
     *
     * @param {number[]|Float32Array} vec       — vector to scan
     * @param {number}               threshold  — similarity threshold (default 0.85)
     * @returns {{ flagged: boolean, matches: Array<{ label, similarity }> }}
     */
    scan(vec, threshold = DEFAULTS.threat_similarity_threshold) {
        // RTP: HS-062 Claim 1(b)
        const matches = [];

        for (const [, pattern] of this._patterns) {
            const similarity = cosine_similarity(vec, pattern.embedding);
            if (similarity >= threshold) {
                matches.push({ label: pattern.label, similarity: +similarity.toFixed(6) });
            }
        }

        // Sort by descending similarity
        matches.sort((a, b) => b.similarity - a.similarity);

        return {
            flagged: matches.length > 0,
            matches,
            threshold,
        };
    }

    /**
     * Get all registered patterns.
     * @returns {Array}
     */
    listPatterns() {
        return Array.from(this._patterns.values());
    }

    get size() { return this._patterns.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// II. OUTLIER DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OutlierDetector: identifies geometrically isolated vectors using zone centroid
 * distance analysis with φ²-derived thresholds.
 *
 * // RTP: HS-062 Claim 1(c) — compute minimum distance from each vector to zone
 * //                           centroids; flag vectors exceeding outlier threshold.
 * // RTP: HS-062 Claim 3    — outlier threshold = φ² (≈ 2.618) std deviations from
 * //                           mean inter-centroid distance.
 * // RTP: HS-062 Claim 7(b) — outlier detector using zone centroid distance.
 */
class OutlierDetector {

    constructor(opts = {}) {
        this._centroids = new Map();  // zoneName → centroid vector
        this._stdMultiplier = opts.stdMultiplier || DEFAULTS.outlier_std_multiplier;
    }

    /**
     * Register or update a zone centroid.
     * @param {string}              zoneName  — zone identifier
     * @param {number[]|Float32Array} centroid — centroid embedding vector
     */
    registerZone(zoneName, centroid) {
        this._centroids.set(zoneName, Array.from(centroid));
    }

    /**
     * Remove a zone.
     * @param {string} zoneName
     */
    removeZone(zoneName) {
        this._centroids.delete(zoneName);
    }

    /**
     * Compute Euclidean distance between two vectors.
     * @param {number[]|Float32Array} a
     * @param {number[]|Float32Array} b
     * @returns {number}
     */
    _euclideanDistance(a, b) {
        let sum = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const d = a[i] - b[i];
            sum += d * d;
        }
        return Math.sqrt(sum);
    }

    /**
     * Compute mean and standard deviation of inter-centroid distances.
     * @returns {{ mean: number, std: number }}
     */
    _computeInterCentroidStats() {
        const centroids = Array.from(this._centroids.values());
        if (centroids.length < 2) return { mean: 1, std: 0 };

        const distances = [];
        for (let i = 0; i < centroids.length; i++) {
            for (let j = i + 1; j < centroids.length; j++) {
                distances.push(this._euclideanDistance(centroids[i], centroids[j]));
            }
        }

        const mean = distances.reduce((s, d) => s + d, 0) / distances.length;
        const variance = distances.reduce((s, d) => s + (d - mean) ** 2, 0) / distances.length;
        return { mean, std: Math.sqrt(variance) };
    }

    /**
     * Scan a vector for geometric isolation (potential injection attempt).
     *
     * // RTP: HS-062 Claim 1(c) — compute minimum distance to any zone centroid
     * // RTP: HS-062 Claim 3    — flag if distance > φ² × std from mean inter-centroid dist
     *
     * @param {number[]|Float32Array} vec       — vector to evaluate
     * @returns {{ flagged: boolean, minDistance: number, nearestZone: string|null, threshold: number }}
     */
    scan(vec) {
        // RTP: HS-062 Claim 1(c) and Claim 3
        if (this._centroids.size === 0) {
            return { flagged: false, minDistance: 0, nearestZone: null, threshold: Infinity, reason: 'no_zones' };
        }

        let minDistance = Infinity;
        let nearestZone = null;

        for (const [zoneName, centroid] of this._centroids) {
            const dist = this._euclideanDistance(vec, centroid);
            if (dist < minDistance) {
                minDistance = dist;
                nearestZone = zoneName;
            }
        }

        // RTP: HS-062 Claim 3 — threshold = φ² standard deviations from mean inter-centroid dist
        const { mean, std } = this._computeInterCentroidStats();
        const threshold = mean + this._stdMultiplier * std;

        return {
            flagged:     minDistance > threshold,
            minDistance: +minDistance.toFixed(6),
            nearestZone,
            threshold:   +threshold.toFixed(6),
            stdMultiplier: this._stdMultiplier,  // φ² ≈ 2.618
        };
    }

    get zoneCount() { return this._centroids.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// III. INJECTION DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InjectionDetector: identifies vectors with anomalous access patterns.
 * Tracks access frequency per vector and flags those exceeding φ³ × mean.
 *
 * // RTP: HS-062 Claim 1(d) — track access frequency; flag vectors with anomalously
 * //                           high access rates as potential adversarial probes.
 * // RTP: HS-062 Claim 7(c) — injection detector flagging anomalous access patterns.
 */
class InjectionDetector {

    constructor(opts = {}) {
        this._accessLog     = new Map();  // vectorId → array of timestamps
        this._accessWindow  = opts.accessWindowMs   || DEFAULTS.access_window_ms;
        this._freqMultiplier = opts.freqMultiplier  || DEFAULTS.injection_freq_multiplier;
        this._avgNorm       = opts.avgNorm          || null; // will be updated dynamically
        this._normSamples   = [];
    }

    /**
     * Record an access event for a vector.
     *
     * // RTP: HS-062 Claim 1(d) — track access frequency for stored vectors
     *
     * @param {string}              vectorId   — unique vector identifier
     * @param {number[]|Float32Array} embedding — the vector being accessed
     */
    recordAccess(vectorId, embedding) {
        // RTP: HS-062 Claim 1(d)
        const now = Date.now();
        if (!this._accessLog.has(vectorId)) {
            this._accessLog.set(vectorId, []);
        }

        // Prune timestamps outside the window
        const log = this._accessLog.get(vectorId).filter(t => now - t < this._accessWindow);
        log.push(now);
        this._accessLog.set(vectorId, log);

        // Track embedding norm for anomaly detection
        if (embedding) {
            const n = norm(embedding);
            this._normSamples.push(n);
            if (this._normSamples.length > 1000) this._normSamples.shift();
            this._avgNorm = this._normSamples.reduce((s, x) => s + x, 0) / this._normSamples.length;
        }
    }

    /**
     * Compute mean access frequency across all tracked vectors in the window.
     * @returns {number}
     */
    _computeMeanAccessFreq() {
        const now = Date.now();
        let total = 0;
        let count = 0;

        for (const [, timestamps] of this._accessLog) {
            const recent = timestamps.filter(t => now - t < this._accessWindow);
            total += recent.length;
            count++;
        }

        return count > 0 ? total / count : 0;
    }

    /**
     * Scan a vector access record for injection indicators.
     *
     * // RTP: HS-062 Claim 1(d) — flag if access rate > φ³ × mean access freq
     * //                         or if embedding norm significantly deviates from avg.
     *
     * @param {string}              vectorId   — vector to evaluate
     * @param {number[]|Float32Array} embedding — the vector's embedding
     * @returns {{ flagged: boolean, accessCount: number, meanFreq: number, normDeviation: number, reasons: string[] }}
     */
    scan(vectorId, embedding) {
        // RTP: HS-062 Claim 1(d)
        const now = Date.now();
        const timestamps = (this._accessLog.get(vectorId) || []).filter(t => now - t < this._accessWindow);
        const accessCount = timestamps.length;
        const meanFreq    = this._computeMeanAccessFreq();
        const threshold   = meanFreq * this._freqMultiplier;  // φ³ × mean

        const reasons = [];
        let flagged = false;

        // Check access frequency
        if (meanFreq > 0 && accessCount > threshold) {
            flagged = true;
            reasons.push(`high_access_frequency: ${accessCount} > ${threshold.toFixed(2)} (φ³ × mean)`);
        }

        // Check embedding norm deviation
        let normDeviation = 0;
        if (embedding && this._avgNorm && this._avgNorm > 0) {
            const vecNorm = norm(embedding);
            normDeviation = Math.abs(vecNorm - this._avgNorm) / this._avgNorm;
            if (normDeviation > 2.0) {  // more than 200% deviation from avg norm
                flagged = true;
                reasons.push(`abnormal_embedding_norm: deviation=${normDeviation.toFixed(3)}`);
            }
        }

        return {
            flagged,
            accessCount,
            meanFreq:      +meanFreq.toFixed(4),
            threshold:     +threshold.toFixed(4),
            freqMultiplier: this._freqMultiplier,  // φ³ ≈ 4.236
            normDeviation:  +normDeviation.toFixed(4),
            reasons,
        };
    }

    /**
     * Clear access log for a specific vector.
     * @param {string} vectorId
     */
    clearVector(vectorId) {
        this._accessLog.delete(vectorId);
    }

    get trackedVectorCount() { return this._accessLog.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// IV. POISONING DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PoisoningDetector: detects vectors that have shifted zone membership since baseline.
 *
 * // RTP: HS-062 Claim 2 — compare current zone membership against baseline snapshot;
 * //                        flag vectors that have migrated between zones without user action.
 * // RTP: HS-062 Claim 7(d) — poisoning detector identifying shifted zone membership.
 */
class PoisoningDetector {

    constructor() {
        this._baseline       = new Map();  // vectorId → { zone, capturedAt }
        this._baselineCaptured = false;
    }

    /**
     * Capture a baseline snapshot of zone memberships.
     *
     * // RTP: HS-062 Claim 2 — capture baseline snapshot of zone memberships
     *
     * @param {Array<{ id: string, zone: string }>} vectorMemberships
     */
    captureBaseline(vectorMemberships) {
        // RTP: HS-062 Claim 2
        this._baseline.clear();
        for (const { id, zone } of vectorMemberships) {
            this._baseline.set(id, { zone, capturedAt: new Date().toISOString() });
        }
        this._baselineCaptured = true;
    }

    /**
     * Check current zone memberships against baseline.
     *
     * // RTP: HS-062 Claim 2 — flag vectors that have migrated between zones
     *
     * @param {Array<{ id: string, zone: string }>} currentMemberships
     * @returns {{ flagged: Array<{ id, baseline, current }>, migrationCount: number }}
     */
    scan(currentMemberships) {
        // RTP: HS-062 Claim 2
        if (!this._baselineCaptured) {
            return { flagged: [], migrationCount: 0, baselineActive: false };
        }

        const flagged = [];
        for (const { id, zone: currentZone } of currentMemberships) {
            if (this._baseline.has(id)) {
                const baselineEntry = this._baseline.get(id);
                if (baselineEntry.zone !== currentZone) {
                    // RTP: HS-062 Claim 2 — flag zone migration without explicit user action
                    flagged.push({
                        id,
                        baseline: baselineEntry.zone,
                        current:  currentZone,
                        capturedAt: baselineEntry.capturedAt,
                    });
                }
            }
        }

        return {
            flagged,
            migrationCount: flagged.length,
            baselineActive: true,
            scannedCount:   currentMemberships.length,
        };
    }

    /**
     * Update baseline for specific vectors (after explicit user action).
     * @param {Array<{ id: string, zone: string }>} updates
     */
    updateBaseline(updates) {
        for (const { id, zone } of updates) {
            this._baseline.set(id, { zone, capturedAt: new Date().toISOString() });
        }
    }

    get baselineCaptured() { return this._baselineCaptured; }
    get baselineSize()     { return this._baseline.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// V. ANTI-SPRAWL ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AntiSprawlEngine: monitors zone density growth and flags uncontrolled expansion.
 *
 * // RTP: HS-062 Claim 4 — capture baseline zone densities; flag zones exceeding
 * //                        growth threshold compared to baseline.
 * // RTP: HS-062 Claim 7(e) — anti-sprawl engine detecting uncontrolled zone growth.
 */
class AntiSprawlEngine {

    constructor(opts = {}) {
        this._baselineDensities  = new Map();  // zoneName → density count
        this._growthThreshold    = opts.growthThreshold || DEFAULTS.sprawl_growth_threshold; // φ²
        this._baselineCaptured   = false;
    }

    /**
     * Capture baseline zone densities.
     *
     * // RTP: HS-062 Claim 4 — capture baseline of zone densities
     *
     * @param {object} zoneDensities — { [zoneName]: vectorCount }
     */
    captureBaseline(zoneDensities) {
        // RTP: HS-062 Claim 4
        this._baselineDensities.clear();
        for (const [zone, density] of Object.entries(zoneDensities)) {
            this._baselineDensities.set(zone, density);
        }
        this._baselineCaptured = true;
    }

    /**
     * Scan current zone densities for sprawl.
     *
     * // RTP: HS-062 Claim 4 — flag zones with density > φ² × baseline density
     *
     * @param {object} currentDensities — { [zoneName]: vectorCount }
     * @returns {{ alerts: Array, warnings: Array, newZones: Array }}
     */
    scan(currentDensities) {
        // RTP: HS-062 Claim 4
        if (!this._baselineCaptured) {
            return { alerts: [], warnings: [], newZones: [], baselineActive: false };
        }

        const alerts   = [];   // blockers
        const warnings = [];   // advisories
        const newZones = [];   // zones not in baseline

        for (const [zone, currentDensity] of Object.entries(currentDensities)) {
            if (!this._baselineDensities.has(zone)) {
                // RTP: HS-062 §V — new zones trigger uncontrolled growth warnings
                newZones.push({ zone, currentDensity, reason: 'uncontrolled_growth' });
                warnings.push({ zone, currentDensity, baseline: 0, reason: 'new_zone' });
            } else {
                const baselineDensity = this._baselineDensities.get(zone);
                const growthRatio     = baselineDensity > 0
                    ? currentDensity / baselineDensity
                    : Infinity;

                if (growthRatio > this._growthThreshold) {
                    // RTP: HS-062 Claim 4 — density > φ² × baseline triggers sprawl alert
                    alerts.push({
                        zone,
                        currentDensity,
                        baselineDensity,
                        growthRatio:     +growthRatio.toFixed(3),
                        threshold:       +this._growthThreshold.toFixed(3),
                        reason:          'density_exceeded_phi_squared',
                    });
                }
            }
        }

        return {
            alerts,
            warnings,
            newZones,
            hasBlockers:  alerts.length > 0,
            baselineActive: true,
        };
    }

    get baselineCaptured() { return this._baselineCaptured; }
}

// ─────────────────────────────────────────────────────────────────────────────
// VI. PRE-DEPLOYMENT GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PreDeployGate: orchestrates all security checks before deployment.
 *
 * // RTP: HS-062 Claim 5  — pre-deployment security gate executes geometric threat
 * //                         analysis before code deployment; blocks on blockers.
 * // RTP: HS-062 Claim 7(f) — pre-deployment gate blocking when integrity compromised.
 */
class PreDeployGate {

    constructor(opts = {}) {
        this.threatRegistry  = opts.threatRegistry  || new ThreatPatternRegistry();
        this.outlierDetector = opts.outlierDetector || new OutlierDetector();
        this.injectionDetector = opts.injectionDetector || new InjectionDetector();
        this.poisoningDetector = opts.poisoningDetector || new PoisoningDetector();
        this.antiSprawlEngine  = opts.antiSprawlEngine  || new AntiSprawlEngine();

        this._runLog = [];
    }

    /**
     * Execute the full pre-deployment security gate.
     *
     * // RTP: HS-062 Claim 5 — run anti-sprawl + security scan; block on blockers
     *
     * @param {object} context — deployment context
     * @param {object} context.zoneDensities      — current zone densities
     * @param {Array}  context.recentVectors      — vectors recently ingested [{ id, embedding, zone }]
     * @param {Array}  context.currentMemberships — current zone memberships [{ id, zone }]
     * @param {object} context.memoryHealth       — optional memory health data
     * @returns {{ allowed: boolean, blockers: Array, warnings: Array, report: object }}
     */
    run(context = {}) {
        // RTP: HS-062 Claim 5
        const blockers = [];
        const warnings = [];
        const checks   = {};

        // 1. Anti-sprawl check
        // RTP: HS-062 Claim 4 and §V
        if (context.zoneDensities) {
            const sprawlResult = this.antiSprawlEngine.scan(context.zoneDensities);
            checks.antiSprawl = sprawlResult;
            if (sprawlResult.alerts && sprawlResult.alerts.length > 0) {
                blockers.push({ check: 'anti_sprawl', details: sprawlResult.alerts });
            }
            if (sprawlResult.warnings && sprawlResult.warnings.length > 0) {
                warnings.push({ check: 'anti_sprawl', details: sprawlResult.warnings });
            }
        }

        // 2. Threat pattern scan on recent vectors
        // RTP: HS-062 Claim 1(b)
        if (context.recentVectors && context.recentVectors.length > 0) {
            const threatMatches = [];
            for (const vec of context.recentVectors) {
                const result = this.threatRegistry.scan(vec.embedding);
                if (result.flagged) {
                    threatMatches.push({ vectorId: vec.id, matches: result.matches });
                }
            }
            checks.threatScan = { scanned: context.recentVectors.length, flagged: threatMatches };
            if (threatMatches.length > 0) {
                blockers.push({ check: 'threat_pattern', details: threatMatches });
            }
        }

        // 3. Outlier detection
        // RTP: HS-062 Claim 1(c) and Claim 3
        if (context.recentVectors && context.recentVectors.length > 0) {
            const outliers = [];
            for (const vec of context.recentVectors) {
                const result = this.outlierDetector.scan(vec.embedding);
                if (result.flagged) {
                    outliers.push({ vectorId: vec.id, result });
                }
            }
            checks.outlierDetection = { scanned: context.recentVectors.length, outliers };
            if (outliers.length > 0) {
                blockers.push({ check: 'outlier_detection', details: outliers });
            }
        }

        // 4. Injection detection
        // RTP: HS-062 Claim 1(d)
        if (context.recentVectors && context.recentVectors.length > 0) {
            const injections = [];
            for (const vec of context.recentVectors) {
                const result = this.injectionDetector.scan(vec.id, vec.embedding);
                if (result.flagged) {
                    injections.push({ vectorId: vec.id, result });
                }
            }
            checks.injectionDetection = { scanned: context.recentVectors.length, injections };
            if (injections.length > 0) {
                blockers.push({ check: 'injection_detection', details: injections });
            }
        }

        // 5. Poisoning detection
        // RTP: HS-062 Claim 2
        if (context.currentMemberships) {
            const poisonResult = this.poisoningDetector.scan(context.currentMemberships);
            checks.poisoningDetection = poisonResult;
            if (poisonResult.migrationCount > 0) {
                blockers.push({ check: 'poisoning_detection', details: poisonResult.flagged });
            }
        }

        // 6. Memory health check
        if (context.memoryHealth) {
            checks.memoryHealth = context.memoryHealth;
            if (context.memoryHealth.staleVectors > 100) {
                warnings.push({ check: 'memory_health', details: { staleVectors: context.memoryHealth.staleVectors } });
            }
        }

        // RTP: HS-062 Claim 5 — block if any blockers; proceed with advisory if only warnings
        const allowed = blockers.length === 0;

        const runRecord = {
            timestamp:    new Date().toISOString(),
            allowed,
            blockerCount: blockers.length,
            warningCount: warnings.length,
        };
        this._runLog.push(runRecord);

        return {
            allowed,
            blockers,
            warnings,
            checks,
            summary: {
                timestamp:    runRecord.timestamp,
                decision:     allowed ? 'DEPLOY_ALLOWED' : 'DEPLOY_BLOCKED',
                blockerCount: blockers.length,
                warningCount: warnings.length,
            },
        };
    }

    /**
     * Get history of pre-deploy gate runs.
     * @returns {Array}
     */
    getRunLog() {
        return [...this._runLog];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VII. FULL VECTOR-NATIVE SECURITY SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VectorNativeSecuritySystem: the complete HS-062 system.
 *
 * // RTP: HS-062 Claim 7 — full system with threat registry, outlier detector,
 * //                         injection detector, poisoning detector, anti-sprawl engine,
 * //                         and pre-deployment gate.
 */
class VectorNativeSecuritySystem {

    constructor(opts = {}) {
        // RTP: HS-062 Claim 7(a)
        this.threatRegistry     = new ThreatPatternRegistry();
        // RTP: HS-062 Claim 7(b)
        this.outlierDetector    = new OutlierDetector(opts.outlier || {});
        // RTP: HS-062 Claim 7(c)
        this.injectionDetector  = new InjectionDetector(opts.injection || {});
        // RTP: HS-062 Claim 7(d)
        this.poisoningDetector  = new PoisoningDetector();
        // RTP: HS-062 Claim 7(e)
        this.antiSprawlEngine   = new AntiSprawlEngine(opts.sprawl || {});
        // RTP: HS-062 Claim 7(f)
        this.preDeployGate      = new PreDeployGate({
            threatRegistry:    this.threatRegistry,
            outlierDetector:   this.outlierDetector,
            injectionDetector: this.injectionDetector,
            poisoningDetector: this.poisoningDetector,
            antiSprawlEngine:  this.antiSprawlEngine,
        });

        this._scanHistory = [];
    }

    /**
     * Full scan of an incoming vector across all detection methods.
     *
     * // RTP: HS-062 Claim 1 — full detection pipeline: threat patterns, outlier,
     * //                         injection frequency check.
     *
     * @param {string}              vectorId
     * @param {number[]|Float32Array} embedding
     * @param {string}              zone         — current zone membership
     * @returns {object} consolidated scan result
     */
    scanVector(vectorId, embedding, zone = 'default') {
        // RTP: HS-062 Claim 1
        this.injectionDetector.recordAccess(vectorId, embedding);

        const threatResult    = this.threatRegistry.scan(embedding);          // Claim 1(b)
        const outlierResult   = this.outlierDetector.scan(embedding);         // Claim 1(c)
        const injectionResult = this.injectionDetector.scan(vectorId, embedding); // Claim 1(d)

        const flagged = threatResult.flagged || outlierResult.flagged || injectionResult.flagged;

        const result = {
            vectorId,
            zone,
            timestamp:    new Date().toISOString(),
            flagged,
            threat:       threatResult,
            outlier:      outlierResult,
            injection:    injectionResult,
        };

        this._scanHistory.push(result);
        return result;
    }

    /**
     * Get scan history.
     * @returns {Array}
     */
    getScanHistory() {
        return [...this._scanHistory];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,
    PHI_SQUARED,
    PHI_CUBED,
    DEFAULTS,
    ThreatPatternRegistry,
    OutlierDetector,
    InjectionDetector,
    PoisoningDetector,
    AntiSprawlEngine,
    PreDeployGate,
    VectorNativeSecuritySystem,
};
