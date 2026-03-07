/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Heady Secrets Manager ═══
 *
 * Manages secrets lifecycle: registration, rotation tracking, audit, and state persistence.
 * Cloud-only — secrets sourced from environment variables and Cloudflare KV.
 *
 * Heady AI Nodes: SENTINEL, CONDUCTOR
 */

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "..", "data", "secrets-state.json");

class SecretsManager {
    constructor() {
        this._secrets = new Map();
        this._rotationLog = [];
    }

    /**
     * Register a secret for tracking.
     */
    register({ id, name, envVar, source = "env", tags = [], dependents = [] }) {
        const value = process.env[envVar] || null;
        this._secrets.set(id, {
            id,
            name,
            envVar,
            source,
            tags,
            dependents,
            present: !!value,
            maskedValue: value ? `${value.slice(0, 4)}...${value.slice(-4)}` : null,
            registeredAt: new Date().toISOString(),
            lastRotated: null,
            expiresAt: null,
        });
    }

    /**
     * Get all tracked secrets.
     */
    getAll() {
        return Array.from(this._secrets.values());
    }

    /**
     * Get a summary for dashboards.
     */
    getSummary() {
        const all = this.getAll();
        return {
            total: all.length,
            present: all.filter(s => s.present).length,
            missing: all.filter(s => !s.present).length,
            sources: [...new Set(all.map(s => s.source))],
        };
    }

    /**
     * Get a specific secret's metadata (never the raw value).
     */
    get(id) {
        return this._secrets.get(id) || null;
    }

    /**
     * Mark a secret as rotated.
     */
    rotate(id) {
        const secret = this._secrets.get(id);
        if (!secret) return false;
        secret.lastRotated = new Date().toISOString();
        this._rotationLog.push({ id, rotatedAt: secret.lastRotated });
        return true;
    }

    /**
     * Audit all secrets for expiration/warnings.
     */
    audit() {
        const all = this.getAll();
        const now = Date.now();
        const expired = all.filter(s => s.expiresAt && new Date(s.expiresAt).getTime() < now);
        const warning = all.filter(s => !s.present);
        const score = all.length > 0
            ? Math.round(((all.length - expired.length - warning.length) / all.length) * 100)
            : 100;
        return { total: all.length, expired, warning, healthy: all.length - expired.length - warning.length, score };
    }

    /**
     * Persist state to disk.
     */
    saveState() {
        try {
            const dir = path.dirname(STATE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                secrets: this.getAll(),
                rotationLog: this._rotationLog,
                savedAt: new Date().toISOString(),
            }, null, 2));
        } catch { /* non-blocking */ }
    }

    /**
     * Restore state from disk.
     */
    restoreState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
                if (data.rotationLog) this._rotationLog = data.rotationLog;
            }
        } catch { /* non-blocking */ }
    }
}

// Singleton
const secretsManager = new SecretsManager();

/**
 * Register Express routes for secrets management.
 */
function registerSecretsRoutes(app) {
    app.get("/api/secrets/status", (req, res) => {
        res.json({ ok: true, ...secretsManager.getSummary(), ts: new Date().toISOString() });
    });

    app.get("/api/secrets", (req, res) => {
        res.json({ ok: true, secrets: secretsManager.getAll() });
    });

    app.get("/api/secrets/audit", (req, res) => {
        res.json({ ok: true, ...secretsManager.audit() });
    });

    app.get("/api/secrets/:id", (req, res) => {
        const secret = secretsManager.get(req.params.id);
        if (!secret) return res.status(404).json({ error: "Secret not found" });
        res.json({ ok: true, secret });
    });

    app.post("/api/secrets/:id/refresh", (req, res) => {
        const rotated = secretsManager.rotate(req.params.id);
        secretsManager.saveState();
        res.json({ ok: rotated, message: rotated ? "Rotated" : "Secret not found" });
    });

    app.get("/api/secrets/alerts", (req, res) => {
        const audit = secretsManager.audit();
        res.json({
            ok: true,
            alerts: [
                ...audit.expired.map(s => ({ level: "critical", secret: s.id, message: `${s.name} has expired` })),
                ...audit.warning.map(s => ({ level: "warning", secret: s.id, message: `${s.name} is missing from environment` })),
            ],
        });
    });

    app.get("/api/secrets/check", (req, res) => {
        const audit = secretsManager.audit();
        res.json({ ok: audit.score >= 80, score: audit.score });
    });
}

module.exports = { secretsManager, registerSecretsRoutes, SecretsManager };
