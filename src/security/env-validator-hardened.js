'use strict';

/**
 * Heady™ Environment Validator (Hardened)
 * Drop into: src/security/env-validator-hardened.js
 * Usage: const { valid, errors } = validateEnvironment();
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'GCP_PROJECT_ID',
  'NODE_ENV',
];

const REQUIRED_IN_PRODUCTION = [
  'HEADY_CONDUCTOR_URL',
  'HEADY_MCP_URL',
  'SENTRY_DSN',
];

const FORBIDDEN_PATTERNS = [
  { pattern: /localhost/i, message: 'localhost references forbidden in production' },
  { pattern: /127\.0\.0\.1/, message: 'loopback address forbidden' },
  { pattern: /0\.0\.0\.0/, message: 'wildcard bind address forbidden' },
  { pattern: /password123/i, message: 'weak password detected' },
  { pattern: /changeme/i, message: 'placeholder credential detected' },
  { pattern: /TODO|FIXME|HACK/i, message: 'unresolved marker in env' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/, message: 'potential API key in non-key var' },
];

const MIN_SECRET_LENGTH = 32;

function validateEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];
  const isProd = env.NODE_ENV === 'production' || env.HEADY_ENVIRONMENT === 'production';

  // Check required vars
  for (const key of REQUIRED_VARS) {
    if (!env[key]) {
      errors.push({ type: 'missing', key, message: `Missing required: ${key}` });
    }
  }

  // Production-only checks
  if (isProd) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!env[key]) {
        errors.push({ type: 'missing_prod', key, message: `Missing in production: ${key}` });
      }
    }
  }

  // Check forbidden patterns
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      if (pattern.test(value) && isProd) {
        errors.push({ type: 'forbidden', key, message: `${key}: ${message}` });
      }
    }
  }

  // Check secret strength
  const SECRET_KEYS = ['JWT_SECRET', 'API_SECRET', 'SESSION_SECRET'];
  for (const key of SECRET_KEYS) {
    if (env[key] && env[key].length < MIN_SECRET_LENGTH) {
      warnings.push({ type: 'weak_secret', key, message: `${key} should be >= ${MIN_SECRET_LENGTH} chars` });
    }
  }

  // Check for production readiness
  if (!isProd && env.HEADY_ENVIRONMENT !== 'pilot') {
    warnings.push({ type: 'env', message: 'NODE_ENV is not production or pilot' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: `${errors.length} errors, ${warnings.length} warnings`,
  };
}

// Run on import if NODE_ENV is production
if (process.env.NODE_ENV === 'production') {
  const result = validateEnvironment();
  if (!result.valid) {
    console.error('[EnvValidator] ❌ CRITICAL: Environment validation failed');
    for (const err of result.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = { validateEnvironment, REQUIRED_VARS, FORBIDDEN_PATTERNS };
