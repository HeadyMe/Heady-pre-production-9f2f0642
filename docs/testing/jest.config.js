/**
 * Heady™ Jest Configuration — 100% Core Orchestration Coverage
 * Drop into monorepo root: Heady-pre-production-9f2f0642/jest.config.js
 */

const PHI = 1.6180339887;

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.mjs'],
  
  // Coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov', 'html'],
  
  // Source files to measure
  collectCoverageFrom: [
    'src/orchestration/**/*.js',
    'src/resilience/**/*.js',
    'src/security/**/*.js',
    'src/bees/bee-factory.js',
    'src/bees/bee-factory-v2.js',
    'src/bees/registry.js',
    'src/bees/health-bee.js',
    'src/bees/security-bee.js',
    'src/bees/governance-bee.js',
    'packages/core/src/**/*.js',
    'packages/orchestrator/src/**/*.js',
    'packages/gateway/src/**/*.js',
    // Exclude type definitions
    '!**/*.d.ts',
    '!**/*.d.ts.map',
    '!**/node_modules/**',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    // Global minimum — must pass before pilot
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    
    // ===== CORE ORCHESTRATION: 100% =====
    './src/orchestration/heady-conductor.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/heady-conductor-v2.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/hc-full-pipeline.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/hc-full-pipeline-v2.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/swarm-consensus.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/swarm-consensus-v2.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/swarm-intelligence.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/self-awareness.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/monte-carlo-optimizer.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/task-decomposition-engine.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/orchestration/semantic-backpressure.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    
    // ===== CORE RESILIENCE: 100% =====
    './src/resilience/circuit-breaker.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/resilience/redis-pool.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/resilience/auto-heal.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/resilience/exponential-backoff.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    
    // ===== CORE SECURITY: 100% =====
    './src/security/secrets-manager.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/security/zero-trust-sanitizer.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/security/vector-native-scanner.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/security/secret-rotation.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
  },
  
  // Test organization by type
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testTimeout: Math.round(PHI * 5000), // ~8,090ms
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testTimeout: Math.round(PHI * PHI * 5000), // ~13,090ms
      globalSetup: '<rootDir>/tests/integration/setup.js',
      globalTeardown: '<rootDir>/tests/integration/teardown.js',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testTimeout: 60000, // 60s for full pipeline
    },
  ],
  
  // Reporter for CI
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
    }],
  ],
};
