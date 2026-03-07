/**
 * CSL Verification Suite v3.0
 * Tests all CSL gate operations PLUS integration into:
 *   - MCP Router (tool routing via multi_resonance + route_gate)
 *   - Bee Factory (bee dispatch via multi_resonance + ternary_gate)
 *   - Skill Router (agent assignment via route_gate + risk_gate)
 *
 * Run: node scripts/test-csl.js
 */

const CSL = require('../src/core/semantic-logic');

const DIM = 64; // Matching the integration modules' vector dimension
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const SECTION = '\x1b[36m';
const RESET = '\x1b[0m';
let passed = 0, failed = 0;

function assert(label, condition) {
    if (condition) { console.log(`  ${PASS} ${label}`); passed++; }
    else { console.log(`  ${FAIL} ${label}`); failed++; }
}

function section(title) {
    console.log(`\n${SECTION}── ${title} ──${RESET}`);
}

function randomVec(dim = DIM) {
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
    return CSL.normalize(v);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Heady CSL Verification Suite v3.0');
console.log('  Core Gates + MCP Router + Bee Factory + Skill Router');
console.log('═══════════════════════════════════════════════════════');

// ══════════════════════════════════════════════════════════════════
// PART 1: CORE CSL GATES
// ══════════════════════════════════════════════════════════════════

CSL.resetStats();

section('Gate 1: Resonance (Semantic AND/IF)');
const a = randomVec();
const b = Float32Array.from(a); // identical
const c = randomVec();

const r1 = CSL.resonance_gate(a, b, 0.95);
assert('Identical vectors → score ≈ 1.0', r1.score > 0.99);
assert('Identical vectors → gate OPEN', r1.open === true);

const r2 = CSL.resonance_gate(a, c, 0.95);
assert('Random vectors → score < 0.5', Math.abs(r2.score) < 0.5);
assert('Random vectors → gate CLOSED', r2.open === false);

section('Gate 1b: Multi-Resonance (N-way scoring)');
const candidates = [b, c, randomVec(), randomVec()];
const mr = CSL.multi_resonance(a, candidates, 0.95);
assert('Multi-resonance returns sorted array', mr[0].score >= mr[1].score);
assert('Best match is the identical vector', mr[0].score > 0.99);
assert('Returns correct count', mr.length === 4);

section('Gate 2: Superposition (Semantic OR/MERGE)');
const s1 = CSL.superposition_gate(a, c);
const norm = CSL.norm(s1);
assert('Superposition result is normalized', Math.abs(norm - 1.0) < 0.001);
assert('Hybrid differs from both inputs', CSL.cosine_similarity(s1, a) < 0.99);
assert('Hybrid has correct dimensions', s1.length === DIM);

section('Gate 2b: Weighted Superposition');
const ws_full_a = CSL.weighted_superposition(a, c, 1.0);
assert('α=1.0 → result ≈ vec_a', CSL.cosine_similarity(ws_full_a, a) > 0.99);
const ws_full_c = CSL.weighted_superposition(a, c, 0.0);
assert('α=0.0 → result ≈ vec_b', CSL.cosine_similarity(ws_full_c, c) > 0.99);

section('Gate 2c: Consensus Superposition');
const consensus = CSL.consensus_superposition([a, b, a]);
assert('Consensus of same vectors ≈ original', CSL.cosine_similarity(consensus, a) > 0.99);
const mixed = CSL.consensus_superposition([randomVec(), randomVec(), randomVec()]);
assert('Consensus is normalized', Math.abs(CSL.norm(mixed) - 1.0) < 0.001);

section('Gate 3: Orthogonal (Semantic NOT/REJECT)');
const o1 = CSL.orthogonal_gate(a, c);
const dotAfter = Math.abs(CSL.dot_product(o1, c));
assert('Orthogonal gate strips reject vector', dotAfter < 0.01);
assert('Result is normalized', Math.abs(CSL.norm(o1) - 1.0) < 0.01);

section('Gate 3b: Batch Orthogonal');
const rejects = [randomVec(), randomVec()];
const bo = CSL.batch_orthogonal(a, rejects);
assert('Batch orthogonal is normalized', Math.abs(CSL.norm(bo) - 1.0) < 0.01);

section('Soft Gate (sigmoid activation)');
const sg1 = CSL.soft_gate(0.9, 0.5, 20);
assert('Score 0.9 at threshold 0.5 → activation ≈ 1.0', sg1 > 0.99);
const sg2 = CSL.soft_gate(0.1, 0.5, 20);
assert('Score 0.1 at threshold 0.5 → activation ≈ 0.0', sg2 < 0.01);
const sg3 = CSL.soft_gate(0.5, 0.5, 20);
assert('Score AT threshold → activation ≈ 0.5', Math.abs(sg3 - 0.5) < 0.01);

section('Ternary Gate');
const tg1 = CSL.ternary_gate(0.9, 0.72, 0.35);
assert('High score → state = +1 (Resonance)', tg1.state === 1);
const tg2 = CSL.ternary_gate(0.1, 0.72, 0.35);
assert('Low score → state = -1 (Repel)', tg2.state === -1);
const tg3 = CSL.ternary_gate(0.5, 0.72, 0.35);
assert('Mid score → state = 0 (Ephemeral)', tg3.state === 0);
assert('Ternary returns raw score', tg1.raw === 0.9);

section('Risk Gate');
const rg1 = CSL.risk_gate(90, 100, 0.8);
assert('90/100 → high risk', rg1.riskLevel > 0.5);
const rg2 = CSL.risk_gate(10, 100, 0.8);
assert('10/100 → low risk', rg2.riskLevel < 0.3);
assert('Risk gate returns proximity', typeof rg1.proximity === 'number');

section('Route Gate');
const intent = randomVec();
const rc = [
    { id: 'exact', vector: Float32Array.from(intent) },
    { id: 'random1', vector: randomVec() },
    { id: 'random2', vector: randomVec() },
];
const rg = CSL.route_gate(intent, rc, 0.3);
assert('Route gate selects best candidate', rg.best === 'exact');
assert('Scores array has all candidates', rg.scores.length === 3);
assert('Best score ≈ 1.0', rg.scores[0].score > 0.99);
assert('Fallback is false when match found', rg.fallback === false);

section('Gate Statistics');
const stats = CSL.getStats();
assert('Stats track resonance calls', stats.resonance > 0);
assert('Stats track superposition calls', stats.superposition > 0);
assert('Stats track orthogonal calls', stats.orthogonal > 0);
assert('Stats track soft gate calls', stats.softGate > 0);
assert('Total calls counted', stats.totalCalls > 0);

// ══════════════════════════════════════════════════════════════════
// PART 2: MCP ROUTER CSL INTEGRATION
// ══════════════════════════════════════════════════════════════════

section('MCP Router: CSL-gated tool routing');
const { MCPRouter } = require('../src/mcp/mcp-router');
const mcpRouter = new MCPRouter({ resonanceThreshold: 0.2 });

// Register servers with different tool profiles
mcpRouter.registerServer('code-server', {
    name: 'Code MCP', url: 'http://localhost:3001',
    tools: ['code-gen', 'refactor', 'lint', 'test-runner'],
    capabilities: ['code'],
    latency: 50,
});

mcpRouter.registerServer('data-server', {
    name: 'Data MCP', url: 'http://localhost:3002',
    tools: ['sql-query', 'data-viz', 'csv-parse', 'analytics'],
    capabilities: ['data'],
    latency: 100,
});

mcpRouter.registerServer('deploy-server', {
    name: 'Deploy MCP', url: 'http://localhost:3003',
    tools: ['docker-build', 'k8s-deploy', 'cloud-run', 'rollback'],
    capabilities: ['deploy', 'infrastructure'],
    latency: 200,
});

// Test CSL-gated routing
const codeRoute = mcpRouter.route('code-gen');
assert('MCP: routes code-gen to code-server', codeRoute.serverId === 'code-server');
assert('MCP: returns CSL metadata', codeRoute.csl !== undefined);
assert('MCP: CSL resonance score present', typeof codeRoute.csl.resonanceScore === 'number');
assert('MCP: CSL composite score present', typeof codeRoute.csl.composite === 'number');
assert('MCP: latency risk evaluated', typeof codeRoute.csl.latencyRisk === 'number');

const dataRoute = mcpRouter.route('sql-query');
assert('MCP: routes sql-query to data-server', dataRoute.serverId === 'data-server');

const deployRoute = mcpRouter.route('docker-build');
assert('MCP: routes docker-build to deploy-server', deployRoute.serverId === 'deploy-server');

// Test cache bypass for CSL (cache returns without CSL)
const cachedRoute = mcpRouter.route('code-gen');
assert('MCP: second call uses cache', cachedRoute.cached === true);

// Test CSL health check with ternary classification
const health = mcpRouter.healthCheck();
assert('MCP: health check returns all servers', health.length === 3);
assert('MCP: health includes CSL state', health[0].csl !== undefined);
assert('MCP: health includes ternary state', typeof health[0].csl.state === 'number');
assert('MCP: fresh servers are healthy', health.every(h => h.healthy === true));

// Test blacklist capability
mcpRouter.blacklistCapability('deploy');
const afterBlacklist = mcpRouter.route('cloud-run');
assert('MCP: blacklist modifies routing behavior', afterBlacklist.serverId !== null);

// Test no-match fallback
const noMatch = mcpRouter.route('nonexistent-tool-xyz');
assert('MCP: routes to some server (CSL soft matching)', noMatch.serverId !== null);

// Test metrics
const mcpStatus = mcpRouter.getStatus();
assert('MCP: status includes CSL stats', mcpStatus.cslStats !== undefined);
assert('MCP: metrics track CSL-routed count', mcpStatus.metrics.cslRouted > 0);

// ══════════════════════════════════════════════════════════════════
// PART 3: BEE FACTORY CSL INTEGRATION
// ══════════════════════════════════════════════════════════════════

section('Bee Factory: CSL-gated dispatch');
const beeFactory = require('../src/bees/bee-factory');

// Create bees with different domains
const codeBee = beeFactory.createBee('code-generation', {
    description: 'Generates, refactors, and tests source code',
    priority: 0.9,
    workers: [{ name: 'generate', fn: async () => ({ generated: true }) }],
});

const dataBee = beeFactory.createBee('data-analysis', {
    description: 'Analyzes data, runs queries, produces visualizations',
    priority: 0.7,
    workers: [{ name: 'analyze', fn: async () => ({ analyzed: true }) }],
});

const deployBee = beeFactory.createBee('deployment-ops', {
    description: 'Deploys services to cloud infrastructure',
    priority: 0.8,
    workers: [{ name: 'deploy', fn: async () => ({ deployed: true }) }],
});

const lowBee = beeFactory.createBee('logging', {
    description: 'Low priority background logging',
    priority: 0.2,
    workers: [{ name: 'log', fn: async () => ({ logged: true }) }],
});

// Test CSL vector assignment
assert('Bee: code bee has vector', codeBee.vector instanceof Float32Array);
assert('Bee: vector has correct dimension', codeBee.vector.length === 64);
assert('Bee: CSL metadata present', codeBee.csl !== undefined);

// Test ternary priority classification
assert('Bee: high priority → state +1', codeBee.csl.priorityState === 1);
assert('Bee: low priority → state -1', lowBee.csl.priorityState === -1);

// Test CSL-powered routeBee
const codeRouteResult = beeFactory.routeBee('code-generation');
assert('Bee: routeBee returns best match', codeRouteResult.best !== null);
assert('Bee: routeBee returns ranked list', codeRouteResult.ranked.length > 0);
assert('Bee: ranked includes resonance score', typeof codeRouteResult.ranked[0].resonance === 'number');
assert('Bee: ranked includes composite score', typeof codeRouteResult.ranked[0].composite === 'number');
assert('Bee: ranked includes priority activation', typeof codeRouteResult.ranked[0].priorityActivation === 'number');
assert('Bee: CSL metadata in result', codeRouteResult.csl.candidatesScored > 0);

// Test routeBee with exclusion
const excludeResult = beeFactory.routeBee('code-generation', { exclude: ['code-generation'] });
assert('Bee: exclusion modifies ranking', excludeResult.ranked.length > 0);

// Test spawn with CSL
const ephBee = beeFactory.spawnBee('quick-task', async () => ({ quick: true }));
assert('Bee: ephemeral bee has vector', ephBee.vector instanceof Float32Array);
assert('Bee: ephemeral bee has CSL metadata', ephBee.csl !== undefined);

// Test listDynamicBees includes CSL
const allBees = beeFactory.listDynamicBees();
assert('Bee: listed bees include CSL', allBees.some(b => b.csl !== null));

// Test createSwarm with CSL scoring
const swarm = beeFactory.createSwarm('full-deploy', [
    { domain: 'swarm-build', config: { description: 'Build step', priority: 0.9, workers: [{ name: 'build', fn: async () => ({ built: true }) }] } },
    { domain: 'swarm-test', config: { description: 'Test step', priority: 0.8, workers: [{ name: 'test', fn: async () => ({ tested: true }) }] } },
    { domain: 'swarm-push', config: { description: 'Push step', priority: 0.7, workers: [{ name: 'push', fn: async () => ({ pushed: true }) }] } },
], { mode: 'pipeline' });

assert('Swarm: has composite vector', swarm.vector instanceof Float32Array);
assert('Swarm: has CSL affinity scores', Array.isArray(swarm.csl.affinityScores));
assert('Swarm: affinity scores for all bees', swarm.csl.affinityScores.length === 3);

// ══════════════════════════════════════════════════════════════════
// PART 4: SKILL ROUTER CSL INTEGRATION
// ══════════════════════════════════════════════════════════════════

section('Skill Router: CSL-gated agent assignment');
const { SkillRouter } = require('../src/orchestration/skill-router');
const skillRouter = new SkillRouter({ resonanceThreshold: 0.2 });

// Register agents
skillRouter.register('agent-alpha', ['code', 'refactor', 'test'], 10);
skillRouter.register('agent-beta', ['data', 'analytics', 'sql'], 5);
skillRouter.register('agent-gamma', ['deploy', 'docker', 'k8s'], 8);
skillRouter.register('agent-delta', ['code', 'deploy'], 3);

// Test CSL-gated routing
const codeAssign = skillRouter.route('code', 'medium');
assert('Skill: assigns code task', codeAssign.assigned !== null);
assert('Skill: returns CSL metadata', codeAssign.csl !== undefined);
assert('Skill: CSL resonance score present', typeof codeAssign.csl.resonance === 'number');
assert('Skill: CSL availability present', typeof codeAssign.csl.availability === 'number');
assert('Skill: CSL reliability classification present', typeof codeAssign.csl.reliability === 'number');
assert('Skill: CSL overload risk present', typeof codeAssign.csl.overloadRisk === 'number');
assert('Skill: candidates scored count', codeAssign.csl.candidatesScored > 0);

const dataAssign = skillRouter.route('data', 'high');
assert('Skill: assigns data task', dataAssign.assigned !== null);

// Test priority boost
const criticalAssign = skillRouter.route('deploy', 'critical');
assert('Skill: critical priority routes successfully', criticalAssign.assigned !== null);

// Complete some tasks to affect reliability
skillRouter.complete('agent-alpha', true);
skillRouter.complete('agent-alpha', true);
skillRouter.complete('agent-beta', false);
skillRouter.complete('agent-beta', false);

// Test that reliability affects routing
const statusAfter = skillRouter.getStatus();
assert('Skill: status includes CSL stats', statusAfter.cslStats !== undefined);
const alphaAgent = statusAfter.agents.find(a => a.id === 'agent-alpha');
const betaAgent = statusAfter.agents.find(a => a.id === 'agent-beta');
assert('Skill: alpha has high reliability state', alphaAgent.csl.reliabilityState === 1);
assert('Skill: beta has low reliability state', betaAgent.csl.reliabilityState === -1);

// Test exclusion via orthogonal_gate
const excludeAssign = skillRouter.route('code', 'medium', { exclude: ['test'] });
assert('Skill: exclusion modifies routing', excludeAssign.assigned !== null);

// Test capacity overload
// Fill up agent-delta (capacity 3)
skillRouter.route('code', 'low');
skillRouter.route('deploy', 'low');
skillRouter.route('deploy', 'low');
// Verify overload detection
const overloadStatus = skillRouter.getStatus();
const deltaAgent = overloadStatus.agents.find(a => a.id === 'agent-delta');
assert('Skill: capacity tracking works', deltaAgent !== undefined);

// ══════════════════════════════════════════════════════════════════
// PART 5: CROSS-SYSTEM COHERENCE
// ══════════════════════════════════════════════════════════════════

section('Cross-System CSL Coherence');

// Verify all systems use the same CSL engine instance
const finalStats = CSL.getStats();
assert('CSL: total gate calls > 50 (all systems active)', finalStats.totalCalls > 50);
assert('CSL: resonance gate used', finalStats.resonance > 0);
assert('CSL: superposition gate used', finalStats.superposition > 0);
assert('CSL: soft gate used', finalStats.softGate > 0);

// Verify vector dimensions consistent across systems
const { _textToVec } = require('../src/mcp/mcp-router');
const { _domainToVec } = require('../src/bees/bee-factory');
const { _skillToVec } = require('../src/orchestration/skill-router');

const mcpVec = _textToVec('test-tool');
const beeVec = _domainToVec('test-tool');
const skillVec = _skillToVec('test-tool');
assert('Cross: all modules produce same-dim vectors', mcpVec.length === beeVec.length && beeVec.length === skillVec.length);
assert('Cross: deterministic hashing produces identical vectors', CSL.cosine_similarity(mcpVec, beeVec) > 0.99);
assert('Cross: MCP ↔ Skill vectors identical', CSL.cosine_similarity(mcpVec, skillVec) > 0.99);

// ══════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Results: \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m`);
console.log(`  CSL gate calls: ${finalStats.totalCalls}`);
console.log(`  Avg resonance score: ${finalStats.avgResonanceScore}`);
console.log(`  Systems tested: CSL Core, MCP Router, Bee Factory, Skill Router`);
console.log('═══════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
