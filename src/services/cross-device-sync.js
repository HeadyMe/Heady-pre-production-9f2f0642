/**
 * HeadyBuddy Cross-Device Sync Service
 *
 * Cloud-mediated state synchronization between all provisioned devices.
 * All sync operations run on cloud bees — devices are thin clients.
 *
 * Syncs: auth tokens, mod states, chat history, preferences, fs bookmarks
 *
 * Architecture:
 *   Device → WebSocket → Cloud Sync Bee → Vector Memory → All Other Devices
 *
 * © 2026 HeadySystems Inc. All rights reserved.
 */

const crypto = require('crypto');
const { PHI } = require('../heady-principles');

const SYNC_VERSION = 'v3457890';
const SYNC_INTERVAL_MS = Math.round(5000 * PHI); // ~8090ms — phi-based interval

// ─── Device Registry ────────────────────────────────────────────────────

class DeviceRegistry {
    constructor() {
        this.devices = new Map();
    }

    register(deviceId, metadata) {
        this.devices.set(deviceId, {
            ...metadata,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            syncState: 'ready',
        });
        return this.devices.get(deviceId);
    }

    heartbeat(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.lastSeen = new Date().toISOString();
            device.syncState = 'connected';
        }
    }

    listActive(thresholdMs = 60000) {
        const now = Date.now();
        const active = [];
        for (const [id, device] of this.devices) {
            if (now - new Date(device.lastSeen).getTime() < thresholdMs) {
                active.push({ deviceId: id, ...device });
            }
        }
        return active;
    }

    getDevice(deviceId) {
        return this.devices.get(deviceId) || null;
    }
}

// ─── Sync State Manager ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class SyncStateManager {
    constructor() {
        this.state = {
            version: SYNC_VERSION,
            lastSync: null,
            syncId: null,

            // Synchronized across all devices
            auth: {
                rootAuthorized: false,
                authCode: null,
                scope: 'pending',
                expiresAt: null,
            },
            mods: {},
            preferences: {
                theme: 'sacred-geometry',
                chatHistorySync: true,
                notificationsEnabled: true,
                autoConnect: true,
            },
            chatHistory: [],
            fsBookmarks: [],
            deviceProfiles: {},
        };
    }

    // Generate a deterministic sync ID for conflict resolution
    generateSyncId() {
        const payload = JSON.stringify(this.state) + Date.now();
        return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
    }

    // Apply a partial update from any device
    applyUpdate(deviceId, patch) {
        const merged = deepMerge(this.state, patch);
        merged.lastSync = new Date().toISOString();
        merged.syncId = this.generateSyncId();
        this.state = merged;
        return this.state;
    }

    // Get the full state for a newly connecting device
    getFullState() {
        return { ...this.state };
    }

    // Get a delta since a given syncId (simplified — returns full state)
    getDelta(sinceSyncId) {
        // In production, this would compute actual deltas
        return {
            full: true,
            state: this.getFullState(),
            since: sinceSyncId,
        };
    }

    // Auth sync — when one device authorizes root, all devices get it
    syncAuth(authData) {
        this.state.auth = { ...this.state.auth, ...authData };
        this.state.lastSync = new Date().toISOString();
        this.state.syncId = this.generateSyncId();
        return this.state.auth;
    }

    // Mod sync — toggle state propagates to all devices
    syncMod(modId, installed) {
        this.state.mods[modId] = {
            installed,
            syncedAt: new Date().toISOString(),
        };
        this.state.lastSync = new Date().toISOString();
        this.state.syncId = this.generateSyncId();
        return this.state.mods;
    }

    // Chat history sync — messages appear on all devices
    syncChatMessage(message) {
        this.state.chatHistory.push({
            ...message,
            syncedAt: new Date().toISOString(),
            id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
        });
        // Keep last 500 messages
        if (this.state.chatHistory.length > 500) {
            this.state.chatHistory = this.state.chatHistory.slice(-500);
        }
        this.state.lastSync = new Date().toISOString();
        this.state.syncId = this.generateSyncId();
    }

    // Filesystem bookmarks sync
    syncFsBookmark(bookmark) {
        const existing = this.state.fsBookmarks.findIndex(b => b.path === bookmark.path);
        if (existing >= 0) {
            this.state.fsBookmarks[existing] = { ...this.state.fsBookmarks[existing], ...bookmark };
        } else {
            this.state.fsBookmarks.push({ ...bookmark, addedAt: new Date().toISOString() });
        }
        this.state.lastSync = new Date().toISOString();
        this.state.syncId = this.generateSyncId();
    }
}

