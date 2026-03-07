'use strict';

/**
 * HeadyChain Configuration
 * Sacred Geometry scaling with PHI = 1.618 for backoff, timeouts, and sizing
 */

const PHI = 1.618033988749895;

const config = {
  // Sacred Geometry constants
  PHI,
  PHI_SQUARED: PHI * PHI,       // 2.618
  PHI_CUBED: PHI * PHI * PHI,   // 4.236
  INVERSE_PHI: 1 / PHI,          // 0.618

  // Service identity
  SERVICE_NAME: 'heady-chain',
  SERVICE_VERSION: '1.0.0',
  PORT: parseInt(process.env.HEADY_CHAIN_PORT || '3007', 10),

  // Execution engine
  MAX_PARALLEL_NODES: parseInt(process.env.MAX_PARALLEL_NODES || '10', 10),
  DEFAULT_NODE_TIMEOUT_MS: parseInt(process.env.DEFAULT_NODE_TIMEOUT_MS || '30000', 10),
  DEFAULT_WORKFLOW_TIMEOUT_MS: parseInt(process.env.DEFAULT_WORKFLOW_TIMEOUT_MS || '300000', 10),
  MAX_WORKFLOW_STEPS: parseInt(process.env.MAX_WORKFLOW_STEPS || '500', 10),
  MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5', 10),

  // PHI-based retry backoff: base_ms * PHI^attempt
  RETRY_BASE_MS: parseInt(process.env.RETRY_BASE_MS || '1000', 10),

  // Memory configuration
  MEMORY_BUFFER_SIZE: parseInt(process.env.MEMORY_BUFFER_SIZE || '50', 10),
  MEMORY_SUMMARY_THRESHOLD: parseInt(process.env.MEMORY_SUMMARY_THRESHOLD || '20', 10),
  WORKING_MEMORY_TTL_MS: parseInt(process.env.WORKING_MEMORY_TTL_MS || '3600000', 10),
  ENTITY_MEMORY_MAX: parseInt(process.env.ENTITY_MEMORY_MAX || '100', 10),

  // Prompt / token management
  DEFAULT_MAX_TOKENS: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),
  DEFAULT_CONTEXT_WINDOW: parseInt(process.env.DEFAULT_CONTEXT_WINDOW || '8192', 10),
  // Rough tokens-per-char estimate for truncation
  CHARS_PER_TOKEN: 4,

  // Tool configuration
  DEFAULT_TOOL_TIMEOUT_MS: parseInt(process.env.DEFAULT_TOOL_TIMEOUT_MS || '15000', 10),
  MAX_TOOL_RESULT_LENGTH: parseInt(process.env.MAX_TOOL_RESULT_LENGTH || '10000', 10),

  // HeadyInfer endpoint (LLM calls)
  HEADY_INFER_URL: process.env.HEADY_INFER_URL || 'http://heady-infer:3003',
  HEADY_INFER_TIMEOUT_MS: parseInt(process.env.HEADY_INFER_TIMEOUT_MS || '60000', 10),
  HEADY_INFER_DEFAULT_MODEL: process.env.HEADY_INFER_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',

  // HeadyVector endpoint (vector memory)
  HEADY_VECTOR_URL: process.env.HEADY_VECTOR_URL || 'http://heady-vector:3006',

  // Checkpoint / persistence
  CHECKPOINT_ENABLED: process.env.CHECKPOINT_ENABLED !== 'false',
  CHECKPOINT_DIR: process.env.CHECKPOINT_DIR || '/tmp/heady-chain/checkpoints',
  CHECKPOINT_TTL_MS: parseInt(process.env.CHECKPOINT_TTL_MS || '86400000', 10), // 24h

  // Workflow store
  MAX_STORED_WORKFLOWS: parseInt(process.env.MAX_STORED_WORKFLOWS || '1000', 10),

  // SSE streaming
  SSE_HEARTBEAT_MS: parseInt(process.env.SSE_HEARTBEAT_MS || '15000', 10),

  // Human-in-the-loop
  HUMAN_TIMEOUT_MS: parseInt(process.env.HUMAN_TIMEOUT_MS || '3600000', 10), // 1h

  // Agent patterns
  REACT_MAX_ITERATIONS: parseInt(process.env.REACT_MAX_ITERATIONS || '10', 10),
  PLAN_EXECUTE_MAX_STEPS: parseInt(process.env.PLAN_EXECUTE_MAX_STEPS || '20', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_PRETTY: process.env.LOG_PRETTY === 'true',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['*'],

  // Metrics
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
};

/**
 * Compute PHI-backoff delay for retry attempt n (0-indexed)
 * delay = base * PHI^n, capped at 30s
 */
config.phiBackoff = function phiBackoff(attempt) {
  const delay = config.RETRY_BASE_MS * Math.pow(PHI, attempt);
  return Math.min(delay, 30000);
};

/**
 * Scale a value by PHI^n
 */
config.phiScale = function phiScale(value, n = 1) {
  return value * Math.pow(PHI, n);
};

module.exports = config;
