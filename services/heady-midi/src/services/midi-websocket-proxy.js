/**
 * @fileoverview MIDI2 UMP WebSocket Proxy — Bridges UDP (port 5504) and
 * WebSocket clients for real-time, bidirectional MIDI 2.0 Universal MIDI
 * Packet transport. Receives UMP packets from NetworkMidiTransport via UDP,
 * broadcasts to browser clients via WebSocket, and relays browser MIDI events
 * back to hardware over UDP.
 *
 * Features:
 * - Zero-dependency WebSocket server (manual frame handling)
 * - MIDI 1.0 ↔ MIDI 2.0 UMP 32-bit word conversion
 * - Ring buffer of last 987 events (Fibonacci)
 * - φ-exponential backoff for auto-reconnect
 * - Latency measurement via timestamp ping/pong
 * - Max 55 concurrent WebSocket clients (Fibonacci)
 *
 * @module services/midi-websocket-proxy
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import {
  PHI, PSI, FIB,
  NETWORK_MIDI_PORT, WS_MIDI_PORT, MAX_WS_CLIENTS,
  EVENT_BUFFER_SIZE, BACKOFF_BASE_MS, BACKOFF_MAX_MS,
  STATUS, UMP_TYPE, UMP_STATUS, MANUFACTURER_ID,
  CHANNEL, VELOCITY,
} from '../shared/midi-constants.js';

import {
  parseSysEx, buildSysEx,
} from '../shared/sysex-codec.js';

// ─── Node.js Imports (lazy, for server-side only) ─────────────────
import { createSocket } from 'dgram';
import { createServer } from 'http';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// ─── Constants ────────────────────────────────────────────────────

/** WebSocket magic GUID per RFC 6455 */
const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-5AB5DC286688';

/** WebSocket opcodes */
const WS_OPCODE = Object.freeze({
  CONTINUATION: 0x0,
  TEXT:         0x1,
  BINARY:       0x2,
  CLOSE:        0x8,
  PING:         0x9,
  PONG:         0xA,
});

/** UMP packet size in bytes (1 word = 4 bytes for MIDI 1.0 channel voice) */
const UMP_WORD_BYTES = 4;

/** Maximum UMP packet size (128-bit = 16 bytes for MIDI 2.0 data messages) */
const UMP_MAX_BYTES = 16;

/** Ping interval for latency measurement (Fibonacci-scaled ms) */
const PING_INTERVAL_MS = FIB[13]; // 377ms

/** Connection timeout — φ-scaled from base */
const CONNECTION_TIMEOUT_MS = Math.round(FIB[11] * FIB[5] * PSI); // 89 × 8 × 0.618 ≈ 440ms

// ─── Ring Buffer ──────────────────────────────────────────────────

/**
 * Fixed-size ring buffer for storing recent MIDI events.
 * Size derived from Fibonacci sequence (987).
 *
 * @class
 * @template T
 */
export class RingBuffer {
  /**
   * @param {number} [capacity=EVENT_BUFFER_SIZE] - Buffer capacity (default: 987)
   */
  constructor(capacity = EVENT_BUFFER_SIZE) {
    /** @type {number} */
    this.capacity = capacity;

    /** @type {Array<T|null>} */
    this._buffer = new Array(capacity).fill(null);

    /** @type {number} Write head position */
    this._head = 0;

    /** @type {number} Total events written (monotonic) */
    this._count = 0;
  }

  /**
   * Push an event into the ring buffer.
   * @param {T} event - Event to store
   */
  push(event) {
    this._buffer[this._head] = event;
    this._head = (this._head + 1) % this.capacity;
    this._count++;
  }

  /**
   * Get the most recent N events in chronological order.
   * @param {number} [n] - Number of events to retrieve (default: all)
   * @returns {T[]} Array of events, oldest first
   */
  recent(n) {
    const count = Math.min(n ?? this.capacity, this._count, this.capacity);
    const result = [];
    let idx = (this._head - count + this.capacity) % this.capacity;
    for (let i = 0; i < count; i++) {
      if (this._buffer[idx] !== null) {
        result.push(this._buffer[idx]);
      }
      idx = (idx + 1) % this.capacity;
    }
    return result;
  }

  /**
   * Total number of events ever written.
   * @returns {number}
   */
  get totalCount() {
    return this._count;
  }

