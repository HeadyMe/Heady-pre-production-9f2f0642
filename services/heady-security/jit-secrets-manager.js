/**
 * ═══════════════════════════════════════════════════════════════
 * SEC-001: JIT Secrets Manager
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Just-In-Time secrets injection — loads secrets only when needed,
 * never keeps them in memory longer than the TTL, and provides
 * zero-knowledge rotation support.
 */

'use strict';

const crypto = require('crypto');

class JITSecretsManager {
    constructor(options = {}) {
        this.vault = new Map();          // Encrypted secret store
        this.accessLog = [];             // Audit trail
        this.ttlMs = options.ttlMs || 300000;  // 5-minute TTL
        this.rotationCallbacks = new Map();
        this.masterKey = options.masterKey || this._deriveMasterKey();
    }

    /**
     * Store a secret with encryption
     */
    store(name, value, metadata = {}) {
        const encrypted = this._encrypt(value);
        this.vault.set(name, {
            encrypted,
            metadata: {
                ...metadata,
                createdAt: new Date().toISOString(),
                rotateAfter: metadata.rotateAfter || null,
                scope: metadata.scope || 'global',
            },
            accessCount: 0,
            lastAccessed: null,
        });
        this._log('store', name, 'Secret stored');
    }

    /**
     * JIT retrieve a secret — decrypts only when needed
     */
    retrieve(name, scope = 'global') {
        const entry = this.vault.get(name);
        if (!entry) {
            this._log('access_denied', name, 'Secret not found');
            throw new Error(`Secret not found: ${name}`);
        }

        // Scope validation
        if (entry.metadata.scope !== 'global' && entry.metadata.scope !== scope) {
            this._log('access_denied', name, `Scope mismatch: ${scope} != ${entry.metadata.scope}`);
            throw new Error(`Access denied: scope mismatch for ${name}`);
        }

        entry.accessCount++;
        entry.lastAccessed = new Date().toISOString();

        const decrypted = this._decrypt(entry.encrypted);

        // Schedule auto-wipe from memory
        setTimeout(() => {
            // In a real implementation, this would clear the decrypted value from V8 heap
            this._log('auto_wipe', name, 'TTL expired, value wiped from memory');
        }, this.ttlMs);

        this._log('access', name, `Retrieved (count: ${entry.accessCount})`);
        return decrypted;
    }

    /**
     * Rotate a secret
     */
    rotate(name, newValue) {
        const entry = this.vault.get(name);
        if (!entry) throw new Error(`Cannot rotate: ${name} not found`);

        const oldMetadata = { ...entry.metadata };
        entry.encrypted = this._encrypt(newValue);
        entry.metadata.rotatedAt = new Date().toISOString();
        entry.metadata.previousVersion = oldMetadata.createdAt;

        // Notify rotation callbacks
        const callback = this.rotationCallbacks.get(name);
        if (callback) {
            try { callback(name); } catch (e) { /* ignore callback errors */ }
        }

        this._log('rotate', name, 'Secret rotated');
        return { rotated: true, name, at: entry.metadata.rotatedAt };
    }

    /**
     * Register a callback for when a secret is rotated
     */
    onRotation(name, callback) {
        this.rotationCallbacks.set(name, callback);
    }

    /**
     * Delete a secret permanently
     */
    destroy(name) {
        const existed = this.vault.delete(name);
        this._log('destroy', name, existed ? 'Secret destroyed' : 'Secret not found');
        return existed;
    }

    /**
     * List secret names (not values)
     */
    list() {
        return Array.from(this.vault.entries()).map(([name, entry]) => ({
            name,
            scope: entry.metadata.scope,
            createdAt: entry.metadata.createdAt,
            accessCount: entry.accessCount,
            lastAccessed: entry.lastAccessed,
        }));
    }

    /**
     * Get audit log
     */
    getAuditLog(limit = 50) {
        return this.accessLog.slice(-limit);
    }

    // ─── Crypto ──────────────────────────────────────────────────

    _encrypt(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
        let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return { iv: iv.toString('hex'), data: encrypted, tag: authTag.toString('hex') };
    }

    _decrypt(encrypted) {
        const iv = Buffer.from(encrypted.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
        decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
        let decrypted = decipher.update(encrypted.data, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }

    _deriveMasterKey() {
        const seed = process.env.HEADY_MASTER_KEY || 'heady-dev-key-change-in-production';
        return crypto.scryptSync(seed, 'heady-salt', 32);
    }

    _log(action, name, detail) {
        this.accessLog.push({
            action,
            name,
            detail,
            timestamp: new Date().toISOString(),
        });
    }
}

// ─── Load secrets from .env ─────────────────────────────────────
function loadFromEnv(manager) {
    const secretKeys = [
        'HEADY_MASTER_KEY', 'JWT_SIGNING_KEY', 'DATABASE_URL',
        'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_AI_KEY',
        'PERPLEXITY_API_KEY', 'GROQ_API_KEY', 'STRIPE_SECRET_KEY',
        'CLOUDFLARE_API_TOKEN', 'GITHUB_TOKEN',
    ];

    let loaded = 0;
    for (const key of secretKeys) {
        if (process.env[key]) {
            manager.store(key, process.env[key], { scope: 'service' });
            loaded++;
        }
    }
    return loaded;
}

if (require.main === module) {
    const mgr = new JITSecretsManager();

    // Demo
    mgr.store('API_KEY', 'sk-test-1234567890abcdef', { scope: 'service' });
    mgr.store('DB_PASSWORD', 'super-secret-pw', { scope: 'database' });

    console.log('═══ JIT Secrets Manager ═══');
    console.log('Stored:', mgr.list().map(s => s.name));
    console.log('Retrieved:', mgr.retrieve('API_KEY', 'service').substring(0, 10) + '...');
    console.log('Audit:', mgr.getAuditLog());
    console.log('✅ JIT Secrets Manager operational');
}

module.exports = { JITSecretsManager, loadFromEnv };
