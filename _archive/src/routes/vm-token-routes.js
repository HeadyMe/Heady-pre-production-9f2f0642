/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ VM Token Routes ═══
 *
 * GitHub App-based token generation for VM/CI operations.
 * Issues short-lived installation tokens via GitHub App credentials.
 *
 * Heady AI Nodes: SENTINEL, CONDUCTOR
 */

const express = require("express");
const { createAppAuth } = require("@octokit/auth-app");

function createVmTokenRoutes(secretsManager) {
    const router = express.Router();

    const APP_ID = process.env.GITHUB_APP_ID;
    const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
    const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID;

    router.get("/health", (req, res) => {
        res.json({
            ok: true,
            service: "heady-vm-token",
            configured: !!(APP_ID && PRIVATE_KEY && INSTALLATION_ID),
            appId: APP_ID ? `${APP_ID.slice(0, 3)}...` : null,
            ts: new Date().toISOString(),
        });
    });

    router.post("/generate", async (req, res) => {
        if (!APP_ID || !PRIVATE_KEY || !INSTALLATION_ID) {
            return res.status(503).json({
                ok: false,
                error: "GitHub App credentials not configured",
                required: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_INSTALLATION_ID"],
            });
        }

        try {
            const auth = createAppAuth({
                appId: APP_ID,
                privateKey: PRIVATE_KEY,
                installationId: INSTALLATION_ID,
            });

            const installationAuth = await auth({ type: "installation" });

            res.json({
                ok: true,
                token: installationAuth.token,
                expiresAt: installationAuth.expiresAt,
                permissions: installationAuth.permissions || {},
                ts: new Date().toISOString(),
            });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.post("/revoke", (req, res) => {
        // Token revocation handled at the manager level
        res.json({ ok: true, message: "Revocation delegated to manager" });
    });

    return router;
}

module.exports = createVmTokenRoutes;
