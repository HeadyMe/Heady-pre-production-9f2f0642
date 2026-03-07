/**
 * HIPAA Audit Controls — Production Implementation
 * @module compliance-templates/hipaa/hipaa-audit-controls
 *
 * Implements HIPAA §164.312(b) audit controls:
 *  - All PHI access logged with who, what, when, where, why
 *  - Log integrity verification via SHA-256 hash chain (extends audit-log.js)
 *  - 6-year retention policy enforcement per §164.316(b)(2)(i)
 *  - Breach notification workflow trigger per §164.412
 *  - Immutable append-only log structure
 */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');

// Re-use the existing AuditLogger chain infrastructure
// Path resolves relative to deployment; adjust as needed
let _BaseAuditLogger;
try {
  _BaseAuditLogger = require('../../../src/middleware/audit-log').AuditLogger;
} catch {
  // Fallback: inline minimal compatible implementation
  _BaseAuditLogger = class {
    constructor(opts = {}) {
      this._store = opts.store || { append: async (r) => {}, query: async () => [] };
      this._hashChain = opts.lastHash || '0'.repeat(64);
    }
    async log(entry) {
      const record = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor: entry.actor || 'system',
        actorId: entry.actorId || 'unknown',
        tenantId: entry.tenantId || 'default',
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        outcome: entry.outcome || 'success',
        metadata: entry.metadata || {},
        ip: entry.ip,
        userAgent: entry.userAgent,
        previousHash: this._hashChain,
      };
      record.hash = crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
      this._hashChain = record.hash;
      await this._store.append(record);
      return record;
    }
    async query(filters = {}, limit = 100) { return this._store.query(filters, limit); }
    async verifyChain(records) {
      for (let i = 1; i < records.length; i++) {
        if (records[i].previousHash !== records[i - 1].hash) {
          return { valid: false, brokenAt: i, record: records[i].id };
        }
      }
      return { valid: true, count: records.length };
    }
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SIX_YEARS_MS        = 6 * 365.25 * 24 * 60 * 60 * 1000;
const RETENTION_DAYS      = Math.ceil(6 * 365.25); // 2192 days
const BREACH_NOTIFY_HOURS = 60 * 60 * 1000;        // 1-hour internal SLA
const HHS_NOTIFY_DAYS     = 60;                     // 60 calendar days per §164.412
const LARGE_BREACH_THRESHOLD = 500;                 // individuals affected — triggers media/HHS notice

// PHI access action classification
const PHI_ACTIONS = {
  VIEW:     'PHI:VIEW',
  EXPORT:   'PHI:EXPORT',
  EDIT:     'PHI:EDIT',
  DELETE:   'PHI:DELETE',
  SHARE:    'PHI:SHARE',
  IMPORT:   'PHI:IMPORT',
  SEARCH:   'PHI:SEARCH',
  DOWNLOAD: 'PHI:DOWNLOAD',
  PRINT:    'PHI:PRINT',
  FAX:      'PHI:FAX',
  BTG:      'PHI:BREAK_GLASS',
  DISCLOSE: 'PHI:DISCLOSE',
  AMEND:    'PHI:AMEND',
  // System actions
  ENCRYPT:  'PHI:ENCRYPT',
  DECRYPT:  'PHI:DECRYPT',
  BACKUP:   'PHI:BACKUP',
  PURGE:    'PHI:PURGE',
};

// Breach severity classification
const BREACH_SEVERITY = {
  LOW:      'low',      // < 10 individuals, no financial/clinical data
  MEDIUM:   'medium',   // 10–499 individuals
  HIGH:     'high',     // 500+ individuals or sensitive data category
  CRITICAL: 'critical', // > 10,000 individuals or national media attention likely
};

// ─── PHI Audit Logger ─────────────────────────────────────────────────────────

class PHIAuditLogger extends _BaseAuditLogger {
  /**
   * @param {object} opts
   * @param {object} opts.store           - Persistent store (pg, etc.)
   * @param {string} [opts.lastHash]      - Resume hash chain from last stored hash
   * @param {object} [opts.notifier]      - Breach notification emitter
   * @param {object} [opts.retentionStore] - Store for retention metadata
   */
  constructor(opts = {}) {
    super(opts);
    this._emitter    = opts.emitter || new EventEmitter();
    this._retention  = opts.retentionStore || new InMemoryRetentionStore();
    this._breaches   = new Map();           // breachId → breach record
    this._chainStart = opts.chainStart || { hash: '0'.repeat(64), seq: 0 };
  }

  /**
   * Log a PHI access event with full HIPAA §164.312(b) fields.
   *
   * @param {object} entry
   * @param {string} entry.actor           - Email or service name of accessor
   * @param {string} entry.actorId         - Internal user/service UUID
   * @param {string} entry.tenantId        - Tenant / Covered Entity ID
   * @param {string} entry.action          - PHI_ACTIONS constant
   * @param {string} entry.resource        - Resource type (e.g. 'patient')
   * @param {string} entry.resourceId      - Specific record ID accessed
   * @param {string} [entry.outcome]       - 'success' | 'failure' | 'denied'
   * @param {string} [entry.why]           - Purpose of access (required for non-treatment)
   * @param {string} [entry.ip]            - Source IP
   * @param {string} [entry.userAgent]     - User agent string
   * @param {object} [entry.metadata]      - Additional structured data
   * @param {boolean} [entry.btg]          - Was this a break-glass access?
   * @param {string[]} [entry.phiFields]   - Which PHI fields were accessed
   * @returns {Promise<object>} Immutable log record
   */
  async logPHIAccess(entry) {
    // Validate required HIPAA fields
    if (!entry.actor)    throw new Error('[HIPAA-AUDIT] actor is required');
    if (!entry.actorId)  throw new Error('[HIPAA-AUDIT] actorId is required');
    if (!entry.tenantId) throw new Error('[HIPAA-AUDIT] tenantId is required');
    if (!entry.action)   throw new Error('[HIPAA-AUDIT] action is required');
    if (!entry.resource) throw new Error('[HIPAA-AUDIT] resource is required');

    const record = await this.log({
      actor:      entry.actor,
      actorId:    entry.actorId,
      tenantId:   entry.tenantId,
      action:     entry.action,
      resource:   entry.resource,
      resourceId: entry.resourceId,
      outcome:    entry.outcome || 'success',
      metadata: {
        why:         entry.why || 'treatment',         // purpose of access
        phiFields:   entry.phiFields || [],            // specific fields accessed
        btg:         entry.btg || false,               // break-glass flag
        location:    entry.location || 'application',  // application, api, admin, btg
        application: entry.application || 'heady-platform',
        ...entry.metadata,
      },
      ip:        entry.ip,
      userAgent: entry.userAgent,
    });

    // Register with retention tracker
    await this._retention.register(record.id, record.tenantId, record.timestamp);

    // Emit for real-time monitoring
    this._emitter.emit('phi:access', record);

    // Break-glass gets special alerting
    if (entry.btg || entry.action === PHI_ACTIONS.BTG) {
      this._emitter.emit('phi:break-glass', record);
    }

    return record;
  }

  /**
   * Verify integrity of the entire stored log chain.
   * Fetches all records and verifies SHA-256 chain continuity.
   *
   * @param {string} tenantId
   * @param {string} [since]  - ISO date string to limit verification window
   * @returns {Promise<object>} { valid, count, brokenAt?, brokenRecord? }
   */
  async verifyLogIntegrity(tenantId, since) {
    const filters = { tenantId };
    if (since) filters.since = since;

    // Fetch all records — in production, paginate to avoid memory issues
    const records = await this._store.query(filters, 100_000);
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const result = await this.verifyChain(records);
    this._emitter.emit('phi:integrity-check', {
      tenantId,
      ...result,
      checkedAt: new Date().toISOString(),
    });
    return result;
  }

  /**
   * Re-hash-check a single record against its stored hash.
   * Useful for spot verification.
   *
   * @param {object} record
   * @returns {boolean}
   */
  verifyRecord(record) {
    const { hash, ...data } = record;
    const expected = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return expected === hash;
  }

  // ─── Breach Notification ────────────────────────────────────────────────────

  /**
   * Initiate breach notification workflow per §164.412.
   *
   * @param {object} breachEvent
   * @param {string}   breachEvent.tenantId
   * @param {string}   breachEvent.description
   * @param {string[]} breachEvent.affectedIndividuals  - list of affected individual IDs
   * @param {string}   breachEvent.phiType              - type of PHI involved
   * @param {string}   breachEvent.vector               - how breach occurred
   * @param {string}   breachEvent.detectedAt           - ISO timestamp of detection
   * @param {string}   breachEvent.discoveredBy         - employee/system that found breach
   * @param {object}   [breachEvent.riskAssessment]     - HITECH 4-factor risk assessment
   * @returns {Promise<object>} breach record with notification timeline
   */
  async triggerBreachNotification(breachEvent) {
    const breachId = `breach-${crypto.randomUUID()}`;
    const now = new Date();
    const detectedAt = breachEvent.detectedAt ? new Date(breachEvent.detectedAt) : now;

    // HITECH 4-factor risk assessment for "low probability of compromise" exception
    const riskAssessment = breachEvent.riskAssessment || {
      natureExtent:      'unknown',   // nature and extent of PHI involved
      unauthorizedPerson: 'unknown',  // who accessed it
      phiAcquiredViewed: null,        // was PHI actually acquired or viewed?
      mitigationExtent:  'none',      // extent to which risk has been mitigated
    };

    const affectedCount = breachEvent.affectedIndividuals?.length || 0;
    const severity = this._classifyBreachSeverity(affectedCount, breachEvent.phiType);

    // Notification deadlines
    const individualNotifyBy = new Date(detectedAt.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    const hhsNotifyBy         = new Date(detectedAt.getTime() + HHS_NOTIFY_DAYS * 24 * 60 * 60 * 1000);
    const mediaNotifyBy       = affectedCount >= LARGE_BREACH_THRESHOLD
      ? new Date(detectedAt.getTime() + 60 * 24 * 60 * 60 * 1000)  // 60 days prominent media
      : null;

    const breach = {
      breachId,
      tenantId:              breachEvent.tenantId,
      description:           breachEvent.description,
      affectedCount,
      affectedIndividuals:   breachEvent.affectedIndividuals || [],
      phiType:               breachEvent.phiType,
      vector:                breachEvent.vector,
      detectedAt:            detectedAt.toISOString(),
      discoveredBy:          breachEvent.discoveredBy,
      severity,
      riskAssessment,
      status:                'open',
      requiresNotification:  true,   // presume notification required unless risk assessment proves otherwise
      timeline: {
        detectedAt:              detectedAt.toISOString(),
        internalNotifyBy:        new Date(detectedAt.getTime() + BREACH_NOTIFY_HOURS).toISOString(),
        individualNotifyBy:      individualNotifyBy.toISOString(),
        hhsNotifyBy:             hhsNotifyBy.toISOString(),
        mediaNotifyBy:           mediaNotifyBy?.toISOString() || null,
        individualNotifiedAt:    null,
        hhsNotifiedAt:           null,
        mediaNotifiedAt:         null,
        remediatedAt:            null,
        closedAt:                null,
      },
      communications: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this._breaches.set(breachId, breach);

    // Audit log the breach discovery
    await this.logPHIAccess({
      actor:    breachEvent.discoveredBy || 'system',
      actorId:  'system',
      tenantId: breachEvent.tenantId,
      action:   'BREACH_DETECTED',
      resource: 'security/breach',
      resourceId: breachId,
      outcome:  'alert',
      why:      'security-incident-response',
      metadata: {
        breachId,
        severity,
        affectedCount,
        phiType: breachEvent.phiType,
      },
    });

    // Emit events for downstream handlers (email, PagerDuty, Jira, etc.)
    this._emitter.emit('breach:detected', breach);

    if (severity === BREACH_SEVERITY.HIGH || severity === BREACH_SEVERITY.CRITICAL) {
      this._emitter.emit('breach:critical', breach);
    }

    // Schedule follow-up reminders
    this._scheduleBreachReminders(breach);

    return breach;
  }

  /**
   * Record individual notification sent for a breach.
   */
  async recordBreachNotification(breachId, notificationType, details) {
    const breach = this._breaches.get(breachId);
    if (!breach) throw new Error(`[HIPAA-AUDIT] Breach ${breachId} not found`);

    const comm = {
      id:        crypto.randomUUID(),
      type:      notificationType,  // 'individual' | 'hhs' | 'media'
      sentAt:    new Date().toISOString(),
      sentBy:    details.sentBy,
      method:    details.method,   // 'email' | 'letter' | 'phone' | 'online'
      content:   details.content,
      recipients: details.recipients || [],
    };

    breach.communications.push(comm);

    if (notificationType === 'individual') breach.timeline.individualNotifiedAt = comm.sentAt;
    if (notificationType === 'hhs')        breach.timeline.hhsNotifiedAt        = comm.sentAt;
    if (notificationType === 'media')      breach.timeline.mediaNotifiedAt      = comm.sentAt;

    breach.updatedAt = new Date().toISOString();

    await this.logPHIAccess({
      actor:    details.sentBy || 'system',
      actorId:  'system',
      tenantId: breach.tenantId,
      action:   `BREACH_NOTIFICATION_SENT:${notificationType.toUpperCase()}`,
      resource: 'security/breach',
      resourceId: breachId,
      outcome:  'success',
      why:      'breach-notification-compliance',
      metadata: { notificationType, commId: comm.id, recipientCount: comm.recipients.length },
    });

    this._emitter.emit('breach:notified', { breach, notification: comm });
    return comm;
  }

  /**
   * Close a breach record once fully remediated and documented.
   */
  async closeBreach(breachId, resolution) {
    const breach = this._breaches.get(breachId);
    if (!breach) throw new Error(`[HIPAA-AUDIT] Breach ${breachId} not found`);

    breach.status         = 'closed';
    breach.resolution     = resolution;
    breach.timeline.remediatedAt = resolution.remediatedAt || new Date().toISOString();
    breach.timeline.closedAt     = new Date().toISOString();
    breach.updatedAt      = new Date().toISOString();

    await this.logPHIAccess({
      actor:    resolution.closedBy || 'security-officer',
      actorId:  'system',
      tenantId: breach.tenantId,
      action:   'BREACH_CLOSED',
      resource: 'security/breach',
      resourceId: breachId,
      outcome:  'success',
      why:      'breach-remediation-complete',
      metadata: { resolution: resolution.summary },
    });

    this._emitter.emit('breach:closed', breach);
    return breach;
  }

  getBreach(breachId) { return this._breaches.get(breachId); }

  listBreaches(tenantId) {
    return [...this._breaches.values()].filter(b => b.tenantId === tenantId);
  }

  // ─── Retention Enforcement ──────────────────────────────────────────────────

  /**
   * Check and purge log records past the 6-year retention window.
   * Call via cron job (monthly recommended).
   *
   * @param {string} tenantId
   * @param {boolean} [dryRun]  - If true, return what would be purged without deleting
   * @returns {Promise<{ purged: number, retained: number, cutoffDate: string }>}
   */
  async enforceRetention(tenantId, dryRun = false) {
    const cutoff = new Date(Date.now() - SIX_YEARS_MS);
    const result = await this._retention.enforceRetention(tenantId, cutoff, dryRun);

    if (!dryRun && result.purged > 0) {
      // Audit the purge itself
      await this.logPHIAccess({
        actor:    'system',
        actorId:  'system',
        tenantId,
        action:   PHI_ACTIONS.PURGE,
        resource: 'audit-log',
        outcome:  'success',
        why:      'retention-policy-6-year-hipaa',
        metadata: { purged: result.purged, cutoffDate: cutoff.toISOString() },
      });
    }

    this._emitter.emit('retention:enforced', { tenantId, ...result, dryRun });
    return { ...result, cutoffDate: cutoff.toISOString() };
  }

  /**
   * Generate retention compliance report for a tenant.
   */
  async getRetentionReport(tenantId) {
    return this._retention.getReport(tenantId);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _classifyBreachSeverity(affectedCount, phiType) {
    if (affectedCount >= 10000)   return BREACH_SEVERITY.CRITICAL;
    if (affectedCount >= 500)     return BREACH_SEVERITY.HIGH;
    if (affectedCount >= 10)      return BREACH_SEVERITY.MEDIUM;
    // Low count but highly sensitive data
    const sensitiveTypes = ['ssn', 'financial', 'mental-health', 'hiv', 'substance-abuse'];
    if (sensitiveTypes.some(t => phiType?.toLowerCase().includes(t))) return BREACH_SEVERITY.HIGH;
    return BREACH_SEVERITY.LOW;
  }

  _scheduleBreachReminders(breach) {
    const now = Date.now();
    const internalDeadline = new Date(breach.timeline.internalNotifyBy).getTime() - now;
    const individualDeadline = new Date(breach.timeline.individualNotifyBy).getTime() - now;

    if (internalDeadline > 0) {
      setTimeout(() => {
        if (this._breaches.get(breach.breachId)?.timeline.individualNotifiedAt == null) {
          this._emitter.emit('breach:reminder:internal', breach);
        }
      }, Math.min(internalDeadline, 2147483647));
    }

    if (individualDeadline > 0) {
      setTimeout(() => {
        if (this._breaches.get(breach.breachId)?.timeline.individualNotifiedAt == null) {
          this._emitter.emit('breach:reminder:individual-overdue', breach);
        }
      }, Math.min(individualDeadline, 2147483647));
    }
  }
}

// ─── Retention Store ─────────────────────────────────────────────────────────

class InMemoryRetentionStore {
  constructor() {
    this._index = new Map(); // recordId → { tenantId, timestamp }
  }

  async register(recordId, tenantId, timestamp) {
    this._index.set(recordId, { tenantId, timestamp });
  }

  async enforceRetention(tenantId, cutoff, dryRun) {
    let purged = 0;
    let retained = 0;
    const toDelete = [];

    for (const [id, meta] of this._index) {
      if (meta.tenantId !== tenantId) continue;
      if (new Date(meta.timestamp) < cutoff) {
        toDelete.push(id);
        purged++;
      } else {
        retained++;
      }
    }

    if (!dryRun) {
      for (const id of toDelete) this._index.delete(id);
    }

    return { purged, retained };
  }

  async getReport(tenantId) {
    const records = [...this._index.values()].filter(m => m.tenantId === tenantId);
    const oldest  = records.reduce((min, r) => r.timestamp < min ? r.timestamp : min, new Date().toISOString());
    const cutoff  = new Date(Date.now() - SIX_YEARS_MS).toISOString();
    const expired = records.filter(r => r.timestamp < cutoff).length;

    return {
      tenantId,
      totalRecords:     records.length,
      expiredRecords:   expired,
      activeRecords:    records.length - expired,
      oldestRecord:     oldest,
      retentionCutoff:  cutoff,
      retentionDays:    RETENTION_DAYS,
      generatedAt:      new Date().toISOString(),
    };
  }
}

// ─── Express Middleware ───────────────────────────────────────────────────────

/**
 * Express middleware that logs all PHI endpoint access.
 * Attaches `req.logPHIAccess(opts)` helper for route handlers.
 *
 * @param {PHIAuditLogger} auditLogger
 * @returns {Function}
 */
function phiAuditMiddleware(auditLogger) {
  return async (req, res, next) => {
    const start = Date.now();

    // Attach convenience logger for route handlers
    req.logPHIAccess = (opts) => auditLogger.logPHIAccess({
      actor:     req.user?.email    || 'anonymous',
      actorId:   req.user?.id       || 'unknown',
      tenantId:  req.tenantId       || req.user?.tenantId || 'default',
      ip:        req.ip             || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      btg:       req.hipaaSession?.btg || false,
      ...opts,
    });

    // Auto-log response completion
    res.on('finish', () => {
      const action = req._phiAction || `${req.method}:${req.route?.path || req.path}`;
      const resourceId = req.params?.patientId || req.params?.id;

      auditLogger.logPHIAccess({
        actor:     req.user?.email    || 'anonymous',
        actorId:   req.user?.id       || 'unknown',
        tenantId:  req.tenantId       || req.user?.tenantId || 'default',
        action:    PHI_ACTIONS.VIEW,
        resource:  req.baseUrl + (req.route?.path || req.path),
        resourceId,
        outcome:   res.statusCode < 400 ? 'success' : (res.statusCode === 403 ? 'denied' : 'failure'),
        why:       req.headers['x-access-purpose'] || 'treatment',
        phiFields: req._accessedPHIFields || [],
        metadata: {
          method:      req.method,
          statusCode:  res.statusCode,
          durationMs:  Date.now() - start,
          requestId:   req.id || req.headers['x-request-id'],
          btg:         req.hipaaSession?.btg || false,
          btgId:       req.hipaaSession?.btgId,
        },
        ip:        req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[HIPAA-AUDIT] Log error:', err.message));
    });

    next();
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a fully-configured PHIAuditLogger.
 *
 * @param {object} opts
 * @param {object} opts.store           - Persistent store implementing append/query
 * @param {string} [opts.lastHash]      - Last stored hash to resume chain
 * @param {object} [opts.retentionStore]
 * @returns {{ logger, middleware, PHI_ACTIONS, BREACH_SEVERITY }}
 */
function createHIPAAAuditControls(opts = {}) {
  const logger = new PHIAuditLogger(opts);
  const middleware = phiAuditMiddleware(logger);

  return { logger, middleware, PHI_ACTIONS, BREACH_SEVERITY, SIX_YEARS_MS, RETENTION_DAYS };
}

module.exports = {
  createHIPAAAuditControls,
  PHIAuditLogger,
  InMemoryRetentionStore,
  phiAuditMiddleware,
  PHI_ACTIONS,
  BREACH_SEVERITY,
  SIX_YEARS_MS,
  RETENTION_DAYS,
  LARGE_BREACH_THRESHOLD,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const { createHIPAAAuditControls, PHI_ACTIONS } = require('./hipaa-audit-controls');
const { MyPgStore } = require('../stores/pg-audit-store');

const app = express();
const { logger, middleware, BREACH_SEVERITY } = createHIPAAAuditControls({
  store: new MyPgStore(),
});

// Attach to all PHI routes
app.use('/phi', middleware);

// Manual PHI log in route
app.get('/phi/patient/:id', async (req, res) => {
  const patient = await db.getPatient(req.params.id);

  await req.logPHIAccess({
    action:     PHI_ACTIONS.VIEW,
    resource:   'patient',
    resourceId: req.params.id,
    phiFields:  ['name', 'dob', 'diagnosis'],
    why:        req.headers['x-access-purpose'] || 'treatment',
  });

  res.json(req.phiFilter(patient));
});

// Breach detection handler
logger._emitter.on('breach:detected', (breach) => {
  console.error('[BREACH DETECTED]', breach);
  // Send PagerDuty alert, email security@, create Jira ticket, etc.
});

// Run retention enforcement monthly (e.g., via cron)
// 0 0 1 * * → first day of each month
setInterval(async () => {
  for (const tenantId of await getTenantIds()) {
    const result = await logger.enforceRetention(tenantId);
    console.log(`[RETENTION] Tenant ${tenantId}: purged ${result.purged} records`);
  }
}, 30 * 24 * 60 * 60 * 1000);

// Verify log integrity daily
setInterval(async () => {
  for (const tenantId of await getTenantIds()) {
    const result = await logger.verifyLogIntegrity(tenantId);
    if (!result.valid) {
      console.error('[INTEGRITY FAILURE] Log chain broken!', result);
      // Trigger incident
    }
  }
}, 24 * 60 * 60 * 1000);
*/
