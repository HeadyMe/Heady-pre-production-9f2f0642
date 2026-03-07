'use strict';

const EventEmitter = require('events');

/**
 * ProviderRacing — Fire requests to multiple providers concurrently; return fastest.
 *
 * Features:
 *  - Fire N concurrent provider requests
 *  - Return first successful response; cancel losers
 *  - Timeout-based racing with progressive fallback
 *  - Race analytics: win counts, avg latency per provider
 *  - Weighted racing: bias toward historically faster providers
 *
 * Events:
 *  'winner'  (providerId, latencyMs)
 *  'loser'   (providerId)
 *  'timeout' (providerId)
 *  'allFailed' ()
 */
class ProviderRacing extends EventEmitter {
  /**
   * @param {object} options
   * @param {boolean} options.enabled
   * @param {number}  options.maxConcurrent   max providers to race
   * @param {number}  options.timeout         per-race timeout ms
   * @param {number}  options.minWinRate      min historical win rate to include
   * @param {number}  options.weightDecay     decay factor for historical weights
   */
  constructor(options = {}) {
    super();
    this.enabled       = options.enabled        !== false;
    this.maxConcurrent = options.maxConcurrent  || 3;
    this.timeout       = options.timeout        || 10000;
    this.minWinRate    = options.minWinRate      || 0;
    this.weightDecay   = options.weightDecay     || 0.95;

    // Analytics store: providerId → RaceStats
    this._stats = new Map();
  }

  // ─── Stats Management ─────────────────────────────────────────────────────

  _getStats(providerId) {
    if (!this._stats.has(providerId)) {
      this._stats.set(providerId, {
        providerId,
        races:    0,
        wins:     0,
        losses:   0,
        timeouts: 0,
        errors:   0,
        totalLatencyMs: 0,
        latencies:      [],   // rolling window of last 50
        weight:         1.0,
      });
    }
    return this._stats.get(providerId);
  }

  _recordWin(providerId, latencyMs) {
    const s = this._getStats(providerId);
    s.races++;
    s.wins++;
    s.totalLatencyMs += latencyMs;
    s.latencies = [...s.latencies.slice(-49), latencyMs];
    // Increase weight
    s.weight = Math.min(s.weight * (1 / this.weightDecay), 2.0);
    this.emit('winner', providerId, latencyMs);
  }

  _recordLoss(providerId) {
    const s = this._getStats(providerId);
    s.races++;
    s.losses++;
    // Slight weight decay for losing
    s.weight = Math.max(s.weight * Math.sqrt(this.weightDecay), 0.1);
    this.emit('loser', providerId);
  }

  _recordError(providerId) {
    const s = this._getStats(providerId);
    s.races++;
    s.errors++;
    s.weight = Math.max(s.weight * this.weightDecay, 0.05);
  }

  _recordTimeout(providerId) {
    const s = this._getStats(providerId);
    s.races++;
    s.timeouts++;
    s.weight = Math.max(s.weight * this.weightDecay, 0.05);
    this.emit('timeout', providerId);
  }

  // ─── Provider Selection ───────────────────────────────────────────────────

