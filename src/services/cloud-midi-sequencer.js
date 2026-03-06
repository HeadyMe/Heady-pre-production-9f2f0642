/**
 * Heady Cloud-Native MIDI Sequencer — Master Clock
 *
 * Headless cloud sequencer synchronizing tempo + user patterns as MIDI to
 * distributed browser-based DAW timelines. Central server acts as absolute
 * master clock for globally distributed live performance with sub-millisecond
 * timeline fidelity.
 *
 * Architecture:
 *   Server: WebSocket master clock broadcasting BPM-locked ticks
 *   Clients: Browser DAW timelines receiving time-stamped MIDI events
 *   Protocol: High-resolution timestamps + latency compensation
 *
 * Uses Sacred Geometry timing (φ-based swing, base-13 quantization).
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const { PHI, PHI_INV, BASE, phiScale, phiTiming } = require('../heady-principles');

// ── High-Resolution Clock ──────────────────────────────────────────

/**
 * Master clock state — absolute time reference
 */
class MasterClock {
    constructor(options = {}) {
        this.bpm = options.bpm || 120;
        this.ppq = options.ppq || 480;           // pulses per quarter note
        this.swingAmount = options.swing || 0;    // 0-1, where 0.618 = φ-swing
        this.running = false;
        this.startTime = 0;
        this.tickCount = 0;
        this.subscribers = new Set();
        this._interval = null;

        // Sub-millisecond precision via performance.now() fallback
        this._hrtime = typeof process !== 'undefined' && process.hrtime
            ? () => { const t = process.hrtime(); return t[0] * 1e9 + t[1]; }
            : () => performance.now() * 1e6;
    }

    /**
     * Microseconds per tick at current BPM
     */
    get usPerTick() {
        return (60_000_000 / this.bpm) / this.ppq;
    }

    /**
     * Current position in musical time
     */
    get position() {
        if (!this.running) return { bar: 0, beat: 0, tick: 0, totalTicks: 0 };
        const totalTicks = this.tickCount;
        const ticksPerBeat = this.ppq;
        const ticksPerBar = ticksPerBeat * 4; // 4/4 time
        return {
            bar: Math.floor(totalTicks / ticksPerBar),
            beat: Math.floor((totalTicks % ticksPerBar) / ticksPerBeat),
            tick: totalTicks % ticksPerBeat,
            totalTicks,
            timeMs: (totalTicks * this.usPerTick) / 1000,
        };
    }

    /**
     * Start the master clock
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.startTime = this._hrtime();
        this.tickCount = 0;
        this._scheduleTick();
        this._emit('start', { bpm: this.bpm, ppq: this.ppq, timestamp: Date.now() });
    }

    /**
     * Stop the master clock
     */
    stop() {
        this.running = false;
        if (this._interval) clearTimeout(this._interval);
        this._emit('stop', { totalTicks: this.tickCount, timestamp: Date.now() });
    }

    /**
     * Set BPM (tempo change, live)
     */
    setTempo(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
        this._emit('tempo', { bpm: this.bpm, timestamp: Date.now() });
    }

    /**
     * Enable φ-swing: subdivisions offset by golden ratio
     * swing=0 → straight, swing=0.618 → golden swing
     */
    setSwing(amount) {
        this.swingAmount = Math.max(0, Math.min(1, amount));
    }

    /**
     * Subscribe to clock events
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    // ── Internal ──

    _scheduleTick() {
        if (!this.running) return;
        const now = this._hrtime();
        const elapsed = now - this.startTime;
        const expectedTick = Math.floor(elapsed / (this.usPerTick * 1000));

        while (this.tickCount < expectedTick) {
            this.tickCount++;
            const pos = this.position;

            // Apply φ-swing to off-beat ticks
            let swingOffset = 0;
            const isOffBeat = (this.tickCount % (this.ppq / 2)) >= (this.ppq / 4);
            if (isOffBeat && this.swingAmount > 0) {
                swingOffset = (this.usPerTick * this.swingAmount * PHI_INV) / 1000;
            }

            this._emit('tick', {
                ...pos,
                bpm: this.bpm,
                swingOffset,
                serverTimestamp: Date.now(),
                hrTimestamp: now,
            });

            // Quantized events on beat boundaries
            if (pos.tick === 0) {
                this._emit('beat', { ...pos, bpm: this.bpm, timestamp: Date.now() });
            }
            if (pos.tick === 0 && pos.beat === 0) {
                this._emit('bar', { ...pos, bpm: this.bpm, timestamp: Date.now() });
            }
        }

        // Schedule next batch with sub-ms precision
        const nextTickTime = (this.tickCount + 1) * this.usPerTick * 1000;
        const waitNs = nextTickTime - elapsed;
        const waitMs = Math.max(0.5, waitNs / 1e6);
        this._interval = setTimeout(() => this._scheduleTick(), waitMs);
    }

    _emit(event, data) {
        for (const cb of this.subscribers) {
            try { cb(event, data); } catch (e) { /* non-blocking */ }
        }
    }
}

// ── MIDI Pattern Sequencer ─────────────────────────────────────────

/**
 * MIDI event types
 */
