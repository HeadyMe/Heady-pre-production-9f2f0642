/**
 * T4: Immutable Audit Logging Middleware — GDPR Art. 30 compliance
 * @module src/middleware/audit-log
 */
'use strict';

const crypto = require('crypto');

class AuditLogger {
    constructor(opts = {}) {
        this._store = opts.store || new InMemoryAuditStore();
        this._hashChain = opts.lastHash || '0'.repeat(64); // immutable chain
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
        record.hash = crypto.createHash('sha256')
            .update(JSON.stringify(record))
            .digest('hex');
        this._hashChain = record.hash;
        await this._store.append(record);
        return record;
    }

    async query(filters = {}, limit = 100) {
        return this._store.query(filters, limit);
    }

    async verifyChain(records) {
        for (let i = 1; i < records.length; i++) {
            if (records[i].previousHash !== records[i - 1].hash) {
                return { valid: false, brokenAt: i, record: records[i].id };
            }
        }
        return { valid: true, count: records.length };
    }
}

class InMemoryAuditStore {
    constructor() { this._records = []; }
    async append(record) { this._records.push(Object.freeze(record)); }
    async query(filters, limit) {
        let results = [...this._records];
        if (filters.tenantId) results = results.filter(r => r.tenantId === filters.tenantId);
        if (filters.actor) results = results.filter(r => r.actor === filters.actor);
        if (filters.action) results = results.filter(r => r.action === filters.action);
        if (filters.since) results = results.filter(r => r.timestamp >= filters.since);
        return results.slice(-limit);
    }
}

function auditMiddleware(auditLogger) {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            auditLogger.log({
                actor: req.user?.email || 'anonymous',
                actorId: req.user?.id || 'unknown',
                tenantId: req.tenantId || 'default',
                action: `${req.method} ${req.route?.path || req.path}`,
                resource: req.baseUrl + (req.route?.path || req.path),
                resourceId: req.params?.id,
                outcome: res.statusCode < 400 ? 'success' : 'failure',
                metadata: { statusCode: res.statusCode, durationMs: Date.now() - start },
                ip: req.ip || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent'],
            }).catch(err => console.error('[AUDIT] Log error:', err.message));
        });
        next();
    };
}

module.exports = { AuditLogger, InMemoryAuditStore, auditMiddleware };
