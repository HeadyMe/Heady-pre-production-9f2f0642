'use strict';

/**
 * HeadyGuard — PII Detector & Redactor
 *
 * Detects and optionally redacts personally identifiable information:
 *  - Email addresses
 *  - Phone numbers (US + international)
 *  - Social Security Numbers (SSN)
 *  - Credit/debit card numbers
 *  - IP addresses (v4 and v6)
 *  - Dates of birth
 *  - US postal addresses
 *  - Passport and driver's license patterns
 *  - Person names (heuristic — capitalized word pairs)
 *  - API keys / tokens (generic high-entropy strings)
 *
 * Redaction strategies:
 *   'mask'        → replace with ****
 *   'hash'        → replace with sha256 prefix [sha:xxxxxx]
 *   'placeholder' → replace with labeled token [EMAIL_1]
 */

const crypto = require('crypto');
const STAGE_NAME = 'pii';

// ── Regex patterns ────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  {
    type: 'EMAIL',
    // RFC-5321 simplified; catches most real-world emails
    re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    severity: 'high',
    riskWeight: 0.7,
  },
  {
    type: 'PHONE_US',
    // US phone: (555) 555-5555 | 555-555-5555 | 5555555555 | +1-555-555-5555
    re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'medium',
    riskWeight: 0.55,
  },
  {
    type: 'PHONE_INTL',
    // International: +44 20 1234 5678 style
    re: /\+(?:[0-9] ?){6,14}[0-9]\b/g,
    severity: 'medium',
    riskWeight: 0.55,
  },
  {
    type: 'SSN',
    // 9-digit US SSN: 123-45-6789 | 123456789
    re: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    severity: 'critical',
    riskWeight: 0.95,
  },
  {
    type: 'CREDIT_CARD',
    // Visa, MC, Amex, Discover; with optional separators
    re: /\b(?:4[0-9]{12}(?:[0-9]{3})?|(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})(?:[-\s]?\d{4}){0,3}\b/g,
    severity: 'critical',
    riskWeight: 0.95,
    validate: _luhnCheck,
  },
  {
    type: 'IP_V4',
    re: /\b(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\b/g,
    severity: 'medium',
    riskWeight: 0.5,
    // skip private/loopback
    validate: (m) => !m.startsWith('127.') && !m.startsWith('192.168.') && !m.startsWith('10.') && m !== '0.0.0.0',
  },
  {
    type: 'IP_V6',
    re: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
    severity: 'low',
    riskWeight: 0.35,
  },
  {
    type: 'DATE_OF_BIRTH',
    // "DOB:", "born on", "date of birth" followed by date
    re: /(?:d(?:ate\s+of\s+)?b(?:irth)?|born)\s*[:\-]?\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/ig,
    severity: 'high',
    riskWeight: 0.72,
  },
  {
    type: 'DATE',
    // Standalone dates: MM/DD/YYYY, YYYY-MM-DD
    re: /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b|\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
    severity: 'low',
    riskWeight: 0.3,
  },
  {
    type: 'PASSPORT_US',
    // US passports: letter followed by 8 digits
    re: /\b[A-Z][0-9]{8}\b/g,
    severity: 'critical',
    riskWeight: 0.88,
  },
  {
    type: 'DRIVERS_LICENSE',
    // Generic US DL heuristic: 1 letter + 7-8 digits or all digits 8-9
    re: /\b(?:[A-Z]\d{7,8}|\d{8,9})\b/g,
    severity: 'high',
    riskWeight: 0.65,
  },
  {
    type: 'US_ADDRESS',
    // e.g. "123 Main St, Springfield, IL 62701"
    re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Wy|Circle|Cir)\b(?:,?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
    severity: 'high',
    riskWeight: 0.72,
  },
  {
    type: 'API_KEY',
    // Generic high-entropy tokens: sk-xxx, Bearer tokens, long hex strings
    re: /\b(?:sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9+/=_\-]{20,}|[0-9a-fA-F]{32,}|[A-Za-z0-9+/]{40,}={0,2})\b/g,
    severity: 'critical',
    riskWeight: 0.80,
    validate: _isHighEntropy,
  },
  {
    type: 'PERSON_NAME',
    // Heuristic: two consecutive Title-Case words not at sentence start
    // This is intentionally conservative to avoid false positives
    re: /(?<!\. |\n|^)(?:[A-Z][a-z]{1,20}\s){1,2}[A-Z][a-z]{1,20}\b/g,
    severity: 'low',
    riskWeight: 0.25,
    validate: _isLikelyPersonName,
  },
];

// ── Validators ────────────────────────────────────────────────────────────────

