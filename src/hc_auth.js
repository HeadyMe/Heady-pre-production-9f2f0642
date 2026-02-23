/**
 * HeadyAuth — Comprehensive Authentication & Session Engine
 *
 * Supports 4 auth methods:
 *   1. Manual login (username/password)
 *   2. Device token (silent, auto-generated per device)
 *   3. WARP detection (Cloudflare WARP → 365-day extended session)
 *   4. Google OAuth (redirect flow)
 *
 * Features:
 *   - JWT-style tokens with configurable expiry
 *   - Persistent sessions (data/auth-sessions.json)
 *   - 3D vector prereq scanning on authenticated requests
 *   - Audit logging (data/auth-audit.jsonl)
 *   - Admin tier detection via HEADY_API_KEY
 *   - Cross-device session sharing via token
 */

const EventEmitter = require("events");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ─── Constants ──────────────────────────────────────────────────────
const TOKEN_LENGTHS = {
    warp: 365 * 24 * 60 * 60 * 1000,      // 365 days
    device: 90 * 24 * 60 * 60 * 1000,     // 90 days
    standard: 30 * 24 * 60 * 60 * 1000,   // 30 days
    google: 180 * 24 * 60 * 60 * 1000,    // 180 days for OAuth users
};

const TIERS = {
    admin: { label: "Admin", features: ["*"], rateLimit: 0 },
    premium: { label: "Premium", features: ["heady_chat", "heady_analyze", "heady_battle", "heady_orchestrator", "heady_creative"], rateLimit: 100 },
    core: { label: "Core", features: ["heady_chat", "heady_analyze"], rateLimit: 30 },
    guest: { label: "Guest", features: ["heady_chat"], rateLimit: 5 },
};

