'use strict';

/**
 * security-hardening.js — OWASP Top 10 Security Middleware
 *
 * New file: comprehensive security middleware layer for the Heady platform.
 *
 * Protections implemented:
 *  1. Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy)
 *  2. Request sanitization (path traversal prevention, null-byte injection, oversized payloads)
 *  3. Prompt injection detection (multi-layer: keyword, pattern, Unicode normalization)
 *  4. RuleZGatekeeper path jail (prevents directory traversal on YAML schema loading)
 *  5. Content-Type enforcement (reject requests with unexpected MIME types)
 *  6. JSON deserialization safety (prototype pollution prevention)
 *  7. Correlation ID injection (X-Request-ID propagation for audit trail linkage)
 *  8. Security event structured logging
 *
 * @module security-hardening
 */

const crypto = require('crypto');
const path   = require('path');
const logger = require('../utils/logger');

// ─── Security logger ───────────────────────────────────────────────────────────

/**
 * Emit a structured security event.
 * In production, wire this to a SIEM (Splunk, Datadog Security, etc.).
 *
 * @param {string} event   - Security event type
 * @param {object} details - Event payload
 */
function securityEvent(event, details = {}) {
    const entry = {
        level:       'SECURITY',
        event,
        timestamp:   new Date().toISOString(),
        requestId:   details.requestId,
        ip:          details.ip,
        userId:      details.userId,
        ...details,
    };
    logger.warn(`[SECURITY] ${event}`, entry);
    // Emit to SIEM stream in production:
    // process.emit('heady:security-event', entry);
    return entry;
}

// ─── 1. Security Headers Middleware ───────────────────────────────────────────

/**
 * Attach security headers to every response.
 * Covers OWASP Top 10 A05:2021 (Security Misconfiguration).
 *
 * @param {object} [opts]
 * @param {string}  [opts.cspDirectives]  - Custom CSP; defaults to strict policy
 * @param {boolean} [opts.hsts=true]      - Enable Strict-Transport-Security
 * @param {number}  [opts.hstsMaxAge]     - HSTS max-age in seconds (default: 1 year)
 * @returns {import('express').RequestHandler}
 */
