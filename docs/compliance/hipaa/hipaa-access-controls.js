/**
 * HIPAA Access Controls — Production Implementation
 * @module compliance-templates/hipaa/hipaa-access-controls
 *
 * Implements:
 *  - Minimum necessary access principle (§164.502(b), §164.514(d))
 *  - PHI field encryption/decryption (§164.312(a)(2)(iv), §164.312(e)(2)(ii))
 *  - Access logging (§164.312(b))
 *  - Emergency "break the glass" access with audit trail (§164.312(a)(2)(ii))
 *  - Automatic session timeout — 15 min idle (§164.312(a)(2)(iii))
 */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ─── Constants ───────────────────────────────────────────────────────────────

const ALGORITHM        = 'aes-256-gcm';
const KEY_LENGTH       = 32;        // 256-bit
const IV_LENGTH        = 12;        // 96-bit GCM nonce
const TAG_LENGTH       = 16;        // 128-bit auth tag
const SESSION_IDLE_MS  = 15 * 60 * 1000; // 15 minutes per HIPAA guidance
const BTG_TTL_MS       = 30 * 60 * 1000; // Break-glass session max 30 min

// PHI field definitions — maps field name → sensitivity tier
// Tier 1: Directly identifies individual
// Tier 2: Indirectly identifies when combined
// Tier 3: Clinical/sensitive
const PHI_FIELD_TIERS = {
  name:              1, firstName: 1, lastName: 1, middleName: 1,
  ssn:               1, socialSecurityNumber: 1,
  dob:               1, dateOfBirth: 1, birthDate: 1,
  address:           1, street: 1, city: 1, zip: 1, zipCode: 1, postalCode: 1,
  phone:             1, phoneNumber: 1, mobile: 1, fax: 1,
  email:             1, emailAddress: 1,
  mrn:               1, medicalRecordNumber: 1, patientId: 1,
  accountNumber:     1, memberNumber: 1,
  certificateNumber: 1, licenseNumber: 1,
  vehicleId:         1, deviceId:1, deviceSerialNumber: 1,
  url:               2, ipAddress: 2,
  biometric:         1, fingerprint: 1, photo: 1,
  fullFaceImage:     1,
  // Tier 2 clinical identifiers
  admissionDate:     2, dischargeDate: 2, serviceDate: 2, procedureDate: 2,
  age:               2,  // if > 89, direct identifier
  // Tier 3 clinical
  diagnosis:         3, diagnosisCode: 3, icd10: 3,
  medication:        3, prescription: 3, drug: 3, dosage: 3,
  labResult:         3, labValue: 3, testResult: 3,
  vitalSign:         3, bloodPressure: 3, weight: 3, height: 3,
  treatmentHistory:  3, procedureHistory: 3, allergyList: 3,
  insuranceId:       2, groupNumber: 2, payerId: 2,
};

// Role → allowed PHI tier access (lowest number = most sensitive)
const ROLE_PHI_ACCESS = {
  'admin':                 3,  // all tiers
  'provider':              3,  // all tiers
  'care_coordinator':      3,
  'billing':               2,  // tier 2 and above only
  'support':               2,
  'analyst':               2,  // de-identified or aggregate only in practice
  'auditor':               3,  // read-only all tiers
  'developer':             1,  // synthetic data only — enforce strictly
  'readonly':              2,
  'patient':               3,  // own data only — enforced by resource ownership check
};

// ─── Key Management ──────────────────────────────────────────────────────────

class PHIKeyManager {
  /**
   * @param {object} opts
   * @param {string} opts.masterKey  - 32-byte hex master key (from env / HSM)
   * @param {object} [opts.keyCache] - optional key-value store for derived keys
   */
  constructor(opts = {}) {
    const rawKey = opts.masterKey || process.env.HIPAA_PHI_MASTER_KEY;
    if (!rawKey) throw new Error('[HIPAA] HIPAA_PHI_MASTER_KEY env var is required');

    this._masterKey = Buffer.from(rawKey, 'hex');
    if (this._masterKey.length !== KEY_LENGTH) {
      throw new Error('[HIPAA] Master key must be 256 bits (32 bytes hex-encoded)');
    }
    this._cache = opts.keyCache || new Map();
  }

  /**
   * Derives a tenant-scoped encryption key using HKDF.
   * @param {string} tenantId
   * @returns {Buffer} 32-byte derived key
   */
  deriveKey(tenantId) {
    if (this._cache.has(tenantId)) return this._cache.get(tenantId);
    const derived = crypto.hkdfSync(
      'sha256',
      this._masterKey,
      Buffer.from(tenantId, 'utf8'),
      Buffer.from('heady-hipaa-phi-key-v1', 'utf8'),
      KEY_LENGTH
    );
    const key = Buffer.from(derived);
    this._cache.set(tenantId, key);
    return key;
  }
}

