/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Governance Bee — Covers governance/approval-gates.js, policy-engine.js,
 * policy-service.js, heady-principles.js, corrections.js
 */
const domain = 'governance';
const description = 'Approval gates, policy engine, policy service, principles, corrections';
const priority = 0.8;

function getWork(ctx = {}) {
    const mods = [
        { name: 'approval-gates', path: '../governance/approval-gates' },
        { name: 'policy-engine', path: '../policy-engine' },
        { name: 'policy-service', path: '../policy-service' },
        { name: 'heady-principles', path: '../heady-principles' },
        { name: 'corrections', path: '../corrections' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
