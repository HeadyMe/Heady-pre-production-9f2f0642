/**
 * Heady Latent OS — Usage Metering Module
 * HeadySystems, Inc.
 *
 * Production-grade usage tracking and billing for:
 *  - API calls, vector operations, LLM tokens, agent compute hours, storage
 *  - Per-user and per-organization aggregation
 *  - Real-time usage dashboard data
 *  - Overage detection and alerting
 *  - Usage-based billing calculation (Stripe integration)
 *  - Rate limit enforcement based on plan
 *
 * Architecture:
 *  - UsageMeter: core class managing counters and aggregation
 *  - Uses Redis for real-time counters (sliding window)
 *  - Uses PostgreSQL for persistent billing records
 *  - Reports to Stripe every φ² hours (≈ 2.618h → rounded to next Fibonacci = fib(12)=144 min)
 *    via scheduled job
 *
 * Phi-Math Integration (v2.0):
 *  - Alert thresholds replaced with ALERT_THRESHOLDS from phi-math
 *    (warning≈0.618, caution≈0.764, critical≈0.854, exceeded≈0.910, hard_max=1.0)
 *  - Sliding window sizes use phiWindows(1000, 4) progression
 *  - Batch sizes are Fibonacci numbers
 *  - Rate limit calculation uses phi-scaled intervals (phiAdaptiveInterval)
 *  - Threshold checks use cslGate() for smooth, continuous alerting
 */

'use strict';

// ── Phi-Math Import ───────────────────────────────────────────────────────────
import {
  PHI,
  PSI,
  ALERT_THRESHOLDS,
  phiBackoff,
  fib,
  phiAdaptiveInterval,
  CSL_THRESHOLDS,
  phiWindows,
  cslGate,
  fibBatchSizes,
} from '../../shared/phi-math.js';

const EventEmitter = require('events');
const { PLAN_LIMITS, reportUsage, batchReportUsage } = require('../configs/stripe-config');

// ── Metric Types ──────────────────────────────────────────────────────────────

const METRIC_TYPES = {
  API_CALLS:   'api_calls',
  VECTOR_OPS:  'vector_ops',
  LLM_TOKENS:  'llm_tokens',
  AGENT_HOURS: 'agent_hours',
  STORAGE_GB:  'storage_gb',
};

// Overage pricing in USD cents (matches stripe-config.js)
const OVERAGE_RATES = {
  [METRIC_TYPES.API_CALLS]:    0.04 / 100,   // $0.0004 per call
  [METRIC_TYPES.VECTOR_OPS]:   0.02 / 10000, // $0.02 per 10K ops
  [METRIC_TYPES.LLM_TOKENS]:   1.50 / 1e6,   // $1.50 per 1M tokens
  [METRIC_TYPES.AGENT_HOURS]:  0.08,          // $0.08 per hour
  [METRIC_TYPES.STORAGE_GB]:   0.023,         // $0.023 per GB/mo
};

// ── Alert Thresholds (phi-math derived) ──────────────────────────────────────
// Replaces the old arbitrary { warning: 0.80, critical: 0.95, exceeded: 1.00 }
// with phi-harmonic levels:
//   warning  = ψ        ≈ 0.618  (61.8% of limit — early heads-up)
//   caution  = 1 - ψ²   ≈ 0.764  (mid-level alert)
//   critical = 1 - ψ³   ≈ 0.854  (85.4% — hard stop approaching)
//   exceeded = 1 - ψ⁴   ≈ 0.910  (91.0% — entering overage zone)
//   hard_max = 1.0               (100% — plan cap)
//
// Re-exported as module symbol for consumers; the constant from phi-math is the
// canonical source of truth.
// (The 'const ALERT_THRESHOLDS' below shadows the import intentionally so that
//  require('../modules/usage-metering').ALERT_THRESHOLDS exposes the phi values.)
const ALERT_THRESHOLDS_EXPORT = ALERT_THRESHOLDS; // alias for module.exports

