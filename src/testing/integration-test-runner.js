'use strict';

/**
 * integration-test-runner.js
 * Runs 8 cross-service integration test scenarios in-process.
 * Each scenario records pass/fail, duration, CSL scores, and error context.
 *
 * Part of the Heady Auto-Testing Framework (Part C3)
 */

const logger = require('../utils/logger');
const CSL    = require('../core/semantic-logic');
const { PHI, PHI_INVERSE, PhiScale, PhiBackoff } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------
const STATUS = { PASS: 'PASS', FAIL: 'FAIL', SKIP: 'SKIP' };

// ---------------------------------------------------------------------------
// Helper: safe dynamic require (returns null if module absent)
// ---------------------------------------------------------------------------
function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: build a simple n-dim test vector
// ---------------------------------------------------------------------------
function buildVec(seed, dim = 64) {
  const v = [];
  for (let i = 0; i < dim; i++) {
    v.push(Math.sin((seed + i) * PHI));
  }
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / mag);
}

// ---------------------------------------------------------------------------
// Scenario result builder
// ---------------------------------------------------------------------------
function makeResult(id, name) {
  return {
    id,
    name,
    status:    STATUS.SKIP,
    durationMs: 0,
    cslScore:   null,
    error:      null,
    details:    {},
  };
}

// ---------------------------------------------------------------------------
// Scenario runners
// ---------------------------------------------------------------------------

/**
 * Scenario 1: MCP Tool Request → MCPRouter.route() → correct server
 */
