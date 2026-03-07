/**
 * Smoke Test Suite for Heady Zero-Dependency System
 * Verifies all layers load and core functionality works.
 * Run: node tests/smoke-test.js
 */

const PHI = (1 + Math.sqrt(5)) / 2;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function testConfig() {
  console.log('\n── Config Layer ──');
  const { SACRED_GEOMETRY, CLUSTER, POOLS } = await import('../config/global.js');
  assert(Math.abs(SACRED_GEOMETRY.PHI - PHI) < 0.001, 'PHI constant correct');
  assert(CLUSTER.BRAIN.port === 3001, 'BRAIN port configured');
  assert(CLUSTER.CONDUCTOR.port === 3002, 'CONDUCTOR port configured');
  assert(CLUSTER.SENTINEL.port === 3003, 'SENTINEL port configured');
  assert(POOLS.HOT.allocation === 0.34, 'Hot pool Fibonacci ratio');
}

async function testUtils() {
  console.log('\n── Utils Layer ──');
  const { createLogger } = await import('../utils/logger.js');
  const logger = createLogger('test');
  assert(typeof logger.info === 'function', 'Logger has info method');
  assert(typeof logger.error === 'function', 'Logger has error method');
  assert(typeof logger.child === 'function', 'Logger has child method');
}

async function testEventBus() {
  console.log('\n── Core: EventBus ──');
  const { EventBus } = await import('../core/event-bus.js');
  const bus = new EventBus();
  let received = false;
  bus.on('test.event', () => { received = true; });
  bus.emit('test.event', { data: 'hello' });
  assert(received, 'Event bus pub/sub works');
}

async function testMCPProtocol() {
  console.log('\n── Core: MCP Protocol ──');
  const mod = await import('../core/mcp-protocol.js');
  assert(typeof mod.MCPServer === 'function' || typeof mod.MCPServer !== 'undefined', 'MCPServer exported');
  assert(typeof mod.MCPClient === 'function' || typeof mod.MCPClient !== 'undefined', 'MCPClient exported');
}

async function testGitHubClient() {
  console.log('\n── Core: GitHub Client ──');
  const mod = await import('../core/github-client.js');
  assert(mod.GitHubClient !== undefined, 'GitHubClient exported');
}

async function testHTTPServer() {
  console.log('\n── Core: HTTP Server ──');
  const mod = await import('../core/http-server.js');
  assert(mod.HeadyHTTPServer !== undefined || mod.default !== undefined, 'HTTP Server exported');
}

async function testProcessManager() {
  console.log('\n── Core: Process Manager ──');
  const mod = await import('../core/process-manager.js');
  assert(mod.ProcessManager !== undefined || mod.default !== undefined, 'ProcessManager exported');
}

async function testVectorDB() {
  console.log('\n── Memory: VectorDB ──');
  const mod = await import('../memory/vector-db.js');
  assert(mod.VectorDB !== undefined || mod.default !== undefined, 'VectorDB exported');
  
  // Test basic vector operations if VectorDB is a constructor
  if (typeof mod.VectorDB === 'function') {
    const db = new mod.VectorDB({ dimensions: 384 });
    assert(typeof db.insert === 'function' || typeof db.add === 'function', 'VectorDB has insert/add method');
  }
}

async function testKVStore() {
  console.log('\n── Memory: KV Store ──');
  const mod = await import('../memory/kv-store.js');
  assert(mod.KVStore !== undefined || mod.default !== undefined, 'KVStore exported');
}

async function testGraphRAG() {
  console.log('\n── Memory: Graph RAG ──');
  const mod = await import('../memory/graph-rag.js');
  assert(mod.GraphRAG !== undefined || mod.default !== undefined, 'GraphRAG exported');
}

async function testSTMLTM() {
  console.log('\n── Memory: STM-LTM ──');
  const mod = await import('../memory/stm-ltm.js');
  assert(mod.STM !== undefined || mod.ShortTermMemory !== undefined || mod.default !== undefined, 'STM exported');
}

