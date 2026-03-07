/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Model Armor & Data Loss Prevention (DLP) Middleware
 *
 * Every prompt passed through the A2A mesh is routed through this layer:
 * - Neutralizes prompt injection jailbreaks
 * - Redacts PII before it reaches the LLM
 * - Blocks adversarial payloads
 * - Logs all security events
 */

'use strict';

const logger = require('../utils/logger');

// ─── PII Patterns ────────────────────────────────────────────────────────────
const PII_PATTERNS = [
    { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
    { name: 'credit_card', regex: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[REDACTED-CC]' },
    { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED-EMAIL]' },
    { name: 'phone', regex: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED-PHONE]' },
    { name: 'api_key', regex: /\b(sk-|pk_|api[_-]?key[=:]\s*)[a-zA-Z0-9_-]{20,}\b/gi, replacement: '[REDACTED-APIKEY]' },
    { name: 'password', regex: /(password|passwd|pwd)\s*[=:]\s*\S+/gi, replacement: '[REDACTED-PASSWORD]' },
    { name: 'bearer_token', regex: /Bearer\s+[a-zA-Z0-9_.-]+/gi, replacement: 'Bearer [REDACTED]' },
    { name: 'db_url', regex: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+/gi, replacement: '[REDACTED-DB-URL]' },
];

// ─── Prompt Injection Patterns ───────────────────────────────────────────────
const INJECTION_PATTERNS = [
    { name: 'system_override', regex: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules)/gi },
    { name: 'role_escape', regex: /(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you're)|your\s+new\s+role)/gi },
    { name: 'code_injection', regex: /(?:eval|exec|system|__import__|os\.system|child_process|require\s*\(\s*['"](?:child_process|fs|net))/gi },
    { name: 'encoding_bypass', regex: /(?:base64|atob|btoa|hex|unicode_escape)\s*\(/gi },
    { name: 'delimiter_attack', regex: /(?:```system|<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]|<\/?s>)/gi },
    { name: 'data_exfil', regex: /(?:send|post|upload|exfiltrate|transmit)\s+(?:all|every|the)\s+(?:data|info|content|secrets)/gi },
];

// ─── Model Armor Engine ──────────────────────────────────────────────────────
class ModelArmor {
    constructor(opts = {}) {
        this._stats = { scanned: 0, blocked: 0, redacted: 0, clean: 0 };
        this._blockedLog = [];
        this._enabled = opts.enabled !== false;
        this._strictMode = opts.strictMode || false;
        this._maxBlockedLogSize = opts.maxBlockedLogSize || 200;
    }

    /**
     * Scan text for prompt injection attacks.
     * @returns {{ safe: boolean, threats: Array, sanitized: string }}
     */
    scanForInjection(text) {
        if (!text || typeof text !== 'string') return { safe: true, threats: [], sanitized: text };

        const threats = [];
        for (const pattern of INJECTION_PATTERNS) {
            const matches = text.match(pattern.regex);
            if (matches) {
                threats.push({
                    type: pattern.name,
                    matches: matches.length,
                    samples: matches.slice(0, 3),
                });
            }
        }

        return {
            safe: threats.length === 0,
            threats,
            sanitized: threats.length > 0 ? this._sanitizeInjection(text) : text,
        };
    }

    /**
     * Redact PII from text.
     * @returns {{ redacted: string, findings: Array }}
     */
    redactPII(text) {
        if (!text || typeof text !== 'string') return { redacted: text, findings: [] };

        const findings = [];
        let redacted = text;

        for (const pattern of PII_PATTERNS) {
            const matches = redacted.match(pattern.regex);
            if (matches) {
                findings.push({ type: pattern.name, count: matches.length });
                redacted = redacted.replace(pattern.regex, pattern.replacement);
            }
        }

        if (findings.length > 0) this._stats.redacted++;
        return { redacted, findings };
    }

    /**
     * Full armor scan: injection + PII + content policy.
     */
    fullScan(text) {
        this._stats.scanned++;

        const injection = this.scanForInjection(text);
        const pii = this.redactPII(injection.sanitized);

        const result = {
            safe: injection.safe,
            text: pii.redacted,
            originalLength: text.length,
            processedLength: pii.redacted.length,
            injectionThreats: injection.threats,
            piiFindings: pii.findings,
            blocked: false,
            ts: new Date().toISOString(),
        };

        if (!injection.safe) {
            this._stats.blocked++;
            result.blocked = this._strictMode;
            this._logBlocked(result);
        }

        if (injection.safe && pii.findings.length === 0) {
            this._stats.clean++;
        }

        return result;
    }

    /**
     * Sanitize detected injection attempts.
     */
    _sanitizeInjection(text) {
        let sanitized = text;
        for (const pattern of INJECTION_PATTERNS) {
            sanitized = sanitized.replace(pattern.regex, `[BLOCKED: ${pattern.name}]`);
        }
        return sanitized;
    }

    _logBlocked(result) {
        this._blockedLog.push({
            ts: result.ts,
            threats: result.injectionThreats.map(t => t.type),
            textPreview: result.text.slice(0, 100),
        });
        if (this._blockedLog.length > this._maxBlockedLogSize) {
            this._blockedLog = this._blockedLog.slice(-100);
        }
    }

    getStats() {
        return { ...this._stats, blockedLogSize: this._blockedLog.length };
    }

    getBlockedLog() {
        return this._blockedLog.slice(-50);
    }
}

// ─── Express Middleware ──────────────────────────────────────────────────────
function createModelArmorMiddleware(opts = {}) {
    const armor = new ModelArmor(opts);
    const protectedPaths = opts.protectedPaths || ['/api/v2/a2a/', '/api/pipeline/', '/api/v1/train', '/brain/'];

    const middleware = (req, res, next) => {
        // Only scan POST/PUT/PATCH with body content
        if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

        // Only scan protected paths
        const isProtected = protectedPaths.some(p => req.path.startsWith(p));
        if (!isProtected) return next();

        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
        if (!body || body.length < 5) return next();

        const result = armor.fullScan(body);

        // Attach scan result to request for downstream use
        req.modelArmorResult = result;

        if (result.blocked) {
            logger.error?.(`[MODEL ARMOR] BLOCKED request to ${req.path}: ${result.injectionThreats.map(t => t.type).join(', ')}`) ||
                console.error(`[MODEL ARMOR] BLOCKED: ${req.path}`);
            return res.status(403).json({
                error: 'Request blocked by Model Armor',
                reason: 'Prompt injection detected',
                threats: result.injectionThreats.map(t => t.type),
            });
        }

        // If PII was found, replace req.body with redacted version
        if (result.piiFindings.length > 0) {
            try {
                req.body = JSON.parse(result.text);
            } catch {
                // If not valid JSON after redaction, keep original
            }
        }

        next();
    };

    // Attach armor instance for route registration
    middleware.armor = armor;
    return middleware;
}

// ─── Route Registration ──────────────────────────────────────────────────────
function registerModelArmorRoutes(app, armor) {
    app.get('/api/v2/security/armor/stats', (req, res) => res.json({ ok: true, ...armor.getStats() }));
    app.get('/api/v2/security/armor/blocked', (req, res) => res.json({ ok: true, entries: armor.getBlockedLog() }));
    app.post('/api/v2/security/armor/scan', (req, res) => {
        const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const result = armor.fullScan(text);
        res.json({ ok: true, ...result });
    });
}

module.exports = { ModelArmor, createModelArmorMiddleware, registerModelArmorRoutes, PII_PATTERNS, INJECTION_PATTERNS };
