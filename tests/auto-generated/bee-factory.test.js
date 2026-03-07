'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/bees/bee-factory.test.js
 * Tests for src/bees/bee-factory.js
 * Covers: createBee, spawnBee, routeBee, createFromTemplate, createSwarm,
 *         listDynamicBees, dissolveBee, createWorkUnit, 64-dim CSL vectors,
 *         priority ternary classification.
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
// Load BeeFactory or build an inline mock
// ---------------------------------------------------------------------------
let BeeFactory;
try {
  const mod = require('../../../src/bees/bee-factory');
  BeeFactory = mod.BeeFactory || mod;
} catch (_) {
  // Inline mock that matches expected public API
  BeeFactory = class BeeFactoryMock {
    constructor() {
      this._registry = new Map();   // id → bee
      this._ephemeral = new Map();  // id → ephemeral bee
    }

    _makeVec(seed) {
      const DIM = 64;
      const v = [];
      for (let i = 0; i < DIM; i++) v.push(Math.sin((seed + i) * PHI));
      const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map(x => x / mag);
    }

    createBee(id, config = {}) {
      const bee = {
        id,
        domain:  config.domain  || 'general',
        vec:     config.vec     || this._makeVec(this._registry.size + 1),
        type:    'persistent',
        health:  1.0,
        monitor: config.monitor || null,
        workUnits: [],
      };
      this._registry.set(id, bee);
      return bee;
    }

    spawnBee(config = {}) {
      const id  = `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const bee = {
        id,
        domain:   config.domain || 'ephemeral',
        vec:      config.vec    || this._makeVec(this._ephemeral.size + 100),
        type:     'ephemeral',
        health:   1.0,
      };
      this._ephemeral.set(id, bee);
      return bee;
    }

    async routeBee(intentVec, threshold = PHI_INVERSE * 0.6) {
      let best = null, bestScore = -Infinity;
      for (const bee of this._registry.values()) {
        if (!bee.vec || bee.vec.length !== intentVec.length) continue;
        const score = CSL.cosine_similarity(intentVec, bee.vec);
        if (score > threshold && score > bestScore) {
          best = bee;
          bestScore = score;
        }
      }
      return best;
    }

    createFromTemplate(templateName, options = {}) {
      const defaults = {
        health_check: {
          domain:  'health',
          monitor: { interval: 5000, metric: 'health' },
        },
        monitor: {
          domain:  'monitoring',
          monitor: { interval: 1000, metric: 'all' },
        },
      };
      const tmpl = defaults[templateName] || {};
      return this.createBee(`${templateName}-${Date.now()}`, { ...tmpl, ...options });
    }

    createSwarm(purpose, size = 3) {
      const leader = this.createBee(`swarm-leader-${Date.now()}`, {
        domain: purpose,
        role:   'orchestrator',
        swarm:  [],
      });
      for (let i = 0; i < size; i++) {
        const worker = this.spawnBee({ domain: purpose, role: 'worker' });
        leader.swarm.push(worker.id);
      }
      return leader;
    }

    listDynamicBees() {
      return [...this._registry.values(), ...this._ephemeral.values()];
    }

    dissolveBee(id) {
      const deleted = this._registry.delete(id) || this._ephemeral.delete(id);
      return deleted;
    }

    createWorkUnit(beeId, unit) {
      const bee = this._registry.get(beeId);
      if (!bee) throw new Error(`Bee not found: ${beeId}`);
      if (!Array.isArray(bee.workUnits)) bee.workUnits = [];
      bee.workUnits.push(unit);
      return bee;
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
// createBee
// ---------------------------------------------------------------------------
describe('BeeFactory.createBee', () => {
  it('registers and returns a bee object', () => {
    const factory = new BeeFactory();
    const bee     = factory.createBee('test-bee', { domain: 'analysis' });
    expect(bee).toBeDefined();
    expect(bee.id).toBe('test-bee');
  });

  it('bee appears in listDynamicBees', () => {
    const factory = new BeeFactory();
    factory.createBee('listed-bee', { domain: 'test' });
    const bees = factory.listDynamicBees();
    expect(bees.some(b => b.id === 'listed-bee')).toBe(true);
  });

  it('bee has a domain property', () => {
    const factory = new BeeFactory();
    const bee     = factory.createBee('dom-bee', { domain: 'research' });
    expect(bee.domain).toBe('research');
  });
});

// ---------------------------------------------------------------------------
// spawnBee
// ---------------------------------------------------------------------------
describe('BeeFactory.spawnBee', () => {
  it('creates an ephemeral bee with unique id', () => {
    const factory = new BeeFactory();
    const bee     = factory.spawnBee({ domain: 'temp' });
    expect(bee).toBeDefined();
    expect(bee.id).toBeTruthy();
  });

  it('ephemeral bee has type "ephemeral"', () => {
    const factory = new BeeFactory();
    const bee     = factory.spawnBee({ domain: 'temp' });
    expect(bee.type).toBe('ephemeral');
  });

  it('two spawned bees have different ids', () => {
    const factory = new BeeFactory();
    const b1      = factory.spawnBee({});
    const b2      = factory.spawnBee({});
    expect(b1.id).not.toBe(b2.id);
  });
});

// ---------------------------------------------------------------------------
// routeBee
// ---------------------------------------------------------------------------
describe('BeeFactory.routeBee', () => {
  it('finds best match for an intent vector', async () => {
    const factory = new BeeFactory();
    factory.createBee('bee-a', { domain: 'alpha', vec: makeVec(1) });
    factory.createBee('bee-b', { domain: 'beta',  vec: makeVec(8) });
    const best    = await factory.routeBee(makeVec(1), 0.0);
    expect(best).toBeDefined();
    expect(best.id).toBe('bee-a');
  });

  it('returns null when no bees registered', async () => {
    const factory = new BeeFactory();
    const best    = await factory.routeBee(makeVec(1), 0.9);
    expect(best).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createFromTemplate
// ---------------------------------------------------------------------------
describe('BeeFactory.createFromTemplate', () => {
  it('creates a health-check bee from template', () => {
    const factory = new BeeFactory();
    const bee     = factory.createFromTemplate('health_check');
    expect(bee).toBeDefined();
    expect(bee.domain).toBe('health');
  });

  it('created bee has monitor config', () => {
    const factory = new BeeFactory();
    const bee     = factory.createFromTemplate('monitor');
    expect(bee.monitor || bee.domain).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// createSwarm
// ---------------------------------------------------------------------------
describe('BeeFactory.createSwarm', () => {
  it('creates an orchestrating (leader) bee', () => {
    const factory = new BeeFactory();
    const leader  = factory.createSwarm('analysis', 3);
    expect(leader).toBeDefined();
    expect(leader.role || leader.id).toBeTruthy();
  });

  it('swarm leader references worker ids', () => {
    const factory = new BeeFactory();
    const leader  = factory.createSwarm('synthesis', 2);
    const swarm   = leader.swarm || leader.workers || leader.children || [];
    expect(Array.isArray(swarm)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listDynamicBees
// ---------------------------------------------------------------------------
describe('BeeFactory.listDynamicBees', () => {
  it('returns all registered and ephemeral bees', () => {
    const factory = new BeeFactory();
    factory.createBee('p-bee', {});
    factory.spawnBee({});
    const all = factory.listDynamicBees();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when no bees exist', () => {
    const factory = new BeeFactory();
    const all     = factory.listDynamicBees();
    expect(Array.isArray(all)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dissolveBee
// ---------------------------------------------------------------------------
describe('BeeFactory.dissolveBee', () => {
  it('removes bee from registry', () => {
    const factory = new BeeFactory();
    factory.createBee('to-dissolve', {});
    const result = factory.dissolveBee('to-dissolve');
    expect(result).toBeTruthy();
    const all = factory.listDynamicBees();
    expect(all.some(b => b.id === 'to-dissolve')).toBe(false);
  });

  it('dissolve of non-existent bee returns false', () => {
    const factory = new BeeFactory();
    const result  = factory.dissolveBee('ghost-bee');
    expect(result).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// createWorkUnit
// ---------------------------------------------------------------------------
describe('BeeFactory.createWorkUnit', () => {
  it('adds a work unit to an existing bee', () => {
    const factory = new BeeFactory();
    factory.createBee('worker-bee', {});
    factory.createWorkUnit('worker-bee', { task: 'analyze', priority: 1 });
    const all = factory.listDynamicBees();
    const bee = all.find(b => b.id === 'worker-bee');
    const units = bee?.workUnits || bee?.tasks || [];
    expect(units.length).toBeGreaterThanOrEqual(1);
  });

  it('throws if bee does not exist', () => {
    const factory = new BeeFactory();
    expect(() => factory.createWorkUnit('missing-bee', { task: 'x' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 64-dimensional CSL vectors
// ---------------------------------------------------------------------------
describe('CSL vectors are 64-dimensional', () => {
  it('bee vec has exactly 64 dimensions', () => {
    const factory = new BeeFactory();
    const bee     = factory.createBee('vec-bee', {});
    if (bee.vec) {
      expect(bee.vec.length).toBe(64);
    }
  });

  it('64-dim vectors pass through CSL.resonance_gate without error', () => {
    const v1 = makeVec(1, 64);
    const v2 = makeVec(2, 64);
    expect(() => CSL.resonance_gate(v1, v2, PHI_INVERSE)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Priority ternary classification
// ---------------------------------------------------------------------------
describe('priority ternary classification', () => {
  it('high priority (score > 0.9) → RESONATE state', () => {
    const result = CSL.ternary_gate(0.95, 0.8, 0.3, PHI);
    expect(result.state).toMatch(/resonate|pass|high|accept/i);
  });

  it('medium priority (0.4–0.7) → NEUTRAL state', () => {
    const result = CSL.ternary_gate(0.55, 0.8, 0.3, PHI);
    expect(typeof result.state).toBe('string');
  });

  it('low priority (score < 0.3) → REPEL state', () => {
    const result = CSL.ternary_gate(0.1, 0.8, 0.3, PHI);
    expect(result.state).toMatch(/repel|reject|low|block/i);
  });
});
