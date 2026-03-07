'use strict';

/**
 * HeadyGuard — Rate Limiter
 *
 * Per-user abuse prevention using sliding window counters:
 *  - Requests per minute (RPM)
 *  - Requests per hour (RPH)
 *  - Tokens per minute (TPM)
 *  - Tokens per hour (TPH)
 *  - Burst detection (N requests in M ms)
 *
 * All state is held in-process (Map). For multi-instance deployments,
 * swap the store implementation with a Redis adapter.
 */

const STAGE_NAME = 'rate_limit';

// ── In-memory sliding window store ───────────────────────────────────────────

/**
 * A sliding window counter stored as a ring of timestamped events.
 * windowMs: size of the window in milliseconds
 * limit:    max events allowed in the window
 */
class SlidingWindowCounter {
  constructor(windowMs, limit) {
    this.windowMs = windowMs;
    this.limit    = limit;
    // Map<userId, Array<timestamp>>
    this._store   = new Map();
  }

  /** Prune timestamps outside the window */
  _prune(userId) {
    const now    = Date.now();
    const cutoff = now - this.windowMs;
    const arr = this._store.get(userId);
    if (!arr) return [];
    const pruned = arr.filter(ts => ts > cutoff);
    this._store.set(userId, pruned);
    return pruned;
  }

  /** Check if userId is within the limit without recording */
  check(userId) {
    const events = this._prune(userId);
    return {
      count:     events.length,
      limit:     this.limit,
      remaining: Math.max(0, this.limit - events.length),
      exceeded:  events.length >= this.limit,
    };
  }

  /** Record an event and return whether the limit was exceeded */
  record(userId, count = 1) {
    const events = this._prune(userId);
    const now = Date.now();
    for (let i = 0; i < count; i++) events.push(now);
    this._store.set(userId, events);
    return {
      count:     events.length,
      limit:     this.limit,
      remaining: Math.max(0, this.limit - events.length),
      exceeded:  events.length > this.limit,
    };
  }

  /** Reset a user's counter */
  reset(userId) {
    this._store.delete(userId);
  }

  /** Prune all expired entries across all users */
  gc() {
    for (const userId of this._store.keys()) {
      this._prune(userId);
      if ((this._store.get(userId) || []).length === 0) {
        this._store.delete(userId);
      }
    }
  }
}

// ── Token usage counter (sliding window, but records token amounts) ───────────

class TokenWindowCounter {
  constructor(windowMs, limit) {
    this.windowMs = windowMs;
    this.limit    = limit;
    // Map<userId, Array<{ts, tokens}>>
    this._store   = new Map();
  }

  _prune(userId) {
    const now    = Date.now();
    const cutoff = now - this.windowMs;
    const arr = this._store.get(userId) || [];
    const pruned = arr.filter(e => e.ts > cutoff);
    this._store.set(userId, pruned);
    return pruned;
  }

  _sum(events) {
    return events.reduce((acc, e) => acc + e.tokens, 0);
  }

  check(userId) {
    const events = this._prune(userId);
    const used   = this._sum(events);
    return {
      used,
      limit:     this.limit,
      remaining: Math.max(0, this.limit - used),
      exceeded:  used >= this.limit,
    };
  }

  record(userId, tokens) {
    const events = this._prune(userId);
    events.push({ ts: Date.now(), tokens });
    this._store.set(userId, events);
    const used = this._sum(events);
    return {
      used,
      limit:     this.limit,
      remaining: Math.max(0, this.limit - used),
      exceeded:  used > this.limit,
    };
  }

  reset(userId) {
    this._store.delete(userId);
  }

  gc() {
    for (const userId of this._store.keys()) {
      this._prune(userId);
      if ((this._store.get(userId) || []).length === 0) {
        this._store.delete(userId);
      }
    }
  }
}

// ── Burst detector ────────────────────────────────────────────────────────────

class BurstDetector {
  constructor(windowMs, limit) {
    this.windowMs = windowMs;
    this.limit    = limit;
    // Same as SlidingWindowCounter
    this._store   = new Map();
  }

  _prune(userId) {
    const cutoff = Date.now() - this.windowMs;
    const arr = this._store.get(userId) || [];
    const pruned = arr.filter(ts => ts > cutoff);
    this._store.set(userId, pruned);
    return pruned;
  }

  record(userId) {
    const events = this._prune(userId);
    events.push(Date.now());
    this._store.set(userId, events);
    return {
      count:    events.length,
      limit:    this.limit,
      burst:    events.length > this.limit,
    };
  }