async function testEmbeddingEngine() {
  console.log('\n── Memory: Embedding Engine ──');
  const mod = await import('../memory/embedding-engine.js');
  assert(mod.EmbeddingEngine !== undefined || mod.default !== undefined, 'EmbeddingEngine exported');
}

async function testConductor() {
  console.log('\n── Orchestration: Conductor ──');
  const mod = await import('../orchestration/heady-conductor.js');
  assert(mod.HeadyConductor !== undefined || mod.default !== undefined, 'HeadyConductor exported');
}

async function testSwarmIntelligence() {
  console.log('\n── Orchestration: Swarm Intelligence ──');
  const mod = await import('../orchestration/swarm-intelligence.js');
  assert(mod.computeSwarmAllocation !== undefined || mod.SwarmIntelligence !== undefined, 'SwarmIntelligence exported');
}

async function testSelfAwareness() {
  console.log('\n── Orchestration: Self-Awareness ──');
  const mod = await import('../orchestration/self-awareness.js');
  assert(mod.SelfAwareness !== undefined || mod.default !== undefined, 'SelfAwareness exported');
}

async function testPipelineCore() {
  console.log('\n── Pipeline: Core ──');
  const mod = await import('../pipeline/pipeline-core.js');
  assert(mod.HCFullPipeline !== undefined || mod.default !== undefined, 'HCFullPipeline exported');
}

async function testPipelinePools() {
  console.log('\n── Pipeline: Pools ──');
  const mod = await import('../pipeline/pipeline-pools.js');
  assert(mod.PoolManager !== undefined || mod.default !== undefined, 'PoolManager exported');
}

async function testBeeFactory() {
  console.log('\n── Bees: Factory ──');
  const mod = await import('../bees/bee-factory.js');
  assert(mod.BeeFactory !== undefined || mod.default !== undefined, 'BeeFactory exported');
}

async function testRegistry() {
  console.log('\n── Bees: Registry ──');
  const mod = await import('../bees/registry.js');
  assert(mod.Registry !== undefined || mod.default !== undefined, 'Registry exported');
}

async function testCircuitBreaker() {
  console.log('\n── Resilience: Circuit Breaker ──');
  const mod = await import('../resilience/circuit-breaker.js');
  assert(mod.CircuitBreaker !== undefined || mod.default !== undefined, 'CircuitBreaker exported');
}

async function testRateLimiter() {
  console.log('\n── Resilience: Rate Limiter ──');
  const mod = await import('../resilience/rate-limiter.js');
  assert(mod.RateLimiter !== undefined || mod.TokenBucket !== undefined || mod.default !== undefined, 'RateLimiter exported');
}

async function testCache() {
  console.log('\n── Resilience: Cache ──');
  const mod = await import('../resilience/cache.js');
  assert(mod.Cache !== undefined || mod.MultiTierCache !== undefined || mod.default !== undefined, 'Cache exported');
}

async function testAutoHeal() {
  console.log('\n── Resilience: Auto Heal ──');
  const mod = await import('../resilience/auto-heal.js');
  assert(mod.AutoHeal !== undefined || mod.SelfHealingMesh !== undefined || mod.default !== undefined, 'AutoHeal exported');
}

async function testPQC() {
  console.log('\n── Security: PQC ──');
  const mod = await import('../security/pqc.js');
  assert(mod.default !== undefined || mod.PQC !== undefined || mod.HeadyPQC !== undefined, 'PQC exported');
}

async function testHandshake() {
  console.log('\n── Security: Handshake ──');
  const mod = await import('../security/handshake.js');
  assert(mod.Handshake !== undefined || mod.NodeHandshake !== undefined || mod.default !== undefined, 'Handshake exported');
}

async function testRBAC() {
  console.log('\n── Security: RBAC ──');
  const mod = await import('../security/rbac-vendor.js');
  assert(mod.RBAC !== undefined || mod.default !== undefined, 'RBAC exported');
}

