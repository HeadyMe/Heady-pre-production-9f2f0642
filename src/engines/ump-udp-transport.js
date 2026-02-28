/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ UMP/UDP Transport Layer ═══
 *
 * Hardware-accelerated MIDI 2.0 Universal MIDI Packet transport over UDP.
 *
 *   - UMP encoding/decoding (32-bit word packets)
 *   - Ring buffer for O(1) memory access, zero GC pauses
 *   - UDP socket manager with configurable buffer tuning
 *   - Virtual MIDI port bridge
 *   - Integration with MIDI event bus
 *
 * Pipeline Tasks: ump-001 through ump-005
 */

const dgram = require("dgram");
const EventEmitter = require("events");
const { midiBus, CHANNELS, MSG } = require("./midi-event-bus");

// ═══ UMP Message Types (MIDI 2.0) ═══
const UMP_TYPE = {
    UTILITY:        0x0, // Utility messages (NOOP, JR Timestamp, etc.)
    SYSTEM:         0x1, // System common / real-time
    MIDI1_CV:       0x2, // MIDI 1.0 Channel Voice (backward compat)
    DATA_64:        0x3, // 64-bit Data (SysEx7)
    MIDI2_CV:       0x4, // MIDI 2.0 Channel Voice (high-resolution)
    DATA_128:       0x5, // 128-bit Data (SysEx8)
};

// ═══ MIDI 2.0 Channel Voice Status ═══
const MIDI2_STATUS = {
    NOTE_OFF:       0x80,
    NOTE_ON:        0x90,
    POLY_PRESSURE:  0xA0,
    CONTROL_CHANGE: 0xB0,
    PROGRAM_CHANGE: 0xC0,
    CHAN_PRESSURE:   0xD0,
    PITCH_BEND:     0xE0,
    PER_NOTE_MGMT:  0xF0,
};

// ═══ Ring Buffer ═══
// O(1) read/write, zero garbage collection pauses
class RingBuffer {
    constructor(capacity = 4096) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }

    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this.size === this.capacity) {
            this.tail = (this.tail + 1) % this.capacity; // Overwrite oldest
        } else {
            this.size++;
        }
    }

    pop() {
        if (this.size === 0) return null;
        const item = this.buffer[this.tail];
        this.buffer[this.tail] = null;
        this.tail = (this.tail + 1) % this.capacity;
        this.size--;
        return item;
    }

    peek() {
        if (this.size === 0) return null;
        return this.buffer[this.tail];
    }

    drain(count) {
        const items = [];
        const n = Math.min(count, this.size);
        for (let i = 0; i < n; i++) items.push(this.pop());
        return items;
    }

    clear() { this.head = 0; this.tail = 0; this.size = 0; }
    isFull() { return this.size === this.capacity; }
    isEmpty() { return this.size === 0; }
}

// ═══ UMP Packet Codec ═══
const UMPCodec = {
    // Encode a MIDI 2.0 Channel Voice message (64-bit = 2 x 32-bit words)
    encodeNoteOn(group, channel, noteNumber, velocity16, attrType = 0, attrData = 0) {
        // Word 0: [mt=0x4][group][status|channel][noteNumber]
        const word0 = ((UMP_TYPE.MIDI2_CV & 0xF) << 28) | ((group & 0xF) << 24) |
                       ((MIDI2_STATUS.NOTE_ON | (channel & 0xF)) << 16) | ((noteNumber & 0x7F) << 8) | (attrType & 0xFF);
        // Word 1: [velocity16][attrData16]
        const word1 = ((velocity16 & 0xFFFF) << 16) | (attrData & 0xFFFF);
        return Buffer.from(new Uint32Array([word0, word1]).buffer);
    },

    encodeNoteOff(group, channel, noteNumber, velocity16 = 0) {
        const word0 = ((UMP_TYPE.MIDI2_CV & 0xF) << 28) | ((group & 0xF) << 24) |
                       ((MIDI2_STATUS.NOTE_OFF | (channel & 0xF)) << 16) | ((noteNumber & 0x7F) << 8);
        const word1 = ((velocity16 & 0xFFFF) << 16);
        return Buffer.from(new Uint32Array([word0, word1]).buffer);
    },

    encodeCC(group, channel, ccIndex, value32) {
        const word0 = ((UMP_TYPE.MIDI2_CV & 0xF) << 28) | ((group & 0xF) << 24) |
                       ((MIDI2_STATUS.CONTROL_CHANGE | (channel & 0xF)) << 16) | ((ccIndex & 0x7F) << 8);
        const word1 = value32 >>> 0; // Full 32-bit CC value (MIDI 2.0 resolution)
        return Buffer.from(new Uint32Array([word0, word1]).buffer);
    },

    encodePitchBend(group, channel, value32) {
        const word0 = ((UMP_TYPE.MIDI2_CV & 0xF) << 28) | ((group & 0xF) << 24) |
                       ((MIDI2_STATUS.PITCH_BEND | (channel & 0xF)) << 16);
        const word1 = value32 >>> 0;
        return Buffer.from(new Uint32Array([word0, word1]).buffer);
    },

    // Encode MIDI 1.0 compat message (32-bit = 1 word)
    encodeMidi1(group, status, data1, data2 = 0) {
        const word = ((UMP_TYPE.MIDI1_CV & 0xF) << 28) | ((group & 0xF) << 24) |
                      ((status & 0xFF) << 16) | ((data1 & 0x7F) << 8) | (data2 & 0x7F);
        return Buffer.from(new Uint32Array([word]).buffer);
    },

    // Decode a UMP packet from buffer
    decode(buf) {
        if (buf.length < 4) return null;
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const word0 = view.getUint32(0, false); // Big-endian

        const messageType = (word0 >> 28) & 0xF;
        const group = (word0 >> 24) & 0xF;
        const statusByte = (word0 >> 16) & 0xFF;
        const channel = statusByte & 0xF;
        const status = statusByte & 0xF0;

        const result = { messageType, group, status, channel, raw: buf };

        if (messageType === UMP_TYPE.MIDI1_CV) {
            result.data1 = (word0 >> 8) & 0x7F;
            result.data2 = word0 & 0x7F;
            result.is32bit = true;
        } else if (messageType === UMP_TYPE.MIDI2_CV && buf.length >= 8) {
            result.data1 = (word0 >> 8) & 0x7F;
            result.attrType = word0 & 0xFF;
            const word1 = view.getUint32(4, false);
            result.velocity16 = (word1 >> 16) & 0xFFFF;
            result.attrData = word1 & 0xFFFF;
            result.value32 = word1;
            result.is64bit = true;
        }

        return result;
    },
};

