/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Heady Self-Awareness — Metacognitive Telemetry Loop ═══
 *
 * TRUE SELF-AWARENESS ARCHITECTURE:
 *   This module implements the Internal Monologue Loop described in the
 *   Exhaustive Architectural Blueprint. It provides the system with the
 *   capacity to "perceive" its own operational history.
 *
 *   1. TELEMETRY INGESTION — Streams structured logs into vector memory
 *      (third-person empirical data of system performance)
 *   2. AGENTIC METACOGNITION — Before high-stakes decisions, queries
 *      own recent performance for error rates and patterns
 *   3. CONTEXTUAL SYNTHESIS — Injects recent self-performance into
 *      LLM context windows for synthetic first-person awareness
 *
 *   Also includes: Branding integrity monitoring, domain health,
 *   system introspection for the HeadyBees watchdog.
 *
 * Exports:
 *   startSelfAwareness() — boots the full telemetry loop
 *   assessSystemState() — metacognitive snapshot for decision-making
 *   ingestTelemetry(event) — stream operational events into memory
 *   getBrandingReport() — branding health across all domains
 *   getSystemIntrospection() — full system state report
 */

const logger = require("./utils/logger");
let vectorMemory = null;
try { vectorMemory = require('./vector-memory'); } catch { /* loaded later */ }

const PHI = 1.6180339887;

// ═══════════════════════════════════════════════════════════════════
// BRANDING MONITOR (retained from original)
// ═══════════════════════════════════════════════════════════════════

const DOMAINS = [
    'headysystems.com', 'headyme.com', 'headyconnection.org',
    'headyio.com', 'headymcp.com', 'headybuddy.org',
    'manager.headysystems.com',
];

const BRAND_CHECKS = {
    requiredMeta: ['og:title', 'og:description', 'og:image'],
    requiredHeaders: ['x-heady-edge', 'x-heady-serve'],
    forbiddenStrings: ['localhost:3301', '127.0.0.1:3301', 'placeholder', 'TODO', 'FIXME'],
    requiredBranding: ['heady', 'HeadySystems'],
};

let monitorState = {
    lastScan: null, results: {}, alerts: [],
    scanCount: 0, healthy: 0, degraded: 0,
};

async function scanDomain(domain) {
    try {
        const resp = await fetch(`https://${domain}/`, {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'HeadyBrandingMonitor/1.0' },
        });
        const html = await resp.text();
        const issues = [];
        for (const forbidden of BRAND_CHECKS.forbiddenStrings) {
            if (html.includes(forbidden)) issues.push({ type: 'forbidden_string', value: forbidden });
        }
        for (const meta of BRAND_CHECKS.requiredMeta) {
            if (!html.includes(meta)) issues.push({ type: 'missing_meta', value: meta });
        }
        const hasAnyBrand = BRAND_CHECKS.requiredBranding.some(b => html.toLowerCase().includes(b.toLowerCase()));
        if (!hasAnyBrand) issues.push({ type: 'missing_branding', value: 'No Heady branding found' });
        return { domain, status: resp.status, healthy: issues.length === 0, issues, responseTime: Date.now() };
    } catch (err) {
        return { domain, status: 0, healthy: false, issues: [{ type: 'unreachable', value: err.message }], responseTime: Date.now() };
    }
}

async function runBrandingScan() {
    monitorState.scanCount++;
    monitorState.lastScan = new Date().toISOString();
    monitorState.results = {};
    monitorState.alerts = [];
    monitorState.healthy = 0;
    monitorState.degraded = 0;

    for (const domain of DOMAINS) {
        const result = await scanDomain(domain);
        monitorState.results[domain] = result;
        if (result.healthy) monitorState.healthy++;
        else {
            monitorState.degraded++;
            monitorState.alerts.push({ domain, issues: result.issues.map(i => `${i.type}: ${i.value}`) });
        }
    }

    // Ingest into self-awareness telemetry
    await ingestTelemetry({
        type: 'branding_scan',
        summary: `Scan #${monitorState.scanCount}: ${monitorState.healthy}/${DOMAINS.length} healthy`,
        data: { healthy: monitorState.healthy, degraded: monitorState.degraded, scanCount: monitorState.scanCount },
    });
}

function getBrandingReport() {
    return { node: 'heady-self-awareness', ...monitorState, domains: DOMAINS, checks: BRAND_CHECKS };
}

// ═══════════════════════════════════════════════════════════════════
// METACOGNITIVE TELEMETRY LOOP — The Internal Monologue
// ═══════════════════════════════════════════════════════════════════

// In-memory telemetry ring buffer (last N events for fast introspection)
const TELEMETRY_RING_SIZE = 500;
const _telemetryRing = [];
const _telemetryStats = {
    totalEvents: 0,
    errors: 0,
    successes: 0,
    warnings: 0,
    lastEventAt: null,
    errorRate1m: 0,
    errorRate5m: 0,
    categories: {},
};

