/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * JIT Secrets Manager — fetches credentials on-demand, never in LLM context.
 * Supports 1Password CLI (`op run`), env vars, and direct injection.
 */

'use strict';

const { execSync } = require('child_process');
const logger = require('../utils/logger');

/** Secrets NEVER persist in memory longer than one request cycle */
const SECRET_ACCESS_LOG = [];

/**
 * List of patterns that should NEVER appear in LLM context or logs.
 */
const SCRUB_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g,          // OpenAI keys
    /sk-ant-[a-zA-Z0-9-]{40,}/g,     // Anthropic keys
    /AIza[a-zA-Z0-9_-]{35}/g,        // Google API keys
    /gsk_[a-zA-Z0-9]{40,}/g,         // Groq keys
    /Bearer\s+[a-zA-Z0-9._-]{20,}/g, // Bearer tokens
    /ghp_[a-zA-Z0-9]{36,}/g,         // GitHub PATs
    /npm_[a-zA-Z0-9]{36,}/g,         // npm tokens
];

/**
 * Scrub secrets from a string, replacing with [REDACTED].
 */
function scrubSecrets(text) {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    for (const pattern of SCRUB_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Get a secret from environment, never returning it to LLM context.
 * @param {string} key - Environment variable name
 * @returns {string|null} The secret value, or null if not found
 */
function getSecret(key) {
    const value = process.env[key] || null;
    logAccess(key, value ? 'found' : 'not-found');
    return value;
}

/**
 * Run a command with 1Password secrets injection.
 * Secrets are injected into the child process environment only.
 * @param {string} command - The command to run
 * @param {string} envFile - Path to .env file with op:// references
 * @returns {string} Command output with secrets scrubbed
 */
function runWithSecrets(command, envFile) {
    try {
        const result = execSync(`op run --env-file="${envFile}" -- ${command}`, {
            env: { ...process.env, OP_ACCOUNT: process.env.OP_ACCOUNT || 'headysystems.1password.com' },
            encoding: 'utf8',
            timeout: 30000,
        });
        logAccess('op-run', 'success');
        return scrubSecrets(result);
    } catch (err) {
        logAccess('op-run', 'failed');
        logger.error('[SecretsManager] op run failed', { error: scrubSecrets(err.message) });
        throw new Error(`Secrets injection failed: ${scrubSecrets(err.message)}`);
    }
}

/**
 * Inject secrets into a config object, replacing ${VAR} references.
 * Returns a new object — original is NOT modified.
 */
function injectSecrets(config) {
    if (typeof config === 'string') {
        return config.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
            const val = getSecret(key);
            return val || `\${${key}}`;
        });
    }
    if (Array.isArray(config)) return config.map(v => injectSecrets(v));
    if (config && typeof config === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(config)) {
            result[k] = injectSecrets(v);
        }
        return result;
    }
    return config;
}

/**
 * Validate that required secrets are present in environment.
 */
function validateSecrets(requiredKeys) {
    const missing = [];
    const found = [];
    for (const key of requiredKeys) {
        if (process.env[key]) {
            found.push(key);
        } else {
            missing.push(key);
        }
    }
    return { valid: missing.length === 0, found, missing, total: requiredKeys.length };
}

/**
 * Get secrets rotation status based on the secrets manifest.
 */
function checkRotationStatus(manifest) {
    const now = Date.now();
    const results = [];
    for (const secret of (manifest.secrets || [])) {
        const rotatedAt = new Date(secret.rotatedAt).getTime();
        const ageMs = now - rotatedAt;
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        const maxDays = secret.maxAgeDays || 90;
        results.push({
            name: secret.name, ageDays, maxDays,
            status: ageDays > maxDays ? 'expired' : ageDays > maxDays * 0.8 ? 'expiring-soon' : 'ok',
            rotationUrl: secret.rotationUrl,
        });
    }
    return results;
}

/**
 * Log access to a secret (for audit trail, never logs the value).
 */
function logAccess(key, result) {
    const entry = { key, result, timestamp: new Date().toISOString(), caller: new Error().stack?.split('\n')[3]?.trim() };
    SECRET_ACCESS_LOG.push(entry);
    if (SECRET_ACCESS_LOG.length > 1000) SECRET_ACCESS_LOG.splice(0, 500); // Keep bounded
}

/**
 * Get the audit trail of secret accesses.
 */
function getAuditTrail(limit = 50) {
    return SECRET_ACCESS_LOG.slice(-limit);
}

module.exports = {
    getSecret, runWithSecrets, scrubSecrets, injectSecrets,
    validateSecrets, checkRotationStatus, getAuditTrail,
    SCRUB_PATTERNS,
};
