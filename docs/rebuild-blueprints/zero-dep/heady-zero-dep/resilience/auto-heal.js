/**
 * @file auto-heal.js
 * @description Self-healing mesh: health checks, quarantine, recovery, attestation.
 *
 * Lifecycle: healthy → degraded → quarantined → healing → attesting → healthy
 *
 * Features:
 * - Health check scheduler (PHI-interval polling)
 * - Quarantine manager (isolate degraded services)
 * - Recovery actions: restart, reconfigure, failover
 * - Attestation before restoration (verify health before re-admitting)
 * - Incident logging with full audit trail
 *
 * Sacred Geometry: PHI-scaled check intervals, Fibonacci quarantine tiers.
 * Zero external dependencies (events, crypto, fs, os).
 *
 * @module HeadyResilience/AutoHeal
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── Service Health Status ────────────────────────────────────────────────────
export const HealthStatus = Object.freeze({
  HEALTHY:     'healthy',
  DEGRADED:    'degraded',
  QUARANTINED: 'quarantined',
  HEALING:     'healing',
  ATTESTING:   'attesting',
  UNKNOWN:     'unknown',
});

// ─── Recovery Actions ─────────────────────────────────────────────────────────
export const RecoveryAction = Object.freeze({
  RESTART:     'restart',
  RECONFIGURE: 'reconfigure',
  FAILOVER:    'failover',
  WAIT:        'wait',
});

// ─── Incident Record ─────────────────────────────────────────────────────────
class Incident {
  constructor(serviceId, type, details = {}) {
    this.id          = randomUUID();
    this.serviceId   = serviceId;
    this.type        = type;
    this.details     = details;
    this.ts          = Date.now();
    this.resolved    = false;
    this.resolvedAt  = null;
    this.timeline    = [{ ts: this.ts, event: 'opened', details }];
  }

  addEvent(event, details = {}) {
    this.timeline.push({ ts: Date.now(), event, details });
  }

  resolve(details = {}) {
    this.resolved   = true;
    this.resolvedAt = Date.now();
    this.addEvent('resolved', details);
  }

  toJSON() {
    return {
      id:         this.id,
      serviceId:  this.serviceId,
      type:       this.type,
      ts:         this.ts,
      resolved:   this.resolved,
      resolvedAt: this.resolvedAt,
      timeline:   this.timeline,
    };
  }
}

// ─── Service Entry ────────────────────────────────────────────────────────────
class ServiceEntry {
  constructor(id, config = {}) {
    this.id           = id;
    this.status       = HealthStatus.UNKNOWN;
    this.checkFn      = config.checkFn ?? null;         // async () => { ok, details }
    this.recoverFns   = config.recoverFns ?? {};        // { restart, reconfigure, failover }
    this.intervalMs   = config.intervalMs ?? 10_000;    // base check interval
    this.failThreshold = config.failThreshold ?? 3;     // failures before quarantine
    this.passThreshold = config.passThreshold ?? 2;     // successes to attest
    this.quarantineTier = 0;                            // escalation tier (Fibonacci-based)
    this.consecutiveFails    = 0;
    this.consecutivePasses   = 0;
    this.lastCheckAt  = 0;
    this.lastCheckResult = null;
    this.activeIncident = null;
    this.metadata     = config.metadata ?? {};
  }

  get nextCheckMs() {
    // PHI-scaled interval based on quarantine tier
    return Math.floor(this.intervalMs * Math.pow(PHI, this.quarantineTier));
  }

  isDue() {
    return Date.now() - this.lastCheckAt >= this.nextCheckMs;
  }
}

// ─── AutoHeal ────────────────────────────────────────────────────────────────
export class AutoHeal extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.logDir        Incident log directory
   * @param {number} opts.tickMs        Scheduler tick interval
   * @param {number} opts.maxIncidents  Max incidents in memory (ring buffer)
   */
  constructor(opts = {}) {
    super();
    this.opts = {
      logDir:       opts.logDir       ?? path.join(os.tmpdir(), 'heady-autoheal'),
      tickMs:       opts.tickMs       ?? 2_000,
      maxIncidents: opts.maxIncidents ?? 233,
    };
    this._services  = new Map();   // id → ServiceEntry
    this._incidents = [];          // ring buffer of Incidents
    this._timer     = null;
    this._running   = false;

    fs.mkdirSync(this.opts.logDir, { recursive: true });
  }

  // ── Service Registration ──────────────────────────────────────────────────

  /**
   * Register a service for health monitoring.
   *
   * @param {string}   id
   * @param {object}   config
   * @param {Function} config.checkFn        async () => { ok: bool, details?: any }
   * @param {object}   config.recoverFns     { restart?, reconfigure?, failover? }
   * @param {number}   config.intervalMs
   * @param {number}   config.failThreshold
   * @param {number}   config.passThreshold
   */
  register(id, config = {}) {
    if (this._services.has(id)) {
      throw new Error(`AutoHeal: service '${id}' already registered`);
    }
    this._services.set(id, new ServiceEntry(id, config));
    this.emit('registered', { serviceId: id });
    return this;
  }

  unregister(id) {
    this._services.delete(id);
    this.emit('unregistered', { serviceId: id });
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  _tick() {
    if (!this._running) return;
    const now = Date.now();

    const checks = [];
    for (const svc of this._services.values()) {
      if (svc.isDue()) {
        checks.push(this._checkService(svc));
      }
    }

    Promise.allSettled(checks).then(() => {
      if (!this._running) return;
      this._timer = setTimeout(() => this._tick(), this.opts.tickMs);
    });
  }

  // ── Health Check ──────────────────────────────────────────────────────────

  async _checkService(svc) {
    svc.lastCheckAt = Date.now();

    let result = { ok: false, details: 'no check function' };
    if (svc.checkFn) {
      try {
        result = await svc.checkFn();
      } catch (err) {
        result = { ok: false, details: err.message };
      }
    }
    svc.lastCheckResult = result;

    if (result.ok) {
      await this._onPass(svc, result);
    } else {
      await this._onFail(svc, result);
    }
  }

  async _onPass(svc, result) {
    svc.consecutiveFails = 0;
    svc.consecutivePasses++;

    if (svc.status === HealthStatus.ATTESTING) {
      if (svc.consecutivePasses >= svc.passThreshold) {
        await this._restore(svc);
      }
    } else if (svc.status !== HealthStatus.HEALTHY) {
      this._setStatus(svc, HealthStatus.ATTESTING);
    } else {
      // Already healthy — decay quarantine tier
      if (svc.quarantineTier > 0) svc.quarantineTier--;
    }
  }

  async _onFail(svc, result) {
    svc.consecutivePasses = 0;
    svc.consecutiveFails++;

    if (svc.status === HealthStatus.HEALTHY || svc.status === HealthStatus.UNKNOWN) {
      if (svc.consecutiveFails >= Math.ceil(svc.failThreshold * PHI_INV + 1)) {
        this._setStatus(svc, HealthStatus.DEGRADED);
        this._openIncident(svc, 'degraded', result);
        this.emit('degraded', { serviceId: svc.id, result });
      }
    }

    if (svc.consecutiveFails >= svc.failThreshold) {
      if (svc.status !== HealthStatus.QUARANTINED && svc.status !== HealthStatus.HEALING) {
        await this._quarantine(svc, result);
      }
    }
  }

  // ── Quarantine & Recovery ─────────────────────────────────────────────────

  async _quarantine(svc, result) {
    this._setStatus(svc, HealthStatus.QUARANTINED);
    svc.quarantineTier = Math.min(svc.quarantineTier + 1, FIBONACCI.length - 1);
    this.emit('quarantined', { serviceId: svc.id, tier: svc.quarantineTier });

    // Decide recovery action
    const action = this._selectRecoveryAction(svc);
    await this._heal(svc, action, result);
  }

  _selectRecoveryAction(svc) {
    const tier = svc.quarantineTier;
    // Fibonacci-tiered escalation
    if (tier <= 2)  return RecoveryAction.RESTART;
    if (tier <= 5)  return RecoveryAction.RECONFIGURE;
    if (tier <= 10) return RecoveryAction.FAILOVER;
    return RecoveryAction.WAIT;
  }

  async _heal(svc, action, result) {
    this._setStatus(svc, HealthStatus.HEALING);
    svc.activeIncident?.addEvent('healing', { action });
    this.emit('healing', { serviceId: svc.id, action });

    try {
      const recoverFn = svc.recoverFns[action];
      if (recoverFn) {
        await recoverFn({ serviceId: svc.id, action, result });
      }
      // After recovery attempt, move to attestation
      svc.consecutivePasses = 0;
      this._setStatus(svc, HealthStatus.ATTESTING);
    } catch (err) {
      svc.activeIncident?.addEvent('healFailed', { error: err.message });
      this.emit('healFailed', { serviceId: svc.id, error: err.message });
      // Stay in quarantine with escalated tier
      this._setStatus(svc, HealthStatus.QUARANTINED);
    }
  }

  async _restore(svc) {
    const prev = svc.status;
    this._setStatus(svc, HealthStatus.HEALTHY);
    svc.consecutiveFails  = 0;
    svc.consecutivePasses = 0;

    if (svc.activeIncident) {
      svc.activeIncident.resolve({ prevStatus: prev });
      await this._persistIncident(svc.activeIncident);
      svc.activeIncident = null;
    }

    this.emit('restored', { serviceId: svc.id });
  }

  // ── Status Management ─────────────────────────────────────────────────────

  _setStatus(svc, status) {
    const prev  = svc.status;
    svc.status  = status;
    this.emit('statusChange', { serviceId: svc.id, from: prev, to: status, ts: Date.now() });
  }

  // ── Incident Management ───────────────────────────────────────────────────

  _openIncident(svc, type, details) {
    if (svc.activeIncident) return;
    const incident = new Incident(svc.id, type, details);
    svc.activeIncident = incident;

    if (this._incidents.length >= this.opts.maxIncidents) {
      this._incidents.shift();
    }
    this._incidents.push(incident);
    this.emit('incident', { incident: incident.toJSON() });
  }

  async _persistIncident(incident) {
    const fname = `incident-${incident.ts}-${incident.id.slice(0, 8)}.json`;
    const fpath = path.join(this.opts.logDir, fname);
    try {
      fs.writeFileSync(fpath, JSON.stringify(incident.toJSON(), null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }

  // ── Manual Control ────────────────────────────────────────────────────────

  /**
   * Force a health check for a service.
   */
  async forceCheck(id) {
    const svc = this._services.get(id);
    if (!svc) throw new Error(`AutoHeal: unknown service '${id}'`);
    await this._checkService(svc);
  }

  /**
   * Manually quarantine a service.
   */
  async forceQuarantine(id) {
    const svc = this._services.get(id);
    if (!svc) throw new Error(`AutoHeal: unknown service '${id}'`);
    await this._quarantine(svc, { details: 'manual-quarantine' });
  }

  /**
   * Manually restore a service (bypasses attestation).
   */
  async forceRestore(id) {
    const svc = this._services.get(id);
    if (!svc) throw new Error(`AutoHeal: unknown service '${id}'`);
    svc.consecutivePasses = svc.passThreshold;
    await this._restore(svc);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  status() {
    const result = {};
    for (const [id, svc] of this._services) {
      result[id] = {
        status:           svc.status,
        quarantineTier:   svc.quarantineTier,
        consecutiveFails: svc.consecutiveFails,
        lastCheckAt:      svc.lastCheckAt,
        lastCheckResult:  svc.lastCheckResult,
        activeIncident:   svc.activeIncident?.id ?? null,
      };
    }
    return result;
  }

  incidents(limit = 50) {
    return this._incidents.slice(-limit).map(i => i.toJSON());
  }
}

export default AutoHeal;
