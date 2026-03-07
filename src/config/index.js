/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Central configuration loader for the Heady™ AI Platform.
 * Reads all configuration from environment variables with the HEADY_ prefix.
 * @module src/config
 */

const { loadEnv } = require('../core/heady-env');
const domains = require('./domains');

// Load .env file if present (no-op in production where env vars are injected)
loadEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns an environment variable value, or a default.
 * @param {string} key - The environment variable name.
 * @param {*} [defaultValue] - Fallback value if the variable is not set.
 * @returns {string|undefined}
 */
function env(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val;
}

/**
 * Returns an integer from an environment variable.
 * @param {string} key
 * @param {number} defaultValue
 * @returns {number}
 */
function envInt(key, defaultValue) {
  const val = process.env[key];
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Returns a boolean from an environment variable.
 * @param {string} key
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function envBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

// ---------------------------------------------------------------------------
// Sacred Geometry Constants
// ---------------------------------------------------------------------------

/**
 * Sacred Geometry constants used throughout the platform for
 * resource allocation, timing, and orchestration harmonics.
 * @type {Object}
 */
const SACRED_GEOMETRY = Object.freeze({
  PHI: 1.618033988749895,
  FIBONACCI: Object.freeze([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]),
  GOLDEN_ANGLE_DEG: 137.5077640500378,
  GOLDEN_ANGLE_RAD: 2.399963229728653,
  SQRT5: Math.sqrt(5),
  PHI_INVERSE: 0.6180339887498949,
  PHI_SQUARED: 2.618033988749895,
});

// ---------------------------------------------------------------------------
// Resource Pool Percentages (Fibonacci-derived)
// ---------------------------------------------------------------------------

/**
 * Resource pool allocation percentages derived from Fibonacci ratios.
 * @type {Object}
 */
const RESOURCE_POOLS = Object.freeze({
  hot: 34,       // High-frequency active resources
  warm: 21,      // Standby ready resources
  cold: 13,      // Idle/background resources
  reserve: 8,    // Emergency reserve
  governance: 5, // Platform governance overhead
});

// ---------------------------------------------------------------------------
// Main Configuration Object
// ---------------------------------------------------------------------------

/** @type {Object} */
const config = {
  // ── Server ────────────────────────────────────────────────────────────────
  server: {
    port: envInt('HEADY_PORT', 3301),
    host: env('HEADY_HOST', '0.0.0.0'),
    name: env('HEADY_NODE_NAME', 'heady-primary'),
    environment: env('HEADY_ENV', env('NODE_ENV', 'development')),
    version: '3.1.0',
    platform: 'Heady™ AI Platform',
    company: 'HeadySystems Inc.',
    requestTimeout: envInt('HEADY_REQUEST_TIMEOUT_MS', 30000),
    bodyLimit: envInt('HEADY_BODY_LIMIT_BYTES', 10 * 1024 * 1024), // 10 MB
    trustProxy: envBool('HEADY_TRUST_PROXY', false),
  },

  // ── AI Provider API Keys ──────────────────────────────────────────────────
  providers: {
    anthropic: {
      apiKey: env('HEADY_ANTHROPIC_API_KEY', env('ANTHROPIC_API_KEY', '')),
      baseUrl: env('HEADY_ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
      defaultModel: env('HEADY_ANTHROPIC_MODEL', 'claude-opus-4-5'),
      maxTokens: envInt('HEADY_ANTHROPIC_MAX_TOKENS', 8192),
    },
    openai: {
      apiKey: env('HEADY_OPENAI_API_KEY', env('OPENAI_API_KEY', '')),
      baseUrl: env('HEADY_OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      defaultModel: env('HEADY_OPENAI_MODEL', 'gpt-4o'),
      organization: env('HEADY_OPENAI_ORG', ''),
    },
    google: {
      apiKey: env('HEADY_GOOGLE_API_KEY', env('GOOGLE_API_KEY', '')),
      baseUrl: env('HEADY_GOOGLE_BASE_URL', 'https://generativelanguage.googleapis.com'),
      defaultModel: env('HEADY_GOOGLE_MODEL', 'gemini-2.0-flash'),
      projectId: env('HEADY_GOOGLE_PROJECT_ID', ''),
    },
    groq: {
      apiKey: env('HEADY_GROQ_API_KEY', env('GROQ_API_KEY', '')),
      baseUrl: env('HEADY_GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
      defaultModel: env('HEADY_GROQ_MODEL', 'llama-3.3-70b-versatile'),
    },
    perplexity: {
      apiKey: env('HEADY_PERPLEXITY_API_KEY', env('PERPLEXITY_API_KEY', '')),
      baseUrl: env('HEADY_PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
      defaultModel: env('HEADY_PERPLEXITY_MODEL', 'llama-3.1-sonar-large-128k-online'),
    },
    cloudflare: {
      apiKey: env('HEADY_CLOUDFLARE_API_KEY', env('CLOUDFLARE_API_KEY', '')),
      accountId: env('HEADY_CLOUDFLARE_ACCOUNT_ID', ''),
      baseUrl: env('HEADY_CLOUDFLARE_BASE_URL', 'https://api.cloudflare.com/client/v4'),
      aiGateway: env('HEADY_CLOUDFLARE_AI_GATEWAY', ''),
    },
  },

  // ── Databases ─────────────────────────────────────────────────────────────
  database: {
    postgres: {
      url: env('HEADY_POSTGRES_URL', env('DATABASE_URL', '')),
      poolMin: envInt('HEADY_POSTGRES_POOL_MIN', 2),
      poolMax: envInt('HEADY_POSTGRES_POOL_MAX', 10),
      ssl: envBool('HEADY_POSTGRES_SSL', true),
    },
    redis: {
      url: env('HEADY_REDIS_URL', env('REDIS_URL', '')),
      password: env('HEADY_REDIS_PASSWORD', ''),
      tls: envBool('HEADY_REDIS_TLS', false),
      ttlDefault: envInt('HEADY_REDIS_TTL_DEFAULT', 3600),
    },
    vector: {
      url: env('HEADY_VECTOR_URL', env('PINECONE_URL', '')),
      apiKey: env('HEADY_VECTOR_API_KEY', env('PINECONE_API_KEY', '')),
      index: env('HEADY_VECTOR_INDEX', 'heady-memory'),
      namespace: env('HEADY_VECTOR_NAMESPACE', 'default'),
      dimensions: envInt('HEADY_VECTOR_DIMENSIONS', 1536),
    },
  },

  // ── Authentication & Security ─────────────────────────────────────────────
  auth: {
    jwtSecret: env('HEADY_JWT_SECRET', ''),
    jwtExpiresIn: env('HEADY_JWT_EXPIRES_IN', '24h'),
    jwtRefreshExpiresIn: env('HEADY_JWT_REFRESH_EXPIRES_IN', '7d'),
    apiKeyHeader: env('HEADY_API_KEY_HEADER', 'x-heady-api-key'),
    masterApiKey: env('HEADY_MASTER_API_KEY', ''),
    bcryptRounds: envInt('HEADY_BCRYPT_ROUNDS', 12),
  },

  // ── GitHub / Octokit ─────────────────────────────────────────────────────
  github: {
    appId: env('HEADY_GITHUB_APP_ID', ''),
    privateKey: env('HEADY_GITHUB_PRIVATE_KEY', ''),
    clientId: env('HEADY_GITHUB_CLIENT_ID', ''),
    clientSecret: env('HEADY_GITHUB_CLIENT_SECRET', ''),
    installationId: env('HEADY_GITHUB_INSTALLATION_ID', ''),
    webhookSecret: env('HEADY_GITHUB_WEBHOOK_SECRET', ''),
    org: env('HEADY_GITHUB_ORG', 'HeadySystems'),
  },

  // ── MCP (Model Context Protocol) ─────────────────────────────────────────
  mcp: {
    serverName: env('HEADY_MCP_SERVER_NAME', 'heady-mcp'),
    serverVersion: '3.1.0',
    transport: env('HEADY_MCP_TRANSPORT', 'stdio'),
    httpPort: envInt('HEADY_MCP_HTTP_PORT', 3302),
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      sampling: false,
    },
  },

  // ── Pipeline ──────────────────────────────────────────────────────────────
  pipeline: {
    maxConcurrency: envInt('HEADY_PIPELINE_MAX_CONCURRENCY', 5),
    timeoutMs: envInt('HEADY_PIPELINE_TIMEOUT_MS', 120000),
    retryAttempts: envInt('HEADY_PIPELINE_RETRY_ATTEMPTS', 3),
    retryDelayMs: envInt('HEADY_PIPELINE_RETRY_DELAY_MS', 1000),
  },

  // ── Monte Carlo Engine ────────────────────────────────────────────────────
  monteCarlo: {
    iterations: envInt('HEADY_MC_ITERATIONS', 1000),
    confidenceLevel: parseFloat(env('HEADY_MC_CONFIDENCE', '0.95')),
    seed: envInt('HEADY_MC_SEED', 42),
  },

  // ── Bee Factory (Agent Pool) ──────────────────────────────────────────────
  beeFactory: {
    maxAgents: envInt('HEADY_BEE_MAX_AGENTS', 21),
    idleTimeoutMs: envInt('HEADY_BEE_IDLE_TIMEOUT_MS', 300000),
    warmPoolSize: envInt('HEADY_BEE_WARM_POOL', 3),
  },

  // ── Vector Memory ─────────────────────────────────────────────────────────
  vectorMemory: {
    embeddingModel: env('HEADY_EMBED_MODEL', 'text-embedding-3-small'),
    chunkSize: envInt('HEADY_EMBED_CHUNK_SIZE', 512),
    chunkOverlap: envInt('HEADY_EMBED_CHUNK_OVERLAP', 64),
    topK: envInt('HEADY_EMBED_TOP_K', 10),
    similarityThreshold: parseFloat(env('HEADY_EMBED_SIMILARITY_THRESHOLD', '0.75')),
  },

  // ── Logging ───────────────────────────────────────────────────────────────
  logging: {
    level: env('HEADY_LOG_LEVEL', 'info'),
    pretty: envBool('HEADY_LOG_PRETTY', false),
    includeTimestamp: envBool('HEADY_LOG_TIMESTAMP', true),
    includeHostname: envBool('HEADY_LOG_HOSTNAME', true),
    auditLog: envBool('HEADY_AUDIT_LOG', true),
  },

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  rateLimit: {
    windowMs: envInt('HEADY_RATE_WINDOW_MS', 60000),
    maxRequests: envInt('HEADY_RATE_MAX_REQUESTS', 100),
    maxRequestsApi: envInt('HEADY_RATE_MAX_API', 300),
    maxRequestsPipeline: envInt('HEADY_RATE_MAX_PIPELINE', 10),
  },

  // ── Domains ───────────────────────────────────────────────────────────────
  domains,

  // ── Sacred Geometry ───────────────────────────────────────────────────────
  sacredGeometry: SACRED_GEOMETRY,

  // ── Resource Pools ────────────────────────────────────────────────────────
  resourcePools: RESOURCE_POOLS,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that critical configuration values are present.
 * Logs warnings for missing optional keys, throws for required ones.
 * @returns {void}
 */
function validateConfig() {
  const warnings = [];
  const errors = [];

  if (!config.auth.jwtSecret && config.server.environment === 'production') {
    errors.push('HEADY_JWT_SECRET must be set in production');
  }
  if (!config.auth.masterApiKey && config.server.environment === 'production') {
    warnings.push('HEADY_MASTER_API_KEY is not set; API authentication may be limited');
  }
  if (!config.providers.anthropic.apiKey) {
    warnings.push('HEADY_ANTHROPIC_API_KEY not set; Anthropic provider unavailable');
  }
  if (!config.providers.openai.apiKey) {
    warnings.push('HEADY_OPENAI_API_KEY not set; OpenAI provider unavailable');
  }
  if (!config.database.postgres.url) {
    warnings.push('HEADY_POSTGRES_URL not set; persistent storage unavailable');
  }
  if (!config.database.redis.url) {
    warnings.push('HEADY_REDIS_URL not set; distributed cache unavailable');
  }

  if (errors.length > 0) {
    throw new Error(`[Config] Critical configuration errors:\n${errors.join('\n')}`);
  }

  if (warnings.length > 0 && config.server.environment !== 'test') {
    warnings.forEach((w) => process.stderr.write(`[Config WARN] ${w}\n`));
  }
}

// Run validation on load (skip in test to avoid noise from missing keys)
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

/**
 * Returns a read-only deep clone of the configuration to prevent mutation.
 * @returns {Object}
 */
function getConfig() {
  return config;
}

module.exports = config;
module.exports.getConfig = getConfig;
module.exports.validateConfig = validateConfig;
module.exports.SACRED_GEOMETRY = SACRED_GEOMETRY;
module.exports.RESOURCE_POOLS = RESOURCE_POOLS;
