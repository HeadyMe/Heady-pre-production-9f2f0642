/**
 * Heady MCP Zero-Trust Gateway
 * ============================
 * Central gateway that routes MCP tool calls through the full security pipeline:
 *   Rate Limiter → CSL Router → Connection Pool → Zero-Trust Sandbox →
 *   Upstream MCP Server → Output Scanner → Audit Logger → Response
 *
 * Phi-scaled parameters throughout. No magic numbers.
 *
 * @module src/gateway/mcp-gateway
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, phiBackoff, cosineSimilarity,
  cslGate, phiFusionWeights, phiAdaptiveInterval,
} = require('../../shared/phi-math');

const { SemanticRateLimiter } = require('../security/rate-limiter');
const { ZeroTrustSandbox }    = require('../security/zero-trust-sandbox');
const { AuditLogger }         = require('../security/audit-logger');
const { OutputScanner }       = require('../security/output-scanner');
const { InputValidator }      = require('../security/input-validator');
const { RBACManager }         = require('../security/rbac-manager');
const { ConnectionPoolManager } = require('./connection-pool');

// ── CSL-Gated Tool Router ───────────────────────────────────────────────────
class CSLToolRouter {
  constructor(serverRegistry) {
    this.servers = new Map();       // namespace → { endpoint, tools, embedding }
    this.toolEmbeddings = new Map(); // toolName → Float32Array (384D)
    this._initRegistry(serverRegistry);
  }

  _initRegistry(registry) {
    for (const [namespace, config] of Object.entries(registry)) {
      this.servers.set(namespace, {
        endpoint: config.endpoint,
        transport: config.transport || 'streamable-http',
        tools: new Set(config.tools || []),
        embedding: config.embedding || null, // 384D semantic embedding
        weight: config.weight || 1.0,
        healthy: true,
      });
    }
  }

  /**
   * Route a tool call using 3-tier cascade:
   * 1. Namespace prefix match (exact: `github.createPR` → github server)
   * 2. CSL cosine similarity (threshold: MEDIUM ≈ 0.809)
   * 3. Load-balanced fallback (phi-weighted round-robin)
   */
  route(toolName, toolEmbedding = null) {
    // Tier 1: Exact namespace prefix
    const prefix = toolName.split('.')[0];
    if (this.servers.has(prefix) && this.servers.get(prefix).healthy) {
      return { server: prefix, method: 'namespace-prefix', confidence: 1.0 };
    }

    // Tier 2: CSL cosine similarity routing
    if (toolEmbedding) {
      let bestServer = null;
      let bestScore = -1;

      for (const [namespace, config] of this.servers) {
        if (!config.healthy || !config.embedding) continue;
        const score = cosineSimilarity(toolEmbedding, config.embedding);
        const gatedScore = cslGate(1.0, score, CSL_THRESHOLDS.MEDIUM);
        if (gatedScore > bestScore) {
          bestScore = gatedScore;
          bestServer = namespace;
        }
      }

      if (bestServer && bestScore > CSL_THRESHOLDS.MEDIUM) {
        return { server: bestServer, method: 'csl-cosine', confidence: bestScore };
      }
    }

    // Tier 3: Phi-weighted round-robin fallback among healthy servers
    const healthy = [...this.servers.entries()].filter(([, c]) => c.healthy);
    if (healthy.length === 0) throw new Error('No healthy MCP servers available');

    const weights = phiFusionWeights(healthy.length);
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < healthy.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        return { server: healthy[i][0], method: 'phi-roundrobin', confidence: weights[i] };
      }
    }
    return { server: healthy[0][0], method: 'phi-roundrobin', confidence: weights[0] };
  }

  markUnhealthy(namespace) {
    const srv = this.servers.get(namespace);
    if (srv) srv.healthy = false;
  }

  markHealthy(namespace) {
    const srv = this.servers.get(namespace);
    if (srv) srv.healthy = true;
  }
}

