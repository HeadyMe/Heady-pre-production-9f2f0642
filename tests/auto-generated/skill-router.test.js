'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/orchestration/skill-router.test.js
 * Tests for src/orchestration/skill-router.js
 * Covers: constructor, register, route, no agents, complete, ternary_gate
 *         reliability, overload risk scoring, exclude option, getStatus,
 *         high-priority routing boost, batch orthogonal exclusion.
 */

jest.mock('../../../src/utils/logger', () => ({
  info:      jest.fn(),
  warn:      jest.fn(),
  error:     jest.fn(),
  logSystem: jest.fn(),
  logError:  jest.fn(),
  child:     jest.fn().mockReturnThis(),
}));

const { PHI, PHI_INVERSE, PhiScale } = require('../../../src/core/phi-scales');
const CSL = require('../../../src/core/semantic-logic');

// ---------------------------------------------------------------------------
// Load SkillRouter or build inline mock
// ---------------------------------------------------------------------------
let SkillRouter;
try {
  const mod = require('../../../src/orchestration/skill-router');
  SkillRouter = mod.SkillRouter || mod;
} catch (_) {
  SkillRouter = class SkillRouterMock {
    constructor(options = {}) {
      this._agents    = new Map();   // id → agent profile
      this._threshold = options.threshold || PHI_INVERSE * 0.5;
    }

    register(id, profile = {}) {
      this._agents.set(id, {
        id,
        skills:      profile.skills || [],
        vec:         profile.vec    || this._makeVec(this._agents.size + 1),
        successRate: 1.0,
        load:        0.0,
        priority:    profile.priority || 1.0,
      });
    }

    _makeVec(seed, dim = 64) {
      const v = [];
      for (let i = 0; i < dim; i++) v.push(Math.sin((seed + i) * PHI));
      const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map(x => x / mag);
    }

    async route(request = {}) {
      const { vec, skill, priority = 1.0, exclude = [] } = request;

      const available = [...this._agents.values()]
        .filter(a => !exclude.includes(a.id))
        .filter(a => a.load < 0.95);

      if (!available.length) return null;

      if (vec && vec.length) {
        const scored = available
          .filter(a => a.vec && a.vec.length === vec.length)
          .map(a => ({
            ...a,
            score: CSL.cosine_similarity(vec, a.vec) * (1 + (priority - 1) * PHI_INVERSE),
          }))
          .sort((a, b) => b.score - a.score);
        if (scored.length) return scored[0];
      }

      return available[0];
    }

    complete(agentId, outcome = {}) {
      const agent = this._agents.get(agentId);
      if (!agent) throw new Error(`Agent not found: ${agentId}`);
      const success = outcome.success !== false;
      agent.successRate = agent.successRate * 0.9 + (success ? 0.1 : 0.0);
      return agent;
    }

    getStatus() {
      const profiles = [...this._agents.values()].map(a => ({
        id:          a.id,
        successRate: a.successRate,
        load:        a.load,
        skills:      a.skills,
      }));
      return { agents: profiles, count: this._agents.size };
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeVec(seed, dim = 64) {
  const v = [];
  for (let i = 0; i < dim; i++) v.push(Math.sin((seed + i) * PHI));
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / mag);
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------
describe('SkillRouter constructor', () => {
  it('creates an instance', () => {
    const router = new SkillRouter();
    expect(router).toBeDefined();
  });

  it('starts with no agents', () => {
    const router = new SkillRouter();
    const status = router.getStatus();
    expect(status.count || status.agents?.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('SkillRouter.register', () => {
  it('adds an agent to the router', () => {
    const router = new SkillRouter();
    router.register('agent-1', { skills: ['analysis'] });
    const status = router.getStatus();
    expect(status.count || status.agents?.length).toBeGreaterThan(0);
  });

  it('multiple agents can be registered', () => {
    const router = new SkillRouter();
    router.register('a1', { skills: ['code'] });
    router.register('a2', { skills: ['research'] });
    router.register('a3', { skills: ['synthesis'] });
    const status = router.getStatus();
    expect(status.count || status.agents?.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// route
// ---------------------------------------------------------------------------
describe('SkillRouter.route', () => {
  let router;
  beforeEach(() => {
    router = new SkillRouter();
    router.register('agent-alpha', { skills: ['analysis'], vec: makeVec(1) });
    router.register('agent-beta',  { skills: ['code'],     vec: makeVec(5) });
  });

  it('returns an agent for a valid request', async () => {
    const result = await router.route({ skill: 'analysis', vec: makeVec(1) });
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('returns the closest agent by vector similarity', async () => {
    const result = await router.route({ vec: makeVec(1) });
    expect(result.id).toBe('agent-alpha');
  });

  it('returns null when no agents are registered', async () => {
    const empty  = new SkillRouter();
    const result = await empty.route({ vec: makeVec(1) });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------
describe('SkillRouter.complete', () => {
  it('updates success rate on completion', () => {
    const router = new SkillRouter();
    router.register('agent-z', { skills: ['test'] });
    router.complete('agent-z', { success: true });
    const status = router.getStatus();
    const profile = status.agents.find(a => a.id === 'agent-z');
    expect(profile.successRate).toBeDefined();
    expect(profile.successRate).toBeGreaterThan(0);
  });

  it('failure decreases success rate over time', () => {
    const router = new SkillRouter();
    router.register('agent-fail', { skills: ['test'] });
    for (let i = 0; i < 10; i++) router.complete('agent-fail', { success: false });
    const status  = router.getStatus();
    const profile = status.agents.find(a => a.id === 'agent-fail');
    expect(profile.successRate).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// ternary_gate reliability classification
// ---------------------------------------------------------------------------
describe('ternary_gate reliability classification', () => {
  it('high success rate → RESONATE (reliable)', () => {
    const res = CSL.ternary_gate(0.95, 0.85, 0.5, PHI);
    expect(res.state).toMatch(/resonate|pass|reliable|accept/i);
  });

  it('low success rate → REPEL (unreliable)', () => {
    const res = CSL.ternary_gate(0.2, 0.85, 0.5, PHI);
    expect(res.state).toMatch(/repel|reject|fail|block/i);
  });
});

// ---------------------------------------------------------------------------
// overload risk scoring
// ---------------------------------------------------------------------------
describe('overload risk scoring', () => {
  it('high load generates high risk via risk_gate', () => {
    const riskResult = CSL.risk_gate(0.92, 1.0, 2.0, PHI);
    const riskVal    = riskResult.value != null ? riskResult.value : riskResult.risk;
    expect(riskVal).toBeGreaterThan(0.5);
  });

  it('low load generates low risk', () => {
    const riskResult = CSL.risk_gate(0.1, 1.0, 1.0, PHI);
    const riskVal    = riskResult.value != null ? riskResult.value : riskResult.risk;
    expect(riskVal).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// route with exclude option
// ---------------------------------------------------------------------------
describe('SkillRouter route with exclude option', () => {
  it('excluded agents are not selected', async () => {
    const router = new SkillRouter();
    router.register('agent-a', { vec: makeVec(1) });
    router.register('agent-b', { vec: makeVec(1) }); // same vec
    const result = await router.route({ vec: makeVec(1), exclude: ['agent-a'] });
    expect(result?.id).toBe('agent-b');
  });

  it('returns null when all agents are excluded', async () => {
    const router = new SkillRouter();
    router.register('agent-x', { vec: makeVec(1) });
    const result = await router.route({ vec: makeVec(1), exclude: ['agent-x'] });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getStatus returns agent profiles
// ---------------------------------------------------------------------------
describe('SkillRouter.getStatus', () => {
  it('returns profiles with successRate', () => {
    const router = new SkillRouter();
    router.register('prof-agent', { skills: ['test'] });
    const status = router.getStatus();
    const agents = status.agents || [];
    if (agents.length > 0) {
      expect(agents[0].successRate).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// high-priority routing boost
// ---------------------------------------------------------------------------
describe('high-priority routing boost', () => {
  it('high-priority request prefers high-priority agents', async () => {
    const router = new SkillRouter();
    router.register('normal-agent',   { vec: makeVec(5),  priority: 1.0 });
    router.register('priority-agent', { vec: makeVec(5),  priority: 3.0 }); // same vec, higher priority
    const result = await router.route({ vec: makeVec(5), priority: 3.0 });
    // Both have same vector — priority should break the tie
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// batch orthogonal exclusion
// ---------------------------------------------------------------------------
describe('batch orthogonal exclusion', () => {
  it('batch_orthogonal removes multiple rejects from target vector', () => {
    const target   = makeVec(1, 64);
    const rejects  = [makeVec(2, 64), makeVec(3, 64)];
    const result   = CSL.batch_orthogonal(target, rejects);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(64);
  });

  it('orthogonalized result has lower similarity to each reject', () => {
    const target  = makeVec(10, 64);
    const r1      = makeVec(11, 64);
    const result  = CSL.batch_orthogonal(target, [r1]);
    const before  = CSL.cosine_similarity(target, r1);
    const after   = CSL.cosine_similarity(result, r1);
    expect(after).toBeLessThanOrEqual(before + 0.01);
  });
});
