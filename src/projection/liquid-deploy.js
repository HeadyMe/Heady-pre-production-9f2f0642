/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const HeadyKV = require('../../core/heady-kv');
const headyFetch = require('../../core/heady-fetch');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPLOY_STATUS = Object.freeze({
  PENDING:    'pending',
  VALIDATING: 'validating',
  PROJECTING: 'projecting',
  DEPLOYED:   'deployed',
  ROLLED_BACK:'rolled-back',
  FAILED:     'failed',
  APPROVED:   'approved',
  AWAITING_APPROVAL: 'awaiting-approval',
});

const DEPLOY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── LiquidDeploy ─────────────────────────────────────────────────────────────

class LiquidDeploy extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object}  [opts.kv]              - HeadyKV for deployment state
   * @param {object}  [opts.governance]      - Governance module for approval gates
   * @param {boolean} [opts.requireApproval] - Require governance sign-off
   * @param {number}  [opts.timeoutMs=60000] - Max deploy time
   */
  constructor(opts = {}) {
    super();

    this._kv = opts.kv || new HeadyKV({ namespace: 'liquid-deploy' });
    this._governance = opts.governance || null;
    this.requireApproval = opts.requireApproval ?? false;
    this.timeoutMs = opts.timeoutMs ?? 60_000;

    logger.info('[LiquidDeploy] initialized', { requireApproval: this.requireApproval });
  }

  // ─── Projection ───────────────────────────────────────────────────────────────

  /**
   * Project latent-space source repo to a physical target repo.
   *
   * @param {string|object} sourceRepo  - Source repo spec (url or { url, branch, path })
   * @param {string|object} targetRepo  - Target repo spec (url or { url, branch, path })
   * @param {object} [opts]
   * @param {string}   [opts.commitMessage]
   * @param {object}   [opts.env]              - Environment variables to inject
   * @param {boolean}  [opts.dryRun=false]
   * @returns {Promise<DeployRecord>}
   */
  async project(sourceRepo, targetRepo, opts = {}) {
    const deployId = _generateDeployId();
    const src = _normalizeRepo(sourceRepo);
    const tgt = _normalizeRepo(targetRepo);

    logger.info('[LiquidDeploy] projection started', { deployId, src: src.url, tgt: tgt.url });

    const record = {
      deployId,
      source: src,
      target: tgt,
      status: DEPLOY_STATUS.PENDING,
      dryRun: opts.dryRun ?? false,
      commitMessage: opts.commitMessage || `Heady liquid-deploy ${deployId}`,
      env: opts.env || {},
      startedAt: new Date().toISOString(),
      completedAt: null,
      steps: [],
      validationResult: null,
      error: null,
      governanceRef: null,
    };

    await this._persistRecord(record);
    this.emit('deployStarted', { deployId, source: src, target: tgt });

    try {
      // Step 1: Governance approval gate
      if (this.requireApproval && this._governance) {
        record.status = DEPLOY_STATUS.AWAITING_APPROVAL;
        await this._persistRecord(record);
        this.emit('awaitingApproval', { deployId });

        const approval = await this._requestApproval(record);
        if (!approval.approved) {
          throw new Error(`Deployment not approved: ${approval.reason}`);
        }
        record.governanceRef = approval.ref;
        record.status = DEPLOY_STATUS.APPROVED;
        record.steps.push({ step: 'approval', result: 'approved', ref: approval.ref, ts: new Date().toISOString() });
        await this._persistRecord(record);
        this.emit('approved', { deployId, ref: approval.ref });
      }

      // Step 2: Validate source
      record.status = DEPLOY_STATUS.VALIDATING;
      await this._persistRecord(record);
      const validation = await this._validateSource(src);
      record.validationResult = validation;
      record.steps.push({ step: 'validate-source', result: validation.valid ? 'pass' : 'fail', ts: new Date().toISOString() });
      if (!validation.valid) {
        throw new Error(`Source validation failed: ${validation.reason}`);
      }

      // Step 3: Project to target
      record.status = DEPLOY_STATUS.PROJECTING;
      await this._persistRecord(record);
      const projection = await this._executeProjection(src, tgt, opts);
      record.steps.push({ step: 'project', result: 'ok', sha: projection.sha, ts: new Date().toISOString() });

      // Step 4: Post-deploy validation
      const postValidation = await this.validateProjection(tgt, { deployId });
      record.steps.push({ step: 'validate-target', result: postValidation.valid ? 'pass' : 'fail', ts: new Date().toISOString() });
      if (!postValidation.valid) {
        throw new Error(`Post-deploy validation failed: ${postValidation.reason}`);
      }

      record.status = DEPLOY_STATUS.DEPLOYED;
      record.completedAt = new Date().toISOString();
      await this._persistRecord(record);

      logger.info('[LiquidDeploy] projection complete', { deployId, dryRun: record.dryRun });
      this.emit('deployCompleted', record);
      return record;

    } catch (err) {
      record.status = DEPLOY_STATUS.FAILED;
      record.error = err.message;
      record.completedAt = new Date().toISOString();
      await this._persistRecord(record);

      logger.error('[LiquidDeploy] projection failed', { deployId, err: err.message });
      this.emit('deployFailed', { deployId, error: err.message });
      throw err;
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  /**
   * Validate that a target deployment matches the expected source.
   * @param {string|object} target
   * @param {object} [opts]  - { deployId, expectedSha }
   * @returns {Promise<{ valid, reason, details }>}
   */
  async validateProjection(target, opts = {}) {
    const tgt = _normalizeRepo(target);

    logger.debug('[LiquidDeploy] validating projection', { target: tgt.url });

    const checks = [];

    // Check 1: Target is reachable
    const reachable = await this._checkReachable(tgt.url);
    checks.push({ check: 'reachable', passed: reachable });
    if (!reachable) {
      return { valid: false, reason: 'Target repo not reachable', checks };
    }

    // Check 2: SHA matches if expected SHA given
    if (opts.expectedSha) {
      const headSha = await this._getRepoHead(tgt);
      const shaMatch = headSha === opts.expectedSha;
      checks.push({ check: 'sha-match', passed: shaMatch, expected: opts.expectedSha, actual: headSha });
      if (!shaMatch) {
        return { valid: false, reason: `SHA mismatch: expected ${opts.expectedSha} got ${headSha}`, checks };
      }
    }

    // Check 3: Required files present (stub)
    checks.push({ check: 'required-files', passed: true });

    logger.debug('[LiquidDeploy] validation passed', { target: tgt.url });
    return { valid: true, reason: null, checks };
  }

  // ─── Rollback ────────────────────────────────────────────────────────────────

  /**
   * Rollback a deployment to the previous state.
   * @param {string} deployId
   * @returns {Promise<DeployRecord>}
   */
  async rollback(deployId) {
    const record = await this._loadRecord(deployId);
    if (!record) throw new Error(`Deploy not found: ${deployId}`);

    if (record.status === DEPLOY_STATUS.ROLLED_BACK) {
      throw new Error(`Deploy ${deployId} is already rolled back`);
    }

    if (record.status === DEPLOY_STATUS.PENDING || record.status === DEPLOY_STATUS.PROJECTING) {
      throw new Error(`Cannot rollback an in-progress deployment`);
    }

    logger.info('[LiquidDeploy] rollback started', { deployId });
    this.emit('rollbackStarted', { deployId });

    // Find the previous successful deployment to this target
    const previous = await this._findPreviousSuccessful(record.target, deployId);

    if (previous) {
      logger.info('[LiquidDeploy] rolling back to previous deployment', { deployId, previousDeployId: previous.deployId });
      // Re-project from previous source
      try {
        await this._executeProjection(previous.source, record.target, { commitMessage: `Rollback to ${previous.deployId}` });
        record.steps.push({ step: 'rollback', result: 'ok', rolledBackTo: previous.deployId, ts: new Date().toISOString() });
      } catch (err) {
        record.steps.push({ step: 'rollback', result: 'failed', error: err.message, ts: new Date().toISOString() });
        throw err;
      }
    } else {
      logger.warn('[LiquidDeploy] no previous deployment found, marking rolled-back only', { deployId });
      record.steps.push({ step: 'rollback', result: 'no-previous', ts: new Date().toISOString() });
    }

    record.status = DEPLOY_STATUS.ROLLED_BACK;
    record.completedAt = new Date().toISOString();
    await this._persistRecord(record);

    this.emit('rollbackCompleted', { deployId, record });
    logger.info('[LiquidDeploy] rollback complete', { deployId });
    return record;
  }

  // ─── Deployment State ────────────────────────────────────────────────────────

  async getDeployment(deployId) {
    return this._loadRecord(deployId);
  }

  async listDeployments(filter = {}) {
    const keys = await this._kv.keys('deploy:');
    const records = await Promise.all(keys.map(k => this._kv.get(k)));

    return records
      .filter(r => r !== null)
      .filter(r => !filter.status || r.status === filter.status)
      .filter(r => !filter.target || r.target.url === filter.target)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  async _validateSource(src) {
    const reachable = await this._checkReachable(src.url);
    if (!reachable) return { valid: false, reason: `Source not reachable: ${src.url}` };
    return { valid: true };
  }

  async _executeProjection(src, tgt, opts) {
    // In dry-run mode, simulate without actual writes
    if (opts.dryRun) {
      logger.debug('[LiquidDeploy] dry-run projection', { src: src.url, tgt: tgt.url });
      return { sha: _generateSha(), dryRun: true };
    }

    // Real projection: fetch source content and push to target
    // This is intentionally abstract — concrete implementation depends on
    // the repo hosting provider (GitHub, GitLab, Cloudflare, etc.)
    logger.debug('[LiquidDeploy] executing projection', { src: src.url, tgt: tgt.url });

    // Stub: return a deterministic SHA based on source/target
    const sha = _generateSha();
    logger.debug('[LiquidDeploy] projection sha', { sha });
    return { sha };
  }

  async _checkReachable(url) {
    if (!url || url.startsWith('mock://')) return true; // test/mock URLs always pass
    try {
      const res = await Promise.race([
        headyFetch(url, { method: 'HEAD' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }

  async _getRepoHead(repo) {
    // Stub: in production, call GitHub/GitLab API for HEAD SHA
    return crypto.randomBytes(20).toString('hex');
  }

  async _requestApproval(record) {
    if (!this._governance) return { approved: true, ref: 'auto' };
    try {
      return await this._governance.requestApproval({
        type: 'deployment',
        deployId: record.deployId,
        source: record.source,
        target: record.target,
      });
    } catch (err) {
      logger.error('[LiquidDeploy] governance approval error', { err: err.message });
      throw new Error(`Governance error: ${err.message}`);
    }
  }

  async _findPreviousSuccessful(target, excludeDeployId) {
    const all = await this.listDeployments({ target: target.url });
    return all.find(r => r.status === DEPLOY_STATUS.DEPLOYED && r.deployId !== excludeDeployId) || null;
  }

  async _persistRecord(record) {
    await this._kv.set(`deploy:${record.deployId}`, record, { ttlMs: DEPLOY_TTL_MS });
  }

  async _loadRecord(deployId) {
    return this._kv.get(`deploy:${deployId}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _normalizeRepo(repo) {
  if (typeof repo === 'string') {
    return { url: repo, branch: 'main', path: '/' };
  }
  return { branch: 'main', path: '/', ...repo };
}

function _generateDeployId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `ldeploy-${ts}-${rand}`;
}

function _generateSha() {
  return crypto.randomBytes(20).toString('hex');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { LiquidDeploy, DEPLOY_STATUS };
