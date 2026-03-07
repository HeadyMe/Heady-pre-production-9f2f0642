/**
 * HeadySystems™ — Blueprint Schema Validator
 * Phase 1 Tool-to-Platform: Typed schema validation for blueprint payloads.
 *
 * Validates: projection blueprints, agent definitions, workflow specs,
 * and MCP tool schemas against strict type contracts.
 *
 * @module blueprint-validator
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// Schema Definitions
// ═══════════════════════════════════════════════════════════════════

const SCHEMAS = {
    projection: {
        required: ['id', 'coordinates', 'type'],
        properties: {
            id: { type: 'string', pattern: /^proj-[a-z0-9-]+$/ },
            coordinates: { type: 'object', properties: { x: 'number', y: 'number', z: 'number' } },
            type: { type: 'string', enum: ['agent', 'anchor', 'widget', 'service'] },
            ttl: { type: 'number', min: 0 },
            metadata: { type: 'object' },
        },
    },

    agent: {
        required: ['id', 'skills', 'maxLoad'],
        properties: {
            id: { type: 'string', pattern: /^agent-[a-z0-9-]+$/ },
            skills: { type: 'array', items: 'string', minLength: 1 },
            maxLoad: { type: 'number', min: 0.1, max: 10.0 },
            status: { type: 'string', enum: ['idle', 'busy', 'overloaded', 'offline'] },
        },
    },

    workflow: {
        required: ['id', 'steps'],
        properties: {
            id: { type: 'string' },
            steps: { type: 'array', minLength: 1 },
            compensable: { type: 'boolean' },
            timeout: { type: 'number', min: 1000 },
        },
    },

    mcpTool: {
        required: ['name', 'description', 'inputSchema'],
        properties: {
            name: { type: 'string', pattern: /^[a-z][a-z0-9_]+$/ },
            description: { type: 'string' },
            inputSchema: { type: 'object' },
            handler: { type: 'function' },
        },
    },
};

// ═══════════════════════════════════════════════════════════════════
// Validator
// ═══════════════════════════════════════════════════════════════════

class BlueprintValidator {
    constructor() {
        this.schemas = new Map(Object.entries(SCHEMAS));
        this.validationCache = new Map();
    }

    validate(schemaName, payload) {
        const schema = this.schemas.get(schemaName);
        if (!schema) return { valid: false, errors: [`Unknown schema: ${schemaName}`] };

        const errors = [];

        // Required fields
        for (const field of schema.required || []) {
            if (payload[field] === undefined || payload[field] === null) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Type checks
        for (const [field, rules] of Object.entries(schema.properties || {})) {
            if (payload[field] === undefined) continue;
            const value = payload[field];

            if (rules.type === 'array') {
                if (!Array.isArray(value)) errors.push(`${field} must be an array`);
                else if (rules.minLength && value.length < rules.minLength) errors.push(`${field} must have at least ${rules.minLength} items`);
            } else if (rules.type && typeof value !== rules.type) {
                errors.push(`${field} must be type ${rules.type}, got ${typeof value}`);
            }

            if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
                errors.push(`${field} does not match pattern ${rules.pattern}`);
            }

            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }

            if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
                errors.push(`${field} must be >= ${rules.min}`);
            }

            if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
                errors.push(`${field} must be <= ${rules.max}`);
            }

            // Nested object validation
            if (rules.type === 'object' && rules.properties && typeof value === 'object') {
                for (const [subField, expectedType] of Object.entries(rules.properties)) {
                    if (value[subField] !== undefined && typeof value[subField] !== expectedType) {
                        errors.push(`${field}.${subField} must be type ${expectedType}`);
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    addSchema(name, schema) {
        this.schemas.set(name, schema);
    }

    validateBatch(schemaName, payloads) {
        return payloads.map((payload, index) => {
            const result = this.validate(schemaName, payload);
            return { index, ...result };
        });
    }

    // Idempotent auth check (Phase 2)
    validateAuth(token) {
        if (!token || typeof token !== 'string') return { valid: false, errors: ['Token required'] };
        if (token.split('.').length !== 3) return { valid: false, errors: ['Invalid JWT format'] };

        // Idempotent: same token always produces same result
        const cacheKey = `auth:${token.substring(0, 20)}`;
        if (this.validationCache.has(cacheKey)) return this.validationCache.get(cacheKey);

        const result = { valid: true, errors: [], idempotent: true };
        this.validationCache.set(cacheKey, result);
        return result;
    }
}

module.exports = { BlueprintValidator, SCHEMAS };
