/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Security Bee — Covers all security modules:
 * hc_auth.js (648 lines), code-governance.js, env-validator.js,
 * handshake.js, ip-classification.js, pqc.js, rate-limiter.js,
 * rbac-vendor.js, secret-rotation.js, web3-ledger-anchor.js
 */
const domain = 'security';
const description = 'Auth, governance, PQC, rate limiting, RBAC, secret rotation, web3 ledger';
const priority = 1.0;

function getWork(ctx = {}) {
    return [
        async () => { try { require('../hc_auth'); return { bee: domain, action: 'auth', loaded: true }; } catch { return { bee: domain, action: 'auth', loaded: false }; } },
        async () => { try { require('../security/code-governance'); return { bee: domain, action: 'code-governance', loaded: true }; } catch { return { bee: domain, action: 'code-governance', loaded: false }; } },
        async () => { try { require('../security/env-validator'); return { bee: domain, action: 'env-validator', loaded: true }; } catch { return { bee: domain, action: 'env-validator', loaded: false }; } },
        async () => { try { require('../security/handshake'); return { bee: domain, action: 'handshake', loaded: true }; } catch { return { bee: domain, action: 'handshake', loaded: false }; } },
        async () => { try { require('../security/ip-classification'); return { bee: domain, action: 'ip-classification', loaded: true }; } catch { return { bee: domain, action: 'ip-classification', loaded: false }; } },
        async () => { try { require('../security/pqc'); return { bee: domain, action: 'pqc', loaded: true }; } catch { return { bee: domain, action: 'pqc', loaded: false }; } },
        async () => { try { require('../security/rate-limiter'); return { bee: domain, action: 'rate-limiter', loaded: true }; } catch { return { bee: domain, action: 'rate-limiter', loaded: false }; } },
        async () => { try { require('../security/rbac-vendor'); return { bee: domain, action: 'rbac-vendor', loaded: true }; } catch { return { bee: domain, action: 'rbac-vendor', loaded: false }; } },
        async () => { try { require('../security/secret-rotation'); return { bee: domain, action: 'secret-rotation', loaded: true }; } catch { return { bee: domain, action: 'secret-rotation', loaded: false }; } },
        async () => { try { require('../security/web3-ledger-anchor'); return { bee: domain, action: 'web3-ledger', loaded: true }; } catch { return { bee: domain, action: 'web3-ledger', loaded: false }; } },
    ];
}

module.exports = { domain, description, priority, getWork };
