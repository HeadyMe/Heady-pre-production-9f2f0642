/**
 * GDPR Privacy Middleware — Express Implementation
 * @module compliance-templates/gdpr/gdpr-privacy-middleware
 *
 * Implements:
 *  - Cookie consent enforcement
 *  - IP anonymisation for analytics
 *  - Data minimisation validation
 *  - Cross-border transfer checks (EU adequacy decisions)
 *  - Purpose limitation enforcement per processing activity
 */

'use strict';

const crypto = require('crypto');

// ─── EU Adequacy Decisions (updated Jan 2025) ────────────────────────────────
// Countries with EU adequacy decisions per GDPR Art. 45
const EU_ADEQUATE_COUNTRIES = new Set([
  'AD', // Andorra
  'AR', // Argentina
  'CA', // Canada (commercial — PIPEDA)
  'CH', // Switzerland (post-Schrems II special framework)
  'FO', // Faroe Islands
  'GB', // United Kingdom (adequacy decision post-Brexit)
  'GG', // Guernsey
  'IL', // Israel
  'IM', // Isle of Man
  'JP', // Japan
  'JE', // Jersey
  'KR', // South Korea
  'MX', // Mexico (partially)
  'NZ', // New Zealand
  'UY', // Uruguay
  // EEA countries (within EU framework)
  'IS', 'LI', 'NO',
  // EU member states (inherently adequate)
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR',
  'HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO',
  'SE','SI','SK',
]);

// Countries with special data transfer frameworks
const TRANSFER_FRAMEWORKS = {
  US: ['EU-US Data Privacy Framework', 'Standard Contractual Clauses', 'Binding Corporate Rules'],
  IN: ['Standard Contractual Clauses'],
  CN: ['Standard Contractual Clauses'],
  RU: ['Standard Contractual Clauses'], // With significant caveats
  BR: ['Standard Contractual Clauses'],
};

// ─── Processing Purpose Registry ─────────────────────────────────────────────

const PROCESSING_PURPOSES = {
  'auth':           { description: 'User authentication',        legalBasis: 'contract',            scope: ['id', 'email', 'session'] },
  'ai-inference':   { description: 'AI query processing',        legalBasis: 'contract',            scope: ['messages', 'context'] },
  'ai-training':    { description: 'AI model training',          legalBasis: 'consent',             scope: ['messages', 'feedback'] },
  'analytics':      { description: 'Platform analytics',         legalBasis: 'legitimate-interest', scope: ['ip_anonymised', 'events', 'user_agent'] },
  'marketing':      { description: 'Marketing communications',   legalBasis: 'consent',             scope: ['email', 'name'] },
  'billing':        { description: 'Payment processing',         legalBasis: 'contract',            scope: ['billing_name', 'billing_address', 'payment_token'] },
  'security':       { description: 'Security monitoring',        legalBasis: 'legal-obligation',    scope: ['ip', 'user_agent', 'request_metadata'] },
  'support':        { description: 'Customer support',           legalBasis: 'contract',            scope: ['id', 'email', 'conversation'] },
  'personalization':{ description: 'AI personalisation',         legalBasis: 'consent',             scope: ['preferences', 'history'] },
};

// Cookie categories
const COOKIE_CATEGORIES = {
  STRICTLY_NECESSARY: 'strictly_necessary',
  FUNCTIONAL:         'functional',
  ANALYTICS:          'analytics',
  MARKETING:          'marketing',
};

// ─── IP Anonymisation ─────────────────────────────────────────────────────────

/**
 * Anonymise an IPv4 or IPv6 address by zeroing the host portion.
 * IPv4: zero last octet (e.g., 192.168.1.100 → 192.168.1.0)
 * IPv6: zero last 80 bits (keep /48 prefix)
 *
 * @param {string} ip
 * @returns {string} anonymised IP
 */
function anonymizeIP(ip) {
  if (!ip || typeof ip !== 'string') return '0.0.0.0';

  // Handle IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.');
    parts[3] = '0';
    return parts.join('.');
  }

  // Handle IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (ip.startsWith('::ffff:')) {
    const v4 = ip.slice(7);
    return '::ffff:' + anonymizeIP(v4);
  }

  // Handle IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    // Keep first 3 groups (48-bit prefix), zero the rest
    return parts.slice(0, 3).concat(['0', '0', '0', '0', '0']).join(':');
  }

  return '0.0.0.0';
}

/**
 * Hash an IP address for consistent pseudonymisation (not re-identifiable without salt).
 * @param {string} ip
 * @param {string} salt   - Daily rotating salt
 * @returns {string} SHA-256 hex hash (truncated to 16 chars)
 */
