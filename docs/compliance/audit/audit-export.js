'use strict';

/**
 * @module audit-export
 * @description Export the SHA-256 chained audit trail to CSV, JSON, and PDF formats.
 * Supports filtering by date range, user, and action type.
 * Verifies chain integrity before export.
 *
 * The audit chain uses a SHA-256 hash linking mechanism:
 *   hash(n) = SHA256(hash(n-1) + action + JSON(metadata) + timestamp)
 * This ensures tamper-evidence — any modification breaks the chain.
 *
 * @architecture Express Router mounted at /api/v1/audit/export
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { z }   = require('zod');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const EXPORT_CONSTANTS = {
  // Default page size: fib(9)=34
  DEFAULT_PAGE_SIZE: fib(9),
  // Max records per export: fib(14)=377 (for performance)
  MAX_EXPORT_RECORDS: fib(14),
  // Download link expiry: fib(7)=13 days
  DOWNLOAD_EXPIRY_DAYS: fib(7),
  DOWNLOAD_EXPIRY_SECONDS: fib(7) * 24 * 60 * 60,
  // Batch size for chain verification: fib(10)=55
  VERIFY_BATCH_SIZE: fib(10),
  // Retry
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(5),
};

// Action categories for filtering
const ACTION_CATEGORIES = Object.freeze({
  AUTH: ['LOGIN', 'LOGOUT', 'TOKEN_ISSUED', 'TOKEN_REVOKED', 'MFA_CHALLENGE', 'MFA_VERIFIED'],
  DATA: ['DATA_ACCESS', 'DATA_CREATED', 'DATA_UPDATED', 'DATA_DELETED', 'DATA_EXPORTED'],
  DSAR: ['DSAR_RECEIVED', 'DSAR_VERIFIED', 'DSAR_COMPLETED', 'DSAR_ERASURE_INITIATED', 'DATA_PORTABILITY_EXPORT'],
  CONSENT: ['CONSENT_GRANTED', 'CONSENT_WITHDRAWN'],
  CCPA: ['CCPA_DO_NOT_SELL_OPT_OUT', 'CCPA_DO_NOT_SELL_OPT_IN', 'CCPA_DELETE_EXECUTED'],
  SECURITY: ['SECURITY_ALERT', 'RATE_LIMIT_EXCEEDED', 'THREAT_DETECTED', 'CSL_ESCALATION'],
  ADMIN: ['USER_CREATED', 'USER_DELETED', 'ROLE_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED'],
  SYSTEM: ['RETENTION_ENGINE_RUN', 'SOC2_EVIDENCE_COLLECTED', 'BACKUP_COMPLETED', 'DEPLOYMENT'],
});

// Export request schema
const ExportRequestSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
  userId:   z.string().max(255).optional(),
  actionTypes: z.array(z.string()).optional(),
  actionCategory: z.enum(Object.keys(ACTION_CATEGORIES)).optional(),
  tenantId: z.string().max(255).optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  pageSize: z.number().int().positive().max(EXPORT_CONSTANTS.MAX_EXPORT_RECORDS).default(EXPORT_CONSTANTS.DEFAULT_PAGE_SIZE),
  page: z.number().int().positive().default(1),
  verifyChain: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// φ-Retry Helper
// ---------------------------------------------------------------------------
const withPhiRetry = async (fn, maxRetries = EXPORT_CONSTANTS.MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.round(EXPORT_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// Chain Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify SHA-256 chain integrity for a set of audit records.
 * Each record's chain_hash must equal SHA256(prev_hash + action + metadata + timestamp).
 *
 * @param {Object[]} records - Audit records ordered by created_at ASC
 * @returns {Object} Verification result
 */
