/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: MIDI-to-MCP Protocol Bridge - HS-series Hardware Gesture Control

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── MIDI Constants ────────────────────────────────────────────────────────────

const MIDI_STATUS = {
  NOTE_OFF:        0x80,
  NOTE_ON:         0x90,
  POLY_PRESSURE:   0xA0,
  CONTROL_CHANGE:  0xB0,
  PROGRAM_CHANGE:  0xC0,
  CHANNEL_PRESSURE:0xD0,
  PITCH_BEND:      0xE0,
  SYSEX_START:     0xF0,
  SYSEX_END:       0xF7,
  TIMING_CLOCK:    0xF8,
  ACTIVE_SENSING:  0xFE,
  SYSTEM_RESET:    0xFF,
};

const MIDI2_MESSAGE_TYPE = {
  UTILITY:          0x0,
  SYSTEM:           0x1,
  MIDI1_CHANNEL:    0x2,
  SYSEX7:           0x3,
  MIDI2_CHANNEL:    0x4,
  SYSEX8:           0x5,
};

const DEFAULT_CC_MAP = {
  7:  { tool: 'set_volume',      param: 'level',       scale: [0, 1] },
  10: { tool: 'set_pan',         param: 'position',    scale: [-1, 1] },
  11: { tool: 'set_expression',  param: 'value',       scale: [0, 1] },
  74: { tool: 'adjust_temperature', param: 'temperature', scale: [0, 2] },
  75: { tool: 'adjust_top_p',    param: 'top_p',       scale: [0, 1] },
  76: { tool: 'adjust_max_tokens', param: 'max_tokens', scale: [64, 4096] },
};

const DEFAULT_NOTE_MAP = {
  60: { tool: 'trigger_deploy',    params: {} },        // C4
  62: { tool: 'trigger_test',      params: {} },        // D4
  64: { tool: 'trigger_rollback',  params: {} },        // E4
  65: { tool: 'pause_agent',       params: {} },        // F4
  67: { tool: 'resume_agent',      params: {} },        // G4
  69: { tool: 'snapshot_state',    params: {} },        // A4
  71: { tool: 'clear_memory',      params: {} },        // B4
  72: { tool: 'trigger_health_check', params: {} },     // C5
};

// ─── MidiParser ───────────────────────────────────────────────────────────────

class MidiParser {
  /**
   * Parse raw MIDI 1.0 byte buffer into structured events.
   * @param {Buffer|Uint8Array} bytes
   * @returns {Array<Object>} parsed MIDI events
   */
  static parse(bytes) {
    if (!bytes || bytes.length === 0) return [];
    const events = [];
    let i = 0;
    let runningStatus = 0;

    while (i < bytes.length) {
      const byte = bytes[i];

      // Skip real-time messages inline
      if (byte === MIDI_STATUS.TIMING_CLOCK ||
          byte === MIDI_STATUS.ACTIVE_SENSING) {
        i++;
        continue;
      }

      // SysEx
      if (byte === MIDI_STATUS.SYSEX_START) {
        const sysexEnd = Array.from(bytes).indexOf(MIDI_STATUS.SYSEX_END, i + 1);
        if (sysexEnd === -1) break;
        const data = Buffer.from(bytes.slice(i + 1, sysexEnd));
        events.push({ type: 'sysex', manufacturerId: data[0], data });
        i = sysexEnd + 1;
        runningStatus = 0;
        continue;
      }

      // Status byte?
      if (byte & 0x80) {
        runningStatus = byte;
        i++;
      }

      const status  = runningStatus & 0xF0;
      const channel = runningStatus & 0x0F;

      switch (status) {
        case MIDI_STATUS.NOTE_OFF: {
          const note     = bytes[i]   || 0;
          const velocity = bytes[i+1] || 0;
          events.push({ type: 'note_off', channel, note, velocity });
          i += 2;
          break;
        }
        case MIDI_STATUS.NOTE_ON: {
          const note     = bytes[i]   || 0;
          const velocity = bytes[i+1] || 0;
          // Note On with velocity 0 = Note Off
          const type = velocity === 0 ? 'note_off' : 'note_on';
          events.push({ type, channel, note, velocity });
          i += 2;
          break;
        }
        case MIDI_STATUS.POLY_PRESSURE: {
          events.push({ type: 'poly_pressure', channel, note: bytes[i], pressure: bytes[i+1] });
          i += 2;
          break;
        }
        case MIDI_STATUS.CONTROL_CHANGE: {
          events.push({ type: 'control_change', channel, controller: bytes[i], value: bytes[i+1] });
          i += 2;
          break;
        }
        case MIDI_STATUS.PROGRAM_CHANGE: {
          events.push({ type: 'program_change', channel, program: bytes[i] });
          i += 1;
          break;
        }
        case MIDI_STATUS.CHANNEL_PRESSURE: {
          events.push({ type: 'channel_pressure', channel, pressure: bytes[i] });
          i += 1;
          break;
        }
        case MIDI_STATUS.PITCH_BEND: {
          const lsb   = bytes[i]   || 0;
          const msb   = bytes[i+1] || 0;
          const bend  = ((msb << 7) | lsb) - 8192;
          events.push({ type: 'pitch_bend', channel, bend, normalized: bend / 8192 });
          i += 2;
          break;
        }
        default:
          i++;
          break;
      }
    }
    return events;
  }

