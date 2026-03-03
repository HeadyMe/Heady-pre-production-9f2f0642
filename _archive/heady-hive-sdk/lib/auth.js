/**
 * HeadyAuth — Multi-method authentication client
 * Supports: manual login, device auth, WARP, Google OAuth
 */
class HeadyAuth {
    constructor(client) {
        this._c = client;
        this._token = null;
        this._refreshToken = null;
        this._tier = null;
    }

    /** Standard login */
    async login(username, password) {
        const res = await this._c.post("/api/auth/login", { username, password });
        if (res.token) {
            this._token = res.token;
            this._tier = res.tier;
            this._c.apiKey = res.token;
        }
        return res;
    }

    /** Device authentication flow */
    async deviceAuth(deviceId, opts = {}) {
        return this._c.post("/api/auth/device", {
            deviceId, deviceName: opts.name || "sdk-device",
            platform: opts.platform || process.platform,
        });
    }

    /** WARP (Cloudflare Zero Trust) authentication */
    async warpAuth(warpToken) {
        const res = await this._c.post("/api/auth/warp", { token: warpToken });
        if (res.token) {
            this._token = res.token;
            this._tier = res.tier;
            this._c.apiKey = res.token;
        }
        return res;
    }

    /** Google OAuth flow — get redirect URL */
    async googleAuthUrl(redirectUri) {
        return this._c.post("/api/auth/google", { redirectUri });
    }

    /** Google OAuth callback */
    async googleCallback(code) {
        const res = await this._c.post("/api/auth/google/callback", { code });
        if (res.token) {
            this._token = res.token;
            this._refreshToken = res.refreshToken;
            this._tier = res.tier;
            this._c.apiKey = res.token;
        }
        return res;
    }

    /** Verify current token */
    async verify() {
        return this._c.get("/api/auth/verify");
    }

    /** Refresh token */
    async refresh() {
        const res = await this._c.post("/api/auth/refresh", {
            refreshToken: this._refreshToken,
        });
        if (res.token) {
            this._token = res.token;
            this._c.apiKey = res.token;
        }
        return res;
    }

    /** Get active sessions */
    async sessions() {
        return this._c.get("/api/auth/sessions");
    }

    /** Current auth state */
    get token() { return this._token; }
    get tier() { return this._tier; }
    get isAuthenticated() { return !!this._token; }
}

module.exports = HeadyAuth;
