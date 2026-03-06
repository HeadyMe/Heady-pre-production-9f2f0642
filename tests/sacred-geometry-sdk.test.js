/*
 * © 2026 Heady Systems LLC.
 * Tests for packages/heady-sacred-geometry-sdk
 */

const sdk = require('../packages/heady-sacred-geometry-sdk');

describe('Sacred Geometry SDK — Core Constants', () => {
    test('PHI is the golden ratio', () => {
        expect(sdk.PHI).toBeCloseTo(1.6180339887, 8);
    });

    test('PHI_INV is 1/PHI', () => {
        expect(sdk.PHI_INV).toBeCloseTo(1 / sdk.PHI, 8);
    });

    test('PHI_SQ is PHI squared', () => {
        expect(sdk.PHI_SQ).toBeCloseTo(sdk.PHI ** 2, 6);
    });

    test('PHI_CUBE is PHI cubed', () => {
        expect(sdk.PHI_CUBE).toBeCloseTo(sdk.PHI ** 3, 5);
    });

    test('BASE is 13', () => {
        expect(sdk.BASE).toBe(13);
    });

    test('LOG_BASE is 42', () => {
        expect(sdk.LOG_BASE).toBe(42);
    });

    test('FIB is a Fibonacci sequence array', () => {
        expect(Array.isArray(sdk.FIB)).toBe(true);
        expect(sdk.FIB.length).toBeGreaterThan(5);
        // Verify Fibonacci property: FIB[n] = FIB[n-1] + FIB[n-2]
        for (let i = 2; i < sdk.FIB.length; i++) {
            expect(sdk.FIB[i]).toBe(sdk.FIB[i - 1] + sdk.FIB[i - 2]);
        }
    });
});

describe('Sacred Geometry SDK — Principles Module', () => {
    test('phiScale returns phi-derived scale values', () => {
        expect(typeof sdk.phiScale).toBe('function');
        const scaled = sdk.phiScale(1);
        expect(typeof scaled).toBe('number');
        expect(scaled).toBeGreaterThan(0);
    });

    test('goldenSplit divides a value by the golden ratio', () => {
        expect(typeof sdk.goldenSplit).toBe('function');
        const [a, b] = sdk.goldenSplit(100);
        expect(a + b).toBeCloseTo(100, 5);
        expect(a / b).toBeCloseTo(sdk.PHI, 3);
    });

    test('toBase13 converts numbers to base-13', () => {
        expect(typeof sdk.toBase13).toBe('function');
        const result = sdk.toBase13(13);
        expect(result).toBe('10');
    });

    test('fromBase13 converts base-13 back to decimal', () => {
        expect(typeof sdk.fromBase13).toBe('function');
        expect(sdk.fromBase13('10')).toBe(13);
    });

    test('log42 returns logarithm base 42', () => {
        expect(typeof sdk.log42).toBe('function');
        const result = sdk.log42(42);
        expect(result).toBeCloseTo(1, 5);
    });
});

describe('Sacred Geometry SDK — Sub-Module Exports', () => {
    test('SpatialEmbedder class is exported', () => {
        expect(sdk.SpatialEmbedder).toBeDefined();
    });

    test('OctreeManager class is exported', () => {
        expect(sdk.OctreeManager).toBeDefined();
    });

    test('TemplateEngine class is exported', () => {
        expect(sdk.TemplateEngine).toBeDefined();
    });

    test('CapacityPlanner class is exported', () => {
        expect(sdk.CapacityPlanner).toBeDefined();
    });

    test('spatial module is accessible', () => {
        expect(sdk.spatial).toBeDefined();
        expect(typeof sdk.spatial).toBe('object');
    });

    test('octree module is accessible', () => {
        expect(sdk.octree).toBeDefined();
        expect(typeof sdk.octree).toBe('object');
    });
});

describe('Sacred Geometry SDK — Design Tokens', () => {
    test('designTokens returns an object', () => {
        expect(typeof sdk.designTokens).toBe('function');
        const tokens = sdk.designTokens();
        expect(typeof tokens).toBe('object');
    });

    test('phiTiming returns timing values', () => {
        expect(typeof sdk.phiTiming).toBe('function');
        const timing = sdk.phiTiming(1000);
        expect(typeof timing).toBe('number');
        expect(timing).toBeGreaterThan(0);
    });
});