// ── Phi-Scaled Sliding Windows ────────────────────────────────────────────────
// Replaces arbitrary [1000, 60000, 3600000, 86400000] with a phi-harmonic
// progression from a 1-second base.
//
// phiWindows(1000, 4) → [1000, 1618, 2618, 4236]  (ms — sub-minute windows)
// We keep the semantic labels and add the phi-window array as an auxiliary tool
// for adaptive rate-limiter logic.
const PHI_WINDOW_PROGRESSION = phiWindows(1000, 4); // [1000, 1618, 2618, 4236] ms

const RATE_WINDOW_MS = {
  second: 1_000,
  minute: 60_000,
  hour:   3_600_000,
  day:    86_400_000,
  month:  30 * 86_400_000,
};

// ── Fibonacci Batch Sizes ─────────────────────────────────────────────────────
// Batch sizes for Stripe flush are Fibonacci numbers in [50, 500]:
// fibBatchSizes(50, 500) → [55, 89, 144, 233, 377]
const FIB_BATCH_SIZES = fibBatchSizes(50, 500); // [55, 89, 144, 233, 377]
const DEFAULT_BATCH_SIZE = FIB_BATCH_SIZES[0];  // fib(10) = 55

// Stripe flush interval: fib(12) minutes = 144 minutes (≈ 2.4h; replaces 60 min)
const STRIPE_FLUSH_INTERVAL_MS = fib(12) * 60 * 1000; // 144 min × 60s × 1000ms

// ── UsageMeter Class ──────────────────────────────────────────────────────────

/**
 * UsageMeter tracks and enforces usage limits for all Heady platform resources.
 *
 * @example
 * const meter = new UsageMeter({ redis, db, emailService });
 * await meter.init();
 *
 * // Track usage
 * const result = await meter.track({
 *   orgId: 'org_abc123',
 *   userId: 'user_xyz',
 *   metric: METRIC_TYPES.API_CALLS,
 *   quantity: 1,
 * });
 *
 * if (!result.allowed) {
 *   throw new RateLimitError(result.message);
 * }
 */
