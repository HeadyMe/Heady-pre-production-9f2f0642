'use strict';

/**
 * HeadyGuard — Rule Engine
 *
 * Define content moderation rules in JSON/YAML format.
 * Rules are evaluated in priority order (lower number = higher priority).
 *
 * Rule format:
 * {
 *   id:          string,        // unique identifier
 *   name:        string,        // human-readable name
 *   enabled:     boolean,       // default true
 *   priority:    number,        // 1-1000, lower = higher priority
 *   conditions:  Condition[],   // all must match (AND logic)
 *   conditionOp: 'AND'|'OR',   // default: AND
 *   action:      Action,
 *   metadata:    object,
 * }
 *
 * Condition types:
 *   { type: 'contains',  value: string, caseSensitive?: bool }
 *   { type: 'regex',     pattern: string, flags?: string }
 *   { type: 'length',    op: 'gt'|'lt'|'gte'|'lte'|'eq', value: number }
 *   { type: 'category',  category: string, threshold?: number }  // from upstream stage results
 *   { type: 'userId',    op: 'eq'|'in'|'not_in', value: string|string[] }
 *   { type: 'source',    value: 'input'|'output' }
 *
 * Action types:
 *   { type: 'block',     message?: string }
 *   { type: 'flag',      label: string,  score?: number }
 *   { type: 'redact',    target?: string }  // redact matching content
 *   { type: 'rate_limit',level: 'warn'|'block' }
 *   { type: 'allow' }  // override and allow (bypasses subsequent rules)
 */

const fs   = require('fs');
const path = require('path');

// ── In-memory rule store ──────────────────────────────────────────────────────

let _rules   = [];
let _rulesTs = 0; // last-modified timestamp for hot-reload

// ── Default built-in rules ────────────────────────────────────────────────────

const DEFAULT_RULES = [
  {
    id:       'rule-deny-token-exfil',
    name:     'Block API key / token exfiltration in output',
    enabled:  true,
    priority: 5,
    conditionOp: 'AND',
    conditions: [
      { type: 'source', value: 'output' },
      { type: 'regex', pattern: '(?:sk-|Bearer\\s+)[A-Za-z0-9_\\-]{16,}', flags: 'i' },
    ],
    action: { type: 'block', message: 'Potential credential exfiltration detected in response.' },
    metadata: { tags: ['security', 'output'] },
  },
  {
    id:       'rule-csam-hard-block',
    name:     'Hard block CSAM references',
    enabled:  true,
    priority: 1,
    conditionOp: 'OR',
    conditions: [
      { type: 'regex', pattern: '\\b(loli|shota|child\\s+porn|cp\\s+link|underage\\s+nude)\\b', flags: 'i' },
    ],
    action: { type: 'block', message: 'CSAM content detected. Request blocked.' },
    metadata: { tags: ['csam', 'critical'] },
  },
  {
    id:       'rule-excessive-input',
    name:     'Flag excessively long inputs',
    enabled:  true,
    priority: 100,
    conditions: [
      { type: 'length', op: 'gt', value: 20000 },
    ],
    action: { type: 'flag', label: 'excessive_length', score: 30 },
    metadata: { tags: ['abuse'] },
  },
  {
    id:       'rule-empty-input',
    name:     'Flag empty inputs',
    enabled:  true,
    priority: 99,
    conditions: [
      { type: 'length', op: 'lt', value: 1 },
    ],
    action: { type: 'flag', label: 'empty_input', score: 10 },
    metadata: { tags: ['quality'] },
  },
  {
    id:       'rule-allow-health-check',
    name:     'Always allow health check requests',
    enabled:  true,
    priority: 2,
    conditions: [
      { type: 'contains', value: '__heady_health_check__' },
    ],
    action: { type: 'allow' },
    metadata: { tags: ['internal'] },
  },
];

// ── Condition evaluators ──────────────────────────────────────────────────────

/**
 * Evaluate a single condition against the payload.
 *
 * @param {object} condition
 * @param {object} payload  — { text, output, userId, source, stageResults }
 * @returns {boolean}
 */
function _evalCondition(condition, payload) {
  const text = payload.text || payload.output || '';

  switch (condition.type) {
    case 'contains': {
      const needle = condition.value || '';
      if (condition.caseSensitive) return text.includes(needle);
      return text.toLowerCase().includes(needle.toLowerCase());
    }

    case 'regex': {
      try {
        const re = new RegExp(condition.pattern, condition.flags || 'i');
        return re.test(text);
      } catch {
        return false;
      }
    }

    case 'length': {
      const len = text.length;
      switch (condition.op) {
        case 'gt':  return len >  condition.value;
        case 'lt':  return len <  condition.value;
        case 'gte': return len >= condition.value;
        case 'lte': return len <= condition.value;
        case 'eq':  return len === condition.value;
        default:    return false;
      }
    }

    case 'category': {
      // Check a score from a previous stage result
      const stageResults = payload.stageResults || {};
      const category     = condition.category;
      const threshold    = condition.threshold || 0.5;
      for (const result of Object.values(stageResults)) {
        if (result.meta?.categories?.[category]?.score !== undefined) {
          if (parseFloat(result.meta.categories[category].score) >= threshold) return true;
        }
      }
      return false;
    }

    case 'userId': {
      const uid = payload.userId || '';
      switch (condition.op) {
        case 'eq':     return uid === condition.value;
        case 'in':     return Array.isArray(condition.value) && condition.value.includes(uid);
        case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(uid);
        default:       return false;
      }
    }

    case 'source': {
      return (payload.source || 'input') === condition.value;
    }

    default:
      return false;
  }
}

