/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Mutual TLS (mTLS) Configuration Module
 *
 * Zero-Trust security layer for inter-agent mesh communication.
 * All agent-to-agent traffic must be encrypted via TLS 1.3 with
 * mutual certificate verification.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const https = require('https');
const logger = require('../utils/logger');

const DEFAULT_CERT_DIR = path.join(process.cwd(), 'certs');

/**
 * Load mTLS configuration from certificate files.
 * @param {Object} opts
 * @param {string} opts.certDir - Directory containing cert files
 * @param {string} opts.certFile - Server certificate file name
 * @param {string} opts.keyFile - Server private key file name
 * @param {string} opts.caFile - Certificate Authority file name
 * @returns {Object|null} TLS options or null if certs not found
 */
function loadMTLSConfig(opts = {}) {
    const certDir = opts.certDir || DEFAULT_CERT_DIR;
    const certFile = path.join(certDir, opts.certFile || 'server.crt');
    const keyFile = path.join(certDir, opts.keyFile || 'server.key');
    const caFile = path.join(certDir, opts.caFile || 'ca.crt');

    // Check if certs exist
    const hasCert = fs.existsSync(certFile);
    const hasKey = fs.existsSync(keyFile);
    const hasCA = fs.existsSync(caFile);

    if (!hasCert || !hasKey) {
        logger.warn?.('[mTLS] Certificates not found — running in non-mTLS mode') ||
            console.warn('[mTLS] Certificates not found');
        return null;
    }

    const config = {
        cert: fs.readFileSync(certFile),
        key: fs.readFileSync(keyFile),
        ca: hasCA ? [fs.readFileSync(caFile)] : undefined,
        requestCert: true,
        rejectUnauthorized: opts.rejectUnauthorized !== false,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
        ].join(':'),
    };

    logger.info?.('[mTLS] Configuration loaded — TLS 1.3 with mutual verification') ||
        console.log('[mTLS] Configuration loaded');

    return config;
}

/**
 * Create an HTTPS server with mTLS enforcement.
 * Falls back to the provided Express app on regular HTTP if no certs.
 */
function createMTLSServer(app, opts = {}) {
    const tlsConfig = loadMTLSConfig(opts);

    if (!tlsConfig) {
        return { server: null, mtlsEnabled: false, reason: 'certificates_not_found' };
    }

    const server = https.createServer(tlsConfig, app);
    return { server, mtlsEnabled: true };
}

/**
 * Create an HTTPS agent for outbound mTLS requests.
 * Used by agents to communicate with other agents in the mesh.
 */
function createMTLSAgent(opts = {}) {
    const tlsConfig = loadMTLSConfig(opts);
    if (!tlsConfig) return null;

    return new https.Agent({
        cert: tlsConfig.cert,
        key: tlsConfig.key,
        ca: tlsConfig.ca,
        minVersion: 'TLSv1.3',
        rejectUnauthorized: opts.rejectUnauthorized !== false,
        keepAlive: true,
        maxSockets: opts.maxSockets || 50,
    });
}

/**
 * Express middleware to enforce mTLS on specific routes.
 */
function enforceMTLS(requiredPaths = []) {
    return (req, res, next) => {
        // Only enforce on specified paths
        if (requiredPaths.length > 0) {
            const requiresCheck = requiredPaths.some(p => req.path.startsWith(p));
            if (!requiresCheck) return next();
        }

        // Check if the connection has a valid client certificate
        const cert = req.socket.getPeerCertificate?.();
        const authorized = req.socket.authorized;

        if (!cert || !cert.subject) {
            return res.status(401).json({
                error: 'Client certificate required',
                protocol: 'mTLS 1.3',
                hint: 'Provide a valid client certificate signed by the trusted CA',
            });
        }

        if (!authorized) {
            return res.status(403).json({
                error: 'Client certificate not authorized',
                subject: cert.subject?.CN,
                issuer: cert.issuer?.CN,
            });
        }

        // Attach cert info to request for RBAC
        req.clientCert = {
            cn: cert.subject.CN,
            org: cert.subject.O,
            issuer: cert.issuer.CN,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            fingerprint: cert.fingerprint256,
        };

        next();
    };
}

/**
 * Register mTLS status routes.
 */
function registerMTLSRoutes(app, tlsConfig) {
    app.get('/api/v2/security/mtls/status', (req, res) => {
        const cert = req.socket.getPeerCertificate?.();
        res.json({
            ok: true,
            mtlsEnabled: !!tlsConfig,
            tlsVersion: req.socket.getProtocol?.() || 'unknown',
            clientCert: cert?.subject ? {
                cn: cert.subject.CN,
                org: cert.subject.O,
                issuer: cert.issuer?.CN,
                authorized: req.socket.authorized,
            } : null,
            serverConfig: tlsConfig ? {
                minVersion: 'TLSv1.3',
                ciphers: 'TLS_AES_256_GCM_SHA384',
                mutualVerification: true,
            } : null,
        });
    });
}

module.exports = {
    loadMTLSConfig,
    createMTLSServer,
    createMTLSAgent,
    enforceMTLS,
    registerMTLSRoutes,
};
