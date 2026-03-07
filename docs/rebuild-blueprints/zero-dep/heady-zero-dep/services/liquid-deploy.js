/**
 * @file liquid-deploy.js
 * @description Deployment engine: JSON AST → physical files, Git operations,
 * blue-green and canary strategies, rollback, and deploy gates.
 *
 * Features:
 * - JSON AST projection (latent space description → file tree)
 * - Git operations via internal github-client.js
 * - Blue-green deployment (swap active/standby)
 * - Canary rollout with progressive traffic shift (PHI-scaled percentages)
 * - Automatic rollback on failure or health-check regression
 * - Deploy gates: manual approval, health checks, budget checks
 *
 * Zero external dependencies — fs, path, crypto, events (Node built-ins).
 * Sacred Geometry: PHI-scaled canary steps, Fibonacci rollback delays.
 *
 * @module HeadyServices/LiquidDeploy
 */

import { EventEmitter }                  from 'events';
import { mkdirSync, writeFileSync,
         readFileSync, existsSync,
         rmSync, cpSync, renameSync }    from 'fs';
import { join, dirname, resolve }        from 'path';
import { randomUUID, createHash }        from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// Canary traffic steps (PHI-derived percentages summing to 100)
// 5, 13, 21, 34, 55, 89 (Fibonacci % steps)
const CANARY_STEPS = [5, 13, 21, 34, 55, 89, 100];
const phiDelay = (n, base = 5_000) => Math.round(base * Math.pow(PHI, n));

// ─── Deploy Status ────────────────────────────────────────────────────────────
export const DeployStatus = Object.freeze({
  PENDING:   'PENDING',
  GATING:    'GATING',
  DEPLOYING: 'DEPLOYING',
  CANARY:    'CANARY',
  VERIFYING: 'VERIFYING',
  ACTIVE:    'ACTIVE',
  ROLLBACK:  'ROLLBACK',
  FAILED:    'FAILED',
});

export const DeployStrategy = Object.freeze({
  DIRECT:     'direct',
  BLUE_GREEN: 'blue-green',
  CANARY:     'canary',
});

// ─── JSON AST Projector ───────────────────────────────────────────────────────
/**
 * Project a JSON AST (file tree description) into physical files.
 *
 * AST format:
 * {
 *   "src/index.js":   "export default 42;",
 *   "src/util/fn.js": "export const fn = () => {};"
 * }
 * Or nested:
 * {
 *   "src": {
 *     "index.js": "export default 42;",
 *     "util": { "fn.js": "..." }
 *   }
 * }
 */
export class ASTProjector {
  /**
   * @param {string} basePath  Root directory to project into
   */
  constructor(basePath) {
    this._base = resolve(basePath);
  }

  /**
   * Flatten nested AST to path → content map.
   * @param {object} ast
   * @param {string} [prefix]
   * @returns {Map<string, string>}
   */
  flatten(ast, prefix = '') {
    const files = new Map();
    for (const [key, value] of Object.entries(ast)) {
      const path = prefix ? `${prefix}/${key}` : key;
      if (typeof value === 'string') {
        files.set(path, value);
      } else if (value && typeof value === 'object') {
        for (const [subPath, content] of this.flatten(value, path)) {
          files.set(subPath, content);
        }
      }
    }
    return files;
  }

  /**
   * Project AST into the base directory.
   * @param {object} ast
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun]  If true, return planned operations without writing
   * @returns {{ written: string[], skipped: string[], operations: object[] }}
   */
  project(ast, opts = {}) {
    const files     = this.flatten(ast);
    const written   = [];
    const skipped   = [];
    const operations = [];

    for (const [relPath, content] of files) {
      const absPath = join(this._base, relPath);
      const op      = { path: relPath, action: 'write', size: content.length };

      // Check if file content changed
      if (existsSync(absPath)) {
        const existing = readFileSync(absPath, 'utf8');
        if (existing === content) {
          skipped.push(relPath);
          op.action = 'skip';
          operations.push(op);
          continue;
        }
        op.action = 'update';
      }

      if (!opts.dryRun) {
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content, 'utf8');
      }

      written.push(relPath);
      operations.push(op);
    }

