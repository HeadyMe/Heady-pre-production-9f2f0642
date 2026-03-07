# Heady™ 100% Test Coverage Plan — Core Orchestration Logic

> Priority: IMMEDIATE | Prerequisite for: Public Pilot + >80% Readiness
> Scope: All modules in src/orchestration/, src/resilience/, src/security/ marked ✅ CORE

---

## 1. Current State

### Existing Test Files (60+)

| Test File | Module Covered | Type |
|-----------|---------------|------|
| hc-full-pipeline.test.js | HCFullPipeline | Unit |
| buddy-core.test.js | BuddyCore | Unit |
| circuit-breaker.test.js | CircuitBreaker | Unit |
| swarm-intelligence.test.js | SwarmIntelligence | Unit |
| self-awareness.test.js | SelfAwareness | Unit |
| sacred-geometry-sdk.test.js | Sacred Geometry SDK | Unit |
| vector-memory.test.js | Vector Memory | Unit |
| resilience.test.js | Resilience index | Unit |
| exponential-backoff.test.js | PHI Backoff | Unit |
| heady-conductor-lifecycle.test.js | Conductor Lifecycle | Integration |
| hc-pipeline-circuit-breaker.test.js | Pipeline + CB | Integration |
| self-healing-pipeline.test.js | Self-Healing | Integration |

### Coverage Gaps (Critical Modules Without Tests)

| Module | File | Priority | Gap |
|--------|------|----------|-----|
| **HeadyConductor v2** | heady-conductor-v2.js | ✅ CRITICAL | No dedicated tests |
| **SwarmConsensus v2** | swarm-consensus-v2.js | ✅ CRITICAL | No v2 tests |
| **MonteCarloOptimizer** | monte-carlo-optimizer.js | ✅ CRITICAL | No tests |
| **TaskDecomposition** | task-decomposition-engine.js | ✅ CRITICAL | No tests |
| **SemanticBackpressure** | semantic-backpressure.js | ✅ CRITICAL | No tests |
| **ContextWindowManager** | context-window-manager.js | HIGH | No tests |
| **SocraticLoop** | socratic-execution-loop.js | HIGH | No tests |
| **SecretRotation** | secret-rotation.js | HIGH | No tests |
| **ZeroTrustSanitizer** | zero-trust-sanitizer.js | HIGH | No tests |
| **VectorNativeScanner** | vector-native-scanner.js | HIGH | No tests |
| **QuarantineManager** | quarantine-manager.js | HIGH | No tests |
| **RespawnController** | respawn-controller.js | HIGH | No tests |
| **DriftDetector** | drift-detector.js | HIGH | No tests |
| **RedisPool** | redis-pool.js | HIGH | No tests |
| **SelfCorrection** | self-correction-loop.js | MEDIUM | No tests |
| **17SwarmOrchestrator** | seventeen-swarm-orchestrator.js | MEDIUM | No tests |
| **ContinuousConductor** | continuous-conductor.js | MEDIUM | No tests |
| **BeeFactory v2** | bee-factory-v2.js | MEDIUM | No v2 tests |

---

## 2. Test Strategy

### 2.1 Test Pyramid

```
         ╱╲         E2E Tests (5%)
        ╱  ╲        - Full pipeline execution
       ╱    ╲       - Multi-agent grant-writing flow
      ╱──────╲
     ╱        ╲     Integration Tests (25%)
    ╱          ╲    - Conductor + Swarm + Redis
   ╱            ╲   - Pipeline + Circuit Breaker
  ╱──────────────╲
 ╱                ╲  Unit Tests (70%)
╱                  ╲ - Each module in isolation
╱────────────────────╲ - Mocked dependencies
```

### 2.2 Coverage Targets

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Line Coverage | ≥80% (all), 100% core | CI gate |
| Branch Coverage | ≥80% (all), 100% core | CI gate |
| Function Coverage | 100% (core modules) | CI gate |
| Statement Coverage | ≥80% (all) | CI gate |

### 2.3 Core Module Definition

Modules that MUST have 100% coverage before public pilot:

