/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Ops Bee — Covers src/ops/ modules:
 * dag-engine, mlops-logger, scaler
 * Also: deploy-gates, incident-manager, drift-detector
 */
const domain = 'ops';
const description = 'DAG engine, MLOps logger, scaler, deploy gates, incident manager, drift detector';
const priority = 0.8;

function getWork(ctx = {}) {
    const mods = [
        { name: 'dag-engine', path: '../ops/dag-engine' },
        { name: 'mlops-logger', path: '../ops/mlops-logger' },
        { name: 'scaler', path: '../ops/scaler' },
        { name: 'deploy-gates', path: '../deploy-gates' },
        { name: 'incident-manager', path: '../incident-manager' },
        { name: 'drift-detector', path: '../drift-detector' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
