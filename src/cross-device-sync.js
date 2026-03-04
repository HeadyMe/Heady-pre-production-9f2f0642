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
const fs = require("fs");
const path = require("path");

class CrossDeviceSyncHub extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.devices = new Map();       // deviceId → { ws, name, platform, connectedAt, lastSeen }
        this.sessions = new Map();      // sessionId → { deviceId, context, startedAt }
        this.sharedContext = new Map();  // key → { value, updatedBy, updatedAt }
        this.heartbeatInterval = opts.heartbeatInterval || 30000;
        this.maxMessageBytes = opts.maxMessageBytes || 64 * 1024;
        this.maxMessagesPerMinute = opts.maxMessagesPerMinute || 300;
        this.requireAuthToken = opts.requireAuthToken || process.env.HEADY_SYNC_REQUIRE_TOKEN === "true";
        this.sharedToken = opts.sharedToken || process.env.HEADY_SYNC_SHARED_TOKEN || null;
        this._heartbeatTimer = null;
        this._messageCount = 0;
        this._rejectedMessageCount = 0;
        this._rateWindows = new Map();
        this.storePath = opts.storePath || path.join(__dirname, "..", "data", "cross-device-sync-store.json");
        this.vectorMemory = opts.vectorMemory || null;
        if (!this.vectorMemory) {
            try {
                this.vectorMemory = require("./vector-memory");
            } catch { }
        }
        this._persistTimer = null;
        this._persistentState = { users: {}, workspaces: {}, lastUpdatedAt: null };
        this._loadPersistentState();
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
            if (!this._isAuthorized(req)) {
                this._rejectedMessageCount++;
                this._send(ws, { type: "error", error: "Unauthorized device" });
                ws.close(1008, "Unauthorized");
                return;
            }

            const deviceId = req.headers["x-device-id"] || crypto.randomBytes(8).toString("hex");
            const deviceName = req.headers["x-device-name"] || "unknown";
            const platform = req.headers["x-device-platform"] || "unknown";
            const userId = this._getDeviceUserId(req, deviceId);

            this._registerDevice(deviceId, ws, { name: deviceName, platform, userId });

            ws.on("message", (raw) => {
                try {
                    if (this._isMessageRejected(deviceId, raw)) {
                        this._send(ws, { type: "error", error: "Message rejected by policy" });
                        return;
                    }

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



    _loadPersistentState() {
        try {
            if (fs.existsSync(this.storePath)) {
                this._persistentState = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            }
        } catch (error) {
            logger.warn(`⚠ [SyncHub] Failed loading persistent state: ${error.message}`);
        }
    }

    _schedulePersist() {
        if (this._persistTimer) return;
        this._persistTimer = setTimeout(() => {
            try {
                const dir = path.dirname(this.storePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                this._persistentState.lastUpdatedAt = new Date().toISOString();
                fs.writeFileSync(this.storePath, JSON.stringify(this._persistentState, null, 0));
            } catch (error) {
                logger.warn(`⚠ [SyncHub] Failed persisting state: ${error.message}`);
            } finally {
                this._persistTimer = null;
            }
        }, 250);
        if (typeof this._persistTimer.unref === "function") this._persistTimer.unref();
    }

    _ingestSyncEvent(eventType, payload = {}) {
        const content = `[SYNC:${eventType}] ${JSON.stringify(payload).substring(0, 1200)}`;
        if (this.vectorMemory && typeof this.vectorMemory.smartIngest === "function") {
            this.vectorMemory.smartIngest({
                content,
                metadata: {
                    type: "cross-device-sync",
                    domain: "system-actions",
                    category: "sync-event",
                    eventType,
                    ts: Date.now(),
                },
            }, 0.95).catch(() => { });
        }

        if (global.eventBus) {
            global.eventBus.emit("system:action", {
                actor: "cross-device-sync",
                action: eventType,
                target: "cross-device-state",
                outcome: "recorded",
                details: payload,
            });

            if (["context_update", "widget_state_update", "workspace_sync"].includes(eventType)) {
                global.eventBus.emit("user:action", {
                    message: `${eventType}:${payload.userId || "unknown"}`,
                    response: JSON.stringify(payload).substring(0, 800),
                    userId: payload.userId || "unknown",
                    sessionId: payload.deviceId || payload.via || "sync",
                });
            }
        }
    }

    _getDeviceUserId(req, deviceId) {
        const explicit = req.headers["x-user-id"];
        if (explicit) return String(explicit).trim();
        return `user:${String(deviceId).slice(0, 12)}`;
    }

    _registerDevice(deviceId, ws, meta) {
        this.devices.set(deviceId, {
            ws,
            name: meta.name,
            platform: meta.platform,
            userId: meta.userId || "unknown",
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
            personalState: this._persistentState.users[meta.userId] || {},
            workspaceState: this._persistentState.workspaces[meta.userId] || {},
        });

        // Notify all other devices
        this._broadcast(deviceId, {
            type: "device_connected",
            device: { id: deviceId, name: meta.name, platform: meta.platform },
            connectedDevices: this._getDeviceList(),
        });

        this._ingestSyncEvent("device_connected", { deviceId, userId: meta.userId, name: meta.name, platform: meta.platform });
        this.emit("device:connected", { deviceId, ...meta });
    }

    _isAuthorized(req) {
        if (!this.requireAuthToken) return true;
        if (!this.sharedToken) {
            logger.warn("⚠ [SyncHub] Auth token required but HEADY_SYNC_SHARED_TOKEN is not configured");
            return false;
        }

        const presented = req.headers["x-sync-token"];
        return presented === this.sharedToken;
    }

    _isMessageRejected(deviceId, raw) {
        const rawLength = typeof raw?.length === "number" ? raw.length : Buffer.byteLength(raw?.toString() || "", "utf8");
        if (rawLength > this.maxMessageBytes) {
            this._rejectedMessageCount++;
            logger.warn(`⚠ [SyncHub] Message rejected (size=${rawLength}) from ${deviceId.slice(0, 8)}...`);
            return true;
        }

        const now = Date.now();
        const existing = this._rateWindows.get(deviceId) || { count: 0, windowStartMs: now };
        if (now - existing.windowStartMs >= 60000) {
            existing.count = 0;
            existing.windowStartMs = now;
        }
        existing.count += 1;
        this._rateWindows.set(deviceId, existing);

        if (existing.count > this.maxMessagesPerMinute) {
            this._rejectedMessageCount++;
            logger.warn(`⚠ [SyncHub] Rate limited device ${deviceId.slice(0, 8)}... (${existing.count}/min)`);
            return true;
        }

        return false;
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
            this._ingestSyncEvent("device_disconnected", { deviceId, userId: device.userId, name: device.name });
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
                    if (device?.userId) {
                        if (!this._persistentState.users[device.userId]) this._persistentState.users[device.userId] = {};
                        this._persistentState.users[device.userId].context = this._persistentState.users[device.userId].context || {};
                        this._persistentState.users[device.userId].context[msg.key] = msg.value;
                        this._persistentState.users[device.userId].contextUpdatedAt = Date.now();
                        this._schedulePersist();
                        this._ingestSyncEvent("context_update", { userId: device.userId, key: msg.key });
                    }
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

            case "task_widget_sync":
            case "widget_state_update": {
                const state = msg.state || {};
                if (!device) break;
                if (!this._persistentState.users[device.userId]) this._persistentState.users[device.userId] = {};
                this._persistentState.users[device.userId].widget = {
                    ...this._persistentState.users[device.userId].widget,
                    ...state,
                    updatedAt: Date.now(),
                    updatedBy: fromDeviceId,
                };
                this._schedulePersist();
                this._ingestSyncEvent("widget_state_update", { userId: device.userId, deviceId: fromDeviceId, keys: Object.keys(state) });
                this._broadcast(fromDeviceId, {
                    type: "widget_state_updated",
                    userId: device.userId,
                    state: this._persistentState.users[device.userId].widget,
                });
                break;
            }

            case "workspace_sync": {
                const snapshot = msg.snapshot || {};
                if (!device) break;
                this._persistentState.workspaces[device.userId] = {
                    ...snapshot,
                    updatedAt: Date.now(),
                    updatedBy: fromDeviceId,
                };
                this._schedulePersist();
                this._ingestSyncEvent("workspace_sync", {
                    userId: device.userId,
                    deviceId: fromDeviceId,
                    vectorWorkspaceId: snapshot.vectorWorkspaceId || null,
                    templateCount: Array.isArray(snapshot.templates) ? snapshot.templates.length : 0,
                });
                this._broadcast(fromDeviceId, {
                    type: "workspace_synced",
                    userId: device.userId,
                    snapshot: this._persistentState.workspaces[device.userId],
                });
                break;
            }

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

        const fromDevice = this.devices.get(fromDeviceId);
        if (fromDevice) {
            this._send(fromDevice.ws, {
                type: "session_handoff_ack",
                sessionId,
                to: targetDeviceId,
            });
        }

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
                userId: device.userId,
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
            rejectedMessages: this._rejectedMessageCount,
            persistentUsers: Object.keys(this._persistentState.users || {}).length,
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

        app.get("/api/sync/health", (req, res) => {
            res.json({
                ok: true,
                service: "cross-device-sync",
                connectedDevices: this.devices.size,
                rejectedMessages: this._rejectedMessageCount,
                persistentUsers: Object.keys(this._persistentState.users || {}).length,
                checkedAt: new Date().toISOString(),
            });
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

        app.get("/api/sync/personal/:userId", (req, res) => {
            const userId = req.params.userId;
            res.json({ ok: true, userId, state: this._persistentState.users[userId] || {} });
        });

        app.get("/api/sync/workspace/:userId", (req, res) => {
            const userId = req.params.userId;
            res.json({ ok: true, userId, workspace: this._persistentState.workspaces[userId] || {} });
        });

        app.post("/api/sync/widget/:userId", (req, res) => {
            const userId = req.params.userId;
            const state = req.body?.state || {};
            if (!this._persistentState.users[userId]) this._persistentState.users[userId] = {};
            this._persistentState.users[userId].widget = { ...state, updatedAt: Date.now(), updatedBy: "api" };
            this._schedulePersist();
            this._ingestSyncEvent("widget_state_update", { userId, via: "api", keys: Object.keys(state) });
            this._broadcast(null, { type: "widget_state_updated", userId, state: this._persistentState.users[userId].widget });
            res.json({ ok: true, userId });
        });

        app.post("/api/sync/workspace/:userId", (req, res) => {
            const userId = req.params.userId;
            const snapshot = req.body?.snapshot || {};
            this._persistentState.workspaces[userId] = { ...snapshot, updatedAt: Date.now(), updatedBy: "api" };
            this._schedulePersist();
            this._ingestSyncEvent("workspace_sync", { userId, via: "api", vectorWorkspaceId: snapshot.vectorWorkspaceId || null });
            this._broadcast(null, { type: "workspace_synced", userId, snapshot: this._persistentState.workspaces[userId] });
            res.json({ ok: true, userId });
        });


        app.get("/api/sync/templates/:userId", (req, res) => {
            const userId = req.params.userId;
            const workspace = this._persistentState.workspaces[userId] || {};
            const templates = Array.isArray(workspace.templates)
                ? workspace.templates.map((template, idx) => ({
                    templateId: `sync-template-${userId}-${idx}`,
                    source: 'cross-device-workspace',
                    payload: template,
                    injectedAt: workspace.updatedAt || null,
                }))
                : [];

            res.json({
                ok: true,
                userId,
                vectorWorkspaceId: workspace.vectorWorkspaceId || null,
                templateCount: templates.length,
                templates,
            });
        });

        app.post("/api/sync/broadcast", (req, res) => {
            const { event, data } = req.body || {};
            if (!event) return res.status(400).json({ ok: false, error: "event is required" });
            this._broadcast(null, { type: "event", from: "api", event, data });
            res.json({ ok: true, sentTo: this.devices.size });
        });

        logger.info("  🔗 [SyncHub] Routes: /api/sync/status, /health, /devices, /context, /personal/:userId, /workspace/:userId, /widget/:userId, /templates/:userId, /broadcast");
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
        this._rateWindows.clear();
        if (this._persistTimer) clearTimeout(this._persistTimer);
        try {
            this._persistentState.lastUpdatedAt = new Date().toISOString();
            const dir = path.dirname(this.storePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.storePath, JSON.stringify(this._persistentState, null, 0));
        } catch { }
    }
}

module.exports = { CrossDeviceSyncHub };