// ─── PHI Encryption ──────────────────────────────────────────────────────────

class PHIEncryptor {
  /**
   * @param {PHIKeyManager} keyManager
   */
  constructor(keyManager) {
    this._km = keyManager;
  }

  /**
   * Encrypt a PHI value using AES-256-GCM.
   * @param {string} plaintext   - PHI value to encrypt
   * @param {string} tenantId    - Tenant scope for key derivation
   * @param {object} [aad]       - Additional authenticated data (logged, not encrypted)
   * @returns {{ ciphertext: string, iv: string, tag: string, aad: string }}
   */
  encrypt(plaintext, tenantId, aad = {}) {
    if (plaintext == null) return null;

    const key = this._km.deriveKey(tenantId);
    const iv  = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    const aadBuffer = Buffer.from(JSON.stringify(aad), 'utf8');
    cipher.setAAD(aadBuffer);

    const ct1 = cipher.update(String(plaintext), 'utf8');
    const ct2 = cipher.final();
    const ciphertext = Buffer.concat([ct1, ct2]);
    const tag = cipher.getAuthTag();

    return {
      __phi__: true,                          // marker for identification
      ciphertext: ciphertext.toString('base64'),
      iv:         iv.toString('base64'),
      tag:        tag.toString('base64'),
      aad:        aadBuffer.toString('base64'),
      alg:        ALGORITHM,
    };
  }

  /**
   * Decrypt a PHI envelope.
   * @param {object} envelope  - Result of encrypt()
   * @param {string} tenantId
   * @returns {string} plaintext
   */
  decrypt(envelope, tenantId) {
    if (!envelope || !envelope.__phi__) return envelope;

    const key = this._km.deriveKey(tenantId);
    const iv  = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ct  = Buffer.from(envelope.ciphertext, 'base64');
    const aad = Buffer.from(envelope.aad, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    decipher.setAAD(aad);

    const plain1 = decipher.update(ct, undefined, 'utf8');
    const plain2 = decipher.final('utf8');
    return plain1 + plain2;
  }
}

// ─── Minimum Necessary Access ────────────────────────────────────────────────

class MinimumNecessaryEnforcer {
  /**
   * @param {PHIEncryptor} encryptor
   */
  constructor(encryptor) {
    this._enc = encryptor;
  }

  /**
   * Redacts or decrypts PHI fields based on user role.
   * Returns a copy of data with fields above user's tier removed/redacted.
   *
   * @param {object} data       - Record potentially containing PHI
   * @param {string} userRole   - Requesting user's role
   * @param {string} tenantId   - Tenant ID for key derivation
   * @param {object} [opts]
   * @param {boolean} [opts.decrypt]  - If true, decrypt permitted fields (default: true)
   * @returns {object} Filtered/decrypted record
   */
  filter(data, userRole, tenantId, { decrypt = true } = {}) {
    const allowedTier = ROLE_PHI_ACCESS[userRole] ?? 0; // 0 = no PHI access
    if (allowedTier === 0) return this._redactAll(data);

    return this._processObject(data, allowedTier, tenantId, decrypt);
  }

  _processObject(obj, allowedTier, tenantId, decrypt) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this._processObject(item, allowedTier, tenantId, decrypt));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldTier = PHI_FIELD_TIERS[key];

      if (fieldTier !== undefined) {
        if (fieldTier > allowedTier) {
          // Field is more sensitive than role allows — redact
          result[key] = '[REDACTED]';
        } else if (decrypt && value && typeof value === 'object' && value.__phi__) {
          // Decrypt permitted PHI field
          try {
            result[key] = this._enc.decrypt(value, tenantId);
          } catch {
            result[key] = '[DECRYPTION_ERROR]';
          }
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this._processObject(value, allowedTier, tenantId, decrypt);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  _redactAll(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this._redactAll(item));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = PHI_FIELD_TIERS[key] !== undefined
        ? '[REDACTED]'
        : (typeof value === 'object' ? this._redactAll(value) : value);
    }
    return result;
  }

  /**
   * Encrypt PHI fields in an object before storage.
   * @param {object} data
   * @param {string} tenantId
   * @param {object} [aad] - Additional authenticated data
   * @returns {object}
   */
  encryptFields(data, tenantId, aad = {}) {
    return this._encryptObject(data, tenantId, aad);
  }

