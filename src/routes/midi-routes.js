/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  MidiParser,
  GestureRecognizer,
  MidiToMcpTranslator,
  McpDispatcher,
  MidiMcpBridge,
  DEFAULT_CC_MAP,
  DEFAULT_NOTE_MAP,
} = require('../bridge/midi-to-mcp-bridge');

// ─── Route Handler Factory ────────────────────────────────────────────────────

function createMidiRoutes(opts = {}) {
  const bridge  = opts.bridge || new MidiMcpBridge(opts.bridgeOpts || {});
  const routes  = [];

  /**
   * POST /midi/parse
   * Parse raw MIDI bytes (hex or base64 encoded) into structured events.
   * Body: { data: string, encoding: 'hex'|'base64', format: 'midi1'|'ump' }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/parse',
    handler: async (req, res) => {
      const { data, encoding = 'hex', format = 'midi1' } = req.body || {};
      if (!data) return respond(res, 400, { error: 'Missing data field' });

      try {
        const buf = encoding === 'base64'
          ? Buffer.from(data, 'base64')
          : Buffer.from(data, 'hex');

        const events = format === 'ump'
          ? MidiParser.parseUMP(new Uint32Array(buf.buffer))
          : MidiParser.parse(buf);

        return respond(res, 200, { ok: true, events, count: events.length });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /midi/translate
   * Translate a MIDI event to an MCP tool call.
   * Body: { event: { type, channel, note, velocity, controller, value, ... } }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/translate',
    handler: async (req, res) => {
      const { event } = req.body || {};
      if (!event) return respond(res, 400, { error: 'Missing event field' });

      const translator = new MidiToMcpTranslator(opts.translatorOpts || {});
      const toolCall   = translator.translate(event);

      if (!toolCall) {
        return respond(res, 200, { ok: true, mapped: false, toolCall: null });
      }
      return respond(res, 200, { ok: true, mapped: true, toolCall });
    },
  });

  /**
   * POST /midi/gesture
   * Detect a gesture from a MIDI event.
   * Body: { event: midiEvent }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/gesture',
    handler: async (req, res) => {
      const { event } = req.body || {};
      if (!event) return respond(res, 400, { error: 'Missing event field' });

      const recognizer = new GestureRecognizer(opts.gestureOpts || {});
      const gesture    = recognizer.recognize(event);
      return respond(res, 200, { ok: true, gesture });
    },
  });

  /**
   * POST /midi/process
   * Process raw MIDI bytes: parse → detect gestures → translate → queue dispatch.
   * Body: { data: string, encoding: 'hex'|'base64' }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/process',
    handler: async (req, res) => {
      const { data, encoding = 'hex' } = req.body || {};
      if (!data) return respond(res, 400, { error: 'Missing data field' });

      try {
        const buf    = encoding === 'base64'
          ? Buffer.from(data, 'base64')
          : Buffer.from(data, 'hex');
        const events = bridge.processMidiBytes(buf);
        const stats  = bridge.getStats();
        return respond(res, 200, { ok: true, events: events.length, stats });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * GET /midi/mappings
   * Return current CC and Note mappings.
   */
  routes.push({
    method: 'GET',
    path:   '/midi/mappings',
    handler: async (req, res) => {
      return respond(res, 200, {
        ok: true,
        ccMap:   DEFAULT_CC_MAP,
        noteMap: DEFAULT_NOTE_MAP,
      });
    },
  });

  /**
   * POST /midi/profile/load
   * Load a named mapping profile.
   * Body: { name: string }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/profile/load',
    handler: async (req, res) => {
      const { name } = req.body || {};
      if (!name) return respond(res, 400, { error: 'Missing name field' });
      try {
        bridge.loadProfile(name);
        return respond(res, 200, { ok: true, profile: name });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * POST /midi/profile/register
   * Register a new mapping profile.
   * Body: { name: string, profile: { ccMap?, noteMap? } }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/profile/register',
    handler: async (req, res) => {
      const { name, profile } = req.body || {};
      if (!name || !profile) return respond(res, 400, { error: 'Missing name or profile' });
      bridge.registerProfile(name, profile);
      return respond(res, 201, { ok: true, profile: name });
    },
  });

  /**
   * GET /midi/stats
   * Return bridge statistics.
   */
  routes.push({
    method: 'GET',
    path:   '/midi/stats',
    handler: async (req, res) => {
      return respond(res, 200, { ok: true, stats: bridge.getStats() });
    },
  });

  /**
   * POST /midi/encode/note-on
   * Encode a Note On message to hex bytes.
   * Body: { channel, note, velocity }
   */
  routes.push({
    method: 'POST',
    path:   '/midi/encode/note-on',
    handler: async (req, res) => {
      const { channel = 0, note, velocity } = req.body || {};
      if (note === undefined || velocity === undefined) {
        return respond(res, 400, { error: 'Missing note or velocity' });
      }
      const buf = MidiParser.encodeNoteOn(channel, note, velocity);
      return respond(res, 200, { ok: true, hex: buf.toString('hex'), bytes: Array.from(buf) });
    },
  });

  return routes;
}

// ─── Express middleware adapter ───────────────────────────────────────────────

function respond(res, status, body) {
  if (res && typeof res.status === 'function') {
    return res.status(status).json(body);
  }
  // Raw Node.js http response
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

/**
 * Attach MIDI routes to an Express (or Express-compatible) app.
 */
function attachMidiRoutes(app, opts = {}) {
  const routes = createMidiRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) {
      app[method](route.path, route.handler);
    }
  }
  return app;
}

module.exports = {
  createMidiRoutes,
  attachMidiRoutes,
};
