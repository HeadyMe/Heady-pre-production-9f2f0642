/**
 * @file global.js
 * @description Global configuration for the Heady zero-dependency system.
 *
 * Sacred Geometry: PHI (φ=1.618…) and Fibonacci sequence govern all ratios.
 * Cluster: 3-node topology (BRAIN, CONDUCTOR, SENTINEL).
 * Zero external dependencies — pure ES module constants.
 *
 * @module HeadyConfig/Global
 */

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
export const PHI           = 1.6180339887498948482;
export const PHI_INV       = 1 / PHI;           // 0.6180339887…
export const PHI_SQ        = PHI * PHI;          // 2.6180339887…
export const SQRT5         = Math.sqrt(5);
export const GOLDEN_ANGLE  = 2 * Math.PI * (2 - PHI); // ≈137.508°  (radians: ~2.3998)
export const GOLDEN_ANGLE_DEG = 360 * (2 - PHI);      // ≈137.508°

/** Fibonacci sequence — first 32 terms */
export const FIBONACCI = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610,
  987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025,
  121393, 196418, 317811, 514229, 832040, 1346269,
]);

/** Lucas numbers */
export const LUCAS = Object.freeze([
  2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123, 199, 322, 521, 843,
  1364, 2207, 3571, 5778, 9349, 15127, 24476, 39603,
]);

/**
 * PHI-scale a value by nth power.
 * @param {number} base
 * @param {number} n
 * @returns {number}
 */
export const phiScale = (base, n = 1) => base * Math.pow(PHI, n);

/**
 * PHI-scaled exponential backoff delay (ms).
 * @param {number} attempt  0-indexed attempt number
 * @param {number} base     Base delay ms (default 618)
 * @param {number} cap      Maximum delay ms (default 55000)
 */
export const phiBackoff = (attempt, base = 618, cap = 55_000) =>
  Math.min(Math.floor(base * Math.pow(PHI, attempt)), cap);

// ─── Cluster Topology ────────────────────────────────────────────────────────

/** Node roles in the 3-Colab cluster */
export const NodeRole = Object.freeze({
  BRAIN:     'BRAIN',
  CONDUCTOR: 'CONDUCTOR',
  SENTINEL:  'SENTINEL',
});

/** Node IDs */
export const NodeId = Object.freeze({
  BRAIN:     'node-0',
  CONDUCTOR: 'node-1',
  SENTINEL:  'node-2',
});

/**
 * Sacred Geometry resource allocation (must sum ≤ 100):
 *   BRAIN:      34% Hot Pool (Fibonacci 34) — latency-critical
 *   CONDUCTOR:  21% Warm Pool + 13% Cold Pool (Fibonacci 21, 13)
 *   SENTINEL:   8% Reserve + 5% Governance (Fibonacci 8, 5)
 *   Overhead:   remainder (~19%)
 */
export const RESOURCE_ALLOCATION = Object.freeze({
  HOT_POOL:        34,   // F(9)  — BRAIN hot path
  WARM_POOL:       21,   // F(8)  — CONDUCTOR background
  COLD_POOL:       13,   // F(7)  — CONDUCTOR cold tasks
  RESERVE:          8,   // F(6)  — SENTINEL reserve
  GOVERNANCE:       5,   // F(5)  — SENTINEL governance overhead
  SYSTEM_OVERHEAD: 19,   // remainder
});