function _luhnCheck(numStr) {
  const digits = numStr.replace(/[\s\-]/g, '');
  if (!/^\d+$/.test(digits) || digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function _isHighEntropy(str) {
  // Shannon entropy — flag strings with > 3.5 bits/char (typical for keys)
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy > 3.5;
}

// Names that are actually common English words / not PII
const _NAME_STOPWORDS = new Set([
  'The', 'This', 'That', 'Then', 'There', 'These', 'Those', 'When', 'What',
  'Where', 'Which', 'While', 'With', 'Without', 'Your', 'Their', 'They',
  'You', 'She', 'He', 'We', 'It', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been',
  'Being', 'Have', 'Has', 'Had', 'Do', 'Does', 'Did', 'Will', 'Would', 'Could',
  'Should', 'May', 'Might', 'Must', 'Shall', 'Can', 'New', 'Old', 'Big', 'Small',
  'Large', 'First', 'Last', 'Long', 'Great', 'Good', 'High', 'Low', 'Open', 'Free',
]);

function _isLikelyPersonName(match) {
  const words = match.trim().split(/\s+/);
  return words.every(w => !_NAME_STOPWORDS.has(w)) && words.length >= 2;
}

// ── Redaction strategies ──────────────────────────────────────────────────────

const _counters = {};
function _nextCounter(type) {
  _counters[type] = (_counters[type] || 0) + 1;
  return _counters[type];
}

function redactMatch(original, type, strategy) {
  switch (strategy) {
    case 'mask':
      return '*'.repeat(Math.min(original.length, 8));
    case 'hash': {
      const h = crypto.createHash('sha256').update(original).digest('hex').slice(0, 8);
      return `[sha:${h}]`;
    }
    case 'placeholder':
    default: {
      const n = _nextCounter(type);
      return `[${type}_${n}]`;
    }
  }
}

// ── Core detection ────────────────────────────────────────────────────────────

/**
 * Detect PII in text.
 *
 * @param {string} text
 * @param {object} opts — { strategy: 'mask'|'hash'|'placeholder', redact: boolean }
 * @returns {{ detections: Array, redactedText: string, riskScore: number }}
 */
function detect(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { detections: [], redactedText: text || '', riskScore: 0 };
  }

  const strategy = opts.strategy || 'placeholder';
  const doRedact  = opts.redact  !== undefined ? opts.redact : false;

  // Reset counters for placeholder strategy per call
  if (strategy === 'placeholder') Object.keys(_counters).forEach(k => delete _counters[k]);

  const detections = [];
  // We build a redaction map: [{start, end, replacement}] then apply in reverse order
  const replacements = [];

  for (const pattern of PII_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags.includes('g') ? pattern.re.flags : pattern.re.flags + 'g');
    let match;
    while ((match = re.exec(text)) !== null) {
      const matchStr = match[0];
      if (pattern.validate && !pattern.validate(matchStr)) continue;

      const detection = {
        type:    pattern.type,
        value:   matchStr,
        start:   match.index,
        end:     match.index + matchStr.length,
        severity: pattern.severity,
        riskWeight: pattern.riskWeight,
      };
      detections.push(detection);

      if (doRedact) {
        replacements.push({
          start: match.index,
          end: match.index + matchStr.length,
          replacement: redactMatch(matchStr, pattern.type, strategy),
        });
      }
    }
  }

  let redactedText = text;
  if (doRedact && replacements.length > 0) {
    // Sort descending by start to avoid offset shifting
    replacements.sort((a, b) => b.start - a.start);
    let result = text;
    for (const { start, end, replacement } of replacements) {
      result = result.slice(0, start) + replacement + result.slice(end);
    }
    redactedText = result;
  }

  // Risk score: highest single severity drives base, number of detections adds
  const maxWeight = detections.length > 0
    ? Math.max(...detections.map(d => d.riskWeight))
    : 0;
  const diversityBonus = Math.min(0.2, (new Set(detections.map(d => d.type)).size) * 0.04);
  const riskScore = Math.round(Math.min(1.0, maxWeight + diversityBonus) * 100);

  return { detections, redactedText, riskScore };
}

// ── Stage interface ───────────────────────────────────────────────────────────

async function run(payload, stageConfig = {}) {
  const { text = '', context = {} } = payload;
  const blockThreshold = stageConfig.blockThreshold ?? 80;
  const flagThreshold  = stageConfig.flagThreshold  ?? 50;
  const piiMode        = stageConfig.piiMode        ?? 'detect';
  const strategy       = stageConfig.piiRedactionStrategy ?? 'placeholder';

  const result = detect(text, {
    redact:   piiMode === 'redact',
    strategy,
  });

  let action = 'PASS';
  if (result.detections.length > 0) {
    const hasCritical = result.detections.some(d => d.severity === 'critical');
    if (hasCritical || result.riskScore >= blockThreshold) {
      action = 'BLOCK';
    } else if (result.riskScore >= flagThreshold) {
      action = 'FLAG';
    } else {
      action = 'FLAG'; // any PII detection is at minimum a FLAG
    }
  }

  const stageResult = {
    stage: STAGE_NAME,
    action,
    riskScore: result.riskScore,
    confidence: result.detections.length > 0 ? 0.9 : 0,
    findings: result.detections.map(d => ({
      label: d.type,
      severity: d.severity,
      snippet: piiMode === 'redact' ? '[redacted]' : d.value.slice(0, 20) + (d.value.length > 20 ? '…' : ''),
    })),
    meta: {
      detectionCount: result.detections.length,
      types: [...new Set(result.detections.map(d => d.type))],
    },
  };

  // Attach redacted text if mode is redact
  if (piiMode === 'redact') {
    stageResult.redactedText = result.redactedText;
  }

  return stageResult;
}

/**
 * Standalone redaction helper.
 * @param {string} text
 * @param {object} opts
 * @returns {{ redactedText: string, detections: Array }}
 */
function redact(text, opts = {}) {
  return detect(text, { ...opts, redact: true });
}

module.exports = { run, detect, redact, redactMatch, STAGE_NAME };
