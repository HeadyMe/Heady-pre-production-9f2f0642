/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Health Bee — Multi-domain health monitoring, service liveness,
 * branding integrity, and edge latency checks.
 */
const domain = 'health';
const description = 'Multi-domain health checks, service liveness probes, branding integrity, edge latency monitoring';
const priority = 0.95;

const HEADY_DOMAINS = [
    'headyme.com', 'headysystems.com', 'headyconnection.org',
    'headymcp.com', 'headyio.com', 'headybuddy.org',
    'headybot.com', 'headyos.com', 'headyapi.com',
];

const INTERNAL_ENDPOINTS = [
    { name: 'cloud-run', url: '/api/health' },
    { name: 'brain', url: '/api/brain/status' },
    { name: 'registry', url: '/api/registry' },
];

function getWork(ctx = {}) {
    const work = [];

    // Domain health checks
    work.push(...HEADY_DOMAINS.map(d => async () => {
        try {
            const start = Date.now();
            const resp = await fetch(`https://${d}/`, {
                signal: AbortSignal.timeout(10000),
                headers: { 'User-Agent': 'HeadyHealthBee/1.0' },
            });
            const latency = Date.now() - start;
            const html = await resp.text();
            const hasHeadyBrand = html.toLowerCase().includes('heady');
            const hasCanvas = html.includes('canvas') || html.includes('sacred');
            const hasForbidden = ['localhost', 'TODO', 'FIXME'].some(f => html.includes(f));
            return {
                bee: domain, action: `check-${d}`,
                status: resp.status, latency, healthy: resp.ok && hasHeadyBrand && !hasForbidden,
                branding: hasHeadyBrand, canvas: hasCanvas, forbidden: hasForbidden,
            };
        } catch (err) {
            return { bee: domain, action: `check-${d}`, status: 0, healthy: false, error: err.message };
        }
    }));

    // Internal service liveness
    work.push(...INTERNAL_ENDPOINTS.map(ep => async () => {
        try {
            const baseUrl = process.env.HEADY_URL || 'https://headyme.com';
            const resp = await fetch(`${baseUrl}${ep.url}`, { signal: AbortSignal.timeout(5000) });
            return { bee: domain, action: `liveness-${ep.name}`, status: resp.status, healthy: resp.ok };
        } catch (err) {
            return { bee: domain, action: `liveness-${ep.name}`, status: 0, healthy: false, error: err.message };
        }
    }));

    return work;
}

module.exports = { domain, description, priority, getWork, HEADY_DOMAINS, INTERNAL_ENDPOINTS };