export const CLUSTER_CONFIG = Object.freeze({
  nodes: [
    {
      id:          NodeId.BRAIN,
      role:        NodeRole.BRAIN,
      geometry:    'origin',
      gpuHint:     'T4/A100',
      resourcePct: RESOURCE_ALLOCATION.HOT_POOL,
      services:    ['VectorDB', 'EmbeddingEngine', 'LLMRouter', 'ModelServe'],
      heartbeatMs: Math.round(phiScale(1000, 2)),  // ~2618ms
    },
    {
      id:          NodeId.CONDUCTOR,
      role:        NodeRole.CONDUCTOR,
      geometry:    'inner-ring',
      gpuHint:     'T4/V100',
      resourcePct: RESOURCE_ALLOCATION.WARM_POOL + RESOURCE_ALLOCATION.COLD_POOL,
      services:    ['Conductor', 'HCFullPipeline', 'BeeFactory', 'SwarmConsensus'],
      heartbeatMs: Math.round(phiScale(1000, 2)),
    },
    {
      id:          NodeId.SENTINEL,
      role:        NodeRole.SENTINEL,
      geometry:    'governance-shell',
      gpuHint:     'T4',
      resourcePct: RESOURCE_ALLOCATION.RESERVE + RESOURCE_ALLOCATION.GOVERNANCE,
      services:    ['CircuitBreaker', 'SelfHealing', 'Telemetry', 'Governance', 'AutoDeploy'],
      heartbeatMs: Math.round(phiScale(1000, 2)),
    },
  ],

  /** Mesh heartbeat every 5s (matches architecture spec) */
  heartbeatIntervalMs: 5_000,

  /** W3C Trace Context traceparent version */
  traceVersion: '00',

  /** State embedding dimensionality (384D) */
  embeddingDim: 377,  // nearest Fibonacci to 384

  /** Cosine similarity threshold for coherence */
  similarityThreshold: PHI_INV * PHI_INV, // ≈0.382 (conservative) or use 0.75 per spec
  coherenceThreshold: 0.75,

  /** Maximum fanout for swarm consensus */
  maxFanout: 8,  // octant count
});

// ─── Timing Constants (PHI-derived ms) ───────────────────────────────────────
export const TIMING = Object.freeze({
  TICK_MS:            Math.round(1000 / PHI),   // ~618ms  — base tick
  SHORT_POLL_MS:      1_000,
  MEDIUM_POLL_MS:     Math.round(phiScale(1000, 1)),  // ~1618ms
  LONG_POLL_MS:       Math.round(phiScale(1000, 2)),  // ~2618ms
  HEARTBEAT_MS:       5_000,
  HEALTH_CHECK_MS:    Math.round(phiScale(1000, 4)),  // ~11090ms
  RECONNECT_BASE_MS:  Math.round(phiScale(1000, 0)),  // ~1618ms
  CIRCUIT_TIMEOUT_MS: 30_000,
  LLM_TIMEOUT_MS:     Math.round(phiScale(1000, 5)), // ~17944ms
  STREAM_CHUNK_MS:    Math.round(1000 / PHI_SQ),     // ~382ms
  CACHE_TTL_MS:       Math.round(phiScale(60_000, 2)), // ~157k ms ≈ 2.6 min
  BUDGET_WINDOW_MS:   86_400_000, // 24h
  SESSION_TTL_MS:     Math.round(phiScale(3_600_000, 1)), // ~5.8h
});

// ─── LLM Provider Registry ────────────────────────────────────────────────────
export const LLMProvider = Object.freeze({
  CLAUDE:      'anthropic',
  OPENAI:      'openai',
  GEMINI:      'google',
  GROQ:        'groq',
  PERPLEXITY:  'perplexity',
  OLLAMA:      'ollama',
});

export const PROVIDER_MODELS = Object.freeze({
  [LLMProvider.CLAUDE]: {
    default:   'claude-opus-4-5',
    fast:      'claude-haiku-4-5',
    balanced:  'claude-sonnet-4-5',
  },
  [LLMProvider.OPENAI]: {
    default:   'gpt-4o',
    fast:      'gpt-4o-mini',
    balanced:  'gpt-4o',
  },
  [LLMProvider.GEMINI]: {
    default:   'gemini-2.0-flash',
    fast:      'gemini-2.0-flash-lite',
    balanced:  'gemini-2.0-flash',
  },
  [LLMProvider.GROQ]: {
    default:   'llama-3.3-70b-versatile',
    fast:      'llama-3.1-8b-instant',
    balanced:  'llama-3.3-70b-versatile',
  },
  [LLMProvider.PERPLEXITY]: {
    default:   'sonar-pro',
    fast:      'sonar',
    balanced:  'sonar-pro',
  },
  [LLMProvider.OLLAMA]: {
    default:   'llama3.2',
    fast:      'llama3.2:1b',
    balanced:  'llama3.2',
  },
});