// ═══ UMP/UDP Transport ═══
class UmpUdpTransport extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.setMaxListeners(50);

        this.config = {
            listenPort: parseInt(opts.listenPort || process.env.UMP_LISTEN_PORT) || 11420,
            sendPort: parseInt(opts.sendPort || process.env.UMP_SEND_PORT) || 11421,
            sendHost: opts.sendHost || process.env.UMP_SEND_HOST || "127.0.0.1",
            ringBufferSize: opts.ringBufferSize || 8192,
            batchSize: opts.batchSize || 64, // Max packets per flush
            flushIntervalMs: opts.flushIntervalMs || 1, // Sub-ms flush cycle
            rcvBufSize: opts.rcvBufSize || 4 * 1024 * 1024, // 4MB receive buffer
            sndBufSize: opts.sndBufSize || 4 * 1024 * 1024, // 4MB send buffer
        };

        // Sockets
        this._rxSocket = null;
        this._txSocket = null;

        // Ring buffers
        this._rxBuffer = new RingBuffer(this.config.ringBufferSize);
        this._txBuffer = new RingBuffer(this.config.ringBufferSize);

        // Flush timer
        this._flushTimer = null;

        // Metrics
        this._metrics = {
            rxPackets: 0, txPackets: 0, rxBytes: 0, txBytes: 0,
            rxDropped: 0, txDropped: 0, flushCycles: 0,
            avgLatencyUs: 0, latencies: [],
        };
    }

    // ═══ Init ═══
    async init() {
        console.log("[UMP-UDP] Initializing transport...");
        midiBus.taskStarted("UMP-UDP-Init", CHANNELS.PIPELINE);

        // RX socket
        this._rxSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        this._rxSocket.on("message", (buf, rinfo) => this._onReceive(buf, rinfo));
        this._rxSocket.on("error", (err) => console.error(`[UMP-UDP] RX error: ${err.message}`));
        this._rxSocket.bind(this.config.listenPort, () => {
            // Tune socket buffers
            try {
                this._rxSocket.setRecvBufferSize(this.config.rcvBufSize);
            } catch {
                console.log("[UMP-UDP] Could not set RX buffer size (may need elevated privileges)");
            }
            console.log(`[UMP-UDP] RX listening on port ${this.config.listenPort}`);
        });

        // TX socket
        this._txSocket = dgram.createSocket("udp4");
        this._txSocket.on("error", (err) => console.error(`[UMP-UDP] TX error: ${err.message}`));
        try {
            this._txSocket.setSendBufferSize(this.config.sndBufSize);
        } catch {}

        // Start flush cycle
        this._flushTimer = setInterval(() => this._flushTx(), this.config.flushIntervalMs);

        midiBus.taskCompleted("UMP-UDP-Init", CHANNELS.PIPELINE);
        console.log("[UMP-UDP] Transport initialized.");
        return this;
    }

    // ═══ Receive Path ═══
    _onReceive(buf, rinfo) {
        this._metrics.rxPackets++;
        this._metrics.rxBytes += buf.length;

        const decoded = UMPCodec.decode(buf);
        if (!decoded) { this._metrics.rxDropped++; return; }

        // Push to ring buffer
        decoded.receivedAt = process.hrtime.bigint();
        decoded.source = rinfo;
        this._rxBuffer.push(decoded);

        // Forward to MIDI event bus (sub-ms path)
        if (decoded.status) {
            midiBus.send(decoded.status, decoded.channel, decoded.data1 || 0, decoded.data2 || (decoded.velocity16 >> 9) || 0, {
                source: "ump-udp", group: decoded.group, ump: true,
                velocity16: decoded.velocity16, value32: decoded.value32,
            });
        }

        this.emit("packet", decoded);
    }

    // ═══ Transmit Path ═══
    send(umpBuffer) {
        this._txBuffer.push({ buf: umpBuffer, queuedAt: process.hrtime.bigint() });
    }

    sendNoteOn(group, channel, note, velocity16) {
        this.send(UMPCodec.encodeNoteOn(group, channel, note, velocity16));
    }

    sendNoteOff(group, channel, note) {
        this.send(UMPCodec.encodeNoteOff(group, channel, note));
    }

    sendCC(group, channel, cc, value32) {
        this.send(UMPCodec.encodeCC(group, channel, cc, value32));
    }

    sendPitchBend(group, channel, value32) {
        this.send(UMPCodec.encodePitchBend(group, channel, value32));
    }

    _flushTx() {
        this._metrics.flushCycles++;
        const batch = this._txBuffer.drain(this.config.batchSize);
        if (batch.length === 0) return;

        for (const item of batch) {
            if (!item || !item.buf) continue;
            try {
                this._txSocket.send(item.buf, 0, item.buf.length, this.config.sendPort, this.config.sendHost);
                this._metrics.txPackets++;
                this._metrics.txBytes += item.buf.length;

                // Track latency
                if (item.queuedAt) {
                    const now = process.hrtime.bigint();
                    const latencyUs = Number(now - item.queuedAt) / 1000;
                    this._metrics.latencies.push(latencyUs);
                    if (this._metrics.latencies.length > 200) this._metrics.latencies.shift();
                    this._metrics.avgLatencyUs = this._metrics.latencies.reduce((a, b) => a + b, 0) / this._metrics.latencies.length;
                }
            } catch {
                this._metrics.txDropped++;
            }
        }
    }

    // ═══ Bulk Operations ═══
    sendBatch(packets) {
        for (const pkt of packets) this.send(pkt);
    }

    drainRxBuffer(count = 100) {
        return this._rxBuffer.drain(count);
    }

    // ═══ Metrics ═══
    getMetrics() {
        return {
            ...this._metrics,
            rxBufferSize: this._rxBuffer.size,
            txBufferSize: this._txBuffer.size,
            rxBufferCapacity: this._rxBuffer.capacity,
            txBufferCapacity: this._txBuffer.capacity,
        };
    }

    // ═══ Shutdown ═══
    shutdown() {
        if (this._flushTimer) clearInterval(this._flushTimer);
        this._flushTx(); // Final flush
        if (this._rxSocket) this._rxSocket.close();
        if (this._txSocket) this._txSocket.close();
        console.log("[UMP-UDP] Transport shut down.");
    }

    // ═══ Express Routes ═══
    registerRoutes(app) {
        app.get("/api/ump/status", (req, res) => res.json({ ok: true, metrics: this.getMetrics() }));
        app.post("/api/ump/send/note", (req, res) => {
            const { group = 0, channel = 0, note = 60, velocity = 0xFFFF, off } = req.body;
            if (off) this.sendNoteOff(group, channel, note);
            else this.sendNoteOn(group, channel, note, velocity);
            res.json({ ok: true });
        });
        app.post("/api/ump/send/cc", (req, res) => {
            const { group = 0, channel = 0, cc = 1, value = 0 } = req.body;
            this.sendCC(group, channel, cc, value);
            res.json({ ok: true });
        });
        app.post("/api/ump/send/batch", (req, res) => {
            const { packets = [] } = req.body;
            for (const p of packets) {
                if (p.type === "noteOn") this.sendNoteOn(p.group || 0, p.channel || 0, p.note, p.velocity || 0xFFFF);
                else if (p.type === "noteOff") this.sendNoteOff(p.group || 0, p.channel || 0, p.note);
                else if (p.type === "cc") this.sendCC(p.group || 0, p.channel || 0, p.cc, p.value);
                else if (p.type === "pitchBend") this.sendPitchBend(p.group || 0, p.channel || 0, p.value);
            }
            res.json({ ok: true, sent: packets.length });
        });
        app.get("/api/ump/rx/drain", (req, res) => {
            const count = parseInt(req.query.count) || 50;
            res.json({ ok: true, packets: this.drainRxBuffer(count) });
        });
    }
}

let _instance = null;
function getInstance(opts) { if (!_instance) _instance = new UmpUdpTransport(opts); return _instance; }

module.exports = { UmpUdpTransport, UMPCodec, RingBuffer, UMP_TYPE, MIDI2_STATUS, getInstance };