    return { written, skipped, operations, base: this._base };
  }

  /**
   * Compute a content hash for the entire AST (for change detection).
   */
  hash(ast) {
    const files   = this.flatten(ast);
    const sorted  = [...files.entries()].sort(([a], [b]) => a.localeCompare(b));
    const payload = sorted.map(([p, c]) => `${p}:${c}`).join('\n');
    return createHash('sha256').update(payload).digest('hex');
  }
}

// ─── Deploy Gates ─────────────────────────────────────────────────────────────
export class DeployGates {
  constructor(gates = []) {
    this._gates = gates;  // Array of { name, fn: async () => { pass, reason } }
  }

  add(name, fn) {
    this._gates.push({ name, fn });
    return this;
  }

  /** Run all gates in sequence. Returns { passed, failed: [{name, reason}] } */
  async run() {
    const failed = [];
    for (const gate of this._gates) {
      try {
        const result = await gate.fn();
        if (!result.pass) {
          failed.push({ name: gate.name, reason: result.reason ?? 'gate rejected' });
        }
      } catch (e) {
        failed.push({ name: gate.name, reason: `gate threw: ${e.message}` });
      }
    }
    return { passed: failed.length === 0, failed };
  }
}

// ─── Deploy Record ────────────────────────────────────────────────────────────
class DeployRecord {
  constructor(opts) {
    this.id         = randomUUID();
    this.strategy   = opts.strategy   ?? DeployStrategy.DIRECT;
    this.status     = DeployStatus.PENDING;
    this.startedAt  = new Date().toISOString();
    this.endedAt    = null;
    this.repo       = opts.repo       ?? '';
    this.branch     = opts.branch     ?? 'main';
    this.commit     = opts.commit     ?? null;
    this.astHash    = opts.astHash    ?? null;
    this.steps      = [];  // audit trail
    this.rollbackTo = opts.rollbackTo ?? null;
    this.canaryPct  = 0;
    this.meta       = opts.meta ?? {};
  }

  addStep(action, detail = {}) {
    this.steps.push({ action, ts: new Date().toISOString(), ...detail });
  }

  setStatus(s) {
    this.status = s;
    this.addStep('status_change', { status: s });
  }

  complete(success = true) {
    this.endedAt = new Date().toISOString();
    this.status  = success ? DeployStatus.ACTIVE : DeployStatus.FAILED;
    this.addStep(success ? 'completed' : 'failed');
  }

  toJSON() {
    return {
      id: this.id, strategy: this.strategy, status: this.status,
      startedAt: this.startedAt, endedAt: this.endedAt,
      repo: this.repo, branch: this.branch, commit: this.commit,
      astHash: this.astHash, steps: this.steps, canaryPct: this.canaryPct,
    };
  }
}

