'use strict';

/**
 * @module data-portability
 * @description GDPR Article 20 Data Portability — Export user data in machine-readable formats.
 * Exports vector memory, agent configs, interaction history, and all associated metadata.
 * Supports JSON (primary, structured), CSV (tabular), and PDF-metadata formats.
 *
 * @architecture Express Router mounted at /api/v1/portability
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

const PORTABILITY_CONSTANTS = {
  // Max records per section in export: fib(11)=89
  MAX_RECORDS_PER_SECTION: fib(11),
  // Download link expiry: fib(8)=21 days (in seconds)
  DOWNLOAD_EXPIRY_SECONDS: fib(8) * 24 * 60 * 60,
  // Max export file size: fib(10)=55 MB
  MAX_EXPORT_SIZE_BYTES: fib(10) * 1024 * 1024,
  // Export job timeout: fib(9)=34 minutes (ms)
  EXPORT_TIMEOUT_MS: fib(9) * 60 * 1000,
  // Retry constants
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(6),
  // Batch size for streaming large datasets: fib(8)=21
  BATCH_SIZE: fib(8),
};

// ---------------------------------------------------------------------------
// Export Schema
// ---------------------------------------------------------------------------
const ExportRequestSchema = z.object({
  userId: z.string().min(1).max(255),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  sections: z.array(z.enum([
    'all', 'account', 'vector_memory', 'agent_configs',
    'interaction_history', 'conductor_tasks', 'usage_logs', 'consent_records'
  ])).default(['all']),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// Data Gathering Functions
// ---------------------------------------------------------------------------

/**
 * Gather account profile data.
 */
const gatherAccountData = async (userId, pgClient) => {
  const { rows } = await pgClient.query(
    `SELECT id, email, name, organization, role, subscription_tier, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Gather vector memory data (metadata only, not raw embeddings).
 * Raw embedding vectors are excluded — they are numerical representations,
 * not personal data in the traditional sense, and too large to be useful to users.
 */
const gatherVectorMemory = async (userId, pgClient, dateRange) => {
  let query = `
    SELECT id, memory_key, metadata, namespace, created_at, updated_at, accessed_at
    FROM vector_memories
    WHERE user_id = $1 AND deleted_at IS NULL
  `;
  const params = [userId];

  if (dateRange?.from) {
    query += ` AND created_at >= $${params.push(dateRange.from)}`;
  }
  if (dateRange?.to) {
    query += ` AND created_at <= $${params.push(dateRange.to)}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.push(PORTABILITY_CONSTANTS.MAX_RECORDS_PER_SECTION)}`;

  const { rows } = await pgClient.query(query, params);
  return {
    entries: rows,
    count: rows.length,
    note: 'Embedding vectors are excluded from this export. Only memory keys, metadata, and access history are included.',
    format: 'structured',
  };
};

/**
 * Gather agent configurations.
 */
const gatherAgentConfigs = async (userId, pgClient) => {
  const { rows } = await pgClient.query(
    `SELECT id, name, description, capabilities, system_prompt, model_config,
            tool_access, created_at, updated_at, is_active
     FROM agents
     WHERE owner_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, PORTABILITY_CONSTANTS.MAX_RECORDS_PER_SECTION]
  );

  // Sanitize: redact any embedded API keys in configs
  return rows.map(agent => ({
    ...agent,
    model_config: sanitizeConfig(agent.model_config),
    capabilities: agent.capabilities,
  }));
};

/**
 * Gather AI interaction history.
 * Omits raw content for very old interactions (>fib(11)=89 days), shows metadata only.
 */
