/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ DAW MCP Bridge — Ableton Live Integration ═══
 *
 * Dual-component architecture:
 *   1. Remote Script Protocol Handler — TCP/UDP socket bridge to Ableton's Python env
 *   2. MCP Server Intelligence — Translates Buddy's semantic intent → LOM API calls
 *
 * Communication:
 *   - TCP socket for structural LOM commands (tracks, plugins, mixer)
 *   - Virtual MIDI ports for raw musical data (bypasses TCP overhead)
 *   - Event-listener model via LOM add_listener (zero-polling)
 *
 * Pipeline Tasks: daw-001 through daw-007
 */

const net = require("net");
const dgram = require("dgram");
const EventEmitter = require("events");
const { midiBus, CHANNELS, MSG, NOTES } = require("../engines/midi-event-bus");

// ═══ Configuration ═══
const CONFIG = {
    // Remote Script connection
    remoteHost: process.env.DAW_REMOTE_HOST || "127.0.0.1",
    remotePort: parseInt(process.env.DAW_REMOTE_PORT) || 11411,
    // UDP port for low-latency MIDI data
    udpPort: parseInt(process.env.DAW_UDP_PORT) || 11412,
    // MCP Server port (for external AI connections)
    mcpPort: parseInt(process.env.DAW_MCP_PORT) || 11413,
    // Connection settings
    reconnectIntervalMs: 2000,
    maxReconnectAttempts: 0, // 0 = unlimited
    heartbeatIntervalMs: 5000,
    // Parameter smoothing
    smoothingResolution: 64,    // micro-steps per parameter change
    smoothingIntervalMs: 2,     // ms between micro-steps
};

// ═══ LOM Command Types ═══
const LOM_COMMANDS = {
    // Transport
    PLAY: "transport.play",
    STOP: "transport.stop",
    RECORD: "transport.record",
    SET_TEMPO: "transport.set_tempo",
    GET_TEMPO: "transport.get_tempo",
    // Tracks
    CREATE_MIDI_TRACK: "track.create_midi",
    CREATE_AUDIO_TRACK: "track.create_audio",
    DELETE_TRACK: "track.delete",
    SET_TRACK_VOLUME: "track.set_volume",
    SET_TRACK_PAN: "track.set_pan",
    SET_TRACK_MUTE: "track.set_mute",
    SET_TRACK_SOLO: "track.set_solo",
    SET_TRACK_ARM: "track.set_arm",
    SET_TRACK_NAME: "track.set_name",
    GET_TRACK_STATE: "track.get_state",
    // Devices / Plugins
    ADD_DEVICE: "device.add",
    SET_DEVICE_PARAM: "device.set_param",
    GET_DEVICE_PARAMS: "device.get_params",
    SET_MACRO: "device.set_macro",
    // Clips
    CREATE_CLIP: "clip.create",
    DELETE_CLIP: "clip.delete",
    SET_CLIP_NOTES: "clip.set_notes",
    FIRE_CLIP: "clip.fire",
    STOP_CLIP: "clip.stop",
    // Scene
    FIRE_SCENE: "scene.fire",
    // Session Query
    GET_SESSION_STATE: "session.get_state",
    GET_ALL_TRACKS: "session.get_tracks",
    GET_ROUTING: "session.get_routing",
};

// ═══ DAW Event Types (from Remote Script → MCP Server) ═══
const DAW_EVENTS = {
    NOTE_PLAYED: "note.played",
    NOTE_RELEASED: "note.released",
    KNOB_TURNED: "knob.turned",
    TRANSPORT_CHANGED: "transport.changed",
    TRACK_ADDED: "track.added",
    TRACK_REMOVED: "track.removed",
    DEVICE_PARAM_CHANGED: "device.param_changed",
    CLIP_ADDED: "clip.added",
    CLIP_REMOVED: "clip.removed",
    CLIP_TRIGGERED: "clip.triggered",
    TEMPO_CHANGED: "tempo.changed",
    SCENE_FIRED: "scene.fired",
    SESSION_STATE_UPDATED: "session.state_updated",
};

