/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { DriftDetector } = require('../drift-detector');

// ─── Constants ────────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

const LAYER_IDS = ['local', 'cloud-me', 'cloud-sys', 'cloud-conn', 'hybrid'];

// Layer descriptors
const LAYER_DEFINITIONS = {
  'local': {
    id:          'local',
    class:       'HeadyLocal',
    description: 'On-device local compute (CPU/GPU)',
    costTier:    'free',
    latencyMs:   10,
    capabilities: ['inference', 'embedding', 'storage'],
  },
  'cloud-me': {
    id:          'cloud-me',
    class:       'HeadyCloudMe',
    description: 'User-owned personal cloud resources',
    costTier:    'personal',
    latencyMs:   100,
    capabilities: ['inference', 'embedding', 'storage', 'scheduling'],
  },
  'cloud-sys': {
    id:          'cloud-sys',
    class:       'HeadyCloudSys',
    description: 'Heady Systems managed cloud infrastructure',
    costTier:    'managed',
    latencyMs:   50,
    capabilities: ['inference', 'embedding', 'storage', 'scheduling', 'governance'],
  },
  'cloud-conn': {
    id:          'cloud-conn',
    class:       'HeadyCloudConn',
    description: 'Third-party connected cloud providers (AWS, GCP, Azure)',
    costTier:    'provider',
    latencyMs:   80,
    capabilities: ['inference', 'storage', 'compute', 'network'],
  },
  'hybrid': {
    id:          'hybrid',
    class:       'HeadyHybrid',
    description: 'Hybrid edge-cloud mesh routing',
    costTier:    'variable',
    latencyMs:   30,
    capabilities: ['inference', 'routing', 'caching', 'edge'],
  },
};

// Default desired state per layer
const DEFAULT_DESIRED_STATE = {
  'local': {
    replicas:      1,
    memoryGB:      8,
    gpuEnabled:    false,
    models:        ['llama3', 'mistral'],
    enabled:       true,
  },
  'cloud-me': {
    replicas:      2,
    memoryGB:      16,
    gpuEnabled:    true,
    models:        ['claude-sonnet-4', 'gpt-4o'],
    enabled:       true,
  },
  'cloud-sys': {
    replicas:      5,
    memoryGB:      64,
    gpuEnabled:    true,
    models:        ['claude-opus-4', 'gpt-4o', 'gemini-pro'],
    enabled:       true,
  },
  'cloud-conn': {
    replicas:      3,
    memoryGB:      32,
    gpuEnabled:    true,
    models:        ['various'],
    enabled:       true,
  },
  'hybrid': {
    replicas:      4,
    memoryGB:      16,
    gpuEnabled:    false,
    models:        ['router-only'],
    enabled:       true,
  },
};

// ─── HeadyCloudConductor ──────────────────────────────────────────────────────

