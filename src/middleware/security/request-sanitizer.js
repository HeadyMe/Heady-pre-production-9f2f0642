/**
 * Request Sanitization Middleware — Production Implementation
 * @module security-middleware/request-sanitizer
 *
 * Protections:
 *  - XSS sanitization of all string inputs
 *  - SQL injection pattern detection
 *  - NoSQL injection prevention (MongoDB $ operators)
 *  - Path traversal prevention
 *  - HTTP parameter pollution protection
 *  - Request body size limits (10MB default)
 *  - File upload type validation (MIME + magic bytes)
 *  - JSON depth limit (20 levels)
 *  - Unicode normalization (NFC)
 *  - Null byte injection prevention
 *  - SSRF prevention in URL params
 */

'use strict';

// ─── XSS Patterns ────────────────────────────────────────────────────────────

const HTML_ENTITY_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '/': '&#x2F;',
};

const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,       // onClick=, onLoad=, etc.
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /<link\b[^>]*rel\s*=\s*["']?stylesheet/gi,
  /data:text\/html/gi,
  /vbscript\s*:/gi,
  /expression\s*\(/gi, // IE CSS expression
  /<!--[\s\S]*?-->/g,  // HTML comments (may contain code)
];

// ─── SQL Injection Patterns ───────────────────────────────────────────────────

const SQLI_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE|GRANT|REVOKE)\b/gi,
  /(-{2}|\/\*)/g,                          // SQL comment markers
  /('|\"|;|\b(OR|AND)\b\s+('|\d|true|false))/gi, // tautologies
  /\bCAST\s*\(/gi,
  /\bCONVERT\s*\(/gi,
  /\bINFORMATION_SCHEMA\b/gi,
  /\bSYS\.(TABLES|COLUMNS|OBJECTS)\b/gi,
  /xp_cmdshell/gi,
  /\bWAITFOR\s+DELAY\b/gi,               // time-based blind
  /\bBENCHMARK\s*\(/gi,
  /\bSLEEP\s*\(/gi,
];

// ─── NoSQL Injection Patterns ─────────────────────────────────────────────────

const NOSQL_DANGER_KEYS = new Set([
  '$where', '$regex', '$gt', '$gte', '$lt', '$lte', '$ne', '$nin',
  '$or', '$and', '$not', '$nor', '$exists', '$type', '$size',
  '$all', '$elemMatch', '$slice', '$expr', '$jsonSchema',
  '$mod', '$text', '$search', '$natural', '$comment',
]);

// ─── Path Traversal Patterns ─────────────────────────────────────────────────

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/g,               // ../
  /%2e%2e[%2f%5c]/gi,          // URL-encoded ../
  /\.\.%2f/gi,
  /\.\.%5c/gi,
  /%252e%252e/gi,              // Double-encoded
  /\/etc\/passwd/gi,
  /\/windows\/system32/gi,
  /\/proc\/self/gi,
];

// ─── SSRF Patterns ────────────────────────────────────────────────────────────

const SSRF_BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,   // link-local / IMDS
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,       // IPv6 private
  /\.internal$/i,
  /\.local$/i,
];

// ─── Allowed File Types ───────────────────────────────────────────────────────

// MIME type → allowed extensions + magic byte signatures
const ALLOWED_FILE_TYPES = {
  'image/jpeg':      { exts: ['.jpg', '.jpeg'], magic: [Buffer.from([0xFF, 0xD8, 0xFF])] },
  'image/png':       { exts: ['.png'],          magic: [Buffer.from([0x89, 0x50, 0x4E, 0x47])] },
  'image/gif':       { exts: ['.gif'],          magic: [Buffer.from('GIF87a'), Buffer.from('GIF89a')] },
  'image/webp':      { exts: ['.webp'],         magic: [Buffer.from('RIFF')] },
  'image/svg+xml':   { exts: ['.svg'],          magic: [] },  // text-based; validated separately
  'application/pdf': { exts: ['.pdf'],          magic: [Buffer.from([0x25, 0x50, 0x44, 0x46])] }, // %PDF
  'text/plain':      { exts: ['.txt'],          magic: [] },
  'text/csv':        { exts: ['.csv'],          magic: [] },
  'application/json':{ exts: ['.json'],         magic: [] },
};

// ─── String Sanitisers ────────────────────────────────────────────────────────

/**
 * Escape HTML special characters.
 */
function escapeHTML(str) {
  return str.replace(/[&<>"'`/]/g, c => HTML_ENTITY_MAP[c] || c);
}

/**
 * Strip dangerous XSS patterns from a string.
 * Uses escape + strip approach.
 */
function sanitizeXSS(value) {
  if (typeof value !== 'string') return value;

  // Normalize unicode first
  let v = value.normalize('NFC');

  // Remove null bytes
  v = v.replace(/\0/g, '');

  // Strip XSS patterns
  for (const pattern of XSS_PATTERNS) {
    v = v.replace(pattern, '');
  }

  return v;
}

/**
 * Detect SQL injection patterns.
 * Returns { suspicious: bool, patterns: string[] }
 */
function detectSQLInjection(value) {
  if (typeof value !== 'string') return { suspicious: false, patterns: [] };
  const found = [];
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(value)) {
      found.push(pattern.toString());
      pattern.lastIndex = 0; // Reset stateful regex
    }
  }
  return { suspicious: found.length > 0, patterns: found };
}

/**
 * Detect path traversal.
 */
function detectPathTraversal(value) {
  if (typeof value !== 'string') return false;
  return PATH_TRAVERSAL_PATTERNS.some(p => p.test(value));
}

/**
 * Detect SSRF risk in a URL string.
 */
function detectSSRF(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return SSRF_BLOCKED_HOSTS.some(p => p.test(host));
  } catch {
    return false;
  }
}