// ── MCP Gateway ─────────────────────────────────────────────────────────────
class MCPGateway extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      serverRegistry: config.serverRegistry || {},
      jwtSecret: config.jwtSecret || process.env.HEADY_JWT_SECRET,
      auditLogPath: config.auditLogPath || './logs/mcp-audit.jsonl',
      maxConcurrent: config.maxConcurrent || fib(7),  // 13
      executionTimeoutMs: config.executionTimeoutMs || fib(7) * 1000, // 13s default
      ...config,
    };

    // Initialize all security layers
    this.router     = new CSLToolRouter(this.config.serverRegistry);
    this.pool       = new ConnectionPoolManager(this.config.serverRegistry);
    this.rateLimiter = new SemanticRateLimiter(config.rateLimiter || {});
    this.sandbox    = new ZeroTrustSandbox(config.sandbox || {});
    this.auditor    = new AuditLogger({ logPath: this.config.auditLogPath });
    this.scanner    = new OutputScanner(config.scanner || {});
    this.validator  = new InputValidator(config.validator || {});
    this.rbac       = new RBACManager(config.rbac || {});

    this._activeCalls = 0;
    this._metrics = {
      totalCalls: 0,
      blockedByRateLimit: 0,
      blockedByValidation: 0,
      blockedByRBAC: 0,
      sandboxViolations: 0,
      redactedOutputs: 0,
      avgLatencyMs: 0,
    };
  }

  /**
   * Execute an MCP tool call through the full security pipeline.
   * @param {Object} request - { tool, arguments, user, session, jwt }
   * @returns {Object} - { result, metadata }
   */
  async execute(request) {
    const startTime = Date.now();
    const { tool, arguments: args, user, session, jwt } = request;

    // ── Step 1: RBAC Check ──────────────────────────────────────────────
    const rbacResult = this.rbac.checkAccess(jwt, tool);
    if (!rbacResult.allowed) {
      this._metrics.blockedByRBAC++;
      await this.auditor.log({
        tool, user, action: 'RBAC_DENIED',
        reason: rbacResult.reason,
        duration_ms: Date.now() - startTime,
      });
      throw new SecurityError('ACCESS_DENIED', `RBAC denied: ${rbacResult.reason}`);
    }

    // ── Step 2: Rate Limiting ───────────────────────────────────────────
    const rateResult = await this.rateLimiter.check({
      tool, user, session,
      inputEmbedding: request.inputEmbedding || null,
    });
    if (!rateResult.allowed) {
      this._metrics.blockedByRateLimit++;
      await this.auditor.log({
        tool, user, action: 'RATE_LIMITED',
        reason: rateResult.reason,
        duration_ms: Date.now() - startTime,
      });
      return {
        result: null,
        metadata: {
          rateLimited: true,
          retryAfterMs: rateResult.retryAfterMs,
          headers: rateResult.headers,
        },
      };
    }

    // Semantic dedup — return cached if near-identical call
    if (rateResult.cachedResult) {
      await this.auditor.log({
        tool, user, action: 'DEDUP_HIT',
        duration_ms: Date.now() - startTime,
      });
      return { result: rateResult.cachedResult, metadata: { deduplicated: true } };
    }

    // ── Step 3: Input Validation ────────────────────────────────────────
    const validationResult = this.validator.validate(tool, args);
    if (!validationResult.safe) {
      this._metrics.blockedByValidation++;
      await this.auditor.log({
        tool, user, action: 'INPUT_REJECTED',
        threats: validationResult.threats,
        duration_ms: Date.now() - startTime,
      });
      throw new SecurityError('INPUT_REJECTED', validationResult.threats.join('; '));
    }

    // ── Step 4: CSL Route ───────────────────────────────────────────────
    const route = this.router.route(tool, request.toolEmbedding || null);

    // ── Step 5: Connection Pool → Sandbox → Execute ─────────────────────
    let rawResult;
    try {
      const connection = await this.pool.acquire(route.server);
      try {
        this._activeCalls++;
        rawResult = await this.sandbox.execute({
          tool,
          arguments: validationResult.sanitized,
          connection,
          user,
          jwt,
          timeoutMs: this.config.executionTimeoutMs,
          capabilities: rbacResult.capabilities,
        });
      } finally {
        this._activeCalls--;
        await this.pool.release(route.server, connection);
      }
    } catch (execError) {
      if (execError.type === 'SANDBOX_VIOLATION') {
        this._metrics.sandboxViolations++;
      }
      await this.auditor.log({
        tool, user, action: 'EXEC_FAILED',
        error: execError.message,
        route: route.server,
        duration_ms: Date.now() - startTime,
      });
      throw execError;
    }

    // ── Step 6: Output Scanning ─────────────────────────────────────────
    const scannedResult = this.scanner.scan(rawResult);
    if (scannedResult.redacted) {
      this._metrics.redactedOutputs++;
    }

    // ── Step 7: Audit Log ───────────────────────────────────────────────
    const duration = Date.now() - startTime;
    this._metrics.totalCalls++;
    this._metrics.avgLatencyMs =
      (this._metrics.avgLatencyMs * (this._metrics.totalCalls - 1) + duration)
      / this._metrics.totalCalls;

    await this.auditor.log({
      tool,
      user,
      action: 'EXECUTED',
      route: route.server,
      routeMethod: route.method,
      confidence: route.confidence,
      inputHash: this.auditor.hashInput(args),
      outputHash: this.auditor.hashOutput(scannedResult.output),
      redacted: scannedResult.redacted,
      duration_ms: duration,
    });

    // Cache for semantic dedup
    if (request.inputEmbedding) {
      await this.rateLimiter.cacheResult(request.inputEmbedding, scannedResult.output);
    }

    return {
      result: scannedResult.output,
      metadata: {
        route: route.server,
        routeMethod: route.method,
        confidence: route.confidence,
        duration_ms: duration,
        redacted: scannedResult.redacted,
        rateHeaders: rateResult.headers,
      },
    };
  }

  /**
   * Health check — meta.health tool per MCP gateway spec.
   */
  async health() {
    const serverHealth = {};
    for (const [ns, config] of this.router.servers) {
      serverHealth[ns] = {
        healthy: config.healthy,
        transport: config.transport,
        poolSize: this.pool.getPoolSize(ns),
      };
    }
    return {
      status: 'ok',
      activeCalls: this._activeCalls,
      metrics: { ...this._metrics },
      servers: serverHealth,
      auditChainValid: await this.auditor.verifyChain(),
    };
  }

  /**
   * Graceful shutdown — LIFO cleanup.
   */
  async shutdown() {
    this.emit('shutting-down');
    await this.auditor.flush();
    await this.pool.drainAll();
    this.emit('shutdown-complete');
  }
}

// ── Custom Error Types ──────────────────────────────────────────────────────
class SecurityError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
    this.name = 'SecurityError';
  }
}

module.exports = { MCPGateway, CSLToolRouter, SecurityError };
