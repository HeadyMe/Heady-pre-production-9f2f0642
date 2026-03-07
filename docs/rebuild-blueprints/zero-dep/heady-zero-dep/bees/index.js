/**
 * @file index.js
 * @description Heady Bees Layer — Unified Exports.
 *
 * Combines:
 * - BeeFactory: Dynamic agent worker factory (createBee, spawnBee, auto-scale)
 * - Registry: Bee & service registry with 197 worker registration slots
 *
 * Sacred Geometry: PHI ratios for all sizing and timing.
 * Zero external dependencies.
 *
 * @module Bees
 * @example
 * import Bees, { BeeFactory, Registry } from './bees/index.js';
 * const layer = Bees.createBeeLayer();
 * layer.factory.createBee({ type: 'EmbedBee' });
 */

// ─── BeeFactory ───────────────────────────────────────────────────────────────

export {
  BeeFactory,
  Bee,
  BeeState,
  BEE_TEMPLATES,
  TEMPLATE_MAP,
  getBeeTemplate,
  listBeeTypes,
  getGlobalBeeFactory,
  phiBackoff as beePhiBackoff,
} from './bee-factory.js';

// ─── Registry ─────────────────────────────────────────────────────────────────

export {
  Registry,
  CapabilityIndex,
  EntryType,
  HealthStatus,
  REGISTRY_CAPACITY,
  createEntry,
  semverCompare,
  getGlobalRegistry,
} from './registry.js';

// ─── Direct imports for factory ───────────────────────────────────────────────

import {
  BeeFactory,
  Bee,
  BeeState,
  BEE_TEMPLATES,
  TEMPLATE_MAP,
  getBeeTemplate,
  listBeeTypes,
  getGlobalBeeFactory,
} from './bee-factory.js';

import {
  Registry,
  EntryType,
  HealthStatus,
  REGISTRY_CAPACITY,
  createEntry,
  getGlobalRegistry,
} from './registry.js';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

export const PHI = 1.6180339887498948482;
export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Bee Layer Factory ────────────────────────────────────────────────────────

/**
 * @typedef {object} BeeLayerOptions
 * @property {number} [maxBees=197] - max total bees
 * @property {boolean} [autoStart=true] - auto-start factory and registry
 * @property {boolean} [preload=false] - pre-instantiate one bee of each template type
 * @property {boolean} [wired=true] - auto-register bees in the registry on creation
 * @property {object} [factoryOptions] - passed to BeeFactory
 * @property {object} [registryOptions] - passed to Registry
 */

/**
 * @typedef {object} BeeLayer
 * @property {BeeFactory} factory
 * @property {Registry} registry
 * @property {Function} createBee - create + auto-register a persistent bee
 * @property {Function} spawnBee - spawn + auto-register an ephemeral bee
 * @property {Function} findBee - discover a bee by capability
 * @property {Function} start - start all subsystems
 * @property {Function} shutdown - stop all subsystems
 * @property {Function} status - aggregate status
 */

/**
 * Create a wired bee layer (BeeFactory + Registry).
 *
 * Integration:
 * - Bees are automatically registered in the Registry when created via createBee/spawnBee
 * - Health heartbeats from bees update Registry health status
 * - Registry discovery maps to BeeFactory.findBee()
 *
 * @param {BeeLayerOptions} [options]
 * @returns {BeeLayer}
 */