  /**
   * Parse MIDI 2.0 Universal MIDI Packet (32-bit words).
   * @param {Uint32Array|Array<number>} words
   * @returns {Array<Object>} parsed UMP events
   */
  static parseUMP(words) {
    if (!words || words.length === 0) return [];
    const events = [];

    for (let i = 0; i < words.length; ) {
      const w0       = words[i];
      const msgType  = (w0 >>> 28) & 0xF;
      const group    = (w0 >>> 24) & 0xF;

      switch (msgType) {
        case MIDI2_MESSAGE_TYPE.UTILITY:
          events.push({ type: 'utility', group, data: w0 & 0x00FFFFFF });
          i += 1;
          break;

        case MIDI2_MESSAGE_TYPE.MIDI1_CHANNEL: {
          const status  = (w0 >>> 16) & 0xFF;
          const byte1   = (w0 >>>  8) & 0xFF;
          const byte2   =  w0         & 0xFF;
          const channel = status & 0x0F;
          const opcode  = status & 0xF0;
          events.push({ type: 'midi1_channel', group, opcode, channel, byte1, byte2 });
          i += 1;
          break;
        }

        case MIDI2_MESSAGE_TYPE.MIDI2_CHANNEL: {
          if (i + 1 >= words.length) { i++; break; }
          const w1      = words[i+1];
          const status  = (w0 >>> 16) & 0xFF;
          const channel = status & 0x0F;
          const opcode  = status & 0xF0;
          const index   = (w0 >>>  8) & 0xFF;
          const value32 = w1; // 32-bit value
          events.push({ type: 'midi2_channel', group, opcode, channel, index, value32,
                        normalizedValue: value32 / 0xFFFFFFFF });
          i += 2;
          break;
        }

        case MIDI2_MESSAGE_TYPE.SYSEX7: {
          const numWords = (w0 >>> 24) & 0x3;
          const dataWords = Array.from(words).slice(i, i + numWords + 1);
          events.push({ type: 'sysex7', group, words: dataWords });
          i += numWords + 1;
          break;
        }

        default:
          i++;
          break;
      }
    }
    return events;
  }

  /**
   * Encode a MIDI Note On message to bytes.
   */
  static encodeNoteOn(channel, note, velocity) {
    return Buffer.from([
      (MIDI_STATUS.NOTE_ON | (channel & 0x0F)),
      note & 0x7F,
      velocity & 0x7F,
    ]);
  }

  /**
   * Encode a MIDI Control Change message to bytes.
   */
  static encodeCC(channel, controller, value) {
    return Buffer.from([
      (MIDI_STATUS.CONTROL_CHANGE | (channel & 0x0F)),
      controller & 0x7F,
      value & 0x7F,
    ]);
  }
}

// ─── GestureRecognizer ────────────────────────────────────────────────────────

class GestureRecognizer {
  constructor(opts = {}) {
    this._windowMs   = opts.windowMs   || 500;
    this._padThresh  = opts.padThresh  || 64;
    this._knobDelta  = opts.knobDelta  || 3;
    this._history    = [];
    this._maxHistory = opts.maxHistory || 64;
  }

  /**
   * Feed a parsed MIDI event; returns detected gesture or null.
   */
  recognize(event) {
    const ts = Date.now();
    this._history.push({ ts, event });
    if (this._history.length > this._maxHistory) this._history.shift();

    switch (event.type) {
      case 'note_on':
        return this._detectPadHit(event, ts);
      case 'control_change':
        return this._detectKnobOrFader(event, ts);
      case 'pitch_bend':
        return { gesture: 'pitch_wheel', channel: event.channel,
                 direction: event.normalized > 0 ? 'up' : 'down',
                 magnitude: Math.abs(event.normalized) };
      case 'program_change':
        return { gesture: 'preset_select', channel: event.channel, preset: event.program };
      default:
        return null;
    }
  }

