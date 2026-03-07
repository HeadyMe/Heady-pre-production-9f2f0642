/**
 * @fileoverview MIDI Routes V2 — Complete REST + WebSocket API for all MIDI operations.
 * Express.js router with φ-derived rate limiting and real-time event streaming.
 *
 * REST Endpoints:
 *   GET    /api/midi/status              — Bus metrics + per-channel stats
 *   GET    /api/midi/events              — Buffered event history (ring buffer)
 *   POST   /api/midi/send                — Inject MIDI message into bus
 *   GET    /api/midi/sequencer/state     — Clock + pattern state
 *   POST   /api/midi/sequencer/play      — Start playback
 *   POST   /api/midi/sequencer/stop      — Stop playback
 *   POST   /api/midi/sequencer/tempo     — Set BPM
 *   POST   /api/midi/sequencer/pattern   — Add/update pattern
 *   GET    /api/midi/mappings            — List CC mappings
 *   POST   /api/midi/mappings            — Create/update mapping
 *   DELETE /api/midi/mappings/:id        — Delete mapping
 *   POST   /api/midi/sysex/send          — Encode + dispatch SysEx to Ableton
 *   GET    /api/midi/network/peers       — Connected MIDI peers (UDP + WS)
 *   POST   /api/midi/arrangement         — Trigger AI arrangement pipeline
 *
 * WebSocket Endpoints (upgrade):
 *   /ws/midi     — Real-time JSON MIDI event stream
 *   /ws/midi/ump — Raw MIDI 2.0 UMP binary stream (ArrayBuffer)
 *
 * Rate Limiting: φ-derived — FIB[10]=55 requests per FIB[7]=13 second window per IP
 *
 * @module routes/midi-routes-v2
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import { Router } from 'express';
import { WebSocketServer } from 'ws';
import {
  FIB, CHANNEL, CHANNEL_LABELS, CHANNEL_COLORS,
  EVENT_BUFFER_SIZE, MAX_WS_CLIENTS,
} from '../shared/midi-constants.js';
import {
  encodeSetTempo, encodeTransport, encodeSetTrackVolume,
  encodeTriggerClip, encodeSetDeviceParam, encodeCreateMidiTrack,
  encodeCreateAudioTrack, encodeSetTrackSend, encodeSetTrackEQ,
  encodeArmTrack, encodeSetClipColor, encodeSetClipName,
  encodeQuantizeClip, encodeDuplicateClip, encodeDeleteClip,
  encodeStatusRequest, encodeGetTrackNames, encodeGetDeviceChain,
  encodeSetMacro, encodeLoadPreset, encodeCCRecordEnable,
  encodeSetLoopRegion, encodeSetTimeSignature, encodeSetTrackRouting,
  encodeSoloTrack, encodeMuteTrack, encodeSetSceneName, encodeFireScene,
  encodeCaptureMidi, encodeConsolidateClip, encodeUndo,
  encodeAIArrangement, encodeAIGeneratePattern, encodeVersionNegotiate,
} from '../shared/sysex-codec.js';

// ─── φ-Derived Rate Limiting ──────────────────────────────────────
/** Max requests per window: FIB[10]=55. Window: FIB[7]=13 seconds. */
const RATE_MAX    = FIB[9];       // 55
const RATE_WINDOW = FIB[6] * 1000; // 13 000 ms

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map();

/** Sliding-window rate limiter keyed by client IP. */
function rateLimiter(req, res, next) {
  const ip  = req.ip || req.socket.remoteAddress || '0.0.0.0';
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now >= b.resetAt) { b = { count: 0, resetAt: now + RATE_WINDOW }; rateBuckets.set(ip, b); }
  b.count++;
  res.set('X-RateLimit-Limit', String(RATE_MAX));
  res.set('X-RateLimit-Remaining', String(Math.max(0, RATE_MAX - b.count)));
  res.set('X-RateLimit-Reset', String(Math.ceil(b.resetAt / 1000)));
  if (b.count > RATE_MAX) return res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: b.resetAt - now });
  next();
}
setInterval(() => { const n = Date.now(); for (const [k, v] of rateBuckets) if (n >= v.resetAt) rateBuckets.delete(k); }, RATE_WINDOW);