export function createBeeLayer(options = {}) {
  const factory = new BeeFactory({
    maxBees: options.maxBees ?? REGISTRY_CAPACITY,
    ...(options.factoryOptions ?? {}),
  });

  const registry = new Registry({
    capacity: options.maxBees ?? REGISTRY_CAPACITY,
    ...(options.registryOptions ?? {}),
  });

  // ── Auto-register bees in the registry when created ────────────────────
  const entryIds = new Map(); // beeId → registryEntryId

  const autoRegister = (bee) => {
    if (options.wired === false) return;
    try {
      const entryId = registry.register({
        name:         bee.type,
        entryType:    EntryType.BEE,
        beeId:        bee.id,
        capabilities: bee.capabilities,
        node:         bee.node,
        zone:         bee.zone,
        version:      '1.0.0',
        metadata:     { phi_score: bee.phi_score },
        heartbeatTtl: FIBONACCI[8] * 2000, // 68s for bees (longer TTL)
      });
      entryIds.set(bee.id, entryId);

      // Update registry health on bee state changes
      bee.on('bee.idle',     () => registry.heartbeat(entryId, HealthStatus.PASSING, bee.phi_score));
      bee.on('bee.cooldown', () => registry.heartbeat(entryId, HealthStatus.WARNING, bee.phi_score));
      bee.on('bee.error',    () => registry.heartbeat(entryId, HealthStatus.CRITICAL, 0));
      bee.on('task.accepted',() => registry.heartbeat(entryId, HealthStatus.PASSING, bee.phi_score));

      // Deregister on destruction
      bee.on('bee.destroyed', () => {
        const eid = entryIds.get(bee.id);
        if (eid) { registry.deregister(eid); entryIds.delete(bee.id); }
      });
    } catch (_) {}
  };

  factory.on('bee.created', ({ beeId }) => {
    const bee = factory.bees.get(beeId);
    if (bee) autoRegister(bee);
  });
  factory.on('bee.spawned', ({ beeId }) => {
    const bee = factory.bees.get(beeId);
    if (bee) autoRegister(bee);
  });

  // ── Wrapped createBee / spawnBee ───────────────────────────────────────

  /**
   * Create a persistent bee and register it
   * @param {object} config
   * @returns {Bee}
   */
  const createBee = (config) => factory.createBee(config);

  /**
   * Spawn an ephemeral bee and register it
   * @param {object} config
   * @returns {Bee}
   */
  const spawnBee = (config) => factory.spawnBee(config);

  /**
   * Find the best bee for a capability (searches factory + falls back to registry)
   * @param {string} capability
   * @param {string} [preferredNode]
   * @returns {Bee|null}
   */
  const findBee = (capability, preferredNode) => {
    // Try factory first (has live bee objects)
    const bee = factory.findBee(capability, preferredNode);
    if (bee) return bee;

    // Fallback: use registry to find entry, then locate bee in factory
    const entry = registry.getBest(capability, preferredNode);
    if (entry?.beeId) return factory.bees.get(entry.beeId) ?? null;
    return null;
  };

  // ── Preload one bee per template ───────────────────────────────────────
  if (options.preload) {
    for (const template of BEE_TEMPLATES) {
      try {
        factory.createBee({ type: template.type });
      } catch (_) { break; } // stop if capacity reached
    }
  }

  // ── Aggregate start ────────────────────────────────────────────────────
  const start = async () => {
    factory.start();
    registry.start();
    return { started: true, phi: PHI };
  };

  // ── Aggregate shutdown ─────────────────────────────────────────────────
  const shutdown = async () => {
    await factory.shutdown();
    await registry.shutdown();
    return { stopped: true };
  };

  // ── Aggregate status ───────────────────────────────────────────────────
  const status = () => ({
    factory:  factory.status,
    registry: registry.status,
    wired:    options.wired !== false,
    phi:      PHI,
  });

  if (options.autoStart !== false) {
    start().catch(() => {}); // non-blocking
  }

  return { factory, registry, createBee, spawnBee, findBee, start, shutdown, status };
}

// ─── Version ──────────────────────────────────────────────────────────────────

export const VERSION = '1.0.0';

export const BEES_INFO = Object.freeze({
  version:         VERSION,
  registrySlots:   REGISTRY_CAPACITY,  // 197
  beeTemplates:    BEE_TEMPLATES.length, // 24
  nodeDistribution: {
    brain:     BEE_TEMPLATES.filter((t) => t.node === 'brain').length,
    conductor: BEE_TEMPLATES.filter((t) => t.node === 'conductor').length,
    sentinel:  BEE_TEMPLATES.filter((t) => t.node === 'sentinel').length,
  },
  sacredGeometry: {
    phi:              PHI,
    maxBees:          REGISTRY_CAPACITY,
    hotZoneBees:      BEE_TEMPLATES.filter((t) => t.zone === 'HOT').length,
    warmZoneBees:     BEE_TEMPLATES.filter((t) => t.zone === 'WARM').length,
    coldZoneBees:     BEE_TEMPLATES.filter((t) => t.zone === 'COLD').length,
    governanceBees:   BEE_TEMPLATES.filter((t) => t.zone === 'GOVERNANCE').length,
  },
  templates: BEE_TEMPLATES.map((t) => ({
    type: t.type, node: t.node, zone: t.zone,
    maxConcurrent: t.maxConcurrent, capabilities: t.capabilities,
  })),
});

// ─── Default Export ───────────────────────────────────────────────────────────

export default {
  createBeeLayer,

  // ── Classes ────────────────────────────────────────────────────────────
  BeeFactory,
  Bee,
  Registry,

  // ── Singletons ─────────────────────────────────────────────────────────
  getGlobalBeeFactory,
  getGlobalRegistry,

  // ── Enums ──────────────────────────────────────────────────────────────
  BeeState,
  EntryType,
  HealthStatus,

  // ── Templates ──────────────────────────────────────────────────────────
  BEE_TEMPLATES,
  TEMPLATE_MAP,
  getBeeTemplate,
  listBeeTypes,

  // ── Constants ──────────────────────────────────────────────────────────
  REGISTRY_CAPACITY,
  createEntry,

  // ── Sacred Geometry ────────────────────────────────────────────────────
  PHI,
  FIBONACCI,

  // ── Metadata ───────────────────────────────────────────────────────────
  VERSION,
  BEES_INFO,
};