/**
 * Ingest a telemetry event into the self-awareness loop.
 * This is the third-person empirical data stream.
 *
 * @param {Object} event - { type, summary, data, severity }
 * @param {string} event.type - Event category (e.g., 'pipeline_failure', 'api_error', 'self_heal')
 * @param {string} event.summary - Human-readable one-line summary
 * @param {Object} event.data - Structured event data
 * @param {string} event.severity - 'info'|'warn'|'error'|'critical'
 */
async function ingestTelemetry(event) {
    const entry = {
        ts: Date.now(),
        isoTime: new Date().toISOString(),
        type: event.type || 'generic',
        summary: event.summary || '',
        data: event.data || {},
        severity: event.severity || 'info',
    };

    // Ring buffer — constant memory
    _telemetryRing.push(entry);
    if (_telemetryRing.length > TELEMETRY_RING_SIZE) _telemetryRing.shift();

    // Stats tracking
    _telemetryStats.totalEvents++;
    _telemetryStats.lastEventAt = entry.isoTime;
    _telemetryStats.categories[entry.type] = (_telemetryStats.categories[entry.type] || 0) + 1;

    if (entry.severity === 'error' || entry.severity === 'critical') _telemetryStats.errors++;
    else if (entry.severity === 'warn') _telemetryStats.warnings++;
    else _telemetryStats.successes++;

    // Compute rolling error rates
    const now = Date.now();
    const events1m = _telemetryRing.filter(e => now - e.ts < 60000);
    const events5m = _telemetryRing.filter(e => now - e.ts < 300000);
    const errors1m = events1m.filter(e => e.severity === 'error' || e.severity === 'critical');
    const errors5m = events5m.filter(e => e.severity === 'error' || e.severity === 'critical');
    _telemetryStats.errorRate1m = events1m.length > 0 ? +(errors1m.length / events1m.length * 100).toFixed(1) : 0;
    _telemetryStats.errorRate5m = events5m.length > 0 ? +(errors5m.length / events5m.length * 100).toFixed(1) : 0;

    // Persist significant events to vector memory for long-term metacognition
    if (vectorMemory && (entry.severity !== 'info' || _telemetryStats.totalEvents % 10 === 0)) {
        try {
            await vectorMemory.ingestMemory({
                content: `[TELEMETRY] ${entry.type}: ${entry.summary}`,
                metadata: { type: 'self_telemetry', severity: entry.severity, category: entry.type },
            });
        } catch { /* best-effort */ }
    }
}

/**
 * METACOGNITIVE ASSESSMENT — The First-Person Awareness Query
 *
 * Before a high-stakes decision, query the system's own recent
 * operational state. Returns a confidence modifier and context string
 * that can be injected into an LLM prompt.
 *
 * This implements the "Internal Monologue Loop" from the blueprint:
 * - Third-person: recent error rates, pattern frequencies
 * - First-person: synthesized self-assessment for LLM injection
 *
 * @param {string} [context] - Optional context about the upcoming decision
 * @returns {Object} { confidence, contextString, recentErrors, recommendations }
 */
async function assessSystemState(context = '') {
    const now = Date.now();

    // Recent events analysis
    const recent5m = _telemetryRing.filter(e => now - e.ts < 300000);
    const recentErrors = recent5m.filter(e => e.severity === 'error' || e.severity === 'critical');
    const recentByType = {};
    recent5m.forEach(e => { recentByType[e.type] = (recentByType[e.type] || 0) + 1; });

    // Confidence calculation based on recent health
    let confidence = 1.0;
    if (_telemetryStats.errorRate1m > 50) confidence *= 0.3;
    else if (_telemetryStats.errorRate1m > 25) confidence *= 0.5;
    else if (_telemetryStats.errorRate1m > 10) confidence *= 0.7;
    else if (_telemetryStats.errorRate1m > 5) confidence *= 0.85;

    // Memory pressure factor
    const mem = process.memoryUsage();
    const heapUsagePercent = (mem.heapUsed / mem.heapTotal) * 100;
    if (heapUsagePercent > 90) confidence *= 0.5;
    else if (heapUsagePercent > 75) confidence *= 0.8;

    // Vector memory depth query (if available)
    let memoryContext = [];
    if (vectorMemory && context.length > 0) {
        try {
            memoryContext = await vectorMemory.queryMemory(
                `system health assessment for: ${context}`, 3,
                { type: 'self_telemetry' },
            );
        } catch { /* best-effort */ }
    }

    // Generate recommendations
    const recommendations = [];
    if (_telemetryStats.errorRate1m > 15) recommendations.push('HIGH ERROR RATE: Consider circuit breaker activation');
    if (heapUsagePercent > 80) recommendations.push('MEMORY PRESSURE: Reduce concurrent operations');
    if (recentErrors.length > 5) recommendations.push(`${recentErrors.length} ERRORS in 5min: Investigate ${recentErrors[0]?.type}`);

    // Synthesize the contextual self-awareness string for LLM injection
    const contextString = [
        `[HEADY SELF-AWARENESS STATE]`,
        `Confidence: ${(confidence * 100).toFixed(0)}%`,
        `Error rate (1m): ${_telemetryStats.errorRate1m}% | (5m): ${_telemetryStats.errorRate5m}%`,
        `Heap usage: ${heapUsagePercent.toFixed(0)}%`,
        `Recent events (5m): ${recent5m.length} total, ${recentErrors.length} errors`,
        `Uptime: ${(process.uptime() / 3600).toFixed(1)}h`,
        recommendations.length > 0 ? `Recommendations: ${recommendations.join('; ')}` : 'Status: NOMINAL',
        memoryContext.length > 0 ? `Historical context: ${memoryContext.map(m => m.content?.substring(0, 80)).join(' | ')}` : '',
    ].filter(Boolean).join('\n');

    return {
        confidence,
        contextString,
        errorRate1m: _telemetryStats.errorRate1m,
        errorRate5m: _telemetryStats.errorRate5m,
        heapUsagePercent: +heapUsagePercent.toFixed(1),
        recentErrors: recentErrors.slice(0, 5).map(e => ({ type: e.type, summary: e.summary, ts: e.isoTime })),
        recentEventTypes: recentByType,
        memoryContextDepth: memoryContext.length,
        recommendations,
        ts: new Date().toISOString(),
    };
}

