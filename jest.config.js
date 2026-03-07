// Jest configuration for HeadySystems™
// Coverage thresholds use phi-based dynamic scaling instead of fixed values
// φ = 1.618033988749895 (golden ratio)

const PHI = 1.618033988749895;
const PHI_INV = 1 / PHI; // 0.618033988749895

/**
 * PhiThreshold: Generates coverage thresholds using golden ratio relationships
 * instead of arbitrary fixed values like 80, 90, 100.
 *
 * Tier 1 (Critical):  100 * (1 / PHI^0) = 100    — orchestration, core
 * Tier 2 (Important): 100 * (1 / PHI^0.25) ≈ 89  — MCP, services  
 * Tier 3 (Standard):  100 * (1 / PHI^0.5) ≈ 78.6 — global baseline
 * Tier 4 (Emerging):  100 * (1 / PHI^1) ≈ 61.8   — experimental modules
 *
 * These values are NOT fixed — they self-adjust based on the phi exponent,
 * creating a continuous spectrum rather than discrete 80/90/100 buckets.
 */
function phiThreshold(exponent = 0) {
    return Math.round(100 * Math.pow(PHI_INV, exponent) * 10) / 10;
}

function phiCoverageTier(exponent) {
    const t = phiThreshold(exponent);
    return { branches: t, functions: t, lines: t, statements: t };
}

// Timeout scales with phi: base * phi^tier
// Standard: 10000 * φ^1 ≈ 16180ms (vs arbitrary 30000)
// Extended: 10000 * φ^2 ≈ 26180ms for integration tests
const PHI_TIMEOUT_BASE = 10000;
const testTimeout = Math.round(PHI_TIMEOUT_BASE * PHI);

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.test.{js,ts}',
        '**/tests/**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
    ],
    collectCoverageFrom: [
        'src/orchestration/**/*.{js,ts}',
        'src/mcp/**/*.{js,ts}',
        'src/services/**/*.{js,ts}',
        'src/core/**/*.{js,ts}',
        'src/routing/**/*.{js,ts}',
        'src/projection/**/*.{js,ts}',
        'src/memory/**/*.{js,ts}',
        'src/resilience/**/*.{js,ts}',
        'src/scripting/**/*.{js,ts}',
        'src/vsa/**/*.{js,ts}',
        'src/compute/**/*.{js,ts}',
        'src/intelligence/**/*.{js,ts}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/_archive/**',
    ],
    coverageThreshold: {
        // Tier 1 — Critical path (φ^0 = 100%)
        'src/orchestration/': phiCoverageTier(0),
        'src/core/': phiCoverageTier(0),

        // Tier 2 — Important infrastructure (φ^0.25 ≈ 89%)
        'src/mcp/': phiCoverageTier(0.25),
        'src/routing/': phiCoverageTier(0.25),
        'src/scripting/': phiCoverageTier(0.25),

        // Tier 3 — Standard modules (φ^0.5 ≈ 78.6%)
        'src/services/': phiCoverageTier(0.5),
        'src/resilience/': phiCoverageTier(0.5),
        'src/memory/': phiCoverageTier(0.5),

        // Tier 4 — Emerging / experimental (φ^1 ≈ 61.8%)
        'src/vsa/': phiCoverageTier(1),
        'src/compute/': phiCoverageTier(1),
        'src/intelligence/': phiCoverageTier(1),

        // Global baseline — phi equilibrium (φ^0.5 ≈ 78.6%)
        global: phiCoverageTier(0.5),
    },
    coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
    coverageDirectory: 'coverage',
    verbose: true,
    testTimeout,
    setupFilesAfterEnv: [],  // Add setup files here when needed
    moduleNameMapper: {
        '^@heady/core$': '<rootDir>/packages/core/src',
        '^@heady/gateway$': '<rootDir>/packages/gateway/src',
        '^@heady/sdk$': '<rootDir>/packages/sdk/src',
    },
    // Enable ts-jest when TypeScript tests are added:
    // transform: { '^.+\\.ts$': 'ts-jest' },
};
