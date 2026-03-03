/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const crypto = require("crypto");

/**
 * ═══ Connector Vault ═══
 *
 * Secure, encrypted token storage for OAuth connector tokens.
 *
 * Each user can have multiple "connectors" — one per provider.
 * Each connector stores:
 *   - provider ID
 *   - granted services (scopes)
 *   - encrypted access token + refresh token
 *   - token expiry
 *   - last-used timestamp
 *
 * Tokens are AES-256-GCM encrypted at rest.
 * In production, the vault delegates to Firestore + Cloud KMS.
 * This module provides the in-memory implementation + encryption layer.
 */

const ENCRYPTION_ALGO = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

class ConnectorVault {
    /**
     * @param {{ encryptionKey?: string, maxConnectorsPerUser?: number }} opts
     */
    constructor(opts = {}) {
        // 32-byte key (hex string or auto-generate for dev)
        const keyHex = opts.encryptionKey || process.env.CONNECTOR_VAULT_KEY || crypto.randomBytes(32).toString("hex");
        this.key = Buffer.from(keyHex, "hex");
        if (this.key.length !== 32) throw new Error("CONNECTOR_VAULT_KEY must be 32 bytes (64 hex chars)");

        this.maxPerUser = opts.maxConnectorsPerUser || 50;
        this.connectors = new Map(); // userId → Map<providerId, ConnectorRecord>
        this.metrics = {
            stored: 0,
            revoked: 0,
            refreshed: 0,
            decryptFailures: 0,
        };
    }

    // ─── Encrypt / Decrypt ───────────────────────────────