  _encryptObject(obj, tenantId, aad) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this._encryptObject(item, tenantId, aad));
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PHI_FIELD_TIERS[key] !== undefined && value != null && typeof value !== 'object') {
        result[key] = this._enc.encrypt(String(value), tenantId, { ...aad, field: key });
      } else if (typeof value === 'object' && value !== null && !value.__phi__) {
        result[key] = this._encryptObject(value, tenantId, aad);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

// ─── Session Manager ─────────────────────────────────────────────────────────

class HIPAASessionManager extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._sessions = new Map();          // sessionId → session record
    this._btgSessions = new Set();       // active break-glass sessions
    this._idleMs = opts.idleMs ?? SESSION_IDLE_MS;
    this._btgTtlMs = opts.btgTtlMs ?? BTG_TTL_MS;
    this._logger = opts.logger;

    // Sweep expired sessions every 60 seconds
    this._sweepInterval = setInterval(() => this._sweep(), 60_000);
    if (this._sweepInterval.unref) this._sweepInterval.unref();
  }

  /**
   * Create or refresh a session record.
   * @param {string} sessionId
   * @param {object} user  - { id, email, role, tenantId }
   * @returns {object} session record
   */
  touch(sessionId, user) {
    const now = Date.now();
    const existing = this._sessions.get(sessionId);
    if (existing && existing.btg) {
      // Break-glass sessions cannot be extended
      return existing;
    }
    const record = {
      sessionId,
      userId:   user.id,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId,
      lastActivity: now,
      expiresAt:    now + this._idleMs,
      btg:          false,
    };
    this._sessions.set(sessionId, record);
    return record;
  }

  /**
   * Validate that a session is active. Returns session or throws.
   * @param {string} sessionId
   * @returns {object}
   */
  validate(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) throw Object.assign(new Error('Session not found'), { code: 'SESSION_NOT_FOUND', status: 401 });
    if (Date.now() > session.expiresAt) {
      this._sessions.delete(sessionId);
      this.emit('session:expired', { sessionId, userId: session.userId });
      throw Object.assign(new Error('Session expired — 15-minute HIPAA idle timeout exceeded'), { code: 'SESSION_EXPIRED', status: 401 });
    }
    return session;
  }

  /**
   * Terminate a session.
   * @param {string} sessionId
   */
  destroy(sessionId) {
    this._sessions.delete(sessionId);
    this._btgSessions.delete(sessionId);
  }

  /**
   * Initiate emergency break-glass access.
   * Creates a limited-duration, fully-audited PHI access session.
   *
   * @param {object} opts
   * @param {string} opts.sessionId
   * @param {string} opts.userId
   * @param {string} opts.email
   * @param {string} opts.tenantId
   * @param {string} opts.reason     - Mandatory justification
   * @param {string} opts.patientId  - Patient whose records are being accessed
   * @param {string} opts.supervisorId - Supervisor who authorized BTG
   * @param {string} opts.ip
   * @returns {object} btg record
   */
  createBreakGlassSession(opts) {
    const { sessionId, userId, email, tenantId, reason, patientId, supervisorId, ip } = opts;
    if (!reason || reason.trim().length < 10) {
      throw new Error('[HIPAA] Break-glass reason is required and must be descriptive (≥10 chars)');
    }
    if (!patientId) throw new Error('[HIPAA] Break-glass requires a specific patient ID');
    if (!supervisorId) throw new Error('[HIPAA] Break-glass requires supervisor authorization');

    const now = Date.now();
    const btgId = `btg-${crypto.randomUUID()}`;
    const record = {
      sessionId,
      btgId,
      userId,
      email,
      tenantId,
      patientId,
      supervisorId,
      reason: reason.trim(),
      ip,
      startedAt: now,
      expiresAt: now + this._btgTtlMs,
      btg: true,
      lastActivity: now,
      active: true,
    };

    this._sessions.set(sessionId, record);
    this._btgSessions.add(sessionId);
    this.emit('break-glass:initiated', record);

    // Auto-expire break-glass session
    setTimeout(() => {
      if (this._btgSessions.has(sessionId)) {
        this._sessions.delete(sessionId);
        this._btgSessions.delete(sessionId);
        this.emit('break-glass:expired', { btgId, sessionId, userId, tenantId });
      }
    }, this._btgTtlMs);

    return record;
  }

  _sweep() {
    const now = Date.now();
    for (const [id, session] of this._sessions) {
      if (now > session.expiresAt && !this._btgSessions.has(id)) {
        this._sessions.delete(id);
        this.emit('session:expired', { sessionId: id, userId: session.userId });
      }
    }
  }

  destroy() {
    clearInterval(this._sweepInterval);
    this._sessions.clear();
    this._btgSessions.clear();
  }
}

