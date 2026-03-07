'use strict';

/**
 * HeadyEval Configuration
 * LLM-as-judge evaluation framework for the Heady AI platform.
 * Sacred Geometry scaling: PHI = 1.618
 */

const PHI = 1.618033988749895;

const config = {
  // Service identity
  serviceName: 'heady-eval',
  serviceVersion: process.env.npm_package_version || '1.0.0',

  // Server
  port: parseInt(process.env.HEADY_EVAL_PORT, 10) || 3107,
  host: process.env.HEADY_EVAL_HOST || '0.0.0.0',

  // Sacred Geometry scaling
  phi: PHI,
  phiSquared: PHI * PHI,
  phiInverse: 1 / PHI,

  // Judge model (via HeadyInfer)
  judgeModel: process.env.HEADY_EVAL_JUDGE_MODEL || 'claude-3.5-sonnet',
  judgeTemperature: parseFloat(process.env.HEADY_EVAL_JUDGE_TEMPERATURE) || 0.0,
  judgeMaxTokens: parseInt(process.env.HEADY_EVAL_JUDGE_MAX_TOKENS, 10) || 1024,

  // Concurrency
  concurrency: parseInt(process.env.HEADY_EVAL_CONCURRENCY, 10) || 5,

  // Default scorers (comma-separated list of scorer names)
  defaultScorers: (process.env.HEADY_EVAL_DEFAULT_SCORERS || 'relevance,faithfulness,safety,coherence,helpfulness')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Upstream service URLs
  headyInferUrl: process.env.HEADY_INFER_URL || 'http://heady-infer:3101',
  headyEmbedUrl: process.env.HEADY_EMBED_URL || 'http://heady-embed:3102',
  headyGuardUrl: process.env.HEADY_GUARD_URL || 'http://heady-guard:3103',

  // Rate limiting for judge calls
  judgeRateLimit: {
    requestsPerMinute: parseInt(process.env.HEADY_EVAL_JUDGE_RPM, 10) || 60,
    tokensPerMinute: parseInt(process.env.HEADY_EVAL_JUDGE_TPM, 10) || 100000,
  },

  // Storage
  storageDir: process.env.HEADY_EVAL_STORAGE_DIR || '/tmp/heady-eval',
  datasetsDir: process.env.HEADY_EVAL_DATASETS_DIR || '/tmp/heady-eval/datasets',
  runsDir: process.env.HEADY_EVAL_RUNS_DIR || '/tmp/heady-eval/runs',
  checkpointsDir: process.env.HEADY_EVAL_CHECKPOINTS_DIR || '/tmp/heady-eval/checkpoints',

  // Timeouts (ms) — scaled by PHI
  requestTimeout: parseInt(process.env.HEADY_EVAL_REQUEST_TIMEOUT, 10) || 30000,
  judgeTimeout: parseInt(process.env.HEADY_EVAL_JUDGE_TIMEOUT, 10) || Math.round(30000 * PHI),

  // Retry
  maxRetries: parseInt(process.env.HEADY_EVAL_MAX_RETRIES, 10) || 3,
  retryDelayMs: parseInt(process.env.HEADY_EVAL_RETRY_DELAY, 10) || 1000,

  // Self-consistency: run judge twice and flag disagreements beyond this delta
  selfConsistencyThreshold: parseFloat(process.env.HEADY_EVAL_SELF_CONSISTENCY_THRESHOLD) || 1.0,

  // Multi-judge consensus: minimum number of judges that must agree
  multiJudgeConsensusMin: parseInt(process.env.HEADY_EVAL_MULTI_JUDGE_CONSENSUS_MIN, 10) || 2,

  // Scoring scales
  scoring: {
    min: 1,
    max: 5,
    passThreshold: parseFloat(process.env.HEADY_EVAL_PASS_THRESHOLD) || 3.0,
  },

  // HTTP service config
  corsOrigins: (process.env.HEADY_EVAL_CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  trustProxy: process.env.HEADY_EVAL_TRUST_PROXY === 'true',

  // Environment
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
