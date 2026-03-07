'use strict';

const EventEmitter = require('events');

/**
 * TaskRouter — Task-aware routing engine.
 *
 * Features:
 *  - Routing matrix: task type → [primary, fallback1, fallback2]
 *  - Dynamic routing: shift to cheaper models near budget limit
 *  - Model affinity learning: track success rates per model per task type
 *  - Custom routing rules via config
 *  - Provider availability-aware routing
 */
class TaskRouter extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.matrix         task → [provider/model, ...]
   * @param {object} options.costTracker    CostTracker instance
   * @param {object} options.circuitBreaker CircuitBreakerManager instance
   */
  constructor(options = {}) {
    super();
    this._matrix      = options.matrix      || {};
    this.costTracker  = options.costTracker  || null;
    this.circuitBreaker = options.circuitBreaker || null;

    // Affinity learning: taskType → model → { attempts, successes }
    this._affinity = new Map();

    // Custom rules: array of { condition: fn(request), route: [provider/model] }
    this._customRules = [];

    // Stats
    this._routingDecisions = 0;
  }

  // ─── Matrix Management ────────────────────────────────────────────────────

  /**
   * Get the routing matrix (copy).
   */
  getMatrix() {
    return { ...this._matrix };
  }

  /**
   * Update routing for a task type.
   */
  setRoute(taskType, providers) {
    if (!Array.isArray(providers) || providers.length === 0) {
      throw new Error('providers must be a non-empty array');
    }
    this._matrix[taskType] = providers;
    this.emit('routeUpdated', taskType, providers);
  }

  /**
   * Add a custom routing rule (highest priority).
   * @param {Function} condition  (request) → boolean
   * @param {string[]} route      [provider/model, ...]
   */
  addCustomRule(condition, route) {
    this._customRules.push({ condition, route });
  }

  // ─── Routing Resolution ───────────────────────────────────────────────────

  /**
   * Resolve routing for a request.
   * Returns ordered list of {provider, model} objects to try.
   *
   * @param {object} request
   * @param {string} request.taskType
   * @param {string} [request.model]      explicit model override
   * @param {string} [request.provider]   explicit provider override
   * @returns {{ chain: [{provider, model}], taskType, reason }}
   */
  resolve(request) {
    this._routingDecisions++;
    const taskType = request.taskType || 'general';

    // 1. Explicit provider+model override
    if (request.provider && request.model) {
      return {
        chain:    [{ provider: request.provider, model: request.model }],
        taskType,
        reason:   'explicit_override',
      };
    }

    // 2. Custom rules (highest priority)
    for (const rule of this._customRules) {
      try {
        if (rule.condition(request)) {
          const chain = this._parseRouteList(rule.route);
          return { chain, taskType, reason: 'custom_rule' };
        }
      } catch (_) {}
    }

    // 3. Matrix lookup
    let routeList = this._matrix[taskType] || this._matrix['general'] || [];

    // 4. Budget-aware downgrade
    if (this.costTracker) {
      routeList = this._applyBudgetDowngrade(routeList);
    }

    // 5. Affinity sort (boost high-success models for this task type)
    routeList = this._applyAffinity(taskType, routeList);

    // 6. Filter out open circuits
    const filtered = routeList.filter(r => this._isAvailable(r));
    // Always include at least the first entry even if circuit is open (failover will handle it)
    const finalList = filtered.length > 0 ? filtered : routeList.slice(0, 1);

    const chain = this._parseRouteList(finalList);
    return { chain, taskType, reason: 'matrix' };
  }

  /**
   * Parse 'provider/model' strings into {provider, model} objects.
   */
  _parseRouteList(list) {
    return list.map(entry => {
      if (typeof entry === 'object' && entry.provider) return entry;
      const parts    = (entry || '').split('/');
      const provider = parts[0];
      const model    = parts.slice(1).join('/') || undefined;
      return { provider, model };
    });
  }

  /**
   * Apply budget-driven downgrade: if near budget limit, prefer cheaper entries.
   */
  _applyBudgetDowngrade(routeList) {
    if (!this.costTracker) return routeList;
    try {
      const totals = this.costTracker.getCurrentTotals();
      const dailyPct   = totals.daily.pct;
      const monthlyPct = totals.monthly.pct;
      const maxPct     = Math.max(dailyPct, monthlyPct);

      if (maxPct >= 0.9) {
        // At 90%: only use cheapest (last) entry
        return [routeList[routeList.length - 1]].filter(Boolean);
      }
      if (maxPct >= 0.75) {
        // At 75%: skip first (expensive primary), use fallbacks
        return routeList.slice(1).length > 0 ? routeList.slice(1) : routeList;
      }
    } catch (_) {}
    return routeList;
  }

  /**
   * Sort route list by affinity (success rate for this task type).
   */
  _applyAffinity(taskType, routeList) {
    const affinityMap = this._affinity.get(taskType);
    if (!affinityMap) return routeList;

    return [...routeList].sort((a, b) => {
      const aStats = affinityMap.get(a) || { attempts: 0, successes: 0 };
      const bStats = affinityMap.get(b) || { attempts: 0, successes: 0 };

      // Need minimum 5 attempts before trusting affinity data
      const aRate = aStats.attempts >= 5 ? aStats.successes / aStats.attempts : 0.5;
      const bRate = bStats.attempts >= 5 ? bStats.successes / bStats.attempts : 0.5;

      return bRate - aRate;  // descending
    });
  }

  /**
   * Check if a route entry's provider circuit is available.
   */
  _isAvailable(routeEntry) {
    if (!this.circuitBreaker) return true;
    const parsed = typeof routeEntry === 'string'
      ? routeEntry.split('/')[0]
      : routeEntry.provider;
    return this.circuitBreaker.isAvailable(parsed);
  }

  // ─── Affinity Learning ────────────────────────────────────────────────────

  /**
   * Record the outcome of a routing decision for affinity learning.
   * @param {string} taskType
   * @param {string} routeKey  'provider/model' string
   * @param {'success'|'failure'} outcome
   */
  recordOutcome(taskType, routeKey, outcome) {
    if (!this._affinity.has(taskType)) {
      this._affinity.set(taskType, new Map());
    }
    const affinityMap = this._affinity.get(taskType);
    if (!affinityMap.has(routeKey)) {
      affinityMap.set(routeKey, { attempts: 0, successes: 0 });
    }
    const stats = affinityMap.get(routeKey);
    stats.attempts++;
    if (outcome === 'success') stats.successes++;
    this.emit('affinityUpdate', taskType, routeKey, stats);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  getAffinityStats() {
    const result = {};
    for (const [taskType, modelMap] of this._affinity) {
      result[taskType] = {};
      for (const [routeKey, stats] of modelMap) {
        result[taskType][routeKey] = {
          ...stats,
          successRate: stats.attempts > 0 ? stats.successes / stats.attempts : null,
        };
      }
    }
    return result;
  }

  getStats() {
    return {
      routingDecisions: this._routingDecisions,
      customRules:      this._customRules.length,
      taskTypes:        Object.keys(this._matrix),
      affinityStats:    this.getAffinityStats(),
    };
  }
}

module.exports = TaskRouter;
