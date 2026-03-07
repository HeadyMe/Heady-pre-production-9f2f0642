'use strict';

/**
 * @module webhook-manager
 * @description Webhook management API for HeadyOS.
 * Handles webhook registration, delivery, monitoring, and reliability.
 *
 * Features:
 * - Register/list/delete webhooks
 * - Delivery monitoring with retry (φ-backoff)
 * - Dead letter queue (DLQ) for failed deliveries
 * - HMAC-SHA256 payload signing
 * - Delivery status tracking
 * - Event filtering by type
 *
 * @architecture Express Router mounted at /api/v1/webhooks
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

const WEBHOOK_CONSTANTS = {
  // Max retries for failed deliveries: fib(6)=8
  MAX_RETRIES: fib(6),
  // φ-backoff base: 1000ms
  RETRY_BASE_MS: 1000,
  // Max retry delay: 1000ms × φ^8 ≈ 46370ms
  MAX_RETRY_DELAY_MS: Math.round(1000 * Math.pow(PHI, 8)),
  // Delivery timeout: 1000ms × φ^4 ≈ 6854ms
  DELIVERY_TIMEOUT_MS: Math.round(1000 * Math.pow(PHI, 4)),
  // DLQ TTL: fib(13)=233 days
  DLQ_TTL_DAYS: fib(13),
  // Max webhooks per tenant: fib(10)=55
  MAX_WEBHOOKS_PER_TENANT: fib(10),
  // Max events per webhook: fib(8)=21
  MAX_EVENTS_PER_WEBHOOK: fib(8),
  // Delivery history retention: fib(11)=89 days
  HISTORY_RETENTION_DAYS: fib(11),
  // Webhook secret length: fib(5)=5 × 8 = 40 bytes
  SECRET_BYTES: fib(5) * 8,
};

// Available event types
const WEBHOOK_EVENTS = Object.freeze([
  'task.submitted',
  'task.started',
  'task.completed',
  'task.failed',
  'task.cancelled',
  'agent.created',
  'agent.updated',
  'agent.deleted',
  'brain.chat.completed',
  'memory.stored',
  'memory.deleted',
  'mcp.tool.executed',
  'user.created',
  'user.deleted',
  'billing.subscription.created',
  'billing.subscription.cancelled',
  'security.alert',
  'system.maintenance',
  'dsar.received',
  'dsar.completed',
  'consent.granted',
  'consent.withdrawn',
]);

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const WebhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1).max(WEBHOOK_CONSTANTS.MAX_EVENTS_PER_WEBHOOK),
  description: z.string().max(fib(9)).optional(), // max 34 chars
  secret: z.string().min(fib(6)).max(fib(11)).optional(), // 8-89 chars (auto-generated if not provided)
  active: z.boolean().default(true),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(WEBHOOK_CONSTANTS.MAX_RETRIES).default(WEBHOOK_CONSTANTS.MAX_RETRIES),
    timeoutMs: z.number().int().positive().default(WEBHOOK_CONSTANTS.DELIVERY_TIMEOUT_MS),
  }).optional(),
});

// ---------------------------------------------------------------------------
// φ-Retry Helper
// ---------------------------------------------------------------------------
const withPhiRetry = async (fn, maxRetries = WEBHOOK_CONSTANTS.MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(
          Math.round(WEBHOOK_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt)),
          WEBHOOK_CONSTANTS.MAX_RETRY_DELAY_MS
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// Payload Signing
// ---------------------------------------------------------------------------

/**
 * Sign a webhook payload using HMAC-SHA256.
 * Produces a signature in the format: sha256=<hex_digest>
 * Compatible with GitHub webhook signature format.
 */
const signPayload = (payload, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  return `sha256=${hmac.update(JSON.stringify(payload)).digest('hex')}`;
};

/**
 * Verify a webhook signature (for incoming webhook verification).
 */
const verifySignature = (payload, signature, secret) => {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expected, 'utf8')
  );
};

// ---------------------------------------------------------------------------
// Webhook Delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a webhook event to a registered endpoint.
 * Returns delivery result with status and latency.
 */
const deliverWebhook = async (webhook, eventType, eventData) => {
  const deliveryId = `delivery-${Date.now()}-${crypto.randomBytes(fib(3)).toString('hex')}`;
  const payload = {
    deliveryId,
    webhookId: webhook.id,
    event: eventType,
    data: eventData,
    timestamp: new Date().toISOString(),
  };

  const signature = signPayload(payload, webhook.secret);
  const startMs = Date.now();

  const result = {
    deliveryId,
    webhookId: webhook.id,
    event: eventType,
    url: webhook.url,
    attempt: 1,
    latencyMs: 0,
    status: 'pending',
    statusCode: null,
    error: null,
    timestamp: payload.timestamp,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      webhook.retryPolicy?.timeoutMs || WEBHOOK_CONSTANTS.DELIVERY_TIMEOUT_MS
    );

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Heady-Webhook-Id': webhook.id,
        'X-Heady-Delivery': deliveryId,
        'X-Heady-Event': eventType,
        'X-Heady-Signature': signature,
        'X-Heady-Timestamp': payload.timestamp,
        'User-Agent': 'HeadyOS-Webhooks/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    result.statusCode = response.status;
    result.latencyMs = Date.now() - startMs;
    result.status = response.ok ? 'delivered' : 'failed';

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

  } catch (err) {
    result.latencyMs = Date.now() - startMs;
    result.status = 'failed';
    result.error = err.name === 'AbortError'
      ? `Delivery timeout after ${WEBHOOK_CONSTANTS.DELIVERY_TIMEOUT_MS}ms`
      : err.message;
  }

  return result;
};

