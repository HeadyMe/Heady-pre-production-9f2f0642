/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Trading Bee — Covers all trading/financial modules:
 * trading-tasks.js, apex-risk-agent.js, payment-gateway.js,
 * heady-fintech-agent.js, trader-core.js, biometric-hitl.js, webgl-orderbook.js
 */
const domain = 'trading';
const description = 'Trading tasks, apex risk, payment gateway, fintech agent, trader widgets';
const priority = 0.75;

function getWork(ctx = {}) {
    const mods = [
        { name: 'trading-tasks', path: '../trading-tasks' },
        { name: 'apex-risk-agent', path: '../trading/apex-risk-agent' },
        { name: 'payment-gateway', path: '../api/payment-gateway' },
        { name: 'trader-core', path: '../widgets/trader-widget/trader-core' },
        { name: 'biometric-hitl', path: '../widgets/trader-widget/biometric-hitl' },
        { name: 'webgl-orderbook', path: '../widgets/trader-widget/webgl-orderbook' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