  _detectPadHit(event, ts) {
    const velocity = event.velocity;
    const intensity = velocity >= this._padThresh ? 'hard' : 'soft';

    // Detect double-tap within window
    const recent = this._history.filter(h =>
      h.event.type === 'note_on' &&
      h.event.note === event.note &&
      (ts - h.ts) < this._windowMs &&
      h.ts !== ts
    );

    return {
      gesture:   recent.length >= 1 ? 'double_tap' : 'pad_hit',
      note:      event.note,
      channel:   event.channel,
      velocity,
      intensity,
    };
  }

  _detectKnobOrFader(event, ts) {
    // Knobs typically use relative CC or high-res CC7/11; faders are absolute
    const isFader = [7, 11, 91, 93, 95].includes(event.controller);
    const gesture = isFader ? 'fader_slide' : 'knob_turn';
    const direction = event.value > 64 ? 'increase' : (event.value < 63 ? 'decrease' : 'center');

    return {
      gesture,
      controller: event.controller,
      channel:    event.channel,
      value:      event.value,
      direction,
      normalized: event.value / 127,
    };
  }

  clearHistory() {
    this._history = [];
  }
}

// ─── MidiToMcpTranslator ──────────────────────────────────────────────────────

class MidiToMcpTranslator {
  constructor(opts = {}) {
    this._ccMap      = Object.assign({}, DEFAULT_CC_MAP, opts.ccMap || {});
    this._noteMap    = Object.assign({}, DEFAULT_NOTE_MAP, opts.noteMap || {});
    this._profiles   = opts.profiles  || {};
    this._activeProfile = opts.defaultProfile || null;
    this._requestId  = 0;
  }

  /**
   * Load a named mapping profile.
   */
  loadProfile(name) {
    if (!this._profiles[name]) throw new Error(`Profile not found: ${name}`);
    const p = this._profiles[name];
    if (p.ccMap)   this._ccMap   = Object.assign({}, DEFAULT_CC_MAP, p.ccMap);
    if (p.noteMap) this._noteMap = Object.assign({}, DEFAULT_NOTE_MAP, p.noteMap);
    this._activeProfile = name;
  }

  /**
   * Register a custom mapping profile.
   */
  registerProfile(name, profile) {
    this._profiles[name] = profile;
  }

  /**
   * Translate a parsed MIDI event to an MCP tool call descriptor.
   * Returns null if no mapping exists.
   */
  translate(midiEvent) {
    switch (midiEvent.type) {
      case 'control_change':
        return this._ccToMcp(midiEvent);
      case 'note_on':
        return this._noteToMcp(midiEvent);
      case 'program_change':
        return this._programToMcp(midiEvent);
      case 'pitch_bend':
        return this._pitchBendToMcp(midiEvent);
      default:
        return null;
    }
  }

  _ccToMcp(event) {
    const mapping = this._ccMap[event.controller];
    if (!mapping) return null;
    const [lo, hi] = mapping.scale;
    const paramValue = lo + (event.value / 127) * (hi - lo);
    return {
      tool:   mapping.tool,
      params: { [mapping.param]: +paramValue.toFixed(4) },
      meta:   { source: 'midi_cc', controller: event.controller, channel: event.channel },
    };
  }

  _noteToMcp(event) {
    const mapping = this._noteMap[event.note];
    if (!mapping) return null;
    return {
      tool:   mapping.tool,
      params: Object.assign({}, mapping.params, { velocity: event.velocity }),
      meta:   { source: 'midi_note', note: event.note, channel: event.channel },
    };
  }

  _programToMcp(event) {
    return {
      tool:   'select_program',
      params: { program: event.program, channel: event.channel },
      meta:   { source: 'midi_program_change' },
    };
  }

  _pitchBendToMcp(event) {
    return {
      tool:   'set_pitch_bend',
      params: { bend: event.bend, normalized: event.normalized },
      meta:   { source: 'midi_pitch_bend', channel: event.channel },
    };
  }

  nextRequestId() {
    return `midi-mcp-${++this._requestId}-${Date.now()}`;
  }
}

// ─── McpDispatcher ────────────────────────────────────────────────────────────

