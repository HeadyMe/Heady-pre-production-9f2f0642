/**
 * Heady Project - RBAC Token Vendor (Principle of Least Privilege)
 *
 * Grants narrowly scoped, temporary execution tokens to AI agents 
 * to interface with enterprise databases, APIs, or MCP endpoints.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AUDIT_LOG = path.join(__dirname, '../../data/rbac-audit.log');

class RBACVendor {
    constructor() {
        this.activeTokens = new Map();

        // Ensure audit log dir exists
        const dir = path.dirname(AUDIT_LOG);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    /**
     * @param {string} agentId e.g., 'procurement-agent-alpha'
     * @param {string[]} scopes e.g., ['system:read', 'salesforce:query']
     * @param {number} ttlMs Default 5 minutes (300000 ms)
     */
    issueTemporaryToken(agentId, scopes, ttlMs = 300000) {
        if (!agentId || !Array.isArray(scopes)) throw new Error('Invalid agent Id or scopes');

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + ttlMs;

        const claim = { agentId, scopes, expiresAt };
        this.activeTokens.set(token, claim);

        // Schedule invalidation
        setTimeout(() => this.activeTokens.delete(token), ttlMs);

        // Immutable Audit Trail
        this._audit({
            action: 'ISSUE_TOKEN',
            agentId,
            scopes,
            ttl: ttlMs,
            tokenId: token.substring(0, 8) + '...'
        });

        return token;
    }

    validateToken(token, requiredScope) {
        const claim = this.activeTokens.get(token);
        if (!claim) return { valid: false, reason: 'Token not found or expired' };
        if (Date.now() > claim.expiresAt) {
            this.activeTokens.delete(token); // cleanup
            return { valid: false, reason: 'Token expired' };
        }

        if (!claim.scopes.includes(requiredScope) && !claim.scopes.includes('admin:all')) {
            this._audit({
                action: 'DENIED_ACCESS',
                agentId: claim.agentId,
                requestedScope: requiredScope,
                grantedScopes: claim.scopes
            });
            return { valid: false, reason: 'Insufficient privilege' };
        }

        this._audit({
            action: 'GRANTED_ACCESS',
            agentId: claim.agentId,
            scope: requiredScope
        });

        return { valid: true, agentId: claim.agentId };
    }

    revokeToken(token) {
        if (this.activeTokens.has(token)) {
            const claim = this.activeTokens.get(token);
            this._audit({ action: 'REVOKE_TOKEN', agentId: claim.agentId });
            this.activeTokens.delete(token);
        }
    }

    _audit(entry) {
        entry.ts = new Date().toISOString();
        const line = JSON.stringify(entry) + '\n';
        fs.appendFile(AUDIT_LOG, line, () => { });
    }
}

let _rbac = null;
function getRBACVendor() {
    if (!_rbac) _rbac = new RBACVendor();
    return _rbac;
}

module.exports = { RBACVendor, getRBACVendor };