```javascript
// jest.config.js — core coverage thresholds
module.exports = {
  coverageThreshold: {
    // Global minimum
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // 100% on core orchestration
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
    // Core resilience
    './src/resilience/circuit-breaker.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/resilience/redis-pool.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/resilience/auto-heal.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    // Core security
    './src/security/secrets-manager.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/security/zero-trust-sanitizer.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
  },
};
```

---

## 3. Test Specifications per Module

### 3.1 HeadyConductor v2 — Test Plan

File: `tests/unit/heady-conductor-v2.test.js`

| Test Case | Category | Description |
|-----------|----------|-------------|
| constructor | Init | Creates conductor with default PHI config |
| routeTask-basic | Routing | Routes simple task to correct agent |
| routeTask-csl-scoring | Routing | CSL score > 0.8 routes to best match |
| routeTask-fallback | Routing | Falls back when primary agent unavailable |
| routeTask-circuit-open | Error | Returns error when circuit breaker open |
| registerAgent | Registry | Agent registers with capabilities |
| deregisterAgent | Registry | Agent deregisters cleanly |
| healthCheck | Health | Returns full health status |
| shutdown | Lifecycle | Graceful shutdown with LIFO cleanup |
| concurrent-routing | Stress | 100 concurrent routes resolve correctly |
| phi-timing | Config | All intervals are PHI-derived |

### 3.2 SwarmConsensus v2 — Test Plan

File: `tests/unit/swarm-consensus-v2.test.js`

| Test Case | Category | Description |
|-----------|----------|-------------|
| propose | Consensus | Agent proposes a result |
| vote-majority | Consensus | Majority vote accepted |
| vote-tie | Consensus | Tie broken by CSL score |
| vote-timeout | Consensus | Timeout triggers fallback |
| quorum-check | Consensus | Minimum quorum enforced (Fibonacci: 3) |
| reject-malformed | Validation | Rejects invalid proposals |
| two-key-gate | Validation | HeadyCheck + HeadyAssure both required |
| concurrent-proposals | Stress | Multiple proposals resolve correctly |

### 3.3 MonteCarloOptimizer — Test Plan

File: `tests/unit/monte-carlo-optimizer.test.js`

| Test Case | Category | Description |
|-----------|----------|-------------|
| ucb1-selection | Algorithm | UCB1 selects best arm correctly |
| exploration-exploitation | Algorithm | Balances explore vs exploit |
| convergence | Algorithm | Converges to optimal after N iterations |
| plan-ranking | Integration | Ranks execution plans by score |
| deterministic-seed | Reproducibility | Same seed → same results |
| phi-scaled-iterations | Config | Iteration count is Fibonacci |

### 3.4 TaskDecomposition — Test Plan

File: `tests/unit/task-decomposition-engine.test.js`

| Test Case | Category | Description |
|-----------|----------|-------------|
| decompose-simple | Core | Single task returns 1 subtask |
| decompose-complex | Core | Multi-step task returns DAG |
| dependency-ordering | DAG | Topological sort correct |
| cycle-detection | DAG | Circular deps rejected |
| csl-capability-match | Routing | Subtasks scored against 17 swarms |
| parallel-execution | Execution | Independent subtasks run parallel |
| progress-tracking | Observability | Progress updated per subtask |

### 3.5 SemanticBackpressure — Test Plan

File: `tests/unit/semantic-backpressure.test.js`

| Test Case | Category | Description |
|-----------|----------|-------------|
| accept-normal | Throttle | Normal load accepted |
| throttle-high | Throttle | High load triggers adaptive throttle |
| shed-critical | LoadShed | Critical overload sheds low-priority |
| dedup-cosine | Dedup | Duplicate requests detected by cosine sim |
| priority-scoring | Priority | PHI-weighted priority correct |
| circuit-breaker-trip | Integration | Trips when error threshold exceeded |
| backpressure-signal | Integration | Upstream notified of pressure |
| recovery | Recovery | Resumes after pressure drops |

---

## 4. Integration Test Suites

### 4.1 Pipeline Integration

File: `tests/integration/full-pipeline.test.js`

```javascript
describe('HCFullPipeline Integration', () => {
  // Requires: Redis, PostgreSQL (via Docker in CI)
  
  test('executes 12-stage pipeline end-to-end');
  test('checkpoint and rollback on stage failure');
  test('circuit breaker trips on external service failure');
  test('self-healing recovers from transient errors');
  test('telemetry events emitted for all stages');
  test('PHI-scaled timeouts applied per stage');
});
```