  reset(userId) {
    this._store.delete(userId);
  }
}

// ── Rate limiter singleton ────────────────────────────────────────────────────

let _counters = null;

function _getCounters(cfg) {
  if (!_counters) {
    _counters = {
      rpmCounter:   new SlidingWindowCounter(60_000,    cfg.requestsPerMinute),
      rphCounter:   new SlidingWindowCounter(3600_000,  cfg.requestsPerHour),
      tpmCounter:   new TokenWindowCounter(60_000,      cfg.tokensPerMinute),
      tphCounter:   new TokenWindowCounter(3600_000,    cfg.tokensPerHour),
      burstDetector: new BurstDetector(cfg.burstWindow, cfg.burstLimit),
    };

    // Periodic GC every 5 minutes
    setInterval(() => {
      _counters.rpmCounter.gc();
      _counters.rphCounter.gc();
      _counters.tpmCounter.gc();
      _counters.tphCounter.gc();
    }, 5 * 60_000).unref();
  }
  return _counters;
}

/** Reset counters (used in tests) */
function resetCounters() {
  _counters = null;
}

// ── Core check function ───────────────────────────────────────────────────────

/**
 * Check and record a rate-limit event for a user.
 *
 * @param {string} userId
 * @param {object} opts — { tokens: number, config: object }
 * @returns {{ allowed: boolean, exceeded: Array<string>, counters: object }}
 */
function check(userId, opts = {}) {
  if (!userId) userId = 'anonymous';

  const cfg = {
    requestsPerMinute: 60,
    requestsPerHour:   1000,
    tokensPerMinute:   50000,
    tokensPerHour:     500000,
    burstWindow:       5000,
    burstLimit:        10,
    ...(opts.config || {}),
  };

  const tokens = opts.tokens || 0;
  const record = opts.record !== false; // default: record=true

  const c = _getCounters(cfg);

  const rpmResult   = record ? c.rpmCounter.record(userId, 1)  : c.rpmCounter.check(userId);
  const rphResult   = record ? c.rphCounter.record(userId, 1)  : c.rphCounter.check(userId);
  const tpmResult   = tokens > 0 && record ? c.tpmCounter.record(userId, tokens) : c.tpmCounter.check(userId);
  const tphResult   = tokens > 0 && record ? c.tphCounter.record(userId, tokens) : c.tphCounter.check(userId);
  const burstResult = record ? c.burstDetector.record(userId)  : { burst: false };

  const exceeded = [];
  if (rpmResult.exceeded)  exceeded.push('requests_per_minute');
  if (rphResult.exceeded)  exceeded.push('requests_per_hour');
  if (tpmResult.exceeded)  exceeded.push('tokens_per_minute');
  if (tphResult.exceeded)  exceeded.push('tokens_per_hour');
  if (burstResult.burst)   exceeded.push('burst');

  return {
    allowed: exceeded.length === 0,
    exceeded,
    counters: {
      rpm:   rpmResult,
      rph:   rphResult,
      tpm:   tpmResult,
      tph:   tphResult,
      burst: burstResult,
    },
  };
}

/** Get current state for a user without recording */
function getStatus(userId, cfg = {}) {
  return check(userId, { tokens: 0, record: false, config: cfg });
}

/** Reset all counters for a user */
function resetUser(userId) {
  if (!_counters) return;
  _counters.rpmCounter.reset(userId);
  _counters.rphCounter.reset(userId);
  _counters.tpmCounter.reset(userId);
  _counters.tphCounter.reset(userId);
  _counters.burstDetector.reset(userId);
}

// ── Stage interface ───────────────────────────────────────────────────────────

async function run(payload, stageConfig = {}) {
  const { userId = 'anonymous', tokens = 0 } = payload;

  const result = check(userId, {
    tokens,
    config: stageConfig.rateLimit || stageConfig,
  });

  const riskScore = result.allowed ? 0 : result.exceeded.includes('burst') ? 90 : 75;

  return {
    stage: STAGE_NAME,
    action: result.allowed ? 'PASS' : 'BLOCK',
    riskScore,
    confidence: 1.0, // rate limiting is deterministic
    findings: result.exceeded.map(r => ({ label: r, weight: 1.0 })),
    meta: {
      exceeded: result.exceeded,
      counters: result.counters,
      userId,
    },
  };
}

module.exports = {
  run,
  check,
  getStatus,
  resetUser,
  resetCounters,
  SlidingWindowCounter,
  TokenWindowCounter,
  BurstDetector,
  STAGE_NAME,
};