// ─── Object Sanitizer ─────────────────────────────────────────────────────────

/**
 * Recursively sanitize an object.
 * Returns { sanitized, violations } where violations is an array of detected issues.
 *
 * @param {any} data
 * @param {object} opts
 * @param {boolean} [opts.xss]          - Enable XSS sanitization (default: true)
 * @param {boolean} [opts.sqli]         - Enable SQLi detection (default: true)
 * @param {boolean} [opts.nosql]        - Enable NoSQL injection prevention (default: true)
 * @param {boolean} [opts.pathTraversal] - Enable path traversal detection (default: true)
 * @param {number}  [opts.maxDepth]     - Maximum object depth (default: 20)
 * @param {number}  [opts.currentDepth] - Internal recursion counter
 * @param {string}  [opts.path]         - Current key path for violation reporting
 * @returns {{ sanitized: any, violations: object[] }}
 */
function sanitizeObject(data, opts = {}) {
  const {
    xss          = true,
    sqli         = true,
    nosql        = true,
    pathTraversal= true,
    maxDepth     = 20,
    currentDepth = 0,
    path         = '',
  } = opts;

  const violations = [];

  if (currentDepth > maxDepth) {
    violations.push({ path, type: 'depth_exceeded', message: `Object depth exceeds limit of ${maxDepth}` });
    return { sanitized: null, violations };
  }

  if (data === null || data === undefined) return { sanitized: data, violations };

  // Array
  if (Array.isArray(data)) {
    const sanitized = [];
    for (let i = 0; i < data.length; i++) {
      const result = sanitizeObject(data[i], { ...opts, currentDepth: currentDepth + 1, path: `${path}[${i}]` });
      sanitized.push(result.sanitized);
      violations.push(...result.violations);
    }
    return { sanitized, violations };
  }

  // Object
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      const fieldPath = path ? `${path}.${key}` : key;

      // NoSQL injection: block $ operator keys
      if (nosql && NOSQL_DANGER_KEYS.has(key)) {
        violations.push({ path: fieldPath, type: 'nosql_injection', message: `Dangerous MongoDB operator: ${key}` });
        continue; // Drop the key
      }

      // Sanitize key itself
      const safeKey = xss ? sanitizeXSS(String(key)) : String(key);

      const result = sanitizeObject(value, { ...opts, currentDepth: currentDepth + 1, path: fieldPath });
      sanitized[safeKey] = result.sanitized;
      violations.push(...result.violations);
    }
    return { sanitized, violations };
  }

  // String
  if (typeof data === 'string') {
    let sanitized = data;

    // Null byte removal
    sanitized = sanitized.replace(/\0/g, '');

    // Unicode normalization
    sanitized = sanitized.normalize('NFC');

    // Path traversal
    if (pathTraversal && detectPathTraversal(sanitized)) {
      violations.push({ path, type: 'path_traversal', message: 'Path traversal sequence detected' });
      sanitized = sanitized.replace(/\.\.[\/\\]/g, '').replace(/%2e%2e/gi, '');
    }

    // SQLi detection
    if (sqli) {
      const sqliResult = detectSQLInjection(sanitized);
      if (sqliResult.suspicious) {
        violations.push({ path, type: 'sqli_pattern', message: 'SQL injection pattern detected', patterns: sqliResult.patterns });
        // Don't strip — SQLi detection is advisory; let upper layers decide
        // For high-risk fields (like raw SQL params), the caller should reject on violation
      }
    }

    // XSS sanitization
    if (xss) {
      sanitized = sanitizeXSS(sanitized);
    }

    return { sanitized, violations };
  }

  // Number, boolean, etc. — pass through
  return { sanitized: data, violations };
}

