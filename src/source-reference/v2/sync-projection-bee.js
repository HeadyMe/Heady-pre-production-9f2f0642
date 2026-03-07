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

// ─── Template Injection ─────────────────────────────────────────────
// Renders fresh pages from template-bee and injects into HF Spaces.
function injectTemplatesIntoHFSpaces() {
    const results = [];
    try {
        const templateBee = require("./template-bee");
        const allTemplates = templateBee.getAllSiteTemplates();

        // Map domains to HF space directories
        const domainToSpace = {
            "headyme.com": "main",
            "headysystems.com": "systems",
            "headyconnection.org": "connection",
        };

        for (const [domainName, spaceName] of Object.entries(domainToSpace)) {
            const template = allTemplates[domainName];
            if (!template) {
                results.push({ space: spaceName, injected: false, reason: `No template for ${domainName}` });
                continue;
            }

            const spaceDir = path.join(HF_SPACES_DIR, spaceName);
            if (!fs.existsSync(spaceDir)) {
                fs.mkdirSync(spaceDir, { recursive: true });
            }

            // Render full page via template-bee
            const rendered = templateBee.renderSite(domainName);
            if (!rendered) {
                results.push({ space: spaceName, injected: false, reason: "renderSite returned null" });
                continue;
            }

            // Generate the injection payload — a full branded HTML page
            const html = generateFullPage(rendered, template);

            // Write to HF space
            const indexPath = path.join(spaceDir, "index.html");
            fs.writeFileSync(indexPath, html, "utf8");

            // Ensure README.md exists for HF static spaces
            const readmePath = path.join(spaceDir, "README.md");
            if (!fs.existsSync(readmePath)) {
                fs.writeFileSync(readmePath, `---\ntitle: ${template.name}\nemoji: ✦\ncolorFrom: indigo\ncolorTo: purple\nsdk: static\npinned: false\n---\n`, "utf8");
            }

            results.push({ space: spaceName, injected: true, domain: domainName, bytes: html.length });
        }
    } catch (e) {
        results.push({ space: "all", injected: false, error: e.message });
    }
    return results;
}

// ─── Full Page Generator ────────────────────────────────────────────
// Takes template-bee rendered data and produces a complete HTML page
// ready for injection into an HF Space or Cloudflare KV.
function generateFullPage(rendered, template) {
    const { name, tagline, accent, nav, authGate, cardHTML, statsHTML, sacredGeometry } = rendered;
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<!--
  © ${year} HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
  Auto-generated by sync-projection-bee — do not edit manually.
  Source of truth: RAM / vector space → site-registry.json → template-bee
  Sacred Geometry: ${sacredGeometry}
-->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — ${tagline}</title>
<meta name="description" content="${template.description || tagline}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:#0a0a0f;color:#e0e0e8;min-height:100vh;overflow-x:hidden}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;gap:1rem;padding:.8rem 2rem;background:rgba(10,10,15,0.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.04)}
.nav a{color:rgba(255,255,255,0.5);text-decoration:none;font-size:.78rem;font-weight:500;transition:color .2s}
.nav a:hover,.nav a.active{color:${accent}}
.hero{padding:8rem 2rem 4rem;text-align:center;position:relative}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:700;background:linear-gradient(135deg,#fff,${accent});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.8rem}
.hero p{color:rgba(255,255,255,0.45);font-size:1.1rem;max-width:600px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;max-width:1100px;margin:0 auto;padding:0 2rem 4rem}
.card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:2rem;transition:all .3s}
.card:hover{border-color:${accent}33;transform:translateY(-2px);box-shadow:0 8px 32px ${accent}08}
.card h3{font-size:1rem;font-weight:600;margin:.8rem 0 .4rem}
.card p{font-size:.82rem;color:rgba(255,255,255,0.4);line-height:1.5}
.ci{font-size:1.5rem}
.stats{display:flex;justify-content:center;gap:3rem;padding:2rem;margin-bottom:3rem}
.stat-val{font-size:1.8rem;font-weight:700;color:${accent}}
.stat-lbl{font-size:.7rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.08em}
footer{text-align:center;padding:2rem;color:rgba(255,255,255,0.15);font-size:.7rem;border-top:1px solid rgba(255,255,255,0.03)}
</style>
</head>
<body>
<nav class="nav">${nav}</nav>
<section class="hero">
<h1>${name}</h1>
<p>${tagline}</p>
</section>
${statsHTML ? `<div class="stats">${statsHTML}</div>` : ""}
<section class="cards">${cardHTML}</section>
<footer>© ${year} HeadySystems Inc. · Sacred Geometry: ${sacredGeometry}</footer>
${authGate}
</body>
</html>`;
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