const MIDI = {
    NOTE_ON: 0x90,
    NOTE_OFF: 0x80,
    CC: 0xB0,
    PROGRAM_CHANGE: 0xC0,
    PITCH_BEND: 0xE0,
    CLOCK: 0xF8,
    START: 0xFA,
    STOP: 0xFC,
};

/**
 * Pattern — a sequence of MIDI events with tick positions
 */
class Pattern {
    constructor(options = {}) {
        this.id = options.id || `pat-${Date.now()}`;
        this.name = options.name || 'Untitled';
        this.lengthBars = options.lengthBars || 4;
        this.channel = options.channel || 0;
        this.events = []; // { tick, type, data: [byte1, byte2, ...] }
        this.muted = false;
        this.volume = 1.0;
    }

    /**
     * Add a note event
     * @param {number} tick - position in pattern (0 = start)
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - 0-127
     * @param {number} durationTicks - note length in ticks
     */
    addNote(tick, note, velocity, durationTicks) {
        this.events.push({
            tick,
            type: MIDI.NOTE_ON,
            data: [MIDI.NOTE_ON | this.channel, note, velocity],
        });
        this.events.push({
            tick: tick + durationTicks,
            type: MIDI.NOTE_OFF,
            data: [MIDI.NOTE_OFF | this.channel, note, 0],
        });
        this.events.sort((a, b) => a.tick - b.tick);
        return this;
    }

    /**
     * Add a CC (control change) event
     */
    addCC(tick, controller, value) {
        this.events.push({
            tick,
            type: MIDI.CC,
            data: [MIDI.CC | this.channel, controller, value],
        });
        this.events.sort((a, b) => a.tick - b.tick);
        return this;
    }

    /**
     * Quantize all events to nearest base-13 subdivision
     */
    quantize(ppq = 480) {
        const gridSize = Math.round(ppq / BASE); // 480/13 ≈ 37 ticks
        for (const event of this.events) {
            event.tick = Math.round(event.tick / gridSize) * gridSize;
        }
        return this;
    }

    /**
     * Get events within a tick range
     */
    getEventsInRange(startTick, endTick) {
        if (this.muted) return [];
        return this.events
            .filter(e => e.tick >= startTick && e.tick < endTick)
            .map(e => ({
                ...e,
                data: [...e.data],
                // Scale velocity by pattern volume
                ...(e.type === MIDI.NOTE_ON ? {
                    data: [e.data[0], e.data[1], Math.round(e.data[2] * this.volume)]
                } : {})
            }));
    }

    /**
     * Get total ticks in pattern
     */
    get totalTicks() {
        return this.lengthBars * 4 * 480; // 4 beats × ppq
    }
}

// ── Sequencer Transport─────────────────────────────────────────────

/**
 * Cloud-native sequencer combining master clock + patterns
 * Designed for WebSocket broadcast to distributed DAW clients
 */
class CloudSequencer {
    constructor(options = {}) {
        this.clock = new MasterClock(options);
        this.patterns = new Map();
        this.activePatterns = new Set();
        this.clients = new Map(); // clientId → { latency, offsetMs }
        this.eventBuffer = [];    // buffered events for broadcast
        this.bufferWindowMs = options.bufferWindowMs || 50; // 50ms lookahead

        // Wire clock events
        this.clock.subscribe((event, data) => {
            if (event === 'tick') this._onTick(data);
            if (event === 'beat') this._onBeat(data);
        });
    }

    /**
     * Add a pattern to the sequencer
     */
    addPattern(pattern) {
        this.patterns.set(pattern.id, pattern);
        this.activePatterns.add(pattern.id);
        return this;
    }

    /**
     * Remove a pattern
     */
    removePattern(id) {
        this.patterns.delete(id);
        this.activePatterns.delete(id);
        return this;
    }

    /**
     * Register a remote client with measured latency
     * @param {string} clientId
     * @param {number} latencyMs - one-way network latency
     */
    registerClient(clientId, latencyMs = 0) {
        this.clients.set(clientId, {
            id: clientId,
            latencyMs,
            offsetMs: latencyMs * PHI_INV, // φ-compensated offset
            registeredAt: Date.now(),
        });
    }

    /**
     * Start playback
     */
    play() { this.clock.start(); }

    /**
     * Stop playback
     */
    stop() { this.clock.stop(); }

    /**
     * Set tempo
     */
    setTempo(bpm) { this.clock.setTempo(bpm); }

    /**
     * Get time-stamped MIDI event bundle for a specific client
     * Includes latency-compensated scheduling timestamps
     */
    getClientBundle(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return { events: [], position: this.clock.position };

        return {
            events: this.eventBuffer.map(e => ({
                ...e,
                // Pre-compensate: schedule event earlier by client's latency
                scheduledAt: e.serverTimestamp - client.latencyMs,
                playAt: e.serverTimestamp - client.offsetMs,
            })),
            position: this.clock.position,
            serverTime: Date.now(),
            clientLatency: client.latencyMs,
            compensation: client.offsetMs,
        };
    }

