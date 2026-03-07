/*
 * © 2026 HeadySystems Inc..
 * Tests for src/self-awareness.js
 */

const {
    ingestTelemetry,
    assessSystemState,
    getBrandingReport,
    getSystemIntrospection,
} = require('../src/self-awareness');

describe('Self-Awareness — Telemetry Ingestion', () => {
    test('ingestTelemetry accepts a valid event', () => {
        expect(() => {
            ingestTelemetry({
                type: 'test_event',
                summary: 'Unit test telemetry event',
                data: { test: true },
                severity: 'info',
            });
        }).not.toThrow();
    });

    test('ingestTelemetry handles error severity', () => {
        expect(() => {
            ingestTelemetry({
                type: 'api_error',
                summary: 'Simulated API failure',
                data: { code: 500 },
                severity: 'error',
            });
        }).not.toThrow();
    });
});

describe('Self-Awareness — System Assessment', () => {
    test('assessSystemState returns confidence and context', () => {
        const assessment = assessSystemState('unit test context');
        expect(assessment).toBeDefined();
        expect(typeof assessment.confidence).toBe('number');
        expect(assessment.confidence).toBeGreaterThanOrEqual(0);
        expect(assessment.confidence).toBeLessThanOrEqual(1);
        expect(typeof assessment.contextString).toBe('string');
        expect(Array.isArray(assessment.recentErrors)).toBe(true);
        expect(Array.isArray(assessment.recommendations)).toBe(true);
    });

    test('assessSystemState works without context argument', () => {
        const assessment = assessSystemState();
        expect(assessment).toBeDefined();
        expect(typeof assessment.confidence).toBe('number');
    });
});

describe('Self-Awareness — Branding Report', () => {
    test('getBrandingReport returns a report object', () => {
        const report = getBrandingReport();
        expect(report).toBeDefined();
        expect(typeof report).toBe('object');
    });
});

describe('Self-Awareness — System Introspection', () => {
    test('getSystemIntrospection returns full introspection', () => {
        const introspection = getSystemIntrospection();
        expect(introspection).toBeDefined();
        expect(typeof introspection).toBe('object');
    });
});
