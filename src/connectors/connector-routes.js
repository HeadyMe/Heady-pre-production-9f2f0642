/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const { ConnectorVault } = require("./connector-vault");
const { listProviders, listServices, getScopesForServices, PROVIDERS } = require("./oauth-scopes");

const vault = new ConnectorVault();

/**
 * Register connector API routes on the Express app.
 * @param {import("express").Application} app
 */
function registerConnectorRoutes(app) {

    // Auth middleware — extracts userId from Firebase token or header
    function requireUser(req, res, next) {
        const userId = req.headers["x-user-id"] || req.user?.uid;
        if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
        req.userId = userId;
        next();
    }

    // ════════ Discovery ════════

    /** List all available providers */
    app.get("/api/connectors/providers", (_req, res) => {
        res.json({ ok: true, providers: listProviders() });
    });

    /** List available services for a provider */
    app.get("/api/connectors/providers/:providerId/services", (req, res) => {
        const businessMode = req.query.business === "true";
        const services = listServices(req.params.providerId, { businessMode });
        if (!PROVIDERS[req.params.providerId]) {
            return res.status(404).json({ ok: false, error: "provider not found" });
        }
        res.json({ ok: true, providerId: req.params.providerId, services });
    });

    /** Get the scopes needed for selected services */
    app.post("/api/connectors/providers/:providerId/scopes", (req, res) => {
        const { services } = req.body || {};
        if (!Array.isArray(services)) return res.status(400).json({ ok: false, error: "services array required" });
        const scopes = getScopesForServices(req.params.providerId, services);
        res.json({ ok: true, providerId: req.params.providerId, services, scopes });
    });

    // ════════ User Connectors ════════

    /** List connected providers for the current user */
    app.get("/api/connectors/me", requireUser, (req, res) => {
        const connectors = vault.listConnectors(req.userId);
        res.json({ ok: true, userId: req.userId, connectors });
    });

    /** Store or update a connector after OAuth consent */
    app.post("/api/connectors/me/:providerId", requireUser, (req, res) => {
        try {
            const { accessToken, refreshToken, expiresAt, grantedServices, scopes, providerUid, email } = req.body || {};
            const result = vault.storeConnector(req.userId, {
                providerId: req.params.providerId,
                accessToken,
                refreshToken,
                expiresAt,
                grantedServices: grantedServices || [],
                scopes: scopes || [],
                providerUid,
                email,
            });
            res.json(result);
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    /** Get decrypted token for a provider (internal use / bees) */
    app.get("/api/connectors/me/:providerId/token", requireUser, (req, res) => {
        try {
            const token = vault.getToken(req.userId, req.params.providerId);
            res.json({ ok: true, ...token });
        } catch (err) {
            res.status(404).json({ ok: false, error: err.message });
        }
    });

    /** Refresh a token */
    app.post("/api/connectors/me/:providerId/refresh", requireUser, (req, res) => {
        try {
            const { accessToken, expiresAt } = req.body || {};
            const result = vault.refreshToken(req.userId, req.params.providerId, { accessToken, expiresAt });
            res.json(result);
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    /** Update granted services for a connector */
    app.patch("/api/connectors/me/:providerId/services", requireUser, (req, res) => {
        try {
            const { add, remove } = req.body || {};
            const result = vault.updateServices(req.userId, req.params.providerId, { add, remove });
            res.json(result);
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    /** Revoke / disconnect a provider */
    app.delete("/api/connectors/me/:providerId", requireUser, (req, res) => {
        try {
            const result = vault.revokeConnector(req.userId, req.params.providerId);
            res.json(result);
        } catch (err) {
            res.status(404).json({ ok: false, error: err.message });
        }
    });

    // ════════ Health ════════

    app.get("/api/connectors/health", (_req, res) => {
        res.json(vault.getHealth());
    });

    try {
        require("../utils/logger").logSystem("🔌 Connector routes registered: providers, services, token vault, health");
    } catch {
        console.log("🔌 Connector routes registered");
    }
}

module.exports = { registerConnectorRoutes, vault };