function pseudonymizeIP(ip, salt) {
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 16);
}

// ─── Cookie Consent Enforcement ──────────────────────────────────────────────

/**
 * Parse the Heady consent cookie.
 * Expected cookie format: base64(JSON({ v: version, s: { analytics: 1, marketing: 0, ... }, ts: timestamp }))
 *
 * @param {string} cookieValue
 * @returns {object} parsed consent state
 */
function parseConsentCookie(cookieValue) {
  if (!cookieValue) return null;
  try {
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf8');
    const consent = JSON.parse(decoded);
    if (!consent.v || !consent.s) return null;
    return consent;
  } catch {
    return null;
  }
}

/**
 * Serialize consent state to cookie value.
 */
function serializeConsentCookie(scopes) {
  const payload = {
    v:  '1',
    s:  scopes,
    ts: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Cookie consent enforcement middleware.
 * - Blocks non-essential cookies if consent not given
 * - Injects consent object into res.locals for downstream use
 * - Handles preflight consent check before cookie setting
 *
 * @param {object} opts
 * @param {string} [opts.cookieName]      - Consent cookie name (default: 'heady-consent')
 * @param {string} [opts.consentPath]     - Path to consent UI (default: '/privacy/consent')
 * @param {boolean} [opts.strictMode]     - Block ALL cookies until consent (default: false — allow strictly necessary)
 * @returns {Function} Express middleware
 */
function cookieConsentMiddleware(opts = {}) {
  const {
    cookieName   = 'heady-consent',
    consentPath  = '/privacy/consent',
    strictMode   = false,
  } = opts;

  return (req, res, next) => {
    const consentCookie = req.cookies?.[cookieName];
    const consent = parseConsentCookie(consentCookie);

    // Attach consent state to request
    req.gdprConsent = consent || {
      v:  null,
      s:  { [COOKIE_CATEGORIES.STRICTLY_NECESSARY]: 1 },
      ts: null,
    };

    // Helper: check if category is consented
    req.hasConsentFor = (category) => {
      if (category === COOKIE_CATEGORIES.STRICTLY_NECESSARY) return true;
      return req.gdprConsent?.s?.[category] === 1;
    };

    // Intercept Set-Cookie to enforce consent
    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      if (name.toLowerCase() === 'set-cookie') {
        const cookies = Array.isArray(value) ? value : [value];
        const filtered = cookies.filter(cookie => {
          const cookieLower = cookie.toLowerCase();
          // Always allow strictly necessary cookies
          if (cookieLower.includes('heady-session') || cookieLower.includes('csrf')) return true;
          // Check analytics cookies
          if (cookieLower.includes('_ga') || cookieLower.includes('analytics')) {
            return req.hasConsentFor(COOKIE_CATEGORIES.ANALYTICS);
          }
          // Check marketing cookies
          if (cookieLower.includes('_fbp') || cookieLower.includes('_gcl')) {
            return req.hasConsentFor(COOKIE_CATEGORIES.MARKETING);
          }
          // Functional cookies require functional consent
          if (cookieLower.includes('preference') || cookieLower.includes('lang')) {
            return req.hasConsentFor(COOKIE_CATEGORIES.FUNCTIONAL);
          }
          return !strictMode; // Allow if not in strict mode
        });
        if (filtered.length === 0) return;
        value = filtered.length === 1 ? filtered[0] : filtered;
      }
      origSetHeader(name, value);
    };

    // Set consent state in response locals
    res.locals.gdprConsent   = req.gdprConsent;
    res.locals.cookieBannerRequired = !consent || !consent.ts;

    next();
  };
}

// ─── IP Anonymisation Middleware ──────────────────────────────────────────────

/**
 * Middleware to anonymise IP addresses before analytics logging.
 * Replaces req.ip with anonymised version for non-security contexts.
 *
 * @param {object} opts
 * @param {boolean} [opts.anonymize]      - Replace req.analyticsIp with anonymised (default: true)
 * @param {boolean} [opts.pseudonymize]   - Use HMAC pseudonymisation (default: false)
 * @param {string}  [opts.salt]           - Salt for pseudonymisation
 * @param {string[]} [opts.preservePaths] - Paths where full IP is preserved (security endpoints)
 */
function ipAnonymizationMiddleware(opts = {}) {
  const {
    anonymize      = true,
    pseudonymize   = false,
    salt           = process.env.IP_PSEUDONYM_SALT || crypto.randomBytes(16).toString('hex'),
    preservePaths  = ['/auth/', '/security/', '/admin/'],
  } = opts;

  return (req, res, next) => {
    const rawIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';

    // Preserve full IP for security-critical paths
    const isSecurityPath = preservePaths.some(p => req.path.startsWith(p));
    req.fullIP = rawIP;

    if (!isSecurityPath && anonymize) {
      req.analyticsIp = pseudonymize
        ? pseudonymizeIP(rawIP, salt)
        : anonymizeIP(rawIP);
    } else {
      req.analyticsIp = rawIP;
    }

    next();
  };
}

// ─── Data Minimisation Validation ────────────────────────────────────────────

/**
 * Validates that only the expected fields are present in request body/response.
 * Rejects requests with unexpected fields for the declared processing purpose.
 *
 * @param {object} opts
 * @param {string} opts.purpose            - Processing purpose key from PROCESSING_PURPOSES
 * @param {string[]} [opts.allowedFields]  - Override allowed fields
 * @param {boolean} [opts.strip]           - Strip disallowed fields instead of rejecting (default: true)
 * @param {string} [opts.source]           - 'body' | 'query' | 'both' (default: 'body')
 */
function dataMinimisationMiddleware(opts = {}) {
  const {
    purpose,
    allowedFields,
    strip   = true,
    source  = 'body',
  } = opts;

  const purposeConfig = purpose ? PROCESSING_PURPOSES[purpose] : null;
  const permitted = new Set(allowedFields || purposeConfig?.scope || []);

  return (req, res, next) => {
    const targets = [];
    if (source === 'body' || source === 'both') targets.push(['body', req.body]);
    if (source === 'query' || source === 'both') targets.push(['query', req.query]);

    for (const [location, data] of targets) {
      if (!data || typeof data !== 'object') continue;

      const unexpected = Object.keys(data).filter(k => !permitted.has(k));
      if (unexpected.length === 0) continue;

      if (strip) {
        for (const k of unexpected) delete req[location][k];
      } else {
        return res.status(422).json({
          error:          'Data minimisation violation',
          code:           'DATA_MINIMISATION_VIOLATION',
          gdprPrinciple:  'Art. 5(1)(c) — Data minimisation',
          unexpectedFields: unexpected,
          allowedFields:  [...permitted],
        });
      }
    }

    next();
  };
}

// ─── Cross-Border Transfer Checks ────────────────────────────────────────────

/**
 * Middleware to check cross-border data transfer compliance before forwarding data.
 * Inspects destination country header/param and verifies adequacy or transfer mechanism.
 *
 * @param {object} opts
 * @param {boolean} [opts.block]      - Block transfers without adequate basis (default: false — warn)
 * @param {string}  [opts.headerName] - Header indicating destination country (default: 'x-data-destination-country')
 */
function crossBorderTransferMiddleware(opts = {}) {
  const {
    block      = false,
    headerName = 'x-data-destination-country',
  } = opts;

  return (req, res, next) => {
    const destinationCountry = (
      req.headers[headerName] ||
      req.query.destinationCountry ||
      req.body?.destinationCountry
    )?.toUpperCase();

    if (!destinationCountry) return next();

    const isAdequate = EU_ADEQUATE_COUNTRIES.has(destinationCountry);
    const frameworks = TRANSFER_FRAMEWORKS[destinationCountry] || [];

    req.transferCheck = {
      destinationCountry,
      isAdequate,
      availableFrameworks: frameworks,
      requiresSCCs: !isAdequate && frameworks.includes('Standard Contractual Clauses'),
    };

    if (!isAdequate && frameworks.length === 0) {
      const message = `Transfer to ${destinationCountry} lacks adequate legal basis under GDPR Art. 44-49`;
      if (block) {
        return res.status(451).json({
          error:    message,
          code:     'TRANSFER_NOT_PERMITTED',
          article:  'GDPR Art. 44',
        });
      } else {
        res.set('X-Transfer-Warning', `Country ${destinationCountry} may lack adequate transfer basis`);
      }
    }

    if (isAdequate) {
      res.set('X-Transfer-Basis', 'GDPR Art. 45 — Adequacy Decision');
    } else if (frameworks.length > 0) {
      res.set('X-Transfer-Basis', `Supplementary: ${frameworks[0]}`);
    }

    next();
  };
}

// ─── Purpose Limitation Enforcement ──────────────────────────────────────────

/**
 * Enforces that data is only used for its declared processing purpose.
 * Tags each request with a processing purpose; validates downstream access.
 *
 * @param {string} purpose   - Key from PROCESSING_PURPOSES
 * @returns {Function} Express middleware
 */
function purposeLimitationMiddleware(purpose) {
  const config = PROCESSING_PURPOSES[purpose];
  if (!config) throw new Error(`[GDPR] Unknown processing purpose: ${purpose}`);

  return (req, res, next) => {
    req.processingPurpose  = purpose;
    req.processingConfig   = config;
    res.locals.processingPurpose = purpose;

    // Set purpose header for transparency/debugging
    res.set('X-Processing-Purpose', purpose);
    res.set('X-Legal-Basis', config.legalBasis);

    // Consent-based purposes: verify consent is present
    if (config.legalBasis === 'consent') {
      const userId = req.user?.id;
      if (userId && req.gdprConsent) {
        const purposeToScope = {
          'ai-training':     'ai_training',
          'analytics':       'analytics',
          'marketing':       'marketing',
          'personalization': 'ai_personalisation',
        };
        const scope = purposeToScope[purpose];
        if (scope && req.gdprConsent.s?.[scope] !== 1) {
          return res.status(403).json({
            error:  `Processing requires consent for: ${scope}`,
            code:   'CONSENT_REQUIRED',
            scope,
            action: 'Update privacy settings at /privacy/consent',
          });
        }
      }
    }

    next();
  };
}

// ─── Comprehensive GDPR Privacy Middleware Bundle ─────────────────────────────

/**
 * All-in-one GDPR middleware that applies all privacy protections.
 * Use as a single app.use() call for GDPR-wide compliance.
 *
 * @param {object} opts
 * @param {object} [opts.cookieConsent]       - Options for cookieConsentMiddleware
 * @param {object} [opts.ipAnonymization]     - Options for ipAnonymizationMiddleware
 * @param {boolean} [opts.enforceTransfers]   - Block prohibited transfers (default: false)
 * @returns {Function[]} Array of middleware functions to spread into app.use()
 */
function gdprPrivacyBundle(opts = {}) {
  return [
    cookieConsentMiddleware(opts.cookieConsent || {}),
    ipAnonymizationMiddleware(opts.ipAnonymization || {}),
    crossBorderTransferMiddleware({ block: opts.enforceTransfers || false }),

    // Attach GDPR utilities to all requests
    (req, res, next) => {
      res.locals.gdprUtils = {
        anonymizeIP,
        pseudonymizeIP,
        PROCESSING_PURPOSES,
        EU_ADEQUATE_COUNTRIES: [...EU_ADEQUATE_COUNTRIES],
        TRANSFER_FRAMEWORKS,
        COOKIE_CATEGORIES,
      };
      next();
    },
  ];
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Middleware factories
  cookieConsentMiddleware,
  ipAnonymizationMiddleware,
  dataMinimisationMiddleware,
  crossBorderTransferMiddleware,
  purposeLimitationMiddleware,
  gdprPrivacyBundle,

  // Utilities
  anonymizeIP,
  pseudonymizeIP,
  parseConsentCookie,
  serializeConsentCookie,

  // Constants / registries
  EU_ADEQUATE_COUNTRIES,
  TRANSFER_FRAMEWORKS,
  PROCESSING_PURPOSES,
  COOKIE_CATEGORIES,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const cookieParser = require('cookie-parser');
const { gdprPrivacyBundle, purposeLimitationMiddleware, dataMinimisationMiddleware } = require('./gdpr-privacy-middleware');

const app = express();
app.use(cookieParser());
app.use(express.json());

// Apply GDPR bundle to all routes
app.use(...gdprPrivacyBundle({
  enforceTransfers: true,    // block prohibited cross-border transfers
  cookieConsent: { strictMode: false },
  ipAnonymization: { anonymize: true },
}));

// Analytics endpoint — enforces purpose + anonymised IP
app.post('/analytics/event',
  purposeLimitationMiddleware('analytics'),
  dataMinimisationMiddleware({ purpose: 'analytics' }),
  (req, res) => {
    const event = {
      ...req.body,
      ip: req.analyticsIp,  // anonymised
    };
    // store event...
    res.json({ ok: true });
  }
);

// AI training endpoint — requires consent
app.post('/ai/train',
  purposeLimitationMiddleware('ai-training'),   // auto-checks consent
  (req, res) => {
    // Only reached if user has consented to ai_training scope
    res.json({ ok: true });
  }
);

// Consent management
app.get('/privacy/consent', (req, res) => {
  res.json({
    currentConsent: req.gdprConsent,
    cookieBannerRequired: res.locals.cookieBannerRequired,
    categories: Object.values(COOKIE_CATEGORIES),
  });
});
*/