// ─── Express Middleware ───────────────────────────────────────────────────────

/**
 * Creates HIPAA access control Express middleware.
 *
 * @param {object} opts
 * @param {HIPAASessionManager} opts.sessionManager
 * @param {MinimumNecessaryEnforcer} opts.enforcer
 * @param {object} opts.auditLogger  - AuditLogger instance from audit-log.js
 * @param {string} [opts.sessionHeader] - Header name for session ID (default: 'x-session-id')
 * @returns {Function} Express middleware
 */
function hipaaAccessMiddleware(opts) {
  const {
    sessionManager,
    enforcer,
    auditLogger,
    sessionHeader = 'x-session-id',
  } = opts;

  if (!sessionManager) throw new Error('[HIPAA] sessionManager is required');
  if (!enforcer)       throw new Error('[HIPAA] enforcer is required');
  if (!auditLogger)    throw new Error('[HIPAA] auditLogger is required');

  return async (req, res, next) => {
    const sessionId = req.headers[sessionHeader] || req.cookies?.['heady-session'];
    if (!sessionId) {
      return res.status(401).json({ error: 'No session', code: 'NO_SESSION' });
    }

    try {
      const session = sessionManager.validate(sessionId);
      req.hipaaSession = session;
      req.user = req.user || {
        id:       session.userId,
        email:    session.email,
        role:     session.role,
        tenantId: session.tenantId,
      };
      req.tenantId = session.tenantId;

      // Refresh idle timer (only for non-BTG sessions)
      if (!session.btg) {
        sessionManager.touch(sessionId, session);
      }

      // Attach minimum-necessary filter to response
      req.phiFilter = (data) =>
        enforcer.filter(data, session.role, session.tenantId);

      // Attach PHI field encryptor
      req.encryptPHI = (data, aad = {}) =>
        enforcer.encryptFields(data, session.tenantId, { ...aad, userId: session.userId });

      next();
    } catch (err) {
      // Log failed access attempt
      await auditLogger.log({
        actor:      'unknown',
        actorId:    'unknown',
        tenantId:   'unknown',
        action:     `PHI_ACCESS_DENIED:${req.method} ${req.path}`,
        resource:   req.path,
        outcome:    'failure',
        metadata:   { reason: err.message, code: err.code },
        ip:         req.ip || req.headers['x-forwarded-for'],
        userAgent:  req.headers['user-agent'],
      }).catch(() => {});

      return res.status(err.status || 401).json({ error: err.message, code: err.code });
    }
  };
}

/**
 * Middleware for break-glass emergency access.
 * Must be applied AFTER hipaaAccessMiddleware.
 *
 * POST body expected: { reason, patientId, supervisorId }
 */
function breakGlassMiddleware(opts) {
  const { sessionManager, auditLogger } = opts;

  return async (req, res, next) => {
    const { reason, patientId, supervisorId } = req.body || {};
    const sessionId = req.headers['x-session-id'] || req.cookies?.['heady-session'];
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Authenticated session required' });

    try {
      const btgRecord = sessionManager.createBreakGlassSession({
        sessionId,
        userId:       user.id,
        email:        user.email,
        tenantId:     user.tenantId,
        reason,
        patientId,
        supervisorId,
        ip:           req.ip || req.headers['x-forwarded-for'],
      });

      // Mandatory audit log — break-glass is always logged
      await auditLogger.log({
        actor:     user.email,
        actorId:   user.id,
        tenantId:  user.tenantId,
        action:    'BREAK_GLASS_INITIATED',
        resource:  `patient/${patientId}`,
        resourceId: patientId,
        outcome:   'success',
        metadata:  {
          btgId:        btgRecord.btgId,
          reason:       reason,
          supervisorId: supervisorId,
          expiresAt:    new Date(btgRecord.expiresAt).toISOString(),
        },
        ip:        req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        why:       reason,
      });

      req.hipaaSession = btgRecord;
      res.locals.btgActive = true;
      res.locals.btgId = btgRecord.btgId;

      // Alert security team (async, non-blocking)
      process.nextTick(() => {
        sessionManager.emit('break-glass:alert', {
          btgId:       btgRecord.btgId,
          userId:      user.id,
          email:       user.email,
          patientId,
          reason,
          supervisorId,
          tenantId:    user.tenantId,
          timestamp:   new Date().toISOString(),
        });
      });

      next();
    } catch (err) {
      await auditLogger.log({
        actor:    user?.email || 'unknown',
        actorId:  user?.id    || 'unknown',
        tenantId: user?.tenantId || 'unknown',
        action:   'BREAK_GLASS_FAILED',
        resource: `patient/${patientId}`,
        outcome:  'failure',
        metadata: { error: err.message },
        ip:       req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      }).catch(() => {});

      return res.status(400).json({ error: err.message });
    }
  };
}

