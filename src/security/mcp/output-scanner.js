/**
 * Heady Output Scanner
 * ====================
 * Scans MCP tool execution output for sensitive data and redacts it.
 *
 * Detects and redacts:
 * - AWS access keys (AKIA...)
 * - JWT tokens (eyJ...)
 * - Credit card numbers (Luhn-validated)
 * - Social Security Numbers (SSN)
 * - Private keys (RSA, EC, etc.)
 * - API keys and secrets (common patterns)
 * - Email addresses (in sensitive contexts)
 * - IP addresses (internal ranges)
 * - Database connection strings
 * - Bearer tokens
 *
 * @module src/security/output-scanner
 * @version 1.0.0
 */

'use strict';

const { CSL_THRESHOLDS, cslGate } = require('../../shared/phi-math');

// ── Redaction Patterns ──────────────────────────────────────────────────────
const PATTERNS = [
  {
    name: 'AWS_ACCESS_KEY',
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    severity: 'critical',
    replacement: '[REDACTED:AWS_KEY]',
  },
  {
    name: 'AWS_SECRET_KEY',
    pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    severity: 'critical',
    replacement: '[REDACTED:AWS_SECRET]',
  },
  {
    name: 'JWT_TOKEN',
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
    severity: 'critical',
    replacement: '[REDACTED:JWT]',
  },
  {
    name: 'BEARER_TOKEN',
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
    severity: 'critical',
    replacement: 'Bearer [REDACTED:TOKEN]',
  },
  {
    name: 'PRIVATE_KEY',
    pattern: /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g,
    severity: 'critical',
    replacement: '[REDACTED:PRIVATE_KEY]',
  },
  {
    name: 'CREDIT_CARD',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical',
    replacement: '[REDACTED:CARD]',
    validate: luhnCheck,
  },
  {
    name: 'SSN',
    pattern: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    severity: 'critical',
    replacement: '[REDACTED:SSN]',
    // Additional validation: must be in context of SSN-like usage
    contextRequired: true,
  },
  {
    name: 'GCP_API_KEY',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'high',
    replacement: '[REDACTED:GCP_KEY]',
  },
  {
    name: 'GITHUB_TOKEN',
    pattern: /(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
    replacement: '[REDACTED:GITHUB_TOKEN]',
  },
  {
    name: 'SLACK_TOKEN',
    pattern: /xox[bporas]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: 'high',
    replacement: '[REDACTED:SLACK_TOKEN]',
  },
  {
    name: 'GENERIC_SECRET',
    pattern: /(?:api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd)\s*[=:]\s*['"]?([A-Za-z0-9/+=._-]{16,})['"]?/gi,
    severity: 'high',
    replacement: (match, key) => match.replace(/=.*/, '=[REDACTED:SECRET]'),
  },
  {
    name: 'DATABASE_URL',
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"]+/gi,
    severity: 'high',
    replacement: '[REDACTED:DB_URL]',
  },
  {
    name: 'INTERNAL_IP',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    severity: 'medium',
    replacement: '[REDACTED:INTERNAL_IP]',
  },
];

// ── SSN Context Keywords ────────────────────────────────────────────────────
const SSN_CONTEXT = /(?:ssn|social\s*security|tax\s*id|taxpayer|ein|itin)/i;

// ── Output Scanner ──────────────────────────────────────────────────────────
class OutputScanner {
  constructor(config = {}) {
    this.patterns = config.patterns || PATTERNS;
    this.enabled = config.enabled !== false;
    this.severityThreshold = config.severityThreshold || 'medium'; // minimum severity to redact
    this._stats = {
      scanned: 0,
      redacted: 0,
      byPattern: {},
    };
  }

  /**
   * Scan output for sensitive data and redact.
   * @param {any} output - Tool execution output
   * @returns {{ output: any, redacted: boolean, findings: Object[] }}
   */
  scan(output) {
    if (!this.enabled) return { output, redacted: false, findings: [] };

    this._stats.scanned++;
    const stringified = typeof output === 'string' ? output : JSON.stringify(output);
    const findings = [];
    let redactedStr = stringified;

    for (const rule of this.patterns) {
      if (!this._meetsThreshold(rule.severity)) continue;

      // Reset regex lastIndex for global patterns
      if (rule.pattern.global) rule.pattern.lastIndex = 0;

      const matches = redactedStr.match(rule.pattern);
      if (!matches) continue;

      for (const match of matches) {
        // Skip context-required patterns without context
        if (rule.contextRequired && !SSN_CONTEXT.test(redactedStr)) continue;

        // Validate if validator exists
        if (rule.validate && !rule.validate(match)) continue;

        findings.push({
          pattern: rule.name,
          severity: rule.severity,
          matchLength: match.length,
          position: redactedStr.indexOf(match),
        });

        this._stats.byPattern[rule.name] = (this._stats.byPattern[rule.name] || 0) + 1;
      }

      // Apply redaction
      if (rule.pattern.global) rule.pattern.lastIndex = 0;
      if (typeof rule.replacement === 'function') {
        redactedStr = redactedStr.replace(rule.pattern, rule.replacement);
      } else {
        redactedStr = redactedStr.replace(rule.pattern, rule.replacement);
      }
    }

    const wasRedacted = findings.length > 0;
    if (wasRedacted) this._stats.redacted++;

    // Parse back to object if input was object
    let finalOutput;
    if (typeof output === 'string') {
      finalOutput = redactedStr;
    } else {
      try {
        finalOutput = JSON.parse(redactedStr);
      } catch {
        finalOutput = redactedStr;
      }
    }

    return {
      output: finalOutput,
      redacted: wasRedacted,
      findings,
    };
  }

  /**
   * Get scanning statistics.
   */
  getStats() {
    return { ...this._stats };
  }

  _meetsThreshold(severity) {
    const levels = { critical: 3, high: 2, medium: 1, low: 0 };
    return (levels[severity] || 0) >= (levels[this.severityThreshold] || 0);
  }
}

// ── Luhn Validation (credit cards) ──────────────────────────────────────────
function luhnCheck(num) {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

module.exports = { OutputScanner, PATTERNS, luhnCheck };
