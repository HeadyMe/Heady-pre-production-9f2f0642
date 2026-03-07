/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * @module @heady/shared-types
 *
 * Shared type definitions, enums, and constants used across the Heady™ AI
 * Platform monorepo. Because the codebase uses plain ESM (no TypeScript build
 * step for packages), types are expressed as JSDoc so editors still get
 * full IntelliSense and type checking with `"checkJs": true`.
 */

// ── Core constant ─────────────────────────────────────────────────────────────
/**
 * Golden ratio — used for interval scaling, animation timing, and priority weighting.
 * @type {number}
 */
export const PHI = 1.6180339887;

// ── ProjectionType enum ───────────────────────────────────────────────────────
/**
 * All valid projection domains recognised by the Heady™ Projection Service.
 * @readonly
 * @enum {string}
 */
export const ProjectionType = Object.freeze({
  VECTOR_MEMORY: 'vector-memory',
  CONFIG:        'config',
  HEALTH:        'health',
  TELEMETRY:     'telemetry',
  TOPOLOGY:      'topology',
  TASK_QUEUE:    'task-queue',
});

/** Array of all ProjectionType values. @type {string[]} */
export const ALL_PROJECTION_TYPES = Object.values(ProjectionType);

// ── BeeCategory enum ──────────────────────────────────────────────────────────
/**
 * Bee routing categories used for CSL vector classification.
 * @readonly
 * @enum {string}
 */
export const BeeCategory = Object.freeze({
  OPS:       'ops',
  MONITOR:   'monitor',
  ANALYTICS: 'analytics',
  SECURITY:  'security',
  INFRA:     'infra',
  GENERAL:   'general',
});

// ── Service status ────────────────────────────────────────────────────────────
/**
 * @readonly
 * @enum {string}
 */
export const ServiceStatus = Object.freeze({
  HEALTHY:  'healthy',
  DEGRADED: 'degraded',
  DOWN:     'down',
  UNKNOWN:  'unknown',
});

// ── SwarmScalingStrategy ──────────────────────────────────────────────────────
/**
 * @readonly
 * @enum {string}
 */
export const ScalingStrategy = Object.freeze({
  PHI_WEIGHTED: 'phi-weighted',
  ROUND_ROBIN:  'round-robin',
  PRIORITY:     'priority',
  UNIFORM:      'uniform',
});

// ── JSDoc type definitions ────────────────────────────────────────────────────

/**
 * @typedef {object} CslVector
 * @property {number} x         - X component (domain hash × PHI mod 1)
 * @property {number} y         - Y component (domain hash × e mod 1)
 * @property {number} z         - Z component (domain hash × π mod 1)
 * @property {string} category  - Routing category (BeeCategory value)
 */

/**
 * Core state snapshot for a projection domain.
 * @typedef {object} ProjectionState
 * @property {string}  domain      - Projection domain (ProjectionType value)
 * @property {number}  version     - Monotonically increasing version counter
 * @property {object}  state       - Domain-specific state payload
 * @property {object|null} prev    - Previous state snapshot (null on first update)
 * @property {number}  updatedAt   - Unix timestamp (ms) of last update
 */

/**
 * Configuration for a single HeadyBee.
 * @typedef {object} BeeConfig
 * @property {string}   domain      - Bee's projection domain
 * @property {string}   description - Human-readable description
 * @property {number}   priority    - Scheduling priority [0.0 – 1.0]
 * @property {number}   [intervalMs=8090] - Polling interval in ms
 * @property {CslVector} cslVector  - Routing vector for HeadyConductor
 * @property {Function} getWork     - Returns an array of async worker functions
 */

/**
 * Configuration for the ProjectionSwarm.
 * @typedef {object} SwarmConfig
 * @property {number}  maxConcurrent    - Max parallel bee workers
 * @property {string}  scalingStrategy  - ScalingStrategy value
 * @property {number}  errorThreshold   - Circuit-breaker trip ratio [0–1]
 * @property {object}  [circuitBreaker] - Circuit breaker config
 * @property {number}  [circuitBreaker.windowMs]         - Error window
 * @property {number}  [circuitBreaker.tripAfterErrors]  - Trip threshold
 * @property {number}  [circuitBreaker.recoveryMs]       - Recovery timeout
 */

/**
 * SSE configuration.
 * @typedef {object} SseConfig
 * @property {number}   heartbeatIntervalMs - Heartbeat ping interval
 * @property {number}   maxClients          - Maximum concurrent SSE clients
 * @property {number}   bufferSize          - Per-client event buffer depth
 * @property {number}   timeoutMs           - Idle client disconnect timeout
 * @property {string[]} corsOrigins         - Allowed CORS origins
 */

/**
 * Worker function return type — each bee worker must return this shape.
 * @typedef {object} WorkerResult
 * @property {string} bee     - Bee domain (matches BeeConfig.domain)
 * @property {string} action  - Name of the action performed
 * @property {number} ts      - Unix timestamp (ms) when work completed
 * @property {*}      [...]   - Additional domain-specific fields
 */

/**
 * HeadyConductor registration payload.
 * @typedef {object} ConductorRegistration
 * @property {string}   service   - Service name
 * @property {number}   port      - Listening port
 * @property {number}   phi       - PHI constant (sanity check)
 * @property {string[]} domains   - List of projection domains served
 * @property {number}   ts        - Registration timestamp (ms)
 */

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Returns true if the given domain is a valid ProjectionType value.
 * @param {string} domain
 * @returns {boolean}
 */
export function isValidProjectionType(domain) {
  return ALL_PROJECTION_TYPES.includes(domain);
}

/**
 * Returns true if the given status is a valid ServiceStatus value.
 * @param {string} status
 * @returns {boolean}
 */
export function isValidServiceStatus(status) {
  return Object.values(ServiceStatus).includes(status);
}

/**
 * Returns true if priority is a number in [0, 1].
 * @param {number} priority
 * @returns {boolean}
 */
export function isValidPriority(priority) {
  return typeof priority === 'number' && priority >= 0 && priority <= 1;
}

// ── Re-exports ────────────────────────────────────────────────────────────────
export default {
  PHI,
  ProjectionType,
  ALL_PROJECTION_TYPES,
  BeeCategory,
  ServiceStatus,
  ScalingStrategy,
  isValidProjectionType,
  isValidServiceStatus,
  isValidPriority,
};
