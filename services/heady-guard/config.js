'use strict';

/**
 * HeadyGuard Configuration
 * All settings are read from environment variables with sensible defaults.
 * PHI = 1.618 (Sacred Geometry scaling used in risk scoring weighting)
 */

const PHI = 1.618;

function parseList(str, defaultVal = []) {
  if (!str) return defaultVal;
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function parseFloat_(str, defaultVal) {
  const v = parseFloat(str);
  return isNaN(v) ? defaultVal : v;
}

function parseInt_(str, defaultVal) {
  const v = parseInt(str, 10);
  return isNaN(v) ? defaultVal : v;
}

const config = {
  // ── Service identity ─────────────────────────────────────────────────────
  service: 'heady-guard',
  version: '1.0.0',

  // ── Network ───────────────────────────────────────────────────────────────
  port: parseInt_(process.env.HEADY_GUARD_PORT, 3106),
  host: process.env.HEADY_GUARD_HOST || '0.0.0.0',

  // ── Pipeline ──────────────────────────────────────────────────────────────
  // Ordered list of stage names; earlier stages run first
  stages: parseList(
    process.env.HEADY_GUARD_STAGES,
    ['injection', 'pii', 'toxicity', 'topic', 'rate_limit']
  ),

  // Stages that can run in parallel (no shared mutable state dependency)
  parallelStages: parseList(
    process.env.HEADY_GUARD_PARALLEL_STAGES,
    ['toxicity', 'topic']
  ),

  // ── Thresholds ────────────────────────────────────────────────────────────
  // Risk scores above blockThreshold → BLOCK
  blockThreshold: parseInt_(process.env.HEADY_GUARD_BLOCK_THRESHOLD, 80),
  // Risk scores between flagThreshold and blockThreshold → FLAG
  flagThreshold: parseInt_(process.env.HEADY_GUARD_FLAG_THRESHOLD, 50),

  // Per-stage timeout in milliseconds
  stageTimeoutMs: parseInt_(process.env.HEADY_GUARD_STAGE_TIMEOUT_MS, 500),

  // Overall pipeline timeout
  pipelineTimeoutMs: parseInt_(process.env.HEADY_GUARD_PIPELINE_TIMEOUT_MS, 2000),

  // ── PII ───────────────────────────────────────────────────────────────────
  // 'detect' = report only | 'redact' = auto-replace PII in text
  piiMode: process.env.HEADY_GUARD_PII_MODE === 'redact' ? 'redact' : 'detect',

  // Redaction strategy: 'mask' (****) | 'hash' (sha256 prefix) | 'placeholder' ([EMAIL_1])
  piiRedactionStrategy: process.env.HEADY_GUARD_PII_REDACTION_STRATEGY || 'placeholder',

  // ── Audit log ─────────────────────────────────────────────────────────────
  // If set, decisions are appended to this NDJSON file
  auditLogPath: process.env.HEADY_GUARD_AUDIT_LOG || null,
  // Maximum number of audit entries kept in memory
  auditMemoryLimit: parseInt_(process.env.HEADY_GUARD_AUDIT_MEMORY_LIMIT, 10000),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimit: {
    requestsPerMinute: parseInt_(process.env.HEADY_GUARD_RATE_RPM, 60),
    requestsPerHour: parseInt_(process.env.HEADY_GUARD_RATE_RPH, 1000),
    tokensPerMinute: parseInt_(process.env.HEADY_GUARD_RATE_TPM, 50000),
    tokensPerHour: parseInt_(process.env.HEADY_GUARD_RATE_TPH, 500000),
    burstWindow: parseInt_(process.env.HEADY_GUARD_RATE_BURST_WINDOW_MS, 5000),
    burstLimit: parseInt_(process.env.HEADY_GUARD_RATE_BURST_LIMIT, 10),
  },

  // ── Toxicity thresholds per category ──────────────────────────────────────
  toxicity: {
    hate:       parseFloat_(process.env.HEADY_GUARD_TOX_HATE,       0.7),
    violence:   parseFloat_(process.env.HEADY_GUARD_TOX_VIOLENCE,   0.75),
    sexual:     parseFloat_(process.env.HEADY_GUARD_TOX_SEXUAL,     0.8),
    selfHarm:   parseFloat_(process.env.HEADY_GUARD_TOX_SELF_HARM,  0.65),
    harassment: parseFloat_(process.env.HEADY_GUARD_TOX_HARASSMENT, 0.7),
  },

  // ── Rules engine ──────────────────────────────────────────────────────────
  rulesPath: process.env.HEADY_GUARD_RULES_PATH || null,
  rulesHotReload: process.env.HEADY_GUARD_RULES_HOT_RELOAD !== 'false',

  // ── Sacred Geometry scaling factor ───────────────────────────────────────
  // Used in risk score aggregation to weight later (higher-confidence) stages
  phi: PHI,

  // ── Node / environment ────────────────────────────────────────────────────
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  logLevel: process.env.HEADY_GUARD_LOG_LEVEL || 'info',
};

module.exports = config;