  /**
   * Current number of stored events (up to capacity).
   * @returns {number}
   */
  get size() {
    return Math.min(this._count, this.capacity);
  }

  /**
   * Clear the buffer.
   */
  clear() {
    this._buffer.fill(null);
    this._head = 0;
    this._count = 0;
  }
}

// ─── UMP Conversion ───────────────────────────────────────────────

/**
 * Convert a MIDI 1.0 message (1-3 bytes) to a MIDI 2.0 UMP 32-bit word.
 * Uses UMP message type 0x2 (MIDI 1.0 Channel Voice) with group 0.
 *
 * @param {number[]} midi1Bytes - MIDI 1.0 bytes [status, data1?, data2?]
 * @param {number} [group=0] - UMP group (0-15)
 * @returns {Uint8Array} 4-byte UMP word
 */
export function midi1ToUMP(midi1Bytes, group = 0) {
  const ump = new Uint8Array(UMP_WORD_BYTES);
  // Byte 0: message type (0x2 = MIDI 1.0 voice) in high nibble, group in low nibble
  ump[0] = (UMP_TYPE.MIDI1_VOICE << 4) | (group & 0x0F);
  // Bytes 1-3: original MIDI 1.0 bytes
  ump[1] = midi1Bytes[0] || 0;
  ump[2] = midi1Bytes[1] || 0;
  ump[3] = midi1Bytes[2] || 0;
  return ump;
}

/**
 * Convert a MIDI 2.0 UMP 32-bit word back to MIDI 1.0 bytes.
 * Only handles type 0x2 (MIDI 1.0 Channel Voice).
 *
 * @param {Uint8Array} ump - 4-byte UMP word
 * @returns {{ type: number, group: number, midi1: number[], valid: boolean }}
 */
export function umpToMidi1(ump) {
  if (!ump || ump.length < UMP_WORD_BYTES) {
    return { type: 0, group: 0, midi1: [], valid: false };
  }

  const msgType = (ump[0] >> 4) & 0x0F;
  const group = ump[0] & 0x0F;

  if (msgType !== UMP_TYPE.MIDI1_VOICE) {
    return { type: msgType, group, midi1: [], valid: false };
  }

  const statusByte = ump[1];
  const msgKind = statusByte & 0xF0;
  const channel = statusByte & 0x0F;

  // Determine byte count from status
  let byteCount = 3;
  if (msgKind === STATUS.PROGRAM_CHANGE || msgKind === STATUS.CHANNEL_PRESSURE) {
    byteCount = 2;
  }

  const midi1 = [ump[1]];
  if (byteCount >= 2) midi1.push(ump[2]);
  if (byteCount >= 3) midi1.push(ump[3]);

  return { type: msgType, group, midi1, valid: true };
}

/**
 * Convert MIDI 1.0 bytes to a MIDI 2.0 UMP Channel Voice (type 0x4) 64-bit message.
 * Provides full 16-bit velocity and 32-bit controller resolution.
 *
 * @param {number[]} midi1Bytes - MIDI 1.0 bytes [status, data1, data2]
 * @param {number} [group=0] - UMP group (0-15)
 * @returns {Uint8Array} 8-byte UMP packet (64-bit)
 */
export function midi1ToUMP2(midi1Bytes, group = 0) {
  const ump = new Uint8Array(8);
  const statusByte = midi1Bytes[0] || 0;
  const msgKind = statusByte & 0xF0;
  const channel = statusByte & 0x0F;

  // Byte 0: message type 0x4 (MIDI 2.0 voice), group
  ump[0] = (UMP_TYPE.MIDI2_VOICE << 4) | (group & 0x0F);
  // Byte 1: status (preserving channel)
  ump[1] = statusByte;
  // Byte 2: note number / CC number
  ump[2] = midi1Bytes[1] || 0;

  // Byte 3: attribute type (0 = none)
  ump[3] = 0;

  // Bytes 4-7: 32-bit value (upscale 7-bit to 16/32-bit)
  const data2 = midi1Bytes[2] || 0;
  if (msgKind === STATUS.NOTE_ON || msgKind === STATUS.NOTE_OFF) {
    // 16-bit velocity in bytes 4-5 (upscale: v << 9 | v << 2 | v >> 5)
    const vel16 = data2 > 0 ? (data2 << 9) | (data2 << 2) | (data2 >> 5) : 0;
    ump[4] = (vel16 >> 8) & 0xFF;
    ump[5] = vel16 & 0xFF;
    ump[6] = 0;
    ump[7] = 0;
  } else if (msgKind === STATUS.CC) {
    // 32-bit CC value (upscale 7-bit)
    const cc32 = (data2 << 25) | (data2 << 18) | (data2 << 11) | (data2 << 4) | (data2 >> 3);
    ump[4] = (cc32 >> 24) & 0xFF;
    ump[5] = (cc32 >> 16) & 0xFF;
    ump[6] = (cc32 >> 8) & 0xFF;
    ump[7] = cc32 & 0xFF;
  } else {
    // Pitch bend, pressure, etc. — simple upscale
    const val16 = (data2 << 9) | (data2 << 2);
    ump[4] = (val16 >> 8) & 0xFF;
    ump[5] = val16 & 0xFF;
    ump[6] = 0;
    ump[7] = 0;
  }

  return ump;
}

