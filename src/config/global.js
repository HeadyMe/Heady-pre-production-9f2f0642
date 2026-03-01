/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * GLOBAL CONFIG — Single Source of Truth
 * ═══════════════════════════════════════
 * ALL environment variables, URLs, ports, and constants are defined HERE.
 * No other file should read process.env directly.
 * Import this module: const config = require('../config/global');
 */

require('dotenv').config();

// ─── Helper: Required env var (fails loud, never hides) ─────────────
function requireEnv(key, fallback) {
    const val = process.env[key];
    if (val !== undefined && val !== '') return val;
    if (fallback !== undefined) return fallback;
    throw new Error(`[CONFIG FATAL] Missing required env var: ${key}`);
}

// ─── Helper: Optional env var (returns fallback, logs if missing) ───
function optionalEnv(key, fallback) {
    const val = process.env[key];
    if (val !== undefined && val !== '') return val;
    return fallback;
}

// ═══════════════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════
const NODE_ENV = optionalEnv('NODE_ENV', 'production');
const IS_PRODUCTION = NODE_ENV === 'production';
const LOG_LEVEL = optionalEnv('LOG_LEVEL', IS_PRODUCTION ? 'info' : 'debug');

// ═══════════════════════════════════════════════════════════════════════
// SERVICE URLS — Cloud-only, zero localhost
// ═══════════════════════════════════════════════════════════════════════
const URLS = Object.freeze({
    MANAGER: optionalEnv('HEADY_MANAGER_URL', 'https://manager.headysystems.com'),
    EDGE_PROXY: optionalEnv('HEADY_EDGE_PROXY_URL', 'https://heady-edge-proxy.headysystems.workers.dev'),
    BRAIN: optionalEnv('HEADY_BRAIN_URL', 'https://manager.headysystems.com'),
    CLOUDRUN: optionalEnv('HEADY_CLOUDRUN_URL', 'https://manager.headysystems.com'),
    QDRANT: optionalEnv('QDRANT_URL', 'https://qdrant.headysystems.com'),
    REDIS: optionalEnv('REDIS_URL', ''),
});

// ═══════════════════════════════════════════════════════════════════════
// DOMAINS — All production domains whitelist
// ═══════════════════════════════════════════════════════════════════════
const DOMAINS = Object.freeze([
    'headyme.com',
    'headysystems.com',
    'headyconnection.org',
    'headymcp.com',
    'headyio.com',
    'headybuddy.org',
    '1ime1.com',
]);

const ALLOWED_ORIGINS = Object.freeze([
    ...DOMAINS.flatMap(d => [`https://${d}`, `https://www.${d}`]),
    'https://app.headyme.com',
    'https://app.headysystems.com',
    'https://dashboard.headysystems.com',
    'https://api.headysystems.com',
    'https://manager.headysystems.com',
]);

const ALLOWED_ORIGIN_PATTERNS = Object.freeze([
    /^https:\/\/.*\.headyme\.com$/,
    /^https:\/\/.*\.headysystems\.com$/,
    /^https:\/\/.*\.headyconnection\.org$/,
    /^https:\/\/.*\.headymcp\.com$/,
]);

// ═══════════════════════════════════════════════════════════════════════
// PORT — Cloud Run sets PORT env var; 3301 for compat
// ═══════════════════════════════════════════════════════════════════════
const PORT = parseInt(optionalEnv('PORT', optionalEnv('HEADY_PORT', '3301')), 10);

// ═══════════════════════════════════════════════════════════════════════
// AUTH & API KEYS (required in production, optional in dev)
// ═══════════════════════════════════════════════════════════════════════
const AUTH = Object.freeze({
    HEADY_API_KEY: optionalEnv('HEADY_API_KEY', ''),
    ADMIN_TOKEN: optionalEnv('ADMIN_TOKEN', ''),
    GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID', ''),
    GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET', ''),
    GOOGLE_REDIRECT_URI: optionalEnv('GOOGLE_REDIRECT_URI', ''),
    CLOUDFLARE_API_TOKEN: optionalEnv('CLOUDFLARE_API_TOKEN', ''),
    CLOUDFLARE_ACCOUNT_ID: optionalEnv('CLOUDFLARE_ACCOUNT_ID', ''),
});

