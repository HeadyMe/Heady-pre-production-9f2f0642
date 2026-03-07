/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Routes: Metacognitive Self-Awareness Loop (HS-061)
 *
 * Express/Node.js compatible route handlers for the metacognitive loop.
 * Mount with: app.use('/api/awareness', require('./routes/awareness-routes'));
 *
 * Endpoints:
 *   POST /events               — Ingest a telemetry event
 *   POST /events/batch         — Ingest multiple telemetry events
 *   GET  /assess               — Get current state assessment + recommendations
 *   GET  /report               — Full system introspection report
 *   POST /inject-prompt        — Inject self-assessment into an AI prompt
 *   GET  /ring-buffer/stats    — Ring buffer statistics
 *   POST /branding/domains     — Register a domain for branding monitoring
 *   DELETE /branding/domains/:id — Deregister a branding domain
 *   POST /branding/check-all   — Check all registered branding domains
 *   GET  /branding/report      — Brand health report
 */

'use strict';

const { MetacognitiveLoop, SEVERITY } = require('../awareness/metacognitive-loop');

// Module-level singleton
let _loop = null;

/**
 * Get or create the singleton MetacognitiveLoop.
 * @param {object} [opts]
 * @returns {MetacognitiveLoop}
 */
function getLoop(opts = {}) {
  if (!_loop) _loop = new MetacognitiveLoop(opts);
  return _loop;
}

/**
 * Replace the singleton (for testing or reconfiguration).
 * @param {MetacognitiveLoop} instance
 */
function setLoop(instance) {
  _loop = instance;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /events
 * Body: { type: string, summary: string, data?: object, severity: string, timestamp?: number }
 */
function ingestEvent(req, res) {
  try {
    const event = req.body || {};
    if (!event.type) return res.status(400).json({ error: 'event.type is required' });

    const loop   = getLoop();
    const stored = loop.ingest(event);
    return res.status(201).json({ ok: true, event: stored, bufferSize: loop.ringBuffer.size });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /events/batch
 * Body: { events: Array<{ type, summary, severity, ... }> }
 */
function ingestBatch(req, res) {
  try {
    const { events = [] } = req.body || {};
    if (!Array.isArray(events)) return res.status(400).json({ error: 'events must be an array' });

    const loop   = getLoop();
    const stored = events.map(e => loop.ingest(e));
    return res.status(201).json({ ok: true, count: stored.length, bufferSize: loop.ringBuffer.size });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /assess
 */
function assess(req, res) {
  try {
    const loop   = getLoop();
    const result = loop.assess();
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /report
 */
function fullReport(req, res) {
  try {
    const loop   = getLoop();
    const report = loop.fullReport();
    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /inject-prompt
 * Body: { prompt: string, includeRecommendations?: boolean, includeRecentErrors?: boolean }
 */
function injectPrompt(req, res) {
  try {
    const { prompt, ...opts } = req.body || {};
    if (typeof prompt !== 'string') return res.status(400).json({ error: 'prompt must be a string' });

    const loop      = getLoop();
    const augmented = loop.injectPrompt(prompt, opts);
    return res.json({ ok: true, augmented, originalLength: prompt.length, augmentedLength: augmented.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /ring-buffer/stats
 */
function ringBufferStats(req, res) {
  try {
    const loop = getLoop();
    return res.json({ ok: true, stats: loop.ringBuffer.stats() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /branding/domains
 * Body: { domainId: string, url: string, brandingElements?: string[] }
 */
function registerBrandingDomain(req, res) {
  try {
    const { domainId, url, brandingElements = [] } = req.body || {};
    if (!domainId) return res.status(400).json({ error: 'domainId is required' });
    if (!url)      return res.status(400).json({ error: 'url is required' });

    const loop = getLoop();
    const desc = loop.brandingMonitor.registerDomain(domainId, url, brandingElements);
    return res.status(201).json({ ok: true, domain: desc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /branding/domains/:id
 */
function deregisterBrandingDomain(req, res) {
  try {
    const { id } = req.params;
    const loop    = getLoop();
    const removed = loop.brandingMonitor.deregisterDomain(id);
    return res.json({ ok: true, removed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /branding/check-all
 */
async function checkAllBranding(req, res) {
  try {
    const loop    = getLoop();
    const results = await loop.brandingMonitor.checkAll();
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /branding/report
 */
function brandingReport(req, res) {
  try {
    const loop   = getLoop();
    const report = loop.brandingMonitor.brandHealthReport();
    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Router Assembly ──────────────────────────────────────────────────────────

function awarenessRouter() {
  try {
    const express = require('express');
    const router  = express.Router();
    router.post  ('/events',                ingestEvent);
    router.post  ('/events/batch',          ingestBatch);
    router.get   ('/assess',                assess);
    router.get   ('/report',                fullReport);
    router.post  ('/inject-prompt',         injectPrompt);
    router.get   ('/ring-buffer/stats',     ringBufferStats);
    router.post  ('/branding/domains',      registerBrandingDomain);
    router.delete('/branding/domains/:id',  deregisterBrandingDomain);
    router.post  ('/branding/check-all',    checkAllBranding);
    router.get   ('/branding/report',       brandingReport);
    return router;
  } catch {
    return [
      { method: 'POST',   path: '/events',               handler: ingestEvent },
      { method: 'POST',   path: '/events/batch',          handler: ingestBatch },
      { method: 'GET',    path: '/assess',                handler: assess },
      { method: 'GET',    path: '/report',                handler: fullReport },
      { method: 'POST',   path: '/inject-prompt',         handler: injectPrompt },
      { method: 'GET',    path: '/ring-buffer/stats',     handler: ringBufferStats },
      { method: 'POST',   path: '/branding/domains',      handler: registerBrandingDomain },
      { method: 'DELETE', path: '/branding/domains/:id',  handler: deregisterBrandingDomain },
      { method: 'POST',   path: '/branding/check-all',    handler: checkAllBranding },
      { method: 'GET',    path: '/branding/report',       handler: brandingReport },
    ];
  }
}

module.exports = {
  awarenessRouter,
  getLoop,
  setLoop,
  ingestEvent,
  ingestBatch,
  assess,
  fullReport,
  injectPrompt,
  ringBufferStats,
  registerBrandingDomain,
  deregisterBrandingDomain,
  checkAllBranding,
  brandingReport,
};
