/**
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Cross-Device Sync Hub — Buddy Everywhere ═══
 *
 * WebSocket-based real-time sync layer that connects all Buddy
 * device agents. State follows you across devices instantly.
 *
 * Features:
 *   - Device registry with crypto identity
 *   - Session handoff (start on desktop → continue on phone)
 *   - Shared context broadcast
 *   - Presence tracking (which devices are online)
 *   - Event relay for realtime orchestration
 */

const crypto = require("crypto");
const logger = require("./utils/logger");
const EventEmitter = require("events");

class CrossDeviceSyncHub extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.devices = new Map();       // deviceId → { ws, name, platform, connectedAt, lastSeen }
        this.sessions = new Map();      // sessionId → { deviceId, context, startedAt }
        this.sharedContext = new Map();  // key → { value, updatedBy, updatedAt }
        this.heartbeatInterval = opts.heartbeatInterval || 30000;
        this._heartbeatTimer = null;
        this._messageCount = 0;
    }

    /**
     * Attach to an HTTP server to upgrade WebSocket connections.
     * Uses the ws module if available, otherwise falls back to raw upgrade.
     */
    attachToServer(server) {
        let WebSocketServer;
        try {
            WebSocketServer = require("ws").Server;
        } catch {
            logger.info("⚠ [SyncHub] ws module not available — WebSocket sync disabled");
            return;
        }

        this.wss = new WebSocketServer({ server, path: "/ws/sync" });

        this.wss.on("connection", (ws, req) => {
            const deviceId = req.headers["x-device-id"] || crypto.randomBytes(8).toString("hex");
            const deviceName = req.headers["x-device-name"] || "unknown";
            const platform = req.headers["x-device-platform"] || "unknown";

            this._registerDevice(deviceId, ws, { name: deviceName, platform });

            ws.on("message", (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    this._handleMessage(deviceId, msg);
                } catch (err) {
                    this._send(ws, { type: "error", error: `Invalid message: ${err.message}` });
                }
            });

            ws.on("close", () => {
                this._unregisterDevice(deviceId);
            });

            ws.on("error", (err) => {
                logger.info(`⚠ [SyncHub] Device ${deviceId} error: ${err.message}`);
            });
        });

        // Start heartbeat monitoring
        this._heartbeatTimer = setInterval(() => this._checkHeartbeats(), this.heartbeatInterval);

        logger.info(`🔗 [SyncHub] Cross-device sync hub active on /ws/sync`);
    }

    _registerDevice(deviceId, ws, meta) {
        this.devices.set(deviceId, {
            ws,
            name: meta.name,
            platform: meta.platform,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
        });

        logger.info(`🔗 [SyncHub] Device connected: ${meta.name} (${deviceId.slice(0, 8)}...) [${meta.platform}]`);

        // Send welcome + current state
        this._send(ws, {
            type: "welcome",
            deviceId,
            connectedDevices: this._getDeviceList(),
            sharedContext: Object.fromEntries(this.sharedContext),
        });

        // Notify all other devices
        this._broadcast(deviceId, {
            type: "device_connected",
            device: { id: deviceId, name: meta.name, platform: meta.platform },
            connectedDevices: this._getDeviceList(),
        });

        this.emit("device:connected", { deviceId, ...meta });
    }

    _unregisterDevice(deviceId) {
        const device = this.devices.get(deviceId);
        this.devices.delete(deviceId);

        if (device) {
            logger.info(`🔗 [SyncHub] Device disconnected: ${device.name} (${deviceId.slice(0, 8)}...)`);
            this._broadcast(null, {
                type: "device_disconnected",
                deviceId,
                connectedDevices: this._getDeviceList(),
            });
            this.emit("device:disconnected", { deviceId, name: device.name });
        }
    }

    _handleMessage(fromDeviceId, msg) {
        this._messageCount++;
        const device = this.devices.get(fromDeviceId);
        if (device) device.lastSeen = Date.now();

        switch (msg.type) {
            case "heartbeat":
                this._send(device?.ws, { type: "heartbeat_ack", ts: Date.now() });
                break;

            case "context_update":
                // Update shared context and broadcast to all devices
                if (msg.key && msg.value !== undefined) {
                    this.sharedContext.set(msg.key, {
                        value: msg.value,
                        updatedBy: fromDeviceId,
                        updatedAt: Date.now(),
                    });
                    this._broadcast(fromDeviceId, {
                        type: "context_updated",
                        key: msg.key,
                        value: msg.value,
                        updatedBy: fromDeviceId,
                    });
                    this.emit("context:updated", { key: msg.key, value: msg.value, deviceId: fromDeviceId });
                }
                break;

            case "session_handoff":
                // Transfer active session to another device
                this._handoffSession(fromDeviceId, msg.targetDeviceId, msg.sessionData);
                break;

            case "relay_event":
                // Relay an event to a specific device or broadcast
                if (msg.targetDeviceId) {
                    const target = this.devices.get(msg.targetDeviceId);
                    if (target) this._send(target.ws, { type: "event", from: fromDeviceId, event: msg.event, data: msg.data });
                } else {
                    this._broadcast(fromDeviceId, { type: "event", from: fromDeviceId, event: msg.event, data: msg.data });
                }
                this.emit("event:relayed", { from: fromDeviceId, event: msg.event });
                break;

            case "get_devices":
                this._send(device?.ws, { type: "device_list", devices: this._getDeviceList() });
                break;

            case "get_context":
                this._send(device?.ws, { type: "context_snapshot", context: Object.fromEntries(this.sharedContext) });
                break;

            default:
                this._send(device?.ws, { type: "error", error: `Unknown message type: ${msg.type}` });
        }
    }

    _handoffSession(fromDeviceId, targetDeviceId, sessionData) {
        const target = this.devices.get(targetDeviceId);
        if (!target) {
            const from = this.devices.get(fromDeviceId);
            if (from) this._send(from.ws, { type: "error", error: `Target device ${targetDeviceId} not connected` });
            return;
        }

        const sessionId = crypto.randomUUID();
        this.sessions.set(sessionId, {
            deviceId: targetDeviceId,
            context: sessionData,
            startedAt: Date.now(),
            handedOffFrom: fromDeviceId,
        });

        this._send(target.ws, {
            type: "session_handoff",
            sessionId,
            from: fromDeviceId,
            context: sessionData,
        });

        const from = this.devices.get(fromDeviceId);
        if (from) this._send(from.ws, { type: "session_handoff_ack", sessionId, targetDeviceId });

        logger.info(`🔗 [SyncHub] Session handoff: ${fromDeviceId.slice(0, 8)} → ${targetDeviceId.slice(0, 8)}`);
        this.emit("session:handoff", { sessionId, from: fromDeviceId, to: targetDeviceId });
    }

    _broadcast(excludeDeviceId, message) {
        for (const [deviceId, device] of this.devices) {
            if (deviceId !== excludeDeviceId) {
                this._send(device.ws, message);
            }
        }
    }

    _send(ws, message) {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(message));
        }
    }

    _getDeviceList() {
        const list = [];
        for (const [id, device] of this.devices) {
            list.push({
                id: id.slice(0, 12),
                name: device.name,
                platform: device.platform,
                connectedAt: device.connectedAt,
                lastSeen: device.lastSeen,
            });
        }
        return list;
    }

    _checkHeartbeats() {
        const staleThreshold = this.heartbeatInterval * 3;
        const now = Date.now();

        for (const [deviceId, device] of this.devices) {
            if (now - device.lastSeen > staleThreshold) {
                logger.info(`🔗 [SyncHub] Device stale, disconnecting: ${device.name} (${deviceId.slice(0, 8)}...)`);
                device.ws.terminate();
                this._unregisterDevice(deviceId);
            }
        }
    }

    /**
     * Get current sync hub status.
     */
    getStatus() {
        return {
            ok: true,
            connectedDevices: this.devices.size,
            activeSessions: this.sessions.size,
            sharedContextKeys: this.sharedContext.size,
            totalMessages: this._messageCount,
            devices: this._getDeviceList(),
        };
    }

    /**
     * Register HTTP routes for sync hub management.
     */
    registerRoutes(app) {
        app.get("/api/sync/status", (req, res) => {
            res.json(this.getStatus());
        });

        app.get("/api/sync/devices", (req, res) => {
            res.json({ ok: true, devices: this._getDeviceList() });
        });

        app.get("/api/sync/context", (req, res) => {
            res.json({ ok: true, context: Object.fromEntries(this.sharedContext) });
        });

        app.post("/api/sync/context", (req, res) => {
            const { key, value } = req.body || {};
            if (!key) return res.status(400).json({ ok: false, error: "key is required" });
            this.sharedContext.set(key, { value, updatedBy: "api", updatedAt: Date.now() });
            this._broadcast(null, { type: "context_updated", key, value, updatedBy: "api" });
            res.json({ ok: true, key });
        });

        app.post("/api/sync/broadcast", (req, res) => {
            const { event, data } = req.body || {};
            if (!event) return res.status(400).json({ ok: false, error: "event is required" });
            this._broadcast(null, { type: "event", from: "api", event, data });
            res.json({ ok: true, sentTo: this.devices.size });
        });

        logger.info("  🔗 [SyncHub] Routes: /api/sync/status, /devices, /context, /broadcast");
    }

    /**
     * Clean shutdown.
     */
    shutdown() {
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
        for (const [, device] of this.devices) {
            this._send(device.ws, { type: "shutdown", reason: "Server shutting down" });
            device.ws.close();
        }
        this.devices.clear();
        this.sessions.clear();
    }
}

module.exports = { CrossDeviceSyncHub };
