/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Sync Projection Bee ════════════════════════════════════════════
 *
 * RAM-first architecture: all Heady operations happen in memory
 * (vector space). External stores are PROJECTIONS that auto-sync
 * only when RAM state changes.
 *
 * This bee:
 *  1. Maintains a SHA-256 hash of current RAM state (site-registry + templates)
 *  2. On delta detection, calls template-bee to render fresh pages
 *  3. Injects rendered templates into HF Spaces, GitHub, Cloudflare
 *  4. Commits and pushes changes automatically
 *
 * External targets are projections, NOT sources of truth.
 * The source of truth is always in RAM / vector space.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const domain = "sync-projection";
const description = "RAM-first auto-sync: detects state deltas, renders templates, projects to GitHub/HF/Cloudflare";
const priority = 0.95; // High — keeps all external stores current

const PROJECT_ROOT = path.join(__dirname, "../..");
const HF_SPACES_DIR = path.join(PROJECT_ROOT, "heady-hf-spaces");

// ─── In-Memory State Tracking ───────────────────────────────────────
// These live in RAM and are the single source of truth for sync state.
const _syncState = {
    lastRegistryHash: null,
    lastProjectionTime: null,
    projectionCount: 0,
    targets: {
        github: { lastSync: null, hash: null, status: "idle" },
        hfSpaces: { lastSync: null, hash: null, status: "idle" },
        cloudflare: { lastSync: null, hash: null, status: "idle" },
    },
};

// ─── RAM State Hashing ──────────────────────────────────────────────
// Hash the current in-memory state to detect changes.
function computeRAMStateHash() {
    const stateComponents = [];

    // 1. Site registry (the template source data)
    try {
        const registryPath = path.join(PROJECT_ROOT, "src/sites/site-registry.json");
        stateComponents.push(fs.readFileSync(registryPath, "utf8"));
    } catch { stateComponents.push("registry-missing"); }

    // 2. Template bee module (rendering logic)
    try {
        const templatePath = path.join(PROJECT_ROOT, "src/bees/template-bee.js");
        stateComponents.push(fs.readFileSync(templatePath, "utf8"));
    } catch { stateComponents.push("template-missing"); }

    // 3. HF space shared assets
    try {
        const sharedDir = path.join(HF_SPACES_DIR, "shared");
        if (fs.existsSync(sharedDir)) {
            const files = fs.readdirSync(sharedDir);
            for (const f of files) {
                stateComponents.push(fs.readFileSync(path.join(sharedDir, f), "utf8"));
            }
        }
    } catch { }

    return crypto.createHash("sha256")
        .update(stateComponents.join("\n---STATE-BOUNDARY---\n"))
        .digest("hex");
}

// ─── Delta Detection ────────────────────────────────────────────────
function hasStateChanged() {
    const currentHash = computeRAMStateHash();
    if (currentHash !== _syncState.lastRegistryHash) {
        _syncState.lastRegistryHash = currentHash;
        return true;
    }
    return false;
}

// ─── Premium Renderer Integration ───────────────────────────────────
// Uses site-projection-renderer for full premium HTML generation.
let _siteRenderer = null;
function getSiteRenderer() {
    if (_siteRenderer) return _siteRenderer;
    try {
        _siteRenderer = require("../projection/site-projection-renderer");
    } catch { _siteRenderer = null; }
    return _siteRenderer;
}

// ─── Template Injection ─────────────────────────────────────────────
// Renders fresh pages from site-projection-renderer and injects into HF Spaces.
function injectTemplatesIntoHFSpaces() {
    const results = [];
    try {
        const renderer = getSiteRenderer();
        if (!renderer) {
            results.push({ space: "all", injected: false, error: "site-projection-renderer not available" });
            return results;
        }

        const allSites = renderer.renderAllSites();

        // Map domains to HF space directories
        const domainToSpace = {
            "headyme.com": "main",
            "headysystems.com": "systems",
            "headyconnection.org": "connection",
            "heady-ai.com": "heady-ai",
            "headyos.com": "headyos",
            "headyex.com": "exchange",
            "headyfinance.com": "investments",
            "headyconnection.com": "community",
            "admin.headysystems.com": "admin",
        };

        for (const [domainName, spaceName] of Object.entries(domainToSpace)) {
            const rendered = allSites[domainName];
            if (!rendered || !rendered.html) {
                results.push({ space: spaceName, injected: false, reason: `No rendering for ${domainName}` });
                continue;
            }

            const spaceDir = path.join(HF_SPACES_DIR, spaceName);
            if (!fs.existsSync(spaceDir)) {
                fs.mkdirSync(spaceDir, { recursive: true });
            }

            // Write premium HTML to HF space
            const indexPath = path.join(spaceDir, "index.html");
            fs.writeFileSync(indexPath, rendered.html, "utf8");

            // Ensure README.md exists for HF static spaces
            const readmePath = path.join(spaceDir, "README.md");
            if (!fs.existsSync(readmePath)) {
                fs.writeFileSync(readmePath, `---\ntitle: ${rendered.slug}\nemoji: ✦\ncolorFrom: indigo\ncolorTo: purple\nsdk: static\npinned: false\n---\n`, "utf8");
            }

            results.push({ space: spaceName, injected: true, domain: domainName, bytes: rendered.bytes });
        }

        // Also project to dev folder (services/heady-web/sites/)
        try { renderer.projectToDevFolder(); } catch { }

    } catch (e) {
        results.push({ space: "all", injected: false, error: e.message });
    }
    return results;
}

