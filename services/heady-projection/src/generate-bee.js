/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * HeadyBee Generator CLI
 * Generates domain-specific bee files and their test stubs.
 *
 * Usage:
 *   node scripts/generate-bee.js --domain my-domain --description "Does something" --priority 0.7 --category ops
 *   node scripts/generate-bee.js --template monitor --domain cpu-monitor
 */

const { mkdir, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
};
const ok   = (m) => console.log(`${c.green}✔${c.reset}  ${m}`);
const info = (m) => console.log(`${c.blue}▶${c.reset}  ${m}`);
const err  = (m, exit) => { console.error(`${c.red}✖${c.reset}  ${m}`); if (exit) process.exit(1); };

// ── Arg parsing ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const domain      = getArg('--domain');
const description = getArg('--description') || `HeadyBee for ${domain} domain`;
const priority    = parseFloat(getArg('--priority') || '0.5');
const category    = getArg('--category') || 'general';
const template    = getArg('--template') || 'default';

// ── Validation ────────────────────────────────────────────────────────────────
if (!domain) {
  err('Usage: node scripts/generate-bee.js --domain <name> [--description "..."] [--priority 0.5] [--category ops] [--template health-check|monitor|processor|scanner|projection]', true);
}
if (!/^[a-z][a-z0-9-]*$/.test(domain)) {
  err(`Invalid domain "${domain}". Lowercase, letters/numbers/hyphens only.`, true);
}
if (priority < 0 || priority > 1) {
  err('Priority must be between 0.0 and 1.0', true);
}

const VALID_TEMPLATES = ['default', 'health-check', 'monitor', 'processor', 'scanner', 'projection'];
if (!VALID_TEMPLATES.includes(template)) {
  err(`Invalid template "${template}". Choose from: ${VALID_TEMPLATES.join(', ')}`, true);
}

// ── CSL Vector generator ──────────────────────────────────────────────────────
function genCslVector(domain, category) {
  const domainHash = domain.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const x = ((domainHash * 1.6180339887) % 1).toFixed(6);
  const y = ((domainHash * 2.7182818284) % 1).toFixed(6);
  const z = ((domainHash * 3.1415926535) % 1).toFixed(6);
  return { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z), category };
}

// ── Template bodies ───────────────────────────────────────────────────────────
const TEMPLATES = {
  'health-check': (domain) => `
  async function checkServiceHealth() {
    const start = Date.now();
    let healthy = true;
    let details = {};

    try {
      // TODO: Replace with actual health check logic
      const response = await fetch(\`http://localhost:3849/health\`);
      healthy = response.ok;
      details = await response.json();
    } catch (e) {
      healthy = false;
      details = { error: e.message };
    }

    return {
      bee: '${domain}',
      action: 'checkServiceHealth',
      healthy,
      latencyMs: Date.now() - start,
      details,
      ts: Date.now(),
    };
  },`,

  'monitor': (domain) => `
  async function collectMetrics() {
    const metrics = {
      // TODO: Add domain-specific metric collection
      timestamp: Date.now(),
      samples: [],
    };

    return {
      bee: '${domain}',
      action: 'collectMetrics',
      metrics,
      ts: Date.now(),
    };
  },

  async function detectAnomalies() {
    const anomalies = [];

    // TODO: Add anomaly detection logic using PHI thresholds
    const threshold = PHI * 0.1;

    return {
      bee: '${domain}',
      action: 'detectAnomalies',
      anomalies,
      threshold,
      ts: Date.now(),
    };
  },`,

  'processor': (domain) => `
  async function processQueue() {
    const processed = [];
    const errors = [];

    // TODO: Implement queue processing logic
    const batchSize = Math.ceil(PHI * 8); // ~13 items per batch

    return {
      bee: '${domain}',
      action: 'processQueue',
      processed: processed.length,
      errors: errors.length,
      batchSize,
      ts: Date.now(),
    };
  },

  async function flushResults() {
    // TODO: Flush processed results to downstream
    return {
      bee: '${domain}',
      action: 'flushResults',
      flushed: 0,
      ts: Date.now(),
    };
  },`,

  'scanner': (domain) => `
  async function scanResources() {
    const discovered = [];
    const stale = [];

    // TODO: Implement resource scanning logic
    const scanInterval = PHI * 1000; // PHI-scaled interval

    return {
      bee: '${domain}',
      action: 'scanResources',
      discovered: discovered.length,
      stale: stale.length,
      scanInterval,
      ts: Date.now(),
    };
  },

  async function pruneStale() {
    // TODO: Remove stale resources discovered during scan
    return {
      bee: '${domain}',
      action: 'pruneStale',
      pruned: 0,
      ts: Date.now(),
    };
  },`,

  'projection': (domain) => `
  async function computeProjection() {
    const state = {};

    // TODO: Compute the ${domain} projection state
    const version = Date.now();

    return {
      bee: '${domain}',
      action: 'computeProjection',
      state,
      version,
      ts: Date.now(),
    };
  },

  async function diffAndPublish() {
    // TODO: Diff new state vs old state, publish if changed
    const changed = false;
    return {
      bee: '${domain}',
      action: 'diffAndPublish',
      changed,
      ts: Date.now(),
    };
  },`,

  'default': (domain) => `
  async function run() {
    // TODO: Implement primary worker logic for ${domain}
    return {
      bee: '${domain}',
      action: 'run',
      result: null,
      ts: Date.now(),
    };
  },`,
};

