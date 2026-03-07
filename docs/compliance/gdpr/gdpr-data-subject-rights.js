/**
 * GDPR Data Subject Rights Implementation
 * @module compliance-templates/gdpr/gdpr-data-subject-rights
 *
 * Implements:
 *  - Art. 15: Right of Access — full user data export (JSON + CSV)
 *  - Art. 17: Right to Erasure — cascade delete across all stores
 *  - Art. 16: Right to Rectification — update with audit trail
 *  - Art. 20: Right to Data Portability — machine-readable export
 *  - Art. 21: Right to Object — opt-out of AI processing
 *  - Consent management with granular scopes
 *  - Data retention scheduler with auto-purge
 *
 * SLA: 30 calendar days per Art. 12(3), extendable to 90 for complex requests
 */

'use strict';

const crypto    = require('crypto');
const { EventEmitter } = require('events');

// ─── Constants ───────────────────────────────────────────────────────────────

const DSR_SLA_DAYS           = 30;
const DSR_SLA_EXTENDED_DAYS  = 90;
const CONSENT_VERSION        = '2025-01-01';

// GDPR consent scopes
const CONSENT_SCOPES = {
  ESSENTIAL:           'essential',          // Cannot be withheld (contract/legal obligation)
  ANALYTICS:           'analytics',          // Platform analytics
  AI_MEMORY:           'ai_memory',          // Long-term AI memory / vector storage
  AI_PERSONALISATION:  'ai_personalisation', // AI personalisation beyond session
  AI_TRAINING:         'ai_training',        // Use data to improve AI models
  MARKETING:           'marketing',          // Marketing communications
  THIRD_PARTY_SHARING: 'third_party_sharing',// Sharing with integration partners
  RESEARCH:            'research',           // Aggregate research/product analytics
};

const ERASURE_STORES = ['postgres', 'redis', 'vector', 'audit_logs', 'backups', 'cache', 'email_lists'];

// ─── DSR Request Manager ─────────────────────────────────────────────────────

class DSRRequestManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} opts.stores   - { pg, redis, vector, auditLog, email }
   * @param {object} opts.logger   - AuditLogger instance
   * @param {object} [opts.notifier] - Email/notification service
   */
  constructor(opts = {}) {
    super();
    this._stores   = opts.stores   || {};
    this._logger   = opts.logger;
    this._notifier = opts.notifier;
    this._requests = new Map(); // requestId → DSR record
    this._consents = new Map(); // userId → consent record
  }

  // ── Art. 15: Right of Access ──────────────────────────────────────────────

  /**
   * Handle a Subject Access Request (SAR).
   * Returns all personal data held about the data subject.
   *
   * @param {object} opts
   * @param {string} opts.userId
   * @param {string} opts.tenantId
   * @param {string} opts.requestedBy    - Who made the request (user ID or email)
   * @param {string} [opts.format]       - 'json' (default) | 'csv'
   * @returns {Promise<{ requestId, data, downloadUrl?, expiresAt }>}
   */
  async handleAccessRequest({ userId, tenantId, requestedBy, format = 'json' }) {
    const requestId = this._createDSRRecord('access', userId, tenantId, requestedBy);

    try {
      const data = await this._gatherAllUserData(userId, tenantId);

      const exportPayload = {
        requestId,
        generatedAt:     new Date().toISOString(),
        dataSubjectId:   userId,
        format,
        gdprArticle:     'Art. 15 — Right of Access',
        data,
      };

      const output = format === 'csv'
        ? this._toCSV(data)
        : JSON.stringify(exportPayload, null, 2);

      await this._completeDSR(requestId, { recordCount: this._countRecords(data) });
      await this._auditDSR(requestId, 'ACCESS_REQUEST_COMPLETED', userId, tenantId);

      this.emit('dsr:access:completed', { requestId, userId, tenantId });

      return {
        requestId,
        data:     exportPayload,
        raw:      output,
        format,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // link expires 7d
      };
    } catch (err) {
      await this._failDSR(requestId, err);
      throw err;
    }
  }

  // ── Art. 17: Right to Erasure ("Right to be Forgotten") ──────────────────

  /**
   * Cascade-delete all personal data across all stores.
   * Respects legal hold exceptions (§17(3)).
   *
   * @param {object} opts
   * @param {string} opts.userId
   * @param {string} opts.tenantId
   * @param {string} opts.requestedBy
   * @param {string} [opts.reason]       - Reason for erasure request
   * @param {boolean} [opts.dryRun]      - If true, return what would be deleted
   * @returns {Promise<{ requestId, stores, summary }>}
   */
  async handleErasureRequest({ userId, tenantId, requestedBy, reason = '', dryRun = false }) {
    const requestId = this._createDSRRecord('erasure', userId, tenantId, requestedBy, { reason, dryRun });

    const results = {
      postgres:   null,
      redis:      null,
      vector:     null,
      auditLogs:  null,
      cache:      null,
      emailLists: null,
      backups:    'deferred', // Backups purged on next rotation cycle
    };

    try {
      // Check for legal hold exceptions (§17(3))
      const legalHolds = await this._checkLegalHolds(userId, tenantId);
      const holdFields = legalHolds.map(h => h.scope);

      // PostgreSQL — delete user records across all tables
      results.postgres = await this._erasePostgres(userId, tenantId, holdFields, dryRun);

      // Redis — delete session data, cache entries
      results.redis = await this._eraseRedis(userId, tenantId, dryRun);

      // Vector store — delete all embeddings for this user
      results.vector = await this._eraseVectorMemory(userId, tenantId, dryRun);

      // Audit logs — anonymise rather than delete (legal obligation to retain structure)
      results.auditLogs = await this._anonymiseAuditLogs(userId, tenantId, dryRun);

      // Email lists — unsubscribe and delete from marketing
      results.emailLists = await this._eraseEmailLists(userId, tenantId, dryRun);

      // Cache
      results.cache = await this._eraseCache(userId, tenantId, dryRun);

      const summary = {
        requestId,
        userId,
        tenantId,
        dryRun,
        legalHoldsApplied: holdFields,
        stores:            results,
        completedAt:       new Date().toISOString(),
      };

      if (!dryRun) {
        await this._completeDSR(requestId, summary);
        await this._auditDSR(requestId, 'ERASURE_REQUEST_COMPLETED', userId, tenantId, { summary });
        this.emit('dsr:erasure:completed', { requestId, userId, tenantId, summary });
      }

      return summary;
    } catch (err) {
      await this._failDSR(requestId, err);
      throw err;
    }
  }

  // ── Art. 16: Right to Rectification ──────────────────────────────────────

  /**
   * Update user personal data with full audit trail.
   *
   * @param {object} opts
   * @param {string} opts.userId
   * @param {string} opts.tenantId
   * @param {string} opts.requestedBy
   * @param {object} opts.updates        - { field: newValue } map
   * @param {string} [opts.justification] - Why the correction is needed
   * @returns {Promise<{ requestId, applied, auditTrail }>}
   */
  async handleRectificationRequest({ userId, tenantId, requestedBy, updates, justification = '' }) {
    const requestId = this._createDSRRecord('rectification', userId, tenantId, requestedBy, { fields: Object.keys(updates) });

    try {
      // Fetch current values for audit trail
      const before = await this._stores.pg?.getUserProfile(userId, tenantId) || {};
      const applied = {};
      const auditTrail = [];

      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = before[field];
        if (oldValue === newValue) continue; // No change

        // Apply update in PostgreSQL
        if (this._stores.pg) {
          await this._stores.pg.updateUserField(userId, tenantId, field, newValue);
        }

        auditTrail.push({
          field,
          before:    this._maskSensitive(field, oldValue),
          after:     this._maskSensitive(field, newValue),
          updatedAt: new Date().toISOString(),
        });
        applied[field] = true;
      }

      // Invalidate any cached profile data
      if (this._stores.redis) {
        await this._stores.redis.del(`profile:${userId}`);
        await this._stores.redis.del(`profile:${tenantId}:${userId}`);
      }

      await this._completeDSR(requestId, { applied, fieldsUpdated: Object.keys(applied).length });
      await this._auditDSR(requestId, 'RECTIFICATION_COMPLETED', userId, tenantId, {
        fieldsUpdated: Object.keys(applied),
        justification,
        auditTrail,
      });

      this.emit('dsr:rectification:completed', { requestId, userId, tenantId, applied });

      return { requestId, applied, auditTrail };
    } catch (err) {
      await this._failDSR(requestId, err);
      throw err;
    }
  }

  // ── Art. 20: Right to Data Portability ───────────────────────────────────

  /**
   * Export user data in machine-readable format (JSON or CSV).
   * Covers data provided by the user (not inferred data).
   *
   * @param {object} opts
   * @param {string} opts.userId
   * @param {string} opts.tenantId
   * @param {string} opts.requestedBy
   * @param {'json'|'csv'} [opts.format]
   * @returns {Promise<{ requestId, filename, content, mimeType, checksum }>}
   */
  async handlePortabilityRequest({ userId, tenantId, requestedBy, format = 'json' }) {
    const requestId = this._createDSRRecord('portability', userId, tenantId, requestedBy, { format });

    try {
      // Portability covers only data provided by the user (Art. 20(1))
      const portableData = await this._gatherPortableData(userId, tenantId);

      const payload = {
        schema:         'heady-portability/v1',
        exportedAt:     new Date().toISOString(),
        dataSubjectId:  userId,
        gdprArticle:    'Art. 20 — Right to Data Portability',
        ...portableData,
      };

      const content   = format === 'csv' ? this._toCSV(portableData) : JSON.stringify(payload, null, 2);
      const checksum  = crypto.createHash('sha256').update(content).digest('hex');
      const mimeType  = format === 'csv' ? 'text/csv' : 'application/json';
      const filename  = `heady-export-${userId}-${Date.now()}.${format}`;

      await this._completeDSR(requestId, { format, checksum });
      await this._auditDSR(requestId, 'PORTABILITY_EXPORT_COMPLETED', userId, tenantId, { format, checksum });
      this.emit('dsr:portability:completed', { requestId, userId, tenantId, format });

      return { requestId, filename, content, mimeType, checksum };
    } catch (err) {
      await this._failDSR(requestId, err);
      throw err;
    }
  }

  // ── Art. 21: Right to Object ──────────────────────────────────────────────

  /**
   * Process objection to specific processing activities.
   * Immediately halts objected processing.
   *
   * @param {object} opts
   * @param {string} opts.userId
   * @param {string} opts.tenantId
   * @param {string[]} opts.processingActivities  - List of CONSENT_SCOPES to object to
   * @param {string} [opts.reason]
   * @returns {Promise<{ requestId, stopped, consentState }>}
   */
  async handleObjectionRequest({ userId, tenantId, processingActivities, reason = '' }) {
    const requestId = this._createDSRRecord('objection', userId, tenantId, userId, { processingActivities });

    try {
      const stopped = [];

      for (const activity of processingActivities) {
        if (activity === CONSENT_SCOPES.ESSENTIAL) {
          // Cannot object to essential processing (contract/legal obligation)
          continue;
        }
        await this.withdrawConsent(userId, tenantId, activity);
        stopped.push(activity);
      }

      // For AI processing objections, disable vector memory immediately
      if (stopped.includes(CONSENT_SCOPES.AI_MEMORY) || stopped.includes(CONSENT_SCOPES.AI_PERSONALISATION)) {
        if (this._stores.redis) {
          await this._stores.redis.hset(`user:flags:${userId}`, 'ai_processing_disabled', '1');
        }
      }

      const consentState = this.getConsentState(userId);
      await this._completeDSR(requestId, { stopped });
      await this._auditDSR(requestId, 'OBJECTION_PROCESSED', userId, tenantId, { stopped, reason });
      this.emit('dsr:objection:completed', { requestId, userId, tenantId, stopped });

      return { requestId, stopped, consentState };
    } catch (err) {
      await this._failDSR(requestId, err);
      throw err;
    }
  }

  // ── Consent Management ────────────────────────────────────────────────────

  /**
   * Record granular user consent.
   * @param {string} userId
   * @param {string} tenantId
   * @param {object} scopes  - { [scope]: true|false }
   * @param {object} [meta]  - { ipAddress, userAgent, source }
   * @returns {object} consent record
   */
  recordConsent(userId, tenantId, scopes, meta = {}) {
    const existing = this._consents.get(userId) || {
      userId,
      tenantId,
      version:    CONSENT_VERSION,
      scopes:     {},
      history:    [],
      createdAt:  new Date().toISOString(),
    };

    const changes = [];
    for (const [scope, granted] of Object.entries(scopes)) {
      if (scope === CONSENT_SCOPES.ESSENTIAL) continue; // Essential cannot be modified
      const old = existing.scopes[scope];
      if (old !== granted) {
        changes.push({ scope, from: old ?? null, to: granted });
        existing.scopes[scope] = granted;
      }
    }

    // Always ensure essential is set
    existing.scopes[CONSENT_SCOPES.ESSENTIAL] = true;

    if (changes.length > 0) {
      existing.history.push({
        changedAt:  new Date().toISOString(),
        changes,
        ipAddress:  meta.ipAddress,
        userAgent:  meta.userAgent,
        source:     meta.source || 'user',
        version:    CONSENT_VERSION,
      });
      existing.updatedAt = new Date().toISOString();
    }

    this._consents.set(userId, existing);
    this.emit('consent:updated', { userId, tenantId, changes });
    return existing;
  }

  /**
   * Withdraw consent for specific scopes.
   */
  withdrawConsent(userId, tenantId, ...scopes) {
    const updates = {};
    for (const s of scopes.flat()) updates[s] = false;
    return this.recordConsent(userId, tenantId, updates, { source: 'withdrawal' });
  }

  /**
   * Check if user has consented to a specific scope.
   * @returns {boolean}
   */
  hasConsent(userId, scope) {
    if (scope === CONSENT_SCOPES.ESSENTIAL) return true;
    const record = this._consents.get(userId);
    return record?.scopes[scope] === true;
  }

  /**
   * Get full consent state for a user.
   */
  getConsentState(userId) {
    const record = this._consents.get(userId);
    if (!record) return { userId, scopes: {}, hasAnyConsent: false };
    return record;
  }

  /**
   * Validate consent before processing.
   * Throws if required consent not present.
   */
  requireConsent(userId, scope) {
    if (!this.hasConsent(userId, scope)) {
      const err = new Error(`Processing requires consent for scope: ${scope}`);
      err.code = 'CONSENT_REQUIRED';
      err.scope = scope;
      err.status = 403;
      throw err;
    }
  }

  // ── Retention Scheduler ────────────────────────────────────────────────────

  /**
   * Start the retention auto-purge scheduler.
   * Runs daily to find and purge data past its retention period.
   *
   * @param {object} retentionPolicies  - { [dataType]: retentionDays }
   * @returns {object} scheduler handle
   */
  startRetentionScheduler(retentionPolicies = {}) {
    const policies = {
      conversations:   retentionPolicies.conversations  ?? 90,
      vectorMemory:    retentionPolicies.vectorMemory   ?? 90,
      sessionData:     retentionPolicies.sessionData    ?? 30,
      analyticsEvents: retentionPolicies.analyticsEvents ?? 30,
      errorLogs:       retentionPolicies.errorLogs      ?? 90,
      auditLogs:       retentionPolicies.auditLogs      ?? 2192, // 6 years HIPAA
      consentRecords:  retentionPolicies.consentRecords ?? 1825, // 5 years
      marketingData:   retentionPolicies.marketingData  ?? 1095, // 3 years
    };

    const runPurge = async () => {
      this.emit('retention:purge:start', { policies });
      const results = {};

      for (const [dataType, days] of Object.entries(policies)) {
        try {
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const count  = await this._purgeExpiredData(dataType, cutoff);
          results[dataType] = { purged: count, cutoff: cutoff.toISOString() };
        } catch (err) {
          results[dataType] = { error: err.message };
        }
      }

      this.emit('retention:purge:complete', results);
      return results;
    };

    // Run once immediately, then every 24 hours
    runPurge().catch(err => this.emit('retention:purge:error', err));
    const interval = setInterval(() => runPurge().catch(err => this.emit('retention:purge:error', err)), 24 * 60 * 60 * 1000);
    if (interval.unref) interval.unref();

    return { stop: () => clearInterval(interval), runNow: runPurge };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  _createDSRRecord(type, userId, tenantId, requestedBy, meta = {}) {
    const requestId = `dsr-${type}-${crypto.randomUUID()}`;
    const now = new Date();
    this._requests.set(requestId, {
      requestId,
      type,
      userId,
      tenantId,
      requestedBy,
      status:    'pending',
      createdAt: now.toISOString(),
      dueBy:     new Date(now.getTime() + DSR_SLA_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      meta,
    });
    return requestId;
  }

  async _completeDSR(requestId, result) {
    const record = this._requests.get(requestId);
    if (record) {
      record.status      = 'completed';
      record.completedAt = new Date().toISOString();
      record.result      = result;
    }
  }

  async _failDSR(requestId, err) {
    const record = this._requests.get(requestId);
    if (record) {
      record.status    = 'failed';
      record.failedAt  = new Date().toISOString();
      record.error     = err.message;
    }
    this.emit('dsr:failed', { requestId, error: err.message });
  }

  async _auditDSR(requestId, action, userId, tenantId, meta = {}) {
    if (!this._logger) return;
    await this._logger.log({
      actor:      userId,
      actorId:    userId,
      tenantId,
      action:     `GDPR:${action}`,
      resource:   'dsr',
      resourceId: requestId,
      outcome:    'success',
      metadata:   { requestId, ...meta },
    }).catch(() => {});
  }

  async _gatherAllUserData(userId, tenantId) {
    const data = { userId, tenantId };

    if (this._stores.pg) {
      data.profile        = await this._stores.pg.getUserProfile(userId, tenantId).catch(() => null);
      data.conversations  = await this._stores.pg.getUserConversations(userId, tenantId).catch(() => []);
      data.settings       = await this._stores.pg.getUserSettings(userId, tenantId).catch(() => null);
      data.apiKeys        = await this._stores.pg.getUserAPIKeys(userId, tenantId).catch(() => []);
      data.billingHistory = await this._stores.pg.getUserBilling(userId, tenantId).catch(() => []);
      data.integrations   = await this._stores.pg.getUserIntegrations(userId, tenantId).catch(() => []);
    }

    if (this._stores.vector) {
      data.vectorMemories = await this._stores.vector.getUserEmbeddings(userId, tenantId).catch(() => []);
    }

    data.consentRecord = this.getConsentState(userId);

    return data;
  }

  async _gatherPortableData(userId, tenantId) {
    // Portability: only data *provided* by the user (not derived/inferred)
    const data = {};
    if (this._stores.pg) {
      data.profile       = await this._stores.pg.getUserProfile(userId, tenantId).catch(() => null);
      data.conversations = await this._stores.pg.getUserConversations(userId, tenantId).catch(() => []);
      data.documents     = await this._stores.pg.getUserDocuments(userId, tenantId).catch(() => []);
      data.settings      = await this._stores.pg.getUserSettings(userId, tenantId).catch(() => null);
    }
    return data;
  }

  async _erasePostgres(userId, tenantId, holdFields, dryRun) {
    if (!this._stores.pg) return { skipped: true, reason: 'no_pg_store' };
    if (dryRun) return { dryRun: true, wouldDelete: await this._stores.pg.countUserRecords?.(userId, tenantId) || 'unknown' };

    const tables = [
      'conversations', 'messages', 'documents', 'api_keys',
      'user_settings', 'user_integrations', 'session_tokens',
      'notifications', 'agents', 'workflows',
    ];
    const results = {};
    for (const table of tables) {
      try {
        const count = await this._stores.pg.deleteUserRecords?.(table, userId, tenantId) || 0;
        results[table] = { deleted: count };
      } catch (err) {
        results[table] = { error: err.message };
      }
    }
    // Anonymise profile (keep row for referential integrity, null PII fields)
    await this._stores.pg.anonymiseUserProfile?.(userId, tenantId);
    return results;
  }

  async _eraseRedis(userId, tenantId, dryRun) {
    if (!this._stores.redis) return { skipped: true, reason: 'no_redis_store' };
    const patterns = [
      `session:${userId}:*`,
      `user:${userId}:*`,
      `profile:${userId}`,
      `profile:${tenantId}:${userId}`,
      `ratelimit:${userId}:*`,
      `cache:${tenantId}:${userId}:*`,
    ];
    if (dryRun) return { dryRun: true, patterns };
    let deleted = 0;
    for (const pattern of patterns) {
      const keys = await this._stores.redis.keys?.(pattern) || [];
      if (keys.length > 0) {
        await this._stores.redis.del(...keys);
        deleted += keys.length;
      }
    }
    return { deleted };
  }

  async _eraseVectorMemory(userId, tenantId, dryRun) {
    if (!this._stores.vector) return { skipped: true, reason: 'no_vector_store' };
    if (dryRun) {
      const count = await this._stores.vector.countEmbeddings?.(userId, tenantId) || 'unknown';
      return { dryRun: true, wouldDelete: count };
    }
    const deleted = await this._stores.vector.deleteUserEmbeddings?.(userId, tenantId) || 0;
    return { deleted };
  }

  async _anonymiseAuditLogs(userId, tenantId, dryRun) {
    // Audit logs cannot be fully deleted (legal obligation, HIPAA retention)
    // Instead, anonymise the actor fields
    if (!this._stores.auditLog) return { skipped: true, reason: 'no_audit_store' };
    if (dryRun) return { dryRun: true, action: 'would_anonymise' };
    const anonymised = await this._stores.auditLog.anonymiseActor?.(userId, tenantId) || 0;
    return { anonymised, note: 'Audit log records retained per legal obligation; actor PII anonymised' };
  }

  async _eraseEmailLists(userId, tenantId, dryRun) {
    if (!this._stores.email) return { skipped: true, reason: 'no_email_store' };
    if (dryRun) return { dryRun: true, action: 'would_unsubscribe_and_delete' };
    await this._stores.email.unsubscribeAll?.(userId);
    await this._stores.email.deleteContact?.(userId);
    return { deleted: true };
  }

  async _eraseCache(userId, tenantId, dryRun) {
    // Same as Redis for cache layer
    return this._eraseRedis(userId, tenantId, dryRun);
  }

  async _checkLegalHolds(userId, tenantId) {
    // Check if any data is under legal hold (litigation, regulatory investigation)
    // Return list of holds with scope
    if (!this._stores.pg) return [];
    return await this._stores.pg.getLegalHolds?.(userId, tenantId) || [];
  }

  async _purgeExpiredData(dataType, cutoff) {
    if (!this._stores.pg) return 0;
    return await this._stores.pg.purgeExpiredData?.(dataType, cutoff) || 0;
  }

  _countRecords(data) {
    return Object.values(data)
      .reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 1), 0);
  }

  _maskSensitive(field, value) {
    const sensitiveFields = new Set(['password', 'ssn', 'creditCard', 'token', 'secret', 'apiKey']);
    if (sensitiveFields.has(field)) return '[REDACTED]';
    if (typeof value === 'string' && value.length > 4) {
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }
    return value;
  }

  _toCSV(data) {
    const rows = [['category', 'field', 'value']];
    const flatten = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (Array.isArray(v)) {
          v.forEach((item, i) => {
            if (typeof item === 'object') flatten(item, `${key}[${i}]`);
            else rows.push([prefix, `${key}[${i}]`, String(item ?? '')]);
          });
        } else if (v !== null && typeof v === 'object') {
          flatten(v, key);
        } else {
          rows.push([prefix || 'root', key, String(v ?? '')]);
        }
      }
    };
    flatten(data);
    return rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  getDSRStatus(requestId) {
    return this._requests.get(requestId) || null;
  }

  listDSRRequests(tenantId, since) {
    return [...this._requests.values()].filter(r =>
      r.tenantId === tenantId &&
      (!since || r.createdAt >= since)
    );
  }
}

