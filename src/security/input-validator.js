/**
 * Heady MCP Input Validator
 * =========================
 * Validates and sanitizes MCP tool call arguments against:
 * - SQL injection
 * - Path traversal
 * - SSRF (Server-Side Request Forgery)
 * - Command injection
 * - XSS (Cross-Site Scripting)
 * - Prototype pollution
 * - Template injection
 * - NoSQL injection
 *
 * @module src/security/input-validator
 * @version 1.0.0
 */

'use strict';

const { URL } = require('url');
const { fib, CSL_THRESHOLDS } = require('../../shared/phi-math');

// ── Threat Detection Patterns ───────────────────────────────────────────────
const THREAT_PATTERNS = {
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b\s)/i,
    /('|"|;)\s*(OR|AND)\s+\d+\s*=\s*\d+/i,
    /(\bOR\b\s+\d+\s*=\s*\d+|\b1\s*=\s*1\b)/i,
    /--\s*$/m,
    /\/\*[\s\S]*?\*\//,
    /(\bWAITFOR\b\s+\bDELAY\b)/i,
    /(\bBENCHMARK\b\s*\()/i,
    /(\bSLEEP\b\s*\()/i,
    /(\bLOAD_FILE\b\s*\()/i,
    /(\bINTO\s+(?:OUT|DUMP)FILE\b)/i,
  ],
  PATH_TRAVERSAL: [
    /\.\.[/\\]/,
    /[/\\]\.\.[/\\]/,
    /%2e%2e[%2f%5c]/i,
    /%252e%252e/i,
    /\.\.%c0%af/i,
    /\.\.%c1%9c/i,
    /\0/,                        // null byte
    /\/etc\/(passwd|shadow|hosts)/i,
    /\/proc\/self\//i,
    /[/\\](windows|winnt)[/\\]system32/i,
  ],
  SSRF: [
    /^https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|0x7f)/i,
    /^https?:\/\/(?:10\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+|192\.168\.\d+)\.\d+/i,
    /^https?:\/\/169\.254\.\d+\.\d+/i,  // AWS metadata
    /^https?:\/\/metadata\.google\.internal/i, // GCP metadata
    /^https?:\/\/\[::(?:ffff:)?\d+/i, // IPv6 mapped
    /^(?:file|gopher|dict|ftp):\/\//i, // Dangerous protocols
  ],
  COMMAND_INJECTION: [
    /[;&|`$](?!\s*$)/,
    /\$\(/,
    /`[^`]*`/,
    /\|\s*(?:bash|sh|cmd|powershell|python|node|ruby|perl|php)/i,
    /(?:;|\||&&)\s*(?:cat|ls|dir|echo|wget|curl|nc|ncat|netcat)/i,
    />\s*\/(?:dev|tmp|etc)/,
    /\beval\s*\(/,
    /\bexec\s*\(/,
    /\bchild_process/,
    /\brequire\s*\(\s*['"](?:child_process|fs|net|http|os)['"]\)/,
  ],
  XSS: [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on(?:load|error|click|mouseover|focus|blur)\s*=/i,
    /<(?:img|svg|iframe|object|embed|link|style|meta|base)\b/i,
    /expression\s*\(/i,
    /url\s*\(\s*['"]?javascript/i,
    /data:\s*text\/html/i,
  ],
  PROTOTYPE_POLLUTION: [
    /__proto__/,
    /constructor\.prototype/,
    /Object\.(?:assign|defineProperty|setPrototypeOf)/,
    /\["__proto__"\]/,
    /\['__proto__'\]/,
  ],
  TEMPLATE_INJECTION: [
    /\{\{[^}]+\}\}/,       // Handlebars/Mustache
    /\$\{[^}]+\}/,         // ES6 template literal
    /<%= .+ %>/,            // EJS
    /\{%[^%]+%\}/,          // Jinja2/Nunjucks
    /#\{[^}]+\}/,           // Ruby/Pug
  ],
  NOSQL_INJECTION: [
    /\$(?:gt|gte|lt|lte|ne|in|nin|regex|exists|type|where|all|elemMatch)\b/,
    /\{\s*\$(?:gt|lt|ne|regex)/,
    /\bfunction\s*\(\s*\)\s*\{/,  // JavaScript in MongoDB queries
  ],
};

// ── SSRF — Blocked Internal CIDR Ranges ─────────────────────────────────────
const BLOCKED_CIDRS = [
  { prefix: '127.',      label: 'loopback' },
  { prefix: '10.',       label: 'private-class-a' },
  { prefix: '172.16.',   label: 'private-class-b' },
  { prefix: '172.17.',   label: 'private-class-b' },
  { prefix: '172.18.',   label: 'private-class-b' },
  { prefix: '172.19.',   label: 'private-class-b' },
  { prefix: '172.20.',   label: 'private-class-b' },
  { prefix: '172.21.',   label: 'private-class-b' },
  { prefix: '172.22.',   label: 'private-class-b' },
  { prefix: '172.23.',   label: 'private-class-b' },
  { prefix: '172.24.',   label: 'private-class-b' },
  { prefix: '172.25.',   label: 'private-class-b' },
  { prefix: '172.26.',   label: 'private-class-b' },
  { prefix: '172.27.',   label: 'private-class-b' },
  { prefix: '172.28.',   label: 'private-class-b' },
  { prefix: '172.29.',   label: 'private-class-b' },
  { prefix: '172.30.',   label: 'private-class-b' },
  { prefix: '172.31.',   label: 'private-class-b' },
  { prefix: '192.168.',  label: 'private-class-c' },
  { prefix: '169.254.',  label: 'link-local/cloud-metadata' },
  { prefix: '0.0.0.0',   label: 'unspecified' },
];

// ── Input Validator ─────────────────────────────────────────────────────────
class InputValidator {
  constructor(config = {}) {
    this.maxArgLength = config.maxArgLength || fib(14) * 10; // 3770 chars per arg
    this.maxTotalLength = config.maxTotalLength || fib(16) * 10; // 9870 chars total
    this.maxDepth = config.maxDepth || fib(6); // 8 levels of nesting
    this.customPatterns = config.customPatterns || {};
    this.allowedProtocols = new Set(config.allowedProtocols || ['https', 'http']);
    this.allowedDomains = config.allowedDomains || null; // null = all external allowed
    this._stats = { validated: 0, rejected: 0, sanitized: 0, byThreat: {} };
  }

  /**
   * Validate and sanitize MCP tool arguments.
   * @param {string} tool - Tool name
   * @param {Object} args - Tool arguments
   * @returns {{ safe: boolean, sanitized: Object, threats: string[] }}
   */
  validate(tool, args) {
    this._stats.validated++;
    const threats = [];
    const sanitized = {};

    // ── Total size check ────────────────────────────────────────────────
    const totalStr = JSON.stringify(args);
    if (totalStr.length > this.maxTotalLength) {
      threats.push(`Total input size ${totalStr.length} exceeds limit ${this.maxTotalLength}`);
    }

    // ── Depth check ─────────────────────────────────────────────────────
    if (this._getDepth(args) > this.maxDepth) {
      threats.push(`Input nesting depth exceeds limit ${this.maxDepth}`);
    }

    // ── Per-field validation ────────────────────────────────────────────
    for (const [key, value] of Object.entries(args || {})) {
      const fieldThreats = this._validateField(key, value);
      threats.push(...fieldThreats);

      // Sanitize: strip known-dangerous characters but preserve intent
      sanitized[key] = this._sanitize(key, value);
    }

    if (threats.length > 0) {
      this._stats.rejected++;
      for (const t of threats) {
        const type = t.split(':')[0] || 'UNKNOWN';
        this._stats.byThreat[type] = (this._stats.byThreat[type] || 0) + 1;
      }
    }

    return {
      safe: threats.length === 0,
      sanitized: threats.length === 0 ? sanitized : args, // only use sanitized if safe
      threats,
    };
  }

  _validateField(key, value) {
    const threats = [];

    if (typeof value === 'string') {
      // Check length
      if (value.length > this.maxArgLength) {
        threats.push(`SIZE: Field "${key}" exceeds max length ${this.maxArgLength}`);
      }

      // Run all threat patterns
      for (const [category, patterns] of Object.entries(THREAT_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.global) pattern.lastIndex = 0;
          if (pattern.test(value)) {
            threats.push(`${category}: Detected in field "${key}"`);
            break; // one match per category is enough
          }
        }
      }

      // SSRF-specific URL validation
      if (this._looksLikeURL(value)) {
        const urlThreats = this._validateURL(value, key);
        threats.push(...urlThreats);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursive validation for nested objects
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          threats.push(...this._validateField(`${key}[${i}]`, value[i]));
        }
      } else {
        // Check prototype pollution keys
        for (const k of Object.keys(value)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
            threats.push(`PROTOTYPE_POLLUTION: Dangerous key "${k}" in field "${key}"`);
          }
          threats.push(...this._validateField(`${key}.${k}`, value[k]));
        }
      }
    }

    return threats;
  }

  _validateURL(value, key) {
    const threats = [];
    try {
      const url = new URL(value);

      // Protocol check
      if (!this.allowedProtocols.has(url.protocol.replace(':', ''))) {
        threats.push(`SSRF: Blocked protocol "${url.protocol}" in field "${key}"`);
      }

      // Internal IP check
      const hostname = url.hostname.toLowerCase();
      for (const cidr of BLOCKED_CIDRS) {
        if (hostname.startsWith(cidr.prefix) || hostname === 'localhost') {
          threats.push(`SSRF: Blocked internal address "${hostname}" (${cidr.label}) in field "${key}"`);
          break;
        }
      }

      // Domain allowlist check
      if (this.allowedDomains && !this.allowedDomains.includes(hostname)) {
        threats.push(`SSRF: Domain "${hostname}" not in allowlist for field "${key}"`);
      }

      // Cloud metadata check
      if (hostname === 'metadata.google.internal' ||
          hostname === '169.254.169.254') {
        threats.push(`SSRF: Blocked cloud metadata endpoint in field "${key}"`);
      }
    } catch {
      // Not a valid URL — not an SSRF threat
    }
    return threats;
  }

  _sanitize(key, value) {
    if (typeof value === 'string') {
      // Remove null bytes
      let clean = value.replace(/\0/g, '');
      // Normalize path separators
      if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
        clean = clean.replace(/\.\.[/\\]/g, '');
      }
      return clean;
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((v, i) => this._sanitize(`${key}[${i}]`, v));
      }
      const cleanObj = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        cleanObj[k] = this._sanitize(`${key}.${k}`, v);
      }
      return cleanObj;
    }
    return value;
  }

  _looksLikeURL(str) {
    return /^(?:https?|ftp|file|gopher|dict):\/\//i.test(str);
  }

  _getDepth(obj, depth = 0) {
    if (typeof obj !== 'object' || obj === null) return depth;
    let maxDepth = depth;
    for (const v of Object.values(obj)) {
      maxDepth = Math.max(maxDepth, this._getDepth(v, depth + 1));
    }
    return maxDepth;
  }

  getStats() { return { ...this._stats }; }
}

module.exports = { InputValidator, THREAT_PATTERNS, BLOCKED_CIDRS };