    _encrypt(plaintext) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();
        // Pack: iv(16) + authTag(16) + ciphertext
        return Buffer.concat([iv, authTag, encrypted]).toString("base64");
    }

    _decrypt(packed) {
        try {
            const buf = Buffer.from(packed, "base64");
            const iv = buf.subarray(0, IV_LENGTH);
            const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
            const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
            const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, this.key, iv);
            decipher.setAuthTag(authTag);
            return decipher.update(ciphertext, null, "utf8") + decipher.final("utf8");
        } catch (err) {
            this.metrics.decryptFailures++;
            throw new Error("Token decryption failed: " + err.message);
        }
    }

    // ─── Store / Update Connector ────────────────────────

    /**
     * Store or update a connector for a user.
     * @param {string} userId
     * @param {{ providerId: string, accessToken: string, refreshToken?: string, expiresAt?: number, grantedServices: string[], scopes: string[], providerUid?: string, email?: string }} data
     */
    storeConnector(userId, data) {
        if (!userId) throw new Error("userId required");
        if (!data.providerId) throw new Error("providerId required");
        if (!data.accessToken) throw new Error("accessToken required");
        if (!Array.isArray(data.grantedServices)) throw new Error("grantedServices array required");

        if (!this.connectors.has(userId)) this.connectors.set(userId, new Map());
        const userMap = this.connectors.get(userId);

        if (userMap.size >= this.maxPerUser && !userMap.has(data.providerId)) {
            throw new Error("max connectors per user reached");
        }

        const record = {
            providerId: data.providerId,
            providerUid: data.providerUid || null,
            email: data.email || null,
            grantedServices: data.grantedServices,
            scopes: data.scopes || [],
            encryptedAccessToken: this._encrypt(data.accessToken),
            encryptedRefreshToken: data.refreshToken ? this._encrypt(data.refreshToken) : null,
            expiresAt: data.expiresAt || null,
            connectedAt: Date.now(),
            lastUsedAt: null,
            status: "active",
        };

        const existing = userMap.get(data.providerId);
        if (existing) {
            // Update: merge granted services
            const merged = new Set([...existing.grantedServices, ...data.grantedServices]);
            record.grantedServices = Array.from(merged);
            record.connectedAt = existing.connectedAt;
        }

        userMap.set(data.providerId, record);
        this.metrics.stored++;

        return {
            ok: true,
            userId,
            providerId: data.providerId,
            grantedServices: record.grantedServices,
            connectedAt: new Date(record.connectedAt).toISOString(),
        };
    }

    // ─── Get Token (Decrypted) ───────────────────────────

    /**
     * Retrieve the decrypted access token for a connector.
     * Updates lastUsedAt.
     * @param {string} userId
     * @param {string} providerId
     * @returns {{ accessToken: string, refreshToken?: string, expiresAt?: number, grantedServices: string[] }}
     */
    getToken(userId, providerId) {
        const record = this._getRecord(userId, providerId);

        // Check expiry
        if (record.expiresAt && Date.now() > record.expiresAt) {
            record.status = "expired";
            throw new Error("Token expired — refresh required");
        }

        record.lastUsedAt = Date.now();

        return {
            accessToken: this._decrypt(record.encryptedAccessToken),
            refreshToken: record.encryptedRefreshToken ? this._decrypt(record.encryptedRefreshToken) : null,
            expiresAt: record.expiresAt,
            grantedServices: record.grantedServices,
            scopes: record.scopes,
        };
    }

    // ─── Refresh Token ───────────────────────────────────

    /**
     * Update the access token after a refresh.
     * @param {string} userId
     * @param {string} providerId
     * @param {{ accessToken: string, expiresAt?: number }} data
     */
    refreshToken(userId, providerId, data) {
        const record = this._getRecord(userId, providerId);
        record.encryptedAccessToken = this._encrypt(data.accessToken);
        record.expiresAt = data.expiresAt || null;
        record.status = "active";
        this.metrics.refreshed++;
        return { ok: true, providerId, expiresAt: record.expiresAt };
    }

    // ─── Revoke Connector ────────────────────────────────

    /**
     * Revoke and remove a connector for a user.
     * @param {string} userId
     * @param {string} providerId
     */
    revokeConnector(userId, providerId) {
        const userMap = this.connectors.get(userId);
        if (!userMap || !userMap.has(providerId)) {
            throw new Error("connector not found");
        }
        userMap.delete(providerId);
        if (userMap.size === 0) this.connectors.delete(userId);
        this.metrics.revoked++;
        return { ok: true, userId, providerId, revoked: true };
    }

    // ─── Update Granted Services ─────────────────────────

    /**
     * Add or remove granted services for a connector.
     * @param {string} userId
     * @param {string} providerId
     * @param {{ add?: string[], remove?: string[] }} changes
     */
    updateServices(userId, providerId, changes = {}) {
        const record = this._getRecord(userId, providerId);
        const services = new Set(record.grantedServices);
        if (changes.add) changes.add.forEach((s) => services.add(s));
        if (changes.remove) changes.remove.forEach((s) => services.delete(s));
        record.grantedServices = Array.from(services);
        return { ok: true, providerId, grantedServices: record.grantedServices };
    }

    // ─── List Connectors ─────────────────────────────────

    /**
     * List all connectors for a user (without decrypted tokens).
     * @param {string} userId
     * @returns {Array<{ providerId, grantedServices, status, connectedAt, lastUsedAt, hasRefreshToken, expiresAt }>}
     */
    listConnectors(userId) {
        const userMap = this.connectors.get(userId);
        if (!userMap) return [];
        return Array.from(userMap.values()).map((r) => ({
            providerId: r.providerId,
            providerUid: r.providerUid,
            email: r.email,
            grantedServices: r.grantedServices,
            scopes: r.scopes,
            status: r.status,
            connectedAt: new Date(r.connectedAt).toISOString(),
            lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
            hasRefreshToken: !!r.encryptedRefreshToken,
            expiresAt: r.expiresAt,
        }));
    }

    // ─── Health / Metrics ────────────────────────────────

    getHealth() {
        let totalConnectors = 0;
        let activeConnectors = 0;
        let expiredConnectors = 0;
        const now = Date.now();

        for (const [, userMap] of this.connectors) {
            for (const [, record] of userMap) {
                totalConnectors++;
                if (record.expiresAt && now > record.expiresAt) {
                    expiredConnectors++;
                } else {
                    activeConnectors++;
                }
            }
        }

        return {
            status: expiredConnectors > totalConnectors / 2 ? "degraded" : "healthy",
            users: this.connectors.size,
            totalConnectors,
            activeConnectors,
            expiredConnectors,
            metrics: { ...this.metrics },
            ts: new Date().toISOString(),
        };
    }

    // ─── Internal ────────────────────────────────────────

    _getRecord(userId, providerId) {
        const userMap = this.connectors.get(userId);
        if (!userMap) throw new Error("no connectors for user");
        const record = userMap.get(providerId);
        if (!record) throw new Error("connector not found: " + providerId);
        return record;
    }
}

module.exports = { ConnectorVault };
