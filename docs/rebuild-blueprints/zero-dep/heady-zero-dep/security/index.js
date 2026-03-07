/**
 * @file index.js
 * @description Security layer: unified export + createSecurityLayer() factory.
 *
 * Wires together post-quantum cryptography, node-to-node handshake,
 * RBAC, and environment validation into a single cohesive security system
 * for the 3-node Heady cluster.
 *
 * Sacred Geometry: PHI ratios for timing and sizing.
 * Zero external dependencies (crypto, events only).
 *
 * @module HeadySecurity
 */

import { EventEmitter } from 'events';
import { randomBytes }  from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI; // 0.618…

// ─── Re-exports ───────────────────────────────────────────────────────────────
export {
  PQC,
  hmacSign, hmacVerify,
  aesEncrypt, aesDecrypt,
  generateEd25519KeyPair, ed25519Sign, ed25519Verify,
  hkdfDerive,
  secureRandom, secureRandomHex,
} from './pqc.js';

export {
  NodeHandshake,
  SessionStore,
  createHandshakeServer,
} from './handshake.js';

export {
  RBAC,
  RBACPolicy,
  Permission,
  createRBAC,
} from './rbac-vendor.js';

export {
  EnvValidator,
  validateEnv,
  EnvSchema,
} from './env-validator.js';

// ─── Module imports for factory ───────────────────────────────────────────────
import { PQC as _PQC }                        from './pqc.js';
import { NodeHandshake as _NodeHandshake,
         SessionStore  as _SessionStore }     from './handshake.js';
import { RBAC as _RBAC }                      from './rbac-vendor.js';
import { EnvValidator as _EnvValidator }      from './env-validator.js';

// ─── SecurityLayer class ──────────────────────────────────────────────────────

/**
 * Unified security context for a Heady cluster node.
 *
 * Usage:
 *   const security = createSecurityLayer({ nodeId: 'SENTINEL', ... });
 *   await security.handshake.initiateHandshake('BRAIN', brainPublicKey);
 *   security.rbac.can('alice', 'task:create');
 */
export class SecurityLayer extends EventEmitter {
  /**
   * @param {object} opts
   * @param {_PQC}           opts.pqc
   * @param {_NodeHandshake} opts.handshake
   * @param {_SessionStore}  opts.sessions
   * @param {_RBAC}          opts.rbac
   * @param {_EnvValidator}  opts.env
   * @param {string}         opts.nodeId
   */
  constructor({ pqc, handshake, sessions, rbac, env, nodeId }) {
    super();
    this.pqc       = pqc;
    this.handshake = handshake;
    this.sessions  = sessions;
    this.rbac      = rbac;
    this.env       = env;
    this.nodeId    = nodeId;
    this._booted   = Date.now();

    // Forward security events upward
    handshake.on('authenticated',  evt => this.emit('authenticated',  evt));
    handshake.on('authFailed',     evt => this.emit('authFailed',     evt));
    handshake.on('sessionExpired', evt => this.emit('sessionExpired', evt));
    rbac.on('accessGranted',       evt => this.emit('accessGranted',  evt));
    rbac.on('accessDenied',        evt => this.emit('accessDenied',   evt));
    rbac.on('auditLog',            evt => this.emit('auditLog',       evt));
  }

  /**
   * Verify an inbound request: validate session token + check RBAC permission.
   *
   * @param {string} token       Session token from Authorization header
   * @param {string} permission  Permission string e.g. 'task:create'
   * @param {string} [resource]  Optional resource id for resource-level checks
   * @returns {{ allowed: boolean, subject: string|null, reason: string }}
   */
  authorize(token, permission, resource = null) {
    // 1. Validate session
    const session = this.sessions.validate(token);
    if (!session.valid) {
      return { allowed: false, subject: null, reason: session.reason };
    }

    // 2. RBAC check
    const check = this.rbac.can(session.subject, permission, resource);
    return {
      allowed: check.allowed,
      subject: session.subject,
      reason:  check.reason,
      session: { nodeId: session.nodeId, expiresAt: session.expiresAt },
    };
  }

  /**
   * Encrypt a payload for inter-node transport.
   *
   * @param {Buffer|string} data
   * @param {Buffer}        recipientPublicKey  (used as AAD; symmetric key derived via HKDF)
   * @returns {{ ciphertext: string, iv: string, tag: string, keyId: string }}
   */
  encryptForTransport(data, recipientPublicKey) {
    return this.pqc.encrypt(data, recipientPublicKey);
  }

  /**
   * Decrypt a transport payload.
   */
  decryptFromTransport(envelope, recipientPublicKey) {
    return this.pqc.decrypt(envelope, recipientPublicKey);
  }

