#!/usr/bin/env node
/**
 * ─── Heady SEO Generator ──────────────────────────────────────────
 * Generates production SEO essentials for all vertical sites:
 * favicon.svg, robots.txt, sitemap.xml, manifest.json, 404.html
 * 
 * Run: node scripts/generate-seo.js
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const CASCADE = "/home/headyme/CascadeProjects";

const SITES = [
    {
        dir: "headysystems-com",
        name: "Heady Systems",
        domain: "headysystems.com",
        description: "The unified AI ecosystem — Brain, Battle, Creative, MCP, and 40+ services.",
        color: "#6366f1",
    },
    {
        dir: "headyme-com",
        name: "HeadyMe",
        domain: "headyme.com",
        description: "Sacred Geometry AI Platform — personal AI with HeadySoul integration.",
        color: "#8b5cf6",
        subdir: "dist",
    },
    {
        dir: "headybuddy-org",
        name: "HeadyBuddy",
        domain: "headybuddy.org",
        description: "The ultimate AI companion — voice, chat, cross-device, always learning.",
        color: "#10b981",
    },
    {
        dir: "headyconnection-org",
        name: "HeadyConnection",
        domain: "headyconnection.org",
        description: "Partnership and connector ecosystem — integrate with Heady services.",
        color: "#f59e0b",
    },
    {
        dir: "headymcp-com",
        name: "HeadyMCP",
        domain: "headymcp.com",
        description: "Model Context Protocol hub — 30+ tools, dynamic routing, AI orchestration.",
        color: "#ec4899",
    },
    {
        dir: "headyio",
        name: "HeadyIO",
        domain: "headyio.com",
        description: "SDK integration platform — heady-hive-sdk, OpenAI bridge, GCloud bridge.",
        color: "#06b6d4",
    },
    {
        dir: "HeadyWeb",
        name: "HeadyWeb",
        domain: "headyweb.com",
        description: "Chromium-based AI browser — smarter search, AI sidebar, built-in tools.",
        color: "#3b82f6",
    },
    {
        dir: "admin-ui",
        name: "Heady Admin",
        domain: "admin.headyme.com",
        description: "Heady Systems administration — compute dashboard, agent orchestration, monitoring.",
        color: "#ef4444",
    },
];

// Sacred geometry infinity symbol favicon (SVG)
function faviconSVG(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${color}88"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#g)" stroke-width="3" opacity="0.3"/>
  <path d="M25 50 C25 30, 50 30, 50 50 C50 70, 75 70, 75 50 C75 30, 50 30, 50 50 C50 70, 25 70, 25 50Z" 
        fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}

function robotsTxt(domain) {
    return `User-agent: *
Allow: /

Sitemap: https://${domain}/sitemap.xml
`;
}

function sitemapXml(domain) {
    const now = new Date().toISOString().split("T")[0];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${domain}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>
</urlset>
`;
}

function manifestJson(name, color, description) {
    return JSON.stringify({
        name,
        short_name: name,
        description,
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a1a",
        theme_color: color,
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
    }, null, 2);
}

function page404(name, color) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 — ${name}</title>
    <style>
        body { margin:0; min-height:100vh; background:#0a0a1a; color:#e2e8f0;
               font-family:Inter,-apple-system,sans-serif;
               display:flex; align-items:center; justify-content:center; }
        .c { text-align:center; }
        h1 { font-size:6rem; background:linear-gradient(135deg,${color},${color}88);
             -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; }
        p { color:#94a3b8; font-size:1.1rem; margin:1rem 0; }
        a { color:${color}; text-decoration:none; border:1px solid ${color}44;
            padding:0.5rem 1.5rem; border-radius:8px; transition:all 0.2s; }
        a:hover { background:${color}22; }
    </style>
</head>
<body><div class="c">
    <h1>404</h1>
    <p>This page doesn't exist in the ${name} universe.</p>
    <a href="/">← Return Home</a>
</div></body>
</html>`;
}

// OG meta tags to inject into existing index.html
function ogTags(site) {
    return `    <meta property="og:title" content="${site.name}" />
    <meta property="og:description" content="${site.description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://${site.domain}/" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${site.name}" />
    <meta name="twitter:description" content="${site.description}" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />`;
}

// JSON-LD structured data
function jsonLD(site) {
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: site.name,
        url: `https://${site.domain}`,
        description: site.description,
        applicationCategory: "AI Platform",
        operatingSystem: "Web",
        creator: { "@type": "Organization", name: "Heady Systems" },
    });
}

// ── Generate ────────────────────────────────────────────────────
let generated = 0;
for (const site of SITES) {
    const baseDir = path.join(CASCADE, site.dir);
    const targetDir = site.subdir ? path.join(baseDir, site.subdir) : baseDir;

    if (!fs.existsSync(targetDir)) {
        console.log(`  ⚠ Skipping ${site.dir} — directory not found`);
        continue;
    }

    // Generate files
    fs.writeFileSync(path.join(targetDir, "favicon.svg"), faviconSVG(site.color));
    fs.writeFileSync(path.join(targetDir, "robots.txt"), robotsTxt(site.domain));
    fs.writeFileSync(path.join(targetDir, "sitemap.xml"), sitemapXml(site.domain));
    fs.writeFileSync(path.join(targetDir, "manifest.json"), manifestJson(site.name, site.color, site.description));
    fs.writeFileSync(path.join(targetDir, "404.html"), page404(site.name, site.color));

    // Inject OG tags into index.html if they're not already there
    const indexPath = path.join(targetDir, "index.html");
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf-8");
        if (!html.includes("og:title")) {
            const tags = ogTags(site);
            const ldScript = `    <script type="application/ld+json">${jsonLD(site)}</script>`;
            html = html.replace("</head>", `${tags}\n${ldScript}\n  </head>`);
            fs.writeFileSync(indexPath, html);
            console.log(`  ✅ ${site.dir}: OG + JSON-LD injected`);
        } else {
            console.log(`  ⚠ ${site.dir}: OG tags already present`);
        }
    }

    generated++;
    console.log(`  ✅ ${site.dir}: favicon + robots + sitemap + manifest + 404`);
}

console.log(`\n  ∞ Generated SEO essentials for ${generated}/${SITES.length} sites`);