const gatherInteractionHistory = async (userId, pgClient, dateRange) => {
  const cutoffDate = new Date(Date.now() - fib(11) * 24 * 60 * 60 * 1000).toISOString();

  let query = `
    SELECT id, session_id, model, role, prompt_tokens, completion_tokens,
           total_tokens, latency_ms, created_at,
           CASE WHEN created_at > $2 THEN content ELSE '[Content retained for fib(11)=89 days only]' END as content
    FROM ai_interactions
    WHERE user_id = $1 AND deleted_at IS NULL
  `;
  const params = [userId, cutoffDate];

  if (dateRange?.from) {
    query += ` AND created_at >= $${params.push(dateRange.from)}`;
  }
  if (dateRange?.to) {
    query += ` AND created_at <= $${params.push(dateRange.to)}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.push(PORTABILITY_CONSTANTS.MAX_RECORDS_PER_SECTION)}`;

  const { rows } = await pgClient.query(query, params);
  return {
    interactions: rows,
    count: rows.length,
    retentionNote: `Full content available for interactions within the last ${fib(11)} days.`,
  };
};

/**
 * Gather Heady Conductor task history.
 */
const gatherConductorTasks = async (userId, pgClient, dateRange) => {
  let query = `
    SELECT id, task_type, status, priority, input_summary, output_summary,
           agent_id, created_at, started_at, completed_at, error_message
    FROM conductor_tasks
    WHERE submitted_by = $1 AND deleted_at IS NULL
  `;
  const params = [userId];

  if (dateRange?.from) {
    query += ` AND created_at >= $${params.push(dateRange.from)}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.push(PORTABILITY_CONSTANTS.MAX_RECORDS_PER_SECTION)}`;

  const { rows } = await pgClient.query(query, params);
  return { tasks: rows, count: rows.length };
};

/**
 * Gather consent record history.
 */
const gatherConsentRecords = async (userId, pgClient) => {
  const { rows } = await pgClient.query(
    `SELECT purpose, status, source, granted_at, withdrawn_at, expires_at, consent_version
     FROM consent_records
     WHERE user_id = $1
     ORDER BY granted_at DESC`,
    [userId]
  );
  return { consents: rows, count: rows.length };
};

/**
 * Sanitize config objects to redact secrets.
 */
const sanitizeConfig = (config) => {
  if (!config || typeof config !== 'object') return config;
  const redactKeys = ['api_key', 'apiKey', 'secret', 'password', 'token', 'credential'];
  const sanitized = { ...config };
  for (const key of Object.keys(sanitized)) {
    if (redactKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

// ---------------------------------------------------------------------------
// Export Formatters
// ---------------------------------------------------------------------------

/**
 * Format data export as structured JSON (GDPR Art. 20 primary format).
 */
const formatAsJSON = (userId, data) => {
  const manifest = {
    exportedBy: 'HeadySystems Inc. (DBA Heady™)',
    exportedAt: new Date().toISOString(),
    subject: userId,
    format: 'application/json',
    schemaVersion: '1.0.0',
    gdprBasis: 'GDPR Article 20 — Right to Data Portability',
    sections: Object.keys(data),
    data,
  };
  return Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
};

/**
 * Format data export as CSV (multi-sheet represented as sections).
 */
const formatAsCSV = (userId, data) => {
  const sections = [];

  sections.push('=== HEADY DATA EXPORT ===');
  sections.push(`Subject,${userId}`);
  sections.push(`Exported At,${new Date().toISOString()}`);
  sections.push(`GDPR Basis,Article 20 — Right to Data Portability`);
  sections.push('');

  // Account section
  if (data.account) {
    sections.push('=== ACCOUNT ===');
    for (const [key, val] of Object.entries(data.account)) {
      sections.push(`${key},"${String(val ?? '').replace(/"/g, '""')}"`);
    }
    sections.push('');
  }

  // Vector memory section
  if (data.vector_memory?.entries) {
    sections.push('=== VECTOR MEMORY ===');
    sections.push('id,memory_key,namespace,metadata,created_at,updated_at');
    for (const row of data.vector_memory.entries) {
      const meta = JSON.stringify(row.metadata || {}).replace(/"/g, '""');
      sections.push(`"${row.id}","${row.memory_key}","${row.namespace || ''}","${meta}","${row.created_at}","${row.updated_at}"`);
    }
    sections.push('');
  }

  // Agent configs section
  if (data.agent_configs) {
    sections.push('=== AGENT CONFIGURATIONS ===');
    sections.push('id,name,description,created_at,updated_at');
    for (const agent of data.agent_configs) {
      sections.push(`"${agent.id}","${agent.name}","${(agent.description || '').replace(/"/g, '""')}","${agent.created_at}","${agent.updated_at}"`);
    }
    sections.push('');
  }

  // Interaction history section
  if (data.interaction_history?.interactions) {
    sections.push('=== AI INTERACTION HISTORY ===');
    sections.push('id,session_id,model,role,prompt_tokens,completion_tokens,created_at');
    for (const row of data.interaction_history.interactions) {
      sections.push(`"${row.id}","${row.session_id}","${row.model}","${row.role}","${row.prompt_tokens}","${row.completion_tokens}","${row.created_at}"`);
    }
    sections.push('');
  }

  // Consent records section
  if (data.consent_records?.consents) {
    sections.push('=== CONSENT RECORDS ===');
    sections.push('purpose,status,source,granted_at,withdrawn_at,expires_at');
    for (const row of data.consent_records.consents) {
      sections.push(`"${row.purpose}","${row.status}","${row.source}","${row.granted_at}","${row.withdrawn_at || ''}","${row.expires_at || ''}"`);
    }
  }

  return Buffer.from(sections.join('\n'), 'utf8');
};

/**
 * Format data as PDF-structured metadata (for PDF generation libraries).
 * Returns JSON with PDF rendering hints.
 */
const formatAsPDF = (userId, data) => {
  const pdfDoc = {
    title: `Personal Data Export — ${userId}`,
    author: 'HeadySystems Inc.',
    subject: 'GDPR Article 20 Data Portability Export',
    creator: 'HeadyOS Data Portability Service',
    keywords: 'GDPR, data portability, personal data',
    created: new Date().toISOString(),
    pages: [
      {
        title: 'Cover Page',
        content: [
          { type: 'heading', text: 'Personal Data Export' },
          { type: 'text', text: `This document contains all personal data held by HeadySystems Inc. for user: ${userId}` },
          { type: 'text', text: `Export Date: ${new Date().toLocaleDateString()}` },
          { type: 'text', text: 'Legal Basis: GDPR Article 20 — Right to Data Portability' },
        ],
      },
      ...Object.entries(data).map(([section, sectionData]) => ({
        title: section.replace(/_/g, ' ').toUpperCase(),
        content: [
          { type: 'heading', text: section.replace(/_/g, ' ') },
          { type: 'pre', text: JSON.stringify(sectionData, null, 2) },
        ],
      })),
    ],
  };
  return Buffer.from(JSON.stringify(pdfDoc, null, 2), 'utf8');
};

// ---------------------------------------------------------------------------
// Main Export Function
// ---------------------------------------------------------------------------

/**
 * Generate a complete data portability export for a user.
 *
 * @param {string} userId - User identifier
 * @param {string[]} sections - Sections to include (default: all)
 * @param {string} format - 'json' | 'csv' | 'pdf'
 * @param {Object} options - { dateRange }
 * @returns {Promise<Object>} Export package with buffer and metadata
 */
const generatePortabilityExport = async (userId, sections = ['all'], format = 'json', options = {}, pgClient, redisClient) => {
  const includeAll = sections.includes('all');
  const data = {};

  // Gather requested sections in parallel for efficiency
  const gatherTasks = [];

  if (includeAll || sections.includes('account')) {
    gatherTasks.push(gatherAccountData(userId, pgClient).then(d => { data.account = d; }));
  }
  if (includeAll || sections.includes('vector_memory')) {
    gatherTasks.push(gatherVectorMemory(userId, pgClient, options.dateRange).then(d => { data.vector_memory = d; }));
  }
  if (includeAll || sections.includes('agent_configs')) {
    gatherTasks.push(gatherAgentConfigs(userId, pgClient).then(d => { data.agent_configs = d; }));
  }
  if (includeAll || sections.includes('interaction_history')) {
    gatherTasks.push(gatherInteractionHistory(userId, pgClient, options.dateRange).then(d => { data.interaction_history = d; }));
  }
  if (includeAll || sections.includes('conductor_tasks')) {
    gatherTasks.push(gatherConductorTasks(userId, pgClient, options.dateRange).then(d => { data.conductor_tasks = d; }));
  }
  if (includeAll || sections.includes('consent_records')) {
    gatherTasks.push(gatherConsentRecords(userId, pgClient).then(d => { data.consent_records = d; }));
  }

  await Promise.all(gatherTasks);

  let buffer;
  switch (format) {
    case 'json': buffer = formatAsJSON(userId, data); break;
    case 'csv':  buffer = formatAsCSV(userId, data);  break;
    case 'pdf':  buffer = formatAsPDF(userId, data);  break;
    default: throw new Error(`Unsupported format: ${format}`);
  }

  if (buffer.length > PORTABILITY_CONSTANTS.MAX_EXPORT_SIZE_BYTES) {
    throw Object.assign(new Error(`Export exceeds maximum size of ${fib(10)}=55 MB`), { code: 'EXPORT_TOO_LARGE' });
  }

  return {
    userId,
    format,
    sections: Object.keys(data),
    sizeBytes: buffer.length,
    buffer,
    exportId: crypto.randomBytes(fib(4)).toString('hex'),
    generatedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize data portability router.
 * @param {Object} deps - { pgClient, redisClient, storageClient, auditLogger }
 */
const createPortabilityRouter = (deps) => {
  /**
   * POST /api/v1/portability/export
   * Request a data export.
   */
  router.post('/export', async (req, res) => {
    try {
      const validation = ExportRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      }
      const { userId, format, sections, dateRange } = validation.data;

      const exportResult = await generatePortabilityExport(
        userId, sections, format, { dateRange },
        deps.pgClient, deps.redisClient
      );

      // Upload to storage and get signed URL
      const filename = `portability-export-${userId}-${Date.now()}.${format}`;
      const storageKey = `portability-exports/${exportResult.exportId}/${filename}`;

      await deps.storageClient.upload({
        key: storageKey,
        data: exportResult.buffer,
        contentType: format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/pdf',
        expires: PORTABILITY_CONSTANTS.DOWNLOAD_EXPIRY_SECONDS,
      });

      const downloadUrl = await deps.storageClient.getSignedUrl(storageKey, {
        expiresIn: PORTABILITY_CONSTANTS.DOWNLOAD_EXPIRY_SECONDS,
      });

      await deps.auditLogger.log({
        action: 'DATA_PORTABILITY_EXPORT',
        userId,
        exportId: exportResult.exportId,
        format,
        sections: exportResult.sections,
        sizeBytes: exportResult.sizeBytes,
      });

      res.json({
        success: true,
        exportId: exportResult.exportId,
        filename,
        format,
        sizeBytes: exportResult.sizeBytes,
        sections: exportResult.sections,
        downloadUrl,
        expiresAt: new Date(Date.now() + PORTABILITY_CONSTANTS.DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString(),
        notice: 'Your data export is ready. The download link expires in 21 days.',
      });
    } catch (err) {
      const status = err.code === 'EXPORT_TOO_LARGE' ? 413 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/portability/download/:exportId
   * Direct download of export (streaming response).
   */
  router.get('/download/:exportId', async (req, res) => {
    try {
      const { exportId } = req.params;
      const { userId, format } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId query parameter required' });

      const exportResult = await generatePortabilityExport(
        userId, ['all'], format || 'json', {},
        deps.pgClient, deps.redisClient
      );

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="heady-export-${userId}.${format || 'json'}"`);
      res.setHeader('Content-Length', exportResult.buffer.length);
      res.send(exportResult.buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/portability/schema
   * Return the export schema for developer reference.
   */
  router.get('/schema', (req, res) => {
    res.json({
      exportSchema: {
        version: '1.0.0',
        format: 'JSON (primary), CSV, PDF',
        sections: {
          account: 'User profile and subscription data',
          vector_memory: 'Memory keys, metadata (embeddings excluded)',
          agent_configs: 'Agent definitions and capability settings',
          interaction_history: 'AI conversation history (89-day content window)',
          conductor_tasks: 'Multi-agent orchestration task history',
          consent_records: 'Full consent audit trail',
        },
        gdprBasis: 'Article 20 — Right to Data Portability',
        retentionPolicy: {
          sessionData: `${fib(9)} days`,
          usageLogs: `${fib(11)} days`,
          aiInteractions: `${fib(11)} days`,
          vectorMemory: `${fib(13)} days (configurable)`,
          auditTrail: `${fib(13)} days`,
          financialRecords: `${fib(15)} days`,
        },
      },
    });
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createPortabilityRouter,
  generatePortabilityExport,
  gatherAccountData,
  gatherVectorMemory,
  gatherAgentConfigs,
  gatherInteractionHistory,
  gatherConsentRecords,
  formatAsJSON,
  formatAsCSV,
  formatAsPDF,
  PORTABILITY_CONSTANTS,
  PHI,
  fib,
};