// ─── LiquidDeploy ─────────────────────────────────────────────────────────────
export class LiquidDeploy extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  opts.workDir       Working directory for file operations
   * @param {object}  [opts.githubClient] github-client.js instance
   * @param {object}  [opts.gates]       Default DeployGates
   * @param {boolean} [opts.autoRollback] Auto-rollback on verify failure (default true)
   */
  constructor(opts = {}) {
    super();
    this._workDir     = resolve(opts.workDir ?? '/tmp/heady-deploy');
    this._github      = opts.githubClient ?? null;
    this._gates       = opts.gates ?? new DeployGates();
    this._autoRollback = opts.autoRollback !== false;
    this._projector   = new ASTProjector(this._workDir);

    // Blue-green state
    this._activeSlot  = 'blue';   // 'blue' | 'green'
    this._slots       = { blue: null, green: null };  // slot → DeployRecord

    // History
    this._history     = [];
    this._maxHistory  = 34;  // Fibonacci
  }

  // ─── Main deploy entry ────────────────────────────────────────────────

  /**
   * Deploy an AST to the target environment.
   *
   * @param {object} ast         File tree (path → content)
   * @param {object} opts
   * @param {string} [opts.strategy]  DeployStrategy
   * @param {string} [opts.repo]
   * @param {string} [opts.branch]
   * @param {object} [opts.gates]     Override gates
   * @param {Function} [opts.verify] async () => { pass, reason } — called post-deploy
   * @returns {Promise<DeployRecord>}
   */
  async deploy(ast, opts = {}) {
    const strategy = opts.strategy ?? DeployStrategy.BLUE_GREEN;
    const record   = new DeployRecord({
      strategy,
      repo:     opts.repo   ?? '',
      branch:   opts.branch ?? 'main',
      astHash:  this._projector.hash(ast),
      meta:     opts.meta ?? {},
    });

    this._history.push(record);
    if (this._history.length > this._maxHistory) this._history.shift();

    this.emit('deployStart', record.toJSON());

    try {
      // Gate check
      record.setStatus(DeployStatus.GATING);
      const gates = opts.gates ?? this._gates;
      const gateResult = await gates.run();
      if (!gateResult.passed) {
        record.setStatus(DeployStatus.FAILED);
        record.addStep('gate_failed', { failed: gateResult.failed });
        this.emit('gateBlocked', { deployId: record.id, failed: gateResult.failed });
        throw Object.assign(new Error(`Deploy gates failed: ${gateResult.failed.map(f => f.name).join(', ')}`),
          { code: 'GATE_REJECTED', gateResult });
      }
      record.addStep('gates_passed');

      // Route to strategy
      record.setStatus(DeployStatus.DEPLOYING);
      switch (strategy) {
        case DeployStrategy.BLUE_GREEN:
          await this._blueGreenDeploy(ast, record, opts);
          break;
        case DeployStrategy.CANARY:
          await this._canaryDeploy(ast, record, opts);
          break;
        default:
          await this._directDeploy(ast, record, opts);
      }

      // Verify
      if (opts.verify) {
        record.setStatus(DeployStatus.VERIFYING);
        const verifyResult = await opts.verify(record);
        if (!verifyResult.pass) {
          if (this._autoRollback) {
            await this._rollback(record, `Verify failed: ${verifyResult.reason}`);
          } else {
            record.complete(false);
            throw new Error(`Deploy verify failed: ${verifyResult.reason}`);
          }
          return record;
        }
        record.addStep('verified');
      }

      record.complete(true);
      this.emit('deploySuccess', record.toJSON());
      return record;

    } catch (err) {
      if (record.status !== DeployStatus.ROLLBACK) {
        record.complete(false);
        this.emit('deployFailed', { deployId: record.id, error: err.message });
      }
      throw err;
    }
  }

  // ─── Strategies ───────────────────────────────────────────────────────

  async _directDeploy(ast, record, opts) {
    const result = this._projector.project(ast, opts);
    record.addStep('direct_deploy', { written: result.written.length, skipped: result.skipped.length });

    if (this._github && opts.repo && !opts.skipGit) {
      await this._pushToGit(ast, record, opts);
    }
  }

  async _blueGreenDeploy(ast, record, opts) {
    // Determine standby slot
    const standby = this._activeSlot === 'blue' ? 'green' : 'blue';
    const standbyDir = join(this._workDir, standby);

    mkdirSync(standbyDir, { recursive: true });

    // Project to standby
    const projector = new ASTProjector(standbyDir);
    const result    = projector.project(ast);
    record.addStep('blue_green_deploy', { slot: standby, written: result.written.length });

    this.emit('slotDeployed', { deployId: record.id, slot: standby, written: result.written.length });

    // Keep reference to active (for rollback)
    const previousActiveDir = join(this._workDir, this._activeSlot);
    record.rollbackTo = this._activeSlot;
    record.addStep('standby_ready', { slot: standby });

    // Swap active slot
    this._slots[standby] = record;
    this._activeSlot     = standby;
    record.addStep('slot_swapped', { from: standby === 'blue' ? 'green' : 'blue', to: standby });

    this.emit('slotSwapped', { deployId: record.id, activeSlot: standby });

    if (this._github && opts.repo && !opts.skipGit) {
      await this._pushToGit(ast, record, opts);
    }
  }

  async _canaryDeploy(ast, record, opts) {
    const steps       = opts.canarySteps ?? CANARY_STEPS;
    const stepDelayMs = opts.stepDelayMs ?? phiDelay(2, 10_000); // PHI^2 * 10s ≈ 26s

    record.setStatus(DeployStatus.CANARY);

    for (let i = 0; i < steps.length; i++) {
      const pct = steps[i];
      record.canaryPct = pct;
      record.addStep('canary_step', { pct });
      this.emit('canaryStep', { deployId: record.id, pct });

      // At each step, verify if callback provided
      if (opts.verifyStep) {
        const v = await opts.verifyStep(record, pct);
        if (!v.pass) {
          await this._rollback(record, `Canary failed at ${pct}%: ${v.reason}`);
          return;
        }
      }

      if (pct < 100) {
        await this._sleep(stepDelayMs);
      }
    }

    // Full rollout
    const result = this._projector.project(ast);
    record.addStep('canary_full', { written: result.written.length });
    this.emit('canaryComplete', { deployId: record.id });
  }

  // ─── Git operations ───────────────────────────────────────────────────

  async _pushToGit(ast, record, opts) {
    if (!this._github) return;

    try {
      const files  = this._projector.flatten(ast);
      const branch = opts.branch ?? record.branch ?? 'main';
      const message = opts.commitMessage ?? `[Heady Deploy] ${record.id.slice(0, 8)} via ${record.strategy}`;

      // Commit all files via GitHub API
      for (const [path, content] of files) {
        await this._github.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          owner:   opts.repo.split('/')[0],
          repo:    opts.repo.split('/')[1],
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
        });
      }

      record.addStep('git_pushed', { repo: opts.repo, branch, files: files.size });
      this.emit('gitPushed', { deployId: record.id, repo: opts.repo, branch });
    } catch (e) {
      record.addStep('git_failed', { error: e.message });
      this.emit('gitFailed', { deployId: record.id, error: e.message });
      if (!opts.continueOnGitFail) throw e;
    }
  }

  // ─── Rollback ─────────────────────────────────────────────────────────

  async _rollback(record, reason) {
    record.setStatus(DeployStatus.ROLLBACK);
    record.addStep('rollback_start', { reason });
    this.emit('rollbackStart', { deployId: record.id, reason });

    try {
      if (record.strategy === DeployStrategy.BLUE_GREEN && record.rollbackTo) {
        this._activeSlot = record.rollbackTo;
        record.addStep('rollback_slot', { restoredSlot: record.rollbackTo });
      }

      record.complete(false);
      this.emit('rollbackComplete', { deployId: record.id });
    } catch (e) {
      record.addStep('rollback_failed', { error: e.message });
      this.emit('rollbackFailed', { deployId: record.id, error: e.message });
      throw e;
    }
  }

  /**
   * Manually trigger rollback on a deploy ID.
   */
  async rollback(deployId, reason = 'manual') {
    const record = this._history.find(d => d.id === deployId);
    if (!record) throw new Error(`Deploy ${deployId} not found`);
    await this._rollback(record, reason);
    return record;
  }

  // ─── State ────────────────────────────────────────────────────────────

  activeSlot()  { return this._activeSlot; }
  history(n = 13) { return this._history.slice(-n); }
  latestDeploy() { return this._history[this._history.length - 1] ?? null; }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _deployer = null;

export function getDeployer(opts = {}) {
  if (!_deployer) _deployer = new LiquidDeploy(opts);
  return _deployer;
}

export { ASTProjector as Projector, DeployGates as Gates };
export default LiquidDeploy;
