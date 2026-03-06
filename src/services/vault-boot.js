/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Vault Boot — Dynamic Credential Projection ═══
 *
 * On boot:
 *   1. Unlocks the SecureKeyVault with VAULT_PASSPHRASE
 *   2. Retrieves all stored credentials from encrypted vector memory
 *   3. Projects them into process.env for dynamic runtime use
 *   4. Credentials live in RAM only — never written to disk
 *
 * Projection API (registered on Express app):
 *   GET  /api/vault/project  → shows masked credentials
 *   POST /api/vault/project  → shows full credentials (requires passphrase)
 *   GET  /api/vault/health   → vault status
 */

const logger = require('../utils/logger');

// ── ENV VAR mapping for each vault credential ──────────────────
const CREDENTIAL_ENV_MAP = {
    // GitHub
    'github-pat-primary': 'GITHUB_TOKEN',
    'github-pat-secondary': 'GITHUB_TOKEN_SECONDARY',
    // Claude / Anthropic
    'claude-api-key': 'ANTHROPIC_API_KEY',
    'claude-code-oauth': 'CLAUDE_CODE_OAUTH_TOKEN',
    'claude-admin-key': 'ANTHROPIC_ADMIN_KEY',
    'claude-dev-admin': 'ANTHROPIC_ADMIN_KEY_DEV',
    'claude-org-id': 'ANTHROPIC_ORG_ID',
    // OpenAI
    'openai-api-key': 'OPENAI_API_KEY',
    // Hugging Face
    'hf-token': 'HF_TOKEN',
    // Groq
    'groq-api-key': 'GROQ_API_KEY',
    // Cloudflare
    'cf-api-token-primary': 'CLOUDFLARE_API_TOKEN',
    'cf-api-token-secondary': 'CLOUDFLARE_API_TOKEN_2',
    'cf-api-token-tertiary': 'CLOUDFLARE_API_TOKEN_3',
    // Sentry
    'sentry-org-token': 'SENTRY_AUTH_TOKEN',
    'sentry-personal-token': 'SENTRY_PERSONAL_TOKEN',
    'sentry-dsn': 'SENTRY_DSN',
    // Neon
    'neon-api-key': 'NEON_API_KEY',
    'neon-database-url': 'DATABASE_URL',
    // Upstash
    'upstash-db-id': 'UPSTASH_REDIS_REST_TOKEN',
    // Pinecone
    'pinecone-api-key': 'PINECONE_API_KEY',
    // Stripe
    'stripe-secret-key': 'STRIPE_SECRET_KEY',
    // 1Password
    'onepassword-service-account': 'OP_SERVICE_ACCOUNT_TOKEN',
    // Google AI
    'gai-headyme-colab': 'GEMINI_API_KEY',
    'gai-heady-project': 'GEMINI_API_KEY_HEADY',
    'gai-gcloud-default': 'GCLOUD_API_KEY',
    'gai-firebase': 'FIREBASE_API_KEY',
    // Perplexity
    'perplexity-api-key': 'PERPLEXITY_API_KEY',
    // Domain URLs (projected from vector space at runtime)
    'heady-url-main':           'HEADY_URL',
    'heady-url-api':            'HEADY_MANAGER_URL',
    'heady-url-brain':          'HEADY_BRAIN_URL',
    'heady-url-edge':           'HEADY_EDGE_URL',
    'heady-url-mcp':            'HEADY_MCP_URL',
    'heady-url-bot':            'HEADY_BOT_URL',
    'heady-url-os':             'HEADY_OS_URL',
    'heady-url-buddy':          'HEADY_BUDDY_URL',
    'heady-url-systems':        'HEADY_SYSTEMS_URL',
    'heady-url-connection':     'HEADY_CONNECTION_URL',
    'heady-url-cloudrun':       'HEADY_CLOUDRUN_URL',
};

/**
 * Boot the vault: unlock, retrieve all credentials, project into process.env.
 * Call this EARLY in the app bootstrap (before any service needs API keys).
 */