  /**
   * Sign a message with this node's Ed25519 private key.
   * @param {Buffer|string} message
   * @returns {string} hex signature
   */
  sign(message) {
    return this.pqc.sign(message);
  }

  /**
   * Verify a message signature.
   * @param {Buffer|string} message
   * @param {string}        signature  hex
   * @param {Buffer|string} publicKey
   * @returns {boolean}
   */
  verify(message, signature, publicKey) {
    return this.pqc.verify(message, signature, publicKey);
  }

  /**
   * Health snapshot.
   */
  health() {
    return {
      nodeId:      this.nodeId,
      uptimeMs:    Date.now() - this._booted,
      sessions:    this.sessions.stats(),
      rbac:        this.rbac.stats(),
      env:         this.env.summary(),
    };
  }

  /**
   * Graceful shutdown — clears session timers, etc.
   */
  shutdown() {
    this.sessions.shutdown();
    this.emit('shutdown', { nodeId: this.nodeId, at: Date.now() });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a fully-wired security layer for a Heady cluster node.
 *
 * @param {object} [opts]
 * @param {string}   [opts.nodeId]           Node identifier (default: random)
 * @param {object}   [opts.pqc]              PQC options (keyPair, etc.)
 * @param {object}   [opts.handshake]        Handshake options
 * @param {object}   [opts.rbac]             RBAC seed roles/permissions
 * @param {object}   [opts.env]              EnvValidator schema
 * @param {boolean}  [opts.skipEnvValidation] Skip env validation (test mode)
 * @returns {SecurityLayer}
 */
export function createSecurityLayer(opts = {}) {
  const nodeId = opts.nodeId ?? `node-${randomBytes(4).toString('hex')}`;

  // ── PQC ──────────────────────────────────────────────────────────────────
  const pqc = new _PQC(opts.pqc ?? {});

  // ── Handshake + Session Store ─────────────────────────────────────────────
  const sessions  = new _SessionStore({
    tokenTtlMs:  opts.handshake?.tokenTtlMs  ?? Math.round(3_600_000 * PHI_INV), // ~36 min
    maxSessions: opts.handshake?.maxSessions ?? 89,   // Fibonacci
  });

  const handshake = new _NodeHandshake({
    nodeId,
    pqc,
    sessions,
    challengeTtlMs:     opts.handshake?.challengeTtlMs     ?? 30_000,
    allowedNodes:       opts.handshake?.allowedNodes        ?? ['BRAIN', 'CONDUCTOR', 'SENTINEL'],
    ...opts.handshake,
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────
  const rbac = new _RBAC(opts.rbac ?? {});
  _seedDefaultRoles(rbac);

  // ── Environment Validator ─────────────────────────────────────────────────
  const env = new _EnvValidator(opts.env ?? {});
  if (!opts.skipEnvValidation) {
    env.validate(process.env);
  }

  return new SecurityLayer({ pqc, handshake, sessions, rbac, env, nodeId });
}

// ─── Default RBAC seed ────────────────────────────────────────────────────────

/**
 * Bootstrap default Heady roles if not already present.
 * Roles: supernode, conductor, sentinel, worker, observer
 */
function _seedDefaultRoles(rbac) {
  const roles = [
    {
      name: 'supernode',
      permissions: ['*'],
      description: 'Full cluster access',
    },
    {
      name: 'conductor',
      permissions: [
        'task:create', 'task:read', 'task:update', 'task:delete',
        'pipeline:execute', 'pipeline:read',
        'bee:spawn', 'bee:terminate', 'bee:read',
        'memory:read', 'memory:write',
        'governance:read',
      ],
      description: 'Conductor node — orchestration full access',
    },
    {
      name: 'sentinel',
      permissions: [
        'security:read', 'security:write',
        'telemetry:read', 'telemetry:write',
        'governance:read', 'governance:write',
        'health:read', 'health:write',
        'circuit:read', 'circuit:write',
      ],
      description: 'Sentinel node — security + governance full access',
    },
    {
      name: 'worker',
      permissions: [
        'task:read', 'task:update',
        'memory:read',
        'health:read',
      ],
      description: 'Worker bee — limited execution access',
    },
    {
      name: 'observer',
      permissions: [
        'task:read',
        'health:read',
        'telemetry:read',
      ],
      description: 'Read-only observer',
    },
  ];

  for (const role of roles) {
    try {
      rbac.defineRole(role.name, role.permissions, { description: role.description });
    } catch {
      // Role already defined — skip
    }
  }
}

// ─── Default export ───────────────────────────────────────────────────────────
export default createSecurityLayer;
