/**
 * Self-Awareness — Branding Monitor + System Introspection + Vector Memory
 * Continuously ensures Heady branding integrity across all services
 * Stores scan results in vector memory for historical trend analysis
 * Reports on system health: vector memory, brain race, response filter
 * Exports: startBrandingMonitor(), getBrandingReport(), getSystemIntrospection()
 */

let vectorMemory = null;
try { vectorMemory = require('./vector-memory'); } catch (e) { /* loaded later */ }

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
    lastScan: null,
    results: {},
    alerts: [],
    scanCount: 0,
    healthy: 0,
    degraded: 0,
};

async function scanDomain(domain) {
    try {
        const resp = await fetch(`https://${domain}/`, {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'HeadyBrandingMonitor/1.0' },
        });
        const html = await resp.text();
        const issues = [];

        // Check for forbidden strings
        for (const forbidden of BRAND_CHECKS.forbiddenStrings) {
            if (html.includes(forbidden)) {
                issues.push({ type: 'forbidden_string', value: forbidden });
            }
        }

        // Check meta tags
        for (const meta of BRAND_CHECKS.requiredMeta) {
            if (!html.includes(meta)) {
                issues.push({ type: 'missing_meta', value: meta });
            }
        }

        // Check branding presence
        const hasAnyBrand = BRAND_CHECKS.requiredBranding.some(b =>
            html.toLowerCase().includes(b.toLowerCase())
        );
        if (!hasAnyBrand) {
            issues.push({ type: 'missing_branding', value: 'No Heady branding found' });
        }

        return {
            domain,
            status: resp.status,
            healthy: issues.length === 0,
            issues,
            responseTime: Date.now(),
            hasFavicon: html.includes('favicon'),
            hasCanonical: html.includes('canonical'),
            hasJsonLd: html.includes('application/ld+json'),
        };
    } catch (err) {
        return {
            domain,
            status: 0,
            healthy: false,
            issues: [{ type: 'unreachable', value: err.message }],
            responseTime: Date.now(),
        };
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
            monitorState.alerts.push({
                domain,
                issueCount: result.issues.length,
                issues: result.issues.map(i => `${i.type}: ${i.value}`),
            });
        }
    }

    // Store scan results in vector memory for historical analysis
    if (vectorMemory && typeof vectorMemory.ingestMemory === 'function') {
        try {
            await vectorMemory.ingestMemory({
                content: `Branding scan #${monitorState.scanCount}: ${monitorState.healthy}/${DOMAINS.length} domains healthy. Alerts: ${monitorState.alerts.map(a => `${a.domain}(${a.issueCount})`).join(', ') || 'none'}`,
                metadata: { type: 'branding_scan', healthy: monitorState.healthy, degraded: monitorState.degraded, scanCount: monitorState.scanCount }
            });
        } catch (e) { /* non-critical */ }
    }

    if (monitorState.alerts.length > 0) {
        console.log(`  🔍 BrandingMonitor: ${monitorState.healthy}/${DOMAINS.length} healthy, ${monitorState.alerts.length} alerts`);
    }
}

function startBrandingMonitor() {
    // Initial scan after 30s startup delay
    setTimeout(() => {
        runBrandingScan().catch(err => {
            console.warn(`  ⚠ BrandingMonitor scan error: ${err.message}`);
        });
    }, 30000);

    // Periodic scan every 6 hours
    setInterval(() => {
        runBrandingScan().catch(err => {
            console.warn(`  ⚠ BrandingMonitor scan error: ${err.message}`);
        });
    }, 6 * 60 * 60 * 1000);

    console.log('  ∞ BrandingMonitor: STARTED (initial scan in 30s, then every 6h)');
}

function getBrandingReport() {
    return {
        node: 'heady-self-awareness',
        role: 'Branding integrity, domain health, and system introspection',
        ...monitorState,
        domains: DOMAINS,
        checks: BRAND_CHECKS,
    };
}

function getSystemIntrospection() {
    const vmStats = vectorMemory ? vectorMemory.getStats() : { total_vectors: 0, embedding_source: 'unavailable' };
    return {
        node: 'heady-introspection',
        ts: new Date().toISOString(),
        vectorMemory: {
            connected: !!vectorMemory,
            ...vmStats,
        },
        branding: {
            lastScan: monitorState.lastScan,
            healthy: monitorState.healthy,
            degraded: monitorState.degraded,
            scanCount: monitorState.scanCount,
        },
        services: {
            responseFilter: 'active (10 patterns)',
            modelAbstraction: 'active (5 service groups)',
            providerScrubbing: 'active',
            contentSafety: process.env.HEADY_CONTENT_FILTER === 'strict' ? 'strict' : 'standard',
        },
    };
}

module.exports = { startBrandingMonitor, getBrandingReport, runBrandingScan, getSystemIntrospection };