class DawMcpBridge extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.config = { ...CONFIG, ...opts };
        this.setMaxListeners(50);

        // Connection state
        this._tcpClient = null;
        this._udpSocket = null;
        this._mcpServer = null;
        this._connected = false;
        this._reconnectTimer = null;
        this._heartbeatTimer = null;
        this._reconnectAttempts = 0;

        // Session state mirror (live representation of Ableton state)
        this._sessionState = {
            tempo: 120.0,
            playing: false,
            recording: false,
            tracks: [],
            scenes: [],
            selectedTrack: null,
            selectedScene: null,
            masterVolume: 0.85,
            playheadPosition: 0,
            timeSignature: [4, 4],
            lastUpdated: null,
        };

        // Pending command queue
        this._pendingCommands = new Map();
        this._commandIdCounter = 0;

        // Parameter smoothing state
        this._activeSmooths = new Map();

        // Metrics
        this._metrics = {
            commandsSent: 0,
            commandsReceived: 0,
            eventsReceived: 0,
            smoothOps: 0,
            midiNotesSent: 0,
            reconnections: 0,
            avgLatencyMs: 0,
            latencies: [],
        };
    }

    // ═══ Initialization ═══

    async init() {
        console.log("[DAW-MCP] Initializing DAW MCP Bridge...");
        midiBus.taskStarted("DAW-MCP-Init", CHANNELS.PIPELINE);

        try {
            // Start UDP socket for low-latency MIDI data
            this._initUdpSocket();

            // Start MCP command server (for Buddy/AI connections)
            this._initMcpServer();

            // Connect to Ableton Remote Script
            await this._connectToRemoteScript();

            midiBus.taskCompleted("DAW-MCP-Init", CHANNELS.PIPELINE);
            console.log("[DAW-MCP] Bridge initialized successfully.");
        } catch (err) {
            midiBus.taskFailed("DAW-MCP-Init", err.message, CHANNELS.PIPELINE);
            console.error(`[DAW-MCP] Init error: ${err.message}`);
            // Don't throw — allow graceful degradation
        }

        return this;
    }

    // ═══ TCP Connection to Ableton Remote Script ═══

    async _connectToRemoteScript() {
        return new Promise((resolve, reject) => {
            if (this._tcpClient) {
                this._tcpClient.destroy();
            }

            this._tcpClient = new net.Socket();
            let dataBuffer = "";

            this._tcpClient.connect(this.config.remotePort, this.config.remoteHost, () => {
                console.log(`[DAW-MCP] Connected to Ableton Remote Script at ${this.config.remoteHost}:${this.config.remotePort}`);
                this._connected = true;
                this._reconnectAttempts = 0;
                this._startHeartbeat();

                // Initial session state query
                this._sendCommand(LOM_COMMANDS.GET_SESSION_STATE)
                    .then(state => {
                        if (state) this._updateSessionState(state);
                        this.emit("connected", this._sessionState);
                        midiBus.noteOn(CHANNELS.TELEMETRY, NOTES.TASK_COMPLETE, 127, { task: "daw-handshake" });
                    })
                    .catch(() => {});

                resolve();
            });

            this._tcpClient.on("data", (chunk) => {
                dataBuffer += chunk.toString();
                // Parse newline-delimited JSON messages
                const lines = dataBuffer.split("\n");
                dataBuffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        this._handleRemoteMessage(msg);
                    } catch (err) {
                        console.error(`[DAW-MCP] Parse error: ${err.message}`);
                    }
                }
            });

            this._tcpClient.on("error", (err) => {
                console.error(`[DAW-MCP] TCP error: ${err.message}`);
                this._connected = false;
                if (this._reconnectAttempts === 0) reject(err);
            });

            this._tcpClient.on("close", () => {
                console.log("[DAW-MCP] Connection to Remote Script closed.");
                this._connected = false;
                this._stopHeartbeat();
                this._scheduleReconnect();
                this.emit("disconnected");
            });
        });
    }

    _scheduleReconnect() {
        if (this._reconnectTimer) return;
        const max = this.config.maxReconnectAttempts;
        if (max > 0 && this._reconnectAttempts >= max) {
            console.log("[DAW-MCP] Max reconnect attempts reached.");
            return;
        }
        this._reconnectAttempts++;
        this._metrics.reconnections++;
        this._reconnectTimer = setTimeout(async () => {
            this._reconnectTimer = null;
            console.log(`[DAW-MCP] Reconnecting (attempt ${this._reconnectAttempts})...`);
            try {
                await this._connectToRemoteScript();
            } catch {
                // Will retry via close handler
            }
        }, this.config.reconnectIntervalMs);
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            if (this._connected) {
                this._sendRaw({ type: "heartbeat", ts: Date.now() });
            }
        }, this.config.heartbeatIntervalMs);
    }

    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    // ═══ UDP Socket for Low-Latency MIDI Data ═══

    _initUdpSocket() {
        this._udpSocket = dgram.createSocket("udp4");
        this._udpSocket.on("message", (buf, rinfo) => {
            this._handleUdpMidiData(buf, rinfo);
        });
        this._udpSocket.on("error", (err) => {
            console.error(`[DAW-MCP] UDP error: ${err.message}`);
        });
        this._udpSocket.bind(this.config.udpPort, () => {
            console.log(`[DAW-MCP] UDP MIDI listener on port ${this.config.udpPort}`);
        });
    }

    _handleUdpMidiData(buf, rinfo) {
        // UMP packets arrive here for direct injection
        // Forward to MIDI event bus
        if (buf.length >= 4) {
            const messageType = (buf[0] >> 4) & 0x0f;
            const group = buf[0] & 0x0f;
            const status = buf[1];
            const channel = status & 0x0f;
            const data1 = buf[2];
            const data2 = buf.length > 3 ? buf[3] : 0;

            midiBus.send(status & 0xf0, channel, data1, data2, {
                source: "daw-udp",
                umpGroup: group,
                umpType: messageType,
            });

            this._metrics.eventsReceived++;
        }
    }

    // ═══ MCP Server (AI/Buddy connects here) ═══

    _initMcpServer() {
        this._mcpServer = net.createServer((socket) => {
            console.log("[DAW-MCP] MCP client connected.");
            let buffer = "";

            socket.on("data", (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const request = JSON.parse(line);
                        this._handleMcpRequest(request, socket);
                    } catch (err) {
                        socket.write(JSON.stringify({ error: err.message }) + "\n");
                    }
                }
            });

            socket.on("error", (err) => {
                console.error(`[DAW-MCP] MCP client error: ${err.message}`);
            });
        });

        this._mcpServer.listen(this.config.mcpPort, () => {
            console.log(`[DAW-MCP] MCP Server listening on port ${this.config.mcpPort}`);
        });
    }

    async _handleMcpRequest(request, socket) {
        const { id, action, intent, params } = request;

        try {
            let result;

            if (intent) {
                // Semantic intent — translate to LOM commands
                result = await this._processSemanticIntent(intent, params);
            } else if (action) {
                // Direct LOM command
                result = await this._sendCommand(action, params);
            } else if (request.type === "get_state") {
                result = this._sessionState;
            } else if (request.type === "inject_midi") {
                result = this._injectMidi(request.notes, request.channel || 0);
            } else if (request.type === "smooth_param") {
                result = this._smoothParameter(request.track, request.device, request.param, request.targetValue, request.durationMs);
            } else {
                result = { error: "Unknown request type" };
            }

            socket.write(JSON.stringify({ id, result }) + "\n");
        } catch (err) {
            socket.write(JSON.stringify({ id, error: err.message }) + "\n");
        }
    }

    // ═══ Semantic Intent Processing ═══
    // Translates high-level musical intent into concrete LOM commands

    async _processSemanticIntent(intent, params = {}) {
        const intentLower = intent.toLowerCase();
        const results = [];

        // Intent: Make something "more aggressive"
        if (intentLower.includes("aggressive") || intentLower.includes("harder") || intentLower.includes("drive")) {
            const track = params.track || this._findTrackByContext(intentLower);
            if (track) {
                // Increase drive/distortion on any saturator
                const devices = await this._sendCommand(LOM_COMMANDS.GET_DEVICE_PARAMS, { trackIndex: track.index });
                if (devices) {
                    for (const device of devices) {
                        if (this._isDistortionDevice(device.name)) {
                            results.push(await this._smoothParameter(track.index, device.index, "Drive", Math.min(1.0, (device.params?.Drive || 0.5) + 0.3), 500));
                        }
                        if (this._isFilterDevice(device.name)) {
                            results.push(await this._smoothParameter(track.index, device.index, "Frequency", Math.min(1.0, (device.params?.Frequency || 0.5) + 0.2), 500));
                        }
                    }
                }
            }
        }

        // Intent: Make something "softer" or "mellower"
        if (intentLower.includes("soft") || intentLower.includes("mellow") || intentLower.includes("gentle")) {
            const track = params.track || this._findTrackByContext(intentLower);
            if (track) {
                results.push(await this._smoothParameter(track.index, -1, "Volume", Math.max(0.0, track.volume - 0.15), 800));
                const devices = await this._sendCommand(LOM_COMMANDS.GET_DEVICE_PARAMS, { trackIndex: track.index });
                if (devices) {
                    for (const device of devices) {
                        if (this._isFilterDevice(device.name)) {
                            results.push(await this._smoothParameter(track.index, device.index, "Frequency", Math.max(0.0, (device.params?.Frequency || 0.5) - 0.25), 800));
                        }
                    }
                }
            }
        }

        // Intent: Change tempo
        if (intentLower.includes("tempo") || intentLower.includes("bpm")) {
            const bpmMatch = intent.match(/(\d+)\s*(bpm)?/i);
            if (bpmMatch) {
                results.push(await this._sendCommand(LOM_COMMANDS.SET_TEMPO, { tempo: parseFloat(bpmMatch[1]) }));
            }
        }

        // Intent: Add a track
        if (intentLower.includes("add") && intentLower.includes("track")) {
            const isMidi = !intentLower.includes("audio");
            const cmd = isMidi ? LOM_COMMANDS.CREATE_MIDI_TRACK : LOM_COMMANDS.CREATE_AUDIO_TRACK;
            results.push(await this._sendCommand(cmd, { name: params.name || "Buddy Track" }));
        }

        // Intent: Start/stop
        if (intentLower.includes("play") || intentLower.includes("start")) {
            results.push(await this._sendCommand(LOM_COMMANDS.PLAY));
        }
        if (intentLower.includes("stop") || intentLower.includes("pause")) {
            results.push(await this._sendCommand(LOM_COMMANDS.STOP));
        }

        return { intent, processed: results.length > 0, actions: results };
    }

    // ═══ Predictive Parameter Smoothing ═══
    // Eliminates zipper noise by interpolating parameter changes over time

    _smoothParameter(trackIndex, deviceIndex, paramName, targetValue, durationMs = 500) {
        return new Promise((resolve) => {
            const key = `${trackIndex}:${deviceIndex}:${paramName}`;

            // Cancel any existing smooth on this parameter
            if (this._activeSmooths.has(key)) {
                clearInterval(this._activeSmooths.get(key).timer);
                this._activeSmooths.delete(key);
            }

            const steps = this.config.smoothingResolution;
            const intervalMs = Math.max(1, Math.floor(durationMs / steps));
            let currentStep = 0;

            // Get current value (from session state or default)
            const currentValue = this._getCurrentParamValue(trackIndex, deviceIndex, paramName) || 0;
            const delta = (targetValue - currentValue) / steps;

            const timer = setInterval(() => {
                currentStep++;
                const value = currentValue + (delta * currentStep);

                if (deviceIndex === -1) {
                    // Track-level parameter (volume, pan)
                    this._sendRaw({
                        type: "command",
                        command: paramName === "Volume" ? LOM_COMMANDS.SET_TRACK_VOLUME : LOM_COMMANDS.SET_TRACK_PAN,
                        params: { trackIndex, value: Math.max(0, Math.min(1, value)) },
                    });
                } else {
                    this._sendRaw({
                        type: "command",
                        command: LOM_COMMANDS.SET_DEVICE_PARAM,
                        params: { trackIndex, deviceIndex, paramName, value: Math.max(0, Math.min(1, value)) },
                    });
                }

                if (currentStep >= steps) {
                    clearInterval(timer);
                    this._activeSmooths.delete(key);
                    this._metrics.smoothOps++;
                    resolve({ trackIndex, deviceIndex, paramName, targetValue, steps: currentStep });
                }
            }, intervalMs);

            this._activeSmooths.set(key, { timer, target: targetValue });
        });
    }

    // ═══ MIDI Injection ═══
    // Sends note data via UDP to virtual MIDI ports (bypasses TCP)

    _injectMidi(notes, channel = 0) {
        if (!this._udpSocket || !notes || notes.length === 0) return { sent: 0 };

        let sent = 0;
        for (const note of notes) {
            // UMP format: [messageType|group, status|channel, noteNumber, velocity]
            const buf = Buffer.alloc(4);
            buf[0] = 0x20 | (0 & 0x0f); // MIDI 1.0 channel voice, group 0
            buf[1] = (note.type === "off" ? 0x80 : 0x90) | (channel & 0x0f);
            buf[2] = note.pitch & 0x7f;
            buf[3] = (note.velocity || 100) & 0x7f;

            this._udpSocket.send(buf, 0, buf.length, this.config.remotePort + 1, this.config.remoteHost);
            sent++;
            this._metrics.midiNotesSent++;
        }

        midiBus.cc(CHANNELS.TELEMETRY, 6, Math.min(127, sent), { source: "daw-inject" });
        return { sent };
    }

    // ═══ Command Protocol ═══

    async _sendCommand(command, params = {}) {
        const id = ++this._commandIdCounter;
        const msg = { type: "command", id, command, params, ts: Date.now() };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pendingCommands.delete(id);
                reject(new Error(`Command timeout: ${command}`));
            }, 10000);

            this._pendingCommands.set(id, { resolve, reject, timeout, sentAt: Date.now() });
            this._sendRaw(msg);
            this._metrics.commandsSent++;
        });
    }

    _sendRaw(obj) {
        if (!this._tcpClient || !this._connected) return false;
        try {
            this._tcpClient.write(JSON.stringify(obj) + "\n");
            return true;
        } catch (err) {
            console.error(`[DAW-MCP] Send error: ${err.message}`);
            return false;
        }
    }

    // ═══ Message Handling ═══

    _handleRemoteMessage(msg) {
        this._metrics.commandsReceived++;

        // Response to a pending command
        if (msg.id && this._pendingCommands.has(msg.id)) {
            const pending = this._pendingCommands.get(msg.id);
            clearTimeout(pending.timeout);
            this._pendingCommands.delete(msg.id);

            const latency = Date.now() - pending.sentAt;
            this._metrics.latencies.push(latency);
            if (this._metrics.latencies.length > 100) this._metrics.latencies.shift();
            this._metrics.avgLatencyMs = this._metrics.latencies.reduce((a, b) => a + b, 0) / this._metrics.latencies.length;

            if (msg.error) {
                pending.reject(new Error(msg.error));
            } else {
                pending.resolve(msg.result);
            }
            return;
        }

        // Event from Remote Script (bidirectional listener)
        if (msg.event) {
            this._metrics.eventsReceived++;
            this._handleDawEvent(msg.event, msg.data);
        }

        // Heartbeat ACK
        if (msg.type === "heartbeat_ack") {
            // Connection is alive
        }
    }

    _handleDawEvent(event, data) {
        // Update session state mirror
        switch (event) {
            case DAW_EVENTS.TEMPO_CHANGED:
                this._sessionState.tempo = data.tempo;
                break;
            case DAW_EVENTS.TRANSPORT_CHANGED:
                this._sessionState.playing = data.playing;
                this._sessionState.recording = data.recording;
                break;
            case DAW_EVENTS.TRACK_ADDED:
                this._sessionState.tracks.push(data.track);
                break;
            case DAW_EVENTS.TRACK_REMOVED:
                this._sessionState.tracks = this._sessionState.tracks.filter(t => t.index !== data.trackIndex);
                break;
            case DAW_EVENTS.DEVICE_PARAM_CHANGED:
                this._updateDeviceParam(data);
                break;
            case DAW_EVENTS.SESSION_STATE_UPDATED:
                this._updateSessionState(data);
                break;
            case DAW_EVENTS.NOTE_PLAYED:
                midiBus.noteOn(CHANNELS.TELEMETRY, data.note || 60, data.velocity || 100, { source: "human", track: data.track });
                break;
            case DAW_EVENTS.CLIP_REMOVED:
                // This is the negative-weight correction signal
                this.emit("correction", { type: "clip_removed", data });
                break;
        }

        this._sessionState.lastUpdated = Date.now();
        this.emit("daw_event", { event, data });
        this.emit(event, data);
    }

    // ═══ Session State Helpers ═══

    _updateSessionState(state) {
        Object.assign(this._sessionState, state);
        this._sessionState.lastUpdated = Date.now();
    }

    _updateDeviceParam(data) {
        const track = this._sessionState.tracks.find(t => t.index === data.trackIndex);
        if (track && track.devices) {
            const device = track.devices.find(d => d.index === data.deviceIndex);
            if (device && device.params) {
                device.params[data.paramName] = data.value;
            }
        }
    }

    _getCurrentParamValue(trackIndex, deviceIndex, paramName) {
        const track = this._sessionState.tracks.find(t => t.index === trackIndex);
        if (!track) return null;
        if (deviceIndex === -1) {
            if (paramName === "Volume") return track.volume;
            if (paramName === "Pan") return track.pan;
            return null;
        }
        if (track.devices) {
            const device = track.devices.find(d => d.index === deviceIndex);
            if (device && device.params) return device.params[paramName];
        }
        return null;
    }

    _findTrackByContext(text) {
        const keywords = {
            lead: ["lead", "synth", "melody"],
            bass: ["bass", "sub", "low"],
            drums: ["drum", "kick", "snare", "hat", "perc"],
            vocal: ["vocal", "voice", "vox"],
            pad: ["pad", "ambient", "atmosphere"],
        };

        for (const track of this._sessionState.tracks) {
            const trackName = (track.name || "").toLowerCase();
            for (const [, words] of Object.entries(keywords)) {
                if (words.some(w => text.includes(w) && trackName.includes(w))) {
                    return track;
                }
            }
        }
        return this._sessionState.tracks[0] || null;
    }

    _isDistortionDevice(name) {
        const lower = (name || "").toLowerCase();
        return ["saturator", "overdrive", "distortion", "pedal", "amp", "drive", "heat"].some(k => lower.includes(k));
    }

    _isFilterDevice(name) {
        const lower = (name || "").toLowerCase();
        return ["filter", "autofilter", "eq", "equalizer"].some(k => lower.includes(k));
    }

    // ═══ Public API ═══

    getSessionState() {
        return { ...this._sessionState };
    }

    isConnected() {
        return this._connected;
    }

    getMetrics() {
        return {
            connected: this._connected,
            ...this._metrics,
            activeSmooths: this._activeSmooths.size,
            pendingCommands: this._pendingCommands.size,
            sessionTracks: this._sessionState.tracks.length,
        };
    }

    async sendLomCommand(command, params = {}) {
        return this._sendCommand(command, params);
    }

    async processIntent(intent, params = {}) {
        return this._processSemanticIntent(intent, params);
    }

    injectNotes(notes, channel = 0) {
        return this._injectMidi(notes, channel);
    }

    // ═══ Shutdown ═══

    async shutdown() {
        console.log("[DAW-MCP] Shutting down...");
        this._stopHeartbeat();
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);

        // Cancel all active smoothing operations
        for (const [, smooth] of this._activeSmooths) {
            clearInterval(smooth.timer);
        }
        this._activeSmooths.clear();

        // Close connections
        if (this._tcpClient) this._tcpClient.destroy();
        if (this._udpSocket) this._udpSocket.close();
        if (this._mcpServer) this._mcpServer.close();
    }

    // ═══ Express Routes ═══

    registerRoutes(app) {
        app.get("/api/daw/status", (req, res) => {
            res.json({
                ok: true,
                connected: this._connected,
                session: this._sessionState,
                metrics: this.getMetrics(),
            });
        });

        app.post("/api/daw/command", async (req, res) => {
            try {
                const { command, params } = req.body;
                if (!command) return res.status(400).json({ error: "Missing command" });
                const result = await this._sendCommand(command, params || {});
                res.json({ ok: true, result });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post("/api/daw/intent", async (req, res) => {
            try {
                const { intent, params } = req.body;
                if (!intent) return res.status(400).json({ error: "Missing intent" });
                const result = await this._processSemanticIntent(intent, params || {});
                res.json({ ok: true, result });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post("/api/daw/midi/inject", (req, res) => {
            const { notes, channel } = req.body;
            if (!notes || !Array.isArray(notes)) return res.status(400).json({ error: "Missing notes array" });
            const result = this._injectMidi(notes, channel || 0);
            res.json({ ok: true, result });
        });

        app.post("/api/daw/smooth", async (req, res) => {
            try {
                const { track, device, param, value, duration } = req.body;
                const result = await this._smoothParameter(track, device || -1, param, value, duration || 500);
                res.json({ ok: true, result });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }
}

// ═══ Singleton ═══
let _instance = null;
function getInstance(opts) {
    if (!_instance) _instance = new DawMcpBridge(opts);
    return _instance;
}

module.exports = {
    DawMcpBridge,
    getInstance,
    LOM_COMMANDS,
    DAW_EVENTS,
    CONFIG: CONFIG,
};
