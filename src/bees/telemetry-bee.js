/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Telemetry Bee — Covers all src/telemetry/ modules:
 * cognitive-telemetry, proof-view-receipts, provider-usage-tracker (502 lines)
 * Also covers system-monitor.js (508 lines) and self-optimizer.js (487 lines)
 */
const domain = 'telemetry';
const description = 'Cognitive telemetry, proof-view receipts, provider usage tracking, system monitor, self-optimizer';
const priority = 0.75;

function getWork(ctx = {}) {
    const mods = [
        { name: 'cognitive-telemetry', path: '../telemetry/cognitive-telemetry' },
        { name: 'proof-view-receipts', path: '../telemetry/proof-view-receipts' },
        { name: 'provider-usage-tracker', path: '../telemetry/provider-usage-tracker' },
        { name: 'system-monitor', path: '../system-monitor' },
        { name: 'self-optimizer', path: '../self-optimizer' },
        { name: 'self-awareness', path: '../self-awareness' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
