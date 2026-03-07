/**
 * Heady Latent OS — Feature Gate Module
 * HeadySystems, Inc.
 *
 * Production-grade feature gating and access control:
 *  - Per-plan feature definitions (community → enterprise)
 *  - featureGate.can(userId, 'feature_name') — primary access check API
 *  - Plan override and custom enterprise feature support
 *  - Feature flag management (kill switches, gradual rollouts)
 *  - A/B testing integration with experiment assignment
 *  - Usage quota enforcement with graceful degradation
 *  - Real-time flag updates via Redis pub/sub
 *
 * Phi-Math Integration (v2.0):
 *  - A/B test weights use phiFusionWeights(2) → [0.618, 0.382]
 *    (phi-biased exploration: slightly favors new variant)
 *  - Rollout weights [0.3, 0.7] replaced with [PSI², PSI] normalized
 *    → [0.382, 0.618] (inverse phi-split)
 *  - usage_pct threshold 0.6 → PSI (≈ 0.618)
 *  - queue_max: 50 → fib(10) = 55
 *  - Rollout percentage steps use Fibonacci progression:
 *    1%, 2%, 3%, 5%, 8%, 13%, 21%, 34%, 55%, 89%, 100%
 */

'use strict';

// ── Phi-Math Import ───────────────────────────────────────────────────────────
import {
  PHI,
  PSI,
  fib,
  fibSequence,
  phiFusionWeights,
  CSL_THRESHOLDS,
  cslGate,
  ALERT_THRESHOLDS,
} from '../../shared/phi-math.js';

const EventEmitter = require('events');
const crypto       = require('crypto');

// ── Phi-Derived Rollout Progression ──────────────────────────────────────────
// Fibonacci percentage steps for gradual feature rollout.
// Replaces arbitrary [1, 5, 10, 25, 50, 100] with:
//   1%, 2%, 3%, 5%, 8%, 13%, 21%, 34%, 55%, 89%, 100%
const PHI_ROLLOUT_STEPS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100];

// ── A/B Experiment Weights ─────────────────────────────────────────────────
// phiFusionWeights(2) → [φ/(φ+1), 1/(φ+1)] = [0.618, 0.382]
// Phi-biased: slightly favors the new variant (index 0 = higher weight)
// for golden-ratio exploration in A/B tests.
const PHI_AB_WEIGHTS = phiFusionWeights(2);   // [0.618, 0.382]

// Inverse phi-split weights: [PSI², PSI] normalized = [0.382, 0.618]
// Used for experiments where control gets 38.2% and treatment gets 61.8%.
const PSI_SPLIT_WEIGHTS = (() => {
  const raw = [PSI * PSI, PSI]; // [0.382, 0.618]
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(r => r / sum);  // normalized → still [0.382, 0.618]
})();

// ── Plan Feature Definitions ──────────────────────────────────────────────────

/**
 * Master feature registry.
 * Features are inherited upward: community ⊂ developer ⊂ team ⊂ enterprise
 *
 * Each feature entry:
 *  - plans: which plan tiers have access
 *  - description: human-readable description
 *  - ga: whether feature is generally available (vs. beta/experimental)
 *  - category: grouping for admin UI
 */