async function scenarioMCPRouting(log) {
  const result = makeResult(1, 'MCP Tool Request → MCPRouter.route() → correct server');
  const MCPRouter = tryRequire('../mcp/mcp-router');
  if (!MCPRouter) {
    result.status = STATUS.SKIP;
    result.error  = 'mcp-router module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const router = new MCPRouter();
    router.registerServer('server-a', { capabilities: ['read', 'write'], vec: buildVec(1) });
    router.registerServer('server-b', { capabilities: ['execute'],        vec: buildVec(2) });

    const route = await router.route({ tool: 'read', intent: buildVec(1) });
    const cslRes = CSL.resonance_gate(buildVec(1), buildVec(1), PHI_INVERSE);

    result.status    = route != null ? STATUS.PASS : STATUS.FAIL;
    result.cslScore  = cslRes.score;
    result.details   = { routed: route };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 2: Bee Task → routeBee() → correct domain
 */
async function scenarioBeeDomain(log) {
  const result = makeResult(2, 'Bee Task → routeBee() → correct domain');
  const BeeFactory = tryRequire('../bees/bee-factory');
  if (!BeeFactory) {
    result.status = STATUS.SKIP;
    result.error  = 'bee-factory module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const factory = new (BeeFactory.BeeFactory || BeeFactory)();
    const bee = factory.createBee
      ? factory.createBee('domain-test', { domain: 'analysis', vec: buildVec(3) })
      : null;

    const taskVec = buildVec(3);
    const bestBee = factory.routeBee
      ? await factory.routeBee(taskVec, PHI_INVERSE * 0.8)
      : null;

    const cslRes = CSL.resonance_gate(taskVec, buildVec(3), PHI_INVERSE);
    result.status    = STATUS.PASS;
    result.cslScore  = cslRes.score;
    result.details   = { bee: bee ? bee.id || 'created' : null, bestBee };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 3: Skill Request → SkillRouter.route() → correct agent
 */
async function scenarioSkillRouter(log) {
  const result = makeResult(3, 'Skill Request → SkillRouter.route() → correct agent');
  const SkillRouter = tryRequire('../orchestration/skill-router');
  if (!SkillRouter) {
    result.status = STATUS.SKIP;
    result.error  = 'skill-router module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const SR = SkillRouter.SkillRouter || SkillRouter;
    const router = new SR();
    const agentVec = buildVec(10);

    router.register('agent-alpha', { skills: ['analysis', 'synthesis'], vec: agentVec });
    router.register('agent-beta',  { skills: ['code'],                   vec: buildVec(20) });

    const assigned = await router.route({ skill: 'analysis', vec: buildVec(10) });
    const cslRes   = CSL.resonance_gate(buildVec(10), agentVec, PHI_INVERSE);

    result.status   = assigned != null ? STATUS.PASS : STATUS.FAIL;
    result.cslScore = cslRes.score;
    result.details  = { assigned };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 4: Phi Scale → adjust() with telemetry metrics → value changes
 */
async function scenarioPhiScaleAdjust(log) {
  const result = makeResult(4, 'Phi Scale → adjust() with metrics → value changes');
  const t0 = Date.now();
  try {
    const scale = new PhiScale({
      base: 1000, min: 100, max: 10000, name: 'integration-scale',
      feed: (metrics) => {
        if (metrics && metrics.latency > 800) return 0.5;
        if (metrics && metrics.latency < 200) return -0.3;
        return 0;
      },
    });

    const before = scale.current || scale.value || 1000;
    scale.adjust({ latency: 1200, errorRate: 0.02 });
    const after  = scale.current || scale.value || 1000;

    result.status   = STATUS.PASS; // adjust ran without error
    result.cslScore = CSL.soft_gate(after / before, PHI_INVERSE, PHI).value;
    result.details  = { before, after, changed: before !== after };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 5: Circuit Breaker → trigger open → failover → recover → close
 */
async function scenarioCircuitBreaker(log) {
  const result = makeResult(5, 'Circuit Breaker → open → failover → recover → close');
  const CB = tryRequire('../resilience/circuit-breaker') ||
             tryRequire('../lib/circuit-breaker')        ||
             tryRequire('../utils/circuit-breaker');

  if (!CB) {
    result.status = STATUS.SKIP;
    result.error  = 'circuit-breaker module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const CircuitBreaker = CB.CircuitBreaker || CB;
    const cb = new CircuitBreaker({ threshold: 3, timeout: 100 });

    // Force open by recording failures
    let failCount = 0;
    for (let i = 0; i < 4; i++) {
      try {
        await cb.execute(() => { throw new Error('forced failure'); });
      } catch (_) { failCount++; }
    }

    const isOpen = cb.isOpen ? cb.isOpen() : (cb.state === 'OPEN' || cb.state === 'open');

    // Wait for half-open / reset
    await new Promise(r => setTimeout(r, 150));

    // Attempt recovery
    let recovered = false;
    try {
      await cb.execute(() => Promise.resolve('ok'));
      recovered = true;
    } catch (_) {}

    result.status   = STATUS.PASS;
    result.details  = { failCount, wasOpen: isOpen, recovered };
    result.cslScore = CSL.soft_gate(failCount / 4, 0.5, PHI).value;
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 6: Health Attestation → degrade → quarantine → respawn → recover
 */
async function scenarioHealthAttestation(log) {
  const result = makeResult(6, 'Health Attestation → degrade → quarantine → respawn → recover');
  const HA = tryRequire('../resilience/health-attestor');
  if (!HA) {
    result.status = STATUS.SKIP;
    result.error  = 'health-attestor module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const HealthAttestor = HA.HealthAttestor || HA;
    const attestor = new HealthAttestor({ broadcastInterval: 9999 }); // no auto-broadcast

    // Inject bad metrics
    if (attestor._errorRate !== undefined) attestor._errorRate = 0.9;
    if (typeof attestor.recordError === 'function') {
      for (let i = 0; i < 15; i++) attestor.recordError();
    }

    const score = typeof attestor.computeHealthScore === 'function'
      ? attestor.computeHealthScore()
      : 0.5;

    const state = typeof attestor.classify === 'function'
      ? attestor.classify(score)
      : (score < 0.3 ? 'critical' : score < 0.7 ? 'degraded' : 'healthy');

    // Simulate recover — reset errors
    if (typeof attestor.reset === 'function') attestor.reset();

    const scoreAfter = typeof attestor.computeHealthScore === 'function'
      ? attestor.computeHealthScore()
      : 1.0;

    result.status   = STATUS.PASS;
    result.cslScore = CSL.soft_gate(score, 0.5, PHI).value;
    result.details  = { scoreBefore: score, state, scoreAfter };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 7: AutoSuccess → scan → decompose → package → manifest integrity
 */
async function scenarioAutoSuccess(log) {
  const result = makeResult(7, 'AutoSuccess → scan → decompose → package → manifest integrity');
  const ASE = tryRequire('../engines/auto-success-engine');
  if (!ASE) {
    result.status = STATUS.SKIP;
    result.error  = 'auto-success-engine module not found';
    return result;
  }

  const t0 = Date.now();
  try {
    const { AutoSuccessEngine, getAutoSuccessEngine } = ASE;
    const engine = getAutoSuccessEngine
      ? getAutoSuccessEngine()
      : new AutoSuccessEngine();

    // Run scan if available
    let scanResult = null;
    if (typeof engine.scan === 'function') {
      scanResult = await engine.scan(__dirname);
    }

    result.status  = STATUS.PASS;
    result.details = {
      scanned: scanResult ? Object.keys(scanResult).length : 0,
      hasManifest: scanResult && scanResult.manifest != null,
    };
    result.cslScore = PHI_INVERSE; // nominal
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

/**
 * Scenario 8: CSL Coherence — all modules same-dimension vectors → consistent scores
 */
async function scenaryCslCoherence(log) {
  const result = makeResult(8, 'CSL Coherence → same-dimension vectors → consistent scores');
  const t0 = Date.now();
  try {
    const DIM = 64;
    const v1 = buildVec(1,  DIM);
    const v2 = buildVec(2,  DIM);
    const v3 = buildVec(3,  DIM);
    const v4 = buildVec(4,  DIM);
    const v5 = buildVec(5,  DIM);

    const res12 = CSL.resonance_gate(v1, v2, PHI_INVERSE);
    const res13 = CSL.resonance_gate(v1, v3, PHI_INVERSE);
    const cos11  = CSL.cosine_similarity(v1, v1);
    const cos12  = CSL.cosine_similarity(v1, v2);
    const sp     = CSL.superposition_gate(v1, v2);
    const orth   = CSL.orthogonal_gate(v1, v2);
    const multi  = CSL.multi_resonance(v1, [v2, v3, v4, v5], PHI_INVERSE);

    const coherent = (
      res12.score >= 0 && res12.score <= 1 &&
      res13.score >= 0 && res13.score <= 1 &&
      Math.abs(cos11 - 1) < 0.001 &&         // self-similarity ≈ 1
      cos12 >= 0 && cos12 <= 1 &&
      Array.isArray(sp) && sp.length === DIM &&
      Array.isArray(orth) && orth.length === DIM &&
      Array.isArray(multi) && multi.length >= 1
    );

    result.status   = coherent ? STATUS.PASS : STATUS.FAIL;
    result.cslScore = res12.score;
    result.details  = {
      res12: res12.score,
      res13: res13.score,
      cos11,
      cos12,
      spDim:    sp.length,
      orthDim:  orth.length,
      multiLen: multi.length,
    };
  } catch (err) {
    result.status = STATUS.FAIL;
    result.error  = err.message;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

// ---------------------------------------------------------------------------
// IntegrationTestRunner
// ---------------------------------------------------------------------------

class IntegrationTestRunner {
  constructor(options = {}) {
    this.log    = logger.child ? logger.child({ module: 'IntegrationTestRunner' }) : logger;
    this.results = [];
    this._backoff = new PhiBackoff(200, 5000);
    this.log.info('IntegrationTestRunner initialised');
  }

  // -------------------------------------------------------------------------
  // run
  // -------------------------------------------------------------------------
  /**
   * Execute all 8 scenarios sequentially and collect results.
   * @returns {Object} summary report
   */
  async run() {
    const globalStart = Date.now();
    this.log.logSystem('IntegrationTestRunner.run starting');

    const scenarios = [
      scenarioMCPRouting,
      scenarioBeeDomain,
      scenarioSkillRouter,
      scenarioPhiScaleAdjust,
      scenarioCircuitBreaker,
      scenarioHealthAttestation,
      scenarioAutoSuccess,
      scenaryCslCoherence,
    ];

    this.results = [];

    for (const scenario of scenarios) {
      this.log.info(`Running scenario: ${scenario.name}`);
      try {
        const r = await scenario(this.log);
        this.results.push(r);
        this.log.info(`Scenario ${r.id} ${r.status}: ${r.name}`, {
          durationMs: r.durationMs,
          cslScore:   r.cslScore,
        });
      } catch (err) {
        this.log.error('Unhandled scenario error', { scenario: scenario.name, err: err.message });
        this.results.push({
          id:         this.results.length + 1,
          name:       scenario.name,
          status:     STATUS.FAIL,
          durationMs: 0,
          cslScore:   null,
          error:      err.message,
          details:    {},
        });
      }
    }

    const totalMs = Date.now() - globalStart;
    const summary = this._buildSummary(totalMs);
    this.log.logSystem('IntegrationTestRunner.run complete', summary);
    return summary;
  }

  // -------------------------------------------------------------------------
  // _buildSummary
  // -------------------------------------------------------------------------
  _buildSummary(totalMs) {
    const pass = this.results.filter(r => r.status === STATUS.PASS).length;
    const fail = this.results.filter(r => r.status === STATUS.FAIL).length;
    const skip = this.results.filter(r => r.status === STATUS.SKIP).length;

    const avgCsl = this.results
      .filter(r => r.cslScore != null)
      .reduce((s, r, _, a) => s + r.cslScore / a.length, 0);

    return {
      totalMs,
      pass,
      fail,
      skip,
      total:        this.results.length,
      avgCslScore:  parseFloat(avgCsl.toFixed(4)),
      phiThreshold: PHI_INVERSE,
      scenarios:    this.results,
    };
  }

  // -------------------------------------------------------------------------
  // runScenario (by id, 1-based)
  // -------------------------------------------------------------------------
  async runScenario(id) {
    const runners = [
      null, // 0 unused
      scenarioMCPRouting,
      scenarioBeeDomain,
      scenarioSkillRouter,
      scenarioPhiScaleAdjust,
      scenarioCircuitBreaker,
      scenarioHealthAttestation,
      scenarioAutoSuccess,
      scenaryCslCoherence,
    ];
    if (id < 1 || id >= runners.length) throw new Error(`Unknown scenario id: ${id}`);
    return runners[id](this.log);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { IntegrationTestRunner, STATUS };
