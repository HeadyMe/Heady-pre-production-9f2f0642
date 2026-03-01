/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * DYNAMIC SITE HOSTING — Replaces static file serving
 * ═══════════════════════════════════════════════════════
 * One template engine serves all domains dynamically.
 * No static HTML files. No React build. No Cloudflare tunnel.
 * Domain → config lookup → server-rendered HTML → response.
 *
 * Preconfigured: headyme.com, headysystems.com, headyconnection.org,
 *   headymcp.com, headyos.com, headyapi.com, headyio.com
 * Custom: User-created sites from onboarding (data/user-sites.json)
 * ═══════════════════════════════════════════════════════
 */

"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const { renderSite, resolveSite, resolveSiteBySlug } = require("../sites/site-renderer");
const registry = require("../sites/site-registry.json");

const USER_SITES_PATH = path.join(__dirname, "..", "..", "data", "user-sites.json");

function mountStaticHosting(app, projectRoot) {

    // ─── Static Assets (icons, manifests, service worker) ─────────────
    app.use("/icons", express.static(path.join(projectRoot, "public", "icons")));
    app.use("/manifests", express.static(path.join(projectRoot, "public", "manifests")));
    app.use("/heady-icon-192.png", express.static(path.join(projectRoot, "public", "heady-icon-192.png")));
    app.use("/heady-icon-512.png", express.static(path.join(projectRoot, "public", "heady-icon-512.png")));
    app.use("/.well-known", express.static(path.join(projectRoot, "public", ".well-known")));
    app.use("/sw.js", express.static(path.join(projectRoot, "public", "sw.js")));
    app.use("/manifest.json", express.static(path.join(projectRoot, "public", "manifest.json")));

    // ─── Slug-based routing (/v/:slug) ────────────────────────────────
    app.get("/v/:slug", (req, res) => {
        const site = resolveSiteBySlug(req.params.slug);
        if (!site) return res.status(404).json({ error: "Site not found", slug: req.params.slug });
        res.type("html").send(renderSite(site));
    });

    // ─── Site Registry API ────────────────────────────────────────────
    app.get("/api/sites", (req, res) => {
        const sites = [];
        for (const [domain, cfg] of Object.entries(registry.preconfigured)) {
            sites.push({ domain, name: cfg.name, tagline: cfg.tagline, role: cfg.role, type: "preconfigured", accent: cfg.accent });
        }
        try {
            if (fs.existsSync(USER_SITES_PATH)) {
                const userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
                for (const [domain, cfg] of Object.entries(userSites)) {
                    sites.push({ domain, name: cfg.name, tagline: cfg.tagline, role: cfg.role || "custom", type: "custom", accent: cfg.accent });
                }
            }
        } catch { }
        res.json({ ok: true, sites, total: sites.length, preconfigured: Object.keys(registry.preconfigured).length });
    });

    // ─── Onboarding: Create Custom Site ───────────────────────────────
    app.post("/api/sites/create", express.json(), (req, res) => {
        const { domain, name, tagline, description, accent, sacredGeometry, features, stats, chatEnabled, customCSS } = req.body;
        if (!domain || !name || !tagline) {
            return res.status(400).json({ error: "domain, name, and tagline are required" });
        }
        // Don't overwrite preconfigured
        if (registry.preconfigured[domain]) {
            return res.status(409).json({ error: `${domain} is a preconfigured site and cannot be overwritten` });
        }

        try {
            const dataDir = path.dirname(USER_SITES_PATH);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            let userSites = {};
            if (fs.existsSync(USER_SITES_PATH)) {
                userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
            }

            const slug = domain.replace(/\.(com|org|io|net)$/, "");
            userSites[domain] = {
                name, tagline, description: description || "",
                slug,
                role: "custom",
                sacredGeometry: sacredGeometry || "Flower of Life",
                accent: accent || "#818cf8",
                accentDark: accent ? darkenColor(accent) : "#6366f1",
                features: (features || []).slice(0, 6),
                stats: (stats || []).slice(0, 4),
                chatEnabled: chatEnabled !== false,
                customCSS: customCSS || "",
                createdAt: new Date().toISOString(),
            };

            fs.writeFileSync(USER_SITES_PATH, JSON.stringify(userSites, null, 2));
            res.json({ ok: true, domain, site: userSites[domain], preview: `/v/${slug}` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Onboarding: Update Custom Site ───────────────────────────────
    app.put("/api/sites/:domain", express.json(), (req, res) => {
        const domain = req.params.domain;
        if (registry.preconfigured[domain]) {
            return res.status(409).json({ error: `${domain} is preconfigured` });
        }
        try {
            let userSites = {};
            if (fs.existsSync(USER_SITES_PATH)) {
                userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
            }
            if (!userSites[domain]) return res.status(404).json({ error: "Site not found" });

            const updates = req.body;
            userSites[domain] = { ...userSites[domain], ...updates, updatedAt: new Date().toISOString() };
            fs.writeFileSync(USER_SITES_PATH, JSON.stringify(userSites, null, 2));
            res.json({ ok: true, site: userSites[domain] });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Delete Custom Site ───────────────────────────────────────────
    app.delete("/api/sites/:domain", (req, res) => {
        const domain = req.params.domain;
        if (registry.preconfigured[domain]) {
            return res.status(409).json({ error: `${domain} is preconfigured` });
        }
        try {
            let userSites = {};
            if (fs.existsSync(USER_SITES_PATH)) {
                userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
            }
            if (!userSites[domain]) return res.status(404).json({ error: "Site not found" });
            delete userSites[domain];
            fs.writeFileSync(USER_SITES_PATH, JSON.stringify(userSites, null, 2));
            res.json({ ok: true, deleted: domain });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Cloud Status API ─────────────────────────────────────────────
    app.get("/api/cloud/status", (req, res) => {
        res.json({
            personalCloud: "headyme.com",
            status: "ONLINE",
            domains: Object.keys(registry.preconfigured),
            externalLinks: registry.externalLinks,
            rendering: "dynamic-server-side",
            ts: new Date().toISOString(),
        });
    });

    // ─── Domain-based Rendering (catch-all for host routing) ──────────
    // This must come AFTER all API routes
    app.use((req, res, next) => {
        // Skip API routes and static assets
        if (req.path.startsWith("/api/") || req.path.startsWith("/health/") ||
            req.path.startsWith("/icons/") || req.path.startsWith("/manifests/") ||
            req.path.startsWith("/.well-known/") ||
            req.path === "/sw.js" || req.path === "/manifest.json" ||
            req.path === "/healthz" || req.path.startsWith("/heady-icon-")) {
            return next();
        }

        // Resolve the site for this hostname
        const site = resolveSite(req.hostname);
        if (site) {
            return res.type("html").send(renderSite(site));
        }
        next();
    });

    console.log(`  ∞ Dynamic Site Hosting: ${Object.keys(registry.preconfigured).length} preconfigured sites`);
    console.log(`    → Domains: ${Object.keys(registry.preconfigured).join(", ")}`);
    console.log(`    → Custom sites via POST /api/sites/create`);
    console.log(`    → Slug access via /v/:slug`);
}

/**
 * Simple color darkener — shifts hex towards darker shade
 */
function darkenColor(hex) {
    const v = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, ((v >> 16) & 255) - 30);
    const g = Math.max(0, ((v >> 8) & 255) - 30);
    const b = Math.max(0, (v & 255) - 30);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

module.exports = { mountStaticHosting };