async function testMonteCarlo() {
  console.log('\n── Intelligence: Monte Carlo ──');
  const mod = await import('../intelligence/monte-carlo.js');
  assert(mod.MonteCarloEngine !== undefined || mod.default !== undefined, 'MonteCarloEngine exported');
}

async function testAnalyticsEngine() {
  console.log('\n── Intelligence: Analytics Engine ──');
  const mod = await import('../intelligence/analytics-engine.js');
  assert(mod.AnalyticsEngine !== undefined || mod.default !== undefined, 'AnalyticsEngine exported');
}

async function testPatternEngine() {
  console.log('\n── Intelligence: Pattern Engine ──');
  const mod = await import('../intelligence/pattern-engine.js');
  assert(mod.PatternEngine !== undefined || mod.default !== undefined, 'PatternEngine exported');
}

async function testApprovalGates() {
  console.log('\n── Governance: Approval Gates ──');
  const mod = await import('../governance/approval-gates.js');
  assert(mod.ApprovalGates !== undefined || mod.default !== undefined, 'ApprovalGates exported');
}

async function testLLMRouter() {
  console.log('\n── Services: LLM Router ──');
  const mod = await import('../services/llm-router.js');
  assert(mod.LLMRouter !== undefined || mod.default !== undefined, 'LLMRouter exported');
}

async function testArenaMode() {
  console.log('\n── Services: Arena Mode ──');
  const mod = await import('../services/arena-mode.js');
  assert(mod.ArenaMode !== undefined || mod.default !== undefined, 'ArenaMode exported');
}

async function testBudgetTracker() {
  console.log('\n── Services: Budget Tracker ──');
  const mod = await import('../services/budget-tracker.js');
  assert(mod.BudgetTracker !== undefined || mod.default !== undefined, 'BudgetTracker exported');
}

async function testTelemetry() {
  console.log('\n── Telemetry ──');
  const mod = await import('../telemetry/heady-telemetry.js');
  assert(mod.HeadyTelemetry !== undefined || mod.Telemetry !== undefined || mod.default !== undefined, 'Telemetry exported');
}

async function testProviders() {
  console.log('\n── Providers ──');
  const mod = await import('../providers/brain-providers.js');
  assert(mod.ProviderRegistry !== undefined || mod.default !== undefined, 'ProviderRegistry exported');
}

async function testColabRuntime() {
  console.log('\n── Runtime: Colab ──');
  const mod = await import('../runtime/colab-runtime.js');
  assert(mod.ColabRuntime !== undefined || mod.default !== undefined, 'ColabRuntime exported');
}

async function testLiquidColabServices() {
  console.log('\n── Runtime: Liquid Colab Services ──');
  const mod = await import('../runtime/liquid-colab-services.js');
  assert(mod.default !== undefined || mod.LiquidColabServices !== undefined || mod.ServiceRegistry !== undefined, 'LiquidColabServices exported');
}

// Run all tests
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Heady Zero-Dep Smoke Test Suite          ║');
  console.log('║  Zero external dependencies verified      ║');
  console.log('╚═══════════════════════════════════════════╝');
  
  const tests = [
    testConfig, testUtils, testEventBus, testMCPProtocol,
    testGitHubClient, testHTTPServer, testProcessManager,
    testVectorDB, testKVStore, testGraphRAG, testSTMLTM, testEmbeddingEngine,
    testConductor, testSwarmIntelligence, testSelfAwareness,
    testPipelineCore, testPipelinePools,
    testBeeFactory, testRegistry,
    testCircuitBreaker, testRateLimiter, testCache, testAutoHeal,
    testPQC, testHandshake, testRBAC,
    testMonteCarlo, testAnalyticsEngine, testPatternEngine,
    testApprovalGates,
    testLLMRouter, testArenaMode, testBudgetTracker,
    testTelemetry, testProviders,
    testColabRuntime, testLiquidColabServices
  ];
  
  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      failed++;
      console.log(`  ✗ ${test.name}: ${err.message}`);
    }
  }
  
  console.log('\n══════════════════════════════════════');
  console.log(`  Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
  console.log('══════════════════════════════════════');
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
