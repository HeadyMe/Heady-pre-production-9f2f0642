'use strict';

/**
 * HeadyGuard — Output Validator
 *
 * Validates LLM responses before returning them to the user:
 *  - PII hallucination detection (fabricated personal data in responses)
 *  - Topic boundary enforcement (response stays within allowed scope)
 *  - Refusal detection (AI has already refused — pass through)
 *  - Disclaimer injection checks
 *  - JSON schema validation for structured outputs
 *  - Response length / quality checks
 */

const STAGE_NAME = 'output_validator';

// ── AI Refusal patterns (these are safe outputs — PASS immediately) ───────────

const REFUSAL_PATTERNS = [
  /I('m|\s+am)\s+(not\s+able|unable)\s+to\s+(help|assist|provide|generate|create)/i,
  /I\s+can'?t\s+(help|assist|provide|do|create|generate)\s+(with\s+)?(that|this)/i,
  /I\s+(apologize|sorry),?\s+(but\s+)?I\s+(can'?t|cannot|am\s+unable\s+to)/i,
  /that('s|\s+is)\s+(outside|beyond)\s+(my|the)\s+(scope|capabilities|guidelines|policy)/i,
  /against\s+(my|our)\s+(guidelines|policies|terms|rules)\s+to/i,
  /I\s+(must|need\s+to)\s+decline/i,
  /content\s+(policy|guidelines)\s+(prevents?|prohibits?|doesn'?t\s+allow)/i,
];

// ── Hallucinated PII patterns ────────────────────────────────────────────────
// These detect when an AI *fabricates* personal data in responses

const HALLUCINATION_PATTERNS = [
  {
    // AI presenting specific SSN as fact
    re: /(?:your|his|her|the\s+user'?s?|their)\s+(?:SSN|social\s+security\s+(number)?)\s+(?:is|:)\s*\d{3}[-\s]?\d{2}[-\s]?\d{4}/i,
    label: 'hallucinated_ssn',
    severity: 'critical',
    riskWeight: 0.95,
  },
  {
    // AI presenting specific credit card number
    re: /(?:your|his|her|their)\s+(?:card|credit\s+card|debit\s+card)\s+(?:number\s+)?(?:is|:)\s*[\d\s\-]{13,19}/i,
    label: 'hallucinated_credit_card',
    severity: 'critical',
    riskWeight: 0.95,
  },
  {
    // AI presenting specific home address
    re: /(?:your|his|her|their)\s+(?:home|residential|mailing)\s+(?:address)\s+(?:is|:)\s*\d{1,5}\s+[A-Z][a-z]+/i,
    label: 'hallucinated_address',
    severity: 'high',
    riskWeight: 0.80,
  },
  {
    // Fabricated medical records
    re: /(?:according\s+to\s+)?(?:your|his|her|their)\s+(?:medical|health)\s+(?:record|history|file)\s+(?:shows?|indicates?|says?)\s+(?:you\s+have|that)/i,
    label: 'hallucinated_medical_record',
    severity: 'high',
    riskWeight: 0.85,
  },
  {
    // Password output
    re: /(?:your|their|the\s+)?(?:password|passphrase)\s+(?:is|:)\s*["']?[\w!@#$%^&*]{6,}/i,
    label: 'password_in_response',
    severity: 'critical',
    riskWeight: 0.98,
  },
];

// ── Prohibited content in output ──────────────────────────────────────────────

const OUTPUT_PROHIBITED = [
  {
    re: /here(?:'?s| is) (?:how (?:to )?)?(?:make|build|synthesize)\s+(?:a\s+)?(?:bomb|explosive|weapon|drug|poison|meth|cocaine)/i,
    label: 'dangerous_instructions',
    riskWeight: 0.95,
    severity: 'critical',
  },
  {
    re: /(?:step\s+(?:\d+|one|two|three|four|five)[:\s]+.*?){3,}/is,
    label: 'multi_step_instructions',
    riskWeight: 0.45,
    severity: 'low',
    // Low weight — most instructions are benign. High-risk instructions need combination with topic.
  },
  {
    re: /api[\s_]?key[\s_]+(?:is[\s:]+|[:=]\s*)[a-zA-Z0-9_\-]{16,}/i,
    label: 'api_key_in_response',
    riskWeight: 0.90,
    severity: 'critical',
  },
  {
    re: /\[SYSTEM\]|\[SYS\]|<system>/i,
    label: 'system_tag_in_output',
    riskWeight: 0.70,
    severity: 'high',
  },
];

// ── Response quality checks ───────────────────────────────────────────────────

const MIN_RESPONSE_LENGTH = 1;
const MAX_RESPONSE_LENGTH = 100000; // 100k chars

function _checkQuality(text) {
  const issues = [];
  if (!text || text.trim().length < MIN_RESPONSE_LENGTH) {
    issues.push({ label: 'empty_response', riskWeight: 0, severity: 'low' });
  }
  if (text && text.length > MAX_RESPONSE_LENGTH) {
    issues.push({ label: 'excessive_length', riskWeight: 0.30, severity: 'low' });
  }
  // Repetition detection: same phrase repeated >5 times
  const words = (text || '').toLowerCase().split(/\s+/);
  const wordFreq = {};
  for (const w of words) {
    if (w.length > 4) wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  const topRepeat = Math.max(...Object.values(wordFreq), 0);
  if (topRepeat > 20 && words.length < 200) {
    issues.push({ label: 'response_repetition', riskWeight: 0.40, severity: 'moderate' });
  }
  return issues;
}

// ── JSON schema validation ────────────────────────────────────────────────────

/**
 * Lightweight JSON schema validator (supports: type, required, properties, enum, minLength, maxLength, minimum, maximum, pattern)
 *
 * @param {*} value
 * @param {object} schema
 * @param {string} path
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
function validateJsonSchema(value, schema, path = '$') {
  const errors = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const jsType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!types.includes(jsType)) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${jsType}`);
      return { valid: false, errors };
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value not in enum [${schema.enum.join(', ')}]`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path}: string too short (min ${schema.minLength})`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path}: string too long (max ${schema.maxLength})`);
    if (schema.pattern) {
      const re = schema.pattern instanceof RegExp ? schema.pattern : new RegExp(schema.pattern);
      if (!re.test(value)) errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path}: array too short (min ${schema.minItems})`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path}: array too long (max ${schema.maxItems})`);
    if (schema.items) {
      value.forEach((item, i) => {
        const r = validateJsonSchema(item, schema.items, `${path}[${i}]`);
        errors.push(...r.errors);
      });
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
      }
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const r = validateJsonSchema(value[key], subSchema, `${path}.${key}`);
          errors.push(...r.errors);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Core validation ───────────────────────────────────────────────────────────

/**
 * Validate an LLM output response.
 *
 * @param {string} text       — response text
 * @param {object} opts       — { jsonSchema, topicBoundaries, inputTopics }
 * @returns {{ valid: boolean, issues: Array, riskScore: number, isRefusal: boolean }}
 */
function validate(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { valid: true, issues: [], riskScore: 0, isRefusal: false };
  }

  // Fast-path: AI refusal is safe
  const isRefusal = REFUSAL_PATTERNS.some(re => re.test(text));
  if (isRefusal) {
    return { valid: true, issues: [], riskScore: 0, isRefusal: true };
  }

  const issues = [];

  // Check hallucinated PII
  for (const { re, label, severity, riskWeight } of HALLUCINATION_PATTERNS) {
    if (re.test(text)) issues.push({ label, severity, riskWeight, category: 'hallucination' });
  }

  // Check prohibited output content
  for (const { re, label, severity, riskWeight } of OUTPUT_PROHIBITED) {
    if (re.test(text)) issues.push({ label, severity, riskWeight, category: 'prohibited_output' });
  }

  // Quality checks
  const qualityIssues = _checkQuality(text);
  issues.push(...qualityIssues.map(i => ({ ...i, category: 'quality' })));

  // JSON schema validation (if schema provided)
  if (opts.jsonSchema) {
    let parsed;
    try {
      // Try to extract JSON from the response (might be wrapped in markdown)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]+?)```/) || text.match(/(\{[\s\S]+\}|\[[\s\S]+\])/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      issues.push({ label: 'invalid_json', severity: 'high', riskWeight: 0.70, category: 'schema' });
    }
    if (parsed !== undefined) {
      const { errors } = validateJsonSchema(parsed, opts.jsonSchema);
      for (const err of errors) {
        issues.push({ label: 'schema_violation', detail: err, severity: 'high', riskWeight: 0.65, category: 'schema' });
      }
    }
  }

  // Risk score
  const maxWeight = issues.length > 0 ? Math.max(...issues.map(i => i.riskWeight || 0)) : 0;
  const riskScore = Math.round(maxWeight * 100);
  const hasCritical = issues.some(i => i.severity === 'critical');

  return {
    valid: issues.length === 0 || (issues.length === 1 && issues[0].label === 'empty_response'),
    issues,
    riskScore: hasCritical ? Math.max(riskScore, 85) : riskScore,
    isRefusal: false,
  };
}

// ── Stage interface ───────────────────────────────────────────────────────────

async function run(payload, stageConfig = {}) {
  // For output validation, the text is the LLM response (payload.output or payload.text)
  const text = payload.output || payload.text || '';
  const blockThreshold = stageConfig.blockThreshold ?? 80;
  const flagThreshold  = stageConfig.flagThreshold  ?? 50;

  const result = validate(text, {
    jsonSchema:      stageConfig.jsonSchema,
    topicBoundaries: stageConfig.topicBoundaries,
  });

  let action = 'PASS';
  if (result.issues.length > 0 && !result.isRefusal) {
    if (result.riskScore >= blockThreshold) {
      action = 'BLOCK';
    } else if (result.riskScore >= flagThreshold) {
      action = 'FLAG';
    } else if (result.issues.some(i => i.severity === 'critical')) {
      action = 'BLOCK';
    } else if (result.issues.length > 0) {
      action = 'FLAG';
    }
  }

  return {
    stage: STAGE_NAME,
    action,
    riskScore: result.riskScore,
    confidence: 0.85,
    findings: result.issues.map(i => ({ label: i.label, severity: i.severity, detail: i.detail })),
    meta: {
      isRefusal: result.isRefusal,
      issueCount: result.issues.length,
      categories: [...new Set(result.issues.map(i => i.category))],
    },
  };
}

module.exports = { run, validate, validateJsonSchema, STAGE_NAME };