// ─── Ring Buffer (capacity = 987, Fibonacci) ──────────────────────
class RingBuffer {
  constructor(cap = EVENT_BUFFER_SIZE) { this._b = new Array(cap).fill(null); this._h = 0; this._n = 0; this.cap = cap; }
  push(e) { this._b[this._h] = e; this._h = (this._h + 1) % this.cap; if (this._n < this.cap) this._n++; }
  query(since = 0, limit = 100) {
    const out = [], s = this._n < this.cap ? 0 : this._h;
    for (let i = 0; i < this._n && out.length < limit; i++) { const e = this._b[(s + i) % this.cap]; if (e && e.timestamp >= since) out.push(e); }
    return out;
  }
  get size() { return this._n; }
}

// ─── Validation Helpers ───────────────────────────────────────────
/** Check integer in range [lo, hi]. */
const isInt  = (v, lo = 0, hi = 127) => Number.isInteger(v) && v >= lo && v <= hi;
/** Return 400 with structured validation error. */
const fail   = (res, msg) => res.status(400).json({ error: 'Validation failed', message: msg });
/** Wrap handler with async-safe try/catch to prevent unhandled rejections. */
const wrap   = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };

// ─── SysEx Encoder Dispatch Table ─────────────────────────────────
const SYSEX_ENC = new Map([
  ['VERSION_NEGOTIATE',   p => encodeVersionNegotiate(p.version)],
  ['SET_TEMPO',           p => encodeSetTempo(p.bpm)],
  ['SET_TRACK_VOLUME',    p => encodeSetTrackVolume(p.track, p.volume)],
  ['TRIGGER_CLIP',        p => encodeTriggerClip(p.track, p.scene)],
  ['SET_DEVICE_PARAM',    p => encodeSetDeviceParam(p.track, p.device, p.param, p.value)],
  ['TRANSPORT',           p => encodeTransport(p.action)],
  ['CREATE_MIDI_TRACK',   p => encodeCreateMidiTrack(p.name)],
  ['CREATE_AUDIO_TRACK',  p => encodeCreateAudioTrack(p.name)],
  ['SET_TRACK_SEND',      p => encodeSetTrackSend(p.track, p.send, p.value)],
  ['SET_TRACK_EQ',        p => encodeSetTrackEQ(p.track, p.band, p.freqHi, p.freqLo, p.gain, p.q)],
  ['ARM_TRACK',           p => encodeArmTrack(p.track, p.armState)],
  ['SET_CLIP_COLOR',      p => encodeSetClipColor(p.track, p.scene, p.r, p.g, p.b)],
  ['SET_CLIP_NAME',       p => encodeSetClipName(p.track, p.scene, p.name)],
  ['QUANTIZE_CLIP',       p => encodeQuantizeClip(p.track, p.scene, p.quantize)],
  ['DUPLICATE_CLIP',      p => encodeDuplicateClip(p.srcTrack, p.srcScene, p.dstTrack, p.dstScene)],
  ['DELETE_CLIP',         p => encodeDeleteClip(p.track, p.scene)],
  ['STATUS_REQUEST',      () => encodeStatusRequest()],
  ['GET_TRACK_NAMES',     () => encodeGetTrackNames()],
  ['GET_DEVICE_CHAIN',    p => encodeGetDeviceChain(p.track)],
  ['SET_MACRO',           p => encodeSetMacro(p.track, p.device, p.macroIndex, p.value)],
  ['LOAD_PRESET',         p => encodeLoadPreset(p.track, p.device, p.presetIndex)],
  ['CC_RECORD_ENABLE',    p => encodeCCRecordEnable(p.track, p.ccNumber, p.enable)],
  ['SET_LOOP_REGION',     p => encodeSetLoopRegion(p.startBar, p.startBeat, p.endBar, p.endBeat)],
  ['SET_TIME_SIGNATURE',  p => encodeSetTimeSignature(p.numerator, p.denominator)],
  ['SET_TRACK_ROUTING',   p => encodeSetTrackRouting(p.track, p.inputType, p.inputChannel)],
  ['SOLO_TRACK',          p => encodeSoloTrack(p.track, p.soloState)],
  ['MUTE_TRACK',          p => encodeMuteTrack(p.track, p.muteState)],
  ['SET_SCENE_NAME',      p => encodeSetSceneName(p.scene, p.name)],
  ['FIRE_SCENE',          p => encodeFireScene(p.sceneIndex)],
  ['CAPTURE_MIDI',        () => encodeCaptureMidi()],
  ['CONSOLIDATE_CLIP',    p => encodeConsolidateClip(p.track, p.scene)],
  ['UNDO',                () => encodeUndo()],
  ['AI_ARRANGEMENT',      p => encodeAIArrangement(p.data)],
  ['AI_GENERATE_PATTERN', p => encodeAIGeneratePattern(p.data)],
]);

