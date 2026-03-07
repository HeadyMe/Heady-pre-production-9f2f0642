/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Zero-Trust Auto-Sanitization Pipeline

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── Entropy Helpers ──────────────────────────────────────────────────────────

function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  const raw = -Object.values(freq).reduce((acc, count) => {
    const p = count / len;
    return acc + p * Math.log2(p);
  }, 0);
  return raw || 0;  // avoid -0
}

// ─── Secret Patterns ──────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
  { name: 'aws_access_key',     pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'aws_secret_key',     pattern: /\b[0-9a-zA-Z/+]{40}\b/ },
  { name: 'github_token',       pattern: /\bghp_[A-Za-z0-9_]{36}\b/ },
  { name: 'github_oauth',       pattern: /\bgho_[A-Za-z0-9_]{36}\b/ },
  { name: 'github_app',         pattern: /\bghs_[A-Za-z0-9_]{36}\b/ },
  { name: 'github_refresh',     pattern: /\bghr_[A-Za-z0-9_]{76}\b/ },
  { name: 'anthropic_key',      pattern: /\bsk-ant-[A-Za-z0-9\-_]{93}\b/ },
  { name: 'openai_key',         pattern: /\bsk-[A-Za-z0-9]{48}\b/ },
  { name: 'google_api_key',     pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'stripe_secret',      pattern: /\bsk_live_[0-9a-zA-Z]{24}\b/ },
  { name: 'stripe_publishable', pattern: /\bpk_live_[0-9a-zA-Z]{24}\b/ },
  { name: 'jwt_token',          pattern: /\beyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/ },
  { name: 'bearer_token',       pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/ },
  { name: 'basic_auth',         pattern: /Basic\s+[A-Za-z0-9+/]+=*/ },
  { name: 'private_key_pem',    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'password_field',     pattern: /["']password["']\s*:\s*["'][^"']{4,}["']/ },
  { name: 'generic_secret',     pattern: /["'](?:secret|api_key|apikey|token|auth_token)["']\s*:\s*["'][^"']{8,}["']/ },
];

// Entropy thresholds for detecting high-entropy strings (possible keys)
const ENTROPY_THRESHOLD = 3.8;
const MIN_ENTROPY_LEN   = 20;

// ─── PII Patterns ─────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  { name: 'email',       pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replace: '[EMAIL]' },
  { name: 'us_ssn',      pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replace: '[SSN]' },
  { name: 'us_phone',    pattern: /\b(?:\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replace: '[PHONE]' },
  { name: 'credit_card', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, replace: '[CARD]' },
  { name: 'ip_address',  pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, replace: '[IP]' },
];

// ─── Unsafe Code Patterns ─────────────────────────────────────────────────────

const UNSAFE_CODE_PATTERNS = [
  { name: 'eval',              pattern: /\beval\s*\(/,                      severity: 'critical' },
  { name: 'new_function',      pattern: /new\s+Function\s*\(/,              severity: 'critical' },
  { name: 'settimeout_string', pattern: /setTimeout\s*\(\s*['"`]/,          severity: 'high' },
  { name: 'setinterval_string',pattern: /setInterval\s*\(\s*['"`]/,         severity: 'high' },
  { name: 'exec',              pattern: /\bexec\s*\([^)]*\$\{/,             severity: 'high' },
  { name: 'child_process_exec',pattern: /(?:exec|execSync|spawn)\s*\(\s*`/, severity: 'high' },
  { name: 'document_write',    pattern: /document\.write\s*\(/,             severity: 'medium' },
  { name: 'inner_html',        pattern: /\.innerHTML\s*=/,                  severity: 'medium' },
  { name: 'dangerously_set',   pattern: /dangerouslySetInnerHTML/,           severity: 'medium' },
  { name: 'sql_injection',     pattern: /["'`]\s*\+\s*\w+\s*\+\s*["'`]/,   severity: 'high' },
  { name: 'require_dynamic',   pattern: /require\s*\(\s*(?:variable|\w+\s*\+)/, severity: 'medium' },
  { name: 'process_exit',      pattern: /process\.exit\s*\(/,               severity: 'low' },
  { name: 'hardcoded_secret',  pattern: /(?:password|secret|api_key)\s*=\s*["'][^"']{4,}["']/, severity: 'critical' },
];

// ─── SecretScanner ────────────────────────────────────────────────────────────

class SecretScanner {
  constructor(opts = {}) {
    this._patterns   = [...SECRET_PATTERNS, ...(opts.patterns || [])];
    this._entropyThr = opts.entropyThreshold || ENTROPY_THRESHOLD;
    this._minEntropyLen = opts.minEntropyLen || MIN_ENTROPY_LEN;
    this._findings   = [];
  }

  /**
   * Scan text for secrets. Returns array of findings.
   */
  scan(text) {
    const findings = [];

    for (const { name, pattern } of this._patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          findings.push({ type: 'pattern', name, value: m.slice(0, 8) + '...', length: m.length });
        }
      }
    }

    // Entropy scan: find high-entropy tokens
    const tokens = text.split(/[\s,;:(){}\[\]"'`=]/);
    for (const tok of tokens) {
      if (tok.length >= this._minEntropyLen) {
        const entropy = shannonEntropy(tok);
        if (entropy >= this._entropyThr) {
          findings.push({
            type:    'entropy',
            name:    'high_entropy_string',
            entropy: +entropy.toFixed(2),
            length:  tok.length,
            value:   tok.slice(0, 4) + '...',
          });
        }
      }
    }

    this._findings.push(...findings);
    return findings;
  }

  /**
   * Redact detected secrets from text.
   */
  redact(text) {
    let result = text;
    for (const { name, pattern } of this._patterns) {
      result = result.replace(pattern, `[REDACTED:${name}]`);
    }
    // Entropy-based redaction: replace any high-entropy token
    result = result.replace(/\b[A-Za-z0-9/+_\-]{20,}\b/g, tok => {
      if (shannonEntropy(tok) >= this._entropyThr) return '[REDACTED:entropy]';
      return tok;
    });
    return result;
  }

  getFindings() { return this._findings.slice(); }
  clearFindings() { this._findings = []; return this; }
}

// ─── InputValidator ───────────────────────────────────────────────────────────

class InputValidator {
  constructor(opts = {}) {
    this._maxSize    = opts.maxSize    || 1024 * 1024; // 1MB
    this._maxDepth   = opts.maxDepth   || 10;
    this._allowedTypes = opts.allowedTypes || ['string', 'number', 'boolean', 'object', 'array'];
  }

  /**
   * Validate and sanitize an input value against a JSON schema-like spec.
   * @param {*} value
   * @param {Object} schema - { type, required, properties, maxLength, min, max, pattern }
   * @returns {{ valid: boolean, errors: string[], value: * }}
   */
  validate(value, schema = {}) {
    const errors = [];
    const sanitized = this._validate(value, schema, errors, 0);
    return { valid: errors.length === 0, errors, value: sanitized };
  }

  _validate(value, schema, errors, depth) {
    if (depth > this._maxDepth) { errors.push('Max depth exceeded'); return null; }

    // Type check
    if (schema.type) {
      const actual = Array.isArray(value) ? 'array' : typeof value;
      if (actual !== schema.type) {
        errors.push(`Expected type '${schema.type}', got '${actual}'`);
        return value;
      }
    }

    // Null check
    if (value === null || value === undefined) {
      if (schema.required) errors.push('Required value missing');
      return value;
    }

    switch (typeof value) {
      case 'string': {
        if (schema.maxLength && value.length > schema.maxLength) {
          errors.push(`String exceeds maxLength ${schema.maxLength}`);
          value = value.slice(0, schema.maxLength);
        }
        if (schema.pattern) {
          const re = new RegExp(schema.pattern);
          if (!re.test(value)) errors.push(`String does not match pattern: ${schema.pattern}`);
        }
        // Injection prevention
        value = this._sanitizeString(value);
        break;
      }
      case 'number': {
        if (schema.min !== undefined && value < schema.min) errors.push(`Value ${value} < min ${schema.min}`);
        if (schema.max !== undefined && value > schema.max) errors.push(`Value ${value} > max ${schema.max}`);
        if (!isFinite(value)) { errors.push('Non-finite number'); value = 0; }
        break;
      }
      case 'object': {
        if (Array.isArray(value)) {
          if (schema.maxItems && value.length > schema.maxItems) {
            errors.push(`Array exceeds maxItems ${schema.maxItems}`);
            value = value.slice(0, schema.maxItems);
          }
          if (schema.items) value = value.map(v => this._validate(v, schema.items, errors, depth + 1));
        } else {
          if (schema.properties) {
            for (const [k, subSchema] of Object.entries(schema.properties)) {
              if (subSchema.required && !(k in value)) {
                errors.push(`Required property '${k}' missing`);
              } else if (k in value) {
                value[k] = this._validate(value[k], subSchema, errors, depth + 1);
              }
            }
          }
          // Check size
          const size = JSON.stringify(value).length;
          if (size > this._maxSize) errors.push(`Object exceeds max size ${this._maxSize}`);
        }
        break;
      }
    }
    return value;
  }

  _sanitizeString(str) {
    // Prevent null bytes
    str = str.replace(/\0/g, '');
    // Prevent path traversal
    str = str.replace(/\.\.[/\\]/g, '');
    // Normalize unicode
    str = str.normalize('NFC');
    return str;
  }

  /**
   * Check for injection patterns: SQL, NoSQL, LDAP, XSS, SSTI.
   */
  checkInjection(input) {
    const findings = [];
    const sqlPatterns = [/'\s*OR\s*'1'\s*=\s*'1/i, /;\s*DROP\s+TABLE/i, /UNION\s+SELECT/i, /--\s/];
    const nosqlPatterns = [/\$where/, /\$ne/, /\$gt.*\{/, /\$regex/];
    const xssPatterns = [/<script/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i];
    const sstiPatterns = [/\{\{.*\}\}/, /<%.*%>/, /\$\{.*\}/];

    const str = typeof input === 'string' ? input : JSON.stringify(input);
    for (const p of sqlPatterns)  if (p.test(str)) findings.push({ type: 'sql_injection',  pattern: p.source });
    for (const p of nosqlPatterns) if (p.test(str)) findings.push({ type: 'nosql_injection', pattern: p.source });
    for (const p of xssPatterns)  if (p.test(str)) findings.push({ type: 'xss',             pattern: p.source });
    for (const p of sstiPatterns) if (p.test(str)) findings.push({ type: 'ssti',            pattern: p.source });
    return findings;
  }
}

// ─── OutputSanitizer ─────────────────────────────────────────────────────────

class OutputSanitizer {
  constructor(opts = {}) {
    this._scanner    = new SecretScanner(opts.scannerOpts || {});
    this._piiPatterns = [...PII_PATTERNS, ...(opts.extraPii || [])];
    this._customRedactions = opts.customRedactions || [];
  }

  /**
   * Sanitize output: strip PII and redact secrets.
   */
  sanitize(output) {
    let text = typeof output === 'string' ? output : JSON.stringify(output);
    const changes = [];

    // Redact secrets
    const secretFindings = this._scanner.scan(text);
    if (secretFindings.length > 0) {
      const redacted = this._scanner.redact(text);
      if (redacted !== text) { changes.push({ type: 'secret_redaction', count: secretFindings.length }); text = redacted; }
    }

    // Strip PII
    for (const { name, pattern, replace } of this._piiPatterns) {
      const before = text;
      text = text.replace(pattern, replace);
      if (text !== before) changes.push({ type: 'pii_strip', name });
    }

    // Custom redactions
    for (const { pattern, replace, name } of this._customRedactions) {
      const before = text;
      text = text.replace(new RegExp(pattern, 'g'), replace || '[REDACTED]');
      if (text !== before) changes.push({ type: 'custom_redaction', name });
    }

    return { text, changes, clean: changes.length === 0 };
  }

  addCustomRedaction(name, pattern, replace = '[REDACTED]') {
    this._customRedactions.push({ name, pattern, replace });
    return this;
  }
}

// ─── CodeGovernor ─────────────────────────────────────────────────────────────

class CodeGovernor {
  constructor(opts = {}) {
    this._patterns  = [...UNSAFE_CODE_PATTERNS, ...(opts.extraPatterns || [])];
    this._maxScore  = opts.maxRiskScore || 10;
  }

  /**
   * Validate code for unsafe patterns.
   * Returns { safe, riskScore, violations }
   */
  validate(code) {
    if (typeof code !== 'string') return { safe: false, riskScore: 100, violations: [{ name: 'invalid_input', severity: 'critical' }] };

    const violations = [];
    const SEVERITY_SCORES = { critical: 10, high: 5, medium: 2, low: 1 };

    for (const { name, pattern, severity } of this._patterns) {
      if (pattern.test(code)) {
        violations.push({ name, severity, score: SEVERITY_SCORES[severity] || 1 });
      }
    }

    const riskScore = violations.reduce((sum, v) => sum + v.score, 0);
    return {
      safe:       riskScore < this._maxScore,
      riskScore,
      violations,
      summary:    `${violations.length} violations, risk score: ${riskScore}/${this._maxScore}`,
    };
  }

  /**
   * Auto-fix some unsafe patterns (best-effort).
   */
  autoFix(code) {
    let fixed = code;
    fixed = fixed.replace(/\beval\s*\((.*?)\)/gs, '/* [BLOCKED:eval] */');
    fixed = fixed.replace(/new\s+Function\s*\((.*?)\)/gs, '/* [BLOCKED:new Function] */');
    return fixed;
  }
}

// ─── AuditTrail ───────────────────────────────────────────────────────────────

class AuditTrail {
  /**
   * Immutable append-only log of all sanitization actions.
   * Uses hash chaining for tamper evidence.
   */
  constructor(opts = {}) {
    this._entries   = [];
    this._maxSize   = opts.maxSize || 100000;
    this._lastHash  = '0'.repeat(64);
  }

  /**
   * Append an immutable entry.
   */
  append(action, data) {
    const entry = {
      seq:    this._entries.length,
      ts:     Date.now(),
      action,
      data:   this._sanitizeForLog(data),
      prevHash: this._lastHash,
    };
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify({ seq: entry.seq, ts: entry.ts, action, prevHash: entry.prevHash }))
      .digest('hex');
    entry.hash = hash;
    this._lastHash = hash;

    this._entries.push(Object.freeze(entry));
    if (this._entries.length > this._maxSize) this._entries.shift();
    return entry;
  }

  /**
   * Verify the hash chain integrity.
   */
  verify() {
    let prevHash = '0'.repeat(64);
    for (const entry of this._entries) {
      const expected = crypto.createHash('sha256')
        .update(JSON.stringify({ seq: entry.seq, ts: entry.ts, action: entry.action, prevHash }))
        .digest('hex');
      if (entry.hash !== expected) return { valid: false, failedAt: entry.seq };
      prevHash = entry.hash;
    }
    return { valid: true, entries: this._entries.length };
  }

  _sanitizeForLog(data) {
    if (!data) return {};
    const str = JSON.stringify(data);
    // Remove any secrets from the log entry itself
    return JSON.parse(str.replace(
      /["'][A-Za-z0-9/+_\-]{16,}["']/g,
      '"[REDACTED:log]"'
    ));
  }

  query(filter = {}) {
    return this._entries.filter(e => {
      if (filter.action && e.action !== filter.action) return false;
      if (filter.since && e.ts < filter.since) return false;
      if (filter.until && e.ts > filter.until) return false;
      return true;
    });
  }

  getLastHash()    { return this._lastHash; }
  getEntryCount()  { return this._entries.length; }
}

// ─── SanitizationPipeline ─────────────────────────────────────────────────────

class SanitizationPipeline {
  /**
   * Orchestrates all security checks in sequence:
   * input → validate → scan → sanitize → code-govern → audit → output
   */
  constructor(opts = {}) {
    this._validator  = new InputValidator(opts.validatorOpts  || {});
    this._scanner    = new SecretScanner(opts.scannerOpts     || {});
    this._outputSan  = new OutputSanitizer(opts.outputOpts    || {});
    this._governor   = new CodeGovernor(opts.governorOpts     || {});
    this._audit      = new AuditTrail(opts.auditOpts          || {});
    this._strict     = opts.strict !== false; // fail on any issue by default
  }

  /**
   * Run the full sanitization pipeline on input.
   * @param {*} input - raw input (string, object, or code)
   * @param {Object} opts - { schema, isCode }
   * @returns {Object} { ok, output, issues, auditEntry }
   */
  run(input, opts = {}) {
    const issues = [];
    let processed = input;

    // Stage 1: Input validation
    if (opts.schema) {
      const validation = this._validator.validate(processed, opts.schema);
      if (!validation.valid) {
        issues.push(...validation.errors.map(e => ({ stage: 'validate', issue: e, severity: 'high' })));
      }
      processed = validation.value;
    }

    // Stage 2: Injection check
    const injections = this._validator.checkInjection(processed);
    for (const inj of injections) {
      issues.push({ stage: 'scan_injection', issue: inj.type, pattern: inj.pattern, severity: 'critical' });
    }

    // Stage 3: Secret scan
    const textInput = typeof processed === 'string' ? processed : JSON.stringify(processed);
    const secretFindings = this._scanner.scan(textInput);
    for (const f of secretFindings) {
      issues.push({ stage: 'scan_secrets', issue: `${f.type}:${f.name}`, severity: 'critical' });
    }

    // Stage 4: Sanitize output (PII + secret redaction)
    const sanitized = this._outputSan.sanitize(typeof processed === 'string' ? processed : textInput);
    processed = sanitized.text;
    if (sanitized.changes.length > 0) {
      issues.push(...sanitized.changes.map(c => ({ stage: 'sanitize', issue: c.type, name: c.name, severity: 'medium' })));
    }

    // Stage 5: Code governance
    if (opts.isCode) {
      const govResult = this._governor.validate(textInput);
      if (!govResult.safe) {
        for (const v of govResult.violations) {
          issues.push({ stage: 'code_govern', issue: v.name, severity: v.severity });
        }
        if (govResult.riskScore >= 5) processed = this._governor.autoFix(processed);
      }
    }

    // Stage 6: Audit
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const auditEntry = this._audit.append('pipeline_run', {
      inputLen: textInput.length,
      issueCount: issues.length,
      criticalCount,
      stages: ['validate', 'scan_injection', 'scan_secrets', 'sanitize', 'code_govern'],
    });

    const blocked = this._strict && criticalCount > 0;

    return {
      ok:         !blocked,
      blocked,
      output:     blocked ? null : processed,
      issues,
      auditEntry: { seq: auditEntry.seq, hash: auditEntry.hash, ts: auditEntry.ts },
    };
  }

  getAuditTrail()  { return this._audit; }
  getScanner()     { return this._scanner; }
  getValidator()   { return this._validator; }
  getGovernor()    { return this._governor; }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  SECRET_PATTERNS,
  PII_PATTERNS,
  UNSAFE_CODE_PATTERNS,
  shannonEntropy,
  SecretScanner,
  InputValidator,
  OutputSanitizer,
  CodeGovernor,
  AuditTrail,
  SanitizationPipeline,
};