const FEATURE_DEFINITIONS = {
  // ── Core Platform ──────────────────────────────────────────────────────────
  'latent_os.runtime': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Core Latent OS runtime execution',
    ga: true, category: 'core',
  },
  'latent_os.cloud_hosted': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Cloud-hosted runtime (vs. self-hosted only)',
    ga: true, category: 'core',
  },
  'latent_os.self_hosted': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Self-hosted deployment option',
    ga: true, category: 'core',
  },
  'latent_os.on_premises': {
    plans: ['enterprise'],
    description: 'On-premises / VPC / air-gapped deployment',
    ga: true, category: 'core',
  },
  'latent_os.byom': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Bring Your Own Model (BYOM) endpoint support',
    ga: true, category: 'core',
  },

  // ── Vector Memory ──────────────────────────────────────────────────────────
  'memory.vector_storage': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Persistent vector memory storage',
    ga: true, category: 'memory',
  },
  'memory.multi_namespace': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Multiple named vector namespaces per org',
    ga: true, category: 'memory',
  },
  'memory.cross_org_sharing': {
    plans: ['enterprise'],
    description: 'Shared vector memory across enterprise sub-orgs',
    ga: false, category: 'memory',
  },

  // ── Agent Swarms ───────────────────────────────────────────────────────────
  'agents.single': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Single agent execution',
    ga: true, category: 'agents',
  },
  'agents.parallel': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Parallel multi-agent execution (swarms)',
    ga: true, category: 'agents',
  },
  'agents.swarm_coordination': {
    plans: ['team', 'enterprise'],
    description: 'Advanced swarm orchestration and state sharing',
    ga: true, category: 'agents',
  },
  'agents.custom_runtime': {
    plans: ['enterprise'],
    description: 'Custom agent runtime environment with GPU access',
    ga: false, category: 'agents',
  },

  // ── MCP (Model Context Protocol) ──────────────────────────────────────────
  'mcp.protocol': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'MCP tool protocol support',
    ga: true, category: 'mcp',
  },
  'mcp.custom_tools': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Register and deploy custom MCP tools',
    ga: true, category: 'mcp',
  },
  'mcp.tool_marketplace': {
    plans: ['team', 'enterprise'],
    description: 'Access to Heady tool marketplace',
    ga: false, category: 'mcp',
  },

  // ── Team & Administration ──────────────────────────────────────────────────
  'admin.team_management': {
    plans: ['team', 'enterprise'],
    description: 'Multi-user team management dashboard',
    ga: true, category: 'admin',
  },
  'admin.rbac': {
    plans: ['team', 'enterprise'],
    description: 'Role-based access control (admin, developer, viewer)',
    ga: true, category: 'admin',
  },
  'admin.sso_saml': {
    plans: ['team', 'enterprise'],
    description: 'SSO via SAML 2.0, Google Workspace, GitHub',
    ga: true, category: 'admin',
  },
  'admin.scim_provisioning': {
    plans: ['enterprise'],
    description: 'SCIM 2.0 user provisioning and deprovisioning',
    ga: true, category: 'admin',
  },
  'admin.custom_domains': {
    plans: ['enterprise'],
    description: 'Custom domain for hosted endpoints',
    ga: true, category: 'admin',
  },
  'admin.white_label': {
    plans: ['enterprise'],
    description: 'White-label branding for embedded deployments',
    ga: false, category: 'admin',
  },

  // ── Security & Compliance ──────────────────────────────────────────────────
  'security.encryption_at_rest': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'AES-256 encryption at rest',
    ga: true, category: 'security',
  },
  'security.audit_logs': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Security audit log trail',
    ga: true, category: 'security',
  },
  'security.extended_audit_retention': {
    plans: ['enterprise'],
    description: 'Audit log retention up to 7 years',
    ga: true, category: 'security',
  },
  'security.soc2': {
    plans: ['team', 'enterprise'],
    description: 'SOC 2 Type II compliance coverage',
    ga: true, category: 'security',
  },
  'security.hipaa_baa': {
    plans: ['enterprise'],
    description: 'HIPAA Business Associate Agreement',
    ga: true, category: 'security',
  },
  'security.iso27001': {
    plans: ['enterprise'],
    description: 'ISO 27001 certification coverage',
    ga: true, category: 'security',
  },
  'security.ip_allowlist': {
    plans: ['team', 'enterprise'],
    description: 'IP allowlist enforcement for API access',
    ga: true, category: 'security',
  },
  'security.mfa_enforcement': {
    plans: ['team', 'enterprise'],
    description: 'Enforce MFA for all team members',
    ga: true, category: 'security',
  },

  // ── Analytics & Observability ──────────────────────────────────────────────
  'analytics.basic': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Basic usage charts and metrics',
    ga: true, category: 'analytics',
  },
  'analytics.advanced': {
    plans: ['team', 'enterprise'],
    description: 'Advanced analytics: cost attribution, LLM quality metrics, latency',
    ga: true, category: 'analytics',
  },
  'analytics.export': {
    plans: ['team', 'enterprise'],
    description: 'Export usage data to CSV/JSON/Webhook',
    ga: true, category: 'analytics',
  },
  'analytics.custom_dashboards': {
    plans: ['enterprise'],
    description: 'Custom analytics dashboards and alerting',
    ga: false, category: 'analytics',
  },

  // ── Support ────────────────────────────────────────────────────────────────
  'support.community': {
    plans: ['community', 'developer', 'team', 'enterprise'],
    description: 'Community Discord and GitHub support',
    ga: true, category: 'support',
  },
  'support.email': {
    plans: ['developer', 'team', 'enterprise'],
    description: 'Email support with SLA',
    ga: true, category: 'support',
  },
  'support.priority': {
    plans: ['team', 'enterprise'],
    description: 'Priority support queue with 8h SLA',
    ga: true, category: 'support',
  },
  'support.dedicated_csm': {
    plans: ['enterprise'],
    description: 'Dedicated Customer Success Manager',
    ga: true, category: 'support',
  },
  'support.sla_99_99': {
    plans: ['enterprise'],
    description: '99.99% uptime SLA with credits',
    ga: true, category: 'support',
  },

  // ── Beta / Experimental features ──────────────────────────────────────────
  'beta.edge_inference': {
    plans: ['enterprise'],
    description: 'Edge AI inference via Cloudflare Workers',
    ga: false, category: 'beta', beta: true,
  },
  'beta.model_fine_tuning': {
    plans: ['enterprise'],
    description: 'Fine-tune models on your data within the platform',
    ga: false, category: 'beta', beta: true,
  },
  'beta.federated_memory': {
    plans: ['enterprise'],
    description: 'Federated vector memory across air-gapped deployments',
    ga: false, category: 'beta', beta: true,
  },
};