// ─── Router Factory ───────────────────────────────────────────────

/**
 * Create the MIDI REST API router with dependency injection.
 * @param {Object} deps
 * @param {Object} deps.eventBus      — emit('midi',evt), on('midi',fn), getChannelStats(), getTotalEvents(), getUptime()
 * @param {Object} deps.sequencer     — getState(), play(), stop(), setTempo(bpm), addPattern(pat)
 * @param {Object} deps.mappingService — list(), create(obj), remove(id)
 * @param {Object} deps.wsProxy       — send(frame), getUdpPeers(), getWsPeers(), on('ump',fn)
 * @param {Object} deps.arrangementPipeline — run({ description, jobId }): Promise
 * @returns {import('express').Router}
 */
export function createMidiRouter(deps) {
  const { eventBus, sequencer, mappingService, wsProxy, arrangementPipeline } = deps;
  const router = Router();
  const buf    = new RingBuffer(EVENT_BUFFER_SIZE);
  const t0     = Date.now();

  // Wire event bus → ring buffer
  eventBus?.on?.('midi', (e) => buf.push({ ...e, timestamp: e.timestamp || Date.now() }));
  router.use(rateLimiter);

  // ── GET /api/midi/status ──────────────────────────────────────
  /** @route GET /api/midi/status — Bus metrics + per-channel stats. */
  router.get('/status', (_req, res) => {
    try {
      const cs = eventBus?.getChannelStats?.() || {};
      const channels = Object.values(CHANNEL).map(id => ({
        id, label: CHANNEL_LABELS[id], color: CHANNEL_COLORS[id],
        lastActivity: cs[id]?.lastActivity || null,
        eventCount:   cs[id]?.eventCount   || 0,
        ccValues:     cs[id]?.ccValues     || {},
      }));
      res.json({ channels, uptime: Date.now() - (eventBus?.getUptime?.() || t0), totalEvents: eventBus?.getTotalEvents?.() ?? buf.size });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── GET /api/midi/events?since=&limit= ────────────────────────
  /** @route GET /api/midi/events — Buffered event history from ring buffer. */
  router.get('/events', (req, res) => {
    try {
      const since = parseInt(req.query.since, 10) || 0;
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, EVENT_BUFFER_SIZE);
      const events = buf.query(since, limit);
      res.json({ events, count: events.length, bufferSize: buf.size });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/send ───────────────────────────────────────
  /** @route POST /api/midi/send — Inject MIDI message into bus. */
  router.post('/send', (req, res) => {
    try {
      const { type, data, status: st, channel: ch, data1, data2 } = req.body || {};
      if (type === 'sysex') {
        if (!Array.isArray(data) || data.length < 4) return fail(res, 'SysEx data must be an array ≥ 4 bytes');
        if (data.some(b => !isInt(b, 0, 0xFF)))      return fail(res, 'SysEx bytes must be 0x00-0xFF');
        eventBus.emit('midi', { type: 'sysex', data, timestamp: Date.now() });
        return res.json({ ok: true, type: 'sysex', byteCount: data.length });
      }
      if (!isInt(st, 0x80, 0xFF))               return fail(res, `Invalid status: ${st}`);
      if (!isInt(ch, 0, 15))                     return fail(res, `Invalid channel: ${ch}`);
      if (!isInt(data1))                         return fail(res, `Invalid data1: ${data1}`);
      if (data2 !== undefined && !isInt(data2))  return fail(res, `Invalid data2: ${data2}`);
      const evt = { status: st, channel: ch, data1, data2: data2 ?? 0, timestamp: Date.now() };
      eventBus.emit('midi', evt); buf.push(evt);
      res.json({ ok: true, event: evt });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── GET /api/midi/sequencer/state ─────────────────────────────
  /** @route GET /api/midi/sequencer/state — Clock + pattern state. */
  router.get('/sequencer/state', (_req, res) => {
    try {
      const s = sequencer?.getState?.() || {};
      res.json({ bpm: s.bpm ?? 89, playing: s.playing ?? false, position: s.position ?? '1:1:0', swing: s.swing ?? 0.618, patterns: s.patterns ?? [] });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/sequencer/play ─────────────────────────────
  /** @route POST /api/midi/sequencer/play — Start playback. */
  router.post('/sequencer/play', (_req, res) => {
    try {
      if (typeof sequencer?.play !== 'function') return res.status(500).json({ error: 'Sequencer unavailable' });
      sequencer.play();
      res.json({ ok: true, playing: true });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/sequencer/stop ─────────────────────────────
  /** @route POST /api/midi/sequencer/stop — Stop playback. */
  router.post('/sequencer/stop', (_req, res) => {
    try {
      if (typeof sequencer?.stop !== 'function') return res.status(500).json({ error: 'Sequencer unavailable' });
      sequencer.stop();
      res.json({ ok: true, playing: false });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/sequencer/tempo ────────────────────────────
  /** @route POST /api/midi/sequencer/tempo — Set BPM (20–999.9). */
  router.post('/sequencer/tempo', (req, res) => {
    try {
      const { bpm } = req.body || {};
      if (typeof bpm !== 'number' || bpm < 20 || bpm > 999.9) return fail(res, 'bpm must be 20–999.9');
      if (typeof sequencer?.setTempo !== 'function') return res.status(500).json({ error: 'Sequencer unavailable' });
      sequencer.setTempo(bpm);
      res.json({ ok: true, bpm });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/sequencer/pattern ──────────────────────────
  /** @route POST /api/midi/sequencer/pattern — Add/update pattern. */
  router.post('/sequencer/pattern', (req, res) => {
    try {
      const { id, channel, events } = req.body || {};
      if (!id || typeof id !== 'string')            return fail(res, 'id must be a non-empty string');
      if (!isInt(channel, 0, 15))                   return fail(res, 'channel must be 0-15');
      if (!Array.isArray(events) || !events.length) return fail(res, 'events must be a non-empty array');
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (typeof e.tick !== 'number' || e.tick < 0) return fail(res, `events[${i}].tick invalid`);
        if (!isInt(e.type, 0, 0xFF))                  return fail(res, `events[${i}].type invalid`);
        if (!isInt(e.data1))                           return fail(res, `events[${i}].data1 invalid`);
        if (e.data2 !== undefined && !isInt(e.data2))  return fail(res, `events[${i}].data2 invalid`);
      }
      if (typeof sequencer?.addPattern !== 'function') return res.status(500).json({ error: 'Sequencer unavailable' });
      sequencer.addPattern({ id, channel, events });
      res.status(201).json({ ok: true, patternId: id, eventCount: events.length });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── GET /api/midi/mappings ────────────────────────────────────
  /** @route GET /api/midi/mappings — List all CC mappings. */
  router.get('/mappings', (_req, res) => {
    try { res.json({ mappings: mappingService?.list?.() || [] }); }
    catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/mappings ───────────────────────────────────
  /** @route POST /api/midi/mappings — Create/update CC mapping. */
  router.post('/mappings', (req, res) => {
    try {
      const { deviceId, ccNumber, channel, targetParam, curveType, ...extra } = req.body || {};
      if (!deviceId || typeof deviceId !== 'string')     return fail(res, 'deviceId required (string)');
      if (!isInt(ccNumber, 0, 127))                      return fail(res, 'ccNumber must be 0-127');
      if (!isInt(channel, 0, 15))                        return fail(res, 'channel must be 0-15');
      if (!targetParam || typeof targetParam !== 'string') return fail(res, 'targetParam required (string)');
      if (typeof mappingService?.create !== 'function')  return res.status(500).json({ error: 'Mapping service unavailable' });
      const mapping = mappingService.create({ deviceId, ccNumber, channel, targetParam, curveType: curveType || 'linear', ...extra });
      res.status(201).json({ ok: true, mapping });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── DELETE /api/midi/mappings/:id ─────────────────────────────
  /** @route DELETE /api/midi/mappings/:id — Remove mapping. */
  router.delete('/mappings/:id', (req, res) => {
    try {
      if (typeof mappingService?.remove !== 'function') return res.status(500).json({ error: 'Mapping service unavailable' });
      const ok = mappingService.remove(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Mapping not found', id: req.params.id });
      res.json({ ok: true, id: req.params.id });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/sysex/send ─────────────────────────────────
  /** @route POST /api/midi/sysex/send — Encode + dispatch SysEx via wsProxy. */
  router.post('/sysex/send', (req, res) => {
    try {
      const { cmd, ...params } = req.body || {};
      if (!cmd || typeof cmd !== 'string') return fail(res, 'cmd required (SYSEX_CMD name)');
      const enc = SYSEX_ENC.get(cmd.toUpperCase());
      if (!enc) return fail(res, `Unknown cmd "${cmd}". Valid: ${[...SYSEX_ENC.keys()].join(', ')}`);
      const frame = enc(params);
      if (typeof wsProxy?.send !== 'function') return res.status(500).json({ error: 'SysEx proxy unavailable' });
      wsProxy.send(frame);
      res.json({ ok: true, cmd: cmd.toUpperCase(), frameBytes: frame.length, hex: Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ') });
    } catch (e) { res.status(500).json({ error: 'Encoding error', message: e.message }); }
  });

  // ── GET /api/midi/network/peers ───────────────────────────────
  /** @route GET /api/midi/network/peers — Connected MIDI peers. */
  router.get('/network/peers', (_req, res) => {
    try {
      const peers = [
        ...(wsProxy?.getUdpPeers?.() || []).map(p => ({ ...p, transport: 'udp' })),
        ...(wsProxy?.getWsPeers?.()  || []).map(p => ({ ...p, transport: 'ws'  })),
      ];
      res.json({ peers, count: peers.length });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── POST /api/midi/arrangement ────────────────────────────────
  /** @route POST /api/midi/arrangement — Trigger AI arrangement pipeline. */
  router.post('/arrangement', (req, res) => {
    try {
      const { description } = req.body || {};
      if (!description || typeof description !== 'string' || !description.trim()) return fail(res, 'description required (non-empty string)');
      if (description.length > 2000) return fail(res, 'description max 2000 chars');
      if (typeof arrangementPipeline?.run !== 'function') return res.status(500).json({ error: 'Pipeline unavailable' });
      const jobId = `arr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      arrangementPipeline.run({ description: description.trim(), jobId })
        .catch(err => eventBus?.emit?.('arrangement:error', { jobId, error: err.message }));
      res.status(202).json({ ok: true, jobId, status: 'accepted' });
    } catch (e) { res.status(500).json({ error: 'Internal error', message: e.message }); }
  });

  // ── Terminal error handler for this router ──────────────────
  // eslint-disable-next-line no-unused-vars
  router.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return router;
}

// ─── WebSocket Setup ──────────────────────────────────────────────

/**
 * Attach MIDI WebSocket upgrade handlers to an HTTP server.
 *   /ws/midi     — real-time JSON event stream
 *   /ws/midi/ump — raw UMP binary frames (ArrayBuffer)
 *
 * @param {import('http').Server} server
 * @param {Object} deps - { eventBus, wsProxy }
 * @returns {{ wssJson: WebSocketServer, wssUmp: WebSocketServer }}
 */
export function setupMidiWebSocket(server, deps) {
  const { eventBus, wsProxy } = deps;
  /** @type {Set<import('ws').WebSocket>} */ const jsonClients = new Set();
  /** @type {Set<import('ws').WebSocket>} */ const umpClients  = new Set();

  const wssJson = new WebSocketServer({ noServer: true });
  const wssUmp  = new WebSocketServer({ noServer: true });

  // ── JSON stream (/ws/midi) ────────────────────────────────────
  wssJson.on('connection', (ws) => {
    if (jsonClients.size >= MAX_WS_CLIENTS) { ws.close(1013, 'Max clients reached'); return; }
    jsonClients.add(ws);
    ws.send(JSON.stringify({ type: 'connected', message: 'HeadyMIDI real-time stream', maxClients: MAX_WS_CLIENTS, timestamp: Date.now() }));
    ws.on('close', () => jsonClients.delete(ws));
    ws.on('error', () => jsonClients.delete(ws));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (Array.isArray(msg.subscribe)) ws._channelFilter = new Set(msg.subscribe);
        if (msg.ping) ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } catch { /* non-JSON ignored */ }
    });
  });

  // Broadcast MIDI events to JSON clients
  eventBus?.on?.('midi', (evt) => {
    const payload = JSON.stringify({ type: 'midi', channel: evt.channel, status: evt.status, data1: evt.data1, data2: evt.data2, timestamp: evt.timestamp || Date.now() });
    for (const ws of jsonClients) {
      if (ws.readyState !== 1) continue;
      if (ws._channelFilter && !ws._channelFilter.has(evt.channel)) continue;
      ws.send(payload);
    }
  });

  // ── UMP binary stream (/ws/midi/ump) ──────────────────────────
  wssUmp.on('connection', (ws) => {
    if (umpClients.size >= MAX_WS_CLIENTS) { ws.close(1013, 'Max clients reached'); return; }
    umpClients.add(ws);
    ws.binaryType = 'arraybuffer';
    ws.on('close', () => umpClients.delete(ws));
    ws.on('error', () => umpClients.delete(ws));
  });

  wsProxy?.on?.('ump', (frame) => { for (const ws of umpClients) if (ws.readyState === 1) ws.send(frame); });

  // ── Heartbeat — ping every FIB[8]=21 seconds, terminate stale ──
  const HEARTBEAT_MS = FIB[7] * 1000; // 21 000 ms
  const heartbeat = setInterval(() => {
    for (const ws of [...jsonClients, ...umpClients]) {
      if (ws._isAlive === false) { ws.terminate(); continue; }
      ws._isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  // Mark alive on pong
  const markAlive = (ws) => { ws._isAlive = true; ws.on('pong', () => { ws._isAlive = true; }); };
  wssJson.on('connection', markAlive);
  wssUmp.on('connection', markAlive);

  // ── HTTP Upgrade routing ──────────────────────────────────────
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname === '/ws/midi')     return wssJson.handleUpgrade(req, socket, head, ws => wssJson.emit('connection', ws, req));
    if (pathname === '/ws/midi/ump') return wssUmp.handleUpgrade(req, socket, head, ws => wssUmp.emit('connection', ws, req));
    socket.destroy();
  });

  return { wssJson, wssUmp };
}
