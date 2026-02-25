/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                  ║
 * ║  Copyright © 2024-2026 HeadySystems Inc. All Rights Reserved.      ║
 * ║                                                                     ║
 * ║  This file contains trade secrets of HeadySystems Inc.              ║
 * ║  Unauthorized copying, distribution, or use is strictly prohibited  ║
 * ║  and may result in civil and criminal penalties.                    ║
 * ║                                                                     ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Heady Secret Rotation — Automated credential lifecycle management
 * Tracks secret age, warns on expiry, and provides rotation helpers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRETS_MANIFEST = path.join(__dirname, '../../configs/secrets-manifest.json');
const MAX_AGE_DAYS = 90;
const WARN_DAYS_BEFORE = 14;

class SecretRotation {
    constructor() {
        this.manifest = this._loadManifest();
    }

    _loadManifest() {
        try {
            return JSON.parse(fs.readFileSync(SECRETS_MANIFEST, 'utf8'));
        } catch {
            return { secrets: [], lastAudit: null };
        }
    }

    _saveManifest() {
        fs.writeFileSync(SECRETS_MANIFEST, JSON.stringify(this.manifest, null, 2));
    }

    /**
     * Register a secret for tracking
     * @param {string} name - e.g. 'HEADY_COMPUTE_KEY'
     * @param {Object} opts - { provider, rotatedAt, envVar, rotationUrl }
     */
    register(name, opts = {}) {
        const existing = this.manifest.secrets.find(s => s.name === name);
        const entry = {
            name,
            provider: opts.provider || 'unknown',
            envVar: opts.envVar || name,
            rotatedAt: opts.rotatedAt || new Date().toISOString(),
            rotationUrl: opts.rotationUrl || null,
            maxAgeDays: opts.maxAgeDays || MAX_AGE_DAYS,
        };
        if (existing) {
            Object.assign(existing, entry);
        } else {
            this.manifest.secrets.push(entry);
        }
        this._saveManifest();
    }

    /**
     * Audit all secrets for age and expiry
     * @returns {{ healthy: Array, warning: Array, expired: Array }}
     */
    audit() {
        const now = Date.now();
        const healthy = [];
        const warning = [];
        const expired = [];

        for (const secret of this.manifest.secrets) {
            const rotatedAt = new Date(secret.rotatedAt).getTime();
            const ageDays = Math.floor((now - rotatedAt) / (1000 * 60 * 60 * 24));
            const maxAge = secret.maxAgeDays || MAX_AGE_DAYS;
            const daysUntilExpiry = maxAge - ageDays;

            const record = {
                ...secret,
                ageDays,
                daysUntilExpiry,
                hasEnvValue: !!process.env[secret.envVar],
            };

            if (daysUntilExpiry <= 0) {
                expired.push(record);
            } else if (daysUntilExpiry <= WARN_DAYS_BEFORE) {
                warning.push(record);
            } else {
                healthy.push(record);
            }
        }

        this.manifest.lastAudit = new Date().toISOString();
        this._saveManifest();

        return {
            auditedAt: this.manifest.lastAudit,
            total: this.manifest.secrets.length,
            healthy, warning, expired,
            score: this.manifest.secrets.length > 0
                ? ((healthy.length / this.manifest.secrets.length) * 100).toFixed(0) + '%'
                : 'N/A',
        };
    }

    /**
     * Generate a secure random token (for local secrets)
     * @param {number} bytes - default 32
     * @returns {string} hex token
     */
    static generateToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }
}

module.exports = { SecretRotation };