// ═══════════════════════════════════════════════════════════════════════
// AI PROVIDER KEYS
// ═══════════════════════════════════════════════════════════════════════
const PROVIDERS = Object.freeze({
    OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
    OPENAI_ORG_ID: optionalEnv('OPENAI_ORG_ID', ''),
    GOOGLE_API_KEY: optionalEnv('GOOGLE_API_KEY', ''),
    HF_TOKEN: optionalEnv('HF_TOKEN', ''),
    GROQ_API_KEY: optionalEnv('GROQ_API_KEY', ''),
    PERPLEXITY_API_KEY: optionalEnv('PERPLEXITY_API_KEY', ''),
    HEADY_COMPUTE_KEY: optionalEnv('HEADY_COMPUTE_KEY', ''),
    HEADY_PYTHIA_KEY: optionalEnv('HEADY_PYTHIA_KEY_HEADY', ''),
    HEADY_NEXUS_KEY: optionalEnv('HEADY_NEXUS_KEY', ''),
    HEADY_JULES_KEY: optionalEnv('HEADY_JULES_KEY', ''),
});

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION KEYS
// ═══════════════════════════════════════════════════════════════════════
const INTEGRATIONS = Object.freeze({
    NOTION_TOKEN: optionalEnv('NOTION_TOKEN', ''),
    GITHUB_TOKEN: optionalEnv('GITHUB_TOKEN', ''),
    STRIPE_SECRET_KEY: optionalEnv('STRIPE_SECRET_KEY', ''),
    STRIPE_WEBHOOK_SECRET: optionalEnv('STRIPE_WEBHOOK_SECRET', ''),
    DATABASE_URL: optionalEnv('DATABASE_URL', ''),
    WEB3_PRIVATE_KEY: optionalEnv('WEB3_PRIVATE_KEY', ''),
    WEB3_RPC_URL: optionalEnv('WEB3_RPC_URL', ''),
});

// ═══════════════════════════════════════════════════════════════════════
// GCP PROJECTS
// ═══════════════════════════════════════════════════════════════════════
const GCP = Object.freeze({
    PROJECT: optionalEnv('GOOGLE_CLOUD_PROJECT', 'gen-lang-client-0920560496'),
    PROJECTS: [
        { id: 'gen-lang-client-0920560496', number: '609590223909', note: '$230 credit' },
        { id: 'gen-lang-client-0132368016', number: '943575412643' },
        { id: 'gen-lang-client-0013466217', number: '957146169178' },
        { id: 'gen-lang-client-0964718246', number: '468416380409' },
    ],
});

// ═══════════════════════════════════════════════════════════════════════
// BUDGETS & LIMITS
// ═══════════════════════════════════════════════════════════════════════
const LIMITS = Object.freeze({
    DAILY_BUDGET: parseFloat(optionalEnv('HEADY_DAILY_BUDGET', '50')),
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    JSON_BODY_LIMIT: '5mb',
    CONTENT_FILTER: optionalEnv('HEADY_CONTENT_FILTER', 'standard'),
});

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION — Fail loud at startup if critical config is wrong
// ═══════════════════════════════════════════════════════════════════════
function validate() {
    const errors = [];

    // Check for localhost contamination in URLs
    for (const [key, url] of Object.entries(URLS)) {
        if (url && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)) {
            errors.push(`[CONFIG] URLS.${key} contains localhost reference: ${url}`);
        }
    }

    // Warn on missing critical keys in production
    if (IS_PRODUCTION) {
        if (!AUTH.HEADY_API_KEY) errors.push('[CONFIG] HEADY_API_KEY is required in production');
        if (!AUTH.ADMIN_TOKEN) errors.push('[CONFIG] ADMIN_TOKEN is required in production');
    }

    if (errors.length > 0) {
        const msg = `\n${'═'.repeat(60)}\n⚠️  CONFIG VALIDATION ERRORS (${errors.length}):\n${errors.map(e => `  • ${e}`).join('\n')}\n${'═'.repeat(60)}`;
        console.error(msg);
        // In production, these are fatal
        if (IS_PRODUCTION && errors.some(e => e.includes('FATAL'))) {
            process.exit(1);
        }
    }

    return errors;
}

// Run validation on import
const validationErrors = validate();

module.exports = Object.freeze({
    NODE_ENV,
    IS_PRODUCTION,
    LOG_LEVEL,
    PORT,
    URLS,
    DOMAINS,
    ALLOWED_ORIGINS,
    ALLOWED_ORIGIN_PATTERNS,
    AUTH,
    PROVIDERS,
    INTEGRATIONS,
    GCP,
    LIMITS,
    validationErrors,
    // Re-export helpers for edge cases
    requireEnv,
    optionalEnv,
});