  /**
   * Sort and select providers for a race based on weights and history.
   * @param {string[]} candidateIds  all candidate provider IDs
   * @param {number}   n             max to race
   * @returns {string[]}
   */
  selectForRace(candidateIds, n) {
    if (!candidateIds || candidateIds.length === 0) return [];

    // Score = weight * (1 + random jitter to avoid thundering herd)
    const scored = candidateIds.map(id => {
      const stats  = this._getStats(id);
      const jitter = 0.9 + Math.random() * 0.2;   // ±10% jitter
      return { id, score: stats.weight * jitter };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map(s => s.id);
  }

  // ─── Racing ───────────────────────────────────────────────────────────────

  /**
   * Race multiple provider functions.
   * Returns first successful result or throws if all fail.
   *
   * @param {Array<{id: string, fn: Function}>} contestants
   *        Each contestant has an id and an async fn() → response
   * @param {number} [timeoutMs]
   * @returns {Promise<{response, winnerId, latencyMs, losers}>}
   */
  async race(contestants, timeoutMs) {
    if (!contestants || contestants.length === 0) {
      throw new Error('No contestants provided to race');
    }

    const limit    = timeoutMs || this.timeout;
    const selected = contestants.slice(0, this.maxConcurrent);

    return new Promise((resolve, reject) => {
      let   settled  = false;
      let   pending  = selected.length;
      const errors   = [];
      const startTime = Date.now();

      // Overall race timeout
      const overallTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          // Record timeouts for all still-pending
          for (const c of selected) {
            this._recordTimeout(c.id);
          }
          this.emit('allFailed', 'timeout');
          reject(new Error(`All providers timed out after ${limit}ms`));
        }
      }, limit);

      function finish(response, winnerId) {
        if (settled) return;
        settled = true;
        clearTimeout(overallTimer);
        resolve({
          response,
          winnerId,
          latencyMs: Date.now() - startTime,
          losers: selected.filter(c => c.id !== winnerId).map(c => c.id),
        });
      }

      for (const contestant of selected) {
        const { id, fn } = contestant;
        const contStart  = Date.now();

        Promise.resolve()
          .then(() => fn())
          .then((response) => {
            const latency = Date.now() - contStart;
            if (settled) {
              // We lost the race — record as loss
              this._recordLoss(id);
            } else {
              // We won!
              this._recordWin(id, latency);
              // Record losses for others
              for (const other of selected) {
                if (other.id !== id) this._recordLoss(other.id);
              }
              finish(response, id);
            }
          })
          .catch((err) => {
            this._recordError(id);
            errors.push({ id, error: err.message });
            pending--;

            if (pending === 0 && !settled) {
              settled = true;
              clearTimeout(overallTimer);
              this.emit('allFailed', errors);
              const combined = new Error(
                `All ${selected.length} providers failed: ` +
                errors.map(e => `${e.id}: ${e.error}`).join('; ')
              );
              combined.providerErrors = errors;
              reject(combined);
            }
          });
      }
    });
  }

  /**
   * Progressive fallback: try providers one-by-one with increasing timeout.
   * Used when racing is disabled or as a secondary strategy.
   *
   * @param {Array<{id: string, fn: Function}>} chain
   * @param {number} baseTimeoutMs
   * @returns {Promise<{response, winnerId, latencyMs}>}
   */
  async progressiveFallback(chain, baseTimeoutMs) {
    const errors = [];
    const phi    = 1.618033988749895;

    for (let i = 0; i < chain.length; i++) {
      const { id, fn } = chain[i];
      const timeout    = Math.min(baseTimeoutMs * Math.pow(phi, i), 120000);
      const start      = Date.now();

      try {
        const response = await Promise.race([
          fn(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error(`Timeout after ${timeout}ms`)), timeout)
          ),
        ]);

        const latencyMs = Date.now() - start;
        this._recordWin(id, latencyMs);
        for (const e of errors) this._recordLoss(e.id);
        return { response, winnerId: id, latencyMs };
      } catch (err) {
        this._recordError(id);
        errors.push({ id, error: err.message });
      }
    }

    const combined = new Error(
      `All providers in fallback chain failed: ` +
      errors.map(e => `${e.id}: ${e.error}`).join('; ')
    );
    combined.providerErrors = errors;
    throw combined;
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  /**
   * Get full race analytics.
   */
  getAnalytics() {
    const analytics = {};
    for (const [id, s] of this._stats) {
      const recent = s.latencies.slice(-20);
      analytics[id] = {
        races:        s.races,
        wins:         s.wins,
        losses:       s.losses,
        timeouts:     s.timeouts,
        errors:       s.errors,
        winRate:      s.races > 0 ? s.wins / s.races : 0,
        avgLatencyMs: s.latencies.length > 0
          ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length)
          : 0,
        recentAvgLatencyMs: recent.length > 0
          ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
          : 0,
        weight: s.weight,
      };
    }
    return analytics;
  }

  /**
   * Reset analytics for all or a specific provider.
   */
  resetAnalytics(providerId) {
    if (providerId) {
      this._stats.delete(providerId);
    } else {
      this._stats.clear();
    }
  }
}

module.exports = ProviderRacing;