/**
 * Evaluate all conditions of a rule (AND or OR logic).
 */
function _evalRule(rule, payload) {
  if (!rule.enabled) return false;
  if (!rule.conditions || rule.conditions.length === 0) return false;

  const op = rule.conditionOp || 'AND';
  if (op === 'OR') {
    return rule.conditions.some(c => _evalCondition(c, payload));
  }
  return rule.conditions.every(c => _evalCondition(c, payload));
}

// ── Rule execution ────────────────────────────────────────────────────────────

/**
 * Evaluate all rules against a payload and return results.
 *
 * @param {object} payload
 * @param {Array}  ruleset  — optional; defaults to loaded rules + defaults
 * @returns {{ action: string|null, matchedRules: Array, addedFlags: string[], addedScore: number }}
 */
function evaluate(payload, ruleset) {
  const rules = ruleset || _getRules();
  const sorted = [...rules].sort((a, b) => (a.priority || 50) - (b.priority || 50));

  const matchedRules = [];
  let finalAction    = null;
  const addedFlags   = [];
  let addedScore     = 0;

  for (const rule of sorted) {
    if (!_evalRule(rule, payload)) continue;
    matchedRules.push(rule.id);

    switch (rule.action.type) {
      case 'allow':
        // Hard allow — stop processing, return allowed
        return {
          action:       'ALLOW',
          matchedRules: [...matchedRules],
          addedFlags:   [],
          addedScore:   0,
          allowOverride: true,
        };

      case 'block':
        finalAction = 'BLOCK';
        return {
          action:        'BLOCK',
          matchedRules:  [...matchedRules],
          addedFlags,
          addedScore,
          blockMessage:  rule.action.message,
        };

      case 'flag':
        addedFlags.push(rule.action.label || rule.id);
        addedScore += (rule.action.score || 20);
        break;

      case 'redact':
        addedFlags.push(`redact:${rule.action.target || 'match'}`);
        break;

      case 'rate_limit':
        if (rule.action.level === 'block') {
          finalAction = 'BLOCK';
          return {
            action:       'BLOCK',
            matchedRules: [...matchedRules],
            addedFlags,
            addedScore,
            blockMessage: 'Rate limit rule triggered.',
          };
        }
        addedFlags.push('rate_limit_warning');
        addedScore += 40;
        break;

      default:
        break;
    }
  }

  return {
    action:       finalAction,
    matchedRules,
    addedFlags,
    addedScore:   Math.min(addedScore, 100),
    allowOverride: false,
  };
}

// ── Rule store management ─────────────────────────────────────────────────────

function _getRules() {
  return _rules.length > 0 ? _rules : DEFAULT_RULES;
}

/**
 * Load rules from a JSON or YAML file.
 * Merges with DEFAULT_RULES unless mergeDefaults=false.
 */
function loadFromFile(filePath, mergeDefaults = true) {
  if (!filePath || !fs.existsSync(filePath)) {
    _rules = [...DEFAULT_RULES];
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let loaded;
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      // Minimal YAML parsing for simple rule files (keys: value)
      // For production, install js-yaml — this covers the common case
      try {
        const jsYaml = require('js-yaml');
        loaded = jsYaml.load(content);
      } catch {
        // js-yaml not available — fall back to JSON
        loaded = JSON.parse(content);
      }
    } else {
      loaded = JSON.parse(content);
    }

    const fileRules = Array.isArray(loaded) ? loaded : loaded.rules || [];
    _rules = mergeDefaults ? [...DEFAULT_RULES, ...fileRules] : fileRules;
    _rulesTs = fs.statSync(filePath).mtimeMs;
    return { loaded: fileRules.length, total: _rules.length };
  } catch (err) {
    throw new Error(`HeadyGuard rules: failed to load "${filePath}": ${err.message}`);
  }
}

/**
 * Set rules programmatically (hot-reload path).
 */
function setRules(newRules, mergeDefaults = true) {
  if (!Array.isArray(newRules)) throw new TypeError('rules must be an array');
  _rules = mergeDefaults ? [...DEFAULT_RULES, ...newRules] : newRules;
  _rulesTs = Date.now();
  return { total: _rules.length };
}

/**
 * Get current rules (defensive copy).
 */
function getRules() {
  return [..._getRules()];
}

/**
 * Add a single rule (hot-add).
 */
function addRule(rule) {
  if (!rule.id) throw new Error('Rule must have an id');
  const existing = _rules.findIndex(r => r.id === rule.id);
  if (existing >= 0) _rules[existing] = rule;
  else               _rules.push(rule);
  _rulesTs = Date.now();
}

/**
 * Remove a rule by id.
 */
function removeRule(id) {
  const before = _rules.length;
  _rules = _rules.filter(r => r.id !== id);
  return _rules.length < before;
}

/**
 * Check if the rules file has changed (for hot-reload in production).
 */
function checkReload(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const mtime = fs.statSync(filePath).mtimeMs;
  if (mtime > _rulesTs) {
    loadFromFile(filePath);
    return true;
  }
  return false;
}

// Initialize with defaults
_rules = [...DEFAULT_RULES];

module.exports = {
  evaluate,
  loadFromFile,
  setRules,
  getRules,
  addRule,
  removeRule,
  checkReload,
  DEFAULT_RULES,
};