### 4.2 Swarm Integration

File: `tests/integration/swarm-coordination.test.js`

```javascript
describe('Swarm Coordination', () => {
  test('conductor routes to swarm, swarm reaches consensus');
  test('agent handoff via Redis completes in <50ms');
  test('quarantine manager isolates failing agent');
  test('respawn controller replaces quarantined agent');
  test('drift detector flags semantic drift >0.25');
});
```

### 4.3 Security Integration

File: `tests/integration/security-flow.test.js`

```javascript
describe('Security Flow', () => {
  test('zero-trust sanitizer blocks localhost in config');
  test('rate limiter enforces Fibonacci tier limits');
  test('env validator rejects missing required vars');
  test('secret rotation completes without downtime');
  test('vector-native scanner detects injection patterns');
});
```

---

## 5. E2E Test: Grant-Writing Flow

File: `tests/e2e/grant-writing.test.js`

```javascript
describe('Grant Writing E2E', () => {
  test('full grant proposal generation', async () => {
    // 1. Submit grant request
    const task = await submitTask({
      type: 'grant-proposal',
      topic: 'Youth STEM Education',
      org: 'HeadyConnection',
    });
    
    // 2. Verify task decomposed into subtasks
    expect(task.subtasks.length).toBeGreaterThanOrEqual(3);
    
    // 3. Verify research phase completed
    const research = task.subtasks.find(s => s.type === 'research');
    expect(research.status).toBe('completed');
    
    // 4. Verify analysis phase
    const analysis = task.subtasks.find(s => s.type === 'analysis');
    expect(analysis.status).toBe('completed');
    
    // 5. Verify generation phase
    const generation = task.subtasks.find(s => s.type === 'generation');
    expect(generation.status).toBe('completed');
    
    // 6. Verify two-key validation
    expect(task.validation.headyCheck).toBe('approved');
    expect(task.validation.headyAssure).toBe('approved');
    
    // 7. Verify output
    expect(task.output.format).toBe('docx');
    expect(task.output.sections).toContain('executive_summary');
    expect(task.output.sections).toContain('budget');
    expect(task.output.sections).toContain('methodology');
  }, 60000); // 60s timeout for full pipeline
});
```

---

## 6. Jest Configuration

File: `jest.config.js` (additions for monorepo)

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.mjs'],
  
  // Coverage
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov', 'html'],
  
  // Coverage thresholds (see Section 2.3 above)
  coverageThreshold: { /* ... as defined above ... */ },
  
  // Collect from all source files
  collectCoverageFrom: [
    'src/orchestration/**/*.js',
    'src/resilience/**/*.js',
    'src/security/**/*.js',
    'src/bees/**/*.js',
    'packages/*/src/**/*.js',
    '!**/*.d.ts',
    '!**/*.d.ts.map',
    '!**/node_modules/**',
    '!**/v2/**', // Exclude v2 until migration complete
  ],
  
  // Test organization
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/integration/setup.js',
      globalTeardown: '<rootDir>/tests/integration/teardown.js',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testTimeout: 60000,
    },
  ],
  
  // PHI-scaled test timeout
  testTimeout: Math.round(1.618 * 5000), // ~8,090ms per test
};
```

---

## 7. Execution Order

| Phase | Tests to Write | Estimated Files |
|-------|---------------|-----------------|
| Phase 1 | HeadyConductor v2, HCFullPipeline v2 | 2 files |
| Phase 2 | SwarmConsensus v2, SwarmIntelligence | 2 files |
| Phase 3 | MonteCarloOptimizer, TaskDecomposition | 2 files |
| Phase 4 | SemanticBackpressure, CircuitBreaker v2 | 2 files |
| Phase 5 | RedisPool, AutoHeal, SelfAwareness | 3 files |
| Phase 6 | Security (Secrets, ZeroTrust, Scanner) | 3 files |
| Phase 7 | Integration suites (Pipeline, Swarm, Security) | 3 files |
| Phase 8 | E2E grant-writing flow | 1 file |
| **Total** | | **18 new test files** |
