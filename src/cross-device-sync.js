'use strict';

/**
 * CrossDeviceSyncHub — Synchronizes state (buddy sessions, user preferences,
 * config snapshots) across multiple devices for the same user.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const SYNC_EVENT_TYPES = {
  SESSION_UPDATE: 'session_update',
  PREFERENCE_UPDATE: 'preference_update',
  HISTORY_SYNC: 'history_sync',
  CONTEXT_UPDATE: 'context_update',
  DEVICE_REGISTERED: 'device_registered',
  DEVICE_REMOVED: 'device_removed',
};

class CrossDeviceSyncHub extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._users = new Map();     // userId → UserSyncRecord
    this._devices = new Map();   // deviceId → DeviceRecord
    this._syncLog = [];
    this._maxSyncLog = opts.maxSyncLog || 5000;
    this._redisClient = opts.redis || null; // Optional Redis for pub/sub
    this._stats = { syncs: 0, devices: 0, users: 0, errors: 0 };

    // Long-poll queues for devices awaiting updates
    this._pendingRequests = new Map(); // deviceId → [{ resolve, ts }]
    this._deviceEvents = new Map();    // deviceId → [SyncEvent]
  }

  // ─── Device management ─────────────────────────────────────────────────────

  registerDevice(userId, deviceId, meta = {}) {
    if (!userId || !deviceId) throw new Error('userId and deviceId required');

    // User record
    if (!this._users.has(userId)) {
      this._users.set(userId, { id: userId, devices: new Set(), preferences: {}, state: {}, createdAt: new Date().toISOString() });
      this._stats.users++;
    }
    const user = this._users.get(userId);
    user.devices.add(deviceId);

    // Device record
    const device = {
      id: deviceId,
      userId,
      name: meta.name || 'Unknown Device',
      platform: meta.platform || 'unknown',
      userAgent: meta.userAgent || null,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      active: true,
    };
    this._devices.set(deviceId, device);
    this._stats.devices++;

    this._log(userId, deviceId, SYNC_EVENT_TYPES.DEVICE_REGISTERED, { deviceName: device.name });
    this.emit('device-registered', { userId, deviceId });
    return device;
  }

  removeDevice(deviceId) {
    const device = this._devices.get(deviceId);
    if (!device) return false;
    const user = this._users.get(device.userId);
    if (user) user.devices.delete(deviceId);
    this._devices.delete(deviceId);
    this._log(device.userId, deviceId, SYNC_EVENT_TYPES.DEVICE_REMOVED, {});
    this.emit('device-removed', { userId: device.userId, deviceId });
    return true;
  }

  getDevice(deviceId) {
    return this._devices.get(deviceId) || null;
  }

  getUserDevices(userId) {
    const user = this._users.get(userId);
    if (!user) return [];
    return Array.from(user.devices)
      .map(id => this._devices.get(id))
      .filter(Boolean);
  }

  // ─── State sync ────────────────────────────────────────────────────────────

  /**
   * Publish a sync event for all of a user's devices.
   */
  publish(userId, eventType, payload, sourceDeviceId = null) {
    const user = this._users.get(userId);
    if (!user) return 0;

    const event = {
      id: 'sync_' + crypto.randomBytes(6).toString('hex'),
      userId,
      sourceDeviceId,
      type: eventType,
      payload,
      ts: new Date().toISOString(),
    };

    this._log(userId, sourceDeviceId, eventType, payload);
    this._stats.syncs++;

    let notified = 0;
    for (const deviceId of user.devices) {
      if (deviceId === sourceDeviceId) continue; // don't echo back to source

      // Queue event for device
      if (!this._deviceEvents.has(deviceId)) this._deviceEvents.set(deviceId, []);
      this._deviceEvents.get(deviceId).push(event);

      // Resolve any long-poll waiting
      const pending = this._pendingRequests.get(deviceId);
      if (pending && pending.length > 0) {
        const { resolve } = pending.shift();
        resolve([event]);
        if (pending.length === 0) this._pendingRequests.delete(deviceId);
      }

      notified++;
    }

    this.emit('published', { userId, eventType, notified });
    return notified;
  }

  /**
   * Update user preferences (shared across all devices).
   */
  updatePreferences(userId, preferences) {
    const user = this._users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    user.preferences = { ...user.preferences, ...preferences };
    this.publish(userId, SYNC_EVENT_TYPES.PREFERENCE_UPDATE, { preferences: user.preferences });
    return user.preferences;
  }

  /**
   * Update user state (e.g., buddy session, current context).
   */
  updateState(userId, stateUpdates, sourceDeviceId = null) {
    const user = this._users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    user.state = { ...user.state, ...stateUpdates, updatedAt: new Date().toISOString() };
    this.publish(userId, SYNC_EVENT_TYPES.CONTEXT_UPDATE, { state: stateUpdates }, sourceDeviceId);
    return user.state;
  }

  /**
   * Get pending events for a device (and clear them).
   */
  getPendingEvents(deviceId, limit = 50) {
    const device = this._devices.get(deviceId);
    if (device) device.lastSeen = new Date().toISOString();

    const events = this._deviceEvents.get(deviceId) || [];
    const pending = events.splice(0, limit);
    if (events.length === 0) this._deviceEvents.delete(deviceId);
    return pending;
  }

  /**
   * Long-poll: wait for new events (resolved when events arrive or timeout).
   */
  async waitForEvents(deviceId, timeoutMs = 30000) {
    const existing = this.getPendingEvents(deviceId);
    if (existing.length > 0) return existing;

    return new Promise((resolve) => {
      if (!this._pendingRequests.has(deviceId)) this._pendingRequests.set(deviceId, []);
      const entry = { resolve, ts: Date.now() };
      this._pendingRequests.get(deviceId).push(entry);

      setTimeout(() => {
        const list = this._pendingRequests.get(deviceId);
        if (list) {
          const idx = list.indexOf(entry);
          if (idx !== -1) list.splice(idx, 1);
          if (list.length === 0) this._pendingRequests.delete(deviceId);
        }
        resolve([]); // timeout — no events
      }, timeoutMs);
    });
  }

  getUserState(userId) {
    const user = this._users.get(userId);
    if (!user) return null;
    return {
      id: user.id,
      preferences: user.preferences,
      state: user.state,
      deviceCount: user.devices.size,
      createdAt: user.createdAt,
    };
  }

  _log(userId, deviceId, type, payload) {
    this._syncLog.push({ userId, deviceId, type, payload, ts: new Date().toISOString() });
    if (this._syncLog.length > this._maxSyncLog) this._syncLog.shift();
  }

  getSyncLog(userId, limit = 100) {
    let log = this._syncLog;
    if (userId) log = log.filter(l => l.userId === userId);
    return log.slice(-limit).reverse();
  }

  getStats() {
    return {
      ...this._stats,
      connectedDevices: this._devices.size,
      pendingEventQueues: this._deviceEvents.size,
      syncLogSize: this._syncLog.length,
    };
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app) {
    /** POST /api/sync/devices — register a device */
    app.post('/api/sync/devices', (req, res) => {
      try {
        const { userId, deviceId, ...meta } = req.body || {};
        if (!userId || !deviceId) return res.status(400).json({ ok: false, error: 'userId and deviceId required' });
        const device = this.registerDevice(userId, deviceId, meta);
        res.status(201).json({ ok: true, device });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** DELETE /api/sync/devices/:deviceId */
    app.delete('/api/sync/devices/:deviceId', (req, res) => {
      const removed = this.removeDevice(req.params.deviceId);
      res.json({ ok: removed, deviceId: req.params.deviceId });
    });

    /** GET /api/sync/devices/:deviceId */
    app.get('/api/sync/devices/:deviceId', (req, res) => {
      const device = this.getDevice(req.params.deviceId);
      if (!device) return res.status(404).json({ ok: false, error: 'Device not found' });
      res.json({ ok: true, device });
    });

    /** GET /api/sync/users/:userId/devices */
    app.get('/api/sync/users/:userId/devices', (req, res) => {
      res.json({ ok: true, devices: this.getUserDevices(req.params.userId) });
    });

    /** GET /api/sync/users/:userId/state */
    app.get('/api/sync/users/:userId/state', (req, res) => {
      const state = this.getUserState(req.params.userId);
      if (!state) return res.status(404).json({ ok: false, error: 'User not found' });
      res.json({ ok: true, ...state });
    });

    /** PUT /api/sync/users/:userId/preferences */
    app.put('/api/sync/users/:userId/preferences', (req, res) => {
      try {
        const preferences = this.updatePreferences(req.params.userId, req.body || {});
        res.json({ ok: true, preferences });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/sync/users/:userId/state */
    app.post('/api/sync/users/:userId/state', (req, res) => {
      try {
        const { state, sourceDeviceId } = req.body || {};
        const updated = this.updateState(req.params.userId, state || req.body, sourceDeviceId);
        res.json({ ok: true, state: updated });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/sync/devices/:deviceId/events — poll for events */
    app.get('/api/sync/devices/:deviceId/events', async (req, res) => {
      const longPoll = req.query.wait === 'true';
      const timeout = parseInt(req.query.timeout) || 20000;

      if (longPoll) {
        const events = await this.waitForEvents(req.params.deviceId, Math.min(timeout, 30000));
        return res.json({ ok: true, events });
      }

      const events = this.getPendingEvents(req.params.deviceId);
      res.json({ ok: true, events });
    });

    /** POST /api/sync/publish — publish an event to all of a user's devices */
    app.post('/api/sync/publish', (req, res) => {
      try {
        const { userId, eventType, payload, sourceDeviceId } = req.body || {};
        if (!userId || !eventType) return res.status(400).json({ ok: false, error: 'userId and eventType required' });
        const notified = this.publish(userId, eventType, payload || {}, sourceDeviceId);
        res.json({ ok: true, notified });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/sync/log — sync log */
    app.get('/api/sync/log', (req, res) => {
      const { userId, limit } = req.query;
      res.json({ ok: true, log: this.getSyncLog(userId, parseInt(limit) || 100) });
    });

    /** GET /api/sync/stats */
    app.get('/api/sync/stats', (req, res) => {
      res.json({ ok: true, stats: this.getStats() });
    });

    return app;
  }
}

let _instance = null;
function getCrossDeviceSyncHub(opts) {
  if (!_instance) _instance = new CrossDeviceSyncHub(opts);
  return _instance;
}

module.exports = { CrossDeviceSyncHub, getCrossDeviceSyncHub, SYNC_EVENT_TYPES };