// ─── File Validation ──────────────────────────────────────────────────────────

/**
 * Validate a file upload against allowed MIME types and magic bytes.
 *
 * @param {object} file          - Multer/busboy file object { mimetype, originalname, buffer }
 * @param {object} [allowedTypes] - Subset of ALLOWED_FILE_TYPES to check against
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateFileType(file, allowedTypes = ALLOWED_FILE_TYPES) {
  if (!file) return { valid: false, reason: 'No file provided' };

  const { mimetype, originalname, buffer } = file;

  // Check MIME type is in allowlist
  const allowed = allowedTypes[mimetype];
  if (!allowed) {
    return { valid: false, reason: `MIME type not allowed: ${mimetype}` };
  }

  // Check file extension
  const ext = (originalname || '').toLowerCase().slice((originalname || '').lastIndexOf('.'));
  if (allowed.exts.length > 0 && !allowed.exts.includes(ext)) {
    return { valid: false, reason: `File extension ${ext} not allowed for MIME type ${mimetype}` };
  }

  // Check magic bytes (if buffer provided and magic signatures defined)
  if (buffer && allowed.magic.length > 0) {
    const matches = allowed.magic.some(magic =>
      buffer.slice(0, magic.length).equals(magic)
    );
    if (!matches) {
      return { valid: false, reason: 'File magic bytes do not match declared MIME type (possible file spoofing)' };
    }
  }

  // SVG special handling — check for embedded scripts
  if (mimetype === 'image/svg+xml' && buffer) {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 65536));
    if (/<script\b/i.test(content) || /javascript:/i.test(content) || /on\w+\s*=/i.test(content)) {
      return { valid: false, reason: 'SVG file contains potentially dangerous content (script/handler)' };
    }
  }

  return { valid: true };
}

// ─── HTTP Parameter Pollution Protection ─────────────────────────────────────

/**
 * Flatten arrays in query/body parameters to single values.
 * Prevents HPP attacks where repeated params override security checks.
 *
 * @param {object} obj
 * @param {string[]} [allowList]  - Parameters that are permitted to be arrays
 * @returns {object}
 */
function flattenHPP(obj, allowList = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const allowed = new Set(allowList);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && !allowed.has(key)) {
      result[key] = value[value.length - 1]; // Take last value (most specific)
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Create the request sanitizer middleware.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.xss]              - XSS sanitization (default: true)
 * @param {boolean} [opts.sqli]             - SQLi detection (default: true)
 * @param {boolean} [opts.nosql]            - NoSQL injection prevention (default: true)
 * @param {boolean} [opts.pathTraversal]    - Path traversal detection (default: true)
 * @param {boolean} [opts.hpp]              - HTTP parameter pollution protection (default: true)
 * @param {number}  [opts.maxBodySize]      - Max body size in bytes (default: 10MB)
 * @param {number}  [opts.maxDepth]         - Max JSON nesting depth (default: 20)
 * @param {string[]} [opts.hppAllowList]    - Query params allowed to be arrays
 * @param {boolean} [opts.blockOnSQLi]      - Reject request on SQLi pattern (default: false — log only)
 * @param {boolean} [opts.blockOnPathTraversal] - Reject on path traversal (default: true)
 * @param {Function} [opts.onViolation]     - Callback(violations, req, res)
 * @returns {Function} Express middleware
 */