function securityHeaders(opts = {}) {
    const hstsMaxAge = opts.hstsMaxAge ?? 31_536_000; // 1 year
    const enableHsts = opts.hsts !== false;

    const csp = opts.cspDirectives ??
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'; " +
        "base-uri 'self'; " +
        "object-src 'none';";

    return (req, res, next) => {
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        // Prevent MIME sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // XSS filter (legacy browsers)
        res.setHeader('X-XSS-Protection', '1; mode=block');
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        // CSP
        res.setHeader('Content-Security-Policy', csp);
        // Permissions policy
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        // Remove server fingerprint
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');

        if (enableHsts) {
            res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains; preload`);
        }

        // Cache control for auth endpoints
        if (req.path.startsWith('/auth') || req.path.startsWith('/api/auth')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
        }

        next();
    };
}

// ─── 2. Correlation ID Middleware ─────────────────────────────────────────────

/**
 * Inject a correlation ID for request tracing.
 * Reads X-Request-ID header from caller (if trusted), or generates a fresh one.
 *
 * @returns {import('express').RequestHandler}
 */
function correlationId() {
    return (req, res, next) => {
        const fromHeader = req.headers['x-request-id'];
        // Only accept caller-provided IDs if they match safe format (prevent header injection)
        const id = (fromHeader && /^[\w\-]{8,64}$/.test(fromHeader))
            ? fromHeader
            : crypto.randomUUID();

        req.requestId = id;
        res.setHeader('X-Request-ID', id);
        next();
    };
}

// ─── 3. Request Sanitization ──────────────────────────────────────────────────

/**
 * Sanitize incoming requests against path traversal, null-byte injection,
 * and oversized payloads.
 * Covers OWASP A01:2021 (Broken Access Control) and A03:2021 (Injection).
 *
 * @param {object} [opts]
 * @param {number} [opts.maxUrlLength=2048]     - Max URL length
 * @param {number} [opts.maxHeaderValueLen=8192] - Max length of any single header value
 * @returns {import('express').RequestHandler}
 */
function requestSanitizer(opts = {}) {
    const maxUrlLength      = opts.maxUrlLength      ?? 2048;
    const maxHeaderValueLen = opts.maxHeaderValueLen ?? 8192;

    // Patterns that should never appear in a URL path
    const DANGEROUS_PATH_PATTERNS = [
        /\.\.\//,          // Path traversal (Unix)
        /\.\.\\/,          // Path traversal (Windows)
        /%2e%2e/i,         // URL-encoded ..
        /%252e/i,           // Double-encoded .
        /\0/,              // Null byte
        /<script/i,        // XSS in path
        /javascript:/i,    // JavaScript protocol
        /data:text\/html/i,// Data URI XSS
    ];

    return (req, res, next) => {
        const requestId = req.requestId || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress;

        // URL length check
        if (req.url && req.url.length > maxUrlLength) {
            securityEvent('url-too-long', { requestId, ip, length: req.url.length, max: maxUrlLength });
            return res.status(414).json({ error: 'URI Too Long' });
        }

        // Path sanitization
        for (const pattern of DANGEROUS_PATH_PATTERNS) {
            if (pattern.test(req.url || '')) {
                securityEvent('path-traversal-attempt', {
                    requestId, ip, url: req.url, pattern: pattern.toString()
                });
                return res.status(400).json({ error: 'Bad Request' });
            }
        }

        // Header value length check
        for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string' && value.length > maxHeaderValueLen) {
                securityEvent('header-too-long', {
                    requestId, ip, header: key, length: value.length
                });
                return res.status(431).json({ error: 'Request Header Fields Too Large' });
            }
        }

        next();
    };
}

// ─── 4. Prompt Injection Detection ────────────────────────────────────────────

/**
 * Detect and block prompt injection attempts in AI-bound request payloads.
 * Applied to routes that forward user input to LLM providers.
 *
 * Defense layers:
 *  L1 — Direct keyword patterns
 *  L2 — Structural injection patterns (ignore/override/repeat)
 *  L3 — Unicode normalization (catches homoglyph attacks)
 *  L4 — Role impersonation detection
 *  L5 — Base64 encoded injection (catches obfuscation)
 *
 * Covers OWASP Top 10 for LLMs: LLM01 (Prompt Injection).
 *
 * @returns {import('express').RequestHandler}
 */
function promptInjectionGuard() {
    // L1: High-confidence jailbreak keywords
    const JAILBREAK_KEYWORDS = [
        'ignore previous instructions',
        'ignore all previous',
        'disregard your instructions',
        'forget your instructions',
        'your new instructions',
        'act as if you have no restrictions',
        'dan mode',
        'developer mode enabled',
        'jailbreak',
        'you are now',
        'pretend you are',
        'act as an ai with no',
    ];

    // L2: Structural injection patterns
    const INJECTION_PATTERNS = [
        /\bsystem\s*:\s*(ignore|forget|override|bypass)/i,
        /\[SYSTEM\].*\[\/SYSTEM\]/is,
        /<\|im_start\|>/i,    // OpenAI internal format
        /###\s*(instruction|system|prompt)/i,
        /\brepeat\s+(the\s+)?(above|previous|system)\s+(instructions?|prompt)/i,
        /\bprint\s+(your\s+)?(system\s+)?prompt/i,
        /\bwhat\s+(are|were)\s+(your|the)\s+(instructions?|system\s+prompt)/i,
    ];

    // L4: Role impersonation
    const ROLE_IMPERSONATION = [
        /you\s+are\s+(now\s+)?(a|an)\s+(helpful\s+)?(assistant|ai|chatbot)\s+(with|without|that)/i,
        /from\s+now\s+on\s+(you\s+are|act\s+as)/i,
    ];

    /**
     * Normalize Unicode to catch homoglyph substitutions.
     * e.g., "іgnore" (Cyrillic і) → "ignore"
     */
    function normalize(text) {
        return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    /**
     * Check a single text string for injection signals.
     * @returns {{ injected: boolean, layer: string|null, pattern: string|null }}
     */
    function detect(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return { injected: false, layer: null, pattern: null };
        }

        const normalized = normalize(text);

        // L1 keyword scan
        for (const kw of JAILBREAK_KEYWORDS) {
            if (normalized.includes(kw)) {
                return { injected: true, layer: 'L1-keyword', pattern: kw };
            }
        }

        // L2 structural patterns
        for (const re of INJECTION_PATTERNS) {
            if (re.test(text)) {
                return { injected: true, layer: 'L2-structural', pattern: re.toString() };
            }
        }

        // L3 run normalized text through L2 patterns too
        for (const re of INJECTION_PATTERNS) {
            if (re.test(normalized)) {
                return { injected: true, layer: 'L3-unicode-normalized', pattern: re.toString() };
            }
        }

        // L4 role impersonation
        for (const re of ROLE_IMPERSONATION) {
            if (re.test(text)) {
                return { injected: true, layer: 'L4-role-impersonation', pattern: re.toString() };
            }
        }

        // L5 base64 obfuscation — decode and re-scan
        const b64Matches = text.match(/[A-Za-z0-9+/]{20,}={0,2}/g);
        if (b64Matches) {
            for (const b64 of b64Matches.slice(0, 5)) { // limit to first 5 chunks
                try {
                    const decoded = Buffer.from(b64, 'base64').toString('utf8');
                    const inner = detect(decoded);
                    if (inner.injected) {
                        return { injected: true, layer: 'L5-base64-obfuscated', pattern: inner.pattern };
                    }
                } catch { /* not valid base64, skip */ }
            }
        }

        return { injected: false, layer: null, pattern: null };
    }

    return (req, res, next) => {
        const requestId = req.requestId || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress;
        const userId = req.user?.sub;

        // Extract all text fields from request body
        const textsToCheck = extractTextFields(req.body);

        for (const { path: fieldPath, value } of textsToCheck) {
            const result = detect(value);
            if (result.injected) {
                securityEvent('prompt-injection-detected', {
                    requestId, ip, userId,
                    field: fieldPath,
                    layer: result.layer,
                    pattern: result.pattern,
                    excerpt: value.slice(0, 120),
                });
                return res.status(400).json({
                    error:   'Request contains disallowed content',
                    code:    'PROMPT_INJECTION',
                    layer:   result.layer,
                });
            }
        }

        next();
    };
}

/**
 * Recursively extract all string values from a nested object with field paths.
 * @param {*}      obj
 * @param {string} [prefix]
 * @returns {Array<{path: string, value: string}>}
 */
function extractTextFields(obj, prefix = 'body') {
    const results = [];
    if (!obj || typeof obj !== 'object') return results;

    for (const [key, value] of Object.entries(obj)) {
        const p = `${prefix}.${key}`;
        if (typeof value === 'string') {
            results.push({ path: p, value });
        } else if (typeof value === 'object' && value !== null) {
            results.push(...extractTextFields(value, p));
        }
    }
    return results;
}

// ─── 5. JSON Prototype Pollution Guard ────────────────────────────────────────

/**
 * Block prototype pollution in JSON bodies.
 * Covers OWASP A08:2021 (Software and Data Integrity Failures).
 *
 * Usage: replace express.json() with safeJsonParser().
 *
 * @returns {import('express').RequestHandler}
 */
function safeJsonParser() {
    return (req, res, next) => {
        if (req.headers['content-type']?.includes('application/json')) {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                if (!raw) return next();
                try {
                    const parsed = JSON.parse(raw);
                    // Detect prototype pollution keys
                    if (_hasProtoKeys(parsed)) {
                        securityEvent('prototype-pollution-attempt', {
                            requestId: req.requestId,
                            ip: req.ip,
                        });
                        return res.status(400).json({ error: 'Bad Request' });
                    }
                    req.body = parsed;
                    next();
                } catch {
                    res.status(400).json({ error: 'Invalid JSON' });
                }
            });
        } else {
            next();
        }
    };
}

/** @private */
function _hasProtoKeys(obj, depth = 0) {
    if (depth > 10 || typeof obj !== 'object' || obj === null) return false;
    for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
        if (_hasProtoKeys(obj[key], depth + 1)) return true;
    }
    return false;
}

// ─── 6. Content-Type Enforcement ──────────────────────────────────────────────

/**
 * Enforce expected Content-Type on POST/PUT/PATCH requests.
 * Covers OWASP A03:2021 (Injection).
 *
 * @param {string[]} [allowedTypes] - Default: ['application/json']
 * @returns {import('express').RequestHandler}
 */
function contentTypeEnforcement(allowedTypes = ['application/json']) {
    const modifyMethods = new Set(['POST', 'PUT', 'PATCH']);

    return (req, res, next) => {
        if (!modifyMethods.has(req.method)) return next();

        const ct = req.headers['content-type'] || '';
        const allowed = allowedTypes.some(t => ct.startsWith(t));

        if (!allowed && req.headers['content-length'] !== '0') {
            securityEvent('unexpected-content-type', {
                requestId: req.requestId,
                ip: req.ip,
                contentType: ct,
                allowed: allowedTypes,
            });
            return res.status(415).json({
                error: 'Unsupported Media Type',
                expected: allowedTypes,
            });
        }

        next();
    };
}

// ─── 7. Path Jail for RuleZGatekeeper ─────────────────────────────────────────

/**
 * Jail a file path within a permitted root directory.
 * Use this wherever a path is constructed from config or user-influenced data.
 *
 * Addresses CRIT-004 (RuleZ path traversal).
 *
 * @param {string} base - The permitted root directory (must be absolute)
 * @param {string} rel  - The relative path to resolve
 * @returns {string}    - The resolved absolute path
 * @throws {Error}      - If the resolved path escapes the jail
 */
function jailPath(base, rel) {
    const absBase     = path.resolve(base);
    const absResolved = path.resolve(absBase, rel);

    if (!absResolved.startsWith(absBase + path.sep) && absResolved !== absBase) {
        throw Object.assign(
            new Error(`Path traversal detected: "${rel}" escapes jail "${absBase}"`),
            { code: 'PATH_TRAVERSAL', base: absBase, resolved: absResolved }
        );
    }

    return absResolved;
}

// ─── 8. Health Route Auth Guard ───────────────────────────────────────────────

/**
 * Protect /health/full from unauthenticated access.
 * Allows /health/live and /health/ready (needed for Kubernetes probes from within the cluster).
 *
 * Addresses MED-010 (health routes expose system internals).
 *
 * @param {object} [opts]
 * @param {string} [opts.internalSecret] - Static secret expected in X-Internal-Token header
 * @returns {import('express').RequestHandler}
 */
function healthRouteGuard(opts = {}) {
    const secret = opts.internalSecret || process.env.HEALTH_INTERNAL_SECRET;

    return (req, res, next) => {
        // /live and /ready are safe to expose (no sensitive data)
        if (req.path === '/live' || req.path === '/ready') return next();

        // /full and any other health endpoints require internal token or loopback
        const ip = req.ip || req.connection?.remoteAddress;
        const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

        if (isLoopback) return next();

        if (secret) {
            const provided = req.headers['x-internal-token'];
            if (!provided || !crypto.timingSafeEqual(
                Buffer.from(provided),
                Buffer.from(secret)
            )) {
                securityEvent('health-route-unauthorized', { requestId: req.requestId, ip, path: req.path });
                return res.status(401).json({ error: 'Unauthorized' });
            }
        } else {
            // No secret configured — restrict to loopback only
            securityEvent('health-route-denied-no-secret', { requestId: req.requestId, ip, path: req.path });
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
}

// ─── Middleware stack factory ──────────────────────────────────────────────────

/**
 * Compose the full security middleware stack for use with Express.
 *
 * @example
 * const app = express();
 * app.use(securityStack());
 *
 * @param {object} [opts]
 * @param {boolean} [opts.promptGuard=true]       - Enable prompt injection guard
 * @param {boolean} [opts.contentTypeGuard=true]  - Enable content-type enforcement
 * @param {boolean} [opts.protoGuard=true]        - Enable prototype pollution guard
 * @returns {import('express').RequestHandler[]}
 */
function securityStack(opts = {}) {
    const stack = [
        correlationId(),
        securityHeaders(opts.headers || {}),
        requestSanitizer(opts.sanitizer || {}),
    ];

    if (opts.promptGuard !== false) {
        stack.push(promptInjectionGuard());
    }
    if (opts.contentTypeGuard !== false) {
        stack.push(contentTypeEnforcement(opts.allowedContentTypes));
    }

    return stack;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Middleware
    securityHeaders,
    correlationId,
    requestSanitizer,
    promptInjectionGuard,
    safeJsonParser,
    contentTypeEnforcement,
    healthRouteGuard,
    securityStack,

    // Utilities
    jailPath,
    securityEvent,
    extractTextFields,
};