async function bootVault() {
    const passphrase = process.env.VAULT_PASSPHRASE;
    if (!passphrase) {
        logger.logError('VAULT', 'VAULT_PASSPHRASE not set — credentials will not be available');
        return { ok: false, projected: 0, reason: 'No passphrase' };
    }

    try {
        const { vault } = require('./secure-key-vault');
        await vault.unlock(passphrase);

        let projected = 0;
        const projectedKeys = [];

        for (const [credName, envVar] of Object.entries(CREDENTIAL_ENV_MAP)) {
            try {
                const domain = _domainFromName(credName);
                const value = await vault.get(credName, domain);
                if (value) {
                    process.env[envVar] = value;
                    projected++;
                    projectedKeys.push(envVar);
                }
            } catch (e) {
                // Credential not found in vault — skip silently
            }
        }

        logger.logSystem(`  🔐 Vault Boot: ${projected} credentials projected into process.env`);
        return { ok: true, projected, keys: projectedKeys };
    } catch (err) {
        logger.logError('VAULT', `Boot failed: ${err.message}`, err);
        return { ok: false, projected: 0, reason: err.message };
    }
}

/**
 * Derive domain from credential name prefix.
 */
function _domainFromName(name) {
    const prefixMap = {
        'github': 'github', 'claude': 'claude', 'openai': 'openai',
        'hf': 'huggingface', 'groq': 'groq', 'cf': 'cloudflare',
        'sentry': 'sentry', 'neon': 'neon', 'upstash': 'upstash',
        'pinecone': 'pinecone', 'stripe': 'stripe', 'onepassword': 'onepassword',
        'gai': 'googleai', 'heady': 'heady', 'perplexity': 'perplexity',
    };
    for (const [prefix, domain] of Object.entries(prefixMap)) {
        if (name.startsWith(prefix)) return domain;
    }
    return 'custom';
}

/**
 * Mask a credential value for safe display.
 */
function _mask(value) {
    if (!value || value.length < 8) return '****';
    return value.substring(0, 4) + '…' + value.substring(value.length - 4);
}

/**
 * Register vault projection routes on Express app.
 * Lets the user view credentials on demand.
 */
function registerVaultProjectionRoutes(app) {
    // GET /api/vault/project — masked projection (safe to view)
    app.get('/api/vault/project', (req, res) => {
        const projection = {};
        for (const [credName, envVar] of Object.entries(CREDENTIAL_ENV_MAP)) {
            const val = process.env[envVar];
            projection[envVar] = {
                credential: credName,
                domain: _domainFromName(credName),
                status: val ? 'active' : 'missing',
                value: val ? _mask(val) : null,
            };
        }
        res.json({
            ok: true, service: 'vault-projection',
            mode: 'masked', credentialCount: Object.keys(projection).length,
            projection, timestamp: new Date().toISOString(),
        });
    });

    // POST /api/vault/project — full credential projection (requires passphrase in body)
    app.post('/api/vault/project', (req, res) => {
        const { passphrase } = req.body;
        if (passphrase !== process.env.VAULT_PASSPHRASE) {
            return res.status(403).json({ ok: false, error: 'Invalid passphrase' });
        }

        const projection = {};
        for (const [credName, envVar] of Object.entries(CREDENTIAL_ENV_MAP)) {
            const val = process.env[envVar];
            projection[envVar] = {
                credential: credName,
                domain: _domainFromName(credName),
                status: val ? 'active' : 'missing',
                value: val || null,
            };
        }
        res.json({
            ok: true, service: 'vault-projection',
            mode: 'full', credentialCount: Object.keys(projection).length,
            projection, timestamp: new Date().toISOString(),
        });
    });

    // GET /api/vault/health — vault status
    app.get('/api/vault/health', (req, res) => {
        const active = Object.values(CREDENTIAL_ENV_MAP).filter(k => !!process.env[k]).length;
        const total = Object.keys(CREDENTIAL_ENV_MAP).length;
        res.json({
            ok: true, service: 'vault-boot',
            credentialsActive: active, credentialsTotal: total,
            coverage: `${Math.round(active / total * 100)}%`,
            timestamp: new Date().toISOString(),
        });
    });

    logger.logSystem('  🔐 Vault Projection: LIVE → /api/vault/project, /health');
}

module.exports = { bootVault, registerVaultProjectionRoutes, CREDENTIAL_ENV_MAP };
