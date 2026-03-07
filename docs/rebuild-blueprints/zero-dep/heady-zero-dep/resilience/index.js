/**
 * @file index.js
 * @description Resilience layer: unified export + createResilienceLayer() factory.
 *
 * Provides a single cohesive resilience system for the Heady cluster.
 *
 * @module HeadyResilience
 */

// ─── Module Re-exports ────────────────────────────────────────────────────────
export { CircuitBreakerManager, CircuitState, getCircuitBreakerManager } from './circuit-breaker.js';
export { RateLimiter }                                                    from './rate-limiter.js';
export { MultiTierCache }                                                 from './cache.js';
export {
  RetryExecutor, BackoffCalculator as BackoffCalc, JitterStrategy, withRetry
} from './exponential-backoff.js';
export { AutoHeal, HealthStatus, RecoveryAction }                        from './auto-heal.js';
export { Pool }                                                           from './pool.js';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI = 1.6180339887498948482;

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Create a fully-wired resilience layer instance.
 *
 * Returns a single object containing pre-configured instances of all
 * resilience subsystems, wired together for cascade-awareness.
 *
 * @param {object} [opts]
 * @param {object} [opts.circuitBreaker]   CircuitBreakerManager options
 * @param {object} [opts.rateLimiter]      RateLimiter global config
 * @param {object} [opts.cache]            MultiTierCache options
 * @param {object} [opts.backoff]          RetryExecutor options
 * @param {object} [opts.autoHeal]         AutoHeal options
 * @param {boolean} [opts.autoStart]       Auto-start AutoHeal (default: true)
 *
 * @returns {ResilienceLayer}
 */
export function createResilienceLayer(opts = {}) {
  // Circuit Breaker
  const circuitBreaker = new _CircuitBreakerManager(opts.circuitBreaker ?? {});

  // Rate Limiter
  const rateLimiter = new _RateLimiter({
    requestsPerSecond:  (opts.rateLimiter?.requestsPerSecond)  ?? 200,
    requestsPerWindow:  (opts.rateLimiter?.requestsPerWindow)  ?? 10_000,
    windowMs:           (opts.rateLimiter?.windowMs)           ?? 60_000,
    burst:              (opts.rateLimiter?.burst)              ?? Math.ceil(200 * PHI),
    ...opts.rateLimiter,
  });

  // Cache
  const cache = new _MultiTierCache({
    l1Capacity:   opts.cache?.l1Capacity   ?? 610,
    defaultTtlMs: opts.cache?.defaultTtlMs ?? 300_000,
    phiJitter:    opts.cache?.phiJitter    !== false,
    ...opts.cache,
  });

  // Retry Executor
  const retry = new _RetryExecutor({
    backoff: {
      baseDelayMs:  opts.backoff?.baseDelayMs  ?? 100,
      maxDelayMs:   opts.backoff?.maxDelayMs   ?? 30_000,
      maxAttempts:  opts.backoff?.maxAttempts  ?? 8,
      jitter:       opts.backoff?.jitter       ?? 'full',
    },
    budget: {
      total:    opts.backoff?.budgetMs    ?? 120_000,
      windowMs: opts.backoff?.budgetWindow ?? 60_000,
    },
  });

  // Auto-Heal
  const autoHeal = new _AutoHeal({
    tickMs:    opts.autoHeal?.tickMs    ?? 3_000,
    logDir:    opts.autoHeal?.logDir    ?? undefined,
    ...opts.autoHeal,
  });

  // Wire cascade: when circuit opens, auto-heal gets notified
  circuitBreaker.on('cascadeWarning', evt => {
    autoHeal.emit('cascadeAlert', evt);
  });

  if (opts.autoStart !== false) {
    autoHeal.start();
  }

  return new ResilienceLayer({ circuitBreaker, rateLimiter, cache, retry, autoHeal });
}

// ─── Module imports ──────────────────────────────────────────────────────────
import { CircuitBreakerManager as _CircuitBreakerManager } from './circuit-breaker.js';
import { RateLimiter           as _RateLimiter }           from './rate-limiter.js';
import { MultiTierCache        as _MultiTierCache }        from './cache.js';
import { RetryExecutor         as _RetryExecutor }         from './exponential-backoff.js';
import { AutoHeal              as _AutoHeal }              from './auto-heal.js';
import { Pool                  as _Pool }                  from './pool.js';

// ─── ResilienceLayer class ────────────────────────────────────────────────────
export class ResilienceLayer {
  constructor({ circuitBreaker, rateLimiter, cache, retry, autoHeal }) {
    this.circuitBreaker = circuitBreaker;
    this.rateLimiter    = rateLimiter;
    this.cache          = cache;
    this.retry          = retry;
    this.autoHeal       = autoHeal;
  }

  /**
   * Execute a fn through the full resilience stack:
   * rate-limit → circuit-breaker → retry → cache-aside
   *
   * @param {string}   clientId   For rate limiting
   * @param {string}   circuit    Named circuit
   * @param {string}   cacheKey   Cache key (null to skip caching)
   * @param {Function} fn         The operation to protect
   * @param {object}   [opts]
   * @param {number}   [opts.ttlMs]       Cache TTL
   * @param {Function} [opts.fallback]    Fallback fn if circuit is open
   */
  async execute(clientId, circuit, cacheKey, fn, opts = {}) {
    // 1. Rate limit
    const rl = this.rateLimiter.check(clientId);
    if (!rl.allowed) {
      const err = Object.assign(new Error('Rate limited'), {
        code:         'RATE_LIMITED',
        headers:      rl.headers,
        retryAfterMs: rl.retryAfterMs,
      });
      throw err;
    }

    // 2. Cache-aside (if key provided)
    if (cacheKey) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    // 3. Circuit-breaker + retry
    const result = await this.circuitBreaker.execute(
      circuit,
      () => this.retry.execute(fn),
      opts.fallback ?? null,
    );

    // 4. Store in cache
    if (cacheKey && result !== undefined) {
      await this.cache.set(cacheKey, result, opts.ttlMs);
    }

    return result;
  }

  /**
   * Create a pool managed under this resilience layer.
   */
  createPool(poolOpts = {}) {
    return new _Pool(poolOpts);
  }

  /**
   * Health snapshot of all subsystems.
   */
  health() {
    return {
      circuits:    this.circuitBreaker.status(),
      rateLimiter: { maxClients: this.rateLimiter.config.maxClients },
      cache:       this.cache.stats(),
      retry:       this.retry.budgetStats(),
      autoHeal:    this.autoHeal.status(),
    };
  }

  /**
   * Graceful shutdown.
   */
  async shutdown() {
    this.autoHeal.stop();
    this.rateLimiter.destroy();
  }
}

export default createResilienceLayer;