class HeadyCloudConductor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = Object.assign({
      reconcileIntervalMs: 60_000, // 1 minute
      driftThreshold:      0.1,
    }, options);

    // Desired state per layer
    this._desiredState = {};
    for (const layerId of LAYER_IDS) {
      this._desiredState[layerId] = { ...DEFAULT_DESIRED_STATE[layerId] };
    }

    // Actual/observed state per layer (populated by monitoring)
    this._actualState = {};
    for (const layerId of LAYER_IDS) {
      this._actualState[layerId] = null; // unknown until first poll
    }

    // Layer allocation: demand-driven weights (sum to 1.0)
    this._layerAllocation = {
      'local':      0.20,
      'cloud-me':   0.25,
      'cloud-sys':  0.30,
      'cloud-conn': 0.15,
      'hybrid':     0.10,
    };

    // Per-tenant policy store: tenantId → policy
    this._tenantPolicies = new Map();

    // Drift detector
    this._driftDetector = new DriftDetector();

    // Provisioning queue
    this._provisionQueue = [];
    this._provisioning   = new Set();

    // Reconcile timer
    this._reconcileTimer = null;

    logger.logSystem('HeadyCloudConductor', 'Initialized', {
      layers: LAYER_IDS,
      reconcileInterval: this.options.reconcileIntervalMs,
    });
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  start() {
    if (this._reconcileTimer) return;
    this._reconcileTimer = setInterval(
      () => this.reconcile().catch(err => logger.error('HeadyCloudConductor', 'Auto-reconcile error', { error: err.message })),
      this.options.reconcileIntervalMs
    );
    logger.logSystem('HeadyCloudConductor', 'Auto-reconcile started', {
      interval: this.options.reconcileIntervalMs,
    });
  }

  stop() {
    if (this._reconcileTimer) {
      clearInterval(this._reconcileTimer);
      this._reconcileTimer = null;
    }
  }

  // ── Desired State ──────────────────────────────────────────────────────────

  getDesiredState(layerId) {
    if (layerId) {
      return this._desiredState[layerId] || null;
    }
    // Return full desired state
    const full = {};
    for (const id of LAYER_IDS) {
      full[id] = {
        ...LAYER_DEFINITIONS[id],
        desired: { ...this._desiredState[id] },
        allocation: this._layerAllocation[id],
      };
    }
    return full;
  }

  // ── Scale Layer ────────────────────────────────────────────────────────────

  async scaleLayer(layerId, config) {
    if (!LAYER_DEFINITIONS[layerId]) {
      throw new Error(`Unknown layer: ${layerId}`);
    }

    const prev = { ...this._desiredState[layerId] };
    const next = { ...prev, ...config };

    // Validate config
    if (config.replicas !== undefined && config.replicas < 0) {
      throw new Error('replicas must be >= 0');
    }
    if (config.memoryGB !== undefined && config.memoryGB < 1) {
      throw new Error('memoryGB must be >= 1');
    }

    this._desiredState[layerId] = next;

    logger.logSystem('HeadyCloudConductor', `Scale layer: ${layerId}`, { prev, next });
    this.emit('layer:scaled', { layerId, prev, next, ts: Date.now() });

    // Queue provisioning
    this._enqueueProvisioning(layerId, next);

    return { layerId, prev, next };
  }

  _enqueueProvisioning(layerId, config) {
    this._provisionQueue.push({ layerId, config, enqueuedAt: Date.now() });
    this._processProvisionQueue();
  }

  async _processProvisionQueue() {
    while (this._provisionQueue.length > 0) {
      const item = this._provisionQueue.shift();
      const { layerId, config } = item;

      if (this._provisioning.has(layerId)) {
        // Re-queue at end to avoid concurrent provisioning same layer
        this._provisionQueue.push(item);
        break;
      }

      this._provisioning.add(layerId);
      try {
        await this._provisionLayer(layerId, config);
      } finally {
        this._provisioning.delete(layerId);
      }
    }
  }

  async _provisionLayer(layerId, config) {
    logger.logSystem('HeadyCloudConductor', `Provisioning layer: ${layerId}`, config);

    // Stub: in production, call real cloud APIs
    // e.g., Kubernetes HPA, AWS Auto Scaling, etc.
    await new Promise(resolve => setTimeout(resolve, 50)); // simulate async provision

    // Update actual state after provisioning
    this._actualState[layerId] = {
      ...config,
      provisionedAt: new Date().toISOString(),
      healthy: true,
    };

    this.emit('layer:provisioned', { layerId, config, ts: Date.now() });
    logger.logSystem('HeadyCloudConductor', `Layer provisioned: ${layerId}`, { config });
  }

  // ── Dynamic Allocation ─────────────────────────────────────────────────────

  setLayerAllocation(allocations) {
    // Validate allocations sum to ~1.0
    const total = Object.values(allocations).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 1.0) > 0.05) {
      throw new Error(`Layer allocations must sum to ~1.0, got ${total.toFixed(3)}`);
    }
    for (const [id, weight] of Object.entries(allocations)) {
      if (LAYER_DEFINITIONS[id]) {
        this._layerAllocation[id] = weight;
      }
    }
    this.emit('allocation:updated', { allocations: { ...this._layerAllocation }, ts: Date.now() });
  }

  adjustAllocationByDemand(demandMetrics) {
    // demandMetrics: { layerId: { requestRate, latency, errorRate } }
    // Use phi-weighted reallocation: favor layers with low latency & error rate
    const scores = {};
    for (const [layerId, m] of Object.entries(demandMetrics)) {
      if (!LAYER_DEFINITIONS[layerId]) continue;
      const latencyScore = 1 / (1 + m.latency / 1000);
      const errorScore   = 1 - Math.min(m.errorRate, 1);
      const loadScore    = 1 / (1 + m.requestRate / 100);
      scores[layerId]    = latencyScore * errorScore * loadScore;
    }

    const total = Object.values(scores).reduce((s, v) => s + v, 0);
    if (total === 0) return;

    const newAlloc = {};
    for (const [id, score] of Object.entries(scores)) {
      newAlloc[id] = score / total;
    }

    // Smooth with current allocation (phi-weighted blend)
    for (const id of LAYER_IDS) {
      const curr = this._layerAllocation[id] || 0;
      const target = newAlloc[id] || 0;
      this._layerAllocation[id] = curr + (target - curr) / PHI;
    }

    logger.info('HeadyCloudConductor', 'Demand-adjusted layer allocation', this._layerAllocation);
    this.emit('allocation:adjusted', { allocation: { ...this._layerAllocation }, ts: Date.now() });
  }

  // ── Tenant Policy Engine ───────────────────────────────────────────────────

  setTenantPolicy(tenantId, policy) {
    // policy: { maxBudgetUSD, preferredModels, allowedLayers, maxReplicas }
    this._tenantPolicies.set(tenantId, { ...policy, updatedAt: Date.now() });
    logger.logAudit('HeadyCloudConductor', { event: 'policy:set', tenantId, policy });
    this.emit('policy:updated', { tenantId, policy, ts: Date.now() });
  }

  getTenantPolicy(tenantId) {
    return this._tenantPolicies.get(tenantId) || null;
  }

  enforcePolicy(tenantId, requestedLayer, requestedConfig) {
    const policy = this._tenantPolicies.get(tenantId);
    if (!policy) return { allowed: true };

    const issues = [];

    if (policy.allowedLayers && !policy.allowedLayers.includes(requestedLayer)) {
      issues.push(`Layer ${requestedLayer} not allowed by tenant policy`);
    }

    if (policy.maxReplicas !== undefined && (requestedConfig.replicas || 0) > policy.maxReplicas) {
      issues.push(`Replicas ${requestedConfig.replicas} exceeds policy max ${policy.maxReplicas}`);
    }

    const allowed = issues.length === 0;
    if (!allowed) {
      logger.warn('HeadyCloudConductor', 'Policy enforcement blocked request', { tenantId, issues });
    }

    return { allowed, issues };
  }

  // ── Reconcile ─────────────────────────────────────────────────────────────

  async reconcile() {
    const drifts = [];
    const reconcileStart = Date.now();

    logger.logSystem('HeadyCloudConductor', 'Reconcile: start', {});

    for (const layerId of LAYER_IDS) {
      const desired = this._desiredState[layerId];
      const actual  = this._actualState[layerId];

      if (!actual) {
        // First-time provision
        drifts.push({ layerId, type: 'unprovisioned' });
        await this._provisionLayer(layerId, desired);
        continue;
      }

      // Compare desired vs actual
      const layerDrifts = this._detectDrift(layerId, desired, actual);
      if (layerDrifts.length > 0) {
        drifts.push(...layerDrifts.map(d => ({ layerId, ...d })));
        logger.warn('HeadyCloudConductor', `Drift detected on ${layerId}`, { drifts: layerDrifts });
        this.emit('drift:detected', { layerId, drifts: layerDrifts, ts: Date.now() });

        // Reconcile by re-provisioning to desired
        await this._provisionLayer(layerId, desired);
      }
    }

    const summary = {
      drifts:   drifts.length,
      layers:   LAYER_IDS.length,
      duration: Date.now() - reconcileStart,
      details:  drifts,
      ts:       new Date().toISOString(),
    };

    this.emit('reconcile:complete', summary);
    logger.logSystem('HeadyCloudConductor', 'Reconcile: complete', summary);
    return summary;
  }

  _detectDrift(layerId, desired, actual) {
    const drifts = [];
    const keys = ['replicas', 'memoryGB', 'gpuEnabled', 'enabled'];

    for (const key of keys) {
      if (desired[key] !== undefined && actual[key] !== undefined) {
        if (desired[key] !== actual[key]) {
          drifts.push({
            field:   key,
            desired: desired[key],
            actual:  actual[key],
          });
        }
      }
    }

    return drifts;
  }

  // ── Observe Actual State ───────────────────────────────────────────────────

  updateActualState(layerId, state) {
    if (!LAYER_DEFINITIONS[layerId]) {
      throw new Error(`Unknown layer: ${layerId}`);
    }
    this._actualState[layerId] = { ...state, observedAt: new Date().toISOString() };
    this.emit('actual:updated', { layerId, state, ts: Date.now() });
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  getStatus() {
    const layers = {};
    for (const id of LAYER_IDS) {
      layers[id] = {
        definition:  LAYER_DEFINITIONS[id],
        desired:     this._desiredState[id],
        actual:      this._actualState[id],
        allocation:  this._layerAllocation[id],
        provisioning: this._provisioning.has(id),
      };
    }
    return {
      layers,
      tenantPolicies: this._tenantPolicies.size,
      provisionQueue: this._provisionQueue.length,
    };
  }
}

module.exports = {
  HeadyCloudConductor,
  LAYER_DEFINITIONS,
  LAYER_IDS,
  DEFAULT_DESIRED_STATE,
};