    /**
     * Get sequencer state for WebSocket broadcast
     */
    getState() {
        return {
            playing: this.clock.running,
            bpm: this.clock.bpm,
            position: this.clock.position,
            patterns: Array.from(this.patterns.values()).map(p => ({
                id: p.id, name: p.name, muted: p.muted,
                events: p.events.length, bars: p.lengthBars,
            })),
            clients: this.clients.size,
            serverTime: Date.now(),
        };
    }

    // ── Internal ──

    _onTick(data) {
        // Collect events from all active patterns at current tick
        for (const patId of this.activePatterns) {
            const pat = this.patterns.get(patId);
            if (!pat || pat.muted) continue;

            const tickInPattern = data.totalTicks % pat.totalTicks;
            const events = pat.getEventsInRange(tickInPattern, tickInPattern + 1);

            for (const evt of events) {
                this.eventBuffer.push({
                    ...evt,
                    patternId: patId,
                    serverTimestamp: Date.now(),
                    position: { ...data },
                });
            }
        }

        // Prune old events (keep only last bufferWindowMs)
        const cutoff = Date.now() - this.bufferWindowMs;
        this.eventBuffer = this.eventBuffer.filter(e => e.serverTimestamp >= cutoff);
    }

    _onBeat(data) {
        // Heartbeat for connected clients
    }
}

// ── WebSocket Transport Layer ──────────────────────────────────────

/**
 * WebSocket server adapter for distributing sequencer events
 * Integrates with heady-manager.js Express/WS infrastructure
 */
class SequencerTransport {
    constructor(sequencer, wss) {
        this.sequencer = sequencer;
        this.wss = wss; // WebSocket.Server instance
        this._broadcastInterval = null;
    }

    /**
     * Start broadcasting sequencer state to all connected clients
     */
    startBroadcast(intervalMs) {
        // Default: broadcast at φ-derived rate
        const rate = intervalMs || phiTiming(10).fast; // ~6.2ms ≈ 161 Hz
        this._broadcastInterval = setInterval(() => {
            if (!this.wss || !this.sequencer.clock.running) return;

            const state = this.sequencer.getState();
            const msg = JSON.stringify({ type: 'sequencer:state', data: state });

            this.wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(msg);
                }
            });
        }, rate);
    }

    /**
     * Stop broadcasting
     */
    stopBroadcast() {
        if (this._broadcastInterval) clearInterval(this._broadcastInterval);
    }

    /**
     * Handle incoming client messages (latency measurement, pattern requests)
     */
    handleMessage(clientId, message) {
        try {
            const msg = JSON.parse(message);
            switch (msg.type) {
                case 'ping':
                    // Latency measurement: client sends ping with timestamp
                    return JSON.stringify({
                        type: 'pong',
                        clientTimestamp: msg.timestamp,
                        serverTimestamp: Date.now(),
                    });
                case 'latency-report':
                    // Client reports measured round-trip latency
                    this.sequencer.registerClient(clientId, msg.latencyMs / 2);
                    break;
                case 'get-bundle':
                    return JSON.stringify({
                        type: 'midi-bundle',
                        data: this.sequencer.getClientBundle(clientId),
                    });
            }
        } catch (e) { /* ignore malformed messages */ }
        return null;
    }
}

// ── Route Registration ─────────────────────────────────────────────

/**
 * Register sequencer API routes with Express
 */
function registerRoutes(app, sequencer) {
    const prefix = '/api/sequencer';

    app.get(`${prefix}/state`, (req, res) => {
        res.json(sequencer.getState());
    });

    app.post(`${prefix}/play`, (req, res) => {
        sequencer.play();
        res.json({ ok: true, playing: true });
    });

    app.post(`${prefix}/stop`, (req, res) => {
        sequencer.stop();
        res.json({ ok: true, playing: false });
    });

    app.post(`${prefix}/tempo`, (req, res) => {
        const { bpm } = req.body;
        if (!bpm || bpm < 20 || bpm > 300) {
            return res.status(400).json({ error: 'BPM must be between 20 and 300' });
        }
        sequencer.setTempo(bpm);
        res.json({ ok: true, bpm: sequencer.clock.bpm });
    });

    app.post(`${prefix}/pattern`, (req, res) => {
        const { name, lengthBars, channel, events } = req.body;
        const pattern = new Pattern({ name, lengthBars, channel });
        if (events && Array.isArray(events)) {
            for (const e of events) {
                if (e.note !== undefined) {
                    pattern.addNote(e.tick, e.note, e.velocity || 100, e.duration || 240);
                }
            }
        }
        sequencer.addPattern(pattern);
        res.json({ ok: true, patternId: pattern.id });
    });

    app.get(`${prefix}/health`, (req, res) => {
        res.json({
            status: 'operational',
            playing: sequencer.clock.running,
            bpm: sequencer.clock.bpm,
            patterns: sequencer.patterns.size,
            clients: sequencer.clients.size,
            timestamp: Date.now(),
        });
    });
}

// ── Exports ────────────────────────────────────────────────────────

module.exports = {
    MasterClock,
    Pattern,
    CloudSequencer,
    SequencerTransport,
    registerRoutes,
    MIDI,
};
