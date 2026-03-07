/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Connectors Bee — Covers all connector/infra services:
 * brain_connector.js, dynamic-synthesizer.js, event-stream.js,
 * hc_cloudflare.js, hc_liquid.js, remote-compute.js, sdk-services.js,
 * sandbox-executor.js, wasm-sandbox.js, compute-dashboard.js
 */
const domain = 'connectors';
const description = 'Brain connector, dynamic synthesizer, event stream, cloudflare, liquid, remote compute, SDK, sandbox, WASM, compute dashboard';
const priority = 0.75;

function getWork(ctx = {}) {
    const mods = [
        { name: 'brain-connector', path: '../brain_connector' },
        { name: 'dynamic-synthesizer', path: '../connectors/dynamic-synthesizer' },
        { name: 'event-stream', path: '../event-stream' },
        { name: 'cloudflare', path: '../hc_cloudflare' },
        { name: 'liquid', path: '../hc_liquid' },
        { name: 'remote-compute', path: '../remote-compute' },
        { name: 'sdk-services', path: '../sdk-services' },
        { name: 'sandbox-executor', path: '../sandbox-executor' },
        { name: 'wasm-sandbox', path: '../api/wasm-sandbox' },
        { name: 'compute-dashboard', path: '../compute-dashboard' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