// ─── Cross-Device Sync Orchestrator ─────────────────────────────────────

class CrossDeviceSync {
    constructor() {
        this.registry = new DeviceRegistry();
        this.stateManager = new SyncStateManager();
        this.eventHandlers = new Map();
        this.syncInterval = null;
    }

    // Register a new device into the sync mesh
    registerDevice(deviceId, metadata) {
        const device = this.registry.register(deviceId, metadata);

        // Send full state to newly connected device
        const fullState = this.stateManager.getFullState();

        this.emit('device:registered', { deviceId, device, state: fullState });
        this.emit('sync:state-push', { target: deviceId, state: fullState });

        return { device, state: fullState };
    }

    // Receive a state update from a device and broadcast to others
    receiveUpdate(sourceDeviceId, patch) {
        this.registry.heartbeat(sourceDeviceId);

        // Apply update
        const newState = this.stateManager.applyUpdate(sourceDeviceId, patch);

        // Broadcast to all other connected devices
        const activeDevices = this.registry.listActive();
        for (const device of activeDevices) {
            if (device.deviceId !== sourceDeviceId) {
                this.emit('sync:state-push', {
                    target: device.deviceId,
                    state: newState,
                    source: sourceDeviceId,
                });
            }
        }

        return newState;
    }

    // Sync auth state across all devices
    syncAuth(sourceDeviceId, authData) {
        const auth = this.stateManager.syncAuth(authData);
        this.broadcastExcept(sourceDeviceId, 'sync:auth', auth);
        return auth;
    }

    // Sync mod state across all devices
    syncMod(sourceDeviceId, modId, installed) {
        const mods = this.stateManager.syncMod(modId, installed);
        this.broadcastExcept(sourceDeviceId, 'sync:mod', { modId, installed });
        return mods;
    }

    // Sync chat message across all devices
    syncChat(sourceDeviceId, message) {
        this.stateManager.syncChatMessage(message);
        this.broadcastExcept(sourceDeviceId, 'sync:chat', message);
    }

    // Get sync status for monitoring
    getStatus() {
        const active = this.registry.listActive();
        return {
            version: SYNC_VERSION,
            syncInterval: SYNC_INTERVAL_MS,
            activeDevices: active.length,
            devices: active.map(d => ({
                id: d.deviceId,
                type: d.deviceType,
                lastSeen: d.lastSeen,
                syncState: d.syncState,
            })),
            lastSync: this.stateManager.state.lastSync,
            syncId: this.stateManager.state.syncId,
            chatMessages: this.stateManager.state.chatHistory.length,
            modsTracked: Object.keys(this.stateManager.state.mods).length,
            fsBookmarks: this.stateManager.state.fsBookmarks.length,
        };
    }

    // Internal event system
    on(event, handler) {
        if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
        this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
        const handlers = this.eventHandlers.get(event) || [];
        for (const handler of handlers) {
            try { handler(data); } catch (e) { /* swallow */ }
        }
        // Also emit to global event bus if available
        if (global.eventBus) {
            global.eventBus.emit(`device-sync:${event}`, data);
        }
    }

    broadcastExcept(excludeDeviceId, event, data) {
        const active = this.registry.listActive();
        for (const device of active) {
            if (device.deviceId !== excludeDeviceId) {
                this.emit(event, { ...data, target: device.deviceId });
            }
        }
    }
}

// ─── Utility: Deep Merge ────────────────────────────────────────────────

function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// ─── Singleton Instance ─────────────────────────────────────────────────

const syncInstance = new CrossDeviceSync();

module.exports = {
    CrossDeviceSync,
    DeviceRegistry,
    SyncStateManager,
    syncInstance,
    SYNC_VERSION,
    SYNC_INTERVAL_MS,
};
