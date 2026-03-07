/**
 * ∞ Auth Engine — Phase 3 Bootstrap
 * Extracted from heady-manager.js lines 396-446
 * HeadyAuth + fallback login + service groups
 */
module.exports = function mountAuth(app, { logger, secretsManager, cfManager }) {
    let authEngine = null;

    try {
        const { HeadyAuth, registerAuthRoutes } = require('../hc_auth');
        authEngine = new HeadyAuth({
            adminKey: process.env.HEADY_API_KEY,
            googleClientId: process.env.GOOGLE_CLIENT_ID,
            googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
            googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
        });
        registerAuthRoutes(app, authEngine);
        logger.logNodeActivity("CONDUCTOR", "  🔐 HeadyAuth: LOADED (4 methods: manual, device, WARP, Google OAuth)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyAuth not loaded: ${err.message}`);
        // Fallback auth
        app.post("/api/auth/login", (req, res) => {
            const { username, password } = req.body;
            if (username === "admin" && password === process.env.ADMIN_TOKEN) {
                res.json({ success: true, token: process.env.HEADY_API_KEY, tier: "admin" });
            } else if (username) {
                res.json({ success: true, token: "user_token_" + Date.now(), tier: "core" });
            } else {
                res.status(401).json({ error: "Invalid credentials" });
            }
        });
        app.get("/api/auth/policy", (req, res) => {
            const token = req.headers['authorization']?.split(' ')[1];
            const tier = token === process.env.HEADY_API_KEY ? "admin" : "core";
            res.json({ active_policy: tier === "admin" ? "UNRESTRICTED" : "STANDARD" });
        });
    }

    app.get("/api/services/groups", (req, res) => {
        const token = req.headers['authorization']?.split(' ')[1];
        const tier = (authEngine && authEngine.verify(token)?.tier) || (token === process.env.HEADY_API_KEY ? "admin" : "core");
        const groups = { core: ["heady_chat", "heady_analyze"], premium: ["heady_battle", "heady_orchestrator", "heady_creative"] };
        if (tier === "admin") {
            res.json({ tier, groups: ["core", "premium"], services: [...groups.core, ...groups.premium] });
        } else {
            res.json({ tier, groups: ["core"], services: groups.core });
        }
    });

    return { authEngine };
};