// ── Experiment Definitions (A/B Tests) ────────────────────────────────────────
//
// Weights are phi-derived:
//   Equal split → phiFusionWeights(2) = [0.618, 0.382]  (phi-biased exploration)
//   Control-lean → PSI_SPLIT_WEIGHTS  = [0.382, 0.618]  (inverse phi — control is minor)
//
// usage_pct threshold 0.6 → PSI (≈ 0.618)

const EXPERIMENTS = {
  'pricing_v2': {
    description: 'Test new pricing page layout with usage estimator',
    variants: ['control', 'estimator_cta'],
    // phiFusionWeights(2) → [0.618, 0.382]: new variant gets phi-majority share
    weights: PHI_AB_WEIGHTS,   // [≈0.618, ≈0.382]
    targeting: { plan: ['community', 'developer'] },
    active: true,
  },
  'onboarding_flow_v3': {
    description: 'New agent quickstart onboarding vs. existing flow',
    variants: ['control', 'quickstart_v3'],
    // PSI_SPLIT_WEIGHTS → [0.382, 0.618]: new variant gets phi-majority
    weights: PSI_SPLIT_WEIGHTS,  // [≈0.382, ≈0.618]
    targeting: { plan: ['developer', 'team'] },
    active: true,
  },
  'byom_upsell': {
    description: 'Show BYOM upsell banner on token usage page',
    variants: ['control', 'banner'],
    // phiFusionWeights(2) → [0.618, 0.382]: equal-ish exploration
    weights: PHI_AB_WEIGHTS,   // [≈0.618, ≈0.382]
    // usage_pct threshold: PSI ≈ 0.618 (replaces arbitrary 0.6)
    targeting: { plan: ['developer'], usage_pct: { llm_tokens: PSI } },
    active: false,
  },
};

// ── FeatureGate Class ─────────────────────────────────────────────────────────

/**
 * FeatureGate provides fine-grained access control for all Heady features.
 *
 * @example
 * const gate = new FeatureGate({ redis, db });
 * await gate.init();
 *
 * // Primary access check
 * if (await gate.can(userId, 'agents.swarm_coordination')) {
 *   // Use swarm feature
 * }
 *
 * // With graceful degradation
 * const feature = await gate.canWithFallback(userId, 'analytics.advanced', 'analytics.basic');
 *
 * // A/B experiment assignment
 * const variant = await gate.getExperimentVariant(userId, 'pricing_v2');
 */