class UsageMeter extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.redis           — ioredis client instance
   * @param {object} options.db              — database ORM (Prisma/Knex/Mongoose)
   * @param {object} [options.emailService]  — notification service for alerts
   * @param {object} [options.stripeItems]   — org_id → { metric → subscription_item_id }
   * @param {boolean} [options.dryRun=false] — track without enforcing limits
   */
  constructor({ redis, db, emailService = null, stripeItems = {}, dryRun = false }) {
    super();
    this.redis = redis;
    this.db = db;
    this.emailService = emailService;
    this.stripeItems = stripeItems;
    this.dryRun = dryRun;
    this._flushInterval = null;
    this._pendingReports = new Map(); // orgId → { metric → delta }
    // Phi-adaptive flush state: tracks current health for phiAdaptiveInterval
    this._flushCurrentIntervalMs = STRIPE_FLUSH_INTERVAL_MS;
    this._flushHealthy = true;
  }

  /**
   * Initialize the meter: start periodic flush to Stripe and verify Redis connectivity.
   * Flush interval uses fib(12) = 144 minutes (phi-harmonic, replaces fixed 60 min).
   */
  async init() {
    await this.redis.ping();
    // Flush usage to Stripe on a phi-adaptive interval (starts at fib(12) = 144 min)
    this._flushInterval = setInterval(() => this._flushToStripe(), this._flushCurrentIntervalMs);
    this.emit('ready');
    console.log(`[UsageMeter] Initialized. Flush interval: ${fib(12)} minutes (phi-harmonic fib(12)).`);
    console.log(`[UsageMeter] Alert thresholds (phi-derived):`, ALERT_THRESHOLDS);
    console.log(`[UsageMeter] Phi window progression (ms):`, PHI_WINDOW_PROGRESSION);
  }

  /**
   * Gracefully shut down: flush remaining usage before exit.
   */
  async shutdown() {
    if (this._flushInterval) clearInterval(this._flushInterval);
    await this._flushToStripe();
    this.emit('shutdown');
  }

  // ── Primary API ────────────────────────────────────────────────────────────

  /**
   * Track a usage event and enforce rate limits.
   *
   * @param {object} params
   * @param {string} params.orgId      — organization ID
   * @param {string} params.userId     — user ID within the org
   * @param {string} params.metric     — one of METRIC_TYPES
   * @param {number} params.quantity   — units consumed (default: 1)
   * @param {object} [params.meta]     — optional context { endpoint, model, agent_id }
   * @returns {Promise<TrackResult>}
   */
  async track({ orgId, userId, metric, quantity = 1, meta = {} }) {
    try {
      // 1. Load plan limits
      const plan = await this._getPlan(orgId);
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.community;

      // 2. Get current month usage from Redis
      const monthKey = this._monthKey(orgId, metric);
      const currentUsage = await this._getCounter(monthKey);
      const planLimit = this._getPlanLimit(limits, metric, plan, orgId);

      // 3. Check if hard limit is set and exceeded
      const hardLimitKey = `heady:hard_limit:${orgId}:${metric}`;
      const hardLimit = await this.redis.get(hardLimitKey);
      if (hardLimit !== null && currentUsage >= parseInt(hardLimit, 10)) {
        this.emit('hardLimitExceeded', { orgId, userId, metric, currentUsage, hardLimit });
        return {
          allowed: false,
          reason: 'hard_limit',
          message: `Hard usage limit reached for ${metric}. Configure limits in admin dashboard.`,
          current: currentUsage,
          limit: parseInt(hardLimit, 10),
          plan,
        };
      }

      // 4. Enforce plan limits (soft limit — overage billing enabled for paid plans)
      if (planLimit !== null) {
        const projectedUsage = currentUsage + quantity;
        const utilizationRatio = projectedUsage / planLimit;

        if (plan === 'community' && projectedUsage > planLimit) {
          // Community: hard stop at limit (no overage)
          this.emit('limitExceeded', { orgId, userId, metric, currentUsage, planLimit, plan });
          return {
            allowed: false,
            reason: 'plan_limit',
            message: `Community plan limit reached for ${metric} (${planLimit}/mo). Upgrade to Developer for higher limits.`,
            current: currentUsage,
            limit: planLimit,
            plan,
            upgrade_url: 'https://headysystems.com/pricing',
          };
        }

        // Check phi-harmonic alert thresholds via CSL gate (smooth, continuous alerting)
        await this._checkThresholds(orgId, userId, metric, projectedUsage, planLimit, plan);
      }

      // 5. Increment counters
      if (!this.dryRun) {
        await this._incrementCounters(orgId, userId, metric, quantity);
        // Queue for Stripe reporting
        this._queueStripeReport(orgId, metric, quantity);
      }

      // 6. Log to persistent audit trail
      await this._logEvent({ orgId, userId, metric, quantity, meta });

      // 7. Compute overage charge if applicable
      const overage = planLimit !== null && currentUsage + quantity > planLimit
        ? this._calculateOverage(metric, Math.max(0, currentUsage + quantity - planLimit))
        : 0;

      return {
        allowed: true,
        current: currentUsage + quantity,
        limit: planLimit,
        plan,
        overage_usd: overage,
        utilization: planLimit ? (currentUsage + quantity) / planLimit : 0,
      };

    } catch (err) {
      this.emit('error', err);
      // Fail open: allow the request but log the metering failure
      console.error('[UsageMeter] Tracking error (fail-open):', err.message);
      return { allowed: true, error: err.message };
    }
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  /**
   * Check and enforce per-second/per-minute burst rate limits.
   * Returns true if the request should be throttled.
   *
   * Retry delay on throttle uses phiBackoff() for golden-ratio exponential backoff.
   *
   * @param {string} orgId
   * @param {string} metric
   * @param {string} [window='minute'] — 'second' | 'minute' | 'hour'
   * @returns {Promise<RateLimitResult>}
   */
  async checkRateLimit(orgId, metric, window = 'minute') {
    const plan = await this._getPlan(orgId);
    const limits = this._getRateLimits(plan);
    const limit = limits[metric]?.[window];
    if (!limit) return { throttled: false };

    const key = `heady:rl:${orgId}:${metric}:${window}:${this._windowBucket(window)}`;
    const count = await this.redis.incr(key);
    await this.redis.pexpire(key, RATE_WINDOW_MS[window]);

    if (count > limit) {
      const ttl = await this.redis.pttl(key);
      // phi-backoff retry suggestion: attempt 0 = base delay of ttl
      const phiRetryMs = Math.max(ttl, phiBackoff(0, ttl, ttl * PHI, false));
      return {
        throttled: true,
        limit,
        current: count,
        retry_after_ms: phiRetryMs,
        retry_after_s: Math.ceil(phiRetryMs / 1000),
      };
    }

    return {
      throttled: false,
      limit,
      current: count,
      remaining: limit - count,
    };
  }

  // ── Usage Dashboard Data ───────────────────────────────────────────────────

  /**
   * Get real-time usage summary for an organization.
   * Powers the admin dashboard.
   *
   * @param {string} orgId
   * @param {string} [period='current_month'] — 'current_month' | 'last_month' | 'last_7_days'
   * @returns {Promise<UsageSummary>}
   */
  async getOrgUsage(orgId, period = 'current_month') {
    const plan = await this._getPlan(orgId);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.community;
    const result = {};

    for (const metric of Object.values(METRIC_TYPES)) {
      const key = period === 'current_month'
        ? this._monthKey(orgId, metric)
        : this._historicalKey(orgId, metric, period);

      const current = await this._getCounter(key);
      const planLimit = this._getPlanLimit(limits, metric, plan, orgId);

      result[metric] = {
        current,
        limit: planLimit,
        utilization: planLimit ? current / planLimit : null,
        overage: planLimit && current > planLimit
          ? this._calculateOverage(metric, current - planLimit)
          : 0,
        status: this._getUsageStatus(current, planLimit),
      };
    }

    return {
      org_id: orgId,
      plan,
      period,
      metrics: result,
      period_start: this._periodStart(period),
      period_end: this._periodEnd(period),
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Get per-user usage breakdown within an organization.
   *
   * @param {string} orgId
   * @returns {Promise<UserUsageBreakdown[]>}
   */
  async getUserBreakdown(orgId) {
    const pattern = `heady:usage:user:${orgId}:*:${this._currentMonth()}`;
    const keys = await this.redis.keys(pattern);
    const breakdown = {};

    for (const key of keys) {
      const parts = key.split(':');
      const userId = parts[3];
      const metric = parts[4];
      const value = parseInt(await this.redis.get(key) || '0', 10);

      if (!breakdown[userId]) breakdown[userId] = {};
      breakdown[userId][metric] = value;
    }

    return Object.entries(breakdown).map(([userId, metrics]) => ({ userId, metrics }));
  }

  /**
   * Get time-series usage data for charting (hourly buckets).
   *
   * @param {string} orgId
   * @param {string} metric     — METRIC_TYPES value
   * @param {number} hours      — number of hours back (default: fib(8)=21)
   * @returns {Promise<TimeSeriesPoint[]>}
   */
  async getTimeSeries(orgId, metric, hours = fib(8)) { // fib(8)=21 hours default
    const now = Date.now();
    const series = [];

    for (let h = hours; h >= 0; h--) {
      const ts = now - h * RATE_WINDOW_MS.hour;
      const bucket = Math.floor(ts / RATE_WINDOW_MS.hour);
      const key = `heady:ts:${orgId}:${metric}:${bucket}`;
      const value = parseInt(await this.redis.get(key) || '0', 10);
      series.push({
        timestamp: new Date(bucket * RATE_WINDOW_MS.hour).toISOString(),
        value,
      });
    }

    return series;
  }

  // ── Overage Detection & Alerting ───────────────────────────────────────────

  /**
   * Check all organizations for usage overages and send alerts.
   * Run every fib(8)=21 minutes via cron.
   *
   * Uses phi-harmonic ALERT_THRESHOLDS (≈0.618, ≈0.764, ≈0.854, ≈0.910, 1.0)
   * instead of the old arbitrary (0.80, 0.95, 1.00).
   */
  async runOverageCheck() {
    const orgs = await this.db.organizations.getAllActive();

    for (const org of orgs) {
      const usage = await this.getOrgUsage(org.id);

      for (const [metric, data] of Object.entries(usage.metrics)) {
        if (data.utilization === null) continue;

        // Emit machine-readable events using phi-derived thresholds
        if (data.utilization >= ALERT_THRESHOLDS.exceeded) {
          this.emit('overageAlert', { org, metric, ...data, level: 'exceeded' });
          await this._sendOverageAlert(org, metric, data, 'exceeded');
        } else if (data.utilization >= ALERT_THRESHOLDS.critical) {
          await this._sendOverageAlert(org, metric, data, 'critical');
        } else if (data.utilization >= ALERT_THRESHOLDS.caution) {
          await this._sendOverageAlert(org, metric, data, 'caution');
        } else if (data.utilization >= ALERT_THRESHOLDS.warning) {
          await this._sendOverageAlert(org, metric, data, 'warning');
        }
      }
    }
  }

  /**
   * Set a hard spending cap for an organization metric.
   * When reached, requests return 429 instead of incurring overage.
   *
   * @param {string} orgId
   * @param {string} metric
   * @param {number} hardLimit   — absolute cap in metric units
   */
  async setHardLimit(orgId, metric, hardLimit) {
    const key = `heady:hard_limit:${orgId}:${metric}`;
    if (hardLimit === null) {
      await this.redis.del(key);
    } else {
      await this.redis.set(key, String(hardLimit));
    }
    this.emit('hardLimitSet', { orgId, metric, hardLimit });
  }

  // ── Billing Calculation ────────────────────────────────────────────────────

  /**
   * Calculate estimated overage charges for an organization for the current billing period.
   *
   * @param {string} orgId
   * @returns {Promise<BillingEstimate>}
   */
  async calculateBillingEstimate(orgId) {
    const usage = await this.getOrgUsage(orgId);
    const charges = {};
    let totalOverageCents = 0;

    for (const [metric, data] of Object.entries(usage.metrics)) {
      if (data.overage > 0) {
        const cents = Math.round(data.overage * 100);
        charges[metric] = {
          overage_units: data.current - (data.limit || 0),
          overage_usd: data.overage,
          overage_cents: cents,
        };
        totalOverageCents += cents;
      }
    }

    return {
      org_id: orgId,
      plan: usage.plan,
      period: usage.period,
      period_start: usage.period_start,
      period_end: usage.period_end,
      line_items: charges,
      total_overage_cents: totalOverageCents,
      total_overage_usd: totalOverageCents / 100,
      estimated: true,
    };
  }

  // ── Stripe Flush ───────────────────────────────────────────────────────────

  /**
   * Flush pending usage reports to Stripe.
   * Called on a phi-adaptive interval (starts at fib(12) = 144 min).
   * On failure, phiBackoff() governs retry delay.
   */
  async _flushToStripe() {
    if (this._pendingReports.size === 0) return;

    const batch = new Map(this._pendingReports);
    this._pendingReports.clear();

    let flushSuccess = true;

    for (const [orgId, metrics] of batch) {
      const items = this.stripeItems[orgId];
      if (!items) continue;

      await batchReportUsage(metrics, items).catch(err => {
        flushSuccess = false;
        console.error(`[UsageMeter] Stripe flush failed for org ${orgId}:`, err.message);
        // Re-queue failed reports
        for (const [metric, qty] of Object.entries(metrics)) {
          this._queueStripeReport(orgId, metric, qty);
        }
      });
    }

    // Phi-adaptive: shrink interval on failure, expand on success
    this._flushHealthy = flushSuccess;
    const nextInterval = phiAdaptiveInterval(
      this._flushCurrentIntervalMs,
      this._flushHealthy,
      fib(10) * 60 * 1000,   // min: fib(10)=55 min
      fib(13) * 60 * 1000,   // max: fib(13)=233 min
    );
    if (nextInterval !== this._flushCurrentIntervalMs) {
      this._flushCurrentIntervalMs = nextInterval;
      clearInterval(this._flushInterval);
      this._flushInterval = setInterval(() => this._flushToStripe(), this._flushCurrentIntervalMs);
    }

    console.log(`[UsageMeter] Flushed usage for ${batch.size} organizations to Stripe.`);
  }

  /**
   * Export usage records to Stripe-compatible format for manual reconciliation.
   *
   * @param {string} orgId
   * @param {string} month  — 'YYYY-MM'
   * @returns {Promise<StripeUsageExport>}
   */
  async exportToStripe(orgId, month) {
    const records = await this.db.usageRecords.getByOrgAndMonth(orgId, month);
    const items = this.stripeItems[orgId];

    const exports = [];
    for (const record of records) {
      if (items?.[record.metric]) {
        exports.push({
          subscription_item_id: items[record.metric],
          quantity: record.total_quantity,
          timestamp: Math.floor(new Date(`${month}-01`).getTime() / 1000),
          action: 'set',
        });
      }
    }

    return { org_id: orgId, month, records: exports };
  }

  // ── Plan-Level Rate Limits ─────────────────────────────────────────────────
  //
  // Rate limit values use Fibonacci numbers where possible for natural scaling.
  // The phi-window progression (PHI_WINDOW_PROGRESSION) is used for adaptive
  // window selection in the rate-limiter internals.

  _getRateLimits(plan) {
    const base = {
      community: {
        [METRIC_TYPES.API_CALLS]:   { second: 1,        minute: fib(8),    hour: fib(11) },  // 21, 89→200≈144? fib(11)=89→use fib(12)=144... keep semantics: fib(8)=21/min, fib(12)=144/hr (≈200 rounded to Fibonacci)
        [METRIC_TYPES.VECTOR_OPS]:  { minute: fib(11),  hour: fib(14) },                      // 89, 377→500≈fib(14)=377
      },
      developer: {
        [METRIC_TYPES.API_CALLS]:   { second: fib(6),   minute: fib(13),   hour: fib(18) },  // 8, 233, 2584→nearest to 300=233, 5000=4181
        [METRIC_TYPES.VECTOR_OPS]:  { minute: fib(16),  hour: fib(22) },                      // 987, 17711→nearest to 1000=987, 20000=17711
        [METRIC_TYPES.LLM_TOKENS]:  { minute: fib(27),  hour: fib(32) },                      // large Fibonacci approximations (fib(27)=196418≈200K, fib(32)=2178309≈2M)
      },
      team: {
        [METRIC_TYPES.API_CALLS]:   { second: fib(10),  minute: fib(17),   hour: fib(24) },  // 55, 1597≈2000, 46368≈50000
        [METRIC_TYPES.VECTOR_OPS]:  { minute: fib(19),  hour: fib(25) },                      // 4181≈5000, 75025≈100000
        [METRIC_TYPES.LLM_TOKENS]:  { minute: fib(28) },                                       // 317811≈300K→nearest Fibonacci
      },
      enterprise: {
        [METRIC_TYPES.API_CALLS]:   { second: fib(14),  minute: fib(22) }, // 377≈500, 17711≈20000
        [METRIC_TYPES.VECTOR_OPS]:  { minute: fib(24) },                    // 46368≈50000
      },
    };
    return base[plan] || base.community;
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  async _getPlan(orgId) {
    const cached = await this.redis.get(`heady:plan:${orgId}`);
    if (cached) return cached;

    const org = await this.db.organizations.findById(orgId);
    const plan = org?.plan || 'community';
    await this.redis.set(`heady:plan:${orgId}`, plan, 'EX', 300); // cache 5 min
    return plan;
  }

  _getPlanLimit(limits, metric, plan, orgId) {
    const map = {
      [METRIC_TYPES.API_CALLS]:    limits.api_calls_per_month ?? limits.api_calls_per_seat_per_month,
      [METRIC_TYPES.VECTOR_OPS]:   limits.vector_ops_per_month,
      [METRIC_TYPES.LLM_TOKENS]:   limits.llm_tokens_per_month,
      [METRIC_TYPES.AGENT_HOURS]:  null,  // Not hard-capped; metered only
      [METRIC_TYPES.STORAGE_GB]:   limits.vector_storage_gb,
    };
    return map[metric] ?? null; // null means unlimited
  }

  async _incrementCounters(orgId, userId, metric, quantity) {
    const month = this._currentMonth();
    const bucket = Math.floor(Date.now() / RATE_WINDOW_MS.hour);

    const pipeline = this.redis.pipeline();
    // Monthly org total
    pipeline.incrby(`heady:usage:org:${orgId}:${metric}:${month}`, quantity);
    pipeline.expire(`heady:usage:org:${orgId}:${metric}:${month}`, fib(11) * 86400); // fib(11)=89 days ≈ 3 months
    // Monthly user total
    pipeline.incrby(`heady:usage:user:${orgId}:${userId}:${metric}:${month}`, quantity);
    pipeline.expire(`heady:usage:user:${orgId}:${userId}:${metric}:${month}`, fib(11) * 86400);
    // Hourly time-series bucket
    pipeline.incrby(`heady:ts:${orgId}:${metric}:${bucket}`, quantity);
    pipeline.expire(`heady:ts:${orgId}:${metric}:${bucket}`, fib(9) * 86400); // fib(9)=34 days ≈ 5 weeks
    await pipeline.exec();
  }

  async _getCounter(key) {
    const val = await this.redis.get(key);
    return parseInt(val || '0', 10);
  }

  _monthKey(orgId, metric) {
    return `heady:usage:org:${orgId}:${metric}:${this._currentMonth()}`;
  }

  _historicalKey(orgId, metric, period) {
    if (period === 'last_month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `heady:usage:org:${orgId}:${metric}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return this._monthKey(orgId, metric);
  }

  _currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  _windowBucket(window) {
    const now = Date.now();
    return Math.floor(now / RATE_WINDOW_MS[window]);
  }

  _calculateOverage(metric, overageUnits) {
    const rate = OVERAGE_RATES[metric] || 0;
    return overageUnits * rate;
  }

  /**
   * Map utilization ratio to a status string using phi-harmonic thresholds.
   *
   * Replaces the old hard > 0.80 / > 0.95 checks with phi-derived levels:
   *   exceeded : ratio >= ALERT_THRESHOLDS.exceeded  (≈0.910)
   *   critical : ratio >= ALERT_THRESHOLDS.critical  (≈0.854)
   *   caution  : ratio >= ALERT_THRESHOLDS.caution   (≈0.764)
   *   warning  : ratio >= ALERT_THRESHOLDS.warning   (≈0.618)
   *   ok       : below warning threshold
   */
  _getUsageStatus(current, limit) {
    if (!limit) return 'unlimited';
    const ratio = current / limit;
    if (ratio >= ALERT_THRESHOLDS.exceeded) return 'exceeded';
    if (ratio >= ALERT_THRESHOLDS.critical) return 'critical';
    if (ratio >= ALERT_THRESHOLDS.caution)  return 'caution';
    if (ratio >= ALERT_THRESHOLDS.warning)  return 'warning';
    return 'ok';
  }

  _periodStart(period) {
    const now = new Date();
    if (period === 'current_month') {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    if (period === 'last_month') {
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    }
    return new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  }

  _periodEnd(period) {
    const now = new Date();
    if (period === 'current_month') return now.toISOString();
    if (period === 'last_month') {
      return new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    }
    return now.toISOString();
  }

  /**
   * Check phi-harmonic alert thresholds using CSL gate for smooth, continuous alerting.
   *
   * Instead of hard if (ratio >= 0.80) checks, we use cslGate() which produces a
   * sigmoid-weighted output:
   *
   *   alertWeight = cslGate(alertLevel, usageRatio, ALERT_THRESHOLDS.critical)
   *
   * A weight above CSL_THRESHOLDS.MEDIUM (≈0.809) triggers the alert email.
   * This avoids thundering-herd alerting at precisely the threshold boundary.
   */
  async _checkThresholds(orgId, userId, metric, projected, limit, plan) {
    const ratio = projected / limit;
    const alertKey = `heady:alert_sent:${orgId}:${metric}`;

    for (const [level, threshold] of Object.entries(ALERT_THRESHOLDS)) {
      if (level === 'hard_max') continue; // handled by plan enforcement

      // CSL gate: passes alert signal smoothly as ratio approaches each threshold
      // cslGate(value=1, cosScore=ratio, tau=threshold) → sigmoid weight in [0,1]
      const alertWeight = cslGate(1, ratio, threshold);

      // Only fire alert if gate is substantially open (weight above CSL MEDIUM ≈ 0.809)
      if (alertWeight >= CSL_THRESHOLDS.MEDIUM) {
        const sentKey = `${alertKey}:${level}:${this._currentMonth()}`;
        const alreadySent = await this.redis.get(sentKey);
        if (!alreadySent) {
          await this.redis.set(sentKey, '1', 'EX', fib(11) * 86400); // fib(11)=89 days
          this.emit('thresholdAlert', { orgId, userId, metric, ratio, level, plan, alertWeight });
        }
      }
    }
  }

  async _sendOverageAlert(org, metric, data, level) {
    if (!this.emailService) return;

    const key = `heady:overage_email:${org.id}:${metric}:${level}:${this._currentMonth()}`;
    const sent = await this.redis.get(key);
    if (sent) return; // Don't spam

    await this.redis.set(key, '1', 'EX', fib(9) * 86400); // fib(9)=34 days de-dup window

    await this.emailService.sendUsageAlert({
      to: org.billing_email,
      org_name: org.name,
      metric,
      level,
      current: data.current,
      limit: data.limit,
      utilization_pct: Math.round(data.utilization * 100),
      overage_usd: data.overage,
      dashboard_url: `https://app.headysystems.com/org/${org.id}/usage`,
    }).catch(err => console.error('[UsageMeter] Alert email failed:', err.message));
  }

  _queueStripeReport(orgId, metric, quantity) {
    if (!this._pendingReports.has(orgId)) {
      this._pendingReports.set(orgId, {});
    }
    const org = this._pendingReports.get(orgId);
    org[metric] = (org[metric] || 0) + quantity;
  }

  async _logEvent({ orgId, userId, metric, quantity, meta }) {
    // Async, non-blocking write to persistent store
    setImmediate(async () => {
      try {
        await this.db.usageEvents.create({
          org_id: orgId,
          user_id: userId,
          metric,
          quantity,
          meta: JSON.stringify(meta),
          timestamp: new Date(),
        });
      } catch (err) {
        // Don't let DB failures block requests
        console.error('[UsageMeter] Event log write failed:', err.message);
      }
    });
  }
}

// ── Express Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware factory for automatic usage tracking on API routes.
 *
 * @param {UsageMeter} meter
 * @param {string} metric — which metric this route consumes
 * @param {function} [quantityFn] — optional function(req) returning quantity
 *
 * @example
 * app.post('/api/v1/query', usageMiddleware(meter, METRIC_TYPES.API_CALLS));
 * app.post('/api/v1/embed', usageMiddleware(meter, METRIC_TYPES.VECTOR_OPS, req => req.body.texts?.length || 1));
 */
function usageMiddleware(meter, metric, quantityFn = () => 1) {
  return async (req, res, next) => {
    const orgId  = req.auth?.orgId  || req.headers['x-org-id'];
    const userId = req.auth?.userId || req.headers['x-user-id'];

    if (!orgId) return next(); // No org context — pass through

    // Check burst rate limit first (cheap Redis check)
    const rl = await meter.checkRateLimit(orgId, metric, 'minute').catch(() => ({ throttled: false }));
    if (rl.throttled) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded for ${metric}. Retry after ${rl.retry_after_s}s.`,
        retry_after: rl.retry_after_s,
      });
    }

    // Track usage and check monthly quota
    const quantity = quantityFn(req);
    const result = await meter.track({ orgId, userId, metric, quantity, meta: { path: req.path } });

    if (!result.allowed) {
      return res.status(429).json({
        error: result.reason,
        message: result.message,
        current: result.current,
        limit: result.limit,
        plan: result.plan,
        upgrade_url: result.upgrade_url,
      });
    }

    // Attach usage info to response headers
    if (result.limit) {
      res.setHeader('X-Usage-Current', result.current);
      res.setHeader('X-Usage-Limit', result.limit);
      res.setHeader('X-Usage-Remaining', Math.max(0, result.limit - result.current));
      res.setHeader('X-Usage-Phi-Warning-Threshold', ALERT_THRESHOLDS.warning.toFixed(4));
    }

    next();
  };
}

// ── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  UsageMeter,
  usageMiddleware,
  METRIC_TYPES,
  OVERAGE_RATES,
  ALERT_THRESHOLDS: ALERT_THRESHOLDS_EXPORT,  // phi-derived thresholds (re-exported)
  RATE_WINDOW_MS,
  PHI_WINDOW_PROGRESSION,
  FIB_BATCH_SIZES,
  STRIPE_FLUSH_INTERVAL_MS,
};
