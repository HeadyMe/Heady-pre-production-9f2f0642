/**
 * Heady™ Enterprise Test Suite — Environment Validation
 * PR 6: Unit tests for the env-schema validator
 */

const { validateEnvironment, ENV_SCHEMA } = require('../../src/config/env-schema');

describe('Environment Schema Validator', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should pass when all critical vars are set', () => {
        process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
        process.env.HEADY_API_KEY = 'test-key';
        const result = validateEnvironment({ silent: true });
        expect(result.valid).toBe(true);
        expect(result.missing.critical).toHaveLength(0);
    });

    test('should throw when critical vars are missing', () => {
        delete process.env.DATABASE_URL;
        delete process.env.HEADY_API_KEY;
        expect(() => validateEnvironment({ silent: true })).toThrow('Missing critical environment variables');
    });

    test('should throw on DATABASE_URL missing', () => {
        delete process.env.DATABASE_URL;
        process.env.HEADY_API_KEY = 'test-key';
        expect(() => validateEnvironment({ silent: true })).toThrow('DATABASE_URL');
    });

    test('should warn on missing required vars but not throw', () => {
        process.env.DATABASE_URL = 'postgresql://test';
        process.env.HEADY_API_KEY = 'test-key';
        const result = validateEnvironment({ silent: true });
        expect(result.valid).toBe(true);
        expect(result.missing.required.length).toBeGreaterThan(0);
    });

    test('should throw in strict mode when required vars missing', () => {
        process.env.DATABASE_URL = 'postgresql://test';
        process.env.HEADY_API_KEY = 'test-key';
        // Required vars not set
        expect(() => validateEnvironment({ strict: true, silent: true })).toThrow('strict mode');
    });

    test('should report stats correctly', () => {
        process.env.DATABASE_URL = 'postgresql://test';
        process.env.HEADY_API_KEY = 'test-key';
        process.env.PERPLEXITY_API_KEY = 'test';
        process.env.GEMINI_API_KEY = 'test';
        process.env.GITHUB_TOKEN = 'test';
        process.env.CLOUDFLARE_API_TOKEN = 'test';
        process.env.SENTRY_DSN = 'test';
        const result = validateEnvironment({ silent: true });
        expect(result.stats.total).toBe(
            ENV_SCHEMA.critical.length + ENV_SCHEMA.required.length + ENV_SCHEMA.optional.length
        );
        expect(result.stats.set).toBeGreaterThanOrEqual(7);
    });

    test('schema should have required structure', () => {
        expect(ENV_SCHEMA).toHaveProperty('critical');
        expect(ENV_SCHEMA).toHaveProperty('required');
        expect(ENV_SCHEMA).toHaveProperty('optional');
        expect(Array.isArray(ENV_SCHEMA.critical)).toBe(true);
        ENV_SCHEMA.critical.forEach(v => {
            expect(v).toHaveProperty('name');
            expect(v).toHaveProperty('description');
        });
    });
});
