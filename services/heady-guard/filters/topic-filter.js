'use strict';

/**
 * HeadyGuard — Topic Filter
 *
 * Keyword and semantic topic detection with:
 *  - Allowed topic lists (whitelist)
 *  - Denied topic lists (blocklist)
 *  - Domain-specific rule bundles (e.g., FINANCIAL_ADVICE, MEDICAL_ADVICE)
 *  - Keyword scoring with phrase weighting
 *  - Configurable action per topic (block | flag | allow)
 */

const STAGE_NAME = 'topic';

// ── Built-in topic rule bundles ───────────────────────────────────────────────

const TOPIC_BUNDLES = {
  /**
   * Financial advice — regulated; AI should not give specific investment advice
   */
  FINANCIAL_ADVICE: {
    defaultAction: 'flag',
    terms: [
      { re: /\b(buy|sell|invest(ing|ment)?)\s+(in\s+)?(stocks?|shares?|crypto|bitcoin|ethereum|options?|futures?|bonds?|forex)\b/i, weight: 0.75, label: 'investment_advice' },
      { re: /\b(guaranteed\s+return|risk[\s\-]free\s+investment|get\s+rich\s+quick)\b/i, weight: 0.88, label: 'financial_fraud' },
      { re: /\bpump\s+and\s+dump\b/i, weight: 0.95, label: 'market_manipulation' },
      { re: /\binsider\s+(trading|information)\b/i, weight: 0.90, label: 'insider_trading' },
      { re: /\b(should|must|need\s+to)\s+(buy|sell|hold)\s+(this|these)\s+(stocks?|shares?|coins?)\b/i, weight: 0.70, label: 'specific_advice' },
      { re: /\btax\s+(evasion|fraud|shelter)\b/i, weight: 0.90, label: 'tax_crime' },
    ],
  },

  /**
   * Medical advice — should not replace professional medical consultation
   */
  MEDICAL_ADVICE: {
    defaultAction: 'flag',
    terms: [
      { re: /\byou\s+(should|must|need\s+to)\s+(take|use|stop\s+taking|start\s+taking)\s+\w+\s+(mg|milligrams?|dose|dosage)\b/i, weight: 0.80, label: 'dosage_advice' },
      { re: /\bprescribe\s+(yourself|him|her|them)\b/i, weight: 0.85, label: 'self_prescription' },
      { re: /\bdiagnos(e|is|ed)\s+(yourself|him|her|them)\s+(with)\b/i, weight: 0.72, label: 'self_diagnosis' },
      { re: /\b(stop|quit|discontinue)\s+(your\s+)?(medication|treatment|therapy|chemo|chemotherapy)\b/i, weight: 0.82, label: 'unsafe_medical_advice' },
      { re: /\bcure\s+(for|of)\s+(cancer|HIV|AIDS|diabetes|autism|depression)\b/i, weight: 0.75, label: 'false_cure' },
    ],
  },

  /**
   * Legal advice — cannot replace a licensed attorney
   */
  LEGAL_ADVICE: {
    defaultAction: 'flag',
    terms: [
      { re: /\byou\s+(should|must)\s+(sue|file|plead|claim)\b/i, weight: 0.65, label: 'legal_action_advice' },
      { re: /\b(i\s+can\s+guarantee|guaranteed\s+to\s+win)\s+(your\s+)?(case|lawsuit|claim)\b/i, weight: 0.80, label: 'legal_guarantee' },
    ],
  },

  /**
   * Weapons and illegal items
   */
  WEAPONS_ILLEGAL: {
    defaultAction: 'block',
    terms: [
      { re: /\bhow\s+to\s+(make|build|3d[\s\-]print|manufacture|acquire)\s+(a\s+)?(gun|firearm|weapon|silencer|suppressor|explosive|grenade|bomb)\b/i, weight: 0.95, label: 'weapon_instructions' },
      { re: /\b(illegal\s+(drug|substance)\s+synthesis|drug\s+manufacturing|cook(ing)?\s+meth|make\s+cocaine)\b/i, weight: 0.97, label: 'drug_manufacturing' },
      { re: /\bghost\s+(gun|pistol|rifle)\b/i, weight: 0.88, label: 'ghost_gun' },
      { re: /\bbuy\s+(illegal|unregistered)\s+(guns?|firearms?|weapons?)\b/i, weight: 0.90, label: 'illegal_weapons' },
      { re: /\b(dark\s*web|darknet)\s+(market|buy|purchase|order)\b/i, weight: 0.85, label: 'darknet_market' },
    ],
  },

  /**
   * Hacking and unauthorized access
   */
  HACKING: {
    defaultAction: 'flag',
    terms: [
      { re: /\bhow\s+to\s+(hack|crack|bypass)\s+(?:\w+\s+)*(account|password|system|server|database|network)\b/i, weight: 0.85, label: 'hacking_instructions' },
      { re: /\b(sql\s+injection|xss\s+attack|csrf\s+exploit|buffer\s+overflow\s+exploit)\b/i, weight: 0.65, label: 'attack_technique' },
      { re: /\b(phishing|spear\s+phishing)\s+(email|page|site|kit)\b/i, weight: 0.82, label: 'phishing' },
      { re: /\b(keylogger|rat\s+malware|rootkit|ransomware)\s+(install|deploy|spread)\b/i, weight: 0.90, label: 'malware_deployment' },
      { re: /\b(brute[\s\-]force)\s+(attack|login|password)\b/i, weight: 0.72, label: 'brute_force' },
      { re: /\bpassword\s+(dump|hash|crack)\b/i, weight: 0.75, label: 'credential_theft' },
    ],
  },

  /**
   * Privacy violations
   */
  PRIVACY_VIOLATION: {
    defaultAction: 'flag',
    terms: [
      { re: /\btrack\s+(someone|a\s+person|him|her|them)\s+(without\s+(their|his|her)\s+knowledge)\b/i, weight: 0.88, label: 'covert_tracking' },
      { re: /\bspy\s+(on|upon)\s+(partner|spouse|girlfriend|boyfriend|employee|coworker)\b/i, weight: 0.85, label: 'covert_surveillance' },
      { re: /\b(access|read)\s+(someone'?s?\s+)?(email|messages?|texts?|dms?)\s+(without\s+(permission|consent|knowing))\b/i, weight: 0.88, label: 'unauthorized_access' },
    ],
  },

  /**
   * Disinformation and fraud
   */
  DISINFORMATION: {
    defaultAction: 'flag',
    terms: [
      { re: /\b(create|generate|write|make)\s+(?:a\s+|an\s+|some\s+)?(fake|false|misleading)\s+(news|article|story|report)\b/i, weight: 0.80, label: 'fake_news_creation' },
      { re: /\b(impersonat(e|ing)|pretend\s+to\s+be)\s+(a\s+)?(politician|official|journalist|doctor|police)\b/i, weight: 0.82, label: 'impersonation' },
      { re: /\b(deepfake|synthetic\s+media)\s+(without\s+consent|deceptive)\b/i, weight: 0.85, label: 'deepfake_fraud' },
      { re: /\b(ponzi|pyramid)\s+scheme\b/i, weight: 0.90, label: 'financial_fraud' },
    ],
  },
};

// ── Topic detector ────────────────────────────────────────────────────────────

/**
 * Scan text against a specific bundle of topics.
 *
 * @param {string} text
 * @param {object} bundle — { defaultAction, terms }
 * @returns {{ matches: Array, score: number }}
 */
function _scanBundle(text, bundle) {
  const matches = [];
  for (const { re, weight, label } of bundle.terms) {
    const m = re.exec(text);
    if (m) matches.push({ label, weight, snippet: m[0].slice(0, 80) });
  }
  if (matches.length === 0) return { matches: [], score: 0 };
  const maxWeight = Math.max(...matches.map(m => m.weight));
  const bonus = Math.min(0.1, (matches.length - 1) * 0.02);
  return { matches, score: Math.min(1.0, maxWeight + bonus) };
}

/**
 * Classify text against all configured topic bundles.
 *
 * @param {string} text
 * @param {object} opts — { enabledBundles, customDenied, customAllowed }
 * @returns {{ topicHits: object, overallScore: number, primaryTopic: string|null, action: string }}
 */
function classify(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { topicHits: {}, overallScore: 0, primaryTopic: null, action: 'PASS', findings: [] };
  }

  const enabledBundles = opts.enabledBundles ||
    ['FINANCIAL_ADVICE', 'MEDICAL_ADVICE', 'WEAPONS_ILLEGAL', 'HACKING', 'PRIVACY_VIOLATION', 'DISINFORMATION'];

  const topicHits = {};
  const allFindings = [];
  let maxScore = 0;
  let primaryTopic = null;
  let actionForPrimary = 'PASS';

  for (const bundleName of enabledBundles) {
    const bundle = TOPIC_BUNDLES[bundleName];
    if (!bundle) continue;

    const result = _scanBundle(text, bundle);
    if (result.score > 0) {
      topicHits[bundleName] = result;
      allFindings.push(...result.matches.map(m => ({ topic: bundleName, ...m })));
      if (result.score > maxScore) {
        maxScore = result.score;
        primaryTopic = bundleName;
        actionForPrimary = bundle.defaultAction;
      }
    }
  }

  // Custom denied keywords (always FLAG/BLOCK)
  if (opts.customDenied && Array.isArray(opts.customDenied)) {
    for (const keyword of opts.customDenied) {
      const re = keyword instanceof RegExp ? keyword : new RegExp(keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      if (re.test(text)) {
        allFindings.push({ topic: 'custom_denied', label: keyword.toString(), weight: 0.9, snippet: keyword.toString() });
        if (0.9 > maxScore) {
          maxScore = 0.9;
          primaryTopic = 'custom_denied';
          actionForPrimary = 'block';
        }
      }
    }
  }

  // Custom allowed topics override (reduce score when allowed topic detected)
  if (opts.customAllowed && Array.isArray(opts.customAllowed)) {
    for (const keyword of opts.customAllowed) {
      const re = keyword instanceof RegExp ? keyword : new RegExp(keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      if (re.test(text)) {
        maxScore *= 0.5; // Halve risk score for explicitly allowed topics
      }
    }
  }

  // Normalise action to uppercase
  let finalAction = 'PASS';
  if (primaryTopic) {
    finalAction = actionForPrimary === 'block' ? 'BLOCK' : 'FLAG';
  }

  return {
    topicHits,
    overallScore: maxScore,
    primaryTopic,
    action: finalAction,
    findings: allFindings,
  };
}

// ── Stage interface ───────────────────────────────────────────────────────────

async function run(payload, stageConfig = {}) {
  const { text = '', context = {} } = payload;
  const blockThreshold = stageConfig.blockThreshold ?? 80;
  const flagThreshold  = stageConfig.flagThreshold  ?? 50;

  const result = classify(text, {
    enabledBundles: stageConfig.enabledBundles,
    customDenied:   stageConfig.deniedTopics,
    customAllowed:  stageConfig.allowedTopics,
  });

  const riskScore = Math.round(result.overallScore * 100);
  let action = result.action;

  // Reconcile with pipeline thresholds
  if (action === 'FLAG' && riskScore >= blockThreshold) action = 'BLOCK';
  if (action === 'PASS' && riskScore >= flagThreshold)  action = 'FLAG';

  return {
    stage: STAGE_NAME,
    action,
    riskScore,
    confidence: result.findings.length > 0 ? 0.80 : 0,
    findings: result.findings,
    meta: {
      primaryTopic: result.primaryTopic,
      topicsDetected: Object.keys(result.topicHits),
    },
  };
}

module.exports = { run, classify, TOPIC_BUNDLES, STAGE_NAME };