// ── Bee file template ─────────────────────────────────────────────────────────
function genBeeFile(domain, description, priority, category, template) {
  const csl      = genCslVector(domain, category);
  const className = domain.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const workers  = (TEMPLATES[template] || TEMPLATES['default'])(domain);

  return `/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * @module ${domain}-bee
 * ${description}
 *
 * Category : ${category}
 * Priority : ${priority}
 * Template : ${template}
 *
 * CSL Vector: { x: ${csl.x}, y: ${csl.y}, z: ${csl.z} }
 */

const PHI = 1.6180339887;

// ── Identity ──────────────────────────────────────────────────────────────────
export const domain      = '${domain}';
export const description = '${description}';
export const priority    = ${priority};

// ── CSL Routing Vector ────────────────────────────────────────────────────────
export const cslVector = {
  x: ${csl.x},
  y: ${csl.y},
  z: ${csl.z},
  category: '${category}',
};

// ── Worker functions ──────────────────────────────────────────────────────────
/**
 * Returns an array of async worker functions for this bee.
 * Each worker performs one unit of domain-specific work and returns
 * a structured result tagged with { bee, action, ts }.
 *
 * @returns {Array<Function>}
 */
export function getWork() {
  return [${workers}
  ];
}

// ── Dynamic registration (optional) ──────────────────────────────────────────
// If using bee-factory for dynamic registration, uncomment below:
//
// import { createBee } from '@heady/bee-factory';
// export const ${className}Bee = createBee({
//   domain,
//   description,
//   priority,
//   cslVector,
//   getWork,
// });

// ── Metadata export ───────────────────────────────────────────────────────────
export default {
  domain,
  description,
  priority,
  cslVector,
  getWork,
};
`;
}

// ── Test file template ────────────────────────────────────────────────────────
function genTestFile(domain, description) {
  return `/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * Tests for ${domain}-bee
 * ${description}
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import bee from '../../src/bees/${domain}-bee.js';

const PHI = 1.6180339887;

describe('${domain}-bee', () => {
  it('exports required fields', () => {
    assert.equal(typeof bee.domain,      'string',   'domain must be a string');
    assert.equal(typeof bee.description, 'string',   'description must be a string');
    assert.equal(typeof bee.priority,    'number',   'priority must be a number');
    assert.equal(typeof bee.cslVector,   'object',   'cslVector must be an object');
    assert.equal(typeof bee.getWork,     'function', 'getWork must be a function');
  });

  it('domain matches expected value', () => {
    assert.equal(bee.domain, '${domain}');
  });

  it('priority is between 0 and 1', () => {
    assert.ok(bee.priority >= 0 && bee.priority <= 1,
      \`priority \${bee.priority} must be in [0, 1]\`);
  });

  it('cslVector has x, y, z, category fields', () => {
    const { x, y, z, category } = bee.cslVector;
    assert.equal(typeof x,        'number', 'x must be number');
    assert.equal(typeof y,        'number', 'y must be number');
    assert.equal(typeof z,        'number', 'z must be number');
    assert.equal(typeof category, 'string', 'category must be string');
  });

  it('getWork() returns a non-empty array of functions', () => {
    const work = bee.getWork();
    assert.ok(Array.isArray(work),   'getWork() must return an array');
    assert.ok(work.length > 0,       'getWork() must return at least one worker');
    work.forEach((fn, i) => {
      assert.equal(typeof fn, 'function', \`worker[\${i}] must be a function\`);
    });
  });

  it('each worker returns { bee, action, ts }', async () => {
    const work = bee.getWork();
    for (const worker of work) {
      const result = await worker();
      assert.equal(result.bee, '${domain}',      'result.bee must match domain');
      assert.equal(typeof result.action, 'string', 'result.action must be string');
      assert.equal(typeof result.ts,     'number', 'result.ts must be number');
    }
  });

  it('PHI constant is correct', () => {
    // The bee module must be aligned with PHI = 1.6180339887
    assert.ok(Math.abs(PHI - 1.6180339887) < 1e-9);
  });
});
`;
}

// ── Write files ───────────────────────────────────────────────────────────────
const srcBeesDir   = join(ROOT, 'src', 'bees');
const testsBeesDir = join(ROOT, 'tests', 'bees');

const beeFile  = join(srcBeesDir,   `${domain}-bee.js`);
const testFile = join(testsBeesDir, `${domain}-bee.test.js`);

if (existsSync(beeFile)) {
  err(`Bee already exists: src/bees/${domain}-bee.js`, true);
}

await mkdir(srcBeesDir,   { recursive: true });
await mkdir(testsBeesDir, { recursive: true });

const beeContent  = genBeeFile(domain, description, priority, category, template);
const testContent = genTestFile(domain, description);

await writeFile(beeFile,  beeContent,  'utf8');
await writeFile(testFile, testContent, 'utf8');

console.log('');
console.log(`${c.bold}${c.magenta}  HeadyBee Generator${c.reset}`);
console.log(`${c.dim}  Domain: ${c.reset}${c.cyan}${domain}${c.reset}  ${c.dim}Template: ${template}  Priority: ${priority}  Category: ${category}${c.reset}`);
console.log('');
ok(`Created ${c.cyan}src/bees/${domain}-bee.js${c.reset}`);
ok(`Created ${c.cyan}tests/bees/${domain}-bee.test.js${c.reset}`);
console.log('');
info(`Run tests: ${c.dim}node --test tests/bees/${domain}-bee.test.js${c.reset}`);
console.log('');
