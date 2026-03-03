/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Cloudflare Manager ═══
 *
 * Manages Cloudflare API interactions: zone management, DNS, tunnel status,
 * token validation, and KV operations. Cloud-only operations.
 *
 * Heady AI Nodes: SENTINEL, CONDUCTOR
 */

const fetch = require("node-fetch");

class CloudflareManager {
    constructor(secretsManager) {
        this._secretsManager = secretsManager;
        this._token = process.env.CLOUDFLARE_API_TOKEN || null;
        this._accountId = process.env.CLOUDFLARE_ACCOUNT_ID || null;
        this.expiresAt = null;
        this._zones = [];
    }

    isTokenValid() {
        if (!this._token) return false;
        if (this.expiresAt && new Date(this.expiresAt).getTime() < Date.now()) return false;
        return true;
    }

    _timeUntil(dateStr) {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return "expired";
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(hours / 24);
        return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
    }

    async verifyToken() {
        if (!this._token) return { valid: false, error: "No token configured" };
        try {
            const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
                headers: { Authorization: `Bearer ${this._token}` },
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            return { valid: data.success, status: data.result?.status || "unknown" };
        } catch (err) {
            return { valid: false, error: err.message };
        }
    }

    async listZones() {
        if (!this._token) return [];
        try {
            const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
                headers: { Authorization: `Bearer ${this._token}` },
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            this._zones = data.result || [];
            return this._zones;
        } catch {
            return this._zones;
        }
    }

    getStatus() {
        return {
            tokenPresent: !!this._token,
            tokenValid: this.isTokenValid(),
            accountId: this._accountId ? `${this._accountId.slice(0, 6)}...` : null,
            cachedZones: this._zones.length,
            expiresAt: this.expiresAt,
            expiresIn: this.expiresAt ? this._timeUntil(this.expiresAt) : null,
        };
    }
}

function registerCloudflareRoutes(app, cfManager) {
    app.get("/api/cloudflare/status", (req, res) => {
        res.json({ ok: true, ...cfManager.getStatus(), ts: new Date().toISOString() });
    });

    app.post("/api/cloudflare/verify", async (req, res) => {
        const result = await cfManager.verifyToken();
        res.json({ ok: result.valid, ...result });
    });

    app.get("/api/cloudflare/zones", async (req, res) => {
        const zones = await cfManager.listZones();
        res.json({ ok: true, zones: zones.map(z => ({ id: z.id, name: z.name, status: z.status })), count: zones.length });
    });

    app.post("/api/cloudflare/refresh", async (req, res) => {
        const verification = await cfManager.verifyToken();
        res.json({ ok: verification.valid, ...verification, message: verification.valid ? "Token valid" : "Token needs rotation" });
    });

    app.get("/api/cloudflare/domains", async (req, res) => {
        const zones = await cfManager.listZones();
        res.json({ ok: true, domains: zones.map(z => z.name), count: zones.length });
    });
}

module.exports = { CloudflareManager, registerCloudflareRoutes };
