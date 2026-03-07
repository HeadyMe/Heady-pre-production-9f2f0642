/**
 * otel-wrappers/index.js — Central re-export of all 13 traced module wrappers
 *
 * Usage:
 *   // Replace individual lib imports with traced versions:
 *   const AgentProtocolAdapter   = require('./otel-wrappers').AgentProtocolAdapter;
 *   const { CircuitBreaker }     = require('./otel-wrappers');
 *
 *   // Or use the full namespace:
 *   const otel = require('./otel-wrappers');
 *   const flags = otel.featureFlags;
 *
 * Bootstrap order:
 *   1. require('./otel-wrappers/otel-setup')   ← SDK init (must be first)
 *   2. require('./otel-wrappers')              ← Traced modules
 *
 * @module otel-wrappers
 */
'use strict';

// ─── 1. Agent Protocol ────────────────────────────────────────────────────────
const AgentProtocolAdapter = require('./agent-protocol.traced');

// ─── 2. Circuit Breaker ───────────────────────────────────────────────────────
const { CircuitBreaker, TokenBucketRateLimiter, STATES } = require('./circuit-breaker.traced');

// ─── 3. Digital Twin ──────────────────────────────────────────────────────────
const DigitalTwin = require('./digital-twin.traced');

// ─── 4. Eval Pipeline ────────────────────────────────────────────────────────
const EvalPipeline = require('./eval-pipeline.traced');

// ─── 5. Failover ─────────────────────────────────────────────────────────────
const MultiCloudFailover = require('./failover.traced');

// ─── 6. Feature Flags ────────────────────────────────────────────────────────
const featureFlags = require('./feature-flags.traced');
const { isEnabled, setFlag, getAllFlags, flagMiddleware, FLAGS } = featureFlags;

// ─── 7. Graph Orchestrator ───────────────────────────────────────────────────
const GraphOrchestrator = require('./graph-orchestrator.traced');

// ─── 8. Key Rotation (singleton proxy) ───────────────────────────────────────
const keyRotation = require('./key-rotation.traced');

// ─── 9. Pretty Printer ───────────────────────────────────────────────────────
const pretty = require('./pretty.traced');
const { pp, ppTable, prettyHTML } = pretty;

// ─── 10. Prompt Guard ────────────────────────────────────────────────────────
const PromptGuard = require('./prompt-guard.traced');

// ─── 11. Shutdown (singleton proxy) ──────────────────────────────────────────
const shutdown = require('./shutdown.traced');

// ─── 12. Telemetry (enhanced) ────────────────────────────────────────────────
const telemetry = require('./telemetry.traced');
const {
  tracer, meter,
  startSpan, withSpan, traceMiddleware,
  recordTokenUsage, recordToolCall, recordEvalScore,
  setBaggage, getBaggage, injectHeaders, extractHeaders,
} = telemetry;

// ─── 13. Worker Pool ─────────────────────────────────────────────────────────
const { WorkerPool, batchEmbed } = require('./worker-pool.traced');

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Classes
  AgentProtocolAdapter,
  CircuitBreaker,
  TokenBucketRateLimiter,
  STATES,
  DigitalTwin,
  EvalPipeline,
  MultiCloudFailover,
  GraphOrchestrator,
  PromptGuard,
  WorkerPool,

  // Singletons / plain object modules
  featureFlags,       // full feature-flags module
  isEnabled,
  setFlag,
  getAllFlags,
  flagMiddleware,
  FLAGS,

  keyRotation,        // full key-rotation singleton proxy

  pretty,             // full pretty module
  pp,
  ppTable,
  prettyHTML,

  shutdown,           // shutdown singleton proxy

  telemetry,          // full telemetry module
  tracer,
  meter,
  startSpan,
  withSpan,
  traceMiddleware,
  recordTokenUsage,
  recordToolCall,
  recordEvalScore,
  setBaggage,
  getBaggage,
  injectHeaders,
  extractHeaders,

  batchEmbed,
};
