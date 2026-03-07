/**
 * Heady™ Environment Schema Validator
 * 
 * Validates all required environment variables at boot time.
 * Fails fast if critical config is missing — never start with half-valid state.
 * 
 * Usage:
 *   const { validateEnvironment } = require('./src/config/env-schema');
 *   validateEnvironment(); // throws if critical vars missing
 */

const ENV_SCHEMA = {
    // ── Critical (app won't function without these) ──
    critical: [
        { name: 'DATABASE_URL', description: 'Neon Postgres connection string' },
        { name: 'HEADY_API_KEY', description: 'Internal API gateway auth' },
    ],

    // ── Required for full functionality ──
    required: [
        { name: 'PERPLEXITY_API_KEY', description: 'Perplexity Sonar Pro' },
        { name: 'GEMINI_API_KEY', description: 'Google Gemini' },
        { name: 'GITHUB_TOKEN', description: 'GitHub API' },
        { name: 'CLOUDFLARE_API_TOKEN', description: 'Cloudflare API' },
        { name: 'SENTRY_DSN', description: 'Sentry error tracking' },
    ],

    // ── Optional (degraded functionality if missing) ──
    optional: [
        { name: 'GROQ_API_KEY', description: 'Groq fast inference' },
        { name: 'OPENAI_API_KEY', description: 'OpenAI GPT-4o' },
        { name: 'CLAUDE_API_KEY', description: 'Anthropic Claude' },
        { name: 'ANTHROPIC_ADMIN_KEY', description: 'Anthropic admin' },
        { name: 'HF_TOKEN', description: 'Hugging Face' },
        { name: 'PINECONE_API_KEY', description: 'Pinecone vectors' },
        { name: 'STRIPE_SECRET_KEY', description: 'Stripe payments' },
        { name: 'NEON_API_KEY', description: 'Neon management' },
        { name: 'UPSTASH_REDIS_REST_URL', description: 'Upstash cache URL' },
        { name: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash cache token' },
        { name: 'OP_SERVICE_ACCOUNT_TOKEN', description: '1Password SA' },
        { name: 'ADMIN_TOKEN', description: 'Admin access token' },
    ],
};

/**
 * Validate environment variables at boot time.
 * @param {object} options
 * @param {boolean} options.strict - If true, fail on missing required vars too
 * @param {boolean} options.silent - If true, don't log warnings
 * @returns {{ valid: boolean, missing: object, warnings: string[] }}
 */
function validateEnvironment(options = {}) {
    const { strict = false, silent = false } = options;
    const missing = { critical: [], required: [], optional: [] };
    const warnings = [];

    // Check critical vars — always fail
    for (const v of ENV_SCHEMA.critical) {
        if (!process.env[v.name]) {
            missing.critical.push(v);
        }
    }

    // Check required vars
    for (const v of ENV_SCHEMA.required) {
        if (!process.env[v.name]) {
            missing.required.push(v);
            if (!silent) warnings.push(`⚠ Missing required: ${v.name} (${v.description})`);
        }
    }

    // Check optional vars
    for (const v of ENV_SCHEMA.optional) {
        if (!process.env[v.name]) {
            missing.optional.push(v);
        }
    }

    // Fail hard on critical
    if (missing.critical.length > 0) {
        const names = missing.critical.map(v => `  - ${v.name}: ${v.description}`).join('\n');
        throw new Error(
            `❌ FATAL: Missing critical environment variables:\n${names}\n\n` +
            `Set these in .env (local), GitHub Secrets (CI), or GCP Secret Manager (prod).`
        );
    }

    // Fail on required in strict mode
    if (strict && missing.required.length > 0) {
        const names = missing.required.map(v => `  - ${v.name}: ${v.description}`).join('\n');
        throw new Error(
            `❌ Missing required environment variables (strict mode):\n${names}`
        );
    }

    // Log warnings
    if (!silent && warnings.length > 0) {
        console.warn(`\n🔧 Environment Validation (${warnings.length} warnings):`);
        warnings.forEach(w => console.warn(`  ${w}`));
        console.warn('');
    }

    const total = ENV_SCHEMA.critical.length + ENV_SCHEMA.required.length + ENV_SCHEMA.optional.length;
    const set = total - missing.critical.length - missing.required.length - missing.optional.length;

    if (!silent) {
        console.log(`✅ Environment: ${set}/${total} vars set (${missing.optional.length} optional missing)`);
    }

    return {
        valid: missing.critical.length === 0,
        missing,
        warnings,
        stats: { total, set, criticalMissing: missing.critical.length },
    };
}

module.exports = { validateEnvironment, ENV_SCHEMA };