// ─── Legacy Full Page Generator (deprecated — use site-projection-renderer) ─
function generateFullPage(rendered, template) {
    const renderer = getSiteRenderer();
    if (renderer && template) {
        try { return renderer.renderSiteToHTML(template); } catch { }
    }
    // Fallback to minimal template
    const { name, tagline, accent, nav, authGate, cardHTML, statsHTML, sacredGeometry } = rendered;
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — ${tagline}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e0e0e8;min-height:100vh}</style>
</head><body>
<h1 style="text-align:center;padding:4rem">${name} — ${tagline}</h1>
<p style="text-align:center;color:#666">Generated by sync-projection-bee (minimal fallback). Sacred Geometry: ${sacredGeometry}</p>
${authGate || ""}
</body></html>`;
}

// ─── Git Projection ─────────────────────────────────────────────────
// Stages, commits, and pushes changed files to GitHub.
function projectToGitHub(changedFiles) {
    try {
        const { execSync } = require("child_process");
        for (const f of changedFiles) {
            execSync(`git add "${f}"`, { cwd: PROJECT_ROOT, encoding: "utf8" });
        }
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        execSync(`git commit -m "[sync-projection] auto-inject templates ${ts}" --allow-empty`, { cwd: PROJECT_ROOT });
        execSync("git push origin main", { cwd: PROJECT_ROOT });

        _syncState.targets.github.lastSync = new Date().toISOString();
        _syncState.targets.github.status = "synced";
        return { ok: true, files: changedFiles.length };
    } catch (e) {
        _syncState.targets.github.status = "error";
        return { ok: false, error: e.message };
    }
}

// ─── Bee Work Functions ─────────────────────────────────────────────
function getWork(ctx = {}) {
    return [
        // 1. RAM State Delta Check — detect if anything changed
        async () => {
            const changed = hasStateChanged();
            return {
                bee: domain, action: "delta-check",
                stateChanged: changed,
                currentHash: _syncState.lastRegistryHash?.substring(0, 16) + "...",
                projectionCount: _syncState.projectionCount,
            };
        },

        // 2. Template Injection — render and inject into HF Spaces
        async () => {
            // Only inject if state has changed or forced
            if (!ctx.force && !hasStateChanged() && _syncState.projectionCount > 0) {
                return { bee: domain, action: "template-inject", skipped: true, reason: "No state change" };
            }
            const results = injectTemplatesIntoHFSpaces();
            _syncState.projectionCount++;
            _syncState.lastProjectionTime = new Date().toISOString();
            _syncState.targets.hfSpaces.lastSync = _syncState.lastProjectionTime;
            _syncState.targets.hfSpaces.status = results.every(r => r.injected) ? "synced" : "partial";
            return { bee: domain, action: "template-inject", results, projectionCount: _syncState.projectionCount };
        },

        // 3. Sync State Report — expose current projection status
        async () => {
            return {
                bee: domain, action: "sync-status",
                lastProjection: _syncState.lastProjectionTime,
                projectionCount: _syncState.projectionCount,
                targets: Object.entries(_syncState.targets).map(([k, v]) => ({
                    target: k, status: v.status, lastSync: v.lastSync,
                })),
            };
        },
    ];
}

module.exports = {
    domain,
    description,
    priority,
    getWork,
    // API for other bees and orchestrator
    computeRAMStateHash,
    hasStateChanged,
    injectTemplatesIntoHFSpaces,
    projectToGitHub,
    generateFullPage,
    getSyncState: () => ({ ..._syncState }),
};