/**
 * Deliver a webhook with φ-exponential retry on failure.
 * Failed deliveries after all retries are moved to the DLQ.
 */
const deliverWithRetry = async (webhook, eventType, eventData, pgClient, auditLogger) => {
  const maxRetries = webhook.retryPolicy?.maxRetries ?? WEBHOOK_CONSTANTS.MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await deliverWebhook(webhook, eventType, eventData);
    result.attempt = attempt + 1;

    // Log delivery attempt
    await pgClient.query(
      `INSERT INTO webhook_deliveries
         (delivery_id, webhook_id, event_type, url, attempt, status, status_code, latency_ms, error, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [result.deliveryId, webhook.id, eventType, webhook.url, result.attempt,
       result.status, result.statusCode, result.latencyMs, result.error]
    ).catch(() => {}); // Don't fail on audit errors

    if (result.status === 'delivered') {
      await auditLogger?.log({
        action: 'WEBHOOK_DELIVERED',
        webhookId: webhook.id,
        event: eventType,
        deliveryId: result.deliveryId,
        attempt: result.attempt,
        latencyMs: result.latencyMs,
      });
      return result;
    }

    if (attempt < maxRetries) {
      const delay = Math.min(
        Math.round(WEBHOOK_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt)),
        WEBHOOK_CONSTANTS.MAX_RETRY_DELAY_MS
      );
      console.warn(`[Webhook] Delivery failed for ${webhook.id} (${eventType}) — retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // All retries exhausted — send to DLQ
  await sendToDLQ(webhook, eventType, eventData, pgClient, auditLogger);

  return {
    webhookId: webhook.id,
    status: 'dead_lettered',
    event: eventType,
    retries: maxRetries,
    message: `Webhook delivery failed after ${maxRetries + 1} attempts. Sent to dead letter queue.`,
  };
};

/**
 * Move failed webhook to Dead Letter Queue.
 */
const sendToDLQ = async (webhook, eventType, eventData, pgClient, auditLogger) => {
  const dlqId = `dlq-${crypto.randomBytes(fib(3)).toString('hex')}`;
  const expiresAt = new Date(Date.now() + WEBHOOK_CONSTANTS.DLQ_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await pgClient.query(
    `INSERT INTO webhook_dlq
       (dlq_id, webhook_id, event_type, event_data, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [dlqId, webhook.id, eventType, JSON.stringify(eventData), expiresAt]
  ).catch(() => {});

  await auditLogger?.log({
    action: 'WEBHOOK_DEAD_LETTERED',
    dlqId,
    webhookId: webhook.id,
    event: eventType,
    expiresAt,
  });

  console.error(`[Webhook] Dead-lettered: ${webhook.id} for ${eventType} → DLQ ID: ${dlqId}`);
};

// ---------------------------------------------------------------------------
// Webhook Store Operations
// ---------------------------------------------------------------------------

const createWebhookRecord = async (tenantId, data, pgClient) => {
  // Check tenant limit
  const { rows: count } = await pgClient.query(
    'SELECT COUNT(*) FROM webhooks WHERE tenant_id = $1 AND active = true',
    [tenantId]
  );
  if (parseInt(count[0].count, 10) >= WEBHOOK_CONSTANTS.MAX_WEBHOOKS_PER_TENANT) {
    throw new Error(`Maximum of ${WEBHOOK_CONSTANTS.MAX_WEBHOOKS_PER_TENANT} webhooks per tenant (fib(10)=55)`);
  }

  const webhookId = `wh-${crypto.randomBytes(fib(4)).toString('hex')}`;
  const secret = data.secret || crypto.randomBytes(WEBHOOK_CONSTANTS.SECRET_BYTES).toString('hex');

  const { rows } = await pgClient.query(
    `INSERT INTO webhooks
       (webhook_id, tenant_id, url, events, description, secret_hash, active, retry_policy, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING webhook_id, tenant_id, url, events, description, active, retry_policy, created_at`,
    [webhookId, tenantId, data.url, JSON.stringify(data.events), data.description || null,
     crypto.createHash('sha256').update(secret).digest('hex'),
     data.active !== false, JSON.stringify(data.retryPolicy || {})]
  );

  return { ...rows[0], secretShownOnce: secret };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize webhook manager router.
 * @param {Object} deps - { pgClient, redisClient, auditLogger }
 */
const createWebhookRouter = (deps) => {
  /**
   * GET /api/v1/webhooks
   * List all webhooks for the authenticated tenant.
   */
  router.get('/', async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { rows } = await deps.pgClient.query(
        `SELECT webhook_id, url, events, description, active, created_at,
                (SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = w.webhook_id AND status = 'delivered') as delivered_count,
                (SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = w.webhook_id AND status = 'failed') as failed_count
         FROM webhooks w
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [tenantId]
      );
      res.json({ webhooks: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/webhooks
   * Register a new webhook.
   */
  router.post('/', async (req, res) => {
    try {
      const validation = WebhookCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      }
      const tenantId = req.user?.tenantId;
      const record = await createWebhookRecord(tenantId, validation.data, deps.pgClient);
      await deps.auditLogger?.log({
        action: 'WEBHOOK_CREATED',
        webhookId: record.webhook_id,
        url: record.url,
        events: record.events,
        tenantId,
      });
      res.status(201).json({
        success: true,
        webhookId: record.webhook_id,
        url: record.url,
        events: record.events,
        secret: record.secretShownOnce, // Shown only once
        notice: 'Save this secret — it will not be shown again.',
      });
    } catch (err) {
      res.status(err.message.includes('Maximum') ? 429 : 500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/webhooks/:webhookId
   * Get webhook details.
   */
  router.get('/:webhookId', async (req, res) => {
    try {
      const { rows } = await deps.pgClient.query(
        'SELECT webhook_id, url, events, description, active, retry_policy, created_at FROM webhooks WHERE webhook_id = $1 AND tenant_id = $2',
        [req.params.webhookId, req.user?.tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Webhook not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/v1/webhooks/:webhookId
   * Delete a webhook.
   */
  router.delete('/:webhookId', async (req, res) => {
    try {
      const result = await deps.pgClient.query(
        'UPDATE webhooks SET deleted_at = NOW(), active = false WHERE webhook_id = $1 AND tenant_id = $2',
        [req.params.webhookId, req.user?.tenantId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Webhook not found' });
      await deps.auditLogger?.log({ action: 'WEBHOOK_DELETED', webhookId: req.params.webhookId });
      res.json({ success: true, deletedId: req.params.webhookId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/webhooks/:webhookId/deliveries
   * Get delivery history for a webhook.
   */
  router.get('/:webhookId/deliveries', async (req, res) => {
    try {
      const { rows } = await deps.pgClient.query(
        `SELECT delivery_id, event_type, attempt, status, status_code, latency_ms, error, delivered_at
         FROM webhook_deliveries
         WHERE webhook_id = $1
         ORDER BY delivered_at DESC
         LIMIT $2`,
        [req.params.webhookId, fib(9)] // fib(9)=34 deliveries
      );
      res.json({ deliveries: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/webhooks/dlq
   * Get dead letter queue entries.
   */
  router.get('/dlq', async (req, res) => {
    try {
      const { rows } = await deps.pgClient.query(
        `SELECT dlq.*, w.url
         FROM webhook_dlq dlq
         JOIN webhooks w ON w.webhook_id = dlq.webhook_id
         WHERE w.tenant_id = $1 AND dlq.expires_at > NOW()
         ORDER BY dlq.created_at DESC
         LIMIT $2`,
        [req.user?.tenantId, fib(8)] // fib(8)=21
      );
      res.json({ deadLetters: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/webhooks/dlq/:dlqId/retry
   * Retry a dead-lettered webhook delivery.
   */
  router.post('/dlq/:dlqId/retry', async (req, res) => {
    try {
      const { rows: dlqRows } = await deps.pgClient.query(
        'SELECT * FROM webhook_dlq WHERE dlq_id = $1',
        [req.params.dlqId]
      );
      if (!dlqRows[0]) return res.status(404).json({ error: 'DLQ entry not found' });

      const { rows: webhookRows } = await deps.pgClient.query(
        'SELECT * FROM webhooks WHERE webhook_id = $1',
        [dlqRows[0].webhook_id]
      );
      if (!webhookRows[0]) return res.status(404).json({ error: 'Webhook not found' });

      const webhook = webhookRows[0];
      const secretRow = await deps.pgClient.query('SELECT secret FROM webhook_secrets WHERE webhook_id = $1', [webhook.webhook_id]);
      webhook.secret = secretRow.rows[0]?.secret || 'missing-secret';

      const result = await deliverWithRetry(
        webhook,
        dlqRows[0].event_type,
        dlqRows[0].event_data,
        deps.pgClient,
        deps.auditLogger
      );

      if (result.status === 'delivered') {
        await deps.pgClient.query('DELETE FROM webhook_dlq WHERE dlq_id = $1', [req.params.dlqId]);
      }

      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/webhooks/events
   * List all available webhook event types.
   */
  router.get('/events', (req, res) => {
    res.json({ events: WEBHOOK_EVENTS, count: WEBHOOK_EVENTS.length });
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createWebhookRouter,
  deliverWebhook,
  deliverWithRetry,
  sendToDLQ,
  signPayload,
  verifySignature,
  WEBHOOK_EVENTS,
  WEBHOOK_CONSTANTS,
  PHI,
  fib,
};