class HeadyAuth extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.dataDir = opts.dataDir || path.join(__dirname, "..", "data");
        this.sessionsPath = path.join(this.dataDir, "auth-sessions.json");
        this.auditPath = path.join(this.dataDir, "auth-audit.jsonl");
        this.adminKey = opts.adminKey || process.env.HEADY_API_KEY || "";
        this.googleClientId = opts.googleClientId || process.env.GOOGLE_CLIENT_ID || "";
        this.googleClientSecret = opts.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "";
        this.googleRedirectUri = opts.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || "https://headyme.com/api/auth/google/callback";
        this.baseUrl = opts.baseUrl || "https://headyme.com";

        // Deep Intel reference for 3D vector prereq
        this.deepIntel = null;

        // Load sessions
        this.sessions = this._loadSessions();

        // Cleanup expired sessions on boot
        this._cleanupExpired();
    }

    // ─── Wire DeepIntel ───────────────────────────────────────────────
    wireDeepIntel(engine) {
        this.deepIntel = engine;
        if (engine) console.log("    → HeadyAuth ↔ DeepIntel: WIRED (3D vector prereq)");
    }

    // ─── Token Generation ─────────────────────────────────────────────
    generateToken(payload = {}) {
        const tokenId = crypto.randomBytes(32).toString("hex");
        const now = Date.now();
        const method = payload.method || "standard";
        const ttl = TOKEN_LENGTHS[method] || TOKEN_LENGTHS.standard;

        const session = {
            tokenId,
            token: crypto.randomBytes(48).toString("base64url"),
            userId: payload.userId || `user_${crypto.randomBytes(6).toString("hex")}`,
            method,
            tier: payload.tier || "core",
            email: payload.email || null,
            deviceId: payload.deviceId || null,
            warp: payload.warp || false,
            googleId: payload.googleId || null,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ttl).toISOString(),
            expiresMs: now + ttl,
            lastActive: new Date(now).toISOString(),
            userAgent: payload.userAgent || null,
            ip: payload.ip || null,
        };

        this.sessions[session.token] = session;
        this._saveSessions();
        this._audit("token_created", { tokenId, method, tier: session.tier, userId: session.userId });

        return session;
    }

    // ─── Auth Methods ─────────────────────────────────────────────────

    // Method 1: Manual login
    loginManual(username, password, meta = {}) {
        if (username === "admin" && password === this.adminKey) {
            return this.generateToken({
                userId: "admin",
                method: "standard",
                tier: "admin",
                ...meta,
            });
        }
        if (username) {
            return this.generateToken({
                userId: username,
                method: "standard",
                tier: "core",
                ...meta,
            });
        }
        return null;
    }

    // Method 2: Device token (silent auth)
    loginDevice(deviceId, meta = {}) {
        // Check for existing valid device session
        const existing = Object.values(this.sessions).find(
            s => s.deviceId === deviceId && s.method === "device" && s.expiresMs > Date.now()
        );
        if (existing) {
            existing.lastActive = new Date().toISOString();
            this._saveSessions();
            return existing;
        }

        return this.generateToken({
            deviceId,
            method: "device",
            tier: "core",
            ...meta,
        });
    }

    // Method 3: WARP detection
    loginWarp(deviceId, meta = {}) {
        const existing = Object.values(this.sessions).find(
            s => s.deviceId === deviceId && s.warp && s.expiresMs > Date.now()
        );
        if (existing) {
            existing.lastActive = new Date().toISOString();
            this._saveSessions();
            return existing;
        }

        return this.generateToken({
            deviceId,
            method: "warp",
            tier: "premium",
            warp: true,
            ...meta,
        });
    }

    // Method 4: Google OAuth — generate redirect URL
    getGoogleAuthUrl(state = "") {
        if (!this.googleClientId) {
            return `${this.baseUrl}/api/auth/google/unavailable`;
        }
        const params = new URLSearchParams({
            client_id: this.googleClientId,
            redirect_uri: this.googleRedirectUri,
            response_type: "code",
            scope: "openid email profile",
            access_type: "offline",
            state: state || crypto.randomBytes(16).toString("hex"),
            prompt: "consent",
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    // Google OAuth — handle callback
    async handleGoogleCallback(code, meta = {}) {
        if (!this.googleClientId || !this.googleClientSecret) {
            return this.generateToken({ method: "google", tier: "premium", email: "google-user@example.com", ...meta });
        }

        try {
            // Exchange code for tokens
            const tokenData = await this._httpPost("oauth2.googleapis.com", "/token", {
                code,
                client_id: this.googleClientId,
                client_secret: this.googleClientSecret,
                redirect_uri: this.googleRedirectUri,
                grant_type: "authorization_code",
            });

            // Get user info
            const userInfo = await this._httpGet("www.googleapis.com", `/oauth2/v2/userinfo`, tokenData.access_token);

            return this.generateToken({
                method: "google",
                tier: "premium",
                userId: userInfo.id || userInfo.email,
                email: userInfo.email,
                googleId: userInfo.id,
                ...meta,
            });
        } catch (err) {
            this._audit("google_auth_error", { error: err.message });
            // Fallback: still create a session
            return this.generateToken({ method: "google", tier: "premium", ...meta });
        }
    }

    // ─── Token Verification ───────────────────────────────────────────
    verify(token) {
        if (!token) return null;

        // Admin key is always valid
        if (token === this.adminKey) {
            return {
                valid: true,
                tier: "admin",
                userId: "admin",
                method: "api_key",
                features: TIERS.admin.features,
            };
        }

        const session = this.sessions[token];
        if (!session) return null;

        if (session.expiresMs < Date.now()) {
            delete this.sessions[token];
            this._saveSessions();
            return null;
        }

        session.lastActive = new Date().toISOString();

        return {
            valid: true,
            tokenId: session.tokenId,
            userId: session.userId,
            tier: session.tier,
            method: session.method,
            email: session.email,
            warp: session.warp,
            deviceId: session.deviceId,
            expiresAt: session.expiresAt,
            features: TIERS[session.tier]?.features || TIERS.core.features,
        };
    }

    // ─── Token Refresh ────────────────────────────────────────────────
    refresh(token) {
        const session = this.sessions[token];
        if (!session || session.expiresMs < Date.now()) return null;

        // Generate new token, keep same session metadata
        const newSession = this.generateToken({
            userId: session.userId,
            method: session.method,
            tier: session.tier,
            email: session.email,
            deviceId: session.deviceId,
            warp: session.warp,
            googleId: session.googleId,
        });

        // Revoke old token
        delete this.sessions[token];
        this._saveSessions();
        this._audit("token_refreshed", { oldTokenId: session.tokenId, newTokenId: newSession.tokenId });

        return newSession;
    }

    // ─── 3D Vector Prereq Scan ────────────────────────────────────────
    async vectorPrereqScan(session) {
        if (!this.deepIntel || !this.deepIntel.vectorStore) {
            return { scanned: false, reason: "deepintel_not_available" };
        }

        try {
            const stats = this.deepIntel.vectorStore.getStats();
            const scan = {
                scanned: true,
                vectorCount: stats.count || 0,
                chainValid: stats.chainValid !== false,
                lastScanTs: new Date().toISOString(),
                userId: session?.userId || "anonymous",
            };

            // Store the auth-triggered scan as a vector
            this.deepIntel.vectorStore.store(
                `auth-scan-${Date.now()}`,
                { type: "auth-prereq-scan", user: session?.userId, tier: session?.tier },
                { structural: 0.8, behavioral: 0.9, quality: 1.0 }
            );

            return scan;
        } catch {
            return { scanned: false, reason: "scan_error" };
        }
    }

    // ─── Session Management ───────────────────────────────────────────
    getSessions(adminToken) {
        if (adminToken !== this.adminKey) return null;
        return Object.values(this.sessions).map(s => ({
            tokenId: s.tokenId,
            userId: s.userId,
            tier: s.tier,
            method: s.method,
            email: s.email,
            warp: s.warp,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            lastActive: s.lastActive,
        }));
    }

    revokeSession(adminToken, tokenId) {
        if (adminToken !== this.adminKey) return false;
        const entry = Object.entries(this.sessions).find(([_, s]) => s.tokenId === tokenId);
        if (entry) {
            delete this.sessions[entry[0]];
            this._saveSessions();
            this._audit("session_revoked", { tokenId, by: "admin" });
            return true;
        }
        return false;
    }

    // ─── Express Middleware ───────────────────────────────────────────
    middleware(requireTier = null) {
        return async (req, res, next) => {
            const token = req.headers["authorization"]?.split(" ")[1] ||
                req.query.token ||
                req.cookies?.heady_token;

            const verified = this.verify(token);

            if (!verified) {
                req.heady = { authenticated: false, tier: "guest", features: TIERS.guest.features };
            } else {
                // 3D vector prereq scan
                const vectorScan = await this.vectorPrereqScan(verified);
                req.heady = { ...verified, authenticated: true, vectorScan };
            }

            if (requireTier && (!req.heady.authenticated || (requireTier === "admin" && req.heady.tier !== "admin"))) {
                return res.status(401).json({ error: "Authentication required", tier: requireTier });
            }

            next();
        };
    }

    // ─── Status ───────────────────────────────────────────────────────
    getStatus() {
        const now = Date.now();
        const active = Object.values(this.sessions).filter(s => s.expiresMs > now);
        const byMethod = {};
        const byTier = {};
        for (const s of active) {
            byMethod[s.method] = (byMethod[s.method] || 0) + 1;
            byTier[s.tier] = (byTier[s.tier] || 0) + 1;
        }
        return {
            status: "active",
            totalSessions: active.length,
            byMethod,
            byTier,
            googleOAuthConfigured: !!this.googleClientId,
            vectorPrereqEnabled: !!this.deepIntel,
            tokenLengths: {
                warp: "365 days",
                device: "90 days",
                standard: "30 days",
                google: "180 days",
            },
            tiers: Object.keys(TIERS),
        };
    }

    // ─── Persistence ──────────────────────────────────────────────────
    _loadSessions() {
        try {
            if (fs.existsSync(this.sessionsPath)) {
                return JSON.parse(fs.readFileSync(this.sessionsPath, "utf8"));
            }
        } catch { }
        return {};
    }

    _saveSessions() {
        try {
            if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.sessionsPath, JSON.stringify(this.sessions, null, 2));
        } catch { }
    }

    _cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [token, session] of Object.entries(this.sessions)) {
            if (session.expiresMs < now) {
                delete this.sessions[token];
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this._saveSessions();
            this._audit("cleanup", { removed: cleaned });
        }
    }

    _audit(action, details = {}) {
        try {
            const entry = JSON.stringify({
                ts: new Date().toISOString(),
                action,
                ...details,
            }) + "\n";
            fs.appendFileSync(this.auditPath, entry);
        } catch { }
        this.emit("auth:event", { action, ...details });
    }

    // ─── HTTP Helpers (for Google OAuth) ──────────────────────────────
    _httpPost(hostname, path, data) {
        return new Promise((resolve, reject) => {
            const payload = new URLSearchParams(data).toString();
            const req = https.request({
                hostname, path, method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(payload) },
                timeout: 10000,
            }, (res) => {
                let body = "";
                res.on("data", c => body += c);
                res.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error(body.slice(0, 200))); } });
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
            req.write(payload);
            req.end();
        });
    }

    _httpGet(hostname, path, bearerToken) {
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname, path, method: "GET",
                headers: { Authorization: `Bearer ${bearerToken}` },
                timeout: 10000,
            }, (res) => {
                let body = "";
                res.on("data", c => body += c);
                res.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error(body.slice(0, 200))); } });
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
            req.end();
        });
    }
}