// ─── Routing Matrix ───────────────────────────────────────────────────────────
/** Task-type → provider routing preferences */
export const ROUTING_MATRIX = Object.freeze({
  code:       [LLMProvider.CLAUDE,     LLMProvider.OPENAI,    LLMProvider.GROQ],
  research:   [LLMProvider.PERPLEXITY, LLMProvider.CLAUDE,    LLMProvider.OPENAI],
  quick:      [LLMProvider.GROQ,       LLMProvider.GEMINI,    LLMProvider.OPENAI],
  reasoning:  [LLMProvider.CLAUDE,     LLMProvider.OPENAI,    LLMProvider.GEMINI],
  creative:   [LLMProvider.CLAUDE,     LLMProvider.OPENAI,    LLMProvider.GEMINI],
  embed:      [LLMProvider.OPENAI,     LLMProvider.OLLAMA,    LLMProvider.GEMINI],
  local:      [LLMProvider.OLLAMA,     LLMProvider.GROQ,      LLMProvider.GEMINI],
  default:    [LLMProvider.CLAUDE,     LLMProvider.OPENAI,    LLMProvider.GROQ],
});

// ─── Budget Caps (USD per 24h) ────────────────────────────────────────────────
export const DAILY_BUDGET_CAPS = Object.freeze({
  [LLMProvider.CLAUDE]:     10.00,
  [LLMProvider.OPENAI]:     10.00,
  [LLMProvider.GEMINI]:      5.00,
  [LLMProvider.GROQ]:        3.00,
  [LLMProvider.PERPLEXITY]:  5.00,
  [LLMProvider.OLLAMA]:      0.00, // local — no cost
  TOTAL:                    33.00,
});

/** Warn when provider reaches this fraction of daily cap */
export const BUDGET_WARN_THRESHOLD = PHI_INV;   // ≈61.8%
export const BUDGET_HARD_THRESHOLD = PHI_INV * PHI; // ≈100%  (actually ≈1.0)
export const BUDGET_DOWNGRADE_THRESHOLD = PHI_INV * PHI_INV; // ≈38.2% headroom remaining

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const FEATURES = Object.freeze({
  ARENA_MODE:         false,  // battle arena off by default
  CANARY_DEPLOY:      false,
  BLUE_GREEN:         true,
  PHI_SAMPLING:       true,   // adaptive telemetry sampling
  CACHE_LAYER:        true,
  BUDGET_TRACKING:    true,
  SELF_HEALING:       true,
  SERVICE_DISCOVERY:  true,
  HOT_RELOAD:         true,
  STREAMING:          true,
  VECTOR_COMPRESSION: true,
  GRAPH_RAG:          true,
});

// ─── Environment Detection ────────────────────────────────────────────────────
const _env = process.env;

export const ENV = Object.freeze({
  isColab:  !!(_env.COLAB_BACKEND_URL || _env.GCS_READ_BUCKET || _env.COLAB_JUPYTER_TOKEN),
  isCloud:  !!(_env.CLOUD_RUN_JOB || _env.VERCEL || _env.RAILWAY_ENVIRONMENT),
  isLocal:  !(_env.COLAB_BACKEND_URL || _env.GCS_READ_BUCKET || _env.CLOUD_RUN_JOB || _env.VERCEL),
  nodeEnv:  _env.NODE_ENV ?? 'development',
  isProd:   _env.NODE_ENV === 'production',
  isDev:    _env.NODE_ENV !== 'production',
  nodeRole: _env.HEADY_NODE_ROLE ?? NodeRole.BRAIN,
  nodeId:   _env.HEADY_NODE_ID   ?? NodeId.BRAIN,
  logLevel: _env.LOG_LEVEL       ?? 'INFO',
});

// ─── Pool Sizing (PHI/Fibonacci-based) ───────────────────────────────────────
export const POOL_SIZES = Object.freeze({
  HOT:          34,   // F(9)
  WARM:         21,   // F(8)
  COLD:         13,   // F(7)
  DEAD_LETTER:  89,   // F(11)
  CACHE_MAX:    610,  // F(15)
  VECTOR_SHARD:  8,   // octants
  SWARM_MAX:    89,   // F(11) bee slots
  ARENA_MODELS:  8,   // max models in arena
});

// ─── Snapshot ────────────────────────────────────────────────────────────────
export default Object.freeze({
  PHI, PHI_INV, PHI_SQ, SQRT5, GOLDEN_ANGLE, GOLDEN_ANGLE_DEG,
  FIBONACCI, LUCAS, phiScale, phiBackoff,
  NodeRole, NodeId, RESOURCE_ALLOCATION, CLUSTER_CONFIG,
  TIMING, LLMProvider, PROVIDER_MODELS, ROUTING_MATRIX,
  DAILY_BUDGET_CAPS, BUDGET_WARN_THRESHOLD,
  FEATURES, ENV, POOL_SIZES,
});