function requestSanitizer(opts = {}) {
  const {
    xss              = true,
    sqli             = true,
    nosql            = true,
    pathTraversal    = true,
    hpp              = true,
    maxBodySize      = 10 * 1024 * 1024, // 10MB
    maxDepth         = 20,
    hppAllowList     = [],
    blockOnSQLi      = false,
    blockOnPathTraversal = true,
    onViolation,
  } = opts;

  return (req, res, next) => {
    // ── Body size check ──────────────────────────────────────────────────
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBodySize) {
      return res.status(413).json({
        error:  'Request body too large',
        code:   'BODY_TOO_LARGE',
        limit:  `${maxBodySize / 1024 / 1024}MB`,
      });
    }

    // ── HTTP Parameter Pollution (query string) ──────────────────────────
    if (hpp && req.query) {
      req.query = flattenHPP(req.query, hppAllowList);
    }

    // ── Sanitize body ────────────────────────────────────────────────────
    if (req.body && typeof req.body === 'object') {
      const result = sanitizeObject(req.body, { xss, sqli, nosql, pathTraversal, maxDepth });
      const allViolations = result.violations;

      if (allViolations.length > 0) {
        // Log all violations
        console.warn('[SANITIZER] Violations detected:', {
          path:       req.path,
          method:     req.method,
          ip:         req.ip,
          requestId:  req.id,
          violations: allViolations,
        });

        // Call optional handler
        if (typeof onViolation === 'function') {
          onViolation(allViolations, req, res);
        }

        // Block conditions
        const hasPathTraversal = allViolations.some(v => v.type === 'path_traversal');
        const hasSQLi          = allViolations.some(v => v.type === 'sqli_pattern');
        const hasNoSQL         = allViolations.some(v => v.type === 'nosql_injection');
        const hasDepthExceeded = allViolations.some(v => v.type === 'depth_exceeded');

        if ((blockOnPathTraversal && hasPathTraversal) ||
            (blockOnSQLi && hasSQLi) ||
            hasNoSQL ||
            hasDepthExceeded) {
          return res.status(400).json({
            error:  'Request rejected due to security policy',
            code:   'SANITIZATION_BLOCKED',
            types:  [...new Set(allViolations.map(v => v.type))],
          });
        }
      }

      req.body = result.sanitized;
    }

    // ── Sanitize query params ────────────────────────────────────────────
    if (req.query && Object.keys(req.query).length > 0) {
      const result = sanitizeObject(req.query, { xss, sqli: false, nosql, pathTraversal, maxDepth: 3 });
      req.query = result.sanitized;
    }

    // ── Sanitize route params ────────────────────────────────────────────
    if (req.params && Object.keys(req.params).length > 0) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          if (pathTraversal && detectPathTraversal(value)) {
            return res.status(400).json({
              error: 'Invalid path parameter',
              code:  'PATH_TRAVERSAL_IN_PARAM',
            });
          }
          req.params[key] = xss ? sanitizeXSS(value) : value;
        }
      }
    }

    next();
  };
}

/**
 * File upload validation middleware.
 * Use alongside multer or similar.
 *
 * @param {object} [opts]
 * @param {object} [opts.allowedTypes]  - Subset of ALLOWED_FILE_TYPES
 * @param {number} [opts.maxSize]       - Max file size in bytes (default: 10MB)
 * @param {number} [opts.maxFiles]      - Max number of files (default: 10)
 */
function fileValidationMiddleware(opts = {}) {
  const {
    allowedTypes = ALLOWED_FILE_TYPES,
    maxSize      = 10 * 1024 * 1024,
    maxFiles     = 10,
  } = opts;

  return (req, res, next) => {
    const files = req.files
      ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
      : (req.file ? [req.file] : []);

    if (files.length === 0) return next();

    if (files.length > maxFiles) {
      return res.status(400).json({ error: `Too many files. Maximum: ${maxFiles}`, code: 'TOO_MANY_FILES' });
    }

    for (const file of files) {
      if (file.size > maxSize) {
        return res.status(413).json({
          error: `File too large: ${file.originalname}`,
          code: 'FILE_TOO_LARGE',
          limit: `${maxSize / 1024 / 1024}MB`,
        });
      }

      const result = validateFileType(file, allowedTypes);
      if (!result.valid) {
        return res.status(415).json({
          error:  result.reason,
          code:   'INVALID_FILE_TYPE',
          file:   file.originalname,
        });
      }
    }

    next();
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  requestSanitizer,
  fileValidationMiddleware,
  sanitizeObject,
  sanitizeXSS,
  escapeHTML,
  detectSQLInjection,
  detectPathTraversal,
  detectSSRF,
  flattenHPP,
  validateFileType,
  ALLOWED_FILE_TYPES,
  XSS_PATTERNS,
  SQLI_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  NOSQL_DANGER_KEYS,
};