class McpDispatcher {
  constructor(opts = {}) {
    this._endpoint    = opts.endpoint    || 'http://localhost:3000/mcp';
    this._timeout     = opts.timeout     || 5000;
    this._headers     = opts.headers     || { 'Content-Type': 'application/json' };
    this._requestId   = 0;
    this._queue       = [];
    this._processing  = false;
    this._maxQueueSize = opts.maxQueueSize || 256;
    this._callbacks   = {};
    this._batchSize   = opts.batchSize   || 1;
    this._batchDelayMs = opts.batchDelayMs || 8; // ~120fps
  }

  /**
   * Build a JSON-RPC 2.0 MCP call object.
   */
  buildRpcCall(toolCall) {
    const id = `rpc-${++this._requestId}-${Date.now()}`;
    return {
      jsonrpc: '2.0',
      id,
      method:  'tools/call',
      params:  {
        name:      toolCall.tool,
        arguments: toolCall.params || {},
        _meta:     toolCall.meta   || {},
      },
    };
  }

  /**
   * Dispatch a tool call immediately (returns Promise).
   */
  async dispatch(toolCall) {
    const rpc = this.buildRpcCall(toolCall);
    return this._send(rpc);
  }

  /**
   * Enqueue a tool call for batched dispatch.
   */
  enqueue(toolCall) {
    if (this._queue.length >= this._maxQueueSize) {
      this._queue.shift(); // drop oldest
    }
    this._queue.push(toolCall);
    if (!this._processing) {
      this._scheduleFlush();
    }
  }

  _scheduleFlush() {
    this._processing = true;
    setTimeout(() => this._flush(), this._batchDelayMs);
  }

  async _flush() {
    while (this._queue.length > 0) {
      const batch = this._queue.splice(0, this._batchSize);
      for (const tc of batch) {
        const rpc = this.buildRpcCall(tc);
        this._send(rpc).catch(err => {
          // Non-fatal: log and continue
          process.nextTick(() => { throw err; });
        });
      }
    }
    this._processing = false;
  }

  async _send(rpc) {
    // In Node.js environments, use http/https modules
    const url     = new URL(this._endpoint);
    const isHttps = url.protocol === 'https:';
    const mod     = isHttps ? require('https') : require('http');

    return new Promise((resolve, reject) => {
      const body = JSON.stringify(rpc);
      const opts = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method:   'POST',
        headers:  Object.assign({ 'Content-Length': Buffer.byteLength(body) }, this._headers),
      };

      const req = mod.request(opts, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this._timeout, () => {
        req.destroy();
        reject(new Error(`McpDispatcher timeout after ${this._timeout}ms`));
      });
      req.write(body);
      req.end();
    });
  }

  /**
   * Register a response callback for a given request ID.
   */
  onResponse(id, cb) {
    this._callbacks[id] = cb;
  }

  getQueueDepth() { return this._queue.length; }
}

// ─── RtpMidiSocket (Network MIDI) ─────────────────────────────────────────────

class RtpMidiSocket {
  /**
   * Network MIDI via RTP-MIDI / AppleMIDI over UDP.
   * Implements a minimal RTP header decoder and session management.
   */
  constructor(opts = {}) {
    this._port       = opts.port    || 5004;
    this._host       = opts.host    || '0.0.0.0';
    this._ssrc       = opts.ssrc    || crypto.randomBytes(4).readUInt32BE(0);
    this._socket     = null;
    this._sessions   = new Map();   // ssrc → session
    this._listeners  = [];
  }

  /**
   * Decode an RTP-MIDI packet buffer.
   * RTP Header (12 bytes): V(2)|P(1)|X(1)|CC(4)|M(1)|PT(7)|Seq(16)|TS(32)|SSRC(32)
   */
  static decodeRtpPacket(buf) {
    if (!buf || buf.length < 12) return null;
    const version = (buf[0] >>> 6) & 0x3;
    if (version !== 2) return null;

    const payloadType = buf[1] & 0x7F;
    const sequence    = (buf[2] << 8) | buf[3];
    const timestamp   = buf.readUInt32BE(4);
    const ssrc        = buf.readUInt32BE(8);

    // MIDI command section starts at byte 12
    const midiSection = buf.slice(12);
    const hasLongHeader = (midiSection[0] & 0x80) !== 0;
    const midiLen = hasLongHeader
      ? ((midiSection[0] & 0x0F) << 8) | midiSection[1]
      :   midiSection[0] & 0x0F;
    const midiOffset = hasLongHeader ? 2 : 1;
    const midiBytes  = midiSection.slice(midiOffset, midiOffset + midiLen);

    return { version, payloadType, sequence, timestamp, ssrc, midiBytes };
  }