const verifyChainIntegrity = (records) => {
  if (!records || records.length === 0) {
    return { valid: true, recordsChecked: 0, violations: [], checkedAt: new Date().toISOString() };
  }

  const violations = [];
  let expectedPrevHash = '0'.repeat(64); // Genesis hash for first record

  for (const record of records) {
    const metaStr = record.metadata
      ? (typeof record.metadata === 'string' ? record.metadata : JSON.stringify(record.metadata))
      : '{}';

    const expectedHash = crypto
      .createHash('sha256')
      .update(`${record.previous_hash || expectedPrevHash}:${record.action}:${metaStr}:${record.created_at}`)
      .digest('hex');

    if (record.previous_hash && record.previous_hash !== expectedPrevHash) {
      violations.push({
        id: record.id,
        violation: 'chain_break',
        expected_prev_hash: expectedPrevHash.substring(0, 16) + '...',
        actual_prev_hash: (record.previous_hash || '').substring(0, 16) + '...',
        at: record.created_at,
      });
    }

    if (record.chain_hash && record.chain_hash !== expectedHash) {
      violations.push({
        id: record.id,
        violation: 'hash_mismatch',
        expected: expectedHash.substring(0, 16) + '...',
        actual: (record.chain_hash || '').substring(0, 16) + '...',
        at: record.created_at,
      });
    }

    expectedPrevHash = record.chain_hash || expectedHash;
  }

  return {
    valid: violations.length === 0,
    recordsChecked: records.length,
    violations,
    chainContinuous: violations.filter(v => v.violation === 'chain_break').length === 0,
    checkedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Audit Query Builder
// ---------------------------------------------------------------------------

/**
 * Build and execute audit log query with filters.
 */
const queryAuditLogs = async (filters, pgClient) => {
  const {
    dateFrom, dateTo, userId, actionTypes, actionCategory,
    tenantId, pageSize, page,
  } = filters;

  const params = [];
  const conditions = [];

  if (dateFrom) conditions.push(`created_at >= $${params.push(dateFrom)}`);
  if (dateTo)   conditions.push(`created_at <= $${params.push(dateTo)}`);
  if (userId)   conditions.push(`(user_id = $${params.push(userId)} OR subject_id = $${params.push(userId)})`);
  if (tenantId) conditions.push(`tenant_id = $${params.push(tenantId)}`);

  // Action type filtering
  let effectiveActionTypes = actionTypes;
  if (actionCategory && ACTION_CATEGORIES[actionCategory]) {
    effectiveActionTypes = [...(actionTypes || []), ...ACTION_CATEGORIES[actionCategory]];
  }
  if (effectiveActionTypes && effectiveActionTypes.length > 0) {
    conditions.push(`action = ANY($${params.push(effectiveActionTypes)}::text[])`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total records
  const countResult = await pgClient.query(
    `SELECT COUNT(*) FROM audit_events ${whereClause}`,
    params
  );
  const totalRecords = parseInt(countResult.rows[0].count, 10);

  // Fetch page — order by created_at ASC for chain verification
  const offset = (page - 1) * pageSize;
  const { rows } = await pgClient.query(
    `SELECT id, action, user_id, subject_id, tenant_id, ip_address,
            metadata, chain_hash, previous_hash, created_at
     FROM audit_events
     ${whereClause}
     ORDER BY created_at ASC
     LIMIT $${params.push(pageSize)} OFFSET $${params.push(offset)}`,
    params
  );

  return { records: rows, totalRecords, page, pageSize, totalPages: Math.ceil(totalRecords / pageSize) };
};

// ---------------------------------------------------------------------------
// Export Formatters
// ---------------------------------------------------------------------------

/**
 * Format audit records as JSON export.
 */
const formatAsJSON = (exportData) => {
  const doc = {
    exportedBy: 'HeadySystems Inc. — Audit Export Service',
    exportedAt: new Date().toISOString(),
    format: 'application/json',
    filters: exportData.filters,
    chainIntegrity: exportData.chainIntegrity,
    pagination: exportData.pagination,
    records: exportData.records,
  };
  return Buffer.from(JSON.stringify(doc, null, 2), 'utf8');
};

/**
 * Format audit records as CSV.
 */
const formatAsCSV = (exportData) => {
  const lines = [
    '=== HEADY AUDIT TRAIL EXPORT ===',
    `Exported At,${new Date().toISOString()}`,
    `Total Records,${exportData.pagination.totalRecords}`,
    `Chain Valid,${exportData.chainIntegrity?.valid ?? 'Not verified'}`,
    `Chain Violations,${exportData.chainIntegrity?.violations?.length ?? 0}`,
    '',
    'id,action,user_id,subject_id,tenant_id,ip_address,chain_hash,previous_hash,created_at,metadata',
  ];

  for (const record of exportData.records) {
    const meta = JSON.stringify(record.metadata || {}).replace(/"/g, '""');
    const hash = (record.chain_hash || '').substring(0, 16) + '...';
    const prevHash = (record.previous_hash || '').substring(0, 16) + '...';
    lines.push(
      `"${record.id}","${record.action}","${record.user_id || ''}","${record.subject_id || ''}",` +
      `"${record.tenant_id || ''}","${record.ip_address || ''}","${hash}","${prevHash}",` +
      `"${record.created_at}","${meta}"`
    );
  }

  return Buffer.from(lines.join('\n'), 'utf8');
};

/**
 * Format as PDF-renderable structure.
 */
const formatAsPDF = (exportData) => {
  const pdfDoc = {
    title: 'Audit Trail Export',
    subtitle: `HeadySystems Inc. — ${new Date().toLocaleDateString()}`,
    chainStatus: {
      valid: exportData.chainIntegrity?.valid,
      recordsChecked: exportData.chainIntegrity?.recordsChecked,
      violations: exportData.chainIntegrity?.violations?.length || 0,
    },
    filters: exportData.filters,
    summary: {
      totalRecords: exportData.pagination.totalRecords,
      exportedRecords: exportData.records.length,
      dateRange: {
        from: exportData.filters.dateFrom,
        to: exportData.filters.dateTo,
      },
    },
    records: exportData.records.map(r => ({
      id: r.id,
      action: r.action,
      userId: r.user_id,
      tenantId: r.tenant_id,
      ipAddress: r.ip_address,
      timestamp: r.created_at,
      chainHashShort: (r.chain_hash || '').substring(0, 16) + '...',
      prevHashShort: (r.previous_hash || '').substring(0, 16) + '...',
    })),
  };
  return Buffer.from(JSON.stringify(pdfDoc, null, 2), 'utf8');
};

// ---------------------------------------------------------------------------
// Main Export Function
// ---------------------------------------------------------------------------

/**
 * Generate a complete audit trail export.
 *
 * @param {Object} filters - Query filters from ExportRequestSchema
 * @param {Object} deps - { pgClient, storageClient, auditLogger }
 * @returns {Promise<Object>} Export package
 */
const generateAuditExport = async (filters, deps) => {
  const { pgClient, storageClient, auditLogger } = deps;

  // Query records
  const queryResult = await withPhiRetry(() => queryAuditLogs(filters, pgClient));

  // Verify chain integrity if requested
  let chainIntegrity = null;
  if (filters.verifyChain !== false) {
    chainIntegrity = verifyChainIntegrity(queryResult.records);
  }

  const exportData = {
    filters,
    chainIntegrity,
    pagination: queryResult,
    records: filters.includeMetadata !== false ? queryResult.records : queryResult.records.map(r => {
      const { metadata, ...rest } = r;
      return rest;
    }),
  };

  // Format
  let buffer;
  switch (filters.format) {
    case 'json': buffer = formatAsJSON(exportData); break;
    case 'csv':  buffer = formatAsCSV(exportData);  break;
    case 'pdf':  buffer = formatAsPDF(exportData);  break;
    default: throw new Error(`Unsupported format: ${filters.format}`);
  }

  // Generate export ID and upload
  const exportId = `audit-export-${Date.now()}-${crypto.randomBytes(fib(3)).toString('hex')}`;
  const filename = `${exportId}.${filters.format}`;

  if (storageClient) {
    const storageKey = `audit-exports/${exportId}/${filename}`;
    await storageClient.upload({
      key: storageKey,
      data: buffer,
      contentType: filters.format === 'json' ? 'application/json' : filters.format === 'csv' ? 'text/csv' : 'application/pdf',
      expires: EXPORT_CONSTANTS.DOWNLOAD_EXPIRY_SECONDS,
    });
  }

  await auditLogger?.log({
    action: 'AUDIT_EXPORT_GENERATED',
    exportId,
    format: filters.format,
    recordCount: queryResult.records.length,
    chainValid: chainIntegrity?.valid,
    filters: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      userId: filters.userId,
      tenantId: filters.tenantId,
    },
  });

  return {
    exportId,
    filename,
    format: filters.format,
    sizeBytes: buffer.length,
    pagination: queryResult,
    chainIntegrity,
    buffer, // Available for direct streaming
  };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize audit export router.
 * @param {Object} deps - { pgClient, storageClient, auditLogger }
 */
const createAuditExportRouter = (deps) => {
  /**
   * POST /api/v1/audit/export
   * Generate audit trail export.
   */
  router.post('/export', async (req, res) => {
    try {
      const validation = ExportRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      }

      const result = await generateAuditExport(validation.data, deps);

      if (req.query.stream === 'true') {
        // Stream directly in response
        const contentType = result.format === 'json' ? 'application/json'
          : result.format === 'csv' ? 'text/csv' : 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Chain-Valid', String(result.chainIntegrity?.valid ?? 'not-verified'));
        res.setHeader('X-Violation-Count', String(result.chainIntegrity?.violations?.length ?? 0));
        return res.send(result.buffer);
      }

      res.json({
        success: true,
        exportId: result.exportId,
        filename: result.filename,
        format: result.format,
        sizeBytes: result.sizeBytes,
        pagination: {
          totalRecords: result.pagination.totalRecords,
          totalPages: result.pagination.totalPages,
          currentPage: result.pagination.page,
          pageSize: result.pagination.pageSize,
        },
        chainIntegrity: result.chainIntegrity,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/audit/export/verify
   * Verify chain integrity for a date range without full export.
   */
  router.get('/verify', async (req, res) => {
    try {
      const { dateFrom, dateTo, tenantId } = req.query;
      const { records } = await queryAuditLogs(
        { dateFrom, dateTo, tenantId, pageSize: EXPORT_CONSTANTS.MAX_EXPORT_RECORDS, page: 1 },
        deps.pgClient
      );
      const result = verifyChainIntegrity(records);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/audit/export/categories
   * Return available action categories for filtering.
   */
  router.get('/categories', (req, res) => {
    res.json({
      categories: Object.entries(ACTION_CATEGORIES).map(([name, actions]) => ({ name, actions })),
    });
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createAuditExportRouter,
  generateAuditExport,
  verifyChainIntegrity,
  queryAuditLogs,
  formatAsJSON,
  formatAsCSV,
  formatAsPDF,
  ACTION_CATEGORIES,
  EXPORT_CONSTANTS,
  PHI,
  fib,
};
