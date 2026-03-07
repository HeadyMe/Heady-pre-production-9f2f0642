'use strict';
/**
 * @module feature-flag-system
 * @description Feature flag system for HeadySystems
 *
 * Features:
 *   - Gradual rollout via Fibonacci percentages: 1→2→3→5→8→13→21→34→55→89→100
 *   - User segment targeting (tier, usage, cohort)
 *   - A/B testing with φ-weighted split (61.8% control / 38.2% variant)
 *   - Redis-backed flag storage with fib(5)=5s local cache
 *   - Flag evaluation SDK
 *
 * φ = 1.618033988749895
 * A/B split: control=61.8% (1/φ), variant=38.2% (1-1/φ)
 * Cache TTL: fib(5)=5s
 */

const crypto = require('crypto');
const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const FIB  = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

/** Fibonacci rollout percentages */
const ROLLOUT_STEPS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100];

/** A/B split: 1/φ control, 1-1/φ variant */
const AB_CONTROL_RATIO  = 1 / PHI;              // 0.618033…
const AB_VARIANT_RATIO  = 1 - (1 / PHI);        // 0.381966…
const FLAG_CACHE_TTL_MS = FIB[5] * 1000;        // fib(5)=5s local cache

// Redis key namespace
const REDIS_NS = 'heady:flags';

// ─────────────────────────────────────────────────────────────────────────────
// Flag Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FeatureFlag
 * @property {string}   id              - Unique flag identifier
 * @property {string}   name            - Human-readable name
 * @property {string}   description
 * @property {boolean}  enabled         - Master kill-switch
 * @property {'boolean'|'percentage'|'segment'|'ab'} type
 * @property {number}   rolloutPercent  - 0–100 (Fibonacci steps)
 * @property {Object}   segments        - { tier: string[], cohort: string[], ... }
 * @property {Object}   abConfig        - A/B configuration
 * @property {string}   createdAt       - ISO timestamp
 * @property {string}   updatedAt       - ISO timestamp
 * @property {string}   owner           - Owning team/engineer
 * @property {string[]} tags
 */

// ─────────────────────────────────────────────────────────────────────────────
// Local Cache
// ─────────────────────────────────────────────────────────────────────────────