// ─── WebSocket Frame Helpers ──────────────────────────────────────

/**
 * Build a WebSocket frame for binary data (opcode 0x2).
 * @param {Uint8Array} payload - Binary payload
 * @param {number} [opcode=WS_OPCODE.BINARY] - WebSocket opcode
 * @returns {Buffer} Complete WebSocket frame
 */
function buildWSFrame(payload, opcode = WS_OPCODE.BINARY) {
  const len = payload.length;
  let headerLen;
  if (len < 126) {
    headerLen = 2;
  } else if (len < 65536) {
    headerLen = 4;
  } else {
    headerLen = 10;
  }

  const frame = Buffer.alloc(headerLen + len);
  frame[0] = 0x80 | opcode; // FIN + opcode

  if (len < 126) {
    frame[1] = len;
  } else if (len < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(len, 2);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(len), 2);
  }

  payload.copy ? payload.copy(frame, headerLen) : frame.set(payload, headerLen);
  return frame;
}

/**
 * Parse a WebSocket frame from a client (masked per RFC 6455).
 * @param {Buffer} data - Raw data from socket
 * @returns {{ opcode: number, payload: Buffer, valid: boolean }}
 */
function parseWSFrame(data) {
  if (data.length < 2) return { opcode: 0, payload: Buffer.alloc(0), valid: false };

  const opcode = data[0] & 0x0F;
  const masked = (data[1] & 0x80) !== 0;
  let payloadLen = data[1] & 0x7F;
  let offset = 2;

  if (payloadLen === 126) {
    if (data.length < 4) return { opcode, payload: Buffer.alloc(0), valid: false };
    payloadLen = data.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (data.length < 10) return { opcode, payload: Buffer.alloc(0), valid: false };
    payloadLen = Number(data.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey = null;
  if (masked) {
    if (data.length < offset + 4) return { opcode, payload: Buffer.alloc(0), valid: false };
    maskKey = data.slice(offset, offset + 4);
    offset += 4;
  }

  if (data.length < offset + payloadLen) {
    return { opcode, payload: Buffer.alloc(0), valid: false };
  }

  const payload = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    payload[i] = masked
      ? data[offset + i] ^ maskKey[i % 4]
      : data[offset + i];
  }

  return { opcode, payload, valid: true };
}

// ─── WebSocket Client Wrapper ─────────────────────────────────────

/**
 * Represents a single connected WebSocket client with latency tracking.
 * @class
 */
class WSClient {
  /**
   * @param {import('net').Socket} socket - TCP socket
   * @param {string} id - Unique client ID
   */
  constructor(socket, id) {
    /** @type {import('net').Socket} */
    this.socket = socket;

    /** @type {string} */
    this.id = id;

    /** @type {number} Connection timestamp */
    this.connectedAt = Date.now();

    /** @type {number} Last measured round-trip latency (ms) */
    this.latencyMs = 0;

    /** @type {number} Last ping timestamp for latency calculation */
    this._lastPingTs = 0;

    /** @type {boolean} Whether the client is alive (responded to last ping) */
    this.alive = true;
  }

  /**
   * Send binary data to this client.
   * @param {Uint8Array|Buffer} data - Data to send
   */
  sendBinary(data) {
    if (this.socket.writable) {
      const frame = buildWSFrame(data instanceof Buffer ? data : Buffer.from(data));
      this.socket.write(frame);
    }
  }

  /**
   * Send a text message to this client.
   * @param {string} text - Text to send
   */
  sendText(text) {
    if (this.socket.writable) {
      const frame = buildWSFrame(Buffer.from(text, 'utf-8'), WS_OPCODE.TEXT);
      this.socket.write(frame);
    }
  }

  /**
   * Send a WebSocket ping for latency measurement.
   */
  ping() {
    if (this.socket.writable) {
      this._lastPingTs = Date.now();
      const tsBytes = Buffer.alloc(8);
      tsBytes.writeBigUInt64BE(BigInt(this._lastPingTs));
      const frame = buildWSFrame(tsBytes, WS_OPCODE.PING);
      this.socket.write(frame);
      this.alive = false; // Will be set true on pong
    }
  }

  /**
   * Handle a pong response and calculate latency.
   */
  onPong() {
    this.alive = true;
    if (this._lastPingTs > 0) {
      this.latencyMs = Date.now() - this._lastPingTs;
    }
  }

  /**
   * Send a WebSocket close frame.
   * @param {number} [code=1000] - Close status code
   */
  close(code = 1000) {
    if (this.socket.writable) {
      const payload = Buffer.alloc(2);
      payload.writeUInt16BE(code);
      const frame = buildWSFrame(payload, WS_OPCODE.CLOSE);
      this.socket.write(frame);
    }
    this.socket.end();
  }
}

// ─── Main Proxy Class ─────────────────────────────────────────────

/**
 * MidiWebSocketProxy — Bridges UDP MIDI 2.0 UMP traffic with browser
 * WebSocket clients. Receives UMP packets on UDP port 5504, broadcasts
 * to all connected WS clients, and relays browser MIDI back to hardware.
 *
 * @class
 * @extends EventEmitter
 *
 * @fires MidiWebSocketProxy#ump_received - When a UMP packet arrives from UDP
 * @fires MidiWebSocketProxy#ws_message - When a WS client sends MIDI data
 * @fires MidiWebSocketProxy#client_connected - When a new WS client connects
 * @fires MidiWebSocketProxy#client_disconnected - When a WS client disconnects
 *
 * @example
 * const proxy = new MidiWebSocketProxy({ wsPort: 8089, udpPort: 5504 });
 * proxy.start();
 * proxy.on('ump_received', (packet) => console.log('UMP:', packet));
 */
export class MidiWebSocketProxy extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.wsPort=WS_MIDI_PORT] - WebSocket server port
   * @param {number} [options.udpPort=NETWORK_MIDI_PORT] - UDP listener port
   * @param {string} [options.udpHost='0.0.0.0'] - UDP bind address
   * @param {number} [options.maxClients=MAX_WS_CLIENTS] - Max WebSocket clients
   * @param {number} [options.bufferSize=EVENT_BUFFER_SIZE] - Ring buffer size
   * @param {Function} [options.log=console.log] - Logging function
   */
  constructor(options = {}) {
    super();

    /** @type {number} */
    this.wsPort = options.wsPort ?? WS_MIDI_PORT;

    /** @type {number} */
    this.udpPort = options.udpPort ?? NETWORK_MIDI_PORT;

    /** @type {string} */
    this.udpHost = options.udpHost ?? '0.0.0.0';

    /** @type {number} */
    this.maxClients = options.maxClients ?? MAX_WS_CLIENTS;

    /** @type {Function} */
    this._log = options.log ?? console.log;

    /** @type {Map<string, WSClient>} Connected WebSocket clients */
    this._clients = new Map();

    /** @type {RingBuffer} Event ring buffer */
    this._eventBuffer = new RingBuffer(options.bufferSize ?? EVENT_BUFFER_SIZE);

    /** @type {import('dgram').Socket|null} */
    this._udpSocket = null;

    /** @type {import('http').Server|null} */
    this._httpServer = null;

    /** @type {NodeJS.Timeout|null} Ping interval handle */
    this._pingInterval = null;

    /** @type {number} Client ID counter */
    this._clientIdSeq = 0;

    /** @type {string|null} Remote UDP target for relaying browser MIDI to hardware */
    this._udpRemoteHost = null;

    /** @type {number|null} Remote UDP target port */
    this._udpRemotePort = null;

    /** @type {boolean} Server running state */
    this._running = false;

    /** @type {number} Reconnect attempt counter */
    this._reconnectAttempt = 0;

    /** @type {NodeJS.Timeout|null} Reconnect timer handle */
    this._reconnectTimer = null;
  }

  /**
   * Start the proxy: bind UDP socket and start HTTP/WebSocket server.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;

    this._log(`[MidiWSProxy] Starting — UDP:${this.udpPort} WS:${this.wsPort} Max clients:${this.maxClients}`);

    // Start UDP listener
    this._startUDP();

    // Start HTTP server for WebSocket upgrades
    await this._startHTTP();

    // Start ping interval
    this._pingInterval = setInterval(() => this._pingAllClients(), PING_INTERVAL_MS);

    this._running = true;
    this._reconnectAttempt = 0;
    this._log('[MidiWSProxy] Running');
  }

  /**
   * Stop the proxy and close all connections.
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;

    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Close all WS clients
    for (const client of this._clients.values()) {
      client.close(1001); // Going Away
    }
    this._clients.clear();

    // Close UDP
    if (this._udpSocket) {
      this._udpSocket.close();
      this._udpSocket = null;
    }

    // Close HTTP
    if (this._httpServer) {
      await new Promise((resolve) => this._httpServer.close(resolve));
      this._httpServer = null;
    }

    this._log('[MidiWSProxy] Stopped');
  }

  /**
   * Bind the UDP socket for receiving UMP packets from NetworkMidiTransport.
   * @private
   */
  _startUDP() {
    this._udpSocket = createSocket('udp4');

    this._udpSocket.on('message', (msg, rinfo) => {
      // Remember the remote endpoint for bidirectional relay
      if (!this._udpRemoteHost) {
        this._udpRemoteHost = rinfo.address;
        this._udpRemotePort = rinfo.port;
        this._log(`[UDP] Remote endpoint: ${rinfo.address}:${rinfo.port}`);
      }

      this._handleUDPPacket(msg, rinfo);
    });

    this._udpSocket.on('error', (err) => {
      this._log(`[UDP] Error: ${err.message}`);
      this._scheduleReconnect();
    });

    this._udpSocket.bind(this.udpPort, this.udpHost, () => {
      this._log(`[UDP] Bound to ${this.udpHost}:${this.udpPort}`);
    });
  }

  /**
   * Start the HTTP server that handles WebSocket upgrades.
   * @returns {Promise<void>}
   * @private
   */
  _startHTTP() {
    return new Promise((resolve, reject) => {
      this._httpServer = createServer((req, res) => {
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('WebSocket upgrade required');
      });

      this._httpServer.on('upgrade', (req, socket, head) => {
        this._handleUpgrade(req, socket, head);
      });

      this._httpServer.on('error', (err) => {
        this._log(`[HTTP] Error: ${err.message}`);
        reject(err);
      });

      this._httpServer.listen(this.wsPort, () => {
        this._log(`[WS] Listening on port ${this.wsPort}`);
        resolve();
      });
    });
  }

  /**
   * Handle an HTTP Upgrade request to establish a WebSocket connection.
   * Performs the RFC 6455 handshake manually (zero dependency).
   * @param {import('http').IncomingMessage} req - HTTP request
   * @param {import('net').Socket} socket - TCP socket
   * @param {Buffer} head - Leading upgrade buffer
   * @private
   */
  _handleUpgrade(req, socket, head) {
    // Enforce max client limit
    if (this._clients.size >= this.maxClients) {
      this._log(`[WS] Rejecting connection — max clients reached (${this.maxClients})`);
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // RFC 6455 accept key
    const acceptKey = createHash('sha1')
      .update(wsKey + WS_MAGIC_GUID)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      'Sec-WebSocket-Protocol: midi2-ump',
      '',
      '',
    ].join('\r\n');

    socket.write(responseHeaders);

    // Register client
    const clientId = `ws-${++this._clientIdSeq}-${Date.now().toString(36)}`;
    const client = new WSClient(socket, clientId);
    this._clients.set(clientId, client);

    this._log(`[WS] Client connected: ${clientId} (${this._clients.size}/${this.maxClients})`);
    this.emit('client_connected', { id: clientId, total: this._clients.size });

    // Send buffered events as a welcome burst
    this._sendBufferedEvents(client);

    // Handle incoming frames
    socket.on('data', (data) => this._handleWSData(client, data));

    socket.on('close', () => {
      this._clients.delete(clientId);
      this._log(`[WS] Client disconnected: ${clientId} (${this._clients.size}/${this.maxClients})`);
      this.emit('client_disconnected', { id: clientId, total: this._clients.size });
    });

    socket.on('error', (err) => {
      this._log(`[WS] Socket error (${clientId}): ${err.message}`);
      this._clients.delete(clientId);
    });
  }

  /**
   * Handle incoming WebSocket frame data from a client.
   * @param {WSClient} client - Source client
   * @param {Buffer} data - Raw frame data
   * @private
   */
  _handleWSData(client, data) {
    const { opcode, payload, valid } = parseWSFrame(data);
    if (!valid) return;

    switch (opcode) {
      case WS_OPCODE.BINARY:
        this._handleWSBinary(client, payload);
        break;
      case WS_OPCODE.TEXT:
        this._handleWSText(client, payload.toString('utf-8'));
        break;
      case WS_OPCODE.PING:
        // Respond with pong
        client.socket.write(buildWSFrame(payload, WS_OPCODE.PONG));
        break;
      case WS_OPCODE.PONG:
        client.onPong();
        break;
      case WS_OPCODE.CLOSE:
        client.close();
        break;
      default:
        break;
    }
  }

  /**
   * Handle a binary WebSocket message (MIDI data from browser).
   * Converts to UMP if needed and relays to UDP hardware endpoint.
   * @param {WSClient} client - Source client
   * @param {Buffer} payload - Binary MIDI data
   * @private
   */
  _handleWSBinary(client, payload) {
    let umpPacket;

    if (payload.length <= 3) {
      // Raw MIDI 1.0 bytes → convert to UMP
      umpPacket = midi1ToUMP(Array.from(payload));
    } else if (payload.length === UMP_WORD_BYTES || payload.length === 8 || payload.length === UMP_MAX_BYTES) {
      // Already UMP format
      umpPacket = new Uint8Array(payload);
    } else {
      // Assume raw MIDI 1.0 for other sizes
      umpPacket = midi1ToUMP(Array.from(payload.slice(0, 3)));
    }

    // Store in ring buffer
    this._eventBuffer.push({
      timestamp: Date.now(),
      source: client.id,
      direction: 'ws→udp',
      data: Array.from(umpPacket),
    });

    // Relay to UDP hardware endpoint
    this._relayToUDP(umpPacket);

    this.emit('ws_message', { clientId: client.id, data: umpPacket });
  }

  /**
   * Handle a text WebSocket message (control commands, latency probes).
   * @param {WSClient} client - Source client
   * @param {string} text - Text message
   * @private
   */
  _handleWSText(client, text) {
    try {
      const msg = JSON.parse(text);

      switch (msg.type) {
        case 'ping': {
          // Latency measurement: respond with timestamp
          client.sendText(JSON.stringify({
            type: 'pong',
            clientTs: msg.timestamp,
            serverTs: Date.now(),
          }));
          break;
        }
        case 'subscribe': {
          this._log(`[WS] Client ${client.id} subscribed to: ${msg.channels?.join(', ')}`);
          break;
        }
        case 'buffer_request': {
          // Client requests buffered events
          const count = Math.min(msg.count || FIB[8], EVENT_BUFFER_SIZE); // Default 34, max 987
          this._sendBufferedEvents(client, count);
          break;
        }
        case 'stats': {
          client.sendText(JSON.stringify({
            type: 'stats',
            clients: this._clients.size,
            maxClients: this.maxClients,
            bufferSize: this._eventBuffer.size,
            bufferCapacity: this._eventBuffer.capacity,
            totalEvents: this._eventBuffer.totalCount,
            uptime: Date.now() - (this._httpServer?._startTime || Date.now()),
          }));
          break;
        }
        default:
          this._log(`[WS] Unknown text message type: ${msg.type}`);
      }
    } catch {
      this._log(`[WS] Invalid text message from ${client.id}`);
    }
  }

  /**
   * Handle an incoming UDP packet containing UMP data.
   * Stores in ring buffer and broadcasts to all WS clients.
   * @param {Buffer} msg - UDP message
   * @param {import('dgram').RemoteInfo} rinfo - Remote info
   * @private
   */
  _handleUDPPacket(msg, rinfo) {
    const packet = new Uint8Array(msg);

    // Validate minimum UMP size
    if (packet.length < UMP_WORD_BYTES) return;

    // Store in ring buffer
    const event = {
      timestamp: Date.now(),
      source: `${rinfo.address}:${rinfo.port}`,
      direction: 'udp→ws',
      data: Array.from(packet),
    };
    this._eventBuffer.push(event);

    // Broadcast to all connected WS clients
    this._broadcastBinary(packet);

    this.emit('ump_received', { data: packet, rinfo });
  }

  /**
   * Relay a UMP packet to the hardware endpoint via UDP.
   * @param {Uint8Array} umpPacket - UMP data to send
   * @private
   */
  _relayToUDP(umpPacket) {
    if (!this._udpSocket || !this._udpRemoteHost || !this._udpRemotePort) return;

    const buf = Buffer.from(umpPacket);
    this._udpSocket.send(buf, 0, buf.length, this._udpRemotePort, this._udpRemoteHost, (err) => {
      if (err) {
        this._log(`[UDP] Send error: ${err.message}`);
      }
    });
  }

  /**
   * Broadcast binary data to all connected WebSocket clients.
   * @param {Uint8Array} data - Binary data
   * @private
   */
  _broadcastBinary(data) {
    const frame = buildWSFrame(data instanceof Buffer ? data : Buffer.from(data));
    for (const client of this._clients.values()) {
      if (client.socket.writable) {
        client.socket.write(frame);
      }
    }
  }

  /**
   * Send buffered events to a newly connected client.
   * @param {WSClient} client - Target client
   * @param {number} [count] - Number of events to send
   * @private
   */
  _sendBufferedEvents(client, count) {
    const events = this._eventBuffer.recent(count);
    if (events.length === 0) return;

    client.sendText(JSON.stringify({
      type: 'buffer_replay',
      count: events.length,
      events: events.map(e => ({
        timestamp: e.timestamp,
        direction: e.direction,
        data: e.data,
      })),
    }));

    this._log(`[WS] Sent ${events.length} buffered events to ${client.id}`);
  }

  /**
   * Ping all connected clients for latency measurement.
   * Disconnects clients that didn't respond to the last ping.
   * @private
   */
  _pingAllClients() {
    for (const [id, client] of this._clients) {
      if (!client.alive) {
        this._log(`[WS] Client ${id} timed out — disconnecting`);
        client.close(1001);
        this._clients.delete(id);
        this.emit('client_disconnected', { id, total: this._clients.size, reason: 'timeout' });
        continue;
      }
      client.ping();
    }
  }

  /**
   * Schedule a reconnect attempt with φ-exponential backoff.
   * Delay = BACKOFF_BASE_MS × PHI^attempt, capped at BACKOFF_MAX_MS.
   * @private
   */
  _scheduleReconnect() {
    if (!this._running || this._reconnectTimer) return;

    const delay = Math.min(
      BACKOFF_MAX_MS,
      Math.round(BACKOFF_BASE_MS * Math.pow(PHI, this._reconnectAttempt))
    );
    this._reconnectAttempt++;

    this._log(`[Reconnect] Attempt ${this._reconnectAttempt} in ${delay}ms (φ-backoff)`);

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      try {
        this._startUDP();
        this._reconnectAttempt = 0;
        this._log('[Reconnect] UDP restored');
      } catch (err) {
        this._log(`[Reconnect] Failed: ${err.message}`);
        this._scheduleReconnect();
      }
    }, delay);
  }

  // ─── Public Accessors ───────────────────────────────────────────

  /**
   * Get the number of connected WebSocket clients.
   * @returns {number}
   */
  get clientCount() {
    return this._clients.size;
  }

  /**
   * Get latency statistics for all connected clients.
   * @returns {{ id: string, latencyMs: number, connectedAt: number }[]}
   */
  get clientStats() {
    return Array.from(this._clients.values()).map(c => ({
      id: c.id,
      latencyMs: c.latencyMs,
      connectedAt: c.connectedAt,
    }));
  }

  /**
   * Get the event ring buffer instance.
   * @returns {RingBuffer}
   */
  get eventBuffer() {
    return this._eventBuffer;
  }

  /**
   * Whether the proxy is currently running.
   * @returns {boolean}
   */
  get running() {
    return this._running;
  }
}

// ─── Default Export / CLI ─────────────────────────────────────────

/**
 * Create and start a MidiWebSocketProxy with default settings.
 * @param {Object} [options] - Override options
 * @returns {Promise<MidiWebSocketProxy>}
 */
export async function createProxy(options = {}) {
  const proxy = new MidiWebSocketProxy(options);
  await proxy.start();
  return proxy;
}