  /**
   * Encode MIDI bytes into an RTP-MIDI packet.
   */
  encodeRtpPacket(midiBytes, sequenceNum, timestamp) {
    const header = Buffer.alloc(12);
    header[0] = 0x80;          // V=2, P=0, X=0, CC=0
    header[1] = 0x61;          // M=0, PT=97 (RTP-MIDI)
    header.writeUInt16BE(sequenceNum & 0xFFFF, 2);
    header.writeUInt32BE(timestamp >>> 0, 4);
    header.writeUInt32BE(this._ssrc, 8);

    const midiSection = Buffer.alloc(1 + midiBytes.length);
    midiSection[0] = midiBytes.length & 0x0F; // short header, B=0, Z=0, J=0
    midiBytes.copy(midiSection, 1);

    return Buffer.concat([header, midiSection]);
  }

  /**
   * Start listening for incoming RTP-MIDI packets.
   * @param {Function} onEvent - callback(parsedEvents[])
   */
  listen(onEvent) {
    const dgram = require('dgram');
    this._socket = dgram.createSocket('udp4');

    this._socket.on('message', (msg, rinfo) => {
      const packet = RtpMidiSocket.decodeRtpPacket(msg);
      if (!packet) return;

      const session = this._sessions.get(packet.ssrc) || { ssrc: packet.ssrc, seq: -1 };
      session.seq = packet.sequence;
      this._sessions.set(packet.ssrc, session);

      if (packet.midiBytes.length > 0) {
        const events = MidiParser.parse(packet.midiBytes);
        if (events.length > 0) onEvent(events, rinfo);
      }
    });

    this._socket.bind(this._port, this._host);
    return this;
  }

  close() {
    if (this._socket) { this._socket.close(); this._socket = null; }
  }

  getSessions() { return Array.from(this._sessions.values()); }
}

// ─── MidiMcpBridge (Top-level orchestrator) ───────────────────────────────────

class MidiMcpBridge {
  constructor(opts = {}) {
    this._parser     = MidiParser;
    this._translator = new MidiToMcpTranslator(opts.translatorOpts || {});
    this._gesture    = new GestureRecognizer(opts.gestureOpts || {});
    this._dispatcher = new McpDispatcher(opts.dispatcherOpts || {});
    this._rtp        = opts.enableRtp ? new RtpMidiSocket(opts.rtpOpts || {}) : null;
    this._useUmp     = opts.useUmp || false;
    this._listeners  = { event: [], gesture: [], dispatch: [] };
    this._stats      = { parsed: 0, translated: 0, dispatched: 0, errors: 0 };
  }

  /**
   * Process raw MIDI bytes from any source.
   */
  processMidiBytes(bytes) {
    try {
      const events = this._useUmp
        ? MidiParser.parseUMP(new Uint32Array(bytes.buffer))
        : MidiParser.parse(bytes);

      this._stats.parsed += events.length;
      this._emit('event', events);

      for (const event of events) {
        const gesture = this._gesture.recognize(event);
        if (gesture) this._emit('gesture', gesture);

        const toolCall = this._translator.translate(event);
        if (toolCall) {
          this._dispatcher.enqueue(toolCall);
          this._stats.translated++;
          this._stats.dispatched++;
          this._emit('dispatch', toolCall);
        }
      }
      return events;
    } catch (err) {
      this._stats.errors++;
      throw err;
    }
  }

  /**
   * Start network MIDI listener (RTP-MIDI).
   */
  startRtp() {
    if (!this._rtp) throw new Error('RTP-MIDI not enabled. Pass enableRtp:true in opts.');
    this._rtp.listen((events, rinfo) => {
      this._emit('event', events);
      for (const event of events) {
        const toolCall = this._translator.translate(event);
        if (toolCall) {
          this._dispatcher.enqueue(toolCall);
          this._emit('dispatch', toolCall);
        }
      }
    });
    return this;
  }

  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
    return this;
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      for (const fn of this._listeners[event]) fn(data);
    }
  }

  loadProfile(name) {
    this._translator.loadProfile(name);
    return this;
  }

  registerProfile(name, profile) {
    this._translator.registerProfile(name, profile);
    return this;
  }

  getStats() { return Object.assign({}, this._stats); }

  stop() {
    if (this._rtp) this._rtp.close();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  MIDI_STATUS,
  MIDI2_MESSAGE_TYPE,
  DEFAULT_CC_MAP,
  DEFAULT_NOTE_MAP,
  MidiParser,
  GestureRecognizer,
  MidiToMcpTranslator,
  McpDispatcher,
  RtpMidiSocket,
  MidiMcpBridge,
};
