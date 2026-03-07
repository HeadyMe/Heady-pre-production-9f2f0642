/**
 * E4: API Key Rotation Utility
 * Manages short-lived token generation, rotation schedules, and key lifecycle.
 * @module src/lib/key-rotation
 */
'use strict';

const crypto = require('crypto');

const KEY_TTL_MS = parseInt(process.env.KEY_TTL_MS || String(24 * 60 * 60 * 1000), 10); // 24h default
const ROTATION_WARN_MS = KEY_TTL_MS * 0.8;

class KeyRotationManager {
    constructor() {
        this._keys = new Map(); // name → { current, previous, createdAt, expiresAt }
        this._schedules = [];
    }

    generateKey(prefix = 'hdy') {
        const token = crypto.randomBytes(32).toString('base64url');
        return `${prefix}_${token}`;
    }

    registerKey(name, currentValue) {
        const now = Date.now();
        this._keys.set(name, {
            current: currentValue || this.generateKey(),
            previous: null,
            createdAt: now,
            expiresAt: now + KEY_TTL_MS,
            rotationCount: 0,
        });
        return this._keys.get(name);
    }

    rotate(name) {
        const entry = this._keys.get(name);
        if (!entry) throw new Error(`Key "${name}" not registered`);
        entry.previous = entry.current;
        entry.current = this.generateKey();
        entry.createdAt = Date.now();
        entry.expiresAt = Date.now() + KEY_TTL_MS;
        entry.rotationCount++;
        console.log(`[KEY-ROTATION] Rotated "${name}" (count: ${entry.rotationCount})`);
        return entry;
    }

    validate(name, token) {
        const entry = this._keys.get(name);
        if (!entry) return false;
        return token === entry.current || token === entry.previous;
    }

    getStatus() {
        const now = Date.now();
        const status = {};
        for (const [name, entry] of this._keys) {
            const remaining = entry.expiresAt - now;
            status[name] = {
                isExpired: remaining <= 0,
                needsRotation: remaining <= ROTATION_WARN_MS - KEY_TTL_MS + ROTATION_WARN_MS,
                expiresIn: Math.max(0, Math.round(remaining / 1000)) + 's',
                rotationCount: entry.rotationCount,
            };
        }
        return status;
    }

    startAutoRotation(name, intervalMs = KEY_TTL_MS) {
        const timer = setInterval(() => this.rotate(name), intervalMs);
        timer.unref();
        this._schedules.push(timer);
        return timer;
    }

    stopAll() {
        this._schedules.forEach(t => clearInterval(t));
        this._schedules = [];
    }
}

module.exports = new KeyRotationManager();