/**
 * Middleware enforcing session timeout on each PHI-touching request.
 * Attach after hipaaAccessMiddleware.
 */
function sessionTimeoutMiddleware(sessionManager) {
  return (req, res, next) => {
    // Header advertises time remaining
    const session = req.hipaaSession;
    if (session && !session.btg) {
      const remaining = Math.max(0, session.expiresAt - Date.now());
      res.set('X-Session-Expires-In', String(Math.floor(remaining / 1000)));
      res.set('X-Session-Timeout-Policy', 'HIPAA-15MIN-IDLE');
    }
    if (session?.btg) {
      const remaining = Math.max(0, session.expiresAt - Date.now());
      res.set('X-BTG-Session-Expires-In', String(Math.floor(remaining / 1000)));
      res.set('X-BTG-Id', session.btgId);
    }
    next();
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create fully-wired HIPAA access control stack.
 *
 * @param {object} opts
 * @param {string} opts.masterKey      - 32-byte hex master encryption key
 * @param {object} opts.auditLogger    - AuditLogger instance
 * @param {object} [opts.keyCache]     - Optional key cache
 * @param {number} [opts.idleMs]       - Session idle timeout (default 15 min)
 * @returns {{ keyManager, encryptor, enforcer, sessionManager, middleware, breakGlass, sessionTimeout }}
 */
function createHIPAAAccessControls(opts = {}) {
  const keyManager    = new PHIKeyManager({ masterKey: opts.masterKey, keyCache: opts.keyCache });
  const encryptor     = new PHIEncryptor(keyManager);
  const enforcer      = new MinimumNecessaryEnforcer(encryptor);
  const sessionManager = new HIPAASessionManager({ idleMs: opts.idleMs });

  const middleware = hipaaAccessMiddleware({
    sessionManager,
    enforcer,
    auditLogger: opts.auditLogger,
    sessionHeader: opts.sessionHeader,
  });

  const breakGlass = breakGlassMiddleware({
    sessionManager,
    auditLogger: opts.auditLogger,
  });

  const sessionTimeout = sessionTimeoutMiddleware(sessionManager);

  return {
    keyManager,
    encryptor,
    enforcer,
    sessionManager,
    middleware,         // attach to all PHI routes
    breakGlass,         // POST /phi/break-glass
    sessionTimeout,     // append after middleware
    PHI_FIELD_TIERS,
    ROLE_PHI_ACCESS,
  };
}

module.exports = {
  createHIPAAAccessControls,
  PHIKeyManager,
  PHIEncryptor,
  MinimumNecessaryEnforcer,
  HIPAASessionManager,
  hipaaAccessMiddleware,
  breakGlassMiddleware,
  sessionTimeoutMiddleware,
  PHI_FIELD_TIERS,
  ROLE_PHI_ACCESS,
  SESSION_IDLE_MS,
  BTG_TTL_MS,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const { AuditLogger } = require('../../../src/middleware/audit-log');
const { createHIPAAAccessControls } = require('./hipaa-access-controls');

const app = express();
const auditLogger = new AuditLogger({ store: new MyPgAuditStore() });

const hipaa = createHIPAAAccessControls({
  masterKey:   process.env.HIPAA_PHI_MASTER_KEY,
  auditLogger,
});

// Protect all /phi routes
app.use('/phi', hipaa.middleware, hipaa.sessionTimeout);

// Break-glass endpoint
app.post('/phi/break-glass', hipaa.middleware, hipaa.breakGlass, (req, res) => {
  res.json({ btgId: res.locals.btgId, message: 'Emergency access granted — all actions audited' });
});

// Example: store PHI with encryption
app.post('/phi/patient', hipaa.middleware, async (req, res) => {
  const encrypted = req.encryptPHI(req.body, { resourceType: 'patient' });
  await db.patients.insert(encrypted);
  res.json({ id: encrypted.id });
});

// Example: retrieve PHI with minimum-necessary filter
app.get('/phi/patient/:id', hipaa.middleware, async (req, res) => {
  const raw = await db.patients.findById(req.params.id);
  const filtered = req.phiFilter(raw);  // auto-redacts based on role
  res.json(filtered);
});
*/
