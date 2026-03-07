'use strict';

/**
 * HeadyGuard — Injection Detector
 *
 * Detects prompt injection attacks including:
 *  - Classic override phrases ("ignore previous instructions")
 *  - Persona hijacking / jailbreak phrases ("act as DAN")
 *  - Instruction hierarchy violations
 *  - Encoding obfuscation (base64, hex, unicode escapes)
 *  - Delimiter injection (closing XML/JSON tags to escape context)
 *  - Nested prompt injection via data payloads
 *
 * Each detection carries a confidence score (0–1).
 * Aggregate risk contribution: 0–100.
 */

const STAGE_NAME = 'injection';

// ── Pattern banks ─────────────────────────────────────────────────────────────

// Classic override / ignore-instructions patterns
const OVERRIDE_PATTERNS = [
  { re: /ignore\s+(all\s+)?(previous|prior|above|earlier|former)\s+(instructions?|prompts?|context|rules?|constraints?|directions?)/i, label: 'ignore_instructions', weight: 0.95 },
  { re: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i, label: 'disregard_instructions', weight: 0.92 },
  { re: /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|context|rules?)/i, label: 'forget_instructions', weight: 0.90 },
  { re: /override\s+(your\s+)?(instructions?|programming|rules?|directives?|system\s+prompt)/i, label: 'override_instructions', weight: 0.93 },
  { re: /do\s+not\s+follow\s+(your\s+)?(previous|prior|original|initial)\s+(instructions?|rules?|directives?)/i, label: 'do_not_follow', weight: 0.88 },
  { re: /you\s+(are|were)\s+now\s+free\s+(from|of)\s+(your\s+)?(constraints?|restrictions?|rules?|instructions?)/i, label: 'free_from_constraints', weight: 0.91 },
  { re: /new\s+(instruction|directive|task|goal|objective|rule)\s*:\s*/i, label: 'new_instruction_marker', weight: 0.70 },
  { re: /your\s+(actual|real|true|original)\s+(instructions?|task|purpose|goal|mission)\s+(is|are|were)/i, label: 'true_purpose_claim', weight: 0.75 },
  { re: /pretend\s+(that\s+)?(you\s+)?(have\s+no|don'?t\s+have|without)\s+(restrictions?|constraints?|rules?|filters?|guidelines?)/i, label: 'pretend_no_restrictions', weight: 0.89 },
  { re: /\[system\s+override\]/i, label: 'system_override_tag', weight: 0.97 },
  { re: /\[admin\s*mode\]/i, label: 'admin_mode_tag', weight: 0.95 },
  { re: /developer\s+mode\s+(enabled|on|activated)/i, label: 'developer_mode', weight: 0.93 },
  { re: /maintenance\s+mode\s+(enabled|on|activated)/i, label: 'maintenance_mode', weight: 0.85 },
];

// Persona hijacking / jailbreak
const PERSONA_PATTERNS = [
  { re: /act\s+as\s+(a\s+)?(DAN|jailbreak|unrestricted|unfiltered|evil|malicious|hacker|criminal)/i, label: 'act_as_jailbreak', weight: 0.97 },
  { re: /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/i, label: 'dan_jailbreak', weight: 0.98 },
  { re: /you\s+are\s+now\s+(DAN|STAN|AIM|DUDE|KEVIN|ALICE|OMEGA|PLINY)/i, label: 'dan_persona', weight: 0.97 },
  { re: /act\s+as\s+if\s+(you\s+)?(have\s+no\s+(restrictions?|constraints?|filters?)|you\s+(can|could|are\s+able\s+to)\s+(do|say|write)\s+anything)/i, label: 'act_as_unrestricted', weight: 0.94 },
  { re: /roleplay\s+(as\s+)?(an?\s+)?(evil|malicious|criminal|hacker|terrorist|unethical)/i, label: 'evil_roleplay', weight: 0.90 },
  { re: /pretend\s+(to\s+be|you\s+are)\s+(an?\s+)?(AI\s+(with\s+no|without)\s+(restrictions?|filters?|safety|guidelines?)|unrestricted\s+AI)/i, label: 'unrestricted_ai_persona', weight: 0.96 },
  { re: /simulate\s+(a\s+)?(jailbroken|uncensored|unfiltered|unrestricted)\s+(AI|model|assistant|chatbot|LLM)/i, label: 'simulate_jailbroken', weight: 0.95 },
  { re: /\[jailbreak\s*(mode|prompt|start|enabled)?\]/i, label: 'jailbreak_tag', weight: 0.98 },
  { re: /stay\s+in\s+character\s+(no\s+matter\s+what|always|at\s+all\s+times)/i, label: 'stay_in_character', weight: 0.65 },
  { re: /from\s+now\s+on\s+(you\s+)?(will|must|should|shall)\s+(respond|answer|reply|act|behave)\s+(as|like)/i, label: 'from_now_on_persona', weight: 0.75 },
];

// Instruction hierarchy violations – trying to inject system-level content
const HIERARCHY_PATTERNS = [
  { re: /\[INST\]|\[\/INST\]/i, label: 'llama_inst_tag', weight: 0.85 },
  { re: new RegExp('</?s>|</?SYS>|<<SYS>>|<</SYS>>', 'i'), label: 'llama_sys_tag', weight: 0.88 },
  { re: /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>/i, label: 'chatml_tag', weight: 0.87 },
  { re: /###\s*(instruction|system|human|assistant|context)\s*:/i, label: 'alpaca_header', weight: 0.80 },
  { re: /^system\s*:/im, label: 'raw_system_header', weight: 0.78 },
  { re: /<<prompt>>|<\|prompt\|>|\[prompt\]/i, label: 'prompt_tag', weight: 0.82 },
  { re: /you\s+are\s+an?\s+AI\s+(assistant|language\s+model|chatbot)\s+(created|made|built|developed|trained)\s+by/i, label: 'identity_override', weight: 0.60 },
  { re: /your\s+system\s+prompt\s+(is|says|states|reads)/i, label: 'system_prompt_reveal', weight: 0.72 },
  { re: /print\s+(out\s+)?(your\s+)?(system|initial|original)\s+(prompt|instructions?|context)/i, label: 'print_system_prompt', weight: 0.85 },
  { re: /repeat\s+(the\s+)?(above|everything|all|your\s+(system|initial|first))\s+(instructions?|prompts?|text|context)/i, label: 'repeat_instructions', weight: 0.80 },
  { re: /what\s+(were|are)\s+your\s+(exact\s+)?(system\s+)?(instructions?|prompts?|directives?)/i, label: 'reveal_instructions', weight: 0.70 },
];

// Encoding obfuscation patterns
const ENCODING_PATTERNS = [
  // Base64 blobs of meaningful size (>40 chars of base64 alphabet)
  { re: /[A-Za-z0-9+/]{40,}={0,2}/, label: 'base64_blob', weight: 0.55, test: _isLikelyBase64 },
  // Unicode escape sequences (\u0041 = A) — suspicious when dense
  { re: /(?:\\u[0-9a-fA-F]{4}){4,}/, label: 'unicode_escape', weight: 0.75 },
  // Hex encoding patterns (\x41\x43\x54)
  { re: /(?:\\x[0-9a-fA-F]{2}){4,}/, label: 'hex_escape', weight: 0.78 },
  // URL encoding (dense %xx sequences)
  { re: /(?:%[0-9a-fA-F]{2}){5,}/, label: 'url_encoding', weight: 0.72 },
  // Leetspeak mixing (i9nor3 pr3vi0us)
  { re: /[i1][g9][n][o0][r3][e3]\s+[p]\w{3,6}\s+[i1][n]/i, label: 'leetspeak_override', weight: 0.65 },
  // Zero-width characters used to split tokens
  { re: /[\u200B\u200C\u200D\u2060\uFEFF]/, label: 'zero_width_char', weight: 0.70 },
  // Homoglyph substitution (Cyrillic/Greek chars mixed with Latin)
  { re: /[а-яёА-ЯЁ\u0391-\u03C9\u0400-\u04FF]/, label: 'homoglyph_script', weight: 0.45, test: _hasMixedScripts },
];

// Delimiter injection — tries to close context structures
const DELIMITER_PATTERNS = [
  { re: /<\/\s*(system|instruction|context|prompt|user|assistant)\s*>/i, label: 'xml_close_injection', weight: 0.82 },
  { re: /\}\s*\}\s*\}\s*\{/,  label: 'json_close_injection', weight: 0.70 },
  { re: /---\s*[\r\n]+.*?---/s, label: 'yaml_fence_injection', weight: 0.55 },
  { re: /```\s*(system|instruction|prompt)\s*[\r\n]/i, label: 'code_fence_injection', weight: 0.68 },
  { re: /"role"\s*:\s*"system"/i, label: 'json_role_system', weight: 0.78 },
  { re: /"role"\s*:\s*"(user|assistant)"\s*,\s*"content"\s*:/i, label: 'json_chat_injection', weight: 0.72 },
];

// ── Helper functions ──────────────────────────────────────────────────────────

function _isLikelyBase64(match) {
  try {
    const decoded = Buffer.from(match, 'base64').toString('utf8');
    // Contains readable ASCII words if it's actually encoded text
    return /[a-zA-Z]{3,}/.test(decoded) && decoded.length > 10;
  } catch {
    return false;
  }
}

function _hasMixedScripts(text) {
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasNonLatin = /[^\x00-\x7F]/.test(text);
  return hasLatin && hasNonLatin;
}

// ── Detection logic ───────────────────────────────────────────────────────────

/**
 * Run a single pattern bank against text.
 * @param {string} text
 * @param {Array} patterns
 * @returns {Array<{label, weight, match}>}
 */
function _runPatternBank(text, patterns) {
  const hits = [];
  for (const { re, label, weight, test: extraTest } of patterns) {
    const m = re.exec(text);
    if (m) {
      if (extraTest && !extraTest(m[0], text)) continue;
      hits.push({ label, weight, snippet: m[0].slice(0, 80) });
    }
  }
  return hits;
}

/**
 * Detect prompt injection in text.
 *
 * @param {string} text  — the input to analyse
 * @param {object} opts  — optional per-call overrides
 * @returns {{ detected: boolean, confidence: number, findings: Array, riskScore: number }}
 */
function detect(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { detected: false, confidence: 0, findings: [], riskScore: 0 };
  }

  const normalized = text.replace(/\s+/g, ' ').trim();

  const findings = [
    ..._runPatternBank(normalized, OVERRIDE_PATTERNS).map(f => ({ ...f, category: 'override' })),
    ..._runPatternBank(normalized, PERSONA_PATTERNS).map(f => ({ ...f, category: 'persona' })),
    ..._runPatternBank(normalized, HIERARCHY_PATTERNS).map(f => ({ ...f, category: 'hierarchy' })),
    ..._runPatternBank(normalized, ENCODING_PATTERNS).map(f => ({ ...f, category: 'encoding' })),
    ..._runPatternBank(normalized, DELIMITER_PATTERNS).map(f => ({ ...f, category: 'delimiter' })),
  ];

  if (findings.length === 0) {
    return { detected: false, confidence: 0, findings: [], riskScore: 0 };
  }

  // Aggregate confidence: max single finding + bonus for multiple findings
  const maxWeight = Math.max(...findings.map(f => f.weight));
  const multiBonus = Math.min(0.15, (findings.length - 1) * 0.03);
  const confidence = Math.min(1.0, maxWeight + multiBonus);

  // Risk score 0-100 (injection is high-severity, so scale aggressively)
  const riskScore = Math.round(confidence * 100);

  return {
    detected: true,
    confidence,
    findings,
    riskScore,
  };
}

// ── Stage interface ───────────────────────────────────────────────────────────

/**
 * Pipeline stage runner.
 * Returns a standardised stage result object.
 *
 * @param {object} payload  — { text, context }
 * @param {object} stageConfig
 * @returns {{ stage, action, riskScore, confidence, findings, meta }}
 */
async function run(payload, stageConfig = {}) {
  const { text = '', context = {} } = payload;
  const blockThreshold = stageConfig.blockThreshold ?? 80;
  const flagThreshold  = stageConfig.flagThreshold  ?? 50;

  const result = detect(text, stageConfig);

  let action = 'PASS';
  if (result.detected) {
    if (result.riskScore >= blockThreshold) {
      action = 'BLOCK';
    } else if (result.riskScore >= flagThreshold) {
      action = 'FLAG';
    } else {
      action = 'FLAG'; // any injection detection is at least a FLAG
    }
  }

  return {
    stage: STAGE_NAME,
    action,
    riskScore: result.riskScore,
    confidence: result.confidence,
    findings: result.findings,
    meta: {
      findingCount: result.findings.length,
      categories: [...new Set(result.findings.map(f => f.category))],
    },
  };
}

module.exports = { run, detect, STAGE_NAME };
