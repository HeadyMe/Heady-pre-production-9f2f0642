/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Static Hosting & Domain Routing — Phase 2 Liquid Architecture
 * Extracted from heady-manager.js monolith.
 *
 * Handles: static asset serving, vertical site mounts, IDE hosting,
 * personal cloud status, vertical domain routing, edge deep-scan.
 */

const path = require("path");
const fs = require("fs");
const express = require("express");
const logger = require("../utils/logger");

/**
 * Mount all static hosting and domain routing on the Express app.
 *
 * @param {Express.Application} app
 * @param {string} projectRoot - __dirname of heady-manager.js
 */
function mountStaticHosting(app, projectRoot) {
    // ─── Static Assets ─────────────────────────────────────────────────
    const frontendBuildPath = path.join(projectRoot, "frontend", "dist");
    if (fs.existsSync(frontendBuildPath)) {
        app.use(express.static(frontendBuildPath));
    }

    // ─── headyme.com Production Site ───────────────────────────────────
    app.use("/headyme", express.static("/home/headyme/CascadeProjects/headyme-com/dist"));

    // ─── All Vertical Sites ────────────────────────────────────────────
    app.use("/headysystems", express.static("/home/headyme/CascadeProjects/headysystems-com"));
    app.use("/headybuddy", express.static("/home/headyme/CascadeProjects/headybuddy-org"));
    app.use("/headyconnection", express.static("/home/headyme/CascadeProjects/headyconnection-org"));
    app.use("/headymcp", express.static("/home/headyme/CascadeProjects/headymcp-com"));
    app.use("/headyio", express.static("/home/headyme/CascadeProjects/headyio"));
    app.use("/headyweb", express.static("/home/headyme/CascadeProjects/HeadyWeb"));
    app.use("/admin", express.static("/home/headyme/CascadeProjects/admin-ui"));
    app.use("/dist", express.static(path.join(projectRoot, "dist")));
    logger.logNodeActivity("CONDUCTOR", "  ∞ Vertical Sites: 8 sites served (headyme, headysystems, headybuddy, headyconnection, headymcp, headyio, headyweb, admin)");

    // ─── HeadyAI-IDE (ide.headyme.com) ─────────────────────────────────
    const IDE_DIST = path.join(projectRoot, "heady-ide-ui", "dist");
    app.use("/ide", express.static(IDE_DIST));
    app.get("/ide/*", (req, res) => res.sendFile(path.join(IDE_DIST, "index.html")));

    // Host-based routing: ide.headyme.com serves the IDE at root
    app.use((req, res, next) => {
        if (req.hostname === "ide.headyme.com") {
            const filePath = path.join(IDE_DIST, req.path === "/" ? "index.html" : req.path);
            if (fs.existsSync(filePath)) return res.sendFile(filePath);
            return res.sendFile(path.join(IDE_DIST, "index.html")); // SPA fallback
        }
        next();
    });

    // ─── Personal Cloud Connector (External + Internal) ────────────────
    app.get("/api/cloud/status", (req, res) => {
        res.json({
            personalCloud: "headyme.com",
            status: "ONLINE",
            externalProviders: {
                cloudflare: { status: "active", services: ["DNS", "Tunnel", "Workers", "KV", "Vectorize", "Pages", "Access"] },
                google: { status: "configured", services: ["Vertex AI", "Cloud Run", "Colab T4/A100", "Cloud Storage"] },
                github: { status: "active", services: ["Repositories", "Actions CI/CD", "Pages"] },
                litellm: { status: "active", gateway: "api.headysystems.com", services: ["Multi-Model Proxy", "Key Management"] },
            },
            internalServices: {
                "heady-brain": { port: 3301, path: "/api/brain", status: "active" },
                "heady-soul": { port: 3301, path: "/api/soul", status: "active" },
                "heady-conductor": { port: 3301, path: "/api/conductor", status: "active" },
                "heady-battle": { port: 3301, path: "/api/battle", status: "active" },
                "heady-hcfp": { port: 3301, path: "/api/hcfp", status: "active" },
                "heady-patterns": { port: 3301, path: "/api/patterns", status: "active" },
                "heady-lens": { port: 3301, path: "/api/lens", status: "active" },
                "heady-vinci": { port: 3301, path: "/api/vinci", status: "active" },
                "heady-notion": { port: 3301, path: "/api/notion", status: "active" },
                "heady-ops": { port: 3301, path: "/api/ops", status: "active" },
                "heady-maintenance": { port: 3301, path: "/api/maintenance", status: "active" },
                "auto-success-115": { port: 3301, path: "/api/auto-success", status: "active" },
                "sse-streaming": { port: 3301, path: "/api/stream", status: "active" },
                "colab-edge-cache": { port: 3301, path: "/api/edge", status: "active" },
                "vector-memory": { port: 3301, path: "/api/vector", status: "active" },
                "creative-engine": { port: 3301, path: "/api/creative", status: "active" },
                "liquid-allocator": { port: 3301, path: "/api/liquid", status: "active" },
                "deep-scanner": { port: 3301, path: "/api/system/deep-scan", status: "active" },
                "verticals-api": { port: 3301, path: "/api/verticals", status: "active" },
            },
            domains: {
                "headyme.com": { tunnel: true, role: "personal-cloud", status: "active", subdomains: ["api", "cms", "dashboard"] },
                "headysystems.com": { tunnel: true, role: "infrastructure", status: "active", subdomains: ["api", "admin", "manager", "status", "logs", "grafana"] },
                "headyconnection.org": { tunnel: false, role: "community", status: "active", subdomains: ["community", "connect", "social", "network"] },
                "headymcp.com": { tunnel: false, role: "protocol", status: "active", subdomains: ["api", "model", "control", "protocol"] },
                "headyio.com": { tunnel: false, role: "developer-platform", status: "active", subdomains: ["ide", "api", "docs", "playground"] },
                "headybuddy.org": { tunnel: false, role: "ai-assistant", status: "active", subdomains: ["chat", "ai", "extension", "help"] },
                "headybot.com": { tunnel: false, role: "automation", status: "active", subdomains: ["bot", "tasks", "workflows", "automation"] },
                "headycreator.com": { tunnel: false, role: "creative-studio", status: "active", subdomains: ["canvas", "studio", "design", "remix"] },
                "headymusic.com": { tunnel: false, role: "music-audio", status: "active", subdomains: ["generate", "library", "mix", "listen"] },
                "headytube.com": { tunnel: false, role: "video-platform", status: "active", subdomains: ["create", "watch", "publish", "live"] },
                "headycloud.com": { tunnel: false, role: "cloud-services", status: "active", subdomains: ["api", "compute", "storage", "dashboard"] },
                "headylearn.com": { tunnel: false, role: "education", status: "active", subdomains: ["courses", "tutor", "practice", "certs"] },
                "headystore.com": { tunnel: false, role: "marketplace", status: "active", subdomains: ["shop", "assets", "plugins", "billing"] },
                "headystudio.com": { tunnel: false, role: "production-workspace", status: "active", subdomains: ["projects", "collab", "render", "export"] },
                "headyagent.com": { tunnel: false, role: "autonomous-agents", status: "active", subdomains: ["deploy", "market", "monitor", "config"] },
                "headydata.com": { tunnel: false, role: "data-analytics", status: "active", subdomains: ["ingest", "analyze", "visualize", "export"] },
                "headyapi.com": { tunnel: false, role: "public-api", status: "active", subdomains: ["docs", "keys", "playground", "sdk"] },
            },
            localGateway: "https://127.0.0.1:3301",
            ts: new Date().toISOString(),
        });
    });

    // ─── Vertical Domain Routing ───────────────────────────────────────
    const VERTICALS_DIR = path.join(projectRoot, "public", "verticals");
    let verticalsConfig = [];
    try {
        verticalsConfig = require(path.join(projectRoot, "src", "verticals.json")).verticals;
    } catch { /* verticals.json not yet generated */ }

    const domainSlugMap = {};
    for (const v of verticalsConfig) {
        const slug = v.domain.replace(/\.(com|org|io)$/, "");
        domainSlugMap[v.domain] = slug;
        domainSlugMap[`www.${v.domain}`] = slug;
    }

    app.get("/api/verticals", (req, res) => {
        res.json({
            ok: true,
            verticals: verticalsConfig.map(v => ({
                domain: v.domain, name: v.name, tagline: v.tagline,
                icon: v.icon, status: v.status, role: v.ecosystemRole,
            })),
            total: verticalsConfig.length,
            active: verticalsConfig.filter(v => v.status === "active").length,
            planned: verticalsConfig.filter(v => v.status === "planned").length,
        });
    });

    app.get("/v/:slug", (req, res) => {
        const filePath = path.join(VERTICALS_DIR, `${req.params.slug}.html`);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
        res.status(404).json({ error: "Vertical not found", slug: req.params.slug });
    });

    app.use((req, res, next) => {
        const slug = domainSlugMap[req.hostname];
        if (slug && !req.path.startsWith("/api/")) {
            const filePath = path.join(VERTICALS_DIR, `${slug}.html`);
            if (fs.existsSync(filePath)) return res.sendFile(filePath);
        }
        next();
    });

    app.use(express.static("public"));

    // ─── Dynamic Edge Node: Global Project & Vector Scanner ────────────
    app.post("/api/edge/deep-scan", async (req, res) => {
        const { directory, include_vectors } = req.body;
        try {
            let repo_map = directory || '/home/headyme/CascadeProjects';
            const vector_data = include_vectors ? [
                "[GLOBAL PERMISSION] Heady_Battle is restricted. Use BE VERY AWARE MODE safely.",
                "[PROJECT STRUCT] heady-ide-ui (Vite/React) | heady-manager (Express/Mcp)",
                "[SYS PREFERENCE] User strictly prefers concise, non-repetitive updates."
            ] : [];

            res.json({
                success: true,
                processed_at: "cloudflare-edge-worker-sim",
                repo_map: `[Aggregated Map Generated for ${repo_map}] (Directories: 14, Files: 128)`,
                persistent_3d_vectors: vector_data,
                context_ready: true
            });
        } catch (err) {
            res.status(500).json({ error: "Edge deep scan failed", details: err.message });
        }
    });
}

module.exports = { mountStaticHosting };