/** @private Simple TTL cache for flag objects */
class FlagCache {
  constructor(ttlMs = FLAG_CACHE_TTL_MS) {
    this._cache  = new Map();
    this._ttlMs  = ttlMs;
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._cache.delete(key); return null; }
    return entry.value;
  }

  set(key, value) {
    this._cache.set(key, { value, expiresAt: Date.now() + this._ttlMs });
  }

  delete(key) { this._cache.delete(key); }
  clear()     { this._cache.clear(); }

  get size()  { return this._cache.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flag Store (Redis-backed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class FlagStore
 * Persists feature flags in Redis with local cache.
 */
class FlagStore {
  /**
   * @param {Object} opts
   * @param {Object} opts.redis       - Connected Redis client
   * @param {number} [opts.cacheTtlMs] - Local cache TTL (fib5=5s)
   */
  constructor(opts) {
    this._redis = opts.redis;
    this._cache = new FlagCache(opts.cacheTtlMs ?? FLAG_CACHE_TTL_MS);
  }

  _key(flagId) { return `${REDIS_NS}:${flagId}`; }
  _allKey()    { return `${REDIS_NS}:_index`; }

  async get(flagId) {
    const cached = this._cache.get(flagId);
    if (cached) return cached;
    const raw = await this._redis.get(this._key(flagId));
    if (!raw) return null;
    const flag = JSON.parse(raw);
    this._cache.set(flagId, flag);
    return flag;
  }

  async set(flag) {
    flag.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(flag);
    await this._redis.set(this._key(flag.id), serialized);
    await this._redis.sAdd(this._allKey(), flag.id);
    this._cache.set(flag.id, flag);
    return flag;
  }

  async delete(flagId) {
    await this._redis.del(this._key(flagId));
    await this._redis.sRem(this._allKey(), flagId);
    this._cache.delete(flagId);
  }

  async listAll() {
    const ids = await this._redis.sMembers(this._allKey());
    const flags = await Promise.all(ids.map(id => this.get(id)));
    return flags.filter(Boolean);
  }

  invalidateCache(flagId) {
    if (flagId) this._cache.delete(flagId);
    else        this._cache.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic hash of (flagId + userId) → value 0.0–1.0.
 * Used for stable, sticky rollout assignment.
 *
 * @param {string} flagId
 * @param {string} userId
 * @returns {number} 0.0–1.0
 */
function hashUser(flagId, userId) {
  const hash = crypto.createHash('sha256')
    .update(`${flagId}:${userId}`)
    .digest('hex');
  // Use first 8 hex chars → 32-bit integer, normalize to [0, 1)
  return parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;
}

/**
 * Check if user matches segment targeting rules.
 * @param {Object} user  - { userId, plan, cohort, usageVolume, teamSize }
 * @param {Object} segments
 * @returns {boolean}
 */
function matchesSegment(user, segments) {
  if (!segments || Object.keys(segments).length === 0) return true;

  // Plan tier targeting
  if (segments.tier && segments.tier.length > 0) {
    if (!segments.tier.includes(user.plan)) return false;
  }

  // Cohort targeting
  if (segments.cohort && segments.cohort.length > 0) {
    if (!segments.cohort.includes(user.cohort)) return false;
  }

  // Usage volume targeting (min threshold)
  if (segments.minUsageVolume != null) {
    if ((user.usageVolume ?? 0) < segments.minUsageVolume) return false;
  }

  // Team size targeting
  if (segments.minTeamSize != null) {
    if ((user.teamSize ?? 1) < segments.minTeamSize) return false;
  }

  // Explicit user allowlist
  if (segments.allowlist && segments.allowlist.length > 0) {
    if (!segments.allowlist.includes(user.userId)) return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flag System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class FeatureFlagSystem
 * Complete feature flag management and evaluation system.
 *
 * @extends EventEmitter
 *
 * Events:
 *   flag-created({flag})
 *   flag-updated({flag, before})
 *   flag-deleted({flagId})
 *   evaluated({flagId, userId, result, type})
 */
class FeatureFlagSystem extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {Object} opts.redis   - Connected Redis client
   */
  constructor(opts) {
    super();
    this._store = new FlagStore({ redis: opts.redis });
  }

  // ───────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────

  /**
   * Create a new feature flag.
   * @param {Partial<FeatureFlag>} opts
   * @returns {Promise<FeatureFlag>}
   */
  async create(opts) {
    const flag = {
      id:             opts.id ?? opts.name.toLowerCase().replace(/\s+/g, '_'),
      name:           opts.name,
      description:    opts.description ?? '',
      enabled:        opts.enabled ?? false,
      type:           opts.type ?? 'boolean',
      rolloutPercent: opts.rolloutPercent ?? 0,
      segments:       opts.segments ?? {},
      abConfig: opts.abConfig ?? {
        controlRatio:  AB_CONTROL_RATIO,    // 0.618033
        variantRatio:  AB_VARIANT_RATIO,    // 0.381966
        variantName:   opts.variantName ?? 'variant',
      },
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
      owner:          opts.owner ?? 'platform',
      tags:           opts.tags ?? [],
    };

    await this._store.set(flag);
    this.emit('flag-created', { flag });
    return flag;
  }

  /**
   * Update an existing flag.
   * @param {string} flagId
   * @param {Partial<FeatureFlag>} updates
   * @returns {Promise<FeatureFlag>}
   */
  async update(flagId, updates) {
    const before = await this._store.get(flagId);
    if (!before) throw new Error(`Flag not found: ${flagId}`);
    const after = { ...before, ...updates, id: flagId };
    await this._store.set(after);
    this.emit('flag-updated', { flag: after, before });
    return after;
  }

  /**
   * Delete a flag.
   * @param {string} flagId
   */
  async delete(flagId) {
    await this._store.delete(flagId);
    this.emit('flag-deleted', { flagId });
  }

  /**
   * List all flags.
   * @returns {Promise<FeatureFlag[]>}
   */
  list() { return this._store.listAll(); }

  // ───────────────────────────────────────────────
  // Rollout Management
  // ───────────────────────────────────────────────

  /**
   * Set rollout to the next Fibonacci step.
   * Steps: 1→2→3→5→8→13→21→34→55→89→100
   *
   * @param {string} flagId
   * @returns {Promise<{flag: FeatureFlag, step: number, nextStep: number|null}>}
   */
  async progressRollout(flagId) {
    const flag    = await this._store.get(flagId);
    if (!flag) throw new Error(`Flag not found: ${flagId}`);

    const current = flag.rolloutPercent;
    const stepIdx = ROLLOUT_STEPS.indexOf(current);
    const nextStep = stepIdx >= 0 && stepIdx < ROLLOUT_STEPS.length - 1
      ? ROLLOUT_STEPS[stepIdx + 1]
      : 100;

    const updated = await this.update(flagId, { rolloutPercent: nextStep });
    return { flag: updated, step: nextStep, nextStep: ROLLOUT_STEPS[ROLLOUT_STEPS.indexOf(nextStep) + 1] ?? null };
  }

  /**
   * Set rollout to a specific Fibonacci percentage.
   * Validates that the percentage is in the Fibonacci rollout series.
   *
   * @param {string} flagId
   * @param {number} percent - Must be one of ROLLOUT_STEPS
   * @returns {Promise<FeatureFlag>}
   */
  async setRollout(flagId, percent) {
    if (!ROLLOUT_STEPS.includes(percent)) {
      throw new Error(`Rollout percent must be a Fibonacci step: ${ROLLOUT_STEPS.join(',')}`);
    }
    return this.update(flagId, { rolloutPercent: percent });
  }

  // ───────────────────────────────────────────────
  // Evaluation
  // ───────────────────────────────────────────────

  /**
   * Evaluate a flag for a user.
   *
   * @param {string} flagId
   * @param {Object} user   - { userId, plan, cohort, usageVolume, teamSize }
   * @param {*} [defaultValue=false]
   * @returns {Promise<{enabled: boolean, variant: string|null, reason: string}>}
   */
  async evaluate(flagId, user, defaultValue = false) {
    const flag = await this._store.get(flagId);

    if (!flag) {
      return { enabled: defaultValue, variant: null, reason: 'flag-not-found' };
    }

    if (!flag.enabled) {
      this.emit('evaluated', { flagId, userId: user.userId, result: false, type: flag.type, reason: 'flag-disabled' });
      return { enabled: false, variant: null, reason: 'flag-disabled' };
    }

    // Segment check
    if (!matchesSegment(user, flag.segments)) {
      this.emit('evaluated', { flagId, userId: user.userId, result: false, type: flag.type, reason: 'segment-miss' });
      return { enabled: false, variant: null, reason: 'segment-miss' };
    }

    let result;
    let variant = null;
    let reason  = 'evaluated';

    switch (flag.type) {
      case 'boolean':
        result = true;
        reason = 'boolean-enabled';
        break;

      case 'percentage': {
        const userHash = hashUser(flagId, user.userId);
        result = userHash < (flag.rolloutPercent / 100);
        reason = result ? 'percentage-in' : 'percentage-out';
        break;
      }

      case 'ab': {
        const userHash = hashUser(flagId, user.userId);
        const inControl = userHash < AB_CONTROL_RATIO;   // 61.8%
        result  = !inControl;                             // variant = enabled
        variant = inControl ? 'control' : (flag.abConfig?.variantName ?? 'variant');
        reason  = `ab-${variant}`;
        break;
      }

      case 'segment':
        result = true;   // already passed segment check above
        reason = 'segment-match';
        break;

      default:
        result = false;
        reason = 'unknown-type';
    }

    this.emit('evaluated', { flagId, userId: user.userId, result, variant, type: flag.type, reason });
    return { enabled: result, variant, reason };
  }

  /**
   * Evaluate multiple flags at once.
   * @param {string[]} flagIds
   * @param {Object} user
   * @returns {Promise<Object>} flagId → evaluation result map
   */
  async evaluateAll(flagIds, user) {
    const results = await Promise.all(
      flagIds.map(async (id) => [id, await this.evaluate(id, user)])
    );
    return Object.fromEntries(results);
  }

  /**
   * Check if a flag is enabled (simplified boolean).
   * @param {string} flagId
   * @param {Object} user
   * @returns {Promise<boolean>}
   */
  async isEnabled(flagId, user) {
    const result = await this.evaluate(flagId, user);
    return result.enabled;
  }

  // ───────────────────────────────────────────────
  // Metrics
  // ───────────────────────────────────────────────

  async metrics() {
    const flags = await this.list();
    return {
      timestamp:       new Date().toISOString(),
      phi:             PHI,
      totalFlags:      flags.length,
      enabled:         flags.filter(f => f.enabled).length,
      disabled:        flags.filter(f => !f.enabled).length,
      byType:          Object.fromEntries(
        ['boolean', 'percentage', 'segment', 'ab'].map(t => [
          t, flags.filter(f => f.type === t).length
        ])
      ),
      rolloutSteps:    ROLLOUT_STEPS,
      abSplit:         { control: AB_CONTROL_RATIO, variant: AB_VARIANT_RATIO },
      cacheSize:       this._store._cache.size,
      cacheTtlMs:      FLAG_CACHE_TTL_MS,            // 5000 (fib5)
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  FeatureFlagSystem,
  FlagStore,
  FlagCache,
  hashUser,
  matchesSegment,
  ROLLOUT_STEPS,
  AB_CONTROL_RATIO,    // 0.618033 (1/φ)
  AB_VARIANT_RATIO,    // 0.381966 (1-1/φ)
  FLAG_CACHE_TTL_MS,   // 5000 (fib5)
  PHI,
  FIB,
};
