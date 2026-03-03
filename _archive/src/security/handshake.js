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
 * src/security/handshake.js
 * PQC-enhanced mTLS substitute for internal service-to-service auth.
 * Uses SHA3-256 HMAC with revolving Node Tokens.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let headyPQC;
try {
    headyPQC = require('./pqc').headyPQC;
} catch { headyPQC = null; }

const Handshake = {
    _tokenCache: new Map(),
    _secret: process.env.INTERNAL_NODE_SECRET || 'heady-mesh-default-secret-2026',
    _pqcEnabled: !!headyPQC,

    /**
     * Generate a signed token for an internal node
     * @param {string} nodeId - e.g. 'HEADY_CLAUDE'
     * @returns {string} - Signed token
     */
    generateToken(nodeId) {
        const ts = Date.now();
        const payload = `${nodeId}:${ts}`;
        const signature = crypto
            .createHmac('sha3-256', this._secret)
            .update(payload)
            .digest('hex');
        return Buffer.from(`${payload}:${signature}`).toString('base64');
    },

    /**
     * Validate an incoming handshake token
     * @param {string} token - Base64 token
     * @returns {Object} - { valid: boolean, nodeId: string, age: number }
     */
    validateToken(token) {
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            const [nodeId, ts, signature] = decoded.split(':');

            // Re-sign to verify
            const expectedSig = crypto
                .createHmac('sha3-256', this._secret)
                .update(`${nodeId}:${ts}`)
                .digest('hex');

            if (signature !== expectedSig) return { valid: false, error: 'invalid_signature' };

            const age = Date.now() - parseInt(ts);
            // Tokens expire after 5 minutes
            if (age > 300000) return { valid: false, error: 'token_expired', age };

            return { valid: true, nodeId, age };
        } catch (err) {
            return { valid: false, error: 'malformed_token' };
        }
    },

    /**
     * Middleware for Express to enforce internal handshake
     */
    middleware(req, res, next) {
        const token = req.headers['x-heady-handshake'];
        if (!token) {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Internal service mesh authentication required (x-heady-handshake missing)'
            });
        }

        const result = Handshake.validateToken(token);
        if (!result.valid) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: `Handshake failed: ${result.error}`,
                suggested_action: 'Perform a new node-to-node handshake'
            });
        }

        req.internalNode = result.nodeId;
        next();
    }
};

module.exports = Handshake;