/**
 * Full system introspection — combines all self-awareness streams.
 */
function getSystemIntrospection() {
    const vmStats = vectorMemory ? vectorMemory.getStats() : { total_vectors: 0 };
    const mem = process.memoryUsage();

    return {
        node: 'heady-introspection',
        ts: new Date().toISOString(),
        uptime: process.uptime(),
        process: {
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            rss: mem.rss,
            heapUsagePercent: +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
        },
        vectorMemory: { connected: !!vectorMemory, ...vmStats },
        telemetry: {
            totalEvents: _telemetryStats.totalEvents,
            errors: _telemetryStats.errors,
            successes: _telemetryStats.successes,
            warnings: _telemetryStats.warnings,
            errorRate1m: _telemetryStats.errorRate1m,
            errorRate5m: _telemetryStats.errorRate5m,
            ringSize: _telemetryRing.length,
            categories: _telemetryStats.categories,
            lastEvent: _telemetryStats.lastEventAt,
        },
        branding: {
            lastScan: monitorState.lastScan,
            healthy: monitorState.healthy,
            degraded: monitorState.degraded,
            scanCount: monitorState.scanCount,
        },
        services: {
            responseFilter: 'active',
            modelAbstraction: 'active',
            providerScrubbing: 'active',
            contentSafety: process.env.HEADY_CONTENT_FILTER === 'strict' ? 'strict' : 'standard',
        },
    };
}

// ═══════════════════════════════════════════════════════════════════
// STARTUP — Boot the full self-awareness loop
// ═══════════════════════════════════════════════════════════════════

function startSelfAwareness() {
    // Hook into process events for automatic telemetry ingestion
    process.on('heady:circuit', (data) => {
        ingestTelemetry({
            type: 'circuit_breaker',
            summary: `Circuit ${data.breaker}: ${data.from} → ${data.to}`,
            data,
            severity: data.to === 'OPEN' ? 'error' : 'info',
        });
    });

    // Start branding monitor (dynamic interval)
    const brandingScanInterval = () => {
        const mem = process.memoryUsage();
        const pressure = mem.heapUsed / mem.heapTotal;
        // Under pressure: scan less often. Idle: scan more often.
        return Math.round((6 * 60 * 60 * 1000) * (1 + pressure * PHI));
    };

    // Initial scan
    const scheduleNext = () => {
        runBrandingScan().catch(err => {
            logger.warn(`  ⚠ BrandingMonitor scan error: ${err.message}`);
        });
        setTimeout(scheduleNext, brandingScanInterval());
    };
    setTimeout(scheduleNext, Math.round(PHI ** 6 * 1000)); // φ⁶ ≈ 17,944ms — organic initial delay

    // Log self-awareness boot
    ingestTelemetry({
        type: 'system_boot',
        summary: 'Self-Awareness Telemetry Loop: ACTIVE',
        severity: 'info',
    });

    logger.logSystem('  ∞ Self-Awareness Telemetry Loop: ACTIVE (metacognitive introspection, branding monitor, telemetry ingestion)');
}

// Also export under the old API name for backward compatibility
const startBrandingMonitor = startSelfAwareness;

module.exports = {
    startSelfAwareness,
    startBrandingMonitor,
    assessSystemState,
    ingestTelemetry,
    getBrandingReport,
    runBrandingScan,
    getSystemIntrospection,
};
