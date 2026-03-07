'use strict';

/**
 * HeadyStack — Secret Lifecycle Management
 * Manages secret health audits, expiry tracking, and rotation triggers.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

const DEFAULT_ROTATION_DAYS = 90;
const WARNING_DAYS = 14;

class SecretRotation extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} [options.secretsManager] - HeadyStack secrets manager instance
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    super();
    this._secretsManager = options.secretsManager || null;
    this._logger = options.logger || console;
    this._registry = new Map(); // secretId → { rotatedAt, expiresAt, policy }
    this._rotationHandlers = new Map(); // secretId → async fn()
    this._auditTimer = null;
    this._auditInterval = options.auditIntervalMs || 6 * 60 * 60 * 1000; // 6h
  }

  /**
   * Register a secret for lifecycle management.
   * @param {string} secretId
   * @param {object} policy
   * @param {number} [policy.rotationDays] - Days before rotation required
   * @param {Date|string} [policy.rotatedAt] - Last rotation timestamp
   * @param {function} [policy.rotationHandler] - async fn() called during rotation
   */
  register(secretId, policy = {}) {
    const rotatedAt = policy.rotatedAt ? new Date(policy.rotatedAt) : new Date();
    const rotationDays = policy.rotationDays || DEFAULT_ROTATION_DAYS;
    const expiresAt = new Date(rotatedAt.getTime() + rotationDays * 86400000);

    this._registry.set(secretId, {
      rotatedAt,
      expiresAt,
      rotationDays,
      healthy: expiresAt > new Date(),
      lastAudit: null,
    });

    if (typeof policy.rotationHandler === 'function') {
      this._rotationHandlers.set(secretId, policy.rotationHandler);
    }

    this._logger.debug && this._logger.debug(`Registered secret: ${secretId}`, {
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Audit all registered secrets for health and expiry.
   * @returns {{ score: number, expired: string[], expiringSoon: string[], healthy: string[], total: number }}
   */
  audit() {
    const now = new Date();
    const expired = [];
    const expiringSoon = [];
    const healthy = [];

    for (const [secretId, meta] of this._registry.entries()) {
      const daysLeft = (meta.expiresAt - now) / 86400000;
      if (daysLeft <= 0) {
        expired.push(secretId);
        meta.healthy = false;
      } else if (daysLeft <= WARNING_DAYS) {
        expiringSoon.push(secretId);
        meta.healthy = true;
      } else {
        healthy.push(secretId);
        meta.healthy = true;
      }
      meta.lastAudit = now;
    }

    const total = this._registry.size;
    const score = total === 0
      ? 100
      : Math.round(((healthy.length + expiringSoon.length) / total) * 100);

    const result = { score, expired, expiringSoon, healthy, total };

    this.emit('audit', result);

    if (expired.length > 0) {
      this._logger.warn && this._logger.warn('Expired secrets detected', { expired });
      this.emit('secrets:expired', expired);
    }
    if (expiringSoon.length > 0) {
      this.emit('secrets:expiring-soon', expiringSoon);
    }

    return result;
  }

  /**
   * Trigger rotation for a specific secret.
   * @param {string} secretId
   * @returns {Promise<{ success: boolean, secretId: string, rotatedAt: string }>}
   */
  async rotate(secretId) {
    const meta = this._registry.get(secretId);
    if (!meta) {
      throw new Error(`SecretRotation: unknown secretId "${secretId}"`);
    }

    this._logger.info && this._logger.info(`Rotating secret: ${secretId}`);
    this.emit('rotation:start', secretId);

    let newValue = null;

    try {
      // Call custom rotation handler if registered
      const handler = this._rotationHandlers.get(secretId);
      if (handler) {
        newValue = await handler(secretId, meta);
      } else if (this._secretsManager && typeof this._secretsManager.rotate === 'function') {
        newValue = await this._secretsManager.rotate(secretId);
      } else {
        // Default: generate a new secure random secret
        newValue = crypto.randomBytes(48).toString('base64url');
        this._logger.warn && this._logger.warn(
          `No rotation handler for "${secretId}" — generated new random value`
        );
      }

      // Update registry
      const rotatedAt = new Date();
      meta.rotatedAt = rotatedAt;
      meta.expiresAt = new Date(rotatedAt.getTime() + meta.rotationDays * 86400000);
      meta.healthy = true;

      const result = { success: true, secretId, rotatedAt: rotatedAt.toISOString() };
      this.emit('rotation:complete', result);
      this._logger.info && this._logger.info(`Secret rotated: ${secretId}`);
      return result;

    } catch (err) {
      const result = { success: false, secretId, error: err.message };
      this.emit('rotation:failed', result);
      this._logger.error && this._logger.error(`Secret rotation failed: ${secretId}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Rotate all expired secrets.
   * @returns {Promise<{ rotated: string[], failed: string[] }>}
   */
  async rotateExpired() {
    const { expired } = this.audit();
    const rotated = [];
    const failed = [];

    for (const secretId of expired) {
      try {
        await this.rotate(secretId);
        rotated.push(secretId);
      } catch (_) {
        failed.push(secretId);
      }
    }

    return { rotated, failed };
  }

  /**
   * Start automatic periodic audit + rotation.
   */
  startAutoRotation() {
    if (this._auditTimer) return;
    this._auditTimer = setInterval(async () => {
      try {
        await this.rotateExpired();
      } catch (err) {
        this._logger.error && this._logger.error('Auto-rotation error', { error: err.message });
      }
    }, this._auditInterval);
    this._auditTimer.unref();
  }

  /**
   * Stop automatic audit timer.
   */
  stopAutoRotation() {
    if (this._auditTimer) {
      clearInterval(this._auditTimer);
      this._auditTimer = null;
    }
  }

  /**
   * Return registry snapshot for observability.
   * @returns {object[]}
   */
  getSnapshot() {
    const now = new Date();
    return Array.from(this._registry.entries()).map(([secretId, meta]) => ({
      secretId,
      rotatedAt: meta.rotatedAt.toISOString(),
      expiresAt: meta.expiresAt.toISOString(),
      daysRemaining: Math.max(0, Math.floor((meta.expiresAt - now) / 86400000)),
      healthy: meta.healthy,
    }));
  }
}

module.exports = { SecretRotation };
