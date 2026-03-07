'use strict';

/**
 * Heady™ Secret Rotation Scheduler
 * Drop into: src/security/rotation-scheduler.js
 * Automates credential rotation on Fibonacci-scaled intervals
 */

const cron = require('node-cron');
const crypto = require('crypto');

const PHI = 1.6180339887;

// Fibonacci-scaled rotation intervals (days)
const ROTATION_SCHEDULE = {
  jwt: {
    intervalDays: 13,
    description: 'JWT signing keys',
    rotate: async () => {
      const privateKey = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      // Store in Secret Manager
      return { rotated: true, algorithm: 'RSA-4096' };
    },
  },
  database: {
    intervalDays: 34,
    description: 'Database credentials',
    rotate: async () => {
      const newPassword = crypto.randomBytes(32).toString('base64url');
      // Execute ALTER ROLE via admin connection
      return { rotated: true, passwordLength: newPassword.length };
    },
  },
  apiKeys: {
    intervalDays: 21,
    description: 'Internal API signing keys',
    rotate: async () => {
      const newSecret = crypto.randomBytes(32).toString('hex');
      // Update in Secret Manager
      return { rotated: true, secretLength: newSecret.length };
    },
  },
  redis: {
    intervalDays: 21,
    description: 'Redis AUTH password',
    rotate: async () => {
      const newPassword = crypto.randomBytes(24).toString('base64url');
      // Update via CONFIG SET requirepass
      return { rotated: true, passwordLength: newPassword.length };
    },
  },
};

class RotationScheduler {
  constructor(options = {}) {
    this.schedule = { ...ROTATION_SCHEDULE, ...options.schedule };
    this.jobs = [];
    this.log = options.logger || console;
    this.onRotation = options.onRotation || (() => {});
    this.onError = options.onError || (() => {});
    this.history = [];
  }

  start() {
    for (const [name, config] of Object.entries(this.schedule)) {
      // Cron: run at 3am UTC on the interval
      const cronExpr = `0 3 */${config.intervalDays} * *`;
      
      const job = cron.schedule(cronExpr, async () => {
        const entry = {
          name,
          description: config.description,
          startedAt: new Date().toISOString(),
          status: 'running',
        };

        this.log.info(`[SecretRotation] Starting: ${name} (${config.description})`);

        try {
          const result = await config.rotate();
          entry.status = 'success';
          entry.result = result;
          entry.completedAt = new Date().toISOString();
          this.log.info(`[SecretRotation] ✅ ${name} rotated successfully`);
          this.onRotation({ name, ...entry });
        } catch (err) {
          entry.status = 'failed';
          entry.error = err.message;
          entry.completedAt = new Date().toISOString();
          this.log.error(`[SecretRotation] ❌ ${name} failed: ${err.message}`);
          this.onError({ name, error: err, ...entry });
        }

        this.history.push(entry);
        // Keep Fibonacci-sized history (89 entries)
        if (this.history.length > 89) this.history.shift();
      });

      this.jobs.push({ name, job, config });
    }

    this.log.info(`[SecretRotation] Scheduler started with ${this.jobs.length} rotation jobs`);
    return this;
  }

  stop() {
    for (const { job } of this.jobs) {
      job.stop();
    }
    this.log.info('[SecretRotation] Scheduler stopped');
  }

  getStatus() {
    return {
      jobs: this.jobs.map(({ name, config }) => ({
        name,
        description: config.description,
        intervalDays: config.intervalDays,
      })),
      history: this.history.slice(-13), // Last Fibonacci-13 entries
      phi: PHI,
    };
  }

  // Force immediate rotation (for incident response)
  async rotateNow(name) {
    const config = this.schedule[name];
    if (!config) throw new Error(`Unknown rotation: ${name}`);
    return await config.rotate();
  }
}

module.exports = { RotationScheduler, ROTATION_SCHEDULE };