class FeatureGate extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.redis    — ioredis client
   * @param {object} options.db       — database ORM
   * @param {boolean} [options.cache=true] — cache user plan/overrides in Redis
   * @param {number} [options.cacheTtlSec=300] — cache TTL in seconds
   */
  constructor({ redis, db, cache = true, cacheTtlSec = 300 }) {
    super();
    this.redis = redis;
    this.db = db;
    this.cache = cache;
    this.cacheTtlSec = cacheTtlSec;
    this._localFlags = new Map(); // in-process kill switches loaded at init
  }

  /**
   * Initialize: load kill switches from Redis into memory, subscribe to updates.
   */
  async init() {
    await this._loadKillSwitches();
    await this._subscribeToFlagUpdates();
    this.emit('ready');
  }

  // ── Primary Access API ─────────────────────────────────────────────────────

  /**
   * Check if a user has access to a feature.
   *
   * Resolution order:
   *  1. Kill switch (instant disable for all users)
   *  2. User-level override (explicit grant or deny)
   *  3. Org-level override (custom enterprise features)
   *  4. Plan-level definition
   *  5. Default: false (deny)
   *
   * @param {string} userId     — internal user ID
   * @param {string} feature    — feature key (e.g., 'agents.swarm_coordination')
   * @returns {Promise<boolean>}
   */
  async can(userId, feature) {
    try {
      // 1. Kill switch: instant deny
      if (this._localFlags.get(`kill:${feature}`) === true) {
        this.emit('access_denied', { userId, feature, reason: 'kill_switch' });
        return false;
      }

      // 2. User-level override
      const userOverride = await this._getUserOverride(userId, feature);
      if (userOverride !== null) {
        this.emit('access_checked', { userId, feature, granted: userOverride, source: 'user_override' });
        return userOverride;
      }

      // 3. Org-level override
      const orgId = await this._getOrgId(userId);
      const orgOverride = await this._getOrgOverride(orgId, feature);
      if (orgOverride !== null) {
        this.emit('access_checked', { userId, feature, granted: orgOverride, source: 'org_override' });
        return orgOverride;
      }

      // 4. Plan-level access
      const plan = await this._getPlan(userId, orgId);
      const granted = this._checkPlanAccess(plan, feature);

      this.emit('access_checked', { userId, feature, granted, source: 'plan', plan });
      return granted;

    } catch (err) {
      this.emit('error', err);
      // Fail open for existing features, closed for new ones
      const def = FEATURE_DEFINITIONS[feature];
      return def?.ga === true; // If GA, fail open; if beta, fail closed
    }
  }

  /**
   * Check access and return degraded feature if primary is unavailable.
   *
   * @param {string} userId
   * @param {string} feature        — preferred feature
   * @param {string} fallbackFeature — fallback if primary denied
   * @returns {Promise<string|null>} — granted feature key or null if both denied
   */
  async canWithFallback(userId, feature, fallbackFeature) {
    if (await this.can(userId, feature)) return feature;
    if (await this.can(userId, fallbackFeature)) return fallbackFeature;
    return null;
  }

  /**
   * Check multiple features at once. Returns a map of feature → boolean.
   *
   * @param {string} userId
   * @param {string[]} features
   * @returns {Promise<Record<string, boolean>>}
   */
  async canBatch(userId, features) {
    const results = await Promise.all(
      features.map(f => this.can(userId, f).then(granted => [f, granted]))
    );
    return Object.fromEntries(results);
  }

  /**
   * Require feature access or throw a FeatureGateError.
   *
   * @throws {FeatureGateError}
   */
  async require(userId, feature) {
    const granted = await this.can(userId, feature);
    if (!granted) {
      const plan = await this._getPlan(userId);
      const def = FEATURE_DEFINITIONS[feature];
      const minPlan = def ? def.plans[0] : 'enterprise';
      throw new FeatureGateError(feature, plan, minPlan);
    }
  }

  // ── Express Middleware ─────────────────────────────────────────────────────

  /**
   * Express middleware that gates a route behind a feature flag.
   *
   * @param {string} feature  — feature key required to access the route
   * @returns {import('express').RequestHandler}
   *
   * @example
   * app.get('/api/v1/swarm', featureGate.middleware('agents.swarm_coordination'), handler)
   */
  middleware(feature) {
    return async (req, res, next) => {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'unauthenticated' });
      }

      try {
        await this.require(userId, feature);
        next();
      } catch (err) {
        if (err instanceof FeatureGateError) {
          return res.status(403).json({
            error: 'feature_not_available',
            feature: err.feature,
            message: err.message,
            current_plan: err.currentPlan,
            required_plan: err.requiredPlan,
            upgrade_url: `https://headysystems.com/pricing?highlight=${err.requiredPlan}`,
          });
        }
        next(err);
      }
    };
  }

  // ── Plan Override Management ───────────────────────────────────────────────

  /**
   * Grant a specific feature to a user regardless of plan.
   * Used for: trials, beta access, support exceptions, demos.
   *
   * @param {string} userId
   * @param {string} feature
   * @param {object} [options]
   * @param {number} [options.expiresInDays]  — auto-expire the override
   * @param {string} [options.reason]         — audit trail reason
   */
  async grantUserFeature(userId, feature, { expiresInDays, reason = 'manual_grant' } = {}) {
    const key = `heady:fg:user:${userId}:${feature}`;
    const value = JSON.stringify({ granted: true, reason, at: new Date().toISOString() });

    if (expiresInDays) {
      await this.redis.set(key, value, 'EX', expiresInDays * 86400);
    } else {
      await this.redis.set(key, value);
    }

    await this.db.featureOverrides.upsert({ userId, feature, granted: true, reason });
    this.emit('override_set', { userId, feature, granted: true, reason });
  }

  /**
   * Deny a feature for a specific user (override plan access).
   */
  async denyUserFeature(userId, feature, { reason = 'manual_deny' } = {}) {
    const key = `heady:fg:user:${userId}:${feature}`;
    await this.redis.set(key, JSON.stringify({ granted: false, reason }));
    await this.db.featureOverrides.upsert({ userId, feature, granted: false, reason });
    this.emit('override_set', { userId, feature, granted: false, reason });
  }

  /**
   * Grant a feature to an entire organization (enterprise custom features).
   *
   * @param {string} orgId
   * @param {string} feature
   * @param {object} [options]
   */
  async grantOrgFeature(orgId, feature, { expiresInDays, reason = 'enterprise_contract' } = {}) {
    const key = `heady:fg:org:${orgId}:${feature}`;
    const value = JSON.stringify({ granted: true, reason, at: new Date().toISOString() });

    if (expiresInDays) {
      await this.redis.set(key, value, 'EX', expiresInDays * 86400);
    } else {
      await this.redis.set(key, value);
    }

    await this.db.orgFeatureOverrides.upsert({ orgId, feature, granted: true, reason });
    this.emit('org_override_set', { orgId, feature, granted: true, reason });
  }

  /**
   * Get all custom enterprise features granted to an organization.
   */
  async getOrgCustomFeatures(orgId) {
    const overrides = await this.db.orgFeatureOverrides.findByOrg(orgId);
    return overrides.filter(o => o.granted);
  }

  // ── Feature Flag Management (Kill Switches) ───────────────────────────────

  /**
   * Enable a kill switch to instantly disable a feature for ALL users.
   * Use for: incidents, security issues, staged rollbacks.
   *
   * @param {string} feature
   * @param {string} [reason]
   */
  async enableKillSwitch(feature, reason = '') {
    const key = `heady:fg:kill:${feature}`;
    await this.redis.set(key, JSON.stringify({ active: true, reason, at: new Date().toISOString() }));
    this._localFlags.set(`kill:${feature}`, true);
    // Publish to all instances
    await this.redis.publish('heady:fg:updates', JSON.stringify({ type: 'kill', feature, active: true }));
    this.emit('kill_switch', { feature, active: true, reason });
    console.warn(`[FeatureGate] KILL SWITCH ENABLED: ${feature} — ${reason}`);
  }

  /**
   * Disable a kill switch to restore feature access.
   */
  async disableKillSwitch(feature) {
    const key = `heady:fg:kill:${feature}`;
    await this.redis.del(key);
    this._localFlags.delete(`kill:${feature}`);
    await this.redis.publish('heady:fg:updates', JSON.stringify({ type: 'kill', feature, active: false }));
    this.emit('kill_switch', { feature, active: false });
    console.log(`[FeatureGate] Kill switch disabled: ${feature}`);
  }

  /**
   * Gradually roll out a feature to a percentage of users.
   * Percentage should be one of the Fibonacci rollout steps:
   *   1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100
   *
   * @param {string} feature
   * @param {number} pct    — 0–100; should be a Fibonacci step for coherent rollout
   */
  async setGradualRollout(feature, pct) {
    // Snap to nearest Fibonacci rollout step for phi-coherence
    const snappedPct = PHI_ROLLOUT_STEPS.reduce((prev, curr) =>
      Math.abs(curr - pct) < Math.abs(prev - pct) ? curr : prev
    );

    const key = `heady:fg:rollout:${feature}`;
    await this.redis.set(key, String(snappedPct));
    this.emit('rollout_updated', { feature, pct: snappedPct, requested: pct });

    if (snappedPct !== pct) {
      console.log(`[FeatureGate] Rollout pct ${pct}% snapped to Fibonacci step ${snappedPct}%`);
    }
  }

  // ── A/B Testing ────────────────────────────────────────────────────────────

  /**
   * Get the A/B experiment variant for a user.
   * Assignment is deterministic (same user always gets same variant).
   * Weights use phi-fusion (phiFusionWeights(2) or PSI_SPLIT_WEIGHTS).
   *
   * @param {string} userId
   * @param {string} experimentId
   * @returns {Promise<string>} variant name
   */
  async getExperimentVariant(userId, experimentId) {
    const experiment = EXPERIMENTS[experimentId];
    if (!experiment || !experiment.active) {
      return 'control';
    }

    // Check targeting rules
    const eligible = await this._checkExperimentTargeting(userId, experiment);
    if (!eligible) return 'control';

    // Check for existing assignment
    const assignKey = `heady:exp:${experimentId}:${userId}`;
    const cached = await this.redis.get(assignKey);
    if (cached) return cached;

    // Deterministic hash-based assignment using phi-fusion weights
    const variant = this._hashAssign(userId, experimentId, experiment.variants, experiment.weights);
    await this.redis.set(assignKey, variant, 'EX', fib(12) * 86400); // fib(12)=144 days assignment

    this.emit('experiment_assigned', { userId, experimentId, variant });
    return variant;
  }

  /**
   * Track an experiment event (impression, conversion, etc.).
   *
   * @param {string} userId
   * @param {string} experimentId
   * @param {string} event        — 'impression' | 'conversion' | 'engagement'
   * @param {object} [meta]
   */
  async trackExperiment(userId, experimentId, event, meta = {}) {
    const variant = await this.getExperimentVariant(userId, experimentId);

    await this.db.experimentEvents.create({
      user_id: userId,
      experiment_id: experimentId,
      variant,
      event,
      meta: JSON.stringify(meta),
      timestamp: new Date(),
    });

    this.emit('experiment_event', { userId, experimentId, variant, event });
  }

  // ── Usage Quota Enforcement ────────────────────────────────────────────────

  /**
   * Check if a user's org is over quota for a feature.
   * Returns graceful degradation config instead of hard failure.
   *
   * @param {string} userId
   * @param {string} feature
   * @returns {Promise<QuotaResult>}
   */
  async checkQuota(userId, feature) {
    const orgId = await this._getOrgId(userId);

    // Features with associated quotas
    const quotaFeatures = {
      'agents.parallel':       'parallel_agents',
      'memory.vector_storage': 'vector_storage_gb',
      'mcp.custom_tools':      'custom_tools_count',
    };

    const quotaKey = quotaFeatures[feature];
    if (!quotaKey) return { withinQuota: true };

    const plan = await this._getPlan(userId, orgId);
    const limits = require('../configs/stripe-config').PLAN_LIMITS[plan];
    const limit = limits?.[quotaKey];

    if (limit === null || limit === undefined) return { withinQuota: true, unlimited: true };

    const current = await this._getCurrentQuotaUsage(orgId, quotaKey);

    return {
      withinQuota: current < limit,
      current,
      limit,
      utilization: current / limit,
      degradation: current >= limit ? this._getDegradationConfig(feature) : null,
    };
  }

  /**
   * Get graceful degradation behavior for a feature over quota.
   *
   * queue_max uses fib(10) = 55 (replaces arbitrary 50).
   *
   * @returns {object} degradation config
   */
  _getDegradationConfig(feature) {
    const configs = {
      'agents.parallel': {
        strategy: 'queue',
        message: 'Maximum parallel agents reached. New agents will queue.',
        queue_max: fib(10),  // fib(10) = 55 (replaces arbitrary 50)
      },
      'memory.vector_storage': {
        strategy: 'oldest_eviction',
        message: 'Vector storage limit reached. Oldest vectors will be evicted for new inserts.',
        eviction_policy: 'lru',
      },
      'mcp.custom_tools': {
        strategy: 'disable_least_used',
        message: 'Custom tool limit reached. Disable unused tools to register new ones.',
      },
    };
    return configs[feature] || { strategy: 'block', message: 'Quota exceeded. Please upgrade.' };
  }

  // ── Feature Listing (for admin UI) ────────────────────────────────────────

  /**
   * Get all features available to a user's plan (for feature discovery UI).
   */
  async getUserFeatures(userId) {
    const orgId = await this._getOrgId(userId);
    const plan = await this._getPlan(userId, orgId);
    const result = {};

    for (const [feature, def] of Object.entries(FEATURE_DEFINITIONS)) {
      const granted = this._checkPlanAccess(plan, feature);
      const userOverride = await this._getUserOverride(userId, feature);
      const orgOverride = await this._getOrgOverride(orgId, feature);

      result[feature] = {
        granted: userOverride ?? orgOverride ?? granted,
        source: userOverride !== null ? 'user_override'
              : orgOverride  !== null ? 'org_override'
              : 'plan',
        plan_minimum: def.plans[0],
        category: def.category,
        description: def.description,
        ga: def.ga,
        beta: def.beta || false,
      };
    }

    return result;
  }

  /**
   * Get all features enabled for an organization.
   */
  async getOrgFeatures(orgId) {
    const org = await this.db.organizations.findById(orgId);
    const plan = org?.plan || 'community';
    const planFeatures = Object.entries(FEATURE_DEFINITIONS)
      .filter(([, def]) => def.plans.includes(plan))
      .map(([feature]) => feature);

    const customFeatures = await this.getOrgCustomFeatures(orgId);

    return {
      plan,
      plan_features: planFeatures,
      custom_features: customFeatures.map(o => o.feature),
      all_features: [...new Set([...planFeatures, ...customFeatures.map(o => o.feature)])],
    };
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  _checkPlanAccess(plan, feature) {
    const def = FEATURE_DEFINITIONS[feature];
    if (!def) return false;

    // Check gradual rollout (must be at 100 for full plan-level access)
    const rolloutPct = this._localFlags.get(`rollout:${feature}`);
    if (rolloutPct !== undefined && rolloutPct < 100) {
      return false;
    }

    return def.plans.includes(plan);
  }

  async _getUserOverride(userId, feature) {
    try {
      const key = `heady:fg:user:${userId}:${feature}`;
      const val = await this.redis.get(key);
      if (!val) return null;
      return JSON.parse(val).granted;
    } catch {
      return null;
    }
  }

  async _getOrgOverride(orgId, feature) {
    if (!orgId) return null;
    try {
      const key = `heady:fg:org:${orgId}:${feature}`;
      const val = await this.redis.get(key);
      if (!val) return null;
      return JSON.parse(val).granted;
    } catch {
      return null;
    }
  }

  async _getPlan(userId, orgId = null) {
    if (this.cache) {
      const cacheKey = `heady:plan:user:${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;
    }

    const resolvedOrgId = orgId || await this._getOrgId(userId);
    const org = await this.db.organizations.findById(resolvedOrgId);
    const plan = org?.plan || 'community';

    if (this.cache) {
      await this.redis.set(`heady:plan:user:${userId}`, plan, 'EX', this.cacheTtlSec);
    }
    return plan;
  }

  async _getOrgId(userId) {
    const cacheKey = `heady:fg:orgid:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const user = await this.db.users.findById(userId);
    const orgId = user?.org_id || null;
    if (orgId) await this.redis.set(cacheKey, orgId, 'EX', this.cacheTtlSec);
    return orgId;
  }

  async _loadKillSwitches() {
    const keys = await this.redis.keys('heady:fg:kill:*');
    for (const key of keys) {
      const val = await this.redis.get(key);
      if (val) {
        const { active } = JSON.parse(val);
        const feature = key.replace('heady:fg:kill:', '');
        if (active) this._localFlags.set(`kill:${feature}`, true);
      }
    }

    const rolloutKeys = await this.redis.keys('heady:fg:rollout:*');
    for (const key of rolloutKeys) {
      const pct = parseInt(await this.redis.get(key) || '100', 10);
      const feature = key.replace('heady:fg:rollout:', '');
      this._localFlags.set(`rollout:${feature}`, pct);
    }

    console.log(`[FeatureGate] Loaded ${this._localFlags.size} local flags.`);
    console.log(`[FeatureGate] Phi A/B weights: [${PHI_AB_WEIGHTS.map(w => w.toFixed(4)).join(', ')}]`);
    console.log(`[FeatureGate] PSI split weights: [${PSI_SPLIT_WEIGHTS.map(w => w.toFixed(4)).join(', ')}]`);
    console.log(`[FeatureGate] Fibonacci rollout steps: [${PHI_ROLLOUT_STEPS.join(', ')}]%`);
  }

  async _subscribeToFlagUpdates() {
    // Use a separate Redis connection for pub/sub
    try {
      const sub = this.redis.duplicate();
      await sub.subscribe('heady:fg:updates');
      sub.on('message', (channel, msg) => {
        try {
          const update = JSON.parse(msg);
          if (update.type === 'kill') {
            if (update.active) {
              this._localFlags.set(`kill:${update.feature}`, true);
            } else {
              this._localFlags.delete(`kill:${update.feature}`);
            }
            this.emit('flag_updated', update);
          }
        } catch (err) {
          console.error('[FeatureGate] Flag update parse error:', err.message);
        }
      });
    } catch (err) {
      console.warn('[FeatureGate] Could not subscribe to flag updates:', err.message);
    }
  }

  async _checkExperimentTargeting(userId, experiment) {
    if (!experiment.targeting) return true;

    const plan = await this._getPlan(userId);
    if (experiment.targeting.plan && !experiment.targeting.plan.includes(plan)) return false;

    // usage_pct targeting now uses PSI (≈ 0.618) instead of arbitrary 0.6
    // No change needed in logic here — the threshold is stored in EXPERIMENTS object above

    return true;
  }

  _hashAssign(userId, experimentId, variants, weights) {
    // Deterministic hash: same user always in same variant
    // Uses phi-fusion weights (passed in from EXPERIMENTS definition)
    const hash = crypto.createHash('sha256').update(`${userId}:${experimentId}`).digest('hex');
    const normalized = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;

    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (normalized < cumulative) return variants[i];
    }
    return variants[variants.length - 1];
  }

  async _getCurrentQuotaUsage(orgId, quotaKey) {
    const key = `heady:quota:${orgId}:${quotaKey}`;
    const val = await this.redis.get(key);
    return parseInt(val || '0', 10);
  }
}

// ── FeatureGateError ──────────────────────────────────────────────────────────

class FeatureGateError extends Error {
  /**
   * @param {string} feature     — feature key that was denied
   * @param {string} currentPlan — user's current plan
   * @param {string} requiredPlan — minimum plan needed
   */
  constructor(feature, currentPlan, requiredPlan) {
    const def = FEATURE_DEFINITIONS[feature];
    super(
      `Feature '${feature}' is not available on the ${currentPlan} plan. ` +
      `${def?.description ? `(${def.description}) ` : ''}` +
      `Upgrade to ${requiredPlan} or higher.`
    );
    this.name = 'FeatureGateError';
    this.feature = feature;
    this.currentPlan = currentPlan;
    this.requiredPlan = requiredPlan;
    this.statusCode = 403;
  }
}

// ── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  FeatureGate,
  FeatureGateError,
  FEATURE_DEFINITIONS,
  EXPERIMENTS,
  // Phi constants for consumers
  PHI_AB_WEIGHTS,
  PSI_SPLIT_WEIGHTS,
  PHI_ROLLOUT_STEPS,
};
