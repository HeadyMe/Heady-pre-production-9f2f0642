/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Environment Variable Validator
 * Fail-safe validation at startup — prevents silent config failures.
 * Uses a lightweight schema approach (no external deps required).
 *
 * Usage:
 *   const { validateEnv } = require('./security/env-validator');
 *   validateEnv(); // throws on missing required vars
 */

'use strict';
const logger = require("../utils/logger");

const ENV_SCHEMA = {
    // ── Required for ALL environments ──
    required: [
        { key: 'NODE_ENV', description: 'Runtime environment', allowed: ['development', 'production', 'test', 'staging'] },
    ],

    // ── Required for PRODUCTION only ──
    production: [
        { key: 'DATABASE_URL', description: 'Primary database connection string', sensitive: true },
        { key: 'HEADY_API_SECRET', description: 'Internal API authentication secret', sensitive: true },
    ],

    // ── Optional but validated if present ──
    optional: [
        { key: 'PORT', description: 'Server port', default: '3000', validate: (v) => !isNaN(v) && parseInt(v) > 0 },
        { key: 'LOG_LEVEL', description: 'Logging verbosity', allowed: ['debug', 'info', 'warn', 'error'] },
        { key: 'HEADY_BRAIN_URL', description: 'HeadyBrain API endpoint', validate: (v) => v.startsWith('http') },
        { key: 'HEADY_MANAGER_URL', description: 'HeadyManager API endpoint', validate: (v) => v.startsWith('http') },
    ],

    // ── SENSITIVE — must never appear in logs ──
    sensitive_patterns: [
        /api[-_]?key/i,
        /secret/i,
        /password/i,
        /token/i,
        /credential/i,
        /private[-_]?key/i,
    ],
};

/**
 * Validates environment variables against the schema.
 * @param {object} options
 * @param {boolean} options.exitOnError - Exit process on validation failure (default: true in production)
 * @param {boolean} options.logSensitive - Log sensitive var names without values (default: false)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateEnv(options = {}) {
    const env = process.env;
    const isProd = env.NODE_ENV === 'production';
    const exitOnError = options.exitOnError ?? isProd;
    const errors = [];
    const warnings = [];

    // Check required vars
    for (const spec of ENV_SCHEMA.required) {
        if (!env[spec.key]) {
            errors.push(`❌ Missing required: ${spec.key} — ${spec.description}`);
        } else if (spec.allowed && !spec.allowed.includes(env[spec.key])) {
            errors.push(`❌ Invalid ${spec.key}="${env[spec.key]}" — allowed: ${spec.allowed.join(', ')}`);
        }
    }

    // Check production-only vars
    if (isProd) {
        for (const spec of ENV_SCHEMA.production) {
            if (!env[spec.key]) {
                errors.push(`❌ Missing (production): ${spec.key} — ${spec.description}`);
            }
        }
    }

    // Validate optional vars if present
    for (const spec of ENV_SCHEMA.optional) {
        if (env[spec.key]) {
            if (spec.allowed && !spec.allowed.includes(env[spec.key])) {
                warnings.push(`⚠️ Invalid ${spec.key}="${env[spec.key]}" — allowed: ${spec.allowed.join(', ')}`);
            }
            if (spec.validate && !spec.validate(env[spec.key])) {
                warnings.push(`⚠️ ${spec.key} failed validation`);
            }
        } else if (spec.default) {
            process.env[spec.key] = spec.default;
        }
    }

    // Detect sensitive vars that might be placeholder/example values
    const suspiciousPatterns = ['changeme', 'your-', 'xxx', 'placeholder', 'example', 'todo'];
    for (const [key, value] of Object.entries(env)) {
        const isSensitive = ENV_SCHEMA.sensitive_patterns.some(p => p.test(key));
        if (isSensitive && value) {
            for (const sus of suspiciousPatterns) {
                if (value.toLowerCase().includes(sus)) {
                    warnings.push(`⚠️ ${key} appears to contain a placeholder value — rotate before production`);
                    break;
                }
            }
        }
    }

    // Report
    const valid = errors.length === 0;

    if (errors.length > 0) {
        logger.error('\n🔴 Environment Validation FAILED:');
        errors.forEach(e => logger.error(`  ${e}`));
    }

    if (warnings.length > 0) {
        logger.warn('\n🟡 Environment Warnings:');
        warnings.forEach(w => logger.warn(`  ${w}`));
    }

    if (valid) {
        logger.logSystem('✅ Environment validation passed');
    }

    if (!valid && exitOnError) {
        logger.error('\n💀 Refusing to start with invalid environment. Fix the above errors.\n');
        process.exit(1);
    }

    return { valid, errors, warnings };
}

/**
 * Masks sensitive environment variables for safe logging.
 * @returns {object} Env vars with sensitive values replaced by '***'
 */
function getSafeEnvDump() {
    const safe = {};
    for (const [key, value] of Object.entries(process.env)) {
        const isSensitive = ENV_SCHEMA.sensitive_patterns.some(p => p.test(key));
        safe[key] = isSensitive ? '***' : value;
    }
    return safe;
}

module.exports = { validateEnv, getSafeEnvDump, ENV_SCHEMA };