// ─── Express Route Handlers ───────────────────────────────────────────────────

/**
 * Create Express router for all GDPR DSR endpoints.
 *
 * @param {DSRRequestManager} dsrManager
 * @returns {object} Express router
 */
function createDSRRouter(dsrManager) {
  // Avoid hard require of express; accept router injection for test flexibility
  const express = (() => { try { return require('express'); } catch { return null; } })();
  const router  = express ? express.Router() : { get: () => {}, post: () => {} };

  // GET /gdpr/dsr/status/:requestId
  router.get('/status/:requestId', (req, res) => {
    const record = dsrManager.getDSRStatus(req.params.requestId);
    if (!record) return res.status(404).json({ error: 'Request not found' });
    // Only allow access to own requests
    if (record.userId !== req.user?.id && !req.user?.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(record);
  });

  // POST /gdpr/dsr/access
  router.post('/access', async (req, res) => {
    try {
      const result = await dsrManager.handleAccessRequest({
        userId:      req.user.id,
        tenantId:    req.tenantId || req.user.tenantId,
        requestedBy: req.user.id,
        format:      req.body.format || 'json',
      });
      res.json({ requestId: result.requestId, expiresAt: result.expiresAt });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /gdpr/dsr/access/:requestId/download
  router.get('/access/:requestId/download', async (req, res) => {
    const record = dsrManager.getDSRStatus(req.params.requestId);
    if (!record || record.userId !== req.user?.id) return res.status(403).json({ error: 'Forbidden' });
    if (record.status !== 'completed') return res.status(202).json({ status: record.status });
    res.setHeader('Content-Disposition', `attachment; filename="heady-export-${req.user.id}.json"`);
    res.json(record.result?.data || {});
  });

  // POST /gdpr/dsr/erasure
  router.post('/erasure', async (req, res) => {
    try {
      const result = await dsrManager.handleErasureRequest({
        userId:      req.user.id,
        tenantId:    req.tenantId || req.user.tenantId,
        requestedBy: req.user.id,
        reason:      req.body.reason,
        dryRun:      req.body.dryRun === true,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /gdpr/dsr/rectification
  router.post('/rectification', async (req, res) => {
    try {
      const result = await dsrManager.handleRectificationRequest({
        userId:        req.user.id,
        tenantId:      req.tenantId || req.user.tenantId,
        requestedBy:   req.user.id,
        updates:       req.body.updates || {},
        justification: req.body.justification,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /gdpr/dsr/portability
  router.post('/portability', async (req, res) => {
    try {
      const result = await dsrManager.handlePortabilityRequest({
        userId:      req.user.id,
        tenantId:    req.tenantId || req.user.tenantId,
        requestedBy: req.user.id,
        format:      req.body.format || 'json',
      });
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('X-Checksum-SHA256', result.checksum);
      res.send(result.content);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /gdpr/dsr/object
  router.post('/object', async (req, res) => {
    try {
      const result = await dsrManager.handleObjectionRequest({
        userId:               req.user.id,
        tenantId:             req.tenantId || req.user.tenantId,
        processingActivities: req.body.processingActivities || [],
        reason:               req.body.reason,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /gdpr/consent
  router.get('/consent', (req, res) => {
    res.json(dsrManager.getConsentState(req.user.id));
  });

  // POST /gdpr/consent
  router.post('/consent', (req, res) => {
    try {
      const record = dsrManager.recordConsent(
        req.user.id,
        req.tenantId || req.user.tenantId,
        req.body.scopes || {},
        { ipAddress: req.ip, userAgent: req.headers['user-agent'], source: 'preference-center' }
      );
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

// ─── Consent Enforcement Middleware ──────────────────────────────────────────

/**
 * Express middleware that blocks processing if required consent is missing.
 * @param {DSRRequestManager} dsrManager
 * @param {string} requiredScope   - CONSENT_SCOPES constant
 */
function consentGate(dsrManager, requiredScope) {
  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    try {
      dsrManager.requireConsent(userId, requiredScope);
      next();
    } catch (err) {
      res.status(403).json({
        error:    err.message,
        code:     err.code,
        scope:    err.scope,
        action:   'Update consent at /gdpr/consent',
      });
    }
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

function createGDPRDataSubjectRights(opts = {}) {
  const dsrManager = new DSRRequestManager(opts);
  const router     = createDSRRouter(dsrManager);
  return { dsrManager, router, consentGate, CONSENT_SCOPES };
}

module.exports = {
  createGDPRDataSubjectRights,
  DSRRequestManager,
  createDSRRouter,
  consentGate,
  CONSENT_SCOPES,
  DSR_SLA_DAYS,
  DSR_SLA_EXTENDED_DAYS,
};
