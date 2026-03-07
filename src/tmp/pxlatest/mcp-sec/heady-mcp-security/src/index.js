/**
 * Heady MCP Security — Unified Entry Point
 * ==========================================
 * Import all security modules from a single entry.
 *
 * Usage:
 *   const { MCPGateway, RBACManager, AuditLogger } = require('@heady/mcp-security');
 *
 * @module @heady/mcp-security
 * @version 1.0.0
 */

'use strict';

// ── Foundation ──────────────────────────────────────────────────────────────
const phiMath = require('../shared/phi-math');

// ── Gateway ─────────────────────────────────────────────────────────────────
const { MCPGateway, CSLToolRouter, SecurityError } = require('./gateway/mcp-gateway');
const { ConnectionPoolManager, TransportAdapter } = require('./gateway/connection-pool');

// ── Security Modules ────────────────────────────────────────────────────────
const { ZeroTrustSandbox, ResourceTracker, SandboxViolation, CAPABILITIES, TOOL_PROFILES, DEFAULT_RESOURCE_LIMITS } = require('./security/zero-trust-sandbox');
const { SemanticRateLimiter, TokenBucket, SlidingWindowCounter, SemanticDedupCache, PriorityQueue } = require('./security/rate-limiter');
const { AuditLogger, SOC2_CRITERIA } = require('./security/audit-logger');
const { OutputScanner, PATTERNS: SCAN_PATTERNS } = require('./security/output-scanner');
const { RBACManager, ROLES, TOOL_OVERRIDES, JWT_ADAPTERS } = require('./security/rbac-manager');
const { InputValidator, THREAT_PATTERNS, BLOCKED_CIDRS } = require('./security/input-validator');
const { SecretRotationManager, InMemorySecretBackend, GCPSecretBackend, SECRET_TYPES, ROTATION_INTERVALS } = require('./security/secret-rotation');

module.exports = {
  // Foundation
  ...phiMath,

  // Gateway
  MCPGateway,
  CSLToolRouter,
  SecurityError,
  ConnectionPoolManager,
  TransportAdapter,

  // Security Modules
  ZeroTrustSandbox,
  ResourceTracker,
  SandboxViolation,
  CAPABILITIES,
  TOOL_PROFILES,
  DEFAULT_RESOURCE_LIMITS,

  SemanticRateLimiter,
  TokenBucket,
  SlidingWindowCounter,
  SemanticDedupCache,
  PriorityQueue,

  AuditLogger,
  SOC2_CRITERIA,

  OutputScanner,
  SCAN_PATTERNS,

  RBACManager,
  ROLES,
  TOOL_OVERRIDES,
  JWT_ADAPTERS,

  InputValidator,
  THREAT_PATTERNS,
  BLOCKED_CIDRS,

  SecretRotationManager,
  InMemorySecretBackend,
  GCPSecretBackend,
  SECRET_TYPES,
  ROTATION_INTERVALS,
};