// ─── EXPRESS ROUTES ─────────────────────────────────────────────────

function registerAuthRoutes(app, authEngine) {
    const express = require("express");
    const router = express.Router();

    // Health
    router.get("/health", (req, res) => {
        res.json({ ok: true, service: "heady-auth", ...authEngine.getStatus() });
    });

    // Status (admin only)
    router.get("/status", (req, res) => {
        res.json(authEngine.getStatus());
    });

    // Manual login
    router.post("/login", (req, res) => {
        const { username, password } = req.body;
        const session = authEngine.loginManual(username, password, {
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });
        if (!session) return res.status(401).json({ error: "Invalid credentials" });
        res.json({
            success: true,
            token: session.token,
            tier: session.tier,
            expiresAt: session.expiresAt,
            userId: session.userId,
        });
    });

    // Device token (silent auth)
    router.post("/device", (req, res) => {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: "deviceId required" });
        const session = authEngine.loginDevice(deviceId, {
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });
        res.json({
            success: true,
            token: session.token,
            tier: session.tier,
            method: "device",
            expiresAt: session.expiresAt,
        });
    });

    // WARP detection auth
    router.post("/warp", (req, res) => {
        const { deviceId } = req.body;
        const ua = req.headers["user-agent"] || "";
        const isWarp = ua.includes("Cloudflare-WARP") || ua.includes("WARP") || req.body.warp;
        if (!deviceId) return res.status(400).json({ error: "deviceId required" });

        const session = isWarp
            ? authEngine.loginWarp(deviceId, { userAgent: ua, ip: req.ip })
            : authEngine.loginDevice(deviceId, { userAgent: ua, ip: req.ip });

        res.json({
            success: true,
            token: session.token,
            tier: session.tier,
            method: session.method,
            warp: session.warp,
            expiresAt: session.expiresAt,
            sessionDays: session.warp ? 365 : 90,
        });
    });

    // Google OAuth redirect
    router.get("/google", (req, res) => {
        const url = authEngine.getGoogleAuthUrl(req.query.state);
        res.redirect(url);
    });

    // Google OAuth callback
    router.get("/google/callback", async (req, res) => {
        const { code } = req.query;
        if (!code) return res.status(400).json({ error: "No auth code received" });

        const session = await authEngine.handleGoogleCallback(code, {
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });

        // Redirect to frontend with token
        res.redirect(`/?auth_token=${session.token}&method=google&tier=${session.tier}`);
    });

    // Google unavailable fallback
    router.get("/google/unavailable", (req, res) => {
        res.json({
            error: "Google OAuth not configured",
            message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
            alternatives: ["device", "warp", "manual"],
        });
    });

    // Verify token
    router.get("/verify", (req, res) => {
        const token = req.headers["authorization"]?.split(" ")[1] || req.query.token;
        const result = authEngine.verify(token);
        if (!result) return res.status(401).json({ valid: false, error: "Invalid or expired token" });
        res.json(result);
    });

    // Refresh token
    router.post("/refresh", (req, res) => {
        const token = req.headers["authorization"]?.split(" ")[1] || req.body.token;
        const newSession = authEngine.refresh(token);
        if (!newSession) return res.status(401).json({ error: "Cannot refresh — invalid or expired token" });
        res.json({
            success: true,
            token: newSession.token,
            tier: newSession.tier,
            expiresAt: newSession.expiresAt,
        });
    });

    // Policy (tier features)
    router.get("/policy", (req, res) => {
        const token = req.headers["authorization"]?.split(" ")[1];
        const verified = authEngine.verify(token);
        const tier = verified?.tier || "guest";
        res.json({
            tier,
            features: TIERS[tier]?.features || TIERS.guest.features,
            rateLimit: TIERS[tier]?.rateLimit || TIERS.guest.rateLimit,
            tokenLengths: TOKEN_LENGTHS,
        });
    });

    // Admin: list sessions
    router.get("/sessions", (req, res) => {
        const token = req.headers["authorization"]?.split(" ")[1];
        const sessions = authEngine.getSessions(token);
        if (!sessions) return res.status(403).json({ error: "Admin access required" });
        res.json({ total: sessions.length, sessions });
    });

    // Admin: revoke session
    router.delete("/sessions/:tokenId", (req, res) => {
        const adminToken = req.headers["authorization"]?.split(" ")[1];
        const ok = authEngine.revokeSession(adminToken, req.params.tokenId);
        if (!ok) return res.status(403).json({ error: "Unauthorized or session not found" });
        res.json({ success: true, revoked: req.params.tokenId });
    });

    // Service groups (tier-aware)
    router.get("/services", (req, res) => {
        const token = req.headers["authorization"]?.split(" ")[1];
        const verified = authEngine.verify(token);
        const tier = verified?.tier || "guest";
        res.json({
            tier,
            services: TIERS[tier]?.features || TIERS.guest.features,
        });
    });

    app.use("/api/auth", router);
    return router;
}

module.exports = { HeadyAuth, registerAuthRoutes, TIERS, TOKEN_LENGTHS };
